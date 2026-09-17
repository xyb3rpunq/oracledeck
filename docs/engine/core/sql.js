// sql.js — tokenizer, parser, perencana, dan eksekutor SQL.
// Cakupan dipilih agar persis menutup Praktikum 2-5 dan contoh-contoh di modul:
//   [WITH cte AS (...)] SELECT [DISTINCT] ... FROM ... [JOIN|LEFT|RIGHT|FULL] ... ON ...
//   WHERE (=, <>, !=, <, >, <=, >=, BETWEEN, LIKE, IN, EXISTS, IS NULL, NOT, AND, OR)
//   GROUP BY ... HAVING ... ORDER BY ... ASC|DESC
//   LIMIT n [OFFSET m]  |  OFFSET m ROWS FETCH FIRST|NEXT n ROWS ONLY   (gaya Oracle)
//   COUNT/SUM/AVG/MIN/MAX, CASE WHEN, UNION [ALL] / INTERSECT / MINUS / EXCEPT,
//   subquery pada IN, EXISTS (boleh berkorelasi), FROM, dan sebagai nilai skalar,
//   tabel DUAL, serta INSERT / UPDATE / DELETE (dieksekusi oleh engine/core/dml.js).
// Parser juga mengenali perintah sesi yang dijalankan engine/core/terminal.js:
//   CREATE TABLE / CREATE TABLE ... AS SELECT / CREATE [OR REPLACE] VIEW / CREATE INDEX,
//   DROP TABLE|VIEW|INDEX, TRUNCATE TABLE, COMMIT, ROLLBACK [TO SAVEPOINT], SAVEPOINT,
//   DESC[RIBE], EXPLAIN PLAN FOR, dan nama objek remote gaya Oracle: tabel@dblink.
// Nol dependensi.

import { Relation } from './relation.js?v=b04806ea2d';
import * as A from './algebra.js?v=b04806ea2d';

const KEYWORDS = new Set([
  'SELECT', 'DISTINCT', 'FROM', 'WHERE', 'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC',
  'LIMIT', 'OFFSET', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'ON', 'AS',
  'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'BETWEEN', 'LIKE', 'UNION', 'ALL', 'EXISTS', 'CROSS',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'WITH', 'INTERSECT', 'MINUS', 'EXCEPT',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'FETCH',
]);

// ---------------------------------------------------------------- tokenizer

export function tokenize(sql) {
  const t = [];
  let i = 0;
  const s = String(sql);
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '-' && s[i + 1] === '-') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && s[i + 1] === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue; }
    if (c === "'" || c === '‘' || c === '’') {
      let j = i + 1; let v = '';
      while (j < s.length) {
        const cj = s[j];
        if (cj === "'" || cj === '‘' || cj === '’') {
          if (s[j + 1] === "'") { v += "'"; j += 2; continue; }
          break;
        }
        v += cj; j++;
      }
      if (j >= s.length) throw new SqlError('String literal tidak ditutup tanda petik');
      t.push({ type: 'str', value: v, pos: i, end: j + 1 }); i = j + 1; continue;
    }
    if (c === '"') {
      let j = i + 1; let v = '';
      while (j < s.length && s[j] !== '"') { v += s[j]; j++; }
      if (j >= s.length) throw new SqlError('Identifier tidak ditutup tanda kutip ganda');
      t.push({ type: 'ident', value: v, quoted: true, pos: i, end: j + 1 }); i = j + 1; continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
      let j = i; let v = '';
      while (j < s.length && /[0-9.]/.test(s[j])) { v += s[j]; j++; }
      if (Number.isNaN(Number(v))) throw new SqlError(`Angka tidak valid: "${v}" pada posisi ${i}`);
      t.push({ type: 'num', value: Number(v), pos: i, end: j }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; let v = '';
      while (j < s.length && /[A-Za-z0-9_$]/.test(s[j])) { v += s[j]; j++; }
      // nama objek remote gaya Oracle: pasien@bandung (tabel lewat database link)
      if (s[j] === '@' && /[A-Za-z_]/.test(s[j + 1] || '')) {
        let k = j + 1; let link = '';
        while (k < s.length && /[A-Za-z0-9_$]/.test(s[k])) { link += s[k]; k++; }
        t.push({ type: 'ident', value: `${v}@${link}`, link: link.toLowerCase(), pos: i, end: k });
        i = k; continue;
      }
      const up = v.toUpperCase();
      t.push(KEYWORDS.has(up) ? { type: 'kw', value: up, pos: i, end: j } : { type: 'ident', value: v, pos: i, end: j });
      i = j; continue;
    }
    const two = s.slice(i, i + 2);
    if (['<>', '<=', '>=', '!=', '||'].includes(two)) { t.push({ type: 'op', value: two, pos: i, end: i + 2 }); i += 2; continue; }
    if ('=<>+-*/%'.includes(c)) { t.push({ type: 'op', value: c, pos: i, end: i + 1 }); i++; continue; }
    if ('(),.;'.includes(c)) { t.push({ type: 'punct', value: c, pos: i, end: i + 1 }); i++; continue; }
    throw new SqlError(`Karakter tidak dikenal: "${c}" pada posisi ${i}`);
  }
  return t;
}

export class SqlError extends Error {
  constructor(msg) { super(msg); this.name = 'SqlError'; }
}

// ------------------------------------------------------------------ parser

class Parser {
  constructor(tokens) { this.t = tokens; this.p = 0; }
  peek(k = 0) { return this.t[this.p + k]; }
  get done() { return this.p >= this.t.length; }
  isKw(v, k = 0) { const x = this.peek(k); return x && x.type === 'kw' && x.value === v; }
  isPunct(v, k = 0) { const x = this.peek(k); return x && x.type === 'punct' && x.value === v; }
  isOp(v, k = 0) { const x = this.peek(k); return x && x.type === 'op' && x.value === v; }
  next() { return this.t[this.p++]; }
  expectKw(v) { if (!this.isKw(v)) throw new SqlError(`Diharapkan ${v}, ditemukan "${this.describe()}"`); return this.next(); }
  expectPunct(v) { if (!this.isPunct(v)) throw new SqlError(`Diharapkan "${v}", ditemukan "${this.describe()}"`); return this.next(); }
  describe() { const x = this.peek(); return x ? String(x.value) : 'akhir perintah'; }
  isWord(v, k = 0) { const x = this.peek(k); return x && x.type === 'ident' && !x.quoted && String(x.value).toUpperCase() === v; }
  expectWord(v) { if (!this.isWord(v)) throw new SqlError(`Diharapkan ${v}, ditemukan "${this.describe()}"`); return this.next(); }
  expectIdent(apa) {
    const x = this.next();
    if (!x || x.type !== 'ident') throw new SqlError(`Diharapkan nama ${apa}, ditemukan "${x ? x.value : 'akhir perintah'}"`);
    return x.value;
  }

  parseStatement() {
    const q = this.parseAnyStatement();
    while (this.isPunct(';')) this.next();
    if (!this.done) throw new SqlError(`Token sisa setelah perintah: "${this.describe()}"`);
    return q;
  }

  /** Beberapa perintah dipisah titik koma. */
  parseScript() {
    const out = [];
    while (!this.done) {
      while (this.isPunct(';')) this.next();
      if (this.done) break;
      out.push(this.parseAnyStatement());
      if (!this.done && !this.isPunct(';')) throw new SqlError(`Token sisa setelah perintah: "${this.describe()}" — pisahkan perintah dengan titik koma`);
    }
    return out;
  }

  parseAnyStatement() {
    const awal = this.peek();
    const st = this.parseStatementInti();
    // simpan rentang teks asli agar terminal dapat menggemakan perintah yang dijalankan
    const akhir = this.t[this.p - 1];
    if (awal && akhir && awal.pos !== undefined && akhir.end !== undefined) Object.defineProperty(st, 'rentang', { value: [awal.pos, akhir.end], enumerable: false });
    return st;
  }

  parseStatementInti() {
    if (this.isKw('INSERT')) return this.parseInsert();
    if (this.isKw('UPDATE')) return this.parseUpdate();
    if (this.isKw('DELETE')) return this.parseDelete();
    if (this.isKw('WITH')) return this.parseWith();
    if (this.isWord('CREATE')) return this.parseCreate();
    if (this.isWord('DROP')) return this.parseDrop();
    if (this.isWord('TRUNCATE')) { this.next(); this.expectWord('TABLE'); return { type: 'truncate', table: this.expectIdent('tabel') }; }
    if (this.isWord('COMMIT')) {
      this.next();
      if (this.isWord('WORK')) this.next();
      if (this.isWord('FORCE')) {
        this.next();
        const id = this.next();
        if (!id || id.type !== 'str') throw new SqlError("COMMIT FORCE wajib diikuti ID transaksi dalam tanda petik, mis. COMMIT FORCE '1.21.17'");
        return { type: 'commit', force: id.value };
      }
      return { type: 'commit', force: null };
    }
    if (this.isWord('ROLLBACK')) {
      this.next();
      if (this.isWord('WORK')) this.next();
      if (this.isWord('FORCE')) {
        this.next();
        const id = this.next();
        if (!id || id.type !== 'str') throw new SqlError("ROLLBACK FORCE wajib diikuti ID transaksi dalam tanda petik, mis. ROLLBACK FORCE '1.21.17'");
        return { type: 'rollback', savepoint: null, force: id.value };
      }
      if (this.isWord('TO')) {
        this.next();
        if (this.isWord('SAVEPOINT')) this.next();
        return { type: 'rollback', savepoint: this.expectIdent('savepoint') };
      }
      return { type: 'rollback', savepoint: null };
    }
    if (this.isWord('SAVEPOINT')) { this.next(); return { type: 'savepoint', nama: this.expectIdent('savepoint') }; }
    if (this.isKw('DESC') || this.isWord('DESCRIBE')) { this.next(); return { type: 'describe', table: this.expectIdent('tabel') }; }
    if (this.isWord('EXPLAIN')) {
      this.next();
      if (this.isWord('PLAN')) { this.next(); this.expectWord('FOR'); }
      return { type: 'explain', query: this.isKw('WITH') ? this.parseWith() : this.parseSetOp() };
    }
    if (this.peek() && this.peek().type === 'ident' && !this.isPunct('(', 1)) {
      throw new SqlError(`Perintah "${this.peek().value}" tidak dikenal. Perintah yang didukung: SELECT, WITH, INSERT, UPDATE, DELETE, CREATE, DROP, TRUNCATE, COMMIT, ROLLBACK, SAVEPOINT, DESC, EXPLAIN PLAN FOR`);
    }
    return this.parseSetOp();
  }

