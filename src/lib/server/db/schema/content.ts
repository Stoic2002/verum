import { sql } from 'drizzle-orm';
import {
	bigint,
	bigserial,
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { media } from './media';
import { categories, tags, topics } from './taxonomy';
import { ARTICLE_STATUSES, LOCALES, tsvector, type TocEntry } from './shared';

/**
 * The article as an entity: language-agnostic. Everything a reader sees lives
 * in `article_locales`.
 *
 * PRD §11 — splitting these two tables is what makes the asymmetric locale
 * model possible. Columns like `title_en` / `title_id` in one table become
 * expensive the moment a third language appears.
 */
export const articles = pgTable(
	'articles',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		categoryId: bigint('category_id', { mode: 'number' })
			.notNull()
			.references(() => categories.id),
		status: text('status', { enum: ARTICLE_STATUSES }).notNull().default('draft'),
		/** Updated in place rather than replaced by a new post (PRD §12.4). */
		isLiving: boolean('is_living').notNull().default(false),
		coverMediaId: bigint('cover_media_id', { mode: 'number' }).references(() => media.id, {
			onDelete: 'set null'
		}),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date())
	},
	(t) => [
		check('articles_status_ck', sql`status IN ('draft', 'scheduled', 'published', 'archived')`),
		index('articles_status_idx').on(t.status),
		index('articles_category_idx').on(t.categoryId)
	]
);

/**
 * Per-language content. Asymmetric on purpose: an article may exist only in
 * `en`, and the `id` version is a rewrite, never a machine translation
 * (PRD §7 — bulk translation is what Google's scaled content abuse policy
 * targets by name).
 */
export const articleLocales = pgTable(
	'article_locales',
	{
		articleId: bigint('article_id', { mode: 'number' })
			.notNull()
			.references(() => articles.id, { onDelete: 'cascade' }),
		locale: text('locale', { enum: LOCALES }).notNull(),
		slug: text('slug').notNull(),
		title: text('title').notNull(),
		excerpt: text('excerpt').notNull(),

		/** Source of truth, authored in the admin editor. */
		bodyMd: text('body_md').notNull(),
		/**
		 * Rendered once on save, not per request. MDsveX cannot do this — it is a
		 * compile-time preprocessor for files in the repo, and this body lives in
		 * the database. The runtime pipeline is remark/rehype (PLAN-DEV §A.2 #1).
		 */
		bodyHtml: text('body_html').notNull().default(''),
		/**
		 * Plain prose extracted during that same render — no markup, no URLs, no
		 * code blocks. This is what full-text search indexes: feeding it raw
		 * markdown would index '##', link targets and code as searchable words.
		 * Empty until Fase 3 fills it; the trigger falls back to body_md.
		 */
		bodyText: text('body_text').notNull().default(''),
		/** Headings extracted during that same render, for the TOC (PRD §8.1). */
		toc: jsonb('toc').$type<TocEntry[]>().notNull().default([]),
		readingMinutes: integer('reading_minutes').notNull().default(0),
		wordCount: integer('word_count').notNull().default(0),

		metaTitle: text('meta_title'),
		metaDesc: text('meta_desc'),

		/**
		 * Publication is query-driven: a row counts as live when status is
		 * 'published' and published_at has passed. Scheduling therefore needs no
		 * job runner to be correct (PLAN-DEV §A.2 #5).
		 */
		publishedAt: timestamp('published_at', { withTimezone: true }),
		/** Feeds `dateModified`; bumped by a correction or a living-article update. */
		modifiedAt: timestamp('modified_at', { withTimezone: true }),
		/** Correction note appended to the article, dated (PRD §6.4). */
		correction: text('correction'),

		/** Maintained by the article_locales_search_vector trigger. */
		searchVector: tsvector('search_vector')
	},
	(t) => [
		primaryKey({ columns: [t.articleId, t.locale] }),
		check('article_locale_ck', sql`locale IN ('en', 'id')`),
		uniqueIndex('article_locales_slug_idx').on(t.locale, t.slug),
		index('article_locales_published_idx').on(t.locale, t.publishedAt.desc())
	]
);

export const articleTags = pgTable(
	'article_tags',
	{
		articleId: bigint('article_id', { mode: 'number' })
			.notNull()
			.references(() => articles.id, { onDelete: 'cascade' }),
		tagId: bigint('tag_id', { mode: 'number' })
			.notNull()
			.references(() => tags.id, { onDelete: 'cascade' })
	},
	(t) => [
		primaryKey({ columns: [t.articleId, t.tagId] }),
		index('article_tags_tag_idx').on(t.tagId)
	]
);

export const topicArticles = pgTable(
	'topic_articles',
	{
		topicId: bigint('topic_id', { mode: 'number' })
			.notNull()
			.references(() => topics.id, { onDelete: 'cascade' }),
		articleId: bigint('article_id', { mode: 'number' })
			.notNull()
			.references(() => articles.id, { onDelete: 'cascade' }),
		sortOrder: integer('sort_order').notNull().default(0)
	},
	(t) => [
		primaryKey({ columns: [t.topicId, t.articleId] }),
		index('topic_articles_article_idx').on(t.articleId)
	]
);
