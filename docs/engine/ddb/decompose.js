// decompose.js — dekomposisi kueri: empat langkah berurutan pada Modul 7.
//   1) Normalisasi         -> bentuk normal konjungtif (CNF) / disjungtif (DNF)
//   2) Analisis            -> tolak kueri salah tipe atau salah semantik (graf kueri)
//   3) Eliminasi redundansi-> sederhanakan kualifikasi dengan hukum idempoten
//   4) Penulisan ulang     -> pohon operator aljabar relasional
//
// Masukan berupa AST dari engine/core/sql.js sehingga langkah-langkah ini
// bekerja atas SQL sungguhan, bukan contoh yang sudah disiapkan.

import { parse, exprToString, SqlError } from '../core/sql.js?v=b04806ea2d';

// ------------------------------------------------------------ 1) NORMALISASI

/** Dorong NOT ke dalam memakai hukum De Morgan. */
export function pushNegations(e, negate = false) {
  if (!e) return e;
  if (e.k === 'unop' && e.op === 'NOT') return pushNegations(e.e, !negate);
  if (e.k === 'binop' && (e.op === 'AND' || e.op === 'OR')) {
    const op = negate ? (e.op === 'AND' ? 'OR' : 'AND') : e.op;
    return { k: 'binop', op, l: pushNegations(e.l, negate), r: pushNegations(e.r, negate) };
  }
  if (!negate) return e;
  // negasi atas literal: balikkan operatornya bila bisa, selain itu bungkus NOT
  const flip = { '=': '<>', '<>': '=', '<': '>=', '>': '<=', '<=': '>', '>=': '<' };
  if (e.k === 'binop' && flip[e.op]) return { k: 'binop', op: flip[e.op], l: e.l, r: e.r };
  if (e.k === 'isnull') return { ...e, not: !e.not };
  if (e.k === 'like') return { ...e, not: !e.not };
  if (e.k === 'in') return { ...e, not: !e.not };
  if (e.k === 'between') return { ...e, not: !e.not };
  return { k: 'unop', op: 'NOT', e };
}

const isAnd = (e) => e && e.k === 'binop' && e.op === 'AND';
const isOr = (e) => e && e.k === 'binop' && e.op === 'OR';

/** Ratakan pohon AND/OR menjadi daftar. */
export function flatten(e, op) {
  if (!e) return [];
  if (e.k === 'binop' && e.op === op) return [...flatten(e.l, op), ...flatten(e.r, op)];
  return [e];
}

/** Bentuk normal konjungtif: (a ∨ b) ∧ (c ∨ d) ∧ ... */
export function toCNF(expr) {
  const e = pushNegations(expr);
  const clauses = cnfClauses(e);
  return {
    bentuk: 'CNF',
    klausa: clauses.map((c) => c.map(exprToString)),
    teks: clauses.map((c) => (c.length > 1 ? `(${c.map(exprToString).join(' OR ')})` : exprToString(c[0]))).join(' AND ') || 'true',
    jumlahKlausa: clauses.length,
  };
}

function cnfClauses(e) {
  if (isAnd(e)) return [...cnfClauses(e.l), ...cnfClauses(e.r)];
  if (isOr(e)) {
    const L = cnfClauses(e.l);
    const R = cnfClauses(e.r);
    const out = [];
    for (const a of L) for (const b of R) out.push(dedupeLiterals([...a, ...b]));
    return out;
  }
  return [[e]];
}

/** Bentuk normal disjungtif: (a ∧ b) ∨ (c ∧ d) ∨ ... — dipakai fragmentasi minterm. */
export function toDNF(expr) {
  const e = pushNegations(expr);
  const terms = dnfTerms(e);
  return {
    bentuk: 'DNF',
    term: terms.map((t) => t.map(exprToString)),
    teks: terms.map((t) => (t.length > 1 ? `(${t.map(exprToString).join(' AND ')})` : exprToString(t[0]))).join(' OR ') || 'true',
    jumlahTerm: terms.length,
  };
}

