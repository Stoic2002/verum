import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import type { Sql } from 'postgres';
import { setupTestDatabase, truncateAll } from '../db/testing';
import type { Database } from '../db/types';
import { media } from '../db/schema';
import { encodeMediaCursor, listMedia, listMediaAfter, parseMediaCursor } from './index';

let db: Database;
let client: Sql;

const row = (i: number, createdAt: Date) => ({
	r2Key: `img/cursor${i}/original.png`,
	originalName: `photo-${i}.png`,
	mimeType: 'image/png',
	width: 10,
	height: 10,
	bytes: 1,
	alt: `Photo ${i}`,
	variants: [],
	createdAt
});

beforeAll(async () => {
	({ db, client } = await setupTestDatabase());
});

beforeEach(async () => {
	await truncateAll(db);
});

afterAll(async () => {
	await client?.end();
});

/** Walks the whole library through the picker's cursor, collecting ids. */
async function walk(search = '') {
	const ids: number[] = [];
	let after = null;
	for (let guard = 0; guard < 50; guard++) {
		const page = await listMediaAfter(db, { limit: 24, search, after });
		ids.push(...page.items.map((item) => item.id));
		if (!page.nextCursor) break;
		after = parseMediaCursor(page.nextCursor);
	}
	return ids;
}

describe('cursor paging for the picker', () => {
	it('visits every image exactly once', async () => {
		const now = Date.now();
		await db
			.insert(media)
			.values(Array.from({ length: 130 }, (_, i) => row(i, new Date(now - i * 1000))));

		const ids = await walk();
		expect(ids).toHaveLength(130);
		expect(new Set(ids).size).toBe(130);
	});

	it('counts what is left after the page it returns', async () => {
		const now = Date.now();
		await db
			.insert(media)
			.values(Array.from({ length: 30 }, (_, i) => row(i, new Date(now - i * 1000))));

		const first = await listMediaAfter(db, { limit: 24 });
		expect(first.items).toHaveLength(24);
		expect(first.left).toBe(6);
		expect(first.nextCursor).not.toBeNull();

		const second = await listMediaAfter(db, {
			limit: 24,
			after: parseMediaCursor(first.nextCursor!)
		});
		expect(second.items).toHaveLength(6);
		expect(second.left).toBe(0);
		expect(second.nextCursor).toBeNull();
	});

	it('does not repeat an image when a new one is uploaded between loads', async () => {
		// The failure offset paging had: the new row shifts the window by one,
		// the next page repeats the last image, and a keyed #each throws.
		const now = Date.now();
		await db
			.insert(media)
			.values(Array.from({ length: 30 }, (_, i) => row(i, new Date(now - i * 1000))));

		const first = await listMediaAfter(db, { limit: 24 });
		await db.insert(media).values(row(999, new Date(now + 60_000)));
		const second = await listMediaAfter(db, {
			limit: 24,
			after: parseMediaCursor(first.nextCursor!)
		});

		const firstIds = new Set(first.items.map((i) => i.id));
		expect(second.items.some((i) => firstIds.has(i.id))).toBe(false);
		expect(first.items.length + second.items.length).toBe(30);
	});

	it('splits rows with an identical timestamp across pages without losing any', async () => {
		const same = new Date('2026-09-10T06:00:00.000Z');
		await db.insert(media).values(Array.from({ length: 50 }, (_, i) => row(i, same)));

		const ids = await walk();
		expect(new Set(ids).size).toBe(50);
	});

	it('does not skip rows created later within the same millisecond', async () => {
		// created_at has microseconds; a cursor rounded to milliseconds would
		// jump over every row between the rounded value and the real one.
		const values = Array.from({ length: 30 }, (_, i) => {
			const micro = String(100 + i).padStart(6, '0');
			return sql`(${`img/micro${i}/original.png`}, ${`micro-${i}.png`}, 'image/png', 10, 10, 1, '', '[]'::jsonb,
				${`2026-09-10 06:00:00.${micro}+00`}::timestamptz)`;
		});
		await db.execute(sql`
			INSERT INTO media (r2_key, original_name, mime_type, width, height, bytes, alt, variants, created_at)
			VALUES ${sql.join(values, sql`, `)}
		`);

		const ids = await walk();
		expect(new Set(ids).size).toBe(30);
	});

	it('applies search together with the cursor', async () => {
		const now = Date.now();
		await db.insert(media).values(
			Array.from({ length: 60 }, (_, i) => ({
				...row(i, new Date(now - i * 1000)),
				originalName: i % 2 === 0 ? `diagram-${i}.png` : `photo-${i}.png`
			}))
		);

		const ids = await walk('diagram');
		expect(ids).toHaveLength(30);
	});
});

describe('cursor encoding', () => {
	it('round-trips', () => {
		const cursor = { createdAt: '2026-09-10 06:22:22.123456+00', id: 42 };
		expect(parseMediaCursor(encodeMediaCursor(cursor))).toEqual(cursor);
	});

	it('rejects anything it did not produce', () => {
		for (const bad of [
			'',
			'not-base64-at-all',
			Buffer.from('no separator').toString('base64url'),
			Buffer.from('2026-09-10 06:00:00+00|-1').toString('base64url'),
			Buffer.from('2026-09-10 06:00:00+00|abc').toString('base64url'),
			Buffer.from("'); DROP TABLE media; --|5").toString('base64url')
		]) {
			expect(parseMediaCursor(bad), bad).toBeNull();
		}
	});
});

describe('offset paging stays deterministic', () => {
	it('orders identical timestamps by id, so page boundaries do not shift', async () => {
		const same = new Date('2026-09-10T06:00:00.000Z');
		await db.insert(media).values(Array.from({ length: 60 }, (_, i) => row(i, same)));

		const seen = new Set<number>();
		for (let offset = 0; offset < 60; offset += 24) {
			const { items } = await listMedia(db, { limit: 24, offset });
			for (const item of items) {
				expect(seen.has(item.id)).toBe(false);
				seen.add(item.id);
			}
		}
		expect(seen.size).toBe(60);
	});
});
