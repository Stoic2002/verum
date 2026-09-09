import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { confirmedCount } from '$lib/server/newsletter';
import { getMailer } from '$lib/server/mail';
import { getStorage } from '$lib/server/media';
import type { PageServerLoad } from './$types';

/**
 * The weekly numbers, in one place.
 *
 * PRD §3 names what is watched: organic sessions, indexed pages, articles
 * moving up or down, subscribers, RPM. Only the parts this database knows are
 * here; the rest come from Search Console, which is not something to mirror.
 */
export const load: PageServerLoad = async () => {
	const statuses = await db.execute<{ status: string; count: number }>(sql`
		SELECT status, count(*)::int AS count FROM articles GROUP BY status
	`);
	const counts = Object.fromEntries(Array.from(statuses).map((r) => [r.status, Number(r.count)]));

	const [pace] = await db.execute<{ last_7: number; last_28: number }>(sql`
		SELECT
			count(*) FILTER (WHERE al.published_at > now() - interval '7 days')::int AS last_7,
			count(*) FILTER (WHERE al.published_at > now() - interval '28 days')::int AS last_28
		FROM article_locales al
		JOIN articles a ON a.id = al.article_id
		WHERE a.status = 'published' AND al.published_at IS NOT NULL AND al.published_at <= now()
	`);

	const top = await db.execute<{
		article_id: number;
		locale: string;
		title: string;
		slug: string;
		category_slug: string;
		views: number;
	}>(sql`
		SELECT
			s.article_id, s.locale, al.title, al.slug, c.slug AS category_slug,
			sum(s.views)::int AS views
		FROM article_stats s
		JOIN article_locales al ON al.article_id = s.article_id AND al.locale = s.locale
		JOIN articles a ON a.id = s.article_id
		JOIN categories c ON c.id = a.category_id
		WHERE s.day > current_date - 30
		GROUP BY s.article_id, s.locale, al.title, al.slug, c.slug
		ORDER BY views DESC
		LIMIT 10
	`);

	const [views] = await db.execute<{ last_30: number }>(sql`
		SELECT coalesce(sum(views), 0)::int AS last_30
		FROM article_stats WHERE day > current_date - 30
	`);

	const upcoming = await db.execute<{
		id: number;
		title: string;
		locale: string;
		published_at: Date;
	}>(sql`
		SELECT a.id, al.title, al.locale, al.published_at
		FROM articles a
		JOIN article_locales al ON al.article_id = a.id
		WHERE a.status = 'scheduled' AND al.published_at > now()
		ORDER BY al.published_at
		LIMIT 5
	`);

	return {
		counts: {
			draft: counts.draft ?? 0,
			scheduled: counts.scheduled ?? 0,
			published: counts.published ?? 0,
			archived: counts.archived ?? 0
		},
		pace: { last7: Number(pace?.last_7 ?? 0), last28: Number(pace?.last_28 ?? 0) },
		views30: Number(views?.last_30 ?? 0),
		top: Array.from(top),
		upcoming: Array.from(upcoming),
		subscribers: await confirmedCount(db),
		drivers: { mail: getMailer().driver, storage: getStorage().driver }
	};
};
