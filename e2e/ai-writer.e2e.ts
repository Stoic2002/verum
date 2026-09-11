import { expect, test, type Page } from '@playwright/test';
import { LAUNCH_URL, MOCK_ORIGIN, OUTLINE_TITLE, REVIEW_URL } from './mock-ai';
import { toast } from './toast';

/**
 * The AI writer end to end, against e2e/mock-ai.ts: a provider is added, a
 * draft is researched from two pages, its claims are checked, the editor
 * reviews, a draft article is written, and publishing waits for the editor.
 */

const EMAIL = 'admin@verum.local';
const PASSWORD = 'verum-dev-password';
const stamp = Date.now();
const LABEL = `Mock writer ${stamp}`;

test.describe.configure({ mode: 'serial' });

async function signIn(page: Page) {
	await page.goto('/admin/login');
	await page.getByLabel(/username or email/i).fill(EMAIL);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: /sign in/i }).click();
	await expect(page).toHaveURL('/admin');
}

async function openAddForm(page: Page, summary: RegExp) {
	const details = page.locator('details', { has: page.locator('summary', { hasText: summary }) });
	await details.evaluate((el) => ((el as HTMLDetailsElement).open = true));
	return details;
}

let previousLimit = '';

/**
 * These tests write provider rows into the shared dev database, and `db:demo`
 * deliberately keeps provider rows. A failure half-way would otherwise leave
 * "Mock writer …" entries behind in the editor's settings for good.
 */
test.afterAll(async ({ browser }) => {
	const page = await browser.newPage();
	await signIn(page);
	await page.goto('/admin/ai/settings');

	const leftovers = page.locator('li.credential', { hasText: /(Mock writer|Key test) \d{13}/ });
	while ((await leftovers.count()) > 0) {
		const before = await leftovers.count();
		await leftovers
			.first()
			.getByRole('button', { name: /^remove$/i })
			.click();
		await page
			.getByRole('dialog')
			.getByRole('button', { name: /remove provider/i })
			.click();
		await expect(leftovers).toHaveCount(before - 1);
	}

	if (previousLimit) {
		await page.getByLabel('Drafts per 7 days').fill(previousLimit);
		await page.getByRole('button', { name: /save settings/i }).click();
		await expect(page.locator('.toast', { hasText: 'Settings saved' })).toBeVisible();
	}
	await page.close();
});

let jobUrl = '';
let editorUrl = '';

test('adds an OpenAI-compatible provider, loads its models, and tests it', async ({ page }) => {
	await signIn(page);
	await page.goto('/admin/ai/settings');

	const form = await openAddForm(page, /add a model provider/i);
	await form.getByLabel('Provider').selectOption('openai_compatible');
	await form.getByLabel('Name').fill(LABEL);
	await form.getByLabel('Base URL').fill(`${MOCK_ORIGIN}/v1`);
	await form.getByRole('button', { name: /load models/i }).click();
	await expect(toast(page, 'Loaded 1 models')).toBeVisible();

	await form.getByLabel('Model', { exact: true }).fill('mock-writer');
	await form.getByRole('button', { name: /add provider/i }).click();
	await expect(toast(page, `${LABEL} added`)).toBeVisible();

	const row = page.locator('li.credential', { hasText: LABEL });
	await row.getByRole('button', { name: 'Test', exact: true }).click();
	await expect(toast(page, `${LABEL} works`)).toBeVisible();

	// Repeated local runs share a database; keep the weekly cap out of the way,
	// and remember the editor's own value so afterAll can put it back.
	previousLimit = await page.getByLabel('Drafts per 7 days').inputValue();
	await page.getByLabel('Drafts per 7 days').fill('100');
	await page.getByRole('button', { name: /save settings/i }).click();
	await expect(toast(page, 'Settings saved')).toBeVisible();
});

test('stores an API key encrypted and never sends it back to the browser', async ({ page }) => {
	await signIn(page);
	await page.goto('/admin/ai/settings');

	const secret = `sk-e2e-SECRET-${stamp}-abcd`;
	const form = await openAddForm(page, /add a model provider/i);
	await form.getByLabel('Provider').selectOption('openai');
	await form.getByLabel('Name').fill(`Key test ${stamp}`);
	await form.getByLabel('API key').fill(secret);
	await form.getByLabel('Model', { exact: true }).fill('gpt-test');
	await form.getByRole('button', { name: /add provider/i }).click();
	await expect(toast(page, `Key test ${stamp} added`)).toBeVisible();

	await page.reload();
	const row = page.locator('li.credential', { hasText: `Key test ${stamp}` });
	await expect(row).toContainText('…abcd');
	// The page itself mentions AI_KEY_SECRET, so look for this key specifically:
	// neither whole nor its distinctive middle may reach the browser.
	const html = await page.content();
	expect(html).not.toContain(secret);
	expect(html).not.toContain(`SECRET-${stamp}`);

	await row.getByRole('button', { name: /^remove$/i }).click();
	await page
		.getByRole('dialog', { name: new RegExp(`remove key test ${stamp}`, 'i') })
		.getByRole('button', { name: /remove provider/i })
		.click();
	await expect(toast(page, 'Provider removed')).toBeVisible();
	await expect(row).toHaveCount(0);
});

