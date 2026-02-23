#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="home-server"
APP_USER="${HOMEIO_USER:-homeio}"
APP_GROUP="${HOMEIO_GROUP:-${APP_USER}}"
INSTALL_DIR="${HOMEIO_INSTALL_DIR:-/opt/home-server}"
DATA_DIR="${HOMEIO_DATA_DIR:-/var/lib/home-server}"
ENV_DIR="${HOMEIO_ENV_DIR:-/etc/home-server}"
ENV_FILE="${HOMEIO_ENV_FILE:-${ENV_DIR}/home-server.env}"
SERVICE_NAME="${HOMEIO_SERVICE_NAME:-home-server}"

PURGE="false"
ASSUME_YES="false"
REMOVE_SYSTEM_USER="false"

SERVICE_UNIT="${SERVICE_NAME}"
if [[ "${SERVICE_UNIT}" != *.service ]]; then
	SERVICE_UNIT="${SERVICE_UNIT}.service"
fi

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
	[[ "${EUID}" -eq 0 ]] || die "Run this uninstall script as root (for example: sudo bash uninstall.sh)."
}

get_env_value() {
	local key="${1}"
	local file="${2}"
	[[ -f "${file}" ]] || return 1
	grep -E "^${key}=" "${file}" | head -n 1 | cut -d '=' -f 2-
}

confirm() {
	local message="${1}"
	if [[ "${ASSUME_YES}" == "true" ]]; then
		return 0
	fi
	read -r -p "${message} [y/N]: " reply
	[[ "${reply}" == "y" || "${reply}" == "Y" ]]
}

usage() {
	cat <<EOF
Usage: sudo bash uninstall.sh [options]

Options:
  --purge         Remove data, env, and PostgreSQL database/role.
  --remove-user   Remove system user/group (only with --purge).
  -y, --yes       Do not ask for confirmation.
  -h, --help      Show this help.
EOF
}

parse_args() {
	while [[ $# -gt 0 ]]; do
		case "${1}" in
			--purge)
				PURGE="true"
				shift
				;;
			--remove-user)
				REMOVE_SYSTEM_USER="true"
				shift
				;;
			-y|--yes)
				ASSUME_YES="true"
				shift
				;;
			-h|--help)
				usage
				exit 0
				;;
			*)
				die "Unknown option: ${1}"
				;;
		esac
	done

	if [[ "${REMOVE_SYSTEM_USER}" == "true" && "${PURGE}" != "true" ]]; then
		die "--remove-user requires --purge."
	fi
}

stop_and_remove_service() {
	if command_exists systemctl; then
		log "Stopping and disabling ${SERVICE_UNIT}..."
		systemctl stop "${SERVICE_UNIT}" >/dev/null 2>&1 || true
		systemctl disable "${SERVICE_UNIT}" >/dev/null 2>&1 || true
	fi

	local unit_file="/etc/systemd/system/${SERVICE_UNIT}"
	if [[ -f "${unit_file}" ]]; then
		rm -f "${unit_file}"
	fi

	if command_exists systemctl; then
		systemctl daemon-reload
		systemctl reset-failed >/dev/null 2>&1 || true
	fi
}

remove_app_files() {
	if [[ -d "${INSTALL_DIR}" ]]; then
		log "Removing app files from ${INSTALL_DIR}..."
		rm -rf "${INSTALL_DIR}"
	fi
}

purge_database() {
	local db_name
	local db_user
	db_name="$(get_env_value HOMEIO_DB_NAME "${ENV_FILE}" || true)"
	db_user="$(get_env_value HOMEIO_DB_USER "${ENV_FILE}" || true)"

	[[ -n "${db_name}" ]] || db_name="home_server"
	[[ -n "${db_user}" ]] || db_user="home_server"

	if ! id -u postgres >/dev/null 2>&1; then
		log "PostgreSQL OS user not found; skipping DB purge."
		return
	fi

	log "Dropping PostgreSQL database '${db_name}'..."
	runuser -u postgres -- dropdb --if-exists --force "${db_name}" || true

	log "Dropping PostgreSQL role '${db_user}'..."
	runuser -u postgres -- psql -v ON_ERROR_STOP=1 --set=db_user="${db_user}" <<'SQL'
SELECT format('DROP ROLE %I', :'db_user')
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'db_user')
\gexec
SQL
}

purge_data_and_env() {
	if [[ -d "${DATA_DIR}" ]]; then
		log "Removing data directory ${DATA_DIR}..."
		rm -rf "${DATA_DIR}"
	fi

	if [[ -f "${ENV_FILE}" ]]; then
		log "Removing env file ${ENV_FILE}..."
		rm -f "${ENV_FILE}"
	fi

	if [[ -d "${ENV_DIR}" ]]; then
		rmdir "${ENV_DIR}" >/dev/null 2>&1 || true
	fi
}

remove_system_user_group() {
	if [[ "${REMOVE_SYSTEM_USER}" != "true" ]]; then
		return
	fi

	if id -u "${APP_USER}" >/dev/null 2>&1; then
		log "Removing system user ${APP_USER}..."
		userdel "${APP_USER}" >/dev/null 2>&1 || true
	fi

	if getent group "${APP_GROUP}" >/dev/null 2>&1; then
		log "Removing system group ${APP_GROUP}..."
		groupdel "${APP_GROUP}" >/dev/null 2>&1 || true
	fi
}

main() {
	parse_args "$@"
	require_root

	local mode="without purge"
	if [[ "${PURGE}" == "true" ]]; then
		mode="with purge"
	fi

	if ! confirm "Uninstall ${APP_NAME} (${mode})?"; then
		die "Cancelled."
	fi

	stop_and_remove_service
	remove_app_files

	if [[ "${PURGE}" == "true" ]]; then
		purge_database
		purge_data_and_env
		remove_system_user_group
		log "Uninstall completed with purge."
	else
		log "Uninstall completed. Database, data, and env were kept."
	fi
}

main "$@"
