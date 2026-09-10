import { describe, expect, it } from 'vitest';
import { clamp, hreflangLinks, DESCRIPTION_MAX, TITLE_MAX } from './seo';

describe('clamp', () => {
	it('leaves short text alone', () => {
		expect(clamp('Short title', TITLE_MAX)).toBe('Short title');
	});

	it('collapses whitespace', () => {
		expect(clamp('  too   many\nspaces ', 40)).toBe('too many spaces');
	});

	it('cuts on a word boundary, not mid-word', () => {
		const source = 'Comparing AI coding assistants on a real refactoring task';
		const result = clamp(source, 30);

		expect(result.length).toBeLessThanOrEqual(30);
		expect(result.endsWith('…')).toBe(true);

		// A cut in the middle of a word reads as a typo, so whatever survives has
		// to be followed by a space in the original.
		const kept = result.slice(0, -1);
		expect(source.startsWith(kept)).toBe(true);
		expect(source[kept.length]).toBe(' ');
	});

	it('falls back to a hard cut when one word is longer than the budget', () => {
		const result = clamp('Supercalifragilisticexpialidocious', 12);

		expect(result.length).toBeLessThanOrEqual(12);
		expect(result.endsWith('…')).toBe(true);
	});

	it('respects the PRD caps', () => {
		const long = 'word '.repeat(80);
		expect(clamp(long, TITLE_MAX).length).toBeLessThanOrEqual(TITLE_MAX);
		expect(clamp(long, DESCRIPTION_MAX).length).toBeLessThanOrEqual(DESCRIPTION_MAX);
	});
});

describe('hreflang clusters', () => {
	const canonical = 'https://verum.test/en/ai/slug';

	it('includes a self-reference', () => {
		// Google requires it; a cluster without one is ignored entirely.
		const links = hreflangLinks(canonical, [], 'en');
		expect(links).toContainEqual({ hreflang: 'en', href: canonical });
	});

	it('points x-default at the English version', () => {
		const links = hreflangLinks(canonical, [], 'en');
		expect(links).toContainEqual({ hreflang: 'x-default', href: canonical });
	});

	it('adds the other locale when it really exists', () => {
		const links = hreflangLinks(
			canonical,
			[{ locale: 'id', href: 'https://verum.test/id/ai/slug-lain' }],
			'en'
		);

		expect(links.map((l) => l.hreflang).sort()).toEqual(['en', 'id', 'x-default']);
	});

	it('never announces a locale the page does not have', () => {
		// PRD §7: an article may exist in English alone. Claiming otherwise
		// breaks the cluster for both languages.
		const links = hreflangLinks(canonical, [], 'en');
		expect(links.some((l) => l.hreflang === 'id')).toBe(false);
	});

	it('omits x-default when there is no English version', () => {
		const idOnly = 'https://verum.test/id/ai/slug';
		const links = hreflangLinks(idOnly, [], 'id');

		expect(links).toEqual([{ hreflang: 'id', href: idOnly }]);
	});

	it('does not duplicate the current locale', () => {
		const links = hreflangLinks(canonical, [{ locale: 'en', href: canonical }], 'en');

		expect(links.filter((l) => l.hreflang === 'en')).toHaveLength(1);
	});
});
