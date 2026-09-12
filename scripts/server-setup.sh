#!/usr/bin/env bash
#
# Provisions a fresh Ubuntu 24.04 server for VERUM.
#
# Idempotent: safe to run again after a change, and it is the only record of
# how the server was built. If this machine is ever lost, a new one is this
# script plus a database restore — not an afternoon of remembered commands.
#
#   scp scripts/server-setup.sh ubuntu@HOST:/tmp/
#   ssh ubuntu@HOST 'sudo bash /tmp/server-setup.sh'
set -euo pipefail

APP_USER=verum
APP_DIR=/srv/verum
ENV_FILE=/etc/verum/.env
REPO=${REPO:-https://github.com/Stoic2002/verum.git}
SWAP_SIZE=${SWAP_SIZE:-2G}

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }

if [[ $EUID -ne 0 ]]; then
	echo "Run with sudo: sudo bash $0" >&2
	exit 1
fi

log "System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq ca-certificates curl git gnupg ufw fail2ban unattended-upgrades acl

log "Swap (${SWAP_SIZE})"
# 2 GB of RAM with image processing peaking near 700 MB: without swap, a spike
# does not slow the machine down, it makes Linux kill PostgreSQL or Node.
if ! swapon --show | grep -q .; then
	fallocate -l "$SWAP_SIZE" /swapfile
	chmod 600 /swapfile
	mkswap /swapfile >/dev/null
	swapon /swapfile
	grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi
# Swap as insurance, not as memory: only reach for it when RAM is nearly gone.
echo 'vm.swappiness=10' >/etc/sysctl.d/99-verum.conf
sysctl -q --system

log "Firewall"
# The Lighthouse console has its own firewall; this is the second lock, on the
# machine itself. SSH is allowed before enabling, or this command locks us out.
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
systemctl enable --now fail2ban >/dev/null

log "Unattended security upgrades"
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null

log "PostgreSQL 16"
# 16 is what Ubuntu 24.04 ships, what CI tests against, and what PRD §10.1 names.
apt-get install -y -qq postgresql postgresql-contrib
systemctl enable --now postgresql
PG_VERSION=$(psql --version | grep -oE '[0-9]+' | head -1)
[[ "$PG_VERSION" == "16" ]] || echo "WARNING: PostgreSQL $PG_VERSION, expected 16 (CI tests on 16)"

log "Node 22"
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
	curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
	apt-get install -y -qq nodejs
fi

log "Bun (build toolchain)"
if ! command -v bun >/dev/null; then
	curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash >/dev/null
fi

log "Caddy"
if ! command -v caddy >/dev/null; then
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' |
		gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
		>/etc/apt/sources.list.d/caddy-stable.list
	apt-get update -qq
	apt-get install -y -qq caddy
fi

log "Application user and directories"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR" /etc/verum /var/backups/verum
chown -R "$APP_USER:$APP_USER" "$APP_DIR" /var/backups/verum
chmod 750 "$APP_DIR" /var/backups/verum

log "Database role and schema"
DB_PASSWORD_FILE=/etc/verum/db-password
if [[ ! -f "$DB_PASSWORD_FILE" ]]; then
	openssl rand -base64 32 | tr -d '\n/+=' >"$DB_PASSWORD_FILE"
	chmod 600 "$DB_PASSWORD_FILE"
fi
DB_PASSWORD=$(cat "$DB_PASSWORD_FILE")
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$APP_USER'" | grep -q 1 ||
	sudo -u postgres psql -q -c "CREATE ROLE $APP_USER LOGIN PASSWORD '$DB_PASSWORD'"
sudo -u postgres psql -q -c "ALTER ROLE $APP_USER PASSWORD '$DB_PASSWORD'"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$APP_USER'" | grep -q 1 ||
	sudo -u postgres createdb -O "$APP_USER" "$APP_USER"

log "Environment file"
# Production secrets are generated here and never copied from a laptop: the
# development values have been in shell history, editors and backups.
if [[ ! -f "$ENV_FILE" ]]; then
	cat >"$ENV_FILE" <<ENV
# Written by scripts/server-setup.sh. Secrets are generated on this machine.
DATABASE_URL="postgres://$APP_USER:$DB_PASSWORD@localhost:5432/$APP_USER"
SESSION_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
PREVIEW_TOKEN_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
AI_KEY_SECRET="$(openssl rand -base64 48 | tr -d '\n')"

# Set ORIGIN and PUBLIC_SITE_URL to the real address, or every form POST is
# rejected as cross-site (adapter-node checks the Origin header).
ORIGIN="http://SERVER_IP"
PUBLIC_SITE_URL="http://SERVER_IP"
PUBLIC_SITE_NAME="VERUM"
PUBLIC_CONTACT_EMAIL=""
PUBLIC_POLICY_UPDATED="$(date +%F)"

# Behind Cloudflare later: the visitor's address arrives in this header.
ADDRESS_HEADER=""
XFF_DEPTH="1"

# Media on the local disk until R2 is configured (see docs/SETUP-SERVICES.md).
MEDIA_FS_DIR="$APP_DIR/.media"

NODE_ENV="production"
PORT="3000"
HOST="127.0.0.1"
ENV
	sed -i "s|SERVER_IP|$(curl -fsS --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')|g" "$ENV_FILE"
fi
chown root:"$APP_USER" "$ENV_FILE"
chmod 640 "$ENV_FILE"

log "Application checkout"
if [[ ! -d "$APP_DIR/app/.git" ]]; then
	sudo -u "$APP_USER" git clone --depth 50 "$REPO" "$APP_DIR/app"
fi
sudo -u "$APP_USER" mkdir -p "$APP_DIR/.media"
# `bun run build` loads .env from the project directory, while systemd loads
# /etc/verum/.env. A link keeps one file rather than two copies of the secrets.
ln -sfn "$ENV_FILE" "$APP_DIR/app/.env"

log "systemd service"
cat >/etc/systemd/system/verum.service <<UNIT
[Unit]
Description=VERUM
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR/app
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node build/index.js
Restart=always
RestartSec=3
# The service needs nothing outside its own directories.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload

log "Caddy site"
# Plain HTTP against the IP until a domain exists; Caddy will take over TLS
# automatically once the Caddyfile names a domain (see docs/DEPLOY.md).
if [[ ! -f /etc/caddy/Caddyfile.verum ]]; then
	cat >/etc/caddy/Caddyfile <<'CADDY'
:80 {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
CADDY
	touch /etc/caddy/Caddyfile.verum
	systemctl reload caddy || systemctl restart caddy
fi

log "Done"
cat <<SUMMARY

  PostgreSQL : $(psql --version)
  Node       : $(node -v)
  Bun        : $(bun --version)
  Caddy      : $(caddy version | head -1)
  Swap       : $(swapon --show=NAME,SIZE --noheadings | tr '\n' ' ')
  App dir    : $APP_DIR/app
  Env file   : $ENV_FILE (edit ORIGIN and PUBLIC_SITE_URL when a domain exists)

  Next: scripts/deploy.sh on the server.

SUMMARY
