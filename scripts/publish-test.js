// publish-test.js - Simulasi kirim data via MQTT (device rakitan)
const mqtt = require('mqtt');

const BROKER = 'mqtt://localhost:1883';
const DEVICE_ID = 'esp32-rakit-01';
const TOPIC = `iot/device/${DEVICE_ID}/data`;

console.log(`🔌 Connect ke ${BROKER}...`);
const client = mqtt.connect(BROKER);

client.on('connect', () => {
  console.log('✅ Connected to MQTT');
  console.log(`📡 Publish ke: ${TOPIC}`);
  console.log('⏱️  Kirim tiap 3 detik. Ctrl+C untuk stop.\n');

  setInterval(() => {
    const data = {
      deviceId: DEVICE_ID,
      suhu: +(25 + Math.random() * 10).toFixed(1),
      kelembapan: +(50 + Math.random() * 30).toFixed(0),
      timestamp: Math.floor(Date.now() / 1000)
    };
    client.publish(TOPIC, JSON.stringify(data));
    console.log('📤 Sent:', data);
  }, 3000);
});

client.on('error', (err) => {
  console.error('❌ MQTT error:', err.message);
  console.error('   Pastikan Mosquitto jalan di port 1883');
  process.exit(1);
});
