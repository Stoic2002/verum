import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sitemapLastModified } from '$lib/server/db/queries/sitemap';
import { siteOrigin } from '$lib/server/site';
import { xmlSafe } from '$lib/server/xml';
import { LOCALES } from '$lib/server/db/schema';

/**
 * Sitemap index, pointing at one sitemap per locale (PRD §12.7).
 *
 * Generated from the database on request rather than written to a file at
 * publish time. At VERUM's scale the query costs a few milliseconds, the edge
 * caches the result, and a publish purges it — which removes an entire class
 * of failure where the file and the database disagree.
 */
export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const origin = siteOrigin(url);

	setHeaders({
		'content-type': 'application/xml; charset=utf-8',
		'cache-control': 'public, max-age=0, s-maxage=3600'
	});

	const entries = await Promise.all(
		LOCALES.map(async (locale) => {
			const lastmod = await sitemapLastModified(db, locale);
			return `  <sitemap>
    <loc>${xmlSafe(`${origin}/sitemap-${locale}.xml`)}</loc>${
			lastmod ? `\n    <lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ''
		}
  </sitemap>`;
		})
	);

	return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</sitemapindex>
`);
};
