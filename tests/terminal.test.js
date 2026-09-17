// terminal.test.js — sesi terminal SQL: DDL, kendala, transaksi, kamus data,
// preset terdistribusi (database link, 2PC, transaksi ragu-ragu), perintah meta,
// pratinjau langsung, dan pelengkap otomatis.

import { grup, uji, sama, benar, salah, melempar, memuat, tidakMemuat } from './harness.js';
import * as T from '../engine/core/terminal.js';
import { parse, parseScript, query, SqlError } from '../engine/core/sql.js';
import { CONTOH } from '../src/content/contoh-sql.js';
import { KASUS_GALAT } from '../src/content/kasus-galat-oracle.js';

const jalan = (sesi, sql) => T.jalankan(sesi, sql).blok;
const satu = (sesi, sql) => {
  const b = jalan(sesi, sql);
  return b[b.length - 1];
};
const galat = (sesi, sql, kode) => {
  const b = satu(sesi, sql);
  sama(b.jenis, 'galat', `${sql} seharusnya galat, dapat ${b.jenis}: ${b.pesan || ''}`);
  if (kode) memuat(b.pesan, kode);
  return b;
};
const hitung = (sesi, sql) => satu(sesi, sql).relation.rows[0][0];

grup('terminal — pemecah masukan & parser perintah sesi');

uji('pecahMasukan memisah titik koma tetapi tidak di dalam string', () => {
  const p = T.pecahMasukan("SELECT 'a;b' FROM dual; SELECT 2 FROM dual;");
  sama(p.map((x) => x.teks), ["SELECT 'a;b' FROM dual", 'SELECT 2 FROM dual']);
});

uji('pecahMasukan memisahkan baris meta dari SQL', () => {
  const p = T.pecahMasukan('SELECT 1 FROM dual;\n\\d\nSELECT 2\nFROM dual');
  sama(p.map((x) => x.jenis), ['sql', 'meta', 'sql']);
  sama(p[2].teks, 'SELECT 2\nFROM dual');
});

uji('pecahMasukan melaporkan string yang tidak ditutup sebagai galat token', () => {
  sama(T.pecahMasukan("SELECT 'abc FROM dual")[0].jenis, 'galat-token');
});

uji('parser mengenali seluruh perintah sesi', () => {
  const tipe = parseScript("CREATE TABLE t (a NUMBER); CREATE OR REPLACE VIEW v AS SELECT 1 FROM dual; CREATE UNIQUE INDEX i ON t (a); DROP TABLE t CASCADE CONSTRAINTS; DROP VIEW v; DROP INDEX i; TRUNCATE TABLE t; COMMIT; ROLLBACK; ROLLBACK TO SAVEPOINT s; SAVEPOINT s; DESC t; DESCRIBE t; EXPLAIN PLAN FOR SELECT 1 FROM dual; COMMIT FORCE '1.2.3'; ROLLBACK FORCE '1.2.3'").map((x) => x.type);
  sama(tipe, ['create_table', 'create_view', 'create_index', 'drop_table', 'drop_view', 'drop_index', 'truncate', 'commit', 'rollback', 'rollback', 'savepoint', 'describe', 'describe', 'explain', 'commit', 'rollback']);
});

uji('parser CREATE TABLE membaca tipe, kendala kolom, dan kendala tabel', () => {
  const a = parse("CREATE TABLE t (id NUMBER(5) PRIMARY KEY, nama VARCHAR2(20) NOT NULL DEFAULT 'x', jk CHAR(1) CHECK (jk IN ('L','P')), ref NUMBER REFERENCES induk(id) ON DELETE SET NULL, CONSTRAINT uq UNIQUE (nama), CONSTRAINT fk2 FOREIGN KEY (ref) REFERENCES induk ON DELETE CASCADE)");
  sama(a.pk, ['id']);
  sama(a.kolom[0].panjang, 5);
  benar(a.kolom[1].notNull);
  sama(a.kolom[1].default.v, 'x');
  sama(a.cek.length, 1);
  sama(a.fk.map((f) => f.onDelete), ['SET NULL', 'CASCADE']);
  sama(a.fk[1].refCols, null);
  sama(a.unik[0].nama, 'uq');
});

uji('parser menolak primary key ganda dan aturan rujukan asing', () => {
  melempar(() => parse('CREATE TABLE t (a NUMBER PRIMARY KEY, b NUMBER PRIMARY KEY)'), 'ORA-02260');
  melempar(() => parse('CREATE TABLE t (a NUMBER REFERENCES x ON DELETE HAPUS)'), 'Aturan rujukan');
});

uji('tokenizer membaca nama objek remote tabel@link', () => {
  const a = parse('SELECT p.kota, pasien@bdg.nama FROM pasien@bdg p');
  sama(a.from[0].table, 'pasien@bdg');
  sama(a.items[1].expr.table, 'pasien@bdg');
});

uji('literal DATE dan TIMESTAMP diterima', () => {
  sama(query("SELECT DATE '2025-09-01' AS d FROM dual", {}).rows, [['2025-09-01']]);
});

