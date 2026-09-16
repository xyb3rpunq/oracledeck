-- ==========================================================================
-- Langkah 4 - Fragmentasi horizontal turunan (derived)
-- PASIEN_DOKTER mengikuti fragmentasi PASIEN lewat PARTITION BY REFERENCE.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================

-- Tanpa ini, setiap join PASIEN x PASIEN_DOKTER harus melintasi jaringan.
-- Dengan reference partitioning, baris anak SELALU berada di partisi yang sama
-- dengan induknya, sehingga join menjadi partition-wise join yang lokal.

DROP TABLE PASIEN_DOKTER CASCADE CONSTRAINTS;

CREATE TABLE PASIEN_DOKTER (
  ID                     NUMBER(8)  NOT NULL,
  ID_DOKTER              NUMBER(4)  NOT NULL,
  ID_PASIEN              NUMBER(8)  NOT NULL,
  WAKTU_PERIKSA          DATE,
  RESEP                  VARCHAR2(120),
  BIAYA                  NUMBER(12,2),
  CONSTRAINT PK_PASIEN_DOKTER PRIMARY KEY (ID),
  CONSTRAINT FK_PD_PASIEN FOREIGN KEY (ID_PASIEN) REFERENCES PASIEN (ID_PASIEN),
  CONSTRAINT FK_PD_DOKTER FOREIGN KEY (ID_DOKTER) REFERENCES DOKTER (ID_DOKTER)
)
PARTITION BY REFERENCE (FK_PD_PASIEN);

-- Syarat reference partitioning: kolom foreign key WAJIB NOT NULL.
-- Partisi anak otomatis mewarisi nama partisi induknya:
SELECT partition_name FROM user_tab_partitions WHERE table_name = 'PASIEN_DOKTER';

-- Bukti join menjadi lokal (cari baris PARTITION JOIN pada rencana):
EXPLAIN PLAN FOR
SELECT p.NAMA_PASIEN, pd.RESEP
  FROM PASIEN p JOIN PASIEN_DOKTER pd ON p.ID_PASIEN = pd.ID_PASIEN
 WHERE p.KOTA = 'Jakarta';
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, 'BASIC +PARTITION'));
