// gen_oracle.js — hasilkan seluruh skrip Oracle di folder oracle/ dari mesin
// yang sama yang dipakai situs. Dengan begitu skrip yang dijalankan mahasiswa
// di Oracle XE tidak akan pernah menyimpang dari rancangan yang ditampilkan lab.
//
// Jalankan: node tools/gen_oracle.js

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rumahsakit, RS_KEYS, DEFAULT_SITES, dreamhome } from '../engine/data/datasets.js';
import * as O from '../engine/oracle/emit.js';
import * as Fg from '../engine/ddb/fragment.js';
import * as T from '../engine/ddb/transparency.js';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'oracle');
mkdirSync(OUT, { recursive: true });

const db = rumahsakit();
const KOTA = DEFAULT_SITES.map((s) => s.kota);
const berkas = [];

// Lebar kolom ditetapkan untuk pemakaian sungguhan, bukan diterka dari 12 baris
// data contoh. Tipe terkaan hanya cocok untuk pratinjau di situs.
const TIPE = {
  id_pasien: 'NUMBER(8)', id_dokter: 'NUMBER(4)', id_admin: 'NUMBER(4)',
  id: 'NUMBER(8)', id_data: 'NUMBER(8)', id_daftar: 'NUMBER(8)',
  nama_pasien: 'VARCHAR2(60)', nama_dokter: 'VARCHAR2(60)', nama_admin: 'VARCHAR2(60)',
  alamat_pasien: 'VARCHAR2(150)', alamat_dokter: 'VARCHAR2(150)',
  jenis_kelamin: 'CHAR(1)', penyakit: 'VARCHAR2(100)',
  no_hp: 'VARCHAR2(20)', kota: 'VARCHAR2(40)',
  tanggal_lahir: 'DATE', waktu_periksa: 'DATE', tanggal_daftar: 'DATE',
  spesialis: 'VARCHAR2(40)', waktu_kerja: 'VARCHAR2(60)', waktu_jaga: 'VARCHAR2(30)',
  resep: 'VARCHAR2(150)', biaya: 'NUMBER(12,2)',
};

function tulis(nama, isi) {
  writeFileSync(join(OUT, nama), `${isi.trimEnd()}\n`, 'utf8');
  berkas.push(nama);
  process.stdout.write(`  ${nama}\n`);
}

const judul = (t, sub = '') => [
  '-- ' + '='.repeat(74),
  `-- ${t}`,
  sub ? `-- ${sub}` : null,
  '-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.',
  '-- ' + '='.repeat(74),
  '',
].filter((x) => x !== null).join('\n');

// --------------------------------------------------------------- 01 tablespace

tulis('01_tablespace_dan_user.sql', [
  judul('Langkah 1 - Wadah fisik: satu tablespace per situs',
    'Alokasi fragmen ke situs diwujudkan sebagai penempatan partisi ke tablespace.'),
  '-- Jalankan sebagai SYS atau pengguna dengan hak DBA.',
  '-- Pada Oracle XE 21c: sqlplus sys/oracle@//localhost:1521/XEPDB1 as sysdba',
  '',
  'ALTER SESSION SET CONTAINER = XEPDB1;',
  '',
  ...DEFAULT_SITES.map((s) => [
    `-- Situs ${s.id} - ${s.nama}`,
    `CREATE TABLESPACE TS_${s.id}`,
    `  DATAFILE '${s.id.toLowerCase()}_rs01.dbf' SIZE 100M AUTOEXTEND ON NEXT 10M MAXSIZE 2G`,
    '  EXTENT MANAGEMENT LOCAL SEGMENT SPACE MANAGEMENT AUTO;',
    '',
  ].join('\n')),
  '-- Pemilik skema aplikasi',
  'CREATE USER RS_APP IDENTIFIED BY "&sandi_rs_app"',
  `  DEFAULT TABLESPACE TS_${DEFAULT_SITES[0].id}`,
  '  QUOTA UNLIMITED ON ' + DEFAULT_SITES.map((s) => `TS_${s.id}`).join(' QUOTA UNLIMITED ON ') + ';',
  '',
  'GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE SYNONYM,',
  '      CREATE DATABASE LINK, CREATE MATERIALIZED VIEW TO RS_APP;',
  '',
  '-- Hak yang diperlukan untuk memeriksa transaksi terdistribusi:',
  'GRANT SELECT ON dba_2pc_pending TO RS_APP;',
  'GRANT SELECT ON dba_2pc_neighbors TO RS_APP;',
  'GRANT SELECT_CATALOG_ROLE TO RS_APP;',
  '',
  '-- Periksa hasilnya:',
  "SELECT tablespace_name, status, contents FROM dba_tablespaces WHERE tablespace_name LIKE 'TS_%';",
].join('\n'));

