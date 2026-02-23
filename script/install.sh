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
PORT="${HOMEIO_PORT:-3000}"
REPO_URL="${HOMEIO_REPO_URL:-https://github.com/doctor-io/home-server.git}"
REPO_BRANCH="${HOMEIO_REPO_BRANCH:-main}"

NODE_VERSION="${NODE_VERSION:-22.14.0}"
YQ_VERSION="${YQ_VERSION:-4.45.4}"
DOCKER_VERSION="${DOCKER_VERSION:-28.0.1}"
DOCKER_INSTALL_SCRIPT_COMMIT="${DOCKER_INSTALL_SCRIPT_COMMIT:-master}"

HOMEIO_INSTALL_DOCKER="${HOMEIO_INSTALL_DOCKER:-false}"
HOMEIO_INSTALL_EXTRAS="${HOMEIO_INSTALL_EXTRAS:-false}"
HOMEIO_INSTALL_YQ="${HOMEIO_INSTALL_YQ:-false}"
HOMEIO_HOSTNAME="${HOMEIO_HOSTNAME:-}"
HOMEIO_ALLOW_OTHER_NODE="${HOMEIO_ALLOW_OTHER_NODE:-false}"

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
	[[ "${EUID}" -eq 0 ]] || die "Run this installer as root (for example: sudo bash install.sh)."
}

run_as_app() {
	local cmd="${1}"
	runuser -u "${APP_USER}" -- bash -lc "${cmd}"
}

