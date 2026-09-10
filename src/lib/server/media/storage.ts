import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import { AwsClient } from 'aws4fetch';
import { serverEnv as env } from '../env';

/**
 * Object storage behind one small interface.
 *
 * R2 in production (egress is free, which is what makes an image-heavy site
 * affordable — PRD §10.1). A local directory otherwise, so uploads can be
 * built and tested before an R2 account exists and in CI, which has no
 * credentials.
 */
export interface Storage {
	readonly driver: 'r2' | 'fs';
	put(key: string, body: Buffer, contentType: string): Promise<void>;
	remove(keys: string[]): Promise<void>;
	/** Public URL for a stored object. */
	url(key: string): string;
}

/** Keys are built by this codebase, never by a user; this is the belt to that braces. */
function assertSafeKey(key: string): string {
	const clean = normalize(key);
	if (clean !== key || key.startsWith('/') || key.includes('..')) {
		throw new Error(`Unsafe storage key: ${key}`);
	}
	return key;
}

function createR2Storage(): Storage {
	const accountId = env.R2_ACCOUNT_ID!;
	const bucket = env.R2_BUCKET!;
	const publicUrl = (env.R2_PUBLIC_URL ?? '').replace(/\/+$/, '');

	const client = new AwsClient({
		accessKeyId: env.R2_ACCESS_KEY_ID!,
		secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
		service: 's3',
		region: 'auto'
	});

	const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;

	return {
		driver: 'r2',

		async put(key, body, contentType) {
			assertSafeKey(key);
			const response = await client.fetch(`${endpoint}/${key}`, {
				method: 'PUT',
				body: new Uint8Array(body),
				headers: {
					'content-type': contentType,
					// Keys are content-hashed, so an object never changes meaning and
					// can be cached for a year (PRD §10.3).
					'cache-control': 'public, max-age=31536000, immutable'
				}
			});
			if (!response.ok) {
				throw new Error(`R2 PUT ${key} failed: ${response.status} ${await response.text()}`);
			}
		},

		async remove(keys) {
			for (const key of keys) {
				const response = await client.fetch(`${endpoint}/${assertSafeKey(key)}`, {
					method: 'DELETE'
				});
				// 404 means it is already gone, which is the desired end state.
				if (!response.ok && response.status !== 404) {
					throw new Error(`R2 DELETE ${key} failed: ${response.status}`);
				}
			}
		},

		url: (key) => `${publicUrl}/${key}`
	};
}

function createFsStorage(): Storage {
	const root = resolve(env.MEDIA_FS_DIR || '.media');

	return {
		driver: 'fs',

		async put(key, body) {
			const path = join(root, assertSafeKey(key));
			await mkdir(dirname(path), { recursive: true });
			await writeFile(path, body);
		},

		async remove(keys) {
			for (const key of keys) {
				await rm(join(root, assertSafeKey(key)), { force: true });
			}
		},

		// Served by src/routes/media/[...path], which exists only for this driver.
		url: (key) => `/media/${key}`
	};
}

let cached: Storage | undefined;

/**
 * R2 as soon as it is fully configured, local files otherwise.
 *
 * Partial configuration is treated as an error rather than quietly falling back
 * — a production deploy missing one variable would otherwise write uploads to
 * a container-local directory and lose them on the next restart.
 */
export function getStorage(): Storage {
	if (cached) return cached;

	const r2Vars = [
		'R2_ACCOUNT_ID',
		'R2_ACCESS_KEY_ID',
		'R2_SECRET_ACCESS_KEY',
		'R2_BUCKET'
	] as const;
	const present = r2Vars.filter((name) => env[name]);

	if (present.length === r2Vars.length) {
		if (!env.R2_PUBLIC_URL) throw new Error('R2_PUBLIC_URL is required when R2 is configured');
		cached = createR2Storage();
	} else if (present.length > 0) {
		const missing = r2Vars.filter((name) => !env[name]);
		throw new Error(`R2 is partially configured; missing: ${missing.join(', ')}`);
	} else {
		cached = createFsStorage();
	}

	return cached;
}

/** Tests swap the backend without touching the environment. */
export function setStorage(storage: Storage | undefined) {
	cached = storage;
}

export function mediaFsRoot(): string {
	return resolve(env.MEDIA_FS_DIR || '.media');
}
