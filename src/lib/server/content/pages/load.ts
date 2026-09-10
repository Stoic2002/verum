import { simpleSeo } from '../../seo';
import { renderMarkdown } from '../render';
import { getStaticPage, type PageSlug } from './index';
import type { Locale } from '../../db/schema';

/**
 * Shared loader for the five static pages.
 *
 * Each route is a two-line file calling this, which keeps the copy in one
 * module and the routing in another.
 */
export async function loadStaticPage(
	slug: PageSlug,
	{ url, locale }: { url: URL; locale: Locale }
) {
	const page = getStaticPage(slug, locale);
	const rendered = await renderMarkdown(page.markdown);

	return {
		slug,
		title: page.title,
		html: rendered.html,
		seo: simpleSeo(
			{ requestUrl: url, locale },
			{
				title: page.title,
				description: page.description,
				path: `/${locale}/${slug}`,
				altPath: (l) => `/${l}/${slug}`
			}
		)
	};
}

/**
 * Long TTL: these change a few times a year, and a publish does not touch
 * them. An edit ships with a deploy, which is when they get purged.
 */
export const STATIC_PAGE_CACHE = 'public, max-age=0, s-maxage=86400';
