import { grup, uji, sama, benar, salah, melempar } from './harness.js';
import { Relation } from '../engine/core/relation.js';
import * as F from '../engine/core/fd.js';

grup('core/fd — normalisasi');

const fdTask7 = () => F.parseFds(`
  nik -> nama, alamat, kota, kodeperusahaan
  kodeperusahaan -> namaperusahaan, kategoriperusahaan
  kategoriperusahaan -> deskripsiperusahaan
`);
const attrTask7 = ['nik', 'nama', 'alamat', 'kota', 'kodeperusahaan', 'namaperusahaan', 'kategoriperusahaan', 'deskripsiperusahaan'];

uji('parseFds membaca beberapa baris dan beberapa panah', () => {
  const f = F.parseFds('a -> b\nc, d => e\nf → g');
  sama(f.length, 3);
  sama(f[1], { lhs: ['c', 'd'], rhs: ['e'] });
});

uji('parseFds menolak baris tanpa panah', () => { melempar(() => F.parseFds('a b c'), 'tidak valid'); });

uji('closure menghitung penutupan atribut', () => {
  sama(F.closure(['nik'], fdTask7()).length, 8);
  sama(F.closure(['kodeperusahaan'], fdTask7()), ['deskripsiperusahaan', 'kategoriperusahaan', 'kodeperusahaan', 'namaperusahaan']);
});

uji('closure atas himpunan kosong hanya mengembalikan dirinya', () => {
  sama(F.closure([], F.parseFds('a -> b')), []);
});

uji('implies memakai closure', () => {
  benar(F.implies(fdTask7(), ['nik'], ['deskripsiperusahaan']));
  salah(F.implies(fdTask7(), ['kota'], ['nik']));
});

uji('setEq dan isSubset', () => {
  benar(F.setEq(['a', 'b'], ['b', 'a']));
  salah(F.setEq(['a'], ['a', 'b']));
  benar(F.isSubset(['a'], ['a', 'b']));
  salah(F.isSubset(['c'], ['a', 'b']));
});

uji('combinations menghasilkan seluruh kombinasi', () => {
  sama([...F.combinations(['a', 'b', 'c'], 2)], [['a', 'b'], ['a', 'c'], ['b', 'c']]);
  sama([...F.combinations(['a'], 2)], []);
});

uji('candidateKeys menemukan kunci tunggal', () => {
  sama(F.candidateKeys(attrTask7, fdTask7()), [['nik']]);
});

uji('candidateKeys menemukan lebih dari satu kunci', () => {
  sama(F.candidateKeys(['A', 'B', 'C'], F.parseFds('A,B -> C\nC -> B')), [['A', 'B'], ['A', 'C']]);
});

uji('candidateKeys menolak relasi terlalu lebar', () => {
  const lebar = Array.from({ length: 21 }, (_, i) => `a${i}`);
  melempar(() => F.candidateKeys(lebar, []), 'terlalu lebar');
});

uji('primeAttributes mengumpulkan atribut anggota kunci', () => {
  sama(F.primeAttributes(['A', 'B', 'C'], F.parseFds('A,B -> C\nC -> B')), ['A', 'B', 'C']);
});

uji('minimalCover tidak memangkas ruas kiri yang masih perlu', () => {
  const cover = F.minimalCover(F.parseFds('A,B -> C\nC -> B'));
  sama(cover.map(F.fdToString), ['A, B -> C', 'C -> B']);
});

uji('minimalCover memangkas atribut ekstra di ruas kiri', () => {
  const cover = F.minimalCover(F.parseFds('A -> B\nA,B -> C'));
  sama(cover.map(F.fdToString).sort(), ['A -> B', 'A -> C']);
});

uji('minimalCover membuang FD yang bisa disimpulkan', () => {
  const cover = F.minimalCover(F.parseFds('A -> B\nB -> C\nA -> C'));
  sama(cover.length, 2);
});

