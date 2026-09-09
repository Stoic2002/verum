import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	activeCategories,
	articlesByCategory,
	countByCategory
} from '$lib/server/db/queries/public';
import { toCard } from '$lib/server/cards';
import type { PageServerLoad } from './$types';

const PER_PAGE = 12;

export const load: PageServerLoad = async ({ params, url, locals, setHeaders }) => {
	const locale = locals.locale;

	const categories = await activeCategories(db, locale);
	const category = categories.find((row) => row.slug === params.category);
	// Not a category. Static pages own their own routes, so anything reaching
	// here and not matching is genuinely missing.
	if (!category) error(404, 'Not found');

	const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
	const total = await countByCategory(db, locale, category.slug);
	const pages = Math.max(1, Math.ceil(total / PER_PAGE));
	if (page > pages && total > 0) error(404, 'Not found');

	setHeaders({ 'cache-control': 'public, max-age=0, s-maxage=60' });

	const rows = await articlesByCategory(db, locale, category.slug, {
		limit: PER_PAGE,
		offset: (page - 1) * PER_PAGE
	});

	return {
		category: {
			slug: category.slug,
			name: category.name ?? category.slug,
			description: category.description
		},
		articles: rows.map(toCard),
		page,
		pages,
		total
	};
};
