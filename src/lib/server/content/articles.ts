import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../db/types';
import {
	articleLocales,
	articleTags,
	articles,
	categories,
	type ArticleStatus,
	type Locale
} from '../db/schema';
import { getMediaByIds, getStorage } from '../media';
import { referencedMediaIds, renderMarkdown } from './render';

/**
 * Writing an article is the only place markdown is rendered.
 *
 * Rendering on save rather than on read means a published page is a string
 * lookup, and a change to the pipeline is a re-render rather than a silent
 * change in what every historical article looks like.
 */

export type ArticleLocaleInput = {
	slug: string;
	title: string;
	excerpt: string;
	bodyMd: string;
	metaTitle?: string | null;
	metaDesc?: string | null;
	correction?: string | null;
};

/** `/en/ai/some-slug` — the shape every public URL takes (PRD §12.1). */
export function articlePath(locale: Locale, categorySlug: string, slug: string): string {
	return `/${locale}/${categorySlug}/${slug}`;
}

export function slugify(input: string): string {
	return (
		input
			.normalize('NFKD')
			// Strip the combining marks NFKD just separated, so "é" becomes "e".
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			.replace(/['\u2019]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 80)
			.replace(/-+$/g, '')
	);
}

export async function createArticle(
	db: Database,
	input: { categoryId: number; locale: Locale; content: ArticleLocaleInput }
) {
	return db.transaction(async (tx) => {
		const [article] = await tx
			.insert(articles)
			.values({ categoryId: input.categoryId })
			.returning({ id: articles.id });

		await writeLocale(tx as Database, article.id, input.locale, input.content);
		return article.id;
	});
}

/**
 * Creates or updates one language version, rendering its markdown.
 *
 * Renaming a slug records a 301 from the old path in the same transaction
 * (PRD §12.1): a slug may change, but losing the old URL may not, and leaving
 * that to be remembered by hand is how link equity gets thrown away.
 */
export async function saveArticleLocale(
	db: Database,
	articleId: number,
	locale: Locale,
	content: ArticleLocaleInput
) {
	return db.transaction(async (tx) => writeLocale(tx as Database, articleId, locale, content));
}

async function writeLocale(
	tx: Database,
	articleId: number,
	locale: Locale,
	content: ArticleLocaleInput
) {
	// Images are looked up before rendering, so the pipeline itself does no I/O
	// and stays a pure function of (markdown, media).
	const rendered = await renderMarkdown(content.bodyMd, {
		media: await getMediaByIds(tx, referencedMediaIds(content.bodyMd)),
		mediaUrl: (key) => getStorage().url(key),
		locale
	});

	const [existing] = await tx
		.select({ slug: articleLocales.slug, publishedAt: articleLocales.publishedAt })
		.from(articleLocales)
		.where(and(eq(articleLocales.articleId, articleId), eq(articleLocales.locale, locale)))
		.limit(1);

	const values = {
		articleId,
		locale,
		slug: content.slug,
		title: content.title,
		excerpt: content.excerpt,
		bodyMd: content.bodyMd,
		bodyHtml: rendered.html,
		bodyText: rendered.text,
		toc: rendered.toc,
		wordCount: rendered.wordCount,
		readingMinutes: rendered.readingMinutes,
		metaTitle: content.metaTitle || null,
		metaDesc: content.metaDesc || null,
		correction: content.correction || null,
		modifiedAt: new Date()
	};

	await tx
		.insert(articleLocales)
		.values(values)
		.onConflictDoUpdate({
			target: [articleLocales.articleId, articleLocales.locale],
			set: values
		});

	if (existing && existing.slug !== content.slug) {
		await recordSlugRedirect(tx, articleId, locale, existing.slug, content.slug);
	}

	await tx.update(articles).set({ updatedAt: new Date() }).where(eq(articles.id, articleId));

	return {
		rendered,
		slugChangedFrom: existing?.slug !== content.slug ? existing?.slug : undefined
	};
}

async function recordSlugRedirect(
	tx: Database,
	articleId: number,
	locale: Locale,
	fromSlug: string,
	toSlug: string
) {
	const [row] = await tx
		.select({ categorySlug: categories.slug })
		.from(articles)
		.innerJoin(categories, eq(categories.id, articles.categoryId))
		.where(eq(articles.id, articleId))
		.limit(1);

	if (!row) return;

	const from = articlePath(locale, row.categorySlug, fromSlug);
	const to = articlePath(locale, row.categorySlug, toSlug);
	if (from === to) return;

	// Order matters, and postgres.js will not take these as one parameterised
	// statement anyway.

	// 1. Anything already pointing at the old path is repointed at the new one.
	//    A chain A→B→C is a wasted hop and dilutes what the 301 passes on.
	await tx.execute(sql`UPDATE redirects SET to_path = ${to} WHERE to_path = ${from}`);

	// 2. The rename itself.
	await tx.execute(sql`
		INSERT INTO redirects (from_path, to_path, status)
		VALUES (${from}, ${to}, 301)
		ON CONFLICT (from_path) DO UPDATE SET to_path = EXCLUDED.to_path
	`);

	// 3. The live path must never be a redirect source — which happens when a
	//    slug is reverted to one it used before.
	await tx.execute(sql`DELETE FROM redirects WHERE from_path = ${to} OR from_path = to_path`);
}

/**
 * Which of these images has no credit recorded. Ids with no row — an image
 * deleted from the library — are left to the missing-image notice instead.
 */
export async function mediaWithoutCredit(
	db: Database,
	ids: (number | null | undefined)[]
): Promise<number[]> {
	const unique = [...new Set(ids.filter((id): id is number => Number.isInteger(id) && id! > 0))];
	if (unique.length === 0) return [];

	const found = await getMediaByIds(db, unique);
	return [...found.values()]
		.filter((record) => !record.credit?.trim())
		.map((record) => record.id)
		.sort((a, b) => a - b);
}

/**
 * Images a live article would show without a credit: its cover, and every
 * `::image` in any language version (PRD §14).
 *
 * `override` stands in for the version being saved, so the check sees the
 * body about to be written rather than the one already stored.
 */
export async function uncreditedMedia(
	db: Database,
	articleId: number,
	override?: { locale: Locale; bodyMd: string }
): Promise<number[]> {
	const [article] = await db
		.select({ cover: articles.coverMediaId })
		.from(articles)
		.where(eq(articles.id, articleId))
		.limit(1);
	if (!article) return [];

	const rows = await db
		.select({ locale: articleLocales.locale, bodyMd: articleLocales.bodyMd })
		.from(articleLocales)
		.where(eq(articleLocales.articleId, articleId));

	const bodies = rows.filter((row) => row.locale !== override?.locale).map((row) => row.bodyMd);
	if (override) bodies.push(override.bodyMd);

	return mediaWithoutCredit(db, [article.cover, ...bodies.flatMap(referencedMediaIds)]);
}

/**
 * Re-renders every language version that shows this image inline.
 *
 * body_html is written on save, so a credit corrected in the media library
 * would otherwise stay wrong on every article already using the image. The
 * modified date is left alone: fixing a credit is not an edit to the article.
 *
 * Returns the pages to purge, including articles that use it only as a cover —
 * those read the credit live, but the edge still holds the old page.
 */
export async function rerenderArticlesUsingMedia(db: Database, mediaId: number) {
	const rows = await db.execute<{
		article_id: number;
		locale: Locale;
		body_md: string;
		slug: string;
		category_slug: string;
		cover_media_id: number | null;
	}>(sql`
		SELECT al.article_id, al.locale, al.body_md, al.slug, c.slug AS category_slug, a.cover_media_id
		FROM article_locales al
		JOIN articles a ON a.id = al.article_id
		JOIN categories c ON c.id = a.category_id
		WHERE a.cover_media_id = ${mediaId} OR al.body_md LIKE '%::image{%'
	`);

	const touched: { locale: Locale; categorySlug: string; slug: string }[] = [];
	for (const row of rows) {
		const ids = referencedMediaIds(row.body_md);
		const inline = ids.includes(mediaId);

		if (inline) {
			const rendered = await renderMarkdown(row.body_md, {
				media: await getMediaByIds(db, ids),
				mediaUrl: (key) => getStorage().url(key),
				locale: row.locale
			});
			await db
				.update(articleLocales)
				.set({ bodyHtml: rendered.html })
				.where(
					and(
						eq(articleLocales.articleId, Number(row.article_id)),
						eq(articleLocales.locale, row.locale)
					)
				);
		}

		if (inline || Number(row.cover_media_id) === mediaId) {
			touched.push({ locale: row.locale, categorySlug: row.category_slug, slug: row.slug });
		}
	}

	return touched;
}

/**
 * Status changes, kept in one place because publishing has side effects.
 *
 * `published_at` is stamped only the first time, so re-publishing an archived
 * article does not reset its age and lose its ranking history.
 */
export async function setArticleStatus(
	db: Database,
	articleId: number,
	status: ArticleStatus,
	publishAt?: Date | null
) {
	return db.transaction(async (tx) => {
		await tx
			.update(articles)
			.set({ status, updatedAt: new Date() })
			.where(eq(articles.id, articleId));

		if (status === 'published' || status === 'scheduled') {
			const when = publishAt ?? new Date();
			await tx
				.update(articleLocales)
				.set({ publishedAt: when })
				.where(
					and(
						eq(articleLocales.articleId, articleId),
						status === 'scheduled' ? sql`true` : sql`${articleLocales.publishedAt} IS NULL`
					)
				);
		}
	});
}

export async function setArticleTags(db: Database, articleId: number, tagIds: number[]) {
	await db.transaction(async (tx) => {
		await tx.delete(articleTags).where(eq(articleTags.articleId, articleId));
		if (tagIds.length) {
			await tx
				.insert(articleTags)
				.values(tagIds.map((tagId) => ({ articleId, tagId })))
				.onConflictDoNothing();
		}
	});
}

export async function deleteArticle(db: Database, articleId: number) {
	await db.delete(articles).where(eq(articles.id, articleId));
}
