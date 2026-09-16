// localize.js — lapisan lokalisasi data: menerjemahkan kueri aljabar atas relasi
// GLOBAL menjadi kueri atas FRAGMEN fisik, lalu mereduksinya.
// Rujukan: Modul 7 (Dekomposisi Kueri dan Lokalisasi Data);
//          Özsu & Valduriez §7.2 "Data Localization".
//
// Alur: kueri global -> program lokalisasi (generic query) -> reduksi ->
//       kueri terreduksi yang hanya menyentuh fragmen yang benar-benar relevan.

import { Relation } from '../core/relation.js?v=8e172babd6';
import * as A from '../core/algebra.js?v=8e172babd6';

// --------------------------------------------------------- predikat sederhana

/** @typedef {{attr:string, op:string, value:*}} Atom */

export function atom(attr, op, value) { return { attr, op, value }; }

export function atomToString(a) {
  const v = typeof a.value === 'string' ? `'${a.value}'` : a.value;
  return `${a.attr} ${a.op} ${v}`;
}

export function conjToString(c) { return c.length ? c.map(atomToString).join(' AND ') : 'true'; }

const cmpVal = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

/** Apakah satu nilai memenuhi sebuah atom? */
export function satisfiesAtom(v, a) {
  switch (a.op) {
    case '=': return cmpVal(v, a.value) === 0;
    case '<>': return cmpVal(v, a.value) !== 0;
    case '<': return cmpVal(v, a.value) < 0;
    case '>': return cmpVal(v, a.value) > 0;
    case '<=': return cmpVal(v, a.value) <= 0;
    case '>=': return cmpVal(v, a.value) >= 0;
    default: throw new Error(`satisfiesAtom: operator "${a.op}" tidak dikenal`);
  }
}

/**
 * Apakah dua atom pada atribut sama saling bertentangan (tidak ada nilai yang
 * memenuhi keduanya)? Diputuskan lewat penalaran selang, bukan pencocokan string
 * pasangan operator — '<>' dan '<' '>' menghasilkan gabungan yang ambigu.
 */
export function atomsContradict(a, b) {
  if (a.attr !== b.attr) return false;
  return !pairSatisfiable(a, b);
}

function pairSatisfiable(a, b) {
  const eqs = [a, b].filter((x) => x.op === '=');
  if (eqs.length === 2) return cmpVal(a.value, b.value) === 0;
  if (eqs.length === 1) {
    const other = a.op === '=' ? b : a;
    return satisfiesAtom(eqs[0].value, other);
  }
  // keduanya pertidaksamaan / <>
  const bounds = { lo: null, loStrict: false, hi: null, hiStrict: false, ne: [] };
  for (const x of [a, b]) applyBound(bounds, x);
  return boundsSatisfiable(bounds);
}

function applyBound(b, x) {
  switch (x.op) {
    case '>': if (b.lo === null || cmpVal(x.value, b.lo) >= 0) { b.lo = x.value; b.loStrict = true; } break;
    case '>=': if (b.lo === null || cmpVal(x.value, b.lo) > 0) { b.lo = x.value; b.loStrict = false; } break;
    case '<': if (b.hi === null || cmpVal(x.value, b.hi) <= 0) { b.hi = x.value; b.hiStrict = true; } break;
    case '<=': if (b.hi === null || cmpVal(x.value, b.hi) < 0) { b.hi = x.value; b.hiStrict = false; } break;
    case '<>': b.ne.push(x.value); break;
    case '=': b.lo = x.value; b.hi = x.value; b.loStrict = false; b.hiStrict = false; break;
    default: throw new Error(`applyBound: operator "${x.op}" tidak dikenal`);
  }
}

function boundsSatisfiable(b) {
  if (b.lo !== null && b.hi !== null) {
    const c = cmpVal(b.lo, b.hi);
    if (c > 0) return false;
    if (c === 0) {
      if (b.loStrict || b.hiStrict) return false;
      if (b.ne.some((v) => cmpVal(v, b.lo) === 0)) return false;
    }
  }
  return true;
}

/**
 * Konjungsi bertentangan bila ada atribut yang batas-batasnya tidak dapat dipenuhi.
 * Dicek per atribut agar rangkaian seperti x>5 AND x<10 AND x=7 tertangani utuh.
 */
