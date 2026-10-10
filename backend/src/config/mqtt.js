const mqtt = require('mqtt');
const logger = require('./logger');
const SensorData = require('../models/SensorData');
const Device = require('../models/Device');
const { checkAlerts } = require('../services/alertService');

let client;

function initMQTT(io) {
  const broker = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
  const topic = process.env.MQTT_TOPIC || 'iot/device/+/data';
  // Kanal keputusan AI dari service Pi (PRD AI-Atap §5.5): iot/device/+/ai
  const aiTopic = 'iot/device/+/ai';

  const options = {
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    reconnectPeriod: 5000,
    connectTimeout: 30000,
    keepalive: 60
  };

  // Broker cloud TLS (mqtts://, mis. EMQX Serverless / HiveMQ Cloud):
  // sertifikat publik valid → verifikasi tetap aktif (aman).
  logger.info(`Connecting to MQTT: ${broker}`);
  client = mqtt.connect(broker, options);

  client.on('connect', () => {
    logger.info(`MQTT connected to ${broker}`);
    client.subscribe(topic, (err) => {
      if (err) logger.error('MQTT subscribe error:', err);
      else logger.info(`MQTT subscribed: ${topic}`);
    });
    client.subscribe(aiTopic, (err) => {
      if (err) logger.error('MQTT subscribe error:', err);
      else logger.info(`MQTT subscribed: ${aiTopic}`);
    });
  });

  client.on('message', async (topic, message) => {
    // Keputusan AI dari Pi → teruskan ke dashboard via Socket.IO, tanpa DB.
    if (topic.endsWith('/ai')) {
      try {
        const ai = JSON.parse(message.toString());
        io.emit('aiKeputusan', ai);
      } catch (err) {
        logger.warn('AI message parse error: ' + err.message);
      }
      return;
    }
    try {
      const payload = JSON.parse(message.toString());
      logger.info(`MQTT message: ${topic}`, payload);

      const doc = {
        deviceId: payload.deviceId,
        suhu: payload.suhu,
        kelembapan: payload.kelembapan,
        // Field tambahan (hanya disimpan jika ESP32 mengirimnya)
        ...(payload.gas != null ? { gas: Number(payload.gas) } : {}),
        ...(payload.gasRaw != null ? { gasRaw: Number(payload.gasRaw) } : {}),
        ...(payload.pakan != null ? { pakan: Number(payload.pakan) } : {}),
        ...(payload.pakanPersen != null ? { pakanPersen: Number(payload.pakanPersen) } : {}),
        ...(payload.atap != null ? { atap: Number(payload.atap) } : {}),
        ...(payload.mode != null ? { mode: String(payload.mode) } : {}),
        timestamp: payload.timestamp ? new Date(payload.timestamp * 1000) : new Date()
      };

      // Simpan ke DB (skip if DB down)
      let data = doc;
      try {
        data = await SensorData.create(doc);
        await Device.findOneAndUpdate(
          { deviceId: payload.deviceId },
          { status: 'online', lastSeen: new Date() },
          { upsert: true }
        );
      } catch (dbErr) {
        logger.warn('DB save skipped (demo mode): ' + dbErr.message);
      }

      // Emit ke frontend
      io.emit('dataBaru', data);
      io.emit('deviceStatus', { deviceId: payload.deviceId, status: 'online' });

      // Cek alert
      try {
        await checkAlerts(data, io);
      } catch (alertErr) {
        logger.warn('checkAlerts skipped: ' + alertErr.message);
      }
    } catch (err) {
      logger.error('MQTT message handler error:', err);
    }
  });

  client.on('error', (err) => logger.error('MQTT error:', err));
  client.on('reconnect', () => logger.warn('MQTT reconnecting...'));
  client.on('offline', () => logger.warn('MQTT offline'));
}

module.exports = { initMQTT, getClient: () => client };
