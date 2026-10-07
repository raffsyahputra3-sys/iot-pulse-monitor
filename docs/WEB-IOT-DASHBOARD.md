# Web IoT Dashboard — Arsitektur, API & Cara Jalan

## 1. Alur Data End-to-End

```
ESP32 --MQTT JSON--> broker.emqx.io:1883 --subscribe--> backend/src/config/mqtt.js
  --> SensorData.create (MongoDB iotdb) --> io.emit('dataBaru')
  --> frontend (kandang-ayam.html / uiuxbaru.html / js/main.js) update kartu+grafik
  <-- perintah atap: frontend --> backend --> MQTT publish TOPIC_CMD --> ESP32
```

Topik: `iot/device/+/data` (data), `iot/device/esp32-rakit-01/cmd` (perintah), `.../status` (online).
Socket events: `dataBaru` (dokumen sensor), `deviceStatus` (`{deviceId,status}`).

## 2. Backend (Node.js + Express + MQTT.js + Socket.IO + Mongoose)

Struktur relevan:
```
backend/server.js
backend/src/config/mqtt.js      # subscribe, simpan, emit, checkAlerts
backend/src/config/socketio.js  # init Socket.IO
backend/src/models/SensorData.js# suhu, kelembapan, gas, gasRaw, pakan, pakanPersen, atap, mode
backend/src/models/Device.js, Alert.js
backend/src/routes/dataRoutes.js, deviceRoutes.js, alertRoutes.js, authRoutes.js
backend/src/services/alertService.js
```

`.env` penting (lihat `.env.example`):
```
PORT=4000
MONGODB_URI=mongodb://localhost:27017/iotdb
MQTT_BROKER=mqtt://broker.emqx.io:1883
MQTT_TOPIC=iot/device/+/data
ALERT_TEMP_MAX=35 / MIN=15
ALERT_HUMIDITY_MAX=85 / MIN=30   # gas: warning 25 ppm, danger 40 ppm di frontend
CORS_ORIGIN=http://localhost:4000
JWT_SECRET=... / JWT_EXPIRES=7d
```

Logika `mqtt.js:34-79`: parse JSON → buat `doc` (field gas/pakan/atap hanya jika ada → kompatibel firmware lama) → `SensorData.create` + upsert `Device lastSeen` (skip bila DB down/demo) → `io.emit` → `checkAlerts`.

## 3. Frontend

| File | Peran |
|---|---|
| `frontend/kandang-ayam.html` | dashboard 3D kandang + modal sensor/aktuator |
| `frontend/uiuxbaru.html` (+ backup v10) | dashboard UI baru |
| `frontend/js/main.js`, `connector.js` | Socket.IO client, chart, fetch REST |
| `frontend/components/`, `css/` | kartu sensor, badge status, toast |
| `src/App.tsx`, `src/scene.ts` | versi React/Vite + Three.js (alternatif) |

Kartu: Suhu, Kelembapan, Gas NH3 (warning ≥25, danger ≥40 ppm), Pakan (1=ada/0=habis), Atap (0-90°) + tombol Buka/Tutup + toggle Auto/Manual.

## 4. REST API (ringkas)

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/data?deviceId=esp32-rakit-01&limit=50` | riwayat sensor |
| GET | `/api/data/latest/:deviceId` | data terakhir |
| GET | `/api/devices` | daftar device + lastSeen |
| POST | `/api/devices/:id/cmd` body `{"actuator":"atap","value":90}` | kirim perintah atap via MQTT |
| GET | `/api/alerts` | riwayat alert |
| POST | `/api/auth/login` | JWT admin |

## 5. Cara Menjalankan (lokal)

```powershell
# 1. MongoDB + Mosquitto (atau pakai broker.emqx.io)
# 2. Backend
cd backend; Copy-Item .env.example .env  # sesuaikan MQTT_BROKER + MONGODB_URI
npm install; npm run dev   # port 4000
# 3. Frontend
# buka http://localhost:4000 (diserv backend) atau frontend/*.html
# 4. Simulasi tanpa ESP32
node scripts/simulate-device.js
node scripts/publish-test.js
# 5. ESP32 asli: samakan DEVICE_ID + broker di config.h, upload, cek backend log "MQTT message"
```

## 6. Deploy & Samakan ID

- Broker publik `broker.emqx.io:1883` harus sama di `config.h` (`MQTT_BROKER/PORT`) dan backend `.env` (`MQTT_BROKER`, `MQTT_TOPIC`).
- `DEVICE_ID=esp32-rakit-01` harus sama di firmware, backend seed, dan query frontend.
- Field baru (gas/pakan/atap) opsional di DB → dashboard lama tidak rusak; dashboard baru tinggal baca field tambahan.
