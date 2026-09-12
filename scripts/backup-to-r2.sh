#!/usr/bin/env bash
#
# Daily database backup: dump locally, copy to R2, prune both.
#
#   sudo bash scripts/backup-to-r2.sh install   # create and start the timer
#   bash scripts/backup-to-r2.sh                # run one backup now (as verum)
#
# PRD §15: daily dump off-site, 30 days retained, and a restore tested before
# launch. scripts/restore-test.sh is the second half of that.
set -euo pipefail

ENV_FILE=/etc/verum/.env
OUT_DIR=/var/backups/verum
APP_DIR=/srv/verum/app
KEEP_LOCAL=7

if [[ ${1:-} == "install" ]]; then
	[[ $EUID -eq 0 ]] || { echo "Run with sudo: sudo bash $0 install" >&2; exit 1; }

	cat >/etc/systemd/system/verum-backup.service <<'UNIT'
[Unit]
Description=VERUM database backup to R2
After=network-online.target postgresql.service

[Service]
Type=oneshot
User=verum
ExecStart=/usr/bin/env bash /srv/verum/app/scripts/backup-to-r2.sh
UNIT

	cat >/etc/systemd/system/verum-backup.timer <<'UNIT'
[Unit]
Description=Daily VERUM backup

[Timer]
# 02:30 UTC is 09:30 in Jakarta: after the night's traffic, before the day's.
OnCalendar=*-*-* 02:30:00
# Spread the load and, more usefully, survive a reboot during the window.
RandomizedDelaySec=900
Persistent=true

[Install]
WantedBy=timers.target
UNIT

	systemctl daemon-reload
	systemctl enable --now verum-backup.timer
	systemctl list-timers verum-backup.timer --no-pager | head -3
	exit 0
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

mkdir -p "$OUT_DIR"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
file="$OUT_DIR/verum-$stamp.dump"

pg_dump --format=custom --no-owner --no-privileges --file="$file" "$DATABASE_URL"
echo "dumped $(basename "$file") ($(du -h "$file" | cut -f1))"

cd "$APP_DIR"
bun scripts/r2-backup.ts "$file"

# Local copies are the fast path for a restore; R2 is the copy that survives
# losing this machine. Seven days locally is plenty for the fast path.
ls -t "$OUT_DIR"/verum-*.dump | tail -n +$((KEEP_LOCAL + 1)) | xargs -r rm -f
echo "local copies: $(ls -1 "$OUT_DIR"/verum-*.dump | wc -l)"
