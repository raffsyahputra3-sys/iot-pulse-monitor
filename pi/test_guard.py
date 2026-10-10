"""Unit test guard §6.6 (G1-G6) plus dwell time §6.4. Jalan tanpa Pi/MQTT/Ollama."""

import unittest

from guard import guard, should_publish

BASE = {"suhu": 29.0, "gas": 10.0, "kelembapan": 60, "atap": 45, "mode": "auto"}


def now(**kw):
    return {**BASE, **kw}


class TestGuard(unittest.TestCase):
    def test_g1_gas_bahaya(self):
        angle, source = guard(0, now(gas=45), 0, None)
        self.assertEqual(angle, 90)
        self.assertTrue(source.startswith("guard"))

    def test_g2_panas_ekstrem(self):
        angle, source = guard(20, now(suhu=35), 20, None)
        self.assertEqual(angle, 90)
        self.assertTrue(source.startswith("guard"))

    def test_g3_hujan_aman(self):
        weather = {"raining": True, "temp_c": 27, "cloud_pct": 90, "age_min": 5}
        angle, source = guard(60, now(suhu=29, gas=10), 60, weather)
        self.assertEqual(angle, 0)
        self.assertTrue(source.startswith("guard"))

    def test_g3_hujan_dari_sensor_lokal(self):
        angle, source = guard(60, now(suhu=29, gas=10), 60, None, rain_local=True)
        self.assertEqual(angle, 0)
        self.assertTrue(source.startswith("guard"))

    def test_g4_rate_limit(self):
        # last=0, AI usul 90 -> dibatasi +30 -> 30, sudah kelipatan 15.
        angle, source = guard(90, now(), 0, None)
        self.assertEqual(angle, 30)
        self.assertIn("dibatasi", source)

    def test_g4_snap(self):
        # last=0, AI usul 20 -> batas 20 -> snap ke 15.
        angle, _ = guard(20, now(), 0, None)
        self.assertEqual(angle, 15)

    def test_g6_tanpa_cuaca(self):
        angle, source = guard(45, now(), 45, None)
        self.assertEqual(angle, 45)
        self.assertEqual(source, "ai")

    def test_hujan_tapi_panas_tidak_ditutup(self):
        # §6.2 syarat suhu < TEMP_HI. Panas menang, hujan tidak memaksa tutup.
        weather = {"raining": True}
        angle, _ = guard(60, now(suhu=32, gas=10), 60, weather)
        self.assertNotEqual(angle, 0)

    def test_g5_dan_dwell(self):
        # sudut sama, belum 8 menit -> jangan kirim.
        self.assertFalse(should_publish(30, 30, 60, 480, False))
        # lewat 8 menit -> wajib kirim ulang (cegah firmware balik AUTO).
        self.assertTrue(should_publish(30, 30, 500, 480, False))
        # sudut berubah -> kirim.
        self.assertTrue(should_publish(45, 30, 10, 480, False))
        # override darurat -> selalu kirim walau baru saja.
        self.assertTrue(should_publish(90, 90, 1, 480, True))


if __name__ == "__main__":
    unittest.main()
