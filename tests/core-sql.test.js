import { grup, uji, sama, benar, melempar, memuat, samaAngka } from './harness.js';
import { akademik, rumahsakit, dreamhome } from '../engine/data/datasets.js';
import { tokenize, parse, query, execute, planToText, likeMatch, truthy, exprToString, SqlError } from '../engine/core/sql.js';

grup('core/sql — tokenizer & parser');

const db = () => ({ ...akademik(), ...rumahsakit(), ...dreamhome() });

uji('tokenize memisahkan kata kunci, identifier, angka, dan string', () => {
  const t = tokenize("SELECT a FROM t WHERE b = 'x' AND c >= 10");
  sama(t[0], { type: 'kw', value: 'SELECT' });
  sama(t[1], { type: 'ident', value: 'a' });
  benar(t.some((x) => x.type === 'str' && x.value === 'x'));
  benar(t.some((x) => x.type === 'num' && x.value === 10));
  benar(t.some((x) => x.type === 'op' && x.value === '>='));
});

uji('tokenize membuang komentar baris dan blok', () => {
  const t = tokenize('SELECT a -- komentar\n /* blok */ FROM t');
  sama(t.map((x) => x.value), ['SELECT', 'a', 'FROM', 't']);
});

uji('tokenize menangani petik ganda di dalam string', () => {
  const t = tokenize("SELECT 'O''Brien'");
  sama(t[1].value, "O'Brien");
});

uji('tokenize menerima tanda petik miring', () => {
  const t = tokenize("SELECT ‘Manager’");
  sama(t[1].value, 'Manager');
});

uji('tokenize menolak string tak ditutup', () => { melempar(() => tokenize("SELECT 'abc"), 'tidak ditutup'); });
uji('tokenize menolak karakter asing', () => { melempar(() => tokenize('SELECT a ~ b'), 'tidak dikenal'); });

uji('parse menghasilkan AST SELECT', () => {
  const a = parse('SELECT a, b FROM t WHERE a > 1 ORDER BY b DESC LIMIT 5');
  sama(a.type, 'select');
  sama(a.items.length, 2);
  sama(a.from[0].table, 't');
  sama(a.orderBy[0].dir, 'DESC');
  sama(a.limit, 5);
});

uji('parse menolak token sisa', () => { melempar(() => parse('SELECT a FROM t t2 t3'), 'Token sisa'); });
uji('parse menolak JOIN tanpa ON', () => { melempar(() => parse('SELECT a FROM t JOIN u'), 'wajib diikuti ON'); });
uji('parse menolak subquery FROM tanpa alias', () => { melempar(() => parse('SELECT a FROM (SELECT 1 x)'), 'wajib punya alias'); });
uji('parse menolak BETWEEN tanpa AND', () => { melempar(() => parse('SELECT a FROM t WHERE a BETWEEN 1'), 'wajib diikuti AND'); });

uji('exprToString mencetak ulang ekspresi', () => {
  const a = parse("SELECT a FROM t WHERE a BETWEEN 1 AND 5 AND b LIKE '%x%' AND c IS NOT NULL");
  memuat(exprToString(a.where), 'BETWEEN 1 AND 5');
  memuat(exprToString(a.where), "LIKE '%x%'");
  memuat(exprToString(a.where), 'IS NOT NULL');
});

grup('core/sql — eksekusi');

uji('SELECT * mengembalikan seluruh kolom', () => {
  const r = query('SELECT * FROM mata_kuliah', db());
  sama(r.attrs, ['kode_kul', 'nama_kul', 'sks', 'sem']);
  sama(r.cardinality, 5);
});

uji('WHERE dengan = dan <>', () => {
  sama(query('SELECT * FROM mata_kuliah WHERE sem = 1', db()).cardinality, 2);
  sama(query('SELECT * FROM mata_kuliah WHERE sem <> 1', db()).cardinality, 3);
  sama(query('SELECT * FROM mata_kuliah WHERE sem != 1', db()).cardinality, 3);
});

uji('LIKE tidak peka huruf besar-kecil', () => {
  sama(query("SELECT * FROM mata_kuliah WHERE nama_kul LIKE '%informatika%'", db()).cardinality, 2);
});

