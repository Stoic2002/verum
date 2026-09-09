# PRD — VERUM v1

**Status:** Draft untuk disetujui
**Tanggal:** 9 September 2026
**Pemilik:** Arul (solo)
**Versi:** 1.0

---

## 1. Ringkasan

VERUM adalah publikasi digital berbahasa Inggris (dengan versi Indonesia selektif) yang fokus pada AI dan teknologi, ditulis dari sudut pandang seorang developer yang benar-benar memakai tool yang dibahasnya.

Pembeda utama bukan kecepatan atau volume, melainkan **information gain**: setiap artikel harus memuat minimal satu hal yang tidak ada di hasil pencarian teratas — screenshot percobaan sendiri, angka benchmark, atau penilaian dari pengalaman pakai langsung.

Monetisasi awal lewat Google AdSense, dengan email list sebagai aset jangka panjang.

---

## 2. Konteks & batasan

Batasan ini bukan catatan kaki — ini yang membentuk seluruh keputusan di dokumen ini.

| Batasan                | Nilai                                              |
| ---------------------- | -------------------------------------------------- |
| Tim                    | 1 orang (Arul), dibantu AI untuk drafting          |
| Kapasitas              | 2–3 jam/hari, 7 hari/minggu (~17 jam/minggu)       |
| Budget awal            | Rp3.000.000 total                                  |
| Biaya operasional maks | Rp200.000/bulan sebelum ada pemasukan              |
| Horizon                | Jangka panjang, dipelihara terus                   |
| Pengalaman teknis      | Fullstack, Svelte, PostgreSQL, deploy Linux server |

**Implikasi:** setiap fitur yang dibangun adalah artikel yang tidak ditulis. Bagian "Non-Goals" (§9) sama pentingnya dengan bagian "Scope".

---

## 3. Sasaran & metrik

### Sasaran produk

1. Menerbitkan konten yang akurat dan berguna secara konsisten dalam jangka panjang.
2. Membangun traffic organik yang tumbuh dari Google Search dan mesin pencari AI.
3. Menghasilkan pendapatan lewat AdSense, dengan diversifikasi menyusul.

### Metrik & target bertahap

| Fase       | Waktu       | Artikel | Traffic organik/bulan | Milestone                               |
| ---------- | ----------- | ------- | --------------------- | --------------------------------------- |
| 0 — Build  | Minggu 1–7  | 0       | 0                     | Platform selesai, staging jalan         |
| 1 — Seed   | Minggu 8–13 | 30      | —                     | Launch, Search Console terpasang        |
| 2 — Index  | Bulan 4–6   | 80      | 3.000–8.000           | AdSense approved, newsletter mulai      |
| 3 — Growth | Bulan 7–12  | 180     | 20.000–50.000         | Locale `id` diaktifkan                  |
| 4 — Scale  | Bulan 13–24 | 350+    | 100.000+              | Kategori ke-3, diversifikasi monetisasi |

**Metrik utama yang dipantau mingguan:** sesi organik, halaman terindeks, artikel yang naik/turun peringkat, subscriber email, RPM.

**Metrik yang sengaja diabaikan:** jumlah artikel total, followers sosial media, pageview per artikel viral.

### Definisi gagal

Kalau setelah bulan 9 traffic organik masih di bawah 2.000/bulan **dan** tidak ada tren naik, strategi kontennya salah — bukan waktunya menambah artikel, tapi waktunya audit dan ubah arah.

---

## 4. Audiens & positioning

**Pembaca utama:** developer, technical professional, dan tech-curious berbahasa Inggris yang ingin memahami tool AI dan teknologi baru secara praktis — bukan sekadar tahu beritanya.

**Pembaca sekunder (fase 3):** pembaca Indonesia dengan minat yang sama.

**Positioning statement:**

> VERUM menjelaskan tool AI dan teknologi dari sudut pandang orang yang memakainya untuk kerja sungguhan — dengan bukti, bukan siaran pers yang ditulis ulang.

