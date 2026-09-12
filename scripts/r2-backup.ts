/**
 * Uploads one database dump to R2 and prunes old ones.
 *
 *   bun scripts/r2-backup.ts /var/backups/verum/verum-20260913T020000Z.dump
 *
 * Off-site is the whole point: a dump that only exists on the machine it was
 * taken from is not a backup of that machine (PRD §15). Retention is 30 days,
 * applied to the copies in R2 — the local ones are pruned by the shell script.
 */
import { AwsClient } from 'aws4fetch';
import { basename } from 'node:path';

const RETENTION_DAYS = 30;
const PREFIX = 'backups/';

const file = process.argv[2];
if (!file) throw new Error('usage: bun scripts/r2-backup.ts <dump>');

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
for (const name of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']) {
	if (!env[name]) throw new Error(`${name} is not set; backups cannot be sent off-site.`);
}

const client = new AwsClient({
	accessKeyId: env.R2_ACCESS_KEY_ID,
	secretAccessKey: env.R2_SECRET_ACCESS_KEY,
	service: 's3',
	region: 'auto'
});
const bucket = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}`;

const key = `${PREFIX}${basename(file)}`;
const body = await Bun.file(file).arrayBuffer();
const put = await client.fetch(`${bucket}/${key}`, {
	method: 'PUT',
	body: new Uint8Array(body),
	headers: { 'content-type': 'application/octet-stream' }
});
if (!put.ok) throw new Error(`upload failed: ${put.status} ${await put.text()}`);
console.log(`uploaded ${key} (${(body.byteLength / 1024 / 1024).toFixed(1)} MB)`);

// Prune: list what is there, delete what is past retention. Listing is one
// request; deleting only touches what has aged out.
const listed = await client.fetch(`${bucket}?list-type=2&prefix=${encodeURIComponent(PREFIX)}`);
if (!listed.ok) throw new Error(`list failed: ${listed.status}`);
const xml = await listed.text();

const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
const objects = [...xml.matchAll(/<Key>([^<]+)<\/Key>\s*<LastModified>([^<]+)<\/LastModified>/g)];
let removed = 0;
for (const [, objectKey, modified] of objects) {
	if (Date.parse(modified) >= cutoff) continue;
	const deleted = await client.fetch(`${bucket}/${objectKey}`, { method: 'DELETE' });
	if (deleted.ok || deleted.status === 404) removed++;
}
console.log(
	`kept ${objects.length - removed} backups in R2, removed ${removed} older than ${RETENTION_DAYS} days`
);
