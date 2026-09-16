-- ==========================================================================
-- Langkah 3 - Fragmentasi horizontal primer
-- sigma_{kota = X}(PASIEN) diwujudkan sebagai PARTITION BY LIST.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================

-- Aturan kebenaran yang dijamin oleh partisi LIST + partisi DEFAULT:
--   Kelengkapan  : partisi DEFAULT menampung nilai kota yang belum terdaftar
--   Rekonstruksi : SELECT * FROM PASIEN otomatis menggabungkan seluruh partisi
--   Kedisjoinan  : satu baris hanya bisa masuk ke satu partisi LIST

-- Tabel pada 02_skema_global.sql dibuat ulang dalam bentuk terpartisi:
DROP TABLE PASIEN CASCADE CONSTRAINTS;

CREATE TABLE PASIEN (
  ID_PASIEN              NUMBER(8) NOT NULL,
  NAMA_PASIEN            VARCHAR2(60),
  ALAMAT_PASIEN          VARCHAR2(150),
  JENIS_KELAMIN          CHAR(1),
  PENYAKIT               VARCHAR2(100),
  NO_HP                  VARCHAR2(20),
  KOTA                   VARCHAR2(40),
  CONSTRAINT PK_PASIEN PRIMARY KEY (ID_PASIEN),
  CONSTRAINT CK_PASIEN_JK CHECK (JENIS_KELAMIN IN ('L','P'))
)
PARTITION BY LIST (KOTA) (
  PARTITION P_JAKARTA VALUES ('Jakarta') TABLESPACE TS_S1,
  PARTITION P_BANDUNG VALUES ('Bandung') TABLESPACE TS_S2,
  PARTITION P_SURABAYA VALUES ('Surabaya') TABLESPACE TS_S3,
  PARTITION P_PASIEN_LAIN VALUES (DEFAULT)
);

-- Indeks LOCAL: satu segmen indeks per partisi. Operasi partisi (DROP/EXCHANGE)
-- tidak membuat indeks partisi lain invalid. Pilihan default untuk fragmentasi.
CREATE INDEX IX_PASIEN_NAMA ON PASIEN (NAMA_PASIEN) LOCAL;

-- Indeks GLOBAL: satu pohon indeks untuk seluruh tabel. Lebih cepat untuk
-- pencarian lintas partisi, tetapi operasi partisi membuatnya UNUSABLE
-- kecuali dipakai UPDATE INDEXES.
CREATE INDEX IX_PASIEN_HP ON PASIEN (NO_HP) GLOBAL PARTITION BY HASH (NO_HP) PARTITIONS 4;

-- Berapa baris di tiap fragmen:
SELECT partition_name, num_rows FROM user_tab_partitions WHERE table_name = 'PASIEN';

-- Setara dengan "AT SITE" pada Modul 6 - akses satu fragmen secara langsung:
SELECT COUNT(*) FROM PASIEN PARTITION (P_JAKARTA);
SELECT COUNT(*) FROM PASIEN PARTITION (P_BANDUNG);
SELECT COUNT(*) FROM PASIEN PARTITION (P_SURABAYA);
