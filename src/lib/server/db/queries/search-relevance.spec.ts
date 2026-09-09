import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Sql } from 'postgres';
import { setupTestDatabase } from '../testing';
import type { Database } from '../types';
import { articleLocales, articles, categories } from '../schema';
import { countSearchResults, searchArticles } from './search';

/**
 * Fase 6 exit criterion: search returns relevant results for ten queries.
 *
 * The corpus is small but shaped like the real one — overlapping vocabulary
 * across categories, one Indonesian article, one draft, one scheduled — so a
 * result being right is about ranking rather than there being only one answer.
 */

let db: Database;
let client: Sql;

type Fixture = {
	category: 'ai' | 'tech';
	status: 'published' | 'draft' | 'scheduled';
	locale: 'en' | 'id';
	slug: string;
	title: string;
	excerpt: string;
	body: string;
	daysAgo: number;
};

const FIXTURES: Fixture[] = [
	{
		category: 'ai',
		status: 'published',
		locale: 'en',
		slug: 'claude-vs-gpt-for-refactoring',
		title: 'Claude vs GPT for refactoring legacy code',
		excerpt: 'Both models on the same twenty-year-old Java service.',
		body: 'We measured how each model handled a large refactor, counting the corrections needed afterwards.',
		daysAgo: 5
	},
	{
		category: 'ai',
		status: 'published',
		locale: 'en',
		slug: 'prompt-caching-explained',
		title: 'Prompt caching, explained',
		excerpt: 'What it does to latency and to the bill.',
		body: 'Caching a long system prompt cuts both cost and time to first token on repeated calls.',
		daysAgo: 12
	},
	{
		category: 'tech',
		status: 'published',
		locale: 'en',
		slug: 'postgres-full-text-search',
		title: 'Postgres full-text search for small sites',
		excerpt: 'Ranking and highlighting without running a search service.',
		body: 'ts_rank_cd weighs how close matched terms sit together, which starts to matter once article bodies are indexed.',
		daysAgo: 20
	},
	{
		category: 'tech',
		status: 'published',
		locale: 'en',
		slug: 'sqlite-vs-postgres',
		title: 'SQLite or Postgres for a side project',
		excerpt: 'The honest tradeoffs, with numbers.',
		body: 'SQLite wins on operations until you need concurrent writers or full-text search across languages.',
		daysAgo: 40
	},
	{
		category: 'ai',
		status: 'published',
		locale: 'id',
		slug: 'menjelaskan-prompt-caching',
		title: 'Menjelaskan prompt caching untuk pengembang',
		excerpt: 'Pengaruhnya pada latensi dan biaya.',
		body: 'Menyimpan prompt sistem yang panjang memotong biaya dan waktu tunggu pada panggilan berulang.',
		daysAgo: 8
	},
	{
		category: 'ai',
		status: 'draft',
		locale: 'en',
		slug: 'draft-about-refactoring',
		title: 'Draft about refactoring with agents',
		excerpt: 'Not published.',
		body: 'This draft mentions refactoring and agents repeatedly but must never surface.',
		daysAgo: 1
	},
	{
		category: 'tech',
		status: 'scheduled',
		locale: 'en',
		slug: 'scheduled-postgres-piece',
		title: 'Scheduled Postgres piece',
		excerpt: 'Goes live later.',
		body: 'A scheduled article about Postgres indexing that is not readable yet.',
		daysAgo: -3
	}
];

beforeAll(async () => {
	({ db, client } = await setupTestDatabase());

	const inserted = await db
		.insert(categories)
		.values([{ slug: 'ai' }, { slug: 'tech' }])
		.returning({ id: categories.id, slug: categories.slug });
	const categoryId = new Map(inserted.map((row) => [row.slug, row.id]));

	for (const fixture of FIXTURES) {
		const [article] = await db
			.insert(articles)
			.values({ categoryId: categoryId.get(fixture.category)!, status: fixture.status })
			.returning({ id: articles.id });

		await db.insert(articleLocales).values({
			articleId: article.id,
			locale: fixture.locale,
			slug: fixture.slug,
			title: fixture.title,
			excerpt: fixture.excerpt,
			bodyMd: fixture.body,
			bodyText: fixture.body,
			publishedAt: new Date(Date.now() - fixture.daysAgo * 86_400_000)
		});
	}
});