// ------------------------------------------------------------ 02 skema global

const tabelUrut = ['pasien', 'dokter', 'administrator', 'pasien_dokter', 'dokter_admin', 'daftar'];
tulis('02_skema_global.sql', [
  judul('Langkah 2 - Skema konseptual global (GCS)',
    'Enam tabel Praktikum 2, ditulis ulang dengan tipe data Oracle yang benar.'),
  '-- Jalankan sebagai RS_APP.',
  '',
  '-- Catatan perbaikan terhadap skema praktikum asli:',
  '--   * no_hp dibuat VARCHAR2, bukan NUMBER: nol di depan tidak boleh hilang.',
  '--   * kolom kota ditambahkan sebagai kunci fragmentasi horizontal.',
  '--   * biaya dan tanggal_daftar ditambahkan agar laporan bisa diuji.',
  '--   * setiap tabel diberi PRIMARY KEY dan FOREIGN KEY eksplisit.',
  '',
  ...tabelUrut.map((t) => O.createTable(db[t], {
    tipe: TIPE,
    pk: RS_KEYS[t].pk,
    fk: RS_KEYS[t].fk.map((f) => ({ ...f, onDelete: 'CASCADE' })),
    notNull: RS_KEYS[t].fk.flatMap((f) => f.cols),
    check: t === 'pasien' ? [{ nama: 'CK_PASIEN_JK', ekspresi: "JENIS_KELAMIN IN ('L','P')" }] : [],
  })),
  '',
  '-- Indeks penunjang join yang paling sering dipakai laporan:',
  'CREATE INDEX IX_PD_PASIEN ON PASIEN_DOKTER (ID_PASIEN);',
  'CREATE INDEX IX_PD_DOKTER ON PASIEN_DOKTER (ID_DOKTER);',
  'CREATE INDEX IX_DAFTAR_PASIEN ON DAFTAR (ID_PASIEN);',
  '',
  '-- Verifikasi:',
  "SELECT table_name, num_rows FROM user_tables ORDER BY table_name;",
  "SELECT constraint_name, constraint_type, table_name FROM user_constraints WHERE constraint_type IN ('P','R') ORDER BY table_name;",
].join('\n'));

// ------------------------------------------------- 03 fragmentasi horizontal

const fragKota = KOTA.map((k, i) => ({
  nama: `P_${k.toUpperCase()}`,
  nilai: [k],
  situs: DEFAULT_SITES[i].id,
}));

