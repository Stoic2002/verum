import type { RequestHandler } from '@sveltejs/kit';
import { siteOrigin } from '$lib/server/site';

/**
 * PRD §12.6: retrieval crawlers are allowed through, deliberately.
 *
 * Referrals from AI search engines are a real and growing source of traffic,
 * and Search Console reports on them separately. Blocking those crawlers cuts
 * off a distribution channel while doing nothing about the training-data
 * question, because the crawlers that matter for training are different ones.
 *
 * CCBot is listed as the example of a pure training-data crawler that may be
 * blocked without losing any referral.
 */
export const GET: RequestHandler = ({ url, setHeaders }) => {
	const origin = siteOrigin(url);

	setHeaders({
		'content-type': 'text/plain; charset=utf-8',
		'cache-control': 'public, max-age=0, s-maxage=3600'
	});

	const body = `# ${origin}

User-agent: *
Allow: /

# Nothing here is content. Search result pages, drafts behind signed links,
# the admin, and the internal API are all excluded rather than merely
# noindexed, so crawl budget is not spent reaching them.
Disallow: /admin
Disallow: /api/
Disallow: /preview/
Disallow: /*/search
Disallow: /*/newsletter

# Retrieval crawlers for AI search. Allowed on purpose (PRD §12.6).
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

# Training-data collection with no referral in return.
User-agent: CCBot
Disallow: /

Sitemap: ${origin}/sitemap.xml
`;

	return new Response(body);
};
