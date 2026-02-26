import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/files/service", () => ({
  FileServiceError: class FileServiceError extends Error {
    code: string;
    statusCode: number;

    constructor(message: string, code = "internal_error", statusCode = 500) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  },
  readFileForViewer: vi.fn(),
  resolveReadableFileAbsolutePath: vi.fn(),
}));

import { GET } from "@/app/api/v1/files/asset/route";
import {
  FileServiceError,
  readFileForViewer,
  resolveReadableFileAbsolutePath,
} from "@/lib/server/modules/files/service";

describe("GET /api/v1/files/asset", () => {
  let tempDir = "";
  let assetFile = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "home-server-asset-"));
    assetFile = path.join(tempDir, "photo.png");
    await writeFile(assetFile, Buffer.from([1, 2, 3, 4]));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("requires path query parameter", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/v1/files/asset"),
    );
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(json.code).toBe("invalid_path");
  });

  it("returns 415 for unsupported preview modes", async () => {
    vi.mocked(readFileForViewer).mockResolvedValueOnce({
      root: "/",
      path: "Documents/notes.txt",
      name: "notes.txt",
      ext: "txt",
      mode: "text",
      mimeType: "text/plain; charset=utf-8",
      sizeBytes: 5,
      modifiedAt: "2026-02-26T12:00:00.000Z",
      mtimeMs: 1,
      content: "hello",
    });

    const response = await GET(
      new NextRequest("http://localhost/api/v1/files/asset?path=Documents/notes.txt"),
    );
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(415);
    expect(json.code).toBe("unsupported_file");
  });

  it("streams image asset content", async () => {
    vi.mocked(readFileForViewer).mockResolvedValueOnce({
      root: "/",
      path: "Media/photo.png",
      name: "photo.png",
      ext: "png",
      mode: "image",
      mimeType: "image/png",
      sizeBytes: 4,
      modifiedAt: "2026-02-26T12:00:00.000Z",
      mtimeMs: 5,
      content: null,
    });
    vi.mocked(resolveReadableFileAbsolutePath).mockResolvedValueOnce({
      root: "/",
      path: "Media/photo.png",
      absolutePath: assetFile,
    });

    const response = await GET(
      new NextRequest("http://localhost/api/v1/files/asset?path=Media/photo.png"),
    );
    const body = await response.arrayBuffer();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Content-Length")).toBe("4");
    expect(body.byteLength).toBe(4);
  });

  it("maps service errors", async () => {
    vi.mocked(readFileForViewer).mockRejectedValueOnce(
      new FileServiceError("blocked", "symlink_blocked", 403),
    );

    const response = await GET(
      new NextRequest("http://localhost/api/v1/files/asset?path=bad"),
    );
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(403);
    expect(json.code).toBe("symlink_blocked");
  });
});