  /** Daftar nama dalam kurung: (a, b, c) */
  parseDaftarNama(apa) {
    this.expectPunct('(');
    const out = [];
    do { out.push(this.expectIdent(apa)); } while (this.isPunct(',') && (this.next(), true));
    this.expectPunct(')');
    return out;
  }

  parseCreate() {
    this.expectWord('CREATE');
    let ganti = false;
    if (this.isKw('OR')) { this.next(); this.expectWord('REPLACE'); ganti = true; }
    if (this.isWord('FORCE')) this.next();
    if (this.isWord('VIEW')) {
      this.next();
      const view = this.expectIdent('view');
      const kolom = this.isPunct('(') ? this.parseDaftarNama('kolom') : null;
      this.expectKw('AS');
      return { type: 'create_view', view, kolom, ganti, query: this.isKw('WITH') ? this.parseWith() : this.parseSetOp() };
    }
    const unik = this.isWord('UNIQUE') ? (this.next(), true) : false;
    if (this.isWord('INDEX')) {
      this.next();
      const indeks = this.expectIdent('indeks');
      this.expectKw('ON');
      const table = this.expectIdent('tabel');
      return { type: 'create_index', indeks, table, kolom: this.parseDaftarNama('kolom'), unik };
    }
    if (ganti || unik) throw new SqlError('OR REPLACE hanya untuk VIEW, UNIQUE hanya untuk INDEX');
    this.expectWord('TABLE');
    const table = this.expectIdent('tabel');
    if (this.isKw('AS')) {
      this.next();
      return { type: 'create_table', table, sebagai: this.isKw('WITH') ? this.parseWith() : this.parseSetOp() };
    }
    this.expectPunct('(');
    const kolom = [];
    const pk = [];
    const fk = [];
    const unikList = [];
    const cek = [];
    const aturanRujukan = (target) => {
      for (;;) {
        if (!this.isKw('ON')) break;
        this.next();
        const peristiwa = this.isKw('DELETE') ? 'onDelete' : this.isKw('UPDATE') ? 'onUpdate' : null;
        if (!peristiwa) throw new SqlError(`Setelah ON diharapkan DELETE atau UPDATE, ditemukan "${this.describe()}"`);
        this.next();
        if (this.isWord('CASCADE')) { this.next(); target[peristiwa] = 'CASCADE'; }
        else if (this.isKw('SET')) { this.next(); this.expectKw('NULL'); target[peristiwa] = 'SET NULL'; }
        else if (this.isWord('RESTRICT')) { this.next(); target[peristiwa] = 'RESTRICT'; }
        else if (this.isWord('NO')) { this.next(); this.expectWord('ACTION'); target[peristiwa] = 'RESTRICT'; }
        else throw new SqlError(`Aturan rujukan tidak dikenal: "${this.describe()}" — gunakan CASCADE, SET NULL, RESTRICT, atau NO ACTION`);
      }
      return target;
    };
    const bacaCek = (nama) => {
      this.expectPunct('(');
      const mulai = this.peek();
      const expr = this.parseExpr();
      const selesai = this.t[this.p - 1];
      this.expectPunct(')');
      return { nama, expr, posisi: mulai && selesai ? [mulai.pos, selesai.end] : null };
    };
    do {
      let namaKendala = null;
      if (this.isWord('CONSTRAINT')) { this.next(); namaKendala = this.expectIdent('kendala'); }
      if (this.isWord('PRIMARY')) {
        this.next(); this.expectWord('KEY');
        if (pk.length) throw new SqlError(`${table}: primary key didefinisikan lebih dari sekali — mirip ORA-02260`);
        pk.push(...this.parseDaftarNama('kolom'));
      } else if (this.isWord('FOREIGN')) {
        this.next(); this.expectWord('KEY');
        const cols = this.parseDaftarNama('kolom');
        this.expectWord('REFERENCES');
        const ref = this.expectIdent('tabel induk');
        const refCols = this.isPunct('(') ? this.parseDaftarNama('kolom') : null;
        fk.push(aturanRujukan({ nama: namaKendala, cols, ref, refCols }));
      } else if (this.isWord('UNIQUE')) {
        this.next();
        unikList.push({ nama: namaKendala, cols: this.parseDaftarNama('kolom') });
      } else if (this.isWord('CHECK')) {
        this.next();
        cek.push(bacaCek(namaKendala));
      } else {
        if (namaKendala) throw new SqlError(`CONSTRAINT ${namaKendala} wajib diikuti PRIMARY KEY, FOREIGN KEY, UNIQUE, atau CHECK`);
        const nama = this.expectIdent('kolom');
        const tipeTok = this.next();
        if (!tipeTok || tipeTok.type !== 'ident') throw new SqlError(`Kolom ${nama}: tipe data wajib ditulis, ditemukan "${tipeTok ? tipeTok.value : 'akhir perintah'}"`);
        const def = { nama, tipe: String(tipeTok.value).toUpperCase(), panjang: null, skala: null, notNull: false, default: null };
        if (this.isPunct('(')) {
          this.next();
          const a = this.next();
          if (!a || a.type !== 'num') throw new SqlError(`Kolom ${nama}: panjang tipe harus angka`);
          def.panjang = a.value;
          if (this.isPunct(',')) { this.next(); const b = this.next(); if (!b || b.type !== 'num') throw new SqlError(`Kolom ${nama}: skala tipe harus angka`); def.skala = b.value; }
          if (this.isWord('BYTE') || this.isWord('CHAR')) this.next();
          this.expectPunct(')');
        }
        for (;;) {
          let namaK = null;
          if (this.isWord('CONSTRAINT')) { this.next(); namaK = this.expectIdent('kendala'); }
          if (this.isWord('PRIMARY')) { this.next(); this.expectWord('KEY'); if (pk.length) throw new SqlError(`${table}: primary key didefinisikan lebih dari sekali — mirip ORA-02260`); pk.push(nama); continue; }
          if (this.isKw('NOT')) { this.next(); this.expectKw('NULL'); def.notNull = true; continue; }
          if (this.isKw('NULL')) { this.next(); continue; }
          if (this.isWord('UNIQUE')) { this.next(); unikList.push({ nama: namaK, cols: [nama] }); continue; }
          if (this.isWord('DEFAULT')) { this.next(); def.default = this.parseAdd(); continue; }
          if (this.isWord('CHECK')) { this.next(); cek.push({ ...bacaCek(namaK), kolom: nama }); continue; }
          if (this.isWord('REFERENCES')) {
            this.next();
            const ref = this.expectIdent('tabel induk');
            const refCols = this.isPunct('(') ? this.parseDaftarNama('kolom') : null;
            fk.push(aturanRujukan({ nama: namaK, cols: [nama], ref, refCols }));
            continue;
          }
          if (namaK) throw new SqlError(`CONSTRAINT ${namaK} pada kolom ${nama} tidak diikuti jenis kendala`);
          break;
        }
        kolom.push(def);
      }
    } while (this.isPunct(',') && (this.next(), true));
    this.expectPunct(')');
    if (kolom.length === 0) throw new SqlError(`${table}: tabel wajib punya minimal satu kolom`);
    return { type: 'create_table', table, kolom, pk, fk, unik: unikList, cek };
  }

  parseDrop() {
    this.expectWord('DROP');
    const jenis = this.isWord('TABLE') ? 'table' : this.isWord('VIEW') ? 'view' : this.isWord('INDEX') ? 'index' : null;
    if (!jenis) throw new SqlError(`DROP wajib diikuti TABLE, VIEW, atau INDEX, ditemukan "${this.describe()}"`);
    this.next();
    const nama = this.expectIdent(jenis === 'table' ? 'tabel' : jenis);
    let kaskade = false;
    if (this.isWord('CASCADE')) { this.next(); if (this.isWord('CONSTRAINTS')) this.next(); kaskade = true; }
    if (this.isWord('PURGE')) this.next();
    return { type: `drop_${jenis}`, nama, kaskade };
  }

  parseWith() {
    this.expectKw('WITH');
    const ctes = [];
    do {
      const name = this.expectIdent('CTE');
      this.expectKw('AS');
      this.expectPunct('(');
      const query = this.parseSetOp();
      this.expectPunct(')');
      ctes.push({ name, query });
    } while (this.isPunct(',') && (this.next(), true));
    const body = this.parseSetOp();
    return { type: 'with', ctes, body };
  }