uji('likeMatch menangani % dan _', () => {
  benar(likeMatch('abc', 'a%'));
  benar(likeMatch('abc', 'a_c'));
  benar(likeMatch('abc', '%b%'));
  sama(likeMatch('abc', 'a_'), false);
});

uji('BETWEEN inklusif di kedua ujung', () => {
  const r = query('SELECT staffno FROM STAFF WHERE salary BETWEEN 9000 AND 18000', db());
  sama(r.cardinality, 7);
});

uji('IN dengan daftar dan dengan subquery', () => {
  sama(query("SELECT * FROM mata_kuliah WHERE kode_kul IN ('IT0401','IT0402')", db()).cardinality, 2);
  sama(query("SELECT fname FROM STAFF WHERE staffno IN (SELECT staffno FROM STAFF WHERE position = 'Manager')", db()).cardinality, 3);
});

uji('IS NULL dan IS NOT NULL', () => {
  const r = query('SELECT m.nama_mhs FROM mhs m LEFT JOIN nilai n ON m.nim = n.nim WHERE n.nilai IS NULL', db());
  sama(r.cardinality, 2);
});

uji('NOT membalik predikat', () => {
  sama(query('SELECT * FROM mata_kuliah WHERE NOT sem = 1', db()).cardinality, 3);
});

uji('AND dan OR dengan tanda kurung', () => {
  const r = query("SELECT * FROM mata_kuliah WHERE (sem = 1 OR sem = 3) AND sks = 2", db());
  sama(r.cardinality, 2);
});

uji('agregasi tanpa GROUP BY', () => {
  const r = query('SELECT COUNT(*), MIN(sks), MAX(sks), AVG(sks), SUM(sks) FROM mata_kuliah', db());
  sama(r.rows[0][0], 5);
  sama(r.rows[0][1], 2);
  sama(r.rows[0][2], 3);
  samaAngka(r.rows[0][3], 2.6);
  sama(r.rows[0][4], 13);
});

uji('COUNT DISTINCT', () => {
  const r = query('SELECT COUNT(DISTINCT sks) AS c FROM mata_kuliah', db());
  sama(r.rows[0][0], 2);
});

uji('GROUP BY dengan HAVING', () => {
  const r = query('SELECT sem, COUNT(*) AS jml FROM mata_kuliah GROUP BY sem HAVING COUNT(*) > 1', db());
  sama(r.rows, [[1, 2], [2, 2]]);
});

uji('ORDER BY memakai alias hasil', () => {
  const r = query('SELECT sem, COUNT(*) AS jml FROM mata_kuliah GROUP BY sem ORDER BY jml DESC, sem ASC', db());
  sama(r.rows[0][1], 2);
});

uji('ORDER BY menolak kolom di luar hasil', () => {
  melempar(() => query('SELECT sem FROM mata_kuliah ORDER BY tidak_ada', db()), 'tidak ada');
});

uji('DISTINCT membuang baris ganda', () => {
  sama(query('SELECT DISTINCT sks FROM mata_kuliah', db()).cardinality, 2);
});

uji('LIMIT dan OFFSET', () => {
  sama(query('SELECT kode_kul FROM mata_kuliah LIMIT 2', db()).cardinality, 2);
  sama(query('SELECT kode_kul FROM mata_kuliah LIMIT 2 OFFSET 3', db()).rows, [['IT0404'], ['IT0405']]);
});

uji('INNER JOIN eksplisit', () => {
  sama(query('SELECT m.nama_mhs, n.nilai FROM mhs m JOIN nilai n ON m.nim = n.nim', db()).cardinality, 7);
});

uji('LEFT / RIGHT / FULL OUTER JOIN', () => {
  sama(query('SELECT m.nim FROM mhs m LEFT JOIN nilai n ON m.nim = n.nim', db()).cardinality, 9);
  sama(query('SELECT n.nim FROM mhs m RIGHT JOIN nilai n ON m.nim = n.nim', db()).cardinality, 7);
  sama(query('SELECT m.nim FROM mhs m FULL OUTER JOIN nilai n ON m.nim = n.nim', db()).cardinality, 9);
});

