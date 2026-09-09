import { dev } from '$app/environment';
import { redirect, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { SESSION_COOKIE, clearSessionCookie, invalidateSession } from '$lib/server/auth/session';

/**
 * POST only. A GET logout can be triggered by any image tag or prefetch on any
 * page, which makes signing the editor out a one-line prank.
 */
export const POST: RequestHandler = async ({ cookies }) => {
	const token = cookies.get(SESSION_COOKIE);
	if (token) await invalidateSession(db, token);

	clearSessionCookie(cookies, !dev);
	redirect(303, '/admin/login');
};
