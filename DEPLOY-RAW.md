# 🚀 Deploy ke RAW (rawhq.io) — Full VM Gratis

Arsitektur: **satu VM menjalankan semuanya** via `docker-compose.yml`:

```
ESP32 → (internet, port 1883) → Mosquitto di VM
Backend di VM → subscribe Mosquitto → simpan MongoDB (di VM) → Dashboard http://<IP>:4000
```

## ⚠️ Klarifikasi penting: `raw.sh` ≠ RAW

- `raw.sh` adalah **blog pribadi** (raw.sh/docs tidak ada, 404).
- Provider yang dimaksud adalah **RAW / rawhq** di **https://rawhq.io**
  (CLI: `npm install -g rawhq`, repo paket: `npmjs.com/package/rawhq`).
- RAW memberi **Linux VM beneran** (root + SSH + IPv4 publik), BUKAN PaaS.
  Konsekuensinya semuanya gampang: Docker ✓, port berapa pun ✓, storage
  persisten ✓ (SSD 40 GB).

## 📊 Hasil riset RAW

| # | Pertanyaan | Jawaban |
|---|-----------|---------|
| 1 | Support Docker / docker-compose? | ✅ Ya — VM Linux + root, install apa saja |
| 2 | Bisa buka port kustom (1883 MQTT)? | ✅ Ya — IPv4 publik, atur via `ufw` di VM |
| 3 | Persistent volume (MongoDB)? | ✅ Ya — SSD 40 GB persisten, data aman |
| 4 | Spesifikasi free tier (`raw-free`)? | 2 vCPU · 4 GB RAM · 40 GB SSD · bandwidth unmetered |
| 5 | Butuh kartu kredit? | Klaim paket npm: **tidak** (gratis selamanya). Catatan: website rawhq.io saat ini menampilkan paket mulai ~$8/bln — **verifikasi di `raw status` / halaman pricing setelah daftar** |
| 6 | Region? | Frankfurt, Dublin, Ashburn, Hillsboro, **Singapore** (pilih Singapore 🇸🇬) |
| 7 | CLI? | `npm install -g rawhq` → `raw init` → `raw deploy` → `raw ls` → `raw ssh` → `raw rm` |
| 8 | Contoh deploy Node.js? | Tidak perlu template — kita pakai `docker compose` yang sudah ada di repo |

**Kesimpulan: strategi FULL RAW** — tidak perlu hybrid/HiveMQ. ESP32 connect
langsung ke Mosquitto di VM port 1883 (tanpa TLS, sama seperti di laptop).

## Prasyarat
- Node.js v18+ (di laptop, untuk CLI)
- Akun GitHub (login RAW + clone repo private)
- GitHub Personal Access Token (classic, scope `repo`) — untuk clone di server:
  GitHub → Settings → Developer settings → Personal access tokens

## Langkah

### 1. Deploy VM (otomatis, di laptop)

```powershell
.\scripts\setup-raw.ps1
```

Script ini: install CLI `rawhq` → `raw init` (login) →
`raw deploy --type raw-free --region sg` → tampilkan IP publik.
Kalau `sg` penuh/tidak tersedia: `raw deploy --type raw-free --region eu`.

### 2. Provisioning (di server)

```bash
raw ssh <nama-atau-id-server>

# di dalam server:
export GITHUB_TOKEN=ghp_xxxx
sudo git clone https://$GITHUB_TOKEN@github.com/raffsyahputra3-sys/iot-pulse-monitor.git /opt/iot-pulse
sudo bash /opt/iot-pulse/scripts/provision-raw.sh
```

Script provisioning: install Docker → buka firewall (22/4000/1883) →
buat `backend/.env` production (JWT random) → `docker compose up -d --build` →
health check. Target akhir: `http://<IP>:4000/api` balas `"demoMode": false`.

### 3. Arahkan ESP32 ke server

Edit `firmware/esp32-dht22/config.h` (cukup IP-nya, lainnya sama):

```c
#define WIFI_SSID "nama_wifi_tempat_esp_dipasang"  // ⚠️ 2.4 GHz
#define WIFI_PASSWORD "password_wifi"
#define MQTT_BROKER "<IP-PUBLIK-VM>"  // ← dari output `raw ls`
#define MQTT_PORT 1883
#define MQTT_TLS 0
#define DEVICE_ID "esp32-rakit-01"
```

Upload via Arduino IDE → Serial Monitor 115200 harus muncul
`MQTT connecting... connected` → data tampil di `http://<IP>:4000`.

### 4. Seed admin (opsional, di server)

```bash
cd /opt/iot-pulse/scripts
docker exec -i iot-backend node -e "1"  # pastikan backend jalan
# atau seed langsung ke Mongo di VM:
MONGODB_URI=mongodb://localhost:27017/iotdb node seed.js
```

Login default: `admin / admin123` — **ganti password setelah deploy!**

## 🔒 Keamanan (sudah diterapkan)
- MongoDB bind `127.0.0.1` saja (`docker-compose.yml`) → tidak terekspos internet.
- UFW hanya buka 22/4000/1883.
- Mosquitto `allow_anonymous true` (sesuai desain awal; untuk produksi
  pertimbangkan username/password di `mosquitto.conf` + `MQTT_USER/PASS`).

## 🛠️ Perintah berguna

```bash
raw ls                  # lihat server + IP
raw ssh <id>            # masuk server
raw rm <id>             # hapus server
raw status              # info akun & tagihan

# di server:
cd /opt/iot-pulse && docker compose ps
docker compose logs -f backend
docker compose pull && docker compose up -d --build  # update ke versi terbaru
```

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `raw deploy` gagal / region penuh | Coba `--region eu` (Frankfurt) |
| Dashboard tidak bisa dibuka | `ufw status` di server; pastikan port 4000 ALLOW; `docker compose ps` |
| `demoMode: true` | Mongo container down → `docker compose logs mongodb` |
| ESP32 `failed, rc=-2` | Tidak sampai ke server: cek IP, firewall 1883, satu jaringan internet (bukan AP isolation) |
| ESP32 `failed, rc=4/5` | Kredensial salah (kalau pakai auth) |
| Update kode | Push ke GitHub → di server `git pull` → `docker compose up -d --build` |

## ❓ Kapan pakai hybrid (HiveMQ Cloud) sebagai alternatif?
Hanya kalau RAW bermasalah (misal free tier tidak jadi gratis / port 1883
diblokir ISP). Panduannya sudah ada di `DEPLOY.md` (Railway + HiveMQ).
File firmware sudah dukung TLS (`MQTT_TLS 1`), jadi tinggal ganti `config.h`.