afterAll(async () => {
	await client?.end();
});

const slugs = async (query: string, options: Parameters<typeof searchArticles>[2]) =>
	(await searchArticles(db, query, options)).map((hit) => hit.slug);

describe('ten queries', () => {
	const en = { locale: 'en' as const };

	it('1. an exact title phrase ranks its article first', async () => {
		const results = await slugs('Postgres full-text search', en);
		expect(results[0]).toBe('postgres-full-text-search');
	});

	it('2. a single distinctive term finds only what mentions it', async () => {
		expect(await slugs('claude', en)).toEqual(['claude-vs-gpt-for-refactoring']);
	});

	it('3. stemming: "refactor" finds "refactoring"', async () => {
		expect(await slugs('refactor', en)).toContain('claude-vs-gpt-for-refactoring');
	});

	it('4. a body-only term still matches', async () => {
		expect(await slugs('ts_rank_cd', en)).toContain('postgres-full-text-search');
	});

	it('5. two words rank the article containing both above one containing either', async () => {
		const results = await slugs('prompt caching', en);
		expect(results[0]).toBe('prompt-caching-explained');
	});

	it('6. a quoted phrase excludes articles with the words apart', async () => {
		const results = await slugs('"full-text search"', en);
		expect(results).toContain('postgres-full-text-search');
		expect(results).not.toContain('claude-vs-gpt-for-refactoring');
	});

	it('7. negation removes a match', async () => {
		const withBoth = await slugs('postgres', en);
		const without = await slugs('postgres -sqlite', en);
		expect(withBoth).toContain('sqlite-vs-postgres');
		expect(without).not.toContain('sqlite-vs-postgres');
	});

	it('8. the category filter narrows without changing relevance', async () => {
		const all = await slugs('caching', en);
		const filtered = await slugs('caching', { locale: 'en', category: 'ai' });
		expect(all).toContain('prompt-caching-explained');
		expect(filtered).toEqual(['prompt-caching-explained']);
		expect(await slugs('caching', { locale: 'en', category: 'tech' })).toEqual([]);
	});

	it('9. Indonesian stemming works and does not reach English rows', async () => {
		// "menyimpan" stems to the same root as the body's wording.
		expect(await slugs('simpan', { locale: 'id' })).toContain('menjelaskan-prompt-caching');
		expect(await slugs('postgres', { locale: 'id' })).toEqual([]);
	});

	it('10. nonsense returns nothing rather than everything', async () => {
		expect(await slugs('zzzqqqx', en)).toEqual([]);
		expect(await slugs('   ', en)).toEqual([]);
	});
});

describe('what search must never surface', () => {
	it('excludes drafts and scheduled articles', async () => {
		const results = await slugs('refactoring agents postgres indexing', { locale: 'en' });
		expect(results).not.toContain('draft-about-refactoring');
		expect(results).not.toContain('scheduled-postgres-piece');
	});
});

describe('pagination', () => {
	it('counts matches independently of the page being shown', async () => {
		const total = await countSearchResults(db, 'postgres', { locale: 'en' });
		const firstPage = await searchArticles(db, 'postgres', { locale: 'en', limit: 1 });
		const secondPage = await searchArticles(db, 'postgres', { locale: 'en', limit: 1, offset: 1 });

		expect(total).toBeGreaterThan(1);
		expect(firstPage).toHaveLength(1);
		expect(secondPage[0].slug).not.toBe(firstPage[0].slug);
	});

	it('agrees with the result list when there are no matches', async () => {
		expect(await countSearchResults(db, 'zzzqqqx', { locale: 'en' })).toBe(0);
		expect(await countSearchResults(db, '', { locale: 'en' })).toBe(0);
	});
});