**Yang tidak dilakukan VERUM:**

- Tidak mengejar breaking news (kalah cepat dari media bermodal, traffic-nya mati dalam 48 jam).
- Tidak menyalin atau menerjemahkan liputan media lain.
- Tidak menulis headline clickbait yang tidak dijawab isinya.

---

## 5. Strategi konten

### 5.1 Kapasitas & irama

- **Target: 5 artikel/minggu.** Konsistensi jauh lebih penting daripada volume. 5/minggu selama 12 bulan mengalahkan 30/minggu selama 2 bulan.
- Publikasi terjadwal, tidak perlu online real-time.

### 5.2 Bauran konten

- **70% evergreen** — panduan, perbandingan, penjelasan, listicle bernilai. Traffic tumbuh pelan tapi bertahan bertahun-tahun.
- **30% berita bersudut** — bukan "X merilis Y", tapi "X merilis Y, ini artinya untuk developer". Nilainya di analisis, bukan di kecepatan.

### 5.3 Kategori

**Fase 1 (aktif saat launch):**

- `ai` — model, tool, workflow, prompt, agent
- `tech` — developer tooling, gadget, software, infrastruktur

**Fase 2+ (dibuka setelah fase 1 punya traffic terbukti, satu per satu):**

- `games`, `esports`, `reviews`

**Tertutup permanen di v1:** politik (dalam & luar negeri), bencana, kesehatan, keuangan personal.
Alasan: kategori YMYL diperiksa Google jauh lebih ketat, CPC-nya rendah, dan produksi berbantuan AI di topik ini punya risiko misinformasi yang tidak sebanding dengan imbalannya.

### 5.4 Format artikel yang diprioritaskan

1. **Perbandingan** — "X vs Y untuk [use case]"
2. **Panduan praktis** — "Cara [tugas] dengan [tool]"
3. **Explainer** — "Apa itu X dan kapan sebaiknya dipakai"
4. **Listicle terkurasi** — "7 tool untuk [tugas]" (harus punya kriteria seleksi eksplisit)
5. **Living article** — artikel yang diperbarui rutin, bukan diganti artikel baru (lihat §11.4)

### 5.5 Quality gate (wajib, tidak bisa dilewati)

Sebelum publish, setiap artikel harus lolos empat pertanyaan:

1. **Information gain** — apakah ada minimal satu hal di sini yang tidak ada di 5 hasil teratas Google? (screenshot sendiri, angka sendiri, penilaian dari pemakaian sendiri)
2. **Verifikasi fakta** — setiap klaim faktual, angka, tanggal, dan nama produk sudah dicek ke sumber primer?
3. **Judul jujur** — apakah isi artikel benar-benar menjawab judulnya?
4. **Bisa dipertanggungjawabkan** — kalau ada yang protes soal artikel ini, saya bisa menunjukkan dasarnya?

Artikel yang tidak lolos salah satu poin ini **tidak diterbitkan**, meskipun sudah selesai ditulis.

---

## 6. Kebijakan editorial & AI

### 6.1 Peran AI

AI digunakan untuk riset awal, drafting, dan penyuntingan bahasa. Porsi draf dari AI diperkirakan ~70%.

**Yang tidak boleh diserahkan ke AI:**

- Pemilihan topik dan sudut pandang
- Klaim faktual tanpa verifikasi manusia
- Penilaian, rekomendasi, dan opini
- Bagian "information gain" (§5.5 poin 1)

### 6.2 Byline & identitas

- Artikel ditulis dengan **pseudonim yang konsisten**.
- Halaman About memuat persona yang jujur: developer di Indonesia, pengalaman nyata, alasan menulis. Tidak mengarang kredensial, tidak mengaku sebagai tim redaksi kalau hanya satu orang.
- Konsistensi pseudonim penting untuk sinyal E-E-A-T; ganti-ganti nama penulis merugikan.

### 6.3 Disclosure AI

