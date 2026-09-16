import { grup, uji, sama, benar, salah, melempar, samaAngka } from './harness.js';
import { Relation, canon, fromObjects } from '../engine/core/relation.js';

grup('core/relation');

uji('membangun relasi dari baris posisional', () => {
  const r = new Relation('T', ['a', 'b'], [[1, 2], [3, 4]]);
  sama(r.attrs, ['a', 'b']);
  sama(r.cardinality, 2);
  sama(r.degree, 2);
});

uji('membangun relasi dari objek', () => {
  const r = new Relation('T', ['a', 'b'], [{ a: 1, b: 2 }, { b: 4 }]);
  sama(r.rows, [[1, 2], [null, 4]]);
});

uji('fromObjects menurunkan atribut dari gabungan kunci', () => {
  const r = fromObjects('T', [{ a: 1 }, { b: 2 }]);
  sama(r.attrs, ['a', 'b']);
  sama(r.rows, [[1, null], [null, 2]]);
});

uji('menolak nama kosong', () => { melempar(() => new Relation('', ['a'], []), 'nama wajib'); });
uji('menolak atribut kosong', () => { melempar(() => new Relation('T', [], []), 'atribut wajib'); });
uji('menolak atribut ganda', () => { melempar(() => new Relation('T', ['a', 'a'], []), 'atribut ganda'); });
uji('menolak panjang baris yang tidak cocok', () => { melempar(() => new Relation('T', ['a', 'b'], [[1]]), 'butuh 2'); });
uji('menolak baris bertipe salah', () => { melempar(() => new Relation('T', ['a'], [42]), 'array atau objek'); });

uji('indexOf menerima nama polos dan berkualifikasi', () => {
  const r = new Relation('T', ['T.a', 'b'], [['x', 'y']]);
  sama(r.indexOf('a'), 0);
  sama(r.indexOf('T.a'), 0);
  sama(r.indexOf('b'), 1);
  sama(r.indexOf('zz'), -1);
});

uji('has memeriksa keberadaan atribut', () => {
  const r = new Relation('T', ['a'], []);
  benar(r.has('a'));
  salah(r.has('b'));
});

uji('obj dan objects memetakan baris ke objek', () => {
  const r = new Relation('T', ['a', 'b'], [[1, 2]]);
  sama(r.obj(0), { a: 1, b: 2 });
  sama(r.objects(), [{ a: 1, b: 2 }]);
});

uji('cell mengambil sel dan melempar bila atribut tidak ada', () => {
  const r = new Relation('T', ['a'], [[9]]);
  sama(r.cell(0, 'a'), 9);
  melempar(() => r.cell(0, 'z'), 'tidak ada');
});

uji('rename dan clone menyalin isi', () => {
  const r = new Relation('T', ['a'], [[1]]);
  sama(r.rename('U').name, 'U');
  sama(r.clone().rows, [[1]]);
});

uji('qualified menambahkan prefiks nama relasi', () => {
  const r = new Relation('T', ['a', 'T.b'], [[1, 2]]);
  sama(r.qualified().attrs, ['T.a', 'T.b']);
});

uji('distinct membuang baris ganda', () => {
  const r = new Relation('T', ['a'], [[1], [1], [2]]);
  sama(r.distinct().rows, [[1], [2]]);
});

uji('equals membandingkan sebagai himpunan tanpa peduli urutan atribut', () => {
  const a = new Relation('A', ['x', 'y'], [[1, 2], [3, 4]]);
  const b = new Relation('B', ['y', 'x'], [[4, 3], [2, 1]]);
  benar(a.equals(b));
  salah(a.equals(new Relation('C', ['x', 'y'], [[1, 2]])));
  salah(a.equals(new Relation('C', ['x'], [[1]])));
  salah(a.equals(null));
});

uji('equals membedakan atribut yang berbeda nama', () => {
  const a = new Relation('A', ['x'], [[1]]);
  salah(a.equals(new Relation('B', ['z'], [[1]])));
});

uji('canon menormalkan undefined dan Date', () => {
  sama(canon(undefined), null);
  sama(canon(new Date('2025-09-01T10:00:00Z')), '2025-09-01');
  sama(canon(5), 5);
});

uji('key stabil untuk baris yang sama', () => {
  sama(Relation.key([1, 'a']), Relation.key([1, 'a']));
  benar(Relation.key([1]) !== Relation.key(['1']));
});

uji('sizeBytes memperkirakan ukuran', () => {
  const r = new Relation('T', ['a'], [['abcde'], ['xy']]);
  samaAngka(r.sizeBytes(), 10);
  samaAngka(r.sizeBytes({ a: 100 }), 200);
});

uji('toJSON dan fromJSON bolak-balik', () => {
  const r = new Relation('T', ['a', 'b'], [[1, 2]]);
  const r2 = Relation.fromJSON(JSON.parse(JSON.stringify(r)));
  benar(r.equals(r2));
  sama(r2.name, 'T');
});
