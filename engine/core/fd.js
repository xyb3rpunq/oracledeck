// fd.js — ketergantungan fungsional dan normalisasi 1NF-BCNF.
// Menutup materi "Dekomposisi Kueri" bagian normalisasi (Modul 7) dan
// latihan 1NF/2NF/3NF pada dokumentasi Task 7.

/** @typedef {{lhs: string[], rhs: string[]}} FD */

const S = (arr) => [...new Set(arr.map((x) => String(x)))].sort();
export const setEq = (a, b) => S(a).join('|') === S(b).join('|');
export const isSubset = (a, b) => a.every((x) => b.includes(x));

/** X+ — penutupan atribut terhadap himpunan FD. */
export function closure(attrs, fds) {
  let cur = S(attrs);
  let changed = true;
  while (changed) {
    changed = false;
    for (const fd of fds) {
      if (isSubset(fd.lhs, cur) && !isSubset(fd.rhs, cur)) {
        cur = S([...cur, ...fd.rhs]);
        changed = true;
      }
    }
  }
  return cur;
}

/** Apakah X -> Y dapat disimpulkan dari F? */
export function implies(fds, lhs, rhs) { return isSubset(S(rhs), closure(lhs, fds)); }

/** Semua superkey minimal (candidate key) dari R(attrs) terhadap F. */
export function candidateKeys(attrs, fds) {
  const all = S(attrs);
  const keys = [];
  // telusuri semua subset berukuran naik; relasi kuliah berukuran kecil sehingga aman
  if (all.length > 20) throw new Error('candidateKeys: relasi terlalu lebar (>20 atribut)');
  for (let size = 1; size <= all.length; size++) {
    for (const combo of combinations(all, size)) {
      if (keys.some((k) => isSubset(k, combo))) continue; // memuat key lain -> bukan minimal
      if (setEq(closure(combo, fds), all)) keys.push(S(combo));
    }
  }
  return keys;
}

