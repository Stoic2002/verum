import type { Nodes as MdastNodes, Parents as MdastParents, Root as MdastRoot } from 'mdast';
import type { VFile } from 'vfile';
import type { Element, Properties, Root as HastRoot } from 'hast';
import { visit } from 'unist-util-visit';

/**
 * Embeds are handled in two passes, on purpose.
 *
 * Pass one (remark, before sanitisation) turns `::youtube{id=...}` into a plain
 * `<div data-embed>` carrying validated attributes. Pass two (rehype, after
 * sanitisation) expands those divs into the real markup.
 *
 * Splitting it this way is what keeps the sanitiser meaningful: the schema
 * never has to allow `<iframe>`, so an author pasting raw `<iframe>` into the
 * markdown still gets it stripped, while `::youtube{...}` — which can only
 * produce an ID this file has validated — still works.
 */

const YOUTUBE_ID = /^[\w-]{11}$/;
const CALLOUT_TYPES = new Set(['note', 'tip', 'warning', 'caution']);

/** Accepts a bare ID or any of the URL shapes people actually paste. */
export function parseYouTubeId(raw: string): string | null {
	const value = raw.trim();
	if (YOUTUBE_ID.test(value)) return value;

	try {
		const url = new URL(value);
		const host = url.hostname.replace(/^www\./, '');

		if (host === 'youtu.be') {
			const id = url.pathname.slice(1);
			return YOUTUBE_ID.test(id) ? id : null;
		}
		if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
			const fromQuery = url.searchParams.get('v');
			if (fromQuery && YOUTUBE_ID.test(fromQuery)) return fromQuery;

			const fromPath = url.pathname.match(/^\/(?:embed|shorts|v)\/([\w-]{11})/)?.[1];
			if (fromPath) return fromPath;
		}
	} catch {
		// Not a URL; fall through.
	}

	return null;
}

/** Only x.com / twitter.com status URLs, normalised to a canonical form. */
export function parseStatusUrl(raw: string): { url: string; handle: string; id: string } | null {
	try {
		const url = new URL(raw.trim());
		const host = url.hostname.replace(/^www\./, '');
		if (host !== 'x.com' && host !== 'twitter.com') return null;

		const match = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d{1,25})/);
		if (!match) return null;

		const [, handle, id] = match;
		return { url: `https://x.com/${handle}/status/${id}`, handle, id };
	} catch {
		return null;
	}
}

type DirectiveNode = {
	type: 'textDirective' | 'leafDirective' | 'containerDirective';
	name: string;
	attributes?: Record<string, string | null | undefined> | null;
	data?: { hName?: string; hProperties?: Record<string, unknown> };
	children?: unknown[];
};

const KNOWN = new Set(['youtube', 'tweet', 'x', 'callout']);

/**
 * Rewrites known directives into sanitiser-safe placeholders.
 *
 * Three outcomes, and none of them is silence:
 *   - known name, valid attributes  → placeholder for rehypeEmbeds
 *   - known name, bad attributes    → a visible error in the rendered article
 *   - anything else                 → the original source text, verbatim
 *
 * The last case matters more than it looks. remark-directive treats `:word` as
 * a text directive, so ordinary prose can trip it. Without restoring the
 * source, mdast-util-to-hast renders an unhandled directive as an empty
 * element — quietly deleting the author's sentence.
 */
