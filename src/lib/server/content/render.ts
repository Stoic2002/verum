import type { Element, Nodes, Parent, Root, Text } from 'hast';
import rehypeShiki from '@shikijs/rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { VFile } from 'vfile';
import type { TocEntry } from '../db/schema';
import type { MediaRecord } from '../media';
import { rehypeEmbeds, remarkEmbeds } from './embeds';

/**
 * Runtime markdown rendering.
 *
 * MDsveX, which PRD §10.1 names, cannot do this job: it is a compile-time
 * preprocessor for .svx files in the repository, and an article body lives in
 * a database column written by the admin editor. See PLAN-DEV §A.2 #1.
 *
 * Rendering happens once on save into `body_html`, not per request.
 */

/** Average adult reading speed for technical prose. */
const WORDS_PER_MINUTE = 200;

/** Text inside these never counts as prose, for search or for reading time. */
const NON_PROSE = new Set(['pre', 'code', 'script', 'style', 'figcaption']);

/**
 * Sanitisation is not optional and its position is not arbitrary: it runs after
 * rehype-raw has parsed author-supplied HTML, so anything raw HTML introduces
 * is subject to it.
 *
 * The only addition to the default schema is the `data-embed` placeholder
 * vocabulary, which rehypeEmbeds expands afterwards. `<iframe>` is deliberately
 * still not allowed — an author pasting one gets it stripped, while
 * `::youtube{...}` works, because that path can only produce a validated ID.
 */
const schema = {
	...defaultSchema,
	attributes: {
		...defaultSchema.attributes,
		div: [
			...(defaultSchema.attributes?.div ?? []),
			'dataEmbed',
			'dataId',
			'dataTitle',
			'dataUrl',
			'dataHandle',
			'dataType'
		]
	}
};

/** Headings collected for the table of contents, plus prose for search. */
type Extracted = { toc: TocEntry[]; text: string };

function isElement(node: Nodes): node is Element {
	return node.type === 'element';
}

function isText(node: Nodes): node is Text {
	return node.type === 'text';
}

function hasChildren(node: Nodes): node is Extract<Nodes, Parent> {
	return 'children' in node;
}

function textOf(node: Nodes): string {
	if (isText(node)) return node.value;
	if (!hasChildren(node)) return '';
	return node.children.map(textOf).join('');
}

/**
 * One walk producing both outputs.
 *
 * Only h2 and h3 go into the table of contents: h1 is the article title, and
 * anything deeper produces an outline nobody navigates by.
 */
function extract(tree: Root): Extracted {
	const toc: TocEntry[] = [];
	const prose: string[] = [];

	const walk = (node: Nodes) => {
		if (isElement(node)) {
			if (NON_PROSE.has(node.tagName)) return;

			if (node.tagName === 'h2' || node.tagName === 'h3') {
				const id = typeof node.properties?.id === 'string' ? node.properties.id : '';
				const text = textOf(node).trim();
				if (id && text) toc.push({ id, text, level: node.tagName === 'h2' ? 2 : 3 });
			}
		}

		if (isText(node)) {
			prose.push(node.value);
			return;
		}

		if (hasChildren(node)) node.children.forEach(walk);
	};

	walk(tree);

	return { toc, text: prose.join(' ').replace(/\s+/g, ' ').trim() };
}

/**
 * Writes into the VFile, never into module scope.
 *
 * A module-level slot would be shared by every render in flight on the process:
 * renderMarkdown awaits Shiki, so a second call can land between the first
 * call's extraction and its read and hand it the wrong article's headings.
 * Exactly the failure PRD §10.4 describes for locale, and it would never
 * reproduce with one request at a time.
 */
function rehypeExtract() {
	return (tree: Root, file: VFile) => {
		file.data.extracted = extract(tree);
	};
}

export type RenderedMarkdown = {
	html: string;
	/** Plain prose, for the search vector. Never markup, code, or URLs. */
	text: string;
	toc: TocEntry[];
	wordCount: number;
	readingMinutes: number;
};

/**
 * The processor is built once and reused. Shiki loads grammars and two themes
 * on construction; doing that per render would make saving an article slow.
 * Per-call state travels on the VFile, so reuse is safe under concurrency.
 */
const processor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkDirective)
	.use(remarkEmbeds)
	.use(remarkRehype, { allowDangerousHtml: true })
	.use(rehypeRaw)
	.use(rehypeSanitize, schema)
	// Slugs are added after sanitisation so the ids are ours, not an author's.
	.use(rehypeSlug)
	// Placeholders become real markup only now, on the trusted side of the
	// sanitiser — which is why the schema never has to allow <iframe>.
	.use(rehypeEmbeds)
	.use(rehypeExtract)
	// Shiki emits inline styles, which sanitisation would strip — so it runs
	// after it, on markup that is already trusted.
	.use(rehypeShiki, {
		// Dual themes render as CSS variables, so dark mode is a class switch
		// rather than a second highlight pass (Fase 5).
		themes: { light: 'github-light', dark: 'github-dark' },
		fallbackLanguage: 'text',
		langs: [
			'bash',
			'css',
			'diff',
			'go',
			'html',
			'json',
			'js',
			'jsx',
			'md',
			'python',
			'rust',
			'sql',
			'svelte',
			'ts',
			'tsx',
			'yaml'
		]
	})
	.use(rehypeStringify, { allowDangerousHtml: false });

type MediaMap = Map<number, MediaRecord>;

/** Images referenced by `::image{id=N}`, resolved by the caller before rendering. */
export type RenderContext = {
	media?: MediaMap;
	mediaUrl?: (key: string) => string;
};

/** Ids to fetch before rendering, so the pipeline itself stays free of I/O. */
export function referencedMediaIds(markdown: string): number[] {
	const ids = new Set<number>();
	for (const match of (markdown ?? '').matchAll(/::image\{[^}]*\bid=["']?(\d+)/g)) {
		ids.add(Number(match[1]));
	}
	return [...ids];
}

export async function renderMarkdown(
	markdown: string,
	context: RenderContext = {}
): Promise<RenderedMarkdown> {
	const file = new VFile({ value: markdown ?? '' });
	file.data.media = context.media;
	file.data.mediaUrl = context.mediaUrl;
	await processor.process(file);

	const { toc, text } = (file.data.extracted as Extracted | undefined) ?? { toc: [], text: '' };

	const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

	return {
		html: String(file),
		text,
		toc,
		wordCount,
		readingMinutes: wordCount ? Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE)) : 0
	};
}

declare module 'vfile' {
	interface DataMap {
		extracted: Extracted;
		media: MediaMap | undefined;
		mediaUrl: ((key: string) => string) | undefined;
	}
}
