import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../content/render';
import { countEditorNotes, finishDraft, type CitableSource } from './citations';

const SOURCES: CitableSource[] = [
	{
		key: 'S1',
		url: 'https://www.reuters.com/tech/firm-raises',
		title: 'Firm raises $2.5bn',
		siteName: 'Reuters',
		domain: 'reuters.com',
		publishedAt: '2026-09-01T08:00:00.000Z'
	},
	{
		key: 'S2',
		url: 'https://www.theverge.com/firm',
		title: 'The firm confirms funding',
		siteName: '',
		domain: 'theverge.com',
		publishedAt: null
	}
];

const DRAFT = `# Firm raises money

## What happened

The firm raised $2.5 billion [S2][S1]. It will build data centres [S1].
A rumour says more is coming [S7].

## What it means

[[EDITOR: Explain whether this matters for developers.]]`;

describe('finishing a draft', () => {
	it('turns markers into numbered links to the sources this job read', () => {
		const result = finishDraft(DRAFT, SOURCES, 'en', 'Firm raises money');

		expect(result.cited).toEqual(['S2', 'S1']);
		expect(result.markdown).toContain(
			'raised $2.5 billion [[1]](https://www.theverge.com/firm)[[2]](https://www.reuters.com/tech/firm-raises).'
		);
		expect(result.markdown).toContain(
			'data centres [[2]](https://www.reuters.com/tech/firm-raises).'
		);
	});

	it('drops a marker for a source that was never read, without leaving a gap', () => {
		const result = finishDraft(DRAFT, SOURCES, 'en', 'Firm raises money');
		expect(result.dropped).toEqual(['S7']);
		expect(result.markdown).toContain('more is coming.');
		expect(result.markdown).not.toContain('S7');
	});

	it('removes a repeated title and lists the sources at the end', () => {
		const result = finishDraft(DRAFT, SOURCES, 'en', 'Firm raises money');
		expect(result.markdown.startsWith('## What happened')).toBe(true);
		expect(result.markdown).toMatch(
			/## Sources\n\n1\. \[The firm confirms funding\]\(https:\/\/www\.theverge\.com\/firm\) — theverge\.com\n2\. \[Firm raises \$2\.5bn\]\(https:\/\/www\.reuters\.com\/tech\/firm-raises\) — Reuters, 2026-09-01/
		);
	});

	it('always leaves at least one note for the editor', () => {
		const result = finishDraft('Just facts [S1].', SOURCES, 'id', 'Judul');
		expect(result.editorNotes).toBe(1);
		expect(result.markdown).toContain('## Penilaian kami');
		expect(countEditorNotes(result.markdown)).toBe(1);
	});

	it('renders through the real article pipeline with working links', async () => {
		const result = finishDraft(DRAFT, SOURCES, 'en', 'Firm raises money');
		const rendered = await renderMarkdown(result.markdown);

		expect(rendered.html).toContain('href="https://www.theverge.com/firm"');
		expect(rendered.html).toContain('<h2 id="sources">Sources</h2>');
		// The editor note stays visible in the preview, so it cannot be missed.
		expect(rendered.html).toContain('[[EDITOR: Explain whether this matters for developers.]]');
	});
});
