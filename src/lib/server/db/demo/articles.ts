/**
 * Long-form demo bodies.
 *
 * Written to exercise every path the render pipeline has: headings deep enough
 * for a table of contents, a fenced code block, a table, a blockquote, a
 * callout, an image directive, a YouTube embed, an X card, and enough prose on
 * both sides of the first paragraph that the mid-article ad slot appears
 * (PRD §13.1).
 */

export const LONG_EN = (
	imageId: number
) => `Every few weeks another AI coding assistant claims it can refactor a legacy codebase on its own. The claims are easy to make and hard to check, which is exactly why most coverage stops at the press release. This piece does not: six assistants were given the same twenty-year-old Java service and the same brief, and everything below is what came out of it.

The service is a real one — 41,000 lines, no test suite worth the name, and a persistence layer written before anyone on the current team joined. It is the kind of code these tools are sold for.

## How the test was run

Each assistant got an identical prompt, an identical repository checkout, and no follow-up help beyond answering direct questions about the build. Nothing was cherry-picked afterwards.

::image{id=${imageId} caption="The service before the refactor. Every arrow is a compile-time dependency."}

The measurements are wall-clock time from first prompt to a build that passes, and the number of corrections needed along the way. A correction means the assistant produced something that did not compile, changed behaviour, or removed code it should not have.

:::callout{type="warning" title="What these numbers are not"}
This is one codebase. A Java service with weak tests plays to some tools and against others. Treat the ranking as evidence, not as a verdict.
:::

## Results

| Assistant | Time to green build | Corrections | Behaviour changes |
|---|---|---|---|
| Tool A | 41 min | 3 | 0 |
| Tool B | 58 min | 7 | 1 |
| Tool C | 1 h 52 min | 14 | 2 |
| Tool D | did not finish | 21 | 4 |
| Tool E | 47 min | 5 | 0 |
| Tool F | 1 h 09 min | 9 | 1 |

The gap between the fastest and the slowest is not really about speed. It is about how each one behaves when it is wrong.

### The failure that mattered

Two assistants silently changed behaviour. Both rewrote a date-handling branch that had an off-by-one in it, decided the off-by-one was a bug, and fixed it. It was not a bug — downstream systems depend on it, and there is a comment three files away saying so.

\`\`\`java
// Deliberate: the billing window closes at 23:59:59 on the previous day.
// Do not "fix" this without talking to the settlement team.
LocalDate window = invoiceDate.minusDays(1);
\`\`\`

An assistant that reads one file at a time cannot see that comment. The ones that scored well were the ones that asked before changing anything they could not fully explain.

> The useful question is not which tool writes the most code. It is which one stops when it does not know.

## What this changes about how I work

I have stopped asking these tools to refactor anything I have not read myself. The time saved was never in the typing.

::youtube{id="dQw4w9WgXcQ" title="A recording of the third run, unedited"}

For narrow, well-fenced work — extracting a method, adding a parameter through a call chain, writing the test I already described — they are genuinely faster than I am. For anything where being wrong is expensive, the review takes longer than the work would have.

::x{url="https://x.com/svelte_society/status/1234567890123456789"}



## The setup, in enough detail to repeat

The repository is a Spring Boot 2.7 service with 41,412 lines of Java across 318 files. It has 74 tests, of which 61 assert nothing beyond "did not throw". Coverage tooling reports 34 per cent; the honest number is closer to nine.

Each run started from the same commit on a clean branch. The machine was the same throughout: a 2024 laptop, sixteen gigabytes of memory, nothing else running. Network conditions were not controlled, which matters for the hosted tools and does not for the two that run locally.

The brief given to every assistant was identical, and deliberately the kind of thing a team lead actually writes rather than a benchmark prompt:

> Split OrderProcessor into smaller units. It is 1,900 lines and four people are afraid of it. Do not change behaviour. If you are unsure whether something is intentional, ask rather than guess.

The last sentence was in every prompt. Two tools acted on it. Four ignored it.

### What was measured, and what was not

Measured: wall-clock time to a build that passes, number of corrections, number of behaviour changes reaching the test environment, and lines added versus removed.

Not measured: subjective code quality, cost per run, or how the result reads six months later. The first is not comparable between reviewers, the second changes monthly, and the third would take six months.

Nothing was excluded after the fact. The run that did not finish is reported as not finishing rather than dropped, which is the only honest way to handle it.

## Why the corrections matter more than the clock

A tool that finishes in forty minutes and needs three corrections is not twice as good as one that finishes in eighty and needs six. The corrections are where your attention goes, and attention is the scarce thing.

Counting them turned out to be harder than counting minutes. A correction is not a compile error — a compile error is cheap, immediate and self-announcing. The expensive ones are the changes that compile, pass what tests exist, and quietly mean something different.

So each run was scored twice: once by the build, and once by reading every diff line by line. The second pass took longer than the refactor.

### The three shapes a bad change takes

The first shape is deletion. Code that looks unreachable gets removed, and it is unreachable only because the caller lives in a module the assistant never opened. Two runs produced this, both on the same dead-looking factory class that is reflected into at startup.

The second is over-generalisation. A method that handled one case grows a strategy parameter, an enum and a switch, because the assistant inferred a pattern from two call sites that happened to look alike. Nothing breaks. The file is now forty lines longer and harder to read.

The third is the one described above: a deliberate quirk mistaken for a defect.

Only the third caused a behaviour change that reached a test environment. It is also the only one no amount of prompting prevented.

## What a good run looked like

The two assistants that scored best behaved the same way in one specific respect: when they could not explain a piece of code, they said so and left it alone.

\`\`\`text
I can move the validation into a separate method, but ProductRule.apply()
reads a field that is set somewhere I cannot find in the files I have.
Moving it may change initialisation order. Do you want me to proceed?
\`\`\`

That question cost about ninety seconds to answer and saved a bug that would have taken an afternoon to find. Neither of the two slowest tools ever asked anything.

### Prompting made less difference than expected

Three prompt variants were tried on the two worst performers: a short instruction, a long one with explicit constraints, and one that named the specific risks found in earlier runs.

The long prompts reduced the number of corrections by roughly a quarter. They did not change the kind of correction. A tool that rewrites code it does not understand rewrites it more carefully when told to, and still rewrites it.

## What I would tell someone starting this week

Pick the tool that asks questions. Then give it work where the cost of being wrong is visible within a minute — a failing test, a type error, a broken build. Keep it away from anything where being wrong is silent, which in practice means anything touching money, dates, or a boundary another team depends on.

That is a narrower recommendation than the marketing, and it is the one the numbers support.

## Method and raw data

Every prompt, every diff and every build log is in the repository linked at the top. If a number here looks wrong, that is where to check it.`;