uji('execute menolak perintah sesi dengan pesan yang mengarahkan ke terminal', () => {
  melempar(() => query('COMMIT', {}), 'perintah sesi');
});

grup('terminal — kueri, DML, dan transaksi');

uji('sesi rumahsakit menjalankan SELECT dan melaporkan waktu', () => {
  const s = T.buatSesi('rumahsakit');
  const b = satu(s, 'SELECT COUNT(*) FROM pasien');
  sama(b.jenis, 'hasil');
  sama(b.relation.rows, [[12]]);
  benar(b.ms >= 0);
});

uji('galat satu perintah tidak menghentikan perintah berikutnya', () => {
  const s = T.buatSesi('rumahsakit');
  const b = jalan(s, 'SELECT * FROM hantu; SELECT COUNT(*) FROM dokter');
  sama(b.map((x) => x.jenis), ['galat', 'hasil']);
});

uji('autocommit mati: ROLLBACK membatalkan DML', () => {
  const s = T.buatSesi('rumahsakit');
  jalan(s, 'DELETE FROM pasien_dokter WHERE biaya > 400000');
  benar(s.tertunda > 0);
  benar(T.promptSesi(s).includes('*'));
  jalan(s, 'ROLLBACK');
  sama(hitung(s, 'SELECT COUNT(*) FROM pasien_dokter'), 14);
  sama(s.tertunda, 0);
});

uji('COMMIT membuat perubahan bertahan setelah ROLLBACK', () => {
  const s = T.buatSesi('rumahsakit');
  jalan(s, "UPDATE pasien SET kota = 'Depok' WHERE id_pasien = 1; COMMIT; ROLLBACK");
  sama(hitung(s, "SELECT COUNT(*) FROM pasien WHERE kota = 'Depok'"), 1);
});

uji('SAVEPOINT dan ROLLBACK TO membatalkan sebagian transaksi', () => {
  const s = T.buatSesi('rumahsakit');
  jalan(s, "DELETE FROM daftar WHERE id_daftar = 1; SAVEPOINT a; DELETE FROM daftar WHERE id_daftar = 2; ROLLBACK TO a");
  sama(hitung(s, 'SELECT COUNT(*) FROM daftar'), 11);
  sama(s.tertunda, 1);
  galat(s, 'ROLLBACK TO b', 'ORA-01086');
});

uji('CASCADE preset rumahsakit melaporkan tabel anak yang ikut terhapus', () => {
  const s = T.buatSesi('rumahsakit');
  const b = satu(s, 'DELETE FROM pasien WHERE id_pasien = 1');
  memuat(b.detail.join(' '), 'ON DELETE CASCADE');
  sama(hitung(s, 'SELECT COUNT(*) FROM pasien_dokter WHERE id_pasien = 1'), 0);
});

uji('DELETE tanpa WHERE diberi peringatan dan jumlah baris', () => {
  const s = T.buatSesi('akademik');
  const b = satu(s, 'DELETE FROM nilai');
  sama(b.pesan, '7 baris dihapus.');
  memuat(b.detail.join(' '), 'SELURUH');
});

uji('\\kunci restrict membuat DELETE induk ditolak dengan petunjuk', () => {
  const s = T.buatSesi('rumahsakit');
  jalan(s, '\\kunci restrict');
  const b = galat(s, 'DELETE FROM pasien WHERE id_pasien = 1', 'ORA-02292');
  memuat(b.petunjuk.join(' '), '\\kunci cascade');
});

uji('CHECK preset menolak jenis kelamin di luar L/P', () => {
  const s = T.buatSesi('rumahsakit');
  galat(s, "UPDATE pasien SET jenis_kelamin = 'X' WHERE id_pasien = 1", 'ORA-02290');
});

uji('tipe preset: VARCHAR2(60) menolak nama 61 karakter, NUMBER menolak teks', () => {
  const s = T.buatSesi('rumahsakit');
  galat(s, `UPDATE pasien SET nama_pasien = '${'x'.repeat(61)}' WHERE id_pasien = 1`, 'ORA-12899');
  galat(s, "UPDATE pasien_dokter SET biaya = 'mahal' WHERE id = 1", 'ORA-01722');
});

grup('terminal — DDL');

