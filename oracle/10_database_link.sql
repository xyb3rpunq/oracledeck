-- ==========================================================================
-- Langkah 10 - Database link, sinonim, dan view global
-- Transparansi lokasi: aplikasi di Jakarta membaca ketiga situs seperti satu tabel.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================
-- @jalankan situs=jakarta sebagai=rs_app
-- Sambungan: RS_APP ke PDB situs JAKARTA.
-- &&tns_bandung dan &&tns_surabaya berisi alamat EZConnect situs, mis. //host:1521/BANDUNG.

CREATE DATABASE LINK SITUS_BANDUNG
  CONNECT TO RS_APP IDENTIFIED BY "&&sandi_rs_app"
  USING '&&tns_bandung';
SELECT CASE WHEN (SELECT COUNT(*) FROM PASIEN@SITUS_BANDUNG) = 4 THEN 'LULUS: link SITUS_BANDUNG tersambung' ELSE 'GAGAL: link SITUS_BANDUNG tersambung' END AS cek FROM dual;

CREATE DATABASE LINK SITUS_SURABAYA
  CONNECT TO RS_APP IDENTIFIED BY "&&sandi_rs_app"
  USING '&&tns_surabaya';
SELECT CASE WHEN (SELECT COUNT(*) FROM PASIEN@SITUS_SURABAYA) = 4 THEN 'LULUS: link SITUS_SURABAYA tersambung' ELSE 'GAGAL: link SITUS_SURABAYA tersambung' END AS cek FROM dual;

-- Fragmen disebut dengan nama tanpa lokasi (transparansi lokasi):
CREATE OR REPLACE VIEW PASIEN_JAKARTA AS SELECT * FROM PASIEN WHERE KOTA = 'Jakarta';
-- Transparansi lokasi tingkat DDBMS: aplikasi cukup menyebut nama objek,
-- letak fisiknya disembunyikan oleh sinonim. Pindah situs = ubah sinonim,
-- aplikasi tidak perlu disentuh sama sekali.

CREATE OR REPLACE SYNONYM PASIEN_BANDUNG FOR PASIEN@SITUS_BANDUNG;
CREATE OR REPLACE SYNONYM PASIEN_SURABAYA FOR PASIEN@SITUS_SURABAYA;

-- Program lokalisasi fragmentasi horizontal: R = F1 UNION ALL F2 UNION ALL ...
-- Oracle memangkas cabang yang predikatnya bertentangan dengan WHERE kueri
-- (partition pruning / predicate pushdown) — inilah reduksi yang dibahas di Modul 7.
CREATE OR REPLACE VIEW V_PASIEN_NASIONAL AS
SELECT * FROM PASIEN_JAKARTA
UNION ALL
SELECT * FROM PASIEN@SITUS_BANDUNG
UNION ALL
SELECT * FROM PASIEN@SITUS_SURABAYA
;

SELECT CASE WHEN (SELECT COUNT(*) FROM V_PASIEN_NASIONAL) = 12 THEN 'LULUS: rekonstruksi dari tiga basis data = 12 pasien' ELSE 'GAGAL: rekonstruksi dari tiga basis data = 12 pasien' END AS cek FROM dual;
SELECT CASE WHEN (SELECT COUNT(*) FROM (SELECT * FROM V_PASIEN_NASIONAL MINUS SELECT * FROM PASIEN)) + (SELECT COUNT(*) FROM (SELECT * FROM PASIEN MINUS SELECT * FROM V_PASIEN_NASIONAL)) = 0 THEN 'LULUS: isi view global identik dengan tabel global (MINUS dua arah kosong)' ELSE 'GAGAL: isi view global identik dengan tabel global (MINUS dua arah kosong)' END AS cek FROM dual;
SELECT CASE WHEN (SELECT COUNT(*) FROM (SELECT ID_PASIEN FROM V_PASIEN_NASIONAL GROUP BY ID_PASIEN HAVING COUNT(*) > 1)) = 0 THEN 'LULUS: kedisjoinan: tidak ada ID pasien di dua situs' ELSE 'GAGAL: kedisjoinan: tidak ada ID pasien di dua situs' END AS cek FROM dual;

SELECT db_link, username, host FROM user_db_links ORDER BY db_link;
