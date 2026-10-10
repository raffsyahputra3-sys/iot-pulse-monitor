"""Guard safety. Plain Python, tanpa LLM. Dievaluasi SETELAH AI, SEBELUM MQTT.

Prioritas: §6.1 darurat > §6.2 hujan > §6.3 rate-limit + snap.
Dwell time (§6.4) ditangani pemanggil lewat should_publish().
"""

from config import ANGLE_STEP, GAS_DANGER, GAS_WARN, MAX_STEP, TEMP_EXTREME, TEMP_HI


def _snap(angle: int) -> int:
    snapped = round(angle / ANGLE_STEP) * ANGLE_STEP
    return max(0, min(90, snapped))


def guard(ai_angle: int, now: dict, last_angle: int, weather: dict | None,
          rain_local: bool | None = None) -> tuple[int, str]:
    # §6.1 override darurat — abaikan AI sepenuhnya, tidak di-rate-limit.
    if now["gas"] >= GAS_DANGER or now["suhu"] >= TEMP_EXTREME:
        return 90, "guard: bahaya gas/panas — atap dibuka penuh"

    # §6.2 hujan. Sumber: sensor lokal (prioritas) atau cuaca online.
    # Tidak ada data valid -> skip, jangan tebak dari kelembapan (§6.2 catatan).
    raining = None
    if rain_local is not None:
        raining = rain_local
    elif weather is not None and "raining" in weather:
        raining = bool(weather["raining"])

    if raining and now["suhu"] < TEMP_HI and now["gas"] < GAS_WARN:
        return 0, "guard: hujan terdeteksi, kondisi dalam kandang aman"

    # §6.3 rate limit +-30 lalu snap kelipatan 15.
    limited = max(last_angle - MAX_STEP, min(last_angle + MAX_STEP, int(ai_angle)))
    final = _snap(limited)
    if final != int(ai_angle):
        return final, "guard: sudut AI dibatasi/dibulatkan"
    return final, "ai"


def should_publish(angle: int, last_angle: int, seconds_since_cmd: float,
                   resend_seconds: int, forced: bool) -> bool:
    """§6.4. forced=True untuk override §6.1/§6.2 (selalu kirim).
    Selain itu: kirim jika sudut berubah, atau sudah lewat batas re-send."""
    if forced:
        return True
    if angle != last_angle:
        return True
    return seconds_since_cmd >= resend_seconds