Halaman **Editorial Policy** wajib ada dan memuat:

- Bahwa AI digunakan dalam proses drafting
- Bahwa setiap artikel melalui review dan verifikasi manusia sebelum terbit
- Cara menghubungi redaksi untuk koreksi

### 6.4 Kebijakan koreksi

Kesalahan faktual diperbaiki langsung di artikel. Untuk kesalahan material, tambahkan catatan koreksi di bagian bawah artikel dengan tanggal. `dateModified` diperbarui.

---

## 7. Bahasa & lokalisasi

| Locale | Status                           | Keterangan                                                                  |
| ------ | -------------------------------- | --------------------------------------------------------------------------- |
| `en`   | Aktif sejak launch               | Bahasa utama, semua artikel                                                 |
| `id`   | Infrastruktur siap, aktif fase 3 | **Asimetris** — hanya artikel terpilih yang relevan untuk audiens Indonesia |

**Keputusan yang sudah diambil:**

- Bahasa Mandarin, Rusia, dan Spanyol **tidak** masuk roadmap v1. Mandarin praktis mustahil (Google diblokir di China, butuh ICP license). Rusia didominasi Yandex dengan CPC rendah. Spanyol layak dipertimbangkan ulang setelah bulan 12.
- **RTL tidak didukung.** Tidak ada rencana bahasa RTL; mendukungnya menggandakan kompleksitas setiap komponen tanpa manfaat.

**Aturan konten multibahasa:**

- Versi `id` adalah **penulisan ulang**, bukan terjemahan mesin. Penerjemahan massal berbantuan mesin adalah pola yang secara eksplisit ditarget kebijakan scaled content abuse Google.
- Artikel boleh hanya punya versi `en`. Tidak ada kewajiban paritas.

---

## 8. Ruang lingkup v1 — fungsional

### 8.1 Sisi publik

**Homepage**

- Artikel unggulan + daftar artikel terbaru
- Blok per kategori
- CTA newsletter

**Halaman kategori** — daftar artikel dengan paginasi, deskripsi kategori (teks asli, bukan boilerplate)

**Halaman tag** — daftar artikel, `noindex` jika artikel < 3 (menghindari thin pages)

**Halaman topik / dossier** — kurasi artikel seputar satu subjek (mis. "OpenAI") dengan pengantar orisinal. Ini halaman yang bisa ranking sendiri, bukan sekadar arsip.

**Halaman artikel**

- Judul, deskripsi, byline, tanggal terbit & diperbarui, estimasi waktu baca
- Table of contents otomatis dari heading (artikel > 1.200 kata)
- Isi markdown dengan dukungan embed (YouTube, X, code block, tabel, callout)
- Related articles otomatis (berdasarkan kategori + tag, fallback ke terbaru)
- Tombol share: X, LinkedIn, WhatsApp, Reddit, salin link
- CTA newsletter di akhir artikel
- Catatan koreksi bila ada

**Search** — Postgres full-text search dengan ranking, filter kategori

**Newsletter** — form signup (double opt-in), halaman konfirmasi, unsubscribe. Provider: Buttondown atau Listmonk self-hosted.

**Dark mode** — toggle, preferensi tersimpan di `localStorage`, default mengikuti `prefers-color-scheme`

**Halaman statis** — About, Contact, Privacy Policy, Terms of Service, Editorial Policy

**Feed & mesin** — RSS (ringkasan + link), `sitemap.xml`, `robots.txt`, `ads.txt`

### 8.2 Sisi admin

- **Login single-user** — session cookie + argon2 password hash. Tidak ada sistem role, tidak ada registrasi.
- **CRUD artikel** — editor markdown dengan live preview (MDsveX)
- **Manajemen locale artikel** — tambah/hapus versi bahasa per artikel
- **Scheduled publish** — status draft / scheduled / published / archived
- **Upload gambar** — otomatis resize ke 3 ukuran, konversi AVIF + WebP, upload ke object storage
- **Manajemen kategori & tag**
- **Manajemen redirect** — tabel slug lama → baru, 301
- **Preview link** — URL bertoken untuk melihat draft
- **Dashboard** — daftar artikel, status, pageview per artikel

