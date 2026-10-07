# 📋 PRD: IoT Web Monitoring System

## 🎯 Tujuan
Sistem monitoring IoT real-time untuk memantau suhu & kelembapan dari ESP32
via MQTT, ditampilkan di dashboard web dengan grafik live & alert otomatis.

## 🛠️ Tech Stack
- **Backend**: Node.js, Express, Socket.IO, MQTT.js, Mongoose
- **Frontend**: HTML, CSS, JS, Chart.js, Socket.IO Client
- **Database**: MongoDB
- **Broker**: Mosquitto MQTT
- **Firmware**: ESP32 + DHT22
- **OS**: Windows (ASUS TUF)

## 🌐 Info Jaringan
| Item | Nilai |
|------|-------|
| IP Laptop | `192.168.1.6` (cek ulang via `ipconfig`) |
| Backend Port | `4000` |
| MQTT Broker | `localhost:1883` (dari backend) |
| MongoDB | `localhost:27017` |
| Dashboard | `http://localhost:4000` |

## 🔗 Rantai Koneksi
ESP32 → (WiFi) → Mosquitto broker di laptop :1883
→ Backend (subscribe MQTT)
→ MongoDB (simpan)
→ Socket.IO (emit)
→ Dashboard (tampil real-time)

## 📁 Struktur Proyek
```
iot-web-monitoring/
├── PRD.md
├── README.md
├── SETUP.md
├── AUTO-SETUP.md
├── .gitignore
├── scripts/
│   ├── setup.ps1 ← Script auto-setup
│   ├── start-all.ps1 ← Start semua service
│   ├── stop-all.ps1 ← Stop semua service
│   ├── publish-test.js ← Test kirim MQTT
│   ├── simulate-device.js ← Simulasi device (testing tanpa ESP32)
│   └── seed.js ← Seed data
├── backend/
│   ├── package.json
│   ├── .env ← Dibuat otomatis (dari .env.example)
│   ├── server.js
│   └── src/...
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/main.js
├── firmware/
│   └── esp32-dht22/
│       ├── config.h ← 🔴 MANUAL: WiFi & IP
│       └── esp32-dht22.ino
├── mosquitto/
│   └── config/
│       └── mosquitto.conf
└── docs/
```

## 🎯 Fitur MVP
| # | Fitur | Prioritas |
|---|-------|-----------|
| F1 | Terima data via MQTT | P0 |
| F2 | Simpan ke MongoDB | P0 |
| F3 | REST API | P0 |
| F4 | Real-time Socket.IO | P0 |
| F5 | Dashboard web | P0 |
| F6 | Alert otomatis | P1 |
| F7 | Multi-device | P1 |
| F8 | Firmware ESP32 | P1 |

## 📡 API Endpoints
Base: `http://localhost:4000/api`

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| GET | `/` | Cek status server & demoMode |
| GET | `/data` | Ambil data sensor |
| GET | `/data/latest` | Data terbaru per device |
| POST | `/data` | Kirim data |
| POST | `/auth/login` | Login |
| GET | `/devices` | List device |
| GET | `/alerts` | List alert |

## 🔌 MQTT Topics
- `iot/device/{deviceId}/data` → Data sensor
- `iot/device/{deviceId}/status` → Online/offline

**Payload:**
```json
{
  "deviceId": "esp32-rakit-01",
  "suhu": 28.5,
  "kelembapan": 70,
  "timestamp": 1704108000
}
```

## 🗄️ Database Schema (MongoDB)
Database: `iotdb`

- `devices` → deviceId, nama, lokasi, status, lastSeen
- `sensordatas` → deviceId, suhu, kelembapan, timestamp
- `users` → username, password, role
- `alerts` → deviceId, tipe, nilai, pesan, level

## ⚠️ Catatan Penting
- Demo mode aktif kalau MongoDB gak konek → data palsu tiap 3 detik
- Cek `http://localhost:4000/api` → lihat `"demoMode": true/false`
- ESP32 harus WiFi 2.4 GHz (bukan 5 GHz)
- ESP32 & laptop harus 1 WiFi
- Ganti DEVICE_ID di config.h jadi `esp32-rakit-01` biar beda dari demo

## ✅ Kriteria Sukses
- [ ] Mosquitto jalan, listen port 1883
- [ ] MongoDB jalan, listen port 27017
- [ ] Backend jalan, `"demoMode": false`
- [ ] ESP32 connect WiFi & MQTT
- [ ] Data asli muncul di dashboard
- [ ] Grafik bergerak real-time
- [ ] Alert muncul saat suhu > 35°C
