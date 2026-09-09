import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Fase 0 smoke test: proves the locale reached request scope via locals.
	return { locale: locals.locale };
};
