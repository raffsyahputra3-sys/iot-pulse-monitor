"""Facts builder. Angka dihitung di sini, LLM hanya membaca teks (§5.2)."""

from datetime import datetime
from statistics import mean

from config import GAS_DANGER, GAS_WARN, TEMP_HI

HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]


def build_facts(window: list[dict], now_dt: datetime, weather: dict | None,
                rain_local: bool | None = None) -> str:
    now, first = window[-1], window[0]
    d_temp = now["suhu"] - first["suhu"]
    menit = max(1, len(window) * 5 // 60) if len(window) > 1 else 0
    jam = now_dt.hour
    hari = HARI[now_dt.weekday()]

    if now["gas"] >= GAS_DANGER:
        gas_status = "BAHAYA"
    elif now["gas"] >= GAS_WARN:
        gas_status = "peringatan"
    else:
        gas_status = "aman"

    lines = [
        f"Waktu: {hari} jam {jam:02d}:00 ({'siang' if 6 <= jam < 18 else 'malam'}).",
        f"Suhu kandang {now['suhu']:.1f} C "
        f"({'DI ATAS' if now['suhu'] >= TEMP_HI else 'di bawah'} batas {TEMP_HI:.0f} C), "
        f"{'naik' if d_temp > 0 else 'turun'} {abs(d_temp):.1f} C dalam {menit} menit terakhir.",
        f"Kelembapan {now['kelembapan']:.0f}% "
        f"(rata-rata window {mean(w['kelembapan'] for w in window):.0f}%).",
        f"Gas amonia {now['gas']:.1f} ppm - status {gas_status}.",
        f"Pakan: {'tersedia' if now['pakan'] else 'HABIS'}.",
        f"Posisi atap saat ini: {now['atap']} derajat, mode firmware: {now['mode']}.",
    ]

    if rain_local is True:
        lines.append("Sensor hujan lokal: BASAH (hujan terdeteksi sensor fisik).")
    elif rain_local is False:
        lines.append("Sensor hujan lokal: kering.")

    if weather is None:
        lines.append("Cuaca online: tidak tersedia (offline, tidak ada cache valid).")
    else:
        usia = f" (data {weather['age_min']} menit lalu)" if weather.get("age_min", 0) > 30 else ""
        lines.append(
            f"Cuaca{usia}: {'HUJAN' if weather['raining'] else 'tidak hujan'}, "
            f"suhu luar {weather['temp_c']:.0f} C, awan {weather['cloud_pct']}%."
        )
    return "\n".join(lines)
