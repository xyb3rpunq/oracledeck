import { grup, uji, sama, benar, melempar, samaAngka, relasiSama } from './harness.js';
import { Relation } from '../engine/core/relation.js';
import * as A from '../engine/core/algebra.js';

grup('core/algebra');

const R = () => new Relation('R', ['id', 'n'], [[1, 'a'], [2, 'b'], [3, 'c']]);
const S = () => new Relation('S', ['id', 'v'], [[1, 10], [1, 11], [2, 20]]);

uji('select menyaring baris', () => {
  const out = A.select(R(), (row) => row.id > 1);
  sama(out.rows, [[2, 'b'], [3, 'c']]);
  sama(out.trace.op, 'select');
  sama(out.trace.in, 3);
  sama(out.trace.out, 2);
});

uji('project memilih kolom dan membuang duplikat', () => {
  const r = new Relation('T', ['a', 'b'], [[1, 9], [1, 8]]);
  sama(A.project(r, ['a']).rows, [[1]]);
  sama(A.project(r, ['a'], true).rows, [[1], [1]]);
});

uji('project melempar untuk atribut tidak dikenal', () => {
  melempar(() => A.project(R(), ['zz']), 'tidak ada');
});

uji('product menghasilkan perkalian kartesian dengan prefiks saat bentrok', () => {
  const p = A.product(R(), S());
  sama(p.cardinality, 9);
  sama(p.attrs, ['R.id', 'R.n', 'S.id', 'S.v']);
});

uji('product tanpa bentrok tidak memberi prefiks', () => {
  const p = A.product(new Relation('X', ['a'], [[1]]), new Relation('Y', ['b'], [[2]]));
  sama(p.attrs, ['a', 'b']);
});

uji('join theta memakai kondisi bebas', () => {
  const j = A.join(R(), S(), (row) => row['R.id'] === row['S.id']);
  sama(j.cardinality, 3);
});

uji('naturalJoin memadankan atribut bersama', () => {
  const j = A.naturalJoin(R(), S());
  sama(j.attrs, ['id', 'n', 'v']);
  sama(j.cardinality, 3);
  sama(j.trace.on, ['id']);
});

uji('naturalJoin tanpa atribut bersama jatuh ke product', () => {
  const j = A.naturalJoin(new Relation('X', ['a'], [[1], [2]]), new Relation('Y', ['b'], [[3]]));
  sama(j.cardinality, 2);
});

uji('semiJoin hanya menyisakan baris yang punya pasangan', () => {
  const sj = A.semiJoin(R(), S());
  sama(sj.attrs, ['id', 'n']);
  sama(sj.rows, [[1, 'a'], [2, 'b']]);
});

uji('semiJoin tanpa atribut bersama mengembalikan R bila S tidak kosong', () => {
  const X = new Relation('X', ['a'], [[1]]);
  sama(A.semiJoin(X, new Relation('Y', ['b'], [[1]])).cardinality, 1);
  sama(A.semiJoin(X, new Relation('Y', ['b'], [])).cardinality, 0);
});

uji('union membuang duplikat, unionAll tidak', () => {
  const a = new Relation('A', ['x'], [[1], [2]]);
  const b = new Relation('B', ['x'], [[2], [3]]);
  sama(A.union(a, b).rows, [[1], [2], [3]]);
  sama(A.unionAll(a, b).cardinality, 4);
});

uji('union menyesuaikan urutan atribut', () => {
  const a = new Relation('A', ['x', 'y'], [[1, 2]]);
  const b = new Relation('B', ['y', 'x'], [[4, 3]]);
  sama(A.union(a, b).rows, [[1, 2], [3, 4]]);
});

uji('union menolak relasi tidak union-compatible', () => {
  melempar(() => A.union(new Relation('A', ['x'], []), new Relation('B', ['x', 'y'], [])), 'derajat berbeda');
  melempar(() => A.union(new Relation('A', ['x'], []), new Relation('B', ['z'], [])), 'tidak union-compatible');
});

uji('intersect dan difference', () => {
  const a = new Relation('A', ['x'], [[1], [2], [3]]);
  const b = new Relation('B', ['x'], [[2], [3], [4]]);
  sama(A.intersect(a, b).rows, [[2], [3]]);
  sama(A.difference(a, b).rows, [[1]]);
});

uji('leftOuterJoin mengisi null untuk yang tidak berpasangan', () => {
  const loj = A.leftOuterJoin(R(), S());
  sama(loj.cardinality, 4);
  sama(loj.rows[3], [3, 'c', null]);
});

uji('rightOuterJoin mempertahankan seluruh baris kanan', () => {
  const roj = A.rightOuterJoin(R(), S());
  sama(roj.cardinality, 3);
});

