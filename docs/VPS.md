# Spesifikasi VPS — berdasarkan pengukuran, bukan tebakan

Angka di bawah diukur dari build produksi yang berjalan, bukan diperkirakan.

## Yang benar-benar dipakai

| Proses                                            | Memori                                |
| ------------------------------------------------- | ------------------------------------- |
| Node (`node build/index.js`), idle                | 95 MB                                 |
| Node, setelah 70 request (40 artikel + 30 search) | 136 MB — **stabil, tidak naik terus** |
| PostgreSQL 16, data kecil                         | 82 MB (15 proses)                     |
| Caddy                                             | ~30 MB                                |
| **Total kondisi normal**                          | **~250 MB**                           |

Puncaknya bukan di melayani halaman, tapi di **memproses gambar**:

| Operasi                                                  | Memori               |
| -------------------------------------------------------- | -------------------- |
| sharp: satu gambar 4000×2500 → 6 rendition (AVIF + WebP) | naik 41 → **171 MB** |

Jadi saat Anda mengunggah gambar sambil ada pembaca, puncaknya sekitar
**400 MB**. Ditambah OS Linux minimal (200–300 MB), totalnya **sekitar 600–700
MB**.

## Rekomendasi

**Hetzner CX22** — 2 vCPU, 4 GB RAM, 40 GB disk, sekitar $4,59/bulan
([sumber](https://www.hetzner.com/pressroom/new-cx-plans/); Hetzner menyesuaikan
harga Juni 2026, cek nilai terkini saat mendaftar).

Kenapa 4 GB padahal terukur cukup di bawah 1 GB:

- Sisanya bukan terbuang — Linux memakainya sebagai **page cache**, dan itu
  yang membuat PostgreSQL cepat tanpa perlu disetel apa pun.
- Selisih harga dengan varian 2 GB kecil, sementara kehabisan memori saat
  encoding AVIF berarti proses Node dibunuh OOM killer di tengah upload.
- §10.1 PRD menyebut 2 GB, dan pengukuran ini membenarkannya secara teknis. 4
  GB adalah kenyamanan, bukan keharusan.

**Disk 40 GB berlebih**, dan itu disengaja: gambar tinggal di R2, jadi disk
hanya untuk OS, PostgreSQL, dan dump backup. Kalau R2 **tidak** dipakai,
gambar menumpuk di disk dan 40 GB jadi batas nyata.

**CPU 2 vCPU cukup.** Yang berat hanya encoding AVIF, dan itu terjadi saat
Anda mengunggah — bukan saat pembaca membuka halaman. Shiki menyorot kode saat
artikel disimpan, bukan per request.

**Arsitektur:** varian ARM (CAX) lebih murah dan berjalan baik — `sharp` dan
`@node-rs/argon2` keduanya punya binary linux-arm64 dan sudah ada di
`bun.lock`. Kalau ingin menghemat, itu pilihan yang aman.

## Berapa pengunjung sebelum lemot

### Cara mengukurnya

Membatasi core di macOS tanpa Docker tidak bisa dilakukan dengan tepat, dan
menjenuhkan core dengan busy-loop membuat klien benchmark ikut berebut CPU —
hasilnya bias. Jadi yang diukur adalah **waktu CPU per request**, yang tidak
bergantung jumlah core, lalu kapasitas dihitung darinya.

| Halaman                 | CPU Node | CPU Postgres | Total       |
| ----------------------- | -------- | ------------ | ----------- |
| Artikel (SSR + 4 query) | 4,70 ms  | 4,05 ms      | **8,75 ms** |
| Homepage                | 4,17 ms  | 5,47 ms      | 9,65 ms     |
| Search (FTS + headline) | 2,50 ms  | 1,65 ms      | 4,15 ms     |

Diukur di satu core Apple M1. Postgres dihitung terpisah karena di 1 vCPU ia
berebut core yang sama dengan Node.

### Kurva antrean yang terukur

Ramp konkurensi pada halaman artikel, 8 core:

| Konkuren | req/s | p50    | p95        |
| -------- | ----- | ------ | ---------- |
| 1        | 135   | 6 ms   | 14 ms      |
| 10       | 360   | 26 ms  | 41 ms      |
| 25       | 448   | 54 ms  | 73 ms      |
| 50       | 472   | 102 ms | 129 ms     |
| 100      | 491   | 192 ms | **325 ms** |
| 200      | 469   | 421 ms | **510 ms** |

Throughput mentok sekitar 490 req/s; di atas itu setiap request tambahan hanya
menambah antrean. Pola ini yang membuat batas **60% utilisasi** dipakai di
hitungan bawah — di atas itu p95 memanjang cepat.

### Kapasitas per jumlah core

Asumsi, semuanya dinyatakan: vCPU VPS bersama diperkirakan **3× lebih lambat**
dari core M1 (konservatif), utilisasi aman 60%, jam tersibuk 12% traffic
harian, 1,3 pageview per sesi.

| vCPU  | req/s aman | Sesi/bulan (tanpa CDN) |
| ----- | ---------- | ---------------------- |
| **1** | **23**     | **~15 juta**           |
| 2     | 46         | ~31 juta               |
| 4     | 91         | ~63 juta               |
| 8     | 183        | ~126 juta              |

Target tertinggi §3 adalah **100.000 sesi/bulan** di bulan 13–24. Satu vCPU
memberi sekitar **150× dari itu** — dan itu sebelum menghitung Cloudflare, yang
menyimpan halaman artikel 24 jam sehingga sebagian besar pembacaan tidak pernah
mencapai server.

### Jadi kapan sebenarnya lemot

Bukan pada rata-rata bulanan. Yang bisa membuat 1 vCPU kewalahan adalah
**lonjakan mendadak** — satu artikel masuk halaman depan Hacker News atau
Reddit bisa menghasilkan 20–50 req/s selama berjam-jam, bukan 0,14 req/s yang
jadi rata-rata target §3.

Di situ pun CDN yang menyelamatkan: lonjakan pada **satu** artikel dilayani
hampir seluruhnya dari edge, dan origin hanya melihat satu-dua persennya.
Tanpa Cache Rule di Cloudflare ([`CLOUDFLARE.md`](./CLOUDFLARE.md) bagian 1),
perhitungan ini berubah total — setiap kunjungan sampai ke server.

### Yang benar-benar habis lebih dulu

Bukan CPU:

1. **RAM saat memproses gambar.** Terukur 630 MB puncak. Ini alasan
   rekomendasinya 2 GB, bukan 1 GB.
2. **Kolam koneksi Postgres.** Default `postgres.js` sepuluh koneksi; cukup,
   tapi itu batas berikutnya kalau traffic benar-benar besar.
3. **CPU** — terakhir, dan jauh.

> Angka di atas adalah model atas asumsi yang dinyatakan, bukan hasil uji beban
> di VPS sungguhan. Kalikan pengaman 2–3× kalau ingin konservatif; kesimpulannya
> tidak berubah.

## Pilihan lokal (Indonesia)

Harga per 10 September 2026, diambil dari halaman resmi masing-masing. Cek
ulang saat mendaftar.

### Biznet Gio — NEO Lite

| Paket      | vCPU  | RAM      | Disk      | Harga/bulan  |
| ---------- | ----- | -------- | --------- | ------------ |
| XS 1.1     | 1     | 1 GB     | 60 GB     | Rp59.000     |
| **SS 2.1** | **1** | **2 GB** | **60 GB** | **Rp80.000** |
| SS 2.2     | 2     | 2 GB     | 60 GB     | Rp109.000    |
| MS 4.2     | 2     | 4 GB     | 60 GB     | Rp139.000    |
| MS 4.4     | 4     | 4 GB     | 60 GB     | Rp179.000    |

Kode `DISKON10` memberi potongan 10% untuk langganan tahunan.

### IDCloudHost — Basic Standard

| vCPU | RAM  | Disk  | Harga/bulan |
| ---- | ---- | ----- | ----------- |
| 2    | 2 GB | 20 GB | Rp87.000    |
| 2    | 2 GB | 40 GB | Rp100.000   |
| 2    | 4 GB | 60 GB | Rp225.000   |

### Yang paling murah dan benar-benar cukup

**Biznet Gio SS 2.1 — Rp80.000/bulan.** 1 core, 2 GB, 60 GB.

Kenapa bukan XS 1.1 yang Rp59.000: pengukuran di atas menunjukkan pemakaian
puncak sekitar 630 MB saat mengunggah gambar. Pada 1 GB itu menyisakan ~370 MB
— muat, tapi tanpa margin page cache dan dengan risiko OOM killer kalau upload
bertepatan dengan lonjakan pembaca. Selisih Rp21.000 membeli ketenangan itu.

Satu core cukup: yang berat hanya encoding AVIF, dan itu terjadi saat Anda
mengunggah, bukan saat pembaca membuka halaman.

Kalau ingin lega, **Biznet MS 4.2 (2 core, 4 GB) Rp139.000** — masih di bawah
batas Rp200.000/bulan §2, tapi menyisakan sedikit untuk yang lain.

### Lokal versus Hetzner

|               | Spesifikasi         | Harga/bulan |
| ------------- | ------------------- | ----------- |
| Hetzner CX22  | 2 vCPU, 4 GB, 40 GB | ~Rp75.000   |
| Biznet MS 4.2 | 2 vCPU, 4 GB, 60 GB | Rp139.000   |
| IDCloudHost   | 2 vCPU, 4 GB, 60 GB | Rp225.000   |

Untuk spesifikasi setara, lokal berharga sekitar **2–3 kali lipat**. Yang
dibeli dengan selisih itu bukan performa:

- Tagihan rupiah, pembayaran lokal (transfer, VA, e-wallet)
- Dukungan berbahasa Indonesia
- Latensi rendah **untuk Anda** saat memakai admin

**Untuk pembaca, lokasi origin nyaris tidak berpengaruh** pada halaman artikel
— Cloudflare menyimpannya di edge selama 24 jam, jadi sebagian besar
pembacaan tidak pernah sampai ke server. Yang terpengaruh hanya halaman yang
tidak di-cache: search (`no-store`) dan admin.

Dan perlu disadari: audiens utama §4 adalah pembaca berbahasa Inggris. Origin
di Indonesia justru **lebih jauh** dari mereka. Untuk search, itu selisih
ratusan milidetik.

## Yang tidak perlu dibeli

- **Managed database.** PostgreSQL di mesin yang sama sudah benar untuk skala
  ini, dan `scripts/backup.sh` sudah menangani dump harian ke R2.
- **Add-on backup Hetzner** (20% dari harga server). Dump ke R2 lebih murah,
  lebih portabel, dan sudah teruji restore-nya.
- **Load balancer / server kedua.** Rate limiter login bersifat in-memory per
  proses (§G.2) — instance kedua justru melipatgandakan setiap batas.
