#!/usr/bin/env bash
#
# Builds and restarts VERUM on the server. Safe to run repeatedly.
#
#   ssh ubuntu@HOST 'sudo bash /srv/verum/app/scripts/deploy.sh'
set -euo pipefail

APP_USER=verum
APP_DIR=/srv/verum/app
ENV_FILE=/etc/verum/.env

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }

if [[ $EUID -ne 0 ]]; then
	echo "Run with sudo: sudo bash $0" >&2
	exit 1
fi

cd "$APP_DIR"

log "Fetching"
sudo -u "$APP_USER" git fetch --depth 50 origin main
sudo -u "$APP_USER" git reset --hard origin/main

# Provisioning links this; a checkout restored from a backup may not have it,
# and the build fails with "DATABASE_URL is not set" when it is missing.
[[ -e "$APP_DIR/.env" ]] || ln -sfn "$ENV_FILE" "$APP_DIR/.env"

log "Dependencies"
sudo -u "$APP_USER" bun install --frozen-lockfile

log "Migrations"
# Runs before the new build starts serving: a migration that fails must stop
# the deploy, not leave a running app against a half-migrated database.
DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
sudo -u "$APP_USER" env DATABASE_URL="$DATABASE_URL" bunx drizzle-kit migrate

log "Build"
sudo -u "$APP_USER" bun run build

log "Restart"
systemctl restart verum
sleep 2
systemctl is-active --quiet verum || {
	journalctl -u verum -n 30 --no-pager
	echo "verum failed to start" >&2
	exit 1
}

log "Smoke test"
PORT=$(grep -E '^PORT=' "$ENV_FILE" | cut -d= -f2 | tr -d '"' || echo 3000)
code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT:-3000}/en")
echo "GET /en -> $code"
[[ "$code" == "200" ]] || { echo "Smoke test failed" >&2; exit 1; }

log "Deployed: $(sudo -u "$APP_USER" git -C "$APP_DIR" log --oneline -1)"