uji('fullOuterJoin menggabungkan kedua sisi', () => {
  const Rx = new Relation('R', ['id', 'n'], [[1, 'a'], [3, 'c']]);
  const Sx = new Relation('S', ['id', 'v'], [[1, 10], [9, 90]]);
  const foj = A.fullOuterJoin(Rx, Sx);
  sama(foj.cardinality, 3);
  benar(foj.rows.some((r) => r[0] === 9 && r[1] === null));
});

uji('groupBy menghitung agregasi per kelompok', () => {
  const g = A.groupBy(S(), ['id'], [{ fn: 'COUNT', attr: '*', as: 'c' }, { fn: 'SUM', attr: 'v', as: 's' }]);
  sama(g.attrs, ['id', 'c', 's']);
  sama(g.rows, [[1, 2, 21], [2, 1, 20]]);
});

uji('groupBy tanpa kolom pengelompokan atas relasi kosong tetap satu baris', () => {
  const kosong = new Relation('K', ['v'], []);
  const g = A.groupBy(kosong, [], [{ fn: 'COUNT', attr: '*', as: 'c' }]);
  sama(g.rows, [[0]]);
});

uji('groupBy melempar untuk atribut tidak dikenal', () => {
  melempar(() => A.groupBy(S(), ['zz'], []), 'tidak ada');
});

uji('aggregate menangani kelima fungsi', () => {
  sama(A.aggregate('COUNT', [1, null, 3]), 2);
  sama(A.aggregate('SUM', [1, 2, 3]), 6);
  samaAngka(A.aggregate('AVG', [2, 4]), 3);
  sama(A.aggregate('MIN', [5, 2, 9]), 2);
  sama(A.aggregate('MAX', [5, 2, 9]), 9);
});

uji('aggregate atas himpunan kosong', () => {
  sama(A.aggregate('COUNT', []), 0);
  sama(A.aggregate('SUM', []), 0);
  sama(A.aggregate('AVG', []), null);
  sama(A.aggregate('MIN', []), null);
  sama(A.aggregate('MAX', []), null);
});

uji('aggregate MIN/MAX atas teks memakai urutan leksikografis', () => {
  sama(A.aggregate('MIN', ['banana', 'apel']), 'apel');
  sama(A.aggregate('MAX', ['banana', 'apel']), 'banana');
});

uji('aggregate menolak fungsi tak dikenal', () => {
  melempar(() => A.aggregate('MEDIAN', [1]), 'tidak dikenal');
});

uji('orderBy stabil dan mendukung DESC', () => {
  const r = new Relation('T', ['a', 'b'], [[1, 'x'], [2, 'y'], [1, 'z']]);
  sama(A.orderBy(r, [{ attr: 'a', dir: 'ASC' }]).rows, [[1, 'x'], [1, 'z'], [2, 'y']]);
  sama(A.orderBy(r, [{ attr: 'a', dir: 'DESC' }]).rows, [[2, 'y'], [1, 'x'], [1, 'z']]);
});

uji('orderBy melempar untuk atribut tidak dikenal', () => {
  melempar(() => A.orderBy(R(), [{ attr: 'zz' }]), 'tidak ada');
});

uji('compareValues menempatkan null paling awal dan membandingkan angka sebagai angka', () => {
  sama(A.compareValues(null, 1), -1);
  sama(A.compareValues(1, null), 1);
  sama(A.compareValues(null, null), 0);
  sama(A.compareValues('9', '10'), -1);
  sama(A.compareValues('b', 'a'), 1);
});

uji('limit memotong dan menggeser', () => {
  const r = new Relation('T', ['a'], [[1], [2], [3], [4]]);
  sama(A.limit(r, 2).rows, [[1], [2]]);
  sama(A.limit(r, 2, 2).rows, [[3], [4]]);
});

uji('commonAttrs mengabaikan prefiks', () => {
  sama(A.commonAttrs(new Relation('R', ['R.id', 'x'], []), new Relation('S', ['id', 'y'], [])), ['R.id']);
});

uji('reorderTo menyusun ulang kolom', () => {
  const r = new Relation('T', ['a', 'b'], [[1, 2]]);
  sama(A.reorderTo(r, ['b', 'a']).rows, [[2, 1]]);
  melempar(() => A.reorderTo(r, ['z']), 'tidak ada');
});

uji('hukum aljabar: proyeksi setelah seleksi setara seleksi setelah proyeksi', () => {
  const r = new Relation('T', ['a', 'b'], [[1, 'x'], [2, 'y'], [3, 'x']]);
  const kiri = A.project(A.select(r, (o) => o.b === 'x'), ['a']);
  const kanan = A.select(A.project(r, ['a', 'b'], true), (o) => o.b === 'x');
  relasiSama(kiri, A.project(kanan, ['a']));
});

uji('hukum aljabar: semijoin adalah proyeksi dari join', () => {
  const r = R(); const s = S();
  relasiSama(A.semiJoin(r, s), A.project(A.naturalJoin(r, s), ['id', 'n']));
});
