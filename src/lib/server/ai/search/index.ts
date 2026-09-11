import type { SearchProviderKind } from '../../db/schema';
import { ProviderError, describeStatus, redact } from '../llm/types';

/**
 * Web search, as its own provider.
 *
 * Not the models' built-in browsing: only some providers have it, each returns
 * something different, and none of it can be checked afterwards. A plain list
 * of URLs from a search API is the same for every model, and the pages behind
 * it are downloaded by this server, where the quotes can be verified.
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

type Config = { kind: SearchProviderKind; apiKey: string; fetch?: typeof fetch };

const stripTags = (value: string) => value.replace(/<[^>]*>/g, '').trim();

async function send(
	doFetch: typeof fetch,
	url: string,
	init: RequestInit,
	apiKey: string
): Promise<unknown> {
	let response: Response;
	try {
		response = await doFetch(url, init);
	} catch (error) {
		if ((error as Error).name === 'AbortError' || (error as Error).name === 'TimeoutError') {
			throw error;
		}
		throw new ProviderError(`Could not reach ${new URL(url).host}.`);
	}

	const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
	if (!response.ok) {
		const raw = (body.message ?? body.detail ?? body.error ?? '') as unknown;
		const detail = response.status === 401 ? '' : redact(JSON.stringify(raw ?? ''), apiKey);
		throw new ProviderError(describeStatus(response.status, detail, 'search'), response.status);
	}
	return body;
}

function brave(config: Config): SearchClient {
	const doFetch = config.fetch ?? fetch;
	return {
		async search(query, { count, signal }) {
			const params = new URLSearchParams({ q: query, count: String(Math.min(count, 20)) });
			const body = (await send(
				doFetch,
				`https://api.search.brave.com/res/v1/web/search?${params}`,
				{
					signal,
					headers: { accept: 'application/json', 'x-subscription-token': config.apiKey }
				},
				config.apiKey
			)) as {
				web?: {
					results?: { title?: string; url?: string; description?: string; page_age?: string }[];
				};
			};

			return (body.web?.results ?? [])
				.filter((r) => r.url)
				.map((r) => ({
					title: stripTags(r.title ?? ''),
					url: r.url!,
					snippet: stripTags(r.description ?? ''),
					publishedAt: r.page_age ?? null
				}));
		}
	};
}

function tavily(config: Config): SearchClient {
	const doFetch = config.fetch ?? fetch;
	return {
		async search(query, { count, signal }) {
			const body = (await send(
				doFetch,
				'https://api.tavily.com/search',
				{
					method: 'POST',
					signal,
					headers: {
						'content-type': 'application/json',
						authorization: `Bearer ${config.apiKey}`
					},
					body: JSON.stringify({ query, max_results: Math.min(count, 20), search_depth: 'basic' })
				},
				config.apiKey
			)) as {
				results?: { title?: string; url?: string; content?: string; published_date?: string }[];
			};

			return (body.results ?? [])
				.filter((r) => r.url)
				.map((r) => ({
					title: r.title ?? '',
					url: r.url!,
					snippet: r.content ?? '',
					publishedAt: r.published_date ?? null
				}));
		}
	};
}

export function createSearchClient(config: Config): SearchClient {
	return config.kind === 'brave' ? brave(config) : tavily(config);
}
