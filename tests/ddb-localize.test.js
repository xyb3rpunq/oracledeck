import { grup, uji, sama, benar, salah, melempar, memuat } from './harness.js';
import { dreamhome } from '../engine/data/datasets.js';
import * as Fg from '../engine/ddb/fragment.js';
import * as L from '../engine/ddb/localize.js';

grup('ddb/localize — predikat');

const a = L.atom;
const { STAFF, PROPERTY } = dreamhome();

uji('atomToString dan conjToString', () => {
  sama(L.atomToString(a('kota', '=', 'Jakarta')), "kota = 'Jakarta'");
  sama(L.atomToString(a('gaji', '>', 1000)), 'gaji > 1000');
  sama(L.conjToString([]), 'true');
});

uji('satisfiesAtom untuk keenam operator', () => {
  benar(L.satisfiesAtom(5, a('x', '=', 5)));
  benar(L.satisfiesAtom(5, a('x', '<>', 6)));
  benar(L.satisfiesAtom(5, a('x', '<', 6)));
  benar(L.satisfiesAtom(5, a('x', '>', 4)));
  benar(L.satisfiesAtom(5, a('x', '<=', 5)));
  benar(L.satisfiesAtom(5, a('x', '>=', 5)));
  melempar(() => L.satisfiesAtom(5, a('x', '~', 5)), 'tidak dikenal');
});

uji('atomsContradict pada atribut berbeda selalu false', () => {
  salah(L.atomsContradict(a('x', '=', 1), a('y', '=', 2)));
});

uji('dua kesamaan dengan nilai berbeda bertentangan', () => {
  benar(L.contradictory([a('b', '=', 'B3'), a('b', '=', 'B5')]).ada);
  salah(L.contradictory([a('b', '=', 'B3'), a('b', '=', 'B3')]).ada);
});

uji('selang yang tidak beririsan bertentangan', () => {
  benar(L.contradictory([a('s', '>', 5), a('s', '<', 3)]).ada);
  salah(L.contradictory([a('s', '>', 5), a('s', '<', 10)]).ada);
  benar(L.contradictory([a('s', '<', 5), a('s', '>=', 5)]).ada);
  salah(L.contradictory([a('s', '<=', 5), a('s', '>=', 5)]).ada);
});

uji('tiga atom bertentangan walau tiap pasangan konsisten', () => {
  benar(L.contradictory([a('s', '>', 5), a('s', '<', 10), a('s', '=', 20)]).ada);
  salah(L.contradictory([a('s', '>', 5), a('s', '<', 10), a('s', '=', 7)]).ada);
});

uji('<> bertentangan dengan = pada nilai yang sama', () => {
  benar(L.contradictory([a('b', '<>', 'B3'), a('b', '=', 'B3')]).ada);
});

uji('impliesAtom mengenali penyiratan', () => {
  benar(L.impliesAtom([a('x', '=', 5)], a('x', '<', 10)));
  benar(L.impliesAtom([a('x', '>', 10)], a('x', '>', 5)));
  salah(L.impliesAtom([a('x', '>', 5)], a('x', '>', 10)));
});

uji('simplifyConj membuang atom berlebih', () => {
  const c = L.simplifyConj([a('x', '=', 5), a('x', '=', 5)]);
  sama(c.length, 1);
});

uji('conjPredicate menyaring baris nyata', () => {
  const p = L.conjPredicate([a('branchno', '=', 'B3'), a('position', '=', 'Assistant')]);
  sama(STAFF.objects().filter(p).length, 2);
});

uji('atomPredicate menolak operator tak dikenal', () => {
  melempar(() => L.atomPredicate(a('x', '~', 1))({}), 'tidak dikenal');
});

grup('ddb/localize — program & reduksi');

const fragHorizontal = () => {
  const h = Fg.horizontalByAttribute(STAFF, 'branchno', { prefix: 'S' });
  return h.map((f, i) => ({ ...f, konjungsi: [a('branchno', '=', ['B3', 'B5', 'B7'][i])] }));
};

uji('localizationProgram horizontal memakai UNION', () => {
  const p = L.localizationProgram('STAFF', fragHorizontal());
  sama(p.operator, '∪');
  memuat(p.sql, 'UNION ALL');
  sama(p.fragmen, ['S1', 'S2', 'S3']);
});

uji('localizationProgram vertikal memakai JOIN', () => {
  const v = Fg.vertical(STAFF, [{ nama: 'V1', atribut: ['fname'] }, { nama: 'V2', atribut: ['salary'] }], 'staffno');
  const p = L.localizationProgram('STAFF', v);
  sama(p.operator, '⋈');
  memuat(p.sql, 'NATURAL JOIN');
});

