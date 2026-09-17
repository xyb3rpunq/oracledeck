-- ==========================================================================
-- Langkah 16 - Membaca rencana eksekusi
-- Bukti partition pruning (reduksi lokalisasi) dan operasi REMOTE.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================
-- @jalankan situs=jakarta sebagai=rs_app
-- Sambungan: RS_APP ke PDB situs JAKARTA.

EXEC DBMS_STATS.GATHER_SCHEMA_STATS('RS_APP', cascade => TRUE);

EXPLAIN PLAN SET STATEMENT_ID = 'pruning' FOR SELECT * FROM PASIEN WHERE KOTA = 'Jakarta';
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, 'pruning', 'BASIC +PARTITION'));
SELECT CASE WHEN (SELECT COUNT(*) FROM plan_table WHERE statement_id = 'pruning' AND operation = 'PARTITION LIST' AND options = 'SINGLE') = 1 THEN 'LULUS: predikat kota memangkas akses ke SATU partisi' ELSE 'GAGAL: predikat kota memangkas akses ke SATU partisi' END AS cek FROM dual;

EXPLAIN PLAN SET STATEMENT_ID = 'semua' FOR SELECT * FROM PASIEN;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, 'semua', 'BASIC +PARTITION'));
SELECT CASE WHEN (SELECT COUNT(*) FROM plan_table WHERE statement_id = 'semua' AND operation = 'PARTITION LIST' AND options = 'ALL') = 1 THEN 'LULUS: tanpa predikat, SELURUH partisi dibaca' ELSE 'GAGAL: tanpa predikat, SELURUH partisi dibaca' END AS cek FROM dual;

EXPLAIN PLAN SET STATEMENT_ID = 'remote' FOR
SELECT p.NAMA_PASIEN, d.ID_DAFTAR FROM PASIEN p JOIN DAFTAR@SITUS_BANDUNG d ON p.ID_PASIEN = d.ID_PASIEN;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, 'remote', 'BASIC +REMOTE'));
SELECT CASE WHEN (SELECT COUNT(*) FROM plan_table WHERE statement_id = 'remote' AND operation = 'REMOTE') >= 1 THEN 'LULUS: join lintas situs memuat operasi REMOTE' ELSE 'GAGAL: join lintas situs memuat operasi REMOTE' END AS cek FROM dual;
SELECT other FROM plan_table WHERE statement_id = 'remote' AND operation = 'REMOTE';
-- Kolom OTHER di atas berisi SQL yang benar-benar dikirim ke situs Bandung.