uji('violations2NF menemukan ketergantungan parsial', () => {
  const v = F.violations2NF(['nim', 'kode_kul', 'nilai', 'nama_mhs'], F.parseFds('nim,kode_kul -> nilai\nnim -> nama_mhs'));
  sama(v.map(F.fdToString), ['nim -> nama_mhs']);
});

uji('violations3NF menemukan ketergantungan transitif', () => {
  const v = F.violations3NF(attrTask7, fdTask7());
  benar(v.length >= 2);
  benar(v.every((x) => x.alasan.includes('transitif')));
});

uji('violationsBCNF hanya menyisakan ruas kiri bukan superkey', () => {
  const v = F.violationsBCNF(['A', 'B', 'C'], F.parseFds('A,B -> C\nC -> B'));
  sama(v.map(F.fdToString), ['C -> B']);
});

uji('normalForm mengklasifikasi tingkat tertinggi', () => {
  sama(F.normalForm(['nim', 'kode_kul', 'nilai', 'nama_mhs'], F.parseFds('nim,kode_kul -> nilai\nnim -> nama_mhs')), '1NF');
  sama(F.normalForm(attrTask7, fdTask7()), '2NF');
  sama(F.normalForm(['A', 'B', 'C'], F.parseFds('A,B -> C\nC -> B')), '3NF');
  sama(F.normalForm(['A', 'B'], F.parseFds('A -> B')), 'BCNF');
});

uji('normalForm melaporkan 1NF belum terpenuhi', () => {
  sama(F.normalForm(['A'], [], { atomic: false }), '1NF belum terpenuhi');
});

uji('synthesize3NF menghasilkan dekomposisi lossless dan preserving', () => {
  const rels = F.synthesize3NF(attrTask7, fdTask7());
  sama(rels.length, 3);
  const skema = rels.map((r) => r.attrs);
  benar(F.losslessChase(attrTask7, skema, fdTask7()).lossless);
  benar(F.preservesDependencies(skema, fdTask7()).preserved);
  rels.forEach((r) => benar(F.normalForm(r.attrs, r.fds) === '3NF' || F.normalForm(r.attrs, r.fds) === 'BCNF'));
});

uji('losslessBinary memakai aturan irisan', () => {
  sama(F.losslessBinary(['A', 'B'], ['B', 'C'], F.parseFds('B -> C')).lossless, true);
  sama(F.losslessBinary(['A', 'B'], ['B', 'C'], F.parseFds('A -> B')).lossless, false);
  sama(F.losslessBinary(['A'], ['B'], F.parseFds('A -> B')).alasan, 'irisan atribut kosong');
});

uji('losslessChase menolak dekomposisi yang kehilangan informasi', () => {
  const hasil = F.losslessChase(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']], F.parseFds('A -> B'));
  salah(hasil.lossless);
});

uji('losslessChase menerima dekomposisi yang benar', () => {
  const hasil = F.losslessChase(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']], F.parseFds('B -> C'));
  benar(hasil.lossless);
  benar(hasil.barisPenuh >= 0);
});

uji('preservesDependencies menemukan ketergantungan yang hilang', () => {
  const hasil = F.preservesDependencies([['A', 'B'], ['B', 'C']], F.parseFds('A,B -> C\nC -> A'));
  salah(hasil.preserved);
  benar(hasil.hilang.length > 0);
});

uji('violations1NF menemukan sel berisi daftar', () => {
  const r = new Relation('T', ['id', 'hobi'], [[1, 'baca, lari'], [2, 'renang']]);
  const v = F.violations1NF(r);
  sama(v.length, 1);
  sama(v[0].atribut, 'hobi');
});

uji('violations1NF menemukan sel berupa larik', () => {
  const r = new Relation('T', ['id', 'tag'], [[1, ['a', 'b']]]);
  sama(F.violations1NF(r)[0].alasan.includes('larik'), true);
});

uji('fdToString mencetak FD', () => {
  sama(F.fdToString({ lhs: ['b', 'a'], rhs: ['c'] }), 'a, b -> c');
});
