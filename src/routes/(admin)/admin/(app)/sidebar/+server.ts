import { json, type RequestHandler } from '@sveltejs/kit';
import { SIDEBAR_COOKIE } from '$lib/server/admin-ui';

/**
 * Remembers whether the admin sidebar is collapsed.
 *
 * A cookie rather than localStorage so the server renders the right width on
 * the first paint. localStorage would mean rendering it open and snapping it
 * shut once the script runs — the same flash the theme script exists to avoid.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const { collapsed } = (await request.json()) as { collapsed?: unknown };

	cookies.set(SIDEBAR_COOKIE, collapsed ? '1' : '0', {
		path: '/admin',
		httpOnly: false,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 365
	});

	return json({ collapsed: Boolean(collapsed) });
};
