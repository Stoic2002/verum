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
	/^\/(admin|api|preview|media|robots\.txt|ads\.txt|sitemap.*\.xml|\.well-known)(\/|$)/;

/** Set by the language switch; an explicit choice beats every guess. */
export const LOCALE_COOKIE = 'verum-locale';

/**
 * Picks the language for a visit to the bare domain.
 *
 * Only `/` is ever chosen this way — it is the x-default entry point, not a
 * page with content of its own. Every locale-prefixed URL is served exactly as
 * requested. Google advises against redirecting between language versions
 * because Googlebot crawls from the US without Accept-Language: it lands on
 * /en from here, and reaches /id through hreflang and links, so both stay
 * indexed.
 *
 * Order: the reader's saved choice, then the country Cloudflare resolved from
 * the connection (the origin only accepts Cloudflare, so the header cannot
 * come from anyone else), then the browser's language.
 */
export function rootLocale(request: Request, cookie: string | undefined): string {
	if (cookie && isLocale(cookie)) return cookie;
	if (request.headers.get('cf-ipcountry')?.toUpperCase() === 'ID') return 'id';

	const preferred = request.headers.get('accept-language')?.split(',')[0]?.trim().toLowerCase();
	if (preferred?.startsWith('id') || preferred?.startsWith('in')) return 'id';

	return baseLocale;
}

/**
 * Canonicalise every public URL to a locale-prefixed one (PRD §12.1).
 *
 * The bare domain picks a language per visitor (see rootLocale) with a
 * temporary, uncacheable redirect: a 301, or a copy cached at the edge, would
 * hand one visitor's language to everyone. Any other unprefixed path is a
 * permanent move to the base locale, as before.
 */
const handleLocaleRedirect: Handle = async ({ event, resolve }) => {
	const { pathname, search } = event.url;
	const first = pathname.split('/')[1];

	if (pathname === '/') {
		const locale = rootLocale(event.request, event.cookies.get(LOCALE_COOKIE));
		return new Response(null, {
			status: 302,
			headers: {
				location: `/${locale}${search}`,
				'cache-control': 'private, no-store',
				vary: 'Accept-Language, Cookie'
			}
		});
	}

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
