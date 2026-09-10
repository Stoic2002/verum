# Mengisi `.env` — dari mana nilainya

Setiap layanan di bawah punya **perilaku pengganti**, jadi tidak ada yang wajib
diisi untuk menjalankan project ini secara lokal. Isi saat Anda membutuhkan
fiturnya, bukan sebelumnya.

| Layanan          | Kosong berarti                                   | Baru perlu saat                   |
| ---------------- | ------------------------------------------------ | --------------------------------- |
| SMTP             | Email ditulis ke buffer, dibaca di `/admin/mail` | Newsletter diaktifkan (bulan 4–6) |
| Cloudflare R2    | Upload ke folder `.media/` lokal                 | Deploy produksi                   |
| Cloudflare purge | Purge dilewati                                   | Deploy produksi                   |
| Sentry           | Tidak ada pelacakan error                        | Kapan saja; gratis                |

---

## 1. SMTP — pengiriman email

Dipakai untuk **satu hal**: mengirim link konfirmasi double opt-in newsletter.

SMTP bukan nama perusahaan — itu protokol standar untuk mengirim email. Anda
butuh akun di penyedia yang menjalankan server SMTP.

### Kandidat

**Resend** — paling mudah dipasang, 3.000 email/bulan gratis.

1. Daftar di [resend.com](https://resend.com).
2. **Verifikasi domain dulu.** Tanpa domain terverifikasi, tidak ada email yang
   terkirim sama sekali. Anda akan diminta menambahkan beberapa record DNS —
   kalau domainnya di Cloudflare, itu di tab DNS.
3. Buat API key (dimulai dengan `re_`).

```
SMTP_HOST="smtp.resend.com"
SMTP_PORT="587"
SMTP_USER="resend"
SMTP_PASSWORD="re_xxxxxxxxxxxx"
MAIL_FROM="VERUM <hello@domain-anda.com>"
```

`SMTP_USER` benar-benar kata **`resend`** untuk semua akun — itu bukan
placeholder. Password-nya adalah API key, lengkap dengan awalan `re_`.

Port: 587 untuk TLS, atau 465 untuk SSL. Kode ini memilih mode SSL secara
otomatis ketika portnya 465.

**Alternatif:** [Postmark](https://postmarkapp.com) (deliverability terbaik,
berbayar), atau Gmail dengan App Password (bisa, tapi berbatas ketat dan bukan
untuk pengiriman massal).

`MAIL_FROM` domainnya harus milik Anda dan terverifikasi di penyedia. Mengirim
dari `@gmail.com` lewat penyedia lain akan masuk spam atau ditolak.

> Mengisi sebagian variabel SMTP adalah **error yang menggagalkan start**. Itu
> disengaja: form yang menerima alamat lalu diam-diam tidak pernah mengirim
> konfirmasi terlihat persis seperti form yang bekerja.

---

## 2. Cloudflare R2 — penyimpanan gambar

Anda sudah membuat akun R2. Yang tersisa:

### a. Buat bucket

R2 → **Create bucket**. Namanya bebas, misalnya `verum-media`. Lokasi biarkan
otomatis.

### b. Buat API token

R2 → di panel **Account details** kanan, klik **Manage** di sebelah _API
Tokens_ → **Create API token**.

- Permission: **Object Read & Write** sudah cukup. Jangan pakai _Admin Read &
  Write_ — aplikasi ini tidak perlu bisa membuat atau menghapus bucket.
- Scope: pilih **Specific buckets** dan pilih bucket tadi.

Hasilnya dua nilai:

- **Access Key ID** → `R2_ACCESS_KEY_ID`
- **Secret Access Key** → `R2_SECRET_ACCESS_KEY`

**Secret Access Key hanya ditampilkan sekali.** Kalau hilang, tokennya harus
dibuat ulang.

### c. Account ID

Ada di dashboard Cloudflare, halaman R2, panel kanan. Formatnya 32 karakter
heksadesimal. → `R2_ACCOUNT_ID`

### d. URL publik

Bucket R2 **privat secara default** — kalau tidak diatur, gambar tidak bisa
dilihat siapa pun.

Buka bucket → **Settings** → _Public access_. Dua pilihan:

- **Custom domain** — hubungkan subdomain, misalnya `img.domain-anda.com`.
  **Ini yang dipakai untuk produksi.** Domainnya harus ada di Cloudflare.
- **r2.dev subdomain** — cepat untuk mencoba, tapi Cloudflare membatasi
  lajunya dan menyatakan ia tidak untuk produksi.

```
R2_ACCOUNT_ID="a1b2c3..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET="verum-media"
R2_PUBLIC_URL="https://img.domain-anda.com"
```

`R2_PUBLIC_URL` tanpa slash di akhir. Kode ini menyambungnya langsung dengan
key objek.

### Menguji

Isi kelimanya, jalankan `bun run dev`, buka `/admin/media`, dan unggah satu
gambar. Halaman itu menampilkan driver yang sedang aktif — kalau tertulis
`fs`, berarti ada variabel yang belum terisi.

> Mengisi **sebagian** variabel R2 juga error yang menggagalkan start. Deploy
> yang kurang satu variabel akan menulis upload ke disk container dan
> kehilangan semuanya saat restart berikutnya.

---

## 3. CDN cache — bagaimana cara kerjanya

Tiga bagian yang harus semuanya ada. Dua sudah di kode, satu di dashboard.

### a. Origin memberi tahu berapa lama (sudah ada di kode)

Setiap halaman mengirim `Cache-Control` sendiri, karena tiap halaman berbeda:

| Halaman                | `s-maxage`                        | Alasan                           |
| ---------------------- | --------------------------------- | -------------------------------- |
| Artikel terbit         | 24 jam + `stale-while-revalidate` | Jarang berubah                   |
| Homepage, kategori     | 60 detik                          | Berubah tiap ada yang terbit     |
| Topik                  | 5 menit                           |                                  |
| Sitemap, RSS           | 1 jam                             |                                  |
| Search, admin, preview | `no-store`                        | Tidak boleh di-cache sama sekali |

`s-maxage` khusus untuk cache bersama seperti CDN; browser pembaca memakai
`max-age` yang nol. Jadi Cloudflare menyimpan, browser tidak.

### b. Cloudflare harus disuruh meng-cache HTML (belum, di dashboard)

**Cloudflare tidak meng-cache HTML secara default.** Ini bagian yang paling
mudah terlewat: tanpa aturan eksplisit, setiap kunjungan artikel tetap sampai
ke VPS dan seluruh tabel di atas tidak berpengaruh sama sekali.

Langkah lengkapnya ada di [`CLOUDFLARE.md`](./CLOUDFLARE.md) bagian 1. Intinya
satu Cache Rule dengan **Edge TTL: use cache-control header if present** —
supaya angka per-halaman di atas yang dipakai, bukan satu angka tetap.

### c. Purge saat Anda menyunting (sudah ada di kode)

Artikel di-cache 24 jam. Kalau Anda memperbaiki kesalahan, salinan lama harus
dibuang paksa — kalau tidak, perbaikan Anda baru terlihat pembaca besok.

Menyimpan atau menerbitkan artikel memanggil API purge Cloudflare untuk URL
artikel itu **dan semua halaman yang memuat judulnya** — kategori, homepage,
feed, sitemap. Slug yang diganti juga mem-purge URL lamanya.

Butuh dua nilai:

- **Zone ID** — dashboard Cloudflare → halaman domain → panel kanan bawah
- **API token** — My Profile → API Tokens → Create Custom Token, izin
  **Zone → Cache Purge → Purge**, dibatasi ke zone domain Anda

```
CLOUDFLARE_ZONE_ID="..."
CLOUDFLARE_API_TOKEN="..."
```

Kosong = purge dilewati diam-diam. Aman untuk lokal.

### Memeriksa apakah bekerja

```bash
curl -sI https://domain-anda.com/en/ai/slug | grep -i cf-cache-status
```

Kunjungan pertama `MISS`, kedua `HIT`. `/admin/login` harus tidak pernah `HIT`.

---

## 4. Sentry — pelacak error

Saat sebuah halaman gagal untuk pembaca jam 3 pagi, Sentry menangkap error-nya
lengkap dengan baris kode penyebabnya dan mengirimi Anda notifikasi. Tanpa itu
Anda baru tahu kalau ada yang memberi tahu.

1. Daftar di [sentry.io](https://sentry.io) — free tier cukup jauh untuk skala
   ini.
2. **Create Project** → pilih platform **SvelteKit**.
3. Salin **DSN**-nya. Bentuknya seperti
   `https://abc123@o456.ingest.sentry.io/789`.

```
PUBLIC_SENTRY_DSN="https://...@....ingest.sentry.io/..."
SENTRY_DSN="https://...@....ingest.sentry.io/..."
```

Nilainya sama. Dua variabel karena error terjadi di dua tempat: di server dan
di browser pembaca. Yang berawalan `PUBLIC_` ikut terkirim ke browser — itu
memang seharusnya, dan DSN bukan rahasia. Ia hanya alamat tujuan laporan;
siapa pun yang membuka halaman Anda bisa melihatnya.

> **Belum tersambung.** Variabelnya sudah disiapkan, tapi SDK Sentry belum
> dipasang di kode — itu pekerjaan Fase 8. Mengisinya sekarang tidak
> menimbulkan efek apa pun.

---

## Ringkasan urutan pengerjaan

Kalau tujuannya menjalankan lokal saja: **tidak perlu satu pun**.

Kalau tujuannya menuju produksi, urutan yang masuk akal:

1. Beli domain, arahkan ke Cloudflare
2. R2 (bucket → token → custom domain) — supaya gambar punya rumah tetap
3. Cache Rule + purge token — supaya situsnya cepat
4. Sentry — supaya Anda tahu kalau ada yang rusak
5. SMTP — terakhir, bersamaan dengan mengaktifkan newsletter