---

## 9. Non-Goals v1

Ini bukan "tidak pernah", ini "tidak sebelum ada 100 artikel dan traffic organik terbukti".

| Tidak dibuat                   | Alasan                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Akun/registrasi pembaca        | Menghilangkan auth, reset password, verifikasi email, GDPR data export, dan seluruh permukaan serangan. Penghematan waktu terbesar di daftar ini. |
| Kolom komentar                 | Moderasi adalah pekerjaan harian; komentar tak termoderasi adalah risiko policy strike AdSense                                                    |
| Push notification              | Konversi rendah, permission prompt merusak UX                                                                                                     |
| PWA / installable              | Tidak ada nilai untuk situs baca-sekali                                                                                                           |
| Multi-user & role              | Hanya satu orang                                                                                                                                  |
| Revision history               | Nilai rendah untuk solo, kompleksitas tinggi                                                                                                      |
| Video, podcast, galeri         | Kapasitas produksi tidak ada                                                                                                                      |
| Paywall / membership           | Butuh audiens dulu                                                                                                                                |
| Panel direct advertiser        | Butuh traffic dulu                                                                                                                                |
| A/B testing headline           | Butuh volume traffic untuk signifikansi                                                                                                           |
| AMP                            | Sudah tidak relevan sejak 2021                                                                                                                    |
| Google News / Publisher Center | Prioritaskan Google Search dulu; pertimbangkan di fase 3                                                                                          |
| Auto-post ke sosial media      | Manual dulu, otomasi setelah pola terbentuk                                                                                                       |
| Locale ke-3 & ke-4             | Lihat §7                                                                                                                                          |
| Dukungan RTL                   | Lihat §7                                                                                                                                          |
| Review dengan skor numerik     | Butuh metodologi konsisten yang belum ada                                                                                                         |
| Mobile app                     | Web sudah cukup                                                                                                                                   |

---

## 10. Arsitektur teknis

### 10.1 Stack

| Lapisan        | Pilihan                               | Catatan                                             |
| -------------- | ------------------------------------- | --------------------------------------------------- |
| Framework      | SvelteKit + `adapter-node`, SSR wajib | Bukan SPA — SSR mutlak untuk SEO                    |
| Bahasa         | TypeScript                            |                                                     |
| i18n           | Paraglide JS (`npx sv add paraglide`) | Library i18n resmi SvelteKit, compiler-based        |
| Database       | PostgreSQL 16 self-hosted di VPS      |                                                     |
| ORM            | Drizzle                               |                                                     |
| Hosting        | VPS 2GB RAM, ~Rp150.000/bulan         |                                                     |
| Reverse proxy  | Caddy (TLS otomatis)                  |                                                     |
| CDN            | Cloudflare (free tier)                |                                                     |
| Object storage | Cloudflare R2                         | Egress gratis — krusial untuk situs bergambar       |
| Editor konten  | MDsveX                                |                                                     |
| Newsletter     | Buttondown / Listmonk                 |                                                     |
| Error tracking | Sentry (free tier)                    |                                                     |
| Uptime         | UptimeRobot / BetterStack             |                                                     |
| Analytics      | Plausible self-hosted, atau GA4       | Plausible lebih ringan & tidak butuh consent banner |
| CI/CD          | GitHub Actions                        |                                                     |
| Testing        | Playwright, 5 alur kritis             |                                                     |

### 10.2 Catatan hosting

**Vercel Hobby tidak bisa dipakai.** Kebijakan fair-use Vercel membatasi Hobby untuk penggunaan pribadi non-komersial, dan pemasangan iklan termasuk Google AdSense secara eksplisit dihitung sebagai penggunaan komersial. Vercel menegakkan ini dan akun bisa di-pause. Vercel Pro $20/bulan akan menghabiskan seluruh budget Rp3 juta dalam 9 bulan.

