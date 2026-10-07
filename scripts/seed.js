// Seed admin user + dummy device
require('dotenv').config({ path: '../backend/.env' });
// WAJIB pakai instance mongoose milik backend (bukan scripts/),
// karena model-model di bawah terikat ke instance itu.
const mongoose = require('../backend/node_modules/mongoose');
const bcrypt = require('bcryptjs');

const User = require('../backend/src/models/User');
const Device = require('../backend/src/models/Device');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iotdb');

  const hash = await bcrypt.hash('admin123', 10);
  await User.findOneAndUpdate(
    { username: 'admin' },
    { username: 'admin', password: hash, role: 'admin' },
    { upsert: true }
  );
  console.log('Admin user created: admin / admin123');

  await Device.findOneAndUpdate(
    { deviceId: 'esp32-rakit-01' },
    { deviceId: 'esp32-rakit-01', nama: 'Sensor Rakitan', lokasi: 'Rumah' },
    { upsert: true }
  );
  console.log('Dummy device created');

  await mongoose.disconnect();
  console.log('Seed selesai!');
}

seed().catch(err => { console.error(err); process.exit(1); });
