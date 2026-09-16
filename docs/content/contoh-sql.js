// contoh-sql.js — contoh siap jalan untuk Terminal SQL Live. Data murni: diuji di
// tests/terminal.test.js agar setiap contoh benar-benar berjalan seperti yang dijanjikan.
// `galat` berisi kode galat yang MEMANG diharapkan muncul (contoh kesalahan yang disengaja).

export const CONTOH = [
  // ------------------------------------------------------------ Praktikum 2
  { kel: 'Praktikum 2 — SQL & DML rumah sakit', db: 'rumahsakit', judul: 'SELECT bersyarat', sql: "SELECT nama_pasien, penyakit FROM pasien WHERE jenis_kelamin = 'P';" },
  { kel: 'Praktikum 2 — SQL & DML rumah sakit', db: 'rumahsakit', judul: 'Join tiga tabel', sql: 'SELECT p.nama_pasien, d.nama_dokter, pd.resep\n  FROM pasien p\n  JOIN pasien_dokter pd ON p.id_pasien = pd.id_pasien\n  JOIN dokter d ON pd.id_dokter = d.id_dokter\n ORDER BY pd.waktu_periksa;' },
  { kel: 'Praktikum 2 — SQL & DML rumah sakit', db: 'rumahsakit', judul: 'Fungsi matematika & string', sql: 'SELECT UPPER(nama_pasien) AS nama, LENGTH(nama_pasien) AS panjang,\n       ROUND(AVG(pd.biaya), 0) AS rata_biaya\n  FROM pasien p JOIN pasien_dokter pd ON p.id_pasien = pd.id_pasien\n GROUP BY nama_pasien\n ORDER BY rata_biaya DESC;' },
  { kel: 'Praktikum 2 — SQL & DML rumah sakit', db: 'rumahsakit', judul: 'BETWEEN & LIKE', sql: "SELECT * FROM pasien_dokter WHERE biaya BETWEEN 200000 AND 400000;\nSELECT * FROM dokter WHERE nama_dokter LIKE 'dr. A%';" },
  { kel: 'Praktikum 2 — SQL & DML rumah sakit', db: 'rumahsakit', judul: 'INSERT pasien baru', sql: "INSERT INTO pasien (id_pasien, nama_pasien, alamat_pasien, jenis_kelamin, penyakit, no_hp, kota)\nVALUES (13, 'Tegar Pratama', 'Jl. Kelapa 4', 'L', 'Tifus', '081234567013', 'Jakarta');\nSELECT * FROM pasien WHERE id_pasien = 13;" },
  { kel: 'Praktikum 2 — SQL & DML rumah sakit', db: 'rumahsakit', judul: 'UPDATE dengan subquery', sql: "UPDATE pasien_dokter SET biaya = biaya * 1.1\n WHERE id_dokter IN (SELECT id_dokter FROM dokter WHERE spesialis = 'Jantung');\nSELECT id, biaya FROM pasien_dokter WHERE id_dokter = 5;" },
  { kel: 'Praktikum 2 — SQL & DML rumah sakit', db: 'rumahsakit', judul: 'DELETE + ON DELETE CASCADE', sql: 'DELETE FROM pasien WHERE id_pasien = 9;\nSELECT COUNT(*) AS sisa_periksa FROM pasien_dokter WHERE id_pasien = 9;\nROLLBACK;' },
  { kel: 'Praktikum 2 — SQL & DML rumah sakit', db: 'rumahsakit', judul: 'ON UPDATE CASCADE', sql: 'UPDATE dokter SET id_dokter = 16 WHERE id_dokter = 6;\nSELECT id, id_dokter FROM pasien_dokter WHERE id_dokter = 16;\nROLLBACK;' },
  { kel: 'Praktikum 2 — SQL & DML rumah sakit', db: 'rumahsakit', judul: 'Pelanggaran kendala (sengaja)', galat: ['ORA-00001', 'ORA-02290', 'ORA-02291'], sql: "INSERT INTO pasien (id_pasien, nama_pasien, jenis_kelamin) VALUES (1, 'Duplikat', 'L');\nINSERT INTO pasien (id_pasien, nama_pasien, jenis_kelamin) VALUES (30, 'Salah', 'X');\nINSERT INTO pasien_dokter (id, id_dokter, id_pasien) VALUES (99, 42, 1);" },

  // ------------------------------------------------------------ Praktikum 3–5
  { kel: 'Praktikum 3–5 — akademik', db: 'akademik', judul: 'Agregasi lengkap', sql: 'SELECT COUNT(*) AS jumlah, SUM(sks) AS total, AVG(sks) AS rata,\n       MIN(sks) AS minimum, MAX(sks) AS maksimum\n  FROM matakuliah;' },
  { kel: 'Praktikum 3–5 — akademik', db: 'akademik', judul: 'LIKE dan AND', sql: "SELECT * FROM matakuliah WHERE nama_kul LIKE '%Informatika%' AND sks = 3;" },
  { kel: 'Praktikum 3–5 — akademik', db: 'akademik', judul: 'Tiga tabel urut nilai', sql: 'SELECT k.nama_kul, m.nama_mhs, n.nilai\n  FROM mhs m, nilai n, mata_kuliah k\n WHERE m.nim = n.nim AND n.kode_kul = k.kode_kul\n ORDER BY n.nilai ASC;' },
  { kel: 'Praktikum 3–5 — akademik', db: 'akademik', judul: 'LEFT / RIGHT / FULL JOIN', sql: 'SELECT m.nama_mhs, n.nilai FROM mhs m LEFT JOIN nilai n ON m.nim = n.nim;\nSELECT m.nama_mhs, n.nilai FROM mhs m RIGHT JOIN nilai n ON m.nim = n.nim;\nSELECT m.nama_mhs, n.nilai FROM mhs m FULL OUTER JOIN nilai n ON m.nim = n.nim;' },
  { kel: 'Praktikum 3–5 — akademik', db: 'akademik', judul: 'UNION', sql: "SELECT nama_mhs AS nama FROM mhs WHERE alamat_mhs = 'Bekasi'\nUNION\nSELECT nama_kul FROM mata_kuliah WHERE sks = 2;" },
  { kel: 'Praktikum 3–5 — akademik', db: 'akademik', judul: 'Mahasiswa tanpa nilai', sql: 'SELECT m.nama_mhs FROM mhs m LEFT JOIN nilai n ON m.nim = n.nim WHERE n.nilai IS NULL;' },

  // ------------------------------------------------------------ SQL lanjutan
  { kel: 'SQL lanjutan', db: 'akademik', judul: 'CASE WHEN', sql: "SELECT m.nama_mhs, n.nilai,\n       CASE WHEN n.nilai >= 85 THEN 'A' WHEN n.nilai >= 70 THEN 'B' ELSE 'C' END AS huruf\n  FROM mhs m JOIN nilai n ON m.nim = n.nim\n ORDER BY n.nilai DESC;" },
  { kel: 'SQL lanjutan', db: 'akademik', judul: 'EXISTS berkorelasi', sql: 'SELECT m.nama_mhs FROM mhs m\n WHERE NOT EXISTS (SELECT 1 FROM nilai n WHERE n.nim = m.nim);' },
  { kel: 'SQL lanjutan', db: 'akademik', judul: 'WITH (CTE)', sql: 'WITH rata AS (SELECT nim, AVG(nilai) AS r FROM nilai GROUP BY nim)\nSELECT m.nama_mhs, rata.r\n  FROM mhs m JOIN rata ON m.nim = rata.nim\n ORDER BY rata.r DESC;' },
  { kel: 'SQL lanjutan', db: 'akademik', judul: 'INTERSECT & MINUS', sql: 'SELECT nim FROM mhs INTERSECT SELECT nim FROM nilai;\nSELECT nim FROM mhs MINUS SELECT nim FROM nilai;' },
  { kel: 'SQL lanjutan', db: 'rumahsakit', judul: 'FETCH FIRST (top-N Oracle)', sql: 'SELECT nama_pasien, biaya\n  FROM pasien p JOIN pasien_dokter pd ON p.id_pasien = pd.id_pasien\n ORDER BY biaya DESC\n FETCH FIRST 3 ROWS ONLY;' },
  { kel: 'SQL lanjutan', db: 'rumahsakit', judul: 'Subquery skalar berkorelasi', sql: 'SELECT d.nama_dokter,\n       (SELECT COUNT(*) FROM pasien_dokter pd WHERE pd.id_dokter = d.id_dokter) AS jumlah_periksa\n  FROM dokter d\n ORDER BY jumlah_periksa DESC;' },

  // ------------------------------------------------------------ DDL & transaksi
  { kel: 'DDL, kendala & transaksi', db: 'kosong', judul: 'Buat skema sendiri', sql: "CREATE TABLE kategori (\n  id NUMBER(3) PRIMARY KEY,\n  nama VARCHAR2(30) NOT NULL UNIQUE\n);\nCREATE TABLE produk (\n  kode VARCHAR2(6) PRIMARY KEY,\n  nama VARCHAR2(40) NOT NULL,\n  harga NUMBER(10,2) CHECK (harga > 0),\n  stok NUMBER(5) DEFAULT 0,\n  id_kategori NUMBER(3) REFERENCES kategori(id) ON DELETE SET NULL\n);\nINSERT INTO kategori VALUES (1, 'Alat tulis');\nINSERT INTO produk (kode, nama, harga, id_kategori) VALUES ('P001', 'Pena gel', 4500, 1);\nSELECT * FROM produk;\nDESC produk;" },
  { kel: 'DDL, kendala & transaksi', db: 'rumahsakit', judul: 'SAVEPOINT & ROLLBACK TO', sql: "DELETE FROM daftar WHERE id_daftar = 1;\nSAVEPOINT sebelum_hapus_massal;\nDELETE FROM daftar;\nSELECT COUNT(*) FROM daftar;\nROLLBACK TO sebelum_hapus_massal;\nSELECT COUNT(*) FROM daftar;\n\\status" },
  { kel: 'DDL, kendala & transaksi', db: 'rumahsakit', judul: 'View & kamus data', sql: 'CREATE VIEW v_biaya_dokter AS\n  SELECT d.nama_dokter, SUM(pd.biaya) AS total\n    FROM dokter d JOIN pasien_dokter pd ON d.id_dokter = pd.id_dokter\n   GROUP BY d.nama_dokter;\nSELECT * FROM v_biaya_dokter ORDER BY total DESC;\nSELECT view_name, text FROM user_views;\nSELECT constraint_name, constraint_type, table_name FROM user_constraints;' },
  { kel: 'DDL, kendala & transaksi', db: 'rumahsakit', judul: 'EXPLAIN PLAN', sql: "EXPLAIN PLAN FOR\nSELECT p.kota, COUNT(*) AS periksa\n  FROM pasien p JOIN pasien_dokter pd ON p.id_pasien = pd.id_pasien\n WHERE pd.biaya > 200000\n GROUP BY p.kota;" },

  // ------------------------------------------------------------ terdistribusi
  { kel: 'Basis data terdistribusi — 3 situs', db: 'terdistribusi', judul: 'Transparansi lokasi (view global)', sql: 'SELECT kota, COUNT(*) AS pasien FROM pasien GROUP BY kota;\n\\d' },
  { kel: 'Basis data terdistribusi — 3 situs', db: 'terdistribusi', judul: 'Fragmen lewat database link', sql: 'SELECT * FROM pasien@bandung;\nSELECT * FROM pasien_dokter@surabaya;' },
  { kel: 'Basis data terdistribusi — 3 situs', db: 'terdistribusi', judul: 'Join lintas situs + EXPLAIN', sql: 'EXPLAIN PLAN FOR\nSELECT p.nama_pasien, d.nama_dokter\n  FROM pasien@jakarta p\n  JOIN pasien_dokter@jakarta pd ON p.id_pasien = pd.id_pasien\n  JOIN dokter d ON pd.id_dokter = d.id_dokter;' },
  { kel: 'Basis data terdistribusi — 3 situs', db: 'terdistribusi', judul: 'CHECK menjaga predikat fragmen', galat: ['ORA-02290'], sql: "INSERT INTO pasien@bandung (id_pasien, nama_pasien, jenis_kelamin, kota)\nVALUES (20, 'Salah situs', 'L', 'Jakarta');" },
  { kel: 'Basis data terdistribusi — 3 situs', db: 'terdistribusi', judul: 'PK ganda lintas situs', sql: "INSERT INTO pasien@bandung (id_pasien, nama_pasien, jenis_kelamin, kota)\nVALUES (1, 'Kembar id', 'P', 'Bandung');\nSELECT id_pasien, COUNT(*) AS muncul FROM pasien GROUP BY id_pasien HAVING COUNT(*) > 1;" },
  { kel: 'Basis data terdistribusi — 3 situs', db: 'terdistribusi', judul: 'COMMIT lintas situs = 2PC', sql: "UPDATE pasien@jakarta SET penyakit = 'Sembuh' WHERE id_pasien = 1;\nUPDATE pasien@surabaya SET penyakit = 'Sembuh' WHERE id_pasien = 5;\nCOMMIT;" },
  { kel: 'Basis data terdistribusi — 3 situs', db: 'terdistribusi', judul: 'Satu situs VOTE-ABORT', galat: ['ORA-02091'], sql: "\\gagal surabaya\nDELETE FROM daftar@jakarta WHERE id_daftar = 1;\nDELETE FROM daftar@surabaya WHERE id_daftar = 9;\nCOMMIT;\nSELECT COUNT(*) FROM daftar;" },
  { kel: 'Basis data terdistribusi — 3 situs', db: 'terdistribusi', judul: 'Koordinator jatuh → in-doubt', galat: ['ORA-02054'], sql: "\\gagal koordinator\nDELETE FROM daftar@jakarta WHERE id_daftar = 1;\nDELETE FROM daftar@bandung WHERE id_daftar = 5;\nCOMMIT;\nSELECT * FROM dba_2pc_pending;" },

  // ------------------------------------------------------------ studi kasus
  { kel: 'Studi kasus', db: 'dreamhome', judul: 'DreamHome: fragmen S1 (Manager)', sql: "SELECT staffno, fname, lname, salary FROM STAFF WHERE position = 'Manager';" },
  { kel: 'Studi kasus', db: 'dreamhome', judul: 'DreamHome: properti per cabang', sql: 'SELECT b.city, COUNT(*) AS properti, AVG(p.rent) AS sewa_rata\n  FROM BRANCH b JOIN PROPERTY p ON b.branchno = p.branchno\n GROUP BY b.city\n ORDER BY properti DESC;' },
  { kel: 'Studi kasus', db: 'kependudukan', judul: 'Kependudukan: NIK ganda antar desa', sql: 'SELECT nik, COUNT(*) AS muncul, COUNT(DISTINCT nama) AS versi_nama\n  FROM penduduk_semua\n GROUP BY nik\nHAVING COUNT(*) > 1;' },
  { kel: 'Studi kasus', db: 'kependudukan', judul: 'Kependudukan: sudah wafat tapi masih tercatat', sql: 'SELECT p.nik, p.nama, p.desa, k.tgl_wafat\n  FROM penduduk_semua p JOIN KEMATIAN k ON p.nik = k.nik;' },

  // ------------------------------------------------------------ kesalahan
  { kel: 'Kesalahan yang disengaja', db: 'akademik', judul: 'Kolom ambigu', galat: ['ambigu'], sql: 'SELECT nim FROM mhs m JOIN nilai n ON m.nim = n.nim;' },
  { kel: 'Kesalahan yang disengaja', db: 'akademik', judul: 'Salah ketik nama', galat: ['tidak ada'], sql: 'SELECT nama_mahasiswa FROM mahasiswa;' },
  { kel: 'Kesalahan yang disengaja', db: 'akademik', judul: 'GROUP BY tidak lengkap', galat: ['ORA-00979'], sql: 'SELECT alamat_mhs, nama_mhs, COUNT(*) FROM mhs GROUP BY alamat_mhs;' },
];
