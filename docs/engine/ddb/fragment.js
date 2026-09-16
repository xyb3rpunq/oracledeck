// fragment.js — fragmentasi basis data terdistribusi.
// Menutup: Modul 5 (Fragmentasi, Alokasi, Replikasi) dan Modul 7 (Lokalisasi Data).
// Tiga aturan kebenaran wajib (Özsu & Valduriez §3.2):
//   1. Kelengkapan (completeness)   — tiap item data ada di minimal satu fragmen
//   2. Rekonstruksi (reconstruction)— relasi asal dapat dibentuk ulang dari fragmen
//   3. Kedisjoinan (disjointness)   — horizontal: fragmen tidak tumpang tindih
//                                     vertikal : hanya atribut kunci yang berulang

import { Relation } from '../core/relation.js?v=8e172babd6';
import * as A from '../core/algebra.js?v=8e172babd6';

/** @typedef {{nama:string, tipe:string, relasi:Relation, definisi:string, situs?:string}} Fragment */

// ------------------------------------------------------- fragmentasi horizontal

/**
 * Fragmentasi horizontal primer: σ_p(R) untuk setiap predikat.
 * @param {Relation} R
 * @param {Array<{nama:string, predikat:(row)=>boolean, teks:string}>} aturan
 */
export function horizontal(R, aturan) {
  return aturan.map((a) => {
    const rel = A.select(R, a.predikat).rename(a.nama);
    return {
      nama: a.nama,
      tipe: 'horizontal',
      relasi: rel,
      definisi: `${a.nama} = SELECT ${R.name} WHERE ${a.teks}`,
      aljabar: `${a.nama} = σ_{${a.teks}}(${R.name})`,
      teks: a.teks,
    };
  });
}

/** Fragmentasi horizontal berdasarkan nilai satu atribut (partisi list). */
export function horizontalByAttribute(R, attr, { prefix = null, nilai = null } = {}) {
  const i = R.indexOf(attr);
  if (i < 0) throw new Error(`horizontalByAttribute: atribut "${attr}" tidak ada di ${R.name}`);
  const values = nilai || [...new Set(R.rows.map((r) => r[i]))].sort();
  const p = prefix || `${R.name}_`;
  return horizontal(R, values.map((v, k) => ({
    nama: `${p}${k + 1}`,
    predikat: (row) => row[R.attrs[i]] === v,
    teks: `${attr} = '${v}'`,
  })));
}

/**
 * Fragmentasi horizontal turunan (derived): fragmen S mengikuti fragmen R
 * lewat semijoin — S_i = S ⋉ R_i. Dipakai untuk tabel anak pada relasi 1:N
 * supaya join lokal tidak perlu melintasi jaringan.
 */
export function derived(S, fragmentsR, joinAttr) {
  return fragmentsR.map((f) => {
    const rel = A.semiJoin(S, A.project(f.relasi, [joinAttr]), `${S.name}_${f.nama}`);
    return {
      nama: `${S.name}_${f.nama}`,
      tipe: 'turunan',
      relasi: rel,
      induk: f.nama,
      definisi: `${S.name}_${f.nama} = ${S.name} SEMIJOIN ${f.nama} ON ${joinAttr}`,
      aljabar: `${S.name}_${f.nama} = ${S.name} ⋉_{${joinAttr}} ${f.nama}`,
      teks: `${joinAttr} ∈ π_${joinAttr}(${f.nama})`,
    };
  });
}

// --------------------------------------------------------- fragmentasi vertikal

/**
 * Fragmentasi vertikal: π_atribut(R). Setiap fragmen WAJIB memuat kunci agar
 * rekonstruksi lewat natural join tetap lossless (Modul 7: "harus menyediakan
 * id tupel yang unik untuk setiap tupel dalam relasi asli").
 */
