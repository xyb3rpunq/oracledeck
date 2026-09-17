-- ==========================================================================
-- Langkah 14a - Matikan pemulihan otomatis (RECO) sementara
-- Agar transaksi ragu-ragu pada Langkah 14b tidak langsung diselesaikan proses RECO.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================
-- @jalankan situs=cdb sebagai=sys
-- Sambungan: SYS AS SYSDBA ke CDB$ROOT.

ALTER SYSTEM DISABLE DISTRIBUTED RECOVERY;
