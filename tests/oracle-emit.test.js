import { grup, uji, sama, benar, melempar, memuat, tidakMemuat } from './harness.js';
import { Relation } from '../engine/core/relation.js';
import { rumahsakit, RS_KEYS, dreamhome, DEFAULT_SITES } from '../engine/data/datasets.js';
import * as O from '../engine/oracle/emit.js';

grup('oracle/emit — identifier & literal');

uji('ident mengubah nama menjadi huruf besar', () => {
  sama(O.ident('id_pasien'), 'ID_PASIEN');
});

uji('ident mengutip kata kunci Oracle', () => {
  sama(O.ident('select'), '"SELECT"');
  sama(O.ident('date'), '"DATE"');
  sama(O.ident('number'), '"NUMBER"');
});

uji('ident mengutip nama yang mengandung karakter asing', () => {
  sama(O.ident('nama pasien'), '"NAMA PASIEN"');
  sama(O.ident('2tabel'), '"2TABEL"');
});

uji('ident menolak nama melebihi 128 karakter', () => {
  melempar(() => O.ident('a'.repeat(129)), '128 karakter');
});

uji('literal membungkus teks dan meloloskan petik tunggal', () => {
  sama(O.literal("O'Brien"), "'O''Brien'");
  sama(O.literal(42), '42');
  sama(O.literal(null), 'NULL');
  sama(O.literal('2025-09-01'), "DATE '2025-09-01'");
});

grup('oracle/emit — tipe kolom');

uji('inferType mengenali tanggal dan angka', () => {
  sama(O.inferType(['2025-01-01', '2025-02-02']), 'DATE');
  sama(O.inferType([1, 2, 300]), 'NUMBER(3)');
  sama(O.inferType([1.5, 2.25]), 'NUMBER(12,2)');
});

uji('inferType tidak pernah menjadikan nomor telepon sebagai NUMBER', () => {
  memuat(O.inferType(['081234567001'], 'no_hp'), 'VARCHAR2');
  memuat(O.inferType(['3201012345670001'], 'nik'), 'VARCHAR2');
  memuat(O.inferType(['12.345.678.9-012.000'], 'npwp'), 'VARCHAR2');
});

uji('inferType menjaga angka berawalan nol tetap teks', () => {
  memuat(O.inferType(['0812', '0813']), 'VARCHAR2');
});

uji('inferType memberi lebar wajar untuk kolom pendek', () => {
  sama(O.inferType(['L', 'P']), 'VARCHAR2(1)');
});

uji('inferType untuk kolom kosong memakai lebar aman', () => {
  sama(O.inferType([null, undefined, '']), 'VARCHAR2(100)');
});

grup('oracle/emit — DDL');

const db = () => rumahsakit();

uji('createTable menghasilkan kolom, PK, dan tablespace', () => {
  const sql = O.createTable(db().pasien, { pk: RS_KEYS.pasien.pk, tablespace: 'TS_S1' });
  memuat(sql, 'CREATE TABLE PASIEN');
  memuat(sql, 'ID_PASIEN');
  memuat(sql, 'CONSTRAINT PK_PASIEN PRIMARY KEY (ID_PASIEN)');
  memuat(sql, 'TABLESPACE TS_S1');
  memuat(sql, 'NOT NULL');
});

uji('createTable menuliskan foreign key dan ON DELETE', () => {
  const sql = O.createTable(db().pasien_dokter, {
    pk: RS_KEYS.pasien_dokter.pk,
    fk: RS_KEYS.pasien_dokter.fk.map((f) => ({ ...f, onDelete: 'CASCADE' })),
  });
  memuat(sql, 'FOREIGN KEY (ID_DOKTER)');
  memuat(sql, 'REFERENCES DOKTER (ID_DOKTER) ON DELETE CASCADE');
});

uji('createTable menuliskan CHECK constraint', () => {
  const sql = O.createTable(db().pasien, { pk: ['id_pasien'], check: [{ nama: 'CK_JK', ekspresi: "JENIS_KELAMIN IN ('L','P')" }] });
  memuat(sql, "CONSTRAINT CK_JK CHECK (JENIS_KELAMIN IN ('L','P'))");
});

uji('createTable menerima pemetaan tipe eksplisit', () => {
  const sql = O.createTable(db().pasien, { pk: ['id_pasien'], tipe: { nama_pasien: 'VARCHAR2(120)' } });
  memuat(sql, 'VARCHAR2(120)');
});