validate_identifiers() {
	local db_user="${HOMEIO_DB_USER:-home_server}"
	local db_name="${HOMEIO_DB_NAME:-home_server}"
	local admin_username="${HOMEIO_ADMIN_USERNAME:-auto}"

	[[ "${db_user}" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || die "Invalid HOMEIO_DB_USER: ${db_user}"
	[[ "${db_name}" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || die "Invalid HOMEIO_DB_NAME: ${db_name}"
	if [[ "${admin_username}" != "auto" ]]; then
		[[ "${admin_username}" =~ ^[a-zA-Z0-9._-]{3,64}$ ]] || die "Invalid HOMEIO_ADMIN_USERNAME: ${admin_username}"
	fi
}

detect_arch() {
	case "$(uname -m)" in
		x86_64)
			echo "x64"
			;;
		aarch64)
			echo "arm64"
			;;
		*)
			die "Unsupported architecture: $(uname -m). Supported: x86_64, aarch64."
			;;
	esac
}

ensure_apt() {
	command_exists apt-get || die "This installer supports Debian/Ubuntu/Raspberry Pi OS only (apt-get required)."
}

normalize_hostname() {
	local input="${1:-}"
	# Remove whitespace and lowercase
	input="$(echo "${input}" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
	# Strip .local if provided
	if [[ "${input}" == *.local ]]; then
		input="${input%.local}"
	fi
	# Default if empty
	if [[ -z "${input}" ]]; then
		input="homeio"
	fi
	# Basic validation (allow dots for FQDN)
	if ! [[ "${input}" =~ ^[a-z0-9][a-z0-9.-]{0,62}$ ]]; then
		die "Invalid hostname: ${input}. Use letters, numbers, hyphens, and dots."
	fi
	echo "${input}"
}

configure_hostname() {
	local desired="${HOMEIO_HOSTNAME}"

	if [[ -z "${desired}" && -t 0 ]]; then
		echo "Enter the hostname for Home Server (used as <hostname>.local)."
		read -r -p "Hostname [homeio]: " desired
	fi

	desired="$(normalize_hostname "${desired}")"

	if command_exists hostnamectl; then
		hostnamectl set-hostname "${desired}"
	else
		echo "${desired}" >/etc/hostname
		hostname "${desired}"
	fi

	local hosts_entry="127.0.1.1 ${desired}"
	if [[ "${desired}" != *.* ]]; then
		hosts_entry="${hosts_entry} ${desired}.local"
	fi

	if grep -qE '^127\.0\.1\.1' /etc/hosts; then
		sed -i "s|^127\.0\.1\.1.*|${hosts_entry}|" /etc/hosts
	else
		echo "${hosts_entry}" >>/etc/hosts
	fi

	if [[ "${desired}" == *.* ]]; then
		log "Hostname set to ${desired}. Configure DNS to point this name to the server."
	else
		log "Hostname set to ${desired}. Access via http://${desired}.local"
	fi
}

install_packages() {
	log "Installing system dependencies..."
	apt-get update -y
	apt-get install -y \
		ca-certificates \
		curl \
		gnupg \
		git \
		jq \
		rsync \
		python3 \
		build-essential \
		libudev-dev \
		tar \
		xz-utils \
		unzip \
		procps \
		postgresql \
		postgresql-contrib \
		openssl
}

install_extras() {
	if [[ "${HOMEIO_INSTALL_EXTRAS}" != "true" ]]; then
		log "Skipping full extras install (HOMEIO_INSTALL_EXTRAS=${HOMEIO_INSTALL_EXTRAS})."
		return
	fi

	log "Installing full extras..."
	apt-get install -y \
		network-manager \
		systemd-timesyncd \
		openssh-server \
		avahi-daemon \
		avahi-discover \
		avahi-utils \
		libnss-mdns \
		bluez \
		sudo \
		nano \
		vim \
		less \
		man \
		iproute2 \
		iputils-ping \
		wget \
		usbutils \
		whois \
		fswatch \
		gettext-base \
		dmidecode \
		unar \
		imagemagick \
		ffmpeg \
		samba \
		wsdd2 \
		cifs-utils \
		smbclient \
		gdisk \
		parted \
		e2fsprogs \
		exfatprogs

	# ntfs-3g only on amd64
	if [[ "$(detect_arch)" == "x64" ]]; then
		apt-get install -y ntfs-3g
	fi

	# Let HomeIO manage these when needed
	systemctl disable smbd wsdd2 >/dev/null 2>&1 || true
	systemctl enable --now avahi-daemon >/dev/null 2>&1 || true
}

install_docker() {
	if [[ "${HOMEIO_INSTALL_DOCKER}" != "true" ]]; then
		log "Skipping Docker install (HOMEIO_INSTALL_DOCKER=${HOMEIO_INSTALL_DOCKER})."
		return
	fi

	if command_exists docker; then
		log "Docker already installed."
		return
	fi

	log "Installing Docker ${DOCKER_VERSION}..."
	curl -fsSL "https://raw.githubusercontent.com/docker/docker-install/${DOCKER_INSTALL_SCRIPT_COMMIT}/install.sh" -o /tmp/install-docker.sh
	sh /tmp/install-docker.sh --version "v${DOCKER_VERSION}"
	rm -f /tmp/install-docker.sh

	systemctl enable --now docker
}

install_node() {
	local arch
	arch="$(detect_arch)"

	if command_exists node; then
		local current
		current="$(node -v | sed 's/^v//')"
		if [[ "${current}" == "${NODE_VERSION}" ]]; then
			log "Node ${NODE_VERSION} already installed."
			return
		fi
		if [[ "${HOMEIO_ALLOW_OTHER_NODE}" == "true" ]]; then
			log "Using existing Node ${current} (HOMEIO_ALLOW_OTHER_NODE=true)."
			return
		fi
		log "Existing Node ${current} detected; installing Node ${NODE_VERSION}."
	fi

	local node_tar="node-v${NODE_VERSION}-linux-${arch}.tar.gz"
	local node_url="https://nodejs.org/dist/v${NODE_VERSION}/${node_tar}"
	local checksums_url="https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"
	local sha_expected=""

	log "Installing Node ${NODE_VERSION}..."
	curl -fsSL "${checksums_url}" -o /tmp/SHASUMS256.txt
	sha_expected="$(grep " ${node_tar}\$" /tmp/SHASUMS256.txt | awk '{print $1}')"
	[[ -n "${sha_expected}" ]] || die "Could not find checksum for ${node_tar}"

	curl -fsSL "${node_url}" -o "/tmp/${node_tar}"
	echo "${sha_expected}  /tmp/${node_tar}" | sha256sum -c -
	tar -xzf "/tmp/${node_tar}" -C /usr/local --strip-components=1
	rm -f "/tmp/${node_tar}" /tmp/SHASUMS256.txt
}

install_yq() {
	if [[ "${HOMEIO_INSTALL_YQ}" != "true" ]]; then
		log "Skipping yq install (HOMEIO_INSTALL_YQ=${HOMEIO_INSTALL_YQ})."
		return
	fi

	if command_exists yq; then
		log "yq already installed."
		return
	fi

	local arch
	local yq_arch="arm64"
	local yq_sha=""
	arch="$(detect_arch)"
	if [[ "${arch}" == "x64" ]]; then
		yq_arch="amd64"
	fi

	log "Installing yq ${YQ_VERSION}..."
	curl -fsSL "https://github.com/mikefarah/yq/releases/download/v${YQ_VERSION}/checksums" -o /tmp/yq-checksums.txt
	yq_sha="$(grep " yq_linux_${yq_arch}\$" /tmp/yq-checksums.txt | awk '{print $1}')"
	[[ -n "${yq_sha}" ]] || die "Could not find checksum for yq_linux_${yq_arch}"

	curl -fsSL "https://github.com/mikefarah/yq/releases/download/v${YQ_VERSION}/yq_linux_${yq_arch}" -o /usr/local/bin/yq
	echo "${yq_sha}  /usr/local/bin/yq" | sha256sum -c -
	chmod +x /usr/local/bin/yq
	rm -f /tmp/yq-checksums.txt
}

ensure_user_and_data_dir() {
	log "Ensuring system user and directories..."

	if ! getent group "${APP_GROUP}" >/dev/null 2>&1; then
		groupadd --system "${APP_GROUP}"
	fi

	if ! id -u "${APP_USER}" >/dev/null 2>&1; then
		useradd \
			--system \
			--gid "${APP_GROUP}" \
			--home-dir "${DATA_DIR}" \
			--create-home \
			--shell /usr/sbin/nologin \
			"${APP_USER}"
	fi

	mkdir -p "${INSTALL_DIR}" "${DATA_DIR}/logs" "${ENV_DIR}"
	chown -R "${APP_USER}:${APP_GROUP}" "${INSTALL_DIR}" "${DATA_DIR}"
	chown "root:${APP_GROUP}" "${ENV_DIR}"
	chmod 750 "${ENV_DIR}"
}

clone_or_update_repo() {
	log "Syncing repository (${REPO_BRANCH})..."

	if [[ -d "${INSTALL_DIR}/.git" ]]; then
		run_as_app "git -C '${INSTALL_DIR}' fetch --depth=1 origin '${REPO_BRANCH}'"
		run_as_app "git -C '${INSTALL_DIR}' checkout --force FETCH_HEAD"
		return
	fi

	if [[ -n "$(ls -A "${INSTALL_DIR}" 2>/dev/null || true)" ]]; then
		die "Install directory is not empty and is not a git repo: ${INSTALL_DIR}"
	fi

	run_as_app "git clone --depth=1 --branch '${REPO_BRANCH}' '${REPO_URL}' '${INSTALL_DIR}'"
}

get_env_value() {
	local key="${1}"
	local file="${2}"
	[[ -f "${file}" ]] || return 1
	grep -E "^${key}=" "${file}" | head -n 1 | cut -d '=' -f 2-
}

set_env_key() {
	local key="${1}"
	local value="${2}"
	local file="${3}"
	local tmp_file
	tmp_file="$(mktemp)"

	awk -v key="${key}" -v value="${value}" '
		BEGIN { replaced = 0 }
		$0 ~ ("^" key "=") {
			if (!replaced) {
				print key "=" value
				replaced = 1
			}
			next
		}
		{ print }
		END {
			if (!replaced) {
				print key "=" value
			}
		}
	' "${file}" >"${tmp_file}"

	cat "${tmp_file}" >"${file}"
	rm -f "${tmp_file}"
}

ensure_env_file() {
	log "Preparing environment file at ${ENV_FILE}..."
	mkdir -p "${ENV_DIR}"

	local db_name="${HOMEIO_DB_NAME:-}"
	local db_user="${HOMEIO_DB_USER:-}"
	local db_password="${HOMEIO_DB_PASSWORD:-}"
	local admin_username="${HOMEIO_ADMIN_USERNAME:-auto}"
	local admin_password="${HOMEIO_ADMIN_PASSWORD:-}"
	local auth_session_secret="${HOMEIO_AUTH_SESSION_SECRET:-}"
	local generated_admin_password="false"
	local generated_db_password="false"

	local is_new="false"
	if [[ ! -f "${ENV_FILE}" ]]; then
		is_new="true"
		touch "${ENV_FILE}"
	fi

	chown "root:${APP_GROUP}" "${ENV_FILE}"
	chmod 640 "${ENV_FILE}"

	if [[ "${is_new}" == "true" ]]; then
		cat >>"${ENV_FILE}" <<EOF
# ${APP_NAME} environment
EOF
	fi

	if [[ -z "${db_name}" ]]; then
		db_name="$(get_env_value HOMEIO_DB_NAME "${ENV_FILE}" || true)"
	fi
	if [[ -z "${db_name}" ]]; then
		db_name="home_server"
	fi

	if [[ -z "${db_user}" ]]; then
		db_user="$(get_env_value HOMEIO_DB_USER "${ENV_FILE}" || true)"
	fi
	if [[ -z "${db_user}" ]]; then
		db_user="home_server"
	fi

	if [[ -z "${auth_session_secret}" ]]; then
		auth_session_secret="$(get_env_value AUTH_SESSION_SECRET "${ENV_FILE}" || true)"
	fi
	if [[ -z "${auth_session_secret}" ]]; then
		auth_session_secret="$(openssl rand -hex 32)"
	fi

	if [[ -z "${db_password}" ]]; then
		db_password="$(get_env_value HOMEIO_DB_PASSWORD "${ENV_FILE}" || true)"
	fi
	if [[ -z "${db_password}" ]]; then
		db_password="$(openssl rand -hex 24)"
		generated_db_password="true"
	fi

	if [[ -z "${admin_password}" ]]; then
		admin_password="$(get_env_value AUTH_PRIMARY_PASSWORD "${ENV_FILE}" || true)"
	fi
	if [[ -z "${admin_password}" ]]; then
		admin_password="$(openssl rand -hex 12)"
		generated_admin_password="true"
	fi
	[[ "${#admin_password}" -ge 8 ]] || die "Admin password must be at least 8 characters."

	if [[ -z "${admin_username}" || "${admin_username}" == "auto" ]]; then
		admin_username="$(get_env_value AUTH_PRIMARY_USERNAME "${ENV_FILE}" || true)"
	fi
	if [[ -z "${admin_username}" || "${admin_username}" == "auto" ]]; then
		admin_username="homeio-$(openssl rand -hex 2)"
	fi
	[[ "${admin_username}" =~ ^[a-zA-Z0-9._-]{3,64}$ ]] || die "Invalid generated HOMEIO_ADMIN_USERNAME: ${admin_username}"

	local database_url="postgresql://${db_user}:${db_password}@127.0.0.1:5432/${db_name}"
	set_env_key NODE_ENV "production" "${ENV_FILE}"
	set_env_key HOMEIO_DB_NAME "${db_name}" "${ENV_FILE}"
	set_env_key HOMEIO_DB_USER "${db_user}" "${ENV_FILE}"
	set_env_key HOMEIO_DB_PASSWORD "${db_password}" "${ENV_FILE}"
	set_env_key DATABASE_URL "${database_url}" "${ENV_FILE}"
	set_env_key AUTH_SESSION_SECRET "${auth_session_secret}" "${ENV_FILE}"
	set_env_key AUTH_PRIMARY_USERNAME "${admin_username}" "${ENV_FILE}"
	set_env_key AUTH_PRIMARY_PASSWORD "${admin_password}" "${ENV_FILE}"
	set_env_key AUTH_ALLOW_REGISTRATION "false" "${ENV_FILE}"
	set_env_key PG_MAX_CONNECTIONS "10" "${ENV_FILE}"
	set_env_key METRICS_CACHE_TTL_MS "2000" "${ENV_FILE}"
	set_env_key METRICS_PUBLISH_INTERVAL_MS "2000" "${ENV_FILE}"
	set_env_key SSE_HEARTBEAT_MS "15000" "${ENV_FILE}"
	set_env_key WEBSOCKET_ENABLED "true" "${ENV_FILE}"
	set_env_key LOG_LEVEL "info" "${ENV_FILE}"
	set_env_key LOG_FILE_PATH "${DATA_DIR}/logs/home-server.log" "${ENV_FILE}"
	set_env_key LOG_TO_FILE "true" "${ENV_FILE}"
	set_env_key NEXT_PUBLIC_PRIMARY_USERNAME "${admin_username}" "${ENV_FILE}"
	set_env_key NEXT_PUBLIC_LOG_LEVEL "info" "${ENV_FILE}"
	set_env_key NEXT_PUBLIC_CLIENT_LOG_INGEST "true" "${ENV_FILE}"

	if [[ "${generated_admin_password}" == "true" ]]; then
		log "Generated app credentials: ${admin_username} / ${admin_password}"
	fi
	if [[ "${generated_db_password}" == "true" ]]; then
		log "Generated PostgreSQL password for ${db_user}."
	fi
}

configure_local_postgres() {
	log "Configuring local PostgreSQL..."
	systemctl enable --now postgresql

	local db_user
	local db_pass
	local db_name
	db_user="$(get_env_value HOMEIO_DB_USER "${ENV_FILE}" || true)"
	db_pass="$(get_env_value HOMEIO_DB_PASSWORD "${ENV_FILE}" || true)"
	db_name="$(get_env_value HOMEIO_DB_NAME "${ENV_FILE}" || true)"
	[[ -n "${db_user}" ]] || die "HOMEIO_DB_USER is missing in ${ENV_FILE}"
	[[ -n "${db_pass}" ]] || die "HOMEIO_DB_PASSWORD is missing in ${ENV_FILE}"
	[[ -n "${db_name}" ]] || die "HOMEIO_DB_NAME is missing in ${ENV_FILE}"

	runuser -u postgres -- psql -v ON_ERROR_STOP=1 --set=db_user="${db_user}" --set=db_pass="${db_pass}" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'db_user') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_pass');
  ELSE
    EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'db_user', :'db_pass');
  END IF;
