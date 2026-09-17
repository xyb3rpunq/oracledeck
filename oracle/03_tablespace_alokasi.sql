-- ==========================================================================
-- Langkah 3 - Alokasi di dalam satu basis data: satu tablespace per situs
-- Dipakai Langkah 6: partisi PASIEN ditaruh di tablespace situsnya.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================
-- @jalankan situs=jakarta sebagai=sys
-- Sambungan: SYS AS SYSDBA ke PDB situs JAKARTA.

CREATE TABLESPACE TS_BANDUNG DATAFILE SIZE 20M AUTOEXTEND ON NEXT 10M MAXSIZE 1G;
CREATE TABLESPACE TS_SURABAYA DATAFILE SIZE 20M AUTOEXTEND ON NEXT 10M MAXSIZE 1G;

ALTER USER RS_APP QUOTA UNLIMITED ON TS_BANDUNG QUOTA UNLIMITED ON TS_SURABAYA;

SELECT CASE WHEN (SELECT COUNT(*) FROM dba_tablespaces WHERE tablespace_name IN ('TS_JAKARTA', 'TS_BANDUNG', 'TS_SURABAYA')) = 3 THEN 'LULUS: tiga tablespace alokasi tersedia di situs pusat' ELSE 'GAGAL: tiga tablespace alokasi tersedia di situs pusat' END AS cek FROM dual;
