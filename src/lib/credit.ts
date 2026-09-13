/**
 * Image credits (PRD §14: only clearly licensed stock or images made here).
 *
 * Client-safe, because both the media library form and the public pages use
 * it. A credit is shown under the image wherever it appears, and an article
 * cannot go live while any image it shows has none.
 */

export const CREDIT_MAX = 200;
export const CREDIT_URL_MAX = 2000;

/** The word in front of a credit. Neutral on purpose: not every image is a photo. */
export function creditLabel(locale: string): string {
	return locale === 'id' ? 'Gambar' : 'Image';
}

/**
 * Only http and https survive. The value ends up in an href on a public page,
 * so anything else — javascript:, data: — is dropped rather than linked.
 */
export function safeCreditUrl(raw: string | null | undefined): string | null {
	const value = (raw ?? '').trim();
	if (!value || value.length > CREDIT_URL_MAX) return null;
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
	} catch {
		return null;
	}
}

/** Why an article cannot go live yet, naming the images to fix. */
export function missingCreditMessage(ids: number[]): string {
	const list = ids.map((id) => `#${id}`).join(', ');
	return `Add a credit to image ${list} in the media library first. Every image on a live article shows where it came from (PRD §14).`;
}

export type ParsedCredit =
	{ ok: true; credit: string; creditUrl: string | null } | { ok: false; error: string };

/** Validates what the media library form submits. */
export function parseCredit(credit: unknown, creditUrl: unknown): ParsedCredit {
	const text = String(credit ?? '').trim();
	const link = String(creditUrl ?? '').trim();

	if (!text) {
		return {
			ok: false,
			error:
				'Credit is required — record who made the image, e.g. “Jane Doe / Unsplash”, or “VERUM” for your own.'
		};
	}
	if (text.length > CREDIT_MAX) {
		return { ok: false, error: `Keep the credit under ${CREDIT_MAX} characters.` };
	}

	const url = link ? safeCreditUrl(link) : null;
	if (link && !url) {
		return { ok: false, error: 'The source link must be a full http or https address.' };
	}

	return { ok: true, credit: text, creditUrl: url };
}
