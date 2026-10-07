# Kandang Ayam IoT — ESP32 + DHT22 + 2× MG90S + IR Pakan + MQ-135

Firmware: `esp32-kandang-lengkap.ino` + `config.h` (board **ESP32 Dev Module**).

## 1. Daftar belanja

| Qty | Komponen | Catatan |
|-----|----------|---------|
| 1 | ESP32 DevKit V1 30-pin | — |
| 1 | DHT22 | + resistor 10k (pull-up DATA) |
| 2 | Servo MG90S (metal gear) | jangan pakai SG90 plastik untuk atap |
| 1 | IR Obstacle FC-51 | untuk deteksi pakan |
| 1 | MQ-135 | sensor gas/amonia |
| 1 | Adaptor 5V ≥ 2A | **khusus servo + MQ** (jangan dari USB ESP32) |
| 1 | Breadboard + jumper | secukupnya |

## 2. Wiring

> ⚠️ **GROUND WAJIB JADI SATU**: GND ESP32 ↔ GND adaptor 5V ↔ GND semua modul.
> Servo + MQ makan arus besar — kalau power dari pin ESP32, ESP32 akan restart sendiri.

### 2.1 Tabel lengkap

| Modul | Pin modul | → ESP32 / Power | Keterangan |
|-------|-----------|-----------------|------------|
| DHT22 | VCC (+) | 3V3 | |
| DHT22 | GND (−) | GND | |
| DHT22 | DATA (out) | **GPIO14** | + resistor 10k dari DATA ke 3V3 |
| MG90S #1 (kanan) | Sinyal (kuning/oranye) | **GPIO12** | |
| MG90S #1 | VCC (merah) | **5V adaptor** | bukan dari ESP32! |
| MG90S #1 | GND (coklat) | **GND adaptor + GND ESP32** | common ground |
| MG90S #2 (kiri) | Sinyal (kuning/oranye) | **GPIO13** | |
| MG90S #2 | VCC (merah) | **5V adaptor** | gabung dgn servo #1 |
| MG90S #2 | GND (coklat) | **GND adaptor + GND ESP32** | common ground |
| FC-51 IR | VCC | 3V3 | |
| FC-51 IR | GND | GND | |
| FC-51 IR | OUT | **GPIO27** | LOW = pakan terdeteksi |
| MQ-135 | VCC | **5V adaptor** (pemanas butuh 5V) | |
| MQ-135 | GND | GND | |
| MQ-135 | AO | **GPIO34** | analog (ADC1, aman + WiFi) |
| MQ-135 | DO | **GPIO35** (opsional) | boleh kosong |

### 2.2 Diagram (skematik teks)

```
ADAPTOR 5V ≥2A (+) ──┬── Servo#1 VCC (merah) ── Servo#2 VCC (merah) ── MQ-135 VCC
                     │
ESP32 VIN (5V USB) ──┘   (atau: adaptor 5V langsung ke VIN + MQ + servo)

GND BERSAMA ─────────┬── ESP32 GND ── Servo#1 GND ── Servo#2 GND
                     ├── DHT22 GND ── FC-51 GND ── MQ-135 GND
                     └── Adaptor 5V (−)

ESP32 3V3 ───────────┬── DHT22 VCC ── FC-51 VCC
                     └── R 10k ── DHT22 DATA ── GPIO14

GPIO12 ── Servo#1 sinyal (kuning)    → lengan atap KANAN
GPIO13 ── Servo#2 sinyal (kuning)    → lengan atap KIRI (mirror)
GPIO27 ── FC-51 OUT                 → arahkan ke tumpukan pakan ±5–15 cm
GPIO34 ── MQ-135 AO
GPIO35 ── MQ-135 DO (opsional)
```

### 2.3 Mekanik atap

- Servo dipasang di kedua sisi kusen atap, lengan servo dihubungkan ke daun atap
  (kawat/linkage atau horn + push-rod).
- Mode default `SERVO_MIRROR 1` = atap kupu-kupu (kanan 0→90, kiri 90→0).
  Kalau atapmu model satu daun geser/searah, ubah ke `0` di `config.h`.
- 0° = tertutup, 90° = terbuka penuh. Gerakan dibuat halus (1°/20 ms).

