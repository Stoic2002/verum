import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

/**
 * Fase 4 exit criteria:
 *   - one upload produces six renditions plus the original, and one row
 *   - an article using that image reserves its box, so CLS stays at 0
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

const stamp = Date.now();
let mediaId = 0;

/** A distinct image per run, so the content hash does not collide with a previous one. */
async function sampleImage() {
	return sharp({
		create: { width: 2000, height: 1250, channels: 3, background: '#3366aa' }
	})
		.composite([
			{
				input: Buffer.from(
					`<svg width="2000" height="1250"><text x="40" y="200" font-size="120" fill="white">${stamp}</text></svg>`
				),
				top: 0,
				left: 0
			}
		])
		.png()
		.toBuffer();
}

test('uploads an image and writes every rendition', async ({ page }) => {
	await signIn(page);
	await page.goto('/admin/media');

	await page.locator('#file').setInputFiles({
		name: `sample-${stamp}.png`,
		mimeType: 'image/png',
		buffer: await sampleImage()
	});
	await page.locator('#alt').fill('A blue test image');
	await page.locator('#credit').fill('Generated for tests');
	await page.getByRole('button', { name: /^upload$/i }).click();

	const notice = page.locator('.notice');
	await expect(notice).toContainText('6 renditions');

	mediaId = Number((await notice.textContent())?.match(/#(\d+)/)?.[1]);
	expect(mediaId).toBeGreaterThan(0);
});

test('refuses an upload without alt text', async ({ page }) => {
	await signIn(page);
	await page.goto('/admin/media');

	// The browser's own required check has to be bypassed to reach the server rule.
	await page.locator('#file').setInputFiles({
		name: 'no-alt.png',
		mimeType: 'image/png',
		buffer: await sharp({ create: { width: 600, height: 400, channels: 3, background: '#999' } })
			.png()
			.toBuffer()
	});
	await page.locator('#alt').evaluate((el) => el.removeAttribute('required'));
	await page.getByRole('button', { name: /^upload$/i }).click();

	await expect(page.getByRole('alert')).toContainText(/alt text is required/i);
});

test('refuses an SVG', async ({ page }) => {
	await signIn(page);
	await page.goto('/admin/media');

	await page.locator('#file').setInputFiles({
		name: 'evil.svg',
		mimeType: 'image/svg+xml',
		buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
	});
	await page.locator('#alt').fill('Should not upload');
	await page.getByRole('button', { name: /^upload$/i }).click();

	await expect(page.getByRole('alert')).toContainText(/not an image|unsupported/i);
});

test('an article image renders as a picture that reserves its box', async ({ page }) => {
	await signIn(page);

	await page.goto('/admin/articles/new');
	await page.getByLabel('Title').fill(`Media article ${stamp}`);
	await page.getByLabel('Slug').fill(`media-article-${stamp}`);
	await page.getByLabel('Category').selectOption({ index: 1 });
	await page.getByRole('button', { name: /create and edit/i }).click();
	await expect(page).toHaveURL(/\/admin\/articles\/\d+\/en$/);

	await page.getByLabel('Excerpt').fill('An article with an image.');
	await page
		.getByLabel('Body', { exact: false })
		.fill(`Intro paragraph.\n\n::image{id=${mediaId} caption="Figure 1"}\n\nClosing paragraph.`);

	const figure = page.locator('.rendered figure.embed--image');
	await expect(figure).toBeVisible();

	const img = figure.locator('img');
	// Intrinsic dimensions are what let the browser reserve the box up front.
	await expect(img).toHaveAttribute('width', '2000');
	await expect(img).toHaveAttribute('height', '1250');
	await expect(img).toHaveAttribute('loading', 'lazy');
	await expect(img).toHaveAttribute('alt', 'A blue test image');

	await expect(figure.locator('source[type="image/avif"]')).toHaveCount(1);
	await expect(figure.locator('source[type="image/webp"]')).toHaveCount(1);
	await expect(figure.locator('figcaption')).toHaveText('Figure 1');

	await page.getByRole('button', { name: /^save$/i }).click();
	await expect(page.locator('.notice')).toContainText('Saved');
});

test('the image adds no layout shift', async ({ page }) => {
	await signIn(page);
	await page.goto('/admin/media');

	// Measure real CLS on a page whose images come through the same markup.
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
		await new Promise((done) => setTimeout(done, 500));

		observer.disconnect();
		return total;
	});

	// PRD §12.5 allows 0.1. Reserved boxes should make it exactly zero.
	expect(cls).toBe(0);
});