  parseSetOp() {
    let left = this.parseSelect();
    while (this.isKw('UNION') || this.isKw('INTERSECT') || this.isKw('MINUS') || this.isKw('EXCEPT')) {
      const op = this.next().value;
      const all = op === 'UNION' && this.isKw('ALL') ? (this.next(), true) : false;
      const right = this.parseSelect();
      left = op === 'UNION'
        ? { type: 'union', all, left, right }
        : { type: 'setop', op: op === 'EXCEPT' ? 'MINUS' : op, left, right };
    }
    // ORDER BY / LIMIT yang ditulis setelah cabang terakhir berlaku untuk SELURUH
    // hasil gabungan, bukan hanya cabang kanan.
    if (left.type === 'union' || left.type === 'setop') {
      let kanan = left;
      while (kanan.type === 'union' || kanan.type === 'setop') kanan = kanan.right;
      if (kanan.orderBy.length || kanan.limit !== null) {
        left.orderBy = kanan.orderBy; left.limit = kanan.limit; left.offset = kanan.offset;
        kanan.orderBy = []; kanan.limit = null; kanan.offset = 0;
      }
    }
    return left;
  }

  parseInsert() {
    this.expectKw('INSERT'); this.expectKw('INTO');
    const table = this.expectIdent('tabel');
    let columns = null;
    if (this.isPunct('(') && !this.isKw('SELECT', 1)) {
      this.next();
      columns = [];
      do { columns.push(this.expectIdent('kolom')); } while (this.isPunct(',') && (this.next(), true));
      this.expectPunct(')');
    }
    if (this.isKw('VALUES')) {
      this.next();
      const rows = [];
      do {
        this.expectPunct('(');
        const r = [];
        do { r.push(this.parseExpr()); } while (this.isPunct(',') && (this.next(), true));
        this.expectPunct(')');
        rows.push(r);
      } while (this.isPunct(',') && (this.next(), true));
      return { type: 'insert', table, columns, rows };
    }
    if (this.isKw('SELECT') || this.isPunct('(') || this.isKw('WITH')) {
      return { type: 'insert', table, columns, select: this.isKw('WITH') ? this.parseWith() : this.parseSetOp() };
    }
    throw new SqlError(`INSERT wajib diikuti VALUES atau SELECT, ditemukan "${this.describe()}"`);
  }

  parseUpdate() {
    this.expectKw('UPDATE');
    const table = this.expectIdent('tabel');
    let alias = table;
    if (this.peek() && this.peek().type === 'ident') alias = this.next().value;
    this.expectKw('SET');
    const set = [];
    do {
      let col = this.expectIdent('kolom');
      if (this.isPunct('.')) { this.next(); col = this.expectIdent('kolom'); }
      if (!this.isOp('=')) throw new SqlError(`SET ${col} wajib diikuti "="`);
      this.next();
      set.push({ col, expr: this.parseExpr() });
    } while (this.isPunct(',') && (this.next(), true));
    const where = this.isKw('WHERE') ? (this.next(), this.parseExpr()) : null;
    return { type: 'update', table, alias, set, where };
  }

  parseDelete() {
    this.expectKw('DELETE');
    if (this.isKw('FROM')) this.next();
    const table = this.expectIdent('tabel');
    let alias = table;
    if (this.peek() && this.peek().type === 'ident') alias = this.next().value;
    const where = this.isKw('WHERE') ? (this.next(), this.parseExpr()) : null;
    return { type: 'delete', table, alias, where };
  }

  parseSelect() {
    if (this.isPunct('(')) {
      this.next();
      const inner = this.parseSetOp();
      this.expectPunct(')');
      return inner;
    }
    this.expectKw('SELECT');
    const distinct = this.isKw('DISTINCT') ? (this.next(), true) : false;
    const items = [];
    do {
      if (this.isOp('*') && (this.isPunct(',', 1) || this.isKw('FROM', 1))) { this.next(); items.push({ expr: { k: 'star' }, as: null }); }
      else {
        const e = this.parseExpr();
        let as = null;
        if (this.isKw('AS')) { this.next(); as = this.next().value; }
        else if (this.peek() && this.peek().type === 'ident' && !this.isPunct(',') ) { as = this.next().value; }
        items.push({ expr: e, as });
      }
    } while (this.isPunct(',') && (this.next(), true));

    let from = [];
    let joins = [];
    if (this.isKw('FROM')) {
      this.next();
      from.push(this.parseTableRef());
      while (this.isPunct(',')) { this.next(); from.push(this.parseTableRef()); }
      joins = this.parseJoins();
    }
    const where = this.isKw('WHERE') ? (this.next(), this.parseExpr()) : null;
    let groupBy = [];
    if (this.isKw('GROUP')) { this.next(); this.expectKw('BY'); do { groupBy.push(this.parseExpr()); } while (this.isPunct(',') && (this.next(), true)); }
    const having = this.isKw('HAVING') ? (this.next(), this.parseExpr()) : null;
    const orderBy = [];
    if (this.isKw('ORDER')) {
      this.next(); this.expectKw('BY');
      do {
        const e = this.parseExpr();
        let dir = 'ASC';
        if (this.isKw('ASC')) { this.next(); } else if (this.isKw('DESC')) { this.next(); dir = 'DESC'; }
        orderBy.push({ expr: e, dir });
      } while (this.isPunct(',') && (this.next(), true));
    }
    let limit = null; let offset = 0;
    const angka = (apa) => {
      const x = this.next();
      if (!x || x.type !== 'num') throw new SqlError(`${apa} wajib diikuti angka, ditemukan "${x ? x.value : 'akhir perintah'}"`);
      return Number(x.value);
    };
    if (this.isKw('LIMIT')) {
      this.next(); limit = angka('LIMIT');
      if (this.isKw('OFFSET')) { this.next(); offset = angka('OFFSET'); }
    } else {
      // gaya Oracle 12c+: [OFFSET m ROWS] FETCH FIRST|NEXT n ROWS|ROW ONLY
      if (this.isKw('OFFSET')) {
        this.next(); offset = angka('OFFSET');
        if (this.isWord('ROWS') || this.isWord('ROW')) this.next();
      }
      if (this.isKw('FETCH')) {
        this.next();
        if (this.isWord('FIRST') || this.isWord('NEXT')) this.next();
        else throw new SqlError('FETCH wajib diikuti FIRST atau NEXT');
        limit = angka('FETCH FIRST');
        if (this.isWord('ROWS') || this.isWord('ROW')) this.next();
        else throw new SqlError('FETCH FIRST n wajib diikuti ROWS atau ROW');
        this.expectWord('ONLY');
      }
    }
    return { type: 'select', distinct, items, from, joins, where, groupBy, having, orderBy, limit, offset };
  }

  parseTableRef() {
    if (this.isPunct('(')) {
      this.next();
      const sub = this.parseSetOp();
      this.expectPunct(')');
      let alias = null;
      if (this.isKw('AS')) { this.next(); alias = this.next().value; }
      else if (this.peek() && this.peek().type === 'ident') alias = this.next().value;
      if (!alias) throw new SqlError('Subquery pada FROM wajib punya alias');
      return { sub, alias };
    }
    const tok = this.next();
    if (!tok || tok.type !== 'ident') throw new SqlError(`Nama tabel tidak valid: "${tok ? tok.value : 'akhir perintah'}"`);
    let table = tok.value;
    let alias = null;
    if (this.isKw('AS')) { this.next(); alias = this.next().value; }
    else if (this.peek() && this.peek().type === 'ident') alias = this.next().value;
    return { table, alias: alias || table };
  }

  parseJoins() {
    const joins = [];
    for (;;) {
      let kind = null;
      if (this.isKw('JOIN')) { this.next(); kind = 'INNER'; }
      else if (this.isKw('INNER')) { this.next(); this.expectKw('JOIN'); kind = 'INNER'; }
      else if (this.isKw('CROSS')) { this.next(); this.expectKw('JOIN'); kind = 'CROSS'; }
      else if (this.isKw('LEFT') || this.isKw('RIGHT') || this.isKw('FULL')) {
        kind = this.next().value;
        if (this.isKw('OUTER')) this.next();
        this.expectKw('JOIN');
      } else break;
      const ref = this.parseTableRef();
      let on = null;
      if (this.isKw('ON')) { this.next(); on = this.parseExpr(); }
      else if (kind !== 'CROSS') throw new SqlError(`${kind} JOIN wajib diikuti ON`);
      joins.push({ kind, ref, on });
    }
    return joins;
  }

