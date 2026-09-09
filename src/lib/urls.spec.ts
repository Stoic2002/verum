import { describe, expect, it } from 'vitest';
import * as urls from './urls';

/**
 * These shapes are the contract PRD §12.1 sets, and the reason
 * svelte/no-navigation-without-resolve is switched off for public components:
 * the paths are real but deliberately outside the route tree.
 */
describe('public URL shapes', () => {
	it('prefixes every path with its locale, base locale included', () => {
		expect(urls.home('en')).toBe('/en');
		expect(urls.home('id')).toBe('/id');
		expect(urls.category('en', 'ai')).toBe('/en/ai');
		expect(urls.article('id', 'ai', 'tool-terbaik')).toBe('/id/ai/tool-terbaik');
		expect(urls.tag('en', 'llm')).toBe('/en/tag/llm');
		expect(urls.topic('en', 'openai')).toBe('/en/topic/openai');
		expect(urls.search('id')).toBe('/id/search');
	});

	it('carries no date segment', () => {
		// PRD §12.1: dates in a URL make an article look stale and make the
		// living-article strategy impossible.
		expect(urls.article('en', 'ai', 'slug')).not.toMatch(/\d{4}/);
	});

	it('has no trailing slash', () => {
		expect(urls.home('en')).not.toMatch(/\/$/);
		expect(urls.category('en', 'ai')).not.toMatch(/\/$/);
	});

	it('gives page one a single URL', () => {
		// ?page=1 and the bare path would be two URLs for the same content.
		expect(urls.paged('/en/ai', 1)).toBe('/en/ai');
		expect(urls.paged('/en/ai', 0)).toBe('/en/ai');
		expect(urls.paged('/en/ai', 2)).toBe('/en/ai?page=2');
	});

	it('builds absolute URLs without doubling the slash', () => {
		expect(urls.absolute('https://verum.test', '/en/ai')).toBe('https://verum.test/en/ai');
		expect(urls.absolute('https://verum.test/', '/en/ai')).toBe('https://verum.test/en/ai');
	});
});
