#!/usr/bin/env bash
set -Eeuo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_NAME="home-server"
INSTALL_DIR="${HOMEIO_INSTALL_DIR:-/opt/home-server}"
ENV_FILE="${HOMEIO_ENV_FILE:-${INSTALL_DIR}/.env}"
SERVICE_NAME="${HOMEIO_SERVICE_NAME:-home-server}"
DBUS_SERVICE_NAME="${HOMEIO_DBUS_SERVICE_NAME:-home-server-dbus}"
APP_PORT="${HOMEIO_APP_PORT:-${HOMEIO_PORT:-12026}}"
PUBLIC_PORT="${HOMEIO_PUBLIC_PORT:-80}"
NGINX_SITE_NAME="${HOMEIO_NGINX_SITE_NAME:-home-server}"
REPO_URL="${HOMEIO_REPO_URL:-https://github.com/doctor-io/homeio.git}"
# Default to the currently checked-out branch so updates stay on the same track.
# Override with HOMEIO_REPO_BRANCH=<branch> if you want to switch tracks.
REPO_BRANCH="${HOMEIO_REPO_BRANCH:-}"

HOMEIO_RELEASE_TAG="${HOMEIO_RELEASE_TAG:-}"
HOMEIO_RELEASE_TARBALL_URL="${HOMEIO_RELEASE_TARBALL_URL:-}"
HOMEIO_CREATE_BACKUP="${HOMEIO_CREATE_BACKUP:-true}"
HOMEIO_BACKUP_ROOT="${HOMEIO_BACKUP_ROOT:-/var/backups/home-server/releases}"
HOMEIO_HEALTHCHECK_URL="${HOMEIO_HEALTHCHECK_URL:-http://127.0.0.1:${APP_PORT}/api/health}"
HOMEIO_HEALTHCHECK_RETRIES="${HOMEIO_HEALTHCHECK_RETRIES:-60}"
HOMEIO_HEALTHCHECK_DELAY_SEC="${HOMEIO_HEALTHCHECK_DELAY_SEC:-3}"

SERVICE_UNIT="${SERVICE_NAME}"
if [[ "${SERVICE_UNIT}" != *.service ]]; then
	SERVICE_UNIT="${SERVICE_UNIT}.service"
fi

DBUS_SERVICE_UNIT="${DBUS_SERVICE_NAME}"
if [[ "${DBUS_SERVICE_UNIT}" != *.service ]]; then
	DBUS_SERVICE_UNIT="${DBUS_SERVICE_UNIT}.service"
fi

BACKUP_DIR=""
PREVIOUS_GIT_REV=""
ROLLBACK_READY="false"
ROLLBACK_DONE="false"
PREVIOUS_LOCK_HASH=""
NEW_LOCK_HASH=""

print_status() { echo -e "${GREEN}[+]${NC} $1"; }
print_error() { echo -e "${RED}[!]${NC} $1" >&2; }
print_warn() { echo -e "${YELLOW}[*]${NC} $1"; }

command_exists() {
	command -v "$1" >/dev/null 2>&1
}

require_root() {
	[[ "${EUID}" -eq 0 ]] || { print_error "Run this updater as root (for example: sudo bash update.sh)."; exit 1; }
}

hash_file() {
	local file="${1}"
	[[ -f "${file}" ]] || return 0
	sha256sum "${file}" | awk '{print $1}'
}

check_prerequisites() {
	print_status "Checking prerequisites..."
	command_exists apt-get || { print_error "apt-get is required."; exit 1; }
	command_exists systemctl || { print_error "systemd is required but systemctl is not available."; exit 1; }
	command_exists rsync || { print_error "rsync is required."; exit 1; }
	command_exists curl || { print_error "curl is required."; exit 1; }
	command_exists npm || { print_error "npm is required."; exit 1; }

	[[ -d "${INSTALL_DIR}" ]] || { print_error "Install directory not found: ${INSTALL_DIR}"; exit 1; }
	[[ -f "${ENV_FILE}" ]] || { print_error "Environment file not found: ${ENV_FILE}"; exit 1; }
}

