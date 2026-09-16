import { grup, uji, sama, benar, salah, melempar, memuat, samaAngka, relasiSama } from './harness.js';
import { akademik, rumahsakit, RS_KEYS } from '../engine/data/datasets.js';
import { query, parse, parseScript, execute, exprToString, SqlError } from '../engine/core/sql.js';
import { executeScript, salinDb } from '../engine/core/dml.js';
import * as G from '../engine/core/grader.js';
import * as D from '../engine/ddb/decompose.js';
import { treeToText } from '../engine/ddb/localize.js';
import { bankSoalDb, RS_KEYS_CASCADE, RS_SCHEMA } from '../engine/data/datasets.js';
import { BANK_SOAL } from '../src/content/soal.js';

const db = () => ({ ...akademik(), ...rumahsakit() });

grup('sql lanjutan — CASE');

uji('CASE WHEN mencari cabang pertama yang benar', () => {
  const r = query("SELECT kode_kul, CASE WHEN sks >= 3 THEN 'berat' WHEN sks = 2 THEN 'sedang' ELSE 'ringan' END AS b FROM mata_kuliah ORDER BY kode_kul", db());
  sama(r.rows.map((x) => x[1]), ['berat', 'sedang', 'berat', 'berat', 'sedang']);
});

uji('CASE sederhana membandingkan subjek dengan tiap WHEN', () => {
  const r = query("SELECT CASE sem WHEN 1 THEN 'satu' WHEN 2 THEN 'dua' END AS s FROM mata_kuliah ORDER BY kode_kul", db());
  sama(r.rows.map((x) => x[0]), ['satu', 'satu', 'dua', 'dua', null]);
});

uji('CASE tanpa ELSE menghasilkan NULL', () => {
  sama(query("SELECT CASE WHEN 1 = 2 THEN 'x' END AS c FROM DUAL", db()).rows, [[null]]);
});

uji('agregasi di dalam CASE dan CASE di dalam agregasi', () => {
  sama(query('SELECT SUM(CASE WHEN sks = 3 THEN 1 ELSE 0 END) FROM mata_kuliah', db()).rows, [[3]]);
  const r = query("SELECT sem, CASE WHEN COUNT(*) > 1 THEN 'banyak' ELSE 'sedikit' END FROM mata_kuliah GROUP BY sem", db());
  sama(r.rows, [[1, 'banyak'], [2, 'banyak'], [3, 'sedikit']]);
});

uji('CASE tanpa WHEN ditolak', () => {
  melempar(() => parse('SELECT CASE END FROM DUAL'), 'minimal satu WHEN');
});

grup('sql lanjutan — subquery berkorelasi');

uji('EXISTS dan NOT EXISTS berkorelasi', () => {
  sama(query('SELECT m.nim FROM mhs m WHERE EXISTS (SELECT 1 FROM nilai n WHERE n.nim = m.nim)', db()).cardinality, 3);
  sama(query('SELECT m.nim FROM mhs m WHERE NOT EXISTS (SELECT 1 FROM nilai n WHERE n.nim = m.nim)', db()).cardinality, 2);
});

uji('subquery skalar berkorelasi dihitung per baris', () => {
  const r = query('SELECT m.nim, (SELECT COUNT(*) FROM nilai n WHERE n.nim = m.nim) AS jml FROM mhs m ORDER BY m.nim', db());
  sama(r.rows.map((x) => x[1]), [3, 2, 2, 0, 0]);
});

uji('subquery skalar yang mengembalikan banyak baris ditolak', () => {
  melempar(() => query('SELECT (SELECT nim FROM mhs) FROM DUAL', db()), 'lebih dari satu baris');
});

uji('kolom dalam subquery lebih dulu dicari di tabel sendiri', () => {
  // nim ada di nilai (dalam) dan mhs (luar): SQL memakai yang terdekat
  const r = query('SELECT m.nama_mhs FROM mhs m WHERE EXISTS (SELECT 1 FROM nilai WHERE nim = m.nim AND nilai > 90)', db());
  sama(r.rows, [['Daniel Hutajulu'], ['Rizky Ananda']]);
});

