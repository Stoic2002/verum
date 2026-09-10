import type { Locale } from '../../db/schema';
import type { PageContext, StaticPage } from './index';

/**
 * PRD §14 asks for a GDPR-grade policy: what is collected, the legal basis,
 * how to request deletion, and the third parties involved.
 *
 * This describes what the software actually does — aggregate view counts with
 * no identifier, a newsletter address only after double opt-in, and ad and
 * analytics scripts that load only after the CMP has a consent signal. Keeping
 * it accurate is a maintenance obligation: if the code changes, this changes.
 */
export function privacy(locale: Locale, ctx: PageContext): StaticPage {
	if (locale === 'id') {
		return {
			title: 'Kebijakan Privasi',
			description: `Data apa yang dikumpulkan ${ctx.siteName}, dasar hukumnya, dan cara meminta penghapusan.`,
			ads: false,
			markdown: `Terakhir diperbarui: ${ctx.updated}

Pengelola situs ini: ${ctx.authorName}. Kontak: [${ctx.contactEmail}](mailto:${ctx.contactEmail}).

## Yang dikumpulkan situs ini sendiri

**Hitungan pembacaan artikel.** Saat Anda membuka artikel, browser mengirim satu sinyal yang menambah penghitung harian untuk artikel itu. Yang disimpan hanya angka — tidak ada alamat IP, cookie, identifier, atau fingerprint. Data ini tidak bisa dikaitkan kembali ke siapa pun, termasuk oleh kami.

**Alamat email newsletter**, kalau Anda mendaftar. Alamat baru masuk ke daftar setelah Anda mengklik tautan konfirmasi yang kami kirim (*double opt-in*). Yang disimpan: alamat email, bahasa yang Anda pakai saat mendaftar, dan tanggal konfirmasi.

- Dasar hukum: persetujuan (GDPR Pasal 6(1)(a)).
- Menariknya kembali: tautan berhenti langganan ada di setiap email, atau kirim permintaan ke alamat kontak di atas.
- Retensi: sampai Anda berhenti langganan. Pendaftaran yang tidak pernah dikonfirmasi dihapus otomatis setelah 48 jam.

**Preferensi tampilan.** Pilihan tema terang/gelap disimpan di \`localStorage\` browser Anda. Tidak pernah dikirim ke server kami.

## Yang dikumpulkan pihak ketiga

**Google AdSense** (iklan). Iklan personal memakai cookie. Sebelum iklan tampil, Anda akan melihat dialog persetujuan dari Google Funding Choices; skrip iklan **tidak dimuat sebelum Anda menjawabnya**. Anda bisa menolak, dan pilihan itu bisa diubah kapan saja lewat dialog yang sama. Rincian: [kebijakan privasi Google](https://policies.google.com/privacy).

**Cloudflare** (CDN dan keamanan). Sebagai perantara setiap permintaan, Cloudflare memproses alamat IP Anda untuk mengirimkan halaman dan menahan serangan. Dasar hukum: kepentingan sah (GDPR Pasal 6(1)(f)) — situs ini tidak bisa disajikan tanpanya.

**Penyedia email.** Alamat newsletter Anda diproses oleh penyedia pengiriman email kami semata-mata untuk mengirimkan email yang Anda minta.

Situs ini juga menyematkan video YouTube memakai domain \`youtube-nocookie.com\`, yang menunda cookie pelacak sampai Anda benar-benar memutar videonya.

## Hak Anda

Kalau Anda berada di Uni Eropa, EEA, Inggris, atau Swiss, Anda berhak meminta akses, koreksi, penghapusan, dan portabilitas atas data pribadi Anda, serta menolak pemrosesan tertentu.

Kirim permintaan ke [${ctx.contactEmail}](mailto:${ctx.contactEmail}). Dijawab dalam 30 hari.

Karena hitungan pembacaan tidak memuat identifier apa pun, data itu tidak bisa dicari, diekspor, atau dihapus per orang — tidak ada yang menghubungkannya ke Anda.

## Anak-anak

Situs ini tidak ditujukan untuk anak di bawah 13 tahun dan tidak mengumpulkan data mereka secara sengaja.

## Perubahan

Perubahan pada kebijakan ini akan tercermin pada tanggal di atas.`
		};
	}

	return {
		title: 'Privacy Policy',
		description: `What ${ctx.siteName} collects, on what legal basis, and how to request deletion.`,
		ads: false,
		markdown: `Last updated: ${ctx.updated}

This site is operated by ${ctx.authorName}. Contact: [${ctx.contactEmail}](mailto:${ctx.contactEmail}).

## What this site collects itself

**Article read counts.** When you open an article, your browser sends one signal that increments a daily counter for that article. Only the number is stored — no IP address, cookie, identifier or fingerprint. This data cannot be linked back to anyone, including by us.

**A newsletter email address**, if you subscribe. An address joins the list only after you click the confirmation link we send (*double opt-in*). What is stored: the email address, the language you signed up in, and the confirmation date.

- Legal basis: consent (GDPR Article 6(1)(a)).
- Withdrawing it: the unsubscribe link in every email, or a request to the address above.
- Retention: until you unsubscribe. Sign-ups that are never confirmed are deleted automatically after 48 hours.

**Display preference.** Your light/dark theme choice is stored in your browser's \`localStorage\`. It is never sent to our server.

## What third parties collect

**Google AdSense** (advertising). Personalised ads use cookies. Before any ad appears you will see a consent dialog from Google Funding Choices, and **the ad scripts do not load until you answer it**. You may decline, and you can change that choice at any time through the same dialog. Details: [Google's privacy policy](https://policies.google.com/privacy).

**Cloudflare** (CDN and security). As the intermediary for every request, Cloudflare processes your IP address to deliver pages and absorb attacks. Legal basis: legitimate interest (GDPR Article 6(1)(f)) — the site cannot be served without it.

**Email provider.** Your newsletter address is processed by our email delivery provider solely to send you the email you asked for.

This site also embeds YouTube videos through the \`youtube-nocookie.com\` domain, which defers tracking cookies until you actually play a video.

## Your rights

If you are in the EU, EEA, UK or Switzerland, you have the right to request access to, correction of, deletion of and portability of your personal data, and to object to certain processing.

Send requests to [${ctx.contactEmail}](mailto:${ctx.contactEmail}). Answered within 30 days.

Because read counts contain no identifier, that data cannot be searched, exported or deleted per person — there is nothing linking it to you.

## Children

This site is not directed at children under 13 and does not knowingly collect their data.

## Changes

Any change to this policy will be reflected in the date above.`
	};
}
