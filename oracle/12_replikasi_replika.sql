-- ==========================================================================
-- Langkah 12 - Replikasi: materialized view di situs Bandung
-- Salinan DOKTER disegarkan FAST: hanya perubahan yang dikirim.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================
-- @jalankan situs=bandung sebagai=rs_app
-- Sambungan: RS_APP ke PDB situs BANDUNG.

CREATE DATABASE LINK SITUS_JAKARTA
  CONNECT TO RS_APP IDENTIFIED BY "&&sandi_rs_app"
  USING '&&tns_jakarta';

-- Prasyarat di situs sumber (SITUS_JAKARTA): CREATE MATERIALIZED VIEW LOG ON DOKTER WITH PRIMARY KEY, ROWID, SEQUENCE INCLUDING NEW VALUES;
-- Replika (salinan) di situs tujuan.
CREATE MATERIALIZED VIEW MV_DOKTER
  BUILD IMMEDIATE
  REFRESH FAST ON DEMAND
  WITH PRIMARY KEY
AS SELECT * FROM DOKTER@SITUS_JAKARTA;

-- Segarkan manual:
EXEC DBMS_MVIEW.REFRESH('MV_DOKTER', 'F');

-- Pantau apakah replika tertinggal:
SELECT mview_name, last_refresh_type, last_refresh_date, staleness FROM user_mviews;

SELECT CASE WHEN (SELECT COUNT(*) FROM MV_DOKTER) = 6 THEN 'LULUS: replika berisi 6 dokter' ELSE 'GAGAL: replika berisi 6 dokter' END AS cek FROM dual;

-- Perubahan di sumber belum terlihat di replika sampai disegarkan (RPO asinkron):
UPDATE DOKTER@SITUS_JAKARTA SET WAKTU_KERJA = 'Senin-Sabtu' WHERE ID_DOKTER = 3;
COMMIT;
SELECT CASE WHEN (SELECT COUNT(*) FROM MV_DOKTER WHERE ID_DOKTER = 3 AND WAKTU_KERJA = 'Rabu-Jumat') = 1 THEN 'LULUS: sebelum refresh, replika masih nilai lama' ELSE 'GAGAL: sebelum refresh, replika masih nilai lama' END AS cek FROM dual;
EXEC DBMS_MVIEW.REFRESH('MV_DOKTER', 'F');
SELECT CASE WHEN (SELECT COUNT(*) FROM MV_DOKTER WHERE ID_DOKTER = 3 AND WAKTU_KERJA = 'Senin-Sabtu') = 1 THEN 'LULUS: setelah FAST refresh, replika mengikuti sumber' ELSE 'GAGAL: setelah FAST refresh, replika mengikuti sumber' END AS cek FROM dual;
SELECT CASE WHEN (SELECT COUNT(*) FROM user_mviews WHERE mview_name = 'MV_DOKTER' AND last_refresh_type = 'FAST') = 1 THEN 'LULUS: refresh terakhir berjenis FAST' ELSE 'GAGAL: refresh terakhir berjenis FAST' END AS cek FROM dual;

-- Refresh group menjaga konsistensi antar replika: seluruh MV di bawah ini
-- disegarkan dalam SATU transaksi, jadi tidak ada keadaan setengah jadi.
BEGIN
  DBMS_REFRESH.MAKE(
    name        => 'RG_REFERENSI',
    list        => 'MV_DOKTER',
    next_date   => SYSDATE,
    interval    => 'SYSDATE + 15/1440',
    implicit_destroy => FALSE);
END;
/

EXEC DBMS_REFRESH.REFRESH('RG_REFERENSI');
SELECT CASE WHEN (SELECT COUNT(*) FROM user_refresh WHERE rname = 'RG_REFERENSI') = 1 THEN 'LULUS: refresh group RG_REFERENSI terdaftar' ELSE 'GAGAL: refresh group RG_REFERENSI terdaftar' END AS cek FROM dual;

-- Kembalikan nilai sumber agar langkah berikutnya memakai data asli:
UPDATE DOKTER@SITUS_JAKARTA SET WAKTU_KERJA = 'Rabu-Jumat' WHERE ID_DOKTER = 3;
COMMIT;
