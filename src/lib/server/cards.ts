import type { CardData } from '$lib/cards';
import { getStorage, pictureFor, type MediaRecord } from './media';
import type { ArticleCard } from './db/queries/public';

/**
 * Turns a database row into what a card component renders.
 *
 * Kept on the server so components never see database column names, and so the
 * storage URL is resolved once per row rather than in the markup.
 */
export function toCard(row: ArticleCard): CardData {
	const hasImage =
		row.media_id !== null && row.media_key !== null && row.media_width && row.media_height;

	const image = hasImage
		? pictureFor(
				{
					r2Key: row.media_key!,
					width: row.media_width!,
					height: row.media_height!,
					alt: row.media_alt ?? '',
					variants: (row.media_variants ?? []) as MediaRecord['variants']
				},
				(key) => getStorage().url(key)
			)
		: null;

	return {
		id: Number(row.article_id),
		slug: row.slug,
		title: row.title,
		excerpt: row.excerpt,
		readingMinutes: row.reading_minutes,
		publishedAt: new Date(row.published_at).toISOString(),
		isLiving: row.is_living,
		categorySlug: row.category_slug,
		categoryName: row.category_name,
		image
	};
}
