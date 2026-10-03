const Alert = require('../models/Alert');
const mongoose = require('mongoose');
const { store, save } = require('../utils/demoStore');

function isDbReady() {
  return mongoose.connection.readyState === 1;
}

exports.list = async (req, res) => {
  try {
    if (!isDbReady()) {
      let arr = [...store.alerts];
      if (req.query.deviceId) arr = arr.filter(a => a.deviceId === req.query.deviceId);
      if (req.query.unread === 'true') arr = arr.filter(a => !a.read);
      return res.json(arr.slice(0, 100));
    }
    const alerts = await Alert.find().sort({ timestamp: -1 }).limit(100);
    res.json(alerts);
  } catch (err) {
    res.json([]);
  }
};

exports.markRead = async (req, res) => {
  try {
    if (!isDbReady()) {
      const a = store.alerts.find(x => x._id === req.params.id);
      if (!a) return res.status(404).json({ error: 'Alert tidak ditemukan' });
      a.read = true;
      save();
      return res.json({ message: 'Marked as read (demo)' });
    }
    await Alert.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
