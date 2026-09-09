import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import type { PageServerLoad } from './$types';

/**
 * Dashboard counters. The article list, pageviews and scheduling view land in
 * Fase 3 and Fase 6; this is only enough to prove the session reaches the page.
 */
export const load: PageServerLoad = async () => {
	const rows = await db.execute<{ status: string; count: number }>(sql`
		SELECT status, count(*)::int AS count FROM articles GROUP BY status
	`);

	const counts = Object.fromEntries(Array.from(rows).map((r) => [r.status, Number(r.count)]));

	return {
		counts: {
			draft: counts.draft ?? 0,
			scheduled: counts.scheduled ?? 0,
			published: counts.published ?? 0,
			archived: counts.archived ?? 0
		}
	};
};
