-- ==========================================================================
-- Langkah 8 - Transaksi terdistribusi dan two-phase commit
-- Oracle menjalankan 2PC otomatis; yang perlu dipahami adalah kapan ia memblokir.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================

-- Transaksi terdistribusi. Oracle menjalankan two-phase commit SECARA OTOMATIS
-- begitu satu transaksi menyentuh lebih dari satu basis data lewat database link.
-- Tidak ada perintah khusus: cukup COMMIT.

SET TRANSACTION NAME 'RUJUK_PASIEN_LINTAS_KOTA';

-- situs Jakarta (lokal)
UPDATE PASIEN SET KOTA = 'Bandung' WHERE ID_PASIEN = 1;

-- situs Bandung (jauh)
INSERT INTO DAFTAR@SITUS_BANDUNG (ID_DAFTAR, ID_PASIEN, ID_ADMIN, TANGGAL_DAFTAR) VALUES (99, 1, 3, SYSDATE);

-- Satu COMMIT ini memicu PREPARE ke 2 situs, lalu COMMIT global.
COMMIT;

-- Menunjuk situs commit point (paling tepercaya / paling jarang mati):
-- ALTER SESSION SET COMMIT_POINT_STRENGTH = 200;  (parameter tingkat instans)

-- Urutan yang sebenarnya terjadi di balik satu COMMIT itu:
--   fase 1  koordinator mengirim PREPARE ke semua situs
--   fase 1  tiap situs menulis catatan READY lalu menjawab VOTE-COMMIT
--   fase 2  koordinator menulis keputusan lalu menyebarkan GLOBAL-COMMIT
--   fase 2  tiap situs commit dan mengirim ACK

-- Situs commit point ditentukan oleh COMMIT_POINT_STRENGTH tertinggi.
-- Pilih situs yang paling jarang mati sebagai commit point:
SELECT name, value FROM v$parameter WHERE name = 'commit_point_strength';
-- ALTER SYSTEM SET COMMIT_POINT_STRENGTH = 200 SCOPE = SPFILE;

-- Simulasi transaksi menggantung (jalankan di sesi terpisah, lalu matikan
-- jaringan ke situs jauh sebelum COMMIT selesai):
ALTER SESSION SET DISTRIBUTED_LOCK_TIMEOUT = 10;
