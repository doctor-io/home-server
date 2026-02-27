#!/usr/bin/env bash
set -Eeuo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_NAME="home-server"
HOMEIO_USE_CURRENT_USER="${HOMEIO_USE_CURRENT_USER:-false}"

# Determine which user to use
if [[ "${HOMEIO_USE_CURRENT_USER}" == "true" ]]; then
	# Use the actual user who ran sudo
	ACTUAL_USER="${SUDO_USER:-${USER}}"
	[[ -n "${ACTUAL_USER}" && "${ACTUAL_USER}" != "root" ]] || { echo "Could not determine regular user. Set HOMEIO_USER manually."; exit 1; }
	APP_USER="${HOMEIO_USER:-${ACTUAL_USER}}"
	APP_GROUP="${HOMEIO_GROUP:-${ACTUAL_USER}}"
	# Use user's home directory for install
	USER_HOME="$(eval echo ~${ACTUAL_USER})"
	INSTALL_DIR="${HOMEIO_INSTALL_DIR:-${USER_HOME}/home-server}"
else
	# Use system user (original behavior)
	APP_USER="${HOMEIO_USER:-homeio}"
	APP_GROUP="${HOMEIO_GROUP:-${APP_USER}}"
	INSTALL_DIR="${HOMEIO_INSTALL_DIR:-/opt/home-server}"
fi

ENV_DIR="${HOMEIO_ENV_DIR:-/etc/home-server}"
ENV_FILE="${HOMEIO_ENV_FILE:-${INSTALL_DIR}/.env}"
LEGACY_ENV_FILE="${ENV_DIR}/home-server.env"
SERVICE_NAME="${HOMEIO_SERVICE_NAME:-home-server}"
DBUS_SERVICE_NAME="${HOMEIO_DBUS_SERVICE_NAME:-home-server-dbus}"
APP_PORT="${HOMEIO_APP_PORT:-${HOMEIO_PORT:-12026}}"
PUBLIC_PORT="${HOMEIO_PUBLIC_PORT:-80}"
NGINX_SITE_NAME="${HOMEIO_NGINX_SITE_NAME:-home-server}"
REPO_URL="${HOMEIO_REPO_URL:-https://github.com/doctor-io/home-server.git}"
REPO_BRANCH="${HOMEIO_REPO_BRANCH:-main}"

HOMEIO_RELEASE_TARBALL_URL="${HOMEIO_RELEASE_TARBALL_URL:-}"
HOMEIO_CREATE_BACKUP="${HOMEIO_CREATE_BACKUP:-true}"
HOMEIO_BACKUP_ROOT="${HOMEIO_BACKUP_ROOT:-/var/backups/home-server/releases}"
HOMEIO_HEALTHCHECK_URL="${HOMEIO_HEALTHCHECK_URL:-http://127.0.0.1:${APP_PORT}/api/health}"
HOMEIO_HEALTHCHECK_RETRIES="${HOMEIO_HEALTHCHECK_RETRIES:-30}"
HOMEIO_HEALTHCHECK_DELAY_SEC="${HOMEIO_HEALTHCHECK_DELAY_SEC:-2}"

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

run_as_app() {
	local cmd="${1}"
	runuser -u "${APP_USER}" -- bash -lc "${cmd}"
}

hash_file() {
	local file="${1}"
	[[ -f "${file}" ]] || return 0
	sha256sum "${file}" | awk '{print $1}'
}

resolve_env_file() {
	# If caller explicitly set HOMEIO_ENV_FILE, respect it strictly.
	if [[ -n "${HOMEIO_ENV_FILE:-}" ]]; then
		[[ -f "${ENV_FILE}" ]] || { print_error "Environment file not found: ${ENV_FILE}"; exit 1; }
		return
	fi

	# Primary default path (matches install.sh).
	if [[ -f "${ENV_FILE}" ]]; then
		return
	fi

	# Backward-compatible legacy fallback.
	if [[ -f "${LEGACY_ENV_FILE}" ]]; then
		print_warn "Environment file not found at ${ENV_FILE}. Falling back to ${LEGACY_ENV_FILE}."
		ENV_FILE="${LEGACY_ENV_FILE}"
		return
	fi

	print_error "Environment file not found. Checked: ${ENV_FILE} and ${LEGACY_ENV_FILE}"
	exit 1
}

