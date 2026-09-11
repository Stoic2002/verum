import type { SearchProviderKind } from '../../db/schema';
import { ProviderError, describeStatus, redact } from '../llm/types';

/**
 * Web search, as its own provider.
 *
 * Not the models' built-in browsing: only some providers have it, each returns
 * something different, and none of it can be checked afterwards. A plain list
 * of URLs from a search API is the same for every model, and the pages behind
 * it are downloaded by this server, where the quotes can be verified.
 *
 * Only the URL of each result is used for research; titles and snippets are
 * for display. Request shapes follow each provider's documentation as of
 * 11 September 2026.
 */

export type SearchResult = {
	title: string;
	url: string;
	snippet: string;
	publishedAt: string | null;
};

export interface SearchClient {
	search(query: string, options: { count: number; signal?: AbortSignal }): Promise<SearchResult[]>;
}

export type SearchConfig = {
	kind: SearchProviderKind;
	apiKey: string | null;
	/** Self-hosted engines only (SearXNG). */
	baseUrl?: string | null;
	fetch?: typeof fetch;
};

const stripTags = (value: string) => value.replace(/<[^>]*>/g, '').trim();

function requireKey(config: SearchConfig): string {
	if (!config.apiKey) throw new ProviderError('This search provider needs an API key.');
	return config.apiKey;
}

/**
 * One request, with failures reduced to a message fit for the job log.
 * `display` is what errors may name: never the URL, which for SerpApi
 * carries the key.
 */
async function send(
	config: SearchConfig,
	url: string,
	init: RequestInit
): Promise<Record<string, unknown>> {
	const doFetch = config.fetch ?? fetch;
	const host = new URL(url).host;

	let response: Response;
	try {
		response = await doFetch(url, init);
	} catch (error) {
		if ((error as Error).name === 'AbortError' || (error as Error).name === 'TimeoutError') {
			throw error;
		}
		throw new ProviderError(`Could not reach ${host}.`);
	}

	const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
	if (!response.ok) {
		const raw = body.message ?? body.detail ?? body.error ?? '';
		const detail =
			response.status === 401
				? ''
				: redact(typeof raw === 'string' ? raw : JSON.stringify(raw), config.apiKey);
		throw new ProviderError(describeStatus(response.status, detail, 'search'), response.status);
	}
	return body;
}

type Adapter = (config: SearchConfig) => SearchClient;

const brave: Adapter = (config) => ({
	async search(query, { count, signal }) {
		const key = requireKey(config);
		const params = new URLSearchParams({ q: query, count: String(Math.min(count, 20)) });
		const body = (await send(config, `https://api.search.brave.com/res/v1/web/search?${params}`, {
			signal,
			headers: { accept: 'application/json', 'x-subscription-token': key }
		})) as {
			web?: {
				results?: { title?: string; url?: string; description?: string; page_age?: string }[];
			};
		};

		return (body.web?.results ?? []).flatMap((r) =>
			r.url
				? [
						{
							title: stripTags(r.title ?? ''),
							url: r.url,
							snippet: stripTags(r.description ?? ''),
							publishedAt: r.page_age ?? null
						}
					]
				: []
		);
	}
});

const tavily: Adapter = (config) => ({
	async search(query, { count, signal }) {
		const key = requireKey(config);
		const body = (await send(config, 'https://api.tavily.com/search', {
			method: 'POST',
			signal,
			headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
			body: JSON.stringify({ query, max_results: Math.min(count, 20), search_depth: 'basic' })
		})) as {
			results?: { title?: string; url?: string; content?: string; published_date?: string }[];
		};

		return (body.results ?? []).flatMap((r) =>
			r.url
				? [
						{
							title: r.title ?? '',
							url: r.url,
							snippet: r.content ?? '',
							publishedAt: r.published_date ?? null
						}
					]
				: []
		);
	}
});

