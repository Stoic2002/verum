import { expect, test } from '@playwright/test';

/**
 * The locale reaches request scope from the URL alone, and two locales served
 * at the same time do not bleed into each other (PRD §10.4).
 *
 * The assertions read translated copy rather than a marker element: a
 * module-scope locale leak shows up as the wrong language in the rendered
 * text, which is the failure that actually matters.
 */

const TAGLINE_EN = 'Explained with evidence, not press releases.';
const TAGLINE_ID = 'Dijelaskan dengan bukti, bukan siaran pers.';

test('serves the locale named in the URL', async ({ page }) => {
	await page.goto('/en');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.locator('.footer__tagline')).toHaveText(TAGLINE_EN);

	await page.goto('/id');
	await expect(page.locator('html')).toHaveAttribute('lang', 'id');
	await expect(page.locator('.footer__tagline')).toHaveText(TAGLINE_ID);
});

test('canonicalises an unprefixed path to the base locale', async ({ page }) => {
	const response = await page.goto('/');
	expect(response?.request().redirectedFrom()).not.toBeNull();
	expect(new URL(page.url()).pathname).toBe('/en');

	// One hop, not a chain: /en must not redirect again.
	const direct = await page.goto('/en');
	expect(direct?.request().redirectedFrom()).toBeNull();
});

test.describe('the bare domain picks a language', () => {
	test('Indonesia, by the country Cloudflare resolved', async ({ request }) => {
		const response = await request.get('/', { headers: { 'cf-ipcountry': 'ID' }, maxRedirects: 0 });
		expect(response.status()).toBe(302);
		expect(response.headers()['location']).toBe('/id');
		// Never cached: the next visitor may be somewhere else.
		expect(response.headers()['cache-control']).toContain('no-store');
	});

	test('an Indonesian browser outside Indonesia', async ({ request }) => {
		const response = await request.get('/', {
			headers: { 'cf-ipcountry': 'SG', 'accept-language': 'id-ID,id;q=0.9,en;q=0.8' },
			maxRedirects: 0
		});
		expect(response.headers()['location']).toBe('/id');
	});

	test('everyone else gets English', async ({ request }) => {
		const response = await request.get('/', {
			headers: { 'cf-ipcountry': 'US', 'accept-language': 'en-US' },
			maxRedirects: 0
		});
		expect(response.headers()['location']).toBe('/en');
	});

	test('a saved choice beats the country', async ({ request }) => {
		const response = await request.get('/', {
			headers: { 'cf-ipcountry': 'ID', cookie: 'verum-locale=en' },
			maxRedirects: 0
		});
		expect(response.headers()['location']).toBe('/en');
	});

	test('a locale-prefixed page is never redirected by country', async ({ request }) => {
		const response = await request.get('/en', {
			headers: { 'cf-ipcountry': 'ID' },
			maxRedirects: 0
		});
		expect(response.status()).toBe(200);
	});
});

test('the language switch remembers the choice', async ({ page }) => {
	await page.goto('/en');
	await page
		.getByRole('navigation', { name: 'Language' })
		.getByRole('link', { name: 'ID' })
		.click();
	await expect(page).toHaveURL(/\/id$/);

	const cookies = await page.context().cookies();
	expect(cookies.find((cookie) => cookie.name === 'verum-locale')?.value).toBe('id');
});

test('canonicalises a deep path without losing it', async ({ page }) => {
	await page.goto('/ai/best-ai-coding-tools');
	expect(new URL(page.url()).pathname).toBe('/en/ai/best-ai-coding-tools');
});

test('keeps concurrent locales isolated', async ({ browser }) => {
	// The failure this guards against only appears under concurrency: a locale
	// held in module scope is shared by every in-flight request on the process.
	const [a, b] = await Promise.all([browser.newPage(), browser.newPage()]);

	await Promise.all([a.goto('/en'), b.goto('/id')]);

	await expect(a.locator('html')).toHaveAttribute('lang', 'en');
	await expect(b.locator('html')).toHaveAttribute('lang', 'id');
	await expect(a.locator('.footer__tagline')).toHaveText(TAGLINE_EN);
	await expect(b.locator('.footer__tagline')).toHaveText(TAGLINE_ID);
});