uji('CROSS JOIN menghasilkan perkalian kartesian', () => {
  sama(query('SELECT m.nim, k.kode_kul FROM mhs m CROSS JOIN mata_kuliah k', db()).cardinality, 25);
});

uji('join lama dengan koma dan WHERE', () => {
  const r = query("SELECT mhs.nama_mhs, nilai.nilai FROM mhs, nilai WHERE mhs.nim = nilai.nim AND nilai.kode_kul = 'IT0401'", db());
  sama(r.cardinality, 3);
});

uji('join tiga tabel', () => {
  const r = query('SELECT m.nama_mhs, k.nama_kul, n.nilai FROM mhs m JOIN nilai n ON m.nim = n.nim JOIN mata_kuliah k ON n.kode_kul = k.kode_kul', db());
  sama(r.cardinality, 7);
  sama(r.attrs, ['nama_mhs', 'nama_kul', 'nilai']);
});

uji('UNION memadankan berdasarkan posisi kolom dan membuang duplikat', () => {
  const r = query('SELECT nim FROM mhs UNION SELECT nim FROM nilai', db());
  sama(r.cardinality, 5);
  sama(r.attrs, ['nim']);
});

uji('UNION ALL mempertahankan duplikat', () => {
  sama(query('SELECT nim FROM mhs UNION ALL SELECT nim FROM nilai', db()).cardinality, 12);
});

uji('UNION menolak jumlah kolom berbeda', () => {
  melempar(() => query('SELECT nim, nama_mhs FROM mhs UNION SELECT nim FROM nilai', db()), 'jumlah kolom berbeda');
});

uji('subquery pada FROM', () => {
  const r = query('SELECT t.nama_mhs FROM (SELECT nama_mhs FROM mhs WHERE alamat_mhs = \'Bekasi\') t', db());
  sama(r.rows, [['Gita Pranata']]);
});

uji('subquery skalar', () => {
  const r = query('SELECT nama_kul, (SELECT COUNT(*) FROM mhs) AS jml FROM mata_kuliah LIMIT 1', db());
  sama(r.rows[0][1], 5);
});

uji('aritmetika dan penggabungan string', () => {
  const r = query("SELECT sks * 2 AS dua, nama_kul || ' (' || kode_kul || ')' AS label FROM mata_kuliah LIMIT 1", db());
  sama(r.rows[0][0], 6);
  memuat(r.rows[0][1], 'Basis Data Terdistribusi (IT0401)');
});

uji('pembagian dengan nol menghasilkan NULL', () => {
  sama(query('SELECT sks / 0 AS x FROM mata_kuliah LIMIT 1', db()).rows[0][0], null);
});

uji('fungsi skalar', () => {
  const r = query("SELECT UPPER('ab') a, LOWER('AB') b, LENGTH('abc') c, ROUND(3.456, 2) d, SUBSTR('abcdef', 2, 3) e, COALESCE(NULL, 'x') f FROM mata_kuliah LIMIT 1", db());
  sama(r.rows[0], ['AB', 'ab', 3, 3.46, 'bcd', 'x']);
});

uji('fungsi YEAR dan MONTH atas kolom tanggal', () => {
  const r = query('SELECT YEAR(waktu_periksa) y, MONTH(waktu_periksa) m FROM pasien_dokter LIMIT 1', db());
  sama(r.rows[0], [2025, 9]);
});

uji('fungsi tidak dikenal ditolak dengan daftar alternatif', () => {
  const e = melempar(() => query('SELECT MEDIAN(sks) FROM mata_kuliah', db()), 'tidak didukung');
  memuat(e.message, 'UPPER');
});

uji('kolom ambigu ditolak dengan pesan jelas', () => {
  melempar(() => query('SELECT nim FROM mhs m JOIN nilai n ON m.nim = n.nim', db()), 'ambigu');
});

uji('tabel tidak dikenal ditolak dengan daftar tabel yang ada', () => {
  const e = melempar(() => query('SELECT * FROM tabel_hantu', db()), 'tidak ada');
  memuat(e.message, 'Tersedia');
});

