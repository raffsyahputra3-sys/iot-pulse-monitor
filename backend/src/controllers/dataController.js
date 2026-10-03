const SensorData = require('../models/SensorData');
const mongoose = require('mongoose');
const { store, pushData, touchDevice } = require('../utils/demoStore');

function isDbReady() {
  return mongoose.connection.readyState === 1;
}

function filterDemo({ limit = 50, deviceId, from, to }) {
  let arr = [...store.sensorData];
  if (deviceId) arr = arr.filter(d => d.deviceId === deviceId);
  if (from) { const f = new Date(from); arr = arr.filter(d => new Date(d.timestamp) >= f); }
  if (to) { const t = new Date(to); arr = arr.filter(d => new Date(d.timestamp) <= t); }
  return arr.slice(0, Math.min(parseInt(limit) || 50, 500));
}

exports.list = async (req, res) => {
  try {
    if (!isDbReady()) return res.json(filterDemo(req.query));
    const { limit = 50, deviceId, from, to } = req.query;
    const filter = {};
    if (deviceId) filter.deviceId = deviceId;
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }
    const data = await SensorData.find(filter).sort({ timestamp: -1 }).limit(parseInt(limit));
    res.json(data);
  } catch (err) {
    res.json(filterDemo(req.query));
  }
};

exports.latest = async (req, res) => {
  try {
    if (!isDbReady()) {
      // terbaru per device dari demo store
      const seen = new Map();
      for (const d of store.sensorData) if (!seen.has(d.deviceId)) seen.set(d.deviceId, d);
      return res.json([...seen.values()]);
    }
    const data = await SensorData.aggregate([
      { $sort: { timestamp: -1 } },
      { $group: { _id: '$deviceId', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } }
    ]);
    res.json(data);
  } catch (err) {
    const seen = new Map();
    for (const d of store.sensorData) if (!seen.has(d.deviceId)) seen.set(d.deviceId, d);
    res.json([...seen.values()]);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { deviceId, suhu, kelembapan, timestamp } = req.body || {};
    if (!deviceId || suhu == null || kelembapan == null) {
      return res.status(400).json({ error: 'deviceId, suhu, kelembapan wajib diisi' });
    }
    if (typeof suhu !== 'number' || typeof kelembapan !== 'number' || Number.isNaN(suhu) || Number.isNaN(kelembapan)) {
      return res.status(400).json({ error: 'suhu & kelembapan harus angka' });
    }
    if (!isDbReady()) {
      const io = req.app.get('io');
      const data = pushData({ _id: 'demo-' + Date.now(), deviceId, suhu, kelembapan, timestamp: timestamp ? new Date(timestamp) : new Date() });
      touchDevice(deviceId);
      if (io) {
        io.emit('dataBaru', data);
        io.emit('deviceStatus', { deviceId, status: 'online' });
        try {
          const { checkAlerts } = require('../services/alertService');
          await checkAlerts(data, io);
        } catch (_) { /* abaikan */ }
      }
      return res.status(201).json(data);
    }
    const data = await SensorData.create({ deviceId, suhu, kelembapan, timestamp: timestamp ? new Date(timestamp) : new Date() });
    const io = req.app.get('io');
    if (io) {
      io.emit('dataBaru', data);
      try {
        const { checkAlerts } = require('../services/alertService');
        await checkAlerts(data.toObject ? data.toObject() : data, io);
      } catch (_) { /* abaikan */ }
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
