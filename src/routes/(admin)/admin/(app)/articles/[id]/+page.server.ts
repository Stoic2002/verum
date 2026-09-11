import { QUALITY_GATE_KEYS, countEditorNotes } from '$lib/quality-gate';
import { setFlash } from '$lib/server/flash';
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
import { articleSurfaces, purgeUrls } from '$lib/server/cdn';
import { siteOrigin } from '$lib/server/site';
import { articleLocales, LOCALES, articles, type Locale } from '$lib/server/db/schema';
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
		adapter,
		// Stored values are not a submission: show errors only after a save.
		{ errors: false }
	);

	const storage = getStorage();
	const library = (await listMedia(db, { limit: 60 })).items;
	const bodies = await db
		.select({ locale: articleLocales.locale, bodyMd: articleLocales.bodyMd })
		.from(articleLocales)
		.where(eq(articleLocales.articleId, id));

	return {
		article,
		editorNotes: bodies
			.map((row) => ({ locale: row.locale, count: countEditorNotes(row.bodyMd) }))
			.filter((row) => row.count > 0),
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
	settings: async ({ request, params, url }) => {
		const id = Number(params.id);
		const form = await superValidate(request, adapter);
		if (!form.valid) return message(form, 'Fix the errors below.', { status: 400 });

		const { categoryId, coverMediaId, status, isLiving, publishAt, tagIds } = form.data;

		if (status === 'published' || status === 'scheduled') {
			// Placeholders for the editor's own judgment must never reach readers,
			// whether or not the article is already live.
			const bodies = await db
				.select({ locale: articleLocales.locale, bodyMd: articleLocales.bodyMd })
				.from(articleLocales)
				.where(eq(articleLocales.articleId, id));
			const unresolved = bodies.filter((row) => countEditorNotes(row.bodyMd) > 0);
			if (unresolved.length) {
				return message(
					form,
					`Resolve the [[EDITOR: …]] notes in the ${unresolved.map((row) => row.locale).join(' and ')} version first. They mark what only you can write.`,
					{ status: 400 }
				);
			}

			// The gate is asked at the moment of going live, not on every later save.
			const [current] = await db
				.select({ status: articles.status })
				.from(articles)
				.where(eq(articles.id, id));
			const goingLive = current && current.status !== 'published' && current.status !== 'scheduled';
			if (goingLive && !QUALITY_GATE_KEYS.every((key) => form.data.qualityGate.includes(key))) {
				return message(
					form,
					'Confirm all four quality-gate questions before publishing (PRD §5.5).',
					{ status: 400 }
				);
			}
		}

		await db
			.update(articles)
			.set({ categoryId, isLiving, coverMediaId: coverMediaId || null })
			.where(eq(articles.id, id));

		await setArticleStatus(db, id, status, parsePublishAt(publishAt));
		await setArticleTags(db, id, tagIds);

		// Publishing, archiving or moving category all change what the cached
		// listing pages should show.
		const updated = await getArticleForAdmin(db, id);
		if (updated) {
			const origin = siteOrigin(url);
			const surfaces = updated.locales.flatMap((row) =>
				articleSurfaces(origin, row.locale, updated.categorySlug, row.slug)
			);
			await purgeUrls(surfaces);
		}

		form.data.qualityGate = [];
		return message(form, 'Saved.');
	},

	addLocale: async ({ request, params, cookies }) => {
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

		setFlash(
			cookies,
			'success',
			`Added the ${locale} version. It starts empty on purpose — write it, don't translate it.`
		);

		redirect(303, `/admin/articles/${id}/${locale}`);
	},

	delete: async ({ params, cookies }) => {
		await deleteArticle(db, Number(params.id));
		setFlash(cookies, 'success', 'Article deleted.');
		redirect(303, '/admin/articles');
	}
};
