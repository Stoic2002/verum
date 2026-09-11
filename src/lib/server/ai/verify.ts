import type { AiClaim, ClaimStatus } from '../db/schema';

/**
 * Checks a model's claims against the pages this server actually downloaded.
 *
 * The model is asked to back every claim with a verbatim quote and the source
 * it came from. This file then does what the model cannot be trusted to do:
 * look for that quote in the real text. A quote that is not there is either a
 * paraphrase or an invention, and neither is evidence.
 *
 * What this proves is narrow and worth being honest about: *these words appear
 * on these pages*. Whether the pages are right is still the editor's call
 * (PRD section 5.5 point 2, section 6.1).
 */

/** Below this a "quote" is a phrase that matches anywhere and proves nothing. */
export const MIN_QUOTE_CHARS = 20;
const MIN_SEGMENT_CHARS = 8;

export function normaliseForMatch(text: string): string {
	return (
		text
			.normalize('NFKC')
			// Zero-width characters and soft hyphens: invisible, and they split words.
			.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
			.replace(/[\u2018\u2019\u201A\u201B\u2032`\u00B4]/g, "'")
			.replace(/[\u201C\u201D\u201E\u201F\u2033\u00AB\u00BB]/g, '"')
			.replace(/[\u2010-\u2015\u2212]/g, '-')
			.replace(/\u2026/g, '...')
			.toLowerCase()
			.replace(/\s+/g, ' ')
			.trim()
	);
}

/**
 * True when the quote occurs in the (already normalised) source text.
 *
 * An ellipsis splits the quote into segments that must all occur, in order --
 * so a model can trim the middle of a long sentence, but cannot stitch
 * together words from two different paragraphs into a sentence nobody wrote.
 */
export function quoteInText(quote: string, normalisedSource: string): boolean {
	const q = normaliseForMatch(quote)
		.replace(/^["']+|["']+$/g, '')
		.trim();
	if (q.length < MIN_QUOTE_CHARS) return false;

	const segments = q
		.split(/\s*(?:\[\.\.\.\]|\.\.\.)\s*/)
		.map((s) => s.trim())
		.filter(Boolean);
	if (segments.length > 1 && segments.some((s) => s.length < MIN_SEGMENT_CHARS)) return false;

	let from = 0;
	for (const segment of segments) {
		const at = normalisedSource.indexOf(segment, from);
		if (at === -1) return false;
		from = at + segment.length;
	}
	return true;
}

/**
 * Numbers that carry meaning -- two or more digits -- reduced to their digits.
 *
 * Separators are dropped because "1.000" (id) and "1,000" (en) are the same
 * number, and the article may be in either language. That makes 2.5 and 25
 * collide; acceptable, since the check exists to catch a number that appears
 * in *no* quote at all, which is what an invented figure looks like.
 */
export function numbersIn(text: string): string[] {
	const found = new Set<string>();
	for (const match of text.matchAll(/\d[\d.,]*\d/g)) {
		const digits = match[0].replace(/[.,]/g, '');
		if (digits.length >= 2) found.add(digits);
	}
	return [...found];
}

export type RawClaim = { statement: string; evidence: { source: string; quote: string }[] };
export type VerifiableSource = { key: string; domain: string; text: string };

export function verifyClaims(raw: RawClaim[], sources: VerifiableSource[]): AiClaim[] {
	const byKey = new Map(
		sources.map((s) => [s.key.toUpperCase(), { domain: s.domain, text: normaliseForMatch(s.text) }])
	);

	return raw.map((claim, index) => {
		const seen = new Set<string>();
		const evidence = claim.evidence
			.map((e) => ({ source: e.source.trim().toUpperCase(), quote: e.quote.trim() }))
			.filter((e) => {
				const id = `${e.source} ${normaliseForMatch(e.quote)}`;
				if (seen.has(id)) return false;
				seen.add(id);
				return true;
			})
			.map((e) => {
				const source = byKey.get(e.source);
				return { ...e, found: Boolean(source && quoteInText(e.quote, source.text)) };
			});

		const verified = evidence.filter((e) => e.found);
		const domains = [...new Set(verified.map((e) => byKey.get(e.source)!.domain))].sort();

		const quoted = new Set(numbersIn(verified.map((e) => e.quote).join(' ')));
		const unmatchedNumbers = numbersIn(claim.statement).filter((n) => !quoted.has(n));

		let status: ClaimStatus;
		if (verified.length === 0) status = 'unverified';
		else if (unmatchedNumbers.length > 0) status = 'mismatch';
		else if (domains.length >= 2) status = 'confirmed';
		else status = 'single';

		return {
			id: `C${index + 1}`,
			statement: claim.statement.trim(),
			evidence,
			status,
			domains,
			unmatchedNumbers,
			// Only what the pages support goes forward by default. The editor can
			// still untick a single-source claim, or tick a flagged one.
			included: status === 'confirmed' || status === 'single'
		};
	});
}
