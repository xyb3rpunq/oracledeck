// gen_oracle.js — hasilkan seluruh skrip Oracle di folder oracle/ dari mesin
// yang sama yang dipakai situs, sehingga skrip yang dijalankan mahasiswa tidak
// pernah menyimpang dari rancangan yang ditampilkan lab.
//
// Topologi: tiga basis data sungguhan (pluggable database) yang saling terhubung
// lewat database link — JAKARTA (pusat, PDB bawaan), BANDUNG, dan SURABAYA.
//
// Setiap skrip:
//   - diawali "-- @jalankan situs=<...> sebagai=<sys|rs_app>" (dibaca tools/uji_oracle.mjs)
//   - memeriksa hasilnya sendiri dengan baris "LULUS: ..." atau "GAGAL: ..."
//   - mendaftarkan galat yang MEMANG diperagakan lewat "-- @galat-diharapkan ORA-xxxxx"
//
// Jalankan: node tools/gen_oracle.js

import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rumahsakit, RS_KEYS, RS_TIPE, DEFAULT_SITES, dreamhome, STAFF_ATTRS } from '../engine/data/datasets.js';
import { Relation } from '../engine/core/relation.js';
import * as O from '../engine/oracle/emit.js';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'oracle');
mkdirSync(OUT, { recursive: true });
// skrip lama dihapus agar nomor urut yang berubah tidak meninggalkan berkas yatim
for (const f of readdirSync(OUT)) if (/^\d{2}[a-z]?_.*\.sql$/.test(f)) unlinkSync(join(OUT, f));

const db = rumahsakit();
const TIPE = RS_TIPE;
const SITUS = DEFAULT_SITES.map((s) => ({ ...s, kode: s.kota.toUpperCase() }));
const [JKT, BDG, SBY] = SITUS;
const berkas = [];

function tulis(nama, isi) {
  writeFileSync(join(OUT, nama), `${isi.filter((x) => x !== null && x !== undefined).join('\n').trimEnd()}\n`, 'utf8');
  berkas.push(nama);
}

const kepala = ({ judul, sub, situs, sebagai, galat = [], catatan = [] }) => [
  `-- ${'='.repeat(74)}`,
  `-- ${judul}`,
  sub ? `-- ${sub}` : null,
  '-- Dihasilkan oleh ORACLEDECK (node tools/gen_oracle.js) - jangan sunting manual.',
  `-- ${'='.repeat(74)}`,
  `-- @jalankan situs=${situs} sebagai=${sebagai}`,
  galat.length ? `-- @galat-diharapkan ${galat.join(' ')}` : null,
  `-- Sambungan: ${sebagai === 'sys' ? 'SYS AS SYSDBA' : 'RS_APP'} ke ${situs === 'cdb' ? 'CDB$ROOT' : `PDB situs ${situs.toUpperCase()}`}.`,
  ...catatan.map((c) => `-- ${c}`),
  '',
].filter((x) => x !== null).join('\n');

/** Pemeriksaan mandiri: mencetak LULUS/GAGAL agar runner dan mahasiswa sama-sama bisa membacanya. */
const cek = (pesan, kondisi) => `SELECT CASE WHEN ${kondisi} THEN 'LULUS: ${pesan.replace(/'/g, "''")}' ELSE 'GAGAL: ${pesan.replace(/'/g, "''")}' END AS cek FROM dual;`;
const hitung = (sql) => `(SELECT COUNT(*) FROM ${sql})`;

const proyeksi = (rel, nama, kolom, filter = () => true) => new Relation(nama, kolom, rel.rows.filter((r) => filter(r)).map((r) => kolom.map((k) => r[rel.indexOf(k)])));
const barisKota = (kota) => db.pasien.rows.filter((r) => r[db.pasien.indexOf('kota')] === kota).map((r) => r[0]);

// ============================================================ 01 situs (PDB)

tulis('01_situs_pdb.sql', [
  kepala({
    judul: 'Langkah 1 - Tiga situs = tiga basis data',
    sub: 'Situs Jakarta memakai PDB bawaan; Bandung dan Surabaya dibuat sebagai PDB baru.',
    situs: 'cdb',
    sebagai: 'sys',
    catatan: [
      'Oracle Free 23ai: PDB bawaan FREEPDB1. Oracle XE 21c: XEPDB1 (XE mengizinkan 3 PDB).',
      'Di produksi, tiap situs adalah server terpisah; PDB dipakai agar bisa diuji di satu laptop',
      'dengan database link, 2PC, dan DBA_2PC_PENDING yang sungguhan.',
    ],
  }),
  ...[BDG, SBY].map((s) => [
    `-- Situs ${s.id} - ${s.nama}`,
    `CREATE PLUGGABLE DATABASE ${s.kode} ADMIN USER PDB_ADMIN IDENTIFIED BY "&&sandi_rs_app"`,
    `  FILE_NAME_CONVERT = ('/pdbseed/', '/${s.kode}/');`,
    `ALTER PLUGGABLE DATABASE ${s.kode} OPEN;`,
    `ALTER PLUGGABLE DATABASE ${s.kode} SAVE STATE;`,
    '',
  ].join('\n')),
  cek('PDB BANDUNG dan SURABAYA terbuka READ WRITE', `${hitung(`v$pdbs WHERE name IN ('${BDG.kode}', '${SBY.kode}') AND open_mode = 'READ WRITE'`)} = 2`),
]);

// ================================================= 02 pengguna per situs

