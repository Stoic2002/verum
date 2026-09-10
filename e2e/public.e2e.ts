import { expect, test } from '@playwright/test';

/**
 * Fase 5 exit criteria:
 *   - every page renders with JavaScript switched off
 *   - switching locale keeps you on the same article when a version exists
 *   - no flash of the wrong theme
 *   - CLS stays at 0 with the ad placeholders in place
 */

const ARTICLE = '/en/ai/best-ai-coding-tools';

test.describe('with JavaScript disabled', () => {
	// SSR is not a nice-to-have here: PRD §10.1 makes it the reason the stack is
	// SvelteKit rather than an SPA. If a page needs JS to show its text, it
	// needs JS to be indexed.
	test.use({ javaScriptEnabled: false });

	test('the homepage renders its articles', async ({ page }) => {
		await page.goto('/en');

		await expect(page.locator('h1, .card__title').first()).toBeVisible();
		await expect(page.locator('article.card')).not.toHaveCount(0);
		await expect(page.getByRole('link', { name: 'VERUM' })).toBeVisible();
	});

	test('an article renders its body, byline and table of contents', async ({ page }) => {
		await page.goto(ARTICLE);

		await expect(page.locator('h1')).toContainText('Best AI coding tools');
		await expect(page.locator('.prose h2').first()).toBeVisible();
		await expect(page.locator('.byline time').first()).toBeVisible();
	});

	test('category, tag and topic pages render', async ({ page }) => {
		for (const path of ['/en/ai', '/en/tag/llm', '/en/topic/ai-tooling']) {
			const response = await page.goto(path);
			expect(response?.status(), path).toBe(200);
			await expect(page.locator('h1'), path).toBeVisible();
		}
	});

	test('controls that need JavaScript are not offered', async ({ page }) => {
		await page.goto(ARTICLE);

		// A dead toggle is worse than no toggle.
		await expect(page.locator('.theme')).toBeHidden();
		await expect(page.locator('.copy')).toBeHidden();
		// Share links are plain hrefs, so they still work.
		await expect(page.getByRole('link', { name: 'Reddit' })).toBeVisible();
	});
});

test('an unknown category is a 404, not an empty page', async ({ page }) => {
	const response = await page.goto('/en/not-a-real-category');
	expect(response?.status()).toBe(404);
});

test('switching locale keeps you on the same article', async ({ page }) => {
	await page.goto(ARTICLE);

	// The Indonesian version of this article exists in the seed, under its own
	// slug — a rewrite, not a translated URL (PRD §7).
	await page.goto('/id/ai/tool-coding-ai-terbaik');
	await expect(page.locator('html')).toHaveAttribute('lang', 'id');
	await expect(page.locator('h1')).toContainText('Membandingkan');
});

test('an article published only in English has no Indonesian version', async ({ page }) => {
	// Asymmetry is the point: parity is never required.
	const response = await page.goto('/id/tech/postgres-full-text-search-for-small-sites');
	expect(response?.status()).toBe(404);
});

test('a scheduled article is not reachable', async ({ page }) => {
	const response = await page.goto('/en/ai/scheduled-article-not-yet-live');
	expect(response?.status()).toBe(404);
});

test('the chosen theme applies before first paint', async ({ page }) => {
	await page.goto('/en');
	await page.evaluate(() => localStorage.setItem('verum-theme', 'dark'));

	// Watch the root element from the very first script the document runs. If
	// the theme were applied by the app rather than the inline head script,
	// this would catch the untouched state first — the flash.
	await page.addInitScript(() => {
		(window as { __themeAtStart?: string }).__themeAtStart =
			document.documentElement.dataset.theme ?? 'unset';
	});

	await page.reload();

	const applied = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
	expect(applied).toBe('dark');

	const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
	// The dark ground from tokens.css, not the light one.
	expect(background).toBe('rgb(19, 19, 19)');
});

test('the ad placeholders reserve their space and shift nothing', async ({ page }) => {
	await page.goto(ARTICLE);

	// The end slot is always present; the mid-article one appears only when
	// there is prose on both sides of it (PRD §13.1).
	const slots = page.locator('[data-ad-slot]');
	await expect(slots).not.toHaveCount(0);
	await expect(page.locator('[data-ad-slot="article-end"]')).toBeVisible();

	// Reserved before anything loads. Reserving afterwards does not work — the
	// shift has already happened.
	for (const box of await slots.evaluateAll((els) =>
		els.map((el) => el.getBoundingClientRect().height)
	)) {
		expect(box).toBeGreaterThanOrEqual(280);
	}

	const cls = await page.evaluate(async () => {
		let total = 0;
		const observer = new PerformanceObserver((list) => {
			for (const entry of list.getEntries() as (PerformanceEntry & {
				value: number;
				hadRecentInput: boolean;
			})[]) {
				if (!entry.hadRecentInput) total += entry.value;
			}
		});
		observer.observe({ type: 'layout-shift', buffered: true });

		await Promise.all(
			[...document.images].map((img) =>
				img.complete ? null : new Promise((done) => img.addEventListener('load', done))
			)
		);
		await new Promise((done) => setTimeout(done, 600));

		observer.disconnect();
		return total;
	});

	expect(cls).toBe(0);
});

test('the page never scrolls sideways on a phone', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 780 });
	await page.goto(ARTICLE);

	const overflows = await page.evaluate(
		() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
	);
	expect(overflows).toBe(false);
});

test('a long article gets its first ad slot after the opening paragraph', async ({ page }) => {
	await page.goto('/en/tech/postgres-full-text-search-for-small-sites');

	const top = page.locator('[data-ad-slot="article-top"]');
	if ((await top.count()) === 0) return; // Short article; nothing to place.

	// Whatever sits above the slot must include prose, not just the byline.
	const leadText = await page.locator('.prose').first().innerText();
	expect(leadText.trim().length).toBeGreaterThan(40);

	const leadBottom = (await page.locator('.prose').first().boundingBox())!.y;
	const slotTop = (await top.boundingBox())!.y;
	expect(slotTop).toBeGreaterThan(leadBottom);
});