VPS + Cloudflare masuk di bawah batas Rp200.000/bulan dengan margin, dan memanfaatkan pengalaman deploy Linux yang sudah ada.

### 10.3 Strategi rendering & cache

| Halaman             | Strategi                                           |
| ------------------- | -------------------------------------------------- |
| Artikel terbit      | Cache CDN, TTL panjang (24 jam), purge saat update |
| Homepage & kategori | SSR, cache pendek (60 detik)                       |
| Search              | SSR, tanpa cache                                   |
| Admin               | SSR, `no-store`                                    |
| Gambar              | Immutable, TTL 1 tahun, nama file ber-hash         |

Purge cache Cloudflare dipicu lewat API saat artikel dipublish atau diperbarui.

### 10.4 Jebakan yang harus dihindari

**Locale di module-scope store.** Di server, modul dievaluasi sekali per proses. Request A set `id`, yield di `await`, request B set `en`, request A lanjut merender bahasa yang salah. Tidak akan pernah muncul di dev karena hanya satu request. Simpan locale di `event.locals`, dan gunakan mekanisme AsyncLocalStorage bawaan Paraglide.

**Auto-redirect berdasarkan IP.** Googlebot crawl dari US. Kalau pengunjung US dipaksa ke `/en/`, versi `/id/` tidak akan pernah terindeks. Hormati URL yang diminta; tampilkan banner saran ganti bahasa, bukan redirect.

**CLS dari iklan.** Slot AdSense adalah penyebab layout shift nomor satu. Reserve tinggi setiap slot dengan CSS `min-height` sebelum iklan dimuat.

---

## 11. Model data

```sql
-- Artikel (entitas, bahasa-agnostik)
CREATE TABLE articles (
  id            BIGSERIAL PRIMARY KEY,
  category_id   BIGINT NOT NULL REFERENCES categories(id),
  status        TEXT NOT NULL DEFAULT 'draft',   -- draft|scheduled|published|archived
  is_living     BOOLEAN NOT NULL DEFAULT FALSE,  -- artikel yang diperbarui rutin
  cover_image   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Konten per bahasa (asimetris: tidak semua artikel punya semua locale)
CREATE TABLE article_locales (
  article_id     BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  locale         TEXT   NOT NULL,                -- 'en' | 'id'
  slug           TEXT   NOT NULL,
  title          TEXT   NOT NULL,
  excerpt        TEXT   NOT NULL,
  body_md        TEXT   NOT NULL,
  meta_title     TEXT,
  meta_desc      TEXT,
  published_at   TIMESTAMPTZ,
  modified_at    TIMESTAMPTZ,
  correction     TEXT,                           -- catatan koreksi, nullable
  search_vector  TSVECTOR,
  PRIMARY KEY (article_id, locale),
  UNIQUE (locale, slug)
);

CREATE TABLE categories (
  id         BIGSERIAL PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE category_locales (
  category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  locale      TEXT   NOT NULL,
  name        TEXT   NOT NULL,
  description TEXT,                              -- teks asli, bukan boilerplate
  PRIMARY KEY (category_id, locale)
);

CREATE TABLE tags (
  id   BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE article_tags (
  article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id     BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

-- Halaman topik / dossier
CREATE TABLE topics (
  id   BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE topic_locales (
  topic_id BIGINT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  locale   TEXT   NOT NULL,
  title    TEXT   NOT NULL,
  intro_md TEXT   NOT NULL,                      -- pengantar orisinal
  PRIMARY KEY (topic_id, locale)
);

CREATE TABLE topic_articles (
  topic_id   BIGINT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  PRIMARY KEY (topic_id, article_id)
);

-- Redirect (slug lama → baru)
CREATE TABLE redirects (
  id         BIGSERIAL PRIMARY KEY,
  from_path  TEXT NOT NULL UNIQUE,
  to_path    TEXT NOT NULL,
  status     INT  NOT NULL DEFAULT 301,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL                    -- argon2id
);
```

