// algebra.js — operator aljabar relasional lengkap dengan jejak biaya.
// Rujukan: Özsu & Valduriez, Principles of Distributed Database Systems;
//          Connolly & Begg, Database Systems 6th ed.

import { Relation, canon } from './relation.js?v=849b085103';

/** σ_predikat(R) — SELECT / restriksi */
export function select(R, pred, label = '') {
  const rows = [];
  for (let i = 0; i < R.rows.length; i++) if (pred(R.obj(i), i)) rows.push(R.rows[i]);
  const out = new Relation(R.name, R.attrs, rows);
  out.trace = { op: 'select', label, in: R.cardinality, out: rows.length };
  return out;
}

/** π_atribut(R) — PROJECT. Semantik himpunan: duplikat dibuang kecuali keepDuplicates. */
export function project(R, attrs, keepDuplicates = false) {
  const idx = attrs.map((a) => {
    const i = R.indexOf(a);
    if (i < 0) throw new Error(`project: atribut "${a}" tidak ada di ${R.name}(${R.attrs.join(', ')})`);
    return i;
  });
  const rows = R.rows.map((r) => idx.map((i) => r[i]));
  const out = new Relation(R.name, attrs.map((a, k) => R.attrs[idx[k]]), rows);
  return keepDuplicates ? out : out.distinct();
}

/** R × S — CARTESIAN PRODUCT. Atribut diberi prefiks nama relasi bila bentrok. */
export function product(R, S) {
  const [ra, sa] = disambiguate(R, S);
  const rows = [];
  for (const r of R.rows) for (const s of S.rows) rows.push([...r, ...s]);
  return new Relation(`${R.name}x${S.name}`, [...ra, ...sa], rows);
}

/** R ⋈_cond S — THETA JOIN. cond(objGabungan) -> boolean */
export function join(R, S, cond, name = null) {
  const P = product(R, S);
  const out = select(P, cond);
  return out.rename(name || `${R.name}_JOIN_${S.name}`);
}

/** R ⋈ S — NATURAL JOIN atas atribut bernama sama (setelah prefiks dibuang). */
export function naturalJoin(R, S, name = null) {
  const common = commonAttrs(R, S);
  if (common.length === 0) return product(R, S).rename(name || `${R.name}x${S.name}`);
  const sIdxCommon = common.map((a) => S.indexOf(a));
  const rIdxCommon = common.map((a) => R.indexOf(a));
  const sKeep = S.attrs.map((_, i) => i).filter((i) => !sIdxCommon.includes(i));
  const index = new Map();
  for (const s of S.rows) {
    const k = JSON.stringify(sIdxCommon.map((i) => canon(s[i])));
    if (!index.has(k)) index.set(k, []);
    index.get(k).push(s);
  }
  const rows = [];
  for (const r of R.rows) {
    const k = JSON.stringify(rIdxCommon.map((i) => canon(r[i])));
    for (const s of index.get(k) || []) rows.push([...r, ...sKeep.map((i) => s[i])]);
  }
  const attrs = [...R.attrs, ...sKeep.map((i) => S.attrs[i])];
  const out = new Relation(name || `${R.name}_JOIN_${S.name}`, attrs, rows);
  out.trace = { op: 'naturalJoin', on: common, out: rows.length };
  return out;
}

/** R ⋉ S — SEMIJOIN: baris R yang punya pasangan di S. Inti join terdistribusi. */
export function semiJoin(R, S, name = null) {
  const common = commonAttrs(R, S);
  if (common.length === 0) return S.cardinality > 0 ? R.clone() : new Relation(R.name, R.attrs, []);
  const sIdx = common.map((a) => S.indexOf(a));
  const rIdx = common.map((a) => R.indexOf(a));
  const keys = new Set(S.rows.map((s) => JSON.stringify(sIdx.map((i) => canon(s[i])))));
  const rows = R.rows.filter((r) => keys.has(JSON.stringify(rIdx.map((i) => canon(r[i])))));
  return new Relation(name || `${R.name}_SEMI_${S.name}`, R.attrs, rows);
}

/** R ∪ S — UNION (butuh union-compatible) */
export function union(R, S, name = null) {
  assertUnionCompatible(R, S, 'union');
  const S2 = reorderTo(S, R.attrs);
  return new Relation(name || `${R.name}_UNION_${S.name}`, R.attrs, [...R.rows, ...S2.rows]).distinct();
}

