import { describe, expect, it } from 'vitest';
import { creditLabel, parseCredit, safeCreditUrl } from './credit';

describe('safeCreditUrl', () => {
	it('keeps http and https addresses', () => {
		expect(safeCreditUrl('https://unsplash.com/photos/abc')).toBe(
			'https://unsplash.com/photos/abc'
		);
		expect(safeCreditUrl(' http://example.com ')).toBe('http://example.com/');
	});

	it('drops anything that could run or embed', () => {
		expect(safeCreditUrl('javascript:alert(1)')).toBeNull();
		expect(safeCreditUrl('data:text/html,hi')).toBeNull();
		expect(safeCreditUrl('/relative/path')).toBeNull();
		expect(safeCreditUrl('')).toBeNull();
		expect(safeCreditUrl(null)).toBeNull();
	});
});

describe('parseCredit', () => {
	it('requires a credit', () => {
		expect(parseCredit('  ', '')).toMatchObject({ ok: false });
	});

	it('accepts a credit with no link', () => {
		expect(parseCredit(' VERUM ', '')).toEqual({ ok: true, credit: 'VERUM', creditUrl: null });
	});

	it('refuses a link that is not http or https', () => {
		expect(parseCredit('Jane Doe / Unsplash', 'javascript:alert(1)')).toMatchObject({ ok: false });
	});

	it('refuses an overlong credit', () => {
		expect(parseCredit('x'.repeat(201), '')).toMatchObject({ ok: false });
	});
});

describe('creditLabel', () => {
	it('follows the locale', () => {
		expect(creditLabel('id')).toBe('Gambar');
		expect(creditLabel('en')).toBe('Image');
	});
});
