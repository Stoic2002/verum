import { customType } from 'drizzle-orm/pg-core';

/** Locales the site can serve. Adding one is a migration, not a config change. */
export const LOCALES = ['en', 'id'] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * Postgres text search configuration per locale.
 *
 * Both ship with Postgres 16. `indonesian` is a Snowball stemmer
 * (perbandingan → banding); it carries no stopword list, which only means a
 * slightly larger index — ranking still handles common words.
 */
export const TS_CONFIG: Record<Locale, string> = {
	en: 'english',
	id: 'indonesian'
};

/** draft → scheduled → published → archived (PRD §8.2) */
export const ARTICLE_STATUSES = ['draft', 'scheduled', 'published', 'archived'] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const SUBSCRIBER_STATUSES = ['pending', 'confirmed', 'unsubscribed'] as const;
export type SubscriberStatus = (typeof SUBSCRIBER_STATUSES)[number];

/** Drizzle has no tsvector column type; the trigger owns the value. */
export const tsvector = customType<{ data: string; driverData: string }>({
	dataType() {
		return 'tsvector';
	}
});

/** A heading extracted at save time, used to render the table of contents. */
export type TocEntry = { id: string; text: string; level: number };
