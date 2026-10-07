# PRD — Sistem Monitoring Kandang Ayam IoT (ESP32 + Web Real-Time)

**Versi:** 1.0 — 7 Okt 2026
**Device:** `esp32-rakit-01` | **Firmware:** `firmware/esp32-kandang-lengkap/`
**Broker default:** `broker.emqx.io:1883` | **Backend:** Node.js + MQTT.js + Socket.IO + MongoDB

Dokumen pendamping:
- `docs/WIRING-ESP32-KANDANG-LENGKAP.md` — wiring detail
- `docs/SKETCH-INO-ESP32.md` — bedah sketch `.ino` + `config.h`
- `docs/WEB-IOT-DASHBOARD.md` — arsitektur web, API, Socket.IO, cara jalan

---

## 1. Latar Belakang & Tujuan

Monitoring kandang manual (cek suhu, bau amonia, pakan, buka-tutup atap) tidak real-time dan melelahkan. Sistem ini mengotomatiskan semuanya:

1. ESP32 baca **DHT22** (suhu/kelembapan), **MQ-135** (gas amonia), **FC-51 IR** (pakan) tiap 5 detik.
2. Atap dibuka/tutup otomatis oleh **2x servo MG90S** berdasar suhu, bisa dioverride dari web.
3. Data dikirim via **MQTT** → backend simpan ke **MongoDB** → dorong ke dashboard via **Socket.IO** real-time.
4. Dashboard web tampilkan kartu Suhu, Kelembapan, Gas NH3, Pakan + tombol Jendela Atap + grafik + alert.

## 2. Scope

### In-scope (V1)
- 1 device ESP32 DevKit V1 30-pin (`esp32-rakit-01`).
- Sensor: DHT22 (GPIO14), IR FC-51 (GPIO27), MQ-135 AO (GPIO34) + DO opsional (GPIO35).
- Aktuator: 2x MG90S sinyal GPIO12 + GPIO13, mode mirror kupu-kupu.
- Atap otomatis hysteresis: buka ≥31 °C, tutup ≤28 °C, manual timeout 10 menit.
- MQTT topics `iot/device/esp32-rakit-01/data|cmd|status`.
- Backend: subscribe MQTT, simpan `SensorData`, emit `dataBaru`, cek alert, REST API data/device/alert.
- Frontend: dashboard live (kandang-ayam.html / uiuxbaru.html), kartu + grafik + kontrol atap.
- Kompatibilitas mundur: field lama `suhu`/`kelembapan` tetap, field baru opsional.

### Out-of-scope (V1)
- Multi-device, OTA firmware, TLS client-cert di ESP32, kontrol conveyor/lampu fisik (baru simulasi 3D).

## 3. Pengguna & User Stories

| Aktor | Story | Acceptance |
|---|---|---|
| Peternak | Lihat suhu/lembap/gas/pakan live di HP | Data update ≤7 detik, badge OK/warning/danger benar |
| Peternak | Buka/tutup atap dari web saat hujan/panas | Servo gerak ≤3 detik setelah tombol, mode jadi `manual` |
| Peternak | Dapat peringatan gas tinggi / pakan habis | Toast + alert tersimpan saat gas >40 ppm / pakan=0 |
| Dosen/penguji | Lihat bukti end-to-end + wiring rapi | Serial Monitor JSON + web tampil + dokumen ini |

## 4. Arsitektur Sistem

```
[DHT22][IR][MQ-135] → [ESP32] → WiFi 2.4GHz → [broker.emqx.io:1883]
  topic data: iot/device/esp32-rakit-01/data (publish tiap 5 dtk)
  topic cmd:  iot/device/esp32-rakit-01/cmd  (subscribe perintah atap)
      ↓
[Backend Node.js: mqtt.js subscribe → SensorData.create → io.emit('dataBaru')]
      ↓ MongoDB (iotdb.SensorData) + Socket.IO
[Dashboard web: kartu, chart, tombol atap → publish cmd via backend/MQTT]
```

## 5. Spesifikasi Hardware (ringkas)

