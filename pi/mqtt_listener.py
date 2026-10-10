"""Loop utama. Subscribe data ESP32, putuskan sudut tiap LOOP_SECONDS, publish cmd.

Jalankan: python mqtt_listener.py   (working dir = folder pi/)
"""

import json
import os
import time
from collections import deque
from datetime import datetime

import paho.mqtt.client as mqtt

import config
from advisor import advise
from facts import build_facts
from guard import guard, should_publish
from logger import log_decision
from rainsensor import read_rain
from weather import get_weather

WINDOW_MAX = config.WINDOW_SECONDS // config.SENSOR_PERIOD_S
window: deque = deque(maxlen=WINDOW_MAX)


def load_window() -> None:
    if not os.path.exists(config.WINDOW_CACHE):
        return
    with open(config.WINDOW_CACHE, encoding="utf-8") as f:
        for line in f:
            try:
                window.append(json.loads(line))
            except json.JSONDecodeError:
                continue


def save_window() -> None:
    os.makedirs(config.DATA_DIR, exist_ok=True)
    with open(config.WINDOW_CACHE, "w", encoding="utf-8") as f:
        for item in window:
            f.write(json.dumps(item) + "\n")


def load_state() -> dict:
    try:
        with open(config.STATE_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {"last_angle": 0, "last_cmd_ts": 0.0}


def save_state(state: dict) -> None:
    os.makedirs(config.DATA_DIR, exist_ok=True)
    with open(config.STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f)


def on_message(_client, _userdata, msg) -> None:
    try:
        payload = json.loads(msg.payload.decode())
    except (json.JSONDecodeError, UnicodeDecodeError):
        return
    if not all(k in payload for k in ("suhu", "kelembapan", "gas", "atap", "mode")):
        return
    window.append(payload)


def decide_once(client, state: dict) -> None:
    if not window:
        return
    now = window[-1]
    weather = get_weather()
    rain_local = read_rain()
    facts = build_facts(list(window), datetime.now(), weather, rain_local)

    ai = advise(facts)
    # AI mati -> tahan sudut terakhir, biarkan guard darurat tetap bisa bertindak.
    ai_angle = ai["angle"] if ai else state["last_angle"]

    angle, source = guard(ai_angle, now, state["last_angle"], weather, rain_local)
    forced = source.startswith("guard: bahaya") or source.startswith("guard: hujan")

    elapsed = time.time() - state["last_cmd_ts"]
    if should_publish(angle, state["last_angle"], elapsed, config.RESEND_SECONDS, forced):
        cmd = json.dumps({"actuator": "atap", "value": angle})
        client.publish(config.TOPIC_CMD, cmd)
        state["last_angle"] = angle
        state["last_cmd_ts"] = time.time()
        save_state(state)

    info = json.dumps({"angle": angle, "source": source,
                       "reason": ai["reason"] if ai else "AI tidak tersedia"})
    client.publish(config.TOPIC_AI, info)
    log_decision(facts, ai, angle, source)
    save_window()


def main() -> None:
    load_window()
    state = load_state()
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_message = on_message
    client.connect(config.MQTT_HOST, config.MQTT_PORT, keepalive=60)
    client.subscribe(config.TOPIC_DATA)
    client.loop_start()
    try:
        while True:
            time.sleep(config.LOOP_SECONDS)
            decide_once(client, state)
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
