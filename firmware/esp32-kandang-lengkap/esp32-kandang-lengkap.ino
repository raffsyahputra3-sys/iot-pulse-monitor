// ============================================================
// KANDANG AYAM IoT — ESP32 DevKit
// DHT22 (suhu/kelembapan) + 2x MG90S (atap) + IR FC-51 (pakan)
// + MQ-135 (gas amonia) -> MQTT -> web monitoring
//
// Library Arduino IDE (Library Manager):
//   - "DHT sensor library" (Adafruit) + "Adafruit Unified Sensor"
//   - "PubSubClient" (Nick O'Leary)
//   - "ArduinoJson" v6 (Benoit Blanchon)
//   - "ESP32Servo" (Kevin Harrington)
// Board: "ESP32 Dev Module". Lihat README.md untuk wiring.
// ============================================================
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
#include <ESP32Servo.h>

PubSubClient mqtt(net);
DHT dht(DHT_PIN, DHT_TYPE);
Servo servoKanan, servoKiri;

int atapAngle = 0;                 // 0 = tutup, 90 = buka penuh
bool modeAuto = true;              // true = ikut suhu, false = manual dari web
unsigned long manualSampai = 0;     // kapan mode manual kedaluwarsa
unsigned long lastSend = 0;
float suhuTerakhir = NAN, humTerakhir = NAN;

// ---------- SERVO ----------
void atapTulis(int sudut) {
  sudut = constrain(sudut, 0, 90);
  int kanan = sudut;
  int kiri  = SERVO_MIRROR ? (90 - sudut) : sudut;
  servoKanan.write(kanan);
  servoKiri.write(kiri);
}

// Gerak halus agar atap tidak menghentak
void atapGerakKe(int target) {
  target = constrain(target, 0, 90);
  int step = (target > atapAngle) ? 1 : -1;
  while (atapAngle != target) {
    atapAngle += step;
    atapTulis(atapAngle);
    delay(20);
  }
}

// ---------- WiFi / MQTT ----------
void setupWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi ...");
  int t = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
    if (++t > 40) { Serial.println("\nRestart..."); ESP.restart(); }
  }
  Serial.println("\nWiFi OK: " + WiFi.localIP().toString());
}

// Perintah dari web: {"actuator":"atap"|"roofWindow"|"roofAngle", "value":0..90|true|false}
// Juga didukung format pendek: {"atap":90} atau {"mode":"auto"}
void mqttCallback(char* topic, byte* payload, unsigned int len) {
  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, payload, len)) { Serial.println("CMD tidak valid"); return; }

  // Format pendek {"atap": n}
  if (doc.containsKey("atap")) {
    int v = doc["atap"];
    modeAuto = false; manualSampai = millis() + MANUAL_TIMEOUT_MS;
    atapGerakKe(v); lastSend = 0;
    Serial.printf("CMD atap -> %d (manual)\n", atapAngle);
    return;
  }
  if (doc.containsKey("mode") && String((const char*)doc["mode"]) == "auto") {
    modeAuto = true;
    Serial.println("CMD mode -> AUTO");
    return;
  }

  String aktuator = doc["actuator"] | "";
  aktuator.toLowerCase();
  if (aktuator == "atap" || aktuator == "roofwindow" || aktuator == "roofangle" ||
      aktuator == "sidewindow" || aktuator == "sideangle") {
    int v;
    if (doc["value"].is<bool>()) v = (bool)doc["value"] ? 90 : 0;
    else v = doc["value"] | atapAngle;
    modeAuto = false; manualSampai = millis() + MANUAL_TIMEOUT_MS;
    atapGerakKe(v); lastSend = 0;  // kirim status terbaru segera
    Serial.printf("CMD %s -> %d (manual)\n", aktuator.c_str(), atapAngle);
  }
}

void reconnectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("MQTT ...");
    String cid = "ESP32-" + String(DEVICE_ID) + "-" + String(random(0xffff), HEX);
    if (mqtt.connect(cid.c_str(), MQTT_USER, MQTT_PASS)) {
      Serial.println(" OK");
      mqtt.subscribe(MQTT_TOPIC_CMD);
      mqtt.publish(MQTT_TOPIC_STATUS, "{\"status\":\"online\"}");
    } else {
      Serial.printf(" gagal rc=%d\n", mqtt.state());
      delay(2000);
    }
  }
}