export const LONG_ID = (
	imageId: number
) => `Setiap beberapa minggu muncul lagi asisten coding AI yang mengklaim bisa merapikan basis kode lama sendirian. Klaimnya mudah dibuat dan sulit diperiksa — dan itulah kenapa sebagian besar liputan berhenti di siaran pers. Tulisan ini tidak: enam asisten diberi service Java berumur dua puluh tahun yang sama dan tugas yang sama, dan semua di bawah ini adalah hasilnya.

Service-nya nyata — 41.000 baris, tanpa test suite yang layak disebut begitu, dan lapisan persistensi yang ditulis sebelum siapa pun di tim sekarang bergabung. Persis jenis kode yang jadi alasan tool ini dijual.

## Cara pengujiannya

Setiap asisten mendapat prompt identik, checkout repositori identik, dan tidak ada bantuan lanjutan selain menjawab pertanyaan langsung soal build. Tidak ada yang dipilih-pilih setelahnya.

::image{id=${imageId} caption="Service sebelum dirapikan. Setiap panah adalah dependensi saat kompilasi."}

Yang diukur adalah waktu dari prompt pertama sampai build yang lolos, dan jumlah koreksi yang dibutuhkan di sepanjang jalan. Koreksi berarti asisten menghasilkan sesuatu yang tidak bisa dikompilasi, mengubah perilaku, atau menghapus kode yang seharusnya tidak dihapus.

:::callout{type="warning" title="Angka ini bukan apa"}
Ini satu basis kode. Service Java dengan test lemah menguntungkan sebagian tool dan merugikan sebagian lain. Perlakukan peringkatnya sebagai bukti, bukan sebagai vonis.
:::

## Hasil

| Asisten | Waktu sampai build hijau | Koreksi | Perubahan perilaku |
|---|---|---|---|
| Tool A | 41 menit | 3 | 0 |
| Tool B | 58 menit | 7 | 1 |
| Tool C | 1 j 52 m | 14 | 2 |
| Tool D | tidak selesai | 21 | 4 |
| Tool E | 47 menit | 5 | 0 |
| Tool F | 1 j 09 m | 9 | 1 |

Jarak antara yang tercepat dan yang terlambat sebenarnya bukan soal kecepatan. Itu soal bagaimana masing-masing bersikap saat ia salah.

### Kegagalan yang penting

Dua asisten diam-diam mengubah perilaku. Keduanya menulis ulang cabang penanganan tanggal yang punya selisih satu hari, memutuskan itu bug, lalu memperbaikinya. Itu bukan bug — sistem di hilir bergantung padanya, dan ada komentar tiga berkas jauhnya yang menyatakannya.

\`\`\`java
// Disengaja: jendela penagihan tutup pukul 23:59:59 hari sebelumnya.
// Jangan "diperbaiki" tanpa bicara dengan tim settlement.
LocalDate window = invoiceDate.minusDays(1);
\`\`\`

Asisten yang membaca satu berkas pada satu waktu tidak bisa melihat komentar itu. Yang nilainya bagus adalah yang bertanya lebih dulu sebelum mengubah apa pun yang tidak bisa ia jelaskan sepenuhnya.

> Pertanyaan yang berguna bukan tool mana yang menulis kode paling banyak. Tapi tool mana yang berhenti saat ia tidak tahu.

## Yang berubah dari cara saya bekerja

Saya berhenti meminta tool ini merapikan apa pun yang belum saya baca sendiri. Waktu yang hemat tidak pernah ada di pengetikannya.

::youtube{id="dQw4w9WgXcQ" title="Rekaman percobaan ketiga, tanpa suntingan"}

Untuk pekerjaan sempit dan berpagar jelas — mengekstrak method, menambah parameter menembus rantai pemanggilan, menulis test yang sudah saya jelaskan — mereka benar-benar lebih cepat daripada saya. Untuk apa pun yang salahnya mahal, reviewnya makan waktu lebih lama daripada mengerjakannya sendiri.

::x{url="https://x.com/svelte_society/status/1234567890123456789"}



## Persiapannya, cukup rinci untuk diulang

Repositorinya adalah service Spring Boot 2.7 dengan 41.412 baris Java di 318 berkas. Ada 74 test, 61 di antaranya tidak menegaskan apa pun selain "tidak melempar error". Tool coverage melaporkan 34 persen; angka jujurnya lebih dekat ke sembilan.

Setiap percobaan dimulai dari commit yang sama pada branch bersih. Mesinnya sama sepanjang pengujian: laptop 2024, memori enam belas gigabita, tanpa aplikasi lain berjalan. Kondisi jaringan tidak dikendalikan — itu berpengaruh untuk tool yang berjalan di server, dan tidak untuk dua yang berjalan lokal.

Tugas yang diberikan ke setiap asisten identik, dan sengaja berbentuk seperti yang benar-benar ditulis seorang team lead, bukan seperti prompt benchmark:

> Pecah OrderProcessor jadi unit-unit yang lebih kecil. Panjangnya 1.900 baris dan empat orang takut menyentuhnya. Jangan ubah perilakunya. Kalau ragu apakah sesuatu disengaja, tanyakan, jangan menebak.

Kalimat terakhir ada di setiap prompt. Dua tool menjalankannya. Empat mengabaikannya.

### Yang diukur, dan yang tidak

Diukur: waktu sampai build lolos, jumlah koreksi, jumlah perubahan perilaku yang sampai ke lingkungan test, dan baris yang ditambah versus dihapus.

Tidak diukur: kualitas kode secara subjektif, biaya per percobaan, dan bagaimana hasilnya terbaca enam bulan kemudian. Yang pertama tidak sebanding antar-peninjau, yang kedua berubah tiap bulan, dan yang ketiga butuh enam bulan.

Tidak ada yang dikecualikan belakangan. Percobaan yang tidak selesai dilaporkan sebagai tidak selesai, bukan dibuang — itu satu-satunya cara jujur menanganinya.

## Kenapa koreksi lebih penting daripada jam

Tool yang selesai dalam empat puluh menit dengan tiga koreksi tidak dua kali lebih baik daripada yang selesai dalam delapan puluh menit dengan enam koreksi. Koreksi adalah tempat perhatian Anda habis, dan perhatian adalah yang langka.

Menghitungnya ternyata lebih sulit daripada menghitung menit. Koreksi bukan error kompilasi — error kompilasi itu murah, langsung, dan mengumumkan dirinya sendiri. Yang mahal adalah perubahan yang tetap terkompilasi, lolos test yang ada, dan diam-diam berarti sesuatu yang berbeda.

Jadi setiap percobaan dinilai dua kali: sekali oleh build, sekali dengan membaca setiap baris diff. Pemeriksaan kedua memakan waktu lebih lama daripada refactor-nya sendiri.

### Tiga bentuk perubahan yang buruk

Bentuk pertama adalah penghapusan. Kode yang terlihat tidak terjangkau dihapus, dan ia terlihat begitu hanya karena pemanggilnya ada di modul yang tidak pernah dibuka asisten. Dua percobaan menghasilkan ini, keduanya pada kelas factory yang tampak mati tapi diakses lewat refleksi saat startup.

Bentuk kedua adalah generalisasi berlebihan. Method yang menangani satu kasus tumbuh jadi punya parameter strategi, enum, dan switch, karena asisten menyimpulkan pola dari dua tempat pemanggilan yang kebetulan mirip. Tidak ada yang rusak. Berkasnya sekarang empat puluh baris lebih panjang dan lebih sulit dibaca.

Bentuk ketiga adalah yang dijelaskan di atas: keanehan yang disengaja disalahartikan sebagai cacat.

Hanya bentuk ketiga yang menyebabkan perubahan perilaku sampai ke lingkungan test. Itu juga satu-satunya yang tidak bisa dicegah oleh prompt seperti apa pun.

## Seperti apa percobaan yang bagus

Dua asisten dengan nilai terbaik berperilaku sama dalam satu hal spesifik: ketika mereka tidak bisa menjelaskan sepotong kode, mereka mengatakannya dan membiarkannya.

\`\`\`text
Saya bisa memindahkan validasi ini ke method terpisah, tapi ProductRule.apply()
membaca field yang di-set di suatu tempat yang tidak saya temukan di berkas
yang saya punya. Memindahkannya bisa mengubah urutan inisialisasi. Lanjut?
\`\`\`

Pertanyaan itu butuh sekitar sembilan puluh detik untuk dijawab dan menyelamatkan satu bug yang akan memakan satu sore untuk ditemukan. Kedua tool paling lambat tidak pernah menanyakan apa pun.

### Prompt berpengaruh lebih kecil daripada dugaan

Tiga varian prompt dicoba pada dua tool dengan hasil terburuk: instruksi pendek, instruksi panjang dengan batasan eksplisit, dan satu yang menyebutkan risiko spesifik yang ditemukan di percobaan sebelumnya.

Prompt panjang mengurangi jumlah koreksi sekitar seperempat. Ia tidak mengubah jenis koreksinya. Tool yang menulis ulang kode yang tidak ia pahami akan menulis ulangnya dengan lebih hati-hati kalau diminta, dan tetap menulis ulangnya.

## Yang akan saya katakan pada orang yang baru mulai minggu ini

Pilih tool yang bertanya. Lalu beri ia pekerjaan yang biaya salahnya terlihat dalam satu menit — test gagal, error tipe, build rusak. Jauhkan dari apa pun yang salahnya diam, yang dalam praktiknya berarti apa pun yang menyentuh uang, tanggal, atau batas yang tim lain bergantung padanya.

Itu rekomendasi yang lebih sempit daripada pemasarannya, dan itulah yang didukung angkanya.

## Metode dan data mentah

Setiap prompt, setiap diff, dan setiap log build ada di repositori yang ditautkan di atas. Kalau ada angka di sini yang terlihat salah, di situ tempat memeriksanya.`;

