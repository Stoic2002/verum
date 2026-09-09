import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { countSearchResults, searchArticles } from '$lib/server/db/queries/search';
import { activeCategories } from '$lib/server/db/queries/public';
import { searchByIp } from '$lib/server/rate-limit';
import type { PageServerLoad } from './$types';

const PER_PAGE = 10;
const MAX_QUERY = 120;

export const load: PageServerLoad = async ({ url, locals, getClientAddress, setHeaders }) => {
	const locale = locals.locale;

	// Search is the one page that must never be cached: results depend on the
	// query string and on what has published since (PRD §10.3).
	setHeaders({ 'cache-control': 'no-store' });

	const raw = (url.searchParams.get('q') ?? '').slice(0, MAX_QUERY);
	const category = url.searchParams.get('category') ?? '';
	const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);

	const categories = await activeCategories(db, locale);
	const base = { query: raw, category, categories, page };

	if (!raw.trim()) {
		return { ...base, results: [], total: 0, pages: 0, limited: false };
	}

	// Rate limited because every search is a full-text scan plus ts_headline on
	// each hit — the most expensive public request the site serves (PRD §15).
	const limit = searchByIp.check(getClientAddress());
	if (!limit.allowed) {
		error(429, `Too many searches. Try again in ${limit.retryAfter} seconds.`);
	}

	const options = { locale, category: category || undefined };
	const [results, total] = await Promise.all([
		searchArticles(db, raw, { ...options, limit: PER_PAGE, offset: (page - 1) * PER_PAGE }),
		countSearchResults(db, raw, options)
	]);

	return {
		...base,
		results,
		total,
		pages: Math.max(1, Math.ceil(total / PER_PAGE)),
		limited: false
	};
};
