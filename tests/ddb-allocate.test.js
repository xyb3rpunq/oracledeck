import { grup, uji, sama, benar, salah, melempar, samaAngka } from './harness.js';
import { DEFAULT_SITES, DEFAULT_NETWORK } from '../engine/data/datasets.js';
import * as AL from '../engine/ddb/allocate.js';

grup('ddb/allocate');

const input = () => ({
  fragmen: [
    { nama: 'PASIEN_JKT', ukuranKB: 120 },
    { nama: 'PASIEN_BDG', ukuranKB: 90 },
    { nama: 'DOKTER', ukuranKB: 40 },
  ],
  situs: DEFAULT_SITES.map((s) => ({ ...s, keandalan: 0.97 })),
  jaringan: DEFAULT_NETWORK,
  queries: [
    { nama: 'Q1', situsAsal: 'S1', baca: { PASIEN_JKT: 200, DOKTER: 150 }, perbarui: { PASIEN_JKT: 30 } },
    { nama: 'Q2', situsAsal: 'S2', baca: { PASIEN_BDG: 150, DOKTER: 120 }, perbarui: { PASIEN_BDG: 25 } },
    { nama: 'Q3', situsAsal: 'S3', baca: { DOKTER: 130 }, perbarui: {} },
  ],
});

uji('transferCost nol untuk situs yang sama', () => {
  sama(AL.transferCost('S1', 'S1', 100, DEFAULT_NETWORK), 0);
});

uji('transferCost naik seiring jarak dan ukuran', () => {
  const dekat = AL.transferCost('S1', 'S2', 100, DEFAULT_NETWORK);
  const jauh = AL.transferCost('S1', 'S3', 100, DEFAULT_NETWORK);
  const besar = AL.transferCost('S1', 'S2', 1000, DEFAULT_NETWORK);
  benar(jauh > dekat);
  benar(besar > dekat);
});

uji('transferCost simetris bila arah balik tidak didefinisikan', () => {
  const net = { latency: { A: { B: 10 } }, bandwidth: { A: { B: 100 } } };
  samaAngka(AL.transferCost('B', 'A', 100, net), AL.transferCost('A', 'B', 100, net));
});

uji('evaluateAllocation memisahkan biaya simpan, baca, dan perbarui', () => {
  const ev = AL.evaluateAllocation({ PASIEN_JKT: ['S1'], PASIEN_BDG: ['S2'], DOKTER: ['S1'] }, input());
  benar(ev.rincian.simpan > 0);
  benar(ev.rincian.baca > 0);
  benar(ev.rincian.perbarui > 0);
  samaAngka(ev.total, ev.rincian.simpan + ev.rincian.baca + ev.rincian.perbarui, 0.01);
});

uji('evaluateAllocation menolak fragmen tanpa situs', () => {
  melempar(() => AL.evaluateAllocation({ PASIEN_JKT: [] }, input()), 'tidak ditempatkan');
});

uji('evaluateAllocation menolak query yang menyebut fragmen asing', () => {
  const inp = input();
  inp.queries.push({ nama: 'QX', situsAsal: 'S1', baca: { HANTU: 5 }, perbarui: {} });
  melempar(() => AL.evaluateAllocation({ PASIEN_JKT: ['S1'], PASIEN_BDG: ['S2'], DOKTER: ['S1'] }, inp), 'tidak terdaftar');
});

uji('replikasi menaikkan biaya perbarui', () => {
  const satu = AL.evaluateAllocation({ PASIEN_JKT: ['S1'], PASIEN_BDG: ['S2'], DOKTER: ['S1'] }, input());
  const tiga = AL.evaluateAllocation({ PASIEN_JKT: ['S1', 'S2', 'S3'], PASIEN_BDG: ['S2'], DOKTER: ['S1'] }, input());
  benar(tiga.rincian.perbarui > satu.rincian.perbarui);
});

