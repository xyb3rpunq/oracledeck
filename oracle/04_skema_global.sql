-- ==========================================================================
-- Langkah 4 - Skema konseptual global (GCS)
-- Enam tabel Praktikum 2 dengan tipe data Oracle, PRIMARY KEY, FOREIGN KEY, dan CHECK.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================
-- @jalankan situs=jakarta sebagai=rs_app
-- Sambungan: RS_APP ke PDB situs JAKARTA.
-- Perbaikan terhadap skema praktikum asli:
--   * no_hp VARCHAR2, bukan NUMBER: nol di depan tidak boleh hilang.
--   * kolom kota sebagai kunci fragmentasi horizontal.
--   * ON DELETE CASCADE sesuai lembar praktikum (Oracle tidak punya ON UPDATE CASCADE).

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
);
CREATE TABLE DOKTER (
  ID_DOKTER              NUMBER(4) NOT NULL,
  NAMA_DOKTER            VARCHAR2(60),
  ALAMAT_DOKTER          VARCHAR2(150),
  TANGGAL_LAHIR          DATE,
  NO_HP                  VARCHAR2(20),
  SPESIALIS              VARCHAR2(40),
  WAKTU_KERJA            VARCHAR2(60),
  KOTA                   VARCHAR2(40),
  CONSTRAINT PK_DOKTER PRIMARY KEY (ID_DOKTER)
);
CREATE TABLE ADMINISTRATOR (
  ID_ADMIN               NUMBER(4) NOT NULL,
  NAMA_ADMIN             VARCHAR2(60),
  WAKTU_JAGA             VARCHAR2(30),
  KOTA                   VARCHAR2(40),
  CONSTRAINT PK_ADMINISTRATOR PRIMARY KEY (ID_ADMIN)
);
CREATE TABLE PASIEN_DOKTER (
  ID                     NUMBER(8) NOT NULL,
  ID_DOKTER              NUMBER(4) NOT NULL,
  ID_PASIEN              NUMBER(8) NOT NULL,
  WAKTU_PERIKSA          DATE,
  RESEP                  VARCHAR2(150),
  BIAYA                  NUMBER(12,2),
  CONSTRAINT PK_PASIEN_DOKTER PRIMARY KEY (ID),
  CONSTRAINT FK_PASIEN_DOKTER_DOKTER FOREIGN KEY (ID_DOKTER)
    REFERENCES DOKTER (ID_DOKTER) ON DELETE CASCADE,
  CONSTRAINT FK_PASIEN_DOKTER_PASIEN FOREIGN KEY (ID_PASIEN)
    REFERENCES PASIEN (ID_PASIEN) ON DELETE CASCADE
);
CREATE TABLE DOKTER_ADMIN (
  ID_DATA                NUMBER(8) NOT NULL,
  ID_DOKTER              NUMBER(4) NOT NULL,
  ID_ADMIN               NUMBER(4) NOT NULL,
  CONSTRAINT PK_DOKTER_ADMIN PRIMARY KEY (ID_DATA),
  CONSTRAINT FK_DOKTER_ADMIN_DOKTER FOREIGN KEY (ID_DOKTER)
    REFERENCES DOKTER (ID_DOKTER) ON DELETE CASCADE,
  CONSTRAINT FK_DOKTER_ADMIN_ADMINISTRATOR FOREIGN KEY (ID_ADMIN)
    REFERENCES ADMINISTRATOR (ID_ADMIN) ON DELETE CASCADE
);
CREATE TABLE DAFTAR (
  ID_DAFTAR              NUMBER(8) NOT NULL,
  ID_PASIEN              NUMBER(8) NOT NULL,
  ID_ADMIN               NUMBER(4) NOT NULL,
  TANGGAL_DAFTAR         DATE,
  CONSTRAINT PK_DAFTAR PRIMARY KEY (ID_DAFTAR),
  CONSTRAINT FK_DAFTAR_PASIEN FOREIGN KEY (ID_PASIEN)
    REFERENCES PASIEN (ID_PASIEN) ON DELETE CASCADE,
  CONSTRAINT FK_DAFTAR_ADMINISTRATOR FOREIGN KEY (ID_ADMIN)
    REFERENCES ADMINISTRATOR (ID_ADMIN) ON DELETE CASCADE
);

-- Indeks penunjang join:
CREATE INDEX IX_PD_PASIEN ON PASIEN_DOKTER (ID_PASIEN);
CREATE INDEX IX_PD_DOKTER ON PASIEN_DOKTER (ID_DOKTER);
CREATE INDEX IX_DAFTAR_PASIEN ON DAFTAR (ID_PASIEN);

SELECT CASE WHEN (SELECT COUNT(*) FROM user_tables WHERE table_name IN ('PASIEN', 'DOKTER', 'ADMINISTRATOR', 'PASIEN_DOKTER', 'DOKTER_ADMIN', 'DAFTAR')) = 6 THEN 'LULUS: enam tabel global terbentuk' ELSE 'GAGAL: enam tabel global terbentuk' END AS cek FROM dual;
SELECT CASE WHEN (SELECT COUNT(*) FROM user_constraints WHERE constraint_type = 'R') = 6 THEN 'LULUS: enam kunci asing terpasang' ELSE 'GAGAL: enam kunci asing terpasang' END AS cek FROM dual;
