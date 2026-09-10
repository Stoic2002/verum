/**
 * XML escaping for the feed and sitemap.
 *
 * Titles and excerpts are author-written and can contain &, <, or quotes. An
 * unescaped ampersand alone makes a feed unparseable, and a broken feed fails
 * silently — readers just stop receiving anything.
 */
export function xml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** Strips characters XML 1.0 forbids outright, which no escaping can rescue. */
export function xmlSafe(value: string): string {
	// eslint-disable-next-line no-control-regex
	return xml(value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''));
}