uji('CREATE TABLE lalu INSERT menegakkan NOT NULL, panjang, presisi, CHECK, UNIQUE, dan DEFAULT', () => {
  const s = T.buatSesi('kosong');
  sama(satu(s, "CREATE TABLE produk (kode VARCHAR2(5) PRIMARY KEY, nama VARCHAR2(10) NOT NULL UNIQUE, harga NUMBER(6,2) CHECK (harga > 0), stok NUMBER(3) DEFAULT 0)").pesan, 'Tabel dibuat.');
  sama(satu(s, "INSERT INTO produk (kode, nama, harga) VALUES ('P1', 'Pena', 2500.456)").pesan, '1 baris disisipkan.');
  sama(satu(s, 'SELECT harga, stok FROM produk').relation.rows, [[2500.46, 0]]);
  galat(s, "INSERT INTO produk (kode, harga) VALUES ('P2', 1)", 'ORA-01400');
  galat(s, "INSERT INTO produk (kode, nama, harga) VALUES ('P3', 'Pensil warna', 1)", 'ORA-12899');
  galat(s, "INSERT INTO produk (kode, nama, harga) VALUES ('P4', 'Buku', 12345.5)", 'ORA-01438');
  galat(s, "INSERT INTO produk (kode, nama, harga) VALUES ('P5', 'Buku', -1)", 'ORA-02290');
  galat(s, "INSERT INTO produk (kode, nama, harga) VALUES ('P6', 'Pena', 1)", 'ORA-00001');
  galat(s, "INSERT INTO produk (kode, nama, harga) VALUES ('P1', 'Map', 1)", 'ORA-00001');
  galat(s, "INSERT INTO produk (kode, nama, harga) VALUES ('P7', 'Map', 'x')", 'ORA-01722');
});

uji('CHECK dengan NULL tidak dianggap pelanggaran', () => {
  const s = T.buatSesi('kosong');
  jalan(s, 'CREATE TABLE t (a NUMBER CHECK (a > 0))');
  sama(satu(s, 'INSERT INTO t (a) VALUES (NULL)').jenis, 'ok');
});

uji('kolom DATE diurai seperti TO_DATE Oracle: longgar pada pemisah, tegas pada sisa input', () => {
  const s = T.buatSesi('kosong');
  jalan(s, 'CREATE TABLE t (tgl DATE)');
  galat(s, "INSERT INTO t VALUES ('01/09/2025')", 'ORA-01830');
  sama(satu(s, "INSERT INTO t VALUES ('2025/9/1')").jenis, 'ok');
  sama(satu(s, 'SELECT tgl FROM t').relation.rows, [['2025-09-01']]);
  sama(satu(s, "INSERT INTO t VALUES (DATE '2025-09-01')").jenis, 'ok');
});

uji('kunci asing antar tabel buatan sendiri: ORA-02291 dan ON DELETE SET NULL', () => {
  const s = T.buatSesi('kosong');
  jalan(s, 'CREATE TABLE induk (id NUMBER PRIMARY KEY); CREATE TABLE anak (id NUMBER PRIMARY KEY, induk_id NUMBER REFERENCES induk ON DELETE SET NULL)');
  galat(s, 'INSERT INTO anak VALUES (1, 99)', 'ORA-02291');
  jalan(s, 'INSERT INTO induk VALUES (1); INSERT INTO anak VALUES (1, 1); DELETE FROM induk WHERE id = 1');
  sama(satu(s, 'SELECT induk_id FROM anak').relation.rows, [[null]]);
});

uji('validasi DDL: nama dipakai, kolom ganda, VARCHAR2 tanpa panjang, rujukan ke non-kunci', () => {
  const s = T.buatSesi('rumahsakit');
  galat(s, 'CREATE TABLE pasien (a NUMBER)', 'ORA-00955');
  galat(s, 'CREATE TABLE t (a NUMBER, A NUMBER)', 'ORA-00957');
  galat(s, 'CREATE TABLE t (a VARCHAR2)', 'ORA-00906');
  galat(s, 'CREATE TABLE t (a NUMBER REFERENCES pasien(nama_pasien))', 'ORA-02270');
  galat(s, 'CREATE TABLE t (a NUMBER REFERENCES hantu)', 'ORA-00942');
  galat(s, 'CREATE TABLE t (a NUMBER, PRIMARY KEY (b))', 'ORA-00904');
  galat(s, 'CREATE TABLE t (a NUMBER CHECK (b > 1))', 'ORA-02438');
  galat(s, 'CREATE TABLE t (a NUMBER, CHECK (b > 1))', 'ORA-00904');
});

uji('DDL melakukan COMMIT implisit: ROLLBACK sesudahnya tidak membatalkan DML sebelumnya', () => {
  const s = T.buatSesi('akademik');
  const b = jalan(s, 'DELETE FROM nilai WHERE nilai < 80; CREATE TABLE log (a NUMBER); ROLLBACK');
  memuat(b.map((x) => x.pesan).join(' | '), 'Commit implisit');
  sama(hitung(s, 'SELECT COUNT(*) FROM nilai'), 4);
});

uji('DROP TABLE yang masih dirujuk ditolak, CASCADE CONSTRAINTS melepas kunci asing', () => {
  const s = T.buatSesi('akademik');
  galat(s, 'DROP TABLE mhs', 'ORA-02449');
  const b = satu(s, 'DROP TABLE mhs CASCADE CONSTRAINTS');
  sama(b.pesan, 'Tabel dihapus.');
  sama(s.kunci.nilai.fk.length, 1);
  galat(s, 'SELECT * FROM mhs', 'tidak ada');
});

uji('TRUNCATE induk boleh bila semua tabel anak kosong (perilaku Oracle 23ai)', () => {
  const s = T.buatSesi('akademik');
  jalan(s, 'DELETE FROM nilai; COMMIT');
  sama(satu(s, 'TRUNCATE TABLE mhs').jenis, 'ok');
  sama(hitung(s, 'SELECT COUNT(*) FROM mhs'), 0);
});

