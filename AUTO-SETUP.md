# 🤖 Panduan untuk OpenCode / AI Agent

## Tujuan
Setup & jalankan proyek IoT Web Monitoring secara otomatis.

## Prasyarat
- Windows 10/11
- PowerShell
- Node.js v18+ terinstall
- Mosquitto terinstall di `C:\Program Files\mosquitto\`
- MongoDB terinstall (atau Docker)

## Langkah Otomatis
Jalankan script berikut secara berurutan:

### 1. Setup Awal
```powershell
cd "C:\Users\ASUS TUF\Documents\iot-web-monitoring"
.\scripts\setup.ps1
```
Script ini akan:
- Cek Node.js, Mosquitto, MongoDB
- Buat semua folder yang diperlukan
- Buat file mosquitto.conf
- Buat file .env dari .env.example
- Install dependencies backend
- Install dependencies scripts

### 2. Jalankan Semua Service
```powershell
.\scripts\start-all.ps1
```
Script ini akan:
- Start Mosquitto (background)
- Start MongoDB (background)
- Start Backend (background)
- Tunggu 5 detik
- Cek kesehatan semua service
- Buka dashboard di browser

### 3. Test Kirim Data
```powershell
cd scripts
node publish-test.js
```
Kirim data dummy via MQTT tiap 3 detik.

### 4. Stop Semua Service
```powershell
.\scripts\stop-all.ps1
```

## Yang HARUS Manual (Tidak Bisa Otomatis)
- Upload firmware ke ESP32 → butuh Arduino IDE + hardware fisik
- Wiring DHT22 ke ESP32 → butuh tangan manusia
- Edit config.h → isi WiFi SSID, password, IP laptop

## Cek Status
```powershell
# Cek semua port
netstat -ano | findstr ":1883 :27017 :4000"

# Cek API
curl http://localhost:4000/api
```
Kalau `"demoMode": false` → ✅ real mode aktif.