export function* combinations(arr, k) {
  const n = arr.length;
  const idx = Array.from({ length: k }, (_, i) => i);
  if (k > n) return;
  for (;;) {
    yield idx.map((i) => arr[i]);
    let i = k - 1;
    while (i >= 0 && idx[i] === i + n - k) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}

/** Atribut yang menjadi bagian dari suatu candidate key. */
export function primeAttributes(attrs, fds) {
  const keys = candidateKeys(attrs, fds);
  return S(keys.flat());
}

/** Bentuk kanonik (minimal cover) dari F. */
export function minimalCover(fds) {
  // 1. pecah ruas kanan jadi atribut tunggal
  let f = [];
  for (const fd of fds) for (const r of S(fd.rhs)) f.push({ lhs: S(fd.lhs), rhs: [r] });
  f = dedupeFds(f);
  // 2. buang atribut berlebih di ruas kiri
  for (let i = 0; i < f.length; i++) {
    for (const a of [...f[i].lhs]) {
      if (f[i].lhs.length === 1) break;
      const trimmed = f[i].lhs.filter((x) => x !== a);
      // A ekstra pada X->Y bila Y termuat dalam (X-A)+ yang dihitung terhadap F utuh
      // (termasuk X->Y itu sendiri) — memakai himpunan yang sudah diubah membuat
      // penalaran melingkar dan salah memangkas, mis. AB->C jadi B->C.
      if (implies(f, trimmed, f[i].rhs)) f[i] = { lhs: trimmed, rhs: f[i].rhs };
    }
  }
  f = dedupeFds(f);
  // 3. buang FD berlebih
  const out = [];
  for (let i = 0; i < f.length; i++) {
    const rest = [...out, ...f.slice(i + 1)];
    if (!implies(rest, f[i].lhs, f[i].rhs)) out.push(f[i]);
  }
  return out;
}

function dedupeFds(f) {
  const seen = new Set();
  const out = [];
  for (const fd of f) {
    const k = `${S(fd.lhs).join(',')}=>${S(fd.rhs).join(',')}`;
    if (!seen.has(k)) { seen.add(k); out.push({ lhs: S(fd.lhs), rhs: S(fd.rhs) }); }
  }
  return out;
}

/** Cek 2NF: tidak ada ketergantungan parsial atribut non-prime pada sebagian candidate key. */
export function violations2NF(attrs, fds) {
  const keys = candidateKeys(attrs, fds);
  const prime = primeAttributes(attrs, fds);
  const bad = new Map();
  for (const key of keys) {
    if (key.length < 2) continue;
    for (let size = 1; size < key.length; size++) {
      for (const sub of combinations(key, size)) {
        const cl = closure(sub, fds);
        for (const a of cl) {
          if (!prime.includes(a) && !sub.includes(a) && attrs.includes(a)) {
            const k = `${S(sub).join(',')}=>${a}`;
            if (!bad.has(k)) {
              bad.set(k, { lhs: S(sub), rhs: [a], alasan: 'ketergantungan parsial pada sebagian candidate key' });
            }
          }
        }
      }
    }
  }
  return [...bad.values()];
}

/** Cek 3NF: setiap FD X->A harus X superkey ATAU A prime. */
export function violations3NF(attrs, fds) {
  const all = S(attrs);
  const prime = primeAttributes(attrs, fds);
  const bad = [];
  for (const fd of minimalCover(fds)) {
    const superkey = setEq(closure(fd.lhs, fds), all);
    const rhsPrime = fd.rhs.every((a) => prime.includes(a));
    const trivial = isSubset(fd.rhs, fd.lhs);
    if (!trivial && !superkey && !rhsPrime) {
      bad.push({ ...fd, alasan: 'ruas kiri bukan superkey dan ruas kanan bukan atribut prime (transitif)' });
    }
  }
  return bad;
}

/** Cek BCNF: setiap FD non-trivial X->A harus X superkey. */
export function violationsBCNF(attrs, fds) {
  const all = S(attrs);
  const bad = [];
  for (const fd of minimalCover(fds)) {
    const trivial = isSubset(fd.rhs, fd.lhs);
    if (trivial) continue;
    if (!setEq(closure(fd.lhs, fds), all)) bad.push({ ...fd, alasan: 'ruas kiri bukan superkey' });
  }
  return bad;
}

/** Tingkat normalisasi tertinggi yang dipenuhi R(attrs, F). Asumsi 1NF sudah dipenuhi. */
export function normalForm(attrs, fds, { atomic = true } = {}) {
  if (!atomic) return '1NF belum terpenuhi';
  if (violations2NF(attrs, fds).length) return '1NF';
  if (violations3NF(attrs, fds).length) return '2NF';
  if (violationsBCNF(attrs, fds).length) return '3NF';
  return 'BCNF';
}

/** Sintesis 3NF (algoritma Bernstein): dekomposisi lossless + preserving. */
export function synthesize3NF(attrs, fds) {
  const cover = minimalCover(fds);
  const groups = new Map();
  for (const fd of cover) {
    const k = fd.lhs.join(',');
    if (!groups.has(k)) groups.set(k, { lhs: fd.lhs, rhs: [] });
    groups.get(k).rhs.push(...fd.rhs);
  }
  let rels = [...groups.values()].map((g, i) => ({
    nama: `R${i + 1}`,
    attrs: S([...g.lhs, ...g.rhs]),
    fds: [{ lhs: g.lhs, rhs: S(g.rhs) }],
  }));
  // buang relasi yang sudah termuat di relasi lain
  rels = rels.filter((r, i) => !rels.some((o, j) => j !== i && isSubset(r.attrs, o.attrs) && o.attrs.length >= r.attrs.length && (o.attrs.length > r.attrs.length || j < i)));
  // pastikan minimal satu relasi memuat candidate key (jaminan lossless)
  const keys = candidateKeys(attrs, fds);
  if (keys.length && !rels.some((r) => keys.some((k) => isSubset(k, r.attrs)))) {
    rels.push({ nama: `R${rels.length + 1}`, attrs: S(keys[0]), fds: [] });
  }
  rels.forEach((r, i) => { r.nama = `R${i + 1}`; });
  return rels;
}

/**
 * Uji lossless-join untuk dekomposisi biner R = R1 ⋈ R2.
 * Syarat: (R1 ∩ R2) -> R1  atau  (R1 ∩ R2) -> R2.
 */
export function losslessBinary(r1, r2, fds) {
  const inter = S(r1).filter((a) => S(r2).includes(a));
  if (inter.length === 0) return { lossless: false, alasan: 'irisan atribut kosong', irisan: inter };
  const cl = closure(inter, fds);
  const ke1 = isSubset(S(r1), cl);
  const ke2 = isSubset(S(r2), cl);
  return {
    lossless: ke1 || ke2,
    irisan: inter,
    alasan: ke1 || ke2
      ? `(${inter.join(', ')})+ memuat ${ke1 ? 'R1' : 'R2'} secara penuh`
      : `(${inter.join(', ')})+ = {${cl.join(', ')}} tidak memuat R1 maupun R2`,
  };
}

/** Uji lossless-join untuk dekomposisi n-arah — algoritma tabel chase. */
export function losslessChase(attrs, decomposition, fds) {
  const all = S(attrs);
  const T = decomposition.map((d) => all.map((a) => (S(d).includes(a) ? 'a' : 'b')));
  let changed = true;
  let iter = 0;
  while (changed && iter < 1000) {
    changed = false; iter++;
    for (const fd of fds) {
      const lhsIdx = fd.lhs.map((a) => all.indexOf(a)).filter((i) => i >= 0);
      if (lhsIdx.length !== fd.lhs.length) continue;
      const buckets = new Map();
      T.forEach((row, ri) => {
        const k = lhsIdx.map((i) => `${row[i]}#${i}`).join('|');
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push(ri);
      });
      for (const rows of buckets.values()) {
        if (rows.length < 2) continue;
        for (const a of fd.rhs) {
          const ci = all.indexOf(a);
          if (ci < 0) continue;
          if (rows.some((ri) => T[ri][ci] === 'a')) {
            for (const ri of rows) if (T[ri][ci] !== 'a') { T[ri][ci] = 'a'; changed = true; }
          }
        }
      }
    }
  }
  const idx = T.findIndex((row) => row.every((v) => v === 'a'));
  return { lossless: idx >= 0, barisPenuh: idx, tabel: T, atribut: all, iterasi: iter };
}

/** Apakah dekomposisi mempertahankan seluruh ketergantungan? */
export function preservesDependencies(decomposition, fds) {
  const projected = [];
  for (const d of decomposition) {
    const sub = S(d);
    for (let size = 1; size < sub.length; size++) {
      for (const combo of combinations(sub, size)) {
        const cl = closure(combo, fds).filter((a) => sub.includes(a) && !combo.includes(a));
        if (cl.length) projected.push({ lhs: S(combo), rhs: cl });
      }
    }
  }
  const hilang = fds.filter((fd) => !implies(projected, fd.lhs, fd.rhs));
  return { preserved: hilang.length === 0, hilang, proyeksi: minimalCover(projected) };
}

/** Deteksi pelanggaran 1NF dari data: sel berisi pemisah daftar. */
export function violations1NF(relation, { separators = [',', ';', '|'] } = {}) {
  const bad = [];
  relation.attrs.forEach((a, c) => {
    relation.rows.forEach((r, ri) => {
      const v = r[c];
      if (typeof v === 'string' && separators.some((s) => v.includes(s) && v.split(s).length > 1 && v.split(s).every((p) => p.trim().length))) {
        bad.push({ atribut: a, baris: ri, nilai: v, alasan: 'nilai bukan atomik (mengandung daftar)' });
      }
      if (Array.isArray(v)) bad.push({ atribut: a, baris: ri, nilai: JSON.stringify(v), alasan: 'nilai berupa larik' });
    });
  });
  return bad;
}

export function fdToString(fd) { return `${S(fd.lhs).join(', ')} -> ${S(fd.rhs).join(', ')}`; }

export function parseFds(text) {
  return String(text)
    .split(/[\n;]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.split(/->|→|=>/);
      if (m.length !== 2) throw new Error(`FD tidak valid: "${line}" (format: A, B -> C)`);
      return { lhs: S(m[0].split(/[,\s]+/).filter(Boolean)), rhs: S(m[1].split(/[,\s]+/).filter(Boolean)) };
    });
}
