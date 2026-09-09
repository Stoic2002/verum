/**
 * Client-side slug preview.
 *
 * Deliberately a copy of the server's rule rather than an import: pulling in
 * $lib/server/content/articles.ts from a component would drag the whole render
 * pipeline into the browser bundle. `slugSchema` is what actually enforces the
 * format, on both sides, so a drift here shows up as a validation error rather
 * than a bad slug in the database.
 */
export function slugify(input: string): string {
	return input
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/['’]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)
		.replace(/-+$/g, '');
}
