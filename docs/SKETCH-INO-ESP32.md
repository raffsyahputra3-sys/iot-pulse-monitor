# Bedah Sketch INO — `firmware/esp32-kandang-lengkap/`

File: `esp32-kandang-lengkap.ino` (217 baris) + `config.h` (65 baris).
Board Arduino IDE: **ESP32 Dev Module**, baud Serial **115200**.
Library: Adafruit `DHT sensor` + `Adafruit Unified Sensor`, `PubSubClient`, `ArduinoJson` v6, `ESP32Servo`.

## 1. `config.h` — semua yang boleh kamu ubah

| Bagian | Isi | Default |
|---|---|---|
| WiFi | `WIFI_SSID/PASSWORD` | `IOT-ESP` / `12345678` (2.4 GHz) |
| MQTT | `MQTT_BROKER/PORT/USER/PASS/TLS` | `broker.emqx.io:1883`, TLS 0 |
| Device | `DEVICE_ID`, `MQTT_TOPIC_DATA/CMD/STATUS` | `esp32-rakit-01` |
| Pin | `DHT_PIN 14`, `SERVO_KANAN 12`, `SERVO_KIRI 13`, `IR 27`, `MQ_AO 34`, `MQ_DO 35` | jangan ubah kecuali wiring ikut |
| Servo | `SERVO_MIRROR 1` | 1=kupu-kupu, 0=paralel |
| Atap auto | `TEMP_BUKA 31`, `TEMP_TUTUP 28`, `MANUAL_TIMEOUT 600000` (10 mnt) | hysteresis anti-getar |
| Gas | `GAS_ADC_BERSIH 300`, `GAS_ADC_KOTOR 2200`, `GAS_MAX 100` | kalibrasi 2 titik |
| Interval | `SEND_INTERVAL 5000` | kirim tiap 5 detik |

## 2. Alur `setup()` (baris 141-168)

1. `Serial.begin(115200)`, `dht.begin()`, `pinMode(IR, INPUT)`, `pinMode(MQ_DO, INPUT)`, LED GPIO2 OUTPUT.
2. Servo: `allocateTimer(0/1)`, `setPeriodHertz(50)`, `attach(pin, 500, 2400)`, mulai tertutup `atapTulis(0)`.
3. `analogSetAttenuation(ADC_11db)` → ADC baca penuh 0-3.3V.
4. `setupWiFi()` (retry 40x lalu restart), set MQTT server + callback + keepalive 60.

## 3. Alur `loop()` (baris 170-217)

```
cek WiFi → cek MQTT → mqtt.loop()
→ manual expired? kembali AUTO
→ tiap 5 detik:
   bacaDHT (gagal? skip kirim)
   logika atap AUTO (hysteresis)
   bacaGas (rata-rata 10x) + bacaPakan
   rakit JSON → publish TOPIC_DATA → kedip LED
```

## 4. Fungsi Penting

- `atapTulis(sudut)` — tulis kedua servo, kiri di-mirror bila `SERVO_MIRROR=1` (baris 37-43).
- `atapGerakKe(target)` — jalan halus 1°/20 ms agar atap tidak menghentak (46-54).
- `mqttCallback()` (71-100) — terima perintah web:
  - `{"atap":90}` → manual + gerak.
  - `{"mode":"auto"}` → kembali auto.
  - `{"actuator":"atap|roofWindow|roofAngle|sideWindow|sideAngle","value":0-90|bool}` → manual 10 menit.
- `reconnectMQTT()` (102-115) — clientId acak, subscribe CMD, publish `status online`.
- `bacaDHT()` (118-122) — return false bila `nan`.
- `bacaGas(adcOut)` (125-131) — rata-rata 10x `analogRead(34)`, petakan linear BERSIH→KOTOR ke 0→100 ppm.
- `bacaPakan()` (134-138) — `digitalRead(27)`; LOW=ada; hormati `IR_PAKAN_INVERT`.

## 5. Format JSON

Kirim (DATA):
```json
{"deviceId":"esp32-rakit-01","suhu":30.5,"kelembapan":65,"gas":12.3,"gasRaw":512,"pakan":1,"pakanPersen":100,"atap":90,"mode":"auto","timestamp":123}
```
Terima (CMD): contoh `{"actuator":"atap","value":90}` untuk buka penuh, `{"actuator":"atap","value":false}` untuk tutup.

## 6. Cara Upload & Uji

1. Install 4 library di atas via Library Manager.
2. Edit `config.h`: WiFi + broker (samakan dengan backend `.env`).
3. Upload → Serial Monitor 115200 → harus ada `WiFi OK`, `MQTT OK`, JSON tiap 5 detik.
4. Tutup IR dengan tangan → `pakan` 1→0. Dekatkan bau ke MQ → `gas` naik. Panaskan DHT → atap buka.
5. Kalau `Gagal baca DHT`: cek R 10k + kabel GPIO14. Kalau servo diam: cek adaptor 5V + common GND.
