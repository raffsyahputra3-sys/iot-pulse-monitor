# Progress — AI Kontrol Atap Offline (handoff antar-AI)

PRD acuan: `docs/PRD-AI-Kontrol-Atap-Offline-V1.md` (V1, 11 Okt 2026).
File ini ditulis agar AI berikutnya bisa lanjut tanpa membaca ulang semua chat.

## Status per bagian PRD

| PRD | Status | Keterangan |
|---|---|---|
| §2 scope Fase 1 (`pi/`, Mosquitto lokal, Ollama, guard, cuaca cache, logging) | ✅ kode selesai | 12 file di `pi/`, terverifikasi (lihat bawah) |
| §3 arsitektur (loop 60–120 dtk, topic cmd/ai) | ✅ | `mqtt_listener.py` loop 90 dtk, publish `.../cmd` + `.../ai` |
| §4 hardware (Pi, RTC DS3231, cooler) | ⬜ belum | Belanja/pasang fisik + T5 |
| §5.1–5.2 facts builder | ✅ | `pi/facts.py` persis pseudocode PRD + baris sensor hujan lokal |
| §5.3 JSON schema LLM | ✅ | `DECISION_SCHEMA` di `pi/advisor.py`, `format=` Ollama dipaksa |
| §5.4–5.5 guard kontrak + topic cmd | ✅ | `pi/guard.py` + `should_publish()` (§6.4) |
| §6.1–6.4 guard rules | ✅ | Unit test G1–G6 lolos 9/9 (`python -m unittest test_guard -v` di `pi/`) |
| §6.5 fallback firmware | ✅ | Tanpa kode (behavior existing), hanya verifikasi T4 |
| §7.1–7.3 stack + model + Modelfile | ✅ file, ⬜ benchmark | `pi/Modelfile` default `qwen2.5:1.5b-instruct`; kecepatan Pi BELUM dibenchmark (§11.3) |
| §7.4 fine-tuning | 🟡 sebagian | `pi/training/labeler.py` jadi + smoke test 200 baris OK; training LoRA (Colab) BELUM; `overrides.jsonl` logger SIAP menampung data real user |
| §8 perubahan existing | 🟡 sebagian | Backend forward `iot/device/+/ai` → socket `aiKeputusan` ✅; listener `aiKeputusan` di `v10.html` ✅; **MQTT_BROKER di `config.h` + `backend/.env` BELUM diganti IP Pi** (butuh IP asli) |
| §9 T1–T6 | ⬜ belum | Butuh Pi fisik + ESP32 (T1 offline 30 mnt, T2 restart Ollama, T3 = unit test ✅, T4 fallback, T5 RTC, T6 base vs fine-tuned) |
| §10 Fase 2/3 | ⬜ belum | Fase 2 = kumpulkan overrides + training; Fase 3 = mode `"ai"` firmware + rain/LDR fisik |
| §11 open questions | 🟡 | 11.1 hujan offline → diputuskan ACCEPTABLE + rain sensor opsional didukung kode; 11.2 threshold pakai angka PRD + sumber literatur di komentar `config.py`; 11.3 benchmark Pi pending |
| §12 DoD | 🟡 | Kode + unit test ✅; systemd file ✅ (belum diuji di Pi); README ✅; 24-jam offline + RTC ⬜ |

## File dibuat/diubah sesi ini

- Baru: `pi/config.py, facts.py, guard.py, advisor.py, weather.py, rainsensor.py,
  logger.py, mqtt_listener.py, requirements.txt, Modelfile, kandang-ai.service,
  test_guard.py, README.md, data/.gitkeep, training/labeler.py`
- Ubah: `backend/src/config/mqtt.js` (subscribe `+/ai`, emit `aiKeputusan`),
  `frontend/v10.html` (1 baris listener `aiKeputusan` → status log + notif).
- Tidak diubah: firmware `.ino` (sesuai PRD, V1 tanpa ubah firmware).

## Keputusan yang sudah dikunci user

1. Fase 1 dulu; data real dikumpulkan user nanti via `overrides.jsonl`.
2. Rain sensor YL-83 boleh dipakai (GPIO 17, `RAIN_ENABLED=0` untuk matikan).
3. Threshold ikut PRD + literatur (komentar sumber di `config.py`).
4. Combo `pecutt-premium` 9router: gas full 14 model, judge
   `cl/anthropic/claude-opus-5.5` (sudah ditulis ke DB 9router;
   restart 9router DITOLAK user — ingatkan untuk restart manual).

## Perintah verifikasi cepat

```bash
cd pi && python -m unittest test_guard -v        # harus 9 OK
python -m py_compile *.py training/labeler.py    # harus tanpa error
python training/labeler.py --n 3000 --out data_train.jsonl
node --check ../backend/src/config/mqtt.js
```

## Saran langkah berikutnya (untuk AI lanjut)

1. Minta IP Pi user → ganti `MQTT_BROKER` di `config.h` + `backend/.env`.
2. Saat Pi ada: ikut `pi/README.md` (Mosquitto → Ollama → systemd), benchmark
   `ollama run qwen2.5:1.5b-instruct --verbose`, jalankan T1–T5.
3. Kumpulkan `overrides.jsonl` dari pemakaian real → Fase 2 training LoRA di Colab.
