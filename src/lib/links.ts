/** A link to an article in a compact list: trending, most read, related. */
export type ArticleLink = {
	id: number;
	title: string;
	href: string;
	/** Shown above the title, usually the category name. */
	label?: string | null;
};
