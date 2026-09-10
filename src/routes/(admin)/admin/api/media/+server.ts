import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getStorage, listMediaAfter, parseMediaCursor, pictureFor } from '$lib/server/media';

/**
 * Search for the editor's image picker, one page after a cursor.
 *
 * Finding one specific image is what a picker is for, so it searches rather
 * than scrolls, and "load more" continues from the last image shown rather
 * than from an offset — see listMediaAfter for why that distinction matters
 * when uploads happen while the picker is open.
 *
 * Guarded by the /admin session check in hooks.server.ts.
 */
export const GET: RequestHandler = async ({ url }) => {
	const search = (url.searchParams.get('q') ?? '').slice(0, 100);
	const rawCursor = url.searchParams.get('cursor');

	const after = rawCursor ? parseMediaCursor(rawCursor) : null;
	if (rawCursor && !after) {
		// Refused rather than ignored: silently restarting from the top would
		// hand the picker page one again and repeat every image it already has.
		return json({ error: 'Invalid cursor' }, { status: 400 });
	}

	const storage = getStorage();
	const { items, left, nextCursor } = await listMediaAfter(db, { limit: 24, search, after });

	return json({
		left,
		nextCursor,
		items: items.map((row) => ({
			id: row.id,
			alt: row.alt,
			thumb: pictureFor(row, (key) => storage.url(key)).src
		}))
	});
};