/** Google results through Serper: POST google.serper.dev/search, key in X-API-KEY. */
const serper: Adapter = (config) => ({
	async search(query, { count, signal }) {
		const key = requireKey(config);
		const body = (await send(config, 'https://google.serper.dev/search', {
			method: 'POST',
			signal,
			headers: { 'content-type': 'application/json', 'x-api-key': key },
			body: JSON.stringify({ q: query, num: Math.min(count, 20) })
		})) as { organic?: { title?: string; link?: string; snippet?: string; date?: string }[] };

		return (body.organic ?? []).flatMap((r) =>
			r.link
				? [
						{
							title: r.title ?? '',
							url: r.link,
							snippet: r.snippet ?? '',
							publishedAt: r.date ?? null
						}
					]
				: []
		);
	}
});

/**
 * Google results through SerpApi. The key has to travel as `api_key` in the
 * query string — SerpApi documents no header — so no error here ever repeats
 * the request URL.
 */
const serpapi: Adapter = (config) => ({
	async search(query, { count, signal }) {
		const key = requireKey(config);
		const params = new URLSearchParams({ engine: 'google', q: query, api_key: key });
		const body = (await send(config, `https://serpapi.com/search.json?${params}`, { signal })) as {
			organic_results?: { title?: string; link?: string; snippet?: string; date?: string }[];
			error?: string;
		};

		// SerpApi answers an empty search with 200 and an `error` string.
		if (!body.organic_results && body.error) {
			if (/hasn't returned any results/i.test(body.error)) return [];
			throw new ProviderError(`SerpApi: ${redact(body.error, key)}`);
		}

		return (body.organic_results ?? [])
			.flatMap((r) =>
				r.link
					? [
							{
								title: r.title ?? '',
								url: r.link,
								snippet: r.snippet ?? '',
								publishedAt: r.date ?? null
							}
						]
					: []
			)
			.slice(0, count);
	}
});

/** Exa: POST api.exa.ai/search, key in x-api-key. No page contents requested — this server reads the pages. */
const exa: Adapter = (config) => ({
	async search(query, { count, signal }) {
		const key = requireKey(config);
		const body = (await send(config, 'https://api.exa.ai/search', {
			method: 'POST',
			signal,
			headers: { 'content-type': 'application/json', 'x-api-key': key },
			body: JSON.stringify({ query, numResults: Math.min(count, 10) })
		})) as {
			results?: {
				title?: string | null;
				url?: string;
				publishedDate?: string | null;
				summary?: string;
			}[];
		};

		return (body.results ?? []).flatMap((r) =>
			r.url
				? [
						{
							title: r.title ?? '',
							url: r.url,
							snippet: r.summary ?? '',
							publishedAt: r.publishedDate ?? null
						}
					]
				: []
		);
	}
});

/** A self-hosted SearXNG instance: GET {base}/search?format=json. */
const searxng: Adapter = (config) => ({
	async search(query, { count, signal }) {
		const base = config.baseUrl?.trim().replace(/\/+$/, '');
		if (!base) throw new ProviderError('SearXNG needs the address of your instance.');

		const params = new URLSearchParams({ q: query, format: 'json' });
		let body: {
			results?: { url?: string; title?: string; content?: string; publishedDate?: string | null }[];
		};
		try {
			body = (await send(config, `${base}/search?${params}`, {
				signal,
				headers: { accept: 'application/json' }
			})) as typeof body;
		} catch (error) {
			// 403 here is SearXNG refusing the format, not a key problem.
			if (error instanceof ProviderError && error.status === 403) {
				throw new ProviderError(
					'SearXNG refused JSON output (403). Add json under search.formats in its settings.yml.',
					403
				);
			}
			throw error;
		}

		return (body.results ?? [])
			.flatMap((r) =>
				r.url
					? [
							{
								title: r.title ?? '',
								url: r.url,
								snippet: r.content ?? '',
								publishedAt: r.publishedDate ?? null
							}
						]
					: []
			)
			.slice(0, count);
	}
});

const ADAPTERS: Record<SearchProviderKind, Adapter> = {
	brave,
	tavily,
	serper,
	serpapi,
	exa,
	searxng
};

export function createSearchClient(config: SearchConfig): SearchClient {
	return ADAPTERS[config.kind](config);
}
