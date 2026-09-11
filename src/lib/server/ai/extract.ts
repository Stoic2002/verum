import type { Element, Nodes, Root } from 'hast';
import { fromHtml } from 'hast-util-from-html';

/**
 * Turns a downloaded page into the text a claim can be checked against.
 *
 * Two things matter more than elegance here. Block elements must stay apart —
 * "…in 2025.</p><p>The firm…" collapsing into "2025.The firm" would break
 * quote matching in exactly the sentences that carry facts. And navigation,
 * cookie banners and related-article rails must go, or a model will happily
 * quote a headline from the sidebar as if it were the story.
 */

export type ExtractedPage = {
	title: string;
	siteName: string;
	publishedAt: string | null;
	text: string;
};

/** Enough for any article; a page longer than this is not one. */
export const MAX_TEXT_CHARS = 60_000;
/** Below this, an <article> element is a teaser card, not the story. */
const MIN_MAIN_CHARS = 400;

const DROP = new Set([
	'script',
	'style',
	'noscript',
	'template',
	'svg',
	'iframe',
	'canvas',
	'video',
	'audio',
	'object',
	'embed',
	'nav',
	'header',
	'footer',
	'aside',
	'form',
	'button',
	'select',
	'input',
	'textarea',
	'dialog',
	'menu'
]);
const DROP_ROLES = new Set([
	'navigation',
	'banner',
	'contentinfo',
	'complementary',
	'search',
	'dialog'
]);
const BLOCK = new Set([
	'p',
	'div',
	'section',
	'article',
	'main',
	'li',
	'ul',
	'ol',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'blockquote',
	'pre',
	'figure',
	'figcaption',
	'table',
	'tr',
	'br',
	'hr',
	'dd',
	'dt',
	'dl',
	'address',
	'details',
	'summary',
	'caption'
]);

const prop = (el: Element, name: string): string => {
	const value = el.properties?.[name];
	if (Array.isArray(value)) return value.join(' ');
	return value === undefined || value === null ? '' : String(value);
};

function isHidden(el: Element): boolean {
	return (
		el.properties?.hidden === true ||
		prop(el, 'ariaHidden') === 'true' ||
		DROP_ROLES.has(prop(el, 'role'))
	);
}

function textOf(node: Nodes, out: string[]): void {
	if (node.type === 'text') {
		out.push(node.value);
		return;
	}
	if (node.type !== 'element' && node.type !== 'root') return;

	if (node.type === 'element') {
		if (DROP.has(node.tagName) || isHidden(node)) return;
		if (BLOCK.has(node.tagName)) out.push('\n');
		if (node.tagName === 'td' || node.tagName === 'th') out.push(' ');
	}

	for (const child of node.children) textOf(child as Nodes, out);

	if (node.type === 'element' && BLOCK.has(node.tagName)) out.push('\n');
}

export function cleanText(raw: string): string {
	return raw
		.split('\n')
		.map((line) => line.replace(/\s+/g, ' ').trim())
		.filter(Boolean)
		.join('\n')
		.slice(0, MAX_TEXT_CHARS);
}

function collect(root: Root) {
	const metas: Element[] = [];
	const articles: Element[] = [];
	const mains: Element[] = [];
	const times: Element[] = [];
	const ldJson: string[] = [];
	let title = '';
	let body: Element | null = null;

	const walk = (node: Nodes) => {
		if (node.type === 'element') {
			switch (node.tagName) {
				case 'meta':
					metas.push(node);
					break;
				case 'title':
					if (!title) title = textContent(node);
					break;
				case 'article':
					articles.push(node);
					break;
				case 'main':
					mains.push(node);
					break;
				case 'time':
					times.push(node);
					break;
				case 'body':
					body = node;
					break;
				case 'script':
					if (prop(node, 'type').includes('ld+json')) ldJson.push(textContent(node));
					return;
			}
		}
		if ('children' in node) for (const child of node.children) walk(child as Nodes);
	};
	walk(root);

	return { metas, articles, mains, times, ldJson, title, body: body as Element | null };
}

function textContent(node: Nodes): string {
	if (node.type === 'text') return node.value;
	if ('children' in node) return node.children.map((c) => textContent(c as Nodes)).join('');
	return '';
}

