# DOKUMENTASI — IoT Web Monitoring + AI Kontrol Atap

Gabungan seluruh dokumen proyek dalam satu file. Isi tiap bagian disalin utuh dari file aslinya (lihat kolom Sumber).

## Daftar Isi

- [PRD AI Kontrol Atap Offline V1 — proyek berjalan](#prd-ai-kontrol-atap-offline-v1-proyek-berjalan) _(Sumber: `docs/PRD-AI-Kontrol-Atap-Offline-V1.md`)_
- [Progress AI Atap — status & handoff](#progress-ai-atap-status-handoff) _(Sumber: `docs/PROGRESS-AI-ATAP.md`)_
- [README Service Pi](#readme-service-pi) _(Sumber: `pi/README.md`)_
- [PRD Kandang Ayam IoT V1 — sistem dasar](#prd-kandang-ayam-iot-v1-sistem-dasar) _(Sumber: `docs/PRD-Kandang-Ayam-IoT-V1.md`)_
- [Wiring ESP32 Kandang Lengkap](#wiring-esp32-kandang-lengkap) _(Sumber: `docs/WIRING-ESP32-KANDANG-LENGKAP.md`)_
- [Sketch INO ESP32](#sketch-ino-esp32) _(Sumber: `docs/SKETCH-INO-ESP32.md`)_
- [Web IoT Dashboard](#web-iot-dashboard) _(Sumber: `docs/WEB-IOT-DASHBOARD.md`)_
- [PRD Final V6](#prd-final-v6) _(Sumber: `docs/PRD-FINAL-V6.md`)_
- [PRD UI Redesign V9](#prd-ui-redesign-v9) _(Sumber: `docs/PRD-UI-REDESIGN-V9.md`)_
- [PRD V10](#prd-v10) _(Sumber: `docs/PRD-V10.md`)_
- [PRD Laporan Dosen](#prd-laporan-dosen) _(Sumber: `docs/PRD-Laporan-Dosen.md`)_

---

# PRD AI Kontrol Atap Offline V1 — proyek berjalan

> Sumber: `docs/PRD-AI-Kontrol-Atap-Offline-V1.md`

# PRD — AI Lokal Offline untuk Kontrol Atap Otomatis (Kandang Ayam)

**Versi:** 1.0 — 11 Okt 2026
**Device existing:** `esp32-rakit-01` | **Firmware:** `firmware/esp32-kandang-lengkap/`
**Target runtime AI:** Raspberry Pi 4/5 (4-8 GB), offline, tanpa GPU

Dokumen pendamping (baca dulu sebelum implementasi):
- `docs/PRD-Kandang-Ayam-IoT-V1.md` — PRD sistem dasar (sensor, MQTT, dashboard)
- `firmware/esp32-kandang-lengkap/config.h` — threshold & topic MQTT existing
- `firmware/esp32-kandang-lengkap/esp32-kandang-lengkap.ino` — logic auto/manual atap existing

Catatan untuk AI agent yang mengerjakan ini: dokumen ini ditulis untuk standalone implementation.
Semua path file, schema JSON, dan nilai default sudah final — jangan menebak, ikuti apa adanya.
Jika ada ambiguitas yang tidak tercakup di sini, catat sebagai open question (lihat §11), jangan asumsi sendiri untuk hal yang safety-critical (§6).

---

## 1. Latar Belakang & Tujuan

Sistem existing menutup/membuka atap dengan **hysteresis suhu tunggal** (firmware `config.h`):
`TEMP_BUKA_ATAP=31°C`, `TEMP_TUTUP_ATAP=28°C`, langkah 0° atau 90° saja.

Masalah:
- Tidak mempertimbangkan kelembapan, gas amonia, jam/waktu, atau cuaca (hujan).
- Hanya 2 posisi (tutup/buka penuh) — tidak ada sudut optimal di antara.
- Override manual dari web expired 10 menit lalu balik ke hysteresis dasar.

Tujuan V1: tambahkan **lapisan keputusan AI di Raspberry Pi** yang:
1. Membaca histori sensor (suhu, kelembapan, gas), waktu, dan cuaca (jika online).
2. Mengusulkan sudut atap 0–90° (bukan cuma buka/tutup).
3. **Tetap aman walau tanpa internet** — AI harus bisa jalan 100% offline.
4. Tidak pernah mem-bypass kondisi berbahaya (gas tinggi, suhu ekstrem) — ada guard code di luar AI yang punya veto mutlak.

Model AI adalah **advisor**, bukan sumber kebenaran tunggal. Guard (plain Python, bukan LLM) selalu punya keputusan akhir.

---

## 2. Scope

### In-scope (V1)
- Service baru di Raspberry Pi: `pi/` (subscriber MQTT, facts builder, advisor LLM, guard, logger).
- Broker MQTT lokal di Pi (Mosquitto) sebagai pengganti `broker.emqx.io` → sistem jalan tanpa internet.
- LLM lokal via Ollama (model kecil, quantized) untuk mengusulkan sudut atap + alasan dalam bahasa Indonesia.
- Guard rules (kode biasa) yang bisa override AI kapan saja.
- Cache cuaca (Open-Meteo) dengan expiry, dan fallback aman saat cuaca tidak tersedia.
- Logging keputusan (JSONL) sebagai bahan training data masa depan.
- Pipeline data labeling berbasis rule, untuk menghasilkan data fine-tuning (dijalankan di PC/Colab, bukan di Pi).
- Dokumentasi Modelfile untuk Ollama.

### Out-of-scope (V1)
- Training/fine-tuning berjalan di Raspberry Pi (training dilakukan di PC/Colab, hasil di-copy ke Pi).
- Rain sensor & LDR fisik (disebut sebagai rekomendasi hardware opsional, tidak wajib dipasang V1).
- Perubahan firmware ESP32 untuk mode "ai" permanen (V1 pakai mode manual existing + re-send tiap cycle; lihat §6.4). Jika dikerjakan, itu masuk fase 2 (§10).
- Multi-device, OTA, kontrol aktuator lain selain atap.

---

## 3. Arsitektur

```
[DHT22][MQ-135] --MQTT--> [Mosquitto lokal @ Pi:1883] <--MQTT-- [ESP32 esp32-rakit-01]
                                   |
                                   v
                     pi/mqtt_listener.py (subscribe topic data)
                     simpan rolling window 10 menit (list of dict, in-memory + disk cache)
                                   |
                                   v
                     pi/facts.py -> build_facts(window, clock, weather_cache)
                     -> string fakta bahasa Indonesia (angka sudah dihitung, LLM tidak menghitung)
                                   |
                                   v
                     pi/advisor.py -> Ollama API (model fine-tuned, format=JSON schema)
                     -> {"angle": int, "reason": str, "confidence": "low|medium|high"}
                                   |
                                   v
                     pi/guard.py -> guard(ai_output, now, last_angle, weather)
                     -> keputusan final (int angle 0-90, step 15°, sumber "ai"|"guard")
                                   |
                                   v
                     pi/mqtt_listener.py publish cmd setiap cycle (lihat §6.4)
                     -> iot/device/esp32-rakit-01/cmd {"actuator":"atap","value":<angle>}
                                   |
                                   v
                     pi/logger.py -> append JSONL (facts, ai_output, final_decision, timestamp)

[pi/weather.py] -> Open-Meteo API (opsional, cache ke disk, expiry 6 jam) -- jalan paralel, non-blocking
```

Decision loop berjalan setiap **60–120 detik** (bukan tiap 5 detik seperti publish sensor) — lihat §6.5 untuk alasan dwell time.

---

## 4. Hardware

| Komponen | Status | Keterangan |
|---|---|---|
| Raspberry Pi 4 (4GB) atau Pi 5 (8GB) | **Wajib, baru** | Pi 5 direkomendasikan untuk headroom LLM |
| microSD A2 atau SSD via USB | **Wajib** | Model load time didominasi I/O storage |
| Active cooler (fan/heatsink) | **Wajib** | LLM inference sustained load bisa throttle Pi tanpa cooling |
| **RTC module (DS3231, I2C)** | **Wajib** | Pi tidak punya battery-backed clock — tanpa internet, waktu hilang tiap reboot/power-cut, dan input "jam" ke AI jadi salah. Harga ~Rp30-50rb. |
| Rain sensor (YL-83) | Opsional, rekomendasi | AI tidak bisa deteksi hujan tanpa internet tanpa sensor ini; lihat §6.3 untuk fallback tanpa sensor |
| LDR (deteksi gelap/terang) | Opsional | Sinyal tambahan siang/malam selain jam |

---

## 5. Data & Interfaces

### 5.1 Input: payload sensor existing (tidak berubah)
Sesuai `esp32-kandang-lengkap.ino` baris ~207-214, format JSON di topic `iot/device/esp32-rakit-01/data`:
```json
{"deviceId":"esp32-rakit-01","suhu":30.5,"kelembapan":65,
 "gas":12.3,"gasRaw":512,"pakan":1,"pakanPersen":100,
 "atap":90,"mode":"auto","timestamp":123}
```
`pi/mqtt_listener.py` menyimpan rolling window 10 menit (≈120 pesan @ 5 detik) di memory, plus persist ke `pi/data/window_cache.jsonl` supaya survive restart.

### 5.2 Facts builder — `pi/facts.py`

```python
# pi/facts.py
from statistics import mean
from datetime import datetime

TEMP_HI, TEMP_LO = 31.0, 28.0   # sama dengan firmware config.h
GAS_WARN, GAS_DANGER = 25.0, 40.0  # sama dengan README kalibrasi MQ-135

def build_facts(window: list[dict], now_dt: datetime, weather: dict | None) -> str:
    """window = daftar payload data terakhir (>=1, idealnya 10 menit terakhir).
    weather = {"raining": bool, "temp_c": float, "cloud_pct": int, "age_min": int} atau None."""
    now, first = window[-1], window[0]
    d_temp = now["suhu"] - first["suhu"]
    jam, hari = now_dt.hour, ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"][now_dt.weekday()]

    lines = [
        f"Waktu: {hari} jam {jam:02d}:00 ({'siang' if 6 <= jam < 18 else 'malam'}).",
        f"Suhu kandang {now['suhu']:.1f} C "
        f"({'DI ATAS' if now['suhu'] >= TEMP_HI else 'di bawah'} batas {TEMP_HI} C), "
        f"{'naik' if d_temp > 0 else 'turun'} {abs(d_temp):.1f} C dalam {len(window)*5//60} menit terakhir.",
        f"Kelembapan {now['kelembapan']:.0f}% (rata-rata window {mean(w['kelembapan'] for w in window):.0f}%).",
        f"Gas amonia {now['gas']:.1f} ppm - status "
        f"{'BAHAYA' if now['gas'] >= GAS_DANGER else 'peringatan' if now['gas'] >= GAS_WARN else 'aman'}.",
        f"Pakan: {'tersedia' if now['pakan'] else 'HABIS'}.",
        f"Posisi atap saat ini: {now['atap']} derajat, mode firmware: {now['mode']}.",
    ]
    if weather is None:
        lines.append("Cuaca: tidak tersedia (offline, tidak ada cache valid).")
    else:
        usia = f" (data {weather['age_min']} menit lalu)" if weather.get("age_min", 0) > 30 else ""
        lines.append(
            f"Cuaca{usia}: {'HUJAN' if weather['raining'] else 'tidak hujan'}, "
            f"suhu luar {weather['temp_c']:.0f} C, awan {weather['cloud_pct']}%."
        )
    return "\n".join(lines)
```

### 5.3 Output LLM — JSON schema dipaksa via Ollama `format`

```python
DECISION_SCHEMA = {
    "type": "object",
    "properties": {
        "angle": {"type": "integer", "minimum": 0, "maximum": 90},
        "reason": {"type": "string", "maxLength": 160},
        "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
    },
    "required": ["angle", "reason", "confidence"],
}
```
Field `reason` wajib Bahasa Indonesia, maksimal ~25 kata, untuk ditampilkan di dashboard web (field baru, lihat §8).

### 5.4 Guard — `pi/guard.py` (lihat §6 untuk rules lengkap, ini kontrak fungsinya)

```python
def guard(ai_angle: int, now: dict, last_angle: int, weather: dict | None) -> tuple[int, str]:
    """Return (final_angle, source) — source = 'guard' jika override, 'ai' jika angle AI dipakai (mungkin dibulatkan)."""
```

### 5.5 Output ke ESP32 — topic `iot/device/esp32-rakit-01/cmd` (format existing, tidak berubah)
```json
{"actuator":"atap","value":45}
```
Firmware existing menerima ini di `esp32-kandang-lengkap.ino` baris ~95-98: set `modeAuto=false`, timeout 10 menit (`MANUAL_TIMEOUT_MS`), lalu balik ke hysteresis auto jika tidak di-refresh. Implikasi untuk Pi service: lihat §6.4.

---

## 6. Guard Rules — Safety Layer (non-negotiable, implementasi wajib tepat seperti ini)

Guard adalah kode Python biasa, **tidak boleh melibatkan LLM**, dan dievaluasi SETELAH AI memberi usulan, SEBELUM dikirim ke MQTT.

### 6.1 Override darurat (prioritas tertinggi, abaikan AI sepenuhnya)
```python
if now["gas"] >= GAS_DANGER or now["suhu"] >= 34.0:
    return 90, "guard: bahaya gas/panas — atap dibuka penuh"
```

### 6.2 Hujan + kondisi aman → tutup, abaikan AI
```python
if weather and weather.get("raining") and now["suhu"] < TEMP_HI and now["gas"] < GAS_WARN:
    return 0, "guard: hujan terdeteksi, kondisi dalam kandang aman"
```
Catatan: tanpa rain sensor fisik dan tanpa cuaca online, `weather["raining"]` tidak bisa dipastikan. V1 **tidak** boleh menebak hujan dari kombinasi kelembapan+suhu turun sebagai pengganti sensor — itu terlalu tidak reliable untuk guard safety-critical. Jika tidak ada data hujan valid, rule ini di-skip (bukan dipaksa true/false).

### 6.3 Rate limit perubahan (anti servo hunting)
```python
angle = max(last_angle - 30, min(last_angle + 30, ai_angle))   # maksimal ±30° per cycle
angle = round(angle / 15) * 15                                   # snap ke kelipatan 15°: 0,15,...,90
```

### 6.4 Dwell time minimum
Jangan kirim cmd baru jika `angle` sama dengan `last_angle` DAN belum 5 menit sejak cmd terakhir — kecuali §6.1/§6.2 trigger. Ini mencegah spam MQTT dan wear servo.

**PENTING — re-send tiap cycle:** karena firmware override manual expired 10 menit (`MANUAL_TIMEOUT_MS`), Pi WAJIB publish ulang cmd dengan angle yang sama minimal setiap 8 menit meskipun angle tidak berubah, supaya firmware tidak balik sendiri ke hysteresis dasar saat AI sedang aktif. Loop interval 60-120 detik (§3) sudah lebih sering dari ini, jadi secara natural terpenuhi — tapi test case wajib memverifikasi ini secara eksplisit (lihat §9).

### 6.5 Fallback saat Pi/AI/Ollama mati atau network ke ESP32 putus
Tidak perlu kode tambahan di Pi — firmware ESP32 sendiri sudah auto-revert ke hysteresis `TEMP_BUKA_ATAP`/`TEMP_TUTUP_ATAP` setelah 10 menit tanpa cmd baru (behavior existing). Guard harus TIDAK mencoba "fix" ini dengan retry agresif; biarkan firmware fallback bekerja sebagaimana desainnya.

### 6.6 Acceptance criteria guard (wajib lolos semua sebelum merge)
| # | Skenario | Hasil wajib |
|---|---|---|
| G1 | gas=45 ppm, AI usul angle=0 | Guard override jadi 90, source="guard" |
| G2 | suhu=35, AI usul angle=20 | Guard override jadi 90, source="guard" |
| G3 | weather.raining=True, suhu=29, gas=10, AI usul angle=60 | Guard override jadi 0, source="guard" |
| G4 | last_angle=0, AI usul angle=90 (lonjakan) | Hasil akhir angle=30 (dibatasi +30), lalu snap ke kelipatan 15 |
| G5 | angle tidak berubah 10 menit berturut | cmd tetap terpublish minimal 1x per 8 menit |
| G6 | weather=None (offline, tidak ada cache) | Guard §6.2 di-skip, tidak error, lanjut ke rule lain |

---

## 7. Model & Runtime LLM

### 7.1 Software stack di Pi
1. Raspberry Pi OS 64-bit (Lite).
2. Ollama (`curl -fsSL https://ollama.com/install.sh | sh`) — bundle llama.cpp dengan optimasi ARM.
3. Mosquitto broker lokal (`mosquitto/config/mosquitto.conf` sudah ada di repo — pakai config ini, jalankan di Pi).
4. Python 3.11+ dengan `paho-mqtt`, `requests`.

### 7.2 Model pilihan
| Model | Parameter | Ukuran file (.gguf, Q4_K_M) | RAM saat jalan | Kecepatan (Pi 5, Q4) perkiraan | Rekomendasi |
|---|---|---|---|---|---|
| `qwen2.5:0.5b-instruct` | ~494 juta | ~400-450 MB | ~1 GB | Tercepat | Fallback jika Pi 4 RAM 4GB terasa berat |
| **`qwen2.5:1.5b-instruct`** | ~1,54 miliar | ~1.0-1.1 GB | ~2 GB | 5-10 tok/s | **Default V1 — titik optimal: cukup ringan untuk Pi 4/5, cukup besar untuk alasan `reason` yang koheren; kecepatannya jauh melebihi kebutuhan loop 60-120 detik** |
| 3B class | ~3,09 miliar | ~1.8-2.0 GB | ~4 GB | 2-4 tok/s | Hanya jika Pi 5 8GB dan 5-10 tok/s dirasa kurang akurat |

Angka kecepatan adalah estimasi kasar, wajib benchmark ulang di hardware aktual sebelum finalisasi (`ollama run <model> --verbose`).

**Beban base vs fine-tuned: identik — fine-tuning tidak mengecilkan beban, hanya menaikkan kualitas keputusan:**
- Fine-tuning V1 pakai **LoRA** (§7.4) lalu adapter-nya **di-merge** ke bobot base model sebelum dikonversi `.gguf`. Hasilnya **bukan** base model + layer tambahan — jumlah parameter, ukuran file, RAM, dan kecepatan **sama persis** antara base dan `kandang-advisor` (baris tabel di atas berlaku untuk keduanya). Fine-tuning **tidak bisa** dipakai untuk mengecilkan beban di Pi.
- Yang berubah dari fine-tuning adalah **kualitas keputusan**, bukan ukuran model: PRD §9 test T6 membandingkan model base vs fine-tuned pada 20 skenario sama, lalu mengukur seberapa sering guard (§6) terpaksa meng-override usulan AI — model fine-tuned seharusnya lebih jarang di-override karena sudah belajar dari data kandang asli (override manual + data sintetis, §7.4), bukan sekadar model bahasa umum.
- Training LoRA sendiri (bukan saat inferensi) jauh lebih ringan dari full fine-tuning — hanya menyimpan adapter kecil (puluhan MB) selama proses di Colab T4; adapter ini dibuang/di-merge setelah training, jadi tidak menambah beban di Pi.
- Implikasi: tidak perlu upgrade hardware antara Fase 1 (model base) dan Fase 2 (model fine-tuned, §10) — footprint RAM/disk/kecepatan identik. Kalau nanti memang butuh beban lebih kecil lagi, satu-satunya jalan adalah **ganti base model** (turun ke 0.5B) atau **quantize lebih agresif** (Q4→Q2/Q3) — dua-duanya trade-off langsung ke kualitas jawaban, dan V1 sengaja tidak memilih ini kecuali Pi 4 4GB terbukti kepepet saat benchmark nyata.

### 7.3 Modelfile (disimpan di `pi/Modelfile`)
```
FROM qwen2.5:1.5b-instruct
PARAMETER temperature 0.2
SYSTEM """Kamu asisten pengendali atap kandang ayam. Berdasarkan fakta sensor yang diberikan,
tentukan sudut atap optimal (0=tutup penuh, 90=buka penuh) dan jelaskan alasannya singkat
dalam Bahasa Indonesia. Keputusanmu adalah USULAN — sistem keamanan terpisah bisa
membatalkannya. Jawab HANYA dalam format JSON yang diminta."""
```
Build: `ollama create kandang-advisor -f pi/Modelfile`

### 7.4 Fine-tuning (dikerjakan di PC/Colab, BUKAN di Pi)
1. **Data generation**: `pi/training/labeler.py` — rule-based labeler yang generate ribuan pasangan `facts → {angle, reason}` dari skenario simulasi (suhu/kelembapan/gas/jam/cuaca bervariasi), berdasarkan pedoman unggas (nyaman 18-25°C, stress panas >30°C, kelembapan ideal 50-70%, NH3 aman <25ppm, lihat §6 untuk threshold exact).
2. **Override logging**: setiap kali user override manual dari dashboard, `pi/logger.py` mencatat facts + angle pilihan user ke `pi/data/overrides.jsonl` — ini data gold-standard, prioritas lebih tinggi dari data sintetis saat training.
3. **Training**: LoRA di atas `Qwen2.5-1.5B-Instruct` menggunakan Unsloth atau LLaMA-Factory, di Google Colab (free T4 cukup).
4. **Convert & quantize**: merge adapter → `convert_hf_to_gguf.py` (llama.cpp) → quantize `Q4_K_M`.
5. **Deploy**: copy `.gguf` ke Pi, update `pi/Modelfile` baris `FROM`, `ollama create kandang-advisor -f pi/Modelfile` ulang.

---

## 8. Perubahan ke Komponen Existing

| Komponen | Perubahan | Wajib/Opsional |
|---|---|---|
| `backend/.env` | `MQTT_BROKER` ganti ke IP lokal Pi (mis. `mqtt://192.168.1.X:1883`) | Wajib untuk offline (§2) |
| `firmware/esp32-kandang-lengkap/config.h` | `MQTT_BROKER` ganti ke IP Pi (baris 15, ada contoh di baris 21) | Wajib untuk offline |
| Dashboard web (`frontend/`) | Tambah field tampilan: sudut atap AI + `reason` text + badge sumber (`ai`/`guard`) | Opsional V1, rekomendasi untuk UX |
| Backend API | Endpoint baru opsional untuk expose log keputusan AI terbaru ke frontend | Opsional V1 |

Tidak ada perubahan wajib ke `.ino` firmware untuk V1 — AI control memakai command manual existing (lihat §6.4 untuk constraint re-send).

---

## 9. Test Plan

| # | Test | Cara | Hasil wajib |
|---|---|---|---|
| T1 | Offline total (cabut WAN, Mosquitto tetap lokal) | Matikan internet di Pi, jalankan full loop 30 menit | Decision loop tetap jalan, tidak crash, weather field = "tidak tersedia" |
| T2 | Ollama restart di tengah loop | `systemctl restart ollama` saat loop jalan | Satu cycle gagal (timeout/error), cycle berikutnya normal, tidak ada cmd korup terkirim |
| T3 | Guard override semua skenario G1-G6 | Unit test `pi/guard.py` dengan input manual | Lihat tabel §6.6 |
| T4 | Firmware fallback setelah Pi dimatikan | Matikan service Pi, tunggu >10 menit | ESP32 balik ke hysteresis `TEMP_BUKA_ATAP`/`TEMP_TUTUP_ATAP` otomatis (behavior existing, hanya verifikasi tidak rusak) |
| T5 | RTC survive power cut | Cabut power Pi, tunggu 1 menit, nyalakan tanpa internet | Jam Pi tetap benar (dari DS3231), bukan default epoch |
| T6 | End-to-end dengan model fine-tuned vs base | Jalankan 20 skenario sama dengan model base dan fine-tuned | Bandingkan rate keputusan yang di-override guard — fine-tuned seharusnya lebih rendah |

---

## 10. Fase Implementasi

- **Fase 1 (V1, dokumen ini):** `pi/` service lengkap dengan model base (belum fine-tuned), Mosquitto lokal, guard, logging, weather cache. Target: sistem offline jalan aman dengan advisor generik.
- **Fase 2:** Data collection (overrides + sintetis) → fine-tuning → deploy model custom `kandang-advisor`.
- **Fase 3 (opsional, di luar scope ini):** Firmware ditambah mode `"ai"` permanen (tidak expired 10 menit) + rain sensor fisik + LDR, supaya guard §6.2 bisa aktif penuh tanpa tergantung API cuaca online.

---

## 11. Open Questions / Risiko

1. Tanpa rain sensor fisik dan tanpa internet, sistem **tidak punya cara mendeteksi hujan real-time**. Guard §6.2 praktis tidak aktif saat offline > beberapa jam (cache cuaca expired). Risiko: atap terbuka saat hujan tiba-tiba di malam hari tanpa internet. Mitigasi jangka pendek: tidak ada selain pasang rain sensor (Fase 3). Perlu keputusan pemilik produk apakah ini acceptable untuk V1.
2. Breed/umur ayam spesifik mempengaruhi threshold nyaman — threshold di §6 adalah pedoman umum, bukan tervalidasi untuk breed yang dipelihara. Perlu validasi dengan peternak/dosen pembimbing sebelum dianggap final.
3. Kecepatan inference LLM di Pi 4 (4GB) belum dibenchmark nyata — angka §7.2 adalah estimasi dari model card publik, bukan hasil tes di board ini.

---

## 12. Definition of Done (V1)

- [ ] `pi/` service berjalan sebagai systemd service, auto-restart jika crash.
- [ ] Semua acceptance criteria §6.6 (G1-G6) lolos unit test.
- [ ] Semua test §9 (T1-T5 minimal; T6 jika model fine-tuned sudah ada) lolos manual.
- [ ] Sistem tetap berfungsi aman selama ≥24 jam tanpa internet (T1 extended).
- [ ] RTC terpasang dan terverifikasi survive power cut (T5).
- [ ] Dokumentasi setup (`pi/README.md`) mencakup instalasi Mosquitto, Ollama, systemd service, dan cara ganti `MQTT_BROKER` di firmware + backend.


---

# Progress AI Atap — status & handoff

> Sumber: `docs/PROGRESS-AI-ATAP.md`

# Progress — AI Kontrol Atap Offline (handoff antar-AI)

PRD acuan: `docs/PRD-AI-Kontrol-Atap-Offline-V1.md` (V1, 11 Okt 2026).
File ini ditulis agar AI berikutnya bisa lanjut tanpa membaca ulang semua chat.

## Status per bagian PRD

| PRD | Status | Keterangan |
|---|---|---|
| §2 scope Fase 1 (`pi/`, Mosquitto lokal, Ollama, guard, cuaca cache, logging) | ✅ kode selesai | 12 file di `pi/`, terverifikasi (lihat bawah) |
| §3 arsitektur (loop 60–120 dtk, topic cmd/ai) | ✅ | `mqtt_listener.py` loop 90 dtk, publish `.../cmd` + `.../ai` |
| §4 hardware (Pi, RTC DS3231, cooler) | ⬜ belum | Belanja/pasang fisik + T5 |
| §5.1–5.2 facts builder | ✅ | `pi/facts.py` persis pseudocode PRD + baris sensor hujan lokal |
| §5.3 JSON schema LLM | ✅ | `DECISION_SCHEMA` di `pi/advisor.py`, `format=` Ollama dipaksa |
| §5.4–5.5 guard kontrak + topic cmd | ✅ | `pi/guard.py` + `should_publish()` (§6.4) |
| §6.1–6.4 guard rules | ✅ | Unit test G1–G6 lolos 9/9 (`python -m unittest test_guard -v` di `pi/`) |
| §6.5 fallback firmware | ✅ | Tanpa kode (behavior existing), hanya verifikasi T4 |
| §7.1–7.3 stack + model + Modelfile | ✅ file, ⬜ benchmark | `pi/Modelfile` default `qwen2.5:1.5b-instruct`; kecepatan Pi BELUM dibenchmark (§11.3) |
| §7.4 fine-tuning | 🟡 sebagian | `pi/training/labeler.py` jadi + smoke test 200 baris OK; training LoRA (Colab) BELUM; `overrides.jsonl` logger SIAP menampung data real user |
| §8 perubahan existing | 🟡 sebagian | Backend forward `iot/device/+/ai` → socket `aiKeputusan` ✅; listener `aiKeputusan` di `v10.html` ✅; **MQTT_BROKER di `config.h` + `backend/.env` BELUM diganti IP Pi** (butuh IP asli) |
| §9 T1–T6 | ⬜ belum | Butuh Pi fisik + ESP32 (T1 offline 30 mnt, T2 restart Ollama, T3 = unit test ✅, T4 fallback, T5 RTC, T6 base vs fine-tuned) |
| §10 Fase 2/3 | ⬜ belum | Fase 2 = kumpulkan overrides + training; Fase 3 = mode `"ai"` firmware + rain/LDR fisik |
| §11 open questions | 🟡 | 11.1 hujan offline → diputuskan ACCEPTABLE + rain sensor opsional didukung kode; 11.2 threshold pakai angka PRD + sumber literatur di komentar `config.py`; 11.3 benchmark Pi pending |
| §12 DoD | 🟡 | Kode + unit test ✅; systemd file ✅ (belum diuji di Pi); README ✅; 24-jam offline + RTC ⬜ |

## File dibuat/diubah sesi ini

- Baru: `pi/config.py, facts.py, guard.py, advisor.py, weather.py, rainsensor.py,
  logger.py, mqtt_listener.py, requirements.txt, Modelfile, kandang-ai.service,
  test_guard.py, README.md, data/.gitkeep, training/labeler.py`
- Ubah: `backend/src/config/mqtt.js` (subscribe `+/ai`, emit `aiKeputusan`),
  `frontend/v10.html` (1 baris listener `aiKeputusan` → status log + notif).
- Tidak diubah: firmware `.ino` (sesuai PRD, V1 tanpa ubah firmware).

## Keputusan yang sudah dikunci user

1. Fase 1 dulu; data real dikumpulkan user nanti via `overrides.jsonl`.
2. Rain sensor YL-83 boleh dipakai (GPIO 17, `RAIN_ENABLED=0` untuk matikan).
3. Threshold ikut PRD + literatur (komentar sumber di `config.py`).
4. Combo `pecutt-premium` 9router: gas full 14 model, judge
   `cl/anthropic/claude-opus-5.5` (sudah ditulis ke DB 9router;
   restart 9router DITOLAK user — ingatkan untuk restart manual).

## Perintah verifikasi cepat

```bash
cd pi && python -m unittest test_guard -v        # harus 9 OK
python -m py_compile *.py training/labeler.py    # harus tanpa error
python training/labeler.py --n 3000 --out data_train.jsonl
node --check ../backend/src/config/mqtt.js
```

## Saran langkah berikutnya (untuk AI lanjut)

1. Minta IP Pi user → ganti `MQTT_BROKER` di `config.h` + `backend/.env`.
2. Saat Pi ada: ikut `pi/README.md` (Mosquitto → Ollama → systemd), benchmark
   `ollama run qwen2.5:1.5b-instruct --verbose`, jalankan T1–T5.
3. Kumpulkan `overrides.jsonl` dari pemakaian real → Fase 2 training LoRA di Colab.


---

# README Service Pi

> Sumber: `pi/README.md`

# AI Kontrol Atap Offline (Kandang Ayam) — Fase 1

Service Raspberry Pi: baca sensor via MQTT lokal, minta saran sudut atap ke LLM
lokal (Ollama), saring lewat guard safety, publish perintah ke ESP32.
Jalan 100% offline kecuali cache cuaca (opsional).

PRD: `docs/PRD-AI-Kontrol-Atap-Offline-V1.md`

## File

| File | Fungsi |
|---|---|
| `config.py` | Threshold + konstanta (samakan firmware `config.h`) |
| `mqtt_listener.py` | Loop utama: subscribe data, panggil facts→advisor→guard, publish cmd |
| `facts.py` | Bangun teks fakta Bahasa Indonesia (LLM tidak menghitung) |
| `advisor.py` | Panggil Ollama `kandang-advisor`, format JSON dipaksa |
| `guard.py` | Safety layer plain Python, veto mutlak atas AI |
| `weather.py` | Cache Open-Meteo, expiry 6 jam, gagal = pakai cache / None |
| `rainsensor.py` | Baca YL-83 via GPIO (`RAIN_ENABLED=0` untuk nonaktifkan) |
| `logger.py` | Append JSONL keputusan + override manual (bahan training Fase 2) |
| `test_guard.py` | Unit test G1–G6 (`python -m unittest test_guard -v`) |
| `Modelfile` | Definisi model Ollama (`ollama create kandang-advisor -f Modelfile`) |
| `kandang-ai.service` | Unit systemd, copy ke `/etc/systemd/system/` |

## Instal di Pi

```bash
# 1. Dependensi
sudo apt install mosquitto python3-pip
pip install -r requirements.txt

# 2. Mosquitto lokal (config repo sudah ada)
sudo cp ../mosquitto/config/mosquitto.conf /etc/mosquitto/mosquitto.conf
sudo systemctl enable --now mosquitto

# 3. Ollama + model (±1 GB, butuh internet sekali saat download)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:1.5b-instruct
ollama create kandang-advisor -f Modelfile

# 4. Service
sudo cp kandang-ai.service /etc/systemd/system/
sudo mkdir -p /opt/kandang && sudo cp -r . /opt/kandang/pi
sudo systemctl enable --now kandang-ai
```

## Wajib ubah agar offline (PRD §8)

1. `firmware/esp32-kandang-lengkap/config.h` → `MQTT_BROKER` = IP Pi
   (contoh Opsi B di baris 21 sudah ada, tinggal aktifkan).
2. `backend/.env` → `MQTT_BROKER=mqtt://<IP-Pi>:1883`.

Tanpa ini ESP32 & backend masih ke `broker.emqx.io` dan mati saat internet putus.
Firmware `.ino` TIDAK perlu diubah (V1 pakai cmd manual + re-send tiap cycle).

## Rain sensor YL-83 (opsional)

- DO modul → GPIO 17 Pi (ubah via `RAIN_GPIO`), VCC 3V3, GND.
- Tanpa sensor / di PC: `read_rain()` balikin `None`, guard hujan di-skip aman.
- Nonaktifkan paksa: `RAIN_ENABLED=0`.

## Data

`data/` berisi `decisions.jsonl` (tiap cycle), `overrides.jsonl` (override
manual = data gold Fase 2), `weather_cache.json`, `window_cache.jsonl`,
`state.json` (sudut + timestamp cmd terakhir).


---

# PRD Kandang Ayam IoT V1 — sistem dasar

> Sumber: `docs/PRD-Kandang-Ayam-IoT-V1.md`

# PRD — Sistem Monitoring Kandang Ayam IoT (ESP32 + Web Real-Time)

**Versi:** 1.0 — 7 Okt 2026
**Device:** `esp32-rakit-01` | **Firmware:** `firmware/esp32-kandang-lengkap/`
**Broker default:** `broker.emqx.io:1883` | **Backend:** Node.js + MQTT.js + Socket.IO + MongoDB

Dokumen pendamping:
- `docs/WIRING-ESP32-KANDANG-LENGKAP.md` — wiring detail
- `docs/SKETCH-INO-ESP32.md` — bedah sketch `.ino` + `config.h`
- `docs/WEB-IOT-DASHBOARD.md` — arsitektur web, API, Socket.IO, cara jalan

---

## 1. Latar Belakang & Tujuan

Monitoring kandang manual (cek suhu, bau amonia, pakan, buka-tutup atap) tidak real-time dan melelahkan. Sistem ini mengotomatiskan semuanya:

1. ESP32 baca **DHT22** (suhu/kelembapan), **MQ-135** (gas amonia), **FC-51 IR** (pakan) tiap 5 detik.
2. Atap dibuka/tutup otomatis oleh **2x servo MG90S** berdasar suhu, bisa dioverride dari web.
3. Data dikirim via **MQTT** → backend simpan ke **MongoDB** → dorong ke dashboard via **Socket.IO** real-time.
4. Dashboard web tampilkan kartu Suhu, Kelembapan, Gas NH3, Pakan + tombol Jendela Atap + grafik + alert.

## 2. Scope

### In-scope (V1)
- 1 device ESP32 DevKit V1 30-pin (`esp32-rakit-01`).
- Sensor: DHT22 (GPIO14), IR FC-51 (GPIO27), MQ-135 AO (GPIO34) + DO opsional (GPIO35).
- Aktuator: 2x MG90S sinyal GPIO12 + GPIO13, mode mirror kupu-kupu.
- Atap otomatis hysteresis: buka ≥31 °C, tutup ≤28 °C, manual timeout 10 menit.
- MQTT topics `iot/device/esp32-rakit-01/data|cmd|status`.
- Backend: subscribe MQTT, simpan `SensorData`, emit `dataBaru`, cek alert, REST API data/device/alert.
- Frontend: dashboard live (kandang-ayam.html / uiuxbaru.html), kartu + grafik + kontrol atap.
- Kompatibilitas mundur: field lama `suhu`/`kelembapan` tetap, field baru opsional.

### Out-of-scope (V1)
- Multi-device, OTA firmware, TLS client-cert di ESP32, kontrol conveyor/lampu fisik (baru simulasi 3D).

## 3. Pengguna & User Stories

| Aktor | Story | Acceptance |
|---|---|---|
| Peternak | Lihat suhu/lembap/gas/pakan live di HP | Data update ≤7 detik, badge OK/warning/danger benar |
| Peternak | Buka/tutup atap dari web saat hujan/panas | Servo gerak ≤3 detik setelah tombol, mode jadi `manual` |
| Peternak | Dapat peringatan gas tinggi / pakan habis | Toast + alert tersimpan saat gas >40 ppm / pakan=0 |
| Dosen/penguji | Lihat bukti end-to-end + wiring rapi | Serial Monitor JSON + web tampil + dokumen ini |

## 4. Arsitektur Sistem

```
[DHT22][IR][MQ-135] → [ESP32] → WiFi 2.4GHz → [broker.emqx.io:1883]
  topic data: iot/device/esp32-rakit-01/data (publish tiap 5 dtk)
  topic cmd:  iot/device/esp32-rakit-01/cmd  (subscribe perintah atap)
      ↓
[Backend Node.js: mqtt.js subscribe → SensorData.create → io.emit('dataBaru')]
      ↓ MongoDB (iotdb.SensorData) + Socket.IO
[Dashboard web: kartu, chart, tombol atap → publish cmd via backend/MQTT]
```

## 5. Spesifikasi Hardware (ringkas)

| Modul | Pin modul → ESP32/Power |
|---|---|
| DHT22 VCC/GND/DATA | 3V3 / GND / GPIO14 (+R 10k DATA→3V3) |
| Servo #1 sinyal/VCC/GND | GPIO12 / 5V adaptor / GND adaptor (+common ke ESP) |
| Servo #2 sinyal/VCC/GND | GPIO13 / 5V adaptor / GND adaptor |
| IR FC-51 VCC/GND/OUT | 3V3 (gabung DHT boleh) / GND / GPIO27 |
| MQ-135 VCC/GND/AO/DO | 5V adaptor / GND / GPIO34 / GPIO35 opsional |
| Power | Adaptor 5V ≥2A khusus servo+MQ; ESP via USB/VIN; **GND wajib satu** (pusat di adaptor) |

Detail + diagram + troubleshooting: lihat `WIRING-ESP32-KANDANG-LENGKAP.md`.

## 6. Spesifikasi Firmware (ringkas)

- File: `esp32-kandang-lengkap.ino` (217 baris) + `config.h` (65 baris), board `ESP32 Dev Module`, baud 115200.
- Library: Adafruit DHT + Unified Sensor, PubSubClient, ArduinoJson v6, ESP32Servo.
- Loop: baca DHT → logika atap auto → baca gas (rata-rata 10x ADC) → baca IR → publish JSON → kedip LED GPIO2.
- Format data (publish):
```json
{"deviceId":"esp32-rakit-01","suhu":30.5,"kelembapan":65,"gas":12.3,"gasRaw":512,"pakan":1,"pakanPersen":100,"atap":90,"mode":"auto","timestamp":123}
```
- Format perintah (subscribe): `{"actuator":"atap","value":90}` / `{"atap":90}` / `{"mode":"auto"}`. Nilai 0/90 atau bool.
- Kalibrasi gas: `GAS_ADC_BERSIH 300` (=0 ppm), `GAS_ADC_KOTOR 2200` (=100 ppm), burn-in 24 jam.

Detail per fungsi: lihat `SKETCH-INO-ESP32.md`.

## 7. Spesifikasi Web (ringkas)

- Backend `backend/src/config/mqtt.js`: subscribe `MQTT_TOPIC=iot/device/+/data`, simpan ke `SensorData.js` (field gas/pakan/atap opsional), emit `dataBaru` + `deviceStatus`, panggil `checkAlerts`.
- Model `SensorData`: deviceId, suhu, kelembapan, gas, gasRaw, pakan, pakanPersen, atap, mode, timestamp.
- Frontend: `frontend/kandang-ayam.html` (3D), `uiuxbaru.html`, `js/main.js` via Socket.IO; kartu Gas warning 25 ppm / danger 40 ppm.
- Env penting `.env.example`: PORT 4000, MONGODB_URI, MQTT_BROKER, MQTT_TOPIC, ALERT_TEMP_MAX/MIN, ALERT_HUMIDITY_MAX/MIN, CORS_ORIGIN.

Detail + API + cara run: lihat `WEB-IOT-DASHBOARD.md`.

## 8. Kriteria Penerimaan (UAT)

1. Upload firmware → Serial Monitor: `WiFi OK`, `MQTT OK`, JSON tiap 5 detik.
2. Tangan tutup IR → `pakan` 1→0 di serial + web.
3. Panaskan DHT (atau turunkan `TEMP_BUKA_ATAP` sementara) → servo buka 90°.
4. Web: 4 kartu terisi, tombol Jendela Atap gerakkan servo ≤3 detik.
5. Matikan WiFi 10 detik → ESP reconnect sendiri, tidak hang.
6. Backend log tampil `MQTT message` tiap 5 detik, data tersimpan di MongoDB.

## 9. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| ESP restart (power kurang) | Adaptor 5V ≥2A, star-ground di adaptor, kabel pendek |
| Servo getar | Hysteresis 28/31 °C + gerak halus 1°/20 ms |
| MQ ngaco (belum burn-in) | Tulis disclaimer estimasi, kalibrasi 2 titik via serial |
| IR logika terbalik | `IR_PAKAN_INVERT` 0/1 tanpa ubah kabel |
| Broker publik down | Ganti ke Mosquitto lokal `192.168.x.x:1883` di `config.h` + `.env` |


---

# Wiring ESP32 Kandang Lengkap

> Sumber: `docs/WIRING-ESP32-KANDANG-LENGKAP.md`

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


---

# Sketch INO ESP32

> Sumber: `docs/SKETCH-INO-ESP32.md`

# Bedah Sketch INO — `firmware/esp32-kandang-lengkap/`

File: `esp32-kandang-lengkap.ino` (217 baris) + `config.h` (65 baris).
Board Arduino IDE: **ESP32 Dev Module**, baud Serial **115200**.
Library: Adafruit `DHT sensor` + `Adafruit Unified Sensor`, `PubSubClient`, `ArduinoJson` v6, `ESP32Servo`.

## 1. `config.h` — semua yang boleh kamu ubah

| Bagian | Isi | Default |
|---|---|---|
| WiFi | `WIFI_SSID/PASSWORD` | `IOT-ESP` / `12345678` (2.4 GHz) |
| MQTT | `MQTT_BROKER/PORT/USER/PASS/TLS` | `broker.emqx.io:1883`, TLS 0 |
| Device | `DEVICE_ID`, `MQTT_TOPIC_DATA/CMD/STATUS` | `esp32-rakit-01` |
| Pin | `DHT_PIN 14`, `SERVO_KANAN 12`, `SERVO_KIRI 13`, `IR 27`, `MQ_AO 34`, `MQ_DO 35` | jangan ubah kecuali wiring ikut |
| Servo | `SERVO_MIRROR 1` | 1=kupu-kupu, 0=paralel |
| Atap auto | `TEMP_BUKA 31`, `TEMP_TUTUP 28`, `MANUAL_TIMEOUT 600000` (10 mnt) | hysteresis anti-getar |
| Gas | `GAS_ADC_BERSIH 300`, `GAS_ADC_KOTOR 2200`, `GAS_MAX 100` | kalibrasi 2 titik |
| Interval | `SEND_INTERVAL 5000` | kirim tiap 5 detik |

## 2. Alur `setup()` (baris 141-168)

1. `Serial.begin(115200)`, `dht.begin()`, `pinMode(IR, INPUT)`, `pinMode(MQ_DO, INPUT)`, LED GPIO2 OUTPUT.
2. Servo: `allocateTimer(0/1)`, `setPeriodHertz(50)`, `attach(pin, 500, 2400)`, mulai tertutup `atapTulis(0)`.
3. `analogSetAttenuation(ADC_11db)` → ADC baca penuh 0-3.3V.
4. `setupWiFi()` (retry 40x lalu restart), set MQTT server + callback + keepalive 60.

## 3. Alur `loop()` (baris 170-217)

```
cek WiFi → cek MQTT → mqtt.loop()
→ manual expired? kembali AUTO
→ tiap 5 detik:
   bacaDHT (gagal? skip kirim)
   logika atap AUTO (hysteresis)
   bacaGas (rata-rata 10x) + bacaPakan
   rakit JSON → publish TOPIC_DATA → kedip LED
```

## 4. Fungsi Penting

- `atapTulis(sudut)` — tulis kedua servo, kiri di-mirror bila `SERVO_MIRROR=1` (baris 37-43).
- `atapGerakKe(target)` — jalan halus 1°/20 ms agar atap tidak menghentak (46-54).
- `mqttCallback()` (71-100) — terima perintah web:
  - `{"atap":90}` → manual + gerak.
  - `{"mode":"auto"}` → kembali auto.
  - `{"actuator":"atap|roofWindow|roofAngle|sideWindow|sideAngle","value":0-90|bool}` → manual 10 menit.
- `reconnectMQTT()` (102-115) — clientId acak, subscribe CMD, publish `status online`.
- `bacaDHT()` (118-122) — return false bila `nan`.
- `bacaGas(adcOut)` (125-131) — rata-rata 10x `analogRead(34)`, petakan linear BERSIH→KOTOR ke 0→100 ppm.
- `bacaPakan()` (134-138) — `digitalRead(27)`; LOW=ada; hormati `IR_PAKAN_INVERT`.

## 5. Format JSON

Kirim (DATA):
```json
{"deviceId":"esp32-rakit-01","suhu":30.5,"kelembapan":65,"gas":12.3,"gasRaw":512,"pakan":1,"pakanPersen":100,"atap":90,"mode":"auto","timestamp":123}
```
Terima (CMD): contoh `{"actuator":"atap","value":90}` untuk buka penuh, `{"actuator":"atap","value":false}` untuk tutup.

## 6. Cara Upload & Uji

1. Install 4 library di atas via Library Manager.
2. Edit `config.h`: WiFi + broker (samakan dengan backend `.env`).
3. Upload → Serial Monitor 115200 → harus ada `WiFi OK`, `MQTT OK`, JSON tiap 5 detik.
4. Tutup IR dengan tangan → `pakan` 1→0. Dekatkan bau ke MQ → `gas` naik. Panaskan DHT → atap buka.
5. Kalau `Gagal baca DHT`: cek R 10k + kabel GPIO14. Kalau servo diam: cek adaptor 5V + common GND.


---

# Web IoT Dashboard

> Sumber: `docs/WEB-IOT-DASHBOARD.md`

# Web IoT Dashboard — Arsitektur, API & Cara Jalan

## 1. Alur Data End-to-End

```
ESP32 --MQTT JSON--> broker.emqx.io:1883 --subscribe--> backend/src/config/mqtt.js
  --> SensorData.create (MongoDB iotdb) --> io.emit('dataBaru')
  --> frontend (kandang-ayam.html / uiuxbaru.html / js/main.js) update kartu+grafik
  <-- perintah atap: frontend --> backend --> MQTT publish TOPIC_CMD --> ESP32
```

Topik: `iot/device/+/data` (data), `iot/device/esp32-rakit-01/cmd` (perintah), `.../status` (online).
Socket events: `dataBaru` (dokumen sensor), `deviceStatus` (`{deviceId,status}`).

## 2. Backend (Node.js + Express + MQTT.js + Socket.IO + Mongoose)

Struktur relevan:
```
backend/server.js
backend/src/config/mqtt.js      # subscribe, simpan, emit, checkAlerts
backend/src/config/socketio.js  # init Socket.IO
backend/src/models/SensorData.js# suhu, kelembapan, gas, gasRaw, pakan, pakanPersen, atap, mode
backend/src/models/Device.js, Alert.js
backend/src/routes/dataRoutes.js, deviceRoutes.js, alertRoutes.js, authRoutes.js
backend/src/services/alertService.js
```

`.env` penting (lihat `.env.example`):
```
PORT=4000
MONGODB_URI=mongodb://localhost:27017/iotdb
MQTT_BROKER=mqtt://broker.emqx.io:1883
MQTT_TOPIC=iot/device/+/data
ALERT_TEMP_MAX=35 / MIN=15
ALERT_HUMIDITY_MAX=85 / MIN=30   # gas: warning 25 ppm, danger 40 ppm di frontend
CORS_ORIGIN=http://localhost:4000
JWT_SECRET=... / JWT_EXPIRES=7d
```

Logika `mqtt.js:34-79`: parse JSON → buat `doc` (field gas/pakan/atap hanya jika ada → kompatibel firmware lama) → `SensorData.create` + upsert `Device lastSeen` (skip bila DB down/demo) → `io.emit` → `checkAlerts`.

## 3. Frontend

| File | Peran |
|---|---|
| `frontend/kandang-ayam.html` | dashboard 3D kandang + modal sensor/aktuator |
| `frontend/uiuxbaru.html` (+ backup v10) | dashboard UI baru |
| `frontend/js/main.js`, `connector.js` | Socket.IO client, chart, fetch REST |
| `frontend/components/`, `css/` | kartu sensor, badge status, toast |
| `src/App.tsx`, `src/scene.ts` | versi React/Vite + Three.js (alternatif) |

Kartu: Suhu, Kelembapan, Gas NH3 (warning ≥25, danger ≥40 ppm), Pakan (1=ada/0=habis), Atap (0-90°) + tombol Buka/Tutup + toggle Auto/Manual.

## 4. REST API (ringkas)

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/data?deviceId=esp32-rakit-01&limit=50` | riwayat sensor |
| GET | `/api/data/latest/:deviceId` | data terakhir |
| GET | `/api/devices` | daftar device + lastSeen |
| POST | `/api/devices/:id/cmd` body `{"actuator":"atap","value":90}` | kirim perintah atap via MQTT |
| GET | `/api/alerts` | riwayat alert |
| POST | `/api/auth/login` | JWT admin |

## 5. Cara Menjalankan (lokal)

```powershell
# 1. MongoDB + Mosquitto (atau pakai broker.emqx.io)
# 2. Backend
cd backend; Copy-Item .env.example .env  # sesuaikan MQTT_BROKER + MONGODB_URI
npm install; npm run dev   # port 4000
# 3. Frontend
# buka http://localhost:4000 (diserv backend) atau frontend/*.html
# 4. Simulasi tanpa ESP32
node scripts/simulate-device.js
node scripts/publish-test.js
# 5. ESP32 asli: samakan DEVICE_ID + broker di config.h, upload, cek backend log "MQTT message"
```

## 6. Deploy & Samakan ID

- Broker publik `broker.emqx.io:1883` harus sama di `config.h` (`MQTT_BROKER/PORT`) dan backend `.env` (`MQTT_BROKER`, `MQTT_TOPIC`).
- `DEVICE_ID=esp32-rakit-01` harus sama di firmware, backend seed, dan query frontend.
- Field baru (gas/pakan/atap) opsional di DB → dashboard lama tidak rusak; dashboard baru tinggal baca field tambahan.


---

# PRD Final V6

> Sumber: `docs/PRD-FINAL-V6.md`

# PRD: Kandang Ayam 3D — Final Polish v6

## File Target
kandang-ayam-3d-v5-MODAL.html

## Status Saat Ini
- 3D sudah bagus (tekstur kayu, seng rust, jerami, ayam variasi, spider web)
- UI v4 sudah ada (glassmorphism, dark/light mode, sparkline, animated counter)
- Modal v5 sudah ada (sensor detail + aktuator detail)
- MASALAH: ada teks PRD markdown nyangkut di atas <!DOCTYPE html> → wajib dibersihkan
- MASALAH: modal belum 100% selesai (P1/P2 belum diimplementasi)

## Tugas Utama

### TUGAS 0 — BERSIHKAN FILE DARI TEKS MARKDOWN
- Hapus SEMUA teks di atas `<!DOCTYPE html>`
- File harus dimulai persis dengan `<!DOCTYPE html>`
- JANGAN hapus kode di dalam `<style>` atau `<script>`

### TUGAS 1 — LENGKAPI MODAL DASHBOARD (V5 → FINAL)

#### Sensor Modal (4: Suhu, Lembap, Gas, Pakan)
- [x] Big value + status badge
- [x] Chart besar dengan area gradient
- [x] Statistik (min/max/avg)
- [x] Threshold slider (AKTIFKAN — sekarang disabled, harus bisa digeser & tersimpan)
- [x] Riwayat 10 entri (tambah timestamp akurat)
- [ ] TAMBAH: Export CSV asli (generate file .csv lalu download)
- [ ] TAMBAH: Tombol "Calibrate" yang mengubah offset sensor
- [ ] TAMBAH: Warning badge pulse animation di card kalau status warning/critical
- [ ] TAMBAH: Notifikasi browser (Web Notifications API) saat sensor masuk critical

#### Aktuator Modal (4: Jendela Atap, Jendela Samping, Conveyor, Lampu)
- [x] Slider sudut servo
- [x] Tombol Buka/Tutup/Stop
- [x] Toggle Manual/Auto
- [ ] TAMBAH: Slider servo benar-benar mengubah rotasi 3D real-time
- [ ] TAMBAH: Slider kecepatan (0.5x - 5x) mempengaruhi kecepatan animasi 3D
- [ ] TAMBAH: Tab "Riwayat" (log aktivitas: kapan buka/tutup, berapa lama)
- [ ] TAMBAH: Tab "Setting" (schedule harian: buka jam X, tutup jam Y)
- [ ] TAMBAH: Conveyor RPM slider benar-benar mengubah kecepatan belt 3D
- [ ] TAMBAH: Lampu brightness benar-benar mengubah intensitas PointLight 3D
- [ ] TAMBAH: Color temp slider mengubah warna PointLight (2700K-6500K)

### TUGAS 2 — POLISH UI (P1/P2 dari PRD lama)

#### 2A. Statistik Global di Header
Baris kecil di bawah judul:
- Uptime: 0h 0m (hitung dari waktu load)
- Total request: 0 (hitung setiap update sensor)
- Status: 4 OK / 0 warning / 0 critical

#### 2B. Keyboard Shortcut + Overlay Hint
- `1` `2` `3` `4` → buka modal sensor
- `Q` `W` `E` `R` → buka modal aktuator
- `ESC` → tutup modal
- `?` (tahan) → overlay daftar shortcut
- `T` → toggle tema

#### 2C. Sound Feedback (opsional, ada toggle mute di header)
- Beep halus saat buka/tutup modal (Web Audio API, no file)
- Beep berbeda saat warning (nada rendah) & critical (nada tinggi)

#### 2D. Notification Badge di Card Sensor
- Card Suhu/Lembap/Gas/Pakan → badge merah/oranye di pojok kanan atas kalau status warning/critical
- Pulse animation (opacity 0.6 ↔ 1, durasi 2s)
- Badge hilang otomatis saat nilai normal

#### 2E. Toast Stack (max 3)
- Multiple toast bisa muncul bersamaan
- Stack vertikal dari atas
- Auto-dismiss dengan progress bar visual

#### 2F. Mini-Map Posisi Ayam
- Kotak 120×60px di pojok kanan bawah (di atas panel kontrol)
- Canvas 2D, tampilkan denah kandang + dot posisi 12 ayam
- Update real-time (setiap frame atau 5 fps)
- Klik minimap → zoom kamera ke posisi ayam

#### 2G. Export & Import Config
- Tombol di header → export state (device, threshold) ke JSON
- Import JSON → restore state

### TUGAS 3 — BERSIHKAN FOLDER PROYEK

Setelah semua selesai, lakukan audit folder:

#### 3A. Identifikasi File
Scan folder tempat file HTML ini berada. Kategorikan setiap file:
- **KEEP**: file HTML final, asset yang dipakai (jika ada)
- **BACKUP**: file backup lama (misal: `kandang-v3.html`, `kandang-v4-backup.html`)
- **JUNK**: file sementara, PRD lama, snippet code yang tidak dipakai, file test, file .bak, file .tmp, file .old

#### 3B. Konfirmasi ke User SEBELUM Hapus
Tampilkan daftar file yang akan dihapus dalam format:
File yang akan dihapus:
- kandang-ayam-3d-upgraded (1).html (backup v3, 85KB)
- kandang-v4-backup.html (backup v4, 92KB)
- PRD-DASHBOARD-V5.md (PRD lama, sudah tidak dipakai)
- test-output.txt (file test)
- snippet-modal.js (snippet sementara)

File yang DIPERTAHANKAN:
- kandang-ayam-3d-v5-MODAL.html (file utama)
- PRD-FINAL-V6.md (PRD aktif)

Lanjut hapus? (y/n)

#### 3C. Hapus HANYA Setelah User Konfirmasi
- JANGAN hapus tanpa konfirmasi eksplisit
- Kalau ada file ambigu → tanya dulu
- JANGAN hapus file di luar folder proyek
- JANGAN hapus folder (hanya file individual)

#### 3D. Buat File Backup Sebelum Hapus (opsional)
Kalau user setuju, buat folder `_backup-hapus/` dan pindahkan file ke situ, bukan langsung hapus. User bisa hapus sendiri nanti.

## Guard Rails (JANGAN UBAH)
- Struktur 3D kandang, proporsi 2.4×0.8
- Warna material 3D
- Background studio putih
- 12 ayam, model ayam
- Logic SimulationSource (boleh extend)
- Sistem state (boleh extend)

## Deliverable
- File HTML updated, single-file, dimulai dengan `<!DOCTYPE html>`
- TIDAK ADA teks markdown/PRD di dalam file
- Comment `// V6: <deskripsi>` per perubahan
- Laporan file yang dihapus

## Test Checklist
- [ ] File dimulai dengan `<!DOCTYPE html>`
- [ ] 8 modal berfungsi (4 sensor + 4 aktuator)
- [ ] Slider servo mengubah 3D real-time
- [ ] Export CSV menghasilkan file .csv
- [ ] Keyboard shortcut berfungsi
- [ ] Toast stack berfungsi
- [ ] Mini-map menampilkan 12 ayam
- [ ] Dark/light mode OK
- [ ] 3D tidak rusak
- [ ] FPS ≥ 30
- [ ] Mobile responsive
- [ ] Folder bersih dari file junk


---

# PRD UI Redesign V9

> Sumber: `docs/PRD-UI-REDESIGN-V9.md`

# PRD: Kandang Ayam IoT — UI Redesign Anti-Slop (v9)

## Metadata
- **File target**: `kandang-ayam-3d-v5-MODAL.html`
- **Tanggal**: 2026-10-03
- **Versi**: v9 (anti-slop redesign)
- **Prioritas**: P0 (font+color), P1 (icon+radius), P2 (detail), P3 (nilai tambah)

---

## 1. Latar Belakang

### Masalah
UI overlay (panel, button, modal) menggunakan pattern default yang sama dengan jutaan template AI-generated:
- Font **Inter** (default AI)
- Warna **#f97316 orange** (default Tailwind)
- **Emoji** sebagai icon (🪟🚪⚙️💡)
- **Glassmorphism** `backdrop-filter: blur(16px)` di mana-mana
- **Border-radius 14px** seragam semua elemen
- **Corner accent HUD** dekoratif tanpa fungsi
- **Gradient ungu** di background
- **Hover `transform:scale(1.05)`** di semua tombol

### Tujuan
Transformasi dari "template AI" → "control panel industrial yang punya karakter".
Target: orang yang lihat harus berpikir "ini dibikin manusia yang peduli detail".

---

## 2. Aesthetic Direction

### Pilihan: **INDUSTRIAL / TERMINAL HUD**

**Vibe**: Control panel pabrik, HUD militer, terminal retro, NASA control room.

**Kesan**: "Kandang ini dipantau 24/7 oleh sistem serius."

### Alasan
- Cocok untuk IoT monitoring (data-dense, real-time)
- Kontras dengan 3D scene yang warm/organic → balance visual
- Anti-mainstream dari "AI slop" yang biasanya pastel/glassmorphism

---

## 3. Typography

### Font Baru
```html
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
```

### Hierarchy Dramatis

| Elemen | Font | Weight | Size | Keterangan |
|---|---|---|---|---|
| Panel header (.ph) | JetBrains Mono | 600 | 10px | UPPERCASE + letter-spacing |
| Nilai sensor (.card .v) | JetBrains Mono | 700 | 18px | Padding digit: 029.2°C |
| Label sensor (.card .l) | JetBrains Mono | 400 | 9px | UPPERCASE |
| Body text | IBM Plex Sans | 400/500 | 12-14px | Regular copy |
| Modal big value | JetBrains Mono | 700 | 48px | Hero number |
| Button label | JetBrains Mono | 600 | 10px | UPPERCASE |
| Timestamp | JetBrains Mono | 400 | 10px | Format [14:32:01] |

### Aturan
- Semua angka pakai JetBrains Mono (monospace alignment)
- Semua label pakai JetBrains Mono UPPERCASE
- Semua body/deskripsi pakai IBM Plex Sans
- JANGAN pakai Inter lagi

---

## 4. Color Palette

### Dark Mode (default)
```css
:root {
  --bg-base: #0f172a;      /* slate-900, bukan pure black */
  --bg-panel: #1e293b;      /* slate-800, solid (bukan glassmorphism) */
  --bg-card: #0f172a;       /* lebih gelap dari panel */
  --border: #334155;        /* slate-700 */
  
  --accent: #d97706;        /* amber-600 (bukan orange #f97316) */
  --accent-dim: #78350f;    /* amber-900 */
  --accent-glow: #fbbf24;   /* amber-400 untuk glow */
  
  --success: #15803d;       /* green-700, muted */
  --warning: #b45309;       /* amber-700 */
  --danger: #991b1b;        /* red-800, muted */
  
  --text-primary: #e2e8f0;  /* slate-200 */
  --text-secondary: #94a3b8;/* slate-400 */
  --text-muted: #64748b;    /* slate-500 */
}
```

### Light Mode
```css
:root.light {
  --bg-base: #f1f5f9;       /* slate-100 */
  --bg-panel: #ffffff;      /* white */
  --bg-card: #f8fafc;       /* slate-50 */
  --border: #cbd5e1;        /* slate-300 */
  
  --accent: #92400e;        /* amber-800 (muted di light) */
  --accent-dim: #fef3c7;    /* amber-100 */
  
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #64748b;
}
```

### Aturan
- JANGAN pakai #f97316 (orange Tailwind) lagi
- JANGAN pakai gradient ungu/biru
- Semua warna muted, bukan saturated

---

## 5. Layout & Shape

### Panel
- Width: 240px (dari 260px, lebih compact)
- Padding: 14px (dari 12px)
- Border-radius: 4px (dari 14px)
- Border: 1px solid var(--border)
- Background: solid (hapus backdrop-filter)
- Shadow: tidak ada → pakai inset border untuk depth

### Card (sensor)
- Padding: 10px
- Border-radius: 2px
- Border-left: 3px solid (warna sensor)
- Background: var(--bg-card)

### Button
- Padding: 10px 8px
- Min-height: 56px
- Border-radius: 2px
- Border: 1px solid var(--border)
- Background: transparent
- Hover: background: var(--accent-dim) (BUKAN transform:scale)
- Active: background: var(--accent) 100ms

### Modal
- Max-width: 560px
- Border-radius: 4px
- Border: 1px solid var(--border)
- Background: var(--bg-panel) solid
- Header: border-bottom 1px solid var(--border)

### Aturan Shape
- Border-radius max 4px (bukan 14px)
- Hapus semua `.panel::before` dan `.panel::after` (corner accent HUD)
- Hapus glassmorphism backdrop-filter di semua panel
- Hapus `box-shadow: 0 8px 32px` → ganti `border: 1px solid`

---

## 6. Icon System

### Ganti Semua Emoji dengan SVG Inline (Lucide, 18×18, stroke 1.8)

#### Jendela Atap (🪟):
```html
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
```

#### Jendela Samping / Pintu (🚪):
```html
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4h3a2 2 0 0 1 2 2v14M2 20h3M13 20h9"/><path d="M10 12v.01"/><path d="M13 4v16"/></svg>
```

#### Conveyor / Gear (⚙️):
```html
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
```

#### Lampu (💡):
```html
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V17h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z"/></svg>
```

### CSS
```css
.btn i { display: none; }        /* sembunyikan emoji lama */
.btn svg { width: 18px; height: 18px; }
```

---

## 7. Micro-interactions

### Hover
- Background berubah (--accent-dim)
- BUKAN `transform: scale()`
- Durasi: 150ms linear

### Click
- Background flash --accent 100ms

### Focus (aksesibilitas)
- `outline: 2px solid var(--accent)`
- `outline-offset: 2px`

### Transisi
- Semua transisi: 150ms linear (bukan 200ms ease)

---

## 8. Detail Anti-Slop (P2)

### 8.1 Grid Background
Ganti gradient ungu di html,body dengan grid pattern SVG:

```css
body {
  background: 
    linear-gradient(var(--bg-base), var(--bg-base)),
    repeating-linear-gradient(0deg, transparent, transparent 39px, var(--border) 39px, var(--border) 40px),
    repeating-linear-gradient(90deg, transparent, transparent 39px, var(--border) 39px, var(--border) 40px);
  background-blend-mode: overlay;
  opacity: 1;
}
```

### 8.2 Panel ID
Setiap panel dapat label kecil di pojok kiri atas:

```html
<div class="panel-id">PNL-01</div>
```

```css
.panel-id {
  position: absolute;
  top: 4px; left: 6px;
  font: 600 8px 'JetBrains Mono';
  color: var(--text-muted);
  letter-spacing: 0.1em;
}
```

- Panel sensor: PNL-01
- Panel kontrol: PNL-02

### 8.3 Scanline Subtle
Overlay tipis di seluruh panel:

```css
.panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(255,255,255,0.02) 0px,
    rgba(255,255,255,0.02) 1px,
    transparent 1px,
    transparent 2px
  );
  pointer-events: none;
  border-radius: inherit;
}
```

### 8.4 Timestamp Format
Di modal history, ganti format:

- Lama: `14:32:01`
- Baru: `[14:32:01]` (pakai bracket)

### 8.5 Nilai Sensor Format
Padding 3 digit:

- Lama: `29.2°C`
- Baru: `029.2°C` (leading zero)

---

## 9. Nilai Tambah (P3 — Opsional)

### 9.1 Emergency Stop Button
Tombol besar merah di panel kontrol:

```
┌──────────────┐
│  E-STOP      │
│  (hold 2s)   │
└──────────────┘
```

Klik → semua aktuator false, panel flash merah, log EMERGENCY

### 9.2 Status Log Mini (bottom-left panel)
Baris kecil di bawah panel sensor:

```
[14:32:01] OK   KR:1  SN:4
[14:32:03] WARN TEMP 33.2C
[14:32:05] OK   SN:4
```

Update dari subscribe() event. Max 5 baris.

### 9.3 Console Command (advanced)
Input teks di bawah panel kontrol:

- `open roof` → buka jendela atap
- `close side` → tutup jendela samping
- `set temp 30` → ubah threshold
- `log` → tampilkan riwayat
- `help` → daftar command

### 9.4 Copy Value on Click
Klik nilai sensor → copy `temp=29.2` ke clipboard → toast konfirmasi.

### 9.5 Compact / Cozy Mode
Toggle di header:

- **Compact**: panel 200px, font 9px, padding 8px
- **Cozy**: panel 240px, font 11px, padding 14px

### 9.6 Anomaly Highlight
Kalau nilai sensor berubah >10% dalam 5 detik → card flash amber 1 detik.

---

## 10. Guard Rails

### JANGAN UBAH
- ❌ 3D scene (camera, light, texture, mesh, ayam, animasi)
- ❌ Logic JavaScript (state, subscribe, notify, animate, SimulationSource)
- ❌ ID HTML yang dipakai JS (#s-temp, #s-humid, #s-gas, #s-feed)
- ❌ Fungsi modal (openModal, closeModal, buildSensorModal, buildActuatorModal)
- ❌ Data sensor & format update
- ❌ Responsive breakpoint (768px)
- ❌ Layout 3D canvas positioning

### BOLEH UBAH
- ✅ Semua CSS (refactor total OK)
- ✅ Semua ikon (emoji → SVG)
- ✅ Font & warna (variables)
- ✅ Border-radius, shadow, backdrop-filter
- ✅ Micro-interaction
- ✅ Layout panel (width, position, padding)
- ✅ Tambah elemen UI baru (panel ID, log, dll)

---

## 11. Deliverable
- **File**: `kandang-ayam-3d-v5-MODAL.html` (updated)
- **Backup**: `kandang-v5-backup.html` (dibuat sebelum edit)
- **Comment**: Setiap perubahan diberi tag `// V9: <deskripsi>`
- **Test**: Buka di browser, cek 3D scene tetap jalan

---

## 12. Test Checklist

### P0 — Wajib
- [ ] Font JetBrains Mono + IBM Plex Sans ke-load
- [ ] Warna accent amber (#d97706), bukan orange (#f97316)
- [ ] Tidak ada emoji di tombol kontrol
- [ ] Ikon SVG muncul, ukuran 18px
- [ ] Border-radius max 4px
- [ ] Panel solid (no backdrop-filter)
- [ ] Corner accent HUD (.panel::after) dihapus

### P1 — Fungsi
- [ ] 3D scene tetap berfungsi
- [ ] Modal buka/tutup normal
- [ ] Nilai sensor tetap update (cek 5 detik)
- [ ] Sparkline tetap render
- [ ] Keyboard shortcut masih jalan
- [ ] Dark/light mode toggle jalan
- [ ] FPS ≥ 30

### P2 — Polish
- [ ] Grid background muncul
- [ ] Panel ID (PNL-01, PNL-02) muncul
- [ ] Scanline subtle kelihatan
- [ ] Hover pakai background (bukan scale)
- [ ] Focus outline var(--accent) muncul saat Tab

### P3 — Nilai Tambah
- [ ] Emergency stop berfungsi (kalau diimplementasi)
- [ ] Status log mini update (kalau diimplementasi)
- [ ] Console command jalan (kalau diimplementasi)
- [ ] Copy value on click jalan (kalau diimplementasi)

### Mobile (width < 768px)
- [ ] Panel tidak overlap
- [ ] Modal full-screen
- [ ] Font tetap readable
- [ ] Grid background tidak bikin lag

---

## 13. Alur Eksekusi

### Fase 1 — P0 (30 menit)
1. Ganti font (Inter → JetBrains Mono + IBM Plex Sans)
2. Ganti palette (orange → amber)
3. Ganti icon (emoji → SVG)
4. Ganti radius (14px → 4px) + hapus shadow + hapus glassmorphism
5. Test di browser, commit.

### Fase 2 — P1 (15 menit)
1. Polish hover state (background, bukan scale)
2. Focus outline aksesibel
3. Transisi 150ms linear
4. Test di browser, commit.

### Fase 3 — P2 (20 menit)
1. Grid background
2. Panel ID
3. Scanline subtle
4. Timestamp + nilai format
5. Test di browser, commit.

### Fase 4 — P3 (opsional, 30 menit)
1. Emergency stop
2. Status log mini
3. Console command
4. Copy value
5. Test di browser, commit.

---

## 14. Skills Aktif

| Skill | Fungsi |
|---|---|
| ui-ux-pro-max | Database design (161 palette, 57 font pairing) |
| frontend-design | Aesthetic direction, hindari templated look |
| theme-factory | Konsistensi palette dark & light mode |
| writing-plans | Rencana terstruktur per fase |
| systematic-debugging | Kalau ada layout error / font gak load |
| verification-before-completion | Checklist akhir |

---

## 15. Prompt untuk OpenCode

```text
Task: Eksekusi PRD-UI-REDESIGN-V9.md di kandang-ayam-3d-v5-MODAL.html

File: [path file HTML]
PRD: [path PRD-UI-REDESIGN-V9.md]

## ATURAN KETAT
1. FOKUS HANYA UI OVERLAY — jangan sentuh 3D scene
2. JANGAN ubah logic JavaScript atau ID HTML yang dipakai JS
3. Semua perubahan diberi tag `// V9: <deskripsi>`
4. Test di browser setiap selesai 1 fase

## ALUR KERJA

### Step 1 — Baca
Baca file HTML + PRD ini.
Laporkan:
- Berapa AI slop pattern ditemukan (min 10)
- Font yang dipakai saat ini
- Warna default Tailwind yang dipakai
- Border-radius yang dipakai

### Step 2 — Rencana
Pakai skill `writing-plans`.
Buat rencana per fase (P0 → P1 → P2 → P3).
Setiap fase: apa yang diubah, file/fungsi, estimasi baris, cara test.

TUNGGU APPROVAL dari aku.

### Step 3 — Eksekusi
Per fase, urut P0 → P1 → P2 → P3.
Test di browser setelah setiap fase.

### Step 4 — Verifikasi
Pakai skill `verification-before-completion`.
Checklist dari PRD dijalankan.

## GUARD RAILS
JANGAN UBAH:
- 3D scene (camera, light, texture, mesh)
- Logic JavaScript (state, subscribe, animate)
- ID HTML (#s-temp, #s-humid, dll)
- Fungsi modal

BOLEH UBAH:
- Semua CSS
- Icon (emoji → SVG)
- Font, warna, radius, shadow
- Layout panel (width, padding)

## SKILLS AKTIF
ui-ux-pro-max, frontend-design, theme-factory,
writing-plans, systematic-debugging, verification-before-completion

## OUTPUT
Setelah selesai, kasih:
- File backup dibuat
- Checklist PRD terisi
- Screenshot visual (kalau bisa)

Mulai Step 1. JANGAN coding dulu.
```

---

## 16. Hasil yang Diharapkan

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Font | Inter | JetBrains Mono + IBM Plex Sans |
| Accent | #f97316 (orange) | #d97706 (amber muted) |
| Icon | 🪟🚪⚙️💡 (emoji) | SVG Lucide 18px |
| Radius | 14px | 4px |
| Panel bg | Glassmorphism blur | Solid + border 1px |
| Corner accent | Ada (dekoratif) | Dihapus |
| Hover | scale(1.05) | background change |
| Background | Gradient ungu | Dark slate + grid |
| Kesan | "AI-generated" | "Control panel industrial" |

---

## 17. Referensi Visual
- **Linear.app** — minimal, mono, gelap
- **Vercel dashboard** — technical, mono, HUD
- **NASA control room** — dense, functional, utilitarian
- **Teenage Engineering OP-1** — industrial, mono, tactile


---

# PRD V10

> Sumber: `docs/PRD-V10.md`

# PRD: Kandang Ayam 3D — Audit & Upgrade v10

## Metadata
- **File target**: `kandang-ayam-3d-v5-MODAL.html`
- **Tanggal**: 2026-10-03
- **Versi**: v10 (popup info, layout fix, onboarding)
- **Prioritas**: P0 (layout + tooltip), P1 (notification + trend + command), P2 (serial + toggle + theme)

---

## 1. Latar Belakang

### Masalah Post-V9
Setelah redesign v9 (industrial HUD), ditemukan beberapa bug dan gap UX:
- Panel kanan terlalu tinggi (~340px) → menutupi 3D scene dan overlap minimap
- Minimap posisi statis tidak adaptif → kadang tertimpa panel
- Tidak ada tooltip/info untuk user baru (onboarding 0)
- Tidak ada command palette / notification center
- Status log kepotong (max-height 36px terlalu kecil)

### Tujuan
Transformasi dari "panel kaku" → "interface interaktif yang bisa dijelajahi".
Target: user baru langsung paham tanpa baca manual.

---

## 2. Aesthetic Direction (lanjut v9)
Tetap **Industrial / Terminal HUD** dengan tambahan:
- Tooltip: solid dark bg, border accent, font mono, muncul 300ms
- Spotlight overlay: gelap dengan hole cutout di elemen target
- Command palette: mirror style modal card
- Notification badge: amber dot, angka kecil

---

## 3. P0 — Fix Layout + Popup Info

### 3.1 Reorganisasi Panel PNL-02
**Masalah**: Panel kontrol saat ini semua tombol bareng, section E-STOP & console memakan ruang.

**Solusi**:
- Grid 2x2 tetap untuk 4 tombol kontrol (sudah ada, pertahankan)
- Section "Tools" collapsible di bawah grid:
  - Default: collapsed (tinggi ~0, hanya tombol chevron visible)
  - Expanded: E-STOP + Console input
  - Tombol toggle: `⚙ Tools ▾` dengan chevron rotate 180° saat expand
- Tinggi panel collapsed: ~200px (dari ~340px saat ini)

**Implementasi**:
```html
<div id="cp">
  <div class="panel-id">PNL-02</div>
  <div class="ph">Kontrol</div>
  <div class="g">...4 tombol...</div>
  <button class="tools-toggle" onclick="toggleTools()">⚙ Tools ▾</button>
  <div id="tools-section" class="tools-collapsed">
    <!-- E-STOP + Console input -->
  </div>
</div>
```
```css
.tools-collapsed { max-height: 0; overflow: hidden; transition: max-height 150ms linear; }
.tools-expanded { max-height: 300px; }
```

### 3.2 Fix Minimap Overlap
**Masalah**: Minimap posisi `bottom: calc(32px + 220px + 8px)` hardcoded — tidak adaptif jika panel berubah tinggi.

**Solusi**: JS hitung otomatis:
```js
function updateMinimapPos() {
  const cp = $('cp');
  const sp = $('sp');
  const panelH = Math.max(cp.offsetHeight, sp.offsetHeight);
  const mm = $('minimap-container');
  mm.style.bottom = `calc(${32 + panelH + 8}px)`;
}
// Panggil saat init dan saat toggleTools()
```
Update juga di resize event.

### 3.3 Info Tooltip
**Masalah**: User tidak tahu fungsi setiap tombol/card.

**Solusi**: `data-tip="..."` attribute + CSS/JS tooltip system.

**HTML**:
```html
<button class="btn" data-d="roofWindow" data-modal="roofWindow" data-tip="Buka/tutup jendela atap ventilasi">...</button>
<div class="card" data-modal="temp" data-tip="Suhu operasional: 25-35°C normal">...</div>
```

**CSS**:
```css
[data-tip]{position:relative}
[data-tip]::after{
  content:attr(data-tip);
  position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%) translateY(4px);
  background:var(--bg-panel);border:1px solid var(--border);border-left:3px solid var(--accent);
  padding:6px 10px;border-radius:4px;font:400 10px 'JetBrains Mono',monospace;
  color:var(--text-primary);white-space:nowrap;pointer-events:none;
  opacity:0;transition:opacity 150ms linear,transform 150ms linear;z-index:100;
}
[data-tip]:hover::after{opacity:1;transform:translateX(-50%) translateY(0)}
/* Mobile: tap via JS */
```

### 3.4 Info Icon (ⓘ) di Header Panel
**Masalah**: Tidak ada cara tahu fungsi panel secara keseluruhan.

**Solusi**: Tambah button `ⓘ` di setiap panel header, klik → reuse modal system.

```html
<div class="ph">Sensor<span class="panel-info-btn" onclick="showPanelInfo('sensor')">ⓘ</span></div>
```
```css
.panel-info-btn{float:right;cursor:pointer;opacity:.5;transition:opacity 150ms linear;font-size:12px}
.panel-info-btn:hover{opacity:1}
```

**Content modal**:
```
Title: Panel Sensor
Desc: Menampilkan 4 nilai real-time dari sensor IoT. Klik nilai untuk detail chart & threshold.
Features:
- Suhu: DHT22, range 25-35°C
- Lembap: DHT22, range 50-80%
- Gas NH3: MQ9, range 5-45 ppm
- Pakan: Load cell, range 20-100%
Shortcuts: [1] [2] [3] [4]
```

### 3.5 Onboarding Tour
**Masalah**: User baru tidak tahu apa-apa.

**Solusi**: Spotlight overlay muncul pertama kali (cek localStorage).

**Steps**:
1. Panel Sensor (kiri bawah) — "Ini panel sensor. Nilai update tiap 2 detik."
2. Panel Kontrol (kanan bawah) — "Klik tombol atau tekan Q/W/E/R."
3. Minimap (kanan atas) — "Lihat posisi ayam real-time."
4. Tombol kamera — "Ganti sudut pandang."
5. Stats bar — "Status sistem global."

**Implementation**:
- Overlay gelap penuh dengan `clip-path` hole di elemen target
- Navigasi: Skip / Next / Done
- Simpan di localStorage: `v10-onboarding-done=true`
- Button reset: `localStorage.removeItem('v10-onboarding-done')`

```js
function startOnboarding(){
  if(localStorage.getItem('v10-onboarding-done'))return;
  // show overlay with step-by-step
}
```

---

## 4. P1 — Kreativitas & Polish

### 4.1 Notification Center
**Masalah**: Toast hanya muncul sebentar, tidak ada history.

**Solusi**: Icon 🔔 di header, badge angka, klik → dropdown panel.

**Implementation**:
- Tambah `#notif-bell` di header, count badge
- Array `_notifLog[]` simpan semua notifikasi
- Dropdown panel: list item + clear all button
- Setiap `toast()` → push ke `_notifLog` + update badge

```js
function _addNotif(msg, type='info'){
  _notifLog.unshift({time:new Date(),msg,type});
  if(_notifLog.length>20)_notifLog.pop();
  updateNotifBadge();
}
```

### 4.2 Trend Indicator di Sensor Card
**Masalah**: Nilai sensor statis, tidak tahu arah perubahan.

**Solusi**: Arrow ↗ ↘ di sebelah nilai, berdasarkan perbandingan dengan 3 data terakhir.

**Implementation**:
```js
// Di subscribe(), compare nilai saat ini vs 3 tick sebelumnya
if(history.length>=3){
  const prev=history[history.length-4];
  const curr=val;
  const diff=((curr-prev)/prev*100);
  if(diff>5) arrow='↗'; else if(diff<-5) arrow='↘'; else arrow='→';
  el.innerHTML=`${value}<span class="trend ${arrow}">${arrow}</span>`;
}
```

### 4.3 Command Palette (Ctrl+K)
**Masalah**: Tidak ada cara cepat akses fitur tanpa klik/kb shortcut satu per satu.

**Solusi**: Ctrl+K → overlay center input, fuzzy search commands.

**Commands**:
- `open roof` → source.sendCommand('roofWindow', true)
- `close roof` → source.sendCommand('roofWindow', false)
- `open side` / `close side`
- `conveyor on` / `conveyor off`
- `light on` / `light off`
- `set brightness 80`
- `export csv` / `reset history`
- `toggle theme`
- `hide panels` / `show panels`
- `reset onboarding`
- `emergency stop`
- `help` → tampilkan shortcuts

**UI**: Mirip VS Code command palette — input di tengah, list result di bawah.

### 4.4 Status Log Expand
**Masalah**: `max-height:36px` → hanya 2 baris terlihat.

**Solusi**: `max-height:60px`, tambah tombol clear log.

---

## 5. P2 — Extra Polish

### 5.1 Live Serial Monitor
Panel kecil di bawah minimap (collapsed default). Format:
```
[14:32:01] SENSOR temp=29.2 hum=68
[14:32:03] CMD roof_angle=45
[14:32:05] OK actuator=roof
```

### 5.2 Panel Layout Toggle
Tombol di header: "⛶ Hide UI" → semua panel fade out → 3D fullscreen. ESC → muncul kembali.

### 5.3 Color Theme Presets
3 preset via CSS class di `<html>`:
- `amber-slate` (default): --accent:#d97706
- `cyan-navy`: --accent:#0891b2, --accent-dim:#164e63
- `emerald-charcoal`: --accent:#059669, --accent-dim:#064e3b

Dropdown di settings atau cycle button.

---

## 6. Guard Rails

### JANGAN UBAH
- ❌ 3D scene (camera, light, texture, mesh, ayam, animasi)
- ❌ Logic JavaScript (state, subscribe, notify, animate, SimulationSource)
- ❌ ID HTML yang dipakai JS (#s-temp, #s-humid, #s-gas, #s-feed)
- ❌ Fungsi modal existing (openModal, closeModal, buildSensorModal, buildActuatorModal)
- ❌ Data sensor & format update
- ❌ Responsive breakpoint (768px)

### BOLEH UBAH
- ✅ Semua CSS (tambah rule baru)
- ✅ Tambah elemen HTML baru (tooltip, onboarding overlay, notif panel, command palette)
- ✅ Tambah JS baru (fungsi baru, tidak ubah existing)
- ✅ Layout panel (width, height, position)
- ✅ localStorage keys baru

---

## 7. Deliverable
- **File**: `kandang-ayam-3d-v5-MODAL.html` (updated)
- **Backup**: Buat sebelum edit (jika belum ada yang baru)
- **Comment**: Setiap perubahan diberi tag `// V10: <deskripsi>` atau `/* V10: */`

---

## 8. Test Checklist

### P0 — Fix Layout + Popup Info
- [ ] Panel PNL-02 collapsed height ~200px (bukan 340px)
- [ ] Tombol "⚙ Tools" toggle expand/collapse berfungsi
- [ ] Minimap tidak overlap panel (posisi adaptif via JS)
- [ ] Tooltip muncul saat hover tombol & sensor card
- [ ] Info icon (ⓘ) di panel header → modal popup info
- [ ] Onboarding tour muncul pertama kali (refresh browser tanpa localStorage)
- [ ] Onboarding skip → tidak muncul lagi (tersimpan di localStorage)

### P1 — Kreativitas
- [ ] Notification bell icon di header, badge angka
- [ ] Klik bell → dropdown list notifikasi
- [ ] Trend arrow ↗/↘ di sensor card (bukan static)
- [ ] Ctrl+K → command palette muncul
- [ ] Command palette fuzzy search jalan
- [ ] Enter di command palette execute command
- [ ] Status log bisa scroll / max-height 60px

### P2 — Extra Polish
- [ ] Live serial monitor (collapsed default)
- [ ] Hide UI toggle → semua panel hilang → 3D fullscreen
- [ ] ESC → panel muncul kembali
- [ ] Color theme preset cycle

### Guard Rail Check
- [ ] 3D scene tetap jalan (FPS ≥ 30)
- [ ] Modal sensor/aktuator tetap buka normal
- [ ] Keyboard shortcut 1-4, Q-E, T, ESC tetap jalan
- [ ] Dark/light mode toggle jalan
- [ ] Sparkline tetap render
- [ ] Value sensor tetap update tiap 2 detik

---

## 9. Skills Aktif
- **writing-plans** — rencana terstruktur per fase
- **frontend-design** — panduan UI konsisten industrial HUD
- **theme-factory** — konsistensi palette (termasuk presets)
- **systematic-debugging** — kalau ada layout error / tooltip overlap
- **verification-before-completion** — checklist akhir


---

# PRD Laporan Dosen

> Sumber: `docs/PRD-Laporan-Dosen.md`

# PRODUCT REQUIREMENT DOCUMENT (PRD)
## Sistem Monitoring Suhu & Kelembapan Berbasis IoT Real-Time
### ESP32 + DHT22 → MQTT → Node.js → MongoDB → Dashboard Web

**Disusun oleh:**
- Nama: [Nama Mahasiswa]
- NIM: [NIM]
- Program Studi: [Teknik Informatika / Teknik Elektro]
- Universitas: [Nama Universitas]
- Dosen Pembimbing: [Nama Dosen]
- Tahun Akademik: 2025/2026

---

## BAB 1 — PENDAHULUAN

### 1.1 Latar Belakang
Pemantauan suhu dan kelembapan secara manual tidak efisien dan tidak real-time. Sistem IoT memungkinkan pembacaan sensor otomatis setiap 5 detik dan ditampilkan langsung di dashboard web yang dapat diakses publik.

### 1.2 Rumusan Masalah
1. Bagaimana merancang perangkat ESP32 + DHT22 yang mengirim data via MQTT?
2. Bagaimana membangun backend yang menyimpan data dan meneruskannya real-time ke dashboard?
3. Bagaimana mendeploy sistem agar dapat diakses semua orang via internet?

### 1.3 Tujuan
1. Membangun firmware ESP32 + DHT22 dengan koneksi WiFi/MQTT otomatis.
2. Membangun backend Node.js + MongoDB + Socket.IO untuk API dan real-time.
3. Mendeploy dashboard publik di `https://iot-pulse-monitor.onrender.com/`.

### 1.4 Manfaat
Akademik (praktik IoT end-to-end), praktis (monitoring ruangan/lab/server), dan publik (demo live).

### 1.5 Batasan Masalah
- 1 device ESP32 (`esp32-rakit-01`), sensor DHT22 pin GPIO4, interval 5 detik.
- Broker publik `broker.emqx.io:1883` (tanpa TLS).
- Dashboard publik read-only untuk umum; admin via JWT.

## BAB 2 — DASAR TEORI
- **ESP32 DevKit**: mikrokontroler WiFi 2.4 GHz.
- **DHT22**: sensor suhu (-40–80 °C, ±0.5 °C) & kelembapan (0–100%, ±2%).
- **MQTT**: protokol publish/subscribe ringan untuk IoT.
- **Node.js + Express + MQTT.js + Socket.IO + Mongoose**.
- **MongoDB**: database dokumen (`iotdb`).
- **Chart.js**: grafik dashboard.

## BAB 3 — PERANCANGAN SISTEM

### 3.1 Arsitektur
```
[DHT22] → [ESP32] → (WiFi/hotspot 2.4 GHz) → [broker.emqx.io:1883]
  → [Backend Render: subscribe MQTT → MongoDB Atlas → Socket.IO]
  → [Dashboard publik https://iot-pulse-monitor.onrender.com/]
```

### 3.2 Perangkat Keras
| Komponen | Spesifikasi |
|---|---|
| ESP32 | DevKit V1, WiFi STA |
| Sensor | DHT22, DATA → GPIO4, VCC → 3V3, GND → GND |
| Indikator | LED built-in GPIO2 kedip tiap kirim |
| Catu daya | USB 5V / hotspot laptop `IOT-ESP` |

### 3.3 Perangkat Lunak
Backend: Node.js ≥18, Express 4, Socket.IO 4, MQTT.js 5, Mongoose 8, JWT, Winston. Frontend: HTML/CSS/JS, Chart.js, Socket.IO Client. Firmware: Arduino IDE, library DHT Adafruit, PubSubClient, ArduinoJson v6.

### 3.4 MQTT & Payload
- Data: `iot/device/esp32-rakit-01/data`
- Status: `iot/device/esp32-rakit-01/status`
```json
{ "deviceId": "esp32-rakit-01", "suhu": 28.5, "kelembapan": 70, "timestamp": 1704108000 }
```

### 3.5 REST API (`/api`)
| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api` | Status server + demoMode |
| GET | `/api/health` | Mongo, uptime |
| GET | `/data` | Riwayat sensor |
| GET | `/data/latest` | Data terbaru per device |
| POST | `/data` | Kirim data manual |
| POST | `/auth/login` | Login JWT |
| GET | `/devices` | List device |
| GET | `/alerts` | List alert (suhu > 35 °C) |

### 3.6 Database (`iotdb`)
- `devices`: deviceId, nama, lokasi, status, lastSeen
- `sensordatas`: deviceId, suhu, kelembapan, timestamp
- `users`: username, password (hash), role
- `alerts`: deviceId, tipe, nilai, pesan, level

## BAB 4 — IMPLEMENTASI
1. Firmware `firmware/esp32-dht22/` (config.h + esp32-dht22.ino): auto-connect WiFi, reconnect MQTT, kirim JSON tiap 5 detik.
2. Backend `backend/server.js`: subscribe `iot/device/+/data`, simpan MongoDB, emit Socket.IO.
3. Frontend `frontend/`: dashboard 3D (`uiuxbaru.html`, default) + legacy (`index.html`).
4. Deploy: backend di Render Singapore (free), URL `https://iot-pulse-monitor.onrender.com/`, repo `https://github.com/raffsyahputra3-sys/iot-pulse-monitor`.

## BAB 5 — PENGUJIAN
| # | Skenario | Hasil yang diharapkan | Status |
|---|---|---|---|
| U1 | ESP32 nyala, hotspot 2.4 GHz | Serial: `WiFi connected` | ☐ |
| U2 | Publish MQTT | Serial: `Kirim: {...}`, `connected` | ☐ |
| U3 | Buka `/api` | `status: running, demoMode: false` | ✅ |
| U4 | Buka dashboard publik | Data `esp32-rakit-01` live tiap 5 detik | ☐ |
| U5 | Suhu > 35 °C | Alert muncul | ☐ |
| U6 | WiFi putus | ESP reconnect otomatis | ☐ |

## BAB 6 — PENUTUP
### Kesimpulan
Sistem berhasil dirancang end-to-end dan terdeploy publik. Web live di Render; firmware auto-connect; data real-time.
### Saran
Tambah TLS (8883), multi-device, notifikasi WhatsApp/Telegram, dan mode offline (Mosquitto lokal `192.168.137.1`).

## LAMPIRAN
- Demo publik: https://iot-pulse-monitor.onrender.com/
- API: https://iot-pulse-monitor.onrender.com/api
- Repo: https://github.com/raffsyahputra3-sys/iot-pulse-monitor
- Wiring: VCC→3V3, GND→GND, DATA→GPIO4


---
