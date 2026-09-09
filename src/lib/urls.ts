/**
 * Public URL shapes, in one place.
 *
 * These are plain strings rather than SvelteKit `resolve()` calls: every public
 * path carries a locale prefix that the route tree does not contain, because
 * hooks.ts delocalises before matching. The shapes are asserted by urls.spec.ts
 * and by the e2e suite.
 */
import type { Locale } from './paraglide/runtime';

export const home = (locale: Locale) => `/${locale}`;
export const category = (locale: Locale, slug: string) => `/${locale}/${slug}`;
export const article = (locale: Locale, categorySlug: string, slug: string) =>
	`/${locale}/${categorySlug}/${slug}`;
export const tag = (locale: Locale, slug: string) => `/${locale}/tag/${slug}`;
export const topic = (locale: Locale, slug: string) => `/${locale}/topic/${slug}`;
export const search = (locale: Locale) => `/${locale}/search`;
export const page = (locale: Locale, slug: string) => `/${locale}/${slug}`;

/** Absolute URL for canonical, Open Graph and structured data. */
export function absolute(origin: string, path: string): string {
	return `${origin.replace(/\/+$/, '')}${path}`;
}

/** Adds ?page=N, and omits it for page 1 so the first page has one URL, not two. */
export function paged(path: string, pageNumber: number): string {
	return pageNumber <= 1 ? path : `${path}?page=${pageNumber}`;
}
