// connector.js — Bridge antara frontend v10 dan backend Socket.IO
// Mapping: backend kirim {suhu, kelembapan}, frontend expect {temp, humid}
class BackendConnector {
  constructor(url) {
    // Default: same-origin saat di-serve backend (production); localhost hanya fallback dev file://
    this.url = url || ((location.protocol === 'http:' || location.protocol === 'https:') ? location.origin : 'http://localhost:4000');
    this.socket = null;
    this.sensorCb = null;
    this.deviceCb = null;
    this.statusCb = null;
    this.connected = false;
    this.device = {
      roofWindow: false, sideWindow: false, conveyor: false, lights: false,
      roofAngle: 0, sideAngle: 0, conveyorRpm: 0, lightBrightness: 100
    };
  }

  async connect() {
    if (this.statusCb) this.statusCb('connecting', 'socketio');

    if (typeof io === 'undefined') {
      console.error('[connector] Socket.IO client belum di-load. Cek <script src="/socket.io/socket.io.js">');
      if (this.statusCb) this.statusCb('disconnected', 'socketio');
      return;
    }

    this.socket = io(this.url, { transports: ['websocket', 'polling'] });

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('[connector] Connected ke backend', this.url);
      if (this.statusCb) this.statusCb('connected', 'socketio');
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      console.warn('[connector] Disconnect:', reason);
      if (this.statusCb) this.statusCb('disconnected', 'socketio');
    });

    this.socket.on('connect_error', (err) => {
      this.connected = false;
      console.error('[connector] Connect error:', err.message);
      if (this.statusCb) this.statusCb('error', 'socketio');
    });

    // Event dari backend: 'dataBaru' → {suhu, kelembapan, timestamp}
    this.socket.on('dataBaru', (payload) => {
      if (!this.sensorCb) return;
      const sensor = {
        temp:   payload.suhu      != null ? payload.suhu      : null,
        humid:  payload.kelembapan != null ? payload.kelembapan : null,
        gas:    payload.gas       != null ? payload.gas       : null,
        feed:   payload.feed      != null ? payload.feed      : null
      };
      this.sensorCb(sensor);
    });

    // Device state update dari backend (teruskan delta apa adanya, jangan full internal)
    this.socket.on('deviceState', (state) => {
      Object.assign(this.device, state);
      if (this.deviceCb) this.deviceCb(state);
    });

    // Device status (online/offline)
    this.socket.on('deviceStatus', (d) => {
      if (this.statusCb) this.statusCb(d.status === 'online' ? 'connected' : 'offline', 'mqtt');
    });
  }

  onSensor(cb) { this.sensorCb = cb; }
  onDevice(cb) { this.deviceCb = cb; }
  onStatus(cb) { this.statusCb = cb; }

  // Kirim command ke backend (deviceId opsional; default esp32-01, bisa dioverride via source.defaultDeviceId)
  sendCommand(actuator, value, deviceId) {
    this.device[actuator] = value;
    if (this.socket && this.socket.connected) {
      this.socket.emit('command', { actuator, value, deviceId: deviceId || this.defaultDeviceId || 'esp32-01', ts: Date.now() });
    } else {
      console.warn('[connector] Socket offline — command tidak terkirim:', actuator, value);
    }
    if (this.deviceCb) this.deviceCb({ [actuator]: value });
  }
}
window.BackendConnector = BackendConnector;