export function contradictory(conj) {
  const byAttr = new Map();
  for (const a of conj) {
    if (!byAttr.has(a.attr)) byAttr.set(a.attr, []);
    byAttr.get(a.attr).push(a);
  }
  for (const atoms of byAttr.values()) {
    // pasangan dulu supaya bisa melaporkan penyebab yang jelas
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        if (atomsContradict(atoms[i], atoms[j])) return { ada: true, pasangan: [atoms[i], atoms[j]] };
      }
    }
    // gabungan tiga atom atau lebih bisa bertentangan walau tiap pasangan konsisten
    const b = { lo: null, loStrict: false, hi: null, hiStrict: false, ne: [] };
    const eqs = atoms.filter((x) => x.op === '=');
    if (eqs.length) {
      const v = eqs[0].value;
      const gagal = atoms.find((x) => !satisfiesAtom(v, x));
      if (gagal) return { ada: true, pasangan: [eqs[0], gagal] };
      continue;
    }
    for (const x of atoms) applyBound(b, x);
    if (!boundsSatisfiable(b)) return { ada: true, pasangan: [atoms[0], atoms[atoms.length - 1]] };
  }
  return { ada: false };
}

/** Apakah konjungsi a menyiratkan (implies) atom b? Dipakai untuk eliminasi redundansi. */
export function impliesAtom(conj, b) {
  return conj.some((a) => {
    if (a.attr !== b.attr) return false;
    if (a.op === '=' && b.op === '=') return a.value === b.value;
    if (a.op === '=' && b.op === '<') return a.value < b.value;
    if (a.op === '=' && b.op === '>') return a.value > b.value;
    if (a.op === '=' && b.op === '<=') return a.value <= b.value;
    if (a.op === '=' && b.op === '>=') return a.value >= b.value;
    if (a.op === b.op && a.value === b.value) return true;
    if (a.op === '<' && b.op === '<') return a.value <= b.value;
    if (a.op === '>' && b.op === '>') return a.value >= b.value;
    if (a.op === '<=' && b.op === '<=') return a.value <= b.value;
    if (a.op === '>=' && b.op === '>=') return a.value >= b.value;
    return false;
  });
}

/** Buang atom berlebih dari konjungsi (p ∧ p = p; p ∧ q dengan p ⟹ q menjadi p). */
export function simplifyConj(conj) {
  // 1) buang atom yang persis sama (p ∧ p ≡ p). Dilakukan lebih dulu supaya
  //    sepasang atom kembar tidak saling "mengimplikasikan" lalu hilang keduanya.
  const unik = [];
  for (const a of conj) {
    if (!unik.some((o) => o.attr === a.attr && o.op === a.op && o.value === a.value)) unik.push(a);
  }
  // 2) buang atom yang lebih longgar bila ada atom lain yang lebih ketat
  //    (mis. x = 5 ∧ x < 10 cukup ditulis x = 5).
  const out = [];
  for (const a of unik) {
    const sisa = unik.filter((x) => x !== a);
    if (sisa.length && impliesAtom(sisa, a)) continue;
    out.push(a);
  }
  return out.length ? out : unik.slice(0, 1);
}

export function atomPredicate(a) {
  return (row) => {
    const v = row[a.attr];
    switch (a.op) {
      case '=': return v === a.value;
      case '<>': return v !== a.value;
      case '<': return v < a.value;
      case '>': return v > a.value;
      case '<=': return v <= a.value;
      case '>=': return v >= a.value;
      default: throw new Error(`atomPredicate: operator "${a.op}" tidak dikenal`);
    }
  };
}

export function conjPredicate(conj) { const ps = conj.map(atomPredicate); return (row) => ps.every((p) => p(row)); }

// ------------------------------------------------------ program lokalisasi

/**
 * Program lokalisasi: ekspresi yang membentuk ulang relasi global dari fragmennya.
 * horizontal/turunan -> UNION; vertikal -> JOIN atas kunci.
 */
export function localizationProgram(globalName, fragments) {
  const tipe = fragments[0]?.tipe || 'horizontal';
  if (tipe === 'vertikal') {
    return {
      operator: '⋈',
      teks: `${globalName} = ${fragments.map((f) => f.nama).join(' ⋈ ')}`,
      sql: `${globalName} = ${fragments.map((f) => f.nama).join(' NATURAL JOIN ')}`,
      fragmen: fragments.map((f) => f.nama),
      tipe,
    };
  }
  return {
    operator: '∪',
    teks: `${globalName} = ${fragments.map((f) => f.nama).join(' ∪ ')}`,
    sql: `${globalName} = ${fragments.map((f) => f.nama).join(' UNION ALL ')}`,
    fragmen: fragments.map((f) => f.nama),
    tipe,
  };
}