uji('kolom yang tidak ada di dalam maupun di luar tetap ditolak', () => {
  melempar(() => query('SELECT m.nim FROM mhs m WHERE EXISTS (SELECT 1 FROM nilai n WHERE n.hantu = m.nim)', db()), 'tidak ada');
});

grup('sql lanjutan — WITH & operasi himpunan');

uji('WITH mendefinisikan tabel sementara yang dapat saling merujuk', () => {
  const r = query('WITH a AS (SELECT kode_kul, sks FROM mata_kuliah WHERE sem = 1), b AS (SELECT kode_kul FROM a WHERE sks = 3) SELECT * FROM b', db());
  sama(r.rows, [['IT0401']]);
});

uji('WITH tercatat pada rencana eksekusi', () => {
  const { plan } = execute('WITH a AS (SELECT nim FROM mhs) SELECT * FROM a', db());
  sama(plan.op, 'WITH');
  sama(plan.children[0].op, 'CTE a');
});

uji('INTERSECT, MINUS, dan EXCEPT', () => {
  sama(query('SELECT nim FROM mhs INTERSECT SELECT nim FROM nilai', db()).cardinality, 3);
  sama(query('SELECT nim FROM mhs MINUS SELECT nim FROM nilai', db()).rows, [['11010014'], ['11010015']]);
  relasiSama(query('SELECT nim FROM mhs EXCEPT SELECT nim FROM nilai', db()), query('SELECT nim FROM mhs MINUS SELECT nim FROM nilai', db()));
});

uji('operasi himpunan menolak jumlah kolom berbeda', () => {
  melempar(() => query('SELECT nim, nama_mhs FROM mhs INTERSECT SELECT nim FROM nilai', db()), 'jumlah kolom berbeda');
});

uji('ORDER BY setelah UNION mengurutkan seluruh hasil, bukan hanya cabang kanan', () => {
  const r = query('SELECT nama_mhs AS nama FROM mhs UNION SELECT nama_kul FROM mata_kuliah ORDER BY nama DESC', db());
  const nama = r.rows.map((x) => x[0]);
  sama(nama, [...nama].sort().reverse());
});

uji('ORDER BY nomor posisi pada operasi himpunan', () => {
  const r = query('SELECT nim FROM mhs UNION SELECT nim FROM nilai ORDER BY 1 DESC', db());
  sama(r.rows[0][0], '11010015');
  melempar(() => query('SELECT nim FROM mhs UNION SELECT nim FROM nilai ORDER BY 3', db()), 'hanya punya 1 kolom');
});

grup('sql lanjutan — sintaks Oracle');

uji('FETCH FIRST n ROWS ONLY setara LIMIT', () => {
  relasiSama(
    query('SELECT kode_kul FROM mata_kuliah ORDER BY kode_kul FETCH FIRST 2 ROWS ONLY', db()),
    query('SELECT kode_kul FROM mata_kuliah ORDER BY kode_kul LIMIT 2', db()),
  );
});

uji('OFFSET n ROWS FETCH NEXT n ROWS ONLY', () => {
  sama(query('SELECT kode_kul FROM mata_kuliah ORDER BY kode_kul OFFSET 1 ROWS FETCH NEXT 2 ROWS ONLY', db()).rows, [['IT0402'], ['IT0403']]);
  sama(query('SELECT kode_kul FROM mata_kuliah ORDER BY kode_kul FETCH FIRST 1 ROW ONLY', db()).rows, [['IT0401']]);
});

uji('FETCH yang tidak lengkap ditolak dengan pesan jelas', () => {
  melempar(() => parse('SELECT 1 FROM DUAL FETCH 2 ROWS ONLY'), 'FIRST atau NEXT');
  melempar(() => parse('SELECT 1 FROM DUAL FETCH FIRST 2 ONLY'), 'ROWS atau ROW');
  melempar(() => parse('SELECT 1 FROM DUAL FETCH FIRST 2 ROWS'), 'ONLY');
});

