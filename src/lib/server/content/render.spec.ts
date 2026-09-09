import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './render';
import { parseStatusUrl, parseYouTubeId } from './embeds';

describe('sanitisation', () => {
	it('strips script tags and their contents', async () => {
		const { html } = await renderMarkdown('Before\n\n<script>alert(1)</script>\n\nAfter');

		expect(html).not.toContain('<script');
		expect(html).not.toContain('alert(1)');
		expect(html).toContain('Before');
		expect(html).toContain('After');
	});

	it('strips inline event handlers', async () => {
		const { html } = await renderMarkdown('<img src="x" onerror="alert(1)">');

		expect(html).not.toContain('onerror');
		expect(html).not.toContain('alert(1)');
	});

	it('strips javascript: URLs', async () => {
		const { html } = await renderMarkdown('[click](javascript:alert(1))');

		expect(html).not.toContain('javascript:');
	});

	it('strips author-supplied iframes', async () => {
		// The directive path is the only way to get an iframe, and it can only
		// emit an ID this codebase has validated.
		const { html } = await renderMarkdown('<iframe src="https://evil.example/x"></iframe>');

		expect(html).not.toContain('<iframe');
		expect(html).not.toContain('evil.example');
	});

	it('strips style attributes and tags', async () => {
		const { html } = await renderMarkdown(
			'<div style="position:fixed">x</div>\n\n<style>a{}</style>'
		);

		expect(html).not.toContain('position:fixed');
		expect(html).not.toContain('<style');
	});

	it('keeps ordinary markdown intact', async () => {
		const { html } = await renderMarkdown('# Title\n\n**bold** and [a link](https://example.com)');

		expect(html).toContain('<strong>bold</strong>');
		expect(html).toContain('href="https://example.com"');
	});
});

describe('GitHub flavoured markdown', () => {
	it('renders tables', async () => {
		const { html } = await renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |');
		expect(html).toContain('<table>');
	});

	it('highlights fenced code with Shiki', async () => {
		const { html } = await renderMarkdown('```ts\nconst x: number = 1;\n```');

		expect(html).toContain('<pre');
		expect(html).toContain('shiki');
		// Dual themes emit CSS variables so dark mode is a class switch.
		expect(html).toContain('--shiki-dark');
	});

	it('does not throw on an unknown language', async () => {
		const { html } = await renderMarkdown('```notalanguage\nx\n```');
		expect(html).toContain('<pre');
	});
});