/**
 * Reduksi untuk fragmentasi horizontal primer.
 * σ_p(F_i) = ∅ bila p ∧ p_i bertentangan -> fragmen dibuang dari UNION.
 * @param {Atom[]} predikatKueri
 * @param {Array<{nama:string, konjungsi:Atom[]}>} fragmen
 */
export function reduceHorizontal(predikatKueri, fragmen) {
  const hasil = fragmen.map((f) => {
    const gabung = simplifyConj([...predikatKueri, ...f.konjungsi]);
    const c = contradictory(gabung);
    return {
      fragmen: f.nama,
      dipakai: !c.ada,
      predikatGabungan: conjToString(gabung),
      alasan: c.ada
        ? `dibuang: ${atomToString(c.pasangan[0])} bertentangan dengan ${atomToString(c.pasangan[1])}`
        : 'dipertahankan: predikat kueri konsisten dengan predikat fragmen',
    };
  });
  const dipakai = hasil.filter((h) => h.dipakai).map((h) => h.fragmen);
  return {
    jenis: 'horizontal primer',
    hasil,
    fragmenDipakai: dipakai,
    fragmenDibuang: hasil.filter((h) => !h.dipakai).map((h) => h.fragmen),
    ekspresi: dipakai.length === 0 ? '∅' : dipakai.length === 1 ? `σ_p(${dipakai[0]})` : `σ_p(${dipakai.join(' ∪ ')})`,
  };
}

/**
 * Reduksi untuk fragmentasi vertikal.
 * π_A(F_i) dibuang bila atribut fragmen ∩ (A ∪ kunci) hanya berisi kunci.
 */
export function reduceVertical(atributDiminta, fragmen, kunci) {
  const keys = Array.isArray(kunci) ? kunci : [kunci];
  const butuh = new Set(atributDiminta);
  const hasil = fragmen.map((f) => {
    const nonKunci = f.atribut.filter((a) => !keys.includes(a));
    const relevan = nonKunci.filter((a) => butuh.has(a));
    return {
      fragmen: f.nama,
      dipakai: relevan.length > 0,
      atributRelevan: relevan,
      alasan: relevan.length
        ? `dipertahankan: menyumbang ${relevan.join(', ')}`
        : 'dibuang: tidak ada atribut non-kunci yang diminta kueri',
    };
  });
  const dipakai = hasil.filter((h) => h.dipakai).map((h) => h.fragmen);
  return {
    jenis: 'vertikal',
    hasil,
    fragmenDipakai: dipakai,
    fragmenDibuang: hasil.filter((h) => !h.dipakai).map((h) => h.fragmen),
    ekspresi: dipakai.length === 0 ? `π_A(${fragmen[0]?.nama || '∅'})` : `π_A(${dipakai.join(' ⋈ ')})`,
  };
}

/**
 * Reduksi join atas fragmen horizontal: (F_i ⋈ G_j) = ∅ bila predikat keduanya
 * bertentangan pada atribut join. Ini yang menghemat paling banyak lalu lintas jaringan.
 */
export function reduceJoin(fragmenKiri, fragmenKanan, atributJoin) {
  const pasangan = [];
  for (const L of fragmenKiri) {
    for (const R of fragmenKanan) {
      const gab = [...L.konjungsi, ...R.konjungsi.map((a) => ({ ...a, attr: a.attr }))];
      const relevan = gab.filter((a) => a.attr === atributJoin);
      const c = contradictory(relevan);
      pasangan.push({
        kiri: L.nama,
        kanan: R.nama,
        dipakai: !c.ada,
        alasan: c.ada
          ? `dibuang: ${atomToString(c.pasangan[0])} vs ${atomToString(c.pasangan[1])} pada atribut join`
          : 'dipertahankan',
      });
    }
  }
  const hidup = pasangan.filter((p) => p.dipakai);
  return {
    jenis: 'join atas fragmen horizontal',
    pasangan,
    pasanganDipakai: hidup.map((p) => `${p.kiri} ⋈ ${p.kanan}`),
    jumlahAsal: pasangan.length,
    jumlahSisa: hidup.length,
    penghematan: pasangan.length ? Math.round((1 - hidup.length / pasangan.length) * 1000) / 10 : 0,
    ekspresi: hidup.length ? hidup.map((p) => `(${p.kiri} ⋈ ${p.kanan})`).join(' ∪ ') : '∅',
  };
}

