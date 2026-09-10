import { expect, test, type Page } from '@playwright/test';

/**
 * Fase 7 exit criteria:
 *   - structured data valid on articles and categories
 *   - hreflang validated in both directions
 *   - a renamed slug 301s from the old URL
 *   - sitemap, feed and robots serve what they claim to
 */

const ARTICLE_EN = '/en/ai/best-ai-coding-tools';
const ARTICLE_ID = '/id/ai/tool-coding-ai-terbaik';

/** Reads every JSON-LD block on the page and returns the flattened @graph. */
async function jsonLd(page: Page): Promise<Record<string, unknown>[]> {
	const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
	return blocks.flatMap((block) => {
		const parsed = JSON.parse(block);
		return (parsed['@graph'] ?? [parsed]) as Record<string, unknown>[];
	});
}

const attrs = (page: Page, selector: string, name: string) =>
	page.locator(selector).evaluateAll((els, n) => els.map((el) => el.getAttribute(n)), name);

test.describe('article metadata', () => {
	test('carries a canonical pointing at its own locale', async ({ page }) => {
		await page.goto(ARTICLE_EN);

		const canonical = await page.locator('link[rel=canonical]').getAttribute('href');
		// PRD §12.2: never the English version from a non-English page, and
		// never a query string.
		expect(canonical).toMatch(/\/en\/ai\/best-ai-coding-tools$/);

		await page.goto(ARTICLE_ID);
		expect(await page.locator('link[rel=canonical]').getAttribute('href')).toMatch(
			/\/id\/ai\/tool-coding-ai-terbaik$/
		);
	});

	test('title and description stay inside the PRD limits', async ({ page }) => {
		await page.goto(ARTICLE_EN);

		expect((await page.title()).length).toBeLessThanOrEqual(60);
		const description = await page.locator('meta[name=description]').getAttribute('content');
		expect(description!.length).toBeLessThanOrEqual(155);
		expect(description!.length).toBeGreaterThan(0);
	});

	test('emits Article and BreadcrumbList that match the page', async ({ page }) => {
		await page.goto(ARTICLE_EN);
		const nodes = await jsonLd(page);

		const article = nodes.find((n) => n['@type'] === 'Article')!;
		expect(article.headline).toBe(await page.locator('h1').textContent());
		expect(article.datePublished).toBeTruthy();
		// Living articles depend on this signal; it must never be absent.
		expect(article.dateModified).toBeTruthy();
		expect((article.author as Record<string, string>).name).toBeTruthy();
		expect(article.inLanguage).toBe('en');

		const crumbs = nodes.find((n) => n['@type'] === 'BreadcrumbList')!;
		const items = crumbs.itemListElement as { position: number; name: string }[];
		expect(items.map((i) => i.position)).toEqual([1, 2, 3]);
		expect(items[2].name).toBe(article.headline);
	});

	test('exposes Open Graph with an absolute image URL', async ({ page }) => {
		await page.goto(ARTICLE_EN);

		expect(await page.locator('meta[property="og:type"]').getAttribute('content')).toBe('article');
		const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content');
		expect(ogUrl).toMatch(/^https?:\/\//);
	});
});

test.describe('hreflang', () => {
	test('is symmetric between the two versions of one article', async ({ page }) => {
		await page.goto(ARTICLE_EN);
		const fromEn = await attrs(page, 'link[rel=alternate][hreflang]', 'hreflang');
		const enHrefs = await attrs(page, 'link[rel=alternate][hreflang]', 'href');

		expect(fromEn.sort()).toEqual(['en', 'id', 'x-default']);

		await page.goto(ARTICLE_ID);
		const fromId = await attrs(page, 'link[rel=alternate][hreflang]', 'hreflang');
		const idHrefs = await attrs(page, 'link[rel=alternate][hreflang]', 'href');

		expect(fromId.sort()).toEqual(['en', 'id', 'x-default']);

		// Both directions must name the same pair of URLs. A one-sided cluster
		// is ignored by Google entirely.
		const pair = (hrefs: (string | null)[]) =>
			[...new Set(hrefs.map((h) => new URL(h!).pathname))].sort();
		expect(pair(enHrefs)).toEqual(pair(idHrefs));
	});

	test('includes a self-reference and x-default on the English URL', async ({ page }) => {
		await page.goto(ARTICLE_EN);

		const links = await page.locator('link[rel=alternate][hreflang]').evaluateAll((els) =>
			els.map((el) => ({
				hreflang: el.getAttribute('hreflang'),
				href: el.getAttribute('href')
			}))
		);

		const self = links.find((l) => l.hreflang === 'en')!;
		const xDefault = links.find((l) => l.hreflang === 'x-default')!;
		expect(xDefault.href).toBe(self.href);
	});

	test('never announces a locale an article does not have', async ({ page }) => {
		// This one is published in English only (PRD §7 asymmetry).
		await page.goto('/en/tech/postgres-full-text-search-for-small-sites');

		const langs = await attrs(page, 'link[rel=alternate][hreflang]', 'hreflang');
		expect(langs.sort()).toEqual(['en', 'x-default']);
	});
});

test.describe('homepage and category', () => {
	test('the homepage declares Organization and WebSite with a working search action', async ({
		page
	}) => {
		await page.goto('/en');
		const nodes = await jsonLd(page);

		expect(nodes.find((n) => n['@type'] === 'Organization')).toBeTruthy();

		const site = nodes.find((n) => n['@type'] === 'WebSite')!;
		const action = site.potentialAction as { target: { urlTemplate: string } };
		const template = action.target.urlTemplate;
		expect(template).toContain('/en/search?q=');

		// The template has to point at a page that actually exists.
		const probe = await page.goto(
			new URL(template.replace('{search_term_string}', 'postgres')).pathname + '?q=postgres'
		);
		expect(probe?.status()).toBe(200);
	});

	test('a category page carries breadcrumbs', async ({ page }) => {
		await page.goto('/en/ai');
		const nodes = await jsonLd(page);

		const crumbs = nodes.find((n) => n['@type'] === 'BreadcrumbList')!;
		expect((crumbs.itemListElement as unknown[]).length).toBe(2);
	});
});

test.describe('machines', () => {
	test('robots allows AI retrieval crawlers and points at the sitemap', async ({ request }) => {
		const body = await (await request.get('/robots.txt')).text();

		// PRD §12.6: these are a distribution channel, not a threat.
		for (const agent of ['GPTBot', 'PerplexityBot', 'ClaudeBot', 'Google-Extended']) {
			expect(body).toContain(agent);
		}
		expect(body).toMatch(/Sitemap: https?:\/\/\S+\/sitemap\.xml/);
		expect(body).toContain('Disallow: /admin');
	});

	test('the sitemap index lists one sitemap per locale', async ({ request }) => {
		const body = await (await request.get('/sitemap.xml')).text();

		expect(body).toContain('/sitemap-en.xml');
		expect(body).toContain('/sitemap-id.xml');
	});

	test('a locale sitemap carries xhtml alternates and excludes what it must', async ({
		request
	}) => {
		const body = await (await request.get('/sitemap-en.xml')).text();

		expect(body).toContain('xmlns:xhtml');
		expect(body).toContain('best-ai-coding-tools');
		expect(body).toContain('<xhtml:link rel="alternate" hreflang="id"');

		// The AdSense prerequisite pages belong in the sitemap too (PRD §14).
		for (const slug of ['about', 'contact', 'editorial-policy', 'privacy', 'terms']) {
			expect(body, slug).toContain(`/en/${slug}`);
		}

		// A sitemap claims a URL is canonical and indexable. Scheduled articles
		// are neither.
		expect(body).not.toContain('scheduled-article-not-yet-live');
		// Tags under the threshold are noindexed, so listing them contradicts
		// the page itself (PRD §12.7).
		expect(body).not.toContain('/tag/postgres');
	});

	test('the feed is summary-and-link, never full text', async ({ request }) => {
		const response = await request.get('/rss.xml');
		const body = await response.text();

		expect(response.headers()['content-type']).toContain('xml');
		expect(body).toContain('<rss version="2.0"');
		expect(body).toContain('<atom:link');
		expect(body).toContain('Best AI coding tools');
		// The rendered body would hand scrapers a clean copy to outrank us with.
		expect(body).not.toContain('<h2');
	});

	test('the Indonesian feed is a different feed', async ({ request }) => {
		const body = await (await request.get('/rss.xml?locale=id')).text();

		expect(body).toContain('<language>id</language>');
		expect(body).toContain('Membandingkan');
	});

	test('ads.txt is absent rather than a placeholder', async ({ request }) => {
		// A broken declaration is treated worse by verifiers than no file.
		expect((await request.get('/ads.txt')).status()).toBe(404);
	});
});

test('search results and static pages declare the right indexing rules', async ({ page }) => {
	await page.goto('/en/search?q=postgres');
	await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
	await expect(page.locator('link[rel=canonical]')).toHaveCount(0);

	await page.goto('/en/privacy');
	await expect(page.locator('link[rel=canonical]')).toHaveCount(1);
	await expect(page.locator('meta[name=robots]')).toHaveCount(0);
});