| Modul | Pin modul → ESP32/Power |
|---|---|
| DHT22 VCC/GND/DATA | 3V3 / GND / GPIO14 (+R 10k DATA→3V3) |
| Servo #1 sinyal/VCC/GND | GPIO12 / 5V adaptor / GND adaptor (+common ke ESP) |
| Servo #2 sinyal/VCC/GND | GPIO13 / 5V adaptor / GND adaptor |
| IR FC-51 VCC/GND/OUT | 3V3 (gabung DHT boleh) / GND / GPIO27 |
| MQ-135 VCC/GND/AO/DO | 5V adaptor / GND / GPIO34 / GPIO35 opsional |
| Power | Adaptor 5V ≥2A khusus servo+MQ; ESP via USB/VIN; **GND wajib satu** (pusat di adaptor) |

Detail + diagram + troubleshooting: lihat `WIRING-ESP32-KANDANG-LENGKAP.md`.

## 6. Spesifikasi Firmware (ringkas)

- File: `esp32-kandang-lengkap.ino` (217 baris) + `config.h` (65 baris), board `ESP32 Dev Module`, baud 115200.
- Library: Adafruit DHT + Unified Sensor, PubSubClient, ArduinoJson v6, ESP32Servo.
- Loop: baca DHT → logika atap auto → baca gas (rata-rata 10x ADC) → baca IR → publish JSON → kedip LED GPIO2.
- Format data (publish):
```json
{"deviceId":"esp32-rakit-01","suhu":30.5,"kelembapan":65,"gas":12.3,"gasRaw":512,"pakan":1,"pakanPersen":100,"atap":90,"mode":"auto","timestamp":123}
```
- Format perintah (subscribe): `{"actuator":"atap","value":90}` / `{"atap":90}` / `{"mode":"auto"}`. Nilai 0/90 atau bool.
- Kalibrasi gas: `GAS_ADC_BERSIH 300` (=0 ppm), `GAS_ADC_KOTOR 2200` (=100 ppm), burn-in 24 jam.

Detail per fungsi: lihat `SKETCH-INO-ESP32.md`.

## 7. Spesifikasi Web (ringkas)

- Backend `backend/src/config/mqtt.js`: subscribe `MQTT_TOPIC=iot/device/+/data`, simpan ke `SensorData.js` (field gas/pakan/atap opsional), emit `dataBaru` + `deviceStatus`, panggil `checkAlerts`.
- Model `SensorData`: deviceId, suhu, kelembapan, gas, gasRaw, pakan, pakanPersen, atap, mode, timestamp.
- Frontend: `frontend/kandang-ayam.html` (3D), `uiuxbaru.html`, `js/main.js` via Socket.IO; kartu Gas warning 25 ppm / danger 40 ppm.
- Env penting `.env.example`: PORT 4000, MONGODB_URI, MQTT_BROKER, MQTT_TOPIC, ALERT_TEMP_MAX/MIN, ALERT_HUMIDITY_MAX/MIN, CORS_ORIGIN.

Detail + API + cara run: lihat `WEB-IOT-DASHBOARD.md`.

## 8. Kriteria Penerimaan (UAT)

1. Upload firmware → Serial Monitor: `WiFi OK`, `MQTT OK`, JSON tiap 5 detik.
2. Tangan tutup IR → `pakan` 1→0 di serial + web.
3. Panaskan DHT (atau turunkan `TEMP_BUKA_ATAP` sementara) → servo buka 90°.
4. Web: 4 kartu terisi, tombol Jendela Atap gerakkan servo ≤3 detik.
5. Matikan WiFi 10 detik → ESP reconnect sendiri, tidak hang.
6. Backend log tampil `MQTT message` tiap 5 detik, data tersimpan di MongoDB.

## 9. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| ESP restart (power kurang) | Adaptor 5V ≥2A, star-ground di adaptor, kabel pendek |
| Servo getar | Hysteresis 28/31 °C + gerak halus 1°/20 ms |
| MQ ngaco (belum burn-in) | Tulis disclaimer estimasi, kalibrasi 2 titik via serial |
| IR logika terbalik | `IR_PAKAN_INVERT` 0/1 tanpa ubah kabel |
| Broker publik down | Ganti ke Mosquitto lokal `192.168.x.x:1883` di `config.h` + `.env` |
