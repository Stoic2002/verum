import { expect, test, type Page } from '@playwright/test';
import { toast } from './toast';

/**
 * Fase 3 exit criteria:
 *   - an article can be written in en + id, scheduled, and appears on its own
 *   - a preview link shows the draft; an expired or forged one is refused
 *   - a <script> in markdown never reaches the rendered output
 */

const EMAIL = 'admin@verum.local';
const PASSWORD = 'verum-dev-password';

test.describe.configure({ mode: 'serial' });

async function signIn(page: Page) {
	await page.goto('/admin/login');
	await page.getByLabel(/username or email/i).fill(EMAIL);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: /sign in/i }).click();
	await expect(page).toHaveURL('/admin');
}

/** Unique per run so repeated runs against the same database do not collide. */
const stamp = Date.now();
const slug = `e2e-article-${stamp}`;
let articleUrl = '';

test('creates an article and renders its markdown', async ({ page }) => {
	await signIn(page);

	await page.goto('/admin/articles/new');
	await page.getByLabel('Title').fill(`E2E article ${stamp}`);
	await page.getByLabel('Slug').fill(slug);
	// Index 0 is the disabled 'Choose a category' placeholder.
	await page.getByLabel('Category').selectOption({ index: 1 });
	await page.getByRole('button', { name: /create and edit/i }).click();

	await expect(page).toHaveURL(/\/admin\/articles\/\d+\/en$/);
	articleUrl = page.url().replace(/\/en$/, '');

	await page.getByLabel('Excerpt').fill('What this article covers.');
	await page
		.getByLabel('Body', { exact: false })
		.fill(
			[
				'## First section',
				'',
				'Some real prose here.',
				'',
				'```ts',
				'const answer: number = 42;',
				'```',
				'',
				':::callout{type="warning"}',
				'Mind the gap.',
				':::'
			].join('\n')
		);

	// The live preview renders through the server, so it is the published output.
	const preview = page.locator('.rendered');
	await expect(preview.locator('h2')).toHaveText('First section');
	await expect(preview.locator('pre')).toContainText('const answer');
	await expect(preview.locator('.callout--warning')).toContainText('Mind the gap.');

	await page.getByRole('button', { name: /^save$/i }).click();
	await expect(toast(page, 'Saved')).toBeVisible();
});

test('never lets a script in markdown reach the output', async ({ page }) => {
	await signIn(page);
	await page.goto(`${articleUrl}/en`);

	await page
		.getByLabel('Body', { exact: false })
		.fill(
			'Before\n\n<script>window.__pwned = true;</script>\n\n<img src=x onerror="window.__pwned = true">\n\nAfter'
		);

	const preview = page.locator('.rendered');
	await expect(preview).toContainText('Before');
	await expect(preview).toContainText('After');

	await page.getByRole('button', { name: /^save$/i }).click();
	await expect(toast(page, 'Saved')).toBeVisible();

	await page.reload();
	// Nothing executed, and the markup itself is gone.
	expect(await page.evaluate(() => (window as { __pwned?: boolean }).__pwned)).toBeUndefined();
	await expect(page.locator('.rendered script')).toHaveCount(0);
	expect(await page.locator('.rendered').innerHTML()).not.toContain('onerror');
});

test('records a 301 when the slug changes', async ({ page }) => {
	await signIn(page);
	await page.goto(`${articleUrl}/en`);

	await page.getByLabel('Slug').fill(`${slug}-renamed`);
	await page.getByRole('button', { name: /^save$/i }).click();
	await expect(toast(page, '301')).toBeVisible();

	await page.goto('/admin/redirects');
	await expect(page.locator('table')).toContainText(slug);
});

test('deleting a redirect asks first, and cancelling keeps it', async ({ page }) => {
	await signIn(page);
	await page.goto('/admin/redirects');

	const from = `/en/ai/e2e-manual-${stamp}`;
	await page.getByLabel('From path').fill(from);
	await page.getByLabel('To path').fill('/en/ai');
	await page.getByRole('button', { name: /save redirect/i }).click();
	await expect(toast(page, `Saved ${from}`)).toBeVisible();

	const row = page.locator('tr', { hasText: from });
	const dialog = page.getByRole('dialog', { name: /delete this redirect/i });

	// Cancel: nothing is sent, the rule stays.
	await row.getByRole('button', { name: /^delete$/i }).click();
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText(from);
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(row).toHaveCount(1);

	// Confirm: deleted in place, announced by a toast, no page reload.
	await row.getByRole('button', { name: /^delete$/i }).click();
	await dialog.getByRole('button', { name: /delete redirect/i }).click();
	await expect(toast(page, 'Redirect deleted')).toBeVisible();
	await expect(row).toHaveCount(0);
});

