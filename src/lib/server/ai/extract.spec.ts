import { describe, expect, it } from 'vitest';
import { extractHtml, extractPage, UnsupportedContentError } from './extract';

const story = 'The company confirmed the acquisition on Monday. '.repeat(12);

const PAGE = `<!doctype html><html><head>
	<title>Fallback title | Example News</title>
	<meta property="og:title" content="Firm buys rival for $2 billion">
	<meta property="og:site_name" content="Example News">
	<script type="application/ld+json">{"@graph":[{"@type":"NewsArticle","datePublished":"2026-09-01T08:00:00Z"}]}</script>
	<script>window.tracking = "The company confirmed nothing";</script>
</head><body>
	<header><nav>Home World Business Sign in</nav></header>
	<div role="dialog">We use cookies to improve your experience.</div>
	<main>
		<article class="card"><h3>Other story</h3><p>A short teaser.</p></article>
		<article>
			<h1>Firm buys rival</h1>
			<p>${story}</p><p>Regulators must still approve the deal.</p>
			<table><tr><td>Price</td><td>$2 billion</td></tr></table>
			<p hidden>Hidden paywall text.</p>
			<aside>Related: ten other acquisitions</aside>
		</article>
	</main>
	<footer>Copyright Example News</footer>
</body></html>`;

describe('page extraction', () => {
	it('keeps the story and drops the chrome around it', () => {
		const page = extractHtml(PAGE);

		expect(page.text).toContain('The company confirmed the acquisition on Monday.');
		expect(page.text).toContain('Regulators must still approve the deal.');
		for (const noise of [
			'Sign in',
			'cookies',
			'Copyright',
			'Related:',
			'tracking',
			'A short teaser',
			'Hidden paywall'
		]) {
			expect(page.text).not.toContain(noise);
		}
	});

	it('keeps paragraphs apart so sentences do not fuse', () => {
		const page = extractHtml(PAGE);
		expect(page.text).toMatch(/Monday\.\nRegulators|Monday\.\s*\nRegulators/);
		expect(page.text).toContain('Price $2 billion');
	});

	it('reads title, publisher and date from metadata', () => {
		const page = extractHtml(PAGE);
		expect(page.title).toBe('Firm buys rival for $2 billion');
		expect(page.siteName).toBe('Example News');
		expect(page.publishedAt).toBe('2026-09-01T08:00:00.000Z');
	});

	it('falls back to <time> and <title> when there is no metadata', () => {
		const page = extractHtml(
			`<html><head><title>Plain page</title></head><body><time datetime="2026-08-30">Aug 30</time><p>${story}</p></body></html>`
		);
		expect(page.title).toBe('Plain page');
		expect(page.publishedAt).toBe('2026-08-30T00:00:00.000Z');
		expect(page.text).toContain('acquisition');
	});

	it('reads plain text and refuses what it cannot read', () => {
		expect(
			extractPage(Buffer.from('Line one\n\n  Line   two'), 'text/plain; charset=utf-8').text
		).toBe('Line one\nLine two');
		expect(() => extractPage(Buffer.from('%PDF-1.7'), 'application/pdf')).toThrow(
			UnsupportedContentError
		);
	});

	it('honours the declared charset', () => {
		const latin1 = Buffer.from('<p>Caf\xe9 in Jakarta</p>', 'latin1');
		expect(extractPage(latin1, 'text/html; charset=iso-8859-1').text).toBe('Café in Jakarta');
	});
});
