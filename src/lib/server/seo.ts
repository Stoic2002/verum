import { clamp, DESCRIPTION_MAX, TITLE_MAX, type Alternate, type SeoData } from '$lib/seo';
import * as urls from '$lib/urls';
import type { Locale } from '$lib/paraglide/runtime';
import { article, breadcrumbs, graph, organization, website, type Publisher } from './jsonld';
import { siteName, siteOrigin } from './site';
import { LOCALES } from './db/schema';

export { graph };

/**
 * Byline identity (PRD §6.2).
 *
 * A consistent pseudonym is an E-E-A-T signal; changing it costs whatever
 * authority the name has accumulated. It lives here so there is one place to
 * change it, and only once.
 */
export const AUTHOR_NAME = 'Arul';

export function publisherFor(requestUrl: URL): Publisher {
	const url = siteOrigin(requestUrl);
	return { name: siteName(), url };
}

/** Title is suffixed, then clamped — so the site name never pushes it over. */
function pageTitle(title: string, name: string): string {
	const suffixed = `${title} — ${name}`;
	return suffixed.length <= TITLE_MAX ? suffixed : clamp(title, TITLE_MAX);
}

type Common = { requestUrl: URL; locale: Locale };

/**
 * Alternates for a page that exists identically in every locale — the
 * homepage, category and search pages, whose paths are locale-independent.
 *
 * Article pages do not use this: their slugs differ per locale and a version
 * may not exist at all (PRD §7), so they pass their real alternates.
 */
function mirrorAlternates(origin: string, path: (locale: Locale) => string): Alternate[] {
	return LOCALES.map((locale) => ({ locale, href: `${origin}${path(locale)}` }));
}

export function homeSeo({ requestUrl, locale }: Common, description: string): SeoData {
	const publisher = publisherFor(requestUrl);
	const canonical = `${publisher.url}${urls.home(locale)}`;

	return {
		title: `${publisher.name} — ${clamp(description, TITLE_MAX - publisher.name.length - 3)}`,
		description: clamp(description, DESCRIPTION_MAX),
		canonical,
		alternates: mirrorAlternates(publisher.url, urls.home),
		type: 'website',
		jsonLd: [organization(publisher), website(publisher, locale)]
	};
}

export function categorySeo(
	{ requestUrl, locale }: Common,
	category: { slug: string; name: string; description: string | null },
	homeLabel: string
): SeoData {
	const publisher = publisherFor(requestUrl);
	const canonical = `${publisher.url}${urls.category(locale, category.slug)}`;

	return {
		title: pageTitle(category.name, publisher.name),
		description: clamp(
			category.description || `${category.name} on ${publisher.name}.`,
			DESCRIPTION_MAX
		),
		canonical,
		alternates: mirrorAlternates(publisher.url, (l) => urls.category(l, category.slug)),
		type: 'website',
		jsonLd: [
			breadcrumbs([
				{ name: homeLabel, url: `${publisher.url}${urls.home(locale)}` },
				{ name: category.name, url: canonical }
			])
		]
	};
}

export type ArticleSeoInput = {
	title: string;
	excerpt: string;
	metaTitle: string | null;
	metaDesc: string | null;
	slug: string;
	categorySlug: string;
	categoryName: string | null;
	publishedAt: string;
	modifiedAt: string | null;
	wordCount: number;
	tags: { slug: string; name: string }[];
	image: { url: string; width: number; height: number; alt: string } | null;
};

export function articleSeo(
	{ requestUrl, locale }: Common,
	data: ArticleSeoInput,
	alternates: Alternate[],
	homeLabel: string
): SeoData {
	const publisher = publisherFor(requestUrl);
	const canonical = `${publisher.url}${urls.article(locale, data.categorySlug, data.slug)}`;
	const categoryName = data.categoryName ?? data.categorySlug;

	// The author's own meta wins; the article's title and excerpt are the
	// fallback, so a page is never left without either.
	const title = clamp(data.metaTitle || data.title, TITLE_MAX);
	const description = clamp(data.metaDesc || data.excerpt, DESCRIPTION_MAX);

	return {
		title,
		description,
		canonical,
		alternates: [{ locale, href: canonical }, ...alternates],
		type: 'article',
		image: data.image,
		publishedAt: data.publishedAt,
		modifiedAt: data.modifiedAt,
		jsonLd: [
			article(
				{
					headline: data.title,
					description,
					url: canonical,
					locale,
					publishedAt: data.publishedAt,
					modifiedAt: data.modifiedAt,
					authorName: AUTHOR_NAME,
					image: data.image?.url ?? null,
					wordCount: data.wordCount,
					section: categoryName,
					keywords: data.tags.map((tag) => tag.name)
				},
				publisher
			),
			breadcrumbs([
				{ name: homeLabel, url: `${publisher.url}${urls.home(locale)}` },
				{ name: categoryName, url: `${publisher.url}${urls.category(locale, data.categorySlug)}` },
				{ name: data.title, url: canonical }
			]),
			organization(publisher)
		]
	};
}

/**
 * Tag, topic, search and static pages.
 *
 * `path` already carries this locale's prefix, so an alternate has to be built
 * per locale — reusing `path` for every hreflang would announce two languages
 * at one URL, which is the most common way to get a cluster rejected.
 */
export function simpleSeo(
	{ requestUrl }: Common,
	options: {
		title: string;
		description: string;
		path: string;
		/** Omit when the page exists in one locale only. */
		altPath?: (locale: Locale) => string;
		noindex?: boolean;
	}
): SeoData {
	const publisher = publisherFor(requestUrl);

	return {
		title: pageTitle(options.title, publisher.name),
		description: clamp(options.description, DESCRIPTION_MAX),
		canonical: `${publisher.url}${options.path}`,
		alternates:
			options.noindex || !options.altPath ? [] : mirrorAlternates(publisher.url, options.altPath),
		type: 'website',
		noindex: options.noindex,
		jsonLd: []
	};
}

export { clamp, urls };
export type { Alternate, SeoData };
export { LOCALES };
export type { Locale };