/**
 * Reduksi untuk fragmentasi turunan: fragmen anak hanya dipasangkan dengan
 * fragmen induk yang sepadan (kesepadanan dijamin oleh definisi semijoin).
 */
export function reduceDerived(fragmenAnak, fragmenInduk) {
  const pasangan = [];
  for (const anak of fragmenAnak) {
    for (const induk of fragmenInduk) {
      const cocok = anak.induk === induk.nama;
      pasangan.push({
        kiri: anak.nama,
        kanan: induk.nama,
        dipakai: cocok,
        alasan: cocok ? 'sepadan menurut definisi fragmentasi turunan' : `dibuang: ${anak.nama} diturunkan dari ${anak.induk}, bukan ${induk.nama}`,
      });
    }
  }
  const hidup = pasangan.filter((p) => p.dipakai);
  return {
    jenis: 'join atas fragmentasi turunan',
    pasangan,
    pasanganDipakai: hidup.map((p) => `${p.kiri} ⋈ ${p.kanan}`),
    jumlahAsal: pasangan.length,
    jumlahSisa: hidup.length,
    penghematan: pasangan.length ? Math.round((1 - hidup.length / pasangan.length) * 1000) / 10 : 0,
    ekspresi: hidup.map((p) => `(${p.kiri} ⋈ ${p.kanan})`).join(' ∪ ') || '∅',
  };
}

/**
 * Jalankan kueri terreduksi terhadap fragmen nyata dan bandingkan dengan
 * menjalankan kueri yang sama terhadap relasi global. Keduanya WAJIB sama —
 * inilah bukti bahwa reduksi tidak mengubah semantik.
 */
export function verifyReduction(Rglobal, fragments, predikatKueri, atributHasil = null) {
  const pred = conjPredicate(predikatKueri);
  const global = A.select(Rglobal, pred);
  const globalOut = atributHasil ? A.project(global, atributHasil) : global;

  const conjOf = (f) => f.konjungsi || [];
  const red = reduceHorizontal(predikatKueri, fragments.map((f) => ({ nama: f.nama, konjungsi: conjOf(f) })));
  const dipakai = fragments.filter((f) => red.fragmenDipakai.includes(f.nama));
  let acc = null;
  for (const f of dipakai) {
    const bagian = A.select(f.relasi, pred);
    acc = acc === null ? bagian : A.unionAll(acc, bagian, Rglobal.name);
  }
  if (acc === null) acc = new Relation(Rglobal.name, Rglobal.attrs, []);
  const lokalOut = atributHasil ? A.project(acc, atributHasil) : A.project(acc, Rglobal.attrs);

  return {
    setara: lokalOut.equals(globalOut),
    barisGlobal: globalOut.cardinality,
    barisLokal: lokalOut.cardinality,
    fragmenDisentuh: red.fragmenDipakai,
    fragmenDilewati: red.fragmenDibuang,
    reduksi: red,
    hasil: lokalOut,
  };
}

/** Pohon operator sebagai teks berjenjang — dipakai UI untuk menggambar rencana. */
export function treeToText(node, depth = 0) {
  if (!node) return '';
  const pad = '  '.repeat(depth);
  let head;
  switch (node.op) {
    case 'relation': head = `${node.name}${node.situs ? ` @${node.situs}` : ''}`; break;
    case 'select': head = `σ ${node.pred}`; break;
    case 'project': head = `π ${node.attrs.join(', ')}`; break;
    case 'join': head = `⋈ ${node.on || ''}`; break;
    case 'semijoin': head = `⋉ ${node.on || ''}`; break;
    case 'union': head = '∪'; break;
    default: head = node.op;
  }
  let s = `${pad}${head}\n`;
  for (const c of node.children || []) s += treeToText(c, depth + 1);
  return s;
}

export function countNodes(node) {
  if (!node) return 0;
  return 1 + (node.children || []).reduce((a, c) => a + countNodes(c), 0);
}