tulis('03_fragmentasi_horizontal.sql', [
  judul('Langkah 3 - Fragmentasi horizontal primer',
    'sigma_{kota = X}(PASIEN) diwujudkan sebagai PARTITION BY LIST.'),
  '-- Aturan kebenaran yang dijamin oleh partisi LIST + partisi DEFAULT:',
  '--   Kelengkapan  : partisi DEFAULT menampung nilai kota yang belum terdaftar',
  '--   Rekonstruksi : SELECT * FROM PASIEN otomatis menggabungkan seluruh partisi',
  '--   Kedisjoinan  : satu baris hanya bisa masuk ke satu partisi LIST',
  '',
  '-- Tabel pada 02_skema_global.sql dibuat ulang dalam bentuk terpartisi:',
  'DROP TABLE PASIEN CASCADE CONSTRAINTS;',
  '',
  O.horizontalAsPartitions(db.pasien, 'kota', fragKota, {
    tipe: TIPE,
    pk: RS_KEYS.pasien.pk,
    check: [{ nama: 'CK_PASIEN_JK', ekspresi: "JENIS_KELAMIN IN ('L','P')" }],
  }),
  '',
  O.partitionedIndexes('PASIEN', {
    lokal: [{ nama: 'IX_PASIEN_NAMA', kolom: ['nama_pasien'] }],
    global: [{ nama: 'IX_PASIEN_HP', kolom: ['no_hp'], partisi: 4 }],
  }),
  '',
  '-- Berapa baris di tiap fragmen:',
  'SELECT partition_name, num_rows FROM user_tab_partitions WHERE table_name = \'PASIEN\';',
  '',
  '-- Setara dengan "AT SITE" pada Modul 6 - akses satu fragmen secara langsung:',
  ...fragKota.map((f) => `SELECT COUNT(*) FROM PASIEN PARTITION (${f.nama});`),
].join('\n'));

// --------------------------------------------------- 04 fragmentasi turunan

tulis('04_fragmentasi_turunan.sql', [
  judul('Langkah 4 - Fragmentasi horizontal turunan (derived)',
    'PASIEN_DOKTER mengikuti fragmentasi PASIEN lewat PARTITION BY REFERENCE.'),
  '-- Tanpa ini, setiap join PASIEN x PASIEN_DOKTER harus melintasi jaringan.',
  '-- Dengan reference partitioning, baris anak SELALU berada di partisi yang sama',
  '-- dengan induknya, sehingga join menjadi partition-wise join yang lokal.',
  '',
  'DROP TABLE PASIEN_DOKTER CASCADE CONSTRAINTS;',
  '',
  'CREATE TABLE PASIEN_DOKTER (',
  '  ID                     NUMBER(8)  NOT NULL,',
  '  ID_DOKTER              NUMBER(4)  NOT NULL,',
  '  ID_PASIEN              NUMBER(8)  NOT NULL,',
  '  WAKTU_PERIKSA          DATE,',
  '  RESEP                  VARCHAR2(120),',
  '  BIAYA                  NUMBER(12,2),',
  '  CONSTRAINT PK_PASIEN_DOKTER PRIMARY KEY (ID),',
  '  CONSTRAINT FK_PD_PASIEN FOREIGN KEY (ID_PASIEN) REFERENCES PASIEN (ID_PASIEN),',
  '  CONSTRAINT FK_PD_DOKTER FOREIGN KEY (ID_DOKTER) REFERENCES DOKTER (ID_DOKTER)',
  ')',
  'PARTITION BY REFERENCE (FK_PD_PASIEN);',
  '',
  '-- Syarat reference partitioning: kolom foreign key WAJIB NOT NULL.',
  '-- Partisi anak otomatis mewarisi nama partisi induknya:',
  "SELECT partition_name FROM user_tab_partitions WHERE table_name = 'PASIEN_DOKTER';",
  '',
  '-- Bukti join menjadi lokal (cari baris PARTITION JOIN pada rencana):',
  'EXPLAIN PLAN FOR',
  'SELECT p.NAMA_PASIEN, pd.RESEP',
  '  FROM PASIEN p JOIN PASIEN_DOKTER pd ON p.ID_PASIEN = pd.ID_PASIEN',
  " WHERE p.KOTA = 'Jakarta';",
  "SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, 'BASIC +PARTITION'));",
].join('\n'));

// -------------------------------------------------- 05 fragmentasi vertikal

const { STAFF } = dreamhome();
const vert = O.verticalAsTables(STAFF, [
  { nama: 'S1_STAFF', atribut: ['position', 'sex', 'dob', 'salary'], situs: 'S3' },
  { nama: 'S2_STAFF', atribut: ['fname', 'lname', 'branchno'], situs: 'S1' },
], 'staffno');

