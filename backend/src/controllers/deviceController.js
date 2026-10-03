const Device = require('../models/Device');
const mongoose = require('mongoose');
const { store, touchDevice, save } = require('../utils/demoStore');

function isDbReady() {
  return mongoose.connection.readyState === 1;
}

exports.list = async (req, res) => {
  try {
    if (!isDbReady()) return res.json(store.devices);
    const devices = await Device.find().sort({ lastSeen: -1 });
    res.json(devices);
  } catch (err) {
    res.json(store.devices);
  }
};

exports.create = async (req, res) => {
  try {
    const { deviceId, nama, lokasi } = req.body || {};
    if (!deviceId) return res.status(400).json({ error: 'deviceId wajib diisi' });
    if (!isDbReady()) {
      const d = touchDevice(deviceId);
      if (nama) d.nama = nama;
      if (lokasi) d.lokasi = lokasi;
      save();
      return res.status(201).json(d);
    }
    const device = await Device.create(req.body);
    res.status(201).json(device);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'deviceId sudah ada' });
    res.status(500).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    if (!isDbReady()) {
      const idx = store.devices.findIndex(d => (d._id === req.params.id) || (d.deviceId === req.params.id));
      if (idx === -1) return res.status(404).json({ error: 'Device tidak ditemukan' });
      store.devices.splice(idx, 1);
      save();
      return res.json({ message: 'Deleted (demo)' });
    }
    await Device.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