uji('kolom tidak dikenal ditolak', () => {
  melempar(() => query('SELECT kolom_hantu FROM mhs', db()), 'tidak ada');
});

uji('alias bintang berkualifikasi', () => {
  const r = query('SELECT m.* FROM mhs m JOIN nilai n ON m.nim = n.nim', db());
  sama(r.attrs, ['nim', 'nama_mhs', 'alamat_mhs']);
});

uji('alias bintang tidak dikenal ditolak', () => {
  melempar(() => query('SELECT z.* FROM mhs m', db()), 'tidak ada pada FROM');
});

uji('NULL dalam perbandingan menghasilkan baris tidak lolos', () => {
  const r = query('SELECT m.nim FROM mhs m LEFT JOIN nilai n ON m.nim = n.nim WHERE n.nilai > 0', db());
  sama(r.cardinality, 7);
});

uji('truthy hanya menerima true / 1 / "1"', () => {
  benar(truthy(true)); benar(truthy(1)); benar(truthy('1'));
  sama(truthy('ya'), false); sama(truthy(0), false); sama(truthy(null), false);
});

grup('core/sql — rencana eksekusi');

uji('planToText menampilkan operator berjenjang', () => {
  const { plan } = execute('SELECT m.nama_mhs, COUNT(*) AS c FROM mhs m JOIN nilai n ON m.nim = n.nim WHERE n.nilai > 70 GROUP BY m.nama_mhs ORDER BY c DESC', db());
  const t = planToText(plan);
  memuat(t, 'SCAN');
  memuat(t, 'INNER JOIN');
  memuat(t, 'FILTER (WHERE)');
  memuat(t, 'AGGREGATE');
  memuat(t, 'SORT');
});

uji('rencana mencatat jumlah baris tiap tahap', () => {
  const { plan } = execute("SELECT * FROM mata_kuliah WHERE sem = 1", db());
  const scan = plan.children.find((c) => c.op === 'SCAN');
  const filter = plan.children.find((c) => c.op === 'FILTER (WHERE)');
  sama(scan.rows, 5);
  sama(filter.rows, 2);
});

uji('SqlError dapat dikenali tipenya', () => {
  const e = melempar(() => query('SELECT * FROM x y z', db()));
  benar(e instanceof SqlError);
});

grup('core/sql — ORDER BY kolom tersembunyi');

uji('ORDER BY boleh memakai kolom yang tidak diproyeksikan', () => {
  const r = query('SELECT nama_kul FROM mata_kuliah ORDER BY sks DESC, kode_kul ASC', db());
  sama(r.attrs, ['nama_kul']);
  sama(r.rows[0][0], 'Basis Data Terdistribusi');
  sama(r.cardinality, 5);
});

uji('kolom bantu pengurut tidak bocor ke hasil', () => {
  const r = query('SELECT nama_mhs FROM mhs ORDER BY nim DESC', db());
  sama(r.attrs, ['nama_mhs']);
  benar(r.attrs.every((a) => !a.startsWith('__ord')));
  sama(r.rows[0][0], 'Tomi Saputra');
});

uji('ORDER BY kolom berkualifikasi dari tabel yang di-join', () => {
  const r = query('SELECT m.nama_mhs FROM mhs m JOIN nilai n ON m.nim = n.nim ORDER BY n.nilai ASC', db());
  sama(r.attrs, ['nama_mhs']);
  sama(r.rows[0][0], 'Gita Pranata');
});

uji('DISTINCT menolak ORDER BY kolom di luar daftar SELECT', () => {
  melempar(() => query('SELECT DISTINCT nama_kul FROM mata_kuliah ORDER BY sks', db()), 'wajib ada pada daftar SELECT');
});

uji('rencana eksekusi menampilkan ekspresi ORDER BY apa adanya', () => {
  const { plan } = execute('SELECT nama_kul FROM mata_kuliah ORDER BY sks DESC', db());
  const sort = plan.children.find((c) => c.op === 'SORT');
  memuat(sort.detail, 'sks DESC');
});