tulis('05_fragmentasi_vertikal.sql', [
  judul('Langkah 5 - Fragmentasi vertikal',
    'Contoh S1/S2 pada Modul 6: data gaji dipisahkan dari data identitas.'),
  '-- Alasan bisnis: kolom gaji hanya boleh dibaca bagian SDM, sedangkan nama',
  '-- dan cabang dibaca semua orang. Memisahkannya secara vertikal membuat',
  '-- hak akses bisa diberikan per tabel, bukan per kolom.',
  '',
  '-- Syarat lossless-join: SETIAP fragmen wajib memuat kunci (STAFFNO).',
  '-- Tanpa itu, S1 JOIN S2 tidak akan mengembalikan relasi aslinya.',
  '',
  vert.sql,
  '',
  '-- Uji rekonstruksi: jumlah baris VIEW harus sama dengan jumlah baris asli.',
  'SELECT COUNT(*) AS baris_s1 FROM S1_STAFF;',
  'SELECT COUNT(*) AS baris_s2 FROM S2_STAFF;',
  'SELECT COUNT(*) AS baris_rekonstruksi FROM STAFF;',
  '',
  '-- Reduksi fragmentasi vertikal: kueri di bawah hanya menyentuh S2_STAFF',
  '-- karena tidak ada satu pun atribut S1_STAFF yang diminta.',
  'EXPLAIN PLAN FOR SELECT FNAME, LNAME FROM STAFF;',
  "SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, 'BASIC'));",
].join('\n'));

// -------------------------------------------------------- 06 database link

tulis('06_database_link.sql', [
  judul('Langkah 6 - Database link antar situs',
    'Tanpa link, Oracle tidak punya jalan untuk menjalankan kueri terdistribusi.'),
  ...DEFAULT_SITES.slice(1).map((s) => O.createDatabaseLink({
    nama: `SITUS_${s.kota.toUpperCase()}`,
    user: 'RS_APP',
    tns: `//${s.kota.toLowerCase()}-db:1521/XEPDB1`,
  })),
  '',
  O.locationTransparencySynonyms(DEFAULT_SITES.slice(1).map((s) => ({
    alias: `PASIEN_${s.kota.toUpperCase()}`,
    objek: 'PASIEN',
    link: `SITUS_${s.kota.toUpperCase()}`,
  }))),
  '',
  O.unionAllView('V_PASIEN_NASIONAL', [
    { objek: 'PASIEN', predikat: "KOTA = 'Jakarta'" },
    ...DEFAULT_SITES.slice(1).map((s) => ({
      objek: 'PASIEN',
      link: `SITUS_${s.kota.toUpperCase()}`,
      predikat: `KOTA = '${s.kota}'`,
    })),
  ]),
  '',
  '-- Periksa link yang ada dan sesi terdistribusi yang sedang terbuka:',
  'SELECT db_link, username, host FROM user_db_links;',
  'SELECT * FROM v$dblink;',
].join('\n'));

// ----------------------------------------------------------- 07 replikasi

tulis('07_replikasi_materialized_view.sql', [
  judul('Langkah 7 - Replikasi dengan materialized view',
    'DOKTER dibaca semua situs tetapi jarang berubah - kandidat replikasi penuh.'),
  '-- Keputusan ini bukan selera: lab Alokasi & Replikasi menghitung bahwa',
  '-- mereplikasi DOKTER ke tiga situs menurunkan biaya total, sedangkan',
  '-- mereplikasi PASIEN justru menaikkannya karena PASIEN sering di-update.',
  '',
  O.materializedView({
    nama: 'MV_DOKTER',
    sumber: 'DOKTER',
    link: 'SITUS_JAKARTA',
    kunci: ['id_dokter'],
    refresh: 'FAST',
    jadwal: 'START WITH',
    interval: 'SYSDATE + 15/1440',
    tablespace: 'TS_S2',
  }),
  '',
  '-- Pilihan jadwal penyegaran dan konsekuensinya:',
  '--   ON COMMIT   -> RPO 0, tetapi setiap COMMIT di sumber ikut menunggu (sinkron)',
  '--   ON DEMAND   -> RPO sebesar jeda penyegaran, COMMIT tetap cepat (asinkron)',
  '--   START WITH  -> penyegaran berkala; di atas dipakai 15 menit',
  '',
  O.refreshGroup('RG_REFERENSI', ['MV_DOKTER'], 'SYSDATE + 15/1440'),
  '',
  '-- Pantau apakah replika tertinggal:',
  'SELECT mview_name, last_refresh_type, last_refresh_date, staleness FROM user_mviews;',
  "SELECT name, status, next_date FROM user_refresh;",
].join('\n'));

