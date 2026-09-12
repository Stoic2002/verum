#!/usr/bin/env bash
#
# Points the server at a domain: Caddy serves it over HTTPS, and the app is
# told its own address.
#
#   ssh ubuntu@HOST 'sudo bash /srv/verum/app/scripts/enable-domain.sh verumdaily.com'
#
# Run this while DNS is still "DNS only" in Cloudflare. Let's Encrypt has to
# reach this machine directly to prove the domain, and the certificate must
# exist before the proxy is turned on — Cloudflare's Full (strict) mode
# refuses an origin without a valid one.
set -euo pipefail

DOMAIN=${1:?usage: enable-domain.sh DOMAIN}
ENV_FILE=/etc/verum/.env

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }

if [[ $EUID -ne 0 ]]; then
	echo "Run with sudo: sudo bash $0 $DOMAIN" >&2
	exit 1
fi

resolved=$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)
public=$(curl -fsS --max-time 5 https://api.ipify.org || true)
if [[ -n "$resolved" && -n "$public" && "$resolved" != "$public" ]]; then
	echo "WARNING: $DOMAIN resolves to $resolved, this server is $public." >&2
	echo "The certificate will fail until DNS points here. Continuing anyway." >&2
fi

log "Caddy"
cat >/etc/caddy/Caddyfile <<CADDY
# One canonical host: www redirects to the apex, so the same article is never
# reachable at two addresses (PRD §12.1).
$DOMAIN, www.$DOMAIN {
	encode zstd gzip

	header {
		# A year, and every subdomain: img.$DOMAIN serves media over HTTPS too.
		# No preload directive yet — that one is hard to undo.
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"
		# The app sends its own Content-Security-Policy per response (vite.config.ts):
		# it carries per-page script hashes, which a static header here cannot.
		-Server
	}

	@www host www.$DOMAIN
	redir @www https://$DOMAIN{uri} permanent

	reverse_proxy 127.0.0.1:3000
}

# Anything else — the bare IP, a stray hostname — gets nothing.
:80 {
	respond 404
}
CADDY
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
systemctl reload caddy

log "Application address"
# adapter-node checks the Origin header on every form POST; a stale ORIGIN
# turns every save in the admin into a 403.
sed -i "s|^ORIGIN=.*|ORIGIN=\"https://$DOMAIN\"|" "$ENV_FILE"
sed -i "s|^PUBLIC_SITE_URL=.*|PUBLIC_SITE_URL=\"https://$DOMAIN\"|" "$ENV_FILE"
grep -E '^(ORIGIN|PUBLIC_SITE_URL)=' "$ENV_FILE"
systemctl restart verum

log "Waiting for the certificate"
for attempt in $(seq 1 30); do
	code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$DOMAIN/en" || true)
	[[ "$code" == "200" ]] && break
	sleep 5
done

log "Result"
curl -sI --max-time 10 "https://$DOMAIN/en" | head -3 || true
echo
echo "  https://$DOMAIN/en       -> $(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://$DOMAIN/en" || echo 'no answer')"
echo "  http://$DOMAIN/en        -> $(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://$DOMAIN/en" || echo 'no answer')  (301 to https is correct)"
echo "  https://www.$DOMAIN/en   -> $(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://www.$DOMAIN/en" || echo 'no answer')  (301 to the apex is correct)"
echo
echo "Next: turn the Cloudflare proxy on (orange cloud), set SSL/TLS to Full (strict),"
echo "then add ADDRESS_HEADER=\"CF-Connecting-IP\" to $ENV_FILE and restart."