  // ---- ekspresi: OR < AND < NOT < perbandingan < +- < */ < unary < primary
  parseExpr() { return this.parseOr(); }
  parseOr() {
    let l = this.parseAnd();
    while (this.isKw('OR')) { this.next(); l = { k: 'binop', op: 'OR', l, r: this.parseAnd() }; }
    return l;
  }
  parseAnd() {
    let l = this.parseNot();
    while (this.isKw('AND')) { this.next(); l = { k: 'binop', op: 'AND', l, r: this.parseNot() }; }
    return l;
  }
  parseNot() {
    if (this.isKw('NOT')) { this.next(); return { k: 'unop', op: 'NOT', e: this.parseNot() }; }
    return this.parseCompare();
  }
  parseCompare() {
    let l = this.parseAdd();
    for (;;) {
      if (this.peek() && this.peek().type === 'op' && ['=', '<>', '!=', '<', '>', '<=', '>='].includes(this.peek().value)) {
        const op = this.next().value;
        l = { k: 'binop', op: op === '!=' ? '<>' : op, l, r: this.parseAdd() };
        continue;
      }
      let negated = false;
      if (this.isKw('NOT') && (this.isKw('BETWEEN', 1) || this.isKw('IN', 1) || this.isKw('LIKE', 1))) { this.next(); negated = true; }
      if (this.isKw('BETWEEN')) {
        this.next();
        const lo = this.parseAdd();
        if (!this.isKw('AND')) throw new SqlError('BETWEEN wajib diikuti AND');
        this.next();
        const hi = this.parseAdd();
        l = { k: 'between', e: l, lo, hi, not: negated };
        continue;
      }
      if (this.isKw('LIKE')) { this.next(); l = { k: 'like', e: l, pat: this.parseAdd(), not: negated }; continue; }
      if (this.isKw('IN')) {
        this.next(); this.expectPunct('(');
        if (this.isKw('SELECT') || this.isPunct('(')) {
          const sub = this.parseSetOp(); this.expectPunct(')');
          l = { k: 'in', e: l, sub, not: negated };
        } else {
          const list = [];
          do { list.push(this.parseExpr()); } while (this.isPunct(',') && (this.next(), true));
          this.expectPunct(')');
          l = { k: 'in', e: l, list, not: negated };
        }
        continue;
      }
      if (this.isKw('IS')) {
        this.next();
        const not = this.isKw('NOT') ? (this.next(), true) : false;
        this.expectKw('NULL');
        l = { k: 'isnull', e: l, not };
        continue;
      }
      break;
    }
    return l;
  }
  parseAdd() {
    let l = this.parseMul();
    while (this.peek() && this.peek().type === 'op' && ['+', '-', '||'].includes(this.peek().value)) {
      const op = this.next().value;
      l = { k: 'binop', op, l, r: this.parseMul() };
    }
    return l;
  }
  parseMul() {
    let l = this.parseUnary();
    while (this.peek() && this.peek().type === 'op' && ['*', '/', '%'].includes(this.peek().value)) {
      const op = this.next().value;
      l = { k: 'binop', op, l, r: this.parseUnary() };
    }
    return l;
  }
  parseUnary() {
    if (this.isOp('-')) { this.next(); return { k: 'unop', op: '-', e: this.parseUnary() }; }
    if (this.isOp('+')) { this.next(); return this.parseUnary(); }
    return this.parsePrimary();
  }
  parsePrimary() {
    const tok = this.peek();
    if (!tok) throw new SqlError('Ekspresi terpotong di akhir perintah');
    if (tok.type === 'num') { this.next(); return { k: 'num', v: tok.value }; }
    if (tok.type === 'str') { this.next(); return { k: 'str', v: tok.value }; }
    if (this.isKw('NULL')) { this.next(); return { k: 'null' }; }
    if (this.isKw('CASE')) return this.parseCase();
    if (this.isKw('EXISTS')) {
      this.next(); this.expectPunct('(');
      const sub = this.parseSetOp();
      this.expectPunct(')');
      return { k: 'exists', sub };
    }
    if (this.isPunct('(')) {
      this.next();
      if (this.isKw('SELECT')) { const sub = this.parseSetOp(); this.expectPunct(')'); return { k: 'scalarsub', sub }; }
      const e = this.parseExpr();
      this.expectPunct(')');
      return e;
    }
    // literal tanggal ANSI/Oracle: DATE '2025-09-01', TIMESTAMP '2025-09-01 08:00:00'
    if (tok.type === 'ident' && !tok.quoted && ['DATE', 'TIMESTAMP'].includes(String(tok.value).toUpperCase()) && this.peek(1) && this.peek(1).type === 'str') {
      this.next();
      return { k: 'str', v: this.next().value };
    }
    if (tok.type === 'ident') {
      this.next();
      if (this.isPunct('(')) {
        this.next();
        const name = tok.value.toUpperCase();
        const args = [];
        let distinct = false;
        if (this.isKw('DISTINCT')) { this.next(); distinct = true; }
        if (this.isOp('*')) { this.next(); args.push({ k: 'star' }); }
        else if (!this.isPunct(')')) { do { args.push(this.parseExpr()); } while (this.isPunct(',') && (this.next(), true)); }
        this.expectPunct(')');
        if (A.AGG_FNS.includes(name)) return { k: 'agg', fn: name, arg: args[0] || { k: 'star' }, distinct };
        return { k: 'func', name, args };
      }
      if (this.isPunct('.')) {
        this.next();
        if (this.isOp('*')) { this.next(); return { k: 'star', table: tok.value }; }
        const col = this.next();
        return { k: 'col', table: tok.value, name: col.value };
      }
      return { k: 'col', table: null, name: tok.value };
    }
    if (this.isOp('*')) { this.next(); return { k: 'star' }; }
    throw new SqlError(`Token tidak terduga dalam ekspresi: "${tok.value}"`);
  }

  /** CASE WHEN c THEN v ... [ELSE v] END  atau  CASE x WHEN v THEN r ... END */
  parseCase() {
    this.expectKw('CASE');
    if (this.isKw('END') || this.isKw('ELSE')) throw new SqlError('CASE wajib punya minimal satu WHEN');
    const subjek = this.isKw('WHEN') ? null : this.parseExpr();
    const cabang = [];
    while (this.isKw('WHEN')) {
      this.next();
      const kapan = this.parseExpr();
      this.expectKw('THEN');
      cabang.push({ kapan, maka: this.parseExpr() });
    }
    if (cabang.length === 0) throw new SqlError('CASE wajib punya minimal satu WHEN');
    const lain = this.isKw('ELSE') ? (this.next(), this.parseExpr()) : null;
    this.expectKw('END');
    return { k: 'case', subjek, cabang, lain };
  }
}

export function parse(sql) { return new Parser(tokenize(sql)).parseStatement(); }

/** Uraikan beberapa perintah yang dipisah titik koma. */
export function parseScript(sql) { return new Parser(tokenize(sql)).parseScript(); }

/** Uraikan satu ekspresi lepas, mis. isi CHECK atau DEFAULT yang tersimpan. */
export function parseExpression(sql) {
  const p = new Parser(tokenize(sql));
  const e = p.parseExpr();
  if (!p.done) throw new SqlError(`Token sisa setelah ekspresi: "${p.describe()}"`);
  return e;
}

// --------------------------------------------------------------- eksekutor

/**
 * Jalankan query terhadap basis data (peta nama -> Relation).
 * @returns {{relation: Relation, plan: object, steps: string[]}}
 */
export function execute(sql, db, opts = {}) {
  const ast = typeof sql === 'string' ? parse(sql) : sql;
  if (['insert', 'update', 'delete'].includes(ast.type)) {
    throw new SqlError(`${ast.type.toUpperCase()} mengubah data — jalankan lewat executeScript() pada engine/core/dml.js`);
  }
  if (!['select', 'union', 'setop', 'with'].includes(ast.type)) {
    throw new SqlError(`${String(ast.type).replace('_', ' ').toUpperCase()} adalah perintah sesi — jalankan lewat terminal (engine/core/terminal.js)`);
  }
  const ctx = { db: normalizeDb(db), steps: [], plan: null };
  const rel = evalNode(ast, ctx, opts);
  return { relation: rel, plan: ctx.plan, steps: ctx.steps };
}

/** Jalankan dan langsung kembalikan Relation (helper untuk uji). */
export function query(sql, db, opts = {}) { return execute(sql, db, opts).relation; }

export function normalizeDb(db) {
  const out = {};
  for (const [k, v] of Object.entries(db)) out[k.toLowerCase()] = v instanceof Relation ? v : Relation.fromJSON(v);
  return out;
}

export function evalNode(node, ctx, opts) {
  if (node.type === 'with') {
    const db = { ...ctx.db };
    const plan = { op: 'WITH', detail: node.ctes.map((c) => c.name).join(', '), children: [] };
    for (const c of node.ctes) {
      const hasil = stripQualify(evalNode(c.query, { ...ctx, db, plan: null }, opts));
      db[c.name.toLowerCase()] = new Relation(c.name, hasil.attrs, hasil.rows);
      plan.children.push({ op: `CTE ${c.name}`, rows: hasil.cardinality });
    }
    const sub = { ...ctx, db, plan: null };
    const out = evalNode(node.body, sub, opts);
    plan.children.push(sub.plan);
    plan.rows = out.cardinality;
    ctx.plan = plan;
    return out;
  }
  if (node.type === 'setop') {
    const L = stripQualify(evalNode(node.left, ctx, opts));
    const R = stripQualify(evalNode(node.right, ctx, opts));
    if (L.degree !== R.degree) throw new SqlError(`${node.op}: jumlah kolom berbeda — kiri ${L.degree}, kanan ${R.degree}`);
    const R2 = new Relation(R.name, L.attrs, R.rows);
    let out = node.op === 'INTERSECT' ? A.intersect(L, R2, 'INTERSECT') : A.difference(L, R2, 'MINUS');
    out = urutkanGabungan(out, node, ctx);
    ctx.plan = { op: node.op, rows: out.cardinality, children: [ctx.plan] };
    return out;
  }
  if (node.type === 'union') {
    const L = stripQualify(evalNode(node.left, ctx, opts));
    const R = stripQualify(evalNode(node.right, ctx, opts));
    // SQL memadankan UNION berdasarkan POSISI kolom, bukan nama: nama kolom hasil
    // diambil dari cabang kiri (perilaku Oracle/MySQL).
    if (L.degree !== R.degree) {
      throw new SqlError(`UNION: jumlah kolom berbeda — kiri ${L.degree}, kanan ${R.degree}`);
    }
    const R2 = new Relation(R.name, L.attrs, R.rows);
    let out = node.all ? A.unionAll(L, R2, 'UNION') : A.union(L, R2, 'UNION');
    out = urutkanGabungan(out, node, ctx);
    ctx.plan = { op: node.all ? 'UNION ALL' : 'UNION', rows: out.cardinality, children: [ctx.plan] };
    return out;
  }
  return evalSelect(node, ctx, opts);
}