function dnfTerms(e) {
  if (isOr(e)) return [...dnfTerms(e.l), ...dnfTerms(e.r)];
  if (isAnd(e)) {
    const L = dnfTerms(e.l);
    const R = dnfTerms(e.r);
    const out = [];
    for (const a of L) for (const b of R) out.push(dedupeLiterals([...a, ...b]));
    return out;
  }
  return [[e]];
}

function dedupeLiterals(lits) {
  const seen = new Set();
  const out = [];
  for (const l of lits) {
    const k = exprToString(l);
    if (!seen.has(k)) { seen.add(k); out.push(l); }
  }
  return out;
}

// ---------------------------------------------------------------- 2) ANALISIS

/**
 * Analisis kueri: tolak kueri yang salah tipe (atribut/relasi tidak ada di skema
 * global) atau salah semantik (graf kueri tidak terhubung).
 * @param {object} ast hasil parse()
 * @param {Object<string,string[]>} skema peta namaRelasi -> daftar atribut
 */
export function analyze(ast, skema) {
  const skemaLower = Object.fromEntries(Object.entries(skema).map(([k, v]) => [k.toLowerCase(), v]));
  const cte = new Set();
  const cabang = [];
  let badan = ast;
  if (ast.type === 'with') {
    ast.ctes.forEach((c) => cte.add(c.name.toLowerCase()));
    ast.ctes.forEach((c) => cabangSelect(c.query).forEach((q) => cabang.push({ label: `CTE ${c.name}`, q })));
    badan = ast.body;
  }
  const utama = cabangSelect(badan);
  if (utama.length === 0) throw new SqlError(`Dekomposisi kueri hanya berlaku untuk SELECT, bukan ${String(ast.type).toUpperCase()}.`);
  utama.forEach((q, i) => cabang.push({ label: utama.length > 1 ? `cabang ${i + 1}` : null, q, utama: i === 0 }));

  const masalah = [];
  let graf = null;
  const beriLabel = cabang.length > 1;
  for (const c of cabang) {
    const hasil = analisisCabang(c.q, skemaLower, cte);
    hasil.masalah.forEach((m) => masalah.push(beriLabel && c.label ? { ...m, pesan: `${c.label}: ${m.pesan}` } : m));
    if (c.utama) graf = hasil.graf;
  }

  // operasi himpunan hanya sah bila setiap cabang menghasilkan jumlah kolom yang sama
  const jumlahKolom = (q) => (q.items.some((it) => it.expr.k === 'star') ? null : q.items.length);
  const jumlah = utama.map(jumlahKolom);
  if (utama.length > 1 && jumlah.every((n) => n !== null) && new Set(jumlah).size > 1) {
    masalah.push({ jenis: 'salah tipe', pesan: `cabang operasi himpunan punya jumlah kolom berbeda (${jumlah.join(' vs ')}) — UNION/INTERSECT/MINUS menuntut skema yang kompatibel` });
  }

  return {
    diterima: masalah.filter((m) => m.jenis === 'salah tipe' || m.jenis === 'salah semantik' || m.jenis === 'selalu salah').length === 0,
    masalah,
    graf,
  };
}

/**
 * Semua blok SELECT dari sebuah simpul kueri, kiri ke kanan.
 * WITH dibuka ke badannya; UNION/INTERSECT/MINUS diurai ke kedua cabangnya.
 */
export function cabangSelect(node) {
  if (!node) return [];
  if (node.type === 'select') return [node];
  if (node.type === 'with') return cabangSelect(node.body);
  if (node.type === 'union' || node.type === 'setop') return [...cabangSelect(node.left), ...cabangSelect(node.right)];
  return [];
}

/** SELECT yang mewakili kueri: cabang paling kiri dari badan kueri. */
export function selectUtama(ast) {
  const [q] = cabangSelect(ast);
  if (!q) throw new SqlError(`Dekomposisi kueri hanya berlaku untuk SELECT, bukan ${String(ast?.type || '?').toUpperCase()}.`);
  return q;
}