test('a failed save says why, as an error toast', async ({ page }) => {
	await signIn(page);
	await page.goto('/admin/redirects');
	// Nothing has been submitted yet, so nothing is wrong yet.
	await expect(page.locator('.error')).toHaveCount(0);

	// Neither value is a site path, so the server's validation refuses the rule.
	await page.getByLabel('From path').fill('not-a-path');
	await page.getByLabel('To path').fill('also-not-a-path');
	await page.getByRole('button', { name: /save redirect/i }).click();

	await expect(page.locator('.toast--error')).toBeVisible();
	await expect(page.getByRole('alert')).toBeVisible();
});

test('adds a second locale that starts empty, not translated', async ({ page }) => {
	await signIn(page);
	await page.goto(articleUrl);

	await page.getByRole('button', { name: /add language version/i }).click();
	await expect(page).toHaveURL(/\/admin\/articles\/\d+\/id$/);

	// PRD §7: the other locale is a rewrite. Prefilling it with a translation
	// is exactly the pattern the scaled content abuse policy names.
	await expect(page.getByLabel('Body', { exact: false })).toHaveValue('');
	// Empty on purpose, and not already flagged as invalid before a save.
	await expect(page.locator('.field__error')).toHaveCount(0);
});

test('a signed preview link shows the draft to someone without a session', async ({
	page,
	browser
}) => {
	await signIn(page);
	await page.goto(`${articleUrl}/en`);

	const href = await page
		.getByRole('link', { name: /preview/i })
		.first()
		.getAttribute('href');
	expect(href).toMatch(/^\/preview\//);

	// A fresh context: no cookies, no session.
	const anonymous = await browser.newContext();
	const anonymousPage = await anonymous.newPage();
	const response = await anonymousPage.goto(href!);

	await expect(anonymousPage.locator('.banner')).toContainText('unpublished draft');
	await expect(anonymousPage.locator('h1')).toContainText(`E2E article ${stamp}`);
	// A draft that gets indexed is worse than no preview at all.
	expect(response?.headers()['x-robots-tag']).toContain('noindex');
	expect(response?.headers()['cache-control']).toContain('no-store');

	await anonymous.close();
});

test('refuses a tampered preview token', async ({ browser }) => {
	const anonymous = await browser.newContext();
	const page = await anonymous.newPage();

	const response = await page.goto('/preview/1.en.99999999999999.forgedsignature');
	expect(response?.status()).toBe(404);

	await anonymous.close();
});

test('publishes and the article becomes readable', async ({ page }) => {
	await signIn(page);
	await page.goto(articleUrl);

	await page.getByLabel('Status').selectOption('published');
	// Going live asks the four PRD §5.5 questions first.
	for (const box of await page
		.getByRole('group', { name: /quality gate/i })
		.getByRole('checkbox')
		.all()) {
		await box.check();
	}
	await page.getByRole('button', { name: /save settings/i }).click();
	await expect(toast(page, 'Saved')).toBeVisible();

	await page.goto('/admin/articles?status=published');
	await expect(page.locator('table')).toContainText(`E2E article ${stamp}`);
});

test('the old URL 301s to the renamed one, and carries the query string', async ({ page }) => {
	// The redirect was recorded when the slug changed; this is the half that
	// matters to a reader following an old link (PRD §12.1).
	const response = await page.goto(`/en/ai/${slug}?utm_source=newsletter`);

	expect(response?.status()).toBe(200);
	const landed = new URL(page.url());
	expect(landed.pathname).toBe(`/en/ai/${slug}-renamed`);
	// A campaign parameter that survives the move is a campaign you can measure.
	expect(landed.search).toBe('?utm_source=newsletter');

	const chain = response?.request().redirectedFrom();
	expect(chain).not.toBeNull();
});

test('a URL that never existed is still a 404', async ({ page }) => {
	// The redirect lookup runs only after a 404, so this proves it does not
	// invent destinations for unknown paths.
	const response = await page.goto('/en/ai/never-existed-at-all');
	expect(response?.status()).toBe(404);
});
