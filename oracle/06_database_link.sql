-- ==========================================================================
-- Langkah 6 - Database link antar situs
-- Tanpa link, Oracle tidak punya jalan untuk menjalankan kueri terdistribusi.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================

-- Database link: jalur akses ke basis data pada situs lain.
-- Tanpa link ini, tidak ada kueri terdistribusi yang bisa dijalankan Oracle.
CREATE DATABASE LINK SITUS_BANDUNG
  CONNECT TO RS_APP IDENTIFIED BY "&sandi_situs"
  USING '//bandung-db:1521/XEPDB1';

-- Uji sambungan:
SELECT SYSDATE FROM dual@SITUS_BANDUNG;
-- Database link: jalur akses ke basis data pada situs lain.
-- Tanpa link ini, tidak ada kueri terdistribusi yang bisa dijalankan Oracle.
CREATE DATABASE LINK SITUS_SURABAYA
  CONNECT TO RS_APP IDENTIFIED BY "&sandi_situs"
  USING '//surabaya-db:1521/XEPDB1';

-- Uji sambungan:
SELECT SYSDATE FROM dual@SITUS_SURABAYA;

-- Transparansi lokasi tingkat DDBMS: aplikasi cukup menyebut nama objek,
-- letak fisiknya disembunyikan oleh sinonim. Pindah situs = ubah sinonim,
-- aplikasi tidak perlu disentuh sama sekali.

CREATE OR REPLACE SYNONYM PASIEN_BANDUNG FOR PASIEN@SITUS_BANDUNG;
CREATE OR REPLACE SYNONYM PASIEN_SURABAYA FOR PASIEN@SITUS_SURABAYA;

-- Program lokalisasi fragmentasi horizontal: R = F1 UNION ALL F2 UNION ALL ...
-- Oracle memangkas cabang yang predikatnya bertentangan dengan WHERE kueri
-- (partition pruning / predicate pushdown) — inilah reduksi yang dibahas di Modul 7.
CREATE OR REPLACE VIEW V_PASIEN_NASIONAL AS
SELECT * FROM PASIEN WHERE KOTA = 'Jakarta'
UNION ALL
SELECT * FROM PASIEN@SITUS_BANDUNG WHERE KOTA = 'Bandung'
UNION ALL
SELECT * FROM PASIEN@SITUS_SURABAYA WHERE KOTA = 'Surabaya'
;

-- Periksa link yang ada dan sesi terdistribusi yang sedang terbuka:
SELECT db_link, username, host FROM user_db_links;
SELECT * FROM v$dblink;
