-- ==========================================================================
-- Langkah 7 - Replikasi dengan materialized view
-- DOKTER dibaca semua situs tetapi jarang berubah - kandidat replikasi penuh.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================

-- Keputusan ini bukan selera: lab Alokasi & Replikasi menghitung bahwa
-- mereplikasi DOKTER ke tiga situs menurunkan biaya total, sedangkan
-- mereplikasi PASIEN justru menaikkannya karena PASIEN sering di-update.

-- MV log di situs sumber: mencatat perubahan agar refresh cepat (FAST) mungkin.
CREATE MATERIALIZED VIEW LOG ON DOKTER@SITUS_JAKARTA
  WITH PRIMARY KEY, ROWID, SEQUENCE INCLUDING NEW VALUES;

-- Replika (salinan) di situs tujuan.
CREATE MATERIALIZED VIEW MV_DOKTER
  TABLESPACE TS_S2
  BUILD IMMEDIATE
  REFRESH FAST START WITH SYSDATE NEXT SYSDATE + 15/1440
  WITH PRIMARY KEY
  ENABLE QUERY REWRITE
AS SELECT * FROM DOKTER@SITUS_JAKARTA;

-- Segarkan manual:
EXEC DBMS_MVIEW.REFRESH('MV_DOKTER', 'F');

-- Periksa apakah FAST REFRESH memang bisa dipakai:
EXEC DBMS_MVIEW.EXPLAIN_MVIEW('MV_DOKTER');
SELECT capability_name, possible, msgtxt FROM mv_capabilities_table
 WHERE capability_name LIKE 'REFRESH_FAST%';

-- Pilihan jadwal penyegaran dan konsekuensinya:
--   ON COMMIT   -> RPO 0, tetapi setiap COMMIT di sumber ikut menunggu (sinkron)
--   ON DEMAND   -> RPO sebesar jeda penyegaran, COMMIT tetap cepat (asinkron)
--   START WITH  -> penyegaran berkala; di atas dipakai 15 menit

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

-- Pantau apakah replika tertinggal:
SELECT mview_name, last_refresh_type, last_refresh_date, staleness FROM user_mviews;
SELECT name, status, next_date FROM user_refresh;