function metaContent(metas: Element[], ...keys: string[]): string {
	for (const key of keys) {
		const match = metas.find(
			(m) =>
				prop(m, 'property').toLowerCase() === key ||
				prop(m, 'name').toLowerCase() === key ||
				prop(m, 'itemProp').toLowerCase() === key
		);
		const content = match ? prop(match, 'content').trim() : '';
		if (content) return content;
	}
	return '';
}

function findDatePublished(value: unknown, depth = 0): string {
	if (depth > 6 || !value || typeof value !== 'object') return '';
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = findDatePublished(item, depth + 1);
			if (found) return found;
		}
		return '';
	}
	const record = value as Record<string, unknown>;
	if (typeof record.datePublished === 'string') return record.datePublished;
	for (const child of Object.values(record)) {
		const found = findDatePublished(child, depth + 1);
		if (found) return found;
	}
	return '';
}

function toIso(raw: string): string | null {
	if (!raw) return null;
	const time = Date.parse(raw);
	return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/**
 * Removes what extraction throws away anyway, before the parser sees it.
 *
 * Two reasons. A `<template>` inside `<svg>` has no template content, and
 * hast-util-from-parse5 8.0.3 reads that content unconditionally — a Facebook
 * post crashed the whole source with "Cannot read properties of undefined
 * (reading 'nodeName')". And social pages ship megabytes of inline script;
 * not parsing it keeps a 1 MB page cheap. JSON-LD scripts stay: they carry
 * the publication date.
 */
export function stripUnreadable(html: string): string {
	return html
		.replace(/<script\b(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script\s*>/gi, '')
		.replace(/<(style|template|svg|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
}

export function extractHtml(html: string): ExtractedPage {
	let root: Root;
	try {
		root = fromHtml(stripUnreadable(html));
	} catch {
		// A parser bug on one page must cost that source, not look like a JavaScript error.
		throw new UnsupportedContentError('This page could not be parsed as HTML.');
	}
	const { metas, articles, mains, times, ldJson, title, body } = collect(root);

	const render = (node: Nodes) => {
		const out: string[] = [];
		textOf(node, out);
		return cleanText(out.join(''));
	};

	// The longest <article> is the story; shorter ones are usually cards for
	// other stories. Then <main>, then the whole body as a last resort.
	const candidates = [
		...articles.map(render).sort((a, b) => b.length - a.length),
		...mains.map(render)
	];
	let text = candidates.find((candidate) => candidate.length >= MIN_MAIN_CHARS) ?? '';
	if (!text) text = render(body ?? root);

	let published = metaContent(metas, 'article:published_time', 'datepublished', 'pubdate', 'date');
	if (!published) {
		for (const block of ldJson) {
			try {
				published = findDatePublished(JSON.parse(block));
			} catch {
				// Malformed JSON-LD is common; it is only a hint.
			}
			if (published) break;
		}
	}
	if (!published && times.length) published = prop(times[0], 'dateTime');

	return {
		title: (metaContent(metas, 'og:title', 'twitter:title') || title).replace(/\s+/g, ' ').trim(),
		siteName: metaContent(metas, 'og:site_name', 'application-name'),
		publishedAt: toIso(published),
		text
	};
}

/** Decodes with the charset the server declared, falling back to UTF-8. */
export function decodeBody(buffer: Buffer, contentType: string): string {
	const charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
	if (charset) {
		try {
			return new TextDecoder(charset).decode(buffer);
		} catch {
			// Unknown label: fall through.
		}
	}
	return new TextDecoder('utf-8').decode(buffer);
}

export class UnsupportedContentError extends Error {}

export function extractPage(buffer: Buffer, contentType: string): ExtractedPage {
	const type = contentType.split(';')[0].trim().toLowerCase();
	const body = decodeBody(buffer, contentType);

	if (type === 'text/html' || type === 'application/xhtml+xml' || (!type && /^\s*</.test(body))) {
		return extractHtml(body);
	}
	if (type === 'text/plain' || type === 'text/markdown') {
		return { title: '', siteName: '', publishedAt: null, text: cleanText(body) };
	}
	throw new UnsupportedContentError(
		`Unsupported content type ${type || '(none)'}; only web pages and plain text are read.`
	);
}
