-- ==========================================================================
-- Langkah 15 - Satu kueri pada tingkat-tingkat transparansi
-- Hasil setiap tingkat wajib sama; yang berbeda hanya seberapa banyak lokasi yang harus ditulis.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================
-- @jalankan situs=jakarta sebagai=rs_app
-- Sambungan: RS_APP ke PDB situs JAKARTA.
-- Notasi modul "SELECT ... FROM PASIEN_JAKARTA AT SITE S1" BUKAN sintaks Oracle.
-- Padanannya di Oracle adalah tingkat 3 di bawah: nama_tabel@database_link.

-- TINGKAT 1: Transparansi fragmentasi
-- Kueri ke relasi global; fragmen maupun situs tidak disebut.
SELECT NAMA_PASIEN, PENYAKIT FROM V_PASIEN_NASIONAL WHERE JENIS_KELAMIN = 'P';
SELECT CASE WHEN (SELECT COUNT(*) FROM (SELECT NAMA_PASIEN, PENYAKIT FROM V_PASIEN_NASIONAL WHERE JENIS_KELAMIN = 'P')) = 6 THEN 'LULUS: tingkat 1 (Transparansi fragmentasi) menghasilkan 6 pasien perempuan' ELSE 'GAGAL: tingkat 1 (Transparansi fragmentasi) menghasilkan 6 pasien perempuan' END AS cek FROM dual;

-- TINGKAT 2: Transparansi lokasi
-- Fragmen disebut namanya, situsnya disembunyikan view dan sinonim.
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN_JAKARTA WHERE JENIS_KELAMIN = 'P'
UNION ALL
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN_BANDUNG WHERE JENIS_KELAMIN = 'P'
UNION ALL
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN_SURABAYA WHERE JENIS_KELAMIN = 'P';
SELECT CASE WHEN (SELECT COUNT(*) FROM (SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN_JAKARTA WHERE JENIS_KELAMIN = 'P'
UNION ALL
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN_BANDUNG WHERE JENIS_KELAMIN = 'P'
UNION ALL
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN_SURABAYA WHERE JENIS_KELAMIN = 'P')) = 6 THEN 'LULUS: tingkat 2 (Transparansi lokasi) menghasilkan 6 pasien perempuan' ELSE 'GAGAL: tingkat 2 (Transparansi lokasi) menghasilkan 6 pasien perempuan' END AS cek FROM dual;

-- TINGKAT 3: Transparansi pemetaan lokal
-- Fragmen DAN lokasinya disebut: partisi lokal dan tabel@database_link.
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN PARTITION (P_JAKARTA) WHERE JENIS_KELAMIN = 'P'
UNION ALL
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN@SITUS_BANDUNG WHERE JENIS_KELAMIN = 'P'
UNION ALL
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN@SITUS_SURABAYA WHERE JENIS_KELAMIN = 'P';
SELECT CASE WHEN (SELECT COUNT(*) FROM (SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN PARTITION (P_JAKARTA) WHERE JENIS_KELAMIN = 'P'
UNION ALL
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN@SITUS_BANDUNG WHERE JENIS_KELAMIN = 'P'
UNION ALL
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN@SITUS_SURABAYA WHERE JENIS_KELAMIN = 'P')) = 6 THEN 'LULUS: tingkat 3 (Transparansi pemetaan lokal) menghasilkan 6 pasien perempuan' ELSE 'GAGAL: tingkat 3 (Transparansi pemetaan lokal) menghasilkan 6 pasien perempuan' END AS cek FROM dual;

-- TINGKAT 4: Transparansi replikasi
-- Aplikasi membaca salinan terdekat lewat sinonim; ia tidak tahu salinan mana yang dipakai.
CREATE OR REPLACE SYNONYM DOKTER_TERDEKAT FOR MV_DOKTER@SITUS_BANDUNG;
SELECT NAMA_DOKTER, SPESIALIS FROM DOKTER_TERDEKAT;
SELECT CASE WHEN (SELECT COUNT(*) FROM DOKTER_TERDEKAT) = 6 THEN 'LULUS: replika dokter terbaca lewat sinonim' ELSE 'GAGAL: replika dokter terbaca lewat sinonim' END AS cek FROM dual;

-- TINGKAT 5: Tanpa transparansi - aplikasi sendiri yang merutekan ke setiap situs
-- (tiga kueri terpisah, digabung oleh aplikasi):
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN PARTITION (P_JAKARTA) WHERE JENIS_KELAMIN = 'P';
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN@SITUS_BANDUNG WHERE JENIS_KELAMIN = 'P';
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN@SITUS_SURABAYA WHERE JENIS_KELAMIN = 'P';
