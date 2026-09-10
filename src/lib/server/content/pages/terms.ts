import type { Locale } from '../../db/schema';
import type { PageContext, StaticPage } from './index';

export function terms(locale: Locale, ctx: PageContext): StaticPage {
	if (locale === 'id') {
		return {
			title: 'Ketentuan Penggunaan',
			description: `Ketentuan penggunaan ${ctx.siteName}.`,
			ads: false,
			markdown: `Terakhir diperbarui: ${ctx.updated}

Dengan menggunakan ${ctx.siteName}, Anda menyetujui ketentuan berikut.

## Isi situs

Seluruh artikel, gambar buatan sendiri, dan kode di situs ini adalah milik ${ctx.authorName}, kecuali dinyatakan lain.

Anda boleh mengutip sebagian isi situs ini disertai atribusi dan tautan ke halaman aslinya. Anda **tidak** boleh menerbitkan ulang artikel secara utuh, atau memakai isinya untuk membuat salinan situs ini.

## Akurasi

Artikel di sini ditulis dengan sungguh-sungguh dan diverifikasi sebelum terbit, tapi teknologi berubah cepat. Sesuatu yang benar saat ditulis bisa jadi tidak benar lagi saat Anda membacanya.

Isi situs ini bersifat informatif. Ia bukan nasihat profesional, dan keputusan teknis yang Anda ambil berdasarkan tulisan di sini adalah tanggung jawab Anda.

Kalau Anda menemukan sesuatu yang salah, beri tahu — lihat [Kontak](/id/contact).

## Tautan keluar

Situs ini menautkan ke situs lain yang tidak kami kendalikan. Tautan bukan berarti dukungan, dan kami tidak bertanggung jawab atas isi atau praktik privasi situs tujuan.

## Ketersediaan

Situs ini disediakan apa adanya. Tidak ada jaminan bahwa ia selalu tersedia, bebas kesalahan, atau bahwa sebuah URL akan tetap ada selamanya.

## Perubahan

Ketentuan ini dapat berubah. Perubahan tercermin pada tanggal di atas.

## Hukum yang berlaku

Ketentuan ini tunduk pada hukum Republik Indonesia.`
		};
	}

	return {
		title: 'Terms of Service',
		description: `Terms of use for ${ctx.siteName}.`,
		ads: false,
		markdown: `Last updated: ${ctx.updated}

By using ${ctx.siteName} you agree to the following.

## Content

All articles, original images and code on this site belong to ${ctx.authorName} unless stated otherwise.

You may quote portions of this site with attribution and a link to the original page. You may **not** republish articles in full, or use the content to build a copy of this site.

## Accuracy

Articles here are written in good faith and verified before publication, but technology moves quickly. Something true when written may not be true when you read it.

The content is informational. It is not professional advice, and technical decisions you make based on it are your own.

If you find something wrong, tell me — see [Contact](/en/contact).

## Outbound links

This site links to other sites we do not control. A link is not an endorsement, and we are not responsible for the content or privacy practices of the destination.

## Availability

The site is provided as is. There is no guarantee that it will always be available, error-free, or that any URL will exist forever.

## Changes

These terms may change. Changes are reflected in the date above.

## Governing law

These terms are governed by the laws of the Republic of Indonesia.`
	};
}
