#!/usr/bin/env bash
#
# Closes ports 80 and 443 to everything except Cloudflare.
#
#   ssh ubuntu@HOST 'sudo bash /srv/verum/app/scripts/restrict-to-cloudflare.sh'
#
# Run this only once the domain is proxied (orange cloud). Until then the
# origin is reached directly and this would take the site offline.
#
# This is not optional hardening. ADDRESS_HEADER=CF-Connecting-IP tells the app
# to trust a header for the visitor's address; anyone who can reach the origin
# directly can then send any address they like and walk past the login rate
# limit entirely. The header is only safe while this rule holds (PLAN-DEV §F).
set -euo pipefail

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }

if [[ $EUID -ne 0 ]]; then
	echo "Run with sudo: sudo bash $0" >&2
	exit 1
fi

log "Checking the site is served through Cloudflare"
DOMAIN=$(grep -E '^ORIGIN=' /etc/verum/.env | cut -d= -f2- | tr -d '"' | sed 's|https\?://||')
if ! curl -sI --max-time 10 "https://$DOMAIN/en" | grep -qi '^server: cloudflare'; then
	echo "ERROR: https://$DOMAIN is not answering through Cloudflare yet." >&2
	echo "Turn the proxy on (orange cloud) first, or this rule locks readers out." >&2
	exit 1
fi

log "Fetching Cloudflare's address ranges"
v4=$(curl -fsS --max-time 15 https://www.cloudflare.com/ips-v4)
v6=$(curl -fsS --max-time 15 https://www.cloudflare.com/ips-v6)
[[ -n "$v4" ]] || { echo "Empty range list; refusing to continue." >&2; exit 1; }

log "Rewriting the rules"
# Remove the open rules first so re-running does not pile up duplicates.
ufw --force delete allow 80/tcp >/dev/null 2>&1 || true
ufw --force delete allow 443/tcp >/dev/null 2>&1 || true
for range in $v4 $v6; do
	ufw allow from "$range" to any port 80 proto tcp comment 'cloudflare' >/dev/null
	ufw allow from "$range" to any port 443 proto tcp comment 'cloudflare' >/dev/null
done

log "Result"
ufw status | grep -c cloudflare | sed 's/^/  cloudflare rules: /'
echo "  SSH: still open — locking yourself out of the machine is the one mistake"
echo "  that costs a console session to undo."
echo
echo "Certificates: Caddy renews over port 80, and Cloudflare proxies that path,"
echo "so renewal keeps working behind this rule."