export function vertical(R, groups, key) {
  const keys = Array.isArray(key) ? key : [key];
  for (const k of keys) if (R.indexOf(k) < 0) throw new Error(`vertical: kunci "${k}" tidak ada di ${R.name}`);
  return groups.map((g) => {
    const attrs = [...keys, ...g.atribut.filter((a) => !keys.includes(a))];
    const rel = A.project(R, attrs).rename(g.nama);
    return {
      nama: g.nama,
      tipe: 'vertikal',
      relasi: rel,
      kunci: keys,
      definisi: `${g.nama} = SELECT ${attrs.join(', ')} FROM ${R.name}`,
      aljabar: `${g.nama} = π_{${attrs.join(', ')}}(${R.name})`,
      teks: attrs.join(', '),
    };
  });
}

/**
 * Fragmentasi campuran (hybrid): vertikal lalu horizontal, persis pola
 * S1/S2/S21/S22/S23 pada Modul 6 dan Modul 7.
 */
export function mixed(R, { verticalGroups, key, horizontalOn, targetFragment }) {
  const v = vertical(R, verticalGroups, key);
  const out = [];
  for (const f of v) {
    if (f.nama !== targetFragment) { out.push(f); continue; }
    const h = horizontalByAttribute(f.relasi, horizontalOn, { prefix: `${f.nama}` });
    h.forEach((x) => {
      x.tipe = 'campuran';
      x.induk = f.nama;
      x.definisi = `${x.nama} = SELECT ${f.relasi.attrs.join(', ')} FROM ${R.name} WHERE ${x.teks}`;
      x.aljabar = `${x.nama} = σ_{${x.teks}}(${f.nama})`;
    });
    out.push(...h);
  }
  return out;
}

// ------------------------------------------------------------ aturan kebenaran

/**
 * Kenali struktur rancangan. Fragmentasi campuran (mis. S1 vertikal, lalu S2 dipecah
 * horizontal menjadi S21/S22/S23) harus dinilai BERTINGKAT: anak-anak horizontal
 * disatukan dulu menjadi fragmen vertikal induknya, baru tingkat vertikal dinilai.
 * Menilainya secara datar menghasilkan S1 ⋈ S21 ⋈ S22 ⋈ S23 — relasi kosong.
 */
export function strukturFragmen(fragments) {
  const adaVertikal = fragments.some((f) => f.tipe === 'vertikal');
  const adaCampuran = fragments.some((f) => f.tipe === 'campuran');
  if (!adaCampuran) {
    return { mode: adaVertikal ? 'vertikal' : 'horizontal', tingkatVertikal: fragments, grup: [] };
  }
  const grup = new Map();
  const tingkatVertikal = [];
  for (const f of fragments) {
    if (f.tipe !== 'campuran') { tingkatVertikal.push(f); continue; }
    if (!grup.has(f.induk)) {
      grup.set(f.induk, []);
      tingkatVertikal.push({ nama: f.induk, tipe: 'vertikal', virtual: true });
    }
    grup.get(f.induk).push(f);
  }
  const hasil = tingkatVertikal.map((v) => {
    if (!v.virtual) return v;
    const anak = grup.get(v.nama);
    let acc = anak[0].relasi;
    for (let i = 1; i < anak.length; i++) acc = A.unionAll(acc, anak[i].relasi, v.nama);
    return { ...v, relasi: acc.rename(v.nama), anak };
  });
  return { mode: 'campuran', tingkatVertikal: hasil, grup: [...grup.entries()].map(([induk, anak]) => ({ induk, anak })) };
}

/** Ekspresi aljabar rekonstruksi, mis. STAFF = S1 ⋈ (S21 ∪ S22 ∪ S23). */
export function reconstructionExpression(R, fragments) {
  const st = strukturFragmen(fragments);
  if (st.mode === 'horizontal') return `${R.name} = ${fragments.map((f) => f.nama).join(' ∪ ')}`;
  const bagian = st.tingkatVertikal.map((v) => (v.anak ? `(${v.anak.map((x) => x.nama).join(' ∪ ')})` : v.nama));
  return `${R.name} = ${bagian.join(' ⋈ ')}`;
}

