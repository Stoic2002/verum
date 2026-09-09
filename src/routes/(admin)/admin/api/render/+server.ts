import { json, type RequestHandler } from '@sveltejs/kit';
import { renderMarkdown } from '$lib/server/content/render';

/**
 * Renders the editor's markdown for live preview.
 *
 * The preview goes through the server on purpose. A client-side markdown
 * renderer would be a second pipeline with its own sanitiser, embeds and
 * highlighter — and the moment the two disagree, the preview stops being a
 * preview. One renderer, one answer.
 *
 * Guarded by the /admin session check in hooks.server.ts.
 */
export const POST: RequestHandler = async ({ request }) => {
	const { markdown } = (await request.json()) as { markdown?: unknown };

	if (typeof markdown !== 'string') {
		return json({ error: 'markdown must be a string' }, { status: 400 });
	}
	if (markdown.length > 400_000) {
		return json({ error: 'markdown too large' }, { status: 413 });
	}

	const { html, toc, wordCount, readingMinutes } = await renderMarkdown(markdown);

	return json({ html, toc, wordCount, readingMinutes });
};
