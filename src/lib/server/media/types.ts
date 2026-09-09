import type { MediaVariant } from '../db/schema';

/** One row in the media library. Kept free of imports that reach the environment. */
export type MediaRecord = {
	id: number;
	r2Key: string;
	originalName: string;
	mimeType: string;
	width: number;
	height: number;
	bytes: number;
	alt: string;
	credit: string | null;
	variants: MediaVariant[];
};
