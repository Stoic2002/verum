import { relations } from 'drizzle-orm';
import { articleLocales, articleTags, articles, topicArticles } from './content';
import { media } from './media';
import { adminUsers, sessions } from './auth';
import { articleStats } from './site';
import { categories, categoryLocales, tags, topicLocales, topics } from './taxonomy';

export const articlesRelations = relations(articles, ({ one, many }) => ({
	category: one(categories, { fields: [articles.categoryId], references: [categories.id] }),
	coverMedia: one(media, { fields: [articles.coverMediaId], references: [media.id] }),
	locales: many(articleLocales),
	tags: many(articleTags),
	topics: many(topicArticles),
	stats: many(articleStats)
}));

export const articleLocalesRelations = relations(articleLocales, ({ one }) => ({
	article: one(articles, { fields: [articleLocales.articleId], references: [articles.id] })
}));

export const articleTagsRelations = relations(articleTags, ({ one }) => ({
	article: one(articles, { fields: [articleTags.articleId], references: [articles.id] }),
	tag: one(tags, { fields: [articleTags.tagId], references: [tags.id] })
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
	locales: many(categoryLocales),
	articles: many(articles)
}));

export const categoryLocalesRelations = relations(categoryLocales, ({ one }) => ({
	category: one(categories, { fields: [categoryLocales.categoryId], references: [categories.id] })
}));

export const tagsRelations = relations(tags, ({ many }) => ({
	articles: many(articleTags)
}));

export const topicsRelations = relations(topics, ({ many }) => ({
	locales: many(topicLocales),
	articles: many(topicArticles)
}));

export const topicLocalesRelations = relations(topicLocales, ({ one }) => ({
	topic: one(topics, { fields: [topicLocales.topicId], references: [topics.id] })
}));

export const topicArticlesRelations = relations(topicArticles, ({ one }) => ({
	topic: one(topics, { fields: [topicArticles.topicId], references: [topics.id] }),
	article: one(articles, { fields: [topicArticles.articleId], references: [articles.id] })
}));

export const articleStatsRelations = relations(articleStats, ({ one }) => ({
	article: one(articles, { fields: [articleStats.articleId], references: [articles.id] })
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(adminUsers, { fields: [sessions.userId], references: [adminUsers.id] })
}));