**Catatan desain:** kolom `title_en` / `title_id` dalam satu tabel adalah kesalahan yang mahal saat menambah bahasa ketiga. Pemisahan `articles` / `article_locales` adalah yang memungkinkan model asimetris di §7.

---

## 12. SEO & i18n

### 12.1 Struktur URL

```
/en/                          homepage
/en/ai/                       kategori
/en/ai/artikel-slug           artikel
/en/topic/openai              halaman topik
/en/tag/llm                   tag
/id/ai/slug-artikel-indonesia versi Indonesia
```

**Aturan:**

- Subdirectory, bukan subdomain atau ccTLD — mewarisi domain authority ke semua locale
- Tanpa tanggal di URL — membuat artikel terlihat basi dan menyulitkan strategi living article
- Slug boleh diubah, tapi wajib mencatat 301 di tabel `redirects`

### 12.2 Checklist meta per halaman

- `<title>` unik, ≤ 60 karakter
- `<meta name="description">` unik, ≤ 155 karakter
- `<link rel="canonical">` menunjuk ke URL locale itu sendiri (bukan ke versi `en`)
- `hreflang` untuk setiap locale yang benar-benar ada + `x-default` → `en`
- Open Graph + Twitter Card
- `<html lang>` sesuai locale

### 12.3 Structured data

- `Article` di halaman artikel — `headline`, `datePublished`, `dateModified`, `author`, `image`, `publisher`
- `BreadcrumbList` di artikel & kategori
- `Organization` + `WebSite` (dengan `SearchAction`) di homepage
- `FAQPage` hanya bila artikel benar-benar berformat tanya-jawab

### 12.4 Living article

Artikel dengan `is_living = true` diperbarui berkala, bukan diganti artikel baru. `dateModified` naik, backlink terakumulasi di satu URL, dan Google memperlakukannya sebagai konten yang terpelihara. Contoh: "Best AI coding tools", diperbarui bulanan.

### 12.5 Core Web Vitals — target

| Metrik | Target      |
| ------ | ----------- |
| LCP    | < 2,5 detik |
| INP    | < 200 ms    |
| CLS    | < 0,1       |

### 12.6 Kebijakan crawler

- `robots.txt` **mengizinkan** crawler retrieval (GPTBot, PerplexityBot, ClaudeBot, Google-Extended). Referral dari mesin pencari AI sekarang sumber traffic nyata dan tumbuh; Search Console bahkan sudah punya laporan performa AI terpisah sejak Juni 2026.
- Crawler khusus pengumpulan data training (mis. CCBot) boleh diblokir bila diinginkan.
- Blokir menyeluruh terhadap crawler AI **tidak disarankan** — itu memotong kanal distribusi yang sedang tumbuh.

### 12.7 Sitemap

- `sitemap.xml` index → sitemap per locale
- Anotasi `xhtml:link` untuk alternate locale
- Regenerasi otomatis saat publish
- Tag dengan < 3 artikel di-`noindex` dan dikeluarkan dari sitemap

---

## 13. Monetisasi

### 13.1 AdSense

**Timing:** daftar setelah 30 artikel terbit **dan** traffic organik pertama muncul. Bukan hari pertama.

**Prasyarat approval:** HTTPS, halaman About dengan penulis yang bisa diidentifikasi, Privacy Policy, Contact, navigasi jelas, mobile-friendly, konten orisinal. Situs berita diperiksa lebih ketat karena tingginya kasus konten salinan dan otomasi volume tinggi di niche ini. Review 1–14 hari.

**Penempatan slot:** maksimal 3 slot per halaman artikel — setelah paragraf pembuka, di tengah konten, dan di akhir. Setiap slot **wajib** punya `min-height` yang di-reserve untuk mencegah CLS.

**Aturan mutlak:** jangan pernah klik iklan sendiri, jangan beli traffic, jangan minta orang lain klik. Invalid traffic berujung ban permanen tanpa banding yang berarti.

