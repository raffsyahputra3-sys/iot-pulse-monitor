"""Konstanta service AI atap. Angka threshold disamakan firmware config.h
plus guard safety dari PRD §6. Sumber pedoman unggas dicatat di komentar."""

import os

DEVICE_ID = os.getenv("DEVICE_ID", "esp32-rakit-01")
MQTT_HOST = os.getenv("MQTT_HOST", "127.0.0.1")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
TOPIC_DATA = f"iot/device/{DEVICE_ID}/data"
TOPIC_CMD = f"iot/device/{DEVICE_ID}/cmd"
TOPIC_AI = f"iot/device/{DEVICE_ID}/ai"  # keputusan AI -> dashboard

# Hysteresis firmware (config.h). Jangan diubah tanpa ubah firmware.
TEMP_HI = 31.0   # >= ini firmware buka atap 90
TEMP_LO = 28.0   # <= ini firmware tutup atap 0

# Guard darurat (§6.1). Panas ekstrem: ayam dewasa mulai panting berat
# di atas ~32-35 C (Poultry Hub Australia, "Climate in Poultry Houses";
# zona nyaman ayam dewasa 18-24 C). 34 C dipilih sebagai batas buka penuh.
TEMP_EXTREME = 34.0

# NH3 (amonia). Pedoman umum kandang: <10 ppm ideal, 25 ppm batas
# peringatan, >=40 ppm berbahaya bagi saluran napas unggas
# (Ross/Cobb broiler management guides; PRD §5.2).
GAS_WARN = 25.0
GAS_DANGER = 40.0

# Kelembapan nyaman 50-70% (PRD §7.4). Dipakai facts, bukan guard.
HUM_LO, HUM_HI = 50.0, 70.0

WINDOW_SECONDS = 600          # rolling window 10 menit
SENSOR_PERIOD_S = 5           # interval publish ESP32
LOOP_SECONDS = 90             # decision loop 60-120 dtk (§3)
RESEND_SECONDS = 480          # re-publish cmd tiap <=8 menit (§6.4)
MAX_STEP = 30                 # batas perubahan sudut per cycle (§6.3)
ANGLE_STEP = 15               # snap kelipatan 15

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "kandang-advisor")
OLLAMA_TIMEOUT_S = 60

WEATHER_LAT = float(os.getenv("WEATHER_LAT", "-6.2"))
WEATHER_LON = float(os.getenv("WEATHER_LON", "106.8"))
WEATHER_MAX_AGE_MIN = 360     # cache cuaca valid 6 jam (§2)

# Rain sensor YL-83 via GPIO Pi. Aktif LOW saat basah (modul DO).
RAIN_GPIO = int(os.getenv("RAIN_GPIO", "17"))
RAIN_ENABLED = os.getenv("RAIN_ENABLED", "1") == "1"

DATA_DIR = os.getenv("PI_DATA_DIR", os.path.join(os.path.dirname(__file__), "data"))
WINDOW_CACHE = os.path.join(DATA_DIR, "window_cache.jsonl")
DECISION_LOG = os.path.join(DATA_DIR, "decisions.jsonl")
OVERRIDE_LOG = os.path.join(DATA_DIR, "overrides.jsonl")
WEATHER_CACHE = os.path.join(DATA_DIR, "weather_cache.json")
STATE_FILE = os.path.join(DATA_DIR, "state.json")
