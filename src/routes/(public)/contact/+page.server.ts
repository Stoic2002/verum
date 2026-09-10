import { loadStaticPage, STATIC_PAGE_CACHE } from '$lib/server/content/pages/load';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals, setHeaders }) => {
	setHeaders({ 'cache-control': STATIC_PAGE_CACHE });
	return loadStaticPage('contact', { url, locale: locals.locale });
};