uji('reduceHorizontal membuang fragmen yang predikatnya bertentangan', () => {
  const r = L.reduceHorizontal([a('branchno', '=', 'B3')], fragHorizontal());
  sama(r.fragmenDipakai, ['S1']);
  sama(r.fragmenDibuang, ['S2', 'S3']);
  memuat(r.hasil[1].alasan, 'dibuang');
});

uji('reduceHorizontal mempertahankan semua fragmen bila predikat netral', () => {
  const r = L.reduceHorizontal([a('salary', '>', 1000)], fragHorizontal());
  sama(r.fragmenDipakai.length, 3);
  sama(r.ekspresi.includes('∪'), true);
});

uji('reduceHorizontal menghasilkan himpunan kosong bila semua bertentangan', () => {
  const r = L.reduceHorizontal([a('branchno', '=', 'B9')], fragHorizontal());
  sama(r.fragmenDipakai, []);
  sama(r.ekspresi, '∅');
});

uji('reduceVertical membuang fragmen yang atributnya tidak diminta', () => {
  const v = Fg.vertical(STAFF, [
    { nama: 'V1', atribut: ['position', 'salary'] },
    { nama: 'V2', atribut: ['fname', 'lname'] },
  ], 'staffno');
  const r = L.reduceVertical(['fname', 'lname'], v.map((f) => ({ nama: f.nama, atribut: f.relasi.attrs })), 'staffno');
  sama(r.fragmenDipakai, ['V2']);
  sama(r.fragmenDibuang, ['V1']);
});

uji('reduceJoin membuang pasangan fragmen yang bertentangan', () => {
  const kiri = fragHorizontal().map((f) => ({ nama: f.nama, konjungsi: f.konjungsi }));
  const kanan = kiri.map((f) => ({ nama: `P${f.nama}`, konjungsi: f.konjungsi }));
  const r = L.reduceJoin(kiri, kanan, 'branchno');
  sama(r.jumlahAsal, 9);
  sama(r.jumlahSisa, 3);
  benar(r.penghematan > 60);
});

uji('reduceDerived hanya memasangkan anak dengan induknya', () => {
  const h = Fg.horizontalByAttribute(STAFF, 'branchno', { prefix: 'S' });
  const d = Fg.derived(PROPERTY, h, 'branchno');
  const r = L.reduceDerived(d.map((x) => ({ nama: x.nama, induk: x.induk })), h.map((x) => ({ nama: x.nama })));
  sama(r.jumlahAsal, 9);
  sama(r.jumlahSisa, 3);
});

uji('verifyReduction membuktikan hasil lokal sama dengan hasil global', () => {
  const v = L.verifyReduction(STAFF, fragHorizontal(), [a('branchno', '=', 'B3'), a('position', '=', 'Assistant')], ['fname', 'lname']);
  benar(v.setara);
  sama(v.barisGlobal, v.barisLokal);
  sama(v.fragmenDisentuh, ['S1']);
  sama(v.fragmenDilewati, ['S2', 'S3']);
});

uji('verifyReduction tetap setara ketika semua fragmen terpakai', () => {
  const v = L.verifyReduction(STAFF, fragHorizontal(), [a('position', '=', 'Manager')]);
  benar(v.setara);
  sama(v.fragmenDisentuh.length, 3);
  sama(v.barisGlobal, 3);
});

uji('verifyReduction menghasilkan relasi kosong bila tidak ada fragmen cocok', () => {
  const v = L.verifyReduction(STAFF, fragHorizontal(), [a('branchno', '=', 'B9')]);
  benar(v.setara);
  sama(v.barisLokal, 0);
});

uji('treeToText menggambar pohon operator', () => {
  const t = {
    op: 'project', attrs: ['fname'], children: [
      { op: 'select', pred: "branchno='B3'", children: [{ op: 'relation', name: 'S1', situs: 'S3', children: [] }] },
    ],
  };
  const teks = L.treeToText(t);
  memuat(teks, 'π fname');
  memuat(teks, 'σ');
  memuat(teks, 'S1 @S3');
});

uji('countNodes menghitung simpul pohon', () => {
  const t = { op: 'union', children: [{ op: 'relation', children: [] }, { op: 'relation', children: [] }] };
  sama(L.countNodes(t), 3);
  sama(L.countNodes(null), 0);
});

uji('simplifyConj mempertahankan atom yang lebih ketat', () => {
  const c = L.simplifyConj([a('x', '=', 5), a('x', '<', 10)]);
  sama(c.length, 1);
  sama(c[0].op, '=');
});

uji('simplifyConj tidak mengubah konjungsi yang sudah minimal', () => {
  const c = L.simplifyConj([a('x', '=', 5), a('y', '=', 3)]);
  sama(c.length, 2);
});
