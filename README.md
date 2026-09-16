# ORACLEDECK

**Laboratorium Sistem Basis Data Terdistribusi** — 14 topik kuliah CTI313, 16 laboratorium
interaktif, dan 32 soal praktikum yang dinilai otomatis. Mesin relasionalnya ditulis dari nol,
hasilnya diverifikasi silang terhadap SQLite, dan rancangannya diterjemahkan menjadi DDL Oracle.

**Situs:** https://xyb3rpunq.github.io/oracledeck

Statis, nol dependensi runtime, tanpa server, tanpa pelacak. Semua perhitungan berjalan di
peramban pengunjung.

---

## Isi

| Bagian | Jumlah | Keterangan |
|---|---|---|
| Topik kuliah | 14 | Mengikuti Rencana Pembelajaran Semester pada Modul 1, isi dari modul di folder mata kuliah |
| Laboratorium | 16 | Setiap lab menjalankan algoritma sungguhan, bukan menampilkan jawaban jadi |
| Bank soal | 32 | Praktikum 2–5, termasuk ke-12 soal Praktikum 3; dinilai dengan membandingkan hasil kueri |
| Skrip Oracle | 12 | Partisi LIST/REFERENCE, database link, materialized view, diagnosa 2PC |
| Glosarium | 102 | Istilah dengan penjelasan berbahasa Indonesia |
| Audit | 1 | Skema praktikum, Project UAS Kelompok 3, materi kuliah, dan proyek ini sendiri |

### Laboratorium

| # | Lab | Yang dijalankan |
|---|---|---|
| 01 | Perancang ERD | Transformasi ERD → skema relasional → DDL Oracle (1:1, 1:N, N:M, multinilai, entitas lemah) |
| 02 | Normalisasi 1NF–BCNF | Penutupan atribut, candidate key, minimal cover, sintesis 3NF, uji chase lossless-join |
| 03 | Mesin SQL | Tokenizer, parser, perencana, eksekutor, rencana eksekusi |
| 04 | Perancang Fragmentasi | Horizontal, vertikal, turunan, campuran + audit tiga aturan kebenaran |
| 05 | Alokasi & Replikasi | Model biaya empat kelompok informasi, alokasi optimal eksak, ketersediaan |
| 06 | Dekomposisi Kueri | CNF/DNF, graf kueri, eliminasi redundansi, pohon operator, push-down selection |
| 07 | Lokalisasi Data | Program lokalisasi dan reduksi — diverifikasi setara dengan kueri global |
| 08 | Tangga Transparansi | Satu kueri pada lima tingkat transparansi, DRDA, penamaan System R* |
| 09 | Join Terdistribusi | Kirim utuh, semijoin, bloom join, titik impas semijoin |
| 10 | Kendali Konkurensi | Graf presedensi, 2PL, timestamp ordering, recoverable/cascadeless/strict |
| 11 | Manajemen Deadlock | Deteksi terpusat, path pushing, edge chasing, deadlock semu, wait-die/wound-wait |
| 12 | Simulator 2PC & 3PC | Injeksi kegagalan koordinator, peserta, partisi, dan peserta di balik gateway ODBC |
| 13 | Ketersediaan & CAP | MTBF/MTTR, kuorum R+W>N, CAP, PACELC, RTO/RPO |
| 14 | Generator DDL Oracle | Rancangan terdistribusi → objek Oracle |
| 15 | Bank Soal Praktikum | 32 soal dinilai otomatis |
| 16 | Studi Kasus Kependudukan | Skripsi Oracle XE + MySQL lewat ODBC: NIK ganda yang lolos UNIQUE lokal |

---

## Verifikasi

```bash
npm run all
```

Satu perintah itu menjalankan kelima langkah berikut, dan berhenti pada langkah pertama yang gagal:

| Langkah | Perintah | Yang dibuktikan |
|---|---|---|
| 1 | `node tests/run.js` | 528 uji otomatis atas mesin, algoritma terdistribusi, penilai soal, dan pemeriksa situs |
| 2 | `python tools/verify_sqlite.py` | 39 kueri acuan menghasilkan isi identik di mesin ini dan di SQLite |
| 3 | `node tools/gen_oracle.js` | Skrip Oracle dihasilkan ulang dari mesin yang sama |
| 4 | `node tools/build.js` | Situs statis dibangun ke `docs/`, aset diberi versi sidik isi |
| 5 | `node tools/cek_situs.js` | Tautan, impor modul, sitemap, judul, dan kebocoran data pribadi |

Selain itu, ke-16 lab diperiksa di peramban dengan mengeklik setiap kontrolnya sambil menangkap
galat runtime, dan 22 halaman diukur pada lebar ponsel 375 px. Tujuh bug yang hanya muncul saat
dirender dicatat di [AUDIT.md](AUDIT.md) bagian 3.1a.

## Batas yang jujur

- **Skrip Oracle belum pernah dijalankan pada instans Oracle sungguhan.** Yang diuji adalah
  pembangkitnya. Jalankan di Oracle Free untuk membuktikan sintaksnya:
  ```bash
  docker run -d --name oracle-free -p 1521:1521 -e ORACLE_PASSWORD=oracle gvenzl/oracle-free:23-slim
  ```
- **Model biaya adalah model.** Arah dan titik impasnya benar; angkanya bukan milidetik jaringan nyata.
- **Mesin SQL hanya menutup subset SELECT** — tanpa DDL, DML, window function, CTE, atau `EXISTS`.
- **Situs hanya berbahasa Indonesia**, mengikuti bahasa materi dan pembacanya.
- **Seluruh data contoh adalah karangan**, termasuk NIK pada studi kasus (memakai segmen `9999`).

## Struktur

```
engine/            mesin nol dependensi — dipakai identik oleh uji dan peramban
  core/            relation, algebra, sql, fd (normalisasi), grader
  ddb/             fragment, allocate, localize, decompose, transparency, joinstrat,
                   twophase, concurrency, deadlock, availability, erd, integrity
  oracle/          emit — penghasil DDL Oracle
  data/            dataset praktikum, DreamHome, kependudukan
src/
  content/         materi 14 topik, bank soal, glosarium
  labs/            skrip 16 lab + ui.js
  styles.css
tests/             19 berkas uji + harness nol dependensi
tools/             build, gen_oracle, cek_situs, export_for_verify, verify_sqlite.py
oracle/            12 skrip Oracle hasil generator
docs/              keluaran situs (GitHub Pages)
AUDIT.md           audit lengkap
```

## Sumber materi

- Modul 1, 2, dan 6 CTI313 — Ir. Nixon Erzed, MT, Universitas Esa Unggul
- Modul Pertemuan 3 dan 7 — Sawali Wahyu, S.Kom, M.Kom, Universitas Esa Unggul
- Lembar Praktikum 1–5 dan dokumen tugas praktikum mata kuliah
- Skripsi *Implementasi Basis Data Terdistribusi untuk Meningkatkan Konsistensi Data Kependudukan*,
  UIN Sunan Kalijaga, 2016 — dipakai sebagai studi kasus; seluruh datanya diganti data karangan
- Connolly & Begg, *Database Systems*, 6th ed. · Özsu & Valduriez, *Principles of Distributed Database Systems*
- [Oracle Database Gateway for ODBC — Features and Restrictions](https://docs.oracle.com/en/database/oracle/oracle-database/12.2/odbcu/database-gateway-for-odbc-features.html)

## Lisensi

Kode: MIT. Tidak berafiliasi dengan Oracle Corporation; nama Oracle dipakai hanya sebagai
rujukan teknis.

Daniel Hutajulu (20210801207) · CTI313 Sistem Basis Data Terdistribusi · Universitas Esa Unggul