function analisisCabang(q, skemaLower, cte) {
  const masalah = [];
  const alias = new Map();

  const daftar = (ref) => {
    if (ref.sub) { alias.set(ref.alias.toLowerCase(), null); return; }
    const nama = String(ref.table).toLowerCase();
    if (cte.has(nama)) { alias.set(String(ref.alias).toLowerCase(), null); return; }
    const t = skemaLower[nama];
    if (!t) masalah.push({ jenis: 'salah tipe', pesan: `relasi "${ref.table}" tidak ada dalam skema global` });
    alias.set(String(ref.alias).toLowerCase(), t || null);
  };
  q.from.forEach(daftar);
  q.joins.forEach((j) => daftar(j.ref));

  const cekKolom = (e) => {
    if (!e || typeof e !== 'object') return;
    if (e.k === 'col') {
      if (e.table) {
        const t = alias.get(String(e.table).toLowerCase());
        if (t === undefined) masalah.push({ jenis: 'salah tipe', pesan: `alias "${e.table}" tidak dideklarasikan pada FROM` });
        else if (t && !t.some((a) => a.toLowerCase() === e.name.toLowerCase())) {
          masalah.push({ jenis: 'salah tipe', pesan: `atribut "${e.table}.${e.name}" tidak ada pada relasi tersebut` });
        }
      } else {
        const kandidat = [...alias.values()].filter((t) => t && t.some((a) => a.toLowerCase() === e.name.toLowerCase()));
        if (kandidat.length === 0 && [...alias.values()].every((t) => t !== null)) {
          masalah.push({ jenis: 'salah tipe', pesan: `atribut "${e.name}" tidak ada pada relasi mana pun di FROM` });
        } else if (kandidat.length > 1) {
          masalah.push({ jenis: 'ambigu', pesan: `atribut "${e.name}" muncul pada lebih dari satu relasi — perlu nama berkualifikasi` });
        }
      }
      return;
    }
    for (const key of ['l', 'r', 'e', 'lo', 'hi', 'pat', 'arg', 'subjek', 'lain']) if (e[key]) cekKolom(e[key]);
    if (e.args) e.args.forEach(cekKolom);
    if (e.list) e.list.forEach(cekKolom);
    if (e.cabang) e.cabang.forEach((c) => { cekKolom(c.kapan); cekKolom(c.maka); });
  };
  q.items.forEach((it) => cekKolom(it.expr));
  if (q.where) cekKolom(q.where);
  q.joins.forEach((j) => j.on && cekKolom(j.on));
  q.groupBy.forEach(cekKolom);
  if (q.having) cekKolom(q.having);

  const graf = queryGraph(q);
  if (!graf.terhubung && graf.simpul.length > 1) {
    masalah.push({
      jenis: 'salah semantik',
      pesan: `graf kueri tidak terhubung: ${graf.komponen.map((c) => `{${c.join(', ')}}`).join(' dan ')} tidak dihubungkan predikat join — hasilnya perkalian kartesian`,
    });
  }

  const kontradiksi = q.where ? cariKontradiksi(q.where) : [];
  kontradiksi.forEach((k) => masalah.push({ jenis: 'selalu salah', pesan: k }));

  return { masalah, graf };
}

/** Graf kueri: simpul = relasi (alias), sisi = predikat join antar dua relasi. */
export function queryGraph(q) {
  const simpul = [];
  const add = (ref) => { const a = ref.alias || ref.table; if (a && !simpul.includes(a)) simpul.push(a); };
  q.from.forEach(add);
  q.joins.forEach((j) => add(j.ref));
  const sisi = [];
  const scan = (e) => {
    if (!e || typeof e !== 'object') return;
    if (e.k === 'binop' && ['=', '<', '>', '<=', '>=', '<>'].includes(e.op) && e.l?.k === 'col' && e.r?.k === 'col') {
      const a = e.l.table; const b = e.r.table;
      if (a && b && a !== b) sisi.push({ dari: a, ke: b, label: exprToString(e) });
      return;
    }
    for (const key of ['l', 'r', 'e']) if (e[key]) scan(e[key]);
  };
  if (q.where) scan(q.where);
  q.joins.forEach((j) => j.on && scan(j.on));

  // komponen terhubung
  const adj = new Map(simpul.map((s) => [s, new Set()]));
  for (const e of sisi) { adj.get(e.dari)?.add(e.ke); adj.get(e.ke)?.add(e.dari); }
  const seen = new Set();
  const komponen = [];
  for (const s of simpul) {
    if (seen.has(s)) continue;
    const stack = [s]; const comp = [];
    while (stack.length) {
      const x = stack.pop();
      if (seen.has(x)) continue;
      seen.add(x); comp.push(x);
      for (const y of adj.get(x) || []) if (!seen.has(y)) stack.push(y);
    }
    komponen.push(comp.sort());
  }
  return { simpul, sisi, komponen, terhubung: komponen.length <= 1 };
}

