import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema';

/**
 * The one database type the whole app passes around.
 *
 * `PostgresJsDatabase` without its generic defaults to an empty schema, which
 * does not accept a schema-aware client — so every helper takes this alias
 * instead, and every `drizzle()` call is constructed with the schema.
 */
export type Database = PostgresJsDatabase<typeof schema>;
