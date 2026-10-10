"""Logger keputusan JSONL. Satu baris per cycle, bahan training nanti (§7.4)."""

import json
import os
from datetime import datetime, timezone

from config import DATA_DIR, DECISION_LOG, OVERRIDE_LOG


def _append(path: str, record: dict) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def log_decision(facts: str, ai_output: dict | None, angle: int, source: str) -> None:
    _append(DECISION_LOG, {
        "ts": datetime.now(timezone.utc).isoformat(),
        "facts": facts,
        "ai_output": ai_output,
        "final_angle": angle,
        "source": source,
    })


def log_override(facts: str, user_angle: int) -> None:
    """Panggilan manual saat user override dari dashboard. Data gold-standard."""
    _append(OVERRIDE_LOG, {
        "ts": datetime.now(timezone.utc).isoformat(),
        "facts": facts,
        "user_angle": user_angle,
    })
