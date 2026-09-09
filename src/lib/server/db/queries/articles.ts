import { and, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '../types';
import { articleLocales, articles, categories, categoryLocales, type Locale } from '../schema';
import { isLive, paging, type Paging } from './shared';

/** Columns every article listing needs, and no more. */
const listColumns = {
	articleId: articleLocales.articleId,
	slug: articleLocales.slug,
	title: articleLocales.title,
	excerpt: articleLocales.excerpt,
	readingMinutes: articleLocales.readingMinutes,
	publishedAt: articleLocales.publishedAt,
	coverMediaId: articles.coverMediaId,
	categorySlug: categories.slug
};

export function listPublished(
	db: Database,
	{ locale, category, ...page }: Paging & { locale: Locale; category?: string }
) {
	const { limit, offset } = paging(page);

	return db
		.select(listColumns)
		.from(articleLocales)
		.innerJoin(articles, eq(articles.id, articleLocales.articleId))
		.innerJoin(categories, eq(categories.id, articles.categoryId))
		.where(
			and(
				eq(articleLocales.locale, locale),
				isLive,
				category ? eq(categories.slug, category) : undefined
			)
		)
		.orderBy(desc(articleLocales.publishedAt))
		.limit(limit)
		.offset(offset);
}

export type ArticleListItem = Awaited<ReturnType<typeof listPublished>>[number];

/** A single published article, addressed the way its URL addresses it. */
export async function getPublishedBySlug(
	db: Database,
	{ locale, slug }: { locale: Locale; slug: string }
) {
	const [row] = await db
		.select({
			id: articles.id,
			status: articles.status,
			isLiving: articles.isLiving,
			coverMediaId: articles.coverMediaId,
			categorySlug: categories.slug,
			categoryName: categoryLocales.name,
			slug: articleLocales.slug,
			title: articleLocales.title,
			excerpt: articleLocales.excerpt,
			bodyHtml: articleLocales.bodyHtml,
			toc: articleLocales.toc,
			readingMinutes: articleLocales.readingMinutes,
			metaTitle: articleLocales.metaTitle,
			metaDesc: articleLocales.metaDesc,
			publishedAt: articleLocales.publishedAt,
			modifiedAt: articleLocales.modifiedAt,
			correction: articleLocales.correction
		})
		.from(articleLocales)
		.innerJoin(articles, eq(articles.id, articleLocales.articleId))
		.innerJoin(categories, eq(categories.id, articles.categoryId))
		.leftJoin(
			categoryLocales,
			and(
				eq(categoryLocales.categoryId, categories.id),
				eq(categoryLocales.locale, articleLocales.locale)
			)
		)
		.where(and(eq(articleLocales.locale, locale), eq(articleLocales.slug, slug), isLive))
		.limit(1);

	return row ?? null;
}

/**
 * Which locales a given article actually exists in.
 *
 * Drives hreflang (PRD §12.2): only locales that are really published may be
 * announced, because the model is asymmetric — an article is allowed to exist
 * in `en` alone, and claiming otherwise is a broken hreflang cluster.
 */
export async function publishedLocalesOf(db: Database, articleId: number) {
	const rows = await db
		.select({ locale: articleLocales.locale, slug: articleLocales.slug })
		.from(articleLocales)
		.innerJoin(articles, eq(articles.id, articleLocales.articleId))
		.where(and(eq(articleLocales.articleId, articleId), isLive));

	return rows;
}

/** Tag pages with fewer than 3 articles are noindexed and kept out of the sitemap (PRD §12.7). */
export async function countPublishedForTag(db: Database, tagId: number, locale: Locale) {
	const [row] = await db.execute<{ count: number }>(sql`
		SELECT count(*)::int AS count
		FROM article_tags at
		JOIN articles a ON a.id = at.article_id
		JOIN article_locales al ON al.article_id = a.id AND al.locale = ${locale}
		WHERE at.tag_id = ${tagId}
			AND a.status = 'published'
			AND al.published_at IS NOT NULL
			AND al.published_at <= now()
	`);

	return row?.count ?? 0;
}