/** 1) Kelengkapan: gabungan fragmen memuat seluruh tupel/atribut relasi asal. */
export function checkCompleteness(R, fragments) {
  const st = strukturFragmen(fragments);
  if (st.mode === 'horizontal') {
    const seen = new Set(fragments.flatMap((f) => f.relasi.rows.map(Relation.key)));
    const hilang = R.rows.filter((r) => !seen.has(Relation.key(r)));
    return {
      lengkap: hilang.length === 0,
      hilang: hilang.map((r) => r[0]),
      pesan: hilang.length ? `${hilang.length} tupel tidak masuk fragmen mana pun` : 'semua tupel terliput',
    };
  }
  const covered = new Set(st.tingkatVertikal.flatMap((f) => f.relasi.attrs));
  const hilang = R.attrs.filter((a) => !covered.has(a));
  // pada rancangan campuran, tiap kelompok horizontal juga wajib meliput seluruh
  // tupel proyeksi induknya
  const hilangTupel = [];
  for (const v of st.tingkatVertikal.filter((x) => x.anak)) {
    const proyeksi = A.project(R, v.relasi.attrs);
    const seen = new Set(A.project(v.relasi, v.relasi.attrs).rows.map(Relation.key));
    const kurang = proyeksi.rows.filter((r) => !seen.has(Relation.key(r)));
    if (kurang.length) hilangTupel.push(`${v.nama}: ${kurang.length} tupel`);
  }
  const lengkap = hilang.length === 0 && hilangTupel.length === 0;
  const pesan = [];
  if (hilang.length) pesan.push(`atribut tidak terliput: ${hilang.join(', ')}`);
  if (hilangTupel.length) pesan.push(`tupel tidak terliput pada ${hilangTupel.join('; ')}`);
  return {
    lengkap,
    hilang: [...hilang, ...hilangTupel],
    pesan: lengkap
      ? (st.mode === 'campuran' ? 'semua atribut dan semua tupel tiap kelompok horizontal terliput' : 'semua atribut terliput')
      : pesan.join(' · '),
  };
}

/** 2) Rekonstruksi: R = ∪F_i (horizontal), R = ⋈F_i (vertikal), atau bertingkat (campuran). */
export function reconstruct(R, fragments) {
  if (fragments.length === 0) return { relasi: new Relation(R.name, R.attrs, []), operator: '-' };
  const st = strukturFragmen(fragments);
  if (st.mode === 'horizontal') {
    let acc = fragments[0].relasi;
    for (let i = 1; i < fragments.length; i++) acc = A.unionAll(acc, fragments[i].relasi, R.name);
    return { relasi: A.project(acc, R.attrs).rename(R.name), operator: 'UNION (∪)' };
  }
  const v = st.tingkatVertikal;
  let acc = v[0].relasi;
  for (let i = 1; i < v.length; i++) acc = A.naturalJoin(acc, v[i].relasi, R.name);
  return {
    relasi: A.project(acc, R.attrs).rename(R.name),
    operator: st.mode === 'campuran' ? 'UNION lalu NATURAL JOIN (∪ → ⋈)' : 'NATURAL JOIN (⋈)',
  };
}

export function checkReconstruction(R, fragments) {
  const { relasi, operator } = reconstruct(R, fragments);
  const sama = relasi.equals(R);
  return {
    dapatDirekonstruksi: sama,
    operator,
    ekspresi: fragments.length ? reconstructionExpression(R, fragments) : `${R.name} = ∅`,
    kardinalitasAsal: R.cardinality,
    kardinalitasHasil: relasi.cardinality,
    pesan: sama ? `R = ${operator} fragmen — lossless` : `hasil rekonstruksi ${relasi.cardinality} tupel vs asal ${R.cardinality} tupel`,
  };
}

