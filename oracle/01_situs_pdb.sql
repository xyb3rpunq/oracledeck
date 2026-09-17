-- ==========================================================================
-- Langkah 1 - Tiga situs = tiga basis data
-- Situs Jakarta memakai PDB bawaan; Bandung dan Surabaya dibuat sebagai PDB baru.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================
-- @jalankan situs=cdb sebagai=sys
-- Sambungan: SYS AS SYSDBA ke CDB$ROOT.
-- Oracle Free 23ai: PDB bawaan FREEPDB1. Oracle XE 21c: XEPDB1 (XE mengizinkan 3 PDB).
-- Di produksi, tiap situs adalah server terpisah; PDB dipakai agar bisa diuji di satu laptop
-- dengan database link, 2PC, dan DBA_2PC_PENDING yang sungguhan.

-- Situs S2 - Bandung
CREATE PLUGGABLE DATABASE BANDUNG ADMIN USER PDB_ADMIN IDENTIFIED BY "&&sandi_rs_app"
  FILE_NAME_CONVERT = ('/pdbseed/', '/BANDUNG/');
ALTER PLUGGABLE DATABASE BANDUNG OPEN;
ALTER PLUGGABLE DATABASE BANDUNG SAVE STATE;

-- Situs S3 - Surabaya
CREATE PLUGGABLE DATABASE SURABAYA ADMIN USER PDB_ADMIN IDENTIFIED BY "&&sandi_rs_app"
  FILE_NAME_CONVERT = ('/pdbseed/', '/SURABAYA/');
ALTER PLUGGABLE DATABASE SURABAYA OPEN;
ALTER PLUGGABLE DATABASE SURABAYA SAVE STATE;

SELECT CASE WHEN (SELECT COUNT(*) FROM v$pdbs WHERE name IN ('BANDUNG', 'SURABAYA') AND open_mode = 'READ WRITE') = 2 THEN 'LULUS: PDB BANDUNG dan SURABAYA terbuka READ WRITE' ELSE 'GAGAL: PDB BANDUNG dan SURABAYA terbuka READ WRITE' END AS cek FROM dual;
