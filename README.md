# VERUM

Publikasi digital tentang AI dan teknologi. SvelteKit + PostgreSQL, SSR wajib.

- Spesifikasi produk: [`PRD-VERUM-v1.md`](./PRD-VERUM-v1.md)
- Rencana development: [`docs/PLAN-DEV.md`](./docs/PLAN-DEV.md)

## Prasyarat

|            | Versi                    | Catatan                                                                                                  |
| ---------- | ------------------------ | -------------------------------------------------------------------------------------------------------- |
| Bun        | ≥ 1.4                    | Package manager + script runner                                                                          |
| Node       | ≥ 22.12 (lihat `.nvmrc`) | Runtime produksi — `adapter-node` menargetkan Node, dan `sharp` + `@node-rs/argon2` adalah native module |
| PostgreSQL | 16                       | `brew install postgresql@16 && brew services start postgresql@16`                                        |

Bun dipakai untuk toolchain, Node untuk menjalankan hasil build. Jangan tukar keduanya
tanpa menguji native module lebih dulu.

## Mulai

```bash
bun install
bun run db:setup      # membuat role + database verum & verum_test
cp .env.example .env  # isi yang masih kosong
bun run dev
```

Buka http://localhost:5173 — akan diarahkan ke `/en`.

Tanpa PostgreSQL lokal, `bun run db:docker` menjalankan Postgres 16 di container
(butuh Docker) dengan kredensial yang sama.

## Perintah

| Perintah                                           | Fungsi                                                       |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `bun run dev`                                      | Dev server                                                   |
| `bun run build` / `bun run preview`                | Build produksi & pratinjau                                   |
| `bun run start`                                    | Menjalankan hasil build dengan Node                          |
| `bun run check`                                    | Typecheck (`svelte-check`)                                   |
| `bun run lint` / `bun run format`                  | Prettier + ESLint                                            |
| `bun run test:unit`                                | Vitest                                                       |
| `bun run test:e2e`                                 | Playwright (jalankan `bun run test:e2e:install` sekali dulu) |
| `bun run db:setup`                                 | Buat database lokal                                          |
| `bun run db:generate` / `db:migrate` / `db:studio` | Drizzle                                                      |

## Keputusan yang sudah mengikat

**URL dan locale.** Setiap URL publik membawa prefix locale-nya: `/en/ai/slug`,
`/id/ai/slug` (PRD §12.1). Path tanpa prefix di-301 ke `/en`. Tanpa trailing slash —
satu bentuk kanonik, satu redirect.

Locale ditentukan **hanya** oleh URL (`strategy: ['url']`). Tidak ada deteksi
cookie, `Accept-Language`, atau IP: memaksa pengunjung ke locale tertentu membuat
Googlebot — yang merayapi dari US — tidak pernah mengindeks locale lain (PRD §10.4).
Saran ganti bahasa nanti berupa banner, bukan redirect.

Locale dibaca dari `event.locals.locale`, tidak pernah dari store module-scope.
Di server sebuah modul dievaluasi sekali per proses, jadi store akan membocorkan
locale satu request ke request lain yang sedang menunggu `await` — dan itu tidak
akan pernah muncul di dev, tempat hanya ada satu request. `e2e/locale.e2e.ts`
menjaga ini.

**Konfigurasi Paraglide ada di `vite.config.ts`.** Script `paraglide:compile` hanya
menghasilkan tipe agar `svelte-check` bisa jalan tanpa build; `urlPatterns` tidak
bisa dikirim lewat CLI. Compile yang otoritatif selalu lewat Vite.

**Admin ada di `/admin`, tanpa prefix locale.** Login satu user, argon2id,
session cookie. Cookie membawa token; database menyimpan SHA-256-nya, sehingga
sebuah dump tidak berisi session yang bisa dipakai. Rate limit login bersifat
in-memory — benar untuk satu proses Node, dan harus pindah ke Postgres atau
Redis kalau nanti berjalan lebih dari satu instance (`docs/PLAN-DEV.md` §G.2).

**Di produksi, `ADDRESS_HEADER` wajib diisi.** Di balik Caddy + Cloudflare,
tanpa itu semua request terlihat berasal dari satu IP dan rate limit login akan
memblokir semua orang sekaligus. Lihat `.env.example`.

**Markdown dirender sekali, saat simpan.** Pipeline runtime remark/rehype ada di
`src/lib/server/content/render.ts` dan hasilnya masuk ke `body_html`. Preview di
editor memakai endpoint server dengan pipeline yang sama — bukan renderer
klien, supaya preview tidak pernah berbeda dari hasil terbit.

**Sanitasi berjalan setelah `rehype-raw` dan sebelum ekspansi embed.** Skema
sanitasi sengaja tidak mengizinkan `<iframe>`: `::youtube{id=…}` bekerja karena
jalur itu hanya bisa menghasilkan ID yang sudah divalidasi, sementara `<iframe>`
yang ditempel penulis tetap dibuang. Jangan ubah urutan plugin tanpa membaca
`docs/PLAN-DEV.md` §H.1.

**Mengganti slug menulis 301 secara otomatis**, dalam transaksi yang sama, dan
memindahkan redirect lama agar tidak terbentuk rantai.

**Skema database beku.** 15 tabel, migrasi di `drizzle/`. Perubahan hanya lewat
migrasi baru dengan alasan tertulis (`docs/PLAN-DEV.md` §D.4). Yang berbeda dari
PRD §11 dan alasannya ada di §F.1.

**Publikasi digerakkan query, bukan job.** Sebuah artikel hidup ketika
`status = 'published'` dan `published_at` sudah lewat — definisinya ada satu
tempat, di `isLive` (`src/lib/server/db/queries/shared.ts`). Tidak ada worker
yang bisa gagal atau lupa dijalankan. Cron nanti hanya untuk purge cache CDN dan
regenerasi sitemap.

**Search vector diisi trigger, bukan generated column.** Ekspresi generated
column wajib `IMMUTABLE`, sementara config text search harus dipilih dari
`locale` baris itu — `english` dan `indonesian` menstem sangat berbeda, dan satu
config bersama merusak keduanya.
