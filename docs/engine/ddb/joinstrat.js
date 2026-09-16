// joinstrat.js — strategi eksekusi join terdistribusi (Topik 14: Distributed Joins).
// Yang dihitung bukan tebakan: setiap strategi benar-benar dijalankan atas relasi
// contoh, lalu volume byte yang menyeberang jaringan dihitung dari hasil nyata.
//
// Model biaya (Modul 6, Transparansi Kinerja):
//   biaya = biaya I/O + biaya CPU + biaya komunikasi
//   pada WAN biaya komunikasi mendominasi, jadi metrik utamanya adalah byte terkirim.

import { Relation } from '../core/relation.js?v=8e172babd6';
import * as A from '../core/algebra.js?v=8e172babd6';

/** Biaya komunikasi: C0 per pesan + C1 per byte. */
export const BIAYA_DEFAULT = { perPesan: 20, perByte: 0.02, perTupelLokal: 0.1 };

function ukuran(rel, lebarKolom = 12) { return rel.cardinality * rel.degree * lebarKolom; }

function transfer(bytes, pesan, biaya) {
  return biaya.perPesan * pesan + biaya.perByte * bytes;
}

/**
 * @param {Relation} R relasi di situs kiri
 * @param {Relation} S relasi di situs kanan
 * @param {string} atributJoin
 */
export function shipWholeRight(R, S, atributJoin, opt = {}) {
  const biaya = { ...BIAYA_DEFAULT, ...(opt.biaya || {}) };
  const hasil = A.naturalJoin(R, S);
  const kirim = ukuran(R, opt.lebarKolom);
  return {
    nama: 'Kirim R utuh ke situs S',
    id: 'ship-r',
    langkah: [
      `Situs R mengirim seluruh ${R.name} (${R.cardinality} tupel, ${kirim} B) ke situs S`,
      `Situs S menghitung ${R.name} ⋈ ${S.name} secara lokal`,
      `Hasil ${hasil.cardinality} tupel siap di situs S`,
    ],
    byteTerkirim: kirim,
    pesan: 1,
    biayaKomunikasi: round(transfer(kirim, 1, biaya)),
    biayaLokal: round((R.cardinality + S.cardinality) * biaya.perTupelLokal),
    total: round(transfer(kirim, 1, biaya) + (R.cardinality + S.cardinality) * biaya.perTupelLokal),
    hasil,
  };
}

export function shipWholeLeft(R, S, atributJoin, opt = {}) {
  const biaya = { ...BIAYA_DEFAULT, ...(opt.biaya || {}) };
  const hasil = A.naturalJoin(R, S);
  const kirim = ukuran(S, opt.lebarKolom);
  return {
    nama: 'Kirim S utuh ke situs R',
    id: 'ship-s',
    langkah: [
      `Situs S mengirim seluruh ${S.name} (${S.cardinality} tupel, ${kirim} B) ke situs R`,
      `Situs R menghitung ${R.name} ⋈ ${S.name} secara lokal`,
      `Hasil ${hasil.cardinality} tupel siap di situs R`,
    ],
    byteTerkirim: kirim,
    pesan: 1,
    biayaKomunikasi: round(transfer(kirim, 1, biaya)),
    biayaLokal: round((R.cardinality + S.cardinality) * biaya.perTupelLokal),
    total: round(transfer(kirim, 1, biaya) + (R.cardinality + S.cardinality) * biaya.perTupelLokal),
    hasil,
  };
}

/**
 * Semijoin: R ⋈ S = (R ⋉ S) ⋈ S.
 * Yang dikirim hanya kolom join S, lalu hanya tupel R yang benar-benar cocok.
 */
