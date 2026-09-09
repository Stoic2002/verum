import { fail, redirect, type Actions } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { createTopic, listTopicsForAdmin } from '$lib/server/content/topics';
import { slugify } from '$lib/server/content/articles';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ topics: await listTopicsForAdmin(db) });

export const actions: Actions = {
	create: async ({ request }) => {
		const data = await request.formData();
		const slug = slugify(String(data.get('slug') ?? ''));
		if (!slug) return fail(400, { error: 'A slug is required.' });

		try {
			const id = await createTopic(db, slug);
			redirect(303, `/admin/topics/${id}`);
		} catch (error) {
			if (error instanceof Error && error.message.includes('topics_slug_unique')) {
				return fail(400, { error: 'That slug already exists.' });
			}
			throw error;
		}
	}
};
