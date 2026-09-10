import { desc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../db/types';
import { media } from '../db/schema';
import { cleanOriginalName, processImage } from './process';
import { getStorage } from './storage';
import type { MediaRecord } from './types';

export { MAX_UPLOAD_BYTES, UploadError } from './process';
export { getStorage, mediaFsRoot, setStorage, type Storage } from './storage';
export { ARTICLE_IMAGE_SIZES, pictureFor, type PictureSource } from './picture';
export { fetchImageFromUrl } from './fetch-url';

export type { MediaRecord } from './types';

/**
 * Processes an upload, stores every rendition, and records one row.
 *
 * Objects are written before the row, so a failure halfway leaves orphaned
 * objects rather than a row pointing at files that are not there. Orphans cost
 * a few cents; a broken image on a published article costs a reader.
 */
export async function uploadImage(
	db: Database,
	file: { buffer: Buffer; name: string },
	meta: { alt: string; credit?: string | null }
): Promise<MediaRecord> {
	const processed = await processImage(file.buffer);
	const storage = getStorage();

	const [existing] = await db.select().from(media).where(eq(media.r2Key, processed.original.key));
	if (existing) {
		// Same bytes, same content hash, same key. Re-uploading a file already in
		// the library returns what is there instead of duplicating it.
		return existing as MediaRecord;
	}

	for (const [key, { body, contentType }] of processed.buffers) {
		await storage.put(key, body, contentType);
	}

	const [row] = await db
		.insert(media)
		.values({
			r2Key: processed.original.key,
			originalName: cleanOriginalName(file.name),
			mimeType: processed.mimeType,
			width: processed.width,
			height: processed.height,
			bytes: processed.bytes,
			alt: meta.alt.trim(),
			credit: meta.credit?.trim() || null,
			variants: processed.variants
		})
		.returning();

	return row as MediaRecord;
}

export async function listMedia(db: Database, limit = 100) {
	return db.select().from(media).orderBy(desc(media.createdAt)).limit(limit) as Promise<
		MediaRecord[]
	>;
}

export async function getMedia(db: Database, id: number) {
	const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
	return (row as MediaRecord | undefined) ?? null;
}

export async function getMediaByIds(db: Database, ids: number[]) {
	if (ids.length === 0) return new Map<number, MediaRecord>();

	const numeric = ids.filter((id) => Number.isInteger(id));
	if (numeric.length === 0) return new Map<number, MediaRecord>();

	const rows = (await db.select().from(media).where(inArray(media.id, numeric))) as MediaRecord[];

	return new Map(rows.map((row) => [row.id, row]));
}

export async function updateMediaMeta(
	db: Database,
	id: number,
	meta: { alt: string; credit?: string | null }
) {
	await db
		.update(media)
		.set({ alt: meta.alt.trim(), credit: meta.credit?.trim() || null })
		.where(eq(media.id, id));
}

/**
 * Deletes a row and every object behind it.
 *
 * The row goes first: an article referencing a missing row is a broken page,
 * while an object with no row is invisible and costs a fraction of a cent.
 * `cover_media_id` is ON DELETE SET NULL, so an article survives losing its
 * cover image.
 */
export async function deleteMedia(db: Database, id: number) {
	const row = await getMedia(db, id);
	if (!row) return;

	await db.delete(media).where(eq(media.id, id));

	const keys = [row.r2Key, ...row.variants.map((variant) => variant.key)];
	await getStorage().remove(keys);
}