export function semiJoinStrategy(R, S, atributJoin, opt = {}) {
  const biaya = { ...BIAYA_DEFAULT, ...(opt.biaya || {}) };
  const lebar = opt.lebarKolom || 12;
  const proj = A.project(S, [atributJoin]);
  const kirim1 = proj.cardinality * lebar;
  const Rred = A.semiJoin(R, proj, `${R.name}_reduksi`);
  const kirim2 = Rred.cardinality * R.degree * lebar;
  const hasil = A.naturalJoin(Rred, S);
  const totalByte = kirim1 + kirim2;
  return {
    nama: 'Semijoin',
    id: 'semijoin',
    langkah: [
      `Situs S mengirim π_${atributJoin}(${S.name}) — ${proj.cardinality} nilai, ${kirim1} B — ke situs R`,
      `Situs R menghitung ${R.name} ⋉ ${S.name} = ${Rred.cardinality} tupel (dari ${R.cardinality})`,
      `Situs R mengirim balik ${Rred.cardinality} tupel (${kirim2} B) ke situs S`,
      `Situs S menyelesaikan join: ${hasil.cardinality} tupel`,
    ],
    byteTerkirim: totalByte,
    pesan: 2,
    selektivitas: R.cardinality ? round(Rred.cardinality / R.cardinality) : 0,
    tupelDireduksi: R.cardinality - Rred.cardinality,
    biayaKomunikasi: round(transfer(totalByte, 2, biaya)),
    biayaLokal: round((R.cardinality + S.cardinality + Rred.cardinality) * biaya.perTupelLokal),
    total: round(transfer(totalByte, 2, biaya) + (R.cardinality + S.cardinality + Rred.cardinality) * biaya.perTupelLokal),
    hasil,
  };
}

// ------------------------------------------------------------- bloom join

/** Penapis Bloom sederhana dengan k fungsi hash turunan (double hashing). */
export class BloomFilter {
  constructor(bits = 128, k = 3) {
    this.bits = bits;
    this.k = k;
    this.vector = new Uint8Array(bits);
  }