function cariKontradiksi(where) {
  const out = [];
  const conj = flatten(pushNegations(where), 'AND');
  const eqs = new Map();
  for (const c of conj) {
    if (c.k === 'binop' && c.op === '=' && c.l?.k === 'col' && (c.r?.k === 'str' || c.r?.k === 'num')) {
      const key = exprToString(c.l);
      if (eqs.has(key) && eqs.get(key) !== c.r.v) {
        out.push(`${key} tidak mungkin sama dengan '${eqs.get(key)}' dan '${c.r.v}' sekaligus`);
      }
      eqs.set(key, c.r.v);
    }
  }
  return out;
}

// -------------------------------------------------- 3) ELIMINASI REDUNDANSI

const IDEMPOTEN = [
  { nama: 'p ∧ p ≡ p', jenis: 'AND-idempoten' },
  { nama: 'p ∨ p ≡ p', jenis: 'OR-idempoten' },
  { nama: 'p ∧ true ≡ p', jenis: 'AND-identitas' },
  { nama: 'p ∨ false ≡ p', jenis: 'OR-identitas' },
  { nama: 'p ∧ (p ∨ q) ≡ p', jenis: 'absorpsi' },
  { nama: 'p ∨ (p ∧ q) ≡ p', jenis: 'absorpsi' },
  { nama: 'p ∧ ¬p ≡ false', jenis: 'kontradiksi' },
  { nama: 'p ∨ ¬p ≡ true', jenis: 'tautologi' },
];

export const ATURAN_IDEMPOTEN = IDEMPOTEN;

/**
 * Sederhanakan kualifikasi dengan hukum idempoten. Bekerja atas bentuk CNF
 * sehingga penyederhanaan terjadi baik di dalam klausa (OR) maupun antar klausa (AND).
 */
export function eliminateRedundancy(expr) {
  const jejak = [];
  const cnf = cnfClauses(pushNegations(expr));

  // 3a. dalam satu klausa: p ∨ p = p ; p ∨ ¬p = true
  let clauses = cnf.map((c) => {
    const uniq = dedupeLiterals(c);
    if (uniq.length < c.length) jejak.push({ aturan: 'p ∨ p ≡ p', pada: c.map(exprToString).join(' OR ') });
    const taut = uniq.some((a) => uniq.some((b) => isNegationOf(a, b)));
    if (taut) { jejak.push({ aturan: 'p ∨ ¬p ≡ true', pada: uniq.map(exprToString).join(' OR ') }); return null; }
    return uniq;
  }).filter(Boolean);

  // 3b. antar klausa: klausa ganda (p ∧ p = p)
  const seen = new Set();
  clauses = clauses.filter((c) => {
    const k = c.map(exprToString).sort().join(' OR ');
    if (seen.has(k)) { jejak.push({ aturan: 'p ∧ p ≡ p', pada: k }); return false; }
    seen.add(k);
    return true;
  });

  // 3c. absorpsi: (p) ∧ (p ∨ q) = p  -> buang klausa superset
  const hidup = clauses.filter((c, i) => {
    const sup = clauses.some((o, j) => j !== i && o.length < c.length && o.every((x) => c.some((y) => exprToString(x) === exprToString(y))));
    if (sup) jejak.push({ aturan: 'p ∧ (p ∨ q) ≡ p', pada: c.map(exprToString).join(' OR ') });
    return !sup;
  });

  // 3d. kontradiksi antar klausa unit: p ∧ ¬p = false, termasuk dua kesamaan
  //     atas atribut sama dengan konstanta berbeda (x = 'A' ∧ x = 'B').
  const unit = hidup.filter((c) => c.length === 1).map((c) => c[0]);
  let kontradiksi = unit.some((a) => unit.some((b) => isNegationOf(a, b)));
  if (!kontradiksi) {
    const eq = new Map();
    for (const u of unit) {
      if (u.k === 'binop' && u.op === '=' && u.l?.k === 'col' && (u.r?.k === 'str' || u.r?.k === 'num')) {
        const key = exprToString(u.l);
        if (eq.has(key) && eq.get(key) !== u.r.v) { kontradiksi = true; break; }
        eq.set(key, u.r.v);
      }
    }
  }
  if (kontradiksi) jejak.push({ aturan: 'p ∧ ¬p ≡ false', pada: 'kualifikasi kueri' });

  const teks = kontradiksi ? 'false' : (hidup.map((c) => (c.length > 1 ? `(${c.map(exprToString).join(' OR ')})` : exprToString(c[0]))).join(' AND ') || 'true');
  const asal = toCNF(expr);
  return {
    asal: asal.teks,
    hasil: teks,
    jejak,
    selaluSalah: kontradiksi,
    klausaAsal: asal.jumlahKlausa,
    klausaSisa: kontradiksi ? 0 : hidup.length,
  };
}