tulis('02_pengguna_situs.sql', [
  kepala({
    judul: 'Langkah 2 - Pemilik skema aplikasi di setiap situs',
    sub: 'Dijalankan tiga kali: di JAKARTA, BANDUNG, dan SURABAYA.',
    situs: 'jakarta,bandung,surabaya',
    sebagai: 'sys',
    catatan: ['Variabel &&situs diisi nama situs (JAKARTA/BANDUNG/SURABAYA), &&dir_data folder data Oracle.'],
  }),
  '-- Berkas data dikelola Oracle (OMF) agar nama berkas tidak perlu ditulis manual:',
  "ALTER SYSTEM SET db_create_file_dest = '&&dir_data' SCOPE = BOTH;",
  '',
  'CREATE TABLESPACE TS_&&situs DATAFILE SIZE 50M AUTOEXTEND ON NEXT 10M MAXSIZE 1G;',
  '',
  'CREATE USER RS_APP IDENTIFIED BY "&&sandi_rs_app"',
  '  DEFAULT TABLESPACE TS_&&situs QUOTA UNLIMITED ON TS_&&situs;',
  '',
  'GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE SYNONYM,',
  '      CREATE DATABASE LINK, CREATE MATERIALIZED VIEW, CREATE PROCEDURE TO RS_APP;',
  '',
  '-- Hak untuk memeriksa dan menyelesaikan transaksi terdistribusi (Langkah 13):',
  'GRANT SELECT_CATALOG_ROLE, FORCE ANY TRANSACTION TO RS_APP;',
  'GRANT SELECT ON dba_2pc_pending TO RS_APP;',
  'GRANT SELECT ON dba_2pc_neighbors TO RS_APP;',
  'GRANT EXECUTE ON dbms_transaction TO RS_APP;',
  '',
  cek('pengguna RS_APP dan tablespace situs siap', `${hitung("dba_users WHERE username = 'RS_APP'")} = 1 AND ${hitung("dba_tablespaces WHERE tablespace_name = 'TS_&&situs'")} = 1`),
]);

// ============================================ 03 tablespace alokasi (pusat)

tulis('03_tablespace_alokasi.sql', [
  kepala({
    judul: 'Langkah 3 - Alokasi di dalam satu basis data: satu tablespace per situs',
    sub: 'Dipakai Langkah 6: partisi PASIEN ditaruh di tablespace situsnya.',
    situs: 'jakarta',
    sebagai: 'sys',
  }),
  ...[BDG, SBY].map((s) => `CREATE TABLESPACE TS_${s.kode} DATAFILE SIZE 20M AUTOEXTEND ON NEXT 10M MAXSIZE 1G;`),
  '',
  `ALTER USER RS_APP QUOTA UNLIMITED ON TS_${BDG.kode} QUOTA UNLIMITED ON TS_${SBY.kode};`,
  '',
  cek('tiga tablespace alokasi tersedia di situs pusat', `${hitung("dba_tablespaces WHERE tablespace_name IN ('TS_JAKARTA', 'TS_BANDUNG', 'TS_SURABAYA')")} = 3`),
]);

// ============================================================ 04 skema global

const tabelUrut = ['pasien', 'dokter', 'administrator', 'pasien_dokter', 'dokter_admin', 'daftar'];
tulis('04_skema_global.sql', [
  kepala({
    judul: 'Langkah 4 - Skema konseptual global (GCS)',
    sub: 'Enam tabel Praktikum 2 dengan tipe data Oracle, PRIMARY KEY, FOREIGN KEY, dan CHECK.',
    situs: 'jakarta',
    sebagai: 'rs_app',
    catatan: [
      'Perbaikan terhadap skema praktikum asli:',
      '  * no_hp VARCHAR2, bukan NUMBER: nol di depan tidak boleh hilang.',
      '  * kolom kota sebagai kunci fragmentasi horizontal.',
      '  * ON DELETE CASCADE sesuai lembar praktikum (Oracle tidak punya ON UPDATE CASCADE).',
    ],
  }),
  ...tabelUrut.map((t) => O.createTable(db[t], {
    tipe: TIPE,
    pk: RS_KEYS[t].pk,
    fk: RS_KEYS[t].fk.map((f) => ({ ...f, onDelete: 'CASCADE' })),
    notNull: RS_KEYS[t].fk.flatMap((f) => f.cols),
    check: t === 'pasien' ? [{ nama: 'CK_PASIEN_JK', ekspresi: "JENIS_KELAMIN IN ('L','P')" }] : [],
  })),
  '',
  '-- Indeks penunjang join:',
  'CREATE INDEX IX_PD_PASIEN ON PASIEN_DOKTER (ID_PASIEN);',
  'CREATE INDEX IX_PD_DOKTER ON PASIEN_DOKTER (ID_DOKTER);',
  'CREATE INDEX IX_DAFTAR_PASIEN ON DAFTAR (ID_PASIEN);',
  '',
  cek('enam tabel global terbentuk', `${hitung(`user_tables WHERE table_name IN (${tabelUrut.map((t) => `'${t.toUpperCase()}'`).join(', ')})`)} = 6`),
  cek('enam kunci asing terpasang', `${hitung("user_constraints WHERE constraint_type = 'R'")} = 6`),
]);

// ============================================================ 05 data contoh

tulis('05_data_contoh.sql', [
  kepala({
    judul: 'Langkah 5 - Data contoh',
    sub: 'Dataset yang sama persis dengan Terminal SQL dan lab di situs.',
    situs: 'jakarta',
    sebagai: 'rs_app',
    galat: ['ORA-02290', 'ORA-02291'],
  }),
  ...tabelUrut.map((t) => `-- ${t} (${db[t].cardinality} baris)\n${O.insertRows(db[t])}\n`),
  'COMMIT;',
  '',
  ...tabelUrut.map((t) => cek(`${t} berisi ${db[t].cardinality} baris`, `${hitung(t.toUpperCase())} = ${db[t].cardinality}`)),
  '',
  '-- Kendala ditegakkan Oracle - kedua perintah di bawah SENGAJA ditolak:',
  "INSERT INTO PASIEN (ID_PASIEN, NAMA_PASIEN, JENIS_KELAMIN, KOTA) VALUES (90, 'Uji CHECK', 'X', 'Jakarta');",
  "INSERT INTO PASIEN_DOKTER (ID, ID_DOKTER, ID_PASIEN, BIAYA) VALUES (90, 42, 1, 1);",
  cek('baris yang melanggar kendala tidak tersimpan', `${hitung('PASIEN WHERE ID_PASIEN = 90')} + ${hitung('PASIEN_DOKTER WHERE ID = 90')} = 0`),
]);

