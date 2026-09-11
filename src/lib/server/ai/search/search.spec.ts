import { describe, expect, it } from 'vitest';
import { createSearchClient, type SearchConfig } from './index';

type Call = { url: string; method: string; headers: Headers; body: unknown };

function fake(status: number, payload: unknown) {
	const calls: Call[] = [];
	const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		calls.push({
			url: String(input),
			method: init?.method ?? 'GET',
			headers: new Headers(init?.headers),
			body: init?.body ? JSON.parse(String(init.body)) : undefined
		});
		return new Response(JSON.stringify(payload), {
			status,
			headers: { 'content-type': 'application/json' }
		});
	}) as typeof globalThis.fetch;
	return { calls, fetch };
}

const client = (config: Omit<SearchConfig, 'fetch'>, f: ReturnType<typeof fake>) =>
	createSearchClient({ ...config, fetch: f.fetch });

describe('Serper', () => {
	it('posts the query with the key header and reads organic results', async () => {
		const f = fake(200, {
			organic: [
				{
					title: 'Orbit 2 launch',
					link: 'https://example.com/a',
					snippet: 'Ships in October',
					date: 'Sep 1, 2026',
					position: 1
				},
				{ title: 'No link' }
			]
		});

		const results = await client({ kind: 'serper', apiKey: 'serper-key' }, f).search('orbit 2', {
			count: 6
		});

		expect(f.calls[0]).toMatchObject({
			url: 'https://google.serper.dev/search',
			method: 'POST',
			body: { q: 'orbit 2', num: 6 }
		});
		expect(f.calls[0].headers.get('x-api-key')).toBe('serper-key');
		expect(results).toEqual([
			{
				title: 'Orbit 2 launch',
				url: 'https://example.com/a',
				snippet: 'Ships in October',
				publishedAt: 'Sep 1, 2026'
			}
		]);
	});

	it('reports a rejected key without echoing it', async () => {
		const f = fake(403, { message: 'Unauthorized: serper-key is not valid' });
		const search = client({ kind: 'serper', apiKey: 'serper-key' }, f).search('x', { count: 3 });
		await expect(search).rejects.toThrow('rejected the API key');
		await expect(search).rejects.not.toThrow('serper-key');
	});
});

describe('SerpApi', () => {
	it('sends the key as api_key and reads organic_results, capped to the count', async () => {
		const f = fake(200, {
			organic_results: [1, 2, 3, 4].map((i) => ({
				title: `R${i}`,
				link: `https://example.com/${i}`,
				snippet: 's'
			}))
		});

		const results = await client({ kind: 'serpapi', apiKey: 'serp-key' }, f).search('orbit', {
			count: 2
		});

		const url = new URL(f.calls[0].url);
		expect(url.origin + url.pathname).toBe('https://serpapi.com/search.json');
		expect(Object.fromEntries(url.searchParams)).toEqual({
			engine: 'google',
			q: 'orbit',
			api_key: 'serp-key'
		});
		expect(results.map((r) => r.url)).toEqual(['https://example.com/1', 'https://example.com/2']);
	});

	it('treats "no results" as an empty list, and other errors as errors', async () => {
		const empty = fake(200, { error: "Google hasn't returned any results for this query." });
		expect(
			await client({ kind: 'serpapi', apiKey: 'k' }, empty).search('zzz', { count: 3 })
		).toEqual([]);

		const broken = fake(200, { error: 'Your account has run out of searches.' });
		await expect(
			client({ kind: 'serpapi', apiKey: 'k' }, broken).search('x', { count: 3 })
		).rejects.toThrow('run out of searches');
	});
});

describe('Exa', () => {
	it('posts numResults with x-api-key and reads url, title and date', async () => {
		const f = fake(200, {
			requestId: 'r1',
			results: [
				{
					id: '1',
					title: 'Orbit 2',
					url: 'https://example.com/e',
					publishedDate: '2026-09-01T00:00:00.000Z'
				}
			]
		});

		const results = await client({ kind: 'exa', apiKey: 'exa-key' }, f).search('orbit', {
			count: 25
		});

		expect(f.calls[0]).toMatchObject({
			url: 'https://api.exa.ai/search',
			method: 'POST',
			body: { query: 'orbit', numResults: 10 }
		});
		expect(f.calls[0].headers.get('x-api-key')).toBe('exa-key');
		expect(results).toEqual([
			{
				title: 'Orbit 2',
				url: 'https://example.com/e',
				snippet: '',
				publishedAt: '2026-09-01T00:00:00.000Z'
			}
		]);
	});
});

describe('SearXNG', () => {
	it('asks the instance for JSON, needs no key, and caps to the count', async () => {
		const f = fake(200, {
			query: 'orbit',
			results: [1, 2, 3, 4].map((i) => ({
				url: `https://example.com/${i}`,
				title: `T${i}`,
				content: 'c',
				publishedDate: null
			}))
		});

		const results = await client(
			{ kind: 'searxng', apiKey: null, baseUrl: 'https://searx.example.org/' },
			f
		).search('orbit', { count: 3 });

		expect(f.calls[0].url).toBe('https://searx.example.org/search?q=orbit&format=json');
		expect(results).toHaveLength(3);
		expect(results[0]).toEqual({
			title: 'T1',
			url: 'https://example.com/1',
			snippet: 'c',
			publishedAt: null
		});
	});

	it('explains a 403 as JSON output being disabled, not as a bad key', async () => {
		const f = fake(403, {});
		await expect(
			client({ kind: 'searxng', apiKey: null, baseUrl: 'https://searx.example.org' }, f).search(
				'x',
				{ count: 3 }
			)
		).rejects.toThrow('search.formats');
	});

	it('needs an address', async () => {
		const f = fake(200, {});
		await expect(
			client({ kind: 'searxng', apiKey: null }, f).search('x', { count: 3 })
		).rejects.toThrow('address');
	});
});

describe('keys', () => {
	it('refuses a keyed provider without a key, before any request', async () => {
		for (const kind of ['brave', 'tavily', 'serper', 'serpapi', 'exa'] as const) {
			const f = fake(200, {});
			await expect(
				client({ kind, apiKey: null }, f).search('x', { count: 3 }),
				kind
			).rejects.toThrow('needs an API key');
			expect(f.calls).toHaveLength(0);
		}
	});
});
