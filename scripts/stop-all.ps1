# ============================================
# stop-all.ps1 - Stop semua service IoT
# Jalankan dari root proyek: .\scripts\stop-all.ps1
# ============================================

Write-Host "`n🛑 Stop semua service IoT`n" -ForegroundColor Cyan

# ===== 1. Backend =====
Write-Host "1️⃣  Stop Backend (Node.js)..." -ForegroundColor Yellow
$nodeProcs = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcs) {
    $nodeProcs | Stop-Process -Force
    Write-Host "   ✅ Node.js stopped" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  Tidak ada Node.js jalan" -ForegroundColor Cyan
}

# ===== 2. Mosquitto =====
Write-Host "`n2️⃣  Stop Mosquitto..." -ForegroundColor Yellow
$mosqProcs = Get-Process mosquitto -ErrorAction SilentlyContinue
if ($mosqProcs) {
    $mosqProcs | Stop-Process -Force
    Write-Host "   ✅ Mosquitto stopped" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  Tidak ada Mosquitto jalan" -ForegroundColor Cyan
}

# ===== 3. MongoDB =====
Write-Host "`n3️⃣  Stop MongoDB..." -ForegroundColor Yellow
try {
    net stop MongoDB 2>$null | Out-Null
    Write-Host "   ✅ MongoDB stopped" -ForegroundColor Green
} catch {
    Write-Host "   ℹ️  MongoDB tidak jalan / tidak service" -ForegroundColor Cyan
}

Write-Host "`n🎉 Semua service stopped!`n" -ForegroundColor Green