function tupelGanda(fragments) {
  const count = new Map();
  for (const f of fragments) {
    for (const r of f.relasi.rows) {
      const k = Relation.key(r);
      if (!count.has(k)) count.set(k, []);
      count.get(k).push(f.nama);
    }
  }
  return [...count.entries()].filter(([, fs]) => fs.length > 1).map(([k, fs]) => ({ tupel: JSON.parse(k)[0], fragmen: fs }));
}

/**
 * 3) Kedisjoinan. Horizontal: tidak ada tupel di >1 fragmen.
 * Vertikal: hanya kunci yang berulang. Campuran: keduanya, dinilai per tingkat.
 */
export function checkDisjointness(R, fragments, key = null) {
  const st = strukturFragmen(fragments);
  if (st.mode === 'horizontal') {
    const bocor = tupelGanda(fragments);
    return {
      disjoint: bocor.length === 0,
      tumpangTindih: bocor,
      atributBerulang: [],
      tupelBerulang: bocor,
      pesan: bocor.length ? `${bocor.length} tupel muncul di lebih dari satu fragmen` : 'tidak ada tupel ganda antar fragmen',
    };
  }
  const keys = key ? (Array.isArray(key) ? key : [key]) : (fragments.find((f) => f.kunci)?.kunci || []);
  const count = new Map();
  for (const f of st.tingkatVertikal) for (const a of f.relasi.attrs) count.set(a, (count.get(a) || 0) + 1);
  const atributBerulang = [...count.entries()].filter(([a, c]) => c > 1 && !keys.includes(a)).map(([a]) => a);
  const tupelBerulang = st.grup.flatMap((g) => tupelGanda(g.anak).map((b) => ({ ...b, kelompok: g.induk })));
  const pesan = [];
  if (atributBerulang.length) pesan.push(`atribut non-kunci muncul di >1 fragmen vertikal: ${atributBerulang.join(', ')}`);
  if (tupelBerulang.length) pesan.push(`${tupelBerulang.length} tupel ganda di dalam kelompok horizontal`);
  const disjoint = pesan.length === 0;
  return {
    disjoint,
    tumpangTindih: [...atributBerulang, ...tupelBerulang],
    atributBerulang,
    tupelBerulang,
    pesan: disjoint
      ? (st.mode === 'campuran' ? 'hanya kunci yang berulang, dan tiap kelompok horizontal disjoint' : 'hanya kunci yang berulang')
      : pesan.join(' · '),
  };
}

/** Audit lengkap tiga aturan sekaligus. */
export function auditFragmentation(R, fragments, key = null) {
  const kelengkapan = checkCompleteness(R, fragments);
  const rekonstruksi = checkReconstruction(R, fragments);
  const kedisjoinan = checkDisjointness(R, fragments, key);
  return {
    valid: kelengkapan.lengkap && rekonstruksi.dapatDirekonstruksi && kedisjoinan.disjoint,
    kelengkapan, rekonstruksi, kedisjoinan,
    ringkas: [
      `Kelengkapan  : ${kelengkapan.lengkap ? 'LULUS' : 'GAGAL'} — ${kelengkapan.pesan}`,
      `Rekonstruksi : ${rekonstruksi.dapatDirekonstruksi ? 'LULUS' : 'GAGAL'} — ${rekonstruksi.pesan}`,
      `Kedisjoinan  : ${kedisjoinan.disjoint ? 'LULUS' : 'GAGAL'} — ${kedisjoinan.pesan}`,
    ],
  };
}

// ------------------------------------------- predikat minterm (COM_MIN sederhana)

/**
 * Bangun predikat minterm dari kumpulan predikat sederhana.
 * m = p1* ∧ p2* ∧ ... dengan pi* ∈ {pi, ¬pi}. Minterm yang tidak menghasilkan
 * tupel apa pun dibuang (tidak relevan), sesuai algoritma PHORIZONTAL.
 */
