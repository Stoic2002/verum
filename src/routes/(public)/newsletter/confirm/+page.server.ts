import { db } from '$lib/server/db';
import { confirm } from '$lib/server/newsletter';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });

	const result = await confirm(db, url.searchParams.get('token') ?? '');
	return { result };
};