/** ORDER BY / LIMIT pada hasil gabungan: kunci urut dicari menurut nama kolom hasil atau nomor posisi. */
function urutkanGabungan(out, node, ctx) {
  let hasil = out;
  if (node.orderBy && node.orderBy.length) {
    const keys = node.orderBy.map((o) => {
      if (o.expr.k === 'num') {
        const a = hasil.attrs[o.expr.v - 1];
        if (!a) throw new SqlError(`ORDER BY ${o.expr.v}: hasil hanya punya ${hasil.degree} kolom`);
        return { attr: a, dir: o.dir };
      }
      if (o.expr.k === 'col') {
        const i = hasil.indexOf(o.expr.name);
        if (i >= 0) return { attr: hasil.attrs[i], dir: o.dir };
      }
      throw new SqlError(`ORDER BY pada ${node.type === 'union' ? 'UNION' : node.op} hanya boleh memakai nama kolom hasil atau nomor posisi, bukan "${exprToString(o.expr)}"`);
    });
    hasil = A.orderBy(hasil, keys);
  }
  if (node.limit !== null && node.limit !== undefined) hasil = A.limit(hasil, node.limit, node.offset || 0);
  void ctx;
  return hasil;
}

function stripQualify(R) {
  const seen = new Set();
  const attrs = R.attrs.map((a) => {
    const b = a.split('.').pop();
    if (seen.has(b)) return a;
    seen.add(b);
    return b;
  });
  return new Relation(R.name, attrs, R.rows);
}

/**
 * Setelah GROUP BY hanya kolom pengelompokan dan hasil agregat yang tersisa.
 * Kolom lain yang dirujuk memang ada di tabel sumber — pesannya harus menjelaskan
 * aturan GROUP BY (ORA-00979), bukan mengatakan kolomnya tidak ada.
 */
function bukanGroupBy(dikelompokkan, sumber, fn, adaGroupBy = true) {
  try {
    return fn();
  } catch (e) {
    const m = dikelompokkan && /Kolom "([^"]+)" tidak ada/.exec(e.message);
    if (m) {
      const nama = m[1].toLowerCase();
      const ada = sumber.attrs.some((a) => a.toLowerCase() === nama || a.toLowerCase().endsWith(`.${nama}`));
      if (ada && !adaGroupBy) throw new SqlError(`ORA-00937: ${m[1]} dipakai bersama fungsi agregat tanpa GROUP BY — bukan fungsi kelompok tunggal; tambahkan GROUP BY ${m[1]} atau bungkus kolom itu dengan fungsi agregat`);
      if (ada) throw new SqlError(`ORA-00979: ${m[1]} bukan ekspresi GROUP BY — setiap kolom di SELECT/HAVING wajib ikut GROUP BY atau dibungkus fungsi agregat (COUNT, SUM, AVG, MIN, MAX)`);
    }
    throw e;
  }
}

// ------------------------------------------------------ validasi semantik statis
// Oracle memeriksa nama kolom, ambiguitas, fungsi, dan aturan GROUP BY saat PARSE,
// sehingga galatnya muncul walau tabel tidak berisi satu baris pun. Mesin ini
// mengevaluasi baris demi baris; tanpa pemeriksaan ini galat tersebut lolos diam-diam
// pada tabel kosong (ditemukan saat verifikasi silang terhadap Oracle sungguhan).

const sudahDiperiksa = new WeakMap();

const pesanGroupBy = (nama, adaGroupBy) => (adaGroupBy
  ? `ORA-00979: ${nama} bukan ekspresi GROUP BY — setiap kolom di SELECT/HAVING wajib ikut GROUP BY atau dibungkus fungsi agregat (COUNT, SUM, AVG, MIN, MAX)`
  : `ORA-00937: ${nama} dipakai bersama fungsi agregat tanpa GROUP BY — bukan fungsi kelompok tunggal; tambahkan GROUP BY ${nama} atau bungkus kolom itu dengan fungsi agregat`);

function cocokkanKolom(e, attrs) {
  if (e.table) {
    const want = `${e.table}.${e.name}`.toLowerCase();
    return attrs.filter((a) => a.toLowerCase() === want);
  }
  const nama = String(e.name).toLowerCase();
  return attrs.filter((a) => a.split('.').pop().toLowerCase() === nama);
}

function atributSumber(ref, ctx, opts) {
  let attrs;
  if (ref.sub) attrs = evalNode(ref.sub, { ...ctx, plan: null }, opts).attrs;
  else {
    const r = ctx.db[String(ref.table).toLowerCase()];
    if (r) attrs = r.attrs;
    else if (String(ref.table).toLowerCase() === 'dual') attrs = ['dummy'];
    else throw new SqlError(`ORA-00942: Tabel "${ref.table}" tidak ada. Tersedia: ${Object.keys(ctx.db).join(', ')}`);
  }
  const alias = ref.alias || ref.table || 'sub';
  return attrs.map((a) => `${alias}.${a.split('.').pop()}`);
}

const ANAK_EKSPRESI = ['l', 'r', 'e', 'lo', 'hi', 'pat', 'arg', 'subjek', 'lain'];
function anakEkspresi(e) {
  const out = ANAK_EKSPRESI.filter((k) => e[k]).map((k) => e[k]);
  if (e.args) out.push(...e.args);
  if (e.list) out.push(...e.list);
  if (e.cabang) e.cabang.forEach((c) => out.push(c.kapan, c.maka));
  return out;
}

function larangAgregat(e, tempat) {
  if (!e || typeof e !== 'object' || e.k === 'scalarsub' || e.k === 'exists') return;
  if (e.k === 'agg') throw new SqlError(`ORA-00934: fungsi agregat ${e.fn} tidak boleh dipakai di ${tempat} — saring hasil agregasi dengan HAVING`);
  if (e.k === 'in' && e.sub) { larangAgregat(e.e, tempat); return; }
  anakEkspresi(e).forEach((a) => larangAgregat(a, tempat));
}

/**
 * Periksa satu ekspresi terhadap cakupan nama kolom — cakupan[0] kueri sendiri,
 * sisanya kueri luar dari yang terdekat (subquery berkorelasi).
 */
export function periksaEkspresiStatis(e, cakupan, ctx, opts = {}, aliasPilih = null) {
  if (!e || typeof e !== 'object') return;
  switch (e.k) {
    case 'col': {
      if (!e.table && aliasPilih && aliasPilih.has(String(e.name).toLowerCase())) return;
      for (const attrs of cakupan) {
        const m = cocokkanKolom(e, attrs);
        if (m.length > 1 && !e.table) throw new SqlError(`ORA-00918: Kolom "${e.name}" ambigu (ada di ${m.join(', ')}). Pakai nama berkualifikasi.`);
        if (m.length) return;
      }
      const want = e.table ? `${e.table}.${e.name}` : e.name;
      throw new SqlError(`ORA-00904: Kolom "${want}" tidak ada. Tersedia: ${(cakupan[0] || []).filter((k) => !k.startsWith('__')).join(', ')}`);
    }
    case 'star':
      if (e.table && !(cakupan[0] || []).some((a) => a.toLowerCase().startsWith(`${String(e.table).toLowerCase()}.`))) {
        throw new SqlError(`ORA-00904: "${e.table}.*" — alias ${e.table} tidak ada pada FROM`);
      }
      return;
    case 'func':
      if (!SCALAR[e.name]) throw new SqlError(`ORA-00904: Fungsi "${e.name}" tidak didukung. Tersedia: ${Object.keys(SCALAR).join(', ')}`);
      e.args.forEach((a) => periksaEkspresiStatis(a, cakupan, ctx, opts, aliasPilih));
      return;
    case 'in':
      periksaEkspresiStatis(e.e, cakupan, ctx, opts, aliasPilih);
      if (e.list) e.list.forEach((x) => periksaEkspresiStatis(x, cakupan, ctx, opts, aliasPilih));
      else periksaKueriStatis(e.sub, ctx, opts, cakupan);
      return;
    case 'exists': case 'scalarsub':
      periksaKueriStatis(e.sub, ctx, opts, cakupan);
      return;
    default:
      anakEkspresi(e).forEach((a) => periksaEkspresiStatis(a, cakupan, ctx, opts, aliasPilih));
  }
}

function periksaGroupByStatis(q, attrs, aliasPilih) {
  const adaGroupBy = q.groupBy.length > 0;
  if (!adaGroupBy && collectAggs(q).length === 0) return;
  const teksGrup = new Set(q.groupBy.map((g) => exprToString(g).toLowerCase()));
  const attrGrup = new Set(q.groupBy.filter((g) => g.k === 'col').flatMap((g) => cocokkanKolom(g, attrs)));
  const cek = (e, bolehAlias) => {
    if (!e || typeof e !== 'object' || e.k === 'agg' || e.k === 'scalarsub' || e.k === 'exists') return;
    if (teksGrup.has(exprToString(e).toLowerCase())) return;
    if (e.k === 'col') {
      if (bolehAlias && !e.table && aliasPilih.has(String(e.name).toLowerCase())) return;
      const m = cocokkanKolom(e, attrs);
      if (!m.length || m.some((a) => attrGrup.has(a))) return; // kolom kueri luar tetap konstan per grup
      throw new SqlError(pesanGroupBy(e.table ? `${e.table}.${e.name}` : e.name, adaGroupBy));
    }
    if (e.k === 'star') throw new SqlError(pesanGroupBy('*', adaGroupBy));
    if (e.k === 'in' && e.sub) { cek(e.e, bolehAlias); return; }
    anakEkspresi(e).forEach((a) => cek(a, bolehAlias));
  };
  q.items.forEach((it) => cek(it.expr, false));
  if (q.having) cek(q.having, false);
  q.orderBy.forEach((o) => cek(o.expr, true));
}