**Ekspektasi realistis:** RPM traffic Indonesia berkisar Rp5.000–20.000 per 1.000 pageview; traffic US/Eropa beberapa kali lipat lebih tinggi. Ini alasan utama konten `en` diprioritaskan. Payout threshold $100, transfer sekitar tanggal 21.

### 13.2 `ads.txt`

File di root domain yang menyatakan siapa yang berhak menjual inventory iklan. Isinya diberikan AdSense. Anti-fraud, wajib.

### 13.3 Diversifikasi (fase 3+)

- **Email list** — aset paling berharga; satu-satunya kanal yang tidak bisa diambil Google
- **Affiliate** — dengan disclosure eksplisit dan `rel="sponsored"` di setiap link
- **Sponsored post** — ditandai jelas, `rel="sponsored"`

---

## 14. Legal & compliance

| Item                 | Keputusan                                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Badan hukum          | Perorangan. AdSense payout ke rekening pribadi; penghasilan dilaporkan sebagai penghasilan dari luar negeri.                                 |
| Posisi               | Blog/publikasi teknologi, **bukan** media pers. Tidak tunduk UU Pers/verifikasi Dewan Pers. Halaman About harus konsisten dengan posisi ini. |
| CMP (consent)        | **Google Funding Choices / Privacy & Messaging** — bawaan dashboard AdSense, gratis, tersertifikasi. Wajib sebelum ada traffic Eropa.        |
| Privacy Policy       | GDPR-grade: data apa yang dikumpulkan, dasar hukum, cara request penghapusan, daftar pihak ketiga (Google, Cloudflare, provider newsletter)  |
| Terms of Service     | Ada                                                                                                                                          |
| Editorial Policy     | Ada, termasuk disclosure penggunaan AI                                                                                                       |
| Sumber gambar        | Hanya stock berlisensi jelas (Unsplash, Pexels) atau buatan sendiri. Tidak mengambil gambar dari artikel media lain.                         |
| Takedown / hak jawab | Alamat kontak di halaman Contact, respons dalam 7 hari kerja                                                                                 |

**Catatan penting soal CMP:** sejak 16 Januari 2024, publisher AdSense wajib memakai CMP tersertifikasi Google yang terintegrasi TCF untuk melayani iklan personal ke pengguna EEA dan UK; Swiss menyusul 31 Juli 2024. Tanpa itu, traffic Eropa hanya mendapat iklan non-personal atau limited — pendapatan turun drastis.

**Implikasi teknis:** script iklan dan analytics tidak boleh dimuat sebelum consent. Jangan hardcode di `app.html`; muat kondisional setelah callback CMP.

Ini bukan nasihat hukum. Untuk keputusan struktur badan usaha dan pajak, konsultasikan dengan konsultan pajak.

---

## 15. Operasional

| Aspek      | Ketentuan                                                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backup     | Dump PostgreSQL harian otomatis ke R2, retensi 30 hari. **Tes restore dilakukan sekali sebelum launch dan setiap kuartal** — backup yang belum pernah direstore bukan backup. |
| Deploy     | Push ke `main` → GitHub Actions → build → deploy ke VPS. Staging environment terpisah.                                                                                        |
| Monitoring | Sentry untuk error, UptimeRobot untuk uptime, alert ke email/Telegram                                                                                                         |
| Keamanan   | Rate limiting di endpoint login & search, security header (CSP, HSTS), dependensi diupdate bulanan                                                                            |
| Testing    | Playwright, 5 alur: publish artikel · buka artikel · ganti locale · sitemap ter-generate · search                                                                             |

---

## 16. Roadmap

**Fase 0 — Build (minggu 1–7)**