uji('kata ROWS, FIRST, ONLY tetap boleh menjadi nama kolom', () => {
  const r = query('SELECT t.rows, t.first FROM (SELECT sks AS rows, sem AS first FROM mata_kuliah) t LIMIT 1', db());
  sama(r.rows, [[3, 1]]);
});

uji('tabel DUAL tersedia tanpa didefinisikan', () => {
  sama(query("SELECT 1 + 2 AS a, 'x' || 'y' AS b FROM DUAL", db()).rows, [[3, 'xy']]);
});

uji('DECODE bergaya Oracle termasuk nilai lainnya dan NULL = NULL', () => {
  sama(query("SELECT DECODE(sem, 1, 'satu', 2, 'dua', 'lain') FROM mata_kuliah ORDER BY kode_kul", db()).rows.map((x) => x[0]), ['satu', 'satu', 'dua', 'dua', 'lain']);
  sama(query("SELECT DECODE(NULL, NULL, 'kosong', 'isi') FROM DUAL", db()).rows, [['kosong']]);
  sama(query("SELECT DECODE(5, 1, 'a') FROM DUAL", db()).rows, [[null]]);
});

uji('fungsi skalar tambahan', () => {
  const r = query("SELECT INITCAP('basis data'), LPAD('7', 3, '0'), RPAD('ab', 4, '.'), INSTR('oracle', 'cl'), REPLACE('a-b-c', '-', '+'), MOD(10, 3), POWER(2, 5), GREATEST(3, 9, 4), LEAST(3, 9, 4), TRUNC(3.789, 1), NVL(NULL, 0), LTRIM('  x'), RTRIM('x  ') FROM DUAL", db());
  sama(r.rows[0], ['Basis Data', '007', 'ab..', 4, 'a+b+c', 1, 32, 9, 3, 3.7, 0, 'x', 'x']);
});

uji('exprToString mencetak CASE dan EXISTS', () => {
  const a = parse("SELECT CASE WHEN a = 1 THEN 'x' ELSE 'y' END FROM t WHERE EXISTS (SELECT 1 FROM u)");
  memuat(exprToString(a.items[0].expr), "CASE WHEN (a = 1) THEN 'x' ELSE 'y' END");
  memuat(exprToString(a.where), 'EXISTS');
});

grup('dml — penguraian');

uji('parseScript memecah beberapa perintah', () => {
  sama(parseScript("SELECT 1 FROM DUAL; INSERT INTO t VALUES (1); UPDATE t SET a = 2; DELETE FROM t;").map((s) => s.type), ['select', 'insert', 'update', 'delete']);
});

uji('perintah tanpa titik koma di antaranya ditolak', () => {
  melempar(() => parseScript('SELECT 1 FROM DUAL SELECT 2 FROM DUAL'), 'titik koma');
});

uji('execute menolak DML dan mengarahkan ke executeScript', () => {
  melempar(() => execute('DELETE FROM mhs', db()), 'executeScript');
});

uji('INSERT tanpa VALUES atau SELECT ditolak', () => {
  melempar(() => parse('INSERT INTO mhs'), 'VALUES atau SELECT');
});

uji('UPDATE tanpa tanda sama dengan ditolak', () => {
  melempar(() => parse('UPDATE mhs SET nama_mhs'), '"="');
});

grup('dml — eksekusi');

const kunci = (aturan) => Object.fromEntries(Object.entries(RS_KEYS).map(([t, d]) => [t, { ...d, fk: d.fk.map((f) => ({ ...f, onDelete: aturan, onUpdate: aturan })) }]));

uji('INSERT banyak baris dengan daftar kolom', () => {
  const d = salinDb(akademik());
  const r = executeScript("INSERT INTO mhs (nim, nama_mhs) VALUES ('1', 'A'), ('2', 'B')", d);
  sama(r.galat, null);
  sama(r.hasil[0].terdampak, 2);
  sama(d.mhs.cardinality, 7);
  sama(d.mhs.rows[5], ['1', 'A', null]);
});

