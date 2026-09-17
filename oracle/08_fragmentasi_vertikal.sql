-- ==========================================================================
-- Langkah 8 - Fragmentasi vertikal
-- STAFF dari Modul 6: data gaji (S1) dipisahkan dari data identitas (S2).
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================
-- @jalankan situs=jakarta sebagai=rs_app
-- Sambungan: RS_APP ke PDB situs JAKARTA.
-- Syarat lossless-join: SETIAP fragmen memuat kunci STAFFNO.

CREATE TABLE S1_STAFF (
  STAFFNO                VARCHAR2(10) NOT NULL,
  POSITION               VARCHAR2(20),
  SEX                    VARCHAR2(1),
  DOB                    DATE,
  SALARY                 NUMBER(5),
  CONSTRAINT PK_S1_STAFF PRIMARY KEY (STAFFNO)
);

CREATE TABLE S2_STAFF (
  STAFFNO                VARCHAR2(10) NOT NULL,
  FNAME                  VARCHAR2(10),
  LNAME                  VARCHAR2(20),
  BRANCHNO               VARCHAR2(2),
  CONSTRAINT PK_S2_STAFF PRIMARY KEY (STAFFNO),
  CONSTRAINT FK_S2_STAFF_S1_STAFF FOREIGN KEY (STAFFNO)
    REFERENCES S1_STAFF (STAFFNO) ON DELETE CASCADE
);

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

INSERT ALL
  INTO S1_STAFF (STAFFNO, POSITION, SEX, DOB, SALARY) VALUES ('SL21', 'Manager', 'M', DATE '1945-10-01', 30000)
  INTO S1_STAFF (STAFFNO, POSITION, SEX, DOB, SALARY) VALUES ('SG37', 'Assistant', 'F', DATE '1960-11-10', 12000)
  INTO S1_STAFF (STAFFNO, POSITION, SEX, DOB, SALARY) VALUES ('SG14', 'Supervisor', 'M', DATE '1958-03-24', 18000)
  INTO S1_STAFF (STAFFNO, POSITION, SEX, DOB, SALARY) VALUES ('SA9', 'Assistant', 'F', DATE '1970-02-19', 9000)
  INTO S1_STAFF (STAFFNO, POSITION, SEX, DOB, SALARY) VALUES ('SG5', 'Manager', 'F', DATE '1940-06-03', 24000)
  INTO S1_STAFF (STAFFNO, POSITION, SEX, DOB, SALARY) VALUES ('SL41', 'Assistant', 'F', DATE '1965-06-13', 9000)
  INTO S1_STAFF (STAFFNO, POSITION, SEX, DOB, SALARY) VALUES ('SL22', 'Supervisor', 'M', DATE '1972-09-02', 17000)
  INTO S1_STAFF (STAFFNO, POSITION, SEX, DOB, SALARY) VALUES ('SA11', 'Manager', 'F', DATE '1968-01-25', 27000)
  INTO S1_STAFF (STAFFNO, POSITION, SEX, DOB, SALARY) VALUES ('SA14', 'Assistant', 'M', DATE '1980-12-05', 9500)
  INTO S1_STAFF (STAFFNO, POSITION, SEX, DOB, SALARY) VALUES ('SG21', 'Assistant', 'F', DATE '1977-07-17', 11000)
SELECT * FROM dual;
INSERT ALL
  INTO S2_STAFF (STAFFNO, FNAME, LNAME, BRANCHNO) VALUES ('SL21', 'John', 'White', 'B5')
  INTO S2_STAFF (STAFFNO, FNAME, LNAME, BRANCHNO) VALUES ('SG37', 'Ann', 'Beech', 'B3')
  INTO S2_STAFF (STAFFNO, FNAME, LNAME, BRANCHNO) VALUES ('SG14', 'David', 'Ford', 'B3')
  INTO S2_STAFF (STAFFNO, FNAME, LNAME, BRANCHNO) VALUES ('SA9', 'Mary', 'Howe', 'B7')
  INTO S2_STAFF (STAFFNO, FNAME, LNAME, BRANCHNO) VALUES ('SG5', 'Susan', 'Brand', 'B3')
  INTO S2_STAFF (STAFFNO, FNAME, LNAME, BRANCHNO) VALUES ('SL41', 'Julie', 'Lee', 'B5')
  INTO S2_STAFF (STAFFNO, FNAME, LNAME, BRANCHNO) VALUES ('SL22', 'Peter', 'Nugroho', 'B5')
  INTO S2_STAFF (STAFFNO, FNAME, LNAME, BRANCHNO) VALUES ('SA11', 'Rina', 'Sitorus', 'B7')
  INTO S2_STAFF (STAFFNO, FNAME, LNAME, BRANCHNO) VALUES ('SA14', 'Bimo', 'Prasetyo', 'B7')
  INTO S2_STAFF (STAFFNO, FNAME, LNAME, BRANCHNO) VALUES ('SG21', 'Clara', 'Munthe', 'B3')
SELECT * FROM dual;
COMMIT;

SELECT CASE WHEN (SELECT COUNT(*) FROM STAFF) = 10 THEN 'LULUS: rekonstruksi S1 JOIN S2 mengembalikan 10 pegawai' ELSE 'GAGAL: rekonstruksi S1 JOIN S2 mengembalikan 10 pegawai' END AS cek FROM dual;
SELECT CASE WHEN (SELECT COUNT(*) FROM user_tab_columns WHERE table_name = 'STAFF') = 8 THEN 'LULUS: rekonstruksi memuat seluruh atribut asli' ELSE 'GAGAL: rekonstruksi memuat seluruh atribut asli' END AS cek FROM dual;

EXPLAIN PLAN SET STATEMENT_ID = 'vertikal' FOR SELECT FNAME, LNAME FROM S2_STAFF;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, 'vertikal', 'BASIC'));