export const MEDIUM_EN = (
	imageId: number
) => `Postgres ships with a full-text search engine that most projects never turn on, reaching for a separate search service instead. For a site with a few hundred articles that is a second system to run, back up and keep in sync, in exchange for ranking quality nobody will notice.

Here is what the built-in one actually does, and where it stops being enough.

## Ranking

\`ts_rank_cd\` weighs how close the matched terms sit to each other, which starts to matter as soon as article bodies are in the index rather than just titles.

::image{id=${imageId} caption="Rank distribution across 300 articles for a two-word query."}

\`\`\`sql
SELECT title, ts_rank_cd(search_vector, q, 32) AS rank
FROM articles, websearch_to_tsquery('english', $1) q
WHERE search_vector @@ q
ORDER BY rank DESC;
\`\`\`

The normalisation flag matters more than the function choice: 32 divides by the rank plus one, so a long article does not outrank a short precise one simply for containing more words.

:::callout{type="tip" title="Use websearch_to_tsquery"}
It accepts quoted phrases, OR, and -exclusion the way people already type them, and it never raises a syntax error on odd input. \`to_tsquery\` will happily throw on a stray bracket.
:::

## Where it stops

No typo tolerance, no synonyms you did not configure, and no cross-language search in one query. If any of those are requirements, this is the wrong tool. If they are not, the second system was never worth running.`;