function isNegationOf(a, b) {
  const flip = { '=': '<>', '<>': '=', '<': '>=', '>': '<=', '<=': '>', '>=': '<' };
  if (a.k === 'binop' && b.k === 'binop' && flip[a.op] === b.op) {
    return exprToString(a.l) === exprToString(b.l) && exprToString(a.r) === exprToString(b.r);
  }
  return false;
}

// --------------------------------------------------------- 4) PENULISAN ULANG

/**
 * Ubah AST SELECT menjadi pohon operator aljabar relasional.
 * Daun = relasi pada FROM; akar = proyeksi atribut hasil (Modul 7).
 */
export function toOperatorTree(ast) {
  if (ast.type === 'with') {
    return {
      op: 'with',
      detail: ast.ctes.map((c) => c.name).join(', '),
      children: [...ast.ctes.map((c) => ({ op: 'cte', name: c.name, children: [toOperatorTree(c.query)] })), toOperatorTree(ast.body)],
    };
  }
  if (ast.type === 'union' || ast.type === 'setop') {
    const opHimpunan = ast.type === 'union' ? (ast.all ? 'union all' : 'union') : ast.op.toLowerCase();
    let himpunan = { op: opHimpunan, children: [toOperatorTree(ast.left), toOperatorTree(ast.right)] };
    if (ast.orderBy && ast.orderBy.length) himpunan = { op: 'sort', detail: ast.orderBy.map((o) => `${exprToString(o.expr)} ${o.dir}`).join(', '), children: [himpunan] };
    if (ast.limit !== null && ast.limit !== undefined) himpunan = { op: 'limit', detail: batasTeks(ast), children: [himpunan] };
    return himpunan;
  }
  if (ast.type !== 'select') throw new SqlError(`Pohon operator hanya dibuat untuk SELECT, bukan ${String(ast.type).toUpperCase()}.`);
  const q = ast;
  const daun = [...q.from.map((r) => ({ op: 'relation', name: r.table || `(sub) ${r.alias}`, alias: r.alias, children: [] })),
                ...q.joins.map((j) => ({ op: 'relation', name: j.ref.table || `(sub) ${j.ref.alias}`, alias: j.ref.alias, children: [] }))];
  if (daun.length === 0) return { op: 'relation', name: 'DUAL', children: [] };

  let node = daun[0];
  const joinPreds = q.joins.map((j) => (j.on ? exprToString(j.on) : null));
  for (let i = 1; i < daun.length; i++) {
    const pred = joinPreds[i - 1] ?? null;
    node = { op: pred ? 'join' : 'product', on: pred, children: [node, daun[i]] };
  }
  if (q.where) {
    const bagian = flatten(pushNegations(q.where), 'AND').map(exprToString);
    node = { op: 'select', pred: bagian.join(' AND '), predParts: bagian, children: [node] };
  }
  if (q.groupBy.length || hasAgg(q)) {
    node = { op: 'group', detail: q.groupBy.map(exprToString).join(', ') || '(seluruh relasi)', children: [node] };
  }
  if (q.having) node = { op: 'select', pred: `HAVING ${exprToString(q.having)}`, children: [node] };
  const attrs = q.items.map((it) => it.as || exprToString(it.expr));
  node = { op: 'project', attrs, children: [node] };
  if (q.distinct) node = { op: 'distinct', children: [node] };
  if (q.orderBy.length) node = { op: 'sort', detail: q.orderBy.map((o) => `${exprToString(o.expr)} ${o.dir}`).join(', '), children: [node] };
  if (q.limit !== null && q.limit !== undefined) node = { op: 'limit', detail: batasTeks(q), children: [node] };
  return node;
}

