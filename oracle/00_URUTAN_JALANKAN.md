# Skrip Oracle ORACLEDECK

Dihasilkan otomatis dari mesin yang sama dengan yang dipakai situs
(`node tools/gen_oracle.js`). Jangan disunting manual — perubahan akan hilang
pada pembuatan berikutnya. Ubah `tools/gen_oracle.js` atau `engine/oracle/emit.js`.

## Lingkungan yang diuji

Skrip ditulis untuk **Oracle Database 21c XE** (juga berlaku untuk 19c dan 23ai Free).
Fitur yang dipakai: LIST/REFERENCE partitioning, database link, materialized view,
dan tampilan diagnosa `DBA_2PC_PENDING`.

> Skrip ini **belum pernah dijalankan** pada instans Oracle sungguhan dalam
> repositori ini — tidak ada Oracle di lingkungan pembuatannya. Yang diuji
> otomatis adalah *pembangkitnya*: bentuk DDL, nama objek, dan klausa partisi
> diperiksa 40+ uji di `tests/oracle-emit.test.js`. Jalankan sendiri di Oracle XE
> untuk membuktikan bagian yang tidak bisa diuji tanpa basis data.

## Urutan menjalankan

| # | Berkas | Isi |
|---|--------|-----|
| 1 | `01_tablespace_dan_user.sql` | Tablespace per situs + pengguna RS_APP |
| 2 | `02_skema_global.sql` | Enam tabel skema konseptual global |
| 3 | `03_fragmentasi_horizontal.sql` | PARTITION BY LIST per kota |
| 4 | `04_fragmentasi_turunan.sql` | PARTITION BY REFERENCE untuk tabel anak |
| 5 | `05_fragmentasi_vertikal.sql` | Pemisahan kolom + VIEW perekat |
| 6 | `06_database_link.sql` | Link antar situs, sinonim, view UNION ALL |
| 7 | `07_replikasi_materialized_view.sql` | Replikasi tabel referensi |
| 8 | `08_transaksi_terdistribusi.sql` | 2PC otomatis Oracle |
| 9 | `09_transparansi_lima_tingkat.sql` | Satu kueri, lima tingkat transparansi |
| 10 | `10_diagnosa_2pc_dan_deadlock.sql` | Transaksi menggantung & deadlock |
| 11 | `11_rencana_eksekusi.sql` | Bukti partition pruning & operasi REMOTE |
| 12 | `12_data_contoh.sql` | Data contoh yang identik dengan lab |

## Menjalankan cepat dengan Docker

```bash
docker run -d --name oracle-xe -p 1521:1521 -e ORACLE_PASSWORD=oracle \
  gvenzl/oracle-free:23-slim
sqlplus sys/oracle@//localhost:1521/FREEPDB1 as sysdba @01_tablespace_dan_user.sql
```

## Kalau tidak ada Oracle

Semua konsep yang sama bisa dijalankan langsung di peramban lewat situs
ORACLEDECK — mesin relasionalnya ditulis ulang dari nol dan hasilnya
diverifikasi silang terhadap SQLite (`python tools/verify_sqlite.py`).
