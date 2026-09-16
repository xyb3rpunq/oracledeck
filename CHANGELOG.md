# Catatan perubahan

Semua perubahan penting dicatat di sini. Format mengikuti
[Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/) dan penomoran versi mengikuti
[Semantic Versioning](https://semver.org/lang/id/).

## [2.0.0] — 2026-09-17

### Ditambahkan
- **Terminal SQL Live** (Lab 03 menggantikan "Mesin SQL"): sesi gaya SQL\*Plus dengan pratinjau
  saat mengetik, riwayat, pelengkap otomatis, enam preset basis data, perintah meta, dan
  laci terminal yang bisa dibuka dari halaman mana pun.
- **DML** `INSERT`/`UPDATE`/`DELETE` dengan penegakan PRIMARY KEY, FOREIGN KEY
  (CASCADE, SET NULL, RESTRICT, ON UPDATE CASCADE), UNIQUE, CHECK, NOT NULL, DEFAULT, serta
  tipe dan panjang kolom (ORA-00001, ORA-01400, ORA-01438, ORA-01722, ORA-02290, ORA-02291,
  ORA-02292, ORA-12899).
- **DDL dan transaksi**: CREATE TABLE [AS SELECT], CREATE [OR REPLACE] VIEW, CREATE [UNIQUE]
  INDEX, DROP, TRUNCATE, COMMIT, ROLLBACK, SAVEPOINT, commit implisit oleh DDL, DESC,
  EXPLAIN PLAN FOR, kamus data `user_*` dan `dba_2pc_pending`.
- **Preset terdistribusi tiga situs**: `tabel@situs` lewat database link, view global UNION ALL,
  CHECK predikat fragmen, peringatan kunci ganda lintas situs, COMMIT lintas situs memakai
  two-phase commit, injeksi kegagalan, transaksi ragu-ragu, COMMIT FORCE / ROLLBACK FORCE.
- **SQL lanjutan**: CASE, subquery berkorelasi (EXISTS, IN, skalar), WITH, INTERSECT, MINUS/EXCEPT,
  ORDER BY/LIMIT atas operasi himpunan, FETCH FIRST/OFFSET, DUAL, literal DATE, 19 fungsi skalar
  Oracle (DECODE, NVL, TO_CHAR, INITCAP, LPAD, INSTR, TRUNC, …).
- 40 contoh siap jalan dan 31 kueri "Coba di terminal" per topik, semuanya diuji.
- 6 soal DML Praktikum 2 (INSERT, UPDATE, DELETE, ON DELETE/UPDATE CASCADE) dinilai dari
  keadaan tabel; seluruh bank soal dinilai langsung saat mengetik.
- Catatan istilah pada materi; 102 istilah glosarium kini punya rincian, contoh, dan tautan lab.
- Pencarian Ctrl+K, tema terang/gelap, kemajuan belajar, remah roti, tautan lewati-ke-isi.
- PWA: manifest dan service worker berversi untuk akses luring.
- Halaman **Standar Kualitas** (ISO/IEC 25010:2023, WCAG 2.2 AA), `SECURITY.md`, catatan ini.
- Pemeriksa situs: aksesibilitas statis, Content-Security-Policy, skrip inline, preset terminal.
- Verifikasi SQLite diperluas menjadi 53 kueri dan 7 skrip DML.

### Diubah
- Lab Dekomposisi, Kendali Konkurensi, dan Normalisasi menghitung ulang saat masukan diketik.
- Penilai soal memahami ORDER BY pada operasi himpunan dan badan WITH.
- Dekomposisi kueri menganalisis setiap cabang WITH/UNION/INTERSECT/MINUS dan menolak cabang
  dengan jumlah kolom berbeda.
- Pesan GROUP BY yang salah kini ORA-00979 / ORA-00937, bukan "kolom tidak ada".
- Tipe kolom Oracle rumah sakit diambil dari satu sumber (`RS_TIPE`) untuk skrip dan terminal.
- Markdown audit: `##` menjadi `<h2>` agar urutan judul tidak meloncat.

### Diperbaiki
- Dekomposisi gagal pada rantai UNION tiga cabang.
- `sisipIstilah` tidak lagi menandai istilah pendek di dalam frasa istilah yang lebih panjang.
- Laci terminal tidak lagi gagal bila tombol Jalankan diklik dua kali sebelum mesin selesai dimuat.

### Keamanan
- Content-Security-Policy `script-src 'self'` di setiap halaman; skrip tema dipindah dari inline.

## [1.0.0] — 2026-09-16

### Ditambahkan
- Rilis awal: 14 topik, 16 lab, 32 soal, 12 skrip Oracle, glosarium 102 istilah, audit,
  verifikasi SQLite 39 kueri, CI GitHub Actions.

[2.0.0]: https://github.com/xyb3rpunq/oracledeck/compare/c5d5602...v2.0.0
[1.0.0]: https://github.com/xyb3rpunq/oracledeck/commit/0aeeff7
