# VERUM — Rencana Development (turunan dari PRD v1)

**Basis:** `PRD-VERUM-v1.md`
**Toolchain:** Bun (package manager + script runner), Vite (via SvelteKit), TypeScript
**Tanggal:** 9 September 2026

---

## Bagian A — Hasil analisis PRD

### A.1 Yang sudah solid dan tidak perlu diganggu

- **Pemisahan `articles` / `article_locales`.** Ini keputusan paling benar di dokumen. Model asimetris (§7) hanya mungkin karena ini.
- **Non-Goals (§9).** Ini yang membuat 7 minggu realistis. Tanpa akun pembaca + komentar, permukaan kerja turun drastis.
- **SSR wajib, bukan SPA.** Benar untuk SEO.
- **Locale di `event.locals`, bukan module-scope store (§10.4).** Bug ini nyata dan tidak akan pernah muncul di dev. Dokumen sudah mengantisipasinya.
- **Tidak pakai Vercel Hobby (§10.2).** Analisis kebijakannya benar.
- **VPS + Cloudflare + R2.** Egress gratis R2 memang faktor penentu untuk situs bergambar.

### A.2 Koreksi yang harus diambil SEBELUM coding

| #   | Isu di PRD                                                           | Kenapa bermasalah                                                                                                                                                                                                                                                                   | Keputusan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **MDsveX sebagai editor konten** (§10.1, §8.2)                       | MDsveX adalah _preprocessor compile-time_ untuk file `.svx` di dalam repo. Body artikel disimpan di kolom `body_md` di Postgres dan dirender saat runtime — MDsveX tidak bisa melakukan ini. Ini bukan detail kecil; ini seluruh content pipeline.                                  | Ganti ke pipeline **unified/remark/rehype** runtime: `remark-parse` → `remark-gfm` → `remark-rehype` (allowDangerousHtml) → `rehype-raw` → **`rehype-sanitize` (wajib)** → `rehype-shiki` (code block) → `rehype-slug` + heading extraction (TOC) → `rehype-stringify`. Render **saat simpan**, simpan hasil HTML di kolom `body_html`, bukan render tiap request.                                                                                                                                                                                                                                                        |
| 2   | **Skema kurang 4 tabel** (§11)                                       | `sessions` (login butuh session cookie), `media` (upload gambar butuh registry + varian), `newsletter_subscribers` (kalau Listmonk self-hosted, atau minimal buffer double opt-in), `article_stats` (dashboard §8.2 minta pageview per artikel tapi tidak ada tempat menyimpannya). | Tambahkan di Fase 1. Detail di §B.2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 3   | **`search_vector` tanpa mekanisme pengisian** (§11)                  | Kolom `TSVECTOR` tidak terisi sendiri.                                                                                                                                                                                                                                              | **Trigger `BEFORE INSERT/UPDATE`** yang memilih text search config dari `locale` baris itu. Generated column tidak bisa dipakai: ekspresinya wajib `IMMUTABLE`, sementara memilih config dari kolom lain tidak immutable. ~~Postgres tidak punya dictionary Indonesia~~ — **klaim ini salah**. PostgreSQL 16 punya config `indonesian` (Snowball), terverifikasi bekerja: perbandingan→banding, menggunakan→guna. Dipakai `english` untuk `en`, `indonesian` untuk `id`. Config `indonesian` tidak punya stopword list, jadi kata umum ikut terindeks — hanya membuat index sedikit lebih besar, ranking tetap menangani. |
| 4   | **Cloudflare "cache artikel TTL 24 jam"** (§10.3)                    | Cloudflare free **tidak meng-cache HTML secara default**. Tanpa Cache Rule eksplisit, seluruh strategi cache di §10.3 tidak berjalan dan `purge` tidak ada gunanya.                                                                                                                 | Buat **Cache Rule** di Cloudflare: cache HTML untuk path artikel, `Edge TTL` ikut header origin, `Browser TTL` pendek. Origin kirim `Cache-Control: public, s-maxage=86400, stale-while-revalidate`. Admin **wajib** `no-store` + bypass rule.                                                                                                                                                                                                                                                                                                                                                                            |
| 5   | **Scheduled publish diasumsikan butuh job runner** (§8.2)            | Menambah worker + cron = kompleksitas.                                                                                                                                                                                                                                              | Tidak perlu untuk _korektness_: semua query publik filter `status='published' AND published_at <= now()`. Artikel terjadwal muncul sendiri. Cron ringan (systemd timer) hanya dibutuhkan untuk **purge cache + regen sitemap** saat waktu terbit lewat.                                                                                                                                                                                                                                                                                                                                                                   |
| 6   | **Preview link "URL bertoken"** (§8.2)                               | Kalau token disimpan di DB, butuh tabel + expiry + cleanup.                                                                                                                                                                                                                         | Pakai **HMAC signed token** (`articleId.locale.exp.signature`) dengan secret dari env. Nol tabel, nol maintenance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 7   | **CMP: script iklan tidak boleh dimuat sebelum consent** (§14)       | Ini bukan tugas fase akhir. Kalau CSP dan urutan script disusun di akhir, akan ada rework.                                                                                                                                                                                          | Tetapkan **kontrak loading script** (nonce CSP + loader kondisional pasca-callback CMP) sejak Fase 5 saat layout publik dibuat.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 8   | **Estimasi "Minggu 5: search, topik, tag, dark mode, TOC, related"** | Ini padat sekali untuk 17 jam. Search Postgres FTS + ranking + filter kategori saja bisa habis 6–8 jam kalau baru pertama kali.                                                                                                                                                     | Fase dipecah ulang (§B.3). Search dipindah keluar dari minggu yang sama dengan topik+tag+TOC+related.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### A.3 Catatan spesifik Bun + Vite

Stack PRD **kompatibel** — SvelteKit memang berjalan di atas Vite. Yang perlu diperhatikan:

- **Bun untuk install, script, dan dev.** `bun install`, `bun run dev`, `bunx sv add paraglide`. Cepat dan tidak ada masalah.
- **Runtime produksi: pakai Node, bukan Bun.** `adapter-node` menghasilkan bundle yang ditargetkan untuk Node. Dua dependensi kritis adalah native module — `sharp` (resize gambar) dan `@node-rs/argon2` (password hash). Keduanya jalan di Node tanpa drama. Menjalankannya di Bun _mungkin_ bisa, tapi men-debug NAPI di server produksi jam 2 pagi bukan cara yang baik menghabiskan jatah 17 jam/minggu. **Bun sebagai toolchain, Node sebagai runtime.** Evaluasi ulang setelah launch kalau memang ada alasan.
- **Konsekuensi:** CI harus `bun install --frozen-lockfile` lalu `bun run build`, tapi Dockerfile/systemd menjalankan `node build/index.js`. Versi Node dipin (20 LTS atau 22 LTS).
- **`bun.lock` di-commit.** Jangan campur dengan `package-lock.json`.
- **Drizzle Kit** jalan lewat `bunx drizzle-kit`. Driver: `postgres` (postgres.js) — ringan dan bekerja baik di Node.
- **Vitest** untuk unit test (integrasi Vite-nya mulus). **Playwright** untuk 5 alur E2E sesuai §15.

### A.4 Keputusan yang harus diambil sebelum fase tertentu dimulai

| Keputusan    | Blokir fase | Rekomendasi                                                                                                                                                                                                            |
| ------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider VPS | Fase 7      | **Hetzner CX22** (~€3.79/bln ≈ Rp65rb). Audiens utama `en`, jadi latensi Indonesia bukan prioritas. Sisa budget lega.                                                                                                  |
| Analytics    | Fase 6      | **GA4** + tabel `article_stats` first-party. Rekomendasi Plausible self-hosted saya sebelumnya dicabut — lihat §A.5.                                                                                                   |
| Newsletter   | Fase 6      | **Buttondown** dulu (~$9/bln, tapi baru dibayar saat fase 2 — masih di bawah Rp200rb/bln). Listmonk menambah satu service + SMTP deliverability yang harus diurus sendiri; itu pekerjaan ops, bukan pekerjaan menulis. |
| Nama domain  | Fase 7      | Perlu dicek ketersediaan domain + handle sosial + merek dagang sekaligus. Jangan beli sebelum ketiganya bersih.                                                                                                        |

> Keputusan-keputusan ini **tidak memblokir Fase 0–5.** Mulai coding sekarang; putuskan yang di atas saat fasenya tiba.

### A.5 Koreksi: Plausible self-hosted dicabut

Rekomendasi awal saya salah pada dua hal sekaligus.

**Kapasitas.** Dokumentasi Plausible Community Edition menyebut **minimal 2 GB RAM untuk menjalankan ClickHouse dan Plausible saja**, tanpa OOM. VPS di PRD §10.1 adalah 2 GB _total_ — yang juga harus menampung PostgreSQL 16, proses Node, dan Caddy. Tidak muat, dan naik ke VPS 4 GB menekan batas Rp200.000/bulan.

**Keunggulannya tidak berlaku di sini.** Alasan utama memilih Plausible di PRD adalah "tidak butuh consent banner". Tapi §14 sudah mewajibkan CMP tersertifikasi Google untuk AdSense sebelum ada traffic Eropa. Consent banner **tetap ada** apa pun analytics-nya, jadi keunggulan itu hilang seluruhnya.

**Keputusan:** GA4 (gratis, nol beban RAM, integrasi Search Console lebih baik) untuk analytics pembaca, ditambah tabel `article_stats` first-party untuk dashboard admin. Tabel itu membuat dashboard tidak bergantung pada API, kredensial, atau vendor mana pun — dan karena isinya hitungan agregat tanpa identifier, ia bukan sesuatu yang perlu digerbangi consent.

---

## Bagian B — Fase development

Total 8 fase untuk mencapai launch. Kapasitas ~17 jam/minggu. Setiap fase punya **exit criteria** — fase tidak dianggap selesai sebelum semuanya hijau. Tidak ada fase yang boleh dimulai sambil menyisakan exit criteria fase sebelumnya.

### Fase 0 — Fondasi (± 8 jam)

Tujuan: repo yang bisa dijalankan siapa pun dengan satu perintah.

- `bunx sv create` — SvelteKit, TypeScript, `adapter-node`
- `bunx sv add paraglide` — locale `en` (default) + `id`, strategi URL prefix
- `docker-compose.yml`: PostgreSQL 16 untuk dev lokal
- Drizzle + `drizzle-kit` terkonfigurasi, koneksi via `postgres.js`
- ESLint + Prettier + `svelte-check`
- Struktur folder ditetapkan: `src/lib/server/{db,content,media,auth}`, `src/routes/(public)`, `src/routes/(admin)`
- `.env.example` lengkap dengan seluruh variabel yang akan dipakai sampai Fase 8
- GitHub Actions: install → lint → typecheck → build (belum deploy)

**Exit criteria:** `bun install && bun run dev` jalan dari clone bersih. CI hijau. `event.locals.locale` terisi dari URL dan terbukti benar di dua tab locale berbeda.

---

### Fase 1 — Lapisan data (± 10 jam)

Tujuan: skema final. Perubahan skema setelah fase ini harus punya alasan tertulis.