// ================================================ 06 fragmentasi horizontal

const fragKota = SITUS.map((s) => ({ nama: `P_${s.kode}`, nilai: [s.kota], tablespace: `TS_${s.kode}` }));
tulis('06_fragmentasi_horizontal.sql', [
  kepala({
    judul: 'Langkah 6 - Fragmentasi horizontal primer',
    sub: 'sigma_{kota = X}(PASIEN) diwujudkan sebagai PARTITION BY LIST, tanpa kehilangan data.',
    situs: 'jakarta',
    sebagai: 'rs_app',
    galat: ['ORA-14402'],
    catatan: [
      'Aturan kebenaran:',
      '  Kelengkapan  : partisi DEFAULT menampung kota yang belum terdaftar',
      '  Rekonstruksi : SELECT * FROM PASIEN menggabungkan seluruh partisi',
      '  Kedisjoinan  : satu baris hanya bisa berada di satu partisi LIST',
    ],
  }),
  '-- Tabel yang sudah berisi data diubah menjadi terpartisi secara ONLINE (Oracle 12.2+):',
  'ALTER TABLE PASIEN MODIFY',
  'PARTITION BY LIST (KOTA) (',
  fragKota.map((f) => `  PARTITION ${f.nama} VALUES ('${f.nilai[0]}') TABLESPACE ${f.tablespace}`).join(',\n') + ',',
  '  PARTITION P_LAIN VALUES (DEFAULT)',
  ') ONLINE UPDATE INDEXES;',
  '',
  O.partitionedIndexes('PASIEN', {
    lokal: [{ nama: 'IX_PASIEN_NAMA', kolom: ['nama_pasien'] }],
    global: [{ nama: 'IX_PASIEN_HP', kolom: ['no_hp'], partisi: 4 }],
  }),
  '',
  ...fragKota.map((f, i) => cek(`fragmen ${f.nama} berisi ${barisKota(SITUS[i].kota).length} baris dan berada di ${f.tablespace}`,
    `${hitung(`PASIEN PARTITION (${f.nama})`)} = ${barisKota(SITUS[i].kota).length} AND ${hitung(`user_tab_partitions WHERE table_name = 'PASIEN' AND partition_name = '${f.nama}' AND tablespace_name = '${f.tablespace}'`)} = 1`)),
  cek('kelengkapan: jumlah semua fragmen = 12 baris', `${hitung('PASIEN')} = 12`),
  '',
  '-- Memindah baris ke fragmen lain butuh ROW MOVEMENT. Perintah pertama SENGAJA ditolak:',
  "UPDATE PASIEN SET KOTA = 'Bandung' WHERE ID_PASIEN = 1;",
  'ALTER TABLE PASIEN ENABLE ROW MOVEMENT;',
  "UPDATE PASIEN SET KOTA = 'Bandung' WHERE ID_PASIEN = 1;",
  cek('dengan ROW MOVEMENT baris berpindah ke fragmen Bandung', `${hitung("PASIEN PARTITION (P_BANDUNG) WHERE ID_PASIEN = 1")} = 1`),
  'ROLLBACK;',
  cek('ROLLBACK mengembalikan baris ke fragmen Jakarta', `${hitung("PASIEN PARTITION (P_JAKARTA) WHERE ID_PASIEN = 1")} = 1`),
]);

// ================================================== 07 fragmentasi turunan

tulis('07_fragmentasi_turunan.sql', [
  kepala({
    judul: 'Langkah 7 - Fragmentasi horizontal turunan (derived)',
    sub: 'PASIEN_DOKTER_FRAG mengikuti fragmen PASIEN lewat PARTITION BY REFERENCE.',
    situs: 'jakarta',
    sebagai: 'rs_app',
    catatan: [
      'Syarat: kolom kunci asing NOT NULL dan tabel induk sudah terpartisi (Langkah 6).',
      'Induk sudah ENABLE ROW MOVEMENT, maka anak juga wajib ROW MOVEMENT (tanpanya Oracle menolak: ORA-14661).',
    ],
  }),
  'CREATE TABLE PASIEN_DOKTER_FRAG (',
  '  ID                     NUMBER(8)     NOT NULL,',
  '  ID_DOKTER              NUMBER(4)     NOT NULL,',
  '  ID_PASIEN              NUMBER(8)     NOT NULL,',
  '  WAKTU_PERIKSA          DATE,',
  '  RESEP                  VARCHAR2(150),',
  '  BIAYA                  NUMBER(12,2),',
  '  CONSTRAINT PK_PASIEN_DOKTER_FRAG PRIMARY KEY (ID),',
  '  CONSTRAINT FK_PDF_PASIEN FOREIGN KEY (ID_PASIEN) REFERENCES PASIEN (ID_PASIEN),',
  '  CONSTRAINT FK_PDF_DOKTER FOREIGN KEY (ID_DOKTER) REFERENCES DOKTER (ID_DOKTER)',
  ')',
  'PARTITION BY REFERENCE (FK_PDF_PASIEN)',
  'ENABLE ROW MOVEMENT;',
  '',
  'INSERT INTO PASIEN_DOKTER_FRAG SELECT * FROM PASIEN_DOKTER;',
  'COMMIT;',
  '',
  cek('partisi anak mewarisi 4 partisi induk', `${hitung("user_tab_partitions WHERE table_name = 'PASIEN_DOKTER_FRAG'")} = 4`),
  ...SITUS.map((s) => cek(`setiap pemeriksaan pasien ${s.kota} ikut berada di fragmen P_${s.kode}`,
    `${hitung(`PASIEN_DOKTER_FRAG PARTITION (P_${s.kode})`)} = ${hitung(`PASIEN_DOKTER pd JOIN PASIEN p ON p.ID_PASIEN = pd.ID_PASIEN WHERE p.KOTA = '${s.kota}'`)}`)),
  '',
  '-- Rencana join: PARTITION LIST SINGLE pada kedua tabel menandakan join lokal satu fragmen.',
  "EXPLAIN PLAN SET STATEMENT_ID = 'turunan' FOR",
  'SELECT p.NAMA_PASIEN, pd.RESEP',
  '  FROM PASIEN p JOIN PASIEN_DOKTER_FRAG pd ON p.ID_PASIEN = pd.ID_PASIEN',
  " WHERE p.KOTA = 'Jakarta';",
  "SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, 'turunan', 'BASIC +PARTITION'));",
  cek('rencana memangkas ke satu partisi', `${hitung("plan_table WHERE statement_id = 'turunan' AND operation LIKE 'PARTITION%' AND options = 'SINGLE'")} >= 1`),
]);