/** Validasi semantik satu kueri (dan subquery-nya) sebelum dieksekusi. */
export function periksaKueriStatis(node, ctx, opts = {}, luar = []) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'union' || node.type === 'setop') {
    periksaKueriStatis(node.left, ctx, opts, luar);
    periksaKueriStatis(node.right, ctx, opts, luar);
    return;
  }
  if (node.type !== 'select') return; // WITH diperiksa saat badannya dievaluasi bersama CTE-nya
  if (sudahDiperiksa.get(node) === ctx.db) return;
  const refs = [...node.from, ...node.joins.map((j) => j.ref)];
  const attrs = refs.length ? refs.flatMap((r) => atributSumber(r, ctx, opts)) : ['dummy'];
  const cakupan = [attrs, ...luar];
  const aliasPilih = new Set(node.items.filter((it) => it.as).map((it) => String(it.as).toLowerCase()));
  node.items.forEach((it) => periksaEkspresiStatis(it.expr, cakupan, ctx, opts));
  node.joins.forEach((j) => { if (j.on) { larangAgregat(j.on, 'ON'); periksaEkspresiStatis(j.on, cakupan, ctx, opts); } });
  if (node.where) { larangAgregat(node.where, 'WHERE'); periksaEkspresiStatis(node.where, cakupan, ctx, opts); }
  node.groupBy.forEach((g) => { larangAgregat(g, 'GROUP BY'); periksaEkspresiStatis(g, cakupan, ctx, opts); });
  if (node.having) periksaEkspresiStatis(node.having, cakupan, ctx, opts);
  node.orderBy.forEach((o) => periksaEkspresiStatis(o.expr, cakupan, ctx, opts, aliasPilih));
  periksaGroupByStatis(node, attrs, aliasPilih);
  sudahDiperiksa.set(node, ctx.db);
}

function evalSelect(q, ctx, opts) {
  const plan = { op: 'SELECT', children: [] };
  periksaKueriStatis(q, ctx, opts, (ctx.luar || []).map((r) => Object.keys(r)));

  // 1. FROM + JOIN -> satu relasi kerja dengan atribut berkualifikasi alias.kolom
  let work = buildFrom(q, ctx, opts, plan);

  // 2. WHERE
  if (q.where) {
    const before = work.cardinality;
    work = A.select(work, (row) => truthy(evalExpr(q.where, row, ctx, opts)));
    plan.children.push({ op: 'FILTER (WHERE)', detail: exprToString(q.where), rowsIn: before, rows: work.cardinality });
  }

  // 3. GROUP BY / agregasi
  const aggs = collectAggs(q);
  let grouped = work;
  let aggAliases = new Map();
  if (q.groupBy.length > 0 || aggs.length > 0) {
    const gAttrs = q.groupBy.map((g) => resolveAttr(work, g));
    const specs = aggs.map((a, i) => ({ fn: a.fn, arg: a.arg, distinct: a.distinct, as: `__agg${i}` }));
    grouped = groupWithExpr(work, gAttrs, specs, ctx, opts);
    aggs.forEach((a, i) => aggAliases.set(aggKey(a), `__agg${i}`));
    plan.children.push({ op: 'AGGREGATE', detail: `GROUP BY [${gAttrs.join(', ')}] ${specs.map((s) => `${s.fn}`).join(', ')}`, rows: grouped.cardinality });
  }

  // 4. HAVING
  if (q.having) {
    const before = grouped.cardinality;
    grouped = bukanGroupBy(grouped !== work, work, () => A.select(grouped, (row) => truthy(evalExpr(q.having, row, ctx, opts, aggAliases))), q.groupBy.length > 0);
    plan.children.push({ op: 'FILTER (HAVING)', detail: exprToString(q.having), rowsIn: before, rows: grouped.cardinality });
  }

  // 5. SELECT list (proyeksi + ekspresi turunan)
  let out = bukanGroupBy(grouped !== work, work, () => projectList(grouped, q, ctx, opts, aggAliases), q.groupBy.length > 0);

  // SQL mengizinkan ORDER BY atas kolom yang TIDAK ikut diproyeksikan. Kolom
  // seperti itu dibawa sebagai kolom bantu tersembunyi, dipakai untuk mengurutkan,
  // lalu dibuang lagi sebelum hasil dikembalikan.
  const bantu = q.orderBy.filter((o) => !dapatDiurutkanDariHasil(o.expr, out, q));
  if (bantu.length) {
    if (q.distinct) {
      throw new SqlError(`ORDER BY ${exprToString(bantu[0].expr)}: dengan DISTINCT, kolom pengurut wajib ada pada daftar SELECT`);
    }
    out = projectList(grouped, q, ctx, opts, aggAliases, bantu.map((o, i) => ({ expr: o.expr, as: `__ord${i}` })));
  }
  plan.children.push({ op: 'PROJECT', detail: out.attrs.filter((a) => !a.startsWith('__ord')).join(', '), rows: out.cardinality });

  // 6. DISTINCT
  if (q.distinct) { const b = out.cardinality; out = out.distinct(); plan.children.push({ op: 'DISTINCT', rowsIn: b, rows: out.cardinality }); }

  // 7. ORDER BY
  if (q.orderBy.length) {
    const keys = q.orderBy.map((o) => {
      const i = bantu.indexOf(o);
      return { attr: i >= 0 ? `__ord${i}` : orderKeyAttr(o.expr, out, q), dir: o.dir };
    });
    out = A.orderBy(out, keys);
    plan.children.push({ op: 'SORT', detail: q.orderBy.map((o) => `${exprToString(o.expr)} ${o.dir}`).join(', ') });
    if (bantu.length) out = A.project(out, out.attrs.filter((a) => !a.startsWith('__ord')), true);
  }

  // 8. LIMIT
  if (q.limit !== null && q.limit !== undefined) {
    out = A.limit(out, q.limit, q.offset || 0);
    plan.children.push({ op: 'LIMIT', detail: `${q.limit}${q.offset ? ` OFFSET ${q.offset}` : ''}`, rows: out.cardinality });
  }

  plan.rows = out.cardinality;
  ctx.plan = plan;
  return out;
}

function buildFrom(q, ctx, opts, plan) {
  if (q.from.length === 0) return new Relation('DUAL', ['dummy'], [[null]]);
  let work = loadRef(q.from[0], ctx, opts);
  plan.children.push({ op: 'SCAN', detail: refName(q.from[0]), rows: work.cardinality });
  for (let i = 1; i < q.from.length; i++) {
    const nxt = loadRef(q.from[i], ctx, opts);
    plan.children.push({ op: 'SCAN', detail: refName(q.from[i]), rows: nxt.cardinality });
    work = crossJoin(work, nxt);
    plan.children.push({ op: 'CARTESIAN PRODUCT', rows: work.cardinality });
  }
  for (const j of q.joins) {
    const nxt = loadRef(j.ref, ctx, opts);
    plan.children.push({ op: 'SCAN', detail: refName(j.ref), rows: nxt.cardinality });
    work = applyJoin(work, nxt, j, ctx, opts);
    plan.children.push({ op: `${j.kind} JOIN`, detail: j.on ? exprToString(j.on) : '(cross)', rows: work.cardinality });
  }
  return work;
}

function refName(ref) { return ref.table ? (ref.alias && ref.alias !== ref.table ? `${ref.table} ${ref.alias}` : ref.table) : `(subquery) ${ref.alias}`; }

function loadRef(ref, ctx, opts) {
  let base;
  if (ref.sub) base = evalNode(ref.sub, { ...ctx, plan: null }, opts);
  else {
    const r = ctx.db[String(ref.table).toLowerCase()];
    if (r) base = r;
    // DUAL: tabel satu baris bawaan Oracle, dipakai untuk SELECT ekspresi tanpa tabel
    else if (String(ref.table).toLowerCase() === 'dual') base = new Relation('DUAL', ['dummy'], [['X']]);
    else throw new SqlError(`ORA-00942: Tabel "${ref.table}" tidak ada. Tersedia: ${Object.keys(ctx.db).join(', ')}`);
  }
  const alias = ref.alias || ref.table || 'sub';
  return new Relation(alias, base.attrs.map((a) => `${alias}.${a.split('.').pop()}`), base.rows);
}

function crossJoin(R, S) {
  const rows = [];
  for (const r of R.rows) for (const s of S.rows) rows.push([...r, ...s]);
  return new Relation(`${R.name}x${S.name}`, [...R.attrs, ...S.attrs], rows);
}

function applyJoin(R, S, j, ctx, opts) {
  if (j.kind === 'CROSS') return crossJoin(R, S);
  const attrs = [...R.attrs, ...S.attrs];
  const mk = (rrow, srow) => {
    const o = {};
    attrs.forEach((a, i) => { o[a] = [...rrow, ...srow][i]; });
    return o;
  };
  const nullS = S.attrs.map(() => null);
  const nullR = R.attrs.map(() => null);
  const rows = [];
  const sMatched = new Set();
  for (const r of R.rows) {
    let matched = false;
    for (let si = 0; si < S.rows.length; si++) {
      const s = S.rows[si];
      const env = new Relation('t', attrs, [[...r, ...s]]);
      if (truthy(evalExpr(j.on, env.obj(0), ctx, opts))) { rows.push([...r, ...s]); matched = true; sMatched.add(si); }
    }
    if (!matched && (j.kind === 'LEFT' || j.kind === 'FULL')) rows.push([...r, ...nullS]);
  }
  if (j.kind === 'RIGHT' || j.kind === 'FULL') {
    for (let si = 0; si < S.rows.length; si++) if (!sMatched.has(si)) rows.push([...nullR, ...S.rows[si]]);
  }
  void mk;
  return new Relation(`${R.name}_${j.kind}_${S.name}`, attrs, rows);
}

function collectAggs(q) {
  const found = [];
  const walk = (e) => {
    if (!e || typeof e !== 'object') return;
    if (e.k === 'agg') { if (!found.some((f) => aggKey(f) === aggKey(e))) found.push(e); return; }
    for (const key of ['l', 'r', 'e', 'lo', 'hi', 'pat', 'arg', 'subjek', 'lain']) if (e[key]) walk(e[key]);
    if (e.args) e.args.forEach(walk);
    if (e.list) e.list.forEach(walk);
    if (e.cabang) e.cabang.forEach((c) => { walk(c.kapan); walk(c.maka); });
  };
  q.items.forEach((it) => walk(it.expr));
  if (q.having) walk(q.having);
  q.orderBy.forEach((o) => walk(o.expr));
  return found;
}

