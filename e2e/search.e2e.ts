import { expect, test, type Page } from '@playwright/test';

/**
 * Fase 6 exit criteria: search returns ranked, highlighted, filterable
 * results, and article views are counted.
 *
 * The newsletter that used to share this file was removed on 15 September 2026.
 */

const EMAIL = 'admin@verum.local';
const PASSWORD = 'verum-dev-password';

async function signIn(page: Page) {
	await page.goto('/admin/login');
	await page.getByLabel(/username or email/i).fill(EMAIL);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: /sign in/i }).click();
	await expect(page).toHaveURL('/admin');
}

test.describe('search', () => {
	test('finds an article and highlights the match', async ({ page }) => {
		await page.goto('/en/search?q=coding+tools');

		const results = page.locator('.results li');
		await expect(results).not.toHaveCount(0);
		await expect(results.first().locator('mark').first()).toBeVisible();
	});

	test('filters by category', async ({ page }) => {
		await page.goto('/en/search?q=postgres&category=ai');
		await expect(page.locator('.results li')).toHaveCount(0);

		await page.goto('/en/search?q=postgres&category=tech');
		await expect(page.locator('.results li')).not.toHaveCount(0);
	});

	test('says so plainly when nothing matches', async ({ page }) => {
		await page.goto('/en/search?q=zzzqqqxnothing');
		await expect(page.getByText(/nothing matched/i)).toBeVisible();
	});

	test('is never cached and never indexed', async ({ page }) => {
		const response = await page.goto('/en/search?q=anything');

		expect(response?.headers()['cache-control']).toContain('no-store');
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
	});

	test('works with JavaScript disabled', async ({ browser }) => {
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();

		await page.goto('/en/search');
		await page.locator('#q').fill('postgres');
		await page.getByRole('button', { name: /search/i }).click();

		await expect(page.locator('.results li')).not.toHaveCount(0);
		await context.close();
	});
});

test('a view is counted from the browser, not the cached page', async ({ page }) => {
	// The counter is a beacon precisely because published pages are served from
	// the CDN and never reach the origin. sendBeacon posts a Blob, so the body
	// is not readable here — the outcome on the dashboard is what proves it.
	const accepted = page.waitForResponse(
		(response) => response.url().endsWith('/api/view') && response.status() === 204
	);

	await page.goto('/en/ai/best-ai-coding-tools');
	await accepted;

	await signIn(page);
	const views = await page.locator('li', { hasText: 'Views, 30 days' }).locator('.n').textContent();

	expect(Number((views ?? '0').replace(/[^0-9]/g, ''))).toBeGreaterThan(0);
});

test('the view endpoint refuses a malformed payload', async ({ request }) => {
	expect(
		(await request.post('/api/view', { data: { articleId: 'nope', locale: 'en' } })).status()
	).toBe(400);
	expect((await request.post('/api/view', { data: { articleId: 1, locale: 'de' } })).status()).toBe(
		400
	);
	// An article that no longer exists is the reader's problem to know nothing about.
	expect(
		(await request.post('/api/view', { data: { articleId: 999999, locale: 'en' } })).status()
	).toBe(204);
});