- Seluruh tabel §11 PRD dalam Drizzle schema
- **Tambahan wajib (koreksi A.2 #2):**
  - `sessions` (id, admin_user_id, expires_at, user_agent)
  - `media` (id, r2_key, original_name, width, height, variants JSONB, created_at)
  - `newsletter_subscribers` (email, locale, status, confirm_token, confirmed_at) — dipakai untuk double opt-in buffer meski provider eksternal
  - `article_stats` (article_id, locale, views, period) — hanya kalau memilih GA4 di §A.4
- `body_html` ditambahkan ke `article_locales` (koreksi A.2 #1)
- Trigger `search_vector` per-locale (koreksi A.2 #3), index GIN
- Index: `(locale, slug)`, `(status, published_at DESC)`, `article_tags` kedua arah
- Migration pertama + seed script (2 kategori, 1 admin user, 3 artikel dummy multi-locale)
- Query layer di `src/lib/server/db/queries/` — bukan query mentah tersebar di route

**Exit criteria:** migrate + seed dari database kosong berhasil. Search FTS mengembalikan hasil berperingkat untuk `en` dan `id` lewat script uji. Test restore dari `pg_dump` berhasil sekali (ini juga mencicil checklist launch).

---

### Fase 2 — Auth & kerangka admin (± 8 jam)

- Login single-user: argon2id (`@node-rs/argon2`), session cookie `HttpOnly`/`Secure`/`SameSite=Lax`
- Rate limiting endpoint login (§15)
- Route guard `(admin)` + layout admin + navigasi
- Dashboard kosong (diisi di Fase 6)
- Logout, rotasi session, expiry

**Exit criteria:** admin tidak bisa diakses tanpa login. Rate limit terbukti memblokir brute force di uji manual. Header admin `Cache-Control: no-store`.

---

### Fase 3 — Mesin konten (± 16 jam — fase terberat)

Ini inti produk. Jangan dikompres.

- **Pipeline markdown runtime** (koreksi A.2 #1) — remark/rehype, sanitize, Shiki, slug heading, ekstraksi TOC
- Embed: YouTube, X, code block, tabel, callout — sebagai directive/custom node yang tersanitasi
- CRUD artikel + editor markdown dengan **live preview** (debounce, render server-side lewat endpoint agar preview = hasil akhir)
- Manajemen locale per artikel: tambah/hapus versi bahasa
- Status: draft / scheduled / published / archived (koreksi A.2 #5 — query-driven)
- Manajemen kategori (+ `category_locales`) & tag
- Manajemen redirect
- Preview link bertoken HMAC (koreksi A.2 #6)

**Exit criteria:** satu artikel bisa ditulis, punya versi `en` + `id`, dijadwalkan, dan muncul otomatis saat waktunya lewat. Preview link menampilkan draft, dan link kedaluwarsa ditolak. Input `<script>` di markdown tidak lolos ke output.

---

### Fase 4 — Media (± 8 jam)

- Upload gambar → `sharp` → 3 ukuran × (AVIF + WebP) + fallback
- Nama file ber-hash (§10.3), upload ke R2, registry ke tabel `media`
- Picker gambar di editor, cover image artikel
- `srcset`/`sizes` + `width`/`height` wajib di komponen gambar — ini pencegah CLS terbesar kedua setelah slot iklan

**Exit criteria:** upload 1 gambar menghasilkan 6 objek di R2 + 1 baris `media`. Artikel dengan cover image mendapat skor CLS 0 di Lighthouse lokal.

---

### Fase 5 — Permukaan publik (± 16 jam)

- Layout publik, header/footer, navigasi, dark mode (`localStorage` + `prefers-color-scheme`, **tanpa flash** — inline script di `app.html`)
- Homepage: unggulan + terbaru + blok kategori + CTA newsletter
- Halaman kategori (paginasi, deskripsi asli)
- Halaman artikel: byline, tanggal terbit/diperbarui, waktu baca, TOC (>1.200 kata), related (kategori+tag, fallback terbaru), share buttons, catatan koreksi
- Halaman tag (`noindex` bila < 3 artikel)
- Halaman topik/dossier
- **Slot iklan sebagai komponen dengan `min-height` ter-reserve sejak sekarang** (§13.1) — kosong dulu, tapi ruangnya sudah ada
- **Kontrak loading script CMP-aware** ditetapkan di sini (koreksi A.2 #7)
- Banner saran ganti bahasa — **bukan redirect** (§10.4)

**Exit criteria:** semua halaman render tanpa JS aktif (uji dengan JS dimatikan). Ganti locale mempertahankan halaman yang sama bila versinya ada. Tidak ada flash saat dark mode. CLS = 0 dengan placeholder iklan aktif.

---

### Fase 6 — Search, newsletter, dashboard (± 10 jam)

- Search: Postgres FTS, ranking (`ts_rank_cd`), highlight, filter kategori, paginasi, SSR tanpa cache
- Rate limiting endpoint search (§15)
- Newsletter: form, double opt-in, halaman konfirmasi, unsubscribe, integrasi provider terpilih
- Dashboard admin: daftar artikel + status + pageview (sumber sesuai keputusan §A.4)

**Exit criteria:** search mengembalikan hasil relevan untuk 10 query uji. Alur double opt-in selesai end-to-end dengan email nyata.

---

### Fase 7 — SEO & mesin (± 12 jam)

- Meta per halaman: title ≤60, description ≤155, canonical **ke locale itu sendiri**, `hreflang` + `x-default`, OG/Twitter, `<html lang>`
- Structured data: `Article`, `BreadcrumbList`, `Organization` + `WebSite`+`SearchAction`, `FAQPage` kondisional
- `sitemap.xml` index → per-locale, anotasi `xhtml:link`, regen saat publish, tag <3 artikel dikeluarkan
- RSS, `robots.txt` (izinkan GPTBot/PerplexityBot/ClaudeBot/Google-Extended per §12.6), `ads.txt`
- Middleware redirect 301 dari tabel `redirects`
- Halaman statis: About, Contact, Privacy Policy, Terms, Editorial Policy
- Beli domain, pasang Cloudflare, **Cache Rules** (koreksi A.2 #4), purge API saat publish/update

**Exit criteria:** Rich Results Test lolos untuk artikel dan kategori. `hreflang` divalidasi dua arah. Slug diubah → URL lama 301 ke baru. Purge cache terpicu otomatis dan terverifikasi lewat header `cf-cache-status`.

---

### Fase 8 — Performa, ops, launch gate (± 12 jam)

- Playwright 5 alur (§15): publish artikel · buka artikel · ganti locale · sitemap ter-generate · search
- Sentry, UptimeRobot, alert
- Security header: CSP (dengan nonce, kompatibel dengan slot iklan), HSTS
- Backup `pg_dump` harian → R2, retensi 30 hari, **restore diuji lagi**
- Staging + produksi terpisah, deploy via GitHub Actions → VPS, Caddy + Cloudflare Full (strict)
- Core Web Vitals di mobile: LCP <2,5s · INP <200ms · CLS <0,1
- CMP (Google Funding Choices) terpasang, diuji dengan VPN Eropa

**Exit criteria:** seluruh Lampiran "Definition of Done" PRD tercentang kecuali "30 artikel" (itu Fase Seed, bukan development).

---

## Bagian C — Peta ke roadmap PRD

| Fase dev | Minggu PRD          | Perbedaan                                                                                                   |
| -------- | ------------------- | ----------------------------------------------------------------------------------------------------------- |
| 0 + 1    | Minggu 1            | Sesuai, tapi skema diperluas 4 tabel                                                                        |
| 2        | Minggu 2 (sebagian) | Sesuai                                                                                                      |
| 3        | Minggu 2–3          | **Diperbesar.** Pipeline markdown runtime adalah pekerjaan yang tidak terhitung di PRD karena asumsi MDsveX |
| 4        | Minggu 3            | Sesuai                                                                                                      |
| 5        | Minggu 4–5          | Digabung; slot iklan & kontrak CMP ditarik maju ke sini                                                     |
| 6        | Minggu 5            | **Dipisah dari Fase 5.** Minggu 5 versi PRD terlalu padat                                                   |
| 7        | Minggu 6            | Sesuai + Cloudflare Cache Rules ditambahkan                                                                 |
| 8        | Minggu 7            | Sesuai                                                                                                      |

**Total estimasi: ~90 jam ≈ 5,5 minggu efektif.** PRD mengalokasikan 7 minggu (~119 jam). Selisihnya adalah buffer — dan buffer itu akan terpakai. Jangan diisi fitur.

---

## Bagian D — Aturan yang mengikat selama development

1. **Non-Goals §9 mengikat.** Menambahkan apa pun dari daftar itu butuh alasan tertulis di dokumen ini terlebih dulu.
2. **Fase tidak overlap.** Exit criteria hijau dulu, baru fase berikutnya.
3. **Setiap fase berakhir dengan commit yang bisa di-deploy.** Tidak ada branch yang hidup lebih dari satu fase.
4. **Skema beku setelah Fase 1.** Perubahan lewat migration, dengan catatan alasannya.
5. **Yang tidak masuk exit criteria, tidak dikerjakan di fase itu.** Ide baru masuk ke backlog pasca-launch, bukan ke fase berjalan.

---

## Bagian E — Evaluasi package (svelte.dev/packages, 9 Sep 2026)

Aturan seleksi: **setiap dependensi adalah artikel yang tidak ditulis** (PRD §2). Package hanya masuk kalau menghemat waktu lebih banyak daripada biaya perawatannya seumur hidup project.

### E.1 Dipasang — dari direktori Svelte

| Package                            | Fase | Alasan                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sveltekit-superforms` + `valibot` | 3    | VERUM punya ~8 form (login, artikel, kategori, tag, topik, redirect, upload, newsletter). Superforms menangani validasi server+klien dari satu skema, progressive enhancement, dan pengembalian error — semuanya harus ditulis tangan kalau tidak. Ini penghematan terbesar di daftar ini. `valibot` dipilih atas `zod` karena jauh lebih kecil dan ikut ke bundle klien. |
| `@sentry/sveltekit`                | 8    | Sudah ditetapkan PRD §10.1. SDK resmi, bukan pilihan yang perlu diperdebatkan.                                                                                                                                                                                                                                                                                            |
| `@lucide/svelte`                   | 5    | Ikon tree-shakeable per-ikon. Alternatifnya menempel SVG manual — bisa, tapi ini murah.                                                                                                                                                                                                                                                                                   |

### E.2 Dievaluasi saat fasenya, belum diputuskan

| Package            | Fase | Pertimbangan                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `carta-md`         | 3    | Editor markdown dengan toolbar dan shortcut. **Syarat pakai: hanya sebagai editor, bukan sebagai renderer preview.** Carta punya pipeline markdown sendiri; kalau preview memakai pipeline itu, preview tidak sama dengan hasil terbit — dan seluruh gunanya hilang. Preview tetap harus lewat endpoint server yang memakai pipeline remark/rehype kita. |
| `svelte-meta-tags` | 7    | Deep-merge meta layout→halaman + helper JSON-LD. Nilainya nyata, tapi `hreflang` untuk model locale asimetris (PRD §7) tetap logika sendiri, dan JSON-LD hanyalah satu tag `<script>`. Putuskan setelah melihat berapa banyak yang benar-benar tersisa untuk ditulis tangan.                                                                             |
| `altcha`           | 6    | CAPTCHA privacy-first tanpa Google, aksesibel. Mulai dengan honeypot + rate limit dulu; pasang kalau spam newsletter jadi masalah nyata.                                                                                                                                                                                                                 |

### E.3 Ditolak — dengan alasan

| Package                                                                         | Kenapa tidak                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mdsvex`                                                                        | Sudah dibahas di §A.2 #1. Untuk halaman statis (About, Privacy, dsb.) sebenarnya cocok, tapi itu berarti **dua pipeline markdown** dengan dua set bug styling. Satu pipeline.                                                               |
| `@sveltejs/enhanced-img`                                                        | Terlihat cocok, tapi tidak. Ini optimasi _build-time_ untuk gambar di dalam repo. Gambar artikel VERUM diunggah saat runtime, diproses `sharp`, dan disajikan dari R2 — di luar jangkauannya sepenuhnya.                                    |
| `@unpic/svelte`                                                                 | Ditujukan untuk image CDN dengan transformasi berbasis URL. R2 adalah object storage biasa; varian sudah dibuat saat upload. Tidak ada yang dikerjakannya.                                                                                  |
| `super-sitemap`                                                                 | Berbasis route tree. Sitemap VERUM digerakkan database, per-locale, dengan anotasi `xhtml:link` dan pengecualian tag <3 artikel (PRD §12.7). Tidak ada irisan.                                                                              |
| `better-auth`                                                                   | Framework auth lengkap untuk kebutuhan **satu user tanpa registrasi**. PRD §9 menghapus akun pembaca justru untuk membuang permukaan ini; memasangnya kembali lewat dependensi adalah kemunduran. Argon2 + cookie session adalah ~80 baris. |
| `@tanstack/svelte-table`                                                        | Untuk dashboard <500 artikel milik satu orang, tabel dengan link sort sudah cukup.                                                                                                                                                          |
| `prosekit` / `svelte-lexical` / `typewriter-editor`                             | WYSIWYG. PRD §8.2 menetapkan editor markdown.                                                                                                                                                                                               |
| `svelte-adapter-bun`                                                            | Menarik, tapi memindahkan runtime produksi ke Bun berarti mempertaruhkan `sharp` dan `@node-rs/argon2` di server. Evaluasi ulang setelah launch, bukan sebelum.                                                                             |
| `@testing-library/svelte`, `storybook`, `devtools-json`, `svelte-inspect-value` | Nilai rendah untuk solo dev dengan 5 alur E2E sebagai jaring pengaman utama.                                                                                                                                                                |

### E.4 Dibutuhkan tapi tidak ada di direktori Svelte

Direktori itu hanya memuat package ber-tag Svelte. Yang berikut ini justru inti dari VERUM:

| Package                                                                                                                      | Fase | Untuk                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------- |
| `@node-rs/argon2`                                                                                                            | 2    | Password hash argon2id (PRD §8.2)                                                                       |
| `unified`, `remark-parse`, `remark-gfm`, `remark-rehype`, `rehype-raw`, `rehype-sanitize`, `rehype-slug`, `rehype-stringify` | 3    | Pipeline markdown runtime (koreksi §A.2 #1)                                                             |
| `shiki`                                                                                                                      | 3    | Syntax highlighting code block, tanpa JS di klien                                                       |
| `sharp`                                                                                                                      | 4    | Resize + AVIF/WebP (PRD §8.2)                                                                           |
| `aws4fetch`                                                                                                                  | 4    | Signing S3 untuk R2. ~1 KB; `@aws-sdk/client-s3` puluhan kali lebih besar untuk operasi PUT/DELETE saja |

---

## Bagian F — Catatan implementasi Fase 1 (skema beku)

Skema final: **15 tabel**. Migrasi `0000_initial_schema.sql` (DDL) + `0001_search_vector_trigger.sql` (custom SQL). Mulai titik ini, perubahan skema hanya lewat migrasi baru dengan alasan tertulis (§D.4).

### F.1 Yang berbeda dari PRD §11

| Perubahan                                                                  | Alasan                                                                                                                                                                                         |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `articles.cover_image TEXT` → `cover_media_id BIGINT REFERENCES media(id)` | String path tidak tahu apa-apa tentang varian AVIF/WebP, dimensi, atau alt text. FK ke `media` tahu semuanya, dan `ON DELETE SET NULL` mencegah cover menunjuk ke objek R2 yang sudah dihapus. |
| `article_locales` + `body_html`                                            | Hasil render disimpan, bukan dirender tiap request.                                                                                                                                            |
| `article_locales` + `body_text`                                            | Prosa bersih tanpa markup untuk di-index FTS. Meng-index `body_md` mentah berarti meng-index `##`, target link, dan isi code block sebagai kata yang bisa dicari.                              |
| `article_locales` + `toc`, `reading_minutes`, `word_count`                 | Dihitung sekali saat simpan, bukan tiap request.                                                                                                                                               |
| `topic_locales` + `intro_html`                                             | Pengantar dossier juga markdown; alasan yang sama dengan `body_html`.                                                                                                                          |
| `media.alt` NOT NULL                                                       | Gambar tanpa alt text adalah cacat aksesibilitas. Skema yang memaksanya lebih murah daripada audit belakangan.                                                                                 |
| `sessions.id` menyimpan **hash** token, bukan token                        | Dump database lalu tidak menyerahkan session yang masih hidup. Sama untuk `newsletter_subscribers.confirm_token_hash`.                                                                         |
| Status & locale = `TEXT` + `CHECK`, bukan `pgEnum`                         | Menambah nilai ke enum Postgres butuh `ALTER TYPE` dan mengunci migrasi. `CHECK` sama ketatnya dan bisa diubah. Tipe TS tetap union yang sempit.                                               |
| `article_stats` first-party                                                | Lihat §A.5.                                                                                                                                                                                    |

### F.2 Yang dibuktikan, bukan diasumsikan

- `bun run db:migrate` + `bun run db:seed` dari database kosong — berhasil.
- 8 test integrasi (`src/lib/server/db/queries/search.spec.ts`) berjalan atas migrasi yang sebenarnya, bukan `db:push`, sehingga trigger di `0001` ikut teruji sebelum produksi melihatnya. Mencakup: ranking, stemming `en` dan `id`, highlight `<mark>`, sintaks `websearch` (termasuk input rusak `(((` yang tidak boleh melempar error), isolasi locale, dan gerbang publikasi.
- Stemming Indonesia terbukti perlu: query `banding` menemukan "Membandingkan" dengan config `indonesian`, dan tidak menemukan apa pun dengan `english`.
- Artikel `scheduled` tidak muncul di search maupun listing — tanpa job runner.
- `scripts/backup.sh` + `scripts/restore-test.sh` — dump dipulihkan ke database scratch, lalu diverifikasi: 15 tabel, trigger ada, GIN index ada, `search_vector` selamat, **dan trigger benar-benar menyala di database hasil restore** (bukan sekadar ada). Scratch database dihapus otomatis.

### F.3 Utang yang sengaja ditinggalkan untuk fase berikutnya

- `body_html`, `body_text`, `toc`, `reading_minutes`, `word_count` masih diisi manual oleh seed. Fase 3 yang mengisinya lewat pipeline remark/rehype. Trigger FTS sudah menangani transisi ini: ia jatuh ke `body_md` selama `body_text` masih kosong.
- Belum ada query untuk related articles, topic, dan sitemap — menunggu fase yang memakainya.

---

## Bagian G — Catatan implementasi Fase 2 (auth)

### G.1 Keputusan

| Keputusan                                                                 | Alasan                                                                                                                                                                                                     |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cookie membawa token, database menyimpan **SHA-256**-nya                  | Dump database lalu tidak berisi apa pun yang bisa dipresentasikan browser. SHA-256 tanpa salt benar di sini dan salah untuk password: inputnya 192 bit acak, tidak ada yang bisa ditebak.                  |
| Kedaluwarsa ditegakkan di klausa `WHERE`, bukan dibandingkan di JS        | Baris yang sudah kedaluwarsa tidak pernah dikembalikan, jadi tidak ada celah di mana pemanggil lupa memeriksa.                                                                                             |
| Sliding expiry, diperpanjang saat dipakai                                 | Session tidak mati di tengah penyuntingan artikel.                                                                                                                                                         |
| `verifyDecoy` saat email tidak ditemukan                                  | Tanpa itu, waktu respons sendiri memberi tahu penyerang alamat mana yang nyata. Pesan error juga satu untuk kedua sebab.                                                                                   |
| Rate limit **dua lapis**: per-IP (10/15 menit) dan per-email (5/15 menit) | Keduanya menghentikan serangan berbeda. Per-IP menghentikan satu host mencoba banyak password; per-email menghentikan percobaan terdistribusi ke satu akun, yang per-IP sendirian tidak akan pernah lihat. |
| Logout hanya `POST`                                                       | Logout lewat `GET` bisa dipicu tag gambar atau prefetch mana pun — mengeluarkan editor jadi lelucon satu baris.                                                                                            |
| `?next=` divalidasi hanya path same-site berawalan `/admin`               | Open redirect di halaman login adalah primitif phishing.                                                                                                                                                   |
| Sapu session kedaluwarsa saat login berhasil                              | Satu-satunya saat session dibuat. Nol scheduler untuk dirawat.                                                                                                                                             |
| Copy admin tidak diterjemahkan                                            | Pembacanya tepat satu orang (PRD §8.2).                                                                                                                                                                    |
| Guard dua lapis: `hooks.server.ts` **dan** `+layout.server.ts`            | Kalau guard di hook pernah dipersempit oleh perubahan routing, halaman-halaman ini menolak render, bukan membocorkan isi.                                                                                  |

### G.2 Rate limiter: batasan yang eksplisit

In-memory token bucket. Ini ukuran yang tepat untuk **satu proses Node di satu VPS** (PRD §10.1): nol round-trip database di jalur panas, nol Redis untuk dirawat.

Trade-off-nya nyata dan dicatat di kode: bucket ter-reset saat restart, dan **instance kedua akan melipatgandakan setiap limit**. Kalau VERUM suatu saat berjalan lebih dari satu proses, ini pindah ke Postgres atau Redis — tidak ada bagian lain yang perlu berubah.

Konsekuensi lain: karena limiter adalah state per-proses di server yang diuji, Playwright dijalankan dengan `workers: 1`. Spec paralel akan saling menghabiskan jatah percobaan.

### G.3 Jebakan produksi yang ditangani sekarang

**`getClientAddress()` di balik proxy.** Di balik Caddy + Cloudflare, tanpa konfigurasi, **setiap** request terlihat datang dari satu IP proxy — rate limit login akan memblokir semua orang sekaligus dan tidak berguna sama sekali.

`adapter-node` membaca `ADDRESS_HEADER` dan `XFF_DEPTH`. Sudah masuk `.env.example` dengan peringatannya: `CF-Connecting-IP` ditulis Cloudflare dan tidak bisa dipalsukan klien **selama origin hanya menerima koneksi dari Cloudflare**. Kalau origin bisa dihubungi langsung, header itu bisa dipalsukan siapa pun — jadi firewall origin ke IP range Cloudflare adalah bagian dari kontrol ini, bukan pelengkap. Ditegakkan di Fase 8.

### G.4 Yang dibuktikan

29 test unit/integrasi (naik dari 8) dan 9 e2e (naik dari 3).

- **Password**: verifikasi benar/salah, hash bersalt (password sama → hash berbeda), hash rusak di database = login gagal, bukan 500.
- **Session**: hanya hash yang tersimpan (token mentah tidak menemukan baris apa pun), 200 token tidak ada yang kembar, token tak dikenal/kosong ditolak, session kedaluwarsa ditolak, sliding expiry memperpanjang, invalidasi satu session tidak menyentuh yang lain, menghapus user menghapus session-nya, sapuan menyisakan yang hidup, user-agent 5000 karakter dipotong bukan menggagalkan login.
- **Rate limiter**: burst sampai kapasitas lalu blok, isi ulang proporsional terhadap waktu, tidak pernah melebihi kapasitas, key independen, `reset` mengembalikan jatah, jumlah key terbatas di bawah banjir 500 IP unik.
- **E2E**: `/admin` tidak terjangkau tanpa session, pesan error tidak membocorkan field mana yang salah, header `no-store` + `noindex` + `X-Frame-Options: DENY`, login saat sudah masuk memantul ke dashboard, logout mematikan session di server (bukan hanya tab), `?next=` off-site diabaikan, `?next=` same-site dihormati, dan login gagal berulang benar-benar kena rate limit.

### G.5 Belum dikerjakan (sengaja)

- Superforms belum dipasang. Satu form login tidak membenarkan sebuah library; Fase 3 yang membawanya saat ada ~8 form.
- CSP dan HSTS: Fase 8. Header admin yang ada sekarang (`no-store`, `noindex`, `nosniff`, `DENY`) tidak bergantung pada CSP.
- Ganti password lewat UI. Untuk satu user, mengganti hash lewat `psql` atau seed sudah cukup sampai ada alasan lain.

---

## Bagian H — Catatan implementasi Fase 3 (mesin konten)

### H.1 Pipeline markdown

Urutannya bukan selera; setiap posisi punya alasan.

```
remark-parse → gfm → directive → remarkEmbeds
  → remark-rehype (allowDangerousHtml) → rehype-raw
  → rehype-sanitize          ← setelah raw, jadi HTML penulis ikut disaring
  → rehype-slug              ← id heading milik kita, bukan milik penulis
  → rehypeEmbeds             ← ekspansi placeholder di sisi tepercaya
  → ekstraksi TOC + prosa
  → rehype-shiki             ← inline style; kalau sebelum sanitize akan dibuang
  → rehype-stringify
```

**Embed ditangani dua tahap, dan itu yang membuat sanitizer tetap berarti.** Tahap pertama (sebelum sanitasi) mengubah `::youtube{id=…}` jadi `<div data-embed>` biasa dengan atribut yang sudah divalidasi. Tahap kedua (setelah sanitasi) mengembangkannya jadi markup asli. Konsekuensinya: **skema sanitasi tidak perlu mengizinkan `<iframe>` sama sekali** — penulis yang menempelkan `<iframe>` mentah tetap dibuang, sementara direktif tetap bekerja karena jalur itu hanya bisa menghasilkan ID yang sudah lolos validasi.

**Direktif tak dikenal dikembalikan ke teks aslinya.** remark-directive memperlakukan `:kata` sebagai text directive, jadi prosa biasa bisa memicunya. Tanpa pemulihan sumber, mdast-util-to-hast merender direktif tak tertangani sebagai elemen kosong — **menghapus kalimat penulis diam-diam**. Ada test untuk kalimat `Ratio was 3:1 and the flag is :experimental here.`

### H.2 Keputusan produk di dalam pipeline

| Keputusan                                                                    | Alasan                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Embed X = **kartu statis, bukan widget X**                                   | `widgets.js` adalah JavaScript pihak ketiga yang menyetel cookie — tidak boleh dimuat sebelum consent CMP (§14), jadi ia tidak akan tampil untuk sebagian besar pembaca Eropa. Ditambah satu round-trip render-blocking untuk kutipan sepanjang satu link. Kartu selalu tampil, untuk semua pembaca, tanpa biaya script. **Bisa ditinjau ulang** kalau Anda merasa tampilan asli X sepadan. |
| YouTube lewat `youtube-nocookie.com`, `loading="lazy"`, dibungkus rasio 16:9 | nocookie menahan cookie pelacak sampai pemutaran, jadi ia boleh dimuat sebelum consent. Wrapper rasio memesan tempatnya sehingga iframe yang datang belakangan tidak menggeser halaman (§12.5, CLS).                                                                                                                                                                                        |
| Body di-index dari `body_text`, bukan `body_md`                              | Test membuktikan `const secretToken = 1` di code block tidak jadi kata yang bisa dicari.                                                                                                                                                                                                                                                                                                    |
| TOC hanya h2 dan h3                                                          | h1 adalah judul artikel; lebih dalam dari h3 menghasilkan outline yang tidak dipakai siapa pun untuk navigasi.                                                                                                                                                                                                                                                                              |
| 200 kata/menit                                                               | Angka untuk prosa teknis.                                                                                                                                                                                                                                                                                                                                                                   |

### H.3 Slug berubah = 301 otomatis

PRD §12.1 mewajibkan mencatat 301 saat slug berubah. Mengandalkan ingatan untuk itu adalah cara membuang link equity, jadi `saveArticleLocale` menuliskannya dalam transaksi yang sama. Tiga langkah, berurutan:

1. Apa pun yang sudah menunjuk ke path lama **dipindah** ke path baru. Rantai A→B→C adalah hop terbuang dan mengencerkan apa yang diteruskan 301.
2. Rename-nya sendiri di-insert.
3. Path yang sedang hidup dihapus dari sisi `from_path` — kasus ini muncul saat slug dikembalikan ke nilai yang pernah dipakai, dan tanpa langkah ini artikel akan me-redirect ke dirinya sendiri.

Ada test untuk ketiganya. Form redirect manual juga menolak aturan yang targetnya sendiri sudah jadi sumber redirect.

### H.4 Live preview lewat server

Preview di editor dirender oleh **endpoint server yang memakai pipeline yang sama** dengan yang menulis `body_html` saat simpan. Renderer markdown di klien akan jadi pipeline kedua dengan sanitizer, embed, dan highlighter sendiri — dan begitu keduanya berbeda, preview berhenti jadi preview. Satu renderer, satu jawaban. Di-debounce 400 ms dan permintaan lama di-abort.

Konsekuensinya `carta-md` (§E.2) tidak dipasang: nilainya ada di renderer bawaannya, dan itu justru yang tidak boleh dipakai di sini. Textarea + preview server sudah menutup kebutuhannya.

### H.5 Preview link

HMAC-SHA256 atas `articleId.locale.exp`. Nol tabel, nol baris kedaluwarsa untuk disapu. Signature diverifikasi **sebelum** expiry dipercaya, karena expiry adalah bagian dari yang dilindungi signature — membacanya lebih dulu akan membiarkan siapa pun memperpanjang link-nya sendiri. Ada test yang mencoba persis itu. Merotasi `PREVIEW_TOKEN_SECRET` membatalkan semua link sekaligus; itu seluruh cerita revocation-nya.

Halaman preview `no-store` + `noindex, nofollow, noarchive`: draft yang terindeks lebih buruk daripada tidak ada preview sama sekali.

### H.6 Yang dibuktikan

71 test unit/integrasi (naik dari 29) dan 16 e2e (naik dari 9).

- **Sanitasi**: `<script>` beserta isinya, `onerror=`, `javascript:` URL, `<iframe>` dari penulis, atribut dan tag `style` — semuanya dibuang; markdown biasa utuh.
- **Direktif**: ID YouTube diterima dari bare id / youtu.be / watch?v= / shorts; ditolak untuk URL asing, path traversal, dan payload `"><script>`; `x.com.evil.example` ditolak sebagai lookalike; direktif salah menghasilkan pesan error yang terlihat, bukan hilang.
- **Ekstraksi**: TOC punya id yang benar-benar ada di markup; prosa tidak memuat isi code block maupun URL; state tidak bocor antar render.
- **E2E**: `<script>window.__pwned = true</script>` disimpan lalu dimuat ulang — `window.__pwned` tetap `undefined` dan markup-nya hilang.
- **E2E**: buat artikel → render → ganti slug (301 tercatat) → tambah locale kedua (kosong, bukan terjemahan) → preview link dibuka tanpa session → token dipalsukan ditolak 404 → publish.

### H.7 Belum dikerjakan

- Upload gambar dan picker media: Fase 4. Editor belum bisa menyisipkan gambar.
- Halaman topik/dossier: admin-nya belum ada; tabelnya sudah siap sejak Fase 1.
- Facade klik-untuk-muat pada YouTube. Iframe lazy sudah cukup di bawah lipatan; kalau CWV Fase 8 menunjukkan masalah, ini gantinya.

---

## Bagian I — Catatan implementasi Fase 4 (media)

### I.1 Storage bisa ditukar, dan konfigurasi separuh adalah error

Satu antarmuka `Storage` dengan dua driver: **R2** untuk produksi, **direktori lokal** untuk pengembangan dan CI. Itu yang membuat Fase 4 bisa dibangun dan diuji lengkap sebelum akun R2 ada.

Yang penting: **mengisi sebagian variabel R2 melempar error, bukan diam-diam jatuh ke filesystem.** Deploy produksi yang kurang satu variabel akan menulis upload ke disk container dan kehilangannya saat restart berikutnya — kegagalan yang baru ketahuan berminggu-minggu kemudian. Sekarang ia menolak start.

Route `/media/[...path]` yang menyajikan file lokal **menolak melayani apa pun saat driver R2 aktif**, jadi ia tidak bisa jadi origin produksi secara tidak sengaja.

### I.2 Satu upload = 7 objek, bukan 6

Exit criteria saya sendiri di §B menyebut 6 (3 ukuran × AVIF/WebP). Saya menyimpan **originalnya juga**.

Alasannya: ia berbiaya beberapa sen setahun di R2, dan ia satu-satunya hal yang membuat mengganti breakpoint — atau menambah format baru nanti — jadi pekerjaan re-render, bukan meminta penulis mencari dan meng-upload ulang setiap gambar yang pernah dipakainya. Tanpa original, keputusan ukuran hari ini jadi pintu satu arah.

Tidak ada fallback JPEG. Semua browser yang masih dipakai bisa membaca WebP; format ketiga hanya byte yang disimpan untuk tidak ada siapa-siapa.

### I.3 Keamanan dan privasi upload

| Kontrol                                        | Alasan                                                                                                                                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SVG ditolak**                                | SVG bukan format gambar di sini, ia wadah script.                                                                                                                                            |
| Semua input di-decode ulang oleh sharp         | Apa pun yang diklaim file itu, yang tersimpan adalah keluaran sharp.                                                                                                                         |
| `limitInputPixels` + batas dimensi             | Decompression bomb: file kecil yang mengembang jadi gigapixel.                                                                                                                               |
| `rotate()` tanpa argumen                       | Membakar orientasi EXIF lalu **membuang metadatanya** — termasuk **koordinat GPS** dari foto ponsel. sharp tidak menulis metadata kecuali diminta, jadi itu seluruh ceritanya. Ada test-nya. |
| `alt` wajib di form, bukan hanya default kolom | Gambar tanpa alt text adalah cacat aksesibilitas, dan saat yang tepat memperbaikinya adalah sekarang.                                                                                        |
| Key = hash konten                              | Objek di sebuah key tidak pernah berubah arti, jadi bisa `immutable` setahun (§10.3). Upload ulang file yang sama mengembalikan baris yang ada, bukan duplikat.                              |

### I.4 CLS: dimensi bukan hiasan

`::image{id=N}` dirender jadi `<picture>` lengkap: `<source>` AVIF lalu WebP dengan `srcset`, `sizes`, dan `<img>` dengan **`width` dan `height` intrinsik**, `loading="lazy"`, `decoding="async"`.

Tanpa `width`/`height`, browser tidak bisa memesan kotaknya sebelum byte-nya tiba, dan setiap gambar di halaman jadi layout shift. Ada e2e yang mengukur CLS sungguhan lewat `PerformanceObserver` dan menuntut **tepat 0** — bukan 0,1 yang diizinkan §12.5.

### I.5 Bug yang ditemukan dan diperbaiki di Fase 3

Pipeline render Fase 3 menyimpan hasil ekstraksi TOC/prosa di **variabel module-scope**. `renderMarkdown` menunggu Shiki, jadi render kedua bisa mendarat di antara ekstraksi render pertama dan pembacaannya — lalu menyerahkan heading artikel yang salah.

Ini persis kegagalan yang PRD §10.4 uraikan untuk locale, dan **tidak akan pernah muncul dengan satu request pada satu waktu**. Sekarang state per-render hidup di `VFile`, dan ada test yang menjalankan tiga render bersamaan lewat `Promise.all` untuk membuktikannya.

### I.6 Smoke test build produksi

`vite preview` bukan yang berjalan di produksi. `scripts/smoke-build.sh` menjalankan `node build/index.js` — entry yang sama yang akan distart systemd — dan memeriksa lima path. Sudah masuk CI.

Alasannya konkret: `sharp` dan `@node-rs/argon2` adalah native module, dan itu justru kelas dependensi yang bekerja di dev server lalu gagal di bundle adapter-node. `bun.lock` sudah memuat `@img/sharp-linux-x64`, jadi CI Linux aman dengan `--frozen-lockfile`.

### I.7 Yang dibuktikan

85 test unit/integrasi (naik dari 71) dan 21 e2e (naik dari 16).

- 2400×1600 → tepat 6 rendition + original; 400×300 → 2 rendition, **tidak pernah di-upscale**.
- Byte yang sama → hash sama → key sama; upload ulang tidak menduplikasi baris.
- EXIF termasuk GPS hilang dari hasil.
- SVG, teks biasa, dan file kosong ditolak sebagai `UploadError`, bukan 500.
- Hapus media membuang baris **dan** ketujuh objeknya.
- `::image{id=999}` yang tidak ada di library menghasilkan error terlihat, bukan `<img>` rusak.
- E2E: upload → 6 rendition → sisipkan ke artikel → `<picture>` dengan `width="2000" height="1250"` → **CLS terukur 0**.

### I.8 Belum dikerjakan

- Halaman publik belum memakai `pictureFor`; Fase 5 yang memasangnya di homepage, kategori, dan artikel.
- Belum ada pembersihan objek yatim (upload yang gagal di tengah meninggalkan objek tanpa baris). Sengaja: baris ditulis **setelah** objek, karena objek yatim berharga beberapa sen sementara baris yang menunjuk file tidak ada adalah gambar rusak di artikel terbit. Skrip pembersih masuk Fase 8 kalau memang perlu.

---

## Bagian J — Catatan implementasi Fase 5 (permukaan publik)

### J.1 Banner ganti bahasa dirender di klien, bukan server

Ini bukan preferensi gaya; server-render akan **merusak cache CDN**.

Halaman artikel di-cache di edge dengan TTL panjang (§10.3). Kalau banner diputuskan di server dari `Accept-Language`, maka bahasa pengunjung pertama ikut terbakar ke dalam salinan yang diterima semua orang sesudahnya. Alternatifnya `Vary: Accept-Language`, yang memecah cache jadi puluhan varian dan membuang gunanya.

Jadi: daftar locale yang benar-benar ada dikirim sebagai data (tidak tergantung pengunjung, aman di-cache), dan `navigator.language` yang memutuskan di browser. Tetap **saran, bukan redirect** (§10.4).

### J.2 Cache-control dimiliki halaman, bukan layout

SvelteKit melempar error kalau dua `load` menyetel header yang sama. Awalnya saya menaruh `cache-control` di `+layout.server.ts` sebagai default — hasilnya **setiap halaman publik 500**, dan yang menangkapnya adalah `scripts/smoke-build.sh`, bukan unit test.

Sekarang tiap halaman menyetel miliknya sendiri, karena memang berbeda: artikel 24 jam dengan `stale-while-revalidate`, homepage dan kategori 60 detik, topik 5 menit, search nanti tanpa cache sama sekali. Default di layout akan salah untuk sebagian besar halaman _atau_ bertabrakan dengan halaman yang menyetel yang benar.

### J.3 Dark mode tanpa flash

Script inline di `<head>` membaca `localStorage` dan menyetel `data-theme` **sebelum paint pertama**. Harus inline dan blocking: dimuat sebagai file atau di-defer berarti halaman ter-paint dengan tema default lalu repaint — persis flash yang jadi isi setiap laporan bug "dark mode".

Konsekuensi untuk Fase 8: script ini butuh hash atau nonce di CSP. Sudah dicatat di `app.html` — `script-src 'self'` saja tidak akan cukup.

Toggle punya **tiga** state, bukan dua. "System" harus jadi opsi nyata: pembaca yang mengganti OS-nya ke gelap saat malam berharap situsnya ikut, dan toggle dua-state diam-diam mengeluarkan mereka dari itu selamanya begitu sekali disentuh.

### J.4 Kontrol yang butuh JS disembunyikan sampai JS jalan

Layout menambahkan `class="js"` ke `<html>` lewat efek. Theme toggle dan tombol salin tautan hanya muncul setelah itu — kontrol mati lebih buruk daripada tidak ada kontrol. Tombol share tetap tampil karena memang hanya `<a href>`.

Ada e2e dengan `javaScriptEnabled: false` yang memeriksa homepage, artikel, kategori, tag, dan topik semuanya render, dan bahwa kedua kontrol itu tersembunyi. SSR bukan nice-to-have di sini: §10.1 menjadikannya alasan stack-nya SvelteKit dan bukan SPA.

### J.5 Slot iklan: kotak dulu, script belakangan

`AdSlot` memesan tinggi lewat CSS dan **tidak memuat script apa pun**. Dua hal disengaja:

1. Slot iklan adalah penyebab layout shift nomor satu di situs publisher (§13.1), dan memesan setelah iklan datang tidak menolong — shift-nya sudah terjadi.
2. AdSense hanya boleh berjalan setelah CMP punya sinyal consent (§14). Tag-nya akan disuntikkan oleh callback consent di Fase 8, ke dalam kotak-kotak ini, berdasarkan `data-ad-slot`. Menaruhnya di `app.html` akan menembakkannya sebelum consent — pelanggaran yang justru jadi alasan CMP diwajibkan.

E2E mengukur CLS sungguhan dengan placeholder aktif: **0**.

### J.6 Embed X dan share tanpa script pihak ketiga

Konsisten dengan §H.2: tombol share adalah `<a href>` biasa ke URL intent masing-masing platform. Setiap SDK share adalah JavaScript pihak ketiga yang menyetel cookie — masalah consent dan biaya performa — demi sesuatu yang sudah bisa diungkapkan sebuah URL.

### J.7 Refactor yang dipaksa oleh seed

`renderMarkdown` menarik `media/index.ts`, yang menarik `storage.ts`, yang butuh `$env/dynamic/private`. Seed berjalan sebagai skrip bun di luar SvelteKit, jadi seed **crash** begitu ia mulai me-render markdown.

Perbaikannya struktural, bukan tambalan: fungsi murni (`pictureFor`, `ARTICLE_IMAGE_SIZES`) pindah ke `media/picture.ts` dan tipe ke `media/types.ts`, keduanya tanpa sentuhan environment. Pipeline render sekarang hanya bergantung pada bagian murni. Ini juga membuat seed menghasilkan `body_html` yang identik dengan artikel yang benar-benar ditulis.

### J.8 Aturan lint yang dimatikan, dan gantinya

`svelte/no-navigation-without-resolve` dimatikan **hanya** untuk `src/routes/(public)/**` dan `src/lib/components/**`. Alasannya: setiap URL publik membawa prefix locale yang tidak ada di route tree, karena `hooks.ts` men-delokalisasi sebelum SvelteKit mencocokkan — `/en/ai/slug` adalah halaman nyata sementara `resolve()` tidak punya route id untuknya.

Gantinya `src/lib/urls.spec.ts`: 5 test yang menguji bentuk URL sesuai §12.1, termasuk bahwa tidak ada tanggal di URL dan bahwa halaman 1 tidak punya dua URL (`?page=1` dan path telanjang). Route admin **tetap** memakai aturan itu, karena path-nya memang ada di route tree.

### J.9 Yang dibuktikan

90 test unit/integrasi (naik dari 85) dan 33 e2e (naik dari 21).

- JS mati: homepage, artikel, kategori, tag, topik semuanya render; theme toggle dan tombol salin tersembunyi; link share tetap ada.
- Kategori tak dikenal → 404, bukan halaman kosong.
- Ganti locale tetap di artikel yang sama, dan artikel yang **hanya** punya versi `en` mengembalikan 404 di `/id` — asimetri §7 memang begitu.
- Artikel terjadwal tidak terjangkau.
- Tema tersimpan sudah terpasang sebelum paint, dan `background-color` body benar-benar warna gelap.
- Slot iklan tinggi ≥ 280px dan CLS terukur **0**.
- Di viewport 360px halaman tidak pernah scroll ke samping.
- Smoke build produksi diperluas ke `/en/ai`, `/en/tag/llm`, `/en/topic/ai-tooling`, `/id`, dan 404 kategori.

### J.10 Belum dikerjakan

- `/[locale]/search` belum ada; Fase 6.
- Form newsletter dirender **disabled** karena route-nya baru ada di Fase 6. Form yang diam-diam membuang alamat lebih buruk daripada "belum".
- Meta lengkap, hreflang, structured data, RSS, sitemap: Fase 7. Yang ada sekarang hanya title, description, dan canonical.
- Halaman statis (About, Privacy, dsb.) belum ada — footer sudah menautkannya dan tautan itu masih 404 sampai Fase 7.

---

## Bagian K — Catatan implementasi Fase 6 (search, newsletter, dashboard)

### K.1 Pageview: penghitung sisi server akan salah ~sebesar cache hit rate

Ini temuan terpenting fase ini. Halaman artikel yang terbit di-cache CDN dengan TTL 24 jam (§10.3) — artinya **origin tidak pernah melihat sebagian besar pembacaan**. Menambahkan `UPDATE article_stats` di `load` halaman artikel akan menghitung hanya yang lolos cache, lalu melaporkan angka itu di dashboard seolah-olah itu jumlah sebenarnya.

Jadi penghitungnya adalah **beacon dari browser** ke `/api/view`, endpoint yang tidak di-cache. Yang disimpan hanya hitungan harian per artikel per locale: tanpa identifier, tanpa alamat, tanpa fingerprint — jadi tidak ada yang perlu digerbangi consent banner, dan ia boleh jalan sebelum CMP menjawab.

Ini metrik internal kasar, bukan kebenaran analytics: pengunjung yang niat bisa menggelembungkannya. Keputusan soal peringkat tetap dari Search Console. Sudah dicatat di kode.

### K.2 Mailer bisa ditukar, konfigurasi separuh adalah error

Pola yang sama dengan storage R2 di §I.1. SMTP untuk produksi, buffer in-memory selain itu — jadi alur double opt-in bisa dibangun dan diuji **end-to-end** sebelum akun SMTP ada, dan CI yang tidak punya kredensial tetap menjalankannya.

Mengisi sebagian variabel SMTP melempar error. Alasannya spesifik untuk kasus ini: form pendaftaran yang **menerima alamat lalu diam-diam tidak pernah mengirim konfirmasi** terlihat persis seperti form yang bekerja. Kegagalan itu baru ketahuan saat Anda bertanya-tanya kenapa tidak ada subscriber.

Halaman `/admin/mail` (dev inbox) **berhenti ada** begitu SMTP terkonfigurasi — halaman yang menampilkan isi email keluar tidak boleh terjangkau di produksi, bahkan di balik session admin.

> **Keputusan terbuka:** provider SMTP belum dipilih. §18.4 menyebut Buttondown vs Listmonk, tapi keduanya soal _pengiriman kampanye_; yang dibutuhkan di sini email transaksional. Kandidat: Resend, Postmark, atau SMTP dari provider newsletter yang dipilih. Isi 5 variabel di `.env` dan jalur SMTP langsung aktif tanpa perubahan kode.

### K.3 Double opt-in dimiliki sendiri, bukan provider

§13.3 menyebut email list sebagai satu-satunya kanal yang tidak bisa diambil Google. Itu hanya benar kalau alamatnya ada di tempat yang kita kendalikan — jadi tabel `newsletter_subscribers` **adalah** listnya, dan provider hanya mengirim.

| Keputusan                                                | Alasan                                                                                                                                                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Token disimpan sebagai SHA-256                           | Sama seperti session: dump database tidak berisi apa pun yang bisa dipakai.                                                                                                                                              |
| Token hangus saat dipakai                                | Email yang diteruskan ke orang lain jadi mati.                                                                                                                                                                           |
| Alamat yang **sudah** terkonfirmasi tidak dikirimi ulang | Kalau tidak, form ini jadi cara membuat server kita mengirim email ke alamat siapa pun, berulang kali.                                                                                                                   |
| Alamat pending yang mendaftar lagi mendapat token baru   | Email yang hilang bisa dipulihkan tanpa beban support; link lama langsung mati.                                                                                                                                          |
| Respons sama untuk alamat baru dan yang sudah terdaftar  | Form publik tidak boleh membocorkan siapa ada di list.                                                                                                                                                                   |
| Unsubscribe adalah **POST** dari link **ber-HMAC**       | GET satu klik akan dipicu klien email yang mem-prefetch link — diam-diam mengeluarkan orang yang tidak pernah mengklik. Tanpa signature, siapa pun bisa mengeluarkan siapa pun dengan mengetik alamat di query string.   |
| Honeypot, bukan CAPTCHA                                  | Field tersembunyi yang tidak pernah diisi manusia. `aria-hidden` + `tabindex="-1"` supaya screen reader tidak mengumumkan field yang tidak boleh diisi. `altcha` (§E.2) tetap dicadangkan kalau spam jadi masalah nyata. |
| Rate limit 5/jam per IP                                  | Endpoint ini mengirim email. Tanpa batas, ia adalah alat untuk membuat server ini mengirimi orang lain.                                                                                                                  |

Validasi alamat sengaja longgar (`^[^\s@]+@[^\s@.]+\.[^\s@]+$`). Regex yang lebih ketat menolak alamat asli — tanda plus, TLD baru, local part unicode — dan **email konfirmasinya sendiri adalah pemeriksaan yang sebenarnya**: alamat yang tidak bisa menerimanya tidak pernah jadi subscriber.

### K.4 Search

`ts_rank_cd` dengan normalisasi 32, `websearch_to_tsquery` untuk parsing, `ts_headline` untuk cuplikan. Hitungan total adalah **query kedua**, bukan `count(*) OVER ()`: window function akan memaksa ranking dan headline atas setiap kecocokan sebelum menghitungnya, dan `ts_headline` adalah bagian termahal dari search.

Halaman search `no-store` dan `noindex, follow` — hasil search bukan konten, dan tidak boleh terindeks. Rate-limited karena setiap pencarian adalah full-text scan plus headline per hit: request publik termahal yang dilayani situs ini.

### K.5 Dashboard

Menampilkan yang benar-benar dipantau menurut §3, sebatas yang diketahui database ini: status artikel, **kecepatan terbit terhadap target 5/minggu** (§5.1 — konsistensi mengalahkan volume, jadi ditampilkan relatif terhadap target, bukan angka telanjang), artikel terjadwal berikutnya, 10 artikel paling banyak dibaca 30 hari, subscriber terkonfirmasi, dan driver mail/storage yang sedang aktif. Sesi organik dan halaman terindeks datang dari Search Console — itu tidak untuk dicerminkan.

### K.6 Yang dibuktikan

120 test unit/integrasi (naik dari 90) dan 47 e2e (naik dari 33).

**Sepuluh query search**, sesuai exit criteria, atas korpus yang bentuknya menyerupai yang asli — kosakata tumpang tindih antar kategori, satu artikel Indonesia, satu draft, satu terjadwal:

1. frasa judul persis → artikelnya di peringkat 1
2. satu istilah khas → hanya yang menyebutnya
3. stemming: `refactor` menemukan "refactoring"
4. istilah yang hanya ada di body tetap cocok
5. dua kata → yang memuat keduanya di atas yang memuat salah satu
6. frasa dalam tanda kutip mengecualikan artikel yang katanya terpisah
7. negasi `-sqlite` benar-benar membuang
8. filter kategori menyempitkan tanpa mengubah relevansi
9. stemming Indonesia bekerja dan tidak menjangkau baris Inggris
10. omong kosong mengembalikan kosong, bukan segalanya

Plus: draft dan artikel terjadwal tidak pernah muncul, dan hitungan total konsisten dengan daftar hasil di semua halaman.

**Double opt-in end-to-end** di e2e: daftar → email tertangkap → link diambil dari dev inbox → dibuka di context tanpa session → terkonfirmasi → link yang sama ditolak saat dipakai ulang → subscriber muncul di dashboard. Ditambah: alamat tidak valid ditolak **server**, bukan hanya browser; honeypot menelan bot tanpa membuat apa pun; search bekerja dengan JavaScript mati.

### K.7 Belum dikerjakan

- Sinkronisasi subscriber ke provider pengiriman. Listnya sudah dimiliki; mengirim kampanye adalah pekerjaan Fase 2 roadmap PRD, bukan sekarang.
- `purgeStalePending` ada dan diuji tapi belum dipanggil siapa pun — cron Fase 8.
- Halaman statis yang ditautkan footer masih 404. Fase 7.

---

## Bagian L — Audit layanan pihak ketiga

Ditulis 10 September 2026, setelah pertanyaan: kenapa layanan eksternalnya terasa banyak?

### L.1 Yang benar-benar disentuh kode hari ini: dua

Audit atas seluruh `src/` — setiap `env.*` yang dibaca dan setiap host eksternal yang disebut:

| Layanan           | Dipakai untuk                  | Status                                                   |
| ----------------- | ------------------------------ | -------------------------------------------------------- |
| **Cloudflare R2** | Penyimpanan gambar             | Punya driver; tanpa kredensial jatuh ke filesystem lokal |
| **Provider SMTP** | Email konfirmasi double opt-in | Punya driver; tanpa kredensial jatuh ke buffer in-memory |

Itu saja. Sisanya di `.env.example` adalah **placeholder untuk fase berikutnya**, bukan integrasi yang sudah hidup. Dan keduanya punya driver pengganti, jadi seluruh aplikasi berjalan dan teruji penuh **tanpa satu pun akun eksternal**.

### L.2 Akun vendor yang dibutuhkan sampai launch: empat

Menghitung per **akun**, bukan per fitur — ini yang menentukan berapa banyak yang harus Anda daftar, bayar, dan rawat.

| #   | Vendor         | Untuk                                            | Biaya                          |
| --- | -------------- | ------------------------------------------------ | ------------------------------ |
| 1   | **Cloudflare** | DNS, CDN, R2, dan (opsional) registrar domain    | Gratis + R2 di bawah free tier |
| 2   | **Hetzner**    | VPS                                              | ~Rp65.000/bln                  |
| 3   | **GitHub**     | Repo + CI + deploy                               | Gratis                         |
| 4   | **Google**     | Search Console + AdSense + Funding Choices (CMP) | Gratis                         |

Empat, bukan lima belas. Cloudflare menyediakan empat hal dari satu akun, dan Google tiga. Membeli domain lewat **Cloudflare Registrar** (harga at-cost, tanpa markup perpanjangan) menjaganya tetap empat.

Cloudflare memang benar-benar layak: §10.2 sudah membuktikannya lewat egress R2 yang gratis, dan itu faktor penentu untuk situs bergambar.

### L.3 Ditunda sampai benar-benar perlu: tiga

| Vendor        | Kapan                                                      | Catatan                                                                           |
| ------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Provider SMTP | Saat newsletter diaktifkan — Fase 2 roadmap PRD, bulan 4–6 | **Tidak dibutuhkan untuk launch.** Formnya sudah bekerja penuh dengan driver log. |
| Sentry        | Kapan saja                                                 | Free tier                                                                         |
| UptimeRobot   | Sebelum launch                                             | Free tier                                                                         |

### L.4 Dua yang saya sarankan dibuang

**Buttondown / Listmonk sebagai provider newsletter terpisah — buang.**

Kita sudah memiliki listnya sendiri (§K.3) dan sudah punya SMTP untuk email konfirmasi. Mengirim newsletter ke beberapa ratus alamat bisa lewat SMTP yang sama. Buttondown menambah **$9/bulan dan salinan kedua dari list Anda di tempat lain** — padahal alasan memiliki list adalah agar ia tidak ada di tempat orang lain.

Caveat jujur: bulk send lewat SMTP transaksional bisa kena batas kirim dan masalah deliverability di atas ~1.000 alamat. Tinjau ulang saat sampai di sana — dan saat itu Anda sudah punya traffic yang membenarkan biayanya.

**GA4 — opsional, pasang belakangan.**

§3 memantau lima hal: sesi organik, halaman terindeks, artikel naik/turun peringkat, subscriber, RPM. Search Console memberi tiga yang pertama, `article_stats` memberi pageview, AdSense memberi RPM. Yang hilang hanya **sumber referral** — yang mulai relevan begitu referral dari mesin pencari AI tumbuh (§12.6). Pasang kalau memang ingin tahu itu, bukan karena merasa harus.

### L.5 Bukan layanan, meski sering dikira

| Terlihat seperti integrasi                    | Sebenarnya                                                   |
| --------------------------------------------- | ------------------------------------------------------------ |
| Tombol share X / LinkedIn / WhatsApp / Reddit | `<a href>` biasa. Tanpa SDK, tanpa akun, tanpa cookie (§J.6) |
| Embed YouTube                                 | iframe `youtube-nocookie`. Tanpa akun                        |
| Embed X                                       | Kartu statis, sengaja tanpa `widgets.js` (§H.2)              |
| Unsplash / Pexels                             | Sumber gambar berlisensi, bukan integrasi                    |

Ini hasil langsung dari keputusan §H.2 dan §J.6: menolak setiap SDK pihak ketiga berarti daftar layanan tetap pendek dengan sendirinya.

### L.6 Biaya bulanan kalau saran ini diikuti

| Item                                                 | Perkiraan                               |
| ---------------------------------------------------- | --------------------------------------- |
| Hetzner CX22                                         | ~Rp65.000                               |
| Cloudflare CDN + R2                                  | Rp0 (di bawah free tier; egress gratis) |
| Domain (~Rp180.000/tahun)                            | ~Rp15.000                               |
| GitHub, Sentry, UptimeRobot, Search Console, AdSense | Rp0                                     |
| SMTP (mulai bulan 4–6)                               | Rp0 di free tier awal                   |
| **Total**                                            | **~Rp80.000/bln**                       |

Batas §2 adalah Rp200.000/bln. Ada margin lebar.

Dengan Buttondown: +$9 ≈ Rp145.000 → total ~Rp225.000, **di atas batas** — sebelum ada pemasukan apa pun.

> Harga di atas perkiraan per September 2026. Cek nilai sebenarnya saat mendaftar.

---

## Bagian M — Catatan implementasi Fase 7 (SEO & mesin)

### M.1 Sitemap digenerate dari database, bukan ditulis ke file

PRD §12.7 menyebut "regenerasi otomatis saat publish". Itu biasanya berarti menulis file saat artikel terbit — dan file yang ditulis saat publish bisa **tidak sinkron** dengan database: publish gagal separuh, artikel terjadwal lewat waktunya tanpa ada yang menulis ulang, deploy menimpa file.

Di skala VERUM (350 artikel di akhir tahun kedua), query-nya beberapa milidetik. Jadi sitemap dirender dari database saat diminta, di-cache di edge, dan di-purge saat publish. Seluruh kelas kegagalan "file dan database tidak cocok" hilang.

### M.2 Yang tidak boleh ada di sitemap sama pentingnya dengan yang ada

Sitemap adalah **klaim** bahwa sebuah URL kanonik dan layak diindeks. Jadi ia mengecualikan artikel terjadwal, dan tag di bawah ambang 3 artikel — karena halaman tag itu sendiri mengirim `noindex`. Sitemap yang mencantumkannya berarti situs ini mengatakan dua hal berbeda tentang halaman yang sama, dan Google memperlakukan kontradiksi itu sebagai sinyal yang tidak bisa dipercaya.

### M.3 hreflang: yang paling mudah dirusak

Tiga aturan yang ditegakkan, masing-masing dengan test:

1. **Self-reference wajib.** Cluster tanpa tautan ke dirinya sendiri diabaikan Google sepenuhnya.
2. **Hanya locale yang benar-benar terbit.** §7 mengizinkan artikel hanya punya versi `en`. Mengumumkan versi `id` yang tidak ada merusak cluster untuk **kedua** bahasa, bukan hanya yang hilang.
3. **Simetris.** Ada e2e yang membuka versi `en`, mencatat pasangan URL-nya, membuka versi `id`, dan menuntut pasangan yang sama persis.

Anotasi `xhtml:link` di sitemap harus setuju dengan tag `hreflang` di halaman. Google memeriksa keduanya, dan perbedaan di antaranya membuat seluruh set diabaikan.

### M.4 Redirect diperiksa setelah 404, bukan sebelum routing

Menaruh lookup redirect di depan setiap request berarti satu round-trip database untuk setiap kunjungan halaman, demi tabel yang biasanya kosong. Memeriksanya **setelah** router menghasilkan 404 sama benarnya dan gratis di jalur normal.

Query string dibawa serta: link kampanye dengan `?utm_source=` yang mengikuti slug lama tetap bisa diukur setelah pindah. Ada test-nya.

### M.5 RSS ringkasan, bukan teks penuh

PRD §8.1 sudah menyebut "ringkasan + link", dan alasannya layak dicatat: feed teks penuh menyerahkan salinan bersih setiap artikel kepada setiap scraper, dan salinan itu **rutin mengalahkan aslinya** di peringkat. Excerpt sudah cukup bagi pembaca untuk memutuskan — itu gunanya feed.

### M.6 `ads.txt` mengembalikan 404 sampai diisi

Bukan file kosong, bukan placeholder. Verifier memperlakukan deklarasi yang rusak lebih buruk daripada file yang tidak ada — file berisi contoh berarti situs ini menyatakan ada pihak lain yang boleh menjual inventory-nya.

### M.7 JSON-LD dan tanda `<`

Setiap `<` di payload JSON-LD diubah jadi `<`. Itu tetap JSON yang valid, dan `</script>` adalah satu-satunya urutan yang bisa menutup blok lebih awal — mengubah structured data jadi titik injeksi. Judul artikel adalah teks yang ditulis manusia, jadi ini bukan kemungkinan teoretis.

### M.8 Halaman statis: draf sungguhan, bukan placeholder

Lima halaman yang diwajibkan §14 untuk AdSense, dalam dua bahasa, ditulis sebagai markdown yang lewat pipeline render yang sama dengan artikel.

**Kebijakan Privasi menjelaskan apa yang kode ini benar-benar lakukan** — hitungan agregat tanpa identifier, alamat email hanya setelah double opt-in, script iklan hanya setelah CMP menjawab. Itu menjadikannya kewajiban pemeliharaan: **kalau kodenya berubah, halaman ini ikut berubah.**

> **Perlu Anda kerjakan:** isi `PUBLIC_CONTACT_EMAIL`. Halaman Kontak tanpa cara menghubungi menggagalkan justru syarat AdSense yang halaman itu ada untuk memenuhinya. Dan ini draf yang ditulis dengan hati-hati, bukan nasihat hukum — §14 PRD sendiri menyarankan konsultasi untuk keputusan badan usaha dan pajak.

### M.9 Yang tidak bisa dikerjakan dari kode

`docs/CLOUDFLARE.md` memuat langkah dashboard yang butuh akun Anda. Yang paling penting: **Cache Rule.** Tanpa itu Cloudflare tidak meng-cache HTML sama sekali (koreksi §A.2 #4), TTL di header tidak berpengaruh, dan API purge tidak ada gunanya karena tidak ada yang di-cache untuk dibuang.

Ditambah satu yang mudah terlewat: **firewall origin ke IP range Cloudflare adalah bagian dari kontrol rate limit**, bukan pengerasan opsional. `ADDRESS_HEADER=CF-Connecting-IP` hanya aman selama origin tidak bisa dihubungi langsung — kalau bisa, siapa pun mengirim header itu dengan nilai apa pun dan melewati rate limit login sepenuhnya. Dipasang tanpa firewall, konfigurasi itu justru **melemahkan** keamanan.

### M.10 Yang dibuktikan

131 test unit dan 65 e2e (naik dari 47).

- Canonical menunjuk locale-nya sendiri, di kedua bahasa.
- Title ≤60 dan description ≤155, terpotong di batas kata.
- `Article` cocok dengan `<h1>` yang benar-benar dirender; `dateModified` tidak pernah kosong; `BreadcrumbList` posisinya 1-2-3 dan item terakhirnya judul artikel.
- Template `SearchAction` diikuti sungguhan dan harus mengembalikan 200 — markup yang menunjuk halaman tidak ada adalah yang kebijakan structured data Google sebut spam.
- hreflang simetris dua arah; artikel yang hanya `en` mengumumkan `en` + `x-default` saja.
- robots mengizinkan empat crawler AI dan menunjuk sitemap; `/admin` di-`Disallow`.
- Sitemap `en` memuat anotasi `xhtml:link`, **tidak** memuat artikel terjadwal, dan **tidak** memuat tag di bawah ambang.
- Feed tidak memuat `<h2>` — bukti ia ringkasan, bukan teks penuh.
- Feed `id` benar-benar feed berbeda.
- Slug lama **301 dengan query string terbawa**; URL yang tidak pernah ada tetap 404.
- Halaman search `noindex` tanpa canonical; halaman statis canonical tanpa `noindex`.

### M.11 Belum dikerjakan

- Beli domain, pasang Cloudflare, submit sitemap ke Search Console: Fase 8, dan butuh akun Anda.
- CMP Funding Choices: Fase 8. Kontrak loading script sudah siap sejak §J.5.
- CSP, HSTS, backup terjadwal, Sentry, uptime: Fase 8.

---

## Bagian N — Perombakan desain (referensi: app.uniswap.org)

Diminta 10 September 2026: desain terasa biasa saja, ingin seperti app.uniswap.org.

Saya memeriksa situsnya langsung, bukan mengandalkan ingatan. Nilai yang diambil: `#131313` sebagai dasar, aksen `#ff37c7`, radius 12/16/20/24/pill, dan yang paling khas — **heading 36–52px pada weight 485**.

### N.1 Yang diambil

| Kualitas                                                          | Kenapa cocok untuk publikasi                                                                                                                                                                                      |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Heading besar dengan weight rendah** (485 → 500 di font statis) | Ini justru lebih cocok untuk editorial daripada untuk aplikasi. Ukuran yang membawa hierarki, bukan ketebalan. Judul artikel sekarang `clamp(2rem, …, 3.25rem)` pada weight 500 dengan `letter-spacing: -0.03em`. |
| **Radius konsisten** 12/16/20/24 + pill                           | Kartu, gambar, dan panel terasa satu sistem. Kontrol kecil jadi pill.                                                                                                                                             |
| **Permukaan ber-tint aksen 4–16%**, bukan abu-abu datar           | Inilah yang membuat antarmuka terasa _berwarna_, bukan sekadar dicat. `--surface-2` dan `--surface-3` dicampur dari `--accent`.                                                                                   |
| **Near-black hangat `#131313`**                                   | Bukan biru-hitam, bukan `#000`.                                                                                                                                                                                   |

### N.2 Yang sengaja tidak diambil

| Tidak diambil                     | Alasan                                                                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Layout kartu tunggal di tengah    | Uniswap punya satu aksi. Publikasi **dipindai** — butuh grid dan hierarki tipografi. Menyalinnya akan membuat VERUM terlihat seperti aplikasi kripto, bukan sumber tulisan teknis yang dipercaya (§4). |
| `backdrop-filter` / glassmorphism | Ia me-repaint area di belakangnya **setiap frame scroll** dan melunakkan teks. Dua hal yang paling ditolak anggaran INP dan LCP di §12.5. Masthead sticky dibuat opak.                                 |
| Magenta `#ff37c7` di latar terang | Kontrasnya sekitar **2,5:1** pada putih — gagal WCAG untuk teks. Tema terang memakai `#b3008a` (hue yang sama, lebih dalam); yang terang tetap dipakai di tema gelap, tempatnya memang di sana.        |
| Web font                          | Basel milik mereka, dan font apa pun yang diunduh adalah satu request di depan LCP. Efek "besar tapi ringan" itu sebagian besar soal ukuran, weight, dan line-height — bukan typeface-nya.             |

### N.3 Dua masalah nyata yang ketahuan saat melihat hasilnya

**Slot iklan mendarat sebelum satu paragraf pun.** Terlihat jelas di screenshot: di bawah byline langsung kotak iklan besar, mendorong seluruh tulisan ke bawah lipatan. §13.1 menyebut "setelah paragraf pembuka" — jadi ini penyimpangan spesifikasi yang saya buat sendiri di Fase 5.

Perbaikannya `splitAfterOpening()`: memotong `body_html` setelah `</p>` pertama, tapi hanya kalau ada cukup prosa di **kedua** sisi (240 karakter). Artikel pendek tidak dapat slot tengah sama sekali — lebih baik daripada iklan terjepit di antara dua kalimat. Empat test menjaganya, termasuk kasus paragraf pembuka yang sangat pendek (dilewati, bukan dipotong di situ).

**Masthead sticky memakan 18% viewport di ponsel.** Di lebar 375px, bar-nya membungkus jadi dua baris (~140px). Menyematkan itu sepanjang sesi lebih merugikan daripada kehilangan pintasan ke atas. Di bawah 40rem masthead jadi `position: static`, dan nav pindah ke baris sendiri.

### N.4 CLS turun dari 0,0014 ke 0

Perombakan ini sempat memperkenalkan pergeseran kecil: theme toggle dan tombol salin tautan disembunyikan dengan `display: none` lalu muncul saat `html.js` dipasang — dan kemunculannya **mengubah ukuran masthead**.

Sekarang keduanya `visibility: hidden`, jadi kotaknya sudah terpesan sebelum script berjalan. Playwright tetap menganggapnya tersembunyi, jadi jaminan "kontrol mati tidak pernah ditawarkan" (§J.4) utuh, dan CLS kembali **tepat 0**.

### N.5 Body tetap sans

Sebelumnya prosa artikel memakai serif. Sekarang sans, konsisten dengan referensi dan dengan cara audiens ini membaca dokumentasi sepanjang hari. Kalau nanti Anda lebih suka serif untuk bacaan panjang, itu satu token: setel `--font-body` pada `.prose` di halaman artikel.

### N.6 Yang tidak berubah

135 test unit dan 66 e2e tetap hijau, termasuk yang menjaga janji-janji Fase 5:

- Semua halaman tetap render dengan JavaScript mati.
- Tema tersimpan tetap terpasang sebelum paint (`rgb(19,19,19)` sekarang, bukan `rgb(16,16,18)` — asersinya diperbarui).
- CLS **0** dengan placeholder iklan aktif.
- Viewport 360px tidak pernah scroll ke samping.

---

## Bagian O — Sistem form, palet biru, dan referensi svelte.dev

Diminta 10 September 2026: komponen form dipikirkan desainnya, palet pink → biru, light theme jangan putih banget, dark theme jangan terlalu gelap, referensi ganti ke svelte.dev.

### O.1 Palet: biru, dan kontras yang lebih rendah di kedua ujung

Token svelte.dev dibaca langsung dari situsnya. Yang paling berguna adalah **hubungan angkanya**, bukan warnanya:

|              | svelte.dev         | VERUM sekarang       | Sebelumnya       |
| ------------ | ------------------ | -------------------- | ---------------- |
| Dasar gelap  | `hsl(220 10% 12%)` | `hsl(220 13% 12%)`   | `#131313` (7,5%) |
| Teks gelap   | `hsl(220 2% 90%)`  | `hsl(220 8% 92%)`    | `#f4f4f6` (96%)  |
| Dasar terang | `#fff`             | `hsl(220 24% 97.5%)` | `#fbfbfd`        |

**Kontras maksimum bukan keterbacaan maksimum — itu silau.** Dark mode lama (7,5% dasar, 96% teks) adalah rasio hampir 18:1; sekarang sekitar 13:1, masih jauh di atas ambang AA 4,5:1 tapi tidak lagi menyala. Light mode tidak lagi `#fff`: halaman putih murni adalah benda paling terang di layar.

Semua netral dicampur dari satu hue (220), jadi terang dan gelap terasa satu keluarga.

Aksen biru dipilih karena alasan yang Anda sebut, dan angkanya dijaga: `hsl(219 78% 44%)` di terang memberi **5,4:1** — lolos AA untuk tautan seukuran teks. Magenta Uniswap tidak pernah bisa: `#ff37c7` di putih hanya ~2,5:1.

Radius juga turun. svelte.dev memakai 0,4rem; skala sekarang 5/8/12/16 px, bukan 12/16/20/24. Rounding yang modest terbaca sebagai dokumen, bukan aplikasi.

### O.2 Kontrol form: gaya di elemen native, bukan hanya di komponen

`src/lib/styles/forms.css` menata `input`, `select`, `textarea`, `button`, checkbox, radio, switch, date/time, search, dan file input **pada elemen aslinya**. Konsekuensinya: `<input>` polos di mana pun sudah terlihat benar, dan komponen menyusun di atasnya, bukan menggantikannya.

Tiga aturan yang berlaku di semuanya:

- **Target minimal 2,25rem, dan 2,75rem pada perangkat sentuh** (`@media (pointer: coarse)`). Lebih kecil dari itu adalah target yang meleset.
- **Fokus selalu punya ring yang terlihat.** Tidak pernah `outline: none` sendirian — menghapus indikator fokus adalah cara paling umum sebuah form jadi tidak bisa dipakai lewat keyboard.
- **State tidak pernah warna saja.** Error membawa teks dan `aria-invalid`, disabled membawa cursor, checked membawa tanda centang.

Komponen yang dibuat:

| Komponen    | Kenapa ada                                                                                                                                                                                                                                                                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Field`     | Menyambungkan `for`/`id`, `aria-describedby`, dan `aria-invalid`. Ini mudah lupa per form dan mustahil terlihat hilang tanpa screen reader. Juga membawa counter karakter — dipakai untuk batas 60/155 di meta SEO (§12.2).                                                                                                                                                   |
| `Button`    | Merender `<button>` atau `<a>` dari props yang sama. Tautan yang terlihat seperti tombol harus tetap tautan: klik kanan, klik tengah, dan "buka di tab baru" semuanya rusak kalau navigasi diimplementasikan sebagai tombol dengan onclick. State loading mengganti **label**, bukan hanya menampilkan spinner — spinner sendirian tidak mengatakan apa pun ke screen reader. |
| `Switch`    | Untuk boolean yang labelnya berbunyi seperti keadaan ("Living article"), bukan seperti item yang dipilih.                                                                                                                                                                                                                                                                     |
| `FileInput` | Drop zone + preview gambar + ukuran file. `<input type="file">` aslinya **tetap** di DOM dan tetap yang menerima file — drop ditambahkan di atasnya, jadi jalur keyboard dan pengiriman form tidak berubah. Object URL di-revoke saat komponen dilepas.                                                                                                                       |

Admin juga akhirnya ikut token yang sama, jadi ia punya dark mode — sebelumnya warnanya hardcoded terang.

### O.3 Bug CSS yang ketahuan dari screenshot

Semua tombol varian dirender biru primer. Penyebabnya specificity: `button:not(.unstyled)` bernilai (0,2,1) sementara `.btn--secondary` hanya (0,1,0), jadi aturan dasar selalu menang.

Perbaikannya `:where()`: `button:where(:not(.unstyled))` menyumbang **nol** specificity, sehingga kelas varian menang seperti seharusnya. Ini kelas bug yang tidak terlihat di typecheck maupun test — hanya terlihat dengan mata.

### O.4 Temuan produksi: `ORIGIN` wajib, atau semua form 403

Saat mencoba login di build produksi, semua POST ditolak:

```
403 Cross-site POST form submissions are forbidden
```

`adapter-node` tidak tahu alamatnya sendiri kecuali diberi tahu, dan proteksi CSRF bawaan SvelteKit membandingkan header `Origin` dengan alamat itu. Tanpa `ORIGIN`, **login dan setiap form action di admin mengembalikan 403 di produksi** — sementara seluruh situs publik terlihat sehat sempurna.

`vite dev` dan `vite preview` tahu alamatnya sendiri, jadi ini **hanya muncul di build produksi** — dan smoke test tidak menangkapnya karena hanya melakukan GET.

Dua perbaikan:

1. `ORIGIN` masuk `.env.example` dengan penjelasan lengkap.
2. **Smoke test sekarang melakukan POST**, dan secara khusus melaporkan 403 sebagai "set ORIGIN". Suite yang seluruhnya GET tidak akan pernah melihat kegagalan ini.

### O.5 Celah Fase 7 yang tertutup

Halaman statis (About, Contact, Editorial Policy, Privacy, Terms) **tidak ada di sitemap**. Itu justru halaman yang dicari review AdSense (§14). Sekarang masuk, dengan anotasi `xhtml:link`, dan ada e2e yang memeriksa kelimanya.

---

## Bagian P — Paginasi daftar yang tumbuh

Diminta 10 September 2026: kalau daftar foto dan lainnya jadi banyak, pakai paginasi, infinite scroll, atau yang lain?

### P.1 Temuan: admin tidak punya paginasi sama sekali

Sebelum menjawab, saya periksa yang ada. Halaman publik yang penting (kategori, search) sudah berpaginasi. **Semua daftar admin tidak** — hanya dipotong diam-diam:

| Daftar               | Batas lama  | Akibat                                                                                                  |
| -------------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| Media                | 100 terbaru | Gambar ke-101 ada di storage tapi tidak bisa ditemukan **dan tidak bisa disisipkan** dari picker editor |
| Artikel              | 200         | Artikel lama hilang dari daftar                                                                         |
| Redirect             | 500         | Aturan lama tidak terlihat                                                                              |
| Halaman tag (publik) | 24          | Tag dengan artikel lebih banyak terpotong                                                               |

Itu bug, bukan keterbatasan: tidak ada pesan, tidak ada tanda bahwa ada yang lebih.

### P.2 Keputusan per konteks

| Konteks                                            | Pola                              | Alasan                                                                                                                                                                                                                                     |
| -------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Daftar publik** (kategori, tag, search)          | Paginasi dengan tautan            | Crawler mengikuti tautan. Infinite scroll menyembunyikan artikel di luar halaman pertama dari mesin pencari — langsung bertentangan dengan sasaran traffic organik §3. Halaman 1 tidak pernah membawa `?page=1`, jadi satu URL, bukan dua. |
| **Daftar kelola admin** (media, artikel, redirect) | Paginasi + pencarian              | Daftar kelola dinavigasi: tombol Back harus kembali ke posisi semula, halaman harus bisa ditautkan, ujungnya harus bisa dicapai. Ketiganya rusak di infinite scroll, dan seleksi massal rusak bersamanya.                                  |
| **Picker gambar di editor**                        | Pencarian + "Load more" eksplisit | Tugasnya menemukan _satu_ gambar, bukan menjelajah. Picker lama menerima 60 gambar terbaru secara inline — begitu library melewati itu, gambar lama tidak bisa disisipkan sama sekali.                                                     |

Infinite scroll otomatis tidak dipakai di mana pun.

### P.3 Offset, bukan keyset

Paginasi memakai `LIMIT/OFFSET`. Keyset cursor lebih cepat untuk halaman dalam karena Postgres tidak membuang baris, tapi ia mengorbankan kemampuan melompat ke halaman tertentu — justru yang dipakai di tampilan library.

Di skala VERUM (350 artikel di akhir tahun kedua, masing-masing 2–3 gambar), `OFFSET` membuang beberapa ratus baris dan itu gratis. Keyset baru sepadan di atas sekitar sepuluh ribu baris. Tidak dibangun sebelum ada alasannya.

Total memakai `count(*) OVER ()` dalam query yang sama. Untuk search publik keputusannya berbeda (§K.4) karena di sana `ts_headline` membuat window function mahal; di sini tidak ada yang mahal untuk dihindari.

### P.4 Halaman tag: `noindex` dinilai dari seluruh tag

Dengan paginasi, halaman 2 tag besar bisa berisi hanya beberapa kartu. Ambang `noindex` (< 3 artikel, §8.1) sekarang dihitung dari **total tag**, bukan dari halaman yang sedang ditampilkan — halaman 2 bukan konten tipis hanya karena memuat lebih sedikit kartu.

### P.5 Yang dibuktikan

173 test unit (naik dari 165), 78 e2e (naik dari 76). Test library dengan 130 gambar: total benar (bukan ukuran halaman), baris setelah batas 100 lama bisa dijangkau, halaman tidak tumpang tindih dan tidak berlubang, urutan terbaru dulu, pencarian nama file dan alt dengan total yang mengikuti filter, input pencarian diperlakukan sebagai teks literal, ukuran halaman absurd dijepit ke 100. E2E: halaman media melaporkan total dan pencarian mengosongkan hasil dengan pesan; picker editor memanggil endpoint pencarian seluruh library.

### P.6 Dua celah yang ditutup setelah ditinjau ulang

Setelah bagian di atas ditulis, peninjauan terhadap best practice menemukan dua hal yang belum proper untuk jangka panjang. Keduanya sudah diperbaiki.

**Sortir tanpa pemecah seri.** Semua query yang berpaginasi hanya diurutkan berdasarkan timestamp (`published_at`, `updated_at`, `created_at`). Dua baris dengan timestamp sama tidak punya urutan pasti di antara keduanya, jadi batas halaman offset bisa bergeser antar-request: satu baris muncul di dua halaman, yang lain tidak muncul sama sekali. Sekarang tujuh query itu diakhiri `id DESC` sebagai pemecah seri — search, daftar artikel admin, terbaru, kategori, tag, topik, dan artikel terkait.

**Picker memakai offset untuk "load more".** Paginasi bernomor cocok dengan offset; "load more" tidak. Kalau gambar diunggah di antara dua kali muat — dari tab lain, atau dari halaman media saat editor terbuka — setiap sisipan menggeser jendela satu baris, dan muat berikutnya mengulang gambar terakhir. Grid picker di-key berdasarkan `id`, dan Svelte **melempar error** pada key duplikat.

Picker sekarang memakai **cursor keyset**: `(created_at, id) < (cursor)`, dengan perbandingan baris supaya timestamp yang sama jatuh ke `id` alih-alih hilang atau terulang. Halaman Media tetap offset, sengaja — ia melompat ke nomor halaman, yang tidak bisa dilakukan cursor, dan jendela yang bergeser di sana hanya pengulangan kosmetik, bukan error.

Satu detail yang mudah salah: **timestamp di cursor dikirim sebagai teks Postgres, bukan `Date` JavaScript.** `created_at` punya presisi mikrodetik, `Date` hanya milidetik. Cursor yang dibulatkan ke milidetik membuat `(created_at, id) < cursor` diam-diam melompati setiap baris yang dibuat belakangan dalam milidetik yang sama. Ada test yang menyisipkan 30 baris berbeda mikrodetik dalam satu milidetik dan menuntut ketiga puluhnya terbaca.

Cursor yang tidak valid **ditolak dengan 400**, bukan diabaikan: memulai ulang dari atas diam-diam akan memberi picker halaman pertama lagi dan mengulang semua gambar yang sudah dimilikinya.

182 test unit (naik dari 173), termasuk: menjelajah 130 gambar lewat cursor tanpa ulang, tidak ada pengulangan saat gambar baru diunggah di antara dua kali muat, 50 baris dengan timestamp identik terbagi tanpa hilang, dan offset tetap deterministik pada timestamp identik.

## Bagian Q — Toast, dialog konfirmasi, dan sidebar yang simetris

### Q.1 Sidebar: satu kotak 2.25rem untuk semua baris

Penyebab sidebar tidak sejajar saat dilipat: setiap kontrol punya ukuran sendiri. Nav memakai huruf pertama sebagai "ikon" (Dashboard dan Dev inbox sama-sama "D"), brand memakai `font-size: 0`, tombol toggle 1.875rem, dan tombol keluar memakai `btn--sm` dengan padding sendiri.

Sekarang geometrinya satu aturan: rail terlipat 3.75rem, padding samping 0.75rem, sisa **tepat satu kotak 2.25rem**. Brand, toggle, setiap link nav, dan tombol keluar dibangun di atas kotak itu dengan inset dalam yang sama (`(2.25rem − ikon 18px) / 2`). Ikon memakai `@lucide/svelte`.

Hasil yang diukur di browser, bukan dikira-kira: pusat horizontal setiap ikon **30px, baik saat terbuka maupun terlipat** — ikon tidak bergeser saat rail dilipat.

Label disembunyikan secara visual (`clip-path`), bukan `display: none`: link yang terlipat tetap punya nama untuk screen reader dan untuk query role di e2e. Aturan lipat hanya berlaku di atas 60rem; di layar kecil sidebar tetap bar horizontal.

### Q.2 Toast: satu konvensi untuk setiap aksi

| Jenis aksi                                                                             | Sukses                            | Gagal                                                                                  |
| -------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| superforms (artikel, kategori, tag, redirect)                                          | `message(form, …)` → toast sukses | `message(…, {status: 400})` → toast error; tanpa pesan → "Some fields need attention." |
| `use:enhance` biasa (media, topik, hapus)                                              | action mengembalikan `{ toast }`  | `fail(status, { error })`                                                              |
| Aksi yang me-redirect (buat artikel, hapus artikel, tambah locale, buat topik, keluar) | **flash cookie**                  | —                                                                                      |

Error field tetap tampil di bawah field-nya — toast memberi tahu _bahwa_ gagal, field memberi tahu _di mana_. Error login juga tetap inline: pesan rate limit harus masih terlihat saat orang menoleh ke form.

**Flash cookie** diperlukan karena hasil action hilang saat redirect: halaman berikutnya dirender dari load baru. Pesan ditulis ke cookie `verum_flash` (path `/admin`, `httpOnly`, maxAge 60 detik), dibaca sekali oleh load berikutnya, dan langsung dihapus. Setiap flash punya id, jadi data layout yang dikirim ulang saat invalidasi tidak memunculkan toast yang sama dua kali. Cookie yang rusak atau tipe yang tidak dikenal diabaikan dan tetap dihapus.

Store toast berada di level modul — pola yang dilarang PRD §10.4 di server. Aman di sini hanya karena setiap penulisan dijaga `browser`: salinan server tidak pernah ditulis. Komentar di file menandai ini.

Aksesibilitas: container toast adalah live region `polite` yang ada sejak render pertama (region yang disisipkan bersamaan dengan isinya sering tidak diumumkan). Toast error membawa `role="alert"`; error bertahan 8 detik, sukses 4 detik; maksimal 4 toast.

### Q.3 Dialog konfirmasi: `<dialog>` native

`window.confirm()` diganti `ConfirmButton` di: hapus artikel, hapus gambar, hapus tag, hapus redirect, dan keluar.

Dibangun di atas `<dialog>.showModal()`, bukan modal buatan sendiri: browser sudah mengurung fokus di dalamnya, membuat halaman di belakang inert, menutup dengan Escape, dan mengembalikan fokus ke tombol pemicu. Modal buatan sendiri harus mengimplementasikan keempatnya dan biasanya melewatkan satu.

Pemicunya tetap tombol `submit` sungguhan. Dengan JavaScript, klik membuka dialog dan tombol konfirmasi memanggil `form.requestSubmit(tombolAsli)` — sehingga `formaction` tetap terbawa (tombol hapus gambar berbagi form dengan simpan alt). Tanpa JavaScript, form langsung terkirim, sama seperti `confirm()` sebelumnya.

### Q.4 Celah form yang ikut ditemukan dari screenshot

- `forms.css` hanya menata `input[type='text']`. Input **tanpa atribut `type`** — yang secara spesifikasi adalah input teks — tampil sebagai kotak bawaan browser di halaman redirect, kategori & tag, dan topik. Sekarang `input:not([type])` ikut ditata.
- Selector `form { … }` yang scoped di halaman redirect juga mengenai form hapus di dalam setiap baris tabel, sehingga tombol Delete terdorong 2rem ke bawah. Diganti `.form-grid`; hal yang sama di halaman topik.
- Error field superforms berupa array dan dirender apa adanya: "Required,Must be a site-relative path…,A path cannot redirect to itself". Sekarang hanya pesan pertama, seperti yang sudah dilakukan komponen `Field`.
- Form yang **baru dibuka sudah penuh "Required"**: redirect, kategori, pengaturan artikel, dan editor locale memanggil `superValidate(dataAwal, adapter)` di `load`, dan superforms memvalidasi data itu seketika. Versi bahasa yang baru ditambahkan — kosong dengan sengaja (§7) — terbuka dengan setiap field ditandai salah. Keempatnya sekarang memakai `{ errors: false }`: error hanya muncul setelah simpan.
- Tombol lipat ikut tampil di layar kecil dan header mobile berantakan; sekarang baris brand, chip nav yang membungkus, lalu baris akun.

### Q.5 Yang dibuktikan

189 test unit (naik dari 182): flash terbaca sekali lalu hilang, pesan sama dua kali mendapat id berbeda, cookie ber-scope `/admin` dan `httpOnly`, cookie rusak diabaikan dan dihapus.

80 e2e (naik dari 78; ditambah assertion bahwa form yang baru dibuka tidak menampilkan error): keluar membuka dialog, Cancel mempertahankan sesi, konfirmasi keluar lalu toast "Signed out" muncul di halaman login; hapus redirect membuka dialog yang menyebut path-nya, Escape membatalkan, konfirmasi menghapus di tempat dengan toast; simpan yang gagal memunculkan toast error. Semua assertion `.notice` lama dipindah ke toast. Smoke build lulus.

## Bagian R — AI writer: riset, verifikasi sumber, dan draf

Diminta pemilik setelah Fase 7: agent AI yang membantu menulis artikel, dengan provider yang bisa dipilih (Claude, ChatGPT, Gemini, OpenRouter, dan endpoint lain), API key yang dimasukkan sendiri, dan pengecekan referensi di internet sebelum artikel dirangkai.

### R.1 Posisi terhadap PRD

- **§6.1 mengizinkan** AI untuk riset awal dan drafting. Yang **tidak** diserahkan: pemilihan topik dan sudut pandang (editor mengisi keduanya), klaim faktual tanpa verifikasi manusia (writer berhenti untuk review), penilaian dan opini (ditinggalkan sebagai catatan `[[EDITOR: …]]`), dan information gain (pertanyaan pertama quality gate).
- **§5.5** sekarang ditegakkan di kode untuk _semua_ artikel, bukan hanya draf AI (R.9).
- **§17** — batas mingguan dan alarm biaya bulanan ditegakkan sebelum job dibuat.
- **§7** — tidak ada tombol terjemahkan; versi `id` tetap ditulis sebagai job tersendiri.
- **§D.4 (skema beku)** — empat tabel baru lewat migration `0003_ai_writer`, alasannya tercatat di `schema/ai.ts`.

### R.2 Alur

```
editor: ide + angle + kategori + bahasa + model + (search | URL sendiri)
  → research: rencana query → search → unduh halaman → ekstrak teks
  → model: klaim + kutipan verbatim per sumber
  → KODE: cari setiap kutipan di teks halaman → status per klaim
  → model: outline dari klaim yang lolos
  → STOP: editor meninjau sumber, klaim, dan outline
  → draft: model menulis hanya dari klaim yang dicentang
  → KODE: [S1] → tautan ke halaman yang benar-benar dibaca, daftar Sumber, catatan editor
  → artikel berstatus draft → editor menulis bagiannya → quality gate → publish
```

### R.3 Provider model

| Pilihan                                  | Implementasi                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Claude                                   | **SDK resmi `@anthropic-ai/sdk`**, streaming + `finalMessage()` (draf panjang tidak kena timeout HTTP). `stop_reason: "refusal"` dicek sebelum membaca konten. Untuk `claude-opus-5` dan `claude-fable-5-1` dikirim `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`). Default model yang disarankan: `claude-opus-5`. |
| ChatGPT, OpenRouter, "OpenAI-compatible" | Satu adapter Chat Completions via `fetch`. Mencakup DeepSeek, Groq, Mistral, Together, Ollama/LM Studio lokal — cukup isi base URL. Tanpa `max_tokens`/`temperature` (model reasoning OpenAI menolak bentuk klasiknya); JSON mode hanya dikirim ke OpenAI sendiri, karena parameter asing = 400 di server yang ketat.                |
| Gemini                                   | API native `generateContent`, key lewat header `x-goog-api-key` (bukan `?key=` yang masuk log).                                                                                                                                                                                                                                      |

"opencode" adalah aplikasi agent untuk coding, bukan penyedia model; endpoint apa pun yang berbahasa Chat Completions masuk lewat opsi OpenAI-compatible.

**Balasan terstruktur dari provider mana pun:** tidak semua provider bisa dipaksa JSON, jadi kontraknya ditegakkan di sisi kita — parse longgar (fence, prosa di sekitar), validasi ketat dengan valibot, dan **satu** kesempatan memperbaiki dengan daftar kesalahannya.

"Load models" dan "Test" memakai endpoint daftar model: membuktikan key diterima tanpa menghabiskan token, dan memperingatkan kalau id model yang diisi tidak ada di daftar.

### R.4 Search sebagai provider terpisah

Brave Search API atau Tavily, opsional. Bukan fitur browsing bawaan model: hanya sebagian provider yang punya, hasilnya berbeda-beda, dan tidak bisa diperiksa ulang. Daftar URL biasa sama untuk semua model, dan halamannya diunduh server ini — di sanalah kutipan bisa diverifikasi. Tanpa search provider, writer hanya membaca URL dari editor, yang sering justru pilihan terbaik untuk berita dengan sumber primer yang jelas.

### R.5 Apa yang diverifikasi, dan apa yang tidak

Model wajib menyertakan kutipan verbatim + id sumber untuk setiap klaim. **Kode** (`verify.ts`) lalu mencari kutipan itu di teks halaman:

- Normalisasi dulu: NFKC, kutip lengkung, dash, spasi, karakter zero-width, huruf besar-kecil.
- Kutipan < 20 karakter ditolak — frasa sependek itu cocok di mana saja.
- Elipsis boleh, tapi potongannya harus muncul **berurutan** dan masing-masing ≥ 8 karakter, supaya kata dari dua paragraf tidak bisa dijahit menjadi kalimat yang tidak pernah ditulis.
- Angka di pernyataan yang tidak ada di kutipan terverifikasi mana pun → `mismatch`. Pemisah ribuan diabaikan karena "1.000" (id) = "1,000" (en).
- Id sumber yang tidak pernah dibaca job ini → tidak dipercaya.

| Status                | Arti                                          | Default dicentang |
| --------------------- | --------------------------------------------- | ----------------- |
| Confirmed             | kutipan ditemukan di ≥ 2 **penerbit** berbeda | ya                |
| Single source         | ditemukan, satu penerbit                      | ya                |
| Numbers not in quotes | kutipan ada, tapi angka di klaim tidak        | tidak             |
| Quote not found       | parafrase atau karangan                       | tidak             |

"Penerbit" = domain terdaftar: `news.detik.com` dan `finance.detik.com` dihitung satu. Ini aproksimasi kecil dari Public Suffix List (dua label terakhir, atau tiga di bawah `co.id`, `co.uk`, dll.) yang condong menggabungkan — kesalahannya hanya membuat klaim terlihat _kurang_ terkonfirmasi.

**Yang tidak dibuktikan, dan dikatakan di UI:** kutipan membuktikan _kata-kata itu ada di halaman itu_, bukan bahwa halamannya benar. Dua situs yang memuat rilis kantor berita yang sama tetap terhitung dua penerbit.

### R.6 Keamanan

- **API key** dienkripsi AES-256-GCM sebelum masuk database; kunci diturunkan dengan HKDF dari `AI_KEY_SECRET` (≥ 32 karakter), dengan AAD yang mengikat ciphertext ke kegunaannya. Ciphertext yang diubah atau secret yang salah **gagal keras**, tidak menghasilkan key sampah yang lalu dikirim ke provider. Halaman hanya menerima `…a1b2`; fungsi dekripsi satu-satunya tidak pernah dipanggil dari `load`. Pesan error provider disaring dari key sebelum masuk log job. E2E memeriksa HTML halaman tidak mengandung key setelah reload.
- **SSRF:** pengunduh halaman memakai guard yang sama dengan impor gambar, sekarang digeneralisasi menjadi `fetchPublic` (setiap redirect divalidasi ulang, batas byte, timeout). Untuk e2e ada `AI_UNSAFE_TEST_SOURCE_ORIGIN`: **satu origin persis**, tidak pernah diset di lingkungan nyata, tidak bisa melebar menjadi rentang.
- **Prompt injection dari halaman web:** teks halaman dipagari `<source>` dan setiap system prompt menyebutnya data, bukan instruksi. Itu mengurangi peluang; yang benar-benar membatasi adalah bahwa model **tidak punya aksi apa pun** selain mengembalikan teks, setiap fakta dicek kode terhadap halaman, dan tautan sitasi dibangun dari database — model hanya bisa menulis _id_, id yang tidak dikenal dibuang. Ada test yang memastikan teks "Ignore all previous instructions" dari halaman hanya muncul di dalam pagar.
- Tidak ada yang terbit otomatis.

### R.7 Pagar editorial

- **Batas mingguan** (default 5, §17) dihitung dari job yang dibuat 7 hari terakhir, dicek sebelum ada biaya.
- **Anggaran bulanan** opsional; butuh harga per 1M token yang diisi di provider (harga tiap provider berubah-ubah, jadi tidak di-hardcode). Biaya dan token tercatat per job.
- **Domain tepercaya** ditandai di daftar sumber; **domain diblokir** tidak pernah diunduh, termasuk subdomain dan redirect ke sana.

### R.8 Menjalankan job

Tanpa layanan antrean: satu editor, VPS 1 core, dan job sebagian besar menunggu provider. Antrean in-process, satu job sekaligus; **baris database adalah sumber kebenaran**. Restart saat riset → job ditandai gagal dengan pesan jelas (riset menulis baris sumber sambil jalan, menjalankannya ulang akan bentrok); job `queued`/`drafting` dilanjutkan. Cancel memakai `AbortController` sampai ke fetch dan panggilan model; artikel yang sempat dibuat saat job dibatalkan dihapus lagi. Halaman job memantau dengan polling 2,5 detik — tahan proxy dan reconnect tanpa kode tambahan.

Teks halaman disimpan di tabel `ai_job_sources`, bukan kolom JSON di job: halaman job di-polling, dan kolom yang tidak di-`select` adalah satu-satunya cara andal menjaga puluhan kilobyte teks tetap di server.

### R.9 Catatan editor dan quality gate

- Draf selalu berisi minimal satu `[[EDITOR: …]]` — kalau model tidak menaruhnya, kode menambah bagian "Penilaian kami"/"Our assessment". Catatan terlihat di preview.
- Editor menampilkan jumlah catatan secara live dan tautan ke laporan riset.
- **Artikel apa pun tidak bisa di-publish/schedule selama ada catatan di versi bahasa mana pun**, dan artikel yang sudah live tidak bisa disimpan dengan catatan baru.
- **Saat artikel pertama kali live**, empat pertanyaan §5.5 harus dicentang. Tidak disimpan — ini jeda, bukan catatan audit. Simpan ulang artikel yang sudah live tidak ditanya lagi.

### R.10 Bug lama yang ikut ditemukan

Pengecekan slug duplikat di form "New article", editor locale, dan topik memakai `error.message.includes('…_idx')`. Drizzle membungkus error driver: `message` luarnya "Failed query: …" berisi SQL, dan nama constraint hanya ada di `cause`. Pengecekan itu **tidak pernah cocok**, jadi slug duplikat berakhir 500, bukan pesan di form. Diganti `isUniqueViolation()` yang menelusuri `cause` (kode `23505` + nama constraint), dengan test yang memakai error asli dari Postgres.

### R.11 `db:demo` tidak lagi menghapus API key

`truncateAll` dipakai test dan `db:demo`. Test butuh tabel AI kosong; reload data demo tidak boleh menghapus key yang sudah diketik editor. Opsi `keepAiProviders` menyisakan `ai_credentials` dan `ai_settings`; job tetap hilang karena mereferensikan artikel.

### R.12 Keterbatasan yang diketahui

- Halaman yang butuh JavaScript atau berbayar → "too little readable text". PDF belum dibaca.
- Satu job bisa terhenti karena restart di tengah riset; tombol "Start again" membuat job baru dengan input yang sama.
- Estimasi biaya hanya seakurat harga yang diisi.
- Kualitas outline dan draf tetap tergantung model; verifikasi hanya menjamin faktanya berasal dari halaman yang dibaca.

### R.13 Yang dibuktikan

241 test unit/integrasi (naik dari 189), di antaranya:

- **Enkripsi key:** round-trip; ciphertext tidak memuat bagian key; IV berbeda setiap kali; ciphertext yang diubah dan secret yang salah ditolak; secret pendek ditolak.
- **Verifikasi kutipan:** kutip lengkung, baris baru, dan zero-width tetap cocok; parafrase dan kutipan pendek ditolak; elipsis hanya diterima kalau berurutan; dua subdomain satu penerbit bukan konfirmasi; angka karangan → `mismatch`; id sumber karangan tidak dipercaya.
- **Ekstraksi halaman:** navigasi, banner cookie, aside, skrip, dan teks tersembunyi dibuang; paragraf tidak menyatu; judul, penerbit, dan tanggal dari meta, JSON-LD, atau `<time>`; charset yang dideklarasikan dihormati; PDF ditolak dengan jelas.
- **Sitasi:** marker jadi tautan bernomor ke halaman yang dibaca; id tak dikenal dibuang tanpa bekas; judul ganda dihapus; daftar Sumber; hasilnya dirender lewat pipeline artikel asli dengan tautan yang berfungsi.
- **Pipeline penuh terhadap Postgres** dengan model, search, dan halaman palsu:
  - klaim dari dua penerbit → confirmed; kutipan karangan → tidak dicentang; balasan JSON rusak diperbaiki dalam satu percobaan ulang;
  - token dan biaya dihitung dari harga provider;
  - domain diblokir tidak pernah diunduh; paywall dan error dicatat alasannya;
  - teks halaman hanya ada di dalam pagar `<source>`;
  - error provider muncul sebagai pesannya sendiri; job yang dibatalkan tetap `cancelled`;
  - draf menjadi artikel `draft` dengan tautan hanya ke halaman yang dibaca, hanya dari klaim yang dicentang, slug bentrok dapat `-2`;
  - batas mingguan dan anggaran bulanan menolak job baru.
- **Slug duplikat** dikenali dari error Postgres asli, dan artikel yang setengah jadi ikut di-rollback.

86 e2e (naik dari 80), terhadap server mock yang berbicara Chat Completions dan menyajikan dua halaman berita:

- menambah provider OpenAI-compatible, memuat model, dan menguji koneksi;
- key tersimpan tampil sebagai `…abcd` dan tidak ada di HTML setelah reload;
- riset berhenti di review dengan status klaim yang benar;
- draf ditulis dengan tautan sitasi, daftar Sumber, catatan editor, dan tautan balik ke laporan riset;
- publish ditolak selama catatan editor ada, lalu ditolak lagi sampai empat pertanyaan quality gate dicentang;
- provider dihapus lewat dialog konfirmasi.

Test publish yang lama sekarang ikut mencentang quality gate.

### R.14 Provider bernama, Anthropic-compatible, dan Test yang tidak salah lapor

Ditambahkan setelah pemilik bertanya apakah provider hanya lima dan apakah ada Anthropic-compatible.

**Dropdown dikelompokkan, dengan base URL terisi otomatis:**

| Kelompok             | Pilihan                                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct               | Claude, ChatGPT, Gemini, OpenRouter                                                                                                             |
| OpenAI-compatible    | DeepSeek, Groq, Mistral, xAI (Grok), Kimi, Z.ai (GLM), MiniMax, Qwen (Model Studio), Together AI, Fireworks AI, Perplexity (Sonar), dan "Other" |
| Anthropic-compatible | DeepSeek, Kimi, Z.ai (GLM), MiniMax, dan "Other"                                                                                                |
| Local                | Ollama dan LM Studio, masing-masing lewat API OpenAI dan API Anthropic                                                                          |

Preset **bukan jenis provider baru**: yang disimpan tetap `kind` + base URL, dan preset dikenali ulang dari keduanya. Base URL diambil dari **dokumentasi resmi masing-masing provider pada 11 September 2026**, bukan dari ingatan — dua di antaranya ternyata berbeda dari yang umum beredar (DeepSeek OpenAI tanpa `/v1`; Together sekarang `api.together.ai`). Field tetap bisa diubah untuk region atau paket lain (Z.ai Coding Plan, region Model Studio). Test memeriksa setiap preset dikenali kembali dari data yang tersimpan.

**`anthropic_compatible`** — SDK resmi Anthropic dengan base URL lain; migration `0004` memperluas check constraint. Dua detail yang penting:

- Provider berbeda soal header: DeepSeek dan MiniMax mendokumentasikan `x-api-key`, Kimi, Z.ai, dan Model Studio memakai bearer token. Keduanya dikirim — key yang sama ke host yang sama.
- `fallbacks: "default"` hanya dikirim ke Anthropic sendiri, bahkan kalau nama modelnya kebetulan `claude-opus-5`; vendor lain akan menolak field itu. Diuji dengan fetch palsu yang merekam request SDK.

Endpoint lokal tanpa key diberi key pengganti karena SDK tidak mau mengirim tanpa key. Catatan di form: `localhost` hanya sampai ke mesin yang sama — di VPS, itu VPS-nya.

**Test tidak lagi bergantung pada `/models`.** Banyak endpoint compatible tidak punya daftar model (atau hanya sebagian). Urutannya sekarang:

1. Daftar model menyebut model yang dipakai → berhasil, tanpa token.
2. Daftar tidak ada (404/405/501), kosong, atau tidak menyebut model → satu permintaan chat 32 token ke model itu.
3. Key ditolak (401/403) → dilaporkan sebagai key ditolak, **tanpa** permintaan chat.
4. Balasan kosong dihitung berhasil: permintaan diterima, dan model thinking bisa menghabiskan 32 token untuk berpikir.

"Load models" pada endpoint tanpa daftar sekarang mengatakan itu dengan jelas dan menyuruh mengetik id model, bukan melaporkan error 404.

**Belum didukung:** Amazon Bedrock, Google Vertex AI, Azure OpenAI / Microsoft Foundry (autentikasi cloud, bukan satu API key). Endpoint Anthropic-compatible Qwen memakai URL per workspace, jadi hanya lewat "Other".

256 test unit (naik dari 241) dan 88 e2e (naik dari 86). E2E baru: DeepSeek mengisi base URL lalu hilang saat pindah ke Claude; endpoint tanpa daftar model lulus Test lewat permintaan satu kata; endpoint Anthropic-compatible memuat model dan lulus Test lewat SDK.

### R.15 Search provider tambahan: Serper, SerpApi, Exa, SearXNG

Diminta pemilik saat hendak menambahkan Serper dan pilihannya tidak ada.

| Provider | Request (dicek dari dokumentasi, 11 September 2026)                                                | Catatan                                                                                                                                                                                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Serper   | `POST https://google.serper.dev/search`, header `X-API-KEY`, body `{q, num}` → `organic[]`         | Hasil Google                                                                                                                                                                                                                                                      |
| SerpApi  | `GET https://serpapi.com/search.json?engine=google&q=…&api_key=…` → `organic_results[]`            | Key **wajib** di query string (tidak ada opsi header). Tidak ada pesan error yang mengulang URL request, dan form memperingatkan bahwa key bisa tercatat di log proxy. Hasil kosong dijawab 200 + `error` — dibaca sebagai daftar kosong, error lain tetap error. |
| Exa      | `POST https://api.exa.ai/search`, header `x-api-key`, body `{query, numResults}` → `results[]`     | Isi halaman tidak diminta: server ini membaca halamannya sendiri, jadi tidak perlu membayar dua kali.                                                                                                                                                             |
| SearXNG  | `GET {instance}/search?q=…&format=json` → `results[]` (`url`, `title`, `content`, `publishedDate`) | Self-hosted, tanpa key, butuh alamat instance. Format JSON harus diaktifkan di `search.formats`; 403 dijelaskan sebagai itu, bukan sebagai key ditolak.                                                                                                           |

Migration `0005` memperluas check constraint. Pipeline sekarang menerima search provider tanpa key, dan meneruskan base URL ke adapter.

265 test unit (naik dari 256): setiap adapter diuji bentuk request, header key, pemetaan hasil, batas jumlah hasil, dan penolakan sebelum request kalau key tidak ada; key yang ditolak tidak muncul di pesan error. 89 e2e (naik dari 88): SearXNG ditambahkan tanpa key ke instance tiruan dan lulus Test dengan dua hasil.

### R.16 Ganti model setelah gagal atau dibatalkan

Sebelumnya "Start again" membuat job baru dengan model dan search provider yang **sama** — tidak berguna kalau modelnya sendiri yang bermasalah (overload, kehabisan kredit, menolak permintaan). Sekarang:

- **Banner gagal/dibatalkan** memuat pilihan model dan web search, default ke yang dipakai job itu.
- **Back to review** — hanya kalau riset sudah sampai klaim. Job yang sama dikembalikan ke review dengan model yang dipilih; sumber, klaim, dan outline tetap, jadi tidak ada riset yang dibayar dua kali. Kasus paling umum: model gagal saat menulis draf.
- **Start again** — job baru dengan brief yang sama, **riset ulang**, memakai model dan search yang dipilih sekarang. Tetap dihitung ke batas mingguan. Draf tanpa URL sendiri ditolak kalau search dikosongkan.
- **Saat review**, model untuk outline dan draf bisa diganti langsung; perubahan dicatat di log job.

`reopenJob` mengubah status hanya dari `failed`/`cancelled` dan hanya kalau `claims` tidak kosong, dalam satu `UPDATE … WHERE` — tidak ada jendela di mana dua klik bisa membuka job yang sudah selesai. Job yang masih berhenti (task masih berjalan) ditolak dengan pesan untuk mencoba sebentar lagi.

268 test unit (naik dari 265): job yang gagal saat draf dibuka kembali dengan model lain, riset utuh, lalu draf selesai dan benar-benar memakai model baru; job tanpa klaim dan job yang sudah selesai tidak bisa dibuka kembali. 90 e2e (naik dari 89): model tiruan yang lulus riset tapi gagal saat draf → Start again dengan model lain sampai review → job yang gagal dibuka kembali, klaimnya tetap tiga, dan draf selesai dengan model lain.

### R.17 "The model returned an empty reply" setelah tepat lima menit — dan tiga perbaikan lain

Laporan pemilik: job berhenti lama setelah "Read 5 of 10 pages", lalu gagal dengan "The model returned an empty reply". Data job #4 (endpoint router OpenAI-compatible, model `stepfun-3.7-flash`):

- Jarak antara log terakhir dan error: **09:25:26 → 09:30:27, tepat ~300 detik.** Itu batas default HTTP client Node (undici) untuk respons yang tidak mengirim data selama 300 detik.
- Permintaan ekstraksi klaim dikirim **non-streaming**: satu JSON baru datang setelah seluruh jawaban selesai. Model lambat + input besar (lima halaman, ±41 ribu karakter) melewati lima menit.
- Adapter menelan kegagalan membaca body dengan `.catch(() => ({}))`, sehingga koneksi yang terputus dilaporkan sebagai "empty reply". Penyebab aslinya tersembunyi.

**Perbaikan:**

1. **Streaming** untuk adapter OpenAI-compatible dan Gemini (Claude sudah streaming lewat SDK). Data mengalir selama model menulis, termasuk token reasoning. Usage dibaca dari chunk terakhir (`stream_options.include_usage`); server yang menolak field itu diminta ulang tanpanya; server yang mengabaikan `stream: true` dan menjawab JSON tetap terbaca.
2. **Error yang jujur.** Koneksi putus → "The connection to _host_ broke after *N*s while the model was still answering." Jawaban kosong karena reasoning menghabiskan batas output → "(length): the model spent its whole output budget reasoning before it answered…". Jawaban yang terpotong tidak lagi diminta diulang apa adanya.
3. **Ekstraksi klaim dicoba sekali lagi dengan kutipan setengah panjang** kalau jawaban kosong, terpotong, atau koneksi putus. Key ditolak dan rate limit tidak dicoba ulang.
4. **Log sebelum langkah panjang** ("Extracting claims from 5 pages. The longest step: a few minutes is normal.", "Writing the outline…"), supaya layar tidak terlihat macet.

**Crash parser HTML.** Sumber Facebook di job yang sama gagal dengan "Cannot read properties of undefined (reading 'nodeName')". Direproduksi dari halaman aslinya: `hast-util-from-parse5` 8.0.3 membaca isi `<template>` tanpa memeriksa bahwa isinya ada, dan `<template>` di dalam `<svg>` tidak punya isi. Script (kecuali JSON-LD), style, template, SVG, dan noscript sekarang dibuang sebelum parsing — semuanya memang dibuang saat ekstraksi — dan halaman 955 KB itu terbaca dalam 42 ms. Kegagalan parser yang tersisa menjadi "This page could not be parsed as HTML." untuk sumber itu saja.

**Batas mingguan tidak lagi menghitung draf yang gagal atau dibatalkan.** Empat kegagalan provider (termasuk tiga rate limit/500 di provider lain) sudah menghabiskan batas lima draf tanpa satu artikel pun. Batasnya untuk membatasi output (PRD §17), bukan percobaan.

**Draf AI bisa dihapus**, dari daftar maupun halaman job, dengan dialog konfirmasi. Tidak bisa selama job berjalan (worker akan menulis ke baris yang sudah hilang). Artikel draf yang sempat dibuat tetap ada di Articles, dan dialog menyebutkannya.

282 test unit (naik dari 268): streaming yang terpotong di tengah event, reasoning yang menghabiskan batas, koneksi putus, fallback tanpa `stream_options`, server yang menjawab JSON, Gemini dengan thought parts; retry ekstraksi dengan kutipan lebih pendek dan tidak ada retry untuk key ditolak; draf gagal/dibatalkan tidak dihitung; hapus job beserta sumbernya tapi tidak saat berjalan; `<template>` di dalam `<svg>` dan JSON-LD tetap terbaca. 91 e2e (naik dari 90): server mock sekarang menjawab dengan streaming, dan draf gagal dihapus dari halamannya.

### R.18 Catatan editor untuk writer (DO / DON'T)

Form New draft punya kolom **Notes for the writer** (opsional, maks. 2.000 karakter): arahan editor tentang apa yang dilakukan dan dihindari — misalnya "DO: pernyataan resmi, nada netral / DON'T: menyebut nama anak, berspekulasi soal motif".

- Disimpan di kolom `ai_jobs.notes` (migration `0006`), ikut disalin saat "Start again", dan tetap ada saat job dibuka kembali.
- Dikirim di **setiap tahap** — rencana pencarian, ekstraksi klaim, outline, draf — sebagai bagian dari brief di pesan user, **bukan** di system prompt. Brief menyatakan bahwa notes diikuti kecuali kalau bertentangan dengan aturan fakta, sumber, dan kutipan: "tambahkan jumlah korban" tidak boleh menjadi angka yang tidak ada di sumber mana pun.
- Bisa diubah saat review; rebuild outline dan penulisan draf membaca job dari database, jadi memakai versi terbaru.
- Tampil di halaman job di bawah angle.

284 test unit (naik dari 282): notes muncul di keempat permintaan model dan tidak pernah di system prompt; brief tanpa notes tidak berubah. E2E alur riset mengisi notes dan memeriksa notes masih ada dan bisa diubah saat review (91 e2e).
