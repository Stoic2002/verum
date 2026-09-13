import { fail, type Actions } from '@sveltejs/kit';
import { parseCredit } from '$lib/credit';
import { db } from '$lib/server/db';
import { articleSurfaces, purgeUrls } from '$lib/server/cdn';
import { rerenderArticlesUsingMedia } from '$lib/server/content/articles';
import {
	MAX_UPLOAD_BYTES,
	UploadError,
	deleteMedia,
	fetchImageFromUrl,
	getStorage,
	listMedia,
	pictureFor,
	updateMediaMeta,
	uploadImage
} from '$lib/server/media';
import { siteOrigin } from '$lib/server/site';
import type { PageServerLoad } from './$types';

const PER_PAGE = 24;

export const load: PageServerLoad = async ({ url }) => {
	const storage = getStorage();

	const search = url.searchParams.get('q') ?? '';
	const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);

	const { items, total } = await listMedia(db, {
		limit: PER_PAGE,
		offset: (page - 1) * PER_PAGE,
		search
	});

	return {
		driver: storage.driver,
		maxBytes: MAX_UPLOAD_BYTES,
		search,
		page,
		total,
		pages: Math.max(1, Math.ceil(total / PER_PAGE)),
		media: items.map((row) => ({
			...row,
			picture: pictureFor(row, (key) => storage.url(key)),
			totalBytes: row.bytes + row.variants.reduce((sum, v) => sum + v.bytes, 0)
		}))
	};
};

/**
 * PRD §14 allows only clearly licensed stock or images made here, and every
 * image shows its credit underneath. So a credit is required on every path in —
 * a file from your own disk can be someone else's photo just as easily as a
 * URL can. Your own image is credited too ("VERUM"), which is what tells a
 * reader, or a reviewer, that it was not lifted from elsewhere.
 */
export const actions: Actions = {
	upload: async ({ request }) => {
		const data = await request.formData();
		const file = data.get('file');
		const alt = String(data.get('alt') ?? '').trim();

		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: 'Choose an image to upload.' });
		}
		if (!alt) {
			// Enforced here, not just in the column default: an image without alt
			// text is an accessibility defect, and the moment to fix it is now.
			return fail(400, { error: 'Alt text is required.' });
		}
		const credit = parseCredit(data.get('credit'), data.get('creditUrl'));
		if (!credit.ok) return fail(400, { error: credit.error });

		try {
			const record = await uploadImage(
				db,
				{ buffer: Buffer.from(await file.arrayBuffer()), name: file.name },
				{ alt, credit: credit.credit, creditUrl: credit.creditUrl }
			);
			return { toast: `Added #${record.id} — ${record.variants.length} renditions written.` };
		} catch (error) {
			if (error instanceof UploadError) return fail(400, { error: error.message });
			throw error;
		}
	},

	/**
	 * Imports an image the editor pasted a URL for.
	 *
	 * Making it easy to fetch a URL does not make it legal to use. The source
	 * link defaults to the address it was fetched from when none is given, so
	 * where it came from is on record either way.
	 */
	importUrl: async ({ request }) => {
		const data = await request.formData();
		const url = String(data.get('url') ?? '').trim();
		const alt = String(data.get('alt') ?? '').trim();

		if (!url) return fail(400, { error: 'Paste an image URL.' });
		if (!alt) return fail(400, { error: 'Alt text is required.' });
		const credit = parseCredit(data.get('credit'), data.get('creditUrl'));
		if (!credit.ok) return fail(400, { error: credit.error });

		try {
			const fetched = await fetchImageFromUrl(url);
			const record = await uploadImage(
				db,
				{ buffer: fetched.buffer, name: fetched.name },
				{ alt, credit: credit.credit, creditUrl: credit.creditUrl }
			);
			return { toast: `Added #${record.id} — ${record.variants.length} renditions written.` };
		} catch (error) {
			if (error instanceof UploadError) return fail(400, { error: error.message });
			if (error instanceof Error && error.name === 'TimeoutError') {
				return fail(400, { error: 'That URL took too long to respond.' });
			}
			if (error instanceof Error && /fetch failed/i.test(error.message)) {
				return fail(400, { error: 'Could not reach that URL.' });
			}
			throw error;
		}
	},

	updateMeta: async ({ request, url }) => {
		const data = await request.formData();
		const id = Number(data.get('id'));
		const alt = String(data.get('alt') ?? '').trim();
		if (!Number.isInteger(id)) return fail(400, { error: 'Bad id' });
		if (!alt) return fail(400, { error: 'Alt text is required.' });
		const credit = parseCredit(data.get('credit'), data.get('creditUrl'));
		if (!credit.ok) return fail(400, { error: credit.error });

		await updateMediaMeta(db, id, { alt, credit: credit.credit, creditUrl: credit.creditUrl });

		// Articles store rendered HTML, so the new credit reaches them only by
		// re-rendering — and the edge only after a purge.
		const touched = await rerenderArticlesUsingMedia(db, id);
		if (touched.length) {
			const origin = siteOrigin(url);
			await purgeUrls(
				touched.flatMap((row) => articleSurfaces(origin, row.locale, row.categorySlug, row.slug))
			);
		}

		return {
			toast: touched.length
				? `Image details saved. ${touched.length} article page${touched.length === 1 ? '' : 's'} updated.`
				: 'Image details saved.'
		};
	},

	delete: async ({ request }) => {
		const data = await request.formData();
		const id = Number(data.get('id'));
		if (!Number.isInteger(id)) return fail(400, { error: 'Bad id' });

		await deleteMedia(db, id);
		return { toast: 'Image deleted.' };
	}
};
