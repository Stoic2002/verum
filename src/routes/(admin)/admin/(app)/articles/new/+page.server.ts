import { redirect, type Actions } from '@sveltejs/kit';
import { valibot } from 'sveltekit-superforms/adapters';
import { message, superValidate } from 'sveltekit-superforms';
import { db } from '$lib/server/db';
import { categoryOptions } from '$lib/server/db/queries/admin';
import { createArticle, slugify } from '$lib/server/content/articles';
import { newArticleSchema } from '$lib/server/content/schemas';
import type { PageServerLoad } from './$types';

const adapter = valibot(newArticleSchema);

export const load: PageServerLoad = async () => ({
	form: await superValidate(adapter),
	categories: await categoryOptions(db, 'en')
});

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, adapter);
		if (!form.valid) return message(form, 'Fix the errors below.', { status: 400 });

		const { categoryId, locale, title, slug } = form.data;

		try {
			const id = await createArticle(db, {
				categoryId,
				locale,
				content: {
					slug: slug || slugify(title),
					title,
					excerpt: '',
					bodyMd: ''
				}
			});
			redirect(303, `/admin/articles/${id}/${locale}`);
		} catch (error) {
			// The only realistic failure is the unique (locale, slug) index.
			if (error instanceof Error && error.message.includes('article_locales_slug_idx')) {
				form.errors.slug = ['That slug is already used in this locale.'];
				return message(form, 'Slug already taken.', { status: 400 });
			}
			throw error;
		}
	}
};
