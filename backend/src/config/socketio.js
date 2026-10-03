const logger = require('./logger');

function initSocket(io) {
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);
    socket.emit('deviceStatus', { status: 'connected', socketId: socket.id });

    // Terima command dari frontend → forward ke ESP32 via MQTT
    socket.on('command', (cmd) => {
      const { actuator, value, deviceId } = cmd || {};
      logger.info(`Command from socket ${socket.id}: ${actuator} = ${value}`);
      // Forward ke ESP32 via MQTT (topik per-device)
      try {
        const { getClient } = require('./mqtt');
        const client = getClient();
        const target = deviceId || process.env.DEFAULT_DEVICE_ID || 'esp32-01';
        if (client && client.connected) {
          client.publish(`iot/device/${target}/cmd`, JSON.stringify({ actuator, value }));
        } else {
          logger.warn('MQTT client offline — command tidak diteruskan ke ESP32');
        }
      } catch (err) {
        logger.warn('MQTT forward gagal: ' + err.message);
      }
      // Broadcast state update ke semua client
      io.emit('deviceState', { [actuator]: value });
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = { initSocket };
