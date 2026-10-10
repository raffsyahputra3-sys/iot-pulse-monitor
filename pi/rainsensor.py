"""Rain sensor YL-83 di GPIO Raspberry Pi. Di luar Pi (dev/test) -> None.

Modul DO aktif-LOW: pin LOW = basah. None artinya sensor tidak terbaca,
dan guard harus menganggap data hujan tidak valid (bukan False)."""

from config import RAIN_ENABLED, RAIN_GPIO


def read_rain() -> bool | None:
    if not RAIN_ENABLED:
        return None
    try:
        import RPi.GPIO as GPIO
    except (ImportError, RuntimeError):
        return None
    try:
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(RAIN_GPIO, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        return GPIO.input(RAIN_GPIO) == GPIO.LOW
    except RuntimeError:
        return None
