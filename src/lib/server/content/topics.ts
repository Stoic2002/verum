import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../db/types';
import { topicArticles, topicLocales, topics, type Locale } from '../db/schema';
import { renderMarkdown } from './render';

/** Topics reuse the article render pipeline, so their intro behaves identically. */
export async function saveTopicLocale(
	db: Database,
	topicId: number,
	locale: Locale,
	content: { title: string; introMd: string }
) {
	const rendered = await renderMarkdown(content.introMd);

	await db
		.insert(topicLocales)
		.values({
			topicId,
			locale,
			title: content.title,
			introMd: content.introMd,
			introHtml: rendered.html
		})
		.onConflictDoUpdate({
			target: [topicLocales.topicId, topicLocales.locale],
			set: { title: content.title, introMd: content.introMd, introHtml: rendered.html }
		});
}

export async function createTopic(db: Database, slug: string) {
	const [topic] = await db.insert(topics).values({ slug }).returning({ id: topics.id });
	return topic.id;
}

export async function setTopicArticles(db: Database, topicId: number, articleIds: number[]) {
	await db.transaction(async (tx) => {
		await tx.delete(topicArticles).where(eq(topicArticles.topicId, topicId));
		if (articleIds.length) {
			await tx
				.insert(topicArticles)
				.values(articleIds.map((articleId, index) => ({ topicId, articleId, sortOrder: index })))
				.onConflictDoNothing();
		}
	});
}

export async function listTopicsForAdmin(db: Database) {
	const rows = await db.execute<{
		id: number;
		slug: string;
		titles: Record<string, string>;
		article_count: number;
	}>(sql`
		SELECT t.id, t.slug,
			coalesce(json_object_agg(tl.locale, tl.title) FILTER (WHERE tl.locale IS NOT NULL), '{}') AS titles,
			(SELECT count(*)::int FROM topic_articles ta WHERE ta.topic_id = t.id) AS article_count
		FROM topics t
		LEFT JOIN topic_locales tl ON tl.topic_id = t.id
		GROUP BY t.id
		ORDER BY t.slug
	`);
	return Array.from(rows);
}

export async function getTopicForAdmin(db: Database, id: number) {
	const [topic] = await db.select().from(topics).where(eq(topics.id, id)).limit(1);
	if (!topic) return null;

	const locales = await db.select().from(topicLocales).where(eq(topicLocales.topicId, id));
	const members = await db
		.select({ articleId: topicArticles.articleId })
		.from(topicArticles)
		.where(eq(topicArticles.topicId, id))
		.orderBy(topicArticles.sortOrder);

	return { ...topic, locales, articleIds: members.map((m) => Number(m.articleId)) };
}

export async function getTopicLocale(db: Database, topicId: number, locale: Locale) {
	const [row] = await db
		.select()
		.from(topicLocales)
		.where(and(eq(topicLocales.topicId, topicId), eq(topicLocales.locale, locale)))
		.limit(1);
	return row ?? null;
}
