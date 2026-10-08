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
