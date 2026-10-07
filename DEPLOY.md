# 🚀 DEPLOY: PaaS + Broker Cloud (Gratis)

Arsitektur hosting:

```
ESP32 → (internet, TLS) → HiveMQ Cloud :8883
Backend (Railway) → subscribe HiveMQ ─┐
Backend (Railway) → simpan Atlas ─────┤→ Dashboard (URL Railway)
```

Semua tier gratis. Yang butuh akun: MongoDB Atlas, HiveMQ Cloud, Railway
(ketiganya bisa login pakai akun GitHub `raffsyahputra3-sys`).

## 1. MongoDB Atlas (database)

1. Buka https://cloud.mongodb.com → Sign up / login.
2. Create Cluster → pilih **M0 Free** → region terdekat (Singapore) → Create.
3. **Database Access** → Add User → username `iotapp`, password random (simpan!) → role
   `Read and write to any database`.
4. **Network Access** → Add IP → **Allow Access from Anywhere** (`0.0.0.0/0`)
   (wajib, karena IP Railway dinamis).
5. **Database → Connect → Drivers (Node.js)** → salin connection string,
   ganti `<password>` dengan password tadi + tambahkan nama DB:
   `mongodb+srv://iotapp:<password>@cluster0.xxxxx.mongodb.net/iotdb`

## 2. HiveMQ Cloud (broker MQTT publik)

1. Buka https://console.hivemq.cloud → Sign up / login → Create cluster
   (pilih **Free**, region Singapore).
2. Catat **Host**, misal `abc123.s1.eu.hivemq.cloud`, port TLS **8883**.
3. **Access Management** → Add credentials → misal user `device-01` + password
   (simpan! dipakai ESP32 DAN backend).
4. (Opsional) **WebSocket / MQTT client** di console untuk test publish manual.

## 3. Railway (backend + frontend)

1. Buka https://railway.app → login dengan GitHub → **New Project →
   Deploy from GitHub repo** → pilih `iot-pulse-monitor` (private, authorize).
2. Klik service → **Settings → Root Directory** = `backend`
   (start command default `npm start` sudah benar).
3. **Variables** → isi:
   | Key | Value |
   |-----|-------|
   | `MONGODB_URI` | connection string Atlas (langkah 1) |
   | `MQTT_BROKER` | `mqtts://abc123.s1.eu.hivemq.cloud:8883` |
   | `MQTT_USERNAME` | `device-01` |
   | `MQTT_PASSWORD` | password HiveMQ |
   | `MQTT_TOPIC` | `iot/device/+/data` |
   | `JWT_SECRET` | random panjang (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
   | `CORS_ORIGIN` | `*` |
   | `NODE_ENV` | `production` |
   (`PORT` diisi otomatis oleh Railway, jangan di-set manual.)
4. **Settings → Generate Domain** → dapat URL publik, misal
   `https://iot-pulse-monitor.up.railway.app`.
5. Buka `<url>/api` → harus balas `"demoMode": false` (✅ real mode).

## 4. ESP32 (firmware cloud)

1. Edit `firmware/esp32-dht22/config.h`:
   ```c
   #define WIFI_SSID "nama_wifi_rumah"       // ⚠️ harus 2.4 GHz
   #define WIFI_PASSWORD "password_wifi"
   #define MQTT_BROKER "abc123.s1.eu.hivemq.cloud"
   #define MQTT_PORT 8883
   #define MQTT_USER "device-01"
   #define MQTT_PASS "password_hivemq"
   #define MQTT_TLS 1
   #define DEVICE_ID "esp32-rakit-01"
   ```
2. Upload via Arduino IDE, pantau Serial Monitor 115200:
   `MQTT connecting... connected`.
3. Buka dashboard Railway → data asli masuk tiap 5 detik, grafik bergerak.

## 5. Seed admin (opsional)

```powershell
# sementara arahkan lokal ke cloud, lalu seed
$env:MONGODB_URI="mongodb+srv://..."
cd scripts
node seed.js
```
Login default: `admin / admin123` — **ganti password setelah deploy!**

## ⚠️ Catatan
- Tier gratis Railway (trial $5) & HiveMQ (100 sesi) & Atlas (512 MB) cukup
  untuk 1–2 device. Kalau trial Railway habis, alternatif: Render / Fly.io
  (pola env sama).
- Jangan commit kredensial ke repo — semua lewat Variables Railway.
- Untuk kembali ke mode lokal (laptop), balikan `config.h` ke
  `MQTT_BROKER 192.168.1.6`, `PORT 1883`, `MQTT_TLS 0`.
