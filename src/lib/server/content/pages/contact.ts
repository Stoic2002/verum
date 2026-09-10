import type { Locale } from '../../db/schema';
import type { PageContext, StaticPage } from './index';

/** PRD §14: a reachable contact address, with a stated response window. */
export function contact(locale: Locale, ctx: PageContext): StaticPage {
	if (locale === 'id') {
		return {
			title: 'Kontak',
			description: `Cara menghubungi ${ctx.siteName} untuk koreksi, hak jawab, atau pertanyaan.`,
			markdown: `Email: [${ctx.contactEmail}](mailto:${ctx.contactEmail})

Semua pesan dibaca oleh ${ctx.authorName}. Respons dalam **7 hari kerja**.

## Koreksi dan hak jawab

Kalau ada kesalahan faktual di sebuah artikel, kirimkan tautan artikelnya dan bagian yang keliru. Kalau memungkinkan, sertakan sumber yang benar — itu mempercepat prosesnya.

Kesalahan yang terbukti diperbaiki, dan untuk kesalahan material ditambahkan catatan koreksi bertanggal. Prosesnya dijelaskan di [Kebijakan Editorial](/id/editorial-policy).

## Permintaan penghapusan

Untuk keberatan hak cipta atau permintaan penghapusan konten, sertakan tautan halaman, penjelasan keberatannya, dan dasar hukumnya.

## Privasi

Untuk permintaan terkait data pribadi — akses, koreksi, atau penghapusan — lihat [Kebijakan Privasi](/id/privacy) dan kirim permintaannya ke alamat email di atas.

## Yang tidak dilayani

- Permintaan penempatan tautan dan guest post
- Siaran pers untuk ditulis ulang
- Tawaran menerbitkan artikel yang sudah jadi

Tulisan di sini dikerjakan sendiri. Tidak ada slot untuk konten kiriman.`
		};
	}

	return {
		title: 'Contact',
		description: `How to reach ${ctx.siteName} about a correction, a right of reply, or a question.`,
		markdown: `Email: [${ctx.contactEmail}](mailto:${ctx.contactEmail})

Everything is read by ${ctx.authorName}. Response within **7 working days**.

## Corrections and right of reply

If an article contains a factual error, send the link and the passage that is wrong. Where possible include the correct source — it makes the fix much faster.

Substantiated errors are corrected, and material ones get a dated correction note. The process is set out in the [Editorial Policy](/en/editorial-policy).

## Takedown requests

For copyright complaints or removal requests, include the page link, what the objection is, and the legal basis for it.

## Privacy

For requests about personal data — access, correction or deletion — see the [Privacy Policy](/en/privacy) and send the request to the address above.

## Not accepted

- Link placement requests and guest posts
- Press releases to be rewritten
- Offers to publish finished articles

Everything here is written in-house. There is no slot for submitted content.`
	};
}
