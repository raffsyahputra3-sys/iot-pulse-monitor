# 🌐 DEPLOY HYBRID (Gratis Semua, Tanpa Expired)

```
[ESP32 di rumah] → (TLS :8883) → [EMQX Serverless] → [Render: backend] → [Atlas]
                                                        ↓ Socket.IO
                                              [Vercel: frontend] → 🌍 publik
```

| Komponen | Layanan | Gratis? |
|----------|---------|---------|
| Backend Node.js | Render (Singapore, free) | ✅ selamanya (tidur setelah 15 mnt idle) |
| Database | MongoDB Atlas M0 (512 MB) | ✅ permanen |
| MQTT broker | EMQX Serverless (1 jt sesi/bln) | ✅ |
| Frontend | Vercel | ✅ |
| Repo | GitHub (sudah ada) | ✅ |

Total: **Rp 0**. Alternatif lain: `DEPLOY.md` (Railway+HiveMQ),
`DEPLOY-RAW.md` (VM RAW full-stack).

## STEP 1 — MongoDB Atlas

1. https://www.mongodb.com/atlas → Sign up → **M0 Free** → region **Singapore**.
2. **Database Access** → user `iotuser` + password (simpan!).
3. **Network Access** → **Allow Access from Anywhere** (`0.0.0.0/0`).
4. Connect → Drivers (Node.js) → salin URI, ganti password + tambah `/iotdb`:
   `mongodb+srv://iotuser:<PASSWORD>@cluster0.xxxxx.mongodb.net/iotdb?retryWrites=true&w=majority`

## STEP 2 — EMQX Serverless

1. https://www.emqx.com/en/cloud → Sign up → **Serverless** → Singapore.
2. Catat: **host** (`xxxxx.emqx.cloud`), port TLS **8883**, **username + password**
   (menu Authentication / API key deployment credentials).

## STEP 3 — Render (backend)

1. https://dashboard.render.com → New → Web Service → connect repo
   `iot-pulse-monitor` (file `render.yaml` di root bikin Render auto-detect).
2. Pastikan: Name `iot-backend`, Region **Singapore**, Root Directory `backend`,
   Build `npm install`, Start `npm start`, plan **Free**.
3. **Environment** → isi (secret dari langkah 1–2):
   `MONGODB_URI`, `MQTT_BROKER=mqtts://<host>:8883`, `MQTT_USERNAME`,
   `MQTT_PASSWORD`, `CORS_ORIGIN=*` (nanti ganti URL Vercel, lihat bawah).
   `JWT_SECRET` ter-generate otomatis dari `render.yaml`.
4. Deploy → dapat URL mis. `https://iot-backend.onrender.com`.
   Cek `<url>/api` → `"demoMode": false` = ✅.

## STEP 4 — Frontend (Vercel)

1. Isi dulu URL backend di `frontend/js/main.js`:
   ```js
   const RENDER_BACKEND_URL = 'https://iot-backend.onrender.com';
   ```
   (kosongkan = mode lokal, pakai `window.location.origin`).
2. Push → https://vercel.com → New Project → import repo →
   Root Directory **`frontend`**, Framework **Other** → Deploy.
3. Dapat URL mis. `https://iot-pulse-monitor.vercel.app`.
4. Kembali ke Render → ubah `CORS_ORIGIN` ke URL Vercel (lebih ketat dari `*`).

## STEP 5 — ESP32

```c
#define WIFI_SSID "wifi_kamu"            // ⚠️ 2.4 GHz
#define WIFI_PASSWORD "password_wifi"
#define MQTT_BROKER "xxxxx.emqx.cloud"   // dari STEP 2
#define MQTT_PORT 8883
#define MQTT_USER "username_emqx"
#define MQTT_PASS "password_emqx"
#define MQTT_TLS 1                       // wajib untuk EMQX Serverless
#define DEVICE_ID "esp32-rakit-01"
```
Firmware sudah dukung TLS (`WiFiClientSecure` + `setInsecure()`).
Upload → Serial Monitor 115200 → `connected` → data tampil di Vercel.

## STEP 6 — Seed admin (opsional)

```powershell
$env:MONGODB_URI="mongodb+srv://..."
cd scripts
node seed.js
```
Login: `admin / admin123` — **ganti setelah deploy!**

## ⚠️ Catatan

| Masalah | Solusi |
|---------|--------|
| Render tidur (cold start ~50 dtk) | Wajar di free tier; pakai UptimeRobot ping tiap 5 mnt biar melek |
| ESP32 `rc=-2` | Host/port salah atau WiFi 5 GHz / AP isolation |
| ESP32 `rc=4/5` | Username/password EMQX salah |
| CORS error di Vercel | `CORS_ORIGIN` di Render harus = URL Vercel |
| `demoMode: true` | `MONGODB_URI` salah / IP belum di-allow di Atlas |

## ✅ Checklist

```
[ ] 1. Atlas → connection string
[ ] 2. EMQX → host + credentials
[ ] 3. Render → deploy + env + URL backend
[ ] 4. main.js → isi RENDER_BACKEND_URL → push
[ ] 5. Vercel → deploy (root: frontend)
[ ] 6. Render → CORS_ORIGIN = URL Vercel
[ ] 7. config.h → EMQX + WiFi → upload ESP32
[ ] 8. Dashboard tampil + demoMode=false
```
