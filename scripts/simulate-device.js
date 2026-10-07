// Simulasi device kirim data via MQTT (buat testing tanpa ESP32)
const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://localhost:1883');

client.on('connect', () => {
  console.log('Connected to MQTT');
  setInterval(() => {
    const data = {
      deviceId: 'esp32-01',
      suhu: 20 + Math.random() * 20,
      kelembapan: 40 + Math.random() * 50,
      timestamp: Math.floor(Date.now() / 1000)
    };
    client.publish('iot/device/esp32-01/data', JSON.stringify(data));
    console.log('Sent:', data);
  }, 3000);
});
