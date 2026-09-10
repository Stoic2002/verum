# Spesifikasi VPS — berdasarkan pengukuran, bukan tebakan

Angka di bawah diukur dari build produksi yang berjalan, bukan diperkirakan.

## Yang benar-benar dipakai

| Proses | Memori |
|---|---|
| Node (`node build/index.js`), idle | 95 MB |
| Node, setelah 70 request (40 artikel + 30 search) | 136 MB — **stabil, tidak naik terus** |
| PostgreSQL 16, data kecil | 82 MB (15 proses) |
| Caddy | ~30 MB |
| **Total kondisi normal** | **~250 MB** |

Puncaknya bukan di melayani halaman, tapi di **memproses gambar**:

| Operasi | Memori |
|---|---|
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

## Pilihan lokal (Indonesia)

Harga per 10 September 2026, diambil dari halaman resmi masing-masing. Cek
ulang saat mendaftar.

### Biznet Gio — NEO Lite

| Paket | vCPU | RAM | Disk | Harga/bulan |
|---|---|---|---|---|
| XS 1.1 | 1 | 1 GB | 60 GB | Rp59.000 |
| **SS 2.1** | **1** | **2 GB** | **60 GB** | **Rp80.000** |
| SS 2.2 | 2 | 2 GB | 60 GB | Rp109.000 |
| MS 4.2 | 2 | 4 GB | 60 GB | Rp139.000 |
| MS 4.4 | 4 | 4 GB | 60 GB | Rp179.000 |

Kode `DISKON10` memberi potongan 10% untuk langganan tahunan.

### IDCloudHost — Basic Standard

| vCPU | RAM | Disk | Harga/bulan |
|---|---|---|---|
| 2 | 2 GB | 20 GB | Rp87.000 |
| 2 | 2 GB | 40 GB | Rp100.000 |
| 2 | 4 GB | 60 GB | Rp225.000 |

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

| | Spesifikasi | Harga/bulan |
|---|---|---|
| Hetzner CX22 | 2 vCPU, 4 GB, 40 GB | ~Rp75.000 |
| Biznet MS 4.2 | 2 vCPU, 4 GB, 60 GB | Rp139.000 |
| IDCloudHost | 2 vCPU, 4 GB, 60 GB | Rp225.000 |

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
