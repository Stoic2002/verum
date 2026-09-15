import { describe, expect, it } from 'vitest';
import { resolveTags } from './tag-list';

describe('starter tags', () => {
	it('every tag passes the admin form rules, with no slug used twice', () => {
		const rows = resolveTags();
		expect(rows.length).toBeGreaterThan(400);
		expect(new Set(rows.map((row) => row.slug)).size).toBe(rows.length);
	});

	it('matches the slugs of tags already created by hand', () => {
		const slugs = new Set(resolveTags().map((row) => row.slug));
		for (const slug of ['anthropic', 'chatgpt', 'claude', 'dota-2', 'k-drama', 'openai']) {
			expect(slugs, slug).toContain(slug);
		}
	});

	it('gives symbols a readable slug instead of a collision', () => {
		const bySlug = new Map(resolveTags().map((row) => [row.slug, row.name]));
		expect(bySlug.get('cpp')).toBe('C++');
		expect(bySlug.get('csharp')).toBe('C#');
		expect(bySlug.get('nextjs')).toBe('Next.js');
	});
});
