const logger = require('../config/logger');

function thresholds() {
  return {
    tempMax: parseFloat(process.env.ALERT_TEMP_MAX) || 35,
    tempMin: parseFloat(process.env.ALERT_TEMP_MIN) || 15,
    humMax: parseFloat(process.env.ALERT_HUMIDITY_MAX) || 85,
    humMin: parseFloat(process.env.ALERT_HUMIDITY_MIN) || 30
  };
}

function evaluateAlerts(data) {
  const { tempMax, tempMin, humMax, humMin } = thresholds();
  const out = [];
  if (data.suhu != null) {
    if (data.suhu > tempMax) out.push({ tipe: 'suhu', nilai: data.suhu, pesan: `Suhu tinggi: ${Number(data.suhu).toFixed(1)}C (device ${data.deviceId})`, level: 'danger' });
    else if (data.suhu < tempMin) out.push({ tipe: 'suhu', nilai: data.suhu, pesan: `Suhu rendah: ${Number(data.suhu).toFixed(1)}C (device ${data.deviceId})`, level: 'warning' });
  }
  if (data.kelembapan != null) {
    if (data.kelembapan > humMax) out.push({ tipe: 'kelembapan', nilai: data.kelembapan, pesan: `Kelembapan tinggi: ${Number(data.kelembapan).toFixed(0)}% (device ${data.deviceId})`, level: 'warning' });
    else if (data.kelembapan < humMin) out.push({ tipe: 'kelembapan', nilai: data.kelembapan, pesan: `Kelembapan rendah: ${Number(data.kelembapan).toFixed(0)}% (device ${data.deviceId})`, level: 'warning' });
  }
  return out;
}

async function checkAlerts(data, io) {
  const found = evaluateAlerts(data);
  if (!found.length) return [];
  const mongoose = require('mongoose');
  const isDbReady = mongoose.connection.readyState === 1;
  const results = [];
  for (const a of found) {
    const base = { ...a, deviceId: data.deviceId, read: false, timestamp: new Date() };
    if (isDbReady) {
      try {
        const Alert = require('../models/Alert');
        const saved = await Alert.create(base);
        logger.warn(`Alert: ${a.pesan}`);
        if (io) io.emit('alert', saved);
        results.push(saved);
        continue;
      } catch (e) {
        logger.warn('Alert DB save gagal, fallback demo: ' + e.message);
      }
    }
    // DEMO MODE: simpan di memori + tetap emit
    try {
      const { pushAlert } = require('../utils/demoStore');
      const demo = { _id: 'demo-a-' + Date.now() + '-' + Math.floor(Math.random() * 1e6), ...base };
      pushAlert(demo);
      logger.warn(`Alert (demo): ${a.pesan}`);
      if (io) io.emit('alert', demo);
      results.push(demo);
    } catch (e) {
      logger.warn('Alert demo save gagal: ' + e.message);
      if (io) io.emit('alert', base);
      results.push(base);
    }
  }
  return results;
}

module.exports = { checkAlerts, evaluateAlerts };