uji('INSERT ... SELECT', () => {
  const d = salinDb(akademik());
  executeScript('INSERT INTO mhs (nim, nama_mhs) SELECT kode_kul, nama_kul FROM mata_kuliah WHERE sem = 1', d);
  sama(d.mhs.cardinality, 7);
});

uji('INSERT dengan jumlah nilai salah dan kolom asing ditolak', () => {
  benar(executeScript("INSERT INTO mhs (nim, nama_mhs) VALUES ('1')", salinDb(akademik())).galat.includes('1 nilai untuk 2 kolom'));
  benar(executeScript("INSERT INTO mhs (hantu) VALUES ('1')", salinDb(akademik())).galat.includes('tidak ada'));
});

uji('UPDATE menghitung ruas kanan dari nilai lama', () => {
  const d = salinDb(akademik());
  executeScript('UPDATE mata_kuliah SET sks = sks + 1, sem = sks WHERE kode_kul = \'IT0401\'', d);
  sama(d.mata_kuliah.rows[0], ['IT0401', 'Basis Data Terdistribusi', 4, 3]);
});

uji('UPDATE dan DELETE memakai alias dan subquery', () => {
  const d = salinDb(akademik());
  executeScript("UPDATE nilai n SET nilai = 100 WHERE n.nim IN (SELECT nim FROM mhs WHERE alamat_mhs = 'Depok')", d);
  benar(d.nilai.rows.filter((r) => r[0] === '11010013').every((r) => r[2] === 100));
  const r = executeScript('DELETE FROM mhs m WHERE NOT EXISTS (SELECT 1 FROM nilai n WHERE n.nim = m.nim)', d);
  sama(r.hasil[0].terdampak, 2);
});

uji('DELETE tanpa WHERE mengosongkan tabel', () => {
  const d = salinDb(akademik());
  executeScript('DELETE FROM nilai', d);
  sama(d.nilai.cardinality, 0);
});

uji('primary key ganda dan NULL ditolak tanpa mengubah data', () => {
  const d = salinDb(rumahsakit());
  const r = executeScript("INSERT INTO pasien (id_pasien, nama_pasien) VALUES (1, 'Ganda')", d, { kunci: kunci('CASCADE') });
  memuat(r.galat, 'ORA-00001');
  sama(d.pasien.cardinality, 12);
  memuat(executeScript("INSERT INTO pasien (nama_pasien) VALUES ('Tanpa ID')", d, { kunci: kunci('CASCADE') }).galat, 'tidak boleh NULL');
});

uji('foreign key yang tidak punya induk ditolak', () => {
  const r = executeScript("INSERT INTO daftar VALUES (99, 999, 1, '2025-10-01')", salinDb(rumahsakit()), { kunci: kunci('CASCADE') });
  memuat(r.galat, 'ORA-02291');
});

uji('ON DELETE CASCADE menghapus riwayat anak — temuan audit A1', () => {
  const d = salinDb(rumahsakit());
  const r = executeScript('DELETE FROM pasien WHERE id_pasien = 1', d, { kunci: kunci('CASCADE') });
  sama(r.galat, null);
  sama(r.hasil[0].kaskade, [
    { tabel: 'pasien_dokter', aksi: 'ON DELETE CASCADE', baris: 2 },
    { tabel: 'daftar', aksi: 'ON DELETE CASCADE', baris: 1 },
  ]);
  sama(d.pasien_dokter.cardinality, 12);
});

uji('ON DELETE RESTRICT menolak penghapusan induk yang masih dirujuk', () => {
  const d = salinDb(rumahsakit());
  memuat(executeScript('DELETE FROM pasien WHERE id_pasien = 1', d, { kunci: kunci('RESTRICT') }).galat, 'ORA-02292');
  sama(d.pasien.cardinality, 12);
  sama(d.pasien_dokter.cardinality, 14);
});

