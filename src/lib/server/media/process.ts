import { createHash } from 'node:crypto';
import sharp, { type Metadata, type Sharp } from 'sharp';
import type { MediaVariant } from '../db/schema';

/**
 * Turns an upload into the renditions the site actually serves.
 *
 * PRD §8.2: three sizes, AVIF and WebP. No JPEG fallback is produced — every
 * browser in current use decodes WebP, so a third format would be bytes stored
 * for nobody.
 */

/** Breakpoints, not arbitrary numbers: 1x phone, 1x laptop, 2x laptop / wide. */
const WIDTHS = [640, 1280, 1920];

/**
 * SVG is not an image format here, it is a script container. Everything else is
 * decoded and re-encoded by sharp, so whatever the input claimed to be, what
 * gets stored is what sharp produced.
 */
const ACCEPTED = new Set(['jpeg', 'jpg', 'png', 'webp', 'avif', 'heif', 'tiff', 'gif']);

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
/** Guards against a decompression bomb: a tiny file that expands to gigapixels. */
const MAX_PIXELS = 50_000_000;

export type ProcessedImage = {
	hash: string;
	width: number;
	height: number;
	bytes: number;
	mimeType: string;
	original: { key: string; body: Buffer; contentType: string };
	variants: MediaVariant[];
	buffers: Map<string, { body: Buffer; contentType: string }>;
};

export class UploadError extends Error {}

const EXT: Record<string, string> = {
	jpeg: 'jpg',
	png: 'png',
	webp: 'webp',
	avif: 'avif',
	heif: 'avif',
	tiff: 'tif',
	gif: 'gif'
};

export async function processImage(input: Buffer): Promise<ProcessedImage> {
	if (input.length === 0) throw new UploadError('The file is empty.');
	if (input.length > MAX_UPLOAD_BYTES) {
		throw new UploadError(`Images must be under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
	}

	let source: Sharp;
	let meta: Metadata;
	try {
		source = sharp(input, { limitInputPixels: MAX_PIXELS, animated: false });
		meta = await source.metadata();
	} catch {
		throw new UploadError('That file is not an image sharp can read.');
	}

	if (!meta.format || !ACCEPTED.has(meta.format)) {
		throw new UploadError(`Unsupported image format: ${meta.format ?? 'unknown'}.`);
	}
	if (!meta.width || !meta.height) throw new UploadError('Could not read the image dimensions.');
	if (meta.width * meta.height > MAX_PIXELS) throw new UploadError('That image is too large.');

	// Content hash, so identical bytes always land on the same immutable key.
	const hash = createHash('sha256').update(input).digest('hex').slice(0, 16);
	const prefix = `img/${hash}`;

	// `rotate()` with no argument bakes in the EXIF orientation and then drops
	// the metadata — which also removes GPS coordinates from a phone photo.
	// sharp writes no metadata unless asked, so this is the whole privacy story.
	const base = source.rotate();
	const oriented = await base.clone().toBuffer({ resolveWithObject: true });
	const width = oriented.info.width;
	const height = oriented.info.height;

	// Never upscale: an enlarged 800px source is bytes spent inventing detail.
	const targets = WIDTHS.filter((w) => w <= width);
	if (targets.length === 0) targets.push(width);

	const variants: MediaVariant[] = [];
	const buffers = new Map<string, { body: Buffer; contentType: string }>();

	for (const target of targets) {
		const resized = base.clone().resize({ width: target, withoutEnlargement: true });

		for (const format of ['avif', 'webp'] as const) {
			const encoded = await (
				format === 'avif'
					? resized.clone().avif({ quality: 50 })
					: resized.clone().webp({ quality: 80 })
			).toBuffer({ resolveWithObject: true });

			const key = `${prefix}/${target}w.${format}`;
			variants.push({
				format,
				width: encoded.info.width,
				height: encoded.info.height,
				key,
				bytes: encoded.data.length
			});
			buffers.set(key, { body: encoded.data, contentType: `image/${format}` });
		}
	}

	// The original is kept as well.
	//
	// It costs cents a year on R2 and it is the only thing that makes changing
	// the breakpoints, or adding a format later, a re-render instead of asking
	// the author to find and re-upload every image they have ever used.
	const originalExt = EXT[meta.format] ?? 'bin';
	const originalKey = `${prefix}/original.${originalExt}`;
	const originalBody = oriented.data;
	const originalType = `image/${meta.format === 'heif' ? 'avif' : meta.format}`;
	buffers.set(originalKey, { body: originalBody, contentType: originalType });

	return {
		hash,
		width,
		height,
		bytes: originalBody.length,
		mimeType: originalType,
		original: { key: originalKey, body: originalBody, contentType: originalType },
		variants,
		buffers
	};
}

/** Filename shown in the admin list; the stored key is the hash, not this. */
export function cleanOriginalName(name: string): string {
	return (name.split(/[\\/]/).pop() ?? 'image').slice(0, 200) || 'image';
}
