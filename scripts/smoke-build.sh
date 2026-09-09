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

PORT="$PORT" node build/index.js &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
	curl -sf -o /dev/null "http://localhost:$PORT/en" && break
	sleep 0.25
done

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

[ "$fail" = "0" ] && echo "Production build serves correctly." || exit 1
