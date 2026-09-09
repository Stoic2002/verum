import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../types';
import type { Sql } from 'postgres';
import { setupTestDatabase } from '../testing';
import { articleLocales, articles, categories } from '../schema';
import { searchArticles } from './search';
import { listPublished } from './articles';

let db: Database;
let client: Sql;

const DAY = 24 * 60 * 60 * 1000;
const ago = (d: number) => new Date(Date.now() - d * DAY);
const ahead = (d: number) => new Date(Date.now() + d * DAY);

beforeAll(async () => {
	({ db, client } = await setupTestDatabase());

	const [ai] = await db
		.insert(categories)
		.values({ slug: 'ai', sortOrder: 1 })
		.returning({ id: categories.id });

	const rows = [
		{
			status: 'published' as const,
			locale: 'en' as const,
			slug: 'comparing-ai-coding-tools',
			title: 'Comparing AI coding tools',
			excerpt: 'Six assistants on the same refactor.',
			bodyText: 'Each assistant was given an identical refactor and timed.',
			publishedAt: ago(10)
		},
		{
			status: 'published' as const,
			locale: 'en' as const,
			slug: 'postgres-search',
			title: 'Postgres full-text search',
			excerpt: 'Ranking and highlighting without a search service.',
			bodyText: 'Ranking uses term proximity. No mention of the other subject here.',
			publishedAt: ago(4)
		},
		{
			status: 'published' as const,
			locale: 'id' as const,
			slug: 'membandingkan-tool-coding-ai',
			title: 'Membandingkan tool coding AI',
			excerpt: 'Enam asisten pada refactor yang sama.',
			bodyText: 'Setiap asisten diberi tugas refactor yang identik dan diukur waktunya.',
			publishedAt: ago(10)
		},
		{
			status: 'scheduled' as const,
			locale: 'en' as const,
			slug: 'scheduled-coding-tools-roundup',
			title: 'Scheduled coding tools roundup',
			excerpt: 'Not live yet.',
			bodyText: 'This article about coding tools is scheduled for the future.',
			publishedAt: ahead(3)
		}
	];

	for (const row of rows) {
		const [article] = await db
			.insert(articles)
			.values({ categoryId: ai.id, status: row.status })
			.returning({ id: articles.id });

		await db.insert(articleLocales).values({
			articleId: article.id,
			locale: row.locale,
			slug: row.slug,
			title: row.title,
			excerpt: row.excerpt,
			bodyMd: row.bodyText,
			bodyText: row.bodyText,
			publishedAt: row.publishedAt
		});
	}
});

afterAll(async () => {
	await client?.end();
});

describe('English search', () => {
	it('ranks the title match above the body match', async () => {
		const hits = await searchArticles(db, 'coding tools', { locale: 'en' });

		expect(hits.map((h) => h.slug)).toEqual(['comparing-ai-coding-tools']);
		expect(Number(hits[0].rank)).toBeGreaterThan(0);
	});

	it('stems: "compared" finds "Comparing"', async () => {
		const hits = await searchArticles(db, 'compared', { locale: 'en' });
		expect(hits.map((h) => h.slug)).toContain('comparing-ai-coding-tools');
	});

	it('highlights the match', async () => {
		const [hit] = await searchArticles(db, 'refactor', { locale: 'en' });
		expect(hit.headline).toContain('<mark>');
	});

	it('honours websearch syntax without throwing on odd input', async () => {
		await expect(searchArticles(db, 'coding -postgres', { locale: 'en' })).resolves.toHaveLength(1);
		await expect(searchArticles(db, '(((', { locale: 'en' })).resolves.toBeInstanceOf(Array);
	});
});

describe('Indonesian search', () => {
	it('stems Indonesian: "banding" finds "Membandingkan"', async () => {
		// The reason the trigger picks a config per locale: the english stemmer
		// leaves "membandingkan" whole and this query would return nothing.
		const hits = await searchArticles(db, 'banding', { locale: 'id' });
		expect(hits.map((h) => h.slug)).toEqual(['membandingkan-tool-coding-ai']);
	});

	it('does not leak English rows into the Indonesian index', async () => {
		const hits = await searchArticles(db, 'postgres', { locale: 'id' });
		expect(hits).toHaveLength(0);
	});
});

describe('publication gate', () => {
	it('excludes scheduled articles from search', async () => {
		const hits = await searchArticles(db, 'coding tools', { locale: 'en' });
		expect(hits.map((h) => h.slug)).not.toContain('scheduled-coding-tools-roundup');
	});

	it('excludes scheduled articles from listings', async () => {
		const rows = await listPublished(db, { locale: 'en' });
		expect(rows.map((r) => r.slug)).not.toContain('scheduled-coding-tools-roundup');
		expect(rows).toHaveLength(2);
	});
});
