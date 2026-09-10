import { dev } from '$app/environment';
import { env as privateEnv } from '$env/dynamic/private';
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
import { findRedirect } from '$lib/server/redirects';
import { setEnvSource } from '$lib/server/env';

/*
 * Hand the app's environment to the modules that also have to work outside
 * SvelteKit. Done at module scope so it is in place before the first request:
 * `vite dev` loads .env for $env/dynamic/private but never copies it into
 * process.env, so without this a configured R2 bucket would be ignored in
 * development and only appear to work in production.
 */
setEnvSource(privateEnv);

const LOGIN_PATH = '/admin/login';

/**
 * Paths served without a locale prefix. Keep in sync with `unlocalized()`
 * in vite.config.ts. Assets under static/ never reach this hook — the adapter
 * serves them before the SvelteKit handler runs.
 */
const UNLOCALIZED =
	/^\/(admin|api|preview|media|robots\.txt|ads\.txt|rss\.xml|sitemap.*\.xml|\.well-known)(\/|$)/;

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

/**
 * Serves stored redirects, but only for paths that would otherwise 404.
 *
 * PRD §12.1 allows a slug to change and requires the old URL to keep working.
 * Checking the table before routing would add a database round trip to every
 * request to consult a table that is normally empty; checking it after a 404
 * costs nothing on the happy path and is just as correct.
 *
 * The stored path is matched without its query string, and the query is
 * carried across so a link with campaign parameters survives the move.
 */
const handleStoredRedirects: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	if (response.status !== 404) return response;

	const stored = await findRedirect(db, event.url.pathname);
	if (!stored) return response;

	const target = stored.to_path + (event.url.search || '');
	return new Response(null, {
		status: stored.status,
		headers: {
			location: target,
			// A permanent redirect is worth caching; a temporary one is not.
			'cache-control':
				stored.status === 301 || stored.status === 308
					? 'public, max-age=0, s-maxage=86400'
					: 'no-store'
		}
	});
};

export const handle: Handle = sequence(
	handleLocaleRedirect,
	handleParaglide,
	handleAuth,
	handleAdmin,
	handleStoredRedirects
);
