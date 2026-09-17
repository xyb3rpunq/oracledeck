-- ==========================================================================
-- Langkah 14c - Nyalakan kembali pemulihan otomatis (RECO)
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================
-- @jalankan situs=cdb sebagai=sys
-- Sambungan: SYS AS SYSDBA ke CDB$ROOT.

ALTER SYSTEM ENABLE DISTRIBUTED RECOVERY;
