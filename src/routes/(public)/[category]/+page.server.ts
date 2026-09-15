import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	activeCategories,
	categoryArticles,
	categoryTags,
	countCategoryArticles,
	popularInCategory
} from '$lib/server/db/queries/public';
import { toCard } from '$lib/server/cards';
import { categorySeo } from '$lib/server/seo';
import * as urls from '$lib/urls';
import type { PageServerLoad } from './$types';

const PER_PAGE = 12;

export const load: PageServerLoad = async ({ params, url, locals, setHeaders }) => {
	const locale = locals.locale;

	const categories = await activeCategories(db, locale);
	const category = categories.find((row) => row.slug === params.category);
	// Not a category. Static pages own their own routes, so anything reaching
	// here and not matching is genuinely missing.
	if (!category) error(404, 'Not found');

	const tags = await categoryTags(db, locale, category.slug, 8);
	const requestedTag = url.searchParams.get('tag')?.trim() || null;
	// A filter for a tag this category does not use would be an empty page
	// with a plausible URL. Better to say it does not exist.
	if (requestedTag && !tags.some((tag) => tag.slug === requestedTag)) error(404, 'Not found');

	const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
	const total = await countCategoryArticles(db, locale, category.slug, requestedTag);
	const pages = Math.max(1, Math.ceil(total / PER_PAGE));
	if (page > pages && total > 0) error(404, 'Not found');

	setHeaders({ 'cache-control': 'public, max-age=0, s-maxage=60' });

	const [rows, popular] = await Promise.all([
		categoryArticles(db, locale, category.slug, {
			limit: PER_PAGE,
			offset: (page - 1) * PER_PAGE,
			tagSlug: requestedTag
		}),
		popularInCategory(db, locale, category.slug, { days: 30, limit: 5 })
	]);

	const homeLabel = locale === 'id' ? 'Beranda' : 'Home';
	const named = {
		slug: category.slug,
		name: category.name ?? category.slug,
		description: category.description
	};

	const seo = categorySeo({ requestUrl: url, locale }, named, homeLabel);

	return {
		// A filtered listing repeats what the category page already offers. It
		// keeps the category as canonical and stays out of the index.
		seo: requestedTag ? { ...seo, noindex: true, alternates: [] } : seo,
		category: named,
		tags: tags.map((tag) => ({ slug: tag.slug, name: tag.name })),
		activeTag: requestedTag,
		articles: rows.map(toCard),
		popular: popular.map((item) => ({
			id: item.article_id,
			title: item.title,
			href: urls.article(locale, item.category_slug, item.slug)
		})),
		page,
		pages,
		total
	};
};