test('researches from the given pages, checks the claims, and stops for review', async ({
	page
}) => {
	await signIn(page);
	await page.goto('/admin/ai');

	await page.getByLabel('Idea').fill(`Orbit 2 laptop launch ${stamp}`);
	await page.getByLabel('Angle').fill('Is the battery upgrade worth it?');
	await page.getByLabel('Category').selectOption({ index: 0 });
	await page.getByLabel('Model').selectOption({ label: `${LABEL} · mock-writer` });
	await page.getByLabel('Web search').selectOption('');
	await page.getByLabel('Sources you already have').fill(`${LAUNCH_URL}\n${REVIEW_URL}`);
	await page.getByRole('button', { name: /start research/i }).click();

	await expect(page).toHaveURL(/\/admin\/ai\/\d+$/);
	jobUrl = page.url();
	await expect(page.getByText('Needs your review')).toBeVisible({ timeout: 30_000 });

	const sources = page.locator('table').first();
	await expect(sources).toContainText('Orbit 2 launch details');
	await expect(sources).toContainText('Orbit 2 review: battery');

	const claims = page.locator('li.claim');
	await expect(claims).toHaveCount(3);
	await expect(claims.filter({ hasText: 'ships on 14 October' })).toContainText('Single source');
	const invented = claims.filter({ hasText: 'recycled aluminium' });
	await expect(invented).toContainText('Quote not found on the page');
	await expect(invented.getByRole('checkbox')).not.toBeChecked();

	await expect(page.getByLabel('Title')).toHaveValue(OUTLINE_TITLE);
});

test('writes a draft article with linked citations and a note for the editor', async ({ page }) => {
	await signIn(page);
	await page.goto(jobUrl);

	await page.getByRole('button', { name: /write draft/i }).click();
	await expect(page.getByText('Draft ready')).toBeVisible({ timeout: 30_000 });

	await page.getByRole('link', { name: /open the draft/i }).click();
	await expect(page).toHaveURL(/\/admin\/articles\/\d+\/en$/);
	editorUrl = page.url();

	const body = page.getByLabel('Body', { exact: false });
	await expect(body).toHaveValue(/\[\[1\]\]\(http:\/\/127\.0\.0\.1:4599\/pages\/launch\)/);
	await expect(body).toHaveValue(/## Sources/);
	await expect(page.getByText(/1 editor note to resolve/)).toBeVisible();
	await expect(page.getByRole('link', { name: /research report/i })).toBeVisible();
});

test('does not publish until the note is resolved and the quality gate is confirmed', async ({
	page
}) => {
	await signIn(page);
	const settingsUrl = editorUrl.replace(/\/en$/, '');

	await page.goto(settingsUrl);
	await page.getByLabel('Status').selectOption('published');
	await page.getByRole('button', { name: /save settings/i }).click();
	await expect(page.locator('.toast--error')).toContainText('Resolve the [[EDITOR');

	await page.goto(editorUrl);
	const body = page.getByLabel('Body', { exact: false });
	const text = await body.inputValue();
	await body.fill(text.replace(/\[\[EDITOR:[^\]]*\]\]/, 'In our own test it lasted ten hours.'));
	await page.getByRole('button', { name: /^save$/i }).click();
	await expect(toast(page, 'Saved')).toBeVisible();

	await page.goto(settingsUrl);
	await page.getByLabel('Status').selectOption('published');
	await page.getByRole('button', { name: /save settings/i }).click();
	await expect(toast(page, 'Confirm all four')).toBeVisible();

	for (const box of await page
		.getByRole('group', { name: /quality gate/i })
		.getByRole('checkbox')
		.all()) {
		await box.check();
	}
	await page.getByRole('button', { name: /save settings/i }).click();
	await expect(toast(page, 'Saved.')).toBeVisible();
});

test('removes the provider', async ({ page }) => {
	await signIn(page);
	await page.goto('/admin/ai/settings');

	const row = page.locator('li.credential', { hasText: LABEL });
	await row.getByRole('button', { name: /^remove$/i }).click();
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /remove provider/i })
		.click();
	await expect(toast(page, 'Provider removed')).toBeVisible();
	await expect(row).toHaveCount(0);
});