describe('embeds', () => {
	it('turns a YouTube directive into a lazy nocookie iframe', async () => {
		const { html } = await renderMarkdown('::youtube{id="dQw4w9WgXcQ"}');

		expect(html).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
		expect(html).toContain('loading="lazy"');
		expect(html).toContain('embed--youtube');
	});

	it('accepts the URL shapes people actually paste', () => {
		expect(parseYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1')).toBe('dQw4w9WgXcQ');
		expect(parseYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
	});

	it('rejects anything that is not a YouTube id', () => {
		expect(parseYouTubeId('https://evil.example/x')).toBeNull();
		expect(parseYouTubeId('../../etc/passwd')).toBeNull();
		expect(parseYouTubeId('"><script>alert(1)</script>')).toBeNull();
	});

	it('shows an error for a known directive with bad attributes', async () => {
		const { html } = await renderMarkdown('::youtube{id="not-an-id"}');

		expect(html).not.toContain('<iframe');
		expect(html).toContain('embed-error');
		expect(html).toContain('Invalid YouTube id');
	});

	it('never silently deletes prose that looks like a directive', async () => {
		// remark-directive treats `:word` as a text directive, so ordinary
		// sentences can trip it. The source has to come back verbatim.
		const { html, text } = await renderMarkdown(
			'Ratio was 3:1 and the flag is :experimental here.'
		);

		expect(html).toContain(':experimental');
		expect(text).toContain('Ratio was 3:1');
		expect(text).toContain('here.');
	});

	it('leaves an unknown block directive as written', async () => {
		const { html } = await renderMarkdown('::vimeo{id="123"}');

		expect(html).toContain('::vimeo');
		expect(html).not.toContain('<iframe');
	});

	it('renders an X embed as a static card, with no third-party script', async () => {
		const { html } = await renderMarkdown(
			'::x{url="https://x.com/svelte_society/status/1234567890"}'
		);

		expect(html).toContain('embed--x');
		expect(html).toContain('href="https://x.com/svelte_society/status/1234567890"');
		expect(html).not.toContain('platform.twitter.com');
		expect(html).not.toContain('<script');
	});

	it('normalises twitter.com to x.com and rejects lookalikes', () => {
		expect(parseStatusUrl('https://twitter.com/a/status/1')?.url).toBe('https://x.com/a/status/1');
		expect(parseStatusUrl('https://x.com.evil.example/a/status/1')).toBeNull();
		expect(parseStatusUrl('https://x.com/a/notstatus/1')).toBeNull();
	});

	it('renders a callout container', async () => {
		const { html } = await renderMarkdown(
			':::callout{type="warning" title="Careful"}\nBody text.\n:::'
		);

		expect(html).toContain('callout--warning');
		expect(html).toContain('Careful');
		expect(html).toContain('Body text.');
	});

	it('falls back to note for an unknown callout type', async () => {
		const { html } = await renderMarkdown(':::callout{type="onfire"}\nx\n:::');
		expect(html).toContain('callout--note');
	});
});

describe('extraction', () => {
	it('collects h2 and h3 into a table of contents, with ids', async () => {
		const { toc, html } = await renderMarkdown(
			'# Title\n\n## First section\n\ntext\n\n### Nested\n\n## Second section\n\n#### Too deep'
		);

		expect(toc).toEqual([
			{ id: 'first-section', text: 'First section', level: 2 },
			{ id: 'nested', text: 'Nested', level: 3 },
			{ id: 'second-section', text: 'Second section', level: 2 }
		]);
		// The ids the TOC links to must exist in the markup.
		expect(html).toContain('id="first-section"');
	});

	it('extracts prose but never code', async () => {
		const { text } = await renderMarkdown(
			'Real prose here.\n\n```ts\nconst secret = "tokenvalue";\n```\n\nMore prose.'
		);

		expect(text).toContain('Real prose here.');
		expect(text).toContain('More prose.');
		// Indexing code would make variable names searchable words.
		expect(text).not.toContain('tokenvalue');
	});

	it('extracts link text but not the URL', async () => {
		const { text } = await renderMarkdown('See [the docs](https://example.com/deep/path?q=1).');

		expect(text).toContain('the docs');
		expect(text).not.toContain('example.com');
	});

	it('counts words and estimates reading time', async () => {
		const { wordCount, readingMinutes } = await renderMarkdown(
			Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ')
		);

		expect(wordCount).toBe(400);
		expect(readingMinutes).toBe(2);
	});

	it('handles empty input without throwing', async () => {
		const result = await renderMarkdown('');

		expect(result.html).toBe('');
		expect(result.toc).toEqual([]);
		expect(result.wordCount).toBe(0);
		expect(result.readingMinutes).toBe(0);
	});

	it('does not leak extraction state between renders', async () => {
		const first = await renderMarkdown('## Only heading here');
		const second = await renderMarkdown('No headings at all.');

		expect(first.toc).toHaveLength(1);
		expect(second.toc).toHaveLength(0);
		expect(second.text).not.toContain('Only heading');
	});

	it('keeps concurrent renders separate', async () => {
		// The processor is reused across calls, so per-render state has to live on
		// the VFile. Held in module scope, these two would overwrite each other.
		const [a, b, c] = await Promise.all([
			renderMarkdown('## Alpha heading\n\nAlpha prose.'),
			renderMarkdown('## Beta heading\n\nBeta prose.'),
			renderMarkdown('No heading, gamma prose.')
		]);

		expect(a.toc[0].text).toBe('Alpha heading');
		expect(b.toc[0].text).toBe('Beta heading');
		expect(c.toc).toHaveLength(0);
		expect(a.text).not.toContain('Beta');
		expect(b.text).not.toContain('Alpha');
	});
});
