-- ==========================================================================
-- Langkah 11 - Replikasi: MV log di situs sumber
-- DOKTER dibaca semua situs tetapi jarang berubah - kandidat replikasi.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================
-- @jalankan situs=jakarta sebagai=rs_app
-- Sambungan: RS_APP ke PDB situs JAKARTA.
-- MV log WAJIB dibuat di basis data pemilik tabel, bukan lewat database link.

-- MV log di situs sumber: mencatat perubahan agar refresh cepat (FAST) mungkin.
CREATE MATERIALIZED VIEW LOG ON DOKTER
  WITH PRIMARY KEY, ROWID, SEQUENCE INCLUDING NEW VALUES;

SELECT CASE WHEN (SELECT COUNT(*) FROM user_mview_logs WHERE master = 'DOKTER') = 1 THEN 'LULUS: MV log DOKTER tersedia' ELSE 'GAGAL: MV log DOKTER tersedia' END AS cek FROM dual;
