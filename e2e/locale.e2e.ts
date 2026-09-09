import { expect, test } from '@playwright/test';

/**
 * Fase 0 exit criterion: the locale reaches request scope from the URL, and two
 * locales served concurrently do not bleed into each other (PRD §10.4).
 */

test('serves the locale named in the URL', async ({ page }) => {
	await page.goto('/en');
	await expect(page.getByTestId('locale')).toHaveText('en');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');

	await page.goto('/id');
	await expect(page.getByTestId('locale')).toHaveText('id');
	await expect(page.locator('html')).toHaveAttribute('lang', 'id');
});

test('canonicalises an unprefixed path to the base locale', async ({ page }) => {
	const response = await page.goto('/');
	expect(response?.request().redirectedFrom()).not.toBeNull();
	expect(new URL(page.url()).pathname).toBe('/en');

	// One hop, not a chain: /en must not redirect again.
	const direct = await page.goto('/en');
	expect(direct?.request().redirectedFrom()).toBeNull();
});

test('keeps concurrent locales isolated', async ({ browser }) => {
	// The failure this guards against only appears under concurrency: a locale
	// held in module scope is shared by every in-flight request on the process.
	const [a, b] = await Promise.all([browser.newPage(), browser.newPage()]);

	await Promise.all([a.goto('/en'), b.goto('/id')]);

	await expect(a.getByTestId('locale')).toHaveText('en');
	await expect(b.getByTestId('locale')).toHaveText('id');
});