// ---------------------------------------------- 08 transaksi terdistribusi

tulis('08_transaksi_terdistribusi.sql', [
  judul('Langkah 8 - Transaksi terdistribusi dan two-phase commit',
    'Oracle menjalankan 2PC otomatis; yang perlu dipahami adalah kapan ia memblokir.'),
  O.distributedTransaction({
    situs: ['Jakarta', 'Bandung'],
    namaTransaksi: 'RUJUK_PASIEN_LINTAS_KOTA',
    operasi: [
      { situs: 'Jakarta (lokal)', sql: "UPDATE PASIEN SET KOTA = 'Bandung' WHERE ID_PASIEN = 1" },
      { situs: 'Bandung (jauh)', sql: "INSERT INTO DAFTAR@SITUS_BANDUNG (ID_DAFTAR, ID_PASIEN, ID_ADMIN, TANGGAL_DAFTAR) VALUES (99, 1, 3, SYSDATE)" },
    ],
  }),
  '',
  '-- Urutan yang sebenarnya terjadi di balik satu COMMIT itu:',
  '--   fase 1  koordinator mengirim PREPARE ke semua situs',
  '--   fase 1  tiap situs menulis catatan READY lalu menjawab VOTE-COMMIT',
  '--   fase 2  koordinator menulis keputusan lalu menyebarkan GLOBAL-COMMIT',
  '--   fase 2  tiap situs commit dan mengirim ACK',
  '',
  '-- Situs commit point ditentukan oleh COMMIT_POINT_STRENGTH tertinggi.',
  '-- Pilih situs yang paling jarang mati sebagai commit point:',
  "SELECT name, value FROM v$parameter WHERE name = 'commit_point_strength';",
  '-- ALTER SYSTEM SET COMMIT_POINT_STRENGTH = 200 SCOPE = SPFILE;',
  '',
  '-- Simulasi transaksi menggantung (jalankan di sesi terpisah, lalu matikan',
  '-- jaringan ke situs jauh sebelum COMMIT selesai):',
  'ALTER SESSION SET DISTRIBUTED_LOCK_TIMEOUT = 10;',
].join('\n'));

// -------------------------------------------- 09 lima tingkat transparansi

const fragSpec = KOTA.map((k, i) => ({
  nama: `PASIEN_${k.toUpperCase()}`,
  tipe: 'horizontal',
  atribut: db.pasien.attrs,
  situs: DEFAULT_SITES[i].id,
  predikat: `KOTA = '${k}'`,
}));
const qSpec = { relasiGlobal: 'PASIEN', pilih: ['NAMA_PASIEN', 'PENYAKIT'], kondisi: "JENIS_KELAMIN = 'P'", atributKondisi: 'jenis_kelamin' };

tulis('09_transparansi_lima_tingkat.sql', [
  judul('Langkah 9 - Satu kueri, lima tingkat transparansi',
    'Kueri yang sama ditulis ulang sesuai tangga transparansi pada Modul 6.'),
  ...T.ladder(qSpec, fragSpec).map((lv) => [
    `-- ${'-'.repeat(70)}`,
    `-- TINGKAT ${lv.tingkat}: ${lv.nama}`,
    `-- ${lv.keterangan}`,
    `-- Fragmen disebut: ${lv.jumlahFragmenDisebut} | Situs disebut: ${lv.jumlahSitusDisebut} | Panjang SQL: ${lv.panjangSql} karakter`,
    lv.catatan ? `-- ${lv.catatan}` : null,
    lv.peringatan ? `-- PERINGATAN: ${lv.peringatan}` : null,
    '',
    lv.sql,
    '',
  ].filter((x) => x !== null).join('\n')),
  '-- Kesimpulan: makin rendah transparansinya, makin panjang SQL yang harus',
  '-- ditulis aplikasi, dan makin banyak yang harus diubah saat data dipindahkan.',
].join('\n'));

