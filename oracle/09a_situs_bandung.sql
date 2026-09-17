-- ==========================================================================
-- Langkah 9a - Fragmen di situs Bandung
-- PASIEN_BANDUNG = sigma_{kota = 'Bandung'}(PASIEN); DAFTAR diturunkan dari fragmen itu.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================
-- @jalankan situs=bandung sebagai=rs_app
-- @galat-diharapkan ORA-02290
-- Sambungan: RS_APP ke PDB situs BANDUNG.
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
  CONSTRAINT CK_PASIEN_KOTA CHECK (KOTA = 'Bandung')
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
  INTO PASIEN (ID_PASIEN, NAMA_PASIEN, ALAMAT_PASIEN, JENIS_KELAMIN, PENYAKIT, NO_HP, KOTA) VALUES (3, 'Andi Wijaya', 'Jl. Melati 9', 'L', 'Asma', '081234567003', 'Bandung')
  INTO PASIEN (ID_PASIEN, NAMA_PASIEN, ALAMAT_PASIEN, JENIS_KELAMIN, PENYAKIT, NO_HP, KOTA) VALUES (4, 'Rina Marlina', 'Jl. Anggrek 21', 'P', 'Anemia', '081234567004', 'Bandung')
  INTO PASIEN (ID_PASIEN, NAMA_PASIEN, ALAMAT_PASIEN, JENIS_KELAMIN, PENYAKIT, NO_HP, KOTA) VALUES (8, 'Nurul Hidayah', 'Jl. Flamboyan 2', 'P', 'Migrain', '081234567008', 'Bandung')
  INTO PASIEN (ID_PASIEN, NAMA_PASIEN, ALAMAT_PASIEN, JENIS_KELAMIN, PENYAKIT, NO_HP, KOTA) VALUES (11, 'Rudi Hartono', 'Jl. Kamboja 11', 'L', 'Asma', '081234567011', 'Bandung')
SELECT * FROM dual;
INSERT ALL
  INTO DAFTAR (ID_DAFTAR, ID_PASIEN, ID_ADMIN, TANGGAL_DAFTAR) VALUES (5, 3, 3, DATE '2025-09-04')
  INTO DAFTAR (ID_DAFTAR, ID_PASIEN, ID_ADMIN, TANGGAL_DAFTAR) VALUES (6, 8, 3, DATE '2025-09-04')
  INTO DAFTAR (ID_DAFTAR, ID_PASIEN, ID_ADMIN, TANGGAL_DAFTAR) VALUES (7, 11, 3, DATE '2025-09-05')
  INTO DAFTAR (ID_DAFTAR, ID_PASIEN, ID_ADMIN, TANGGAL_DAFTAR) VALUES (8, 4, 3, DATE '2025-09-05')
SELECT * FROM dual;
COMMIT;

SELECT CASE WHEN (SELECT COUNT(*) FROM PASIEN) = 4 THEN 'LULUS: fragmen PASIEN Bandung berisi 4 baris' ELSE 'GAGAL: fragmen PASIEN Bandung berisi 4 baris' END AS cek FROM dual;
SELECT CASE WHEN (SELECT COUNT(*) FROM DAFTAR) = 4 THEN 'LULUS: fragmen DAFTAR Bandung berisi 4 baris' ELSE 'GAGAL: fragmen DAFTAR Bandung berisi 4 baris' END AS cek FROM dual;

-- CHECK menjaga predikat fragmen: pasien kota lain SENGAJA ditolak.
INSERT INTO PASIEN (ID_PASIEN, NAMA_PASIEN, JENIS_KELAMIN, KOTA) VALUES (91, 'Salah situs', 'L', 'Jakarta');
SELECT CASE WHEN (SELECT COUNT(*) FROM PASIEN WHERE ID_PASIEN = 91) = 0 THEN 'LULUS: baris yang salah situs tidak tersimpan' ELSE 'GAGAL: baris yang salah situs tidak tersimpan' END AS cek FROM dual;