uji('uraiTanggalOracle menerima bentuk longgar dan menolak dengan kode Oracle', async () => {
  const { uraiTanggalOracle } = await import('../engine/core/dml.js');
  sama(uraiTanggalOracle('20250901'), '2025-09-01');
  sama(uraiTanggalOracle(' 2025-9-1'), '2025-09-01');
  sama(uraiTanggalOracle('99-01-01'), '0099-01-01');
  sama(uraiTanggalOracle('2024-02-29'), '2024-02-29');
  for (const [t, kode] of [['2025--09-01', 'ORA-01843'], ['2025-00-10', 'ORA-01843'], ['2025-01-00', 'ORA-01847'], ['2025-09-01 08:00:00', 'ORA-01830'], ['0-01-01', 'ORA-01841'], ['', 'ORA-01840']]) {
    melempar(() => uraiTanggalOracle(t), kode);
  }
});

uji('TRUNCATE ditolak bila tabel dirujuk, dan tidak bisa di-ROLLBACK', () => {
  const s = T.buatSesi('akademik');
  galat(s, 'TRUNCATE TABLE mhs', 'ORA-02266');
  jalan(s, 'TRUNCATE TABLE nilai; ROLLBACK');
  sama(hitung(s, 'SELECT COUNT(*) FROM nilai'), 0);
});

uji('CREATE TABLE AS SELECT menyalin baris tanpa kendala', () => {
  const s = T.buatSesi('akademik');
  const b = satu(s, 'CREATE TABLE lulus AS SELECT nim, nilai FROM nilai WHERE nilai >= 80');
  memuat(b.detail.join(' '), '4 baris');
  sama(s.kunci.lulus.pk, []);
  sama(hitung(s, 'SELECT COUNT(*) FROM lulus'), 4);
});

uji('VIEW: dibuat, dibaca, OR REPLACE, ditolak untuk DML, dan INVALID setelah tabel dasarnya dihapus', () => {
  const s = T.buatSesi('akademik');
  sama(satu(s, 'CREATE VIEW rekap AS SELECT nim, AVG(nilai) AS rata FROM nilai GROUP BY nim').pesan, 'View dibuat.');
  sama(hitung(s, 'SELECT COUNT(*) FROM rekap'), 3);
  galat(s, 'CREATE VIEW rekap AS SELECT 1 AS x FROM dual', 'ORA-00955');
  sama(satu(s, 'CREATE OR REPLACE VIEW rekap AS SELECT nim FROM mhs').pesan, 'View diganti.');
  sama(hitung(s, 'SELECT COUNT(*) FROM rekap'), 5);
  galat(s, 'DELETE FROM rekap', 'ORA-01732');
  galat(s, 'CREATE VIEW v2 (a, b) AS SELECT nim FROM mhs', 'ORA-01730');
  jalan(s, 'CREATE VIEW vn AS SELECT * FROM nilai');
  const d = satu(s, 'DROP TABLE nilai');
  memuat(d.detail.join(' '), 'INVALID');
  galat(s, 'SELECT * FROM vn', 'ORA-04063');
});

uji('view yang dibuat menyimpan teks kuerinya tanpa awalan CREATE', () => {
  const s = T.buatSesi('akademik');
  jalan(s, 'CREATE VIEW v AS SELECT nim FROM mhs');
  sama(s.view[s.view.length - 1].sql, 'SELECT nim FROM mhs');
});

uji('UNIQUE INDEX gagal pada data ganda dan menegakkan keunikan setelah dibuat', () => {
  const s = T.buatSesi('akademik');
  galat(s, 'CREATE UNIQUE INDEX ix ON nilai (nim)', 'ORA-01452');
  sama(satu(s, 'CREATE UNIQUE INDEX ix ON mhs (nama_mhs)').pesan, 'Indeks dibuat.');
  galat(s, "INSERT INTO mhs VALUES ('1', 'Gita Pranata', 'X')", 'ORA-00001');
  jalan(s, 'DROP INDEX ix');
  sama(satu(s, "INSERT INTO mhs VALUES ('1', 'Gita Pranata', 'X')").jenis, 'ok');
});

grup('terminal — kamus data & DESC');

uji('DESC menampilkan tipe, NOT NULL, kendala, dan tabel perujuk', () => {
  const s = T.buatSesi('rumahsakit');
  const b = satu(s, 'DESC pasien');
  sama(b.jenis, 'tabel');
  sama(b.relation.rows[0], ['ID_PASIEN', 'NOT NULL', 'NUMBER(8)']);
  memuat(b.detail.join(' '), 'Dirujuk oleh: pasien_dokter(id_pasien)');
  memuat(b.detail.join(' '), 'CHECK');
});

uji('DESC objek yang salah ketik memberi saran', () => {
  const s = T.buatSesi('rumahsakit');
  memuat(galat(s, 'DESC pasein', 'ORA-04043').pesan, 'pasien');
});

