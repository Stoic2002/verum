import { sql } from 'drizzle-orm';
import {
	bigint,
	bigserial,
	check,
	date,
	index,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp
} from 'drizzle-orm/pg-core';
import { articles } from './content';
import { LOCALES, SUBSCRIBER_STATUSES } from './shared';

/**
 * Slug changes are allowed, losing the old URL is not (PRD §12.1).
 * Served by a middleware in Fase 7.
 */
export const redirects = pgTable(
	'redirects',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		fromPath: text('from_path').notNull().unique(),
		toPath: text('to_path').notNull(),
		status: integer('status').notNull().default(301),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	() => [check('redirects_status_ck', sql`status IN (301, 302, 308)`)]
);

/**
 * Double opt-in buffer (PRD §8.1). Kept locally even though delivery is handled
 * by an external provider: the email list is the one channel Google cannot take
 * away (PRD §13.3), so the addresses must not live only in someone else's
 * account.
 */
export const newsletterSubscribers = pgTable(
	'newsletter_subscribers',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		email: text('email').notNull().unique(),
		locale: text('locale', { enum: LOCALES }).notNull().default('en'),
		status: text('status', { enum: SUBSCRIBER_STATUSES }).notNull().default('pending'),
		/** Hash of the emailed token, not the token itself. */
		confirmTokenHash: text('confirm_token_hash'),
		confirmSentAt: timestamp('confirm_sent_at', { withTimezone: true }),
		confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
		unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		check('subscriber_status_ck', sql`status IN ('pending', 'confirmed', 'unsubscribed')`),
		index('newsletter_status_idx').on(t.status)
	]
);

/**
 * Daily pageview counter per article and locale, for the admin dashboard
 * (PRD §8.2).
 *
 * Deliberately first-party rather than read back from an analytics provider:
 * it survives a switch between GA4 and anything else, needs no API credentials
 * or OAuth, and — since it is aggregate counts with no identifiers — collects
 * nothing that a consent banner would have to gate.
 */
export const articleStats = pgTable(
	'article_stats',
	{
		articleId: bigint('article_id', { mode: 'number' })
			.notNull()
			.references(() => articles.id, { onDelete: 'cascade' }),
		locale: text('locale', { enum: LOCALES }).notNull(),
		day: date('day').notNull(),
		views: integer('views').notNull().default(0)
	},
	(t) => [
		primaryKey({ columns: [t.articleId, t.locale, t.day] }),
		check('article_stats_locale_ck', sql`locale IN ('en', 'id')`),
		index('article_stats_day_idx').on(t.day)
	]
);
