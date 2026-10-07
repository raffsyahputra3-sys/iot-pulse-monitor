#ifndef CONFIG_H
#define CONFIG_H

// WiFi — isi nama hotspot / WiFi 2.4 GHz kamu
#define WIFI_SSID "IOT-ESP"
#define WIFI_PASSWORD "12345678"

// MQTT
// Lokal (Mosquitto di laptop / VM RAW):
//   #define MQTT_BROKER "192.168.1.6"
//   #define MQTT_PORT 1883
//   #define MQTT_TLS 0
// Cloud EMQX Serverless / HiveMQ Cloud (untuk hosting hybrid):
//   #define MQTT_BROKER "xxxxx.emqx.cloud"
//   #define MQTT_PORT 8883
//   #define MQTT_USER "username_emqx"
//   #define MQTT_PASS "password_emqx"
//   #define MQTT_TLS 1
#define MQTT_BROKER "broker.emqx.io"  // broker publik gratis (tanpa daftar)
#define MQTT_PORT 1883
#define MQTT_USER ""
#define MQTT_PASS ""
#define MQTT_TLS 0  // 1 = TLS (port 8883, HiveMQ Cloud), 0 = tanpa TLS

// Device (samakan dengan dashboard publik)
#define DEVICE_ID "esp32-rakit-01"
#define MQTT_TOPIC_DATA "iot/device/esp32-rakit-01/data"
#define MQTT_TOPIC_STATUS "iot/device/esp32-rakit-01/status"

// Sensor (DATA dipindah dari GPIO4 ke GPIO14)
#define DHT_PIN 14
#define DHT_TYPE DHT22

// Interval
#define SEND_INTERVAL 5000  // 5 detik

#endif
