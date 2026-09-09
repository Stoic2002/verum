import type { Locale } from '../db/schema';

/**
 * Confirmation and welcome copy, in both locales.
 *
 * Plain text and a minimal HTML part. Every transactional email is sent with
 * both, because a text-only client should not receive an empty message and a
 * heavily styled one is more likely to be filtered.
 */

const COPY = {
	en: {
		confirmSubject: 'Confirm your VERUM subscription',
		confirmLead: 'Click the link below to confirm your subscription to VERUM.',
		confirmAction: 'Confirm subscription',
		confirmIgnore: 'If you did not sign up, ignore this email — nothing happens without the click.',
		unsubscribe: 'Unsubscribe'
	},
	id: {
		confirmSubject: 'Konfirmasi langganan VERUM',
		confirmLead: 'Klik tautan di bawah untuk mengonfirmasi langganan Anda ke VERUM.',
		confirmAction: 'Konfirmasi langganan',
		confirmIgnore:
			'Kalau Anda tidak mendaftar, abaikan email ini — tidak ada yang terjadi tanpa klik itu.',
		unsubscribe: 'Berhenti langganan'
	}
} as const;

const escape = (value: string) =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function confirmationEmail(locale: Locale, confirmUrl: string) {
	const copy = COPY[locale] ?? COPY.en;
	const safe = escape(confirmUrl);

	return {
		subject: copy.confirmSubject,
		text: `${copy.confirmLead}\n\n${confirmUrl}\n\n${copy.confirmIgnore}\n`,
		html:
			`<p>${copy.confirmLead}</p>` +
			`<p><a href="${safe}">${copy.confirmAction}</a></p>` +
			`<p style="color:#666;font-size:14px">${copy.confirmIgnore}</p>`
	};
}
