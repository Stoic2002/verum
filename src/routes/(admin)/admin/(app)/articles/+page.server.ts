import { db } from '$lib/server/db';
import { listArticlesForAdmin } from '$lib/server/db/queries/admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const status = url.searchParams.get('status') ?? '';
	const search = url.searchParams.get('q') ?? '';

	return {
		status,
		search,
		articles: await listArticlesForAdmin(db, {
			status: status || undefined,
			search: search || undefined
		})
	};
};
