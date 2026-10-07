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