uji('kamus data user_tables, user_constraints, user_tab_columns dapat dikueri', () => {
  const s = T.buatSesi('rumahsakit');
  sama(hitung(s, 'SELECT COUNT(*) FROM user_tables'), 6);
  sama(hitung(s, "SELECT COUNT(*) FROM user_constraints WHERE constraint_type = 'R'"), 6);
  sama(hitung(s, "SELECT COUNT(*) FROM user_tab_columns WHERE table_name = 'PASIEN'"), 7);
  galat(s, 'DELETE FROM user_tables', 'ORA-01031');
});

grup('terminal — preset terdistribusi');

uji('view global sama dengan gabungan fragmen dan setiap fragmen memenuhi predikatnya', () => {
  const s = T.buatSesi('terdistribusi');
  sama(hitung(s, 'SELECT COUNT(*) FROM pasien'), 12);
  sama(hitung(s, "SELECT COUNT(*) FROM pasien@bandung WHERE kota <> 'Bandung'"), 0);
  sama(hitung(s, 'SELECT COUNT(*) FROM pasien_dokter'), 14);
  sama(hitung(s, 'SELECT COUNT(*) FROM daftar'), 12);
  sama(hitung(s, 'SELECT COUNT(*) FROM dokter_admin'), 8);
});

uji('analisis akses memisahkan situs lokal dan remote', () => {
  const s = T.buatSesi('terdistribusi');
  const b = satu(s, 'SELECT * FROM pasien@bandung');
  sama(b.akses.remote, 1);
  sama(b.akses.barisRemote, 4);
  jalan(s, '\\c bandung');
  sama(satu(s, 'SELECT * FROM pasien@bandung').akses.remote, 0);
  sama(T.promptSesi(s), 'SQL@bandung>');
});

uji('EXPLAIN PLAN menandai akses REMOTE lewat database link', () => {
  const s = T.buatSesi('terdistribusi');
  const b = satu(s, 'EXPLAIN PLAN FOR SELECT p.nama_pasien FROM pasien@jakarta p JOIN pasien_dokter@surabaya pd ON p.id_pasien = pd.id_pasien');
  sama(b.jenis, 'rencana');
  memuat(b.teks, 'REMOTE: pasien_dokter@surabaya');
  memuat(b.teks, 'SCAN: pasien@jakarta p (lokal)');
});

uji('CHECK fragmen menolak baris yang salah situs', () => {
  const s = T.buatSesi('terdistribusi');
  const b = galat(s, "INSERT INTO pasien@bandung (id_pasien, nama_pasien, jenis_kelamin, kota) VALUES (20, 'A', 'L', 'Jakarta')", 'ORA-02290');
  memuat(b.pesan, 'NULL');
  memuat(b.petunjuk.join(' '), 'predikat fragmentasi');
});

uji('PRIMARY KEY yang sama di situs lain lolos tetapi diberi peringatan integritas global', () => {
  const s = T.buatSesi('terdistribusi');
  const b = satu(s, "INSERT INTO pasien@bandung (id_pasien, nama_pasien, jenis_kelamin, kota) VALUES (1, 'Kembar', 'L', 'Bandung')");
  sama(b.jenis, 'ok');
  memuat(b.detail.join(' '), 'juga ada di pasien@jakarta');
});

uji('DML pada view global dan DDL remote ditolak', () => {
  const s = T.buatSesi('terdistribusi');
  memuat(galat(s, "UPDATE pasien SET kota = 'X'", 'ORA-01732').pesan, 'pasien@jakarta');
  galat(s, 'CREATE TABLE t@bandung (a NUMBER)', 'ORA-02021');
  galat(s, 'CREATE TABLE t (a NUMBER REFERENCES pasien@bandung)', 'ORA-02021');
});

uji('COMMIT satu situs memakai commit satu fase', () => {
  const s = T.buatSesi('terdistribusi');
  const b = jalan(s, 'DELETE FROM daftar@bandung WHERE id_daftar = 5; COMMIT');
  salah(b.some((x) => x.jenis === '2pc'));
  memuat(b[1].detail.join(' '), 'satu fase');
});

uji('COMMIT dua situs menjalankan Two-Phase Commit', () => {
  const s = T.buatSesi('terdistribusi');
  const b = jalan(s, 'DELETE FROM daftar@jakarta WHERE id_daftar = 1; DELETE FROM daftar@bandung WHERE id_daftar = 5; COMMIT');
  const tpc = b.find((x) => x.jenis === '2pc');
  benar(Boolean(tpc));
  sama(tpc.keputusan, 'GLOBAL-COMMIT');
  sama(tpc.peserta.sort(), ['bandung', 'jakarta']);
  benar(tpc.jejak.length > 4);
  sama(hitung(s, 'SELECT COUNT(*) FROM daftar'), 10);
});

