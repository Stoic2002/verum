import { sql } from 'drizzle-orm';
import type { Database } from './db/types';

/**
 * Looks up a stored redirect for a path (PRD §12.1).
 *
 * Called only after the router has already produced a 404, so a normal request
 * never pays for this query. Putting it in front of every request would add a
 * database round trip to every page view to serve a table that is usually
 * empty.
 */
export async function findRedirect(db: Database, path: string) {
	const [row] = await db.execute<{ to_path: string; status: number }>(sql`
		SELECT to_path, status FROM redirects WHERE from_path = ${path} LIMIT 1
	`);

	return row ?? null;
}