| Minggu | Fokus                                                                  |
| ------ | ---------------------------------------------------------------------- |
| 1      | Setup proyek, schema DB, Drizzle, Paraglide, deploy pipeline           |
| 2      | Admin: auth, CRUD artikel, editor markdown                             |
| 3      | Admin: upload gambar + resize, kategori/tag, scheduling                |
| 4      | Publik: layout, homepage, kategori, halaman artikel                    |
| 5      | Publik: search, topik, tag, dark mode, TOC, related                    |
| 6      | SEO: sitemap, hreflang, structured data, RSS, redirect, halaman statis |
| 7      | Performance, Playwright, staging → produksi, beli domain               |

**Fase 1 — Seed (minggu 8–13)**
Fokus penuh menulis. 30 artikel. Search Console + Analytics terpasang. Tidak ada pengembangan fitur.

**Fase 2 — Index (bulan 4–6)**
Terus menulis 5/minggu. Daftar AdSense. Aktifkan newsletter. Audit artikel pertama.

**Fase 3 — Growth (bulan 7–12)**
Aktifkan locale `id`. Evaluasi pembukaan kategori ketiga. Mulai diversifikasi monetisasi.

---

## 17. Risiko & mitigasi

| Risiko                                 | Dampak                                       | Mitigasi                                                                                                    |
| -------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Penalti scaled content abuse           | Fatal — traffic hilang, pemulihan 3–12 bulan | Quality gate §5.5 ditegakkan tanpa pengecualian; batasi 5 artikel/minggu; tidak ada terjemahan mesin massal |
| AdSense ditolak atau di-ban            | Pendapatan nol                               | Halaman wajib lengkap sebelum daftar; nol invalid traffic; bangun email list sebagai cadangan               |
| Core update menghapus traffic          | Berat                                        | Diversifikasi kanal: organik + AI search + newsletter + sosial                                              |
| Burnout / berhenti menulis             | Paling mungkin terjadi                       | Target sengaja dipasang rendah (5/minggu, bukan 20); 70% evergreen agar tidak terikat jadwal berita         |
| Scope creep                            | Launch tidak pernah terjadi                  | Daftar Non-Goals §9 bersifat mengikat; perubahan butuh alasan tertulis                                      |
| Biaya membengkak                       | Budget habis                                 | Cloudflare CDN + R2 (egress gratis); alarm biaya bulanan di Rp200.000                                       |
| Konten AI mengandung kesalahan faktual | Kredibilitas hancur                          | Verifikasi manual wajib (§5.5 poin 2); tidak menulis topik YMYL                                             |

---

## 18. Keputusan yang masih terbuka

1. **Nama domain final** — `verum.com` terpakai. Kandidat: `verumtech.com`, `verum.tech`, `readverum.com`, `verum.dev`. Perlu cek ketersediaan domain, handle sosial, dan konflik merek dagang sekaligus.
2. **Provider VPS** — kandidat: Hetzner (murah, Eropa/US), Contabo, atau lokal (Biznet/Idcloudhost) bila prioritas latensi Indonesia. Karena audiens utama `en`, Hetzner + Cloudflare kemungkinan pilihan terbaik.
3. **Analytics** — Plausible self-hosted (ringan, tanpa consent banner) vs GA4 (gratis, integrasi Search Console lebih baik).
4. **Provider newsletter** — Buttondown (~$9/bulan) vs Listmonk self-hosted (gratis, satu VPS yang sama).

---

## Lampiran — Definition of Done untuk launch

- [ ] Semua fitur §8 berfungsi di produksi
- [ ] 30 artikel terbit, semua lolos quality gate §5.5
- [ ] Semua halaman statis §14 lengkap dan terisi
- [ ] Core Web Vitals memenuhi target §12.5 di mobile
- [ ] Sitemap ter-generate dan disubmit ke Search Console
- [ ] CMP terpasang dan diuji dengan VPN Eropa
- [ ] Backup berjalan otomatis dan **restore sudah diuji sekali**
- [ ] Sentry dan uptime monitoring aktif
- [ ] Lima alur Playwright hijau
- [ ] Domain terpasang dengan TLS dan Cloudflare aktif