uji('\\gagal situs: satu VOTE-ABORT membatalkan perubahan di semua situs', () => {
  const s = T.buatSesi('terdistribusi');
  const b = jalan(s, '\\gagal surabaya\nDELETE FROM daftar@jakarta WHERE id_daftar = 1;\nDELETE FROM daftar@surabaya WHERE id_daftar = 9;\nCOMMIT;');
  sama(b.find((x) => x.jenis === '2pc').keputusan, 'GLOBAL-ABORT');
  memuat(b[b.length - 1].pesan, 'ORA-02091');
  sama(hitung(s, 'SELECT COUNT(*) FROM daftar'), 12);
  sama(s.gagal, null);
});

uji('\\gagal koordinator: transaksi ragu-ragu, ORA-01591, lalu COMMIT FORCE', () => {
  const s = T.buatSesi('terdistribusi');
  const b = jalan(s, '\\gagal koordinator\nDELETE FROM daftar@jakarta WHERE id_daftar = 1;\nDELETE FROM daftar@bandung WHERE id_daftar = 5;\nCOMMIT;');
  benar(b.find((x) => x.jenis === '2pc').memblokir);
  memuat(b[b.length - 1].pesan, 'ORA-02054');
  benar(T.promptSesi(s).includes('RAGU'));
  const pending = satu(s, 'SELECT local_tran_id, state FROM dba_2pc_pending');
  sama(pending.relation.cardinality, 1);
  const id = pending.relation.rows[0][0];
  galat(s, 'SELECT COUNT(*) FROM daftar', 'ORA-01591');
  galat(s, 'DELETE FROM daftar@bandung WHERE id_daftar = 6', 'ORA-01591');
  sama(T.pratinjau(s, 'SELECT * FROM daftar@jakarta').jenis, 'galat');
  // tabel yang tidak ikut transaksi tetap bisa dibaca dan diubah
  sama(hitung(s, 'SELECT COUNT(*) FROM pasien'), 12);
  sama(satu(s, "UPDATE pasien@bandung SET penyakit = 'Asma' WHERE id_pasien = 3").jenis, 'ok');
  jalan(s, 'ROLLBACK');
  galat(s, "COMMIT FORCE 'salah'", 'ORA-02058');
  sama(satu(s, `COMMIT FORCE '${id}'`).pesan, 'Commit paksa selesai.');
  sama(hitung(s, 'SELECT COUNT(*) FROM daftar'), 10);
  sama(s.ragu, null);
});

uji('ROLLBACK FORCE mengembalikan data sebelum transaksi ragu-ragu', () => {
  const s = T.buatSesi('terdistribusi');
  jalan(s, '\\gagal koordinator\nDELETE FROM daftar@jakarta WHERE id_daftar = 1;\nDELETE FROM daftar@bandung WHERE id_daftar = 5;\nCOMMIT;');
  const id = s.ragu.id;
  sama(satu(s, `ROLLBACK FORCE '${id}'`).pesan, 'Rollback paksa selesai.');
  sama(hitung(s, 'SELECT COUNT(*) FROM daftar'), 12);
});

grup('terminal — perintah meta, pratinjau, pelengkap, ekspor');

uji('\\d mendaftar tabel dan view, \\d nama sama dengan DESC', () => {
  const s = T.buatSesi('terdistribusi');
  const b = satu(s, '\\d');
  sama(b.relation.cardinality, 24);
  sama(satu(s, '\\d pasien@bandung').jenis, 'tabel');
});

uji('\\db mengganti preset dan membuang perubahan sesi', () => {
  const s = T.buatSesi('rumahsakit');
  const r = T.jalankan(s, '\\db akademik');
  sama(r.sesi.preset, 'akademik');
  sama(query('SELECT COUNT(*) FROM mhs', r.sesi.tabel).rows, [[5]]);
  galat(r.sesi, '\\db hantu', 'tidak ada');
});

uji('\\reset memuat ulang data awal preset yang sama', () => {
  const s = T.buatSesi('akademik');
  jalan(s, 'DELETE FROM nilai; COMMIT');
  const r = T.jalankan(s, '\\reset');
  sama(query('SELECT COUNT(*) FROM nilai', r.sesi.tabel).rows, [[7]]);
});

uji('\\status, \\?, \\clear, dan meta yang salah ketik', () => {
  const s = T.buatSesi('rumahsakit');
  jalan(s, 'DELETE FROM daftar WHERE id_daftar = 1; SAVEPOINT a');
  const st = satu(s, '\\status');
  sama(st.relation.rows[0], ['perubahan tertunda', 1]);
  sama(satu(s, '\\?').jenis, 'tabel');
  sama(satu(s, '\\clear').jenis, 'bersihkan');
  memuat(galat(s, '\\stats').pesan, '\\status');
  galat(s, '\\c bandung', 'terdistribusi');
});

uji('pratinjau hanya membaca: DML tidak dijalankan', () => {
  const s = T.buatSesi('rumahsakit');
  sama(T.pratinjau(s, 'DELETE FROM pasien').jenis, 'info');
  sama(hitung(s, 'SELECT COUNT(*) FROM pasien'), 12);
  const p = T.pratinjau(s, 'SELECT nama_pasien FROM pasien WHERE kota = \'Bandung\'');
  sama(p.relation.cardinality, 4);
  sama(p.relation.attrs, ['nama_pasien']);
});

