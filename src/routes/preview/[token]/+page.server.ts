import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { articleLocales, articles, categories } from '$lib/server/db/schema';
import { verifyPreviewToken } from '$lib/server/content/preview-token';
import type { PageServerLoad } from './$types';

/**
 * Renders a draft for someone without a login, using a signed link.
 *
 * Unlike /admin this is reachable by anyone holding the token, so it is
 * `noindex` and `no-store` — an indexed draft is worse than no preview at all.
 */
export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const claim = verifyPreviewToken(params.token);
	// One message for a forged signature and an expired link alike: the
	// difference is not something a holder of a bad token needs to learn.
	if (!claim) error(404, 'This preview link is invalid or has expired.');

	const [row] = await db
		.select({
			title: articleLocales.title,
			excerpt: articleLocales.excerpt,
			bodyHtml: articleLocales.bodyHtml,
			toc: articleLocales.toc,
			readingMinutes: articleLocales.readingMinutes,
			correction: articleLocales.correction,
			slug: articleLocales.slug,
			status: articles.status,
			categorySlug: categories.slug
		})
		.from(articleLocales)
		.innerJoin(articles, eq(articles.id, articleLocales.articleId))
		.innerJoin(categories, eq(categories.id, articles.categoryId))
		.where(
			and(eq(articleLocales.articleId, claim.articleId), eq(articleLocales.locale, claim.locale))
		)
		.limit(1);

	if (!row) error(404, 'Not found');

	setHeaders({
		'cache-control': 'no-store',
		'x-robots-tag': 'noindex, nofollow, noarchive'
	});

	return { article: row, locale: claim.locale, expiresAt: claim.expiresAt.toISOString() };
};
