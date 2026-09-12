import { expect, test } from '@playwright/test';

/**
 * A Content Security Policy fails silently: the page still renders, the script
 * just never runs. Without a test watching the console, a policy that blocks
 * hydration or the theme script looks fine until a reader reports it.
 */

const PAGES = ['/en', '/en/ai', '/en/search?q=test', '/admin/login'];

test('every page type loads without a policy violation', async ({ page }) => {
	const violations: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error' && /content security policy|refused to/i.test(message.text())) {
			violations.push(message.text());
		}
	});

	for (const path of PAGES) {
		await page.goto(path);
		await page.waitForLoadState('networkidle');
	}

	expect(violations, violations.join('\n')).toEqual([]);
});

test('the policy is sent, and allows only what the site needs', async ({ request }) => {
	const csp = (await request.get('/en')).headers()['content-security-policy'];

	expect(csp).toContain("default-src 'self'");
	// SvelteKit's own inline script and the theme script, both by hash.
	expect(csp).toMatch(/script-src 'self'( 'sha256-[^']+')+/);
	expect(csp).toContain("object-src 'none'");
	expect(csp).toContain("frame-ancestors 'none'");
	expect(csp).toContain('frame-src https://www.youtube-nocookie.com');
	// No escape hatches for scripts, whatever else the policy allows.
	expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
	expect(csp).not.toContain('unsafe-eval');
});

test('the theme still applies before paint, so the hash really matches', async ({ page }) => {
	await page.goto('/en');
	await page.evaluate(() => localStorage.setItem('verum-theme', 'dark'));
	await page.reload();

	// Set by the inline script in app.html; if CSP blocked it, this is absent.
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
