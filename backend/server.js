require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');

const connectDB = require('./src/config/database');
const logger = require('./src/config/logger');
const { initMQTT } = require('./src/config/mqtt');
const { initSocket } = require('./src/config/socketio');

// Routes
const authRoutes = require('./src/routes/authRoutes');
const deviceRoutes = require('./src/routes/deviceRoutes');
const dataRoutes = require('./src/routes/dataRoutes');
const alertRoutes = require('./src/routes/alertRoutes');

const errorHandler = require('./src/middlewares/errorHandler');

const app = express();
const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || '*' }
});
app.set('io', io);

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Route default → dashboard 3D baru (frontend/v10.html)
// Dashboard lama tetap bisa diakses via /uiuxbaru
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'v10.html'));
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/alerts', alertRoutes);

app.get('/api', (req, res) => {
  res.json({
    name: 'IoT Web Monitoring API',
    version: '1.0.0',
    status: 'running',
    demoMode: global.DEMO_MODE || false
  });
});

app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    status: 'ok',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    demoMode: global.DEMO_MODE || false,
    uptime: process.uptime()
  });
});

// SPA fallback: all non-API GET returns v10.html
app.get(/^\/(?!api).*/, (req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/socket.io')) return next();
  res.sendFile(path.join(frontendPath, 'v10.html'));
});

// Error handler
app.use(errorHandler);

// Start
const PORT = process.env.PORT || 4000;
global.DEMO_MODE = false;

function startDemoSimulator(io) {
  const { pushData, pushAlert, touchDevice, store } = require('./src/utils/demoStore');
  const { evaluateAlerts } = require('./src/services/alertService');
  logger.warn('DEMO MODE: emitting fake sensor data every 3s (no MongoDB/MQTT needed)');
  const devices = ['esp32-01', 'esp32-02'];
  let tick = 0;
  setInterval(() => {
    tick++;
    const deviceId = devices[tick % devices.length];
    // tiap ~6x emit, buat spike panas >35 agar alert demo terlihat
    const spike = tick % 6 === 0;
    const data = {
      _id: 'demo-live-' + Date.now(),
      deviceId,
      suhu: spike ? 35.5 + Math.random() * 3 : 20 + Math.random() * 12,
      kelembapan: 45 + Math.random() * 30,
      timestamp: new Date()
    };
    pushData(data);
    touchDevice(deviceId);
    io.emit('dataBaru', data);
    io.emit('deviceStatus', { deviceId, status: 'online' });
    const found = evaluateAlerts(data);
    for (const a of found) {
      const alert = { _id: 'demo-a-' + Date.now() + '-' + tick, ...a, deviceId, read: false, timestamp: new Date() };
      pushAlert(alert);
      io.emit('alert', alert);
    }
  }, 3000);
}

async function start() {
  // 1. Listen FIRST so page always loads, even if DB/MQTT down
  server.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });

  initSocket(io);
  logger.info('Socket.IO initialized');

  // 2. Try MongoDB, but don't crash if missing
  try {
    await connectDB();
    logger.info('MongoDB connected');
  } catch (err) {
    global.DEMO_MODE = true;
    logger.warn('MongoDB unavailable, running in DEMO MODE: ' + err.message);
  }

  // 3. Try MQTT, but don't crash if broker missing
  try {
    initMQTT(io);
    logger.info('MQTT init attempted');
  } catch (err) {
    logger.warn('MQTT unavailable: ' + err.message);
  }

  // 4. If demo mode, emit fake data so dashboard is alive
  if (global.DEMO_MODE) startDemoSimulator(io);
}

start();
