# Slot iklan: yang ada, yang bisa ditambah, dan aritmetikanya

## Yang terpasang sekarang

PRD §13.1 membatasi **maksimal 3 slot per halaman artikel**. Implementasinya
menghormati itu di setiap lebar layar:

| Lebar | Slot yang tampil | Jumlah |
|---|---|---|
| ≥ 1248px (desktop) | rail kiri, rail kanan, akhir artikel | 3 |
| < 1248px (laptop kecil, tablet, ponsel) | tengah artikel, akhir artikel | 2 |

Rail dan slot tengah **saling menggantikan**, tidak ditumpuk. Ada e2e yang
menyusuri lima lebar viewport dan menuntut jumlahnya tidak pernah lebih dari
tiga.

**Ponsel hanya punya dua slot**, dan ponsel biasanya mayoritas traffic. Ini
fakta paling penting di halaman ini.

## Kalau ingin menambah: urutan yang masuk akal

Diurutkan dari imbal hasil tertinggi terhadap risiko terendah.

### 1. Anchor ad di ponsel — dampak terbesar

Unit menempel di bawah layar, bisa ditutup. Di sebagian besar situs publisher
ini adalah unit dengan pendapatan tertinggi, justru karena mayoritas traffic
ada di ponsel dan di sanalah slot paling sedikit.

Format anchor bawaan Google memenuhi Better Ads Standards **selama** ia kecil
dan bisa ditutup. Yang melanggar adalah versi yang menutupi konten dan tidak
bisa dibuang.

Menaikkan total ponsel dari 2 jadi 3 — masih di dalam batas §13.1.

### 2. Satu slot di antara kartu daftar

Di homepage dan halaman kategori, satu unit setelah kartu keempat. Halaman
daftar saat ini tidak punya iklan sama sekali.

### 3. Setelah "bacaan terkait"

Rendah nilainya, rendah risikonya. Pembaca yang sampai ke sana sudah selesai
membaca.

## Yang tidak akan saya pasang

| Format | Kenapa tidak |
|---|---|
| Interstitial / prestitial | Menutupi konten sebelum dibaca; ditandai Better Ads Standards |
| Pop-up dan pop-under | Sama, ditambah alasan AdSense mencabut akun |
| Video auto-play | Merusak INP dan menghabiskan kuota pembaca |
| Kepadatan tinggi di atas lipatan | Sinyal page-experience negatif, dan alasan §13.1 memasang batas 3 |

§17 menempatkan "AdSense ditolak atau di-ban" di kolom **dampak: pendapatan
nol**. Keluhan kepadatan iklan adalah jalur nyata menuju tindakan kebijakan,
dan tidak ada banding yang berarti.

## Aritmetika kasar

> **Ini perhitungan atas asumsi, bukan ramalan.** Angka RPM di bawah adalah
> yang paling tidak pasti. Anda akan tahu RPM Anda yang sebenarnya dalam
> sebulan setelah AdSense disetujui, dan semua yang di sini menjadi usang saat
> itu. Hitung ulang dengan angka Anda sendiri.

```
pendapatan/bulan = pageview × (RPM ÷ 1000)
```

**RPM** = pendapatan per 1.000 pageview. §13.1 memberi dua titik acuan:
traffic Indonesia Rp5.000–20.000, dan traffic US/Eropa "beberapa kali lipat
lebih tinggi". Untuk konten teknologi berbahasa Inggris dengan geografi
campuran, asumsi wajar **Rp30.000–90.000**.

**Pageview** — §3 menargetkan sesi organik. Satu sesi biasanya 1,2–1,5
pageview untuk blog; di bawah ini diperlakukan 1:1, jadi angkanya konservatif.

| Fase | Sesi/bulan (§3) | Perkiraan pendapatan iklan |
|---|---|---|
| 2 — bulan 4–6 | 3.000 – 8.000 | Rp90.000 – 720.000 |
| 3 — bulan 7–12 | 20.000 – 50.000 | Rp600.000 – 4.500.000 |
| 4 — bulan 13–24 | 100.000+ | Rp3.000.000 – 9.000.000+ |

### Bagian rail kiri-kanan saja

Rail hanya tampil di ≥1248px. Untuk konten developer, desktop biasanya 45–60%
traffic. Dari tiga slot desktop, rail mengisi dua — tapi slot di dalam artikel
umumnya berkinerja lebih baik daripada sidebar.

Perkiraan kontribusi rail: **sekitar 15–20% dari total pendapatan iklan**.

Pada 50.000 sesi/bulan, itu kira-kira **Rp250.000 – 900.000/bulan**.

### Dua angka yang lebih penting daripada jumlah slot

**Ambang payout $100** (≈ Rp1,6 juta), ditransfer sekitar tanggal 21. Pada
traffic Fase 2, mencapai pembayaran pertama bisa memakan 3–6 bulan. Itu bukan
tanda ada yang salah.

**Selisih 3 slot ke 5 slot mungkin 15–25%. Selisih 8.000 ke 50.000 pageview
adalah 6×.** Tuasnya ada di traffic dan geografi, bukan di jumlah slot — dan
itu persis alasan §13.1 memprioritaskan konten `en` dan membatasi slot di 3.