// ------------------------------------------------------------ 10 diagnosa

tulis('10_diagnosa_2pc_dan_deadlock.sql', [
  judul('Langkah 10 - Diagnosa transaksi menggantung dan deadlock',
    'Yang dilakukan DBA ketika 2PC benar-benar memblokir di produksi.'),
  O.twoPhaseDiagnostics(),
  '',
  '-- Arti kolom STATE pada dba_2pc_pending:',
  "--   collecting  : koordinator masih mengumpulkan suara",
  "--   prepared    : situs ini sudah READY dan MENUNGGU keputusan - inilah keadaan terblokir",
  "--   committed   : sudah commit, tinggal menunggu pembersihan",
  "--   forced commit / forced abort : keputusan dipaksa manual oleh DBA",
  '',
  '-- Kolom MIXED = yes berarti bencana: sebagian situs commit, sebagian rollback.',
  '-- Itu terjadi bila COMMIT FORCE dipakai dengan keputusan yang salah.',
  '',
  '-- Deadlock terdistribusi: Oracle mendeteksi sendiri dan mengorbankan satu sesi',
  '-- dengan ORA-00060. Yang perlu dibaca adalah trace file-nya:',
  "SELECT value AS trace_file FROM v$diag_info WHERE name = 'Default Trace File';",
  '',
  '-- Siapa menunggu siapa (wait-for graph versi Oracle):',
  'SELECT s.sid, s.username, s.blocking_session, s.event, s.seconds_in_wait',
  '  FROM v$session s',
  ' WHERE s.blocking_session IS NOT NULL;',
  '',
  '-- Batas waktu menunggu kunci terdistribusi:',
  "SELECT name, value FROM v$parameter WHERE name = 'distributed_lock_timeout';",
].join('\n'));

// ------------------------------------------------------ 11 rencana eksekusi

tulis('11_rencana_eksekusi.sql', [
  judul('Langkah 11 - Membaca rencana eksekusi kueri terdistribusi',
    'Bukti bahwa reduksi lokalisasi benar-benar terjadi di mesin, bukan di teori.'),
  O.pruningProof('PASIEN', 'kota', 'Jakarta'),
  '',
  O.explainPlan("SELECT p.NAMA_PASIEN, d.NAMA_DOKTER FROM PASIEN p JOIN PASIEN_DOKTER pd ON p.ID_PASIEN = pd.ID_PASIEN JOIN DOKTER d ON pd.ID_DOKTER = d.ID_DOKTER WHERE p.KOTA = 'Jakarta'", { nama: 'join_lokal' }),
  '',
  '-- Kueri lintas situs - perhatikan baris REMOTE pada rencana:',
  'EXPLAIN PLAN FOR',
  'SELECT COUNT(*) FROM PASIEN@SITUS_BANDUNG;',
  "SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, 'ALL +REMOTE'));",
  '',
  '-- Kolom OTHER pada rencana berisi SQL yang benar-benar dikirim ke situs jauh.',
  '-- Di situlah terlihat apakah Oracle mengirim seluruh tabel atau hanya',
  '-- hasil yang sudah tersaring - persis perbandingan strategi join pada lab.',
  '',
  '-- Statistik agar pengoptimal punya dasar angka:',
  "EXEC DBMS_STATS.GATHER_SCHEMA_STATS('RS_APP', cascade => TRUE);",
].join('\n'));

// ------------------------------------------------------------ 12 data contoh