/** UNION ALL — tidak membuang duplikat (SQL, bukan aljabar himpunan) */
export function unionAll(R, S, name = null) {
  assertUnionCompatible(R, S, 'unionAll');
  const S2 = reorderTo(S, R.attrs);
  return new Relation(name || `${R.name}_UNIONALL_${S.name}`, R.attrs, [...R.rows, ...S2.rows]);
}

/** R ∩ S — INTERSECT */
export function intersect(R, S, name = null) {
  assertUnionCompatible(R, S, 'intersect');
  const S2 = reorderTo(S, R.attrs);
  const keys = new Set(S2.rows.map(Relation.key));
  const rows = R.rows.filter((r) => keys.has(Relation.key(r)));
  return new Relation(name || `${R.name}_INTERSECT_${S.name}`, R.attrs, rows).distinct();
}

/** R − S — DIFFERENCE */
export function difference(R, S, name = null) {
  assertUnionCompatible(R, S, 'difference');
  const S2 = reorderTo(S, R.attrs);
  const keys = new Set(S2.rows.map(Relation.key));
  const rows = R.rows.filter((r) => !keys.has(Relation.key(r)));
  return new Relation(name || `${R.name}_MINUS_${S.name}`, R.attrs, rows).distinct();
}

/** LEFT OUTER JOIN atas atribut bersama; kolom kanan diisi null bila tak berpasangan. */
export function leftOuterJoin(R, S, name = null) {
  const common = commonAttrs(R, S);
  const sIdxCommon = common.map((a) => S.indexOf(a));
  const rIdxCommon = common.map((a) => R.indexOf(a));
  const sKeep = S.attrs.map((_, i) => i).filter((i) => !sIdxCommon.includes(i));
  const index = new Map();
  for (const s of S.rows) {
    const k = JSON.stringify(sIdxCommon.map((i) => canon(s[i])));
    if (!index.has(k)) index.set(k, []);
    index.get(k).push(s);
  }
  const rows = [];
  for (const r of R.rows) {
    const k = JSON.stringify(rIdxCommon.map((i) => canon(r[i])));
    const m = index.get(k);
    if (m && m.length) for (const s of m) rows.push([...r, ...sKeep.map((i) => s[i])]);
    else rows.push([...r, ...sKeep.map(() => null)]);
  }
  return new Relation(name || `${R.name}_LEFT_${S.name}`, [...R.attrs, ...sKeep.map((i) => S.attrs[i])], rows);
}

/** RIGHT OUTER JOIN — semua baris S dipertahankan. */
export function rightOuterJoin(R, S, name = null) {
  return leftOuterJoin(S, R, name || `${R.name}_RIGHT_${S.name}`);
}

/** FULL OUTER JOIN = left ⟕ ditambah baris kanan yang tak berpasangan. */
export function fullOuterJoin(R, S, name = null) {
  const L = leftOuterJoin(R, S);
  const common = commonAttrs(R, S);
  const rIdxCommon = common.map((a) => R.indexOf(a));
  const sIdxCommon = common.map((a) => S.indexOf(a));
  const rKeys = new Set(R.rows.map((r) => JSON.stringify(rIdxCommon.map((i) => canon(r[i])))));
  const sKeep = S.attrs.map((_, i) => i).filter((i) => !sIdxCommon.includes(i));
  const bare = (a) => a.split('.').pop();
  const extra = [];
  for (const s of S.rows) {
    const k = JSON.stringify(sIdxCommon.map((i) => canon(s[i])));
    if (rKeys.has(k)) continue;
    const row = R.attrs.map((a) => {
      const ci = common.findIndex((c) => bare(c) === bare(a));
      return ci >= 0 ? s[sIdxCommon[ci]] : null;
    });
    extra.push([...row, ...sKeep.map((i) => s[i])]);
  }
  return new Relation(name || `${R.name}_FULL_${S.name}`, L.attrs, [...L.rows, ...extra]);
}

