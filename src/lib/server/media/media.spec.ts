import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Sharp } from 'sharp';
import type { Sql } from 'postgres';
import { setupTestDatabase, truncateAll } from '../db/testing';
import type { Database } from '../db/types';
import { deleteMedia, getMediaByIds, pictureFor, uploadImage } from './index';
import { setStorage, type Storage } from './storage';
import { processImage, UploadError } from './process';
import { renderMarkdown, referencedMediaIds } from '../content/render';

let db: Database;
let client: Sql;
let dir: string;
let written: Map<string, Buffer>;

/** An in-memory Storage, so these tests need neither R2 nor a disk. */
function memoryStorage(): Storage {
	return {
		driver: 'fs',
		async put(key, body) {
			written.set(key, body);
		},
		async remove(keys) {
			for (const key of keys) written.delete(key);
		},
		url: (key) => `/media/${key}`
	};
}

const image = (width: number, height: number, format: 'png' | 'jpeg' = 'png') =>
	sharp({ create: { width, height, channels: 3, background: '#4488cc' } })
		.toFormat(format)
		.toBuffer();

beforeAll(async () => {
	({ db, client } = await setupTestDatabase());
	dir = await mkdtemp(join(tmpdir(), 'verum-media-'));
});

beforeEach(async () => {
	await truncateAll(db);
	written = new Map();
	setStorage(memoryStorage());
});

afterAll(async () => {
	setStorage(undefined);
	await client?.end();
	await rm(dir, { recursive: true, force: true });
});

describe('processing', () => {
	it('produces three widths in two formats, plus the original', async () => {
		const processed = await processImage(await image(2400, 1600));

		expect(processed.variants.map((v) => `${v.width}${v.format}`).sort()).toEqual(
			['1280avif', '1280webp', '1920avif', '1920webp', '640avif', '640webp'].sort()
		);
		// Six renditions, and the original kept so breakpoints can change later.
		expect(processed.buffers.size).toBe(7);
		expect(processed.buffers.has(processed.original.key)).toBe(true);
	});

	it('never upscales a small source', async () => {
		const processed = await processImage(await image(400, 300));

		expect(processed.variants.every((v) => v.width <= 400)).toBe(true);
		expect(processed.variants).toHaveLength(2);
	});

	it('keys on content, so the same bytes always land in the same place', async () => {
		const bytes = await image(800, 600);
		const [a, b] = [await processImage(bytes), await processImage(bytes)];

		expect(a.hash).toBe(b.hash);
		expect(a.original.key).toBe(b.original.key);
	});

	it('strips metadata, including GPS from a phone photo', async () => {
		const withExif = await sharp({
			create: { width: 800, height: 600, channels: 3, background: '#fff' }
		})
			// sharp accepts a GPS block at runtime but does not type one; the cast is
			// what lets this test assert the case that actually matters.
			.withExif({ IFD0: { Copyright: 'Somebody' }, GPS: { GPSLatitudeRef: 'N' } } as Parameters<
				Sharp['withExif']
			>[0])
			.jpeg()
			.toBuffer();

		const processed = await processImage(withExif);
		const meta = await sharp(processed.original.body).metadata();

		expect(meta.exif).toBeUndefined();
	});

	it('refuses an SVG', async () => {
		const svg = Buffer.from(
			'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
		);
		// SVG is a script container, not an image format.
		await expect(processImage(svg)).rejects.toBeInstanceOf(UploadError);
	});

	it('refuses a file that is not an image at all', async () => {
		await expect(processImage(Buffer.from('just some text'))).rejects.toBeInstanceOf(UploadError);
		await expect(processImage(Buffer.alloc(0))).rejects.toBeInstanceOf(UploadError);
	});
});

describe('uploading', () => {
	it('writes every rendition and one row', async () => {
		const record = await uploadImage(
			db,
			{ buffer: await image(2000, 1000), name: 'hero.png' },
			{ alt: 'A blue rectangle' }
		);

		expect(written.size).toBe(7);
		expect(record.variants).toHaveLength(6);
		expect(record.alt).toBe('A blue rectangle');
		expect(record.width).toBe(2000);
		expect(record.height).toBe(1000);
	});

	it('does not duplicate a re-uploaded file', async () => {
		const bytes = await image(1000, 800);
		const first = await uploadImage(db, { buffer: bytes, name: 'a.png' }, { alt: 'x' });
		const second = await uploadImage(db, { buffer: bytes, name: 'copy.png' }, { alt: 'x' });

		expect(second.id).toBe(first.id);
		expect((await getMediaByIds(db, [first.id])).size).toBe(1);
	});

	it('deletes the row and every object behind it', async () => {
		const record = await uploadImage(
			db,
			{ buffer: await image(2000, 1200), name: 'x.png' },
			{ alt: 'x' }
		);
		expect(written.size).toBe(7);

		await deleteMedia(db, record.id);

		expect(written.size).toBe(0);
		expect((await getMediaByIds(db, [record.id])).size).toBe(0);
	});
});

describe('picture markup', () => {
	it('offers AVIF before WebP and carries intrinsic dimensions', async () => {
		const record = await uploadImage(
			db,
			{ buffer: await image(1800, 1200), name: 'x.png' },
			{ alt: 'A photo' }
		);
		const picture = pictureFor(record, (key) => `/media/${key}`);

		expect(picture.sources.map((s) => s.type)).toEqual(['image/avif', 'image/webp']);
		expect(picture.sources[0].srcset).toMatch(/\d+w/);
		// Without these the browser cannot reserve the box before the bytes land.
		expect(picture.width).toBe(1800);
		expect(picture.height).toBe(1200);
		expect(picture.alt).toBe('A photo');
	});
});

describe('the ::image directive', () => {
	it('finds the ids a body references', () => {
		expect(referencedMediaIds('a ::image{id=3} b ::image{id="12"} c ::image{id=3}')).toEqual([
			3, 12
		]);
		expect(referencedMediaIds('no images here')).toEqual([]);
	});

	it('renders a full picture element with dimensions and lazy loading', async () => {
		const record = await uploadImage(
			db,
			{ buffer: await image(1600, 900), name: 'x.png' },
			{ alt: 'A chart' }
		);

		const { html } = await renderMarkdown(`::image{id=${record.id} caption="Figure 1"}`, {
			media: await getMediaByIds(db, [record.id]),
			mediaUrl: (key) => `/media/${key}`
		});

		expect(html).toContain('<picture>');
		expect(html).toContain('type="image/avif"');
		expect(html).toContain('width="1600"');
		expect(html).toContain('height="900"');
		expect(html).toContain('alt="A chart"');
		expect(html).toContain('loading="lazy"');
		expect(html).toContain('Figure 1');
	});

	it('shows a visible error for an image that is not in the library', async () => {
		const { html } = await renderMarkdown('::image{id=999}', { media: new Map() });

		expect(html).toContain('embed-error');
		expect(html).toContain('999');
		expect(html).not.toContain('<img');
	});
});
