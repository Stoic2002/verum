import { sql } from 'drizzle-orm';
import type { Database } from '../types';
import { TS_CONFIG, type Locale } from '../schema';
import { paging, type Paging } from './shared';

export type SearchHit = {
	article_id: number;
	slug: string;
	title: string;
	excerpt: string;
	category_slug: string;
	published_at: Date;
	rank: number;
	headline: string;
};

export type SearchOptions = Paging & {
	locale: Locale;
	/** Restrict to one category slug (PRD §8.1). */
	category?: string;
};

/**
 * Postgres full-text search, ranked.
 *
 * `websearch_to_tsquery` is the parser to use for a public search box: it
 * accepts quoted phrases, OR and -exclusion the way people already type them,
 * and — unlike `to_tsquery` — never raises a syntax error on odd input.
 *
 * `ts_rank_cd` over `ts_rank` because it accounts for how close the matched
 * terms are to each other, which matters once the body is in the vector.
 * Normalisation 32 divides by (rank + 1) so long articles do not dominate.
 *
 * The text search config is bound as a parameter and cast to regconfig, never
 * interpolated.
 */
export async function searchArticles(
	db: Database,
	query: string,
	{ locale, category, ...page }: SearchOptions
): Promise<SearchHit[]> {
	const trimmed = query.trim();
	if (!trimmed) return [];

	const { limit, offset } = paging(page);
	const cfg = TS_CONFIG[locale];

	const result = await db.execute<SearchHit>(sql`
		WITH q AS (SELECT websearch_to_tsquery(${cfg}::regconfig, ${trimmed}) AS tsq)
		SELECT
			al.article_id,
			al.slug,
			al.title,
			al.excerpt,
			c.slug AS category_slug,
			al.published_at,
			ts_rank_cd(al.search_vector, q.tsq, 32) AS rank,
			ts_headline(
				${cfg}::regconfig,
				coalesce(nullif(al.body_text, ''), al.excerpt),
				q.tsq,
				'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, FragmentDelimiter=" … "'
			) AS headline
		FROM article_locales al
		CROSS JOIN q
		JOIN articles a ON a.id = al.article_id
		JOIN categories c ON c.id = a.category_id
		WHERE al.locale = ${locale}
			AND a.status = 'published'
			AND al.published_at IS NOT NULL
			AND al.published_at <= now()
			AND al.search_vector @@ q.tsq
			${category ? sql`AND c.slug = ${category}` : sql``}
		ORDER BY rank DESC, al.published_at DESC, al.article_id DESC
		LIMIT ${limit} OFFSET ${offset}
	`);

	return Array.from(result);
}

/**
 * How many articles the query matches, for pagination.
 *
 * A second query rather than a window function: `count(*) OVER ()` would have
 * to rank and headline every match before counting them, and ts_headline is by
 * far the most expensive part of the search.
 */
export async function countSearchResults(
	db: Database,
	query: string,
	{ locale, category }: { locale: Locale; category?: string }
): Promise<number> {
	const trimmed = query.trim();
	if (!trimmed) return 0;

	const cfg = TS_CONFIG[locale];

	const [row] = await db.execute<{ count: number }>(sql`
		SELECT count(*)::int AS count
		FROM article_locales al
		JOIN articles a ON a.id = al.article_id
		JOIN categories c ON c.id = a.category_id
		WHERE al.locale = ${locale}
			AND a.status = 'published'
			AND al.published_at IS NOT NULL
			AND al.published_at <= now()
			AND al.search_vector @@ websearch_to_tsquery(${cfg}::regconfig, ${trimmed})
			${category ? sql`AND c.slug = ${category}` : sql``}
	`);

	return Number(row?.count ?? 0);
}