function aggKey(a) { return `${a.fn}|${a.distinct ? 'D' : ''}|${exprToString(a.arg)}`; }

function groupWithExpr(work, gAttrs, specs, ctx, opts) {
  const gIdx = gAttrs.map((a) => {
    const i = work.indexOf(a);
    if (i < 0) throw new SqlError(`GROUP BY: kolom "${a}" tidak ada`);
    return i;
  });
  const buckets = new Map();
  const order = [];
  for (let i = 0; i < work.rows.length; i++) {
    const k = JSON.stringify(gIdx.map((j) => work.rows[i][j]));
    if (!buckets.has(k)) { buckets.set(k, []); order.push(k); }
    buckets.get(k).push(i);
  }
  if (gAttrs.length === 0) { order.length = 0; order.push('[]'); buckets.set('[]', work.rows.map((_, i) => i)); }
  const attrs = [...gAttrs, ...specs.map((s) => s.as)];
  const rows = order.map((k) => {
    const idxs = buckets.get(k);
    const head = gIdx.map((j) => (idxs.length ? work.rows[idxs[0]][j] : null));
    const vals = specs.map((s) => {
      let vs = idxs.map((i) => (s.arg.k === 'star' ? 1 : evalExpr(s.arg, work.obj(i), ctx, opts)));
      if (s.distinct) {
        const seen = new Set(); const uniq = [];
        for (const v of vs) { const kk = JSON.stringify(v); if (!seen.has(kk)) { seen.add(kk); uniq.push(v); } }
        vs = uniq;
      }
      return A.aggregate(s.fn, vs);
    });
    return [...head, ...vals];
  });
  return new Relation(work.name, attrs, rows);
}

function projectList(R, q, ctx, opts, aggAliases, tambahan = []) {
  const outAttrs = [];
  const getters = [];
  for (const item of [...q.items, ...tambahan]) {
    if (item.expr.k === 'star') {
      const want = item.expr.table
        ? R.attrs.filter((a) => a.split('.')[0].toLowerCase() === String(item.expr.table).toLowerCase())
        : R.attrs.filter((a) => !a.startsWith('__agg'));
      if (item.expr.table && want.length === 0) throw new SqlError(`Alias "${item.expr.table}" tidak ada pada FROM`);
      for (const a of want) { outAttrs.push(uniqueName(outAttrs, a.split('.').pop())); const idx = R.attrs.indexOf(a); getters.push((row, i) => R.rows[i][idx]); }
      continue;
    }
    const name = item.as || defaultName(item.expr);
    outAttrs.push(uniqueName(outAttrs, name));
    getters.push((row) => evalExpr(item.expr, row, ctx, opts, aggAliases));
  }
  const rows = R.rows.map((_, i) => getters.map((g) => g(R.obj(i), i)));
  return new Relation('hasil', outAttrs, rows);
}

function uniqueName(list, n) {
  if (!list.includes(n)) return n;
  let i = 2;
  while (list.includes(`${n}_${i}`)) i++;
  return `${n}_${i}`;
}

function defaultName(e) {
  if (e.k === 'col') return e.name;
  if (e.k === 'agg') return `${e.fn}(${e.arg.k === 'star' ? '*' : exprToString(e.arg)})`;
  if (e.k === 'func') return `${e.name}(${e.args.map(exprToString).join(', ')})`;
  return exprToString(e);
}

/** Apakah ekspresi ORDER BY sudah tersedia pada relasi hasil proyeksi? */
function dapatDiurutkanDariHasil(e, out, q) {
  try { orderKeyAttr(e, out, q); return true; } catch { return false; }
}

function orderKeyAttr(e, out, q) {
  if (e.k === 'col') {
    const direct = out.indexOf(e.name);
    if (direct >= 0) return out.attrs[direct];
  }
  const alias = q.items.find((it) => it.as && exprToString(it.expr) === exprToString(e));
  if (alias) return alias.as;
  const byText = out.attrs.find((a) => a === defaultName(e));
  if (byText) return byText;
  throw new SqlError(`ORDER BY: kolom "${exprToString(e)}" tidak ada pada hasil SELECT`);
}

function resolveAttr(R, e) {
  if (e.k !== 'col') throw new SqlError(`GROUP BY hanya menerima nama kolom, bukan "${exprToString(e)}"`);
  const want = e.table ? `${e.table}.${e.name}` : e.name;
  const i = R.indexOf(want);
  if (i < 0) throw new SqlError(`ORA-00904: Kolom "${want}" tidak ada. Tersedia: ${R.attrs.join(', ')}`);
  return R.attrs[i];
}

// --------------------------------------------------------- evaluasi ekspresi

export function evalExpr(e, row, ctx, opts = {}, aggAliases = null) {
  switch (e.k) {
    case 'num': return e.v;
    case 'str': return e.v;
    case 'null': return null;
    case 'col': return lookupColBerkorelasi(e, row, ctx);
    case 'agg': {
      if (!aggAliases) throw new SqlError(`Fungsi agregasi ${e.fn} tidak boleh dipakai di sini`);
      const a = aggAliases.get(aggKey(e));
      if (a === undefined) throw new SqlError(`Agregasi ${e.fn} tidak terdaftar pada perencana`);
      return row[a];
    }
    case 'unop':
      if (e.op === 'NOT') { const v = evalExpr(e.e, row, ctx, opts, aggAliases); return v === null ? null : !truthy(v); }
      return -Number(evalExpr(e.e, row, ctx, opts, aggAliases));
    case 'binop': return evalBin(e, row, ctx, opts, aggAliases);
    case 'between': {
      const v = evalExpr(e.e, row, ctx, opts, aggAliases);
      const lo = evalExpr(e.lo, row, ctx, opts, aggAliases);
      const hi = evalExpr(e.hi, row, ctx, opts, aggAliases);
      if (v === null) return null;
      const r = A.compareValues(v, lo) >= 0 && A.compareValues(v, hi) <= 0;
      return e.not ? !r : r;
    }
    case 'like': {
      const v = evalExpr(e.e, row, ctx, opts, aggAliases);
      const p = evalExpr(e.pat, row, ctx, opts, aggAliases);
      if (v === null || p === null) return null;
      const r = likeMatch(String(v), String(p));
      return e.not ? !r : r;
    }
    case 'isnull': {
      const v = evalExpr(e.e, row, ctx, opts, aggAliases);
      const isN = v === null || v === undefined;
      return e.not ? !isN : isN;
    }
    case 'in': {
      const v = evalExpr(e.e, row, ctx, opts, aggAliases);
      let vals;
      if (e.list) vals = e.list.map((x) => evalExpr(x, row, ctx, opts, aggAliases));
      else {
        const sub = evalNode(e.sub, konteksSub(row, ctx), opts);
        if (sub.degree !== 1) throw new SqlError('Subquery pada IN harus mengembalikan tepat satu kolom');
        vals = sub.rows.map((r) => r[0]);
      }
      const r = vals.some((x) => A.compareValues(x, v) === 0);
      return e.not ? !r : r;
    }
    case 'scalarsub': {
      const sub = evalNode(e.sub, konteksSub(row, ctx), opts);
      if (sub.cardinality === 0) return null;
      if (sub.cardinality > 1) throw new SqlError('Subquery skalar mengembalikan lebih dari satu baris');
      return sub.rows[0][0];
    }
    case 'exists': return evalNode(e.sub, konteksSub(row, ctx), opts).cardinality > 0;
    case 'case': {
      if (e.subjek) {
        const v = evalExpr(e.subjek, row, ctx, opts, aggAliases);
        for (const c of e.cabang) {
          const w = evalExpr(c.kapan, row, ctx, opts, aggAliases);
          if (v !== null && w !== null && A.compareValues(v, w) === 0) return evalExpr(c.maka, row, ctx, opts, aggAliases);
        }
      } else {
        for (const c of e.cabang) {
          if (truthy(evalExpr(c.kapan, row, ctx, opts, aggAliases))) return evalExpr(c.maka, row, ctx, opts, aggAliases);
        }
      }
      return e.lain ? evalExpr(e.lain, row, ctx, opts, aggAliases) : null;
    }
    case 'func': return callFunc(e, row, ctx, opts, aggAliases);
    case 'star': return 1;
    default: throw new SqlError(`Ekspresi tidak dikenal: ${e.k}`);
  }
}

/** Konteks untuk subquery: baris kueri luar disimpan agar subquery boleh berkorelasi. */
function konteksSub(row, ctx) {
  return { ...ctx, plan: null, luar: [row, ...(ctx.luar || [])] };
}

/** Cari kolom pada satu baris. Mengembalikan {ada, nilai}; melempar bila ambigu. */
function cariKolom(e, row) {
  const want = e.table ? `${e.table}.${e.name}` : e.name;
  if (want in row) return { ada: true, nilai: row[want] };
  const keys = Object.keys(row);
  const lower = want.toLowerCase();
  const exact = keys.find((k) => k.toLowerCase() === lower);
  if (exact) return { ada: true, nilai: row[exact] };
  if (!e.table) {
    const matches = keys.filter((k) => k.split('.').pop().toLowerCase() === e.name.toLowerCase());
    if (matches.length === 1) return { ada: true, nilai: row[matches[0]] };
    if (matches.length > 1) throw new SqlError(`ORA-00918: Kolom "${e.name}" ambigu (ada di ${matches.join(', ')}). Pakai nama berkualifikasi.`);
  }
  return { ada: false };
}