tulis('12_data_contoh.sql', [
  judul('Langkah 12 - Data contoh', 'Dataset yang sama persis dengan yang dipakai lab di situs.'),
  'SET DEFINE OFF;',
  '',
  ...tabelUrut.map((t) => `-- ${t} (${db[t].cardinality} baris)\n${O.insertRows(db[t])}\n`),
  'COMMIT;',
  '',
  '-- Verifikasi jumlah baris:',
  ...tabelUrut.map((t) => `SELECT '${t}' AS tabel, COUNT(*) AS baris FROM ${t.toUpperCase()};`),
].join('\n'));

// ----------------------------------------------------------------- README

tulis('00_URUTAN_JALANKAN.md', [
  '# Skrip Oracle ORACLEDECK',
  '',
  'Dihasilkan otomatis dari mesin yang sama dengan yang dipakai situs',
  '(`node tools/gen_oracle.js`). Jangan disunting manual — perubahan akan hilang',
  'pada pembuatan berikutnya. Ubah `tools/gen_oracle.js` atau `engine/oracle/emit.js`.',
  '',
  '## Lingkungan yang diuji',
  '',
  'Skrip ditulis untuk **Oracle Database 21c XE** (juga berlaku untuk 19c dan 23ai Free).',
  'Fitur yang dipakai: LIST/REFERENCE partitioning, database link, materialized view,',
  'dan tampilan diagnosa `DBA_2PC_PENDING`.',
  '',
  '> Skrip ini **belum pernah dijalankan** pada instans Oracle sungguhan dalam',
  '> repositori ini — tidak ada Oracle di lingkungan pembuatannya. Yang diuji',
  '> otomatis adalah *pembangkitnya*: bentuk DDL, nama objek, dan klausa partisi',
  '> diperiksa 40+ uji di `tests/oracle-emit.test.js`. Jalankan sendiri di Oracle XE',
  '> untuk membuktikan bagian yang tidak bisa diuji tanpa basis data.',
  '',
  '## Urutan menjalankan',
  '',
  '| # | Berkas | Isi |',
  '|---|--------|-----|',
  '| 1 | `01_tablespace_dan_user.sql` | Tablespace per situs + pengguna RS_APP |',
  '| 2 | `02_skema_global.sql` | Enam tabel skema konseptual global |',
  '| 3 | `03_fragmentasi_horizontal.sql` | PARTITION BY LIST per kota |',
  '| 4 | `04_fragmentasi_turunan.sql` | PARTITION BY REFERENCE untuk tabel anak |',
  '| 5 | `05_fragmentasi_vertikal.sql` | Pemisahan kolom + VIEW perekat |',
  '| 6 | `06_database_link.sql` | Link antar situs, sinonim, view UNION ALL |',
  '| 7 | `07_replikasi_materialized_view.sql` | Replikasi tabel referensi |',
  '| 8 | `08_transaksi_terdistribusi.sql` | 2PC otomatis Oracle |',
  '| 9 | `09_transparansi_lima_tingkat.sql` | Satu kueri, lima tingkat transparansi |',
  '| 10 | `10_diagnosa_2pc_dan_deadlock.sql` | Transaksi menggantung & deadlock |',
  '| 11 | `11_rencana_eksekusi.sql` | Bukti partition pruning & operasi REMOTE |',
  '| 12 | `12_data_contoh.sql` | Data contoh yang identik dengan lab |',
  '',
  '## Menjalankan cepat dengan Docker',
  '',
  '```bash',
  'docker run -d --name oracle-xe -p 1521:1521 -e ORACLE_PASSWORD=oracle \\',
  '  gvenzl/oracle-free:23-slim',
  'sqlplus sys/oracle@//localhost:1521/FREEPDB1 as sysdba @01_tablespace_dan_user.sql',
  '```',
  '',
  '## Kalau tidak ada Oracle',
  '',
  'Semua konsep yang sama bisa dijalankan langsung di peramban lewat situs',
  'ORACLEDECK — mesin relasionalnya ditulis ulang dari nol dan hasilnya',
  'diverifikasi silang terhadap SQLite (`python tools/verify_sqlite.py`).',
].join('\n'));

process.stdout.write(`\n${berkas.length} berkas ditulis ke oracle/\n`);
