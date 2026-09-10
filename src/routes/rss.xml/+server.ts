import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { recentArticles } from '$lib/server/db/queries/public';
import { siteName, siteOrigin } from '$lib/server/site';
import { xmlSafe } from '$lib/server/xml';
import { baseLocale, isLocale, type Locale } from '$lib/paraglide/runtime';
import * as urls from '$lib/urls';

/**
 * Summary-and-link feed, not full text (PRD §8.1).
 *
 * A full-text feed hands every scraper a clean copy of the article, and the
 * copies routinely outrank the original. The excerpt is enough for a reader
 * to decide, which is what a feed is for.
 *
 * ?locale=id serves the Indonesian feed; the default is the base locale.
 */
const LIMIT = 20;

export const GET: RequestHandler = async ({ url, setHeaders }) => {
	const requested = url.searchParams.get('locale') ?? '';
	const locale: Locale = isLocale(requested) ? requested : baseLocale;

	const origin = siteOrigin(url);
	const name = siteName();
	const rows = await recentArticles(db, locale, { limit: LIMIT });

	setHeaders({
		'content-type': 'application/xml; charset=utf-8',
		'cache-control': 'public, max-age=0, s-maxage=1800'
	});

	const self = `${origin}/rss.xml${locale === baseLocale ? '' : `?locale=${locale}`}`;
	const updated = rows[0]?.published_at ? new Date(rows[0].published_at) : new Date();
	const description =
		locale === 'id'
			? 'AI dan teknologi, diuji oleh orang yang memakainya.'
			: 'AI and technology, tested by someone who uses it.';

	const items = rows
		.map((row) => {
			const link = `${origin}${urls.article(locale, row.category_slug, row.slug)}`;
			return `    <item>
      <title>${xmlSafe(row.title)}</title>
      <link>${xmlSafe(link)}</link>
      <guid isPermaLink="true">${xmlSafe(link)}</guid>
      <description>${xmlSafe(row.excerpt)}</description>
      <category>${xmlSafe(row.category_name ?? row.category_slug)}</category>
      <pubDate>${new Date(row.published_at).toUTCString()}</pubDate>
    </item>`;
		})
		.join('\n');

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlSafe(name)}</title>
    <link>${xmlSafe(`${origin}${urls.home(locale)}`)}</link>
    <description>${xmlSafe(description)}</description>
    <language>${locale}</language>
    <lastBuildDate>${updated.toUTCString()}</lastBuildDate>
    <atom:link href="${xmlSafe(self)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

	return new Response(body);
};