// ================================================== 08 fragmentasi vertikal

const { STAFF } = dreamhome();
const vert = O.verticalAsTables(STAFF, [
  { nama: 'S1_STAFF', atribut: ['position', 'sex', 'dob', 'salary'] },
  { nama: 'S2_STAFF', atribut: ['fname', 'lname', 'branchno'] },
], 'staffno');
tulis('08_fragmentasi_vertikal.sql', [
  kepala({
    judul: 'Langkah 8 - Fragmentasi vertikal',
    sub: 'STAFF dari Modul 6: data gaji (S1) dipisahkan dari data identitas (S2).',
    situs: 'jakarta',
    sebagai: 'rs_app',
    catatan: ['Syarat lossless-join: SETIAP fragmen memuat kunci STAFFNO.'],
  }),
  vert.sql,
  '',
  O.insertRows(proyeksi(STAFF, 'S1_STAFF', ['staffno', 'position', 'sex', 'dob', 'salary'])),
  O.insertRows(proyeksi(STAFF, 'S2_STAFF', ['staffno', 'fname', 'lname', 'branchno'])),
  'COMMIT;',
  '',
  cek(`rekonstruksi S1 JOIN S2 mengembalikan ${STAFF.cardinality} pegawai`, `${hitung('STAFF')} = ${STAFF.cardinality}`),
  cek('rekonstruksi memuat seluruh atribut asli', `${hitung(`user_tab_columns WHERE table_name = 'STAFF'`)} = ${STAFF_ATTRS.length}`),
  '',
  "EXPLAIN PLAN SET STATEMENT_ID = 'vertikal' FOR SELECT FNAME, LNAME FROM S2_STAFF;",
  "SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, 'vertikal', 'BASIC'));",
]);

// =================================================== 09 fragmen di situs remote

for (const [huruf, s] of [['a', BDG], ['b', SBY]]) {
  const idPasien = new Set(barisKota(s.kota));
  const pas = proyeksi(db.pasien, 'PASIEN', db.pasien.attrs, (r) => idPasien.has(r[0]));
  const daf = proyeksi(db.daftar, 'DAFTAR', db.daftar.attrs, (r) => idPasien.has(r[db.daftar.indexOf('id_pasien')]));
  tulis(`09${huruf}_situs_${s.kota.toLowerCase()}.sql`, [
    kepala({
      judul: `Langkah 9${huruf} - Fragmen di situs ${s.nama}`,
      sub: `PASIEN_${s.kode} = sigma_{kota = '${s.kota}'}(PASIEN); DAFTAR diturunkan dari fragmen itu.`,
      situs: s.kota.toLowerCase(),
      sebagai: 'rs_app',
      galat: ['ORA-02290'],
      catatan: ['Kunci asing DAFTAR.ID_ADMIN tidak dideklarasikan: induknya ada di basis data lain,', 'dan Oracle tidak mengizinkan kunci asing lintas basis data.'],
    }),
    O.createTable(pas, {
      tipe: TIPE,
      pk: ['id_pasien'],
      check: [
        { nama: 'CK_PASIEN_JK', ekspresi: "JENIS_KELAMIN IN ('L','P')" },
        { nama: 'CK_PASIEN_KOTA', ekspresi: `KOTA = '${s.kota}'` },
      ],
    }),
    O.createTable(daf, { tipe: TIPE, pk: ['id_daftar'], fk: [{ cols: ['id_pasien'], ref: 'PASIEN', refCols: ['id_pasien'], onDelete: 'CASCADE' }], notNull: ['id_pasien'] }),
    '',
    O.insertRows(pas),
    O.insertRows(daf),
    'COMMIT;',
    '',
    cek(`fragmen PASIEN ${s.nama} berisi ${pas.cardinality} baris`, `${hitung('PASIEN')} = ${pas.cardinality}`),
    cek(`fragmen DAFTAR ${s.nama} berisi ${daf.cardinality} baris`, `${hitung('DAFTAR')} = ${daf.cardinality}`),
    '',
    '-- CHECK menjaga predikat fragmen: pasien kota lain SENGAJA ditolak.',
    `INSERT INTO PASIEN (ID_PASIEN, NAMA_PASIEN, JENIS_KELAMIN, KOTA) VALUES (91, 'Salah situs', 'L', 'Jakarta');`,
    cek('baris yang salah situs tidak tersimpan', `${hitung('PASIEN WHERE ID_PASIEN = 91')} = 0`),
  ]);
}

// ===================================================== 10 database link

