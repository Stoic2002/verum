import { json, type RequestHandler } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { LOCALES, type Locale } from '$lib/server/db/schema';
import { createRateLimiter } from '$lib/server/rate-limit';

/**
 * Counts one article view.
 *
 * This is a beacon from the browser, not a counter in the page load, and that
 * is not a style choice: published article pages sit behind the CDN with a
 * 24-hour TTL (PRD §10.3), so the origin never sees most reads. A server-side
 * increment would undercount by roughly the cache hit rate and quietly report
 * a fraction of the real number on the dashboard.
 *
 * What it stores is a daily count per article and locale. No identifier, no
 * address, no fingerprint — nothing a consent banner would have to gate, which
 * is also why it can run before the CMP has answered.
 *
 * It is a rough internal metric, not analytics truth: a determined visitor can
 * inflate it. Ranking decisions come from Search Console.
 */
const byIp = createRateLimiter({ capacity: 60, refillMs: 60_000 });

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!byIp.check(getClientAddress()).allowed) {
		return new Response(null, { status: 429 });
	}

	let payload: { articleId?: unknown; locale?: unknown };
	try {
		payload = await request.json();
	} catch {
		return json({ error: 'bad payload' }, { status: 400 });
	}

	const articleId = Number(payload.articleId);
	const locale = payload.locale as Locale;

	if (!Number.isInteger(articleId) || articleId <= 0) {
		return json({ error: 'bad articleId' }, { status: 400 });
	}
	if (!LOCALES.includes(locale)) {
		return json({ error: 'bad locale' }, { status: 400 });
	}

	// A foreign key violation means the article is gone; that is a 204, not a
	// 500 — the reader has done nothing wrong and there is nothing to report.
	try {
		await db.execute(sql`
			INSERT INTO article_stats (article_id, locale, day, views)
			VALUES (${articleId}, ${locale}, current_date, 1)
			ON CONFLICT (article_id, locale, day) DO UPDATE
				SET views = article_stats.views + 1
		`);
	} catch {
		return new Response(null, { status: 204 });
	}

	return new Response(null, { status: 204 });
};
