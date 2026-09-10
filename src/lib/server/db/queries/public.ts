import { sql } from 'drizzle-orm';
import type { Database } from '../types';
import type { Locale } from '../schema';

/**
 * Read queries for the public site.
 *
 * Written as SQL rather than assembled through the query builder: these all
 * need the same join across articles / article_locales / categories plus a
 * lateral for the cover image, and the shape is easier to keep honest in one
 * place than spread across builder chains.
 *
 * Every one of them filters on `live`, which is the single definition of what
 * a reader may see.
 */

const live = sql`
	a.status = 'published'
	AND al.published_at IS NOT NULL
	AND al.published_at <= now()
`;

/** Columns a card needs, including the cover image's variants for srcset. */
const cardColumns = sql`
	al.article_id,
	al.slug,
	al.title,
	al.excerpt,
	al.reading_minutes,
	al.published_at,
	a.is_living,
	c.slug AS category_slug,
	cl.name AS category_name,
	m.id AS media_id,
	m.alt AS media_alt,
	m.width AS media_width,
	m.height AS media_height,
	m.r2_key AS media_key,
	m.variants AS media_variants
`;

const cardJoins = sql`
	FROM article_locales al
	JOIN articles a ON a.id = al.article_id
	JOIN categories c ON c.id = a.category_id
	LEFT JOIN category_locales cl ON cl.category_id = c.id AND cl.locale = al.locale
	LEFT JOIN media m ON m.id = a.cover_media_id
`;

export type ArticleCard = {
	article_id: number;
	slug: string;
	title: string;
	excerpt: string;
	reading_minutes: number;
	published_at: Date;
	is_living: boolean;
	category_slug: string;
	category_name: string | null;
	media_id: number | null;
	media_alt: string | null;
	media_width: number | null;
	media_height: number | null;
	media_key: string | null;
	media_variants:
		{ format: string; width: number; height: number; key: string; bytes: number }[] | null;
};

export async function recentArticles(
	db: Database,
	locale: Locale,
	{ limit = 12, offset = 0, excludeIds = [] as number[] } = {}
) {
	const rows = await db.execute<ArticleCard>(sql`
		SELECT ${cardColumns} ${cardJoins}
		WHERE al.locale = ${locale} AND ${live}
			${excludeIds.length ? sql`AND al.article_id <> ALL(${excludeIds})` : sql``}
		ORDER BY al.published_at DESC
		LIMIT ${limit} OFFSET ${offset}
	`);
	return Array.from(rows);
}

export async function articlesByCategory(
	db: Database,
	locale: Locale,
	categorySlug: string,
	{ limit = 12, offset = 0 } = {}
) {
	const rows = await db.execute<ArticleCard>(sql`
		SELECT ${cardColumns} ${cardJoins}
		WHERE al.locale = ${locale} AND c.slug = ${categorySlug} AND ${live}
		ORDER BY al.published_at DESC
		LIMIT ${limit} OFFSET ${offset}
	`);
	return Array.from(rows);
}

export async function countByCategory(db: Database, locale: Locale, categorySlug: string) {
	const [row] = await db.execute<{ count: number }>(sql`
		SELECT count(*)::int AS count
		FROM article_locales al
		JOIN articles a ON a.id = al.article_id
		JOIN categories c ON c.id = a.category_id
		WHERE al.locale = ${locale} AND c.slug = ${categorySlug} AND ${live}
	`);
	return Number(row?.count ?? 0);
}

/** Active categories with their localised name and description (PRD §5.3, §8.1). */
export async function activeCategories(db: Database, locale: Locale) {
	const rows = await db.execute<{
		slug: string;
		name: string | null;
		description: string | null;
		article_count: number;
	}>(sql`
		SELECT
			c.slug,
			cl.name,
			cl.description,
			(
				SELECT count(*)::int
				FROM article_locales al2
				JOIN articles a2 ON a2.id = al2.article_id
				WHERE a2.category_id = c.id AND al2.locale = ${locale}
					AND a2.status = 'published'
					AND al2.published_at IS NOT NULL AND al2.published_at <= now()
			) AS article_count
		FROM categories c
		LEFT JOIN category_locales cl ON cl.category_id = c.id AND cl.locale = ${locale}
		WHERE c.is_active
		ORDER BY c.sort_order, c.slug
	`);
	return Array.from(rows);
}

export type FullArticle = ArticleCard & {
	body_html: string;
	toc: { id: string; text: string; level: number }[];
	word_count: number;
	meta_title: string | null;
	meta_desc: string | null;
	modified_at: Date | null;
	correction: string | null;
	category_description: string | null;
	tags: { slug: string; name: string }[];
};