export function remarkEmbeds() {
	return (tree: MdastRoot, file: VFile) => {
		const source = String(file.value ?? '');

		const literal = (node: DirectiveNode, index: number, parent: MdastParents) => {
			const { start, end } = (
				node as unknown as { position?: { start: { offset?: number }; end: { offset?: number } } }
			).position ?? {
				start: {},
				end: {}
			};
			if (start.offset === undefined || end.offset === undefined) return;

			parent.children.splice(index, 1, {
				type: 'text',
				value: source.slice(start.offset, end.offset)
			} as MdastNodes as never);
		};

		const errored = (node: DirectiveNode, message: string) => {
			node.data = {
				hName: 'div',
				hProperties: { 'data-embed': 'error', 'data-title': message }
			};
			node.children = [];
		};

		visit(tree, (node, index, parent) => {
			const directive = node as unknown as DirectiveNode;
			if (
				directive.type !== 'leafDirective' &&
				directive.type !== 'containerDirective' &&
				directive.type !== 'textDirective'
			) {
				return;
			}

			if (!KNOWN.has(directive.name)) {
				if (parent && typeof index === 'number') literal(directive, index, parent as MdastParents);
				return;
			}

			const attrs = directive.attributes ?? {};

			if (directive.name === 'youtube') {
				const id = parseYouTubeId(attrs.id ?? attrs.url ?? '');
				if (!id) {
					errored(directive, `Invalid YouTube id or URL: ${attrs.id ?? attrs.url ?? '(missing)'}`);
					return;
				}

				directive.data = {
					hName: 'div',
					hProperties: {
						'data-embed': 'youtube',
						'data-id': id,
						'data-title': attrs.title ?? ''
					}
				};
				directive.children = [];
				return;
			}

			if (directive.name === 'tweet' || directive.name === 'x') {
				const status = parseStatusUrl(attrs.url ?? attrs.href ?? '');
				if (!status) {
					errored(directive, `Invalid X status URL: ${attrs.url ?? attrs.href ?? '(missing)'}`);
					return;
				}

				directive.data = {
					hName: 'div',
					hProperties: {
						'data-embed': 'x',
						'data-url': status.url,
						'data-handle': status.handle
					}
				};
				directive.children = [];
				return;
			}

			if (directive.name === 'callout') {
				const type = CALLOUT_TYPES.has(attrs.type ?? '') ? attrs.type! : 'note';
				directive.data = {
					hName: 'div',
					hProperties: {
						'data-embed': 'callout',
						'data-type': type,
						'data-title': attrs.title ?? ''
					}
				};
			}
		});
	};
}

const el = (
	tagName: string,
	properties: Properties,
	children: Element['children'] = []
): Element => ({ type: 'element', tagName, properties, children });

/**
 * Expands the placeholders left by remarkEmbeds. Runs after sanitisation, so
 * everything it emits is trusted by construction.
 */
export function rehypeEmbeds() {
	return (tree: HastRoot) => {
		visit(tree, 'element', (node: Element) => {
			const kind = node.properties?.['dataEmbed'];
			if (typeof kind !== 'string') return;

			if (kind === 'youtube') {
				const id = String(node.properties?.['dataId'] ?? '');
				const title = String(node.properties?.['dataTitle'] ?? '') || 'YouTube video';

				node.tagName = 'figure';
				node.properties = { className: ['embed', 'embed--youtube'] };
				node.children = [
					el('div', { className: ['embed__frame'] }, [
						el('iframe', {
							// youtube-nocookie keeps the tracking cookie out until playback,
							// which is what makes this loadable before consent (PRD §14).
							src: `https://www.youtube-nocookie.com/embed/${id}`,
							title,
							loading: 'lazy',
							// The wrapper reserves a 16:9 box in CSS, so the iframe arriving
							// late cannot shift the page (PRD §12.5, CLS).
							width: '560',
							height: '315',
							frameBorder: '0',
							allow: 'accelerometer; encrypted-media; gyroscope; picture-in-picture',
							allowFullScreen: true,
							referrerPolicy: 'strict-origin-when-cross-origin'
						})
					])
				];
				return;
			}

			if (kind === 'x') {
				const url = String(node.properties?.['dataUrl'] ?? '');
				const handle = String(node.properties?.['dataHandle'] ?? '');

				// A static card, not X's widget script.
				//
				// widgets.js is third-party JavaScript that sets cookies, so it could
				// not load before CMP consent anyway (PRD §14) — and it costs a
				// render-blocking round trip for a quote that is one link long. The
				// card always renders, for every reader, at zero script cost.
				node.tagName = 'figure';
				node.properties = { className: ['embed', 'embed--x'] };
				node.children = [
					el('blockquote', { className: ['embed__card'] }, [
						el('a', { href: url, rel: ['nofollow', 'noopener'], target: '_blank' }, [
							{ type: 'text', value: `@${handle} on X` }
						])
					])
				];
				return;
			}

			if (kind === 'error') {
				const message = String(node.properties?.['dataTitle'] ?? 'Invalid embed');
				node.tagName = 'p';
				node.properties = { className: ['embed-error'] };
				node.children = [{ type: 'text', value: message }];
				return;
			}

			if (kind === 'callout') {
				const type = String(node.properties?.['dataType'] ?? 'note');
				const title = String(node.properties?.['dataTitle'] ?? '');

				node.tagName = 'aside';
				node.properties = { className: ['callout', `callout--${type}`], role: 'note' };
				if (title) {
					node.children = [
						el('p', { className: ['callout__title'] }, [{ type: 'text', value: title }]),
						...node.children
					];
				}
			}
		});
	};
}