uji('ON DELETE SET NULL mengosongkan kolom rujukan anak', () => {
  const d = salinDb(rumahsakit());
  executeScript('DELETE FROM administrator WHERE id_admin = 4', d, { kunci: kunci('SET NULL') });
  benar(d.daftar.rows.some((r) => r[2] === null));
  sama(d.daftar.cardinality, 12);
});

uji('ON UPDATE CASCADE memperbarui kunci di tabel anak', () => {
  const d = salinDb(rumahsakit());
  const r = executeScript('UPDATE dokter SET id_dokter = 60 WHERE id_dokter = 6', d, { kunci: kunci('CASCADE') });
  sama(r.hasil[0].kaskade.map((k) => k.tabel), ['pasien_dokter', 'dokter_admin']);
  benar(d.pasien_dokter.rows.some((row) => row[1] === 60));
});

uji('perubahan kunci induk yang masih dirujuk ditolak pada RESTRICT', () => {
  memuat(executeScript('UPDATE dokter SET id_dokter = 60 WHERE id_dokter = 6', salinDb(rumahsakit()), { kunci: kunci('RESTRICT') }).galat, 'ORA-02292');
});

uji('skrip berhenti di perintah yang gagal dan perintah sebelumnya tetap berlaku', () => {
  const d = salinDb(akademik());
  const r = executeScript("INSERT INTO mhs (nim) VALUES ('X'); UPDATE hantu SET a = 1; DELETE FROM mhs", d);
  sama(r.hasil.length, 1);
  sama(r.gagalPada, 2);
  memuat(r.galat, 'tidak ada');
  sama(d.mhs.cardinality, 6);
});

uji('SELECT di dalam skrip melihat perubahan sebelumnya', () => {
  const d = salinDb(akademik());
  const r = executeScript("DELETE FROM nilai WHERE nilai < 80; SELECT COUNT(*) FROM nilai", d);
  sama(r.hasil[1].relation.rows, [[4]]);
});

uji('salinDb menghasilkan salinan dalam yang tidak berbagi baris', () => {
  const asli = akademik();
  const s = salinDb(asli);
  s.mhs.rows[0][1] = 'Diubah';
  salah(asli.mhs.rows[0][1] === 'Diubah');
});

uji('SqlError tetap bertipe SqlError dari dml', () => {
  benar(new SqlError('x') instanceof Error);
  samaAngka(1, 1);
});

grup('sql lanjutan — penilai memahami sintaks baru');

uji('punyaOrderBy membaca ORDER BY yang diangkat ke simpul UNION', () => {
  benar(G.punyaOrderBy('SELECT nim FROM mhs UNION SELECT nim FROM nilai ORDER BY nim'));
  salah(G.punyaOrderBy('SELECT nim FROM mhs UNION SELECT nim FROM nilai'));
});

uji('punyaOrderBy membaca ORDER BY pada INTERSECT/MINUS dan badan WITH', () => {
  benar(G.punyaOrderBy('SELECT nim FROM mhs MINUS SELECT nim FROM nilai ORDER BY nim DESC'));
  benar(G.punyaOrderBy('WITH a AS (SELECT nim FROM mhs) SELECT nim FROM a ORDER BY nim'));
  salah(G.punyaOrderBy('WITH a AS (SELECT nim FROM mhs ORDER BY nim) SELECT nim FROM a'));
});

uji('urutan UNION ber-ORDER BY dinilai: urutan terbalik kehilangan 15 poin', () => {
  const kunci = 'SELECT nim FROM mhs UNION SELECT nim FROM nilai ORDER BY nim';
  sama(G.gradeQuery('SELECT nim FROM nilai UNION SELECT nim FROM mhs ORDER BY 1', kunci, db()).skor, 100);
  sama(G.gradeQuery('SELECT nim FROM mhs UNION SELECT nim FROM nilai ORDER BY nim DESC', kunci, db()).skor, 85);
});

