#!/bin/bash
# ============================================
# provision-raw.sh - Setup server RAW (Ubuntu)
# Dijalankan DI DALAM server via "raw ssh":
#   sudo bash /opt/iot-pulse/scripts/provision-raw.sh
# ============================================
set -e

APP_DIR="/opt/iot-pulse"

echo ""
echo "🚀 Provision IoT Web Monitoring di RAW"
echo ""

# ===== 1. Docker =====
echo "1️⃣  Install Docker..."
if ! command -v docker &> /dev/null; then
  apt-get update -qq
  apt-get install -y -qq docker.io docker-compose-plugin git ufw curl openssl
  systemctl enable --now docker
  echo "   ✅ Docker terinstall"
else
  echo "   ℹ️  Docker sudah ada"
fi
docker --version

# ===== 2. Firewall: hanya 22 (SSH), 4000 (dashboard), 1883 (MQTT) =====
echo ""
echo "2️⃣  Setup firewall..."
ufw allow 22/tcp > /dev/null
ufw allow 4000/tcp > /dev/null
ufw allow 1883/tcp > /dev/null
ufw --force enable > /dev/null
echo "   ✅ Port 22, 4000, 1883 dibuka (27017 tertutup dari internet)"
ufw status numbered | head -12

# ===== 3. Repo harus sudah di-clone ke $APP_DIR =====
echo ""
echo "3️⃣  Cek repo..."
if [ ! -f "$APP_DIR/docker-compose.yml" ]; then
  echo "   ❌ Repo belum ada di $APP_DIR"
  echo "   Clone dulu:"
  echo "     export GITHUB_TOKEN=ghp_xxxx  # Personal Access Token (repo)"
  echo "     sudo git clone https://\$GITHUB_TOKEN@github.com/raffsyahputra3-sys/iot-pulse-monitor.git $APP_DIR"
  exit 1
fi
echo "   ✅ Repo ditemukan"

# ===== 4. backend/.env (buat sekali, jangan timpa) =====
echo ""
echo "4️⃣  Setup backend/.env..."
if [ -f "$APP_DIR/backend/.env" ]; then
  echo "   ℹ️  .env sudah ada, skip"
else
  JWT=$(openssl rand -hex 32)
  cat > "$APP_DIR/backend/.env" <<EOF
PORT=4000
NODE_ENV=production
MONGODB_URI=mongodb://mongodb:27017/iotdb
MQTT_BROKER=mqtt://mosquitto:1883
MQTT_TOPIC=iot/device/+/data
JWT_SECRET=$JWT
JWT_EXPIRES=7d
ALERT_TEMP_MAX=35
ALERT_TEMP_MIN=15
ALERT_HUMIDITY_MAX=85
ALERT_HUMIDITY_MIN=30
CORS_ORIGIN=*
EOF
  chmod 600 "$APP_DIR/backend/.env"
  echo "   ✅ .env dibuat (JWT random, production)"
fi

# ===== 5. Docker compose up =====
echo ""
echo "5️⃣  Start stack (MongoDB + Mosquitto + Backend)..."
cd "$APP_DIR"
docker compose up -d --build
echo "   ⏳ Tunggu 15 detik..."
sleep 15

# ===== 6. Health check =====
echo ""
echo "📊 Status container:"
docker compose ps
echo ""
echo "🌐 Cek API:"
API=$(curl -s --max-time 10 http://localhost:4000/api || echo "FAIL")
echo "   $API"
echo "$API" | grep -q '"demoMode":false' && echo "   🎉 Real mode aktif!" || echo "   ⚠️  Cek log: docker compose logs backend"

PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me || echo "<ip-server>")
echo ""
echo "🎉 Selesai!"
echo "   Dashboard : http://$PUBLIC_IP:4000"
echo "   MQTT ESP32: $PUBLIC_IP port 1883 (tanpa TLS)"
echo ""