tulis('10_database_link.sql', [
  kepala({
    judul: 'Langkah 10 - Database link, sinonim, dan view global',
    sub: 'Transparansi lokasi: aplikasi di Jakarta membaca ketiga situs seperti satu tabel.',
    situs: 'jakarta',
    sebagai: 'rs_app',
    catatan: ['&&tns_bandung dan &&tns_surabaya berisi alamat EZConnect situs, mis. //host:1521/BANDUNG.'],
  }),
  ...[BDG, SBY].map((s) => [
    `CREATE DATABASE LINK SITUS_${s.kode}`,
    `  CONNECT TO RS_APP IDENTIFIED BY "&&sandi_rs_app"`,
    `  USING '&&tns_${s.kota.toLowerCase()}';`,
    cek(`link SITUS_${s.kode} tersambung`, `${hitung(`PASIEN@SITUS_${s.kode}`)} = ${barisKota(s.kota).length}`),
    '',
  ].join('\n')),
  '-- Fragmen disebut dengan nama tanpa lokasi (transparansi lokasi):',
  "CREATE OR REPLACE VIEW PASIEN_JAKARTA AS SELECT * FROM PASIEN WHERE KOTA = 'Jakarta';",
  O.locationTransparencySynonyms([BDG, SBY].map((s) => ({ alias: `PASIEN_${s.kode}`, objek: 'PASIEN', link: `SITUS_${s.kode}` }))),
  '',
  O.unionAllView('V_PASIEN_NASIONAL', [
    { objek: 'PASIEN_JAKARTA' },
    { objek: 'PASIEN', link: `SITUS_${BDG.kode}` },
    { objek: 'PASIEN', link: `SITUS_${SBY.kode}` },
  ]),
  '',
  cek('rekonstruksi dari tiga basis data = 12 pasien', `${hitung('V_PASIEN_NASIONAL')} = 12`),
  cek('isi view global identik dengan tabel global (MINUS dua arah kosong)',
    `${hitung('(SELECT * FROM V_PASIEN_NASIONAL MINUS SELECT * FROM PASIEN)')} + ${hitung('(SELECT * FROM PASIEN MINUS SELECT * FROM V_PASIEN_NASIONAL)')} = 0`),
  cek('kedisjoinan: tidak ada ID pasien di dua situs', `${hitung('(SELECT ID_PASIEN FROM V_PASIEN_NASIONAL GROUP BY ID_PASIEN HAVING COUNT(*) > 1)')} = 0`),
  '',
  'SELECT db_link, username, host FROM user_db_links ORDER BY db_link;',
]);

// ================================================= 11-12 replikasi (MV)

tulis('11_replikasi_sumber.sql', [
  kepala({
    judul: 'Langkah 11 - Replikasi: MV log di situs sumber',
    sub: 'DOKTER dibaca semua situs tetapi jarang berubah - kandidat replikasi.',
    situs: 'jakarta',
    sebagai: 'rs_app',
    catatan: ['MV log WAJIB dibuat di basis data pemilik tabel, bukan lewat database link.'],
  }),
  O.materializedViewLog('DOKTER'),
  '',
  cek('MV log DOKTER tersedia', `${hitung("user_mview_logs WHERE master = 'DOKTER'")} = 1`),
]);

tulis('12_replikasi_replika.sql', [
  kepala({
    judul: 'Langkah 12 - Replikasi: materialized view di situs Bandung',
    sub: 'Salinan DOKTER disegarkan FAST: hanya perubahan yang dikirim.',
    situs: 'bandung',
    sebagai: 'rs_app',
  }),
  `CREATE DATABASE LINK SITUS_${JKT.kode}`,
  '  CONNECT TO RS_APP IDENTIFIED BY "&&sandi_rs_app"',
  "  USING '&&tns_jakarta';",
  '',
  O.materializedView({ nama: 'MV_DOKTER', sumber: 'DOKTER', link: `SITUS_${JKT.kode}`, kunci: ['id_dokter'], refresh: 'FAST', jadwal: 'ON DEMAND' }),
  '',
  cek(`replika berisi ${db.dokter.cardinality} dokter`, `${hitung('MV_DOKTER')} = ${db.dokter.cardinality}`),
  '',
  '-- Perubahan di sumber belum terlihat di replika sampai disegarkan (RPO asinkron):',
  `UPDATE DOKTER@SITUS_${JKT.kode} SET WAKTU_KERJA = 'Senin-Sabtu' WHERE ID_DOKTER = 3;`,
  'COMMIT;',
  cek('sebelum refresh, replika masih nilai lama', `${hitung("MV_DOKTER WHERE ID_DOKTER = 3 AND WAKTU_KERJA = 'Rabu-Jumat'")} = 1`),
  "EXEC DBMS_MVIEW.REFRESH('MV_DOKTER', 'F');",
  cek('setelah FAST refresh, replika mengikuti sumber', `${hitung("MV_DOKTER WHERE ID_DOKTER = 3 AND WAKTU_KERJA = 'Senin-Sabtu'")} = 1`),
  cek('refresh terakhir berjenis FAST', `${hitung("user_mviews WHERE mview_name = 'MV_DOKTER' AND last_refresh_type = 'FAST'")} = 1`),
  '',
  O.refreshGroup('RG_REFERENSI', ['MV_DOKTER'], 'SYSDATE + 15/1440'),
  cek('refresh group RG_REFERENSI terdaftar', `${hitung("user_refresh WHERE rname = 'RG_REFERENSI'")} = 1`),
  '',
  '-- Kembalikan nilai sumber agar langkah berikutnya memakai data asli:',
  `UPDATE DOKTER@SITUS_${JKT.kode} SET WAKTU_KERJA = 'Rabu-Jumat' WHERE ID_DOKTER = 3;`,
  'COMMIT;',
]);

// ============================================= 13 transaksi terdistribusi

