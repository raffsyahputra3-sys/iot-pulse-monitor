# 🔌 INTEGRATION: uiuxbaru.html → iot-pulse-monitor

Tanggal: 2026-09-25. Frontend lama (cards/chart/table) diganti dashboard 3D
single-file, **tanpa ubah backend/firmware/database**.

## Verifikasi backend (existing)

| Item | Nilai aktual |
|------|--------------|
| Transport | Socket.IO (browser ← server), MQTT hanya ESP32 → broker → server |
| Event ke frontend | `dataBaru`, `alert`, `deviceStatus` |
| Payload `dataBaru` | `{ _id, deviceId, suhu, kelembapan, timestamp }` |
| Static serving | `express.static(frontend/)` di `backend/server.js` |
| Port | `4000` (Render: dinamis via `PORT`) |
| CORS Socket.IO | `process.env.CORS_ORIGIN` (`*` di PaaS) |

## Perubahan yang dilakukan

1. **`frontend/uiuxbaru.html`** (baru, dari `Downloads/uiuxbaru.html.html`).
   Satu-satunya edit: tambah 1 baris listener di `initSocket()`:
   ```js
   socket.on('dataBaru', onSensorData);
   ```
   Payload backend (`suhu`/`kelembapan`/`deviceId`) kompatibel langsung
   dengan `onSensorData()` — field ekstra (`_id`, `timestamp`) diabaikan.
   Listener lama (`sensor-data`, `sensorData`) dibiarkan untuk kompatibilitas.
2. **`backend/server.js`**: `GET /` → `uiuxbaru.html`; SPA fallback
   non-API → `uiuxbaru.html`. API (`/api/*`) dan Socket.IO tidak disentuh.
   Legacy tetap hidup di `/index.html`.
3. **Backup**: `frontend/_legacy/` (`index.html.old`, `css/`, `js/`)
   (termasuk `js/main.js` berisi `RENDER_BACKEND_URL` produksi).
4. **Tidak diubah**: firmware, MQTT topic, REST endpoint, skema DB,
   `evaluateCondition()` (threshold tetap di client).

## Asumsi yang diambil

- Struktur repo ini (`backend/server.js` + `frontend/`) ≠ struktur PRD
  (`server.js` + `public/`) → file ditaruh di `frontend/`, bukan `public/`.
- `io()` tanpa argumen: works karena backend serve frontend dari origin
  yang sama (lokal maupun Render). Di Vercel, Socket.IO Bootstrap dari CDN
  `cdn.socket.io/4.7.2` dan dashboard 3D **tidak pakai `RENDER_BACKEND_URL`**
  (halaman ini connect ke origin tempat ia di-serve).
  → Di Vercel (`frontend` statis tanpa server Socket.IO), live update
  hanya jalan jika di-serve dari backend (Render : `https://iot-pulse-monitor.onrender.com/`).
  Halaman ini tetap berguna di Vercel untuk `simulateData()` / demo visual.

## Cara akses

| URL (lokal / Render) | Isi |
|-----|-----|
| `/` | Dashboard 3D baru |
| `/uiuxbaru.html` | Sama (langsung) |
| `/index.html` | Dashboard lama (legacy) |
| `/api`, `/api/health` | Tidak berubah |

> Catatan Vercel (statis, tanpa `server.js`): `/` tetap `index.html` lama —
> buka **`/uiuxbaru.html`** untuk dashboard 3D. Route `/` → 3D hanya berlaku
> di lokal & Render.

## Test

- Console browser: `simulateData(34, 82)` → badge 🔥 Panas Lembap, chart/table update.
- ESP32 real → UI update <2 detik via event `dataBaru`.
- Rollback: `git checkout HEAD~1 -- backend/server.js` + hapus `frontend/uiuxbaru.html`.
