import { db } from '$lib/server/db';
import { activeCategories, popularTopics, trendingArticles } from '$lib/server/db/queries/public';
import * as urls from '$lib/urls';
import type { ArticleLink } from '$lib/links';
import type { LayoutServerLoad } from './$types';

/**
 * Deliberately sets no cache-control.
 *
 * SvelteKit throws if two load functions set the same header, and caching
 * belongs to the page: an article is cacheable for a day, search for not at
 * all (PRD §10.3). A layout-level default would either be wrong for most pages
 * or collide with the page that sets the right one.
 *
 * Trending and topics ride along on every page because the header, the side
 * columns and the footer all show them. Kept to titles and links, not cards,
 * so they add little to each page's payload.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const locale = locals.locale;

	const [categories, trending, topics] = await Promise.all([
		activeCategories(db, locale),
		trendingArticles(db, locale, { days: 7, limit: 6 }),
		popularTopics(db, locale, 8)
	]);

	return {
		locale,
		categories,
		trending: trending.map((row): ArticleLink => ({
			id: Number(row.article_id),
			title: row.title,
			href: urls.article(locale, row.category_slug, row.slug),
			label: row.category_name ?? row.category_slug
		})),
		topics: topics.map((topic) => ({ slug: topic.slug, title: topic.title }))
	};
};
