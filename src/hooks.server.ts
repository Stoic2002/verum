import { dev } from '$app/environment';
import { sequence } from '@sveltejs/kit/hooks';
import { redirect, type Handle } from '@sveltejs/kit';
import { baseLocale, isLocale } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { db } from '$lib/server/db';
import {
	SESSION_COOKIE,
	clearSessionCookie,
	setSessionCookie,
	validateSession
} from '$lib/server/auth/session';

const LOGIN_PATH = '/admin/login';

/**
 * Paths served without a locale prefix. Keep in sync with `unlocalized()`
 * in vite.config.ts. Assets under static/ never reach this hook — the adapter
 * serves them before the SvelteKit handler runs.
 */
const UNLOCALIZED =
	/^\/(admin|api|preview|robots\.txt|ads\.txt|rss\.xml|sitemap.*\.xml|\.well-known)(\/|$)/;

/**
 * Canonicalise every public URL to a locale-prefixed one (PRD §12.1).
 *
 * Deliberately a pure path rewrite: no IP lookup, no Accept-Language sniffing.
 * PRD §10.4 — Googlebot crawls from the US, so bouncing visitors to a locale
 * based on where they are means the other locale never gets indexed. Locale
 * suggestion is a banner (Fase 5), never a redirect.
 */
const handleLocaleRedirect: Handle = async ({ event, resolve }) => {
	const { pathname, search } = event.url;
	const first = pathname.split('/')[1];

	if (!isLocale(first) && !UNLOCALIZED.test(pathname)) {
		// No trailing slash anywhere: SvelteKit's default `trailingSlash: 'never'`
		// would otherwise bounce /en/ to /en, making every root hit a two-hop
		// redirect chain. One canonical shape, one redirect.
		redirect(301, `/${baseLocale}${pathname === '/' ? '' : pathname}${search}`);
	}

	return resolve(event);
};

/**
 * Resolves the locale from the URL and hands it to the request.
 *
 * `event.locals.locale` is the only place request code may read the locale
 * from. Never a module-scope store: on the server a module is evaluated once
 * per process, so a store would leak one request's locale into another that is
 * parked on an `await` — and it would never reproduce in dev, where there is
 * only ever one request in flight (PRD §10.4).
 */
const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;
		event.locals.locale = locale;

		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
		});
	});

/**
 * Resolves the session cookie into `locals.user` for every request, public
 * pages included: the public layout needs to know whether to show an edit link,
 * and a single lookup here beats one per load function.
 */
const handleAuth: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	const result = token ? await validateSession(db, token) : null;

	event.locals.user = result?.user ?? null;
	event.locals.session = result?.session ?? null;

	if (token && !result) {
		// The cookie names a session that has expired or been revoked. Clearing it
		// stops every later request paying for the same failed lookup.
		clearSessionCookie(event.cookies, !dev);
	} else if (token && result) {
		// Mirror the sliding expiry that validateSession applied to the row.
		setSessionCookie(event.cookies, token, result.session.expiresAt, !dev);
	}

	return resolve(event);
};

/**
 * Guards /admin and keeps it out of every cache (PRD §10.3).
 *
 * The redirect carries `next` so that returning to a deep link after login
 * lands where the request was headed. Only same-site paths are accepted —
 * an open redirect here would be a phishing primitive.
 */
const handleAdmin: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	if (!pathname.startsWith('/admin')) return resolve(event);

	if (!event.locals.user && pathname !== LOGIN_PATH) {
		const next = pathname + event.url.search;
		redirect(303, `${LOGIN_PATH}?next=${encodeURIComponent(next)}`);
	}

	if (event.locals.user && pathname === LOGIN_PATH) {
		redirect(303, '/admin');
	}

	const response = await resolve(event);

	response.headers.set('cache-control', 'no-store, no-cache, must-revalidate');
	response.headers.set('x-robots-tag', 'noindex, nofollow');
	response.headers.set('referrer-policy', 'same-origin');
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('x-frame-options', 'DENY');

	return response;
};

export const handle: Handle = sequence(
	handleLocaleRedirect,
	handleParaglide,
	handleAuth,
	handleAdmin
);
