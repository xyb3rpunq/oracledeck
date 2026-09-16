import { grup, uji, sama, benar, salah, melempar, memuat } from './harness.js';
import { dreamhome, rumahsakit } from '../engine/data/datasets.js';
import * as Fg from '../engine/ddb/fragment.js';

grup('ddb/fragment');

const { STAFF, PROPERTY } = dreamhome();

uji('horizontal memecah relasi menurut predikat', () => {
  const f = Fg.horizontal(STAFF, [
    { nama: 'MANAJER', predikat: (r) => r.position === 'Manager', teks: "position = 'Manager'" },
    { nama: 'BUKAN_MANAJER', predikat: (r) => r.position !== 'Manager', teks: "position <> 'Manager'" },
  ]);
  sama(f[0].relasi.cardinality, 3);
  sama(f[1].relasi.cardinality, 7);
  memuat(f[0].aljabar, 'σ_{');
});

uji('horizontalByAttribute membuat satu fragmen per nilai', () => {
  const f = Fg.horizontalByAttribute(STAFF, 'branchno', { prefix: 'S' });
  sama(f.length, 3);
  sama(f.map((x) => x.relasi.cardinality), [4, 3, 3]);
});

uji('horizontalByAttribute menolak atribut tidak dikenal', () => {
  melempar(() => Fg.horizontalByAttribute(STAFF, 'zz'), 'tidak ada');
});

uji('vertical selalu menyertakan kunci', () => {
  const v = Fg.vertical(STAFF, [{ nama: 'V1', atribut: ['fname', 'lname'] }], 'staffno');
  sama(v[0].relasi.attrs, ['staffno', 'fname', 'lname']);
});

uji('vertical menolak kunci yang tidak ada', () => {
  melempar(() => Fg.vertical(STAFF, [{ nama: 'V1', atribut: ['fname'] }], 'zz'), 'kunci "zz" tidak ada');
});

uji('derived mengikuti fragmen induk lewat semijoin', () => {
  const h = Fg.horizontalByAttribute(STAFF, 'branchno', { prefix: 'S' });
  const d = Fg.derived(PROPERTY, h, 'branchno');
  sama(d.length, 3);
  sama(d.map((x) => x.relasi.cardinality), [4, 2, 2]);
  sama(d[0].induk, 'S1');
  sama(d[0].tipe, 'turunan');
});

uji('mixed mereproduksi skema S1/S21/S22/S23 dari Modul 6', () => {
  const f = Fg.mixed(STAFF, {
    key: 'staffno',
    verticalGroups: [
      { nama: 'S1', atribut: ['position', 'sex', 'dob', 'salary'] },
      { nama: 'S2', atribut: ['fname', 'lname', 'branchno', 'sex', 'dob', 'salary'] },
    ],
    horizontalOn: 'branchno',
    targetFragment: 'S2',
  });
  sama(f.map((x) => x.nama), ['S1', 'S21', 'S22', 'S23']);
  sama(f[0].relasi.cardinality, 10);
  sama(f.slice(1).map((x) => x.relasi.cardinality), [4, 3, 3]);
  sama(f[1].tipe, 'campuran');
});

uji('checkCompleteness meloloskan fragmentasi horizontal penuh', () => {
  const h = Fg.horizontalByAttribute(STAFF, 'branchno');
  benar(Fg.checkCompleteness(STAFF, h).lengkap);
});

uji('checkCompleteness menangkap tupel yang hilang', () => {
  const h = Fg.horizontal(STAFF, [{ nama: 'F1', predikat: (r) => r.branchno === 'B3', teks: "branchno='B3'" }]);
  const c = Fg.checkCompleteness(STAFF, h);
  salah(c.lengkap);
  sama(c.hilang.length, 6);
});

uji('checkCompleteness untuk vertikal memeriksa atribut', () => {
  const v = Fg.vertical(STAFF, [{ nama: 'V1', atribut: ['fname'] }], 'staffno');
  const c = Fg.checkCompleteness(STAFF, v);
  salah(c.lengkap);
  benar(c.hilang.includes('salary'));
});

uji('reconstruct horizontal memakai UNION', () => {
  const h = Fg.horizontalByAttribute(STAFF, 'branchno');
  const r = Fg.reconstruct(STAFF, h);
  sama(r.operator, 'UNION (∪)');
  benar(r.relasi.equals(STAFF));
});