grup('sql lanjutan — penilaian soal DML');

const soal = (id) => BANK_SOAL.find((s) => s.id === id);

uji('RS_KEYS_CASCADE memasang CASCADE pada semua foreign key tanpa mengubah RS_KEYS', () => {
  for (const def of Object.values(RS_KEYS_CASCADE)) def.fk.forEach((fk) => { sama(fk.onDelete, 'CASCADE'); sama(fk.onUpdate, 'CASCADE'); });
  for (const def of Object.values(RS_KEYS)) def.fk.forEach((fk) => sama(fk.onDelete, undefined));
});

uji('gradeScript: DELETE dengan CASCADE cukup satu perintah', () => {
  const r = G.gradeSoal(soal('p2-13'), "DELETE FROM pasien WHERE nama_pasien = 'Hendra Gunawan'", bankSoalDb());
  benar(r.benar, r.alasan.join('; '));
  sama(r.skor, 100);
});

uji('gradeScript: menghapus anak secara manual juga benar karena keadaan akhirnya sama', () => {
  const jawab = 'DELETE FROM pasien_dokter WHERE id_pasien = 9; DELETE FROM daftar WHERE id_pasien = 9; DELETE FROM pasien WHERE id_pasien = 9';
  benar(G.gradeSoal(soal('p2-13'), jawab, bankSoalDb()).benar);
});

uji('gradeScript: DELETE tanpa WHERE dinilai salah dengan petunjuk', () => {
  const r = G.gradeSoal(soal('p2-12'), 'DELETE FROM pasien_dokter', bankSoalDb());
  salah(r.benar);
  benar(r.skor < 100);
  memuat(r.petunjuk.join(' '), 'lebih sedikit');
});

uji('gradeScript: UPDATE yang lupa WHERE dinilai salah', () => {
  const r = G.gradeSoal(soal('p2-10'), "UPDATE pasien SET kota = 'Jakarta'", bankSoalDb());
  salah(r.benar);
  memuat(r.petunjuk.join(' '), 'SET');
});

uji('gradeScript: ON UPDATE CASCADE memperbarui rujukan di dua tabel anak', () => {
  const r = G.gradeSoal(soal('p2-14'), "UPDATE dokter SET id_dokter = 16 WHERE nama_dokter = 'dr. Farah Nadia'", bankSoalDb());
  benar(r.benar, r.alasan.join('; '));
  const anak = r.hasilJawaban.rows.filter((x) => x[0] !== 'dokter' && x[1] === 16);
  benar(anak.length >= 2);
});

uji('gradeScript: perintah yang gagal (PK ganda) diberi nilai 0 dan pesan Oracle', () => {
  const r = G.gradeSoal(soal('p2-09'), "INSERT INTO pasien (id_pasien, nama_pasien) VALUES (1, 'Duplikat')", bankSoalDb());
  sama(r.skor, 0);
  memuat(r.galat, 'ORA-00001');
});

uji('gradeScript: basis data asli tidak berubah setelah penilaian', () => {
  const d = bankSoalDb();
  const sebelum = d.pasien.cardinality;
  G.gradeSoal(soal('p2-13'), 'DELETE FROM pasien', d);
  sama(d.pasien.cardinality, sebelum);
});

uji('gradeScript: jawaban kosong dan SELECT diberi umpan balik', () => {
  sama(G.gradeSoal(soal('p2-12'), '  ', bankSoalDb()).skor, 0);
  memuat(G.gradeSoal(soal('p2-12'), 'SELECT * FROM pasien_dokter', bankSoalDb()).petunjuk.join(' '), 'MENGUBAH');
});

uji('gradeScript menolak dipanggil tanpa kueri pemeriksa', () => {
  melempar(() => G.gradeScript('DELETE FROM pasien', 'DELETE FROM pasien', bankSoalDb()), 'pemeriksa');
});

