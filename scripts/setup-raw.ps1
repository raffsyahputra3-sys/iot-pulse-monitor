# ============================================
# setup-raw.ps1 - Deploy ke RAW (rawhq.io)
# Dijalankan di LAPTOP (PowerShell):
#   .\scripts\setup-raw.ps1
# Script ini: install CLI → login → deploy VM → tampilkan IP.
# Provisioning lanjutan jalan di server via "raw ssh" (ditampilkan otomatis).
# ============================================

Write-Host "`n🚀 Deploy IoT Web Monitoring ke RAW`n" -ForegroundColor Cyan

# ===== 1. Cek Node.js =====
Write-Host "1️⃣  Cek Node.js..." -ForegroundColor Yellow
try {
    $nodeVer = node -v 2>$null
    if (-not $nodeVer) { throw "not found" }
    Write-Host "   ✅ Node.js $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Node.js tidak terinstall! Download: https://nodejs.org" -ForegroundColor Red
    exit 1
}

# ===== 2. Install RAW CLI =====
Write-Host "`n2️⃣  Cek RAW CLI..." -ForegroundColor Yellow
$rawCmd = Get-Command raw -ErrorAction SilentlyContinue
if (-not $rawCmd) {
    Write-Host "   Install rawhq..." -ForegroundColor White
    npm install -g rawhq
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
    $rawCmd = Get-Command raw -ErrorAction SilentlyContinue
}
if ($rawCmd) {
    Write-Host "   ✅ RAW CLI siap" -ForegroundColor Green
} else {
    Write-Host "   ❌ Gagal install. Coba manual: npm install -g rawhq" -ForegroundColor Red
    exit 1
}

# ===== 3. Login / signup (interaktif, gratis, tanpa kartu kredit) =====
Write-Host "`n3️⃣  Login RAW (browser akan terbuka / ikuti prompt)..." -ForegroundColor Yellow
raw init
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ Login gagal, hentikan." -ForegroundColor Red
    exit 1
}

# ===== 4. Deploy VM gratis =====
Write-Host "`n4️⃣  Deploy server (raw-free, region Singapore)..." -ForegroundColor Yellow
Write-Host "   Kalau 'sg' tidak tersedia, ulangi dengan: raw deploy --type raw-free --region eu" -ForegroundColor Cyan
raw deploy --type raw-free --region sg
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ⚠️  Deploy gagal — coba region lain: raw deploy --type raw-free --region eu" -ForegroundColor Yellow
    exit 1
}

# ===== 5. Tampilkan daftar server (catat IP publik) =====
Write-Host "`n5️⃣  Daftar server:" -ForegroundColor Yellow
raw ls

Write-Host "`n🎉 VM RAW jadi! Lanjut provisioning di server:`n" -ForegroundColor Green
Write-Host "  1. Masuk server:  raw ssh <nama-atau-id-server>" -ForegroundColor White
Write-Host "  2. Clone repo (butuh GitHub PAT sekali):" -ForegroundColor White
Write-Host "       export GITHUB_TOKEN=ghp_xxxx" -ForegroundColor Gray
Write-Host "       sudo git clone https://`$GITHUB_TOKEN@github.com/raffsyahputra3-sys/iot-pulse-monitor.git /opt/iot-pulse" -ForegroundColor Gray
Write-Host "  3. Provisioning otomatis:" -ForegroundColor White
Write-Host "       sudo bash /opt/iot-pulse/scripts/provision-raw.sh" -ForegroundColor Gray
Write-Host "  4. Buka http://<IP-SERVER>:4000  → harus demoMode=false" -ForegroundColor White
Write-Host "  5. Arahkan ESP32 ke IP server (lihat DEPLOY-RAW.md)`n" -ForegroundColor White
Write-Host "Panduan lengkap: DEPLOY-RAW.md`n" -ForegroundColor Cyan