uji('reconstruct vertikal memakai NATURAL JOIN', () => {
  const v = Fg.vertical(STAFF, [
    { nama: 'V1', atribut: ['fname', 'lname', 'position'] },
    { nama: 'V2', atribut: ['sex', 'dob', 'salary', 'branchno'] },
  ], 'staffno');
  const r = Fg.reconstruct(STAFF, v);
  sama(r.operator, 'NATURAL JOIN (⋈)');
  benar(r.relasi.equals(STAFF));
});

uji('reconstruct atas daftar fragmen kosong', () => {
  sama(Fg.reconstruct(STAFF, []).relasi.cardinality, 0);
});

uji('checkDisjointness horizontal menangkap tupel ganda', () => {
  const h = Fg.horizontal(STAFF, [
    { nama: 'A', predikat: (r) => r.salary >= 12000, teks: 'salary >= 12000' },
    { nama: 'B', predikat: (r) => r.salary >= 9000, teks: 'salary >= 9000' },
  ]);
  const d = Fg.checkDisjointness(STAFF, h);
  salah(d.disjoint);
  benar(d.tumpangTindih.length > 0);
});

uji('checkDisjointness vertikal hanya mengizinkan kunci berulang', () => {
  const ok = Fg.vertical(STAFF, [
    { nama: 'V1', atribut: ['fname'] },
    { nama: 'V2', atribut: ['salary'] },
  ], 'staffno');
  benar(Fg.checkDisjointness(STAFF, ok, 'staffno').disjoint);
  const bocor = Fg.vertical(STAFF, [
    { nama: 'V1', atribut: ['fname', 'salary'] },
    { nama: 'V2', atribut: ['salary'] },
  ], 'staffno');
  salah(Fg.checkDisjointness(STAFF, bocor, 'staffno').disjoint);
});

uji('auditFragmentation menggabungkan ketiga aturan', () => {
  const h = Fg.horizontalByAttribute(STAFF, 'branchno');
  const a = Fg.auditFragmentation(STAFF, h);
  benar(a.valid);
  sama(a.ringkas.length, 3);
  a.ringkas.forEach((s) => memuat(s, 'LULUS'));
});

uji('auditFragmentation menandai rancangan yang cacat', () => {
  const h = Fg.horizontal(STAFF, [{ nama: 'F1', predikat: (r) => r.branchno === 'B3', teks: "branchno='B3'" }]);
  salah(Fg.auditFragmentation(STAFF, h).valid);
});

uji('mintermPredicates membuang minterm kosong', () => {
  const m = Fg.mintermPredicates(STAFF, [
    { teks: "position = 'Manager'", predikat: (r) => r.position === 'Manager' },
    { teks: 'salary > 15000', predikat: (r) => r.salary > 15000 },
  ]);
  sama(m.length, 3);
  sama(m.reduce((a, b) => a + b.kardinalitas, 0), STAFF.cardinality);
});

uji('mintermPredicates dapat mempertahankan minterm kosong', () => {
  const m = Fg.mintermPredicates(STAFF, [
    { teks: "position = 'Manager'", predikat: (r) => r.position === 'Manager' },
    { teks: 'salary > 15000', predikat: (r) => r.salary > 15000 },
  ], { buangKosong: false });
  sama(m.length, 4);
});

uji('mintermPredicates membatasi jumlah predikat', () => {
  const banyak = Array.from({ length: 13 }, (_, i) => ({ teks: `p${i}`, predikat: () => true }));
  melempar(() => Fg.mintermPredicates(STAFF, banyak), 'maksimum 12');
});

uji('attributeAffinity menjumlahkan akses query bersama', () => {
  const aff = Fg.attributeAffinity(['a', 'b'], [{ atribut: ['a', 'b'], akses: { S1: 5, S2: 5 } }]);
  sama(aff.matriks, [[10, 10], [10, 10]]);
});

uji('verticalSplit memisahkan atribut yang jarang dipakai bersama', () => {
  const aff = Fg.attributeAffinity(['k', 'nama', 'gaji'], [
    { atribut: ['k', 'nama'], akses: { S1: 50 } },
    { atribut: ['k', 'gaji'], akses: { S2: 50 } },
  ]);
  const s = Fg.verticalSplit(aff);
  benar(s.atas.length >= 1 && s.bawah.length >= 1);
  benar(s.atas.length + s.bawah.length === 3);
});

