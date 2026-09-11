import { eq } from 'drizzle-orm';
import { countEditorNotes } from '$lib/quality-gate';
import { jobForArticle } from '$lib/server/ai/store';
import { error, type Actions } from '@sveltejs/kit';
import { valibot } from 'sveltekit-superforms/adapters';
import { message, superValidate } from 'sveltekit-superforms';
import { db } from '$lib/server/db';
import { getArticleForAdmin, getArticleLocale } from '$lib/server/db/queries/admin';
import { saveArticleLocale } from '$lib/server/content/articles';
import { createPreviewToken } from '$lib/server/content/preview-token';
import { articleSurfaces, purgeUrls } from '$lib/server/cdn';
import { siteOrigin } from '$lib/server/site';
import { articleLocaleSchema } from '$lib/server/content/schemas';
import { getStorage, listMedia, pictureFor } from '$lib/server/media';
import { LOCALES, articles, type Locale } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';
import { isUniqueViolation } from '$lib/server/db/errors';

const adapter = valibot(articleLocaleSchema);

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	const locale = params.locale as Locale;

	if (!Number.isInteger(id) || !LOCALES.includes(locale)) error(404, 'Not found');

	const article = await getArticleForAdmin(db, id);
	const row = article && (await getArticleLocale(db, id, locale));
	if (!article || !row) error(404, 'Not found');

	const storage = getStorage();
	const library = (await listMedia(db, { limit: 60 })).items;

	return {
		media: library.map((row) => ({
			id: row.id,
			alt: row.alt,
			thumb: pictureFor(row, (key) => storage.url(key)).src
		})),
		articleId: id,
		locale,
		categorySlug: article.categorySlug,
		status: article.status,
		stats: { wordCount: row.wordCount, readingMinutes: row.readingMinutes },
		previewToken: createPreviewToken(id, locale),
		// Set when the AI writer drafted this article: the editor links back to its research.
		aiJob: await jobForArticle(db, id).then(
			(job) =>
				job && {
					id: job.id,
					claims: job.claims.length,
					used: job.claims.filter((c) => c.included).length
				}
		),
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
			adapter,
			// A freshly added locale is empty on purpose; it must not open covered in "Required".
			{ errors: false }
		)
	};
};

export const actions: Actions = {
	default: async ({ request, params, url }) => {
		const id = Number(params.id);
		const locale = params.locale as Locale;

		const form = await superValidate(request, adapter);
		if (!form.valid) return message(form, 'Fix the errors below.', { status: 400 });

		const [current] = await db
			.select({ status: articles.status })
			.from(articles)
			.where(eq(articles.id, id));
		const live = current?.status === 'published' || current?.status === 'scheduled';
		if (live && countEditorNotes(form.data.bodyMd) > 0) {
			return message(
				form,
				'This article is live: remove the [[EDITOR: …]] notes before saving, or unpublish it first.',
				{ status: 400 }
			);
		}

		try {
			const result = await saveArticleLocale(db, id, locale, form.data);

			// The edit is live at the origin now; the edge still has the old copy
			// for up to a day (PRD §10.3). Purge the article and everything that
			// embeds its title.
			const article = await getArticleForAdmin(db, id);
			if (article) {
				const origin = siteOrigin(url);
				const surfaces = articleSurfaces(origin, locale, article.categorySlug, form.data.slug);
				// A renamed slug leaves the old URL cached as a live page.
				if (result.slugChangedFrom) {
					surfaces.push(`${origin}/${locale}/${article.categorySlug}/${result.slugChangedFrom}`);
				}
				await purgeUrls(surfaces);
			}

			return message(
				form,
				result.slugChangedFrom
					? `Saved. A 301 now points ${result.slugChangedFrom} at the new slug.`
					: 'Saved.'
			);
		} catch (err) {
			if (isUniqueViolation(err, 'article_locales_slug_idx')) {
				form.errors.slug = ['That slug is already used in this locale.'];
				return message(form, 'Slug already taken.', { status: 400 });
			}
			throw err;
		}
	}
};
