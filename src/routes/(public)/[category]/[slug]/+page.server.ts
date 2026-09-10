import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { articleBySlug, publishedAlternates, relatedArticles } from '$lib/server/db/queries/public';
import { toCard } from '$lib/server/cards';
import * as urls from '$lib/urls';
import { articleSeo } from '$lib/server/seo';
import { siteOrigin } from '$lib/server/site';
import type { Locale } from '$lib/paraglide/runtime';
import type { PageServerLoad } from './$types';

/** PRD §8.1: the table of contents only appears on articles long enough to need it. */
const TOC_MIN_WORDS = 1200;

export const load: PageServerLoad = async ({ params, url, locals, setHeaders }) => {
	const locale = locals.locale;
	const row = await articleBySlug(db, locale, params.category, params.slug);
	if (!row) error(404, 'Not found');

	// A published article changes rarely; the cache is purged on update
	// (PRD §10.3). stale-while-revalidate keeps a purge from ever showing a
	// reader a slow origin response.
	setHeaders({
		'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800'
	});

	const alternates = (await publishedAlternates(db, Number(row.article_id)))
		.filter((alternate) => alternate.locale !== locale)
		.map((alternate) => ({
			locale: alternate.locale,
			href: urls.article(alternate.locale as Locale, alternate.category_slug, alternate.slug)
		}));

	// Breadcrumb copy has to match what the page renders, so it comes from the
	// same messages the layout uses.
	const homeLabel = locale === 'id' ? 'Beranda' : 'Home';

	const related = await relatedArticles(db, locale, Number(row.article_id), params.category, 3);

	const origin = siteOrigin(url);
	const card = toCard(row);
	const absolute = (path: string) => `${origin}${path}`;

	const seo = articleSeo(
		{ requestUrl: url, locale },
		{
			title: row.title,
			excerpt: row.excerpt,
			metaTitle: row.meta_title,
			metaDesc: row.meta_desc,
			slug: row.slug,
			categorySlug: row.category_slug,
			categoryName: row.category_name,
			publishedAt: new Date(row.published_at).toISOString(),
			modifiedAt: row.modified_at ? new Date(row.modified_at).toISOString() : null,
			wordCount: row.word_count,
			tags: row.tags,
			image: card.image
				? {
						// Open Graph wants an absolute URL; the widest rendition is the
						// one a social card should get.
						url: card.image.src.startsWith('http') ? card.image.src : absolute(card.image.src),
						width: card.image.width,
						height: card.image.height,
						alt: card.image.alt
					}
				: null
		},
		alternates.map((alternate) => ({
			locale: alternate.locale as Locale,
			href: absolute(alternate.href)
		})),
		homeLabel
	);

	return {
		seo,
		article: {
			...card,
			bodyHtml: row.body_html,
			toc: row.word_count >= TOC_MIN_WORDS ? row.toc : [],
			wordCount: row.word_count,
			metaTitle: row.meta_title,
			metaDesc: row.meta_desc,
			modifiedAt: row.modified_at ? new Date(row.modified_at).toISOString() : null,
			correction: row.correction,
			tags: row.tags
		},
		alternates,
		related: related.map(toCard)
	};
};