// ---------- SENSOR ----------
bool bacaDHT(float &suhu, float &hum) {
  suhu = dht.readTemperature();
  hum  = dht.readHumidity();
  return !(isnan(suhu) || isnan(hum));
}

// Rata-rata 10x agar stabil, lalu petakan ke 0..GAS_MAX_PPM
float bacaGas(int &adcOut) {
  long sum = 0;
  for (int i = 0; i < 10; i++) { sum += analogRead(MQ_AO_PIN); delay(5); }
  adcOut = sum / 10;
  int cl = constrain(adcOut, GAS_ADC_BERSIH, GAS_ADC_KOTOR);
  return (float)(cl - GAS_ADC_BERSIH) * GAS_MAX_PPM / (float)(GAS_ADC_KOTOR - GAS_ADC_BERSIH);
}

// true = pakan TERDETEKSI (wadah ada isi). FC-51: LOW = ada objek.
bool bacaPakan() {
  int v = digitalRead(IR_PAKAN_PIN);
  bool ada = (v == LOW);
  return IR_PAKAN_INVERT ? !ada : ada;
}

// ---------- SETUP / LOOP ----------
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== Kandang Ayam IoT ===");

  dht.begin();
  pinMode(IR_PAKAN_PIN, INPUT);
  pinMode(MQ_DO_PIN, INPUT);
  pinMode(2, OUTPUT);

  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  servoKanan.setPeriodHertz(50);
  servoKiri.setPeriodHertz(50);
  servoKanan.attach(SERVO_KANAN_PIN, 500, 2400);
  servoKiri.attach(SERVO_KIRI_PIN, 500, 2400);
  atapTulis(atapAngle);  // mulai tertutup

  analogSetAttenuation(ADC_11db);  // ADC 0..3,3V penuh

  setupWiFi();
#if MQTT_TLS
  net.setInsecure();  // demo; produksi: pasang CA cert
#endif
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setKeepAlive(60);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) setupWiFi();
  if (!mqtt.connected()) reconnectMQTT();
  mqtt.loop();

  // Manual kedaluwarsa -> kembali AUTO
  if (!modeAuto && (long)(millis() - manualSampai) >= 0) {
    modeAuto = true;
    Serial.println("Mode kembali AUTO");
  }

  if (millis() - lastSend < SEND_INTERVAL) return;
  lastSend = millis();

  float suhu, hum;
  if (!bacaDHT(suhu, hum)) { Serial.println("Gagal baca DHT"); return; }
  suhuTerakhir = suhu; humTerakhir = hum;

  // Atap otomatis (hysteresis)
  if (modeAuto) {
    if (suhu >= TEMP_BUKA_ATAP && atapAngle != 90)       { atapGerakKe(90); Serial.println("AUTO: panas -> atap BUKA"); }
    else if (suhu <= TEMP_TUTUP_ATAP && atapAngle != 0)  { atapGerakKe(0);  Serial.println("AUTO: adem -> atap TUTUP"); }
  }

  int gasAdc; float gasPpm = bacaGas(gasAdc);
  bool pakanAda = bacaPakan();

  // JSON — field suhu/kelembapan TETAP (kompatibel dgn web lama),
  // field gas/pakan/atap DITAMBAHKAN (dibaca web baru).
  StaticJsonDocument<320> doc;
  doc["deviceId"]   = DEVICE_ID;
  doc["suhu"]       = round(suhu * 10) / 10.0;
  doc["kelembapan"] = round(hum * 10) / 10.0;
  doc["gas"]        = round(gasPpm * 10) / 10.0;
  doc["gasRaw"]     = gasAdc;
  doc["pakan"]      = pakanAda ? 1 : 0;
  doc["pakanPersen"] = pakanAda ? 100 : 15;
  doc["atap"]       = atapAngle;
  doc["mode"]       = modeAuto ? "auto" : "manual";
  doc["timestamp"]  = millis() / 1000;

  char buf[384];
  serializeJson(doc, buf);
  Serial.println(buf);
  mqtt.publish(MQTT_TOPIC_DATA, buf);

  digitalWrite(2, HIGH); delay(80); digitalWrite(2, LOW);
}
