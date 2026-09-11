import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';
import type { Database } from './types';

/**
 * Connects to the throwaway test database, applies every migration from
 * scratch, and empties it.
 *
 * Running the real migrations — rather than pushing the schema — is the point:
 * it is the only way the trigger in 0001 is exercised before production sees it.
 */
export async function setupTestDatabase() {
	const url = process.env.DATABASE_URL_TEST;
	if (!url) throw new Error('DATABASE_URL_TEST is not set');
	if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
		throw new Error(
			'DATABASE_URL_TEST must point at a local database — this function truncates it'
		);
	}

	const client = postgres(url, { max: 1 });
	const db = drizzle(client, { schema });

	await migrate(db, { migrationsFolder: './drizzle' });
	await truncateAll(db);

	return { db, client };
}

/**
 * Empties every table but keeps the schema, triggers and sequences reset.
 *
 * `keepAiProviders` spares the AI writer's provider accounts and settings.
 * Tests want a clean slate; `db:demo` does not — reloading demo content must
 * not delete the API keys an editor typed in. (Jobs still go: they reference
 * articles, and TRUNCATE … CASCADE follows that reference.)
 */
export async function truncateAll(db: Database, options: { keepAiProviders?: boolean } = {}) {
	await db.execute(sql`
		TRUNCATE TABLE
			article_stats, article_tags, topic_articles, topic_locales, topics,
			article_locales, articles, category_locales, categories, tags,
			media, sessions, admin_users, newsletter_subscribers, redirects,
			ai_job_sources, ai_jobs
		RESTART IDENTITY CASCADE
	`);
	if (!options.keepAiProviders) {
		await db.execute(sql`TRUNCATE TABLE ai_credentials, ai_settings RESTART IDENTITY CASCADE`);
	}
}
