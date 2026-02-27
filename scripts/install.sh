#!/usr/bin/env bash
set -Eeuo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_NAME="home-server"
INSTALL_DIR="${HOMEIO_INSTALL_DIR:-/opt/home-server}"
ENV_FILE="${INSTALL_DIR}/.env"
SERVICE_NAME="${HOMEIO_SERVICE_NAME:-home-server}"
DBUS_SERVICE_NAME="${HOMEIO_DBUS_SERVICE_NAME:-home-server-dbus}"
APP_PORT="${HOMEIO_APP_PORT:-${HOMEIO_PORT:-12026}}"
PUBLIC_PORT="${HOMEIO_PUBLIC_PORT:-80}"
NGINX_SITE_NAME="${HOMEIO_NGINX_SITE_NAME:-home-server}"
REPO_URL="${HOMEIO_REPO_URL:-https://github.com/doctor-io/home-server.git}"
REPO_BRANCH="${HOMEIO_REPO_BRANCH:-main}"

NODE_VERSION="${NODE_VERSION:-22.14.0}"
YQ_VERSION="${YQ_VERSION:-4.45.4}"
DOCKER_VERSION="${DOCKER_VERSION:-28.0.1}"
DOCKER_INSTALL_SCRIPT_COMMIT="${DOCKER_INSTALL_SCRIPT_COMMIT:-master}"

HOMEIO_INSTALL_YQ="${HOMEIO_INSTALL_YQ:-false}"
HOMEIO_HOSTNAME="${HOMEIO_HOSTNAME:-}"
HOMEIO_ALLOW_OTHER_NODE="${HOMEIO_ALLOW_OTHER_NODE:-false}"
HOMEIO_VERBOSE="${HOMEIO_VERBOSE:-false}"
HOMEIO_DRY_RUN="${HOMEIO_DRY_RUN:-false}"

EFFECTIVE_DB_USER=""

print_status() { echo -e "${GREEN}[+]${NC} $1"; }
print_error() { echo -e "${RED}[!]${NC} $1" >&2; }
print_warn() { echo -e "${YELLOW}[*]${NC} $1"; }
print_dry() { echo -e "${BLUE}[DRY]${NC} Would: $1"; }

run_step() {
	local label="${1}"
	shift
	if [[ "${HOMEIO_DRY_RUN}" == "true" ]]; then
		print_dry "${label}"
		return 0
	fi
	print_status "${label}"
	"$@"
}

command_exists() {
	command -v "$1" >/dev/null 2>&1
}

require_root() {
	[[ "${EUID}" -eq 0 ]] || { print_error "Run this installer as root (for example: sudo bash install.sh)."; exit 1; }
}

run_cmd() {
	local cmd="${1}"
	bash -c "${cmd}"
}

