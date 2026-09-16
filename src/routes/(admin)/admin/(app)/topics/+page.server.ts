import { setFlash } from '$lib/server/flash';
import { fail, redirect, type Actions } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { createTopic, deleteTopic, listTopicsForAdmin } from '$lib/server/content/topics';
import { purgeEverything } from '$lib/server/cdn';
import { slugify } from '$lib/server/content/articles';
import type { PageServerLoad } from './$types';
import { isUniqueViolation } from '$lib/server/db/errors';

export const load: PageServerLoad = async () => ({ topics: await listTopicsForAdmin(db) });

export const actions: Actions = {
	delete: async ({ request }) => {
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id)) return fail(400, { error: 'Bad id' });

		await deleteTopic(db, id);
		// The topic menu and footer on every cached page list topics.
		await purgeEverything();
		return { toast: 'Topic deleted. Its articles are unchanged.' };
	},

	create: async ({ request, cookies }) => {
		const data = await request.formData();
		const slug = slugify(String(data.get('slug') ?? ''));
		if (!slug) return fail(400, { error: 'A slug is required.' });

		try {
			const id = await createTopic(db, slug);
			setFlash(
				cookies,
				'success',
				'Topic created. Write its introduction — that is what makes it rank.'
			);
			redirect(303, `/admin/topics/${id}`);
		} catch (error) {
			if (isUniqueViolation(error, 'topics_slug_unique')) {
				return fail(400, { error: 'That slug already exists.' });
			}
			throw error;
		}
	}
};