grup('oracle/emit — partisi');

uji('partitionClause LIST menaruh tiap fragmen di tablespace situsnya', () => {
  const c = O.partitionClause({
    tipe: 'LIST', kolom: 'kota',
    partisi: [{ nama: 'P_JKT', nilai: ['Jakarta'], tablespace: 'TS_S1' }],
    default: 'P_LAIN',
  });
  memuat(c, 'PARTITION BY LIST (KOTA)');
  memuat(c, "PARTITION P_JKT VALUES ('Jakarta') TABLESPACE TS_S1");
  memuat(c, 'VALUES (DEFAULT)');
});

uji('partitionClause RANGE menambahkan partisi MAXVALUE', () => {
  const c = O.partitionClause({ tipe: 'RANGE', kolom: 'tanggal', partisi: [{ nama: 'P2025', batas: '2026-01-01' }] });
  memuat(c, 'VALUES LESS THAN (DATE \'2026-01-01\')');
  memuat(c, 'MAXVALUE');
});

uji('partitionClause HASH menyebut jumlah partisi', () => {
  memuat(O.partitionClause({ tipe: 'HASH', kolom: 'id', jumlah: 4, tablespaces: ['TS_A', 'TS_B'] }), 'PARTITIONS 4');
});

uji('partitionClause REFERENCE memakai nama constraint', () => {
  sama(O.partitionClause({ tipe: 'REFERENCE', constraint: 'fk_anak' }), 'PARTITION BY REFERENCE (FK_ANAK)');
});

uji('partitionClause INTERVAL menghasilkan partisi otomatis', () => {
  memuat(O.partitionClause({ tipe: 'INTERVAL', kolom: 'tgl', interval: "NUMTOYMINTERVAL(1,'MONTH')", awal: { nama: 'P0', batas: '2025-01-01' } }), 'INTERVAL (');
});

uji('partitionClause menolak tipe tidak dikenal', () => {
  melempar(() => O.partitionClause({ tipe: 'ACAK' }), 'tidak dikenal');
});

uji('horizontalAsPartitions memetakan fragmen ke partisi', () => {
  const sql = O.horizontalAsPartitions(db().pasien, 'kota', [
    { nama: 'P_JAKARTA', nilai: ['Jakarta'], situs: 'S1' },
    { nama: 'P_BANDUNG', nilai: ['Bandung'], situs: 'S2' },
  ], { pk: ['id_pasien'] });
  memuat(sql, 'PARTITION P_JAKARTA');
  memuat(sql, 'TABLESPACE TS_S1');
  memuat(sql, 'TABLESPACE TS_S2');
});

uji('derivedAsReferencePartition memakai reference partitioning', () => {
  const sql = O.derivedAsReferencePartition(db().pasien_dokter, 'fk_pd_pasien', { pk: ['id'] });
  memuat(sql, 'PARTITION BY REFERENCE (FK_PD_PASIEN)');
});

grup('oracle/emit — fragmentasi vertikal & link');

uji('verticalAsTables menyertakan kunci di tiap tabel', () => {
  const { STAFF } = dreamhome();
  const v = O.verticalAsTables(STAFF, [
    { nama: 'S1_STAFF', atribut: ['position', 'salary'], situs: 'S3' },
    { nama: 'S2_STAFF', atribut: ['fname', 'lname'], situs: 'S5' },
  ], 'staffno');
  sama(v.tabel.length, 2);
  v.tabel.forEach((t) => memuat(t, 'STAFFNO'));
  memuat(v.tabel[1], 'REFERENCES S1_STAFF');
});

uji('verticalAsTables membuat VIEW perekat yang menjoin atas kunci', () => {
  const { STAFF } = dreamhome();
  const v = O.verticalAsTables(STAFF, [
    { nama: 'S1_STAFF', atribut: ['position', 'salary'] },
    { nama: 'S2_STAFF', atribut: ['fname', 'lname'] },
  ], 'staffno');
  memuat(v.view, 'CREATE OR REPLACE VIEW STAFF AS');
  memuat(v.view, 'JOIN S2_STAFF ON S1_STAFF.STAFFNO = S2_STAFF.STAFFNO;');
  sama((v.view.match(/;/g) || []).length, 1);
});

