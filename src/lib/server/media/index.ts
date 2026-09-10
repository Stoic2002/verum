import { eq, inArray, sql, type SQL } from 'drizzle-orm';
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

/**
 * A page of the media library, newest first, optionally filtered.
 *
 * Offset paging rather than a keyset cursor. At this scale — a few hundred
 * articles carrying two or three images each — Postgres discarding a few
 * hundred rows costs nothing, and a cursor would trade that for the ability to
 * jump to a page, which is the thing a library view is actually used for.
 * Keyset becomes worth it somewhere past ten thousand rows.
 */
export async function listMedia(
	db: Database,
	{ limit = 24, offset = 0, search = '' }: { limit?: number; offset?: number; search?: string } = {}
) {
	const filter = search.trim()
		? sql`WHERE m.original_name ILIKE ${'%' + search.trim() + '%'} OR m.alt ILIKE ${'%' + search.trim() + '%'}`
		: sql``;

	const rows = await db.execute<MediaRecord & { total: number }>(sql`
		SELECT
			m.id, m.r2_key AS "r2Key", m.original_name AS "originalName", m.mime_type AS "mimeType",
			m.width, m.height, m.bytes, m.alt, m.credit, m.variants,
			count(*) OVER ()::int AS total
		FROM media m
		${filter}
		ORDER BY m.created_at DESC, m.id DESC
		LIMIT ${Math.min(Math.max(limit, 1), 100)} OFFSET ${Math.max(offset, 0)}
	`);

	const list = Array.from(rows);
	return { items: list as MediaRecord[], total: Number(list[0]?.total ?? 0) };
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

/**
 * Position in the media library, as handed to and back from the picker.
 *
 * The timestamp travels as Postgres's own text rendering, not as a JavaScript
 * Date. `created_at` has microsecond precision and a Date has milliseconds:
 * rounding the cursor to the millisecond would make `(created_at, id) < cursor`
 * silently skip every row created later within that same millisecond.
 */
export type MediaCursor = { createdAt: string; id: number };

const TIMESTAMP_TEXT =
	/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}(:?\d{2})?|Z)?$/;

export function encodeMediaCursor(cursor: MediaCursor): string {
	return Buffer.from(`${cursor.createdAt}|${cursor.id}`).toString('base64url');
}

/** Null for anything that is not a cursor this module produced. */
export function parseMediaCursor(raw: string): MediaCursor | null {
	const decoded = Buffer.from(raw, 'base64url').toString('utf8');
	const split = decoded.lastIndexOf('|');
	if (split < 1) return null;

	const createdAt = decoded.slice(0, split);
	const id = Number(decoded.slice(split + 1));

	if (!Number.isInteger(id) || id <= 0) return null;
	if (!TIMESTAMP_TEXT.test(createdAt)) return null;

	return { createdAt, id };
}

/**
 * The media library as a feed, for the editor's picker.
 *
 * A cursor rather than an offset. The picker loads more on request, and images
 * can be uploaded between two loads — from another tab, or from the media page
 * while the editor is open. With an offset each insertion shifts the window by
 * one, so the next load repeats an image already shown; the picker keys its
 * list by id, and Svelte throws on a duplicate key. A cursor anchored on the
 * last row seen is unaffected by anything that arrives above it.
 *
 * The media page keeps offset paging on purpose: it jumps to page numbers,
 * which a cursor cannot do, and a shifted window there is a cosmetic repeat
 * rather than an error.
 */
export async function listMediaAfter(
	db: Database,
	{
		limit = 24,
		search = '',
		after = null
	}: { limit?: number; search?: string; after?: MediaCursor | null } = {}
): Promise<{ items: MediaRecord[]; left: number; nextCursor: string | null }> {
	const size = Math.min(Math.max(limit, 1), 100);
	const term = search.trim();

	const conditions: SQL[] = [];
	if (term) {
		conditions.push(
			sql`(m.original_name ILIKE ${'%' + term + '%'} OR m.alt ILIKE ${'%' + term + '%'})`
		);
	}
	if (after) {
		// Row comparison, so equal timestamps fall through to the id instead of
		// being dropped or repeated at a page boundary.
		conditions.push(sql`(m.created_at, m.id) < (${after.createdAt}::timestamptz, ${after.id})`);
	}
	const where = conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

	const rows = Array.from(
		await db.execute<MediaRecord & { createdAtText: string; remaining: number }>(sql`
			SELECT
				m.id, m.r2_key AS "r2Key", m.original_name AS "originalName", m.mime_type AS "mimeType",
				m.width, m.height, m.bytes, m.alt, m.credit, m.variants,
				m.created_at::text AS "createdAtText",
				count(*) OVER ()::int AS remaining
			FROM media m
			${where}
			ORDER BY m.created_at DESC, m.id DESC
			LIMIT ${size}
		`)
	);

	const remaining = Number(rows[0]?.remaining ?? 0);
	const last = rows.at(-1);

	return {
		items: rows.map((row): MediaRecord => ({
			id: row.id,
			r2Key: row.r2Key,
			originalName: row.originalName,
			mimeType: row.mimeType,
			width: row.width,
			height: row.height,
			bytes: row.bytes,
			alt: row.alt,
			credit: row.credit,
			variants: row.variants
		})),
		left: Math.max(0, remaining - rows.length),
		nextCursor:
			last && remaining > rows.length
				? encodeMediaCursor({ createdAt: last.createdAtText, id: Number(last.id) })
				: null
	};
}