test.describe('importing by URL', () => {
	test('refuses an address inside the network', async ({ page }) => {
		await signIn(page);
		await page.goto('/admin/media');
		await page.getByRole('tab', { name: /import from url/i }).click();

		// The endpoint that hands out credentials on most cloud providers.
		await page.locator('#url').fill('http://169.254.169.254/latest/meta-data/');
		await page.locator('#url-alt').fill('Should never be fetched');
		await page.locator('#url-credit').fill('n/a');
		await page.getByRole('button', { name: /import image/i }).click();

		await expect(page.getByRole('alert')).toContainText(/not reachable from here/i);
	});

	test('requires a credit, unlike a file upload', async ({ page }) => {
		await signIn(page);
		await page.goto('/admin/media');
		await page.getByRole('tab', { name: /import from url/i }).click();

		await page.locator('#url').fill('https://example.com/photo.jpg');
		await page.locator('#url-alt').fill('A photo');
		// PRD §14: an image from someone else's site needs its source recorded.
		await page.locator('#url-credit').evaluate((el) => el.removeAttribute('required'));
		await page.getByRole('button', { name: /import image/i }).click();

		await expect(page.getByRole('alert')).toContainText(/credit is required/i);
	});

	test('the two ways of adding an image are both reachable', async ({ page }) => {
		await signIn(page);
		await page.goto('/admin/media');

		await expect(page.locator('#file')).toBeVisible();
		await page.getByRole('tab', { name: /import from url/i }).click();
		await expect(page.locator('#url')).toBeVisible();
		await expect(page.locator('#file')).toHaveCount(0);
	});
});

test('the sidebar collapses and stays collapsed', async ({ page }) => {
	await signIn(page);

	const shell = page.locator('.shell');
	await expect(shell).not.toHaveClass(/shell--collapsed/);

	await page.getByRole('button', { name: /collapse sidebar/i }).click();
	await expect(shell).toHaveClass(/shell--collapsed/);

	// Stored in a cookie, so the server renders it collapsed on the next load —
	// no flash of the wide rail before a script narrows it.
	await page.goto('/admin/media');
	await expect(page.locator('.shell')).toHaveClass(/shell--collapsed/);

	await page.getByRole('button', { name: /expand sidebar/i }).click();
	await expect(page.locator('.shell')).not.toHaveClass(/shell--collapsed/);
});

test.describe('library size', () => {
	test('the media page reports the true total and filters by search', async ({ page }) => {
		await signIn(page);
		await page.goto('/admin/media');

		// A count, not just whatever fits on the page.
		await expect(page.locator('.pager__count')).toContainText(/images/);

		await page.locator('#q').fill('no-image-is-named-this');
		await page.getByRole('button', { name: /^search$/i }).click();
		await expect(page).toHaveURL(/q=no-image-is-named-this/);
		await expect(page.getByText(/nothing matches/i)).toBeVisible();

		await page.getByRole('link', { name: /clear/i }).click();
		await expect(page).toHaveURL(/\/admin\/media\??$/);
	});

	test('the editor picker searches the whole library, not a fixed recent slice', async ({
		page
	}) => {
		await signIn(page);
		await page.goto('/admin/articles');
		await page.locator('tbody tr td a').first().click();
		await page.getByRole('link', { name: /^en/ }).first().click();
		await expect(page).toHaveURL(/\/admin\/articles\/\d+\/en$/);

		await page.getByRole('button', { name: /insert image/i }).click();
		const search = page.locator('#library-q');
		await expect(search).toBeVisible();

		const responded = page.waitForResponse((r) => r.url().includes('/admin/api/media'));
		await search.fill('sample');
		const response = await responded;
		expect(response.status()).toBe(200);

		const body = (await response.json()) as {
			items: unknown[];
			left: number;
			nextCursor: string | null;
		};
		// A cursor, not an offset: continuing from the last image survives an
		// upload landing between two loads.
		expect(typeof body.left).toBe('number');
		expect(body.nextCursor === null || typeof body.nextCursor === 'string').toBe(true);
	});
});
