import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getStorage, listMedia, pictureFor } from '$lib/server/media';

/**
 * Search for the editor's image picker.
 *
 * The picker used to receive the newest sixty images inline, which meant an
 * older image could not be inserted at all once the library grew past that.
 * Finding one specific image is what a picker is for, so it searches rather
 * than scrolls. Guarded by the /admin session check in hooks.server.ts.
 */
export const GET: RequestHandler = async ({ url }) => {
	const search = (url.searchParams.get('q') ?? '').slice(0, 100);
	const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0);
	const storage = getStorage();

	const { items, total } = await listMedia(db, { limit: 24, offset, search });

	return json({
		total,
		items: items.map((row) => ({
			id: row.id,
			alt: row.alt,
			thumb: pictureFor(row, (key) => storage.url(key)).src
		}))
	});
};
