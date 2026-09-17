# Hasil uji skrip Oracle

Dijalankan otomatis oleh `node tools/uji_oracle.mjs` pada **2026-09-17**.

| | |
|---|---|
| Basis data | Oracle AI Database 26ai Free Release 23.26.3.0.0 - Develop, Learn, and Run for Free Version 23.26.3.0.0 |
| Image | `gvenzl/oracle-free:23-slim` |
| Topologi | 3 pluggable database (JAKARTA pusat, BANDUNG, SURABAYA) + database link |
| Skrip | 21 dari 21 lulus |
| Pemeriksaan mandiri | 60 LULUS, 0 GAGAL |
| Durasi | 69 detik |

## Per skrip

| Skrip | Situs | Sebagai | Status | Cek lulus | Galat peragaan (sengaja) | Log |
|---|---|---|---|---|---|---|
| `01_situs_pdb.sql` | cdb | sys | LULUS | 1 | - | [cdb](bukti/01_situs_pdb.log) |
| `02_pengguna_situs.sql` | jakarta, bandung, surabaya | sys | LULUS | 3 | - | [jakarta](bukti/02_pengguna_situs.jakarta.log) [bandung](bukti/02_pengguna_situs.bandung.log) [surabaya](bukti/02_pengguna_situs.surabaya.log) |
| `03_tablespace_alokasi.sql` | jakarta | sys | LULUS | 1 | - | [jakarta](bukti/03_tablespace_alokasi.log) |
| `04_skema_global.sql` | jakarta | rs_app | LULUS | 2 | - | [jakarta](bukti/04_skema_global.log) |
| `05_data_contoh.sql` | jakarta | rs_app | LULUS | 7 | ORA-02290, ORA-02291 | [jakarta](bukti/05_data_contoh.log) |
| `06_fragmentasi_horizontal.sql` | jakarta | rs_app | LULUS | 6 | ORA-14402 | [jakarta](bukti/06_fragmentasi_horizontal.log) |
| `07_fragmentasi_turunan.sql` | jakarta | rs_app | LULUS | 5 | - | [jakarta](bukti/07_fragmentasi_turunan.log) |
| `08_fragmentasi_vertikal.sql` | jakarta | rs_app | LULUS | 2 | - | [jakarta](bukti/08_fragmentasi_vertikal.log) |
| `09a_situs_bandung.sql` | bandung | rs_app | LULUS | 3 | ORA-02290 | [bandung](bukti/09a_situs_bandung.log) |
| `09b_situs_surabaya.sql` | surabaya | rs_app | LULUS | 3 | ORA-02290 | [surabaya](bukti/09b_situs_surabaya.log) |
| `10_database_link.sql` | jakarta | rs_app | LULUS | 5 | - | [jakarta](bukti/10_database_link.log) |
| `11_replikasi_sumber.sql` | jakarta | rs_app | LULUS | 1 | - | [jakarta](bukti/11_replikasi_sumber.log) |
| `12_replikasi_replika.sql` | bandung | rs_app | LULUS | 5 | - | [bandung](bukti/12_replikasi_replika.log) |
| `13_transaksi_2pc.sql` | jakarta | rs_app | LULUS | 2 | ORA-02290 | [jakarta](bukti/13_transaksi_2pc.log) |
| `14a_matikan_pemulihan.sql` | cdb | sys | LULUS | 0 | - | [cdb](bukti/14a_matikan_pemulihan.log) |
| `14b_transaksi_ragu_ragu.sql` | jakarta | rs_app | LULUS | 4 | ORA-02054, ORA-02059, ORA-01591 | [jakarta](bukti/14b_transaksi_ragu_ragu.log) |
| `14c_nyalakan_pemulihan.sql` | cdb | sys | LULUS | 0 | - | [cdb](bukti/14c_nyalakan_pemulihan.log) |
| `14d_bersihkan_catatan_2pc.sql` | jakarta | sys | LULUS | 1 | - | [jakarta](bukti/14d_bersihkan_catatan_2pc.log) |
| `15_transparansi_lima_tingkat.sql` | jakarta | rs_app | LULUS | 4 | - | [jakarta](bukti/15_transparansi_lima_tingkat.log) |
| `16_rencana_eksekusi.sql` | jakarta | rs_app | LULUS | 3 | - | [jakarta](bukti/16_rencana_eksekusi.log) |
| `17_diagnosa.sql` | jakarta | rs_app | LULUS | 2 | - | [jakarta](bukti/17_diagnosa.log) |

## Seluruh pemeriksaan

### 01_situs_pdb.sql

- LULUS: PDB BANDUNG dan SURABAYA terbuka READ WRITE

### 02_pengguna_situs.sql

- LULUS: pengguna RS_APP dan tablespace situs siap
- LULUS: pengguna RS_APP dan tablespace situs siap
- LULUS: pengguna RS_APP dan tablespace situs siap

