#ifndef CONFIG_H
#define CONFIG_H

// ============================================================
// KONFIGURASI KANDANG AYAM — ESP32 + DHT22 + 2x MG90S + IR + MQ
// Board: ESP32 DevKit V1 (30 pin). Isi bagian WiFi & MQTT.
// ============================================================

// --- WiFi (pakai 2.4 GHz, hotspot HP juga bisa) ---
#define WIFI_SSID "IOT-ESP"
#define WIFI_PASSWORD "12345678"

// --- MQTT ---
// Opsi A — broker publik gratis (tanpa daftar, cocok dgn backend .env kamu):
#define MQTT_BROKER "broker.emqx.io"
#define MQTT_PORT 1883
#define MQTT_USER ""
#define MQTT_PASS ""
#define MQTT_TLS 0
// Opsi B — Mosquitto lokal di laptop (ganti IP di bawah, PORT 1883, TLS 0)
// #define MQTT_BROKER "192.168.1.6"
// Opsi C — EMQX Cloud / HiveMQ Cloud (PORT 8883, TLS 1, isi USER/PASS)

// --- Device (SAMAKAN dengan backend .env / dashboard) ---
#define DEVICE_ID "esp32-rakit-01"
#define MQTT_TOPIC_DATA "iot/device/esp32-rakit-01/data"
#define MQTT_TOPIC_CMD "iot/device/esp32-rakit-01/cmd"      // web -> ESP32 (perintah atap)
#define MQTT_TOPIC_STATUS "iot/device/esp32-rakit-01/status"

// ============================================================
// PIN (jangan diubah kecuali wiring ikut diubah)
// ============================================================
#define DHT_PIN 14        // DHT22 DATA (dengan resistor pull-up 10k ke 3V3)
#define DHT_TYPE DHT22

#define SERVO_KANAN_PIN 12  // MG90S #1 — sinyal (kabel kuning/oranye)
#define SERVO_KIRI_PIN 13   // MG90S #2 — sinyal (kabel kuning/oranye)
// 1 = mirror (kupu-kupu: kanan 0->90, kiri 90->0). 0 = paralel (sama persis).
#define SERVO_MIRROR 1

#define IR_PAKAN_PIN 27   // FC-51 OUT (digital). LOW = ada pakan di depan sensor.
#define IR_PAKAN_INVERT 0 // 1 = balik logika (jika modul kamu HIGH = ada pakan)

#define MQ_AO_PIN 34      // MQ-135 AO (analog, ADC1 — aman dipakai bareng WiFi)
#define MQ_DO_PIN 35      // MQ-135 DO (digital, opsional — boleh tidak dipasang)

// ============================================================
// LOGIKA ATAP OTOMATIS (hysteresis agar servo tidak getar)
// ============================================================
#define TEMP_BUKA_ATAP 31.0   // suhu >= ini  -> atap BUKA (90°)
#define TEMP_TUTUP_ATAP 28.0  // suhu <= ini  -> atap TUTUP (0°)
#define MANUAL_TIMEOUT_MS 600000UL  // perintah manual dari web berlaku 10 mnt, lalu kembali AUTO

// ============================================================
// KALIBRASI GAS MQ-135 (linear 2 titik — lihat README cara kalibrasi)
// Nilai ADC ESP32: 0..4095. Default di bawah hasil perkiraan umum.
// ============================================================
#define GAS_ADC_BERSIH 300   // ADC di udara bersih  -> dibaca 0 ppm
#define GAS_ADC_KOTOR 2200   // ADC di bau menyengat -> dibaca 100 ppm
#define GAS_MAX_PPM 100.0

// Interval kirim
#define SEND_INTERVAL 5000  // 5 detik

#endif
