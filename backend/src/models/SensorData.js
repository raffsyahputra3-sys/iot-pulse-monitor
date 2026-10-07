const mongoose = require('mongoose');

const SensorDataSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  suhu: { type: Number, required: true },
  kelembapan: { type: Number, required: true },
  // Field tambahan firmware kandang-lengkap (opsional → kompatibel data lama)
  gas: { type: Number, required: false },         // ppm estimasi (MQ-135)
  gasRaw: { type: Number, required: false },     // ADC mentah
  pakan: { type: Number, required: false },       // 1 = ada, 0 = habis (IR)
  pakanPersen: { type: Number, required: false }, // 0..100 untuk grafik
  atap: { type: Number, required: false },        // sudut servo 0..90
  mode: { type: String, required: false },        // "auto" | "manual"
  timestamp: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('SensorData', SensorDataSchema);
