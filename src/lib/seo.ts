import type { Locale } from './paraglide/runtime';

/**
 * Everything a page needs to describe itself to a crawler.
 *
 * Assembled on the server and rendered by Seo.svelte, so the rules in
 * PRD §12.2 live in one place instead of being retyped per route.
 */

export type Alternate = { locale: Locale; href: string };

export type JsonLd = Record<string, unknown>;

export type SeoData = {
	title: string;
	description: string;
	/** Absolute, and pointing at this locale's own URL — never at the `en` one. */
	canonical: string;
	alternates: Alternate[];
	/** 'article' switches Open Graph to article semantics. */
	type?: 'website' | 'article';
	image?: { url: string; width: number; height: number; alt: string } | null;
	publishedAt?: string | null;
	modifiedAt?: string | null;
	/** Kept out of the index: search results, previews, thin tag pages. */
	noindex?: boolean;
	jsonLd?: JsonLd[];
};

/** PRD §12.2 caps. Truncating on a word boundary beats a hard cut mid-word. */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

export function clamp(value: string, max: number): string {
	const text = value.trim().replace(/\s+/g, ' ');
	if (text.length <= max) return text;

	const cut = text.slice(0, max - 1);
	const lastSpace = cut.lastIndexOf(' ');
	return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * hreflang, including the self-reference and x-default.
 *
 * Google requires a cluster to be symmetric and to include a link to itself;
 * a cluster that names a locale the page does not actually have is worse than
 * no annotation. x-default points at `en` because that is the site's base
 * locale (PRD §12.2).
 */
export function hreflangLinks(
	canonical: string,
	alternates: Alternate[],
	locale: Locale
): { hreflang: string; href: string }[] {
	const links: { hreflang: string; href: string }[] = [{ hreflang: locale, href: canonical }];

	for (const alternate of alternates) {
		if (alternate.locale !== locale) {
			links.push({ hreflang: alternate.locale, href: alternate.href });
		}
	}

	const english = links.find((link) => link.hreflang === 'en');
	if (english) links.push({ hreflang: 'x-default', href: english.href });

	return links;
}
