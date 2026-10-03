const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  deviceId: String,
  tipe: { type: String, enum: ['suhu', 'kelembapan'] },
  nilai: Number,
  pesan: String,
  level: { type: String, enum: ['info', 'warning', 'danger'], default: 'warning' },
  read: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Alert', AlertSchema);