uji('verticalSplit atas satu atribut mengembalikan satu sisi', () => {
  sama(Fg.verticalSplit({ atribut: ['a'], matriks: [[1]] }).bawah, []);
});

uji('summarize meringkas fragmen untuk tabel', () => {
  const h = Fg.horizontalByAttribute(rumahsakit().pasien, 'kota', { prefix: 'P' });
  const s = Fg.summarize(h);
  sama(s.length, 3);
  benar('kardinalitas' in s[0] && 'definisi' in s[0] && 'situs' in s[0]);
});

grup('ddb/fragment — fragmentasi campuran (regresi render)');

const modul6 = () => Fg.mixed(STAFF, {
  key: 'staffno',
  verticalGroups: [
    { nama: 'S1', atribut: ['position', 'sex', 'dob', 'salary'] },
    { nama: 'S2', atribut: ['fname', 'lname', 'branchno', 'sex', 'dob', 'salary'] },
  ],
  horizontalOn: 'branchno',
  targetFragment: 'S2',
});
const campuranBersih = () => Fg.mixed(STAFF, {
  key: 'staffno',
  verticalGroups: [
    { nama: 'S1', atribut: ['position', 'sex', 'dob', 'salary'] },
    { nama: 'S2', atribut: ['fname', 'lname', 'branchno'] },
  ],
  horizontalOn: 'branchno',
  targetFragment: 'S2',
});

uji('strukturFragmen mengenali ketiga mode', () => {
  sama(Fg.strukturFragmen(Fg.horizontalByAttribute(STAFF, 'branchno')).mode, 'horizontal');
  sama(Fg.strukturFragmen(Fg.vertical(STAFF, [{ nama: 'V', atribut: ['fname'] }], 'staffno')).mode, 'vertikal');
  const st = Fg.strukturFragmen(modul6());
  sama(st.mode, 'campuran');
  sama(st.tingkatVertikal.map((v) => v.nama), ['S1', 'S2']);
  sama(st.grup[0].anak.map((a) => a.nama), ['S21', 'S22', 'S23']);
});

uji('rekonstruksi campuran memakai S1 ⋈ (S21 ∪ S22 ∪ S23), bukan join datar', () => {
  const r = Fg.checkReconstruction(STAFF, modul6());
  benar(r.dapatDirekonstruksi);
  sama(r.kardinalitasHasil, 10);
  sama(r.ekspresi, 'STAFF = S1 ⋈ (S21 ∪ S22 ∪ S23)');
});

uji('contoh Modul 6 lengkap dan lossless tetapi TIDAK disjoint di tingkat vertikal', () => {
  const a = Fg.auditFragmentation(STAFF, modul6(), 'staffno');
  benar(a.kelengkapan.lengkap);
  benar(a.rekonstruksi.dapatDirekonstruksi);
  salah(a.kedisjoinan.disjoint);
  sama(a.kedisjoinan.atributBerulang, ['sex', 'dob', 'salary']);
  sama(a.kedisjoinan.tupelBerulang, []);
});

uji('rancangan campuran tanpa atribut berulang lulus ketiga aturan', () => {
  benar(Fg.auditFragmentation(STAFF, campuranBersih(), 'staffno').valid);
});

uji('audit campuran menangkap tupel ganda di dalam kelompok horizontal', () => {
  const f = campuranBersih();
  f[2] = { ...f[2], relasi: f[2].relasi.rename('S22') };
  f[2].relasi.rows.push(f[1].relasi.rows[0]);
  const d = Fg.checkDisjointness(STAFF, f, 'staffno');
  salah(d.disjoint);
  benar(d.tupelBerulang.length === 1);
});

uji('audit campuran menangkap fragmen horizontal yang hilang', () => {
  const f = campuranBersih().filter((x) => x.nama !== 'S23');
  const c = Fg.checkCompleteness(STAFF, f);
  salah(c.lengkap);
  memuat(c.pesan, 'tupel tidak terliput');
});

uji('reconstructionExpression untuk horizontal dan vertikal', () => {
  sama(Fg.reconstructionExpression(STAFF, Fg.horizontalByAttribute(STAFF, 'branchno', { prefix: 'H' })), 'STAFF = H1 ∪ H2 ∪ H3');
  sama(Fg.reconstructionExpression(STAFF, Fg.vertical(STAFF, [{ nama: 'A', atribut: ['fname'] }, { nama: 'B', atribut: ['salary'] }], 'staffno')), 'STAFF = A ⋈ B');
});
