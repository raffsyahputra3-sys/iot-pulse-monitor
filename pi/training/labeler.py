"""Rule-based labeler (PRD §7.4.1). Generate data sintetis facts -> {angle, reason}
untuk fine-tuning LoRA. Dijalankan di PC/Colab, BUKAN di Pi.

Aturan label mengikuti guard §6 + pedoman nyaman unggas (18-25 C nyaman,
stress panas >30 C, kelembapan ideal 50-70%, NH3 aman <25 ppm):

  gas >= 40 atau suhu >= 34  -> 90 (darurat, sama persis §6.1)
  hujan + suhu < 31 + gas < 25 -> 0 (sama persis §6.2)
  suhu >= 31                 -> 90 (panas, buka penuh)
  suhu <= 28                 -> 0  (adem, tutup penuh)
  28 < suhu < 31             -> skala linear 15..75 (snap 15)
  kelembapan > 75            -> +15 (bantu sirkulasi), max 90
  malam (jam >= 18 atau < 6) -> -15 (tahan panas siang, hemat servo), min 0

Pakai: python labeler.py --n 3000 --out data_train.jsonl [--seed 7]
Format out: {"facts": str, "angle": int, "reason": str} per baris.
"""

import argparse
import json
import random

TEMP_HI, TEMP_LO = 31.0, 28.0
TEMP_EXTREME = 34.0
GAS_WARN, GAS_DANGER = 25.0, 40.0

HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]


def label_angle(suhu, gas, lembap, jam, raining):
    if gas >= GAS_DANGER or suhu >= TEMP_EXTREME:
        return 90, "kondisi bahaya, atap dibuka penuh demi keselamatan ayam"
    if raining and suhu < TEMP_HI and gas < GAS_WARN:
        return 0, "hujan dan kondisi aman, atap ditutup agar kandang tetap kering"
    if suhu >= TEMP_HI:
        angle, why = 90, "suhu panas, atap dibuka penuh untuk sirkulasi udara"
    elif suhu <= TEMP_LO:
        angle, why = 0, "suhu sejuk, atap ditutup untuk menjaga kehangatan"
    else:
        angle = round((suhu - TEMP_LO) / (TEMP_HI - TEMP_LO) * 60 / 15) * 15 + 15
        why = "suhu sedang, atap dibuka sebagian mengikuti kenaikan suhu"
    if lembap > 75:
        angle = min(90, angle + 15)
        why += ", kelembapan tinggi dibantu sirkulasi"
    if jam >= 18 or jam < 6:
        angle = max(0, angle - 15)
        why += ", malam hari bukaan dikurangi"
    return angle, why


def make_facts(suhu, lembap, gas, jam, raining, atap=0):
    hari = HARI[jam % 7]
    siang = "siang" if 6 <= jam < 18 else "malam"
    cuaca = ("HUJAN" if raining else "tidak hujan")
    return (
        f"Waktu: {hari} jam {jam:02d}:00 ({siang}).\n"
        f"Suhu kandang {suhu:.1f} C.\n"
        f"Kelembapan {lembap:.0f}%.\n"
        f"Gas amonia {gas:.1f} ppm.\n"
        f"Posisi atap saat ini: {atap} derajat.\n"
        f"Cuaca: {cuaca}."
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=3000)
    ap.add_argument("--out", default="data_train.jsonl")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()
    rng = random.Random(args.seed)

    n_written = 0
    with open(args.out, "w", encoding="utf-8") as f:
        for _ in range(args.n):
            suhu = round(rng.uniform(24.0, 37.0), 1)
            lembap = round(rng.uniform(45.0, 90.0))
            # gas miring ke rendah (realistis), kadang spike bahaya
            gas = round(rng.choice([rng.uniform(5, 20), rng.uniform(5, 20),
                                    rng.uniform(20, 50)]), 1)
            jam = rng.randrange(0, 24)
            raining = rng.random() < 0.2
            facts = make_facts(suhu, lembap, gas, jam, raining)
            angle, reason = label_angle(suhu, gas, lembap, jam, raining)
            f.write(json.dumps({"facts": facts, "angle": angle, "reason": reason},
                               ensure_ascii=False) + "\n")
            n_written += 1
    print(f"OK: {n_written} baris -> {args.out}")


if __name__ == "__main__":
    main()
