-- ==========================================================================
-- Langkah 5 - Fragmentasi vertikal
-- Contoh S1/S2 pada Modul 6: data gaji dipisahkan dari data identitas.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================

-- Alasan bisnis: kolom gaji hanya boleh dibaca bagian SDM, sedangkan nama
-- dan cabang dibaca semua orang. Memisahkannya secara vertikal membuat
-- hak akses bisa diberikan per tabel, bukan per kolom.

-- Syarat lossless-join: SETIAP fragmen wajib memuat kunci (STAFFNO).
-- Tanpa itu, S1 JOIN S2 tidak akan mengembalikan relasi aslinya.

CREATE TABLE S1_STAFF (
  STAFFNO                VARCHAR2(10) NOT NULL,
  POSITION               VARCHAR2(20),
  SEX                    VARCHAR2(1),
  DOB                    DATE,
  SALARY                 NUMBER(5),
  CONSTRAINT PK_S1_STAFF PRIMARY KEY (STAFFNO)
)
TABLESPACE TS_S3;

CREATE TABLE S2_STAFF (
  STAFFNO                VARCHAR2(10) NOT NULL,
  FNAME                  VARCHAR2(10),
  LNAME                  VARCHAR2(20),
  BRANCHNO               VARCHAR2(2),
  CONSTRAINT PK_S2_STAFF PRIMARY KEY (STAFFNO),
  CONSTRAINT FK_S2_STAFF_S1_STAFF FOREIGN KEY (STAFFNO)
    REFERENCES S1_STAFF (STAFFNO) ON DELETE CASCADE
)
TABLESPACE TS_S1;

-- VIEW perekat: mengembalikan relasi global dari fragmen-fragmen vertikal.
-- Inilah "program lokalisasi" untuk fragmentasi vertikal: R = F1 JOIN F2 ... atas kunci.
CREATE OR REPLACE VIEW STAFF AS
SELECT S1_STAFF.STAFFNO,
       S1_STAFF.POSITION,
       S1_STAFF.SEX,
       S1_STAFF.DOB,
       S1_STAFF.SALARY,
       S2_STAFF.FNAME,
       S2_STAFF.LNAME,
       S2_STAFF.BRANCHNO
  FROM S1_STAFF
  JOIN S2_STAFF ON S1_STAFF.STAFFNO = S2_STAFF.STAFFNO;

-- Uji rekonstruksi: jumlah baris VIEW harus sama dengan jumlah baris asli.
SELECT COUNT(*) AS baris_s1 FROM S1_STAFF;
SELECT COUNT(*) AS baris_s2 FROM S2_STAFF;
SELECT COUNT(*) AS baris_rekonstruksi FROM STAFF;

-- Reduksi fragmentasi vertikal: kueri di bawah hanya menyentuh S2_STAFF
-- karena tidak ada satu pun atribut S1_STAFF yang diminta.
EXPLAIN PLAN FOR SELECT FNAME, LNAME FROM STAFF;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, 'BASIC'));
