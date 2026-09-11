import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import type { Sql } from 'postgres';
import { setupTestDatabase, truncateAll } from '../db/testing';
import type { Database } from '../db/types';
import { articleLocales, articles, categories, redirects } from '../db/schema';
import { getPublishedBySlug } from '../db/queries/articles';
import { isUniqueViolation } from '../db/errors';
import { createArticle, saveArticleLocale, setArticleStatus, slugify } from './articles';

let db: Database;
let client: Sql;
let categoryId: number;

const content = (over: Partial<Parameters<typeof saveArticleLocale>[3]> = {}) => ({
	slug: 'first-article',
	title: 'First article',
	excerpt: 'An excerpt.',
	bodyMd: '## Section one\n\nSome prose here.',
	...over
});

beforeAll(async () => {
	({ db, client } = await setupTestDatabase());
});

beforeEach(async () => {
	await truncateAll(db);
	const [category] = await db
		.insert(categories)
		.values({ slug: 'ai' })
		.returning({ id: categories.id });
	categoryId = category.id;
});

afterAll(async () => {
	await client?.end();
});

describe('slugify', () => {
	it('folds accents and punctuation into a URL-safe slug', () => {
		expect(slugify('Café & Naïve — Guide!')).toBe('cafe-naive-guide');
		expect(slugify('Node.js vs Deno')).toBe('node-js-vs-deno');
		expect(slugify("Don't Panic")).toBe('dont-panic');
		expect(slugify('   ')).toBe('');
	});
});

describe('saving an article', () => {
	it('renders markdown once, on save', async () => {
		const id = await createArticle(db, { categoryId, locale: 'en', content: content() });

		const [row] = await db.select().from(articleLocales).where(eq(articleLocales.articleId, id));

		expect(row.bodyHtml).toContain('<h2');
		expect(row.bodyText).toContain('Some prose here.');
		expect(row.toc).toEqual([{ id: 'section-one', text: 'Section one', level: 2 }]);
		expect(row.wordCount).toBeGreaterThan(0);
		expect(row.readingMinutes).toBe(1);
	});

	it('feeds the search vector from the rendered prose', async () => {
		const id = await createArticle(db, {
			categoryId,
			locale: 'en',
			content: content({ bodyMd: 'Prose about refactoring.\n\n```ts\nconst secretToken = 1;\n```' })
		});
		await setArticleStatus(db, id, 'published');

		// The trigger indexed body_text, so the code identifier is not searchable.
		const [found] = await db.execute<{ n: number }>(sql`
			SELECT count(*)::int AS n FROM article_locales
			WHERE search_vector @@ websearch_to_tsquery('english', 'secretToken')
		`);
		expect(Number(found.n)).toBe(0);
	});

	it('stores both locales independently', async () => {
		const id = await createArticle(db, { categoryId, locale: 'en', content: content() });
		await saveArticleLocale(db, id, 'id', {
			slug: 'artikel-pertama',
			title: 'Artikel pertama',
			excerpt: 'Ringkasan.',
			bodyMd: 'Isi tulisan.'
		});

		const rows = await db.select().from(articleLocales).where(eq(articleLocales.articleId, id));
		expect(rows).toHaveLength(2);
		expect(rows.map((r) => r.locale).sort()).toEqual(['en', 'id']);
	});
});

