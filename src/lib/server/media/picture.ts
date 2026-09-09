import type { MediaVariant } from '../db/schema';

/**
 * Pure functions for building responsive image markup.
 *
 * Deliberately in their own module, with no dependency on storage or the
 * environment: the render pipeline needs them, and the render pipeline is also
 * used by the seed script, which runs outside SvelteKit and cannot resolve
 * $env. Keeping the pure half separate from the I/O half is what lets both
 * callers work.
 */

export type PictureRecord = {
	r2Key: string;
	width: number;
	height: number;
	alt: string;
	variants: MediaVariant[];
};

/** `sizes` tells the browser how wide the image renders, so it can pick a width. */
export const ARTICLE_IMAGE_SIZES = '(min-width: 46rem) 42rem, 100vw';

export type PictureSource = { type: string; srcset: string };

/**
 * Builds what a <picture> needs: one srcset per format, plus intrinsic
 * dimensions.
 *
 * width and height are not decoration. Without them the browser cannot reserve
 * the box before the bytes arrive, and every image on the page becomes a layout
 * shift (PRD §12.5, CLS < 0.1).
 */
export function pictureFor(
	record: PictureRecord,
	url: (key: string) => string
): { sources: PictureSource[]; src: string; width: number; height: number; alt: string } {
	const byFormat = new Map<string, MediaVariant[]>();
	for (const variant of record.variants) {
		byFormat.set(variant.format, [...(byFormat.get(variant.format) ?? []), variant]);
	}

	const srcset = (variants: MediaVariant[]) =>
		variants
			.slice()
			.sort((a, b) => a.width - b.width)
			.map((variant) => `${url(variant.key)} ${variant.width}w`)
			.join(', ');

	// AVIF first: the browser takes the first type it can decode.
	const sources: PictureSource[] = [];
	for (const format of ['avif', 'webp'] as const) {
		const variants = byFormat.get(format);
		if (variants?.length) sources.push({ type: `image/${format}`, srcset: srcset(variants) });
	}

	const webp = byFormat.get('webp') ?? [];
	const fallback = webp.slice().sort((a, b) => a.width - b.width)[Math.min(1, webp.length - 1)];

	return {
		sources,
		src: url(fallback?.key ?? record.r2Key),
		width: record.width,
		height: record.height,
		alt: record.alt
	};
}
