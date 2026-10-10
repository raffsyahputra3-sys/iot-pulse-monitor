# AI Kontrol Atap Offline (Kandang Ayam) — Fase 1

Service Raspberry Pi: baca sensor via MQTT lokal, minta saran sudut atap ke LLM
lokal (Ollama), saring lewat guard safety, publish perintah ke ESP32.
Jalan 100% offline kecuali cache cuaca (opsional).

PRD: `docs/PRD-AI-Kontrol-Atap-Offline-V1.md`

## File

| File | Fungsi |
|---|---|
| `config.py` | Threshold + konstanta (samakan firmware `config.h`) |
| `mqtt_listener.py` | Loop utama: subscribe data, panggil facts→advisor→guard, publish cmd |
| `facts.py` | Bangun teks fakta Bahasa Indonesia (LLM tidak menghitung) |
| `advisor.py` | Panggil Ollama `kandang-advisor`, format JSON dipaksa |
| `guard.py` | Safety layer plain Python, veto mutlak atas AI |
| `weather.py` | Cache Open-Meteo, expiry 6 jam, gagal = pakai cache / None |
| `rainsensor.py` | Baca YL-83 via GPIO (`RAIN_ENABLED=0` untuk nonaktifkan) |
| `logger.py` | Append JSONL keputusan + override manual (bahan training Fase 2) |
| `test_guard.py` | Unit test G1–G6 (`python -m unittest test_guard -v`) |
| `Modelfile` | Definisi model Ollama (`ollama create kandang-advisor -f Modelfile`) |
| `kandang-ai.service` | Unit systemd, copy ke `/etc/systemd/system/` |

## Instal di Pi

```bash
# 1. Dependensi
sudo apt install mosquitto python3-pip
pip install -r requirements.txt

# 2. Mosquitto lokal (config repo sudah ada)
sudo cp ../mosquitto/config/mosquitto.conf /etc/mosquitto/mosquitto.conf
sudo systemctl enable --now mosquitto

# 3. Ollama + model (±1 GB, butuh internet sekali saat download)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:1.5b-instruct
ollama create kandang-advisor -f Modelfile

# 4. Service
sudo cp kandang-ai.service /etc/systemd/system/
sudo mkdir -p /opt/kandang && sudo cp -r . /opt/kandang/pi
sudo systemctl enable --now kandang-ai
```

## Wajib ubah agar offline (PRD §8)

1. `firmware/esp32-kandang-lengkap/config.h` → `MQTT_BROKER` = IP Pi
   (contoh Opsi B di baris 21 sudah ada, tinggal aktifkan).
2. `backend/.env` → `MQTT_BROKER=mqtt://<IP-Pi>:1883`.

Tanpa ini ESP32 & backend masih ke `broker.emqx.io` dan mati saat internet putus.
Firmware `.ino` TIDAK perlu diubah (V1 pakai cmd manual + re-send tiap cycle).

## Rain sensor YL-83 (opsional)

- DO modul → GPIO 17 Pi (ubah via `RAIN_GPIO`), VCC 3V3, GND.
- Tanpa sensor / di PC: `read_rain()` balikin `None`, guard hujan di-skip aman.
- Nonaktifkan paksa: `RAIN_ENABLED=0`.

## Data

`data/` berisi `decisions.jsonl` (tiap cycle), `overrides.jsonl` (override
manual = data gold Fase 2), `weather_cache.json`, `window_cache.jsonl`,
`state.json` (sudut + timestamp cmd terakhir).
