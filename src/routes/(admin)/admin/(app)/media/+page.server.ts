import { fail, type Actions } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	MAX_UPLOAD_BYTES,
	UploadError,
	deleteMedia,
	getStorage,
	listMedia,
	pictureFor,
	updateMediaMeta,
	uploadImage
} from '$lib/server/media';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const storage = getStorage();
	const rows = await listMedia(db);

	return {
		driver: storage.driver,
		maxBytes: MAX_UPLOAD_BYTES,
		media: rows.map((row) => ({
			...row,
			picture: pictureFor(row, (key) => storage.url(key)),
			totalBytes: row.bytes + row.variants.reduce((sum, v) => sum + v.bytes, 0)
		}))
	};
};

export const actions: Actions = {
	upload: async ({ request }) => {
		const data = await request.formData();
		const file = data.get('file');
		const alt = String(data.get('alt') ?? '').trim();
		const credit = String(data.get('credit') ?? '').trim();

		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: 'Choose an image to upload.' });
		}
		if (!alt) {
			// Enforced here, not just in the column default: an image without alt
			// text is an accessibility defect, and the moment to fix it is now.
			return fail(400, { error: 'Alt text is required.' });
		}

		try {
			const record = await uploadImage(
				db,
				{ buffer: Buffer.from(await file.arrayBuffer()), name: file.name },
				{ alt, credit }
			);
			return { uploaded: record.id, variants: record.variants.length };
		} catch (error) {
			if (error instanceof UploadError) return fail(400, { error: error.message });
			throw error;
		}
	},

	updateMeta: async ({ request }) => {
		const data = await request.formData();
		const id = Number(data.get('id'));
		const alt = String(data.get('alt') ?? '').trim();
		if (!Number.isInteger(id)) return fail(400, { error: 'Bad id' });
		if (!alt) return fail(400, { error: 'Alt text is required.' });

		await updateMediaMeta(db, id, { alt, credit: String(data.get('credit') ?? '') });
		return { updated: true };
	},

	delete: async ({ request }) => {
		const data = await request.formData();
		const id = Number(data.get('id'));
		if (!Number.isInteger(id)) return fail(400, { error: 'Bad id' });

		await deleteMedia(db, id);
		return { deleted: true };
	}
};
