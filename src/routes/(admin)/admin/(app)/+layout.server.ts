import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/**
 * hooks.server.ts already blocks unauthenticated requests to /admin. This is
 * the second lock: if that guard is ever narrowed by a routing change, these
 * pages still refuse to render rather than leaking content.
 */
export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.user) redirect(303, '/admin/login');
	return { user: locals.user };
};
