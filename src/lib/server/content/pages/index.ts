import { env } from '$env/dynamic/public';
import type { Locale } from '../../db/schema';
import { AUTHOR_NAME } from '../../seo';
import { about } from './about';
import { contact } from './contact';
import { editorialPolicy } from './editorial-policy';
import { privacy } from './privacy';
import { terms } from './terms';

/**
 * Static pages, written as markdown and rendered through the same pipeline as
 * articles (PLAN-DEV §E.3: one renderer, one set of styling bugs).
 *
 * PRD §14 makes About, Contact, Privacy Policy, Terms and Editorial Policy
 * prerequisites for AdSense approval, and §13.1 notes that news sites are
 * reviewed more strictly than most. These are real drafts, not placeholders,
 * but the facts only the owner knows are substituted at render time.
 */

export type PageSlug = 'about' | 'contact' | 'editorial-policy' | 'privacy' | 'terms';

export type StaticPage = {
	title: string;
	description: string;
	markdown: string;
	/** Legal pages are not the place for ads. */
	ads?: boolean;
};

export type PageContext = {
	authorName: string;
	contactEmail: string;
	siteName: string;
	updated: string;
};

const BUILDERS: Record<PageSlug, (locale: Locale, ctx: PageContext) => StaticPage> = {
	about,
	contact,
	'editorial-policy': editorialPolicy,
	privacy,
	terms
};

export const PAGE_SLUGS = Object.keys(BUILDERS) as PageSlug[];

/**
 * The date shown on the legal pages.
 *
 * Read from an environment variable rather than generated: a "last updated"
 * that moves every deploy tells a reader nothing and quietly claims a review
 * that did not happen.
 */
function lastUpdated(): string {
	return env.PUBLIC_POLICY_UPDATED || '2026-09-10';
}

export function getStaticPage(slug: PageSlug, locale: Locale): StaticPage {
	return BUILDERS[slug](locale, {
		authorName: AUTHOR_NAME,
		// Deliberately visible when unset: a Contact page with no way to make
		// contact fails the AdSense prerequisite it exists to satisfy.
		contactEmail: env.PUBLIC_CONTACT_EMAIL || '(contact email not configured)',
		siteName: env.PUBLIC_SITE_NAME || 'VERUM',
		updated: lastUpdated()
	});
}

export function isPageSlug(value: string): value is PageSlug {
	return PAGE_SLUGS.includes(value as PageSlug);
}
