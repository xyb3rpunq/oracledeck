#!/usr/bin/env python
"""
verify_sqlite.py - verifikasi silang mesin SQL ORACLEDECK terhadap SQLite.

Dataset dan hasil kueri diekspor lebih dulu oleh tools/export_for_verify.js.
Skrip ini membangun basis data SQLite di memori dari dataset yang sama,
menjalankan kueri yang sama, lalu membandingkan himpunan barisnya.

Yang dibandingkan adalah ISI hasil, bukan nama kolom: nama kolom memang
berbeda antar dialek. Untuk kueri yang memakai ORDER BY, urutan baris ikut
dibandingkan; tanpa ORDER BY, hasil dibandingkan sebagai multiset.

Jalankan:  python tools/verify_sqlite.py
"""

from __future__ import annotations

import json
import os
import sqlite3
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools" / ".cache" / "oracledeck-verify.json"

HIJAU = "\033[32m"
MERAH = "\033[31m"
KUNING = "\033[33m"
RESET = "\033[0m"


def jalankan_eksportir() -> None:
    """Jalankan mesin ORACLEDECK lewat Node dan tulis hasilnya ke cache."""
    hasil = subprocess.run(
        ["node", str(ROOT / "tools" / "export_for_verify.js")],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        shell=(os.name == "nt"),
    )
    sys.stdout.write(hasil.stdout)
    if hasil.returncode != 0:
        sys.stderr.write(hasil.stderr)
        raise SystemExit("Eksportir Node gagal; verifikasi dihentikan.")


def tipe_sqlite(nilai_contoh: list) -> str:
    bersih = [v for v in nilai_contoh if v is not None]
    if bersih and all(isinstance(v, bool) is False and isinstance(v, int) for v in bersih):
        return "INTEGER"
    if bersih and all(isinstance(v, (int, float)) for v in bersih):
        return "REAL"
    return "TEXT"


def bangun_db(tabel: dict) -> sqlite3.Connection:
    con = sqlite3.connect(":memory:")
    con.create_function("LENGTH", 1, lambda s: None if s is None else len(str(s)))
    for nama, isi in tabel.items():
        kolom = isi["attrs"]
        baris = isi["rows"]
        definisi = ", ".join(
            f'"{k}" {tipe_sqlite([r[i] for r in baris])}' for i, k in enumerate(kolom)
        )
        con.execute(f'CREATE TABLE "{nama}" ({definisi})')
        tanda = ", ".join("?" * len(kolom))
        con.executemany(f'INSERT INTO "{nama}" VALUES ({tanda})', baris)
    con.commit()
    return con


def normalkan(v):
    """Samakan bentuk nilai agar 3 dan 3.0 tidak dianggap berbeda."""
    if v is None:
        return None
    if isinstance(v, bool):
        return 1 if v else 0
    if isinstance(v, float):
        if abs(v - round(v)) < 1e-9:
            return float(round(v))
        return round(v, 9)
    if isinstance(v, int):
        return float(v)
    return str(v)


def baris_kunci(baris) -> tuple:
    return tuple(normalkan(v) for v in baris)


def bandingkan(id_kueri: str, sql: str, harap_rows, dapat_rows) -> tuple[bool, str]:
    a = [baris_kunci(r) for r in harap_rows]
    b = [baris_kunci(r) for r in dapat_rows]
    if len(a) != len(b):
        return False, f"jumlah baris berbeda: ORACLEDECK {len(a)}, SQLite {len(b)}"
    if "ORDER BY" in sql.upper():
        for i, (x, y) in enumerate(zip(a, b)):
            if x != y:
                return False, f"baris ke-{i + 1} berbeda:\n      ORACLEDECK {x}\n      SQLite     {y}"
        return True, ""
    ca, cb = Counter(a), Counter(b)
    if ca != cb:
        hanya_a = list((ca - cb).elements())[:3]
        hanya_b = list((cb - ca).elements())[:3]
        return False, f"isi berbeda:\n      hanya di ORACLEDECK: {hanya_a}\n      hanya di SQLite    : {hanya_b}"
    return True, ""


def main() -> int:
    jalankan_eksportir()
    if not CACHE.exists():
        sys.stderr.write(f"Berkas cache tidak ditemukan: {CACHE}\n")
        return 1

    data = json.loads(CACHE.read_text(encoding="utf-8"))
    con = bangun_db(data["tabel"])

    lulus, gagal, lewat = 0, [], []
    print(f"\nVerifikasi silang {len(data['hasil'])} kueri terhadap SQLite {sqlite3.sqlite_version}\n")

    for id_kueri, isi in data["hasil"].items():
        sql = isi["sql"]
        try:
            cur = con.execute(sql)
            dapat = cur.fetchall()
        except sqlite3.Error as e:
            lewat.append((id_kueri, str(e)))
            print(f"  {KUNING}~{RESET} {id_kueri:<18} dilewati (SQLite: {e})")
            continue
        ok, pesan = bandingkan(id_kueri, sql, isi["rows"], dapat)
        if ok:
            lulus += 1
            print(f"  {HIJAU}+{RESET} {id_kueri:<18} {len(dapat)} baris cocok")
        else:
            gagal.append((id_kueri, sql, pesan))
            print(f"  {MERAH}x {id_kueri:<18} {pesan}{RESET}")

    skrip = data.get("skrip", {})
    if skrip:
        print(f"\nVerifikasi silang {len(skrip)} skrip DML (INSERT/UPDATE/DELETE)\n")
    for id_skrip, isi in skrip.items():
        con_s = bangun_db(data["tabel"])
        try:
            for perintah in isi["perintah"]:
                con_s.execute(perintah)
            dapat = con_s.execute(isi["penutup"]).fetchall()
        except sqlite3.Error as e:
            lewat.append((id_skrip, str(e)))
            print(f"  {KUNING}~{RESET} {id_skrip:<18} dilewati (SQLite: {e})")
            continue
        ok, pesan = bandingkan(id_skrip, isi["penutup"], isi["rows"], dapat)
        if ok:
            lulus += 1
            print(f"  {HIJAU}+{RESET} {id_skrip:<18} {len(dapat)} baris akhir cocok")
        else:
            gagal.append((id_skrip, " ; ".join(isi["perintah"]), pesan))
            print(f"  {MERAH}x {id_skrip:<18} {pesan}{RESET}")

    print("\n" + "=" * 64)
    if gagal:
        print(f"\n{MERAH}{len(gagal)} kueri BERBEDA hasilnya{RESET}\n")
        for id_kueri, sql, pesan in gagal:
            print(f"  [{id_kueri}]\n    {' '.join(sql.split())}\n    {pesan}\n")
    if lewat:
        print(f"{len(lewat)} kueri dilewati karena SQLite tidak mendukung sintaksnya.")
    print(f"{lulus}/{lulus + len(gagal)} kueri dan skrip menghasilkan isi yang identik di kedua mesin.")
    return 1 if (gagal or lewat) else 0


if __name__ == "__main__":
    raise SystemExit(main())
