-- ==========================================================================
-- Langkah 7 - Fragmentasi horizontal turunan (derived)
-- PASIEN_DOKTER_FRAG mengikuti fragmen PASIEN lewat PARTITION BY REFERENCE.
-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.
-- ==========================================================================
-- @jalankan situs=jakarta sebagai=rs_app
-- Sambungan: RS_APP ke PDB situs JAKARTA.
-- Syarat: kolom kunci asing NOT NULL dan tabel induk sudah terpartisi (Langkah 6).
-- Induk sudah ENABLE ROW MOVEMENT, maka anak juga wajib ROW MOVEMENT (tanpanya Oracle menolak: ORA-14661).

CREATE TABLE PASIEN_DOKTER_FRAG (
  ID                     NUMBER(8)     NOT NULL,
  ID_DOKTER              NUMBER(4)     NOT NULL,
  ID_PASIEN              NUMBER(8)     NOT NULL,
  WAKTU_PERIKSA          DATE,
  RESEP                  VARCHAR2(150),
  BIAYA                  NUMBER(12,2),
  CONSTRAINT PK_PASIEN_DOKTER_FRAG PRIMARY KEY (ID),
  CONSTRAINT FK_PDF_PASIEN FOREIGN KEY (ID_PASIEN) REFERENCES PASIEN (ID_PASIEN),
  CONSTRAINT FK_PDF_DOKTER FOREIGN KEY (ID_DOKTER) REFERENCES DOKTER (ID_DOKTER)
)
PARTITION BY REFERENCE (FK_PDF_PASIEN)
ENABLE ROW MOVEMENT;

INSERT INTO PASIEN_DOKTER_FRAG SELECT * FROM PASIEN_DOKTER;
COMMIT;

SELECT CASE WHEN (SELECT COUNT(*) FROM user_tab_partitions WHERE table_name = 'PASIEN_DOKTER_FRAG') = 4 THEN 'LULUS: partisi anak mewarisi 4 partisi induk' ELSE 'GAGAL: partisi anak mewarisi 4 partisi induk' END AS cek FROM dual;
SELECT CASE WHEN (SELECT COUNT(*) FROM PASIEN_DOKTER_FRAG PARTITION (P_JAKARTA)) = (SELECT COUNT(*) FROM PASIEN_DOKTER pd JOIN PASIEN p ON p.ID_PASIEN = pd.ID_PASIEN WHERE p.KOTA = 'Jakarta') THEN 'LULUS: setiap pemeriksaan pasien Jakarta ikut berada di fragmen P_JAKARTA' ELSE 'GAGAL: setiap pemeriksaan pasien Jakarta ikut berada di fragmen P_JAKARTA' END AS cek FROM dual;
SELECT CASE WHEN (SELECT COUNT(*) FROM PASIEN_DOKTER_FRAG PARTITION (P_BANDUNG)) = (SELECT COUNT(*) FROM PASIEN_DOKTER pd JOIN PASIEN p ON p.ID_PASIEN = pd.ID_PASIEN WHERE p.KOTA = 'Bandung') THEN 'LULUS: setiap pemeriksaan pasien Bandung ikut berada di fragmen P_BANDUNG' ELSE 'GAGAL: setiap pemeriksaan pasien Bandung ikut berada di fragmen P_BANDUNG' END AS cek FROM dual;
SELECT CASE WHEN (SELECT COUNT(*) FROM PASIEN_DOKTER_FRAG PARTITION (P_SURABAYA)) = (SELECT COUNT(*) FROM PASIEN_DOKTER pd JOIN PASIEN p ON p.ID_PASIEN = pd.ID_PASIEN WHERE p.KOTA = 'Surabaya') THEN 'LULUS: setiap pemeriksaan pasien Surabaya ikut berada di fragmen P_SURABAYA' ELSE 'GAGAL: setiap pemeriksaan pasien Surabaya ikut berada di fragmen P_SURABAYA' END AS cek FROM dual;

-- Rencana join: PARTITION LIST SINGLE pada kedua tabel menandakan join lokal satu fragmen.
EXPLAIN PLAN SET STATEMENT_ID = 'turunan' FOR
SELECT p.NAMA_PASIEN, pd.RESEP
  FROM PASIEN p JOIN PASIEN_DOKTER_FRAG pd ON p.ID_PASIEN = pd.ID_PASIEN
 WHERE p.KOTA = 'Jakarta';
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, 'turunan', 'BASIC +PARTITION'));
SELECT CASE WHEN (SELECT COUNT(*) FROM plan_table WHERE statement_id = 'turunan' AND operation LIKE 'PARTITION%' AND options = 'SINGLE') >= 1 THEN 'LULUS: rencana memangkas ke satu partisi' ELSE 'GAGAL: rencana memangkas ke satu partisi' END AS cek FROM dual;