validate_identifiers() {
	local db_user="${HOMEIO_DB_USER:-home_server}"
	local db_name="${HOMEIO_DB_NAME:-home_server}"
	local admin_username="${HOMEIO_ADMIN_USERNAME:-auto}"

	[[ "${db_user}" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || { print_error "Invalid HOMEIO_DB_USER: ${db_user}"; exit 1; }
	[[ "${db_name}" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || { print_error "Invalid HOMEIO_DB_NAME: ${db_name}"; exit 1; }
	[[ "${HOMEIO_VERBOSE}" == "true" || "${HOMEIO_VERBOSE}" == "false" ]] || { print_error "Invalid HOMEIO_VERBOSE: ${HOMEIO_VERBOSE} (expected true|false)"; exit 1; }
	[[ "${HOMEIO_DRY_RUN}" == "true" || "${HOMEIO_DRY_RUN}" == "false" ]] || { print_error "Invalid HOMEIO_DRY_RUN: ${HOMEIO_DRY_RUN} (expected true|false)"; exit 1; }
	if [[ "${admin_username}" != "auto" ]]; then
		[[ "${admin_username}" =~ ^[a-zA-Z0-9._-]{3,64}$ ]] || { print_error "Invalid HOMEIO_ADMIN_USERNAME: ${admin_username}"; exit 1; }
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
			print_error "Unsupported architecture: $(uname -m). Supported: x86_64, aarch64."
			exit 1
			;;
	esac
}

ensure_apt() {
	command_exists apt-get || { print_error "This installer supports Debian/Ubuntu/Raspberry Pi OS only (apt-get required)."; exit 1; }
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
		print_error "Invalid hostname: ${input}. Use letters, numbers, hyphens, and dots."
		exit 1
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
		print_status "Hostname set to ${desired}. Configure DNS to point this name to the server."
	else
		print_status "Hostname set to ${desired}. Access via http://${desired}.local"
	fi
}

install_packages() {
	print_status "Installing system dependencies..."
	if [[ "${HOMEIO_VERBOSE}" == "true" ]]; then
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
	else
		apt-get update -qq >/dev/null
		apt-get install -y -qq \
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
			openssl >/dev/null
	fi
}

install_extras() {

	print_status "Installing full extras..."
	if [[ "${HOMEIO_VERBOSE}" == "true" ]]; then
		apt-get install -y \
			network-manager \
			nginx \
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
	else
		apt-get install -y -qq \
			network-manager \
			nginx \
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
			exfatprogs >/dev/null
	fi

	# ntfs-3g only on amd64
	if [[ "$(detect_arch)" == "x64" ]]; then
		if [[ "${HOMEIO_VERBOSE}" == "true" ]]; then
			apt-get install -y ntfs-3g
		else
			apt-get install -y -qq ntfs-3g >/dev/null
		fi
	fi

	# Let HomeIO manage these when needed
	systemctl disable smbd wsdd2 >/dev/null 2>&1 || true
	systemctl enable --now avahi-daemon >/dev/null 2>&1 || true
}

deploy_os_configs() {
	print_status "Deploying OS configuration overlays..."

	local overlay_src="${INSTALL_DIR}/packages/os/overlay-common"

	if [[ ! -d "${overlay_src}" ]]; then
		print_status "No OS overlays found at ${overlay_src}, skipping."
		return
	fi

	# Deploy netplan config to use NetworkManager
	if [[ -f "${overlay_src}/etc/netplan/01-netcfg.yaml" ]]; then
		mkdir -p /etc/netplan
		cp "${overlay_src}/etc/netplan/01-netcfg.yaml" /etc/netplan/01-netcfg.yaml
		chmod 600 /etc/netplan/01-netcfg.yaml
		print_status "Deployed netplan config to use NetworkManager renderer"

		# Apply netplan configuration
		netplan apply >/dev/null 2>&1 || true
		sleep 2
	fi

	# Deploy NetworkManager config
	if [[ -f "${overlay_src}/etc/NetworkManager/NetworkManager.conf" ]]; then
		mkdir -p /etc/NetworkManager
		cp "${overlay_src}/etc/NetworkManager/NetworkManager.conf" /etc/NetworkManager/NetworkManager.conf
		# Restart NetworkManager to apply the new configuration
		systemctl restart NetworkManager >/dev/null 2>&1 || true
		sleep 2  # Give NetworkManager time to reinitialize devices
		print_status "Deployed NetworkManager.conf and restarted NetworkManager"
	fi

	# Deploy systemd logind configs
	if [[ -d "${overlay_src}/etc/systemd/logind.conf.d" ]]; then
		mkdir -p /etc/systemd/logind.conf.d
		cp "${overlay_src}/etc/systemd/logind.conf.d/"*.conf /etc/systemd/logind.conf.d/ 2>/dev/null || true
		systemctl restart systemd-logind >/dev/null 2>&1 || true
		print_status "Deployed logind configurations"
	fi
}

install_docker() {

	if command_exists docker; then
		print_status "Docker already installed."
		return
	fi

	print_status "Installing Docker ${DOCKER_VERSION}..."
	curl -fsSL "https://raw.githubusercontent.com/docker/docker-install/${DOCKER_INSTALL_SCRIPT_COMMIT}/install.sh" -o /tmp/install-docker.sh
	if [[ "${HOMEIO_VERBOSE}" == "true" ]]; then
		sh /tmp/install-docker.sh --version "v${DOCKER_VERSION}"
	else
		sh /tmp/install-docker.sh --version "v${DOCKER_VERSION}" >/dev/null 2>&1
	fi
	rm -f /tmp/install-docker.sh

	systemctl enable --now docker >/dev/null 2>&1
}

install_node() {
	local arch
	arch="$(detect_arch)"

	if command_exists node; then
		local current
		current="$(node -v | sed 's/^v//')"
			if [[ "${current}" == "${NODE_VERSION}" ]]; then
			print_status "Node ${NODE_VERSION} already installed."
			return
		fi
		if [[ "${HOMEIO_ALLOW_OTHER_NODE}" == "true" ]]; then
			print_status "Using existing Node ${current} (HOMEIO_ALLOW_OTHER_NODE=true)."
			return
		fi
		print_status "Existing Node ${current} detected; installing Node ${NODE_VERSION}."
	fi

	local node_tar="node-v${NODE_VERSION}-linux-${arch}.tar.gz"
	local node_url="https://nodejs.org/dist/v${NODE_VERSION}/${node_tar}"
	local checksums_url="https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"
	local sha_expected=""

	print_status "Installing Node ${NODE_VERSION}..."
	curl -fsSL "${checksums_url}" -o /tmp/SHASUMS256.txt
	sha_expected="$(grep " ${node_tar}\$" /tmp/SHASUMS256.txt | awk '{print $1}')"
	[[ -n "${sha_expected}" ]] || { print_error "Could not find checksum for ${node_tar}"; exit 1; }

	curl -fsSL "${node_url}" -o "/tmp/${node_tar}"
	if [[ "${HOMEIO_VERBOSE}" == "true" ]]; then
		echo "${sha_expected}  /tmp/${node_tar}" | sha256sum -c -
	else
		echo "${sha_expected}  /tmp/${node_tar}" | sha256sum -c - >/dev/null
	fi
	tar -xzf "/tmp/${node_tar}" -C /usr/local --strip-components=1
	rm -f "/tmp/${node_tar}" /tmp/SHASUMS256.txt
}

install_yq() {
	if [[ "${HOMEIO_INSTALL_YQ}" != "true" ]]; then
		print_status "Skipping yq install (HOMEIO_INSTALL_YQ=${HOMEIO_INSTALL_YQ})."
		return
	fi

	if command_exists yq; then
		print_status "yq already installed."
		return
	fi

	local arch
	local yq_arch="arm64"
	local yq_sha=""
	arch="$(detect_arch)"
	if [[ "${arch}" == "x64" ]]; then
		yq_arch="amd64"
	fi

	print_status "Installing yq ${YQ_VERSION}..."
	curl -fsSL "https://github.com/mikefarah/yq/releases/download/v${YQ_VERSION}/checksums" -o /tmp/yq-checksums.txt
	yq_sha="$(grep " yq_linux_${yq_arch}\$" /tmp/yq-checksums.txt | awk '{print $1}')"
	[[ -n "${yq_sha}" ]] || { print_error "Could not find checksum for yq_linux_${yq_arch}"; exit 1; }

	curl -fsSL "https://github.com/mikefarah/yq/releases/download/v${YQ_VERSION}/yq_linux_${yq_arch}" -o /usr/local/bin/yq
	if [[ "${HOMEIO_VERBOSE}" == "true" ]]; then
		echo "${yq_sha}  /usr/local/bin/yq" | sha256sum -c -
	else
		echo "${yq_sha}  /usr/local/bin/yq" | sha256sum -c - >/dev/null
	fi
	chmod +x /usr/local/bin/yq
	rm -f /tmp/yq-checksums.txt
}

ensure_directories() {
	print_status "Ensuring installation directories..."

	mkdir -p "${INSTALL_DIR}"

	# App data directories
	print_status "Creating /DATA directories..."
	mkdir -p /DATA/{Apps,Documents,Media,Download}
	chmod 755 /DATA

	# Stack storage (STORE_STACKS_ROOT) and logs
	mkdir -p /var/lib/home-server/stacks
	mkdir -p "${INSTALL_DIR}/logs"
}

clone_or_update_repo() {
	print_status "Syncing repository (${REPO_BRANCH})..."

	# Remove existing installation if present
	if [[ -d "${INSTALL_DIR}" ]]; then
		cd /tmp || cd /
		print_status "Removing existing installation..."
		rm -rf "${INSTALL_DIR}"
	fi

	print_status "Cloning repository (branch: ${REPO_BRANCH})..."
	git clone --depth=1 --branch "${REPO_BRANCH}" "${REPO_URL}" "${INSTALL_DIR}" --quiet
}

unset_env_key() {
	local key="${1}"
	local file="${2}"
	local tmp_file
	tmp_file="$(mktemp)"

	awk -v key="${key}" '
		$0 ~ ("^" key "=") { next }
		{ print }
	' "${file}" >"${tmp_file}"

	cat "${tmp_file}" >"${file}"
	rm -f "${tmp_file}"
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

create_env_file() {
	print_status "Creating .env file..."

	# Generate auth session secret if not provided
	local auth_session_secret="${HOMEIO_AUTH_SESSION_SECRET:-}"
	if [[ -z "${auth_session_secret}" ]]; then
		auth_session_secret="$(openssl rand -hex 32)"
		print_status "Generated AUTH_SESSION_SECRET"
	fi

	# Generate database password
	local db_password
	db_password="$(openssl rand -hex 24)"
	local db_user="${HOMEIO_DB_USER:-home_server}"
	local db_name="${HOMEIO_DB_NAME:-home_server}"
	local database_url="postgresql://${db_user}:${db_password}@127.0.0.1:5432/${db_name}"

	cat > "${ENV_FILE}" <<EOF
# Home Server Configuration
# Generated on $(date)

# Server
PORT=${APP_PORT}
NODE_ENV=production
HOMEIO_HTTP_HOST=127.0.0.1

# Database
DATABASE_URL="${database_url}"
PG_MAX_CONNECTIONS=10

# Authentication
AUTH_SESSION_SECRET="${auth_session_secret}"
AUTH_ALLOW_REGISTRATION=true
AUTH_COOKIE_SECURE=false

# System Metrics
METRICS_CACHE_TTL_MS=2000
METRICS_PUBLISH_INTERVAL_MS=2000
SSE_HEARTBEAT_MS=8000

# WebSocket
WEBSOCKET_ENABLED=true

# Logging
LOG_LEVEL=info
LOG_TO_FILE=true
LOG_FILE_PATH=${INSTALL_DIR}/logs/home-server.log
NEXT_PUBLIC_LOG_LEVEL=info

# D-Bus Helper
DBUS_HELPER_SOCKET_PATH=/run/home-server/dbus-helper.sock

# Docker/App Stacks
STORE_STACKS_ROOT=/var/lib/home-server/stacks
STORE_DATA_ROOT=/DATA/AppData
EOF

	# Store for downstream steps
	EFFECTIVE_DB_USER="${db_user}"
	EFFECTIVE_DB_PASSWORD="${db_password}"
	EFFECTIVE_DB_NAME="${db_name}"

	print_status ".env file created successfully"
}

wait_for_postgres() {
	print_status "Waiting for PostgreSQL to be ready..."
	local attempts=0
	local max_attempts=20
	until runuser -u postgres -- psql -c "SELECT 1" >/dev/null 2>&1; do
		attempts=$((attempts + 1))
		if [[ "${attempts}" -ge "${max_attempts}" ]]; then
			print_error "PostgreSQL did not become ready after ${max_attempts} attempts"
			exit 1
		fi
		sleep 2
	done
	print_status "PostgreSQL is ready"
}

configure_local_postgres() {
	print_status "Configuring local PostgreSQL..."
	systemctl enable --now postgresql
	wait_for_postgres

	local db_user="${EFFECTIVE_DB_USER}"
	local db_pass="${EFFECTIVE_DB_PASSWORD}"
	local db_name="${EFFECTIVE_DB_NAME}"

	print_status "Ensuring PostgreSQL role '${db_user}'..."
	runuser -u postgres -- psql -v ON_ERROR_STOP=1 --set=db_user="${db_user}" --set=db_pass="${db_pass}" 2>&1 <<'SQL' || true
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_pass')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'db_user')
\gexec

SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'db_user', :'db_pass')
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'db_user')
\gexec
SQL

	print_status "Ensuring PostgreSQL database '${db_name}'..."
	if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='${db_name}'" | grep -q 1; then
		runuser -u postgres -- createdb --owner="${db_user}" "${db_name}"
	fi
}

install_homeio() {
	print_status "Installing ${APP_NAME}..."

	if [[ ! -d "${INSTALL_DIR}" ]]; then
		print_error "Installation directory not found: ${INSTALL_DIR}"
		exit 1
	fi

	cd "${INSTALL_DIR}" || { print_error "Failed to enter installation directory"; exit 1; }

	# Install dependencies
	print_status "Installing npm dependencies (this may take a few minutes)..."
	if [[ "${HOMEIO_VERBOSE}" == "true" ]]; then
		npm ci || { print_error "npm ci failed"; exit 1; }
	else
		npm ci --loglevel=error --no-audit --no-fund || { print_error "npm ci failed"; exit 1; }
	fi

	# Initialize database schema
	print_status "Initializing database schema..."
	if [[ "${HOMEIO_VERBOSE}" == "true" ]]; then
		(set -a && source "${ENV_FILE}" && set +a && npm run db:init) || { print_error "Database initialization failed"; exit 1; }
	else
		(set -a && source "${ENV_FILE}" && set +a && npm run db:init --silent) || { print_error "Database initialization failed"; exit 1; }
	fi

	# Build application
	print_status "Building Next.js application..."
	if [[ "${HOMEIO_VERBOSE}" == "true" ]]; then
		npm run build || { print_error "Build failed"; exit 1; }
	else
		npm run build --silent || { print_error "Build failed"; exit 1; }
	fi

	print_status "Installation completed successfully!"
}

install_systemd_service() {
	command_exists systemctl || { print_error "systemd is required but systemctl is not available."; exit 1; }

	local unit_file="/etc/systemd/system/${SERVICE_NAME}.service"
	print_status "Installing systemd unit ${SERVICE_NAME}.service..."

	cat >"${unit_file}" <<EOF
[Unit]
Description=${APP_NAME}
After=network-online.target postgresql.service docker.service
Wants=network-online.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/env node --import tsx ${INSTALL_DIR}/server.ts
Restart=always
RestartSec=10
KillMode=process
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
EOF

	systemctl daemon-reload
	systemctl enable "${SERVICE_NAME}.service"
	systemctl start "${SERVICE_NAME}.service"

	# Wait a moment for service to start
	sleep 2

	# Check service status
	if systemctl is-active --quiet "${SERVICE_NAME}"; then
		print_status "${APP_NAME} service started successfully!"
	else
		print_error "${APP_NAME} service failed to start. Check logs with: journalctl -u ${SERVICE_NAME} -n 50"
		exit 1
	fi
}

install_reverse_proxy() {
	command_exists systemctl || { print_error "systemd is required but systemctl is not available."; exit 1; }
	command_exists nginx || { print_error "nginx is required but was not found."; exit 1; }

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
	systemctl restart nginx
}

install_dbus_helper_service() {
	command_exists systemctl || { print_error "systemd is required but systemctl is not available."; exit 1; }

	local unit_file="/etc/systemd/system/${DBUS_SERVICE_NAME}.service"
	print_status "Installing systemd unit ${DBUS_SERVICE_NAME}.service..."

	cat >"${unit_file}" <<EOF
[Unit]
Description=${APP_NAME} DBus Network Helper
After=network.target dbus.service NetworkManager.service
Wants=NetworkManager.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${INSTALL_DIR}
Environment=DBUS_HELPER_SOCKET_PATH=/run/home-server/dbus-helper.sock
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=/usr/bin/env node ${INSTALL_DIR}/services/dbus-helper/index.mjs
Restart=on-failure
RestartSec=2
RuntimeDirectory=home-server
RuntimeDirectoryMode=0770
UMask=0007

[Install]
WantedBy=multi-user.target
EOF

	systemctl daemon-reload
	systemctl enable --now "${DBUS_SERVICE_NAME}.service"
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

	auth_entry="/register"

	if [[ "${HOMEIO_DRY_RUN}" == "true" ]]; then
		print_status "Dry run complete. Above actions would be performed during actual installation."
		return
	fi

	echo ""
	echo -e "${GREEN}╭────────────────────────────────────────────────────╮${NC}"
	echo -e "${GREEN}│         Installation Complete!                    │${NC}"
	echo -e "${GREEN}├────────────────────────────────────────────────────┤${NC}"
	echo -e "${GREEN}│${NC}  ${APP_NAME} is now running and accessible via:    ${GREEN}│${NC}"
	echo -e "${GREEN}│${NC}                                                  ${GREEN}│${NC}"
	printf "%b\n" "${GREEN}│${NC}  ${BLUE}*${NC} Local:      ${BLUE}${local_url}${NC}"
	if [[ -n "${network_url}" ]]; then
		printf "%b\n" "${GREEN}│${NC}  ${BLUE}*${NC} Network:    ${BLUE}${network_url}${NC}"
	fi
	echo -e "${GREEN}│${NC}                                                  ${GREEN}│${NC}"
	echo -e "${GREEN}╰────────────────────────────────────────────────────╯${NC}"
	echo ""

	echo -e "${BLUE}Manage service:${NC}"
	echo -e "  sudo systemctl [start|stop|restart|status] ${SERVICE_NAME}.service"
	echo ""
	echo -e "${BLUE}Manage DBus helper:${NC}"
	echo -e "  sudo systemctl [start|stop|restart|status] ${DBUS_SERVICE_NAME}.service"
	echo ""
	echo -e "${BLUE}View logs:${NC}"
	echo -e "  sudo journalctl -u ${SERVICE_NAME}.service -f"
	echo -e "  sudo journalctl -u ${DBUS_SERVICE_NAME}.service -f"
	echo ""
	echo -e "${BLUE}Configuration:${NC}"
	echo -e "  Environment: ${ENV_FILE}"
	echo -e "  App runtime: 127.0.0.1:${APP_PORT}"
	echo -e "  Auth entry:  ${auth_entry}"
	echo ""
}



main() {
	run_step "Checking root privileges..." require_root
	run_step "Checking apt availability..." ensure_apt
	run_step "Validating installer configuration..." validate_identifiers
	run_step "Configuring hostname..." configure_hostname
	run_step "Installing base packages..." install_packages
	run_step "Installing extras packages..." install_extras
	run_step "Installing Docker..." install_docker
	run_step "Installing Node.js..." install_node
	run_step "Installing yq (optional)..." install_yq
	run_step "Ensuring directories..." ensure_directories
	run_step "Syncing repository..." clone_or_update_repo
	run_step "Deploying OS configurations..." deploy_os_configs
	run_step "Creating environment file..." create_env_file
	run_step "Configuring PostgreSQL..." configure_local_postgres
	run_step "Installing application..." install_homeio
	run_step "Installing app systemd service..." install_systemd_service
	run_step "Configuring reverse proxy..." install_reverse_proxy
	run_step "Installing DBus helper service..." install_dbus_helper_service
	print_summary
}

main "$@"
