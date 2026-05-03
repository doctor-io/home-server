package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime"
	"mime/multipart"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

var (
	filesRoot     string
	sessionSecret []byte
)

func main() {
	filesRoot = getEnv("FILES_ROOT", "/DATA")
	sessionSecret = []byte(mustGetEnv("AUTH_SESSION_SECRET"))
	addr := getEnv("UPLOAD_SERVER_ADDR", "/run/home-server/upload.sock")

	mux := http.NewServeMux()
	mux.HandleFunc("POST /upload", handleUpload)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	ln, err := listen(addr)
	if err != nil {
		log.Fatalf("failed to bind %s: %v", addr, err)
	}
	log.Printf("upload-server listening on %s (FILES_ROOT=%s)", addr, filesRoot)
	if err := http.Serve(ln, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func listen(addr string) (net.Listener, error) {
	if strings.Contains(addr, ":") {
		return net.Listen("tcp", addr)
	}
	// Unix socket: remove stale socket file from a previous run.
	_ = os.Remove(addr)
	if dir := filepath.Dir(addr); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("mkdir %s: %w", dir, err)
		}
	}
	ln, err := net.Listen("unix", addr)
	if err != nil {
		return nil, err
	}
	_ = os.Chmod(addr, 0660)
	return ln, nil
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func mustGetEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required environment variable %q is not set", key)
	}
	return v
}

// verifySessionToken validates a homeio_session cookie value.
// Token format: <sessionId>.<expiresAtEpochSeconds>.<hmacSHA256Hex>
// HMAC is computed over "<sessionId>.<expiresAtEpochSeconds>" using AUTH_SESSION_SECRET.
func verifySessionToken(token string) bool {
	// UUID uses hyphens (no dots), so splitting on "." gives exactly 3 parts.
	parts := strings.SplitN(token, ".", 3)
	if len(parts) != 3 {
		return false
	}
	sessionID, expiresStr, sig := parts[0], parts[1], parts[2]

	if sessionID == "" || expiresStr == "" || sig == "" {
		return false
	}

	expiresAt, err := strconv.ParseInt(expiresStr, 10, 64)
	if err != nil {
		return false
	}
	if time.Now().Unix() >= expiresAt {
		return false
	}

	payload := sessionID + "." + expiresStr
	mac := hmac.New(sha256.New, sessionSecret)
	mac.Write([]byte(payload))
	expected := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(expected), []byte(sig))
}

func authenticate(r *http.Request) bool {
	c, err := r.Cookie("homeio_session")
	if err != nil {
		return false
	}
	return verifySessionToken(c.Value)
}

// resolveFilesPath resolves a client-supplied relative path to an absolute path
// within filesRoot, rejecting any traversal attempts.
func resolveFilesPath(rel string) (string, error) {
	// filepath.Clean("/" + rel) collapses ".." without escaping the leading "/".
	cleaned := filepath.Clean("/" + rel)
	abs := filepath.Join(filesRoot, cleaned)
	root := filepath.Clean(filesRoot)
	if abs != root && !strings.HasPrefix(abs, root+string(filepath.Separator)) {
		return "", fmt.Errorf("path escapes files root")
	}
	return abs, nil
}

func isSafeName(name string, allowHidden bool) bool {
	name = strings.TrimSpace(name)
	if name == "" || name == "." || name == ".." {
		return false
	}
	if strings.ContainsAny(name, "/\\\x00") {
		return false
	}
	if !allowHidden && strings.HasPrefix(name, ".") {
		return false
	}
	return true
}

type uploadedEntry struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	SizeBytes int64  `json:"sizeBytes"`
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func handleUpload(w http.ResponseWriter, r *http.Request) {
	if !authenticate(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	mediaType, params, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "multipart/form-data" || params["boundary"] == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "multipart/form-data required"})
		return
	}

	mr := multipart.NewReader(r.Body, params["boundary"])

	var destRel string
	var includeHidden bool
	uploaded := make([]uploadedEntry, 0)
	skipped := make([]string, 0)

	// 1 MiB copy buffer per request — large enough to keep the disk write path fed
	// without allocating an unreasonable amount per concurrent upload.
	buf := make([]byte, 1<<20)

	for {
		part, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "multipart read error"})
			return
		}

		if part.FileName() == "" {
			// Form field — must appear before file parts (client guarantees this).
			data, _ := io.ReadAll(io.LimitReader(part, 4096))
			switch part.FormName() {
			case "path":
				destRel = string(data)
			case "includeHidden":
				includeHidden = string(data) == "true"
			}
			continue
		}

		fileName := part.FileName()

		if !isSafeName(fileName, includeHidden) {
			_, _ = io.Copy(io.Discard, part)
			skipped = append(skipped, fileName)
			continue
		}

		destAbs, err := resolveFilesPath(destRel)
		if err != nil {
			_, _ = io.Copy(io.Discard, part)
			skipped = append(skipped, fileName)
			continue
		}

		// Destination must be an existing real directory (not a symlink).
		info, err := os.Lstat(destAbs)
		if err != nil || !info.IsDir() {
			_, _ = io.Copy(io.Discard, part)
			skipped = append(skipped, fileName)
			continue
		}

		targetAbs := filepath.Join(destAbs, fileName)
		root := filepath.Clean(filesRoot)
		if !strings.HasPrefix(targetAbs, root+string(filepath.Separator)) {
			_, _ = io.Copy(io.Discard, part)
			skipped = append(skipped, fileName)
			continue
		}

		// Skip if already exists (mirrors TypeScript behaviour).
		if _, err := os.Lstat(targetAbs); err == nil {
			_, _ = io.Copy(io.Discard, part)
			skipped = append(skipped, fileName)
			continue
		}

		f, err := os.OpenFile(targetAbs, os.O_CREATE|os.O_WRONLY|os.O_EXCL, 0644)
		if err != nil {
			_, _ = io.Copy(io.Discard, part)
			skipped = append(skipped, fileName)
			continue
		}

		n, copyErr := io.CopyBuffer(f, part, buf)
		f.Close()
		if copyErr != nil {
			_ = os.Remove(targetAbs)
			skipped = append(skipped, fileName)
			continue
		}

		relPath, _ := filepath.Rel(filesRoot, targetAbs)
		uploaded = append(uploaded, uploadedEntry{
			Name:      fileName,
			Path:      filepath.ToSlash(relPath),
			SizeBytes: n,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"data": map[string]any{
			"uploaded": uploaded,
			"skipped":  skipped,
		},
	})
}
