"""Cache cuaca Open-Meteo. Non-blocking: gagal -> pakai cache, cache basi -> None."""

import json
import os
from datetime import datetime, timezone

import requests

from config import WEATHER_CACHE, WEATHER_LAT, WEATHER_LON, WEATHER_MAX_AGE_MIN

URL = "https://api.open-meteo.com/v1/forecast"


def _load() -> dict | None:
    try:
        with open(WEATHER_CACHE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def _age_min(saved_iso: str) -> int:
    saved = datetime.fromisoformat(saved_iso)
    return int((datetime.now(timezone.utc) - saved).total_seconds() // 60)


def get_weather() -> dict | None:
    """{"raining","temp_c","cloud_pct","age_min"} atau None bila tak ada data valid."""
    cached = _load()
    fresh = None
    try:
        r = requests.get(URL, params={
            "latitude": WEATHER_LAT, "longitude": WEATHER_LON,
            "current": "temperature_2m,cloud_cover,precipitation",
        }, timeout=8)
        r.raise_for_status()
        cur = r.json()["current"]
        fresh = {
            "raining": cur.get("precipitation", 0) > 0,
            "temp_c": cur["temperature_2m"],
            "cloud_pct": int(cur.get("cloud_cover", 0)),
            "saved_at": datetime.now(timezone.utc).isoformat(),
        }
        os.makedirs(os.path.dirname(WEATHER_CACHE), exist_ok=True)
        with open(WEATHER_CACHE, "w", encoding="utf-8") as f:
            json.dump(fresh, f)
    except (requests.RequestException, KeyError, ValueError):
        fresh = None

    src = fresh or cached
    if not src:
        return None
    age = 0 if fresh else _age_min(src["saved_at"])
    if age > WEATHER_MAX_AGE_MIN:
        return None
    return {"raining": src["raining"], "temp_c": src["temp_c"],
            "cloud_pct": src["cloud_pct"], "age_min": age}