uji('pratinjau memberi galat plus saran untuk kueri yang belum benar', () => {
  const s = T.buatSesi('rumahsakit');
  const p = T.pratinjau(s, 'SELECT nama_pasen FROM pasien');
  sama(p.jenis, 'galat');
  memuat(p.petunjuk.join(' '), 'nama_pasien');
  sama(T.pratinjau(s, '   '), null);
  sama(T.pratinjau(s, 'SELECT 1 FROM dual; SELECT 2 AS b FROM dual').relation.attrs, ['b']);
});

uji('saranLengkap: nama tabel, kolom lewat alias, dan perintah meta', () => {
  const s = T.buatSesi('rumahsakit');
  benar(T.saranLengkap(s, 'SELECT * FROM pas').kandidat.includes('pasien_dokter'));
  const teks = 'SELECT p.na FROM pasien p';
  const r = T.saranLengkap(s, teks, 'SELECT p.na'.length);
  sama(r.kandidat, ['nama_pasien']);
  sama(r.awal, 'SELECT p.'.length);
  benar(T.saranLengkap(s, '\\st').kandidat.includes('\\status'));
  sama(T.saranLengkap(s, 'SELECT ').kandidat, []);
});

uji('jarakEdit dan saranNama', () => {
  sama(T.jarakEdit('pasein', 'pasien'), 2);
  sama(T.saranNama('dokte', ['dokter', 'daftar', 'pasien']), ['dokter']);
  sama(T.saranNama('zzzzzz', ['dokter']), []);
});

uji('uraiTipe dan tulisTipe saling bolak-balik', () => {
  for (const t of ['NUMBER(12,2)', 'VARCHAR2(60)', 'DATE', 'CHAR(1)']) sama(T.tulisTipe(T.uraiTipe(t)), t);
});

uji('\\ekspor menghasilkan skrip Oracle yang bisa dijalankan ulang dan menghasilkan isi yang sama', () => {
  for (const preset of ['rumahsakit', 'akademik', 'dreamhome', 'kependudukan']) {
    const asal = T.buatSesi(preset);
    const skrip = satu(asal, '\\ekspor').isi;
    memuat(skrip, 'CREATE TABLE');
    const baru = T.buatSesi('kosong');
    const blok = T.jalankan(baru, skrip).blok;
    const gagal = blok.filter((b) => b.jenis === 'galat');
    sama(gagal.length, 0, `${preset}: ${gagal.map((g) => `${g.perintah.slice(0, 60)} -> ${g.pesan}`).join(' | ')}`);
    for (const t of Object.keys(asal.tabel)) {
      sama(query(`SELECT COUNT(*) FROM ${t}`, baru.tabel).rows[0][0], asal.tabel[t].cardinality, `${preset}.${t}`);
    }
  }
});

uji('data setiap preset memenuhi kendalanya sendiri', () => {
  for (const preset of Object.keys(T.PRESET)) {
    const s = T.buatSesi(preset);
    for (const t of Object.keys(s.tabel)) {
      // hapus lalu sisipkan ulang seluruh baris lewat jalur DML yang menegakkan kendala
      const rel = s.tabel[t];
      if (!rel.cardinality) continue;
      const salinan = T.buatSesi('kosong');
      salinan.tabel[t] = rel.constructor ? new rel.constructor(rel.name, rel.attrs, []) : rel;
      salinan.kunci[t] = { ...s.kunci[t], fk: [] };
      const nilai = rel.rows.map((r) => `(${r.map((v) => (v === null ? 'NULL' : typeof v === 'number' ? v : `'${String(v).replace(/'/g, "''")}'`)).join(', ')})`).join(', ');
      const b = satu(salinan, `INSERT INTO ${t} VALUES ${nilai}`);
      sama(b.jenis, 'ok', `${preset}.${t}: ${b.pesan}`);
    }
  }
});

uji('SqlError diekspor untuk pemanggil terminal', () => {
  benar(new SqlError('x') instanceof Error);
  tidakMemuat(T.promptSesi(T.buatSesi('rumahsakit')), '@');
});

grup('terminal — contoh siap jalan di halaman Terminal SQL');

uji('setiap contoh berjalan tanpa galat, kecuali galat yang memang dijanjikan', () => {
  benar(CONTOH.length >= 35);
  for (const c of CONTOH) {
    benar(Boolean(T.PRESET[c.db]), `${c.judul}: preset ${c.db}`);
    const blok = T.jalankan(T.buatSesi(c.db), c.sql).blok;
    const pesanGalat = blok.filter((b) => b.jenis === 'galat').map((b) => b.pesan);
    if (!c.galat) {
      sama(pesanGalat.length, 0, `${c.judul}: ${pesanGalat.join(' | ')}`);
    } else {
      for (const kode of c.galat) benar(pesanGalat.some((p) => p.includes(kode)), `${c.judul}: galat ${kode} tidak muncul (${pesanGalat.join(' | ')})`);
    }
    benar(blok.length > 0, c.judul);
  }
});

