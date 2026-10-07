# ============================================
# setup.ps1 - Auto setup IoT Web Monitoring
# Jalankan dari root proyek: .\scripts\setup.ps1
# ============================================

Write-Host "`n🚀 IoT Web Monitoring - Auto Setup`n" -ForegroundColor Cyan

$root = Split-Path -Parent $PSScriptRoot
$mosquittoPath = "C:\Program Files\mosquitto\mosquitto.exe"

# ===== 1. Cek Node.js =====
Write-Host "1️⃣  Cek Node.js..." -ForegroundColor Yellow
try {
    $nodeVer = node -v 2>$null
    if (-not $nodeVer) { throw "not found" }
    Write-Host "   ✅ Node.js $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Node.js tidak terinstall!" -ForegroundColor Red
    Write-Host "   Download: https://nodejs.org" -ForegroundColor Red
    exit 1
}

# ===== 2. Cek Mosquitto =====
Write-Host "`n2️⃣  Cek Mosquitto..." -ForegroundColor Yellow
if (Test-Path $mosquittoPath) {
    Write-Host "   ✅ Mosquitto terinstall" -ForegroundColor Green
} else {
    Write-Host "   ❌ Mosquitto tidak ditemukan di $mosquittoPath" -ForegroundColor Red
    Write-Host "   Download: https://mosquitto.org/download/" -ForegroundColor Red
    Write-Host "   Lanjut tanpa Mosquitto..." -ForegroundColor Yellow
}

# ===== 3. Cek MongoDB =====
Write-Host "`n3️⃣  Cek MongoDB..." -ForegroundColor Yellow
$mongoRunning = netstat -ano | findstr ":27017" | Select-Object -First 1
if ($mongoRunning) {
    Write-Host "   ✅ MongoDB jalan di port 27017" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  MongoDB tidak jalan. Coba start..." -ForegroundColor Yellow
    try {
        net start MongoDB 2>$null | Out-Null
        Write-Host "   ✅ MongoDB started" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Gagal start MongoDB. Jalankan manual:" -ForegroundColor Red
        Write-Host "      net start MongoDB" -ForegroundColor Red
    }
}

# ===== 4. Buat Folder =====
Write-Host "`n4️⃣  Buat folder..." -ForegroundColor Yellow
$folders = @(
    "$root\mosquitto\config",
    "$root\mosquitto\data",
    "$root\mosquitto\log",
    "$root\backend\logs",
    "$root\backend\uploads\avatars",
    "$root\scripts"
)
foreach ($f in $folders) {
    New-Item -ItemType Directory -Force -Path $f | Out-Null
}
Write-Host "   ✅ Folder dibuat" -ForegroundColor Green

# ===== 5. Buat mosquitto.conf =====
Write-Host "`n5️⃣  Buat mosquitto.conf..." -ForegroundColor Yellow
$mosqConf = "$root\mosquitto\config\mosquitto.conf"
$mosqContent = @"
listener 1883
allow_anonymous true

listener 9001
protocol websockets
allow_anonymous true
"@
Set-Content -Path $mosqConf -Value $mosqContent -Encoding UTF8
Write-Host "   ✅ mosquitto.conf dibuat" -ForegroundColor Green

# ===== 6. Buat .env =====
Write-Host "`n6️⃣  Buat .env..." -ForegroundColor Yellow
$envFile = "$root\backend\.env"
if (Test-Path $envFile) {
    Write-Host "   ℹ️  .env sudah ada, skip" -ForegroundColor Cyan
} else {
    $jwtSecret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    $envContent = @"
PORT=4000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/iotdb
MQTT_BROKER=mqtt://localhost:1883
MQTT_TOPIC=iot/device/+/data
JWT_SECRET=$jwtSecret
JWT_EXPIRES=7d
ALERT_TEMP_MAX=35
ALERT_TEMP_MIN=15
ALERT_HUMIDITY_MAX=85
ALERT_HUMIDITY_MIN=30
CORS_ORIGIN=*
"@
    Set-Content -Path $envFile -Value $envContent -Encoding UTF8
    Write-Host "   ✅ .env dibuat dengan JWT_SECRET random" -ForegroundColor Green
}

# ===== 7. Install Backend Dependencies =====
Write-Host "`n7️⃣  Install backend dependencies..." -ForegroundColor Yellow
Push-Location "$root\backend"
if (Test-Path "package.json") {
    npm install --silent
    Write-Host "   ✅ Backend dependencies terinstall" -ForegroundColor Green
} else {
    Write-Host "   ❌ package.json tidak ada!" -ForegroundColor Red
}
Pop-Location

# ===== 8. Install Scripts Dependencies =====
Write-Host "`n8️⃣  Install scripts dependencies..." -ForegroundColor Yellow
Push-Location "$root\scripts"
if (-not (Test-Path "package.json")) {
    npm init -y --silent | Out-Null
}
npm install mqtt mongoose bcryptjs dotenv --silent
Write-Host "   ✅ Scripts dependencies terinstall" -ForegroundColor Green
Pop-Location

# ===== Selesai =====
Write-Host "`n🎉 Setup selesai!`n" -ForegroundColor Green
Write-Host "Langkah selanjutnya:" -ForegroundColor Cyan
Write-Host "  .\scripts\start-all.ps1    → Jalankan semua service" -ForegroundColor White
Write-Host "  .\scripts\stop-all.ps1     → Stop semua service`n" -ForegroundColor White