/**
 * A curated listicle, the fourth format PRD §5.4 prioritises.
 *
 * The selection criteria are stated before the list, which is the part §5.4
 * actually requires: "harus punya kriteria seleksi eksplisit". A listicle
 * without them is a ranking nobody can check.
 *
 * The titles below are placeholders for the format. Nothing here has been
 * verified against a current chart, and publishing it as-is would fail the
 * quality gate in §5.5 — point 2, every factual claim checked against a
 * primary source.
 */
export const DRAKOR_ID = (
	imageId: number
) => `Daftar "drama Korea terbaik" biasanya disusun dari apa yang sedang ramai dibicarakan, bukan dari apa yang benar-benar bertahan setelah episode keempat. Yang ini disusun dengan kriteria yang bisa Anda periksa sendiri, dan kriterianya ditulis lebih dulu supaya tidak bisa dikarang belakangan.

Lima judul di bawah dipilih dari drama yang tayang dalam dua belas bulan terakhir dan sudah selesai atau melewati separuh episodenya — cukup untuk menilai, belum cukup lama untuk jadi nostalgia.

## Kriteria seleksi

Empat hal, dengan bobot yang sama:

1. **Konsistensi paruh kedua.** Banyak drama kuat di empat episode pertama lalu runtuh. Yang tidak bertahan tidak masuk daftar.
2. **Penulisan, bukan pemeran.** Nama besar tidak menaikkan peringkat.
3. **Selesai dengan tuntas.** Akhir yang menggantung karena mengejar musim kedua dikurangi nilainya.
4. **Bisa ditonton tanpa konteks.** Tidak menuntut Anda sudah menonton tiga judul lain.

Yang **tidak** dipakai: rating penayangan, jumlah penonton platform, dan tren media sosial. Ketiganya mengukur seberapa banyak orang menonton, bukan apakah tontonannya bagus.

::image{id=${imageId} caption="Distribusi penilaian paruh pertama versus paruh kedua untuk dua puluh judul yang dipertimbangkan."}

:::callout{type="warning" title="Judul di bawah adalah contoh format"}
Daftar ini belum diverifikasi terhadap data tayang mana pun. Ia ada untuk menunjukkan bagaimana format listicle terbaca di situs ini — sebelum terbit, setiap judul, tanggal, dan klaim harus dicek ke sumber primer sesuai §5.5.
:::

## 1. Judul Contoh Pertama

Yang membuatnya bekerja adalah pengekangan. Premisnya bisa jadi melodrama besar, tapi naskahnya menolak setiap kesempatan untuk itu.

Paruh keduanya justru lebih tenang daripada paruh pertama, dan itu keputusan yang berani untuk drama yang dipasarkan sebagai thriller.

**Tonton kalau** Anda menyukai cerita yang percaya pada penontonnya.
**Lewati kalau** Anda ingin sesuatu yang bergerak cepat.

## 2. Judul Contoh Kedua

Enam belas episode tanpa satu pun subplot yang terbuang. Itu jarang.

> Kekuatannya bukan di kejutan, tapi di seberapa masuk akal setiap kejutan terasa setelah terjadi.

**Tonton kalau** Anda lelah dengan drama yang memanjangkan diri.
**Lewati kalau** Anda mencari romansa sebagai pusat cerita.

## 3. Judul Contoh Ketiga

Satu-satunya di daftar ini yang gagal di episode terakhir, dan tetap masuk karena lima belas episode sebelumnya cukup kuat untuk menahan itu.

**Tonton kalau** Anda tidak keberatan akhir yang tergesa.
**Lewati kalau** akhir yang buruk merusak keseluruhan bagi Anda.

## 4. Judul Contoh Keempat

Drama paling sepi di daftar ini dan yang paling saya pikirkan setelah selesai.

**Tonton kalau** Anda menonton sendirian, malam hari, tanpa ponsel.
**Lewati kalau** Anda menonton sambil mengerjakan hal lain.

## 5. Judul Contoh Kelima

Yang paling mudah direkomendasikan ke siapa pun. Tidak menuntut apa-apa, dan tidak menghina siapa pun.

**Tonton kalau** Anda baru mulai menonton drama Korea.
**Lewati kalau** Anda sudah menonton banyak dan mencari sesuatu yang tidak biasa.

## Yang hampir masuk

Tiga judul lain sampai ke daftar pendek dan gugur di kriteria ketiga — semuanya berakhir dengan menyiapkan musim kedua yang belum tentu ada.

## Cara daftar ini akan diperbarui

Ini artikel hidup: judul baru ditambahkan dan yang lama diturunkan di tempat, bukan lewat artikel baru. Tanggal pembaruan di atas selalu mencerminkan perubahan terakhir.`;