uji('contoh yang berisi SELECT menghasilkan baris, bukan tabel kosong yang menyesatkan', () => {
  const bolehKosong = new Set(['Mahasiswa tanpa nilai', 'SAVEPOINT & ROLLBACK TO']);
  for (const c of CONTOH.filter((x) => !x.galat)) {
    const hasil = T.jalankan(T.buatSesi(c.db), c.sql).blok.filter((b) => b.jenis === 'hasil');
    for (const h of hasil) if (!bolehKosong.has(c.judul)) benar(h.relation.cardinality > 0 || /COUNT/i.test(h.perintah), `${c.judul}: ${h.perintah}`);
  }
});

uji('judul contoh unik dan setiap kelompok punya minimal dua contoh', () => {
  sama(new Set(CONTOH.map((c) => c.judul)).size, CONTOH.length);
  const per = {};
  CONTOH.forEach((c) => { per[c.kel] = (per[c.kel] || 0) + 1; });
  Object.entries(per).forEach(([k, n]) => benar(n >= 2, k));
});

grup('terminal — kode galat sama dengan Oracle sungguhan');

uji('setiap kasus galat bersama menghasilkan kode ORA yang sama dengan Oracle', () => {
  benar(KASUS_GALAT.length >= 30);
  for (const k of KASUS_GALAT) {
    const s = T.buatSesi('kosong');
    const siap = T.jalankan(s, k.persiapan.map((x) => `${x};`).join('\n')).blok.filter((b) => b.jenis === 'galat');
    sama(siap.length, 0, `${k.id}: persiapan gagal ${siap.map((b) => b.pesan).join(' | ')}`);
    const b = T.jalankan(s, k.perintah).blok.pop();
    sama(b.jenis, 'galat', `${k.id}: seharusnya galat ${k.kode}`);
    memuat(b.pesan, k.kode, k.id);
  }
});

uji('id kasus galat unik dan kodenya berformat ORA-xxxxx', () => {
  sama(new Set(KASUS_GALAT.map((k) => k.id)).size, KASUS_GALAT.length);
  KASUS_GALAT.forEach((k) => benar(/^ORA-\d{5}$/.test(k.kode), k.id));
});

grup('sql — validasi semantik statis (seperti parse Oracle)');

const kosong = () => { const s = T.buatSesi('kosong'); T.jalankan(s, 'CREATE TABLE a (id NUMBER(4), nama VARCHAR2(10)); CREATE TABLE b (id NUMBER(4), a_id NUMBER(4))'); return s; };

uji('kolom salah pada tabel KOSONG tetap ditolak ORA-00904', () => {
  galat(kosong(), 'SELECT hantu FROM a', 'ORA-00904');
  galat(kosong(), 'SELECT id FROM a WHERE hantu = 1', 'ORA-00904');
  galat(kosong(), 'SELECT id FROM a ORDER BY hantu', 'ORA-00904');
  galat(kosong(), 'UPDATE a SET nama = hantu', 'ORA-00904');
  galat(kosong(), 'DELETE FROM a WHERE hantu = 1', 'ORA-00904');
});

uji('kolom ambigu pada tabel kosong ditolak ORA-00918, yang berkualifikasi diterima', () => {
  galat(kosong(), 'SELECT id FROM a JOIN b ON a.id = b.a_id', 'ORA-00918');
  sama(satu(kosong(), 'SELECT a.id FROM a JOIN b ON a.id = b.a_id').jenis, 'hasil');
});

uji('subquery berkorelasi boleh merujuk kolom kueri luar walau tabel kosong', () => {
  sama(satu(kosong(), 'SELECT a.nama FROM a WHERE EXISTS (SELECT 1 FROM b WHERE b.a_id = a.id)').jenis, 'hasil');
  galat(kosong(), 'SELECT a.nama FROM a WHERE EXISTS (SELECT 1 FROM b WHERE b.hantu = a.id)', 'ORA-00904');
});

uji('ORDER BY boleh memakai alias SELECT; GROUP BY dicek walau tanpa baris', () => {
  sama(satu(kosong(), 'SELECT nama AS n, COUNT(*) AS jml FROM a GROUP BY nama ORDER BY jml DESC, n').jenis, 'hasil');
  galat(kosong(), 'SELECT id, nama FROM a GROUP BY id', 'ORA-00979');
  galat(kosong(), 'SELECT * FROM a GROUP BY id', 'ORA-00979');
  galat(kosong(), 'SELECT nama, COUNT(*) FROM a', 'ORA-00937');
  galat(kosong(), 'SELECT id FROM a WHERE COUNT(*) > 0', 'ORA-00934');
});

uji('fungsi tak dikenal dan alias bintang yang salah ditolak sebelum eksekusi', () => {
  galat(kosong(), 'SELECT median(id) FROM a', 'ORA-00904');
  galat(kosong(), 'SELECT x.* FROM a', 'ORA-00904');
});