describe('slug changes', () => {
	it('records a 301 from the old path', async () => {
		const id = await createArticle(db, { categoryId, locale: 'en', content: content() });
		await saveArticleLocale(db, id, 'en', content({ slug: 'renamed-article' }));

		const [redirect] = await db.select().from(redirects);

		expect(redirect.fromPath).toBe('/en/ai/first-article');
		expect(redirect.toPath).toBe('/en/ai/renamed-article');
		expect(redirect.status).toBe(301);
	});

	it('repoints existing redirects instead of building a chain', async () => {
		const id = await createArticle(db, { categoryId, locale: 'en', content: content() });
		await saveArticleLocale(db, id, 'en', content({ slug: 'second-slug' }));
		await saveArticleLocale(db, id, 'en', content({ slug: 'third-slug' }));

		const rows = await db.select().from(redirects);

		// Both old paths point straight at the current one — A→C and B→C, not A→B→C.
		expect(rows).toHaveLength(2);
		expect(rows.every((r) => r.toPath === '/en/ai/third-slug')).toBe(true);
	});

	it('does not leave a slug redirecting to itself when reverted', async () => {
		const id = await createArticle(db, { categoryId, locale: 'en', content: content() });
		await saveArticleLocale(db, id, 'en', content({ slug: 'temporary' }));
		await saveArticleLocale(db, id, 'en', content({ slug: 'first-article' }));

		const rows = await db.select().from(redirects);

		expect(rows.some((r) => r.fromPath === r.toPath)).toBe(false);
		expect(rows.some((r) => r.fromPath === '/en/ai/first-article')).toBe(false);
	});

	it('leaves redirects alone when the slug is unchanged', async () => {
		const id = await createArticle(db, { categoryId, locale: 'en', content: content() });
		await saveArticleLocale(db, id, 'en', content({ title: 'Edited title' }));

		expect(await db.select().from(redirects)).toHaveLength(0);
	});
});

describe('publishing', () => {
	it('stamps published_at and makes the article readable', async () => {
		const id = await createArticle(db, { categoryId, locale: 'en', content: content() });

		expect(await getPublishedBySlug(db, { locale: 'en', slug: 'first-article' })).toBeNull();

		await setArticleStatus(db, id, 'published');

		const article = await getPublishedBySlug(db, { locale: 'en', slug: 'first-article' });
		expect(article?.title).toBe('First article');
	});

	it('keeps the original published_at when re-publishing', async () => {
		const id = await createArticle(db, { categoryId, locale: 'en', content: content() });
		await setArticleStatus(db, id, 'published');

		const [first] = await db
			.select({ publishedAt: articleLocales.publishedAt })
			.from(articleLocales)
			.where(eq(articleLocales.articleId, id));

		await setArticleStatus(db, id, 'archived');
		await setArticleStatus(db, id, 'published');

		const [second] = await db
			.select({ publishedAt: articleLocales.publishedAt })
			.from(articleLocales)
			.where(eq(articleLocales.articleId, id));

		// Resetting this would tell Google a years-old article is brand new.
		expect(second.publishedAt?.getTime()).toBe(first.publishedAt?.getTime());
	});

	it('a scheduled article stays invisible until its time', async () => {
		const id = await createArticle(db, { categoryId, locale: 'en', content: content() });
		const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

		await setArticleStatus(db, id, 'scheduled', future);
		expect(await getPublishedBySlug(db, { locale: 'en', slug: 'first-article' })).toBeNull();

		// Only the status and the clock decide; no job ever runs.
		await db.update(articles).set({ status: 'published' }).where(eq(articles.id, id));
		await db
			.update(articleLocales)
			.set({ publishedAt: new Date(Date.now() - 1000) })
			.where(and(eq(articleLocales.articleId, id), eq(articleLocales.locale, 'en')));

		expect(await getPublishedBySlug(db, { locale: 'en', slug: 'first-article' })).not.toBeNull();
	});
});

describe('duplicate slugs', () => {
	it('fail with an error the forms can recognise, and leave no half-written article', async () => {
		await createArticle(db, { categoryId, locale: 'en', content: content() });

		const failure = await createArticle(db, { categoryId, locale: 'en', content: content() }).catch(
			(error: unknown) => error
		);

		expect(isUniqueViolation(failure, 'article_locales_slug_idx')).toBe(true);
		expect(isUniqueViolation(failure, 'some_other_idx')).toBe(false);
		// The article row is inserted in the same transaction, so it rolled back too.
		const [{ n }] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(articles);
		expect(n).toBe(1);
	});
});
