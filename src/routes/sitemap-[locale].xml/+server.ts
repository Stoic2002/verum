import { error, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	sitemapArticles,
	sitemapCategories,
	sitemapTags,
	sitemapTopics
} from '$lib/server/db/queries/sitemap';
import { siteOrigin } from '$lib/server/site';
import { xmlSafe } from '$lib/server/xml';
import { LOCALES, type Locale } from '$lib/server/db/schema';
import * as urls from '$lib/urls';
import { PAGE_SLUGS } from '$lib/server/content/pages';

/**
 * One locale's sitemap, with xhtml:link alternates (PRD §12.7).
 *
 * The alternates on each URL are the same cluster the page's hreflang tags
 * declare. They have to agree: Google checks both, and a disagreement is
 * treated as an unreliable annotation and dropped for the whole set.
 */
type Entry = {
	loc: string;
	lastmod?: Date | string | null;
	alternates?: { locale: string; loc: string }[];
};

function renderEntry(entry: Entry): string {
	const alternates = (entry.alternates ?? [])
		.map(
			(alternate) =>
				`\n    <xhtml:link rel="alternate" hreflang="${alternate.locale}" href="${xmlSafe(alternate.loc)}" />`
		)
		.join('');

	const lastmod = entry.lastmod
		? `\n    <lastmod>${new Date(entry.lastmod).toISOString()}</lastmod>`
		: '';

	return `  <url>
    <loc>${xmlSafe(entry.loc)}</loc>${lastmod}${alternates}
  </url>`;
}

export const GET: RequestHandler = async ({ params, url, setHeaders }) => {
	const locale = params.locale as Locale;
	if (!LOCALES.includes(locale)) error(404, 'Not found');

	const origin = siteOrigin(url);
	const abs = (path: string) => `${origin}${path}`;

	setHeaders({
		'content-type': 'application/xml; charset=utf-8',
		'cache-control': 'public, max-age=0, s-maxage=3600'
	});

	const [articles, categories, tags, topics] = await Promise.all([
		sitemapArticles(db, locale),
		sitemapCategories(db, locale),
		sitemapTags(db, locale),
		sitemapTopics(db, locale)
	]);

	const entries: Entry[] = [
		{
			loc: abs(urls.home(locale)),
			alternates: LOCALES.map((l) => ({ locale: l, loc: abs(urls.home(l)) }))
		},

		/*
		 * About, Contact, Editorial Policy, Privacy and Terms.
		 *
		 * These are the pages AdSense review looks for (PRD §14), and leaving
		 * them out of the sitemap is the one place the omission costs anything.
		 */
		...PAGE_SLUGS.map((slug) => ({
			loc: abs(`/${locale}/${slug}`),
			alternates: LOCALES.map((l) => ({ locale: l, loc: abs(`/${l}/${slug}`) }))
		})),

		...categories.map((row) => ({
			loc: abs(urls.category(locale, row.slug)),
			lastmod: row.lastmod,
			alternates: LOCALES.map((l) => ({ locale: l, loc: abs(urls.category(l, row.slug)) }))
		})),

		...articles.map((row) => ({
			loc: abs(urls.article(locale, row.category_slug, row.slug)),
			lastmod: row.lastmod,
			// Only locales the article is actually published in (PRD §7).
			alternates: (row.alternates ?? []).map((alternate) => ({
				locale: alternate.locale,
				loc: abs(urls.article(alternate.locale as Locale, alternate.category_slug, alternate.slug))
			}))
		})),

		...topics.map((row) => ({
			loc: abs(urls.topic(locale, row.slug)),
			lastmod: row.lastmod,
			alternates: LOCALES.map((l) => ({ locale: l, loc: abs(urls.topic(l, row.slug)) }))
		})),

		...tags.map((row) => ({
			loc: abs(urls.tag(locale, row.slug)),
			lastmod: row.lastmod
		}))
	];

	return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.map(renderEntry).join('\n')}
</urlset>
`);
};
