import { bigserial, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** One rendition produced at upload time (PRD §8.2: 3 sizes × AVIF + WebP). */
export type MediaVariant = {
	format: 'avif' | 'webp' | 'jpeg';
	width: number;
	height: number;
	key: string;
	bytes: number;
};

/**
 * Registry of everything uploaded to R2. Object keys are content-hashed, so the
 * CDN can hold them immutable for a year (PRD §10.3) and a re-upload of the
 * same bytes never invalidates a cache entry.
 */
export const media = pgTable('media', {
	id: bigserial('id', { mode: 'number' }).primaryKey(),
	/** Key of the original upload; variants carry their own keys. */
	r2Key: text('r2_key').notNull().unique(),
	originalName: text('original_name').notNull(),
	mimeType: text('mime_type').notNull(),
	width: integer('width').notNull(),
	height: integer('height').notNull(),
	bytes: integer('bytes').notNull(),
	/** Required on insert: an image without alt text is an accessibility defect. */
	alt: text('alt').notNull().default(''),
	credit: text('credit'),
	variants: jsonb('variants').$type<MediaVariant[]>().notNull().default([]),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
