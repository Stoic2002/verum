#!/usr/bin/env bash
# Boots the adapter-node build and checks it answers.
#
# `vite preview` is not what runs in production. This is: node build/index.js,
# the same entry systemd will start. Native modules (sharp, @node-rs/argon2)
# are exactly the kind of thing that works under the dev server and fails here.
set -euo pipefail

PORT="${PORT:-4183}"
: "${DATABASE_URL:?DATABASE_URL is not set}"

[ -f build/index.js ] || { echo "build/index.js missing — run bun run build first" >&2; exit 1; }

# The server's output goes to a log, not to this script's stdout. Inheriting
# stdout keeps a pipe open after the script exits, so `bun run smoke | tail`
# hangs forever waiting for an EOF the background process never sends.
LOG=$(mktemp)
# ORIGIN is what lets SvelteKit recognise its own address; without it every
# form POST is rejected as cross-site. Set from this script's own port rather
# than inherited: an ORIGIN pointing at the real site would not match this
# ephemeral server, and the check below would fail for the wrong reason.
ORIGIN="http://localhost:$PORT" PORT="$PORT" node build/index.js >"$LOG" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true; rm -f "$LOG"' EXIT

started=0
for _ in $(seq 1 80); do
	if curl -sf -o /dev/null "http://localhost:$PORT/en"; then started=1; break; fi
	if ! kill -0 $SERVER 2>/dev/null; then
		echo "Server exited before answering:" >&2
		cat "$LOG" >&2
		exit 1
	fi
	sleep 0.25
done

if [ "$started" != "1" ]; then
	echo "Server did not answer on port $PORT:" >&2
	cat "$LOG" >&2
	exit 1
fi

code() { curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT$1"; }

fail=0
check() {
	local path="$1" expected="$2" actual
	actual=$(code "$path")
	if [ "$actual" = "$expected" ]; then
		echo "  ok   $path -> $actual"
	else
		echo "  FAIL $path -> $actual (expected $expected)" >&2
		fail=1
	fi
}

check /en 200
check / 301
check /admin 303
check /admin/login 200
check /media/img/does-not-exist/640w.avif 404
check /en/ai 200
check /en/tag/llm 200
check /en/topic/ai-tooling 200
check /id 200
check /en/not-a-real-category 404
check /en/search 200
check /en/newsletter 200
check /en/newsletter/confirm 200
check /robots.txt 200
check /rss.xml 200
check /sitemap.xml 200
check /sitemap-en.xml 200
check /sitemap-id.xml 200
check /sitemap-de.xml 404
check /ads.txt 404
check /en/about 200
check /en/privacy 200
check /en/editorial-policy 200
check /id/terms 200

# A POST, not just GETs.
#
# adapter-node refuses form submissions whose origin it cannot verify, and a
# suite of GET checks will never see it: the site looks perfectly healthy while
# login and every editor action return 403.
post_code() {
	curl -s -o /dev/null -w '%{http_code}' \
		-X POST "http://localhost:$PORT$1" \
		-H 'content-type: application/x-www-form-urlencoded' \
		-H "origin: http://localhost:$PORT" \
		--data "$2"
}

login=$(post_code /admin/login 'email=nobody@example.test&password=wrong')
if [ "$login" = "403" ]; then
	echo "  FAIL POST /admin/login -> 403 (set ORIGIN; form submissions are being rejected)" >&2
	fail=1
elif [ "$login" = "200" ] || [ "$login" = "400" ]; then
	echo "  ok   POST /admin/login -> $login (form submissions accepted)"
else
	echo "  FAIL POST /admin/login -> $login" >&2
	fail=1
fi

[ "$fail" = "0" ] && echo "Production build serves correctly." || exit 1
