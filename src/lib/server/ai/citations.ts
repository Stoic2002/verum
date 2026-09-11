import type { Locale } from '../db/schema';
import { EDITOR_MARKER } from './prompts';

/**
 * Turns the model's [S1] markers into links a reader can follow, and adds the
 * source list — both built from the database, never from the model's text.
 *
 * A model can type any URL it likes; it can only type an *id* here, and an id
 * this job did not read is simply dropped. Every link in the published article
 * therefore points at a page this server actually downloaded.
 *
 * Plain numbered links rather than GFM footnotes: footnote ids pass through
 * the sanitiser's clobber prefix, and a citation that silently stops linking
 * is worse than a simpler format that always does.
 */

export type CitableSource = {
	key: string;
	url: string;
	title: string;
	siteName: string;
	domain: string;
	publishedAt: string | null;
};

export type FinishedDraft = {
	markdown: string;
	/** Source keys cited, in order of first citation. */
	cited: string[];
	/** Markers naming a source this job never read. */
	dropped: string[];
	editorNotes: number;
};

const HEADINGS: Record<Locale, { sources: string; assessment: string; note: string }> = {
	en: {
		sources: 'Sources',
		assessment: 'Our assessment',
		note: 'Add your own assessment, first-hand testing or recommendation here.'
	},
	id: {
		sources: 'Sumber',
		assessment: 'Penilaian kami',
		note: 'Tambahkan penilaian, pengujian langsung, atau rekomendasi Anda sendiri di sini.'
	}
};

export function countEditorNotes(markdown: string): number {
	return markdown.split(EDITOR_MARKER).length - 1;
}

export function finishDraft(
	raw: string,
	sources: CitableSource[],
	locale: Locale,
	title: string
): FinishedDraft {
	const byKey = new Map(sources.map((s) => [s.key.toUpperCase(), s]));
	const cited: string[] = [];
	const dropped = new Set<string>();

	let body = raw
		.trim()
		.replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i, '$1')
		.trim();

	// A repeated title as the first heading duplicates the page's own <h1>.
	const firstLine = body.split('\n', 1)[0];
	if (/^#\s+/.test(firstLine)) {
		const heading = firstLine.replace(/^#\s+/, '').trim().toLowerCase();
		if (heading === title.trim().toLowerCase() || !body.slice(firstLine.length).includes('\n# ')) {
			body = body.slice(firstLine.length).trim();
		}
	}

	body = body.replace(/\[(S\d{1,3})\]/gi, (_match, key: string) => {
		const id = key.toUpperCase();
		const source = byKey.get(id);
		if (!source) {
			dropped.add(id);
			return '';
		}
		if (!cited.includes(id)) cited.push(id);
		return `[[${cited.indexOf(id) + 1}]](${source.url})`;
	});
	// Tidy the space a dropped marker leaves before punctuation.
	body = body.replace(/[ \t]+([.,;:!?])/g, '$1').replace(/[ \t]{2,}/g, ' ');

	const text = HEADINGS[locale];
	if (countEditorNotes(body) === 0) {
		body += `\n\n## ${text.assessment}\n\n${EDITOR_MARKER} ${text.note}]]`;
	}

	if (cited.length) {
		const list = cited
			.map((key, index) => {
				const s = byKey.get(key)!;
				const label = (s.title || s.siteName || s.domain).replace(/[[\]]/g, '');
				const meta = [s.siteName || s.domain, s.publishedAt?.slice(0, 10)]
					.filter(Boolean)
					.join(', ');
				return `${index + 1}. [${label}](${s.url})${meta ? ` — ${meta}` : ''}`;
			})
			.join('\n');
		body += `\n\n## ${text.sources}\n\n${list}`;
	}

	return {
		markdown: `${body.trim()}\n`,
		cited,
		dropped: [...dropped],
		editorNotes: countEditorNotes(body)
	};
}
