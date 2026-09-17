-- ==========================================================================
-- Langkah 14d - DBA membersihkan catatan transaksi yang sudah diputuskan paksa
-- DBMS_TRANSACTION.PURGE_LOST_DB_ENTRY butuh hak SYS; entri forced commit/rollback tidak hilang sendiri.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================
-- @jalankan situs=jakarta sebagai=sys
-- Sambungan: SYS AS SYSDBA ke PDB situs JAKARTA.

SELECT local_tran_id, state FROM dba_2pc_pending;
BEGIN
  FOR t IN (SELECT local_tran_id FROM dba_2pc_pending WHERE state IN ('forced commit', 'forced rollback')) LOOP
    DBMS_TRANSACTION.PURGE_LOST_DB_ENTRY(t.local_tran_id);
    COMMIT;
  END LOOP;
END;
/
SELECT CASE WHEN (SELECT COUNT(*) FROM dba_2pc_pending WHERE state IN ('prepared', 'forced commit', 'forced rollback')) = 0 THEN 'LULUS: tidak ada lagi catatan transaksi prepared atau forced di situs pusat' ELSE 'GAGAL: tidak ada lagi catatan transaksi prepared atau forced di situs pusat' END AS cek FROM dual;
