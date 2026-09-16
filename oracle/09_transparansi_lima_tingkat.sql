-- ==========================================================================
-- Langkah 9 - Satu kueri, lima tingkat transparansi
-- Kueri yang sama ditulis ulang sesuai tangga transparansi pada Modul 6.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================

-- ----------------------------------------------------------------------
-- TINGKAT 1: Transparansi fragmentasi
-- Tingkat tertinggi. Akses memakai skema global; nama fragmen maupun situs tidak pernah muncul.
-- Fragmen disebut: 0 | Situs disebut: 0 | Panjang SQL: 67 karakter

SELECT NAMA_PASIEN, PENYAKIT
FROM PASIEN
WHERE JENIS_KELAMIN = 'P';

-- ----------------------------------------------------------------------
-- TINGKAT 2: Transparansi lokasi
-- Tingkat menengah. Pengguna tahu data difragmentasi dan harus menyebut nama fragmen, tetapi tidak perlu tahu fragmen itu disimpan di situs mana.
-- Fragmen disebut: 3 | Situs disebut: 0 | Panjang SQL: 238 karakter

SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN_JAKARTA WHERE JENIS_KELAMIN = 'P'
UNION
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN_BANDUNG WHERE JENIS_KELAMIN = 'P'
UNION
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN_SURABAYA WHERE JENIS_KELAMIN = 'P';

-- ----------------------------------------------------------------------
-- TINGKAT 3: Transparansi replikasi
-- Pengguna tidak tahu ada berapa salinan fragmen, apalagi salinan mana yang dipakai. Sistem yang memilih. Bisa ada tanpa transparansi lokasi.
-- Fragmen disebut: 3 | Situs disebut: 0 | Panjang SQL: 238 karakter
-- Tidak ada fragmen yang direplikasi pada rancangan ini.

SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN_JAKARTA WHERE JENIS_KELAMIN = 'P'
UNION
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN_BANDUNG WHERE JENIS_KELAMIN = 'P'
UNION
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN_SURABAYA WHERE JENIS_KELAMIN = 'P';

-- ----------------------------------------------------------------------
-- TINGKAT 4: Transparansi pemetaan lokal
-- Tingkat paling rendah. Pengguna wajib menyebut nama fragmen sekaligus lokasi penyimpanannya.
-- Fragmen disebut: 3 | Situs disebut: 3 | Panjang SQL: 271 karakter

SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN_JAKARTA AT SITE S1 WHERE JENIS_KELAMIN = 'P'
UNION
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN_BANDUNG AT SITE S2 WHERE JENIS_KELAMIN = 'P'
UNION
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN_SURABAYA AT SITE S3 WHERE JENIS_KELAMIN = 'P';

-- ----------------------------------------------------------------------
-- TINGKAT 5: Tanpa transparansi (rute eksplisit)
-- Aplikasi menuliskan sendiri rute akses lintas basis data. Di Oracle bentuknya nama_tabel@database_link.
-- Fragmen disebut: 3 | Situs disebut: 3 | Panjang SQL: 282 karakter
-- PERINGATAN: Perubahan letak fisik data memaksa seluruh aplikasi diubah — inilah biaya yang ditanggung saat transparansi dilepas.

SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN_JAKARTA@SITES1_LINK WHERE JENIS_KELAMIN = 'P'
UNION ALL
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN_BANDUNG@SITES2_LINK WHERE JENIS_KELAMIN = 'P'
UNION ALL
SELECT NAMA_PASIEN, PENYAKIT FROM PASIEN_SURABAYA@SITES3_LINK WHERE JENIS_KELAMIN = 'P';

-- Kesimpulan: makin rendah transparansinya, makin panjang SQL yang harus
-- ditulis aplikasi, dan makin banyak yang harus diubah saat data dipindahkan.
