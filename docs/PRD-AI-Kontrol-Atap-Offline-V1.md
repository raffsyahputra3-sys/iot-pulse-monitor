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