tulis('13_transaksi_2pc.sql', [
  kepala({
    judul: 'Langkah 13 - Transaksi terdistribusi dan two-phase commit',
    sub: 'Satu COMMIT atas dua basis data: Oracle menjalankan 2PC otomatis.',
    situs: 'jakarta',
    sebagai: 'rs_app',
    galat: ['ORA-02290'],
  }),
  O.distributedTransaction({
    situs: ['Jakarta', 'Bandung'],
    namaTransaksi: 'RUJUK_PASIEN_LINTAS_KOTA',
    operasi: [
      { situs: 'Jakarta (lokal)', sql: "UPDATE PASIEN SET PENYAKIT = 'Asma - dirujuk' WHERE ID_PASIEN = 3" },
      { situs: 'Bandung (remote)', sql: `INSERT INTO DAFTAR@SITUS_${BDG.kode} (ID_DAFTAR, ID_PASIEN, ID_ADMIN, TANGGAL_DAFTAR) VALUES (99, 3, 3, DATE '2025-09-20')` },
    ],
  }),
  cek('kedua situs menyimpan perubahan', `${hitung(`DAFTAR@SITUS_${BDG.kode} WHERE ID_DAFTAR = 99`)} = 1 AND ${hitung("PASIEN WHERE ID_PASIEN = 3 AND PENYAKIT = 'Asma - dirujuk'")} = 1`),
  '',
  '-- Atomisitas global: perintah remote yang gagal membatalkan perubahan lokal juga.',
  "UPDATE PASIEN SET PENYAKIT = 'Harus batal' WHERE ID_PASIEN = 1;",
  `INSERT INTO PASIEN@SITUS_${BDG.kode} (ID_PASIEN, NAMA_PASIEN, JENIS_KELAMIN, KOTA) VALUES (92, 'Salah situs', 'L', 'Jakarta');`,
  'ROLLBACK;',
  cek('ROLLBACK membatalkan perubahan lokal', `${hitung("PASIEN WHERE ID_PASIEN = 1 AND PENYAKIT = 'Demam Berdarah'")} = 1`),
  '',
  "SELECT name, value FROM v$parameter WHERE name IN ('commit_point_strength', 'distributed_lock_timeout');",
]);

// ============================================= 14 transaksi ragu-ragu (in-doubt)

tulis('14a_matikan_pemulihan.sql', [
  kepala({
    judul: 'Langkah 14a - Matikan pemulihan otomatis (RECO) sementara',
    sub: 'Agar transaksi ragu-ragu pada Langkah 14b tidak langsung diselesaikan proses RECO.',
    situs: 'cdb',
    sebagai: 'sys',
  }),
  'ALTER SYSTEM DISABLE DISTRIBUTED RECOVERY;',
]);

tulis('14b_transaksi_ragu_ragu.sql', [
  kepala({
    judul: 'Langkah 14b - Kegagalan 2PC, DBA_2PC_PENDING, dan COMMIT FORCE',
    sub: 'Oracle mensimulasikan kegagalan lewat komentar ORA-2PC-CRASH-TEST-n.',
    situs: 'jakarta',
    sebagai: 'rs_app',
    galat: ['ORA-02054', 'ORA-02059', 'ORA-01591'],
    catatan: ['Butuh hak FORCE ANY TRANSACTION di SEMUA situs yang terlibat (Langkah 2).'],
  }),
  "UPDATE PASIEN SET NO_HP = '081299990003' WHERE ID_PASIEN = 3;",
  `UPDATE PASIEN@SITUS_${BDG.kode} SET NO_HP = '081299990003' WHERE ID_PASIEN = 3;`,
  '-- Titik kegagalan 7: situs Bandung sudah commit, situs pusat tertinggal di PREPARED.',
  "COMMIT COMMENT 'ORA-2PC-CRASH-TEST-7';",
  '',
  '-- Catatan in-doubt ditulis ke DBA_2PC_PENDING secara ASINKRON (beberapa detik); tunggu dulu:',
  'DECLARE',
  '  n NUMBER;',
  'BEGIN',
  '  FOR i IN 1 .. 60 LOOP',
  "    SELECT COUNT(*) INTO n FROM dba_2pc_pending WHERE state = 'prepared';",
  '    EXIT WHEN n > 0;',
  '    DBMS_SESSION.SLEEP(1);',
  '  END LOOP;',
  'END;',
  '/',
  '',
  'COLUMN local_tran_id NEW_VALUE id_ragu',
  "SELECT local_tran_id, global_tran_id, state, mixed FROM dba_2pc_pending WHERE state = 'prepared';",
  cek('transaksi tercatat ragu-ragu (prepared) di DBA_2PC_PENDING', `${hitung("dba_2pc_pending WHERE state = 'prepared'")} = 1`),
  '',
  '-- Baris yang dikunci transaksi ragu-ragu tidak bisa dibaca - perintah ini SENGAJA gagal (ORA-01591):',
  'SELECT NO_HP FROM PASIEN WHERE ID_PASIEN = 3;',
  '',
  '-- Sebelum memaksa keputusan, DBA memeriksa keputusan di situs lain:',
  `SELECT state FROM dba_2pc_pending@SITUS_${BDG.kode};`,
  cek('situs Bandung sudah COMMIT, jadi keputusan yang benar adalah COMMIT FORCE', `${hitung(`dba_2pc_pending@SITUS_${BDG.kode} WHERE state = 'committed'`)} = 1`),
  '-- Kueri lewat database link di atas membuka transaksi; tanpa COMMIT ini Oracle menolak COMMIT FORCE (ORA-02043).',
  'COMMIT;',
  "COMMIT FORCE '&id_ragu';",
  '',
  cek('status berubah menjadi forced commit', `${hitung("dba_2pc_pending WHERE state = 'forced commit'")} = 1`),
  cek('data pusat kini sama dengan Bandung', `${hitung("PASIEN WHERE ID_PASIEN = 3 AND NO_HP = '081299990003'")} = 1 AND ${hitung(`PASIEN@SITUS_${BDG.kode} WHERE ID_PASIEN = 3 AND NO_HP = '081299990003'`)} = 1`),
  'COMMIT;',
  '-- Catatan "forced commit" tetap tersimpan sampai DBA membersihkannya (Langkah 14d).',
]);

