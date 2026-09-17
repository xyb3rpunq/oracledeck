-- ==========================================================================
-- Langkah 2 - Pemilik skema aplikasi di setiap situs
-- Dijalankan tiga kali: di JAKARTA, BANDUNG, dan SURABAYA.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================
-- @jalankan situs=jakarta,bandung,surabaya sebagai=sys
-- Sambungan: SYS AS SYSDBA ke PDB situs JAKARTA,BANDUNG,SURABAYA.
-- Variabel &&situs diisi nama situs (JAKARTA/BANDUNG/SURABAYA), &&dir_data folder data Oracle.

-- Berkas data dikelola Oracle (OMF) agar nama berkas tidak perlu ditulis manual:
ALTER SYSTEM SET db_create_file_dest = '&&dir_data' SCOPE = BOTH;

CREATE TABLESPACE TS_&&situs DATAFILE SIZE 50M AUTOEXTEND ON NEXT 10M MAXSIZE 1G;

CREATE USER RS_APP IDENTIFIED BY "&&sandi_rs_app"
  DEFAULT TABLESPACE TS_&&situs QUOTA UNLIMITED ON TS_&&situs;

GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE SYNONYM,
      CREATE DATABASE LINK, CREATE MATERIALIZED VIEW, CREATE PROCEDURE TO RS_APP;

-- Hak untuk memeriksa dan menyelesaikan transaksi terdistribusi (Langkah 13):
GRANT SELECT_CATALOG_ROLE, FORCE ANY TRANSACTION TO RS_APP;
GRANT SELECT ON dba_2pc_pending TO RS_APP;
GRANT SELECT ON dba_2pc_neighbors TO RS_APP;
GRANT EXECUTE ON dbms_transaction TO RS_APP;

SELECT CASE WHEN (SELECT COUNT(*) FROM dba_users WHERE username = 'RS_APP') = 1 AND (SELECT COUNT(*) FROM dba_tablespaces WHERE tablespace_name = 'TS_&&situs') = 1 THEN 'LULUS: pengguna RS_APP dan tablespace situs siap' ELSE 'GAGAL: pengguna RS_APP dan tablespace situs siap' END AS cek FROM dual;
