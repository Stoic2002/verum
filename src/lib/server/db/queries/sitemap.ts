import { sql } from 'drizzle-orm';
import type { Database } from '../types';
import type { Locale } from '../schema';

/**
 * Everything that belongs in a locale's sitemap.
 *
 * A sitemap is a claim that a URL is canonical and worth indexing, so what it
 * must never contain is as important as what it does: unpublished articles,
 * tag pages below the noindex threshold (PRD §12.7), and anything that
 * redirects elsewhere.
 */

export type SitemapEntry = {
	loc: string;
	lastmod: string | null;
	/** Locale versions of the same page, for the xhtml:link annotations. */
	alternates: { locale: string; loc: string }[];
};

export async function sitemapArticles(db: Database, locale: Locale) {
	const rows = await db.execute<{
		slug: string;
		category_slug: string;
		lastmod: Date;
		alternates: { locale: string; slug: string; category_slug: string }[];
	}>(sql`
		SELECT
			al.slug,
			c.slug AS category_slug,
			coalesce(al.modified_at, al.published_at) AS lastmod,
			coalesce(
				(
					SELECT json_agg(json_build_object(
						'locale', alt.locale, 'slug', alt.slug, 'category_slug', c.slug
					))
					FROM article_locales alt
					WHERE alt.article_id = a.id
						AND alt.published_at IS NOT NULL AND alt.published_at <= now()
				),
				'[]'
			) AS alternates
		FROM article_locales al
		JOIN articles a ON a.id = al.article_id
		JOIN categories c ON c.id = a.category_id
		WHERE al.locale = ${locale}
			AND a.status = 'published'
			AND al.published_at IS NOT NULL AND al.published_at <= now()
		ORDER BY lastmod DESC
	`);

	return Array.from(rows);
}

export async function sitemapCategories(db: Database, locale: Locale) {
	const rows = await db.execute<{ slug: string; lastmod: Date | null }>(sql`
		SELECT c.slug, max(al.published_at) AS lastmod
		FROM categories c
		JOIN articles a ON a.category_id = c.id
		JOIN article_locales al ON al.article_id = a.id AND al.locale = ${locale}
		WHERE c.is_active
			AND a.status = 'published'
			AND al.published_at IS NOT NULL AND al.published_at <= now()
		GROUP BY c.slug
		HAVING count(*) > 0
		ORDER BY c.slug
	`);

	return Array.from(rows);
}

/** Tags below the threshold are excluded here as well as noindexed (PRD §12.7). */
export async function sitemapTags(db: Database, locale: Locale, minArticles = 3) {
	const rows = await db.execute<{ slug: string; lastmod: Date | null }>(sql`
		SELECT t.slug, max(al.published_at) AS lastmod
		FROM tags t
		JOIN article_tags at ON at.tag_id = t.id
		JOIN articles a ON a.id = at.article_id
		JOIN article_locales al ON al.article_id = a.id AND al.locale = ${locale}
		WHERE a.status = 'published'
			AND al.published_at IS NOT NULL AND al.published_at <= now()
		GROUP BY t.slug
		HAVING count(*) >= ${minArticles}
		ORDER BY t.slug
	`);

	return Array.from(rows);
}

export async function sitemapTopics(db: Database, locale: Locale) {
	const rows = await db.execute<{ slug: string; lastmod: Date | null }>(sql`
		SELECT t.slug, max(al.published_at) AS lastmod
		FROM topics t
		JOIN topic_locales tl ON tl.topic_id = t.id AND tl.locale = ${locale}
		LEFT JOIN topic_articles ta ON ta.topic_id = t.id
		LEFT JOIN articles a ON a.id = ta.article_id AND a.status = 'published'
		LEFT JOIN article_locales al ON al.article_id = a.id AND al.locale = ${locale}
		GROUP BY t.slug
		ORDER BY t.slug
	`);

	return Array.from(rows);
}

/** The newest change in a locale, for the sitemap index's lastmod. */
export async function sitemapLastModified(db: Database, locale: Locale) {
	const [row] = await db.execute<{ lastmod: Date | null }>(sql`
		SELECT max(coalesce(al.modified_at, al.published_at)) AS lastmod
		FROM article_locales al
		JOIN articles a ON a.id = al.article_id
		WHERE al.locale = ${locale}
			AND a.status = 'published'
			AND al.published_at IS NOT NULL AND al.published_at <= now()
	`);

	return row?.lastmod ?? null;
}