ensure_security_dependencies() {
	print_status "Ensuring security dependencies (ufw, fail2ban)..."

	local packages=()
	command_exists ufw || packages+=("ufw")
	command_exists fail2ban-client || packages+=("fail2ban")

	if (( ${#packages[@]} > 0 )); then
		apt-get update -qq >/dev/null
		apt-get install -y -qq "${packages[@]}" >/dev/null
	fi

	systemctl enable --now fail2ban >/dev/null 2>&1 || true
	systemctl restart fail2ban >/dev/null 2>&1 || true
}

capture_current_state() {
	PREVIOUS_LOCK_HASH="$(hash_file "${INSTALL_DIR}/package-lock.json" || true)"
	if [[ -d "${INSTALL_DIR}/.git" ]]; then
		PREVIOUS_GIT_REV="$(git -C "${INSTALL_DIR}" rev-parse HEAD || true)"
	fi
}

create_backup() {
	if [[ "${HOMEIO_CREATE_BACKUP}" != "true" ]]; then
		print_warn "Skipping code backup (HOMEIO_CREATE_BACKUP=${HOMEIO_CREATE_BACKUP})."
		return
	fi

	local ts
	ts="$(date '+%Y%m%d-%H%M%S')"
	BACKUP_DIR="${HOMEIO_BACKUP_ROOT}/${ts}"
	mkdir -p "${BACKUP_DIR}"

	print_status "Creating backup at ${BACKUP_DIR}..."
	rsync -a \
		--delete \
		--exclude ".git" \
		--exclude "node_modules" \
		--exclude ".next" \
		"${INSTALL_DIR}/" "${BACKUP_DIR}/"
}

deploy_from_git() {
	if [[ -d "${INSTALL_DIR}/.git" ]]; then
		# If no branch was explicitly set, stay on the branch that is currently checked out
		if [[ -z "${REPO_BRANCH}" ]]; then
			REPO_BRANCH="$(git -C "${INSTALL_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")"
			# Detached HEAD (e.g. shallow clone on FETCH_HEAD) → fall back to main
			if [[ "${REPO_BRANCH}" == "HEAD" ]]; then
				REPO_BRANCH="$(git -C "${INSTALL_DIR}" symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||' || echo "main")"
			fi
		fi
		print_status "Updating from git (${REPO_BRANCH})..."
		git -C "${INSTALL_DIR}" fetch --depth=1 origin "${REPO_BRANCH}" --quiet
		git -C "${INSTALL_DIR}" checkout --force FETCH_HEAD --quiet
	else
		print_warn "No git repository at ${INSTALL_DIR}. Cloning fresh copy from ${REPO_URL}..."
		local tmp_dir
		tmp_dir="$(mktemp -d)"
		local clone_branch="${REPO_BRANCH:-main}"
		git clone --depth=1 --branch "${clone_branch}" --quiet "${REPO_URL}" "${tmp_dir}/repo"

		rsync -a \
			--delete \
			--exclude ".git" \
			--exclude "node_modules" \
			--exclude ".next" \
			--exclude ".env" \
			--exclude ".env.local" \
			"${tmp_dir}/repo/" "${INSTALL_DIR}/"

		rm -rf "${tmp_dir}"
		print_status "Fresh clone deployed."
	fi
}

deploy_from_tarball() {
	local tmp_dir
	local extract_dir
	local source_dir
	tmp_dir="$(mktemp -d)"
	extract_dir="${tmp_dir}/extract"
	mkdir -p "${extract_dir}"

	print_status "Downloading release tarball..."
	curl -fsSL "${HOMEIO_RELEASE_TARBALL_URL}" -o "${tmp_dir}/release.tar.gz"
	tar -xzf "${tmp_dir}/release.tar.gz" -C "${extract_dir}"

	if [[ -f "${extract_dir}/package.json" ]]; then
		source_dir="${extract_dir}"
	else
		source_dir="$(find "${extract_dir}" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
	fi

	[[ -n "${source_dir:-}" && -f "${source_dir}/package.json" ]] || { print_error "Could not locate app root in tarball."; exit 1; }

	print_status "Deploying tarball contents..."
	rsync -a \
		--delete \
		--exclude ".git" \
		--exclude "node_modules" \
		--exclude ".next" \
		"${source_dir}/" "${INSTALL_DIR}/"

	rm -rf "${tmp_dir}"
}

install_dependencies_if_needed() {
	NEW_LOCK_HASH="$(hash_file "${INSTALL_DIR}/package-lock.json" || true)"

	if [[ "${PREVIOUS_LOCK_HASH}" != "${NEW_LOCK_HASH}" || ! -d "${INSTALL_DIR}/node_modules" ]]; then
		print_status "Dependency changes detected. Installing npm dependencies..."
		cd "${INSTALL_DIR}" && npm ci --silent --no-audit --no-fund 1>/dev/null
	else
		print_status "No dependency changes detected. Skipping npm ci."
	fi
}

run_database_migrations() {
	print_status "Running database migrations..."

	if [[ ! -f "${ENV_FILE}" ]]; then
		print_error "Environment file not found: ${ENV_FILE}. Cannot run migrations."
		exit 1
	fi

	# Check if there are any pending migration files
	if [[ ! -d "${INSTALL_DIR}/drizzle" ]] || [[ -z "$(ls -A "${INSTALL_DIR}/drizzle"/*.sql 2>/dev/null)" ]]; then
		print_status "No migration files found in ${INSTALL_DIR}/drizzle. Skipping."
		return
	fi

	(set -a && source "${ENV_FILE}" && set +a && cd "${INSTALL_DIR}" && npm run db:migrate --silent) \
		|| { print_error "Database migration failed. Rolling back."; exit 1; }

	print_status "Database migrations applied successfully."
}

build_app() {
	print_status "Building Next.js application..."
	cd "${INSTALL_DIR}" && npm run build --silent
}

stop_service() {
	print_status "Stopping ${SERVICE_NAME} service..."
	systemctl stop "${SERVICE_UNIT}" >/dev/null 2>&1 || true
}

ensure_service_shutdown_behavior() {
	local unit_name="${SERVICE_UNIT%.service}"
	local drop_in_dir="/etc/systemd/system/${unit_name}.service.d"
	local drop_in_file="${drop_in_dir}/10-shutdown.conf"

	print_status "Ensuring clean ${SERVICE_NAME} shutdown settings..."
	mkdir -p "${drop_in_dir}"
	cat >"${drop_in_file}" <<'EOF'
[Service]
KillMode=control-group
TimeoutStopSec=30s
EOF

	systemctl daemon-reload
}

start_service() {
	print_status "Starting ${SERVICE_NAME} service..."
	systemctl daemon-reload
	systemctl start "${SERVICE_UNIT}"
}

restart_dbus_helper_service() {
	if ! systemctl cat "${DBUS_SERVICE_UNIT}" >/dev/null 2>&1; then
		print_warn "DBus helper unit ${DBUS_SERVICE_UNIT} not found; skipping helper restart."
		return
	fi

	print_status "Restarting DBus helper service..."
	systemctl daemon-reload
	systemctl enable --now "${DBUS_SERVICE_UNIT}"
	systemctl restart "${DBUS_SERVICE_UNIT}"
}

configure_reverse_proxy() {
	if ! command_exists nginx; then
		print_warn "nginx is not installed; skipping reverse proxy update."
		return
	fi

	local nginx_conf="/etc/nginx/sites-available/${NGINX_SITE_NAME}.conf"
	local nginx_enabled="/etc/nginx/sites-enabled/${NGINX_SITE_NAME}.conf"
	local maintenance_root="/var/lib/homeio-maintenance"
	local maintenance_file="${maintenance_root}/__homeio_unavailable.html"

	print_status "Configuring nginx reverse proxy on :${PUBLIC_PORT} -> 127.0.0.1:${APP_PORT}..."

	mkdir -p "${maintenance_root}"
	cat >"${maintenance_file}" <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="cache-control" content="no-store" />
    <title>Homeio is restarting</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #07111c;
        --panel: rgba(10, 24, 39, 0.82);
        --border: rgba(148, 163, 184, 0.18);
        --text: #f8fafc;
        --muted: #94a3b8;
        --accent: #38bdf8;
        --warn: #f59e0b;
        --error: #ef4444;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.16), transparent 38%),
          radial-gradient(circle at 80% 70%, rgba(14, 165, 233, 0.12), transparent 42%),
          var(--bg);
        color: var(--text);
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }
      .panel {
        width: min(92vw, 32rem);
        padding: 2rem;
        border-radius: 1.5rem;
        border: 1px solid var(--border);
        background: var(--panel);
        backdrop-filter: blur(14px);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
        text-align: center;
      }
      .spinner {
        width: 3rem;
        height: 3rem;
        margin: 0 auto 1rem;
        border-radius: 999px;
        border: 3px solid rgba(148, 163, 184, 0.24);
        border-top-color: var(--accent);
        animation: spin 0.9s linear infinite;
      }
      .spinner.warn { border-top-color: var(--warn); }
      h1 {
        margin: 0;
        font-size: 1.35rem;
      }
      p {
        margin: 0.75rem 0 0;
        line-height: 1.6;
        color: var(--muted);
      }
      .status {
        margin-top: 1rem;
        font-size: 0.85rem;
        color: var(--muted);
      }
      .log-hint {
        display: none;
        margin-top: 1.25rem;
        padding: 0.75rem 1rem;
        border-radius: 0.75rem;
        background: rgba(245, 158, 11, 0.1);
        border: 1px solid rgba(245, 158, 11, 0.25);
        font-size: 0.8rem;
        color: var(--warn);
        text-align: left;
        line-height: 1.6;
      }
      .log-hint code {
        display: block;
        margin-top: 0.4rem;
        font-family: monospace;
        word-break: break-all;
        color: #fde68a;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <main class="panel">
      <div class="spinner" id="spinner" aria-hidden="true"></div>
      <h1>Homeio is restarting</h1>
      <p>
        The update is being applied. This page will automatically reload when
        <code>/api/health</code> is available again.
      </p>
      <div class="status" id="status">Waiting for Homeio...</div>
      <div class="log-hint" id="log-hint">
        The update is taking longer than expected — it may still be building, or an error may have occurred.
        Check the update log for details:
        <code>sudo tail -f /var/log/homeio-self-update.log</code>
        To manually restart the service:
        <code>sudo systemctl restart home-server</code>
      </div>
    </main>
    <script>
      const statusEl = document.getElementById("status");
      const spinnerEl = document.getElementById("spinner");
      const logHintEl = document.getElementById("log-hint");
      const startedAt = Date.now();
      const WARN_AFTER_MS = 5 * 60 * 1000; // 5 minutes

      async function checkHealth() {
        try {
          const response = await fetch("/api/health", { cache: "no-store" });
          if (response.ok) {
            statusEl.textContent = "Homeio is back. Reloading...";
            window.location.reload();
            return;
          }
        } catch (_) {
          // Ignore while the backend is still down.
        }

        const elapsed = Date.now() - startedAt;
        if (elapsed >= WARN_AFTER_MS) {
          statusEl.textContent = "Still waiting — the update may have failed.";
          spinnerEl.classList.add("warn");
          logHintEl.style.display = "block";
        } else {
          const mins = Math.floor(elapsed / 60000);
          const secs = Math.floor((elapsed % 60000) / 1000);
          statusEl.textContent = `Waiting for Homeio… (${mins}m ${secs}s)`;
        }

        window.setTimeout(checkHealth, 2000);
      }
      window.setTimeout(checkHealth, 1500);
    </script>
  </body>
</html>
EOF

	cat >"${nginx_conf}" <<EOF
upstream homeio_backend {
    server 127.0.0.1:${APP_PORT};
    keepalive 32;
}

server {
    listen ${PUBLIC_PORT};
    listen [::]:${PUBLIC_PORT};
    server_name _;

    client_max_body_size 32m;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_intercept_errors on;
    error_page 502 503 504 /__homeio_unavailable.html;

    location = /__homeio_unavailable.html {
        root ${maintenance_root};
        default_type text/html;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
    }

    location / {
        proxy_pass http://homeio_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
        gzip off;
    }
}
EOF

	ln -sf "${nginx_conf}" "${nginx_enabled}"
	rm -f /etc/nginx/sites-enabled/default >/dev/null 2>&1 || true

	nginx -t
	systemctl enable --now nginx
	systemctl reload nginx
}

healthcheck() {
	local attempts=0
	while (( attempts < HOMEIO_HEALTHCHECK_RETRIES )); do
		if curl -fsS --max-time 5 "${HOMEIO_HEALTHCHECK_URL}" >/dev/null; then
			return 0
		fi
		attempts=$((attempts + 1))
		sleep "${HOMEIO_HEALTHCHECK_DELAY_SEC}"
	done

	return 1
}

rollback_release() {
	trap - ERR
	ROLLBACK_DONE="true"

	print_error "Update failed! Attempting rollback..."
	stop_service

	if [[ -n "${BACKUP_DIR}" && -d "${BACKUP_DIR}" ]]; then
		print_status "Restoring backup from ${BACKUP_DIR}..."
		rsync -a --delete "${BACKUP_DIR}/" "${INSTALL_DIR}/"
	elif [[ -n "${PREVIOUS_GIT_REV}" && -d "${INSTALL_DIR}/.git" ]]; then
		print_status "Restoring previous git revision ${PREVIOUS_GIT_REV}..."
		git -C "${INSTALL_DIR}" checkout --force "${PREVIOUS_GIT_REV}" --quiet
	else
		print_error "No rollback source available."; exit 1;
	fi

	print_status "Rebuilding application after rollback..."
	cd "${INSTALL_DIR}" && npm ci --silent
	cd "${INSTALL_DIR}" && npm run build --silent
	start_service

	if healthcheck; then
		print_status "Rollback succeeded."
	else
		print_error "Rollback failed health check. Manual intervention required."; exit 1;
	fi
}

on_error() {
	local line_no="${1}"
	local exit_code="${2}"
	if [[ "${ROLLBACK_READY}" == "true" && "${ROLLBACK_DONE}" != "true" ]]; then
		print_error "Update failed at line ${line_no} (exit ${exit_code})."
		rollback_release || true
	fi
	exit "${exit_code}"
}

print_summary() {
	local host primary_ip local_url network_url
	host="$(hostnamectl --static 2>/dev/null || hostname)"
	primary_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"

	if [[ "${PUBLIC_PORT}" == "80" ]]; then
		local_url="http://${host}.local"
	else
		local_url="http://${host}.local:${PUBLIC_PORT}"
	fi

	if [[ -n "${primary_ip}" ]]; then
		if [[ "${PUBLIC_PORT}" == "80" ]]; then
			network_url="http://${primary_ip}"
		else
			network_url="http://${primary_ip}:${PUBLIC_PORT}"
		fi
	fi

	echo ""
	echo -e "${GREEN}╭────────────────────────────────────────────────────╮${NC}"
	echo -e "${GREEN}│         Update Complete!                          │${NC}"
	echo -e "${GREEN}├────────────────────────────────────────────────────┤${NC}"
	echo -e "${GREEN}│${NC}  ${APP_NAME} has been updated successfully!      ${GREEN}│${NC}"
	echo -e "${GREEN}│${NC}                                                  ${GREEN}│${NC}"
	printf "%b\n" "${GREEN}│${NC}  ${BLUE}*${NC} Local:      ${BLUE}${local_url}${NC}"
	if [[ -n "${network_url}" ]]; then
		printf "%b\n" "${GREEN}│${NC}  ${BLUE}*${NC} Network:    ${BLUE}${network_url}${NC}"
	fi
	echo -e "${GREEN}│${NC}                                                  ${GREEN}│${NC}"
	echo -e "${GREEN}╰────────────────────────────────────────────────────╯${NC}"
	echo ""

	echo -e "${BLUE}Manage service:${NC}"
	echo -e "  sudo systemctl [start|stop|restart|status] ${SERVICE_UNIT}"
	echo ""
	echo -e "${BLUE}View logs:${NC}"
	echo -e "  sudo journalctl -u ${SERVICE_UNIT} -f"
	echo -e "  sudo journalctl -u ${DBUS_SERVICE_UNIT} -f"
	echo ""
	echo -e "${BLUE}Health check:${NC}"
	echo -e "  ${HOMEIO_HEALTHCHECK_URL}"
	echo ""
	if [[ -n "${BACKUP_DIR}" && -d "${BACKUP_DIR}" ]]; then
		echo -e "${BLUE}Backup location:${NC}"
		echo -e "  ${BACKUP_DIR}"
		echo ""
	fi
}

main() {
	require_root
	check_prerequisites
	capture_current_state
	create_backup

	ROLLBACK_READY="true"
	trap 'on_error ${LINENO} $?' ERR

	ensure_service_shutdown_behavior
	stop_service

	if [[ -n "${HOMEIO_RELEASE_TAG}" ]]; then
		if [[ "${HOMEIO_RELEASE_TAG}" == "latest" ]]; then
			print_status "Fetching latest release URL..."
			HOMEIO_RELEASE_TARBALL_URL="$(curl -fsSL \
				"https://api.github.com/repos/doctor-io/homeio/releases/latest" \
				| jq -r '.tarball_url')"
			[[ -n "${HOMEIO_RELEASE_TARBALL_URL}" ]] || {
				print_error "Could not fetch latest release URL."; false
			}
		else
			HOMEIO_RELEASE_TARBALL_URL="https://github.com/doctor-io/homeio/archive/refs/tags/${HOMEIO_RELEASE_TAG}.tar.gz"
		fi
		deploy_from_tarball
	elif [[ -n "${HOMEIO_RELEASE_TARBALL_URL}" ]]; then
		deploy_from_tarball
	else
		deploy_from_git
	fi

	ensure_security_dependencies
	install_dependencies_if_needed
	run_database_migrations
	build_app
	start_service
	configure_reverse_proxy
	restart_dbus_helper_service

	print_status "Running health check..."
	if ! healthcheck; then
		print_error "Health check failed at ${HOMEIO_HEALTHCHECK_URL}"; exit 1;
	fi

	ROLLBACK_READY="false"
	print_summary
}

main "$@"
