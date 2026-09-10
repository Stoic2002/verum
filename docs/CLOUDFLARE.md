# Cloudflare — yang harus dipasang di dashboard

Kode sudah mengirim header cache yang benar dan sudah bisa memanggil API purge.
Yang berikut ini **tidak bisa dikerjakan dari kode** karena butuh akun Anda.

Kerjakan di Fase 8, setelah domain dibeli.

---

## 1. Cache Rule — tanpa ini seluruh strategi cache tidak berjalan

**Cloudflare tidak meng-cache HTML secara default.** Ini koreksi §A.2 #4: tanpa
aturan eksplisit, setiap kunjungan artikel tetap sampai ke VPS, TTL 24 jam di
header tidak berpengaruh, dan API purge tidak ada gunanya karena tidak ada yang
di-cache untuk dibuang.

**Rules → Cache Rules → Create rule**

| Kolom             | Nilai                                                                                                                                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nama              | `Cache HTML`                                                                                                                                                                                                                                       |
| Expression        | `not (starts_with(http.request.uri.path, "/admin") or starts_with(http.request.uri.path, "/api/") or starts_with(http.request.uri.path, "/preview/") or http.request.uri.path contains "/search" or http.request.uri.path contains "/newsletter")` |
| Cache eligibility | **Eligible for cache**                                                                                                                                                                                                                             |
| Edge TTL          | **Use cache-control header if present**, fallback 0                                                                                                                                                                                                |
| Browser TTL       | **Respect origin**                                                                                                                                                                                                                                 |

`Use cache-control header if present` adalah bagian yang penting: origin sudah
mengirim `s-maxage` berbeda per jenis halaman — artikel 24 jam, homepage 60
detik, topik 5 menit. Menyetel angka tetap di sini akan menimpa semuanya dengan
satu nilai yang salah untuk sebagian besar halaman.

Path admin, API, preview, search, dan newsletter dikecualikan karena origin
mengirim `no-store` untuk semuanya. Aturan ini membuatnya eksplisit di dua
tempat, yang murah dan mencegah satu kesalahan konfigurasi membocorkan halaman
admin ke cache bersama.

### Verifikasi

```bash
# Kunjungan pertama: MISS. Kedua: HIT.
curl -sI https://DOMAIN/en/ai/SLUG | grep -i cf-cache-status
curl -sI https://DOMAIN/en/ai/SLUG | grep -i cf-cache-status

# Admin tidak boleh pernah HIT.
curl -sI https://DOMAIN/admin/login | grep -i cf-cache-status
```

---

## 2. API token untuk purge

**My Profile → API Tokens → Create Token → Create Custom Token**

- Permissions: **Zone → Cache Purge → Purge**
- Zone Resources: **Include → Specific zone →** domain Anda

Zone ID ada di halaman domain, kolom kanan bawah.

Isi keduanya di `.env` produksi:

```
CLOUDFLARE_ZONE_ID="..."
CLOUDFLARE_API_TOKEN="..."
```

Kosong = purge dilewati diam-diam. Aman untuk lokal; di produksi artinya setiap
suntingan baru terlihat pembaca setelah TTL habis.

---

## 3. SSL/TLS — Full (strict)

**SSL/TLS → Overview → Full (strict)**

`Flexible` mengenkripsi Cloudflare→pembaca tapi **tidak** Cloudflare→origin.
Itu berarti trafik antara Cloudflare dan VPS Anda, termasuk cookie session
admin, lewat dalam bentuk polos.

Origin butuh sertifikat yang dipercaya Cloudflare. Dua pilihan:

- **Origin Certificate** (SSL/TLS → Origin Server) — berlaku 15 tahun, dipasang
  di Caddy. Paling sederhana.
- Sertifikat Let's Encrypt biasa lewat Caddy, juga diterima.

---

## 4. Firewall origin — ini bagian dari kontrol rate limit

`ADDRESS_HEADER=CF-Connecting-IP` hanya aman **selama VPS hanya menerima
koneksi dari Cloudflare**. Kalau origin bisa dihubungi langsung, siapa pun bisa
mengirim header itu dengan nilai apa pun dan melewati rate limit login
sepenuhnya.

Jadi firewall VPS harus menolak port 80/443 dari selain
[IP range Cloudflare](https://www.cloudflare.com/ips/). Ini bukan pengerasan
opsional — tanpa itu, konfigurasi `ADDRESS_HEADER` justru **melemahkan**
keamanan dibanding tidak memasangnya.

---

## 5. Yang sengaja TIDAK dinyalakan

| Fitur                      | Kenapa tidak                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Auto Minify**            | Sudah dihapus Cloudflare, dan Vite sudah melakukannya saat build                                                                        |
| **Rocket Loader**          | Menunda eksekusi script, termasuk script tema inline di `app.html` — mengembalikan flash tema yang sudah susah payah dihilangkan (§J.3) |
| **Email Obfuscation**      | Menyisipkan script ke dalam HTML; alamat kontak di halaman Kontak memang seharusnya bisa dibaca mesin                                   |
| **Auto Redirect to HTTPS** | Sudah ditangani Caddy; dua tempat mengurus hal sama akan menghasilkan rantai redirect                                                   |
| **Polish / Mirage**        | Gambar sudah AVIF/WebP dengan `srcset` dari Fase 4; ini akan memproses ulang tanpa manfaat                                              |

---

## 6. Setelah semua terpasang

- [ ] `curl -I` menunjukkan `cf-cache-status: HIT` pada kunjungan kedua artikel
- [ ] `/admin/login` tidak pernah `HIT`
- [ ] Menyunting artikel di admin → muat ulang halaman publik → perubahan langsung terlihat
- [ ] `sitemap.xml` disubmit ke Search Console
- [ ] CMP (Funding Choices) diuji lewat VPN Eropa
