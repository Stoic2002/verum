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
