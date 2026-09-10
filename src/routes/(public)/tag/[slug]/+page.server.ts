import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { articlesByTag, countByTag, tagBySlug } from '$lib/server/db/queries/public';
import { toCard } from '$lib/server/cards';
import { simpleSeo } from '$lib/server/seo';
import * as urls from '$lib/urls';
import type { PageServerLoad } from './$types';

/** PRD §8.1: fewer than this and the page is thin, so it is kept out of the index. */
const NOINDEX_BELOW = 3;
const PER_PAGE = 24;

export const load: PageServerLoad = async ({ params, url, locals, setHeaders }) => {
	const locale = locals.locale;

	const tag = await tagBySlug(db, params.slug);
	if (!tag) error(404, 'Not found');

	const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
	const total = await countByTag(db, locale, tag.slug);
	const pages = Math.max(1, Math.ceil(total / PER_PAGE));
	if (total === 0 || page > pages) error(404, 'Not found');

	const rows = await articlesByTag(db, locale, tag.slug, {
		limit: PER_PAGE,
		offset: (page - 1) * PER_PAGE
	});

	// Judged on the whole tag, not on the page being shown: page two of a
	// large tag is not thin content just because it holds fewer cards.
	const noindex = total < NOINDEX_BELOW;

	setHeaders({
		'cache-control': 'public, max-age=0, s-maxage=60',
		// Belt and braces with the meta tag: a crawler that ignores one still
		// sees the other, and this page is a thin-content risk (PRD §12.7).
		...(noindex ? { 'x-robots-tag': 'noindex, follow' } : {})
	});

	const seo = simpleSeo(
		{ requestUrl: url, locale },
		{
			title: locale === 'id' ? `Artikel bertag ${tag.name}` : `Articles tagged ${tag.name}`,
			description:
				locale === 'id'
					? `Semua artikel VERUM yang ditandai ${tag.name}.`
					: `Every VERUM article tagged ${tag.name}.`,
			path: urls.tag(locale, tag.slug),
			altPath: (l) => urls.tag(l, tag.slug),
			noindex
		}
	);

	return { seo, tag, articles: rows.map(toCard), noindex, page, pages, total };
};
