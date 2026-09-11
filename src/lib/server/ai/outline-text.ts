import type { AiOutline } from '../db/schema';

/**
 * The outline as the editor edits it: plain text in the shape Markdown
 * already taught them, rather than a form with add-section buttons.
 *
 *   ## Section heading
 *   - a point
 *   - another point
 */

export function outlineToText(outline: AiOutline | null): string {
	if (!outline) return '';
	return outline.sections
		.map((s) => [`## ${s.heading}`, ...s.points.map((p) => `- ${p}`)].join('\n'))
		.join('\n\n');
}

export function parseOutlineText(text: string): AiOutline['sections'] {
	const sections: AiOutline['sections'] = [];
	for (const raw of text.split('\n')) {
		const line = raw.trim();
		if (!line) continue;

		const heading = /^#{1,3}\s+(.+)$/.exec(line);
		if (heading) {
			sections.push({ heading: heading[1].trim(), points: [] });
			continue;
		}
		const current = sections.at(-1);
		if (!current) continue;
		current.points.push(line.replace(/^[-*]\s+/, '').trim());
	}
	return sections.filter((s) => s.heading);
}
