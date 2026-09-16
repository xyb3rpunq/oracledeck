-- ==========================================================================
-- Langkah 10 - Diagnosa transaksi menggantung dan deadlock
-- Yang dilakukan DBA ketika 2PC benar-benar memblokir di produksi.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================

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

-- Arti kolom STATE pada dba_2pc_pending:
--   collecting  : koordinator masih mengumpulkan suara
--   prepared    : situs ini sudah READY dan MENUNGGU keputusan - inilah keadaan terblokir
--   committed   : sudah commit, tinggal menunggu pembersihan
--   forced commit / forced abort : keputusan dipaksa manual oleh DBA

-- Kolom MIXED = yes berarti bencana: sebagian situs commit, sebagian rollback.
-- Itu terjadi bila COMMIT FORCE dipakai dengan keputusan yang salah.

-- Deadlock terdistribusi: Oracle mendeteksi sendiri dan mengorbankan satu sesi
-- dengan ORA-00060. Yang perlu dibaca adalah trace file-nya:
SELECT value AS trace_file FROM v$diag_info WHERE name = 'Default Trace File';

-- Siapa menunggu siapa (wait-for graph versi Oracle):
SELECT s.sid, s.username, s.blocking_session, s.event, s.seconds_in_wait
  FROM v$session s
 WHERE s.blocking_session IS NOT NULL;

-- Batas waktu menunggu kunci terdistribusi:
SELECT name, value FROM v$parameter WHERE name = 'distributed_lock_timeout';
