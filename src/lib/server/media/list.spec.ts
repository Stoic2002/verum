import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Sql } from 'postgres';
import { setupTestDatabase, truncateAll } from '../db/testing';
import type { Database } from '../db/types';
import { media } from '../db/schema';
import { listMedia } from './index';

/**
 * The library used to be capped at the newest hundred rows with no way past
 * them, so image 101 existed in storage and could not be found or inserted.
 */
let db: Database;
let client: Sql;

beforeAll(async () => {
	({ db, client } = await setupTestDatabase());
});

beforeEach(async () => {
	await truncateAll(db);
	const now = Date.now();
	await db.insert(media).values(
		Array.from({ length: 130 }, (_, i) => ({
			r2Key: `img/test${i}/original.png`,
			originalName: i === 7 ? 'launch-screenshot.png' : `photo-${i}.png`,
			mimeType: 'image/png',
			width: 100,
			height: 100,
			bytes: 1000,
			alt: i === 42 ? 'A terminal showing the benchmark output' : `Photo ${i}`,
			variants: [],
			// Spread out so newest-first ordering is deterministic.
			createdAt: new Date(now - i * 60_000)
		}))
	);
});

afterAll(async () => {
	await client?.end();
});

describe('media library paging', () => {
	it('reports the true total, not the page size', async () => {
		const { items, total } = await listMedia(db, { limit: 24 });
		expect(items).toHaveLength(24);
		expect(total).toBe(130);
	});

	it('reaches rows past the old hundred-row ceiling', async () => {
		const { items } = await listMedia(db, { limit: 24, offset: 120 });
		expect(items).toHaveLength(10);
		expect(items.at(-1)?.originalName).toBe('photo-129.png');
	});

	it('pages without overlap or gaps', async () => {
		const seen = new Set<number>();
		for (let offset = 0; offset < 130; offset += 24) {
			const { items } = await listMedia(db, { limit: 24, offset });
			for (const item of items) {
				expect(seen.has(item.id)).toBe(false);
				seen.add(item.id);
			}
		}
		expect(seen.size).toBe(130);
	});

	it('returns newest first', async () => {
		const { items } = await listMedia(db, { limit: 3 });
		expect(items.map((i) => i.originalName)).toEqual(['photo-0.png', 'photo-1.png', 'photo-2.png']);
	});

	it('searches filename and alt text, with the total matching the filter', async () => {
		const byName = await listMedia(db, { search: 'launch' });
		expect(byName.items.map((i) => i.originalName)).toEqual(['launch-screenshot.png']);
		expect(byName.total).toBe(1);

		const byAlt = await listMedia(db, { search: 'benchmark' });
		expect(byAlt.items).toHaveLength(1);
		expect(byAlt.items[0].alt).toContain('benchmark');
	});

	it('treats search as literal text, not SQL', async () => {
		const { items, total } = await listMedia(db, { search: "' OR 1=1 --" });
		expect(items).toHaveLength(0);
		expect(total).toBe(0);
	});

	it('clamps an absurd page size', async () => {
		const { items } = await listMedia(db, { limit: 100_000 });
		expect(items.length).toBeLessThanOrEqual(100);
	});

	it('returns zero total when nothing matches', async () => {
		expect(await listMedia(db, { search: 'zzz-nothing' })).toEqual({ items: [], total: 0 });
	});
});
