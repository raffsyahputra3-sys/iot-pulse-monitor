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
