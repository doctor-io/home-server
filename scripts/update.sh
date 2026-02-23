#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="home-server"
APP_USER="${HOMEIO_USER:-homeio}"
APP_GROUP="${HOMEIO_GROUP:-${APP_USER}}"
INSTALL_DIR="${HOMEIO_INSTALL_DIR:-/opt/home-server}"
ENV_DIR="${HOMEIO_ENV_DIR:-/etc/home-server}"
ENV_FILE="${HOMEIO_ENV_FILE:-${ENV_DIR}/home-server.env}"
SERVICE_NAME="${HOMEIO_SERVICE_NAME:-home-server}"
DBUS_SERVICE_NAME="${HOMEIO_DBUS_SERVICE_NAME:-home-server-dbus}"
PORT="${HOMEIO_PORT:-3000}"
REPO_URL="${HOMEIO_REPO_URL:-https://github.com/doctor-io/home-server.git}"
REPO_BRANCH="${HOMEIO_REPO_BRANCH:-main}"

HOMEIO_RELEASE_TARBALL_URL="${HOMEIO_RELEASE_TARBALL_URL:-}"
HOMEIO_CREATE_BACKUP="${HOMEIO_CREATE_BACKUP:-true}"
HOMEIO_BACKUP_ROOT="${HOMEIO_BACKUP_ROOT:-/var/backups/home-server/releases}"
HOMEIO_HEALTHCHECK_URL="${HOMEIO_HEALTHCHECK_URL:-http://127.0.0.1:${PORT}/api/health}"
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

log() {
	printf "[%s] %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

die() {
	echo "ERROR: $*" >&2
	exit 1
}

command_exists() {
	command -v "$1" >/dev/null 2>&1
}

require_root() {
	[[ "${EUID}" -eq 0 ]] || die "Run this updater as root (for example: sudo bash update.sh)."
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

check_prerequisites() {
	command_exists systemctl || die "systemd is required but systemctl is not available."
	command_exists rsync || die "rsync is required."
	command_exists curl || die "curl is required."
	command_exists npm || die "npm is required."

	[[ -d "${INSTALL_DIR}" ]] || die "Install directory not found: ${INSTALL_DIR}"
	[[ -f "${ENV_FILE}" ]] || die "Environment file not found: ${ENV_FILE}"
	id -u "${APP_USER}" >/dev/null 2>&1 || die "App user not found: ${APP_USER}"
}

capture_current_state() {
	PREVIOUS_LOCK_HASH="$(hash_file "${INSTALL_DIR}/package-lock.json" || true)"
	if [[ -d "${INSTALL_DIR}/.git" ]]; then
		PREVIOUS_GIT_REV="$(run_as_app "git -C '${INSTALL_DIR}' rev-parse HEAD" || true)"
	fi
}

create_backup() {
	if [[ "${HOMEIO_CREATE_BACKUP}" != "true" ]]; then
		log "Skipping code backup (HOMEIO_CREATE_BACKUP=${HOMEIO_CREATE_BACKUP})."
		return
	fi

	local ts
	ts="$(date '+%Y%m%d-%H%M%S')"
	BACKUP_DIR="${HOMEIO_BACKUP_ROOT}/${ts}"
	mkdir -p "${BACKUP_DIR}"

	log "Creating backup at ${BACKUP_DIR}..."
	rsync -a \
		--delete \
		--exclude ".git" \
		--exclude "node_modules" \
		--exclude ".next" \
		"${INSTALL_DIR}/" "${BACKUP_DIR}/"
}

deploy_from_git() {
	[[ -d "${INSTALL_DIR}/.git" ]] || die "No git repository found at ${INSTALL_DIR}. Set HOMEIO_RELEASE_TARBALL_URL for tarball-based updates."

	log "Updating from git (${REPO_BRANCH})..."
	run_as_app "git -C '${INSTALL_DIR}' fetch --depth=1 origin '${REPO_BRANCH}'"
	run_as_app "git -C '${INSTALL_DIR}' checkout --force FETCH_HEAD"
}

deploy_from_tarball() {
	local tmp_dir
	local extract_dir
	local source_dir
	tmp_dir="$(mktemp -d)"
	extract_dir="${tmp_dir}/extract"
	mkdir -p "${extract_dir}"

	log "Downloading release tarball..."
	curl -fsSL "${HOMEIO_RELEASE_TARBALL_URL}" -o "${tmp_dir}/release.tar.gz"
	tar -xzf "${tmp_dir}/release.tar.gz" -C "${extract_dir}"

	if [[ -f "${extract_dir}/package.json" ]]; then
		source_dir="${extract_dir}"
	else
		source_dir="$(find "${extract_dir}" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
	fi

	[[ -n "${source_dir:-}" && -f "${source_dir}/package.json" ]] || die "Could not locate app root in tarball."

	log "Deploying tarball contents..."
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
		log "Dependency changes detected. Running npm ci..."
		run_as_app "cd '${INSTALL_DIR}' && npm ci"
	else
		log "No dependency changes detected. Skipping npm ci."
	fi
}

run_db_and_build() {
	log "Running db bootstrap and build..."
	run_as_app "cd '${INSTALL_DIR}' && set -a && source '${ENV_FILE}' && set +a && npm run db:init"
	run_as_app "cd '${INSTALL_DIR}' && npm run build"
}

start_service() {
	systemctl daemon-reload
	systemctl start "${SERVICE_UNIT}"
}

restart_dbus_helper_service() {
	if ! systemctl cat "${DBUS_SERVICE_UNIT}" >/dev/null 2>&1; then
		log "DBus helper unit ${DBUS_SERVICE_UNIT} not found; skipping helper restart."
		return
	fi

	systemctl daemon-reload
	systemctl enable --now "${DBUS_SERVICE_UNIT}"
	systemctl restart "${DBUS_SERVICE_UNIT}"
}

stop_service() {
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

	log "Attempting rollback..."
	stop_service

	if [[ -n "${BACKUP_DIR}" && -d "${BACKUP_DIR}" ]]; then
		log "Restoring backup from ${BACKUP_DIR}..."
		rsync -a --delete "${BACKUP_DIR}/" "${INSTALL_DIR}/"
		chown -R "${APP_USER}:${APP_GROUP}" "${INSTALL_DIR}"
	elif [[ -n "${PREVIOUS_GIT_REV}" && -d "${INSTALL_DIR}/.git" ]]; then
		log "Restoring previous git revision ${PREVIOUS_GIT_REV}..."
		run_as_app "git -C '${INSTALL_DIR}' checkout --force '${PREVIOUS_GIT_REV}'"
	else
		die "No rollback source available."
	fi

	run_as_app "cd '${INSTALL_DIR}' && npm ci"
	run_as_app "cd '${INSTALL_DIR}' && npm run build"
	start_service

	if healthcheck; then
		log "Rollback succeeded."
	else
		die "Rollback failed health check. Manual intervention required."
	fi
}

on_error() {
	local line_no="${1}"
	local exit_code="${2}"
	if [[ "${ROLLBACK_READY}" == "true" && "${ROLLBACK_DONE}" != "true" ]]; then
		log "Update failed at line ${line_no} (exit ${exit_code})."
		rollback_release || true
	fi
	exit "${exit_code}"
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
	restart_dbus_helper_service

	if ! healthcheck; then
		die "Health check failed at ${HOMEIO_HEALTHCHECK_URL}"
	fi

	ROLLBACK_READY="false"
	log "Update completed successfully."
	log "Health check passed: ${HOMEIO_HEALTHCHECK_URL}"
	log "Service: systemctl status ${SERVICE_UNIT}"
}

main "$@"