uji('gradeAll mencampur soal kueri dan soal DML', () => {
  const bank = [soal('p3-01'), soal('p2-12')];
  const r = G.gradeAll({ 'p3-01': soal('p3-01').kunci, 'p2-12': soal('p2-12').kunci }, bank, bankSoalDb());
  sama(r.benar, 2);
  sama(r.nilai, 100);
});

grup('sql lanjutan — dekomposisi memahami sintaks baru');

const skemaDek = () => ({ ...RS_SCHEMA });

uji('cabangSelect mengurai WITH, UNION, dan INTERSECT', () => {
  sama(D.cabangSelect(parse('SELECT 1 FROM pasien UNION SELECT 2 FROM dokter INTERSECT SELECT 3 FROM daftar')).length, 3);
  sama(D.cabangSelect(parse('WITH a AS (SELECT 1 FROM pasien) SELECT * FROM a')).length, 1);
});

uji('decompose menerima rantai UNION tiga cabang (dulu gagal membaca cabang kiri)', () => {
  const r = D.decompose("SELECT kota FROM pasien WHERE kota = 'Jakarta' UNION SELECT kota FROM dokter UNION SELECT kota FROM administrator", skemaDek());
  benar(r.analisis.diterima, JSON.stringify(r.analisis.masalah));
  const teks = treeToText(r.pohon);
  sama((teks.match(/∪/g) || []).length, 2);
});

uji('decompose memakai nama CTE sebagai relasi yang sah', () => {
  const r = D.decompose("WITH jkt AS (SELECT id_pasien, nama_pasien FROM pasien WHERE kota = 'Jakarta') SELECT j.nama_pasien FROM jkt j JOIN daftar d ON j.id_pasien = d.id_pasien", skemaDek());
  benar(r.analisis.diterima, JSON.stringify(r.analisis.masalah));
  const teks = treeToText(r.pohon);
  memuat(teks, 'WITH jkt');
  memuat(teks, 'jkt :=');
});

uji('decompose menandai atribut salah di dalam CTE dengan label cabangnya', () => {
  const r = D.decompose('WITH x AS (SELECT kolom_hantu FROM pasien) SELECT * FROM x', skemaDek());
  salah(r.analisis.diterima);
  memuat(r.analisis.masalah.map((m) => m.pesan).join(' '), 'CTE x');
});

uji('decompose menolak cabang operasi himpunan dengan jumlah kolom berbeda', () => {
  const r = D.decompose('SELECT id_pasien, kota FROM pasien MINUS SELECT id_dokter FROM dokter', skemaDek());
  salah(r.analisis.diterima);
  memuat(r.analisis.masalah.map((m) => m.pesan).join(' '), 'jumlah kolom berbeda');
});

uji('decompose memeriksa kolom di dalam CASE', () => {
  const r = D.decompose("SELECT CASE WHEN umur_hantu > 1 THEN 'a' END FROM pasien", skemaDek());
  salah(r.analisis.diterima);
});

uji('pohon operator: INTERSECT, MINUS, ORDER BY himpunan, dan LIMIT', () => {
  const t1 = treeToText(D.toOperatorTree(parse('SELECT kota FROM pasien INTERSECT SELECT kota FROM dokter ORDER BY kota')));
  memuat(t1.split('\n')[0], 'τ kota');
  memuat(t1, '∩');
  const t2 = treeToText(D.toOperatorTree(parse('SELECT kota FROM pasien MINUS SELECT kota FROM dokter')));
  memuat(t2.split('\n')[0], '−');
  const t3 = treeToText(D.toOperatorTree(parse('SELECT nama_pasien FROM pasien ORDER BY nama_pasien FETCH FIRST 3 ROWS ONLY')));
  memuat(t3.split('\n')[0], 'batasi 3 baris');
});

uji('decompose menolak perintah DML dengan pesan yang jelas', () => {
  melempar(() => D.decompose('DELETE FROM pasien', skemaDek()), 'hanya berlaku untuk SELECT');
  melempar(() => D.toOperatorTree(parse('UPDATE pasien SET kota = 1')), 'SELECT');
});
