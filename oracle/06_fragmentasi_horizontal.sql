-- ==========================================================================
-- Langkah 6 - Fragmentasi horizontal primer
-- sigma_{kota = X}(PASIEN) diwujudkan sebagai PARTITION BY LIST, tanpa kehilangan data.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================
-- @jalankan situs=jakarta sebagai=rs_app
-- @galat-diharapkan ORA-14402
-- Sambungan: RS_APP ke PDB situs JAKARTA.
-- Aturan kebenaran:
--   Kelengkapan  : partisi DEFAULT menampung kota yang belum terdaftar
--   Rekonstruksi : SELECT * FROM PASIEN menggabungkan seluruh partisi
--   Kedisjoinan  : satu baris hanya bisa berada di satu partisi LIST

-- Tabel yang sudah berisi data diubah menjadi terpartisi secara ONLINE (Oracle 12.2+):
ALTER TABLE PASIEN MODIFY
PARTITION BY LIST (KOTA) (
  PARTITION P_JAKARTA VALUES ('Jakarta') TABLESPACE TS_JAKARTA,
  PARTITION P_BANDUNG VALUES ('Bandung') TABLESPACE TS_BANDUNG,
  PARTITION P_SURABAYA VALUES ('Surabaya') TABLESPACE TS_SURABAYA,
  PARTITION P_LAIN VALUES (DEFAULT)
) ONLINE UPDATE INDEXES;

-- Indeks LOCAL: satu segmen indeks per partisi. Operasi partisi (DROP/EXCHANGE)
-- tidak membuat indeks partisi lain invalid. Pilihan default untuk fragmentasi.
CREATE INDEX IX_PASIEN_NAMA ON PASIEN (NAMA_PASIEN) LOCAL;

-- Indeks GLOBAL: satu pohon indeks untuk seluruh tabel. Lebih cepat untuk
-- pencarian lintas partisi, tetapi operasi partisi membuatnya UNUSABLE
-- kecuali dipakai UPDATE INDEXES.
CREATE INDEX IX_PASIEN_HP ON PASIEN (NO_HP) GLOBAL PARTITION BY HASH (NO_HP) PARTITIONS 4;

SELECT CASE WHEN (SELECT COUNT(*) FROM PASIEN PARTITION (P_JAKARTA)) = 4 AND (SELECT COUNT(*) FROM user_tab_partitions WHERE table_name = 'PASIEN' AND partition_name = 'P_JAKARTA' AND tablespace_name = 'TS_JAKARTA') = 1 THEN 'LULUS: fragmen P_JAKARTA berisi 4 baris dan berada di TS_JAKARTA' ELSE 'GAGAL: fragmen P_JAKARTA berisi 4 baris dan berada di TS_JAKARTA' END AS cek FROM dual;
SELECT CASE WHEN (SELECT COUNT(*) FROM PASIEN PARTITION (P_BANDUNG)) = 4 AND (SELECT COUNT(*) FROM user_tab_partitions WHERE table_name = 'PASIEN' AND partition_name = 'P_BANDUNG' AND tablespace_name = 'TS_BANDUNG') = 1 THEN 'LULUS: fragmen P_BANDUNG berisi 4 baris dan berada di TS_BANDUNG' ELSE 'GAGAL: fragmen P_BANDUNG berisi 4 baris dan berada di TS_BANDUNG' END AS cek FROM dual;
SELECT CASE WHEN (SELECT COUNT(*) FROM PASIEN PARTITION (P_SURABAYA)) = 4 AND (SELECT COUNT(*) FROM user_tab_partitions WHERE table_name = 'PASIEN' AND partition_name = 'P_SURABAYA' AND tablespace_name = 'TS_SURABAYA') = 1 THEN 'LULUS: fragmen P_SURABAYA berisi 4 baris dan berada di TS_SURABAYA' ELSE 'GAGAL: fragmen P_SURABAYA berisi 4 baris dan berada di TS_SURABAYA' END AS cek FROM dual;
SELECT CASE WHEN (SELECT COUNT(*) FROM PASIEN) = 12 THEN 'LULUS: kelengkapan: jumlah semua fragmen = 12 baris' ELSE 'GAGAL: kelengkapan: jumlah semua fragmen = 12 baris' END AS cek FROM dual;

-- Memindah baris ke fragmen lain butuh ROW MOVEMENT. Perintah pertama SENGAJA ditolak:
UPDATE PASIEN SET KOTA = 'Bandung' WHERE ID_PASIEN = 1;
ALTER TABLE PASIEN ENABLE ROW MOVEMENT;
UPDATE PASIEN SET KOTA = 'Bandung' WHERE ID_PASIEN = 1;
SELECT CASE WHEN (SELECT COUNT(*) FROM PASIEN PARTITION (P_BANDUNG) WHERE ID_PASIEN = 1) = 1 THEN 'LULUS: dengan ROW MOVEMENT baris berpindah ke fragmen Bandung' ELSE 'GAGAL: dengan ROW MOVEMENT baris berpindah ke fragmen Bandung' END AS cek FROM dual;
ROLLBACK;
SELECT CASE WHEN (SELECT COUNT(*) FROM PASIEN PARTITION (P_JAKARTA) WHERE ID_PASIEN = 1) = 1 THEN 'LULUS: ROLLBACK mengembalikan baris ke fragmen Jakarta' ELSE 'GAGAL: ROLLBACK mengembalikan baris ke fragmen Jakarta' END AS cek FROM dual;
