-- ==========================================================================
-- Langkah 14b - Kegagalan 2PC, DBA_2PC_PENDING, dan COMMIT FORCE
-- Oracle mensimulasikan kegagalan lewat komentar ORA-2PC-CRASH-TEST-n.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================
-- @jalankan situs=jakarta sebagai=rs_app
-- @galat-diharapkan ORA-02054 ORA-02059 ORA-01591
-- Sambungan: RS_APP ke PDB situs JAKARTA.
-- Butuh hak FORCE ANY TRANSACTION di SEMUA situs yang terlibat (Langkah 2).

UPDATE PASIEN SET NO_HP = '081299990003' WHERE ID_PASIEN = 3;
UPDATE PASIEN@SITUS_BANDUNG SET NO_HP = '081299990003' WHERE ID_PASIEN = 3;
-- Titik kegagalan 7: situs Bandung sudah commit, situs pusat tertinggal di PREPARED.
COMMIT COMMENT 'ORA-2PC-CRASH-TEST-7';

-- Catatan in-doubt ditulis ke DBA_2PC_PENDING secara ASINKRON (beberapa detik); tunggu dulu:
DECLARE
  n NUMBER;
BEGIN
  FOR i IN 1 .. 60 LOOP
    SELECT COUNT(*) INTO n FROM dba_2pc_pending WHERE state = 'prepared';
    EXIT WHEN n > 0;
    DBMS_SESSION.SLEEP(1);
  END LOOP;
END;
/

COLUMN local_tran_id NEW_VALUE id_ragu
SELECT local_tran_id, global_tran_id, state, mixed FROM dba_2pc_pending WHERE state = 'prepared';
SELECT CASE WHEN (SELECT COUNT(*) FROM dba_2pc_pending WHERE state = 'prepared') = 1 THEN 'LULUS: transaksi tercatat ragu-ragu (prepared) di DBA_2PC_PENDING' ELSE 'GAGAL: transaksi tercatat ragu-ragu (prepared) di DBA_2PC_PENDING' END AS cek FROM dual;

-- Baris yang dikunci transaksi ragu-ragu tidak bisa dibaca - perintah ini SENGAJA gagal (ORA-01591):
SELECT NO_HP FROM PASIEN WHERE ID_PASIEN = 3;

-- Sebelum memaksa keputusan, DBA memeriksa keputusan di situs lain:
SELECT state FROM dba_2pc_pending@SITUS_BANDUNG;
SELECT CASE WHEN (SELECT COUNT(*) FROM dba_2pc_pending@SITUS_BANDUNG WHERE state = 'committed') = 1 THEN 'LULUS: situs Bandung sudah COMMIT, jadi keputusan yang benar adalah COMMIT FORCE' ELSE 'GAGAL: situs Bandung sudah COMMIT, jadi keputusan yang benar adalah COMMIT FORCE' END AS cek FROM dual;
-- Kueri lewat database link di atas membuka transaksi; tanpa COMMIT ini Oracle menolak COMMIT FORCE (ORA-02043).
COMMIT;
COMMIT FORCE '&id_ragu';

SELECT CASE WHEN (SELECT COUNT(*) FROM dba_2pc_pending WHERE state = 'forced commit') = 1 THEN 'LULUS: status berubah menjadi forced commit' ELSE 'GAGAL: status berubah menjadi forced commit' END AS cek FROM dual;
SELECT CASE WHEN (SELECT COUNT(*) FROM PASIEN WHERE ID_PASIEN = 3 AND NO_HP = '081299990003') = 1 AND (SELECT COUNT(*) FROM PASIEN@SITUS_BANDUNG WHERE ID_PASIEN = 3 AND NO_HP = '081299990003') = 1 THEN 'LULUS: data pusat kini sama dengan Bandung' ELSE 'GAGAL: data pusat kini sama dengan Bandung' END AS cek FROM dual;
COMMIT;
-- Catatan "forced commit" tetap tersimpan sampai DBA membersihkannya (Langkah 14d).
