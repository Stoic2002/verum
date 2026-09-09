import { createReadStream, statSync } from 'node:fs';
import { join, normalize, resolve as resolvePath } from 'node:path';
import { Readable } from 'node:stream';
import { error, type RequestHandler } from '@sveltejs/kit';
import { getStorage, mediaFsRoot } from '$lib/server/media';

/**
 * Serves uploads from disk when the filesystem storage driver is active.
 *
 * Development and CI only. With R2 configured, images are served straight from
 * the bucket's public domain and this route refuses to answer at all — it must
 * never become an accidental origin for production traffic.
 */
const TYPES: Record<string, string> = {
	avif: 'image/avif',
	webp: 'image/webp',
	jpg: 'image/jpeg',
	png: 'image/png',
	tif: 'image/tiff',
	gif: 'image/gif'
};

export const GET: RequestHandler = async ({ params }) => {
	if (getStorage().driver !== 'fs') error(404, 'Not found');

	const root = mediaFsRoot();
	const requested = resolvePath(join(root, normalize(params.path ?? '')));

	// Path traversal check: the resolved path must stay inside the root.
	if (requested !== root && !requested.startsWith(root + '/')) error(404, 'Not found');

	let size: number;
	try {
		const stat = statSync(requested);
		if (!stat.isFile()) error(404, 'Not found');
		size = stat.size;
	} catch {
		error(404, 'Not found');
	}

	const extension = requested.split('.').pop() ?? '';

	return new Response(Readable.toWeb(createReadStream(requested)) as ReadableStream, {
		headers: {
			'content-type': TYPES[extension] ?? 'application/octet-stream',
			'content-length': String(size),
			// Content-hashed keys, so the object at a key never changes.
			'cache-control': 'public, max-age=31536000, immutable'
		}
	});
};
