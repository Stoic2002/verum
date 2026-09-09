import { db } from '$lib/server/db';
import { activeCategories } from '$lib/server/db/queries/public';
import type { LayoutServerLoad } from './$types';

/**
 * Deliberately sets no cache-control.
 *
 * SvelteKit throws if two load functions set the same header, and caching
 * belongs to the page: an article is cacheable for a day, search for not at
 * all (PRD §10.3). A layout-level default would either be wrong for most pages
 * or collide with the page that sets the right one.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		locale: locals.locale,
		categories: await activeCategories(db, locals.locale)
	};
};
