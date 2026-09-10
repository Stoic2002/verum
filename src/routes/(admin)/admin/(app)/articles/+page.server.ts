import { db } from '$lib/server/db';
import { listArticlesForAdmin } from '$lib/server/db/queries/admin';
import type { PageServerLoad } from './$types';

const PER_PAGE = 25;

export const load: PageServerLoad = async ({ url }) => {
	const status = url.searchParams.get('status') ?? '';
	const search = url.searchParams.get('q') ?? '';
	const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);

	const { items, total } = await listArticlesForAdmin(db, {
		status: status || undefined,
		search: search || undefined,
		limit: PER_PAGE,
		offset: (page - 1) * PER_PAGE
	});

	return {
		status,
		search,
		page,
		total,
		pages: Math.max(1, Math.ceil(total / PER_PAGE)),
		articles: items
	};
};
