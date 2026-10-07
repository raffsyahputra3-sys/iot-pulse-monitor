# ESP32 + DHT22 Firmware

## Hardware
- ESP32 DevKit
- Sensor DHT22
- Kabel jumper

## Wiring
| DHT22 | ESP32 |
|-------|-------|
| VCC   | 3.3V  |
| GND   | GND   |
| DATA  | GPIO4 |

## Library (Arduino IDE)
- DHT sensor library (Adafruit)
- PubSubClient (Nick O'Leary)
- ArduinoJson (Benoit Blanchon)

## Konfigurasi
Edit `config.h`:
- WIFI_SSID
- WIFI_PASSWORD
- MQTT_BROKER (IP server)

## Upload
1. Buka di Arduino IDE
2. Pilih board: ESP32 Dev Module
3. Pilih port COM
4. Upload
