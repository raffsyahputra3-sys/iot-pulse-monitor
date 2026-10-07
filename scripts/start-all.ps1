# ============================================
# start-all.ps1 - Start semua service IoT
# Jalankan dari root proyek: .\scripts\start-all.ps1
# ============================================

Write-Host "`n🚀 Start semua service IoT`n" -ForegroundColor Cyan

$root = Split-Path -Parent $PSScriptRoot
$mosquittoPath = "C:\Program Files\mosquitto\mosquitto.exe"
$mosquittoConf = "$root\mosquitto\config\mosquitto.conf"

# ===== 1. Mosquitto =====
Write-Host "1️⃣  Start Mosquitto..." -ForegroundColor Yellow
$mosqRunning = netstat -ano | findstr ":1883" | Select-Object -First 1
if ($mosqRunning) {
    Write-Host "   ℹ️  Mosquitto sudah jalan" -ForegroundColor Cyan
} else {
    if (Test-Path $mosquittoPath) {
        Start-Process -FilePath $mosquittoPath `
            -ArgumentList "-c", "`"$mosquittoConf`"" `
            -WindowStyle Minimized
        Start-Sleep -Seconds 2
        Write-Host "   ✅ Mosquitto started (minimized)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Mosquitto tidak ditemukan" -ForegroundColor Red
    }
}

# ===== 2. MongoDB =====
Write-Host "`n2️⃣  Start MongoDB..." -ForegroundColor Yellow
$mongoRunning = netstat -ano | findstr ":27017" | Select-Object -First 1
if ($mongoRunning) {
    Write-Host "   ℹ️  MongoDB sudah jalan" -ForegroundColor Cyan
} else {
    try {
        net start MongoDB 2>$null | Out-Null
        Write-Host "   ✅ MongoDB started" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ MongoDB gagal start. Jalankan manual:" -ForegroundColor Red
        Write-Host "      net start MongoDB" -ForegroundColor Red
    }
}

# ===== 3. Backend =====
Write-Host "`n3️⃣  Start Backend..." -ForegroundColor Yellow
$backendRunning = netstat -ano | findstr ":4000" | Select-Object -First 1
if ($backendRunning) {
    Write-Host "   ℹ️  Backend sudah jalan" -ForegroundColor Cyan
} else {
    Start-Process -FilePath "powershell" `
        -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; npm start" `
        -WindowStyle Minimized
    Write-Host "   ✅ Backend started (minimized)" -ForegroundColor Green
}

# ===== 4. Tunggu =====
Write-Host "`n⏳ Tunggu 5 detik..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# ===== 5. Cek Status =====
Write-Host "`n📊 Cek Status:" -ForegroundColor Cyan
$checks = @(
    @{Name="Mosquitto"; Port=1883},
    @{Name="MongoDB";   Port=27017},
    @{Name="Backend";   Port=4000}
)
foreach ($c in $checks) {
    $running = netstat -ano | findstr ":$($c.Port)" | Select-Object -First 1
    if ($running) {
        Write-Host "   ✅ $($c.Name) ($($c.Port))" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $($c.Name) ($($c.Port))" -ForegroundColor Red
    }
}

# ===== 6. Cek API =====
Write-Host "`n🌐 Cek API..." -ForegroundColor Yellow
try {
    $api = Invoke-RestMethod -Uri "http://localhost:4000/api" -TimeoutSec 5
    Write-Host "   ✅ API jalan" -ForegroundColor Green
    Write-Host "   Demo Mode: $($api.demoMode)" -ForegroundColor White
    if ($api.demoMode) {
        Write-Host "   ⚠️  Masih demo mode - MongoDB belum konek" -ForegroundColor Yellow
    } else {
        Write-Host "   🎉 Real mode aktif!" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ API tidak merespon" -ForegroundColor Red
}

# ===== 7. Buka Browser =====
Write-Host "`n🌐 Buka dashboard..." -ForegroundColor Yellow
Start-Process "http://localhost:4000"
Write-Host "   ✅ Browser dibuka" -ForegroundColor Green

Write-Host "`n🎉 Semua service started!`n" -ForegroundColor Green
Write-Host "Untuk stop: .\scripts\stop-all.ps1`n" -ForegroundColor Cyan

