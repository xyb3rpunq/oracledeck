// coba-materi.js — kueri "Coba di terminal" untuk setiap topik kuliah.
// Setiap blok dirender di halaman materi dengan tombol ▶ Jalankan dan diuji di
// tests/terminal.test.js: yang tidak punya `galat` wajib berjalan tanpa galat,
// yang punya `galat` wajib memunculkan kode galat itu (peragaan kegagalan yang disengaja).

export const COBA_MATERI = {
  1: [
    { judul: 'Satu tabel logis, tiga lokasi fisik', db: 'terdistribusi', ket: 'Pengguna menulis kueri ke view global pasien; datanya sebenarnya tersebar di tiga situs.', sql: "SELECT kota, COUNT(*) AS pasien FROM pasien GROUP BY kota;\nSELECT COUNT(*) AS di_bandung_saja FROM pasien@bandung;" },
    { judul: 'Keandalan: situs lain tetap melayani', db: 'terdistribusi', ket: 'Kueri yang hanya menyentuh fragmen Jakarta tidak bergantung pada Bandung dan Surabaya.', sql: 'EXPLAIN PLAN FOR\nSELECT nama_pasien FROM pasien@jakarta;' },
  ],
  2: [
    { judul: 'Biaya jaringan terlihat di rencana', db: 'terdistribusi', ket: 'Setiap operator REMOTE berarti data menyeberang WAN — sumber latensi yang dibahas pada topik jaringan.', sql: "EXPLAIN PLAN FOR\nSELECT p.nama_pasien, pd.resep\n  FROM pasien@surabaya p\n  JOIN pasien_dokter@surabaya pd ON p.id_pasien = pd.id_pasien;" },
    { judul: 'Berapa baris yang harus dikirim?', db: 'terdistribusi', ket: 'Bandingkan ringkasan akses: baris lokal gratis, baris remote dibayar dengan bandwidth.', sql: '\\c jakarta\nSELECT * FROM dokter;' },
  ],
  3: [
    { judul: 'Skema eksternal = view', db: 'rumahsakit', ket: 'Lapisan eksternal ANSI/SPARC: pengguna bagian keuangan hanya melihat ringkasan biaya.', sql: 'CREATE VIEW v_keuangan AS\n  SELECT d.spesialis, SUM(pd.biaya) AS pendapatan\n    FROM dokter d JOIN pasien_dokter pd ON d.id_dokter = pd.id_dokter\n   GROUP BY d.spesialis;\nSELECT * FROM v_keuangan ORDER BY pendapatan DESC;' },
    { judul: 'Skema konseptual di kamus data', db: 'rumahsakit', ket: 'Katalog sistem menyimpan definisi tabel, kolom, dan kendala — lapisan konseptual.', sql: "SELECT table_name, column_name, data_type, nullable\n  FROM user_tab_columns\n WHERE table_name = 'PASIEN_DOKTER';" },
  ],
  4: [
    { judul: 'Rancangan global dulu (top-down)', db: 'kosong', ket: 'Pendekatan top-down: skema global disusun lengkap dengan kunci sebelum dipecah dan dialokasikan.', sql: "CREATE TABLE cabang (\n  kode VARCHAR2(4) PRIMARY KEY,\n  kota VARCHAR2(30) NOT NULL\n);\nCREATE TABLE pegawai (\n  nip NUMBER(6) PRIMARY KEY,\n  nama VARCHAR2(50) NOT NULL,\n  kode_cabang VARCHAR2(4) NOT NULL REFERENCES cabang(kode)\n);\nINSERT INTO cabang VALUES ('JKT', 'Jakarta');\nINSERT INTO pegawai VALUES (1, 'Sari', 'JKT');\nDESC pegawai;" },
    { judul: 'Informasi aplikasi: kueri mana yang sering?', db: 'rumahsakit', ket: 'Frekuensi akses per kota adalah masukan predikat minterm dan keputusan alokasi.', sql: 'SELECT p.kota, COUNT(*) AS akses_pemeriksaan\n  FROM pasien p JOIN pasien_dokter pd ON p.id_pasien = pd.id_pasien\n GROUP BY p.kota\n ORDER BY akses_pemeriksaan DESC;' },
  ],
  5: [
    { judul: 'Kelengkapan: gabungan fragmen = relasi global', db: 'terdistribusi', ket: 'Aturan kelengkapan dan rekonstruksi: UNION ALL ketiga fragmen harus sama dengan pasien.', sql: 'SELECT COUNT(*) AS global FROM pasien;\nSELECT COUNT(*) AS jumlah_fragmen FROM (\n  SELECT id_pasien FROM pasien@jakarta\n  UNION ALL SELECT id_pasien FROM pasien@bandung\n  UNION ALL SELECT id_pasien FROM pasien@surabaya\n) f;' },
    { judul: 'Kedisjoinan: tidak ada pasien di dua fragmen', db: 'terdistribusi', ket: 'Irisan antarfragmen horizontal harus kosong.', sql: 'SELECT id_pasien FROM pasien@jakarta\nINTERSECT\nSELECT id_pasien FROM pasien@bandung;' },
    { judul: 'Fragmentasi vertikal lewat CREATE TABLE AS', db: 'rumahsakit', ket: 'Kunci primer disalin ke setiap fragmen vertikal agar join rekonstruksinya lossless.', sql: 'CREATE TABLE pasien_v1 AS SELECT id_pasien, nama_pasien, kota FROM pasien;\nCREATE TABLE pasien_v2 AS SELECT id_pasien, penyakit, no_hp FROM pasien;\nSELECT COUNT(*) AS hasil_join FROM pasien_v1 a JOIN pasien_v2 b ON a.id_pasien = b.id_pasien;' },
  ],
  6: [
    { judul: 'Tingkat transparansi lokasi', db: 'terdistribusi', ket: 'Tanpa @: pengguna tidak tahu lokasi. Dengan @bandung: pengguna harus tahu fragmen dan situsnya.', sql: "SELECT nama_pasien FROM pasien WHERE kota = 'Bandung';\nSELECT nama_pasien FROM pasien@bandung;" },
    { judul: 'Transparansi transaksi: satu COMMIT, dua situs', db: 'terdistribusi', ket: 'Pengguna cukup COMMIT; sistem menjalankan two-phase commit di belakang layar.', sql: "UPDATE dokter@jakarta SET waktu_kerja = 'Senin-Jumat' WHERE id_dokter = 1;\nUPDATE dokter@bandung SET waktu_kerja = 'Senin-Jumat' WHERE id_dokter = 3;\nCOMMIT;" },
  ],
  7: [
    { judul: 'Independensi data logis', db: 'rumahsakit', ket: 'Tabel dasar berubah (tabel baru ditambah), aplikasi yang memakai view lama tidak perlu diubah.', sql: 'CREATE VIEW v_pasien_ringkas AS SELECT id_pasien, nama_pasien, kota FROM pasien;\nCREATE TABLE catatan_alergi (id_pasien NUMBER(8) REFERENCES pasien, alergi VARCHAR2(60));\nSELECT * FROM v_pasien_ringkas FETCH FIRST 3 ROWS ONLY;' },
    { judul: 'Independensi fisik: indeks tidak mengubah hasil', db: 'rumahsakit', ket: 'Menambah struktur penyimpanan hanya mengubah jalur akses.', sql: "SELECT COUNT(*) FROM pasien_dokter WHERE id_dokter = 3;\nCREATE INDEX ix_pd_dokter ON pasien_dokter (id_dokter);\nSELECT COUNT(*) FROM pasien_dokter WHERE id_dokter = 3;" },
  ],
  8: [
    { judul: 'Aturan otonomi lokal', db: 'terdistribusi', ket: 'Setiap situs menegakkan kendalanya sendiri: CHECK fragmen Bandung menolak pasien kota lain.', galat: ['ORA-02290'], sql: "INSERT INTO pasien@bandung (id_pasien, nama_pasien, jenis_kelamin, kota)\nVALUES (40, 'Salah tempat', 'P', 'Surabaya');" },
    { judul: 'Tidak bergantung pada situs pusat', db: 'terdistribusi', ket: 'Setiap fragmen tercatat di tablespace situsnya sendiri (TS_JAKARTA, TS_BANDUNG, TS_SURABAYA) — tidak ada katalog pusat yang wajib hidup.', sql: '\\c surabaya\nSELECT table_name, num_rows, tablespace_name FROM user_tables;' },
  ],
  9: [
    { judul: 'Atomisitas: SAVEPOINT dan ROLLBACK', db: 'rumahsakit', ket: 'Sebagian transaksi dibatalkan, sisanya tetap tertunda sampai COMMIT.', sql: "UPDATE pasien SET kota = 'Depok' WHERE id_pasien = 1;\nSAVEPOINT s1;\nDELETE FROM pasien_dokter;\nROLLBACK TO s1;\nSELECT COUNT(*) AS periksa_utuh FROM pasien_dokter;\n\\status" },
    { judul: 'Agent per situs', db: 'terdistribusi', ket: 'Satu transaksi global menulis ke dua situs; lihat status: situs yang ditulis = agent yang terlibat.', sql: "DELETE FROM daftar@jakarta WHERE id_daftar = 2;\nDELETE FROM daftar@surabaya WHERE id_daftar = 10;\n\\status" },
  ],
  10: [
    { judul: 'Pembaruan hilang dicegah oleh kendala', db: 'akademik', ket: 'Dua pembaruan beruntun pada nilai yang sama: tanpa penguncian, yang pertama bisa hilang. Di sini CHECK juga mencegah nilai di luar 0–100.', galat: ['ORA-02290'], sql: "UPDATE nilai SET nilai = nilai + 10 WHERE nim = '11010013' AND kode_kul = 'IT0401';\nSELECT nilai FROM nilai WHERE nim = '11010013' AND kode_kul = 'IT0401';" },
    { judul: 'Isolasi: perubahan belum COMMIT', db: 'rumahsakit', ket: 'Sesi ini melihat perubahannya sendiri; sesi lain baru melihatnya setelah COMMIT.', sql: "UPDATE pasien SET penyakit = 'Sembuh' WHERE id_pasien = 2;\nSELECT penyakit FROM pasien WHERE id_pasien = 2;\n\\status\nROLLBACK;" },
  ],
  11: [
    { judul: 'Kunci yang ditahan transaksi ragu-ragu', db: 'terdistribusi', ket: 'Koordinator jatuh setelah PREPARE: peserta menahan kunci, perintah lain ke situs itu ditolak ORA-01591 — sumber tunggu yang mirip deadlock.', galat: ['ORA-02054', 'ORA-01591'], sql: "\\gagal koordinator\nDELETE FROM daftar@jakarta WHERE id_daftar = 1;\nDELETE FROM daftar@bandung WHERE id_daftar = 5;\nCOMMIT;\nDELETE FROM daftar@bandung WHERE id_daftar = 6;" },
    { judul: 'Graf tunggu dari data transaksi', db: 'kosong', ket: 'Deteksi deadlock terpusat menyimpan sisi Ti → Tj; siklus dicari dengan join berulang.', sql: "CREATE TABLE tunggu (menunggu VARCHAR2(3), ditunggu VARCHAR2(3), situs VARCHAR2(10));\nINSERT INTO tunggu VALUES ('T1', 'T2', 'S1'), ('T2', 'T3', 'S2'), ('T3', 'T1', 'S1');\nSELECT a.menunggu, a.ditunggu, b.ditunggu AS lalu, c.ditunggu AS kembali_ke\n  FROM tunggu a JOIN tunggu b ON a.ditunggu = b.menunggu\n  JOIN tunggu c ON b.ditunggu = c.menunggu\n WHERE c.ditunggu = a.menunggu;" },
  ],
  12: [
    { judul: 'Two-phase commit sukses', db: 'terdistribusi', ket: 'Dua situs ditulis, COMMIT memicu PREPARE → VOTE → GLOBAL-COMMIT.', sql: "UPDATE pasien@jakarta SET no_hp = '081200000001' WHERE id_pasien = 1;\nUPDATE pasien@bandung SET no_hp = '081200000003' WHERE id_pasien = 3;\nCOMMIT;" },
    { judul: 'Satu situs VOTE-ABORT', db: 'terdistribusi', ket: 'Kegagalan satu peserta membatalkan transaksi di semua situs.', galat: ['ORA-02091'], sql: "\\gagal bandung\nUPDATE pasien@jakarta SET penyakit = 'X' WHERE id_pasien = 1;\nUPDATE pasien@bandung SET penyakit = 'X' WHERE id_pasien = 3;\nCOMMIT;" },
    { judul: 'DBA_2PC_PENDING dan COMMIT FORCE', db: 'terdistribusi', ket: 'Transaksi ragu-ragu diselesaikan manual oleh DBA, persis seperti di Oracle.', galat: ['ORA-02054'], sql: "\\gagal koordinator\nDELETE FROM daftar@jakarta WHERE id_daftar = 1;\nDELETE FROM daftar@surabaya WHERE id_daftar = 9;\nCOMMIT;\nSELECT local_tran_id, state FROM dba_2pc_pending;" },
  ],
  13: [
    { judul: 'Pemulihan ke titik konsisten', db: 'rumahsakit', ket: 'ROLLBACK mengembalikan basis data ke COMMIT terakhir — dasar pemulihan transaksi.', sql: "DELETE FROM pasien_dokter WHERE biaya < 300000;\nSELECT COUNT(*) AS setelah_hapus FROM pasien_dokter;\nROLLBACK;\nSELECT COUNT(*) AS setelah_pulih FROM pasien_dokter;" },
    { judul: 'RPO: data yang belum COMMIT hilang', db: 'rumahsakit', ket: 'Perubahan yang belum di-COMMIT tidak ikut dipulihkan; \\reset meniru crash sebelum COMMIT.', sql: "INSERT INTO administrator VALUES (5, 'Baru', 'Pagi', 'Jakarta');\n\\reset\nSELECT COUNT(*) AS admin FROM administrator;" },
  ],
  14: [
    { judul: 'Rencana eksekusi sebuah join', db: 'rumahsakit', ket: 'Lapisan optimasi: urutan SCAN, JOIN, FILTER, AGGREGATE, SORT.', sql: "EXPLAIN PLAN FOR\nSELECT d.spesialis, COUNT(*) AS n\n  FROM dokter d JOIN pasien_dokter pd ON d.id_dokter = pd.id_dokter\n WHERE pd.biaya > 250000\n GROUP BY d.spesialis\n ORDER BY n DESC;" },
    { judul: 'Reduksi lokalisasi', db: 'terdistribusi', ket: 'Predikat kota = Bandung hanya cocok dengan satu fragmen; dua fragmen lain bisa dilewati.', sql: "SELECT nama_pasien FROM pasien WHERE kota = 'Bandung';\nSELECT nama_pasien FROM pasien@bandung;" },
    { judul: 'Semijoin: kirim kunci, bukan tabel', db: 'terdistribusi', ket: 'Hanya id pasien yang dikirim ke situs lain untuk menyaring baris yang berpasangan.', sql: 'SELECT pd.id, pd.resep\n  FROM pasien_dokter@bandung pd\n WHERE pd.id_pasien IN (SELECT id_pasien FROM pasien@bandung);' },
  ],
};