check_prerequisites() {
	print_status "Checking prerequisites..."
	command_exists systemctl || { print_error "systemd is required but systemctl is not available."; exit 1; }
	command_exists rsync || { print_error "rsync is required."; exit 1; }
	command_exists curl || { print_error "curl is required."; exit 1; }
	command_exists npm || { print_error "npm is required."; exit 1; }

	[[ -d "${INSTALL_DIR}" ]] || { print_error "Install directory not found: ${INSTALL_DIR}"; exit 1; }
	resolve_env_file
	id -u "${APP_USER}" >/dev/null 2>&1 || { print_error "App user not found: ${APP_USER}"; exit 1; }
}

capture_current_state() {
	PREVIOUS_LOCK_HASH="$(hash_file "${INSTALL_DIR}/package-lock.json" || true)"
	if [[ -d "${INSTALL_DIR}/.git" ]]; then
		PREVIOUS_GIT_REV="$(run_as_app "git -C '${INSTALL_DIR}' rev-parse HEAD" || true)"
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
	[[ -d "${INSTALL_DIR}/.git" ]] || { print_error "No git repository found at ${INSTALL_DIR}. Set HOMEIO_RELEASE_TARBALL_URL for tarball-based updates."; exit 1; }

	print_status "Updating from git (${REPO_BRANCH})..."
	run_as_app "git -C '${INSTALL_DIR}' fetch --depth=1 origin '${REPO_BRANCH}' --quiet"
	run_as_app "git -C '${INSTALL_DIR}' checkout --force FETCH_HEAD --quiet"
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
	chown -R "${APP_USER}:${APP_GROUP}" "${INSTALL_DIR}"

	rm -rf "${tmp_dir}"
}

install_dependencies_if_needed() {
	NEW_LOCK_HASH="$(hash_file "${INSTALL_DIR}/package-lock.json" || true)"

	if [[ "${PREVIOUS_LOCK_HASH}" != "${NEW_LOCK_HASH}" || ! -d "${INSTALL_DIR}/node_modules" ]]; then
		print_status "Dependency changes detected. Installing npm dependencies..."
		run_as_app "cd '${INSTALL_DIR}' && npm ci --silent --no-audit --no-fund" 1>/dev/null
	else
		print_status "No dependency changes detected. Skipping npm ci."
	fi
}

run_db_and_build() {
	print_status "Initializing database schema..."
	run_as_app "cd '${INSTALL_DIR}' && set -a && source '${ENV_FILE}' && set +a && npm run db:init --silent" 1>/dev/null
	print_status "Building Next.js application..."
	run_as_app "cd '${INSTALL_DIR}' && npm run build --silent" 1>/dev/null
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

	print_status "Configuring nginx reverse proxy on :${PUBLIC_PORT} -> 127.0.0.1:${APP_PORT}..."

	cat >"${nginx_conf}" <<EOF
server {
    listen ${PUBLIC_PORT};
    listen [::]:${PUBLIC_PORT};
    server_name _;

    client_max_body_size 32m;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
    }
}
EOF

	ln -sf "${nginx_conf}" "${nginx_enabled}"
	rm -f /etc/nginx/sites-enabled/default >/dev/null 2>&1 || true

	nginx -t
	systemctl enable --now nginx
	systemctl reload nginx
}

stop_service() {
	print_status "Stopping ${SERVICE_NAME} service..."
	systemctl stop "${SERVICE_UNIT}" >/dev/null 2>&1 || true
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
		chown -R "${APP_USER}:${APP_GROUP}" "${INSTALL_DIR}"
	elif [[ -n "${PREVIOUS_GIT_REV}" && -d "${INSTALL_DIR}/.git" ]]; then
		print_status "Restoring previous git revision ${PREVIOUS_GIT_REV}..."
		run_as_app "git -C '${INSTALL_DIR}' checkout --force '${PREVIOUS_GIT_REV}' --quiet"
	else
		print_error "No rollback source available."; exit 1;
	fi

	print_status "Rebuilding application after rollback..."
	run_as_app "cd '${INSTALL_DIR}' && npm ci --silent" 1>/dev/null
	run_as_app "cd '${INSTALL_DIR}' && npm run build --silent" 1>/dev/null
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

	stop_service

	if [[ -n "${HOMEIO_RELEASE_TARBALL_URL}" ]]; then
		deploy_from_tarball
	else
		deploy_from_git
	fi

	install_dependencies_if_needed
	run_db_and_build
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