/** GROUP BY + fungsi agregasi (Praktikum 3: COUNT/SUM/AVG/MIN/MAX) */
export function groupBy(R, groupAttrs, aggs, name = null) {
  const gIdx = groupAttrs.map((a) => {
    const i = R.indexOf(a);
    if (i < 0) throw new Error(`groupBy: atribut "${a}" tidak ada di ${R.name}`);
    return i;
  });
  const buckets = new Map();
  const order = [];
  for (let i = 0; i < R.rows.length; i++) {
    const k = JSON.stringify(gIdx.map((j) => canon(R.rows[i][j])));
    if (!buckets.has(k)) { buckets.set(k, []); order.push(k); }
    buckets.get(k).push(i);
  }
  // agregat tanpa GROUP BY atas relasi kosong tetap menghasilkan satu baris (COUNT=0)
  if (groupAttrs.length === 0 && R.rows.length === 0) { order.push('[]'); buckets.set('[]', []); }
  const attrs = [...groupAttrs.map((a, k) => R.attrs[gIdx[k]]), ...aggs.map((a) => a.as)];
  const rows = order.map((k) => {
    const idxs = buckets.get(k);
    const head = gIdx.map((j) => (idxs.length ? R.rows[idxs[0]][j] : null));
    const vals = aggs.map((a) => aggregate(a.fn, idxs.map((i) => (a.attr === '*' ? 1 : R.cell(i, a.attr)))));
    return [...head, ...vals];
  });
  return new Relation(name || `AGG_${R.name}`, attrs, rows);
}

export const AGG_FNS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'];

export function aggregate(fn, values) {
  const f = String(fn).toUpperCase();
  const clean = values.filter((v) => v !== null && v !== undefined);
  const nums = clean.map(Number).filter((n) => !Number.isNaN(n));
  switch (f) {
    case 'COUNT': return clean.length;
    case 'SUM': return nums.length ? nums.reduce((a, b) => a + b, 0) : 0;
    case 'AVG': return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    case 'MIN': {
      if (!clean.length) return null;
      return nums.length === clean.length ? Math.min(...nums) : clean.map(String).sort()[0];
    }
    case 'MAX': {
      if (!clean.length) return null;
      return nums.length === clean.length ? Math.max(...nums) : clean.map(String).sort()[clean.length - 1];
    }
    default: throw new Error(`aggregate: fungsi "${fn}" tidak dikenal (pakai ${AGG_FNS.join('/')})`);
  }
}

/** ORDER BY: keys = [{attr, dir:'ASC'|'DESC'}] — stabil */
export function orderBy(R, keys) {
  const decorated = R.rows.map((r, i) => ({ r, i }));
  decorated.sort((x, y) => {
    for (const k of keys) {
      const c = R.indexOf(k.attr);
      if (c < 0) throw new Error(`orderBy: atribut "${k.attr}" tidak ada di ${R.name}`);
      const cmp = compareValues(x.r[c], y.r[c]);
      if (cmp !== 0) return (k.dir || 'ASC').toUpperCase() === 'DESC' ? -cmp : cmp;
    }
    return x.i - y.i;
  });
  return new Relation(R.name, R.attrs, decorated.map((d) => d.r));
}

export function compareValues(a, b) {
  const av = canon(a); const bv = canon(b);
  if (av === null && bv === null) return 0;
  if (av === null) return -1;
  if (bv === null) return 1;
  const an = Number(av); const bn = Number(bv);
  if (!Number.isNaN(an) && !Number.isNaN(bn) && av !== '' && bv !== '') return an < bn ? -1 : an > bn ? 1 : 0;
  return String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
}

export function limit(R, n, offset = 0) {
  return new Relation(R.name, R.attrs, R.rows.slice(offset, offset + n));
}

// ---------- utilitas internal ----------

export function commonAttrs(R, S) {
  const bare = (a) => a.split('.').pop();
  return R.attrs.filter((a) => S.attrs.some((b) => bare(b) === bare(a)));
}

function disambiguate(R, S) {
  const clash = R.attrs.some((a) => S.attrs.includes(a));
  if (!clash) return [R.attrs.slice(), S.attrs.slice()];
  const q = (rel) => rel.attrs.map((a) => (a.includes('.') ? a : `${rel.name}.${a}`));
  return [q(R), q(S)];
}

function assertUnionCompatible(R, S, op) {
  if (R.degree !== S.degree) {
    throw new Error(`${op}: derajat berbeda — ${R.name} punya ${R.degree} atribut, ${S.name} punya ${S.degree}`);
  }
  const a = R.attrs.map((x) => x.split('.').pop()).slice().sort().join('|');
  const b = S.attrs.map((x) => x.split('.').pop()).slice().sort().join('|');
  if (a !== b) throw new Error(`${op}: tidak union-compatible — [${R.attrs}] vs [${S.attrs}]`);
}

/** susun ulang kolom S agar sejajar dengan urutan atribut target */
export function reorderTo(S, attrs) {
  const idx = attrs.map((a) => {
    const i = S.indexOf(a);
    if (i < 0) throw new Error(`reorderTo: atribut "${a}" tidak ada di ${S.name}`);
    return i;
  });
  return new Relation(S.name, attrs, S.rows.map((r) => idx.map((i) => r[i])));
}