export async function articleBySlug(
	db: Database,
	locale: Locale,
	categorySlug: string,
	slug: string
) {
	const [row] = await db.execute<FullArticle>(sql`
		SELECT ${cardColumns},
			al.body_html, al.toc, al.word_count, al.meta_title, al.meta_desc,
			al.modified_at, al.correction,
			cl.description AS category_description,
			coalesce(
				(
					SELECT json_agg(json_build_object('slug', t.slug, 'name', t.name) ORDER BY t.name)
					FROM article_tags at JOIN tags t ON t.id = at.tag_id
					WHERE at.article_id = a.id
				),
				'[]'
			) AS tags
		${cardJoins}
		WHERE al.locale = ${locale} AND c.slug = ${categorySlug} AND al.slug = ${slug} AND ${live}
		LIMIT 1
	`);
	return row ?? null;
}

/**
 * Which locales this article is actually published in.
 *
 * Drives hreflang and the language banner. Only locales that really exist may
 * be announced — the model is asymmetric, and an article is allowed to live in
 * `en` alone (PRD §7).
 */
export async function publishedAlternates(db: Database, articleId: number) {
	const rows = await db.execute<{ locale: string; slug: string; category_slug: string }>(sql`
		SELECT al.locale, al.slug, c.slug AS category_slug
		FROM article_locales al
		JOIN articles a ON a.id = al.article_id
		JOIN categories c ON c.id = a.category_id
		WHERE al.article_id = ${articleId} AND ${live}
	`);
	return Array.from(rows);
}

/**
 * Related articles: same tags first, then same category, then recent.
 *
 * Ranked by how many tags are shared, so the top result is the closest one
 * rather than merely the newest thing in the category.
 */
export async function relatedArticles(
	db: Database,
	locale: Locale,
	articleId: number,
	categorySlug: string,
	limit = 3
) {
	const rows = await db.execute<ArticleCard & { shared_tags: number }>(sql`
		SELECT ${cardColumns},
			(
				SELECT count(*)::int FROM article_tags x
				WHERE x.article_id = a.id
					AND x.tag_id IN (SELECT tag_id FROM article_tags WHERE article_id = ${articleId})
			) AS shared_tags
		${cardJoins}
		WHERE al.locale = ${locale} AND al.article_id <> ${articleId} AND ${live}
		ORDER BY
			shared_tags DESC,
			(c.slug = ${categorySlug}) DESC,
			al.published_at DESC
		LIMIT ${limit}
	`);
	return Array.from(rows);
}

export async function articlesByTag(
	db: Database,
	locale: Locale,
	tagSlug: string,
	{ limit = 24, offset = 0 } = {}
) {
	const rows = await db.execute<ArticleCard>(sql`
		SELECT ${cardColumns} ${cardJoins}
		JOIN article_tags at ON at.article_id = a.id
		JOIN tags t ON t.id = at.tag_id
		WHERE al.locale = ${locale} AND t.slug = ${tagSlug} AND ${live}
		ORDER BY al.published_at DESC
		LIMIT ${limit} OFFSET ${offset}
	`);
	return Array.from(rows);
}

export async function countByTag(db: Database, locale: Locale, tagSlug: string) {
	const [row] = await db.execute<{ count: number }>(sql`
		SELECT count(*)::int AS count
		FROM article_locales al
		JOIN articles a ON a.id = al.article_id
		JOIN article_tags at ON at.article_id = a.id
		JOIN tags t ON t.id = at.tag_id
		WHERE al.locale = ${locale} AND t.slug = ${tagSlug} AND ${live}
	`);
	return Number(row?.count ?? 0);
}

export async function tagBySlug(db: Database, slug: string) {
	const [row] = await db.execute<{ id: number; slug: string; name: string }>(sql`
		SELECT id, slug, name FROM tags WHERE slug = ${slug} LIMIT 1
	`);
	return row ?? null;
}

export type TopicPage = {
	slug: string;
	title: string;
	intro_html: string;
};

export async function topicBySlug(db: Database, locale: Locale, slug: string) {
	const [row] = await db.execute<TopicPage>(sql`
		SELECT t.slug, tl.title, tl.intro_html
		FROM topics t
		JOIN topic_locales tl ON tl.topic_id = t.id AND tl.locale = ${locale}
		WHERE t.slug = ${slug}
		LIMIT 1
	`);
	return row ?? null;
}

export async function articlesInTopic(db: Database, locale: Locale, topicSlug: string) {
	const rows = await db.execute<ArticleCard>(sql`
		SELECT ${cardColumns} ${cardJoins}
		JOIN topic_articles ta ON ta.article_id = a.id
		JOIN topics t ON t.id = ta.topic_id
		WHERE al.locale = ${locale} AND t.slug = ${topicSlug} AND ${live}
		ORDER BY ta.sort_order, al.published_at DESC
	`);
	return Array.from(rows);
}
