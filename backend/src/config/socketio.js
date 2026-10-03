const logger = require('./logger');

function initSocket(io) {
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);
    socket.emit('deviceStatus', { status: 'connected', socketId: socket.id });

    // Terima command dari frontend → forward ke ESP32 via MQTT
    socket.on('command', (cmd) => {
      const { actuator, value } = cmd || {};
      logger.info(`Command from socket ${socket.id}: ${actuator} = ${value}`);
      // TODO: jika perlu forward ke ESP32 via MQTT, uncomment baris di bawah:
      // const mqtt = require('./mqtt');
      // const client = mqtt.getClient();
      // if (client && client.connected) {
      //   client.publish('iot/device/esp32-01/cmd', JSON.stringify({ actuator, value }));
      // }
      // Broadcast state update ke semua client
      io.emit('deviceState', { [actuator]: value });
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = { initSocket };
