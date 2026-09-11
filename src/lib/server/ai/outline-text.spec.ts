import { describe, expect, it } from 'vitest';
import { outlineToText, parseOutlineText } from './outline-text';

describe('outline text', () => {
	const outline = {
		title: 'T',
		excerpt: 'E',
		sections: [
			{ heading: 'What happened', points: ['C1 funding', 'C2 timeline'] },
			{ heading: 'Our assessment', points: [] }
		]
	};

	it('round-trips', () => {
		expect(parseOutlineText(outlineToText(outline))).toEqual(outline.sections);
	});

	it('accepts what an editor actually types', () => {
		expect(
			parseOutlineText(
				'stray line before any heading\n# Intro\n* first\nplain second\n\n### Deeper\n- x'
			)
		).toEqual([
			{ heading: 'Intro', points: ['first', 'plain second'] },
			{ heading: 'Deeper', points: ['x'] }
		]);
	});
});
