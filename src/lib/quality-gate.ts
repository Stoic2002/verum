/**
 * PRD §5.5: the four questions every article must pass before it is
 * published — whoever, or whatever, wrote the first draft.
 *
 * Client-safe: the article settings page renders these, the server checks
 * them. Confirmations are required at the moment an article goes live and are
 * never stored; they are a pause, not a record.
 */
export const QUALITY_GATE = [
	{
		key: 'information-gain',
		label: 'Information gain',
		question:
			'There is at least one thing here that is not in the top five search results: my own screenshots, numbers, or judgment from using it.'
	},
	{
		key: 'facts-verified',
		label: 'Facts verified',
		question:
			'Every factual claim, number, date and product name was checked against a primary source.'
	},
	{
		key: 'honest-title',
		label: 'Honest title',
		question: 'The article fully answers its title.'
	},
	{
		key: 'accountable',
		label: 'Accountable',
		question: 'If someone disputes this article, I can show what it is based on.'
	}
] as const;

export type QualityGateKey = (typeof QUALITY_GATE)[number]['key'];
export const QUALITY_GATE_KEYS: QualityGateKey[] = QUALITY_GATE.map((item) => item.key);

/**
 * Placeholder the AI writer leaves where only the editor can write: their
 * assessment, first-hand testing, a missing fact. Visible in the preview, and
 * an article containing one cannot be published.
 */
export const EDITOR_NOTE_MARKER = '[[EDITOR:';

export function countEditorNotes(markdown: string): number {
	return markdown.split(EDITOR_NOTE_MARKER).length - 1;
}
