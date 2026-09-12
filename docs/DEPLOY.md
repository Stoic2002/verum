# Deployment (Fase 8)

Server: Tencent Cloud Lighthouse, Singapore. 2 vCPU, 2 GB RAM, SSD 40 GB,
512 GB/bulan, Ubuntu 24.04 LTS. $10,08 setahun (berlaku sampai 2027-09-12,
auto-renew dimatikan; perpanjangan normal $50,40/tahun).

Kenapa satu VPS, bukan serverless: writer AI menjalankan job 3–10 menit dan
menyimpan antreannya di memori proses. Vercel memutus fungsi di 300 detik
(Hobby) atau 800 detik (Pro), melarang paket Hobby untuk situs komersial, dan
Supabase gratis menjeda proyek setelah seminggu tanpa aktivitas — totalnya
sekitar $45/bulan, melewati alarm biaya PRD §17. Lihat juga `docs/VPS.md`.

## Sekali saja: menyiapkan server

```bash
scp scripts/server-setup.sh ubuntu@SERVER_IP:/tmp/
ssh ubuntu@SERVER_IP 'sudo bash /tmp/server-setup.sh'
```

Skrip itu idempoten dan merupakan satu-satunya catatan bagaimana server
dibangun. Kalau mesin ini hilang, penggantinya adalah skrip ini plus restore
database — bukan mengingat-ingat perintah. Isinya:

- swap 2 GB dan `vm.swappiness=10` — dengan RAM 2 GB dan pemrosesan gambar yang
  memuncak di ~700 MB, tanpa swap Linux tidak melambat, ia mematikan PostgreSQL
  atau Node;
- firewall UFW (22, 80, 443) sebagai kunci kedua di samping firewall Lighthouse,
  plus fail2ban dan update keamanan otomatis;
- PostgreSQL 16 — versi yang diuji CI dan disebut PRD §10.1;
- Node 22 (runtime produksi), Bun (toolchain build), Caddy (reverse proxy);
- user sistem `verum`, checkout di `/srv/verum/app`, media di `/srv/verum/.media`;
- `/etc/verum/.env` dengan **rahasia yang dibuat di server itu**, bukan disalin
  dari laptop: nilai pengembangan sudah pernah melewati riwayat shell, editor,
  dan backup;
- service systemd `verum` dengan `ProtectSystem=strict`.

## Setiap rilis

```bash
ssh ubuntu@SERVER_IP 'sudo bash /srv/verum/app/scripts/deploy.sh'
```

Urutannya: `git reset --hard origin/main` → `bun install --frozen-lockfile` →
**migrasi** → build → restart → smoke test `GET /en`. Migrasi berjalan sebelum
build baru melayani permintaan: migrasi yang gagal harus menghentikan deploy,
bukan meninggalkan aplikasi berjalan di atas database setengah jadi.

## Yang masih harus diisi

| Hal                             | Kenapa perlu                                                            | Status                         |
| ------------------------------- | ----------------------------------------------------------------------- | ------------------------------ |
| Domain                          | TLS tidak bisa diterbitkan untuk alamat IP, dan Cloudflare butuh domain | **Belum diputuskan** (PRD §18) |
| `ORIGIN`, `PUBLIC_SITE_URL`     | `adapter-node` menolak setiap POST form kalau `ORIGIN` tidak cocok      | Sementara berisi IP server     |
| Cloudflare (zone id, API token) | CDN, cache rules, dan purge saat artikel disimpan                       | Menunggu domain                |
| R2                              | Media lepas dari disk server; sekarang masih di `/srv/verum/.media`     | Menunggu diisi                 |
| SMTP                            | Newsletter double opt-in                                                | Menunggu diisi                 |
| Sentry, UptimeRobot             | Error dan uptime (PRD §15)                                              | Menunggu diisi                 |
| CMP (Funding Choices)           | Wajib sebelum ada traffic Eropa (PRD §14)                               | Menunggu akun AdSense          |

## Setelah domain ada

1. Arahkan A record domain ke IP server, lewat Cloudflare (proxy aktif).
2. Ubah `/etc/verum/.env`: `ORIGIN` dan `PUBLIC_SITE_URL` ke `https://domain`,
   dan `ADDRESS_HEADER="CF-Connecting-IP"`.
3. Ganti `/etc/caddy/Caddyfile` dari `:80` menjadi nama domain — Caddy mengurus
   sertifikatnya sendiri. Firewall origin sebaiknya dibatasi ke rentang IP
   Cloudflare, karena `CF-Connecting-IP` hanya bisa dipercaya selama origin
   tidak bisa dihubungi langsung (PLAN-DEV §F).
4. `systemctl reload caddy` dan `systemctl restart verum`.

## Backup

`scripts/backup.sh` sudah ada dan `scripts/restore-test.sh` mengujinya. Yang
belum: menjadwalkannya (systemd timer harian) dan mengirim dump ke R2 dengan
retensi 30 hari (PRD §15). Backup yang belum pernah direstore bukan backup.
