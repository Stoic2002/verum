import { describe, expect, it } from 'vitest';
import { createPreviewToken, verifyPreviewToken } from './preview-token';

describe('preview tokens', () => {
	it('round-trips the article, locale and expiry', () => {
		const token = createPreviewToken(42, 'id');
		const claim = verifyPreviewToken(token);

		expect(claim?.articleId).toBe(42);
		expect(claim?.locale).toBe('id');
		expect(claim?.expiresAt.getTime()).toBeGreaterThan(Date.now());
	});

	it('rejects a token whose payload was edited', () => {
		const token = createPreviewToken(1, 'en');
		const [, locale, exp, signature] = token.split('.');

		// Swapping the article id keeps the signature, which is the point.
		expect(verifyPreviewToken(`999.${locale}.${exp}.${signature}`)).toBeNull();
	});

	it('rejects a self-extended expiry', () => {
		const token = createPreviewToken(1, 'en');
		const [id, locale, , signature] = token.split('.');
		const farFuture = Date.now() + 10 * 365 * 24 * 60 * 60 * 1000;

		// The expiry is inside what the signature covers, so it cannot be raised.
		expect(verifyPreviewToken(`${id}.${locale}.${farFuture}.${signature}`)).toBeNull();
	});

	it('rejects an expired token', () => {
		expect(verifyPreviewToken(createPreviewToken(1, 'en', -1000))).toBeNull();
	});

	it('rejects a token for a locale the site does not serve', () => {
		const token = createPreviewToken(1, 'en');
		const [id, , exp, signature] = token.split('.');

		expect(verifyPreviewToken(`${id}.de.${exp}.${signature}`)).toBeNull();
	});

	it('rejects malformed input without throwing', () => {
		for (const bad of ['', 'x', 'a.b.c', 'a.b.c.d.e', '1.en.notanumber.sig']) {
			expect(verifyPreviewToken(bad)).toBeNull();
		}
	});
});