### 03_tablespace_alokasi.sql

- LULUS: tiga tablespace alokasi tersedia di situs pusat

### 04_skema_global.sql

- LULUS: enam tabel global terbentuk
- LULUS: enam kunci asing terpasang

### 05_data_contoh.sql

- LULUS: pasien berisi 12 baris
- LULUS: dokter berisi 6 baris
- LULUS: administrator berisi 4 baris
- LULUS: pasien_dokter berisi 14 baris
- LULUS: dokter_admin berisi 8 baris
- LULUS: daftar berisi 12 baris
- LULUS: baris yang melanggar kendala tidak tersimpan

### 06_fragmentasi_horizontal.sql

- LULUS: fragmen P_JAKARTA berisi 4 baris dan berada di TS_JAKARTA
- LULUS: fragmen P_BANDUNG berisi 4 baris dan berada di TS_BANDUNG
- LULUS: fragmen P_SURABAYA berisi 4 baris dan berada di TS_SURABAYA
- LULUS: kelengkapan: jumlah semua fragmen = 12 baris
- LULUS: dengan ROW MOVEMENT baris berpindah ke fragmen Bandung
- LULUS: ROLLBACK mengembalikan baris ke fragmen Jakarta

### 07_fragmentasi_turunan.sql

- LULUS: partisi anak mewarisi 4 partisi induk
- LULUS: setiap pemeriksaan pasien Jakarta ikut berada di fragmen P_JAKARTA
- LULUS: setiap pemeriksaan pasien Bandung ikut berada di fragmen P_BANDUNG
- LULUS: setiap pemeriksaan pasien Surabaya ikut berada di fragmen P_SURABAYA
- LULUS: rencana memangkas ke satu partisi

### 08_fragmentasi_vertikal.sql

- LULUS: rekonstruksi S1 JOIN S2 mengembalikan 10 pegawai
- LULUS: rekonstruksi memuat seluruh atribut asli

### 09a_situs_bandung.sql

- LULUS: fragmen PASIEN Bandung berisi 4 baris
- LULUS: fragmen DAFTAR Bandung berisi 4 baris
- LULUS: baris yang salah situs tidak tersimpan

### 09b_situs_surabaya.sql

- LULUS: fragmen PASIEN Surabaya berisi 4 baris
- LULUS: fragmen DAFTAR Surabaya berisi 4 baris
- LULUS: baris yang salah situs tidak tersimpan

### 10_database_link.sql

- LULUS: link SITUS_BANDUNG tersambung
- LULUS: link SITUS_SURABAYA tersambung
- LULUS: rekonstruksi dari tiga basis data = 12 pasien
- LULUS: isi view global identik dengan tabel global (MINUS dua arah kosong)
- LULUS: kedisjoinan: tidak ada ID pasien di dua situs

### 11_replikasi_sumber.sql

- LULUS: MV log DOKTER tersedia

### 12_replikasi_replika.sql

- LULUS: replika berisi 6 dokter
- LULUS: sebelum refresh, replika masih nilai lama
- LULUS: setelah FAST refresh, replika mengikuti sumber
- LULUS: refresh terakhir berjenis FAST
- LULUS: refresh group RG_REFERENSI terdaftar

### 13_transaksi_2pc.sql

- LULUS: kedua situs menyimpan perubahan
- LULUS: ROLLBACK membatalkan perubahan lokal

### 14a_matikan_pemulihan.sql


### 14b_transaksi_ragu_ragu.sql

- LULUS: transaksi tercatat ragu-ragu (prepared) di DBA_2PC_PENDING
- LULUS: situs Bandung sudah COMMIT, jadi keputusan yang benar adalah COMMIT FORCE
- LULUS: status berubah menjadi forced commit
- LULUS: data pusat kini sama dengan Bandung

### 14c_nyalakan_pemulihan.sql


### 14d_bersihkan_catatan_2pc.sql

- LULUS: tidak ada lagi catatan transaksi prepared atau forced di situs pusat

### 15_transparansi_lima_tingkat.sql

- LULUS: tingkat 1 (Transparansi fragmentasi) menghasilkan 6 pasien perempuan
- LULUS: tingkat 2 (Transparansi lokasi) menghasilkan 6 pasien perempuan
- LULUS: tingkat 3 (Transparansi pemetaan lokal) menghasilkan 6 pasien perempuan
- LULUS: replika dokter terbaca lewat sinonim

### 16_rencana_eksekusi.sql

- LULUS: predikat kota memangkas akses ke SATU partisi
- LULUS: tanpa predikat, SELURUH partisi dibaca
- LULUS: join lintas situs memuat operasi REMOTE

### 17_diagnosa.sql

- LULUS: tidak ada transaksi yang masih menggantung
- LULUS: seluruh objek RS_APP valid
