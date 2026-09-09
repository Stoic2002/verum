import { error, type Actions } from '@sveltejs/kit';
import { valibot } from 'sveltekit-superforms/adapters';
import { message, superValidate } from 'sveltekit-superforms';
import { db } from '$lib/server/db';
import { getArticleForAdmin, getArticleLocale } from '$lib/server/db/queries/admin';
import { saveArticleLocale } from '$lib/server/content/articles';
import { createPreviewToken } from '$lib/server/content/preview-token';
import { articleLocaleSchema } from '$lib/server/content/schemas';
import { LOCALES, type Locale } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

const adapter = valibot(articleLocaleSchema);

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	const locale = params.locale as Locale;

	if (!Number.isInteger(id) || !LOCALES.includes(locale)) error(404, 'Not found');

	const article = await getArticleForAdmin(db, id);
	const row = article && (await getArticleLocale(db, id, locale));
	if (!article || !row) error(404, 'Not found');

	return {
		articleId: id,
		locale,
		categorySlug: article.categorySlug,
		status: article.status,
		stats: { wordCount: row.wordCount, readingMinutes: row.readingMinutes },
		previewToken: createPreviewToken(id, locale),
		form: await superValidate(
			{
				slug: row.slug,
				title: row.title,
				excerpt: row.excerpt,
				bodyMd: row.bodyMd,
				metaTitle: row.metaTitle ?? '',
				metaDesc: row.metaDesc ?? '',
				correction: row.correction ?? ''
			},
			adapter
		)
	};
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const id = Number(params.id);
		const locale = params.locale as Locale;

		const form = await superValidate(request, adapter);
		if (!form.valid) return message(form, 'Fix the errors below.', { status: 400 });

		try {
			const result = await saveArticleLocale(db, id, locale, form.data);

			return message(
				form,
				result.slugChangedFrom
					? `Saved. A 301 now points ${result.slugChangedFrom} at the new slug.`
					: 'Saved.'
			);
		} catch (err) {
			if (err instanceof Error && err.message.includes('article_locales_slug_idx')) {
				form.errors.slug = ['That slug is already used in this locale.'];
				return message(form, 'Slug already taken.', { status: 400 });
			}
			throw err;
		}
	}
};