END $$;
SQL

	if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='${db_name}'" | grep -q 1; then
		runuser -u postgres -- createdb --owner="${db_user}" "${db_name}"
	fi
}

install_homeio() {
	log "Installing ${APP_NAME} dependencies and building..."
	run_as_app "cd '${INSTALL_DIR}' && npm ci"
	run_as_app "cd '${INSTALL_DIR}' && set -a && source '${ENV_FILE}' && set +a && npm run db:init"
	run_as_app "cd '${INSTALL_DIR}' && npm run build"
}

install_systemd_service() {
	command_exists systemctl || die "systemd is required but systemctl is not available."

	local unit_file="/etc/systemd/system/${SERVICE_NAME}.service"
	log "Installing systemd unit ${SERVICE_NAME}.service..."

	cat >"${unit_file}" <<EOF
[Unit]
Description=${APP_NAME}
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${ENV_FILE}
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=/usr/bin/env npm run start -- -H 0.0.0.0 -p ${PORT}
Restart=on-failure
RestartSec=5
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF

	systemctl daemon-reload
	systemctl enable --now "${SERVICE_NAME}.service"
}

print_summary() {
	local host
	host="$(hostnamectl --static 2>/dev/null || hostname)"

	log "${APP_NAME} installation complete."
	if [[ "${host}" == *.* ]]; then
		log "Open: http://${host}:${PORT}"
	else
		log "Open: http://${host}.local:${PORT}"
	fi
	log "Service: systemctl status ${SERVICE_NAME}.service"

	log "Environment: ${ENV_FILE}"
}

main() {
	require_root
	ensure_apt
	validate_identifiers

	configure_hostname
	install_packages
	install_extras
	install_docker
	install_node
	install_yq
	ensure_user_and_data_dir
	clone_or_update_repo
	ensure_env_file
	configure_local_postgres
	install_homeio
	install_systemd_service
	print_summary
}

main "$@"
