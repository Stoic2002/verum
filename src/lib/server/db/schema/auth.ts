import { bigint, bigserial, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Single-user by design (PRD §8.2). No roles, no registration, no password
 * reset — the whole point of PRD §9 is that this surface does not exist.
 */
export const adminUsers = pgTable('admin_users', {
	id: bigserial('id', { mode: 'number' }).primaryKey(),
	email: text('email').notNull().unique(),
	/** argon2id */
	passwordHash: text('password_hash').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

/**
 * Server-side sessions. Not in PRD §11, but a cookie has to point at something.
 * `id` holds a hash of the cookie token, never the token itself: a database
 * dump then does not hand over live sessions.
 */
export const sessions = pgTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		userId: bigint('user_id', { mode: 'number' })
			.notNull()
			.references(() => adminUsers.id, { onDelete: 'cascade' }),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		userAgent: text('user_agent'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('sessions_expires_idx').on(t.expiresAt)]
);
