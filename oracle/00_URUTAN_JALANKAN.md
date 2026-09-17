# Skrip Oracle ORACLEDECK

Dihasilkan otomatis dari mesin yang sama dengan situs (`node tools/gen_oracle.js`).
Jangan disunting manual; ubah `tools/gen_oracle.js` atau `engine/oracle/emit.js`.

## Topologi

Tiga situs = tiga basis data (pluggable database) yang terhubung database link:

| Situs | Basis data | Isi |
|---|---|---|
| Jakarta (pusat) | PDB bawaan (`FREEPDB1` di Oracle Free, `XEPDB1` di XE) | skema global, partisi per situs, view global, sumber replikasi |
| Bandung | PDB `BANDUNG` | fragmen PASIEN & DAFTAR kota Bandung, materialized view DOKTER |
| Surabaya | PDB `SURABAYA` | fragmen PASIEN & DAFTAR kota Surabaya |

## Sudah diuji di Oracle sungguhan

Seluruh skrip dijalankan otomatis oleh `node tools/uji_oracle.mjs` pada container
`gvenzl/oracle-free:23-slim`. Hasil lengkap, termasuk setiap pemeriksaan LULUS/GAGAL
dan log keluaran SQL*Plus, ada di [`HASIL_UJI.md`](HASIL_UJI.md) dan folder `bukti/`.

## Urutan menjalankan

Baris `-- @jalankan situs=... sebagai=...` di awal tiap berkas menyebut di mana dan sebagai
siapa skrip dijalankan. Variabel substitusi SQL*Plus yang dipakai:

| Variabel | Contoh | Keterangan |
|---|---|---|
| `&&sandi_rs_app` | (rahasia) | sandi RS_APP dan PDB_ADMIN — tidak pernah ditulis di berkas |
| `&&situs` | `BANDUNG` | nama situs saat Langkah 2 dijalankan |
| `&&dir_data` | `/opt/oracle/oradata` | folder berkas data |
| `&&tns_jakarta` | `//localhost:1521/FREEPDB1` | alamat situs pusat |
| `&&tns_bandung` | `//localhost:1521/BANDUNG` | alamat situs Bandung |
| `&&tns_surabaya` | `//localhost:1521/SURABAYA` | alamat situs Surabaya |

| # | Berkas |
|---|---|
| 1 | `01_situs_pdb.sql` |
| 2 | `02_pengguna_situs.sql` |
| 3 | `03_tablespace_alokasi.sql` |
| 4 | `04_skema_global.sql` |
| 5 | `05_data_contoh.sql` |
| 6 | `06_fragmentasi_horizontal.sql` |
| 7 | `07_fragmentasi_turunan.sql` |
| 8 | `08_fragmentasi_vertikal.sql` |
| 9 | `09a_situs_bandung.sql` |
| 10 | `09b_situs_surabaya.sql` |
| 11 | `10_database_link.sql` |
| 12 | `11_replikasi_sumber.sql` |
| 13 | `12_replikasi_replika.sql` |
| 14 | `13_transaksi_2pc.sql` |
| 15 | `14a_matikan_pemulihan.sql` |
| 16 | `14b_transaksi_ragu_ragu.sql` |
| 17 | `14c_nyalakan_pemulihan.sql` |
| 18 | `14d_bersihkan_catatan_2pc.sql` |
| 19 | `15_transparansi_lima_tingkat.sql` |
| 20 | `16_rencana_eksekusi.sql` |
| 21 | `17_diagnosa.sql` |

## Menjalankan otomatis

```bash
node tools/uji_oracle.mjs
```

Runner membuat container bila belum ada, menyiapkan tiga situs dari nol, menjalankan setiap
skrip di situs yang benar, lalu menulis `HASIL_UJI.md`. Ia gagal bila ada pemeriksaan GAGAL,
galat yang tidak diharapkan, atau galat peragaan yang tidak muncul.
