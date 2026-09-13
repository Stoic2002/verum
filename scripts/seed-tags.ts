/**
 * Loads the starter tags from src/lib/server/db/tag-list.ts.
 *
 * Safe on production and safe to repeat:
 *   - a new slug is inserted;
 *   - an existing slug keeps the name the editor gave it, except when the two
 *     differ only in capitals ("Chatgpt" becomes "ChatGPT");
 *   - nothing is ever deleted.
 *
 *   cd /srv/verum/app && sudo -u verum -H bun run db:seed-tags
 */
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { resolveTags } from '../src/lib/server/db/tag-list';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const rows = resolveTags();
const client = postgres(url, { max: 1 });
const db = drizzle(client);

try {
	const changed = await db.execute<{ slug: string; name: string; inserted: boolean }>(sql`
		INSERT INTO tags (slug, name)
		SELECT slug, name FROM json_to_recordset(${JSON.stringify(rows)}::json) AS t(slug text, name text)
		ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
			WHERE lower(tags.name) = lower(EXCLUDED.name) AND tags.name <> EXCLUDED.name
		RETURNING slug, name, (xmax = 0) AS inserted
	`);

	const list = Array.from(changed);
	const added = list.filter((row) => row.inserted);
	const renamed = list.filter((row) => !row.inserted);

	console.log(`${rows.length} tags in the list`);
	console.log(`  added:     ${added.length}`);
	console.log(
		`  recased:   ${renamed.length}${renamed.length ? ` (${renamed.map((r) => r.name).join(', ')})` : ''}`
	);
	console.log(`  unchanged: ${rows.length - list.length}`);
} finally {
	await client.end();
}
