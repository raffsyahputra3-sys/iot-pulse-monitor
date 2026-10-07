# Wiring Lengkap — ESP32 Kandang Ayam (DHT22 + 2x MG90S + IR FC-51 + MQ-135)

Sumber kebenaran: `firmware/esp32-kandang-lengkap/config.h` + `README.md`. Board: **ESP32 DevKit V1 30-pin**.

## 1. Daftar Belanja

| Qty | Komponen | Catatan |
|---|---|---|
| 1 | ESP32 DevKit V1 | — |
| 1 | DHT22 + resistor 10k | pull-up DATA→3V3 |
| 2 | Servo MG90S (metal) | jangan SG90 plastik untuk atap |
| 1 | IR Obstacle FC-51 | deteksi pakan |
| 1 | MQ-135 | gas/amonia, butuh 5V + burn-in 24 jam |
| 1 | Adaptor 5V ≥2A | khusus servo + MQ |
| 1 | Breadboard + jumper | kabel GND tebal/pendek untuk arus besar |

## 2. Tabel Wiring

| Modul | Pin modul | → Tujuan | Ket |
|---|---|---|---|
| DHT22 | VCC (+) | ESP 3V3 | boleh gabung dengan VCC IR |
| DHT22 | GND (−) | ESP GND | |
| DHT22 | DATA | GPIO14 | + R 10k DATA→3V3 |
| Servo #1 kanan | Sinyal kuning/oranye | GPIO12 | data servo 1 |
| Servo #1 | VCC merah | + adaptor 5V | bukan dari ESP! |
| Servo #1 | GND coklat | − adaptor + ESP GND | common ground |
| Servo #2 kiri | Sinyal kuning/oranye | GPIO13 | data servo 2 |
| Servo #2 | VCC merah | + adaptor 5V (gabung #1) | |
| Servo #2 | GND coklat | − adaptor + ESP GND | |
| IR FC-51 | VCC | ESP 3V3 (gabung DHT boleh, total ~22mA aman) | |
| IR FC-51 | GND | ESP GND | |
| IR FC-51 | OUT | GPIO27 | LOW = ada pakan |
| MQ-135 | VCC | + adaptor 5V (pemanas) | |
| MQ-135 | GND | − adaptor + ESP GND | |
| MQ-135 | AO | GPIO34 (ADC1, aman + WiFi) | analog gas |
| MQ-135 | DO | GPIO35 opsional, boleh kosong | digital ambang |

Pin tetap: LED built-in GPIO2 (kedip tiap kirim).

## 3. Diagram

```
ADAPTOR 5V (+) ──┬── Servo#1 VCC ── Servo#2 VCC ── MQ VCC
                 (jangan ke ESP!)

GND BERSAMA (pusat di adaptor -):
Adaptor (-) ──┬── Servo#1 GND ── Servo#2 GND ── MQ GND
              └── 1 kabel ── ESP GND ── DHT GND ── IR GND

ESP 3V3 ──┬── DHT VCC ── IR VCC
          └── R10k ── DHT DATA ── GPIO14

GPIO12 → Servo#1 sinyal (atap KANAN)
GPIO13 → Servo#2 sinyal (atap KIRI, mirror)
GPIO27 ← IR OUT (hadap pakan 5-15 cm)
GPIO34 ← MQ AO
GPIO35 ← MQ DO (opsional)
```

## 4. Aturan Wajib (hasil tanya-jawab rakitan)

1. **GND boleh digabung semua, tapi pusatnya di adaptor, bukan di pin ESP.** 1 kabel adaptor(−)→ESP GND cukup. Jangan lewatkan arus 2A servo+MQ lewat PCB ESP → restart/noise ADC.
2. **3V3 DHT + IR boleh digabung.** Total ~22mA, regulator ESP kuat (~500mA). Jangan tempel servo/MQ ke 3V3.
3. **Sinyal servo hanya 2 kabel kuning ke GPIO12/13.** Kalau atap kupu-kupu pakai `SERVO_MIRROR 1` (default); kalau 1 daun searah pakai `0`.
4. **IR FC-51:** putar trimpot sampai LED nyala saat ada pakan. Kalau terbalik, set `IR_PAKAN_INVERT 1` di `config.h`, tanpa ubah kabel.
5. **MQ-135:** wajib 5V + burn-in 24 jam. Catat `gasRaw` di Serial Monitor: udara bersih → `GAS_ADC_BERSIH`, dekat bau → `GAS_ADC_KOTOR`.

## 5. Troubleshooting Cepat

| Gejala | Penyebab → Solusi |
|---|---|
| ESP restart saat servo gerak | Power kurang → adaptor ≥2A, kabel GND/VCC pendek, elco 470uF di rel 5V bila perlu |
| `gasRaw` loncat-loncat | GND belum common / kabel AO panjang → rapikan star-ground, rata-rata 10x sudah di kode |
| `pakan` selalu 1/0 | Jarak/trimpot salah → geser 5-15 cm, putar trimpot, atau flip `IR_PAKAN_INVERT` |
| DHT `nan` | R 10k belum pasang / kabel DATA longgar / GPIO salah |
| Servo getar | Ambang suhu terlalu rapat → jaga hysteresis 28/31 °C, gerak halus bawaan kode |
