-- ==========================================================================
-- Langkah 11 - Membaca rencana eksekusi kueri terdistribusi
-- Bukti bahwa reduksi lokalisasi benar-benar terjadi di mesin, bukan di teori.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================

-- Reduksi fragmentasi horizontal versi Oracle: kueri di bawah HANYA menyentuh
-- satu partisi. Kolom PSTART/PSTOP pada rencana eksekusi membuktikannya.
EXPLAIN PLAN FOR
SELECT * FROM PASIEN WHERE KOTA = 'Jakarta';
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, 'BASIC +PARTITION'));

-- Bandingkan dengan kueri tanpa predikat partisi (menyentuh SELURUH partisi):
EXPLAIN PLAN FOR SELECT * FROM PASIEN;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, 'BASIC +PARTITION'));

-- Akses langsung ke satu partisi (setara "AT SITE" pada Modul 6):
SELECT * FROM PASIEN PARTITION (P_JAKARTA);

EXPLAIN PLAN SET STATEMENT_ID = 'join_lokal' FOR
SELECT p.NAMA_PASIEN, d.NAMA_DOKTER FROM PASIEN p JOIN PASIEN_DOKTER pd ON p.ID_PASIEN = pd.ID_PASIEN JOIN DOKTER d ON pd.ID_DOKTER = d.ID_DOKTER WHERE p.KOTA = 'Jakarta'
;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, 'join_lokal', 'ALL +PARTITION +REMOTE'));

-- Kolom yang perlu dibaca:
--   PSTART/PSTOP  -> partisi mana yang benar-benar disentuh (bukti partition pruning)
--   OPERATION REMOTE -> bagian kueri yang dikirim ke situs lain
--   Other-nya berisi SQL yang sesungguhnya dijalankan di situs jauh

-- Rencana yang BENAR-BENAR dipakai (bukan perkiraan):
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST +PARTITION'));

-- Kueri lintas situs - perhatikan baris REMOTE pada rencana:
EXPLAIN PLAN FOR
SELECT COUNT(*) FROM PASIEN@SITUS_BANDUNG;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, 'ALL +REMOTE'));

-- Kolom OTHER pada rencana berisi SQL yang benar-benar dikirim ke situs jauh.
-- Di situlah terlihat apakah Oracle mengirim seluruh tabel atau hanya
-- hasil yang sudah tersaring - persis perbandingan strategi join pada lab.

-- Statistik agar pengoptimal punya dasar angka:
EXEC DBMS_STATS.GATHER_SCHEMA_STATS('RS_APP', cascade => TRUE);
