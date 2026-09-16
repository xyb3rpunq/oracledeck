// relation.js — representasi relasi (tabel) dan operasi dasar atas tupel.
// Nol dependensi. Dipakai identik di Node (uji) dan di peramban (situs).

export class Relation {
  /**
   * @param {string} name   nama relasi, mis. "STAFF"
   * @param {string[]} attrs daftar atribut terurut
   * @param {Array<Array<*>>|Array<Object>} rows baris sebagai array posisional atau objek
   */
  constructor(name, attrs, rows = []) {
    if (typeof name !== 'string' || name.length === 0) throw new Error('Relation: nama wajib diisi');
    if (!Array.isArray(attrs) || attrs.length === 0) throw new Error(`Relation ${name}: atribut wajib diisi`);
    const dup = attrs.find((a, i) => attrs.indexOf(a) !== i);
    if (dup) throw new Error(`Relation ${name}: atribut ganda "${dup}"`);
    this.name = name;
    this.attrs = attrs.slice();
    this.rows = rows.map((r) => Relation.#normalizeRow(r, this.attrs, name));
  }

  static #normalizeRow(r, attrs, name) {
    if (Array.isArray(r)) {
      if (r.length !== attrs.length) {
        throw new Error(`Relation ${name}: baris punya ${r.length} nilai, butuh ${attrs.length}`);
      }
      return r.slice();
    }
    if (r && typeof r === 'object') return attrs.map((a) => (a in r ? r[a] : null));
    throw new Error(`Relation ${name}: baris harus array atau objek`);
  }

  get cardinality() { return this.rows.length; }
  get degree() { return this.attrs.length; }

  /** indeks kolom; -1 bila tidak ada. Menerima "STAFF.sno" maupun "sno". */
  indexOf(attr) {
    let i = this.attrs.indexOf(attr);
    if (i >= 0) return i;
    const bare = attr.includes('.') ? attr.split('.').pop() : attr;
    i = this.attrs.indexOf(bare);
    if (i >= 0) return i;
    return this.attrs.findIndex((a) => a.split('.').pop() === bare);
  }

  has(attr) { return this.indexOf(attr) >= 0; }

  /** baris ke objek {atribut: nilai} */
  obj(i) {
    const o = {};
    this.attrs.forEach((a, k) => { o[a] = this.rows[i][k]; });
    return o;
  }

  objects() { return this.rows.map((_, i) => this.obj(i)); }

  /** nilai satu sel berdasarkan nama atribut */
  cell(rowIdx, attr) {
    const c = this.indexOf(attr);
    if (c < 0) throw new Error(`Relation ${this.name}: atribut "${attr}" tidak ada`);
    return this.rows[rowIdx][c];
  }

  rename(newName) { return new Relation(newName, this.attrs, this.rows); }

  /** salin dengan prefiks nama relasi pada tiap atribut: sno -> STAFF.sno */
  qualified() {
    return new Relation(this.name, this.attrs.map((a) => (a.includes('.') ? a : `${this.name}.${a}`)), this.rows);
  }

  clone() { return new Relation(this.name, this.attrs, this.rows); }

  /** kunci kanonik satu baris, untuk deteksi duplikat dan perbandingan himpunan */
  static key(row) { return JSON.stringify(row.map(canon)); }

  /** buang baris duplikat (semantik himpunan aljabar relasional) */
  distinct() {
    const seen = new Set();
    const out = [];
    for (const r of this.rows) {
      const k = Relation.key(r);
      if (!seen.has(k)) { seen.add(k); out.push(r); }
    }
    return new Relation(this.name, this.attrs, out);
  }

  /** ukuran perkiraan dalam byte — dipakai model biaya alokasi & join terdistribusi */
  sizeBytes(widthMap = {}) {
    const w = this.attrs.reduce((s, a) => s + (widthMap[a] ?? defaultWidth(this, a)), 0);
    return w * this.rows.length;
  }

  /** perbandingan himpunan: relasi setara bila atribut sama (urutan bebas) dan isi sama */
  equals(other) {
    if (!(other instanceof Relation)) return false;
    if (this.attrs.length !== other.attrs.length) return false;
    const sa = this.attrs.slice().sort();
    const sb = other.attrs.slice().sort();
    if (sa.join('\u0001') !== sb.join('\u0001')) return false;
    const norm = (rel) => new Set(rel.rows.map((r) => {
      const o = {};
      rel.attrs.forEach((a, i) => { o[a] = canon(r[i]); });
      return JSON.stringify(sa.map((a) => o[a]));
    }));
    const A = norm(this); const B = norm(other);
    if (A.size !== B.size) return false;
    for (const k of A) if (!B.has(k)) return false;
    return true;
  }

  toJSON() { return { name: this.name, attrs: this.attrs, rows: this.rows }; }

  static fromJSON(j) { return new Relation(j.name, j.attrs, j.rows); }
}

/** normalisasi nilai agar 1 dan "1" tidak dianggap sama, tapi Date -> ISO */
export function canon(v) {
  if (v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v;
}

function defaultWidth(rel, attr) {
  const i = rel.attrs.indexOf(attr);
  let max = 1;
  for (const r of rel.rows) {
    const v = r[i];
    if (v === null || v === undefined) continue;
    max = Math.max(max, String(v).length);
  }
  return max;
}

/** bangun Relation dari array objek; atribut diambil dari gabungan kunci */
export function fromObjects(name, objs) {
  const attrs = [];
  for (const o of objs) for (const k of Object.keys(o)) if (!attrs.includes(k)) attrs.push(k);
  return new Relation(name, attrs, objs);
}