uji('replikasi menurunkan biaya baca untuk fragmen baca-saja', () => {
  const satu = AL.evaluateAllocation({ PASIEN_JKT: ['S1'], PASIEN_BDG: ['S2'], DOKTER: ['S1'] }, input());
  const tiga = AL.evaluateAllocation({ PASIEN_JKT: ['S1'], PASIEN_BDG: ['S2'], DOKTER: ['S1', 'S2', 'S3'] }, input());
  benar(tiga.rincian.baca < satu.rincian.baca);
});

uji('optimalAllocation menemukan rancangan termurah', () => {
  const opt = AL.optimalAllocation(input());
  sama(opt.metode, 'eksak (enumerasi penuh)');
  const semua = AL.nonEmptySubsets(['S1', 'S2', 'S3']);
  for (const a of semua) {
    for (const b of semua) {
      for (const c of semua) {
        const ev = AL.evaluateAllocation({ PASIEN_JKT: a, PASIEN_BDG: b, DOKTER: c }, input());
        benar(ev.total >= opt.total - 1e-6, `ada alokasi lebih murah: ${ev.total} < ${opt.total}`);
      }
    }
  }
});

uji('optimalAllocation menempatkan fragmen lokal di situs pemakainya', () => {
  const opt = AL.optimalAllocation(input());
  sama(opt.alokasi.PASIEN_JKT, ['S1']);
  sama(opt.alokasi.PASIEN_BDG, ['S2']);
});

uji('optimalAllocation beralih ke greedy bila ruang terlalu besar', () => {
  const hasil = AL.optimalAllocation(input(), { maxKombinasi: 10 });
  sama(hasil.metode, 'greedy');
});

uji('greedyAllocation menghasilkan alokasi yang sah', () => {
  const g = AL.greedyAllocation(input());
  benar(Object.values(g.alokasi).every((s) => s.length >= 1));
  benar(g.total > 0);
});

uji('fullReplication dan centralized sebagai pembanding', () => {
  const inp = input();
  const opt = AL.optimalAllocation(inp);
  benar(AL.fullReplication(inp).total >= opt.total);
  benar(AL.centralized(inp, 'S1').total >= opt.total);
});

uji('centralized memakai situs pertama bila tidak disebut', () => {
  const c = AL.centralized(input());
  benar(Object.values(c.alokasi).every((s) => s.length === 1 && s[0] === 'S1'));
});

uji('availability naik seiring jumlah replika', () => {
  const a1 = AL.availability({ F: ['S1'] }, input().situs);
  const a3 = AL.availability({ F: ['S1', 'S2', 'S3'] }, input().situs);
  benar(a3.perFragmen.F.ketersediaan > a1.perFragmen.F.ketersediaan);
  samaAngka(a1.perFragmen.F.ketersediaan, 0.97, 1e-6);
  samaAngka(a3.perFragmen.F.ketersediaan, 1 - 0.03 ** 3, 1e-6);
});

uji('availability sistem adalah hasil kali seluruh fragmen', () => {
  const a = AL.availability({ F1: ['S1'], F2: ['S2'] }, input().situs);
  samaAngka(a.sistem, 0.97 * 0.97, 1e-6);
  samaAngka(a.terlemah, 0.97, 1e-6);
});

uji('usageMatrix menyusun matriks baca dan perbarui', () => {
  const m = AL.usageMatrix(input().fragmen, input().queries);
  sama(m.kolom, ['PASIEN_JKT', 'PASIEN_BDG', 'DOKTER']);
  sama(m.baris[0].baca, [200, 0, 150]);
  sama(m.baris[0].perbarui, [30, 0, 0]);
});

uji('nonEmptySubsets menghasilkan 2^n - 1 himpunan', () => {
  sama(AL.nonEmptySubsets(['a', 'b', 'c']).length, 7);
  salah(AL.nonEmptySubsets(['a']).some((s) => s.length === 0));
});
