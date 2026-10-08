"""Generate one-pager kolaborasi PDF (1 halaman A4)."""
from fpdf import FPDF

REPO = "https://github.com/raffsyahputra3-sys/iot-pulse-monitor"

class OnePager(FPDF):
    def header(self):
        self.set_fill_color(17, 24, 39)
        self.rect(0, 0, 210, 30, "F")
        self.set_y(6)
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(255, 255, 255)
        self.cell(0, 8, "Smart Poultry House  -  IoT + Edge ML", align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 10)
        self.set_text_color(209, 213, 219)
        self.cell(0, 6, "Monitoring + kontrol kandang ayam end-to-end  |  Prototype sudah berjalan", align="C", new_x="LMARGIN", new_y="NEXT")

    def footer(self):
        self.set_y(-14)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(107, 114, 128)
        self.cell(0, 5, "Rafi Praja Syahputra  |  Pendidikan Fisika, UNS  |  rafipraja@student.uns.ac.id  |  " + REPO, align="C")

    def section(self, title):
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(17, 24, 39)
        self.set_fill_color(243, 244, 246)
        self.cell(0, 7, "  " + title, fill=True, new_x="LMARGIN", new_y="NEXT")
        self.ln(1.5)

    def body(self, txt):
        self.set_font("Helvetica", "", 9.5)
        self.set_text_color(31, 41, 55)
        self.multi_cell(0, 5, txt, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def bullets(self, items):
        self.set_font("Helvetica", "", 9.5)
        self.set_text_color(31, 41, 55)
        for b in items:
            self.multi_cell(0, 5, "- " + b, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def placeholder_box(self, label, h=34):
        x, y = self.get_x(), self.get_y()
        self.set_draw_color(156, 163, 175)
        self.set_fill_color(249, 250, 251)
        self.rect(x, y, 190, h, "DF")
        self.set_xy(x, y + h / 2 - 4)
        self.set_font("Helvetica", "I", 9)
        self.set_text_color(107, 114, 128)
        self.cell(190, 8, label, align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_y(y + h + 2)


pdf = OnePager("P", "mm", "A4")
pdf.set_auto_page_break(False)
pdf.add_page()

pdf.section("1. Sistem yang sudah berjalan (bukan ide)")
pdf.body("ESP32 (DHT22 suhu/kelembapan + MQ-135 gas amonia + IR FC-51 pakan + 2x servo MG90S atap) "
         "mengirim JSON tiap 5 detik via MQTT ke backend Node.js (Express + Socket.IO), disimpan ke MongoDB, "
         "tampil real-time di dashboard web + 3D. Perintah balik web -> ESP32 via topik .../cmd "
         "(buka/tutup atap, auto hysteresis 28/31 C + manual override 10 menit). Alert otomatis: suhu > 35 C, "
         "gas > 25 ppm, pakan habis.")
pdf.bullets([
    "End-to-end full-stack: firmware ESP32 + backend + dashboard 3D (repo di bawah).",
    "Multi-device, auth JWT, mode demo bila DB/MQTT mati; deploy lokal + Render + Vercel.",
    "Target riset: fisika terapan (mikroklimat, kalibrasi sensor, efisiensi ventilasi) - bukan veteriner.",
])

pdf.section("2. Bukti")
pdf.set_font("Helvetica", "", 9.5)
pdf.set_text_color(31, 41, 55)
pdf.cell(0, 5, "Prototype kandang + wiring ESP32 (dokumentasi sendiri, Okt 2026):", new_x="LMARGIN", new_y="NEXT")
pdf.image(r"C:\Users\ASUS TUF\Documents\iot-web-monitoring\docs\images\prototype-01.jpg", x=10, w=190, h=42)
pdf.set_y(pdf.get_y() + 44)
pdf.placeholder_box("GRAFIK: tempel 1 grafik 3 hari (suhu / kelembapan / gas) di sini", h=22)
pdf.set_font("Helvetica", "", 8.5)
pdf.set_text_color(31, 41, 55)
pdf.cell(0, 5, "GitHub: " + REPO, new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 5, "Video demo: https://youtube.com/shorts/Qf5C-NR5o1w", new_x="LMARGIN", new_y="NEXT")
pdf.ln(2)

pdf.section("3. Rencana kolaborasi (yang ditawarkan)")
pdf.bullets([
    "Logging 2-4 minggu di kandang asli (interval 5 dtk) -> training di laptop -> export ONNX/TFLite.",
    "Inference pindah ke single-board computer di kandang (offline-first); laptop kini sebagai edge sementara.",
    "Fokus: (a) prediksi suhu/amonia, (b) deteksi anomali + THI heat-stress, (c) kontrol ventilasi prediktif hemat energi.",
    "Skema: saya penulis pertama, Bapak/Ibu corresponding author; dana alat & data saya siapkan; mohon 15 menit diskusi.",
])

out = r"C:\Users\ASUS TUF\Documents\iot-web-monitoring\docs\One-Pager-Kolaborasi.pdf"
pdf.output(out)
print("OK -> " + out)
