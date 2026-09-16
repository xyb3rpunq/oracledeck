-- ==========================================================================
-- Langkah 1 - Wadah fisik: satu tablespace per situs
-- Alokasi fragmen ke situs diwujudkan sebagai penempatan partisi ke tablespace.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================

-- Jalankan sebagai SYS atau pengguna dengan hak DBA.
-- Pada Oracle XE 21c: sqlplus sys/oracle@//localhost:1521/XEPDB1 as sysdba

ALTER SESSION SET CONTAINER = XEPDB1;

-- Situs S1 - Jakarta
CREATE TABLESPACE TS_S1
  DATAFILE 's1_rs01.dbf' SIZE 100M AUTOEXTEND ON NEXT 10M MAXSIZE 2G
  EXTENT MANAGEMENT LOCAL SEGMENT SPACE MANAGEMENT AUTO;

-- Situs S2 - Bandung
CREATE TABLESPACE TS_S2
  DATAFILE 's2_rs01.dbf' SIZE 100M AUTOEXTEND ON NEXT 10M MAXSIZE 2G
  EXTENT MANAGEMENT LOCAL SEGMENT SPACE MANAGEMENT AUTO;

-- Situs S3 - Surabaya
CREATE TABLESPACE TS_S3
  DATAFILE 's3_rs01.dbf' SIZE 100M AUTOEXTEND ON NEXT 10M MAXSIZE 2G
  EXTENT MANAGEMENT LOCAL SEGMENT SPACE MANAGEMENT AUTO;

-- Pemilik skema aplikasi
CREATE USER RS_APP IDENTIFIED BY "&sandi_rs_app"
  DEFAULT TABLESPACE TS_S1
  QUOTA UNLIMITED ON TS_S1 QUOTA UNLIMITED ON TS_S2 QUOTA UNLIMITED ON TS_S3;

GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE SYNONYM,
      CREATE DATABASE LINK, CREATE MATERIALIZED VIEW TO RS_APP;

-- Hak yang diperlukan untuk memeriksa transaksi terdistribusi:
GRANT SELECT ON dba_2pc_pending TO RS_APP;
GRANT SELECT ON dba_2pc_neighbors TO RS_APP;
GRANT SELECT_CATALOG_ROLE TO RS_APP;

-- Periksa hasilnya:
SELECT tablespace_name, status, contents FROM dba_tablespaces WHERE tablespace_name LIKE 'TS_%';
