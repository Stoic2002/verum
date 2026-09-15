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
