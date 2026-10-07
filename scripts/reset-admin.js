// reset-admin.js - sekali pakai: set password admin baru di Atlas
const mongoose = require('../backend/node_modules/mongoose');
const bcrypt = require('../backend/node_modules/bcryptjs');

async function main() {
  const uri = process.env.MONGODB_URI;
  const pass = process.env.NEWPASS;
  if (!uri || !pass) throw new Error('MONGODB_URI / NEWPASS belum di-set');
  await mongoose.connect(uri);
  const hash = await bcrypt.hash(pass, 10);
  await mongoose.connection.db.collection('users').findOneAndUpdate(
    { username: 'admin' },
    { $set: { password: hash } },
    { upsert: true }
  );
  console.log('password admin updated');
  await mongoose.disconnect();
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
