// kasus-galat-oracle.js — perintah yang SENGAJA salah, dijalankan di dua tempat:
//   1. Terminal SQL ORACLEDECK (tests/terminal.test.js)
//   2. Oracle sungguhan di container (tools/verifikasi_oracle.mjs)
// Keduanya wajib menghasilkan kode galat yang sama. Setiap kasus dimulai dari skema kosong;
// nama tabel diberi awalan unik agar semua kasus bisa berjalan dalam satu sesi Oracle.
// Tanggal memakai format YYYY-MM-DD (sesi Oracle diset NLS_DATE_FORMAT = 'YYYY-MM-DD').

export const KASUS_GALAT = [
  { id: 'pk-ganda', kode: 'ORA-00001', arti: 'nilai PRIMARY KEY sudah dipakai', persiapan: ['CREATE TABLE g01 (id NUMBER(4) PRIMARY KEY)', 'INSERT INTO g01 VALUES (1)'], perintah: 'INSERT INTO g01 VALUES (1)' },
  { id: 'unique-ganda', kode: 'ORA-00001', arti: 'nilai UNIQUE sudah dipakai', persiapan: ['CREATE TABLE g02 (id NUMBER(4) PRIMARY KEY, kode VARCHAR2(10) UNIQUE)', "INSERT INTO g02 VALUES (1, 'A1')"], perintah: "INSERT INTO g02 VALUES (2, 'A1')" },
  { id: 'not-null', kode: 'ORA-01400', arti: 'kolom NOT NULL tidak diisi', persiapan: ['CREATE TABLE g03 (id NUMBER(4) PRIMARY KEY, nama VARCHAR2(10) NOT NULL)'], perintah: 'INSERT INTO g03 (id) VALUES (1)' },
  { id: 'terlalu-panjang', kode: 'ORA-12899', arti: 'teks melebihi panjang VARCHAR2', persiapan: ['CREATE TABLE g04 (nama VARCHAR2(3))'], perintah: "INSERT INTO g04 VALUES ('abcd')" },
  { id: 'presisi', kode: 'ORA-01438', arti: 'angka melebihi presisi NUMBER(p,s)', persiapan: ['CREATE TABLE g05 (n NUMBER(3,1))'], perintah: 'INSERT INTO g05 VALUES (1234)' },
  { id: 'bukan-angka', kode: 'ORA-01722', arti: 'teks dimasukkan ke kolom NUMBER', persiapan: ['CREATE TABLE g06 (n NUMBER(5))'], perintah: "INSERT INTO g06 VALUES ('abc')" },
  { id: 'check', kode: 'ORA-02290', arti: 'kendala CHECK dilanggar', persiapan: ["CREATE TABLE g07 (jk CHAR(1) CHECK (jk IN ('L', 'P')))"], perintah: "INSERT INTO g07 VALUES ('X')" },
  { id: 'fk-induk-hilang', kode: 'ORA-02291', arti: 'nilai FOREIGN KEY tidak ada di tabel induk', persiapan: ['CREATE TABLE g08a (id NUMBER(4) PRIMARY KEY)', 'CREATE TABLE g08b (id NUMBER(4) PRIMARY KEY, induk NUMBER(4) REFERENCES g08a)'], perintah: 'INSERT INTO g08b VALUES (1, 9)' },
  { id: 'fk-anak-ada', kode: 'ORA-02292', arti: 'baris induk masih dirujuk (tanpa CASCADE)', persiapan: ['CREATE TABLE g09a (id NUMBER(4) PRIMARY KEY)', 'CREATE TABLE g09b (id NUMBER(4) PRIMARY KEY, induk NUMBER(4) REFERENCES g09a)', 'INSERT INTO g09a VALUES (1)', 'INSERT INTO g09b VALUES (1, 1)'], perintah: 'DELETE FROM g09a' },
  { id: 'tabel-tidak-ada', kode: 'ORA-00942', arti: 'tabel atau view tidak ada', persiapan: [], perintah: 'SELECT * FROM g10_tidak_ada' },
  { id: 'kolom-tidak-ada', kode: 'ORA-00904', arti: 'kolom tidak dikenal', persiapan: ['CREATE TABLE g11 (a NUMBER(4))'], perintah: 'SELECT b FROM g11' },
  { id: 'kolom-ambigu', kode: 'ORA-00918', arti: 'nama kolom ada di dua tabel yang di-join', persiapan: ['CREATE TABLE g12a (id NUMBER(4))', 'CREATE TABLE g12b (id NUMBER(4))'], perintah: 'SELECT id FROM g12a JOIN g12b ON g12a.id = g12b.id' },
  { id: 'nama-dipakai', kode: 'ORA-00955', arti: 'nama objek sudah dipakai', persiapan: ['CREATE TABLE g13 (a NUMBER(4))'], perintah: 'CREATE TABLE g13 (b NUMBER(4))' },
  { id: 'kolom-ganda', kode: 'ORA-00957', arti: 'nama kolom ganda', persiapan: [], perintah: 'CREATE TABLE g14 (a NUMBER(4), a NUMBER(4))' },
  { id: 'drop-induk', kode: 'ORA-02449', arti: 'tabel induk masih dirujuk kunci asing', persiapan: ['CREATE TABLE g15a (id NUMBER(4) PRIMARY KEY)', 'CREATE TABLE g15b (induk NUMBER(4) REFERENCES g15a)'], perintah: 'DROP TABLE g15a' },
  { id: 'truncate-induk', kode: 'ORA-02266', arti: 'TRUNCATE tabel induk yang anaknya masih berisi baris', persiapan: ['CREATE TABLE g16a (id NUMBER(4) PRIMARY KEY)', 'CREATE TABLE g16b (induk NUMBER(4) REFERENCES g16a)', 'INSERT INTO g16a VALUES (1)', 'INSERT INTO g16b VALUES (1)'], perintah: 'TRUNCATE TABLE g16a' },
  { id: 'group-by', kode: 'ORA-00979', arti: 'kolom SELECT tidak ikut GROUP BY', persiapan: ['CREATE TABLE g17 (a NUMBER(4), b NUMBER(4))'], perintah: 'SELECT a, b FROM g17 GROUP BY a' },
  { id: 'single-group', kode: 'ORA-00937', arti: 'kolom biasa bercampur fungsi agregat tanpa GROUP BY', persiapan: ['CREATE TABLE g18 (a NUMBER(4))'], perintah: 'SELECT a, COUNT(*) FROM g18' },
  { id: 'agregat-di-where', kode: 'ORA-00934', arti: 'fungsi agregat di WHERE (seharusnya HAVING)', persiapan: ['CREATE TABLE g29 (a NUMBER(4))'], perintah: 'SELECT a FROM g29 WHERE COUNT(*) > 1' },
  { id: 'view-jumlah-kolom', kode: 'ORA-01730', arti: 'daftar nama kolom view tidak sama dengan kolom kueri', persiapan: ['CREATE TABLE g19 (a NUMBER(4))'], perintah: 'CREATE VIEW g19v (x, y) AS SELECT a FROM g19' },
  { id: 'unique-index-ganda', kode: 'ORA-01452', arti: 'UNIQUE INDEX pada data yang sudah ganda', persiapan: ['CREATE TABLE g20 (a NUMBER(4))', 'INSERT INTO g20 VALUES (1)', 'INSERT INTO g20 VALUES (1)'], perintah: 'CREATE UNIQUE INDEX g20i ON g20 (a)' },
  { id: 'dml-view-union', kode: 'ORA-01732', arti: 'DML pada view gabungan UNION ALL', persiapan: ['CREATE TABLE g21 (a NUMBER(4))', 'CREATE VIEW g21v AS SELECT a FROM g21 UNION ALL SELECT a FROM g21'], perintah: 'DELETE FROM g21v' },
  { id: 'fk-bukan-kunci', kode: 'ORA-02270', arti: 'kunci asing merujuk kolom yang bukan PRIMARY KEY/UNIQUE', persiapan: ['CREATE TABLE g22a (id NUMBER(4) PRIMARY KEY, nama VARCHAR2(10))'], perintah: 'CREATE TABLE g22b (x VARCHAR2(10) REFERENCES g22a (nama))' },
  { id: 'fk-induk-tanpa-pk', kode: 'ORA-02268', arti: 'tabel induk tidak punya PRIMARY KEY', persiapan: ['CREATE TABLE g23a (a NUMBER(4))'], perintah: 'CREATE TABLE g23b (x NUMBER(4) REFERENCES g23a)' },
  { id: 'fk-jumlah-kolom', kode: 'ORA-02256', arti: 'jumlah kolom kunci asing tidak sama dengan kunci induk', persiapan: ['CREATE TABLE g24a (a NUMBER(4), b NUMBER(4), PRIMARY KEY (a, b))'], perintah: 'CREATE TABLE g24b (x NUMBER(4), FOREIGN KEY (x) REFERENCES g24a (a, b))' },
  { id: 'varchar2-tanpa-panjang', kode: 'ORA-00906', arti: 'VARCHAR2 tanpa panjang', persiapan: [], perintah: 'CREATE TABLE g25 (a VARCHAR2)' },
  { id: 'check-kolom-menyebut-lain', kode: 'ORA-02438', arti: 'CHECK tingkat kolom menyebut kolom lain', persiapan: [], perintah: 'CREATE TABLE g26 (a NUMBER(4), b NUMBER(4) CHECK (a > 1))' },
  { id: 'check-tabel-kolom-asing', kode: 'ORA-00904', arti: 'CHECK tingkat tabel menyebut kolom yang tidak ada', persiapan: [], perintah: 'CREATE TABLE g26b (a NUMBER(4), CHECK (b > 1))' },
  { id: 'savepoint-tidak-ada', kode: 'ORA-01086', arti: 'ROLLBACK TO savepoint yang belum dibuat', persiapan: [], perintah: 'ROLLBACK TO SAVEPOINT g27_tidak_ada' },
  { id: 'indeks-tidak-ada', kode: 'ORA-01418', arti: 'DROP INDEX yang tidak ada', persiapan: [], perintah: 'DROP INDEX g28_tidak_ada' },
  { id: 'commit-force-salah', kode: 'ORA-02058', arti: 'COMMIT FORCE untuk ID transaksi yang tidak ragu-ragu', persiapan: [], perintah: "COMMIT FORCE '9.99.999'" },
  { id: 'fungsi-tidak-ada', kode: 'ORA-00904', arti: 'fungsi tidak dikenal', persiapan: [], perintah: 'SELECT fungsi_tidak_ada(1) FROM dual' },
  { id: 'tanggal-sisa-input', kode: 'ORA-01830', arti: 'tanggal gaya DD/MM/YYYY pada format YYYY-MM-DD: masih ada sisa input', persiapan: ['CREATE TABLE g30 (t DATE)'], perintah: "INSERT INTO g30 VALUES ('31/12/2025')" },
  { id: 'tanggal-bulan-salah', kode: 'ORA-01843', arti: 'bulan 13', persiapan: ['CREATE TABLE g32 (t DATE)'], perintah: "INSERT INTO g32 VALUES ('2025-13-01')" },
  { id: 'tanggal-hari-salah', kode: 'ORA-01847', arti: 'hari 32', persiapan: ['CREATE TABLE g33 (t DATE)'], perintah: "INSERT INTO g33 VALUES ('2025-01-32')" },
  { id: 'tanggal-tidak-ada', kode: 'ORA-01839', arti: '29 Februari pada tahun bukan kabisat', persiapan: ['CREATE TABLE g34 (t DATE)'], perintah: "INSERT INTO g34 VALUES ('2025-02-29')" },
  { id: 'tanggal-pendek', kode: 'ORA-01840', arti: 'tanggal tanpa hari', persiapan: ['CREATE TABLE g35 (t DATE)'], perintah: "INSERT INTO g35 VALUES ('2025-09')" },
  { id: 'tanggal-bukan-angka', kode: 'ORA-01841', arti: 'teks yang bukan tanggal', persiapan: ['CREATE TABLE g36 (t DATE)'], perintah: "INSERT INTO g36 VALUES ('kemarin')" },
  { id: 'desc-tidak-ada', kode: 'ORA-04043', arti: 'DESC objek yang tidak ada', persiapan: [], perintah: 'DESC g31_tidak_ada' },
];
