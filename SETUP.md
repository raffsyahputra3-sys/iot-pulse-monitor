# SETUP & RUN

## Cara Tercepat (Docker)
```bash
docker-compose up -d
```
Buka: http://localhost:4000

## Cara Manual
### 1. Prasyarat
- Node.js v18+
- MongoDB
- Mosquitto MQTT

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
npm start
```

### 3. Seed data
```bash
cd scripts
npm install mqtt mongoose bcryptjs dotenv
node seed.js
```

### 4. Simulasi Device (untuk testing)
```bash
node simulate-device.js
```

### 5. Frontend
Buka frontend/index.html di browser
atau pakai live server:
```bash
npx serve frontend
```

### 6. Firmware ESP32
Upload ke ESP32 sesuai firmware/esp32-dht22/README.md
