import { sql } from 'drizzle-orm';
import {
	bigint,
	bigserial,
	boolean,
	check,
	integer,
	pgTable,
	primaryKey,
	text
} from 'drizzle-orm/pg-core';
import { LOCALES } from './shared';

const localeCheck = sql`locale IN ('en', 'id')`;

/**
 * Categories are language-agnostic; their names live in category_locales.
 * `is_active` gates PRD §5.3: `ai` and `tech` at launch, the rest opened one at
 * a time once traffic is proven.
 */
export const categories = pgTable('categories', {
	id: bigserial('id', { mode: 'number' }).primaryKey(),
	slug: text('slug').notNull().unique(),
	isActive: boolean('is_active').notNull().default(true),
	sortOrder: integer('sort_order').notNull().default(0)
});

export const categoryLocales = pgTable(
	'category_locales',
	{
		categoryId: bigint('category_id', { mode: 'number' })
			.notNull()
			.references(() => categories.id, { onDelete: 'cascade' }),
		locale: text('locale', { enum: LOCALES }).notNull(),
		name: text('name').notNull(),
		/** Original prose, never boilerplate — this page has to rank on its own. */
		description: text('description')
	},
	(t) => [
		primaryKey({ columns: [t.categoryId, t.locale] }),
		check('category_locale_ck', localeCheck)
	]
);

/**
 * Tags carry a single name across locales: they are keywords (`llm`, `rag`),
 * not prose. A tag page with fewer than 3 articles is noindexed (PRD §8.1).
 */
export const tags = pgTable('tags', {
	id: bigserial('id', { mode: 'number' }).primaryKey(),
	slug: text('slug').notNull().unique(),
	name: text('name').notNull()
});

/**
 * Topic / dossier: a curated set of articles with an original introduction.
 * The article membership table lives in content.ts, next to `articles`.
 */
export const topics = pgTable('topics', {
	id: bigserial('id', { mode: 'number' }).primaryKey(),
	slug: text('slug').notNull().unique()
});

export const topicLocales = pgTable(
	'topic_locales',
	{
		topicId: bigint('topic_id', { mode: 'number' })
			.notNull()
			.references(() => topics.id, { onDelete: 'cascade' }),
		locale: text('locale', { enum: LOCALES }).notNull(),
		title: text('title').notNull(),
		introMd: text('intro_md').notNull(),
		introHtml: text('intro_html').notNull().default('')
	},
	(t) => [primaryKey({ columns: [t.topicId, t.locale] }), check('topic_locale_ck', localeCheck)]
);
