const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', '.demo-db.json');

const store = {
  devices: [
    { _id: 'demo-1', deviceId: 'esp32-01', nama: 'Sensor Ruang Tamu', lokasi: 'Jakarta', status: 'online', lastSeen: new Date() },
    { _id: 'demo-2', deviceId: 'esp32-02', nama: 'Sensor Kamar', lokasi: 'Jakarta', status: 'online', lastSeen: new Date() }
  ],
  sensorData: [],
  alerts: [],
  users: [
    // password: admin123 (bcrypt hash, generated once; fallback plain compare in demo)
    { _id: 'demo-u1', username: 'admin', passwordHash: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', role: 'admin' }
  ]
};

// seed awal 20 data biar grafik langsung isi
(function seed() {
  const now = Date.now();
  for (let i = 20; i >= 1; i--) {
    store.sensorData.push({
      _id: 'demo-init-' + i,
      deviceId: i % 3 === 0 ? 'esp32-02' : 'esp32-01',
      suhu: 22 + Math.random() * 10,
      kelembapan: 50 + Math.random() * 25,
      timestamp: new Date(now - i * 60000)
    });
  }
  tryLoad();
})();

function tryLoad() {
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      if (Array.isArray(raw.sensorData)) {
        // gabung: file first (lebih baru), lalu seed — batasi 500
        const seen = new Set(raw.sensorData.map(d => d._id));
        const extra = store.sensorData.filter(d => !seen.has(d._id));
        store.sensorData = [...raw.sensorData, ...extra].slice(0, 500);
      }
      if (Array.isArray(raw.alerts)) store.alerts = raw.alerts.slice(0, 200);
      if (Array.isArray(raw.devices) && raw.devices.length) store.devices = raw.devices;
    }
  } catch (_) { /* abaikan, pakai seed */ }
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(FILE, JSON.stringify({
        devices: store.devices,
        sensorData: store.sensorData.slice(0, 500),
        alerts: store.alerts.slice(0, 200)
      }, null, 1));
    } catch (_) { /* demo file opsional */ }
  }, 500);
}

function pushData(doc) {
  store.sensorData.unshift(doc);
  if (store.sensorData.length > 500) store.sensorData.length = 500;
  save();
  return doc;
}

function pushAlert(alert) {
  store.alerts.unshift(alert);
  if (store.alerts.length > 200) store.alerts.length = 200;
  save();
  return alert;
}

function touchDevice(deviceId) {
  let d = store.devices.find(x => x.deviceId === deviceId);
  if (!d) {
    d = { _id: 'demo-' + Date.now(), deviceId, nama: 'Device ' + deviceId, lokasi: '-', status: 'online', lastSeen: new Date() };
    store.devices.push(d);
  } else {
    d.status = 'online';
    d.lastSeen = new Date();
  }
  save();
  return d;
}

module.exports = { store, pushData, pushAlert, touchDevice, save };