/**
 * Kolom dicari di baris sendiri lebih dulu, lalu di baris kueri luar dari yang
 * terdekat — aturan cakupan subquery berkorelasi pada SQL standar.
 */
function lookupColBerkorelasi(e, row, ctx) {
  const sendiri = cariKolom(e, row);
  if (sendiri.ada) return sendiri.nilai;
  for (const luar of (ctx && ctx.luar) || []) {
    const r = cariKolom(e, luar);
    if (r.ada) return r.nilai;
  }
  const want = e.table ? `${e.table}.${e.name}` : e.name;
  throw new SqlError(`ORA-00904: Kolom "${want}" tidak ada. Tersedia: ${Object.keys(row).filter((k) => !k.startsWith('__')).join(', ')}`);
}

function evalBin(e, row, ctx, opts, aggAliases) {
  const { op } = e;
  if (op === 'AND') {
    const l = evalExpr(e.l, row, ctx, opts, aggAliases);
    if (l !== null && !truthy(l)) return false;
    const r = evalExpr(e.r, row, ctx, opts, aggAliases);
    if (l === null || r === null) return (l !== null && !truthy(l)) || (r !== null && !truthy(r)) ? false : null;
    return truthy(l) && truthy(r);
  }
  if (op === 'OR') {
    const l = evalExpr(e.l, row, ctx, opts, aggAliases);
    if (l !== null && truthy(l)) return true;
    const r = evalExpr(e.r, row, ctx, opts, aggAliases);
    if (l === null || r === null) return (l !== null && truthy(l)) || (r !== null && truthy(r)) ? true : null;
    return truthy(l) || truthy(r);
  }
  const l = evalExpr(e.l, row, ctx, opts, aggAliases);
  const r = evalExpr(e.r, row, ctx, opts, aggAliases);
  if (op === '||') return (l === null ? '' : String(l)) + (r === null ? '' : String(r));
  if (l === null || r === null) return null;
  switch (op) {
    case '=': return A.compareValues(l, r) === 0;
    case '<>': return A.compareValues(l, r) !== 0;
    case '<': return A.compareValues(l, r) < 0;
    case '>': return A.compareValues(l, r) > 0;
    case '<=': return A.compareValues(l, r) <= 0;
    case '>=': return A.compareValues(l, r) >= 0;
    case '+': return Number(l) + Number(r);
    case '-': return Number(l) - Number(r);
    case '*': return Number(l) * Number(r);
    case '/': return Number(r) === 0 ? null : Number(l) / Number(r);
    case '%': return Number(r) === 0 ? null : Number(l) % Number(r);
    default: throw new SqlError(`Operator "${op}" tidak didukung`);
  }
}

const SCALAR = {
  UPPER: (s) => (s === null ? null : String(s).toUpperCase()),
  LOWER: (s) => (s === null ? null : String(s).toLowerCase()),
  LENGTH: (s) => (s === null ? null : String(s).length),
  LEN: (s) => (s === null ? null : String(s).length),
  TRIM: (s) => (s === null ? null : String(s).trim()),
  ABS: (n) => (n === null ? null : Math.abs(Number(n))),
  ROUND: (n, d = 0) => (n === null ? null : Number(Number(n).toFixed(Number(d)))),
  CEIL: (n) => (n === null ? null : Math.ceil(Number(n))),
  FLOOR: (n) => (n === null ? null : Math.floor(Number(n))),
  SUBSTR: (s, a, b) => (s === null ? null : String(s).substr(Number(a) - 1, b === undefined ? undefined : Number(b))),
  CONCAT: (...xs) => xs.map((x) => (x === null ? '' : String(x))).join(''),
  COALESCE: (...xs) => { for (const x of xs) if (x !== null && x !== undefined) return x; return null; },
  NVL: (a, b) => (a === null || a === undefined ? b : a),
  YEAR: (d) => (d === null ? null : Number(String(d).slice(0, 4))),
  MONTH: (d) => (d === null ? null : Number(String(d).slice(5, 7))),
  IFNULL: (a, b) => (a === null || a === undefined ? b : a),
  SUBSTRING: (s, a, b) => (s === null ? null : String(s).substr(Number(a) - 1, b === undefined ? undefined : Number(b))),
  INITCAP: (s) => (s === null ? null : String(s).toLowerCase().replace(/(^|[^a-z0-9])([a-z])/g, (m, a, b) => a + b.toUpperCase())),
  LTRIM: (s) => (s === null ? null : String(s).replace(/^\s+/, '')),
  RTRIM: (s) => (s === null ? null : String(s).replace(/\s+$/, '')),
  INSTR: (s, cari) => (s === null || cari === null ? null : String(s).indexOf(String(cari)) + 1),
  REPLACE: (s, a, b = '') => (s === null ? null : String(s).split(String(a)).join(b === null ? '' : String(b))),
  LPAD: (s, n, isi = ' ') => (s === null ? null : String(s).padStart(Number(n), String(isi)).slice(0, Number(n))),
  RPAD: (s, n, isi = ' ') => (s === null ? null : String(s).padEnd(Number(n), String(isi)).slice(0, Number(n))),
  MOD: (a, b) => (a === null || b === null ? null : Number(b) === 0 ? Number(a) : Number(a) % Number(b)),
  POWER: (a, b) => (a === null || b === null ? null : Math.pow(Number(a), Number(b))),
  SQRT: (a) => (a === null ? null : Math.sqrt(Number(a))),
  SIGN: (a) => (a === null ? null : Math.sign(Number(a))),
  TRUNC: (n, d = 0) => (n === null ? null : Math.trunc(Number(n) * 10 ** Number(d)) / 10 ** Number(d)),
  GREATEST: (...xs) => (xs.some((x) => x === null) ? null : xs.reduce((a, b) => (A.compareValues(a, b) >= 0 ? a : b))),
  LEAST: (...xs) => (xs.some((x) => x === null) ? null : xs.reduce((a, b) => (A.compareValues(a, b) <= 0 ? a : b))),
  TO_NUMBER: (s) => (s === null ? null : Number(s)),
  TO_CHAR: (x) => (x === null ? null : String(x)),
  // DECODE(ekspr, cari1, hasil1, ..., [lainnya]) — gaya Oracle; NULL dianggap sama dengan NULL
  DECODE: (v, ...pasangan) => {
    for (let i = 0; i + 1 < pasangan.length; i += 2) {
      const cari = pasangan[i];
      if ((v === null && cari === null) || (v !== null && cari !== null && A.compareValues(v, cari) === 0)) return pasangan[i + 1];
    }
    return pasangan.length % 2 === 1 ? pasangan[pasangan.length - 1] : null;
  },
};

function callFunc(e, row, ctx, opts, aggAliases) {
  const f = SCALAR[e.name];
  if (!f) throw new SqlError(`ORA-00904: Fungsi "${e.name}" tidak didukung. Tersedia: ${Object.keys(SCALAR).join(', ')}`);
  return f(...e.args.map((a) => evalExpr(a, row, ctx, opts, aggAliases)));
}

export function likeMatch(value, pattern) {
  let rx = '';
  for (const ch of pattern) {
    if (ch === '%') rx += '[\\s\\S]*';
    else if (ch === '_') rx += '[\\s\\S]';
    else rx += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${rx}$`, 'i').test(value);
}

export function truthy(v) { return v === true || v === 1 || v === '1'; }

// -------------------------------------------------------------- utilitas cetak

export function exprToString(e) {
  if (!e) return '';
  switch (e.k) {
    case 'num': return String(e.v);
    case 'str': return `'${e.v}'`;
    case 'null': return 'NULL';
    case 'col': return e.table ? `${e.table}.${e.name}` : e.name;
    case 'star': return e.table ? `${e.table}.*` : '*';
    case 'agg': return `${e.fn}(${e.distinct ? 'DISTINCT ' : ''}${e.arg.k === 'star' ? '*' : exprToString(e.arg)})`;
    case 'func': return `${e.name}(${e.args.map(exprToString).join(', ')})`;
    case 'unop': return e.op === 'NOT' ? `NOT ${exprToString(e.e)}` : `-${exprToString(e.e)}`;
    case 'binop': return `(${exprToString(e.l)} ${e.op} ${exprToString(e.r)})`;
    case 'between': return `${exprToString(e.e)}${e.not ? ' NOT' : ''} BETWEEN ${exprToString(e.lo)} AND ${exprToString(e.hi)}`;
    case 'like': return `${exprToString(e.e)}${e.not ? ' NOT' : ''} LIKE ${exprToString(e.pat)}`;
    case 'isnull': return `${exprToString(e.e)} IS${e.not ? ' NOT' : ''} NULL`;
    case 'in': return `${exprToString(e.e)}${e.not ? ' NOT' : ''} IN (${e.list ? e.list.map(exprToString).join(', ') : 'SELECT ...'})`;
    case 'scalarsub': return '(SELECT ...)';
    case 'exists': return 'EXISTS (SELECT ...)';
    case 'case': return `CASE${e.subjek ? ` ${exprToString(e.subjek)}` : ''} ${e.cabang.map((c) => `WHEN ${exprToString(c.kapan)} THEN ${exprToString(c.maka)}`).join(' ')}${e.lain ? ` ELSE ${exprToString(e.lain)}` : ''} END`;
    default: return '?';
  }
}

/** Render rencana eksekusi sebagai teks berjenjang (mirip EXPLAIN PLAN). */
export function planToText(plan, depth = 0) {
  if (!plan) return '';
  const pad = '  '.repeat(depth);
  const rows = plan.rows !== undefined ? `  [baris=${plan.rows}]` : '';
  const det = plan.detail ? `: ${plan.detail}` : '';
  let s = `${pad}${plan.op}${det}${rows}\n`;
  for (const c of plan.children || []) if (c) s += planToText(c, depth + 1);
  return s;
}
