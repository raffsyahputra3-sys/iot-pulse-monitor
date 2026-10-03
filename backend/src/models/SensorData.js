const mongoose = require('mongoose');

const SensorDataSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  suhu: { type: Number, required: true },
  kelembapan: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('SensorData', SensorDataSchema);
