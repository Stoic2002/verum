import { and, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '../types';
import {
	articleLocales,
	articles,
	categories,
	categoryLocales,
	tags,
	type Locale
} from '../schema';

/** Admin listings show every status, unlike everything in queries/articles.ts. */
export async function listArticlesForAdmin(
	db: Database,
	{ status, search }: { status?: string; search?: string } = {}
) {
	const rows = await db.execute<{
		id: number;
		status: string;
		is_living: boolean;
		updated_at: Date;
		category_slug: string;
		locales: { locale: string; title: string; slug: string; published_at: string | null }[];
	}>(sql`
		SELECT
			a.id,
			a.status,
			a.is_living,
			a.updated_at,
			c.slug AS category_slug,
			coalesce(
				json_agg(
					json_build_object(
						'locale', al.locale,
						'title', al.title,
						'slug', al.slug,
						'published_at', al.published_at
					) ORDER BY al.locale
				) FILTER (WHERE al.locale IS NOT NULL),
				'[]'
			) AS locales
		FROM articles a
		JOIN categories c ON c.id = a.category_id
		LEFT JOIN article_locales al ON al.article_id = a.id
		WHERE TRUE
			${status ? sql`AND a.status = ${status}` : sql``}
			${
				search
					? sql`AND EXISTS (
				SELECT 1 FROM article_locales s
				WHERE s.article_id = a.id AND s.title ILIKE ${'%' + search + '%'}
			)`
					: sql``
			}
		GROUP BY a.id, c.slug
		ORDER BY a.updated_at DESC
		LIMIT 200
	`);

	return Array.from(rows);
}

export async function getArticleForAdmin(db: Database, id: number) {
	const [article] = await db
		.select({
			id: articles.id,
			categoryId: articles.categoryId,
			status: articles.status,
			isLiving: articles.isLiving,
			coverMediaId: articles.coverMediaId,
			categorySlug: categories.slug,
			updatedAt: articles.updatedAt
		})
		.from(articles)
		.innerJoin(categories, eq(categories.id, articles.categoryId))
		.where(eq(articles.id, id))
		.limit(1);

	if (!article) return null;

	const locales = await db
		.select({
			locale: articleLocales.locale,
			slug: articleLocales.slug,
			title: articleLocales.title,
			excerpt: articleLocales.excerpt,
			bodyMd: articleLocales.bodyMd,
			metaTitle: articleLocales.metaTitle,
			metaDesc: articleLocales.metaDesc,
			correction: articleLocales.correction,
			wordCount: articleLocales.wordCount,
			readingMinutes: articleLocales.readingMinutes,
			publishedAt: articleLocales.publishedAt,
			modifiedAt: articleLocales.modifiedAt
		})
		.from(articleLocales)
		.where(eq(articleLocales.articleId, id))
		.orderBy(articleLocales.locale);

	const tagRows = await db.execute<{ id: number }>(sql`
		SELECT tag_id AS id FROM article_tags WHERE article_id = ${id}
	`);

	return { ...article, locales, tagIds: Array.from(tagRows).map((r) => Number(r.id)) };
}

export async function getArticleLocale(db: Database, articleId: number, locale: Locale) {
	const [row] = await db
		.select()
		.from(articleLocales)
		.where(and(eq(articleLocales.articleId, articleId), eq(articleLocales.locale, locale)))
		.limit(1);

	return row ?? null;
}

/** Categories with both locale names, for the admin pickers and the taxonomy page. */
export async function listCategoriesForAdmin(db: Database) {
	const rows = await db.execute<{
		id: number;
		slug: string;
		is_active: boolean;
		sort_order: number;
		names: Record<string, string>;
		descriptions: Record<string, string | null>;
		article_count: number;
	}>(sql`
		SELECT
			c.id, c.slug, c.is_active, c.sort_order,
			coalesce(json_object_agg(cl.locale, cl.name) FILTER (WHERE cl.locale IS NOT NULL), '{}') AS names,
			coalesce(json_object_agg(cl.locale, cl.description) FILTER (WHERE cl.locale IS NOT NULL), '{}') AS descriptions,
			(SELECT count(*)::int FROM articles a WHERE a.category_id = c.id) AS article_count
		FROM categories c
		LEFT JOIN category_locales cl ON cl.category_id = c.id
		GROUP BY c.id
		ORDER BY c.sort_order, c.slug
	`);

	return Array.from(rows);
}

export async function listTagsForAdmin(db: Database) {
	const rows = await db.execute<{
		id: number;
		slug: string;
		name: string;
		article_count: number;
	}>(sql`
		SELECT t.id, t.slug, t.name,
			(SELECT count(*)::int FROM article_tags at WHERE at.tag_id = t.id) AS article_count
		FROM tags t
		ORDER BY t.name
	`);

	return Array.from(rows);
}

/** Minimal shape for <select> pickers. */
export async function categoryOptions(db: Database, locale: Locale) {
	return db
		.select({ id: categories.id, slug: categories.slug, name: categoryLocales.name })
		.from(categories)
		.leftJoin(
			categoryLocales,
			and(eq(categoryLocales.categoryId, categories.id), eq(categoryLocales.locale, locale))
		)
		.orderBy(categories.sortOrder, categories.slug);
}

export async function tagOptions(db: Database) {
	return db.select({ id: tags.id, slug: tags.slug, name: tags.name }).from(tags).orderBy(tags.name);
}

export async function listRedirects(db: Database) {
	return db
		.execute<{ id: number; from_path: string; to_path: string; status: number }>(
			sql`
		SELECT id, from_path, to_path, status FROM redirects ORDER BY from_path LIMIT 500
	`
		)
		.then((rows) => Array.from(rows));
}

export { desc };
