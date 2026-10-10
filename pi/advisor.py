"""Advisor LLM via Ollama. Balikin None kalau gagal — pemanggil yang putuskan."""

import json

import requests

from config import OLLAMA_MODEL, OLLAMA_TIMEOUT_S, OLLAMA_URL

DECISION_SCHEMA = {
    "type": "object",
    "properties": {
        "angle": {"type": "integer", "minimum": 0, "maximum": 90},
        "reason": {"type": "string", "maxLength": 160},
        "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
    },
    "required": ["angle", "reason", "confidence"],
}

PROMPT = (
    "Berikut fakta sensor kandang ayam saat ini:\n{facts}\n\n"
    "Tentukan sudut atap optimal. 0 = tutup penuh, 90 = buka penuh. "
    "Jawabanmu hanya USULAN."
)


def advise(facts: str) -> dict | None:
    body = {
        "model": OLLAMA_MODEL,
        "prompt": PROMPT.format(facts=facts),
        "format": DECISION_SCHEMA,
        "stream": False,
        "options": {"temperature": 0.2},
    }
    try:
        r = requests.post(f"{OLLAMA_URL}/api/generate", json=body, timeout=OLLAMA_TIMEOUT_S)
        r.raise_for_status()
        parsed = json.loads(r.json().get("response", ""))
    except (requests.RequestException, json.JSONDecodeError, ValueError):
        return None

    if not isinstance(parsed, dict):
        return None
    if not all(k in parsed for k in ("angle", "reason", "confidence")):
        return None
    try:
        parsed["angle"] = int(parsed["angle"])
    except (TypeError, ValueError):
        return None
    if not 0 <= parsed["angle"] <= 90:
        return None
    if parsed["confidence"] not in ("low", "medium", "high"):
        return None
    return parsed
