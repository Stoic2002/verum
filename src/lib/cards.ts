import type { Locale } from './paraglide/runtime';

/** What a card renders. Built on the server so components stay free of DB shapes. */
export type CardData = {
	id: number;
	slug: string;
	title: string;
	excerpt: string;
	readingMinutes: number;
	publishedAt: string;
	isLiving: boolean;
	categorySlug: string;
	categoryName: string | null;
	image: {
		sources: { type: string; srcset: string }[];
		src: string;
		alt: string;
		width: number;
		height: number;
	} | null;
};

export type { Locale };