export function mintermPredicates(R, simplePredicates, { buangKosong = true } = {}) {
  const n = simplePredicates.length;
  if (n > 12) throw new Error('mintermPredicates: maksimum 12 predikat sederhana (2^12 kombinasi)');
  const out = [];
  for (let mask = 0; mask < (1 << n); mask++) {
    const parts = simplePredicates.map((p, i) => ({ p, neg: !(mask & (1 << i)) }));
    const teks = parts.map(({ p, neg }) => (neg ? `NOT (${p.teks})` : p.teks)).join(' AND ');
    const pred = (row) => parts.every(({ p, neg }) => (neg ? !p.predikat(row) : p.predikat(row)));
    const rel = A.select(R, pred);
    if (buangKosong && rel.cardinality === 0) continue;
    out.push({ nama: `m${out.length + 1}`, teks, predikat: pred, kardinalitas: rel.cardinality });
  }
  return out;
}

// -------------------------------- matriks afinitas atribut (fragmentasi vertikal)

/**
 * Matriks penggunaan atribut -> matriks afinitas (Özsu & Valduriez §3.3.2).
 * aff(Ai,Aj) = Σ akses query yang memakai Ai DAN Aj.
 * @param {string[]} attrs
 * @param {Array<{atribut:string[], akses:Object<string,number>}>} queries
 */
export function attributeAffinity(attrs, queries) {
  const n = attrs.length;
  const M = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const q of queries) {
    const total = Object.values(q.akses || {}).reduce((a, b) => a + b, 0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (q.atribut.includes(attrs[i]) && q.atribut.includes(attrs[j])) M[i][j] += total;
      }
    }
  }
  return { atribut: attrs.slice(), matriks: M };
}

/**
 * Pemisahan vertikal dua-arah yang memaksimalkan
 * Z = sq * sb - so²  (square-error partition, Navathe et al.).
 * Menguji semua pembelahan dari urutan atribut hasil pengurutan afinitas.
 */
export function verticalSplit(affinity) {
  const { atribut, matriks } = affinity;
  const n = atribut.length;
  if (n < 2) return { atas: atribut.slice(), bawah: [], z: 0 };
  const order = orderByAffinity(matriks);
  let best = null;
  for (let cut = 1; cut < n; cut++) {
    const TA = order.slice(0, cut);
    const BA = order.slice(cut);
    const sq = sumBlock(matriks, TA, TA);
    const sb = sumBlock(matriks, BA, BA);
    const so = sumBlock(matriks, TA, BA);
    const z = sq * sb - so * so;
    if (!best || z > best.z) best = { atas: TA.map((i) => atribut[i]), bawah: BA.map((i) => atribut[i]), z, sq, sb, so };
  }
  return best;
}

function sumBlock(M, rows, cols) {
  let s = 0;
  for (const i of rows) for (const j of cols) s += M[i][j];
  return s;
}

/** Urutkan indeks atribut secara greedy: berikutnya adalah yang afinitasnya terbesar. */
function orderByAffinity(M) {
  const n = M.length;
  const used = new Set([0]);
  const order = [0];
  while (order.length < n) {
    let bestJ = -1; let bestV = -Infinity;
    for (let j = 0; j < n; j++) {
      if (used.has(j)) continue;
      const v = order.reduce((s, i) => s + M[i][j], 0);
      if (v > bestV) { bestV = v; bestJ = j; }
    }
    used.add(bestJ);
    order.push(bestJ);
  }
  return order;
}

/** Ringkasan fragmen untuk ditampilkan di tabel. */
export function summarize(fragments) {
  return fragments.map((f) => ({
    nama: f.nama,
    tipe: f.tipe,
    kardinalitas: f.relasi.cardinality,
    derajat: f.relasi.degree,
    atribut: f.relasi.attrs.join(', '),
    definisi: f.definisi,
    situs: f.situs || '-',
  }));
}
