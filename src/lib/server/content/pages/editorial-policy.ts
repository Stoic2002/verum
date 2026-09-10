import type { Locale } from '../../db/schema';
import type { PageContext, StaticPage } from './index';

/**
 * PRD §6.3 makes this page mandatory and fixes its three required contents:
 * that AI is used in drafting, that every article is reviewed and verified by
 * a human before publication, and how to reach the editor about a correction.
 */
export function editorialPolicy(locale: Locale, ctx: PageContext): StaticPage {
	if (locale === 'id') {
		return {
			title: 'Kebijakan Editorial',
			description: `Bagaimana artikel ${ctx.siteName} ditulis, diverifikasi, dan dikoreksi — termasuk peran AI.`,
			markdown: `Terakhir diperbarui: ${ctx.updated}

## Peran AI dalam penulisan

AI dipakai di situs ini untuk riset awal, penyusunan draf, dan penyuntingan bahasa. Sebagian besar draf awal dibantu AI.

**Setiap artikel melewati review dan verifikasi manusia sebelum terbit.** Tidak ada tulisan yang diterbitkan tanpa dibaca, diperiksa, dan disetujui oleh ${ctx.authorName}.

Yang tidak pernah diserahkan ke AI:

- **Pemilihan topik dan sudut pandang.** Apa yang layak ditulis adalah penilaian editorial.
- **Klaim faktual tanpa verifikasi.** Setiap angka, tanggal, nama produk, dan pernyataan faktual dicek ke sumber primer oleh manusia.
- **Penilaian, rekomendasi, dan opini.** Kalau sebuah artikel menyarankan satu tool di atas yang lain, itu penilaian orang yang memakainya.
- **Bagian yang membuat artikel ini berbeda.** Angka hasil pengujian sendiri, tangkapan layar percobaan sendiri, dan kesimpulan dari pemakaian langsung.

## Standar sebelum terbit

Empat pertanyaan yang harus dijawab setiap artikel:

1. **Nilai tambah.** Ada minimal satu hal yang tidak ada di lima hasil teratas Google.
2. **Verifikasi.** Setiap klaim faktual dicek ke sumber primer.
3. **Judul jujur.** Isi artikel benar-benar menjawab judulnya.
4. **Bisa dipertanggungjawabkan.** Kalau ada yang protes, dasarnya bisa ditunjukkan.

Artikel yang gagal salah satunya tidak diterbitkan.

## Koreksi

Kesalahan faktual diperbaiki langsung di artikel. Untuk kesalahan material — yang mengubah kesimpulan atau menyesatkan pembaca — catatan koreksi ditambahkan di bagian bawah artikel beserta tanggalnya, dan tanggal pembaruan artikel diperbarui.

Artikel tidak dihapus diam-diam untuk menutupi kesalahan.

Untuk melaporkan kesalahan: [${ctx.contactEmail}](mailto:${ctx.contactEmail}). Respons dalam 7 hari kerja.

## Sumber gambar

Hanya stock berlisensi jelas (misalnya Unsplash, Pexels) atau buatan sendiri. Gambar tidak diambil dari artikel media lain.

## Afiliasi dan konten bersponsor

Kalau sebuah tautan menghasilkan komisi, itu dinyatakan secara eksplisit di artikelnya dan tautannya diberi atribut \`rel="sponsored"\`. Artikel bersponsor ditandai jelas sebagai bersponsor.

Kompensasi tidak pernah mengubah penilaian di dalam artikel. Kalau sebuah produk berbayar ternyata buruk, itu yang ditulis.

## Kemandirian

${ctx.siteName} adalah publikasi teknologi, bukan media pers, dan tidak berafiliasi dengan perusahaan mana pun yang produknya dibahas.`
		};
	}

	return {
		title: 'Editorial Policy',
		description: `How ${ctx.siteName} articles are written, verified and corrected — including the role of AI.`,
		markdown: `Last updated: ${ctx.updated}

## The role of AI

AI is used on this site for initial research, drafting, and language editing. A substantial part of a first draft is AI-assisted.

**Every article goes through human review and verification before it is published.** Nothing appears here that has not been read, checked and approved by ${ctx.authorName}.

What is never delegated to AI:

- **Choosing topics and angles.** What is worth writing about is an editorial judgement.
- **Factual claims without verification.** Every number, date, product name and factual statement is checked against a primary source by a person.
- **Judgement, recommendations and opinion.** When an article recommends one tool over another, that is the view of someone who used it.
- **The part that makes the article worth reading.** Numbers from tests I ran, screenshots of my own attempts, and conclusions earned by use.

## The bar for publication

Four questions every article has to answer:

1. **Information gain.** There is at least one thing here that is not in the top five Google results.
2. **Verification.** Every factual claim has been checked against a primary source.
3. **Honest headline.** The article actually answers its own title.
4. **Defensible.** If someone challenges it, I can show what it rests on.

An article that fails any of them is not published.

## Corrections

Factual errors are fixed in the article itself. For material errors — ones that change a conclusion or mislead a reader — a dated correction note is added at the foot of the article and the modified date is updated.

Articles are not quietly deleted to hide a mistake.

To report an error: [${ctx.contactEmail}](mailto:${ctx.contactEmail}). Response within 7 working days.

## Images

Only clearly licensed stock (Unsplash, Pexels and similar) or images made here. Images are not taken from other publications' articles.

## Affiliate links and sponsored content

If a link earns a commission, that is stated explicitly in the article and the link carries \`rel="sponsored"\`. Sponsored articles are labelled as sponsored.

Compensation never changes the assessment inside an article. If a paid-for product turns out to be poor, that is what gets written.

## Independence

${ctx.siteName} is a technology publication, not a press outlet, and is not affiliated with any company whose products it covers.`
	};
}
