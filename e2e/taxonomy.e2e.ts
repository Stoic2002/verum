import { expect, test, type Page } from '@playwright/test';
import { toast } from './toast';

/**
 * A seeded install has hundreds of tags. Both places that list them have to
 * stay usable at that size: the taxonomy page and the article's tag picker.
 */

const EMAIL = 'admin@verum.local';
const PASSWORD = 'verum-dev-password';
const stamp = Date.now();

async function signIn(page: Page) {
	await page.goto('/admin/login');
	await page.getByLabel(/username or email/i).fill(EMAIL);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: /sign in/i }).click();
	await expect(page).toHaveURL('/admin');
}

test('the tag list is searched, not scrolled', async ({ page }) => {
	await signIn(page);
	await page.goto('/admin/taxonomy');

	const rows = page.locator('section', { hasText: 'Tags' }).locator('tbody tr');
	// A page at a time, however many tags exist.
	expect(await rows.count()).toBeLessThanOrEqual(30);

	await page.getByLabel('Search tags').fill('llm');
	await expect(rows.filter({ hasText: 'llm' }).first()).toBeVisible();
	for (const text of await rows.allInnerTexts()) expect(text.toLowerCase()).toContain('llm');
});

test('a new tag gets its slug from the name', async ({ page }) => {
	await signIn(page);
	await page.goto('/admin/taxonomy');

	await page.locator('#tname').fill(`Taxonomy Test ${stamp}`);
	await expect(page.locator('#tslug')).toHaveValue(`taxonomy-test-${stamp}`);
});

test('an article picks tags by typing, and keeps them as chips', async ({ page }) => {
	await signIn(page);

	await page.goto('/admin/articles/new');
	await page.getByLabel('Title').fill(`Tagged article ${stamp}`);
	await page.getByLabel('Slug').fill(`tagged-article-${stamp}`);
	await page.getByLabel('Category').selectOption({ index: 1 });
	await page.getByRole('button', { name: /create and edit/i }).click();
	await expect(page).toHaveURL(/\/admin\/articles\/\d+\/en$/);
	const articleId = page.url().match(/articles\/(\d+)\//)?.[1];

	await page.goto(`/admin/articles/${articleId}`);
	// No wall of checkboxes before anything is typed.
	await expect(page.locator('.tag-matches')).toHaveCount(0);

	await page.getByLabel('Find a tag').fill('llm');
	// Choosing a tag clears the search, so the checkbox is gone the moment it is
	// ticked; click rather than check(), which waits to see it checked.
	await page.locator('.tag-matches').getByRole('checkbox').first().click();

	const chosen = page.getByRole('list', { name: 'Chosen tags' });
	await expect(chosen.getByRole('listitem')).toHaveCount(1);

	await page.getByRole('button', { name: 'Save settings' }).click();
	await expect(toast(page, 'Saved')).toBeVisible();

	await page.reload();
	await expect(page.getByRole('list', { name: 'Chosen tags' }).getByRole('listitem')).toHaveCount(
		1
	);
});

test('a category can be hidden, shown again, and deleted once empty', async ({ page }) => {
	const slug = `hidden-${stamp}`;
	await signIn(page);
	await page.goto('/admin/taxonomy');

	await page.locator('#cslug').fill(slug);
	await page.locator('#nameEn').fill(`Hidden ${stamp}`);
	await page.getByRole('button', { name: 'Save category' }).click();
	await expect(toast(page, 'Saved category')).toBeVisible();

	const row = page.locator('tr', { hasText: slug });
	await row.getByRole('button', { name: 'Hide' }).click();
	await expect(toast(page, 'Category hidden')).toBeVisible();
	expect((await page.request.get(`/en/${slug}`)).status()).toBe(404);

	await row.getByRole('button', { name: 'Show' }).click();
	await expect(toast(page, 'live again')).toBeVisible();
	expect((await page.request.get(`/en/${slug}`)).status()).toBe(200);

	await row.getByRole('button', { name: 'Delete' }).click();
	await page.getByRole('button', { name: 'Delete category' }).click();
	await expect(toast(page, 'Category deleted')).toBeVisible();
	await expect(page.locator('tr', { hasText: slug })).toHaveCount(0);
});

test('a category with articles cannot be deleted', async ({ page }) => {
	await signIn(page);
	await page.goto('/admin/taxonomy');

	// The seeded ai category always has articles.
	const row = page.locator('tr', { has: page.locator('code', { hasText: /^ai$/ }) });
	await expect(row.getByRole('button', { name: 'Delete' })).toHaveCount(0);
	await expect(row.getByText('Has articles')).toBeVisible();
});

test('a topic can be deleted', async ({ page }) => {
	const slug = `topic-${stamp}`;
	await signIn(page);
	await page.goto('/admin/topics');

	await page.locator('#slug').fill(slug);
	await page.getByRole('button', { name: 'Create topic' }).click();
	await expect(page).toHaveURL(/\/admin\/topics\/\d+$/);

	await page.goto('/admin/topics');
	const row = page.locator('tr', { hasText: slug });
	await row.getByRole('button', { name: 'Delete' }).click();
	await page.getByRole('button', { name: 'Delete topic' }).click();
	await expect(toast(page, 'Topic deleted')).toBeVisible();
	await expect(page.locator('tr', { hasText: slug })).toHaveCount(0);
});