tulis('14c_nyalakan_pemulihan.sql', [
  kepala({
    judul: 'Langkah 14c - Nyalakan kembali pemulihan otomatis (RECO)',
    situs: 'cdb',
    sebagai: 'sys',
  }),
  'ALTER SYSTEM ENABLE DISTRIBUTED RECOVERY;',
]);

tulis('14d_bersihkan_catatan_2pc.sql', [
  kepala({
    judul: 'Langkah 14d - DBA membersihkan catatan transaksi yang sudah diputuskan paksa',
    sub: 'DBMS_TRANSACTION.PURGE_LOST_DB_ENTRY butuh hak SYS; entri forced commit/rollback tidak hilang sendiri.',
    situs: 'jakarta',
    sebagai: 'sys',
  }),
  "SELECT local_tran_id, state FROM dba_2pc_pending;",
  'BEGIN',
  "  FOR t IN (SELECT local_tran_id FROM dba_2pc_pending WHERE state IN ('forced commit', 'forced rollback')) LOOP",
  '    DBMS_TRANSACTION.PURGE_LOST_DB_ENTRY(t.local_tran_id);',
  '    COMMIT;',
  '  END LOOP;',
  'END;',
  '/',
  cek('tidak ada lagi catatan transaksi prepared atau forced di situs pusat', `${hitung("dba_2pc_pending WHERE state IN ('prepared', 'forced commit', 'forced rollback')")} = 0`),
]);

// ============================================= 15 lima tingkat transparansi

const kolomT = 'NAMA_PASIEN, PENYAKIT';
const syaratT = "JENIS_KELAMIN = 'P'";
const jumlahP = db.pasien.rows.filter((r) => r[db.pasien.indexOf('jenis_kelamin')] === 'P').length;
const tingkat = [
  ['1', 'Transparansi fragmentasi', 'Kueri ke relasi global; fragmen maupun situs tidak disebut.', `SELECT ${kolomT} FROM V_PASIEN_NASIONAL WHERE ${syaratT}`],
  ['2', 'Transparansi lokasi', 'Fragmen disebut namanya, situsnya disembunyikan view dan sinonim.', ['JAKARTA', 'BANDUNG', 'SURABAYA'].map((k) => `SELECT ${kolomT} FROM PASIEN_${k} WHERE ${syaratT}`).join('\nUNION ALL\n')],
  ['3', 'Transparansi pemetaan lokal', 'Fragmen DAN lokasinya disebut: partisi lokal dan tabel@database_link.', `SELECT ${kolomT} FROM PASIEN PARTITION (P_JAKARTA) WHERE ${syaratT}\nUNION ALL\nSELECT ${kolomT} FROM PASIEN@SITUS_${BDG.kode} WHERE ${syaratT}\nUNION ALL\nSELECT ${kolomT} FROM PASIEN@SITUS_${SBY.kode} WHERE ${syaratT}`],
];
tulis('15_transparansi_lima_tingkat.sql', [
  kepala({
    judul: 'Langkah 15 - Satu kueri pada tingkat-tingkat transparansi',
    sub: 'Hasil setiap tingkat wajib sama; yang berbeda hanya seberapa banyak lokasi yang harus ditulis.',
    situs: 'jakarta',
    sebagai: 'rs_app',
    catatan: [
      'Notasi modul "SELECT ... FROM PASIEN_JAKARTA AT SITE S1" BUKAN sintaks Oracle.',
      'Padanannya di Oracle adalah tingkat 3 di bawah: nama_tabel@database_link.',
    ],
  }),
  ...tingkat.map(([no, nama, ket, sql]) => [
    `-- TINGKAT ${no}: ${nama}`,
    `-- ${ket}`,
    `${sql};`,
    cek(`tingkat ${no} (${nama}) menghasilkan ${jumlahP} pasien perempuan`, `${hitung(`(${sql})`)} = ${jumlahP}`),
    '',
  ].join('\n')),
  '-- TINGKAT 4: Transparansi replikasi',
  '-- Aplikasi membaca salinan terdekat lewat sinonim; ia tidak tahu salinan mana yang dipakai.',
  `CREATE OR REPLACE SYNONYM DOKTER_TERDEKAT FOR MV_DOKTER@SITUS_${BDG.kode};`,
  'SELECT NAMA_DOKTER, SPESIALIS FROM DOKTER_TERDEKAT;',
  cek('replika dokter terbaca lewat sinonim', `${hitung('DOKTER_TERDEKAT')} = ${db.dokter.cardinality}`),
  '',
  '-- TINGKAT 5: Tanpa transparansi - aplikasi sendiri yang merutekan ke setiap situs',
  '-- (tiga kueri terpisah, digabung oleh aplikasi):',
  `SELECT ${kolomT} FROM PASIEN PARTITION (P_JAKARTA) WHERE ${syaratT};`,
  `SELECT ${kolomT} FROM PASIEN@SITUS_${BDG.kode} WHERE ${syaratT};`,
  `SELECT ${kolomT} FROM PASIEN@SITUS_${SBY.kode} WHERE ${syaratT};`,
]);

// ============================================= 16 rencana eksekusi

