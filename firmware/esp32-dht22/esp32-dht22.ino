#include <WiFi.h>
#include "config.h"
#if MQTT_TLS
  #include <WiFiClientSecure.h>
  WiFiClientSecure net;
#else
  WiFiClient net;
#endif
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

PubSubClient mqtt(net);
DHT dht(DHT_PIN, DHT_TYPE);

unsigned long lastSend = 0;

void setupWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi");
  int t = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (++t > 40) {
      Serial.println("\nRestart...");
      ESP.restart();
    }
  }
  Serial.println("\nWiFi connected: " + WiFi.localIP().toString());
}

void reconnectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("MQTT connecting...");
    String clientId = "ESP32-" + String(DEVICE_ID) + "-" + String(random(0xffff), HEX);
    if (mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
      Serial.println(" connected");
      mqtt.publish(MQTT_TOPIC_STATUS, "{\"status\":\"online\"}");
    } else {
      Serial.print(" failed, rc=");
      Serial.println(mqtt.state());
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  pinMode(2, OUTPUT); // LED indikator (built-in)
  setupWiFi();
#if MQTT_TLS
  net.setInsecure();  // skip verifikasi sertifikat (praktis untuk demo; produksi: pakai CA cert)
#endif
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setKeepAlive(60);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) setupWiFi(); // auto reconnect WiFi/hotspot
  if (!mqtt.connected()) reconnectMQTT();
  mqtt.loop();

  unsigned long now = millis();
  if (now - lastSend >= SEND_INTERVAL) {
    lastSend = now;

    float suhu = dht.readTemperature();
    float kelembapan = dht.readHumidity();

    if (isnan(suhu) || isnan(kelembapan)) {
      Serial.println("Gagal baca DHT");
      return;
    }

    StaticJsonDocument<200> doc;
    doc["deviceId"] = DEVICE_ID;
    doc["suhu"] = suhu;
    doc["kelembapan"] = kelembapan;
    doc["timestamp"] = millis() / 1000;

    char buffer[256];
    serializeJson(doc, buffer);

    Serial.printf("Kirim: %s\n", buffer);
    mqtt.publish(MQTT_TOPIC_DATA, buffer);
    digitalWrite(2, HIGH);
    delay(100);
    digitalWrite(2, LOW);
  }
}
