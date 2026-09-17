-- ==========================================================================
-- Langkah 9b - Fragmen di situs Surabaya
-- PASIEN_SURABAYA = sigma_{kota = 'Surabaya'}(PASIEN); DAFTAR diturunkan dari fragmen itu.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================
-- @jalankan situs=surabaya sebagai=rs_app
-- @galat-diharapkan ORA-02290
-- Sambungan: RS_APP ke PDB situs SURABAYA.
-- Kunci asing DAFTAR.ID_ADMIN tidak dideklarasikan: induknya ada di basis data lain,
-- dan Oracle tidak mengizinkan kunci asing lintas basis data.

CREATE TABLE PASIEN (
  ID_PASIEN              NUMBER(8) NOT NULL,
  NAMA_PASIEN            VARCHAR2(60),
  ALAMAT_PASIEN          VARCHAR2(150),
  JENIS_KELAMIN          CHAR(1),
  PENYAKIT               VARCHAR2(100),
  NO_HP                  VARCHAR2(20),
  KOTA                   VARCHAR2(40),
  CONSTRAINT PK_PASIEN PRIMARY KEY (ID_PASIEN),
  CONSTRAINT CK_PASIEN_JK CHECK (JENIS_KELAMIN IN ('L','P')),
  CONSTRAINT CK_PASIEN_KOTA CHECK (KOTA = 'Surabaya')
);
CREATE TABLE DAFTAR (
  ID_DAFTAR              NUMBER(8) NOT NULL,
  ID_PASIEN              NUMBER(8) NOT NULL,
  ID_ADMIN               NUMBER(4),
  TANGGAL_DAFTAR         DATE,
  CONSTRAINT PK_DAFTAR PRIMARY KEY (ID_DAFTAR),
  CONSTRAINT FK_DAFTAR_PASIEN FOREIGN KEY (ID_PASIEN)
    REFERENCES PASIEN (ID_PASIEN) ON DELETE CASCADE
);

INSERT ALL
  INTO PASIEN (ID_PASIEN, NAMA_PASIEN, ALAMAT_PASIEN, JENIS_KELAMIN, PENYAKIT, NO_HP, KOTA) VALUES (5, 'Joko Susilo', 'Jl. Mawar 3', 'L', 'Diabetes', '081234567005', 'Surabaya')
  INTO PASIEN (ID_PASIEN, NAMA_PASIEN, ALAMAT_PASIEN, JENIS_KELAMIN, PENYAKIT, NO_HP, KOTA) VALUES (6, 'Dewi Lestari', 'Jl. Dahlia 7', 'P', 'Hipertensi', '081234567006', 'Surabaya')
  INTO PASIEN (ID_PASIEN, NAMA_PASIEN, ALAMAT_PASIEN, JENIS_KELAMIN, PENYAKIT, NO_HP, KOTA) VALUES (9, 'Hendra Gunawan', 'Jl. Teratai 18', 'L', 'Patah Tulang', '081234567009', 'Surabaya')
  INTO PASIEN (ID_PASIEN, NAMA_PASIEN, ALAMAT_PASIEN, JENIS_KELAMIN, PENYAKIT, NO_HP, KOTA) VALUES (12, 'Lina Wahyuni', 'Jl. Bougenville 6', 'P', 'Anemia', '081234567012', 'Surabaya')
SELECT * FROM dual;
INSERT ALL
  INTO DAFTAR (ID_DAFTAR, ID_PASIEN, ID_ADMIN, TANGGAL_DAFTAR) VALUES (9, 5, 4, DATE '2025-09-08')
  INTO DAFTAR (ID_DAFTAR, ID_PASIEN, ID_ADMIN, TANGGAL_DAFTAR) VALUES (10, 6, 4, DATE '2025-09-08')
  INTO DAFTAR (ID_DAFTAR, ID_PASIEN, ID_ADMIN, TANGGAL_DAFTAR) VALUES (11, 12, 4, DATE '2025-09-09')
  INTO DAFTAR (ID_DAFTAR, ID_PASIEN, ID_ADMIN, TANGGAL_DAFTAR) VALUES (12, 9, 3, DATE '2025-09-10')
SELECT * FROM dual;
COMMIT;

SELECT CASE WHEN (SELECT COUNT(*) FROM PASIEN) = 4 THEN 'LULUS: fragmen PASIEN Surabaya berisi 4 baris' ELSE 'GAGAL: fragmen PASIEN Surabaya berisi 4 baris' END AS cek FROM dual;
SELECT CASE WHEN (SELECT COUNT(*) FROM DAFTAR) = 4 THEN 'LULUS: fragmen DAFTAR Surabaya berisi 4 baris' ELSE 'GAGAL: fragmen DAFTAR Surabaya berisi 4 baris' END AS cek FROM dual;

-- CHECK menjaga predikat fragmen: pasien kota lain SENGAJA ditolak.
INSERT INTO PASIEN (ID_PASIEN, NAMA_PASIEN, JENIS_KELAMIN, KOTA) VALUES (91, 'Salah situs', 'L', 'Jakarta');
SELECT CASE WHEN (SELECT COUNT(*) FROM PASIEN WHERE ID_PASIEN = 91) = 0 THEN 'LULUS: baris yang salah situs tidak tersimpan' ELSE 'GAGAL: baris yang salah situs tidak tersimpan' END AS cek FROM dual;
