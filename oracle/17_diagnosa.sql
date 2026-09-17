-- ==========================================================================
-- Langkah 17 - Diagnosa DBA: transaksi menggantung, kunci, dan deadlock
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================
-- @jalankan situs=jakarta sebagai=rs_app
-- Sambungan: RS_APP ke PDB situs JAKARTA.

-- Transaksi terdistribusi yang menggantung (in-doubt):
SELECT local_tran_id, global_tran_id, state, mixed, advice, host, commit#
  FROM dba_2pc_pending
 ORDER BY fail_time;

-- Sisi mana yang belum menjawab:
SELECT local_tran_id, in_out, database, dbuser_owner, interface, dbid
  FROM dba_2pc_neighbors;

-- Kunci yang tertahan gara-gara transaksi in-doubt:
SELECT s.sid, s.serial#, s.username, l.type, l.id1, l.id2, l.lmode, l.request
  FROM v$lock l JOIN v$session s ON s.sid = l.sid
 WHERE l.type IN ('TX','TM') AND l.request > 0;

-- Deadlock: Oracle mendeteksi sendiri dan melempar ORA-00060 ke salah satu sesi.
-- Rinciannya ada di trace file yang ditunjuk:
SELECT value FROM v$diag_info WHERE name = 'Default Trace File';

-- Paksa keputusan HANYA bila keputusan koordinator sudah dipastikan:
-- COMMIT FORCE '<local_tran_id>';
-- ROLLBACK FORCE '<local_tran_id>';
-- EXEC DBMS_TRANSACTION.PURGE_LOST_DB_ENTRY('<local_tran_id>');

-- Siapa menunggu siapa (wait-for graph versi Oracle):
SELECT s.sid, s.username, s.blocking_session, s.event, s.seconds_in_wait
  FROM v$session s
 WHERE s.blocking_session IS NOT NULL;

SELECT CASE WHEN (SELECT COUNT(*) FROM dba_2pc_pending WHERE state = 'prepared') = 0 THEN 'LULUS: tidak ada transaksi yang masih menggantung' ELSE 'GAGAL: tidak ada transaksi yang masih menggantung' END AS cek FROM dual;
SELECT CASE WHEN (SELECT COUNT(*) FROM user_objects WHERE status <> 'VALID') = 0 THEN 'LULUS: seluruh objek RS_APP valid' ELSE 'GAGAL: seluruh objek RS_APP valid' END AS cek FROM dual;
