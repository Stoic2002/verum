import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The theme script in app.html runs before the first paint, so it has to be
 * inline — and an inline script under a hash-based CSP is only allowed while
 * its hash matches exactly. Editing the script without updating the policy
 * would block it silently: no error, just the flash of the wrong theme that
 * the script exists to prevent.
 */
describe('inline theme script', () => {
	it('matches the hash allowed by the Content Security Policy', () => {
		const html = readFileSync('src/app.html', 'utf8');
		const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
		expect(script, 'app.html should contain one inline script').toBeDefined();

		const hash = `sha256-${createHash('sha256').update(script!).digest('base64')}`;
		const config = readFileSync('vite.config.ts', 'utf8');

		expect(config, `app.html changed; put ${hash} in vite.config.ts script-src`).toContain(hash);
	});
});
