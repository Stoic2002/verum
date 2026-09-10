import { env } from '$env/dynamic/private';
import { siteName } from './site';

/**
 * Purges Cloudflare's cache for specific URLs.
 *
 * Published articles are cached at the edge for a day (PRD §10.3), so without
 * this an edit is invisible to readers until the TTL expires. Purging by URL
 * rather than purging everything keeps the rest of the site warm.
 *
 * Failure is logged, never thrown: a purge that did not happen means a reader
 * sees yesterday's wording for a while. Turning that into a failed save would
 * make an outage at Cloudflare an outage of the editor.
 */
export type PurgeResult = { attempted: boolean; ok: boolean; error?: string };

export function cdnConfigured(): boolean {
	return Boolean(env.CLOUDFLARE_ZONE_ID && env.CLOUDFLARE_API_TOKEN);
}

export async function purgeUrls(urls: string[]): Promise<PurgeResult> {
	const unique = [...new Set(urls.filter(Boolean))];
	if (unique.length === 0) return { attempted: false, ok: true };

	if (!cdnConfigured()) {
		// Expected during development and in CI; not a warning worth printing
		// on every save.
		return { attempted: false, ok: true };
	}

	try {
		// Cloudflare accepts at most 30 URLs per call.
		for (let index = 0; index < unique.length; index += 30) {
			const batch = unique.slice(index, index + 30);

			const response = await fetch(
				`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/purge_cache`,
				{
					method: 'POST',
					headers: {
						authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
						'content-type': 'application/json'
					},
					body: JSON.stringify({ files: batch })
				}
			);

			if (!response.ok) {
				const detail = await response.text();
				console.error(`[cdn] purge failed: ${response.status} ${detail}`);
				return { attempted: true, ok: false, error: `${response.status}` };
			}
		}

		return { attempted: true, ok: true };
	} catch (error) {
		console.error('[cdn] purge threw:', error);
		return { attempted: true, ok: false, error: (error as Error).message };
	}
}

/**
 * Every URL an article edit can affect.
 *
 * Not just the article: its category listing, the homepage, the feed and the
 * sitemaps all embed its title or date, and leaving those stale is how a site
 * ends up showing a headline that no longer exists anywhere.
 */
export function articleSurfaces(
	origin: string,
	locale: string,
	categorySlug: string,
	slug: string
): string[] {
	return [
		`${origin}/${locale}/${categorySlug}/${slug}`,
		`${origin}/${locale}/${categorySlug}`,
		`${origin}/${locale}`,
		`${origin}/rss.xml`,
		`${origin}/rss.xml?locale=${locale}`,
		`${origin}/sitemap.xml`,
		`${origin}/sitemap-${locale}.xml`
	];
}

export { siteName };