uji('createDatabaseLink menghasilkan link dan uji sambungan', () => {
  const sql = O.createDatabaseLink({ nama: 'SITUS_BANDUNG', user: 'rs_app', tns: 'bandung_db' });
  memuat(sql, 'CREATE DATABASE LINK SITUS_BANDUNG');
  memuat(sql, "USING 'bandung_db'");
  memuat(sql, 'SELECT SYSDATE FROM dual@SITUS_BANDUNG;');
});

uji('createDatabaseLink publik menambahkan kata PUBLIC', () => {
  memuat(O.createDatabaseLink({ nama: 'L', user: 'u', tns: 't', publik: true }), 'CREATE PUBLIC DATABASE LINK');
});

uji('createDatabaseLink tidak menuliskan sandi polos bila tidak diberikan', () => {
  memuat(O.createDatabaseLink({ nama: 'L', user: 'u', tns: 't' }), '&sandi_situs');
});

uji('locationTransparencySynonyms membuat sinonim ke objek jauh', () => {
  const sql = O.locationTransparencySynonyms([{ alias: 'PASIEN', objek: 'PASIEN', link: 'SITUS_BANDUNG', publik: true }]);
  memuat(sql, 'CREATE OR REPLACE PUBLIC SYNONYM PASIEN FOR PASIEN@SITUS_BANDUNG;');
});

uji('unionAllView menyusun program lokalisasi horizontal', () => {
  const sql = O.unionAllView('PASIEN', [
    { objek: 'PASIEN_JKT' },
    { objek: 'PASIEN_BDG', link: 'SITUS_BANDUNG', predikat: "KOTA = 'Bandung'" },
  ]);
  memuat(sql, 'CREATE OR REPLACE VIEW PASIEN AS');
  memuat(sql, 'UNION ALL');
  memuat(sql, 'PASIEN_BDG@SITUS_BANDUNG');
  memuat(sql, 'partition pruning');
});

grup('oracle/emit — replikasi & transaksi');

uji('materializedView membuat MV log dan MV', () => {
  const sql = O.materializedView({ nama: 'MV_DOKTER', sumber: 'DOKTER', link: 'SITUS_JKT', kunci: ['id_dokter'], refresh: 'FAST', jadwal: 'ON COMMIT' });
  memuat(sql, 'CREATE MATERIALIZED VIEW LOG ON DOKTER@SITUS_JKT');
  memuat(sql, 'REFRESH FAST ON COMMIT');
  memuat(sql, 'DBMS_MVIEW.REFRESH');
  memuat(sql, 'EXPLAIN_MVIEW');
});

uji('materializedView dengan jadwal berkala menyertakan NEXT', () => {
  const sql = O.materializedView({ nama: 'MV', sumber: 'T', kunci: ['id'], jadwal: 'START WITH', interval: 'SYSDATE + 1/24' });
  memuat(sql, 'START WITH SYSDATE NEXT SYSDATE + 1/24');
});

uji('materializedView dengan predikat menyaring baris yang direplikasi', () => {
  memuat(O.materializedView({ nama: 'MV', sumber: 'T', kunci: ['id'], predikat: "KOTA = 'Bandung'" }), "WHERE KOTA = 'Bandung'");
});

uji('refreshGroup menyegarkan beberapa MV dalam satu transaksi', () => {
  const sql = O.refreshGroup('RG_RS', ['MV_A', 'MV_B']);
  memuat(sql, 'DBMS_REFRESH.MAKE');
  memuat(sql, "list        => 'MV_A,MV_B'");
  memuat(sql, 'SATU transaksi');
});

uji('distributedTransaction memakai satu COMMIT untuk memicu 2PC', () => {
  const sql = O.distributedTransaction({
    situs: ['S1', 'S2'],
    operasi: [{ situs: 'S1', sql: 'UPDATE a SET x = 1' }, { situs: 'S2', sql: 'UPDATE b@L SET y = 2;' }],
  });
  memuat(sql, "SET TRANSACTION NAME 'TRX_LINTAS_SITUS'");
  memuat(sql, 'UPDATE a SET x = 1;');
  memuat(sql, 'UPDATE b@L SET y = 2;');
  memuat(sql, 'COMMIT;');
  memuat(sql, 'COMMIT_POINT_STRENGTH');
  sama((sql.match(/^COMMIT;$/gm) || []).length, 1);
});

