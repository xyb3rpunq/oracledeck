-- ==========================================================================
-- Langkah 13 - Transaksi terdistribusi dan two-phase commit
-- Satu COMMIT atas dua basis data: Oracle menjalankan 2PC otomatis.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================
-- @jalankan situs=jakarta sebagai=rs_app
-- @galat-diharapkan ORA-02290
-- Sambungan: RS_APP ke PDB situs JAKARTA.

-- Transaksi terdistribusi. Oracle menjalankan two-phase commit SECARA OTOMATIS
-- begitu satu transaksi menyentuh lebih dari satu basis data lewat database link.
-- Tidak ada perintah khusus: cukup COMMIT.

SET TRANSACTION NAME 'RUJUK_PASIEN_LINTAS_KOTA';

-- situs Jakarta (lokal)
UPDATE PASIEN SET PENYAKIT = 'Asma - dirujuk' WHERE ID_PASIEN = 3;

-- situs Bandung (remote)
INSERT INTO DAFTAR@SITUS_BANDUNG (ID_DAFTAR, ID_PASIEN, ID_ADMIN, TANGGAL_DAFTAR) VALUES (99, 3, 3, DATE '2025-09-20');

-- Satu COMMIT ini memicu PREPARE ke 2 situs, lalu COMMIT global.
COMMIT;

-- Menunjuk situs commit point (paling tepercaya / paling jarang mati):
-- ALTER SESSION SET COMMIT_POINT_STRENGTH = 200;  (parameter tingkat instans)
SELECT CASE WHEN (SELECT COUNT(*) FROM DAFTAR@SITUS_BANDUNG WHERE ID_DAFTAR = 99) = 1 AND (SELECT COUNT(*) FROM PASIEN WHERE ID_PASIEN = 3 AND PENYAKIT = 'Asma - dirujuk') = 1 THEN 'LULUS: kedua situs menyimpan perubahan' ELSE 'GAGAL: kedua situs menyimpan perubahan' END AS cek FROM dual;

-- Atomisitas global: perintah remote yang gagal membatalkan perubahan lokal juga.
UPDATE PASIEN SET PENYAKIT = 'Harus batal' WHERE ID_PASIEN = 1;
INSERT INTO PASIEN@SITUS_BANDUNG (ID_PASIEN, NAMA_PASIEN, JENIS_KELAMIN, KOTA) VALUES (92, 'Salah situs', 'L', 'Jakarta');
ROLLBACK;
SELECT CASE WHEN (SELECT COUNT(*) FROM PASIEN WHERE ID_PASIEN = 1 AND PENYAKIT = 'Demam Berdarah') = 1 THEN 'LULUS: ROLLBACK membatalkan perubahan lokal' ELSE 'GAGAL: ROLLBACK membatalkan perubahan lokal' END AS cek FROM dual;

SELECT name, value FROM v$parameter WHERE name IN ('commit_point_strength', 'distributed_lock_timeout');