### 2.4 Posisi sensor pakan (IR FC-51)

- Tempel di dinding wadah pakan, lubang sensor menghadap tumpukan pakan,
  jarak 5–15 cm.
- Putar trimpot biru (potensiometer) sampai LED indikator:
  **menyala saat ada pakan, mati saat pakan habis** (jarak sejauh wadah kosong).
- Kalau logika terbalik, set `IR_PAKAN_INVERT 1` di `config.h` (tanpa ubah kabel).

## 3. Library Arduino IDE

Install via **Sketch → Include Library → Manage Libraries**:

1. `DHT sensor library` (Adafruit) + ikutkan `Adafruit Unified Sensor`
2. `PubSubClient` (Nick O'Leary)
3. `ArduinoJson` **versi 6.x** (Benoit Blanchon)
4. `ESP32Servo` (Kevin Harrington)

Board: **ESP32 Dev Module**, baud Serial Monitor **115200**.

## 4. Konfigurasi (`config.h`)

1. `WIFI_SSID` / `WIFI_PASSWORD` — WiFi 2,4 GHz / hotspot HP.
2. MQTT default `broker.emqx.io:1883` — **sama dengan `backend/.env` kamu**
   (`MQTT_BROKER=mqtt://broker.emqx.io:1883`, `MQTT_TOPIC=iot/device/+/data`)
   jadi tanpa ubah backend pun data langsung masuk. Untuk Mosquitto lokal,
   ganti ke IP laptop.
3. `DEVICE_ID` biarkan `esp32-rakit-01` (topik data/cmd/status ikut otomatis).

## 5. Cara kerja & format data

- Tiap 5 detik ESP32 publish ke `iot/device/esp32-rakit-01/data`:
  ```json
  {"deviceId":"esp32-rakit-01","suhu":30.5,"kelembapan":65,
   "gas":12.3,"gasRaw":512,"pakan":1,"pakanPersen":100,
   "atap":90,"mode":"auto","timestamp":123}
  ```
  Field `suhu`/`kelembapan` tetap seperti firmware lama → dashboard lama tidak rusak.
  Field `gas` (ppm estimasi), `pakan` (1 ada / 0 habis), `atap` (0–90°) dibaca dashboard baru.
- **Atap otomatis**: suhu ≥ 31 °C → buka; suhu ≤ 28 °C → tutup (hysteresis,
  bisa diubah `TEMP_BUKA_ATAP` / `TEMP_TUTUP_ATAP`).
- **Perintah dari web** (tombol Jendela Atap di dashboard): subscribe
  `iot/device/esp32-rakit-01/cmd`, contoh `{"actuator":"atap","value":90}`.
  Perintah manual berlaku 10 menit lalu kembali AUTO (atau kirim `{"mode":"auto"}`).

## 6. Kalibrasi gas MQ-135

1. **Burn-in**: nyalakan MQ minimal 24 jam (pemanas) sebelum dipercaya.
2. Buka Serial Monitor, catat `gasRaw` (ADC) di udara bersih → isi `GAS_ADC_BERSIH`.
3. Dekatkan ke sumber bau/amonia kandang → catat ADC → isi `GAS_ADC_KOTOR` (= 100 ppm).
4. Default: bersih 300 → 0 ppm, kotor 2200 → 100 ppm. Web beri warning di 25 ppm,
   danger di 40 ppm (bisa diubah via `ALERT_GAS_MAX` di backend `.env`).
5. Ini **estimasi** (bukan alat lab) — yang penting tren naik/turun + ambang peringatan.

## 7. Uji coba

1. Upload → buka Serial Monitor 115200 → harus ada `WiFi OK`, `MQTT OK`, JSON tiap 5 dtk.
2. Hembuskan jari hangat ke DHT22 / naikkan ambang sementara → servo membuka.
3. Tutup sensor IR dengan tangan → `pakan` berubah 1 → 0.
4. Cek web: kartu **Suhu**, **Kelembapan**, **Gas NH₃**, **Pakan** terisi;
   tombol **Jendela Atap** menggerakkan servo (butuh backend + MQTT jalan).
5. Kalau data tidak masuk web: pastikan `DEVICE_ID` + broker sama dengan backend,
   dan backend log menampilkan `MQTT message`.