uji('twoPhaseDiagnostics menyebut tampilan diagnosa Oracle', () => {
  const sql = O.twoPhaseDiagnostics();
  memuat(sql, 'dba_2pc_pending');
  memuat(sql, 'dba_2pc_neighbors');
  memuat(sql, 'v$lock');
  memuat(sql, 'ORA-00060');
});

grup('oracle/emit — rencana & indeks');

uji('explainPlan membungkus kueri dan menampilkan rencana', () => {
  const sql = O.explainPlan('SELECT * FROM pasien WHERE kota = \'Jakarta\';', { nama: 'r1' });
  memuat(sql, "EXPLAIN PLAN SET STATEMENT_ID = 'r1' FOR");
  memuat(sql, 'DBMS_XPLAN.DISPLAY');
  memuat(sql, 'PSTART/PSTOP');
  tidakMemuat(sql, "'Jakarta';\n;");
});

uji('partitionedIndexes membedakan LOCAL dan GLOBAL', () => {
  const sql = O.partitionedIndexes('PASIEN', {
    lokal: [{ nama: 'IX_PASIEN_KOTA', kolom: ['kota'] }],
    global: [{ nama: 'IX_PASIEN_HP', kolom: ['no_hp'], partisi: 4 }],
  });
  memuat(sql, 'CREATE INDEX IX_PASIEN_KOTA ON PASIEN (KOTA) LOCAL;');
  memuat(sql, 'GLOBAL PARTITION BY HASH');
  memuat(sql, 'UNUSABLE');
});

uji('pruningProof menunjukkan kueri satu partisi dan pembandingnya', () => {
  const sql = O.pruningProof('PASIEN', 'kota', 'Jakarta');
  memuat(sql, "WHERE KOTA = 'Jakarta'");
  memuat(sql, 'PARTITION (P_JAKARTA)');
  sama((sql.match(/EXPLAIN PLAN/g) || []).length, 2);
});

grup('oracle/emit — INSERT & paket lengkap');

uji('insertRows memakai INSERT ALL secara baku', () => {
  const sql = O.insertRows(db().administrator);
  memuat(sql, 'INSERT ALL');
  memuat(sql, 'SELECT * FROM dual;');
  sama((sql.match(/INTO ADMINISTRATOR/g) || []).length, 4);
});

uji('insertRows dapat menghasilkan INSERT satu per satu', () => {
  const sql = O.insertRows(db().administrator, { batch: false });
  sama((sql.match(/^INSERT INTO/gm) || []).length, 4);
});

uji('insertRows atas relasi kosong memberi komentar', () => {
  memuat(O.insertRows(new Relation('K', ['a'], [])), 'tidak ada baris contoh');
});

uji('emitFullDesign menyusun paket lengkap', () => {
  const sql = O.emitFullDesign({
    relasi: db().pasien,
    kunci: 'id_pasien',
    fragmentasi: { tipe: 'horizontal', kolom: 'kota', partisi: [{ nama: 'P_JKT', nilai: ['Jakarta'], situs: 'S1' }] },
    situs: DEFAULT_SITES,
    link: [{ nama: 'SITUS_BANDUNG', user: 'rs', tns: 'bdg' }],
    replikasi: [{ nama: 'MV_DOKTER', sumber: 'DOKTER', kunci: ['id_dokter'] }],
  });
  memuat(sql, 'CREATE TABLESPACE TS_S1');
  memuat(sql, 'CREATE DATABASE LINK SITUS_BANDUNG');
  memuat(sql, 'PARTITION BY LIST');
  memuat(sql, 'CREATE MATERIALIZED VIEW MV_DOKTER');
  memuat(sql, 'dba_2pc_pending');
});

uji('emitFullDesign menangani fragmentasi vertikal', () => {
  const { STAFF } = dreamhome();
  const sql = O.emitFullDesign({
    relasi: STAFF,
    kunci: 'staffno',
    fragmentasi: { tipe: 'vertikal', grup: [{ nama: 'V1', atribut: ['position'] }, { nama: 'V2', atribut: ['fname'] }] },
    situs: DEFAULT_SITES,
  });
  memuat(sql, 'CREATE OR REPLACE VIEW STAFF AS');
});
