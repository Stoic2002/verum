import { db } from '$lib/server/db';
import {
	activeCategories,
	articlesByCategory,
	recentArticles
} from '$lib/server/db/queries/public';
import { toCard } from '$lib/server/cards';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	const locale = locals.locale;

	// Short edge TTL: the homepage changes whenever anything publishes, and 60
	// seconds of staleness is invisible while still absorbing a traffic spike
	// (PRD §10.3).
	setHeaders({ 'cache-control': 'public, max-age=0, s-maxage=60' });

	const latest = await recentArticles(db, locale, { limit: 13 });
	const [featured, ...rest] = latest;

	const categories = await activeCategories(db, locale);
	const blocks = await Promise.all(
		categories
			.filter((category) => category.article_count > 0)
			.map(async (category) => ({
				slug: category.slug,
				name: category.name ?? category.slug,
				description: category.description,
				articles: (await articlesByCategory(db, locale, category.slug, { limit: 4 })).map(toCard)
			}))
	);

	return {
		featured: featured ? toCard(featured) : null,
		latest: rest.map(toCard),
		blocks
	};
};