const batasTeks = (q) => `${q.limit} baris${q.offset ? `, lewati ${q.offset}` : ''}`;

function hasAgg(q) {
  const cek = (e) => {
    if (!e || typeof e !== 'object') return false;
    if (e.k === 'agg') return true;
    return ['l', 'r', 'e', 'arg'].some((k) => e[k] && cek(e[k])) || (e.args || []).some(cek);
  };
  return q.items.some((it) => cek(it.expr)) || (q.having ? cek(q.having) : false);
}

/**
 * Optimasi aljabar dasar: dorong selection sedekat mungkin ke daun
 * ("push down selection") — kemenangan terbesar sebelum data menyeberang jaringan.
 */
export function pushDownSelections(tree) {
  if (!tree) return tree;
  const langkah = [];
  const walk = (n) => {
    if (!n.children || n.children.length === 0) return n;
    n.children = n.children.map(walk);
    if (n.op === 'select' && n.children[0] && (n.children[0].op === 'join' || n.children[0].op === 'product')) {
      const j = n.children[0];
      // pakai daftar konjung dari AST, bukan pemecahan string: memecah teks pada
      // " AND " merusak tanda kurung dan menghasilkan predikat tak seimbang.
      const conj = n.predParts || [n.pred];
      const kiri = []; const kanan = []; const sisa = [];
      const aliasOf = (node) => collectAliases(node);
      const aKiri = aliasOf(j.children[0]);
      const aKanan = aliasOf(j.children[1]);
      for (const c of conj) {
        const refs = [...c.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\./g)].map((m) => m[1]);
        const diKiri = refs.length > 0 && refs.every((r) => aKiri.includes(r));
        const diKanan = refs.length > 0 && refs.every((r) => aKanan.includes(r));
        if (diKiri) kiri.push(c); else if (diKanan) kanan.push(c); else sisa.push(c);
      }
      if (kiri.length || kanan.length) {
        if (kiri.length) { j.children[0] = { op: 'select', pred: kiri.join(' AND '), predParts: kiri, children: [j.children[0]] }; langkah.push(`dorong "${kiri.join(' AND ')}" ke cabang ${aKiri.join('/')}`); }
        if (kanan.length) { j.children[1] = { op: 'select', pred: kanan.join(' AND '), predParts: kanan, children: [j.children[1]] }; langkah.push(`dorong "${kanan.join(' AND ')}" ke cabang ${aKanan.join('/')}`); }
        return sisa.length ? { op: 'select', pred: sisa.join(' AND '), predParts: sisa, children: [j] } : j;
      }
    }
    return n;
  };
  const out = walk(JSON.parse(JSON.stringify(tree)));
  return { pohon: out, langkah };
}

function collectAliases(n) {
  if (!n) return [];
  if (n.op === 'relation') return [n.alias || n.name];
  return (n.children || []).flatMap(collectAliases);
}

/** Jalankan keempat langkah sekaligus atas string SQL. */
export function decompose(sql, skema) {
  const ast = parse(sql);
  const q = selectUtama(ast);
  const where = q.where;
  const normalisasi = where ? { cnf: toCNF(where), dnf: toDNF(where) } : { cnf: null, dnf: null };
  const analisis = analyze(ast, skema);
  const redundansi = where ? eliminateRedundancy(where) : { asal: 'true', hasil: 'true', jejak: [], selaluSalah: false, klausaAsal: 0, klausaSisa: 0 };
  const pohon = toOperatorTree(ast);
  const dioptimasi = pushDownSelections(pohon);
  return { sql, ast, normalisasi, analisis, redundansi, pohon, dioptimasi };
}

export { SqlError };
