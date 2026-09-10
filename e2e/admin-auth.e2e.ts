import { expect, test } from '@playwright/test';

/**
 * Fase 2 exit criteria: /admin is unreachable without a session, the login
 * endpoint is rate limited, and admin responses are never cached.
 *
 * Credentials come from the seed (src/lib/server/db/seed.ts), which
 * global-setup.ts runs before the suite.
 */
const EMAIL = 'admin@verum.local';
const PASSWORD = 'verum-dev-password';

async function signIn(page: import('@playwright/test').Page, password = PASSWORD, email = EMAIL) {
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: /sign in/i }).click();
}

test.describe.configure({ mode: 'serial' });

test('admin is unreachable without a session', async ({ page }) => {
	await page.goto('/admin');

	await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
	await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
});

test('rejects a wrong password without revealing which field was wrong', async ({ page }) => {
	await page.goto('/admin/login');
	await signIn(page, 'not-the-password');

	const error = page.getByRole('alert');
	await expect(error).toHaveText(/incorrect username, email or password/i);
	// The same message whether the account exists or not, so the form never
	// confirms which usernames or addresses are real.
	await expect(error).not.toContainText(/account|exists|not found/i);
	await expect(page).toHaveURL(/\/admin\/login/);
});

test('signs in, serves the dashboard uncached, and signs out again', async ({ page }) => {
	await page.goto('/admin/login');
	await signIn(page);

	await expect(page).toHaveURL('/admin');
	await expect(page.getByTestId('admin-email')).toHaveText(EMAIL);

	// Admin pages must never be stored by a CDN or a browser (PRD §10.3).
	const response = await page.goto('/admin');
	expect(response?.headers()['cache-control']).toContain('no-store');
	expect(response?.headers()['x-robots-tag']).toContain('noindex');
	expect(response?.headers()['x-frame-options']).toBe('DENY');

	// Visiting the login page while signed in bounces to the dashboard.
	await page.goto('/admin/login');
	await expect(page).toHaveURL('/admin');

	await page.getByRole('button', { name: /sign out/i }).click();
	await expect(page).toHaveURL(/\/admin\/login/);

	// The session is gone server-side, not just from this tab.
	await page.goto('/admin');
	await expect(page).toHaveURL(/\/admin\/login/);
});

test('ignores an off-site ?next= instead of following it', async ({ page }) => {
	await page.goto('/admin/login?next=https://example.com/phish');
	await signIn(page);

	await expect(page).toHaveURL('/admin');
});

test('returns to the requested page after signing in', async ({ page }) => {
	await page.goto('/admin/login?next=%2Fadmin%3Ftab%3Ddrafts');
	await signIn(page);

	await expect(page).toHaveURL('/admin?tab=drafts');
});

// Last: this exhausts the attempt budget for the process under test.
test('rate limits repeated failed logins', async ({ page }) => {
	const email = 'brute-force-target@verum.local';
	let limited = false;

	for (let attempt = 1; attempt <= 8 && !limited; attempt++) {
		await page.goto('/admin/login');
		await signIn(page, `wrong-${attempt}`, email);

		const message = await page.getByRole('alert').textContent();
		limited = /too many attempts/i.test(message ?? '');
	}

	expect(limited).toBe(true);
});

test('signs in with a username as well as an address', async ({ page }) => {
	// The seed gives the admin account the username `admin`.
	await page.goto('/admin/login');
	await signIn(page, PASSWORD, 'admin');

	await expect(page).toHaveURL('/admin');
	await expect(page.getByTestId('admin-email')).toHaveText(EMAIL);
});

test('is case-insensitive about the identifier', async ({ page }) => {
	await page.goto('/admin/login');
	await signIn(page, PASSWORD, 'ADMIN');

	await expect(page).toHaveURL('/admin');
});