tulis('16_rencana_eksekusi.sql', [
  kepala({
    judul: 'Langkah 16 - Membaca rencana eksekusi',
    sub: 'Bukti partition pruning (reduksi lokalisasi) dan operasi REMOTE.',
    situs: 'jakarta',
    sebagai: 'rs_app',
  }),
  "EXEC DBMS_STATS.GATHER_SCHEMA_STATS('RS_APP', cascade => TRUE);",
  '',
  "EXPLAIN PLAN SET STATEMENT_ID = 'pruning' FOR SELECT * FROM PASIEN WHERE KOTA = 'Jakarta';",
  "SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, 'pruning', 'BASIC +PARTITION'));",
  cek('predikat kota memangkas akses ke SATU partisi', `${hitung("plan_table WHERE statement_id = 'pruning' AND operation = 'PARTITION LIST' AND options = 'SINGLE'")} = 1`),
  '',
  "EXPLAIN PLAN SET STATEMENT_ID = 'semua' FOR SELECT * FROM PASIEN;",
  "SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, 'semua', 'BASIC +PARTITION'));",
  cek('tanpa predikat, SELURUH partisi dibaca', `${hitung("plan_table WHERE statement_id = 'semua' AND operation = 'PARTITION LIST' AND options = 'ALL'")} = 1`),
  '',
  "EXPLAIN PLAN SET STATEMENT_ID = 'remote' FOR",
  `SELECT p.NAMA_PASIEN, d.ID_DAFTAR FROM PASIEN p JOIN DAFTAR@SITUS_${BDG.kode} d ON p.ID_PASIEN = d.ID_PASIEN;`,
  "SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, 'remote', 'BASIC +REMOTE'));",
  cek('join lintas situs memuat operasi REMOTE', `${hitung("plan_table WHERE statement_id = 'remote' AND operation = 'REMOTE'")} >= 1`),
  "SELECT other FROM plan_table WHERE statement_id = 'remote' AND operation = 'REMOTE';",
  '-- Kolom OTHER di atas berisi SQL yang benar-benar dikirim ke situs Bandung.',
]);

// ============================================= 17 diagnosa

tulis('17_diagnosa.sql', [
  kepala({
    judul: 'Langkah 17 - Diagnosa DBA: transaksi menggantung, kunci, dan deadlock',
    situs: 'jakarta',
    sebagai: 'rs_app',
  }),
  O.twoPhaseDiagnostics(),
  '',
  '-- Siapa menunggu siapa (wait-for graph versi Oracle):',
  'SELECT s.sid, s.username, s.blocking_session, s.event, s.seconds_in_wait',
  '  FROM v$session s',
  ' WHERE s.blocking_session IS NOT NULL;',
  '',
  cek('tidak ada transaksi yang masih menggantung', `${hitung("dba_2pc_pending WHERE state = 'prepared'")} = 0`),
  cek('seluruh objek RS_APP valid', `${hitung("user_objects WHERE status <> 'VALID'")} = 0`),
]);

// ============================================================ README

const urutan = berkas.map((b) => {
  const nama = b.replace(/\.sql$/, '');
  return nama;
});

tulis('00_URUTAN_JALANKAN.md', [
  '# Skrip Oracle ORACLEDECK',
  '',
  'Dihasilkan otomatis dari mesin yang sama dengan situs (`node tools/gen_oracle.js`).',
  'Jangan disunting manual; ubah `tools/gen_oracle.js` atau `engine/oracle/emit.js`.',
  '',
  '## Topologi',
  '',
  'Tiga situs = tiga basis data (pluggable database) yang terhubung database link:',
  '',
  '| Situs | Basis data | Isi |',
  '|---|---|---|',
  '| Jakarta (pusat) | PDB bawaan (`FREEPDB1` di Oracle Free, `XEPDB1` di XE) | skema global, partisi per situs, view global, sumber replikasi |',
  '| Bandung | PDB `BANDUNG` | fragmen PASIEN & DAFTAR kota Bandung, materialized view DOKTER |',
  '| Surabaya | PDB `SURABAYA` | fragmen PASIEN & DAFTAR kota Surabaya |',
  '',
  '## Sudah diuji di Oracle sungguhan',
  '',
  'Seluruh skrip dijalankan otomatis oleh `node tools/uji_oracle.mjs` pada container',
  '`gvenzl/oracle-free:23-slim`. Hasil lengkap, termasuk setiap pemeriksaan LULUS/GAGAL',
  'dan log keluaran SQL*Plus, ada di [`HASIL_UJI.md`](HASIL_UJI.md) dan folder `bukti/`.',
  '',
  '## Urutan menjalankan',
  '',
  'Baris `-- @jalankan situs=... sebagai=...` di awal tiap berkas menyebut di mana dan sebagai',
  'siapa skrip dijalankan. Variabel substitusi SQL*Plus yang dipakai:',
  '',
  '| Variabel | Contoh | Keterangan |',
  '|---|---|---|',
  '| `&&sandi_rs_app` | (rahasia) | sandi RS_APP dan PDB_ADMIN — tidak pernah ditulis di berkas |',
  '| `&&situs` | `BANDUNG` | nama situs saat Langkah 2 dijalankan |',
  '| `&&dir_data` | `/opt/oracle/oradata` | folder berkas data |',
  '| `&&tns_jakarta` | `//localhost:1521/FREEPDB1` | alamat situs pusat |',
  '| `&&tns_bandung` | `//localhost:1521/BANDUNG` | alamat situs Bandung |',
  '| `&&tns_surabaya` | `//localhost:1521/SURABAYA` | alamat situs Surabaya |',
  '',
  '| # | Berkas |',
  '|---|---|',
  ...urutan.map((n, i) => `| ${i + 1} | \`${n}.sql\` |`),
  '',
  '## Menjalankan otomatis',
  '',
  '```bash',
  'node tools/uji_oracle.mjs',
  '```',
  '',
  'Runner membuat container bila belum ada, menyiapkan tiga situs dari nol, menjalankan setiap',
  'skrip di situs yang benar, lalu menulis `HASIL_UJI.md`. Ia gagal bila ada pemeriksaan GAGAL,',
  'galat yang tidak diharapkan, atau galat peragaan yang tidak muncul.',
]);

process.stdout.write(`${berkas.length} berkas ditulis ke oracle/\n`);
