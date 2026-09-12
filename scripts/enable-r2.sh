#!/usr/bin/env bash
#
# Switches media storage from the server's disk to R2.
#
#   ssh ubuntu@HOST 'sudo bash /srv/verum/app/scripts/enable-r2.sh https://img.example.com'
#
# The five R2 lines are written (commented out) by server-setup.sh or by hand;
# this uncomments them together and fills in the public address. Partial R2
# configuration is a deliberate error in the app — four values without the
# public URL would mean uploads whose URLs point nowhere.
set -euo pipefail

PUBLIC_URL=${1:?usage: enable-r2.sh https://img.example.com}
ENV_FILE=/etc/verum/.env

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }

if [[ $EUID -ne 0 ]]; then
	echo "Run with sudo: sudo bash $0 $PUBLIC_URL" >&2
	exit 1
fi

log "Enabling the R2 settings"
sed -i -E 's|^#(R2_(ACCOUNT_ID|ACCESS_KEY_ID|SECRET_ACCESS_KEY|BUCKET|PUBLIC_URL)=)|\1|' "$ENV_FILE"
sed -i -E "s|^R2_PUBLIC_URL=.*|R2_PUBLIC_URL=\"${PUBLIC_URL%/}\"|" "$ENV_FILE"
grep -E '^R2_' "$ENV_FILE" | sed -E 's|(SECRET_ACCESS_KEY=").{4}[^"]*|\1....(hidden)|'

missing=$(grep -cE '^R2_[A-Z_]+=""' "$ENV_FILE" || true)
if [[ "$missing" != "0" ]]; then
	echo "ERROR: some R2 values are still empty. Fill them in $ENV_FILE first." >&2
	exit 1
fi

log "Round trip: S3 write, public read, delete"
sudo -u verum -H bash -c 'cd /srv/verum/app && cat > r2-check.ts' <<'CHECK'
import { AwsClient } from 'aws4fetch';

const env = Object.fromEntries(
	(await Bun.file('/etc/verum/.env').text())
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => /^R2_[A-Z_]+=/.test(line))
		.map((line) => {
			const at = line.indexOf('=');
			return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, '')];
		})
);

const client = new AwsClient({
	accessKeyId: env.R2_ACCESS_KEY_ID,
	secretAccessKey: env.R2_SECRET_ACCESS_KEY,
	service: 's3',
	region: 'auto'
});
const key = 'img/_check/ok.txt';
const bucket = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}`;

const put = await client.fetch(`${bucket}/${key}`, {
	method: 'PUT',
	body: 'ok',
	headers: { 'content-type': 'text/plain' }
});
console.log('S3 write   :', put.status, put.ok ? 'ok' : await put.text());

// The reader's path: no credentials, straight over the custom domain.
const publicUrl = `${env.R2_PUBLIC_URL}/${key}`;
let served = 0;
for (let attempt = 1; attempt <= 10; attempt++) {
	const response = await fetch(publicUrl, { cache: 'no-store' });
	served = response.status;
	if (response.ok) break;
	await new Promise((r) => setTimeout(r, 3000));
}
console.log('public read:', served, served === 200 ? publicUrl : 'not reachable yet');

const del = await client.fetch(`${bucket}/${key}`, { method: 'DELETE' });
console.log('delete     :', del.status);
process.exit(served === 200 ? 0 : 1);
CHECK
set +e
sudo -u verum -H bash -c 'cd /srv/verum/app && bun r2-check.ts'
result=$?
set -e
sudo -u verum rm -f /srv/verum/app/r2-check.ts

if [[ $result -ne 0 ]]; then
	echo "The public URL did not serve the object. Check the bucket's custom domain." >&2
	exit 1
fi

log "Restarting"
systemctl restart verum
sleep 2
systemctl is-active --quiet verum && echo "  verum: active"
echo "  Uploads now go to R2. Files already in /srv/verum/.media stay where they are;"
echo "  nothing references them yet, so there is nothing to migrate."
