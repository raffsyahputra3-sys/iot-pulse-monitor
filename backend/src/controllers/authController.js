const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { store } = require('../utils/demoStore');

function isDbReady() {
  return mongoose.connection.readyState === 1;
}

function sign(user) {
  return jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    process.env.JWT_SECRET || 'demo-secret-change-me',
    { expiresIn: process.env.JWT_EXPIRES || '7d' }
  );
}

exports.register = async (req, res, next) => {
  try {
    const { username, password, role } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username & password wajib diisi' });
    if (String(password).length < 6) return res.status(400).json({ error: 'password minimal 6 karakter' });
    if (!isDbReady()) {
      if (store.users.find(u => u.username === username)) return res.status(409).json({ error: 'username sudah ada (demo)' });
      const hash = await bcrypt.hash(password, 10);
      const user = { _id: 'demo-u-' + Date.now(), username, passwordHash: hash, role: role === 'admin' ? 'admin' : 'user' };
      store.users.push(user);
      return res.status(201).json({ message: 'User created (demo)', id: user._id });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hash, role: role === 'admin' ? 'admin' : undefined });
    res.status(201).json({ message: 'User created', id: user._id });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'username sudah ada' });
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username & password wajib diisi' });
    if (!isDbReady()) {
      const user = store.users.find(u => u.username === username);
      if (!user) return res.status(401).json({ error: 'User tidak ditemukan (demo). Default: admin / admin123' });
      let ok = false;
      try { ok = await bcrypt.compare(password, user.passwordHash); } catch (_) { ok = false; }
      // fallback: seed awal hash pakai 'password' -> izinkan admin123 juga di demo
      if (!ok && username === 'admin' && password === 'admin123') ok = true;
      if (!ok) return res.status(401).json({ error: 'Password salah' });
      const token = sign(user);
      return res.json({ token, user: { id: user._id, username: user.username, role: user.role }, demo: true });
    }
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: 'User not found' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Wrong password' });

  const token = jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '7d' }
  );

  res.json({ token, user: { id: user._id, username: user.username, role: user.role } });
  } catch (err) {
    next(err);
  }
};
