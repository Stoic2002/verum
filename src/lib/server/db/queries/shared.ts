import { and, eq, isNotNull, lte, sql } from 'drizzle-orm';
import { articleLocales, articles } from '../schema';

/**
 * The single definition of "the public can see this".
 *
 * Scheduling is expressed here rather than in a job: a row goes live the moment
 * `published_at` passes, with no worker to run, fail, or forget. A cron only
 * ever purges CDN cache and regenerates the sitemap (PLAN-DEV §A.2 #5).
 */
export const isLive = and(
	eq(articles.status, 'published'),
	isNotNull(articleLocales.publishedAt),
	lte(articleLocales.publishedAt, sql`now()`)
);

export type Paging = { limit?: number; offset?: number };

export function paging({ limit = 20, offset = 0 }: Paging = {}) {
	return { limit: Math.min(Math.max(limit, 1), 100), offset: Math.max(offset, 0) };
}