  static hash(str, seed) {
    let h = 2166136261 ^ seed;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  positions(v) {
    const h1 = BloomFilter.hash(v, 0);
    const h2 = BloomFilter.hash(v, 0x9e3779b9) | 1;
    const out = [];
    // >>> 0 wajib: Math.imul mengembalikan bilangan bertanda, dan indeks negatif
    // membuat penulisan ke Uint8Array diabaikan diam-diam sehingga penapis
    // menolak semua nilai.
    for (let i = 0; i < this.k; i++) out.push(((h1 + Math.imul(i, h2)) >>> 0) % this.bits);
    return out;
  }

  add(v) { for (const p of this.positions(v)) this.vector[p] = 1; return this; }
  test(v) { return this.positions(v).every((p) => this.vector[p] === 1); }
  get terisi() { return this.vector.reduce((a, b) => a + b, 0); }
  get byteSize() { return Math.ceil(this.bits / 8); }

  /** Perkiraan laju positif palsu: (1 - e^(-kn/m))^k */
  falsePositiveRate(n) {
    const m = this.bits;
    return Math.pow(1 - Math.exp((-this.k * n) / m), this.k);
  }
}

/**
 * Bloom join: yang dikirim bukan daftar nilai join, melainkan penapis Bloom-nya.
 * Jauh lebih kecil dari semijoin, tetapi menyisakan positif palsu yang baru
 * tersaring saat join akhir. Hasil akhir tetap identik.
 */
export function bloomJoinStrategy(R, S, atributJoin, opt = {}) {
  const biaya = { ...BIAYA_DEFAULT, ...(opt.biaya || {}) };
  const lebar = opt.lebarKolom || 12;
  const bits = opt.bits || 128;
  const k = opt.k || 3;
  const bf = new BloomFilter(bits, k);
  const si = S.indexOf(atributJoin);
  if (si < 0) throw new Error(`bloomJoinStrategy: atribut "${atributJoin}" tidak ada di ${S.name}`);
  for (const row of S.rows) bf.add(row[si]);

  const ri = R.indexOf(atributJoin);
  if (ri < 0) throw new Error(`bloomJoinStrategy: atribut "${atributJoin}" tidak ada di ${R.name}`);
  const lolos = R.rows.filter((row) => bf.test(row[ri]));
  const Rfilter = new Relation(`${R.name}_bloom`, R.attrs, lolos);
  const benarCocok = A.semiJoin(R, A.project(S, [atributJoin])).cardinality;
  const positifPalsu = Rfilter.cardinality - benarCocok;

  const kirim1 = bf.byteSize;
  const kirim2 = Rfilter.cardinality * R.degree * lebar;
  const hasil = A.naturalJoin(Rfilter, S);
  const totalByte = kirim1 + kirim2;
  return {
    nama: 'Bloom join',
    id: 'bloomjoin',
    langkah: [
      `Situs S membangun penapis Bloom ${bits} bit (k=${k}) atas ${atributJoin} dan mengirimnya — hanya ${kirim1} B`,
      `Situs R menyaring: ${Rfilter.cardinality} tupel lolos (${positifPalsu} di antaranya positif palsu)`,
      `Situs R mengirim ${Rfilter.cardinality} tupel (${kirim2} B) ke situs S`,
      `Situs S menyelesaikan join: ${hasil.cardinality} tupel — positif palsu tersaring di sini`,
    ],
    byteTerkirim: totalByte,
    pesan: 2,
    bitPenapis: bits,
    positifPalsu,
    lajuPositifPalsuTeoretis: round(bf.falsePositiveRate(S.cardinality)),
    biayaKomunikasi: round(transfer(totalByte, 2, biaya)),
    biayaLokal: round((R.cardinality + S.cardinality + Rfilter.cardinality) * biaya.perTupelLokal),
    total: round(transfer(totalByte, 2, biaya) + (R.cardinality + S.cardinality + Rfilter.cardinality) * biaya.perTupelLokal),
    hasil,
  };
}

/**
 * Bandingkan seluruh strategi sekaligus. Semua WAJIB menghasilkan relasi yang
 * sama — perbedaannya hanya pada byte yang menyeberang jaringan.
 */
export function compareStrategies(R, S, atributJoin, opt = {}) {
  const strategi = [
    shipWholeRight(R, S, atributJoin, opt),
    shipWholeLeft(R, S, atributJoin, opt),
    semiJoinStrategy(R, S, atributJoin, opt),
    bloomJoinStrategy(R, S, atributJoin, opt),
  ];
  const acuan = strategi[0].hasil;
  for (const s of strategi) s.hasilSama = s.hasil.equals(acuan);
  const urut = [...strategi].sort((a, b) => a.total - b.total);
  const terbaik = urut[0];
  const terburuk = urut[urut.length - 1];
  return {
    strategi,
    terbaik: terbaik.id,
    penghematan: terburuk.total ? round((1 - terbaik.total / terburuk.total) * 100) : 0,
    semuaHasilSama: strategi.every((s) => s.hasilSama),
    peringkat: urut.map((s) => ({ id: s.id, nama: s.nama, total: s.total, byte: s.byteTerkirim })),
  };
}

/**
 * Titik impas semijoin terhadap "kirim R utuh".
 *
 * Kirim R utuh  : C0 + C1 · |R| · dR · w
 * Semijoin      : 2·C0 + C1 · (|S| · w + s · |R| · dR · w)     s = selektivitas
 *
 * Semijoin menang bila  s < 1 - ( C0 + C1·|S|·w ) / ( C1·|R|·dR·w ).
 * Inilah alasan semijoin baru berguna pada relasi besar dengan selektivitas rendah,
 * bukan pada tabel kecil seperti contoh kuliah.
 */
export function crossoverAnalysis(R, S, opt = {}) {
  const biaya = { ...BIAYA_DEFAULT, ...(opt.biaya || {}) };
  const w = opt.lebarKolom || 12;
  const byteR = R.cardinality * R.degree * w;
  const byteKunciS = S.cardinality * w;
  const penyebut = biaya.perByte * byteR;
  const s = penyebut > 0 ? 1 - (biaya.perPesan + biaya.perByte * byteKunciS) / penyebut : 0;
  return {
    selektivitasImpas: round(Math.max(0, Math.min(1, s))),
    layak: s > 0,
    byteR,
    byteKunciS,
    catatan: s > 0
      ? `Semijoin lebih murah bila kurang dari ${Math.round(s * 100)}% tupel ${R.name} punya pasangan di ${S.name}.`
      : `Pada ukuran ini semijoin tidak pernah menang: ongkos pesan tambahan (${biaya.perPesan}) lebih besar daripada byte yang bisa dihemat.`,
  };
}

const round = (x) => Math.round(x * 1000) / 1000;
