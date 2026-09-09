import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { articlesByTag, tagBySlug } from '$lib/server/db/queries/public';
import { toCard } from '$lib/server/cards';
import type { PageServerLoad } from './$types';

/** PRD §8.1: fewer than this and the page is thin, so it is kept out of the index. */
const NOINDEX_BELOW = 3;

export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
	const locale = locals.locale;

	const tag = await tagBySlug(db, params.slug);
	if (!tag) error(404, 'Not found');

	const rows = await articlesByTag(db, locale, tag.slug, { limit: 24 });
	if (rows.length === 0) error(404, 'Not found');

	const noindex = rows.length < NOINDEX_BELOW;

	setHeaders({
		'cache-control': 'public, max-age=0, s-maxage=60',
		// Belt and braces with the meta tag: a crawler that ignores one still
		// sees the other, and this page is a thin-content risk (PRD §12.7).
		...(noindex ? { 'x-robots-tag': 'noindex, follow' } : {})
	});

	return { tag, articles: rows.map(toCard), noindex };
};
