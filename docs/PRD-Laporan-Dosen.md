# PRODUCT REQUIREMENT DOCUMENT (PRD)
## Sistem Monitoring Suhu & Kelembapan Berbasis IoT Real-Time
### ESP32 + DHT22 → MQTT → Node.js → MongoDB → Dashboard Web

**Disusun oleh:**
- Nama: [Nama Mahasiswa]
- NIM: [NIM]
- Program Studi: [Teknik Informatika / Teknik Elektro]
- Universitas: [Nama Universitas]
- Dosen Pembimbing: [Nama Dosen]
- Tahun Akademik: 2025/2026

---

## BAB 1 — PENDAHULUAN

### 1.1 Latar Belakang
Pemantauan suhu dan kelembapan secara manual tidak efisien dan tidak real-time. Sistem IoT memungkinkan pembacaan sensor otomatis setiap 5 detik dan ditampilkan langsung di dashboard web yang dapat diakses publik.

### 1.2 Rumusan Masalah
1. Bagaimana merancang perangkat ESP32 + DHT22 yang mengirim data via MQTT?
2. Bagaimana membangun backend yang menyimpan data dan meneruskannya real-time ke dashboard?
3. Bagaimana mendeploy sistem agar dapat diakses semua orang via internet?

### 1.3 Tujuan
1. Membangun firmware ESP32 + DHT22 dengan koneksi WiFi/MQTT otomatis.
2. Membangun backend Node.js + MongoDB + Socket.IO untuk API dan real-time.
3. Mendeploy dashboard publik di `https://iot-pulse-monitor.onrender.com/`.

### 1.4 Manfaat
Akademik (praktik IoT end-to-end), praktis (monitoring ruangan/lab/server), dan publik (demo live).

### 1.5 Batasan Masalah
- 1 device ESP32 (`esp32-rakit-01`), sensor DHT22 pin GPIO4, interval 5 detik.
- Broker publik `broker.emqx.io:1883` (tanpa TLS).
- Dashboard publik read-only untuk umum; admin via JWT.

## BAB 2 — DASAR TEORI
- **ESP32 DevKit**: mikrokontroler WiFi 2.4 GHz.
- **DHT22**: sensor suhu (-40–80 °C, ±0.5 °C) & kelembapan (0–100%, ±2%).
- **MQTT**: protokol publish/subscribe ringan untuk IoT.
- **Node.js + Express + MQTT.js + Socket.IO + Mongoose**.
- **MongoDB**: database dokumen (`iotdb`).
- **Chart.js**: grafik dashboard.

## BAB 3 — PERANCANGAN SISTEM

### 3.1 Arsitektur
```
[DHT22] → [ESP32] → (WiFi/hotspot 2.4 GHz) → [broker.emqx.io:1883]
  → [Backend Render: subscribe MQTT → MongoDB Atlas → Socket.IO]
  → [Dashboard publik https://iot-pulse-monitor.onrender.com/]
```

### 3.2 Perangkat Keras
| Komponen | Spesifikasi |
|---|---|
| ESP32 | DevKit V1, WiFi STA |
| Sensor | DHT22, DATA → GPIO4, VCC → 3V3, GND → GND |
| Indikator | LED built-in GPIO2 kedip tiap kirim |
| Catu daya | USB 5V / hotspot laptop `IOT-ESP` |

### 3.3 Perangkat Lunak
Backend: Node.js ≥18, Express 4, Socket.IO 4, MQTT.js 5, Mongoose 8, JWT, Winston. Frontend: HTML/CSS/JS, Chart.js, Socket.IO Client. Firmware: Arduino IDE, library DHT Adafruit, PubSubClient, ArduinoJson v6.

### 3.4 MQTT & Payload
- Data: `iot/device/esp32-rakit-01/data`
- Status: `iot/device/esp32-rakit-01/status`
```json
{ "deviceId": "esp32-rakit-01", "suhu": 28.5, "kelembapan": 70, "timestamp": 1704108000 }
```

### 3.5 REST API (`/api`)
| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api` | Status server + demoMode |
| GET | `/api/health` | Mongo, uptime |
| GET | `/data` | Riwayat sensor |
| GET | `/data/latest` | Data terbaru per device |
| POST | `/data` | Kirim data manual |
| POST | `/auth/login` | Login JWT |
| GET | `/devices` | List device |
| GET | `/alerts` | List alert (suhu > 35 °C) |

### 3.6 Database (`iotdb`)
- `devices`: deviceId, nama, lokasi, status, lastSeen
- `sensordatas`: deviceId, suhu, kelembapan, timestamp
- `users`: username, password (hash), role
- `alerts`: deviceId, tipe, nilai, pesan, level

## BAB 4 — IMPLEMENTASI
1. Firmware `firmware/esp32-dht22/` (config.h + esp32-dht22.ino): auto-connect WiFi, reconnect MQTT, kirim JSON tiap 5 detik.
2. Backend `backend/server.js`: subscribe `iot/device/+/data`, simpan MongoDB, emit Socket.IO.
3. Frontend `frontend/`: dashboard 3D (`uiuxbaru.html`, default) + legacy (`index.html`).
4. Deploy: backend di Render Singapore (free), URL `https://iot-pulse-monitor.onrender.com/`, repo `https://github.com/raffsyahputra3-sys/iot-pulse-monitor`.

## BAB 5 — PENGUJIAN
| # | Skenario | Hasil yang diharapkan | Status |
|---|---|---|---|
| U1 | ESP32 nyala, hotspot 2.4 GHz | Serial: `WiFi connected` | ☐ |
| U2 | Publish MQTT | Serial: `Kirim: {...}`, `connected` | ☐ |
| U3 | Buka `/api` | `status: running, demoMode: false` | ✅ |
| U4 | Buka dashboard publik | Data `esp32-rakit-01` live tiap 5 detik | ☐ |
| U5 | Suhu > 35 °C | Alert muncul | ☐ |
| U6 | WiFi putus | ESP reconnect otomatis | ☐ |

## BAB 6 — PENUTUP
### Kesimpulan
Sistem berhasil dirancang end-to-end dan terdeploy publik. Web live di Render; firmware auto-connect; data real-time.
### Saran
Tambah TLS (8883), multi-device, notifikasi WhatsApp/Telegram, dan mode offline (Mosquitto lokal `192.168.137.1`).

## LAMPIRAN
- Demo publik: https://iot-pulse-monitor.onrender.com/
- API: https://iot-pulse-monitor.onrender.com/api
- Repo: https://github.com/raffsyahputra3-sys/iot-pulse-monitor
- Wiring: VCC→3V3, GND→GND, DATA→GPIO4
