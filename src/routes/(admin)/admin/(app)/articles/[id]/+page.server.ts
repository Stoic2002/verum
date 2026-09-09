import { error, fail, redirect, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { valibot } from 'sveltekit-superforms/adapters';
import { message, superValidate } from 'sveltekit-superforms';
import { db } from '$lib/server/db';
import { categoryOptions, getArticleForAdmin, tagOptions } from '$lib/server/db/queries/admin';
import {
	deleteArticle,
	saveArticleLocale,
	setArticleStatus,
	setArticleTags,
	slugify
} from '$lib/server/content/articles';
import { createPreviewToken } from '$lib/server/content/preview-token';
import { articleSettingsSchema } from '$lib/server/content/schemas';
import { getStorage, listMedia, pictureFor } from '$lib/server/media';
import { LOCALES, articles, type Locale } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

const adapter = valibot(articleSettingsSchema);

/** <input type="datetime-local"> speaks local time with no zone; Date parses that. */
function parsePublishAt(value: string): Date | null {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function toLocalInput(date: Date | null): string {
	if (!date) return '';
	const offset = date.getTimezoneOffset() * 60_000;
	return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404, 'Not found');

	const article = await getArticleForAdmin(db, id);
	if (!article) error(404, 'Not found');

	const firstPublished = article.locales.find((l) => l.publishedAt)?.publishedAt ?? null;

	const form = await superValidate(
		{
			categoryId: article.categoryId,
			coverMediaId: article.coverMediaId ?? 0,
			status: article.status,
			isLiving: article.isLiving,
			publishAt: toLocalInput(firstPublished),
			tagIds: article.tagIds
		},
		adapter
	);

	const storage = getStorage();
	const library = await listMedia(db, 60);

	return {
		article,
		form,
		media: library.map((row) => ({
			id: row.id,
			alt: row.alt,
			thumb: pictureFor(row, (key) => storage.url(key)).src
		})),
		categories: await categoryOptions(db, 'en'),
		tags: await tagOptions(db),
		missingLocales: LOCALES.filter((l) => !article.locales.some((row) => row.locale === l)),
		previewTokens: Object.fromEntries(
			article.locales.map((l) => [l.locale, createPreviewToken(article.id, l.locale as Locale)])
		)
	};
};

export const actions: Actions = {
	settings: async ({ request, params }) => {
		const id = Number(params.id);
		const form = await superValidate(request, adapter);
		if (!form.valid) return message(form, 'Fix the errors below.', { status: 400 });

		const { categoryId, coverMediaId, status, isLiving, publishAt, tagIds } = form.data;

		await db
			.update(articles)
			.set({ categoryId, isLiving, coverMediaId: coverMediaId || null })
			.where(eq(articles.id, id));

		await setArticleStatus(db, id, status, parsePublishAt(publishAt));
		await setArticleTags(db, id, tagIds);

		return message(form, 'Saved.');
	},

	addLocale: async ({ request, params }) => {
		const id = Number(params.id);
		const data = await request.formData();
		const locale = String(data.get('locale') ?? '') as Locale;
		if (!LOCALES.includes(locale)) return fail(400, { error: 'Unknown locale' });

		const article = await getArticleForAdmin(db, id);
		if (!article) error(404, 'Not found');
		if (article.locales.some((l) => l.locale === locale))
			redirect(303, `/admin/articles/${id}/${locale}`);

		const source = article.locales[0];
		await saveArticleLocale(db, id, locale, {
			// A starting point, not a translation. PRD §7: the other locale is a
			// rewrite, and machine-translating at scale is what Google's scaled
			// content abuse policy targets by name.
			slug: slugify(`${source?.slug ?? 'article'}-${locale}`),
			title: source?.title ?? '',
			excerpt: '',
			bodyMd: ''
		});

		redirect(303, `/admin/articles/${id}/${locale}`);
	},

	delete: async ({ params }) => {
		await deleteArticle(db, Number(params.id));
		redirect(303, '/admin/articles');
	}
};
