import type { Locale } from '../../db/schema';
import type { PageContext, StaticPage } from './index';

/**
 * No personal name on these pages: the site is presented as the work of the
 * VERUM development team. Still no invented credentials, and no claim to be a
 * press outlet (PRD §14).
 */
export function about(locale: Locale, ctx: PageContext): StaticPage {
	if (locale === 'id') {
		return {
			title: `Tentang ${ctx.siteName}`,
			description: `Siapa di balik ${ctx.siteName}, dan bagaimana artikelnya dikerjakan.`,
			markdown: `${ctx.siteName} dikelola oleh **${ctx.team}**, sekelompok developer di Indonesia yang memakai tool AI untuk pekerjaan sehari-hari.

${ctx.siteName} adalah publikasi teknologi, bukan media pers. Tim yang sama menulis, menyunting, dan bertanggung jawab atas setiap tulisan di sini.

## Kenapa situs ini ada

Sebagian besar tulisan tentang tool AI adalah siaran pers yang ditulis ulang. Yang jarang ada: orang yang benar-benar memakai tool itu untuk pekerjaan sungguhan, lalu menuliskan apa yang terjadi.

Itu yang dikerjakan di sini. Setiap artikel harus memuat minimal satu hal yang tidak ada di hasil pencarian teratas — angka dari pengujian sendiri, tangkapan layar percobaan sendiri, atau penilaian dari pemakaian langsung.

## Cara kerjanya

Sebelum terbit, setiap artikel harus lolos empat pertanyaan:

1. Apakah ada sesuatu di sini yang tidak ada di lima hasil teratas Google?
2. Apakah setiap klaim faktual, angka, dan tanggal sudah dicek ke sumber primer?
3. Apakah isi artikel benar-benar menjawab judulnya?
4. Kalau ada yang mempertanyakan artikel ini, bisakah kami menunjukkan dasarnya?

Artikel yang gagal di salah satu poin tidak diterbitkan, sekalipun sudah selesai ditulis.

## Soal AI

AI dipakai dalam proses penulisan di sini, dan itu tidak disembunyikan. Yang tidak diserahkan ke AI: pemilihan topik, penilaian, rekomendasi, dan verifikasi fakta. Penjelasan lengkapnya ada di [Kebijakan Editorial](/id/editorial-policy).

## Yang tidak ditulis di sini

Politik, bencana, kesehatan, dan keuangan personal. Bukan karena tidak penting — justru sebaliknya. Topik-topik itu menuntut keahlian yang tidak kami punya, dan salah menulisnya merugikan pembaca dengan cara yang tidak bisa diperbaiki oleh koreksi.

## Menghubungi

Koreksi, keberatan, atau pertanyaan: [${ctx.contactEmail}](mailto:${ctx.contactEmail}). Lihat halaman [Kontak](/id/contact).`
		};
	}

	return {
		title: `About ${ctx.siteName}`,
		description: `Who is behind ${ctx.siteName}, and how the articles are made.`,
		markdown: `${ctx.siteName} is run by **${ctx.team}**, a group of developers based in Indonesia who use AI tools in their daily work.

${ctx.siteName} is a technology publication, not a press outlet. The same team writes, edits, and is answerable for everything published here.

## Why this site exists

Most writing about AI tools is a press release, rewritten. What is rare is people who actually used the tool for real work and then wrote down what happened.

That is the job here. Every article has to contain at least one thing that is not already in the top search results — a number from a test we ran, a screenshot of our own attempt, or a judgement earned by using the thing.

## How it works

Before anything is published, it has to pass four questions:

1. Is there something here that is not in the top five Google results?
2. Has every factual claim, number and date been checked against a primary source?
3. Does the article actually answer its own headline?
4. If someone challenges this piece, can we show what it rests on?

An article that fails any of them is not published, however finished it is.

## About AI

AI is used in the writing process here, and that is not hidden. What is not delegated to it: choosing topics, judgement, recommendations, and fact-checking. The full explanation is in the [Editorial Policy](/en/editorial-policy).

## What is not covered

Politics, disasters, health, and personal finance. Not because they do not matter — because they do. Those subjects demand expertise we do not have, and getting them wrong harms readers in ways a correction cannot undo.

## Getting in touch

Corrections, objections, or questions: [${ctx.contactEmail}](mailto:${ctx.contactEmail}). See the [Contact](/en/contact) page.`
	};
}
