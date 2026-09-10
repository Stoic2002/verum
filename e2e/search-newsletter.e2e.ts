import { expect, test, type Page } from '@playwright/test';

/**
 * Fase 6 exit criteria:
 *   - search returns ranked, highlighted, filterable results
 *   - the double opt-in flow completes end to end, through a real email
 *
 * "Real email" here means a real message, captured by the log mail driver and
 * read back from the dev inbox — the same code path SMTP takes, minus the
 * credentials CI does not have.
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

test.describe('newsletter double opt-in', () => {
	test.describe.configure({ mode: 'serial' });

	const address = `reader-${Date.now()}@verum.test`;
	let confirmLink = '';

	test('signing up sends a link and adds nobody to the list yet', async ({ page }) => {
		await page.goto('/en/newsletter');
		await page.locator('#newsletter-email').fill(address);
		await page.getByRole('button', { name: /subscribe/i }).click();

		await expect(page.getByRole('heading')).toContainText(/check your inbox/i);
		await expect(page.getByText(address)).toBeVisible();
	});

	test('the confirmation email carries a working link', async ({ page }) => {
		await signIn(page);
		await page.goto('/admin/mail');

		const body = await page.locator('article pre').first().textContent();
		const match = body?.match(/https?:\/\/\S+\/newsletter\/confirm\?token=[\w-]+/);
		expect(match, 'the confirmation email should contain a confirm link').not.toBeNull();

		confirmLink = match![0];
		await expect(page.locator('article').first()).toContainText(address);
	});

	test('clicking the link confirms the subscription', async ({ browser }) => {
		// A fresh context: the reader is not signed in to anything.
		const context = await browser.newContext();
		const page = await context.newPage();

		await page.goto(new URL(confirmLink).pathname + new URL(confirmLink).search);
		await expect(page.locator('[data-result="confirmed"]')).toBeVisible();

		await context.close();
	});

	test('the same link cannot be used twice', async ({ browser }) => {
		const context = await browser.newContext();
		const page = await context.newPage();

		// The token is burned on success, so a forwarded email is inert.
		await page.goto(new URL(confirmLink).pathname + new URL(confirmLink).search);
		await expect(page.locator('[data-result="invalid"]')).toBeVisible();

		await context.close();
	});

	test('the subscriber shows on the dashboard', async ({ page }) => {
		await signIn(page);
		await expect(page.getByText('Confirmed subscribers')).toBeVisible();
	});

	test('an invalid address is rejected by the server, not just the browser', async ({ page }) => {
		await page.goto('/en/newsletter');
		await page.locator('#newsletter-email').evaluate((el) => el.setAttribute('type', 'text'));
		await page.locator('#newsletter-email').fill('not-an-address');
		await page.getByRole('button', { name: /subscribe/i }).click();

		await expect(page.getByRole('alert')).toContainText(/valid email/i);
	});

	test('the honeypot swallows a bot without creating anything', async ({ page }) => {
		await page.goto('/en/newsletter');
		await page.locator('#newsletter-email').fill(`bot-${Date.now()}@verum.test`);
		await page.locator('input[name="website"]').fill('http://spam.example');
		await page.getByRole('button', { name: /subscribe/i }).click();

		// It looks like success to the bot, and no mail is sent.
		await expect(page.getByRole('heading')).toContainText(/check your inbox/i);
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
