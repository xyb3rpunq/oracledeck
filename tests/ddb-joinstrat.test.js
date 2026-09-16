import { grup, uji, sama, benar, salah, melempar, samaAngka, relasiSama } from './harness.js';
import { Relation } from '../engine/core/relation.js';
import { dreamhome } from '../engine/data/datasets.js';
import * as J from '../engine/ddb/joinstrat.js';

grup('ddb/joinstrat');

const { STAFF, PROPERTY } = dreamhome();
const besar = () => new Relation('BESAR', ['k', 'a', 'b', 'c'], Array.from({ length: 500 }, (_, i) => [i, `x${i}`, `y${i}`, `z${i}`]));
const kecil = () => new Relation('KECIL', ['k', 'v'], Array.from({ length: 20 }, (_, i) => [i * 7, `v${i}`]));

uji('keempat strategi menghasilkan relasi yang identik', () => {
  const c = J.compareStrategies(PROPERTY, STAFF, 'staffno');
  benar(c.semuaHasilSama);
  c.strategi.forEach((s) => relasiSama(s.hasil, c.strategi[0].hasil, s.nama));
});

uji('strategi identik juga pada relasi besar dan selektif', () => {
  const c = J.compareStrategies(besar(), kecil(), 'k', { bits: 512, k: 4 });
  benar(c.semuaHasilSama);
});

uji('shipWholeRight mengirim seluruh R', () => {
  const s = J.shipWholeRight(PROPERTY, STAFF, 'staffno');
  sama(s.pesan, 1);
  sama(s.byteTerkirim, PROPERTY.cardinality * PROPERTY.degree * 12);
});

uji('shipWholeLeft mengirim seluruh S', () => {
  const s = J.shipWholeLeft(PROPERTY, STAFF, 'staffno');
  sama(s.byteTerkirim, STAFF.cardinality * STAFF.degree * 12);
});

uji('semijoin memakai dua pesan dan mereduksi R', () => {
  const s = J.semiJoinStrategy(besar(), kecil(), 'k');
  sama(s.pesan, 2);
  benar(s.tupelDireduksi > 400);
  benar(s.selektivitas < 0.1);
});

uji('semijoin pada relasi yang seluruhnya berpasangan tidak mereduksi apa pun', () => {
  const s = J.semiJoinStrategy(PROPERTY, STAFF, 'staffno');
  sama(s.tupelDireduksi, 0);
  sama(s.selektivitas, 1);
});

uji('bloom join mengirim penapis yang jauh lebih kecil daripada daftar kunci', () => {
  const b = J.bloomJoinStrategy(besar(), kecil(), 'k', { bits: 512 });
  const s = J.semiJoinStrategy(besar(), kecil(), 'k');
  benar(b.byteTerkirim < s.byteTerkirim);
  sama(b.bitPenapis, 512);
});

uji('bloom join menolak atribut join yang tidak ada', () => {
  melempar(() => J.bloomJoinStrategy(besar(), kecil(), 'zz'), 'tidak ada');
});

uji('positif palsu bloom tidak pernah negatif dan tidak mengubah hasil', () => {
  const b = J.bloomJoinStrategy(besar(), kecil(), 'k', { bits: 64, k: 2 });
  benar(b.positifPalsu >= 0);
  relasiSama(b.hasil, J.shipWholeRight(besar(), kecil(), 'k').hasil);
});

uji('BloomFilter tidak pernah menghasilkan negatif palsu', () => {
  const bf = new J.BloomFilter(128, 3);
  const nilai = Array.from({ length: 40 }, (_, i) => `nilai-${i}`);
  nilai.forEach((v) => bf.add(v));
  nilai.forEach((v) => benar(bf.test(v), `${v} seharusnya lolos penapis`));
});

uji('BloomFilter menyalakan bit dan melaporkan ukurannya', () => {
  const bf = new J.BloomFilter(64, 3);
  sama(bf.terisi, 0);
  bf.add('x');
  benar(bf.terisi > 0 && bf.terisi <= 3);
  sama(bf.byteSize, 8);
});

uji('BloomFilter menghitung laju positif palsu teoretis', () => {
  const bf = new J.BloomFilter(1024, 3);
  benar(bf.falsePositiveRate(10) < bf.falsePositiveRate(200));
});

uji('BloomFilter.hash deterministik', () => {
  sama(J.BloomFilter.hash('abc', 0), J.BloomFilter.hash('abc', 0));
  benar(J.BloomFilter.hash('abc', 0) !== J.BloomFilter.hash('abc', 1));
});

uji('posisi bit bloom selalu di dalam rentang', () => {
  const bf = new J.BloomFilter(37, 4);
  for (let i = 0; i < 200; i++) {
    bf.positions(`nilai-${i}`).forEach((p) => benar(p >= 0 && p < 37, `posisi ${p} di luar rentang`));
  }
});

uji('compareStrategies memeringkat menurut total biaya', () => {
  const c = J.compareStrategies(besar(), kecil(), 'k');
  const total = c.peringkat.map((p) => p.total);
  sama(total, [...total].sort((a, b) => a - b));
  sama(c.peringkat[0].id, c.terbaik);
});

uji('pada relasi besar dan selektif, semijoin mengalahkan kirim-R-utuh', () => {
  const c = J.compareStrategies(besar(), kecil(), 'k');
  const sj = c.strategi.find((s) => s.id === 'semijoin');
  const sr = c.strategi.find((s) => s.id === 'ship-r');
  benar(sj.total < sr.total, `semijoin ${sj.total} seharusnya lebih murah dari ship-r ${sr.total}`);
});

uji('pada relasi kecil, kirim utuh justru lebih murah', () => {
  const c = J.compareStrategies(PROPERTY, STAFF, 'staffno');
  benar(c.terbaik.startsWith('ship'));
});

uji('crossoverAnalysis menghitung selektivitas titik impas', () => {
  const a = J.crossoverAnalysis(besar(), kecil());
  benar(a.layak);
  benar(a.selektivitasImpas > 0 && a.selektivitasImpas < 1);
  sama(a.byteR, 500 * 4 * 12);
});

uji('crossoverAnalysis menyatakan semijoin tidak layak pada relasi kecil', () => {
  const a = J.crossoverAnalysis(PROPERTY, STAFF);
  salah(a.layak);
  sama(a.selektivitasImpas, 0);
});

uji('biaya dapat disetel lewat opsi', () => {
  const murah = J.shipWholeRight(PROPERTY, STAFF, 'staffno', { biaya: { perPesan: 0, perByte: 0, perTupelLokal: 0 } });
  samaAngka(murah.total, 0);
});

uji('lebar kolom mempengaruhi volume byte', () => {
  const a = J.shipWholeRight(PROPERTY, STAFF, 'staffno', { lebarKolom: 12 });
  const b = J.shipWholeRight(PROPERTY, STAFF, 'staffno', { lebarKolom: 24 });
  sama(b.byteTerkirim, a.byteTerkirim * 2);
});

uji('setiap strategi mencantumkan langkah yang dapat dibaca', () => {
  const c = J.compareStrategies(PROPERTY, STAFF, 'staffno');
  c.strategi.forEach((s) => {
    benar(s.langkah.length >= 3, `${s.nama} harus punya langkah`);
    benar(s.langkah.every((l) => typeof l === 'string' && l.length > 10));
  });
});
