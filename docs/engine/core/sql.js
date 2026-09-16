// sql.js — tokenizer, parser, perencana, dan eksekutor untuk subset SQL SELECT.
// Cakupan dipilih agar persis menutup Praktikum 2-5 dan contoh-contoh di modul:
//   SELECT [DISTINCT] ... FROM ... [JOIN|LEFT|RIGHT|FULL] ... ON ...
//   WHERE (=, <>, !=, <, >, <=, >=, BETWEEN, LIKE, IN, IS NULL, NOT, AND, OR)
//   GROUP BY ... HAVING ... ORDER BY ... ASC|DESC  LIMIT n
//   COUNT/SUM/AVG/MIN/MAX, UNION [ALL], subquery pada IN dan pada FROM.
// Nol dependensi.

import { Relation } from './relation.js?v=76a896ebe2';
import * as A from './algebra.js?v=76a896ebe2';

const KEYWORDS = new Set([
  'SELECT', 'DISTINCT', 'FROM', 'WHERE', 'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC',
  'LIMIT', 'OFFSET', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'ON', 'AS',
  'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'BETWEEN', 'LIKE', 'UNION', 'ALL', 'EXISTS', 'CROSS',
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
      t.push({ type: 'str', value: v }); i = j + 1; continue;
    }
    if (c === '"') {
      let j = i + 1; let v = '';
      while (j < s.length && s[j] !== '"') { v += s[j]; j++; }
      if (j >= s.length) throw new SqlError('Identifier tidak ditutup tanda kutip ganda');
      t.push({ type: 'ident', value: v, quoted: true }); i = j + 1; continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
      let j = i; let v = '';
      while (j < s.length && /[0-9.]/.test(s[j])) { v += s[j]; j++; }
      t.push({ type: 'num', value: Number(v) }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; let v = '';
      while (j < s.length && /[A-Za-z0-9_$]/.test(s[j])) { v += s[j]; j++; }
      const up = v.toUpperCase();
      t.push(KEYWORDS.has(up) ? { type: 'kw', value: up } : { type: 'ident', value: v });
      i = j; continue;
    }
    const two = s.slice(i, i + 2);
    if (['<>', '<=', '>=', '!=', '||'].includes(two)) { t.push({ type: 'op', value: two }); i += 2; continue; }
    if ('=<>+-*/%'.includes(c)) { t.push({ type: 'op', value: c }); i++; continue; }
    if ('(),.;'.includes(c)) { t.push({ type: 'punct', value: c }); i++; continue; }
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

  parseStatement() {
    const q = this.parseSetOp();
    while (this.isPunct(';')) this.next();
    if (!this.done) throw new SqlError(`Token sisa setelah perintah: "${this.describe()}"`);
    return q;
  }

  parseSetOp() {
    let left = this.parseSelect();
    while (this.isKw('UNION')) {
      this.next();
      const all = this.isKw('ALL') ? (this.next(), true) : false;
      const right = this.parseSelect();
      left = { type: 'union', all, left, right };
    }
    return left;
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
    if (this.isKw('LIMIT')) { this.next(); limit = Number(this.next().value); if (this.isKw('OFFSET')) { this.next(); offset = Number(this.next().value); } }
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
    if (this.isPunct('(')) {
      this.next();
      if (this.isKw('SELECT')) { const sub = this.parseSetOp(); this.expectPunct(')'); return { k: 'scalarsub', sub }; }
      const e = this.parseExpr();
      this.expectPunct(')');
      return e;
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
}

export function parse(sql) { return new Parser(tokenize(sql)).parseStatement(); }

// --------------------------------------------------------------- eksekutor

/**
 * Jalankan query terhadap basis data (peta nama -> Relation).
 * @returns {{relation: Relation, plan: object, steps: string[]}}
 */
export function execute(sql, db, opts = {}) {
  const ast = typeof sql === 'string' ? parse(sql) : sql;
  const ctx = { db: normalizeDb(db), steps: [], plan: null };
  const rel = evalNode(ast, ctx, opts);
  return { relation: rel, plan: ctx.plan, steps: ctx.steps };
}

/** Jalankan dan langsung kembalikan Relation (helper untuk uji). */
export function query(sql, db, opts = {}) { return execute(sql, db, opts).relation; }

function normalizeDb(db) {
  const out = {};
  for (const [k, v] of Object.entries(db)) out[k.toLowerCase()] = v instanceof Relation ? v : Relation.fromJSON(v);
  return out;
}

function evalNode(node, ctx, opts) {
  if (node.type === 'union') {
    const L = stripQualify(evalNode(node.left, ctx, opts));
    const R = stripQualify(evalNode(node.right, ctx, opts));
    // SQL memadankan UNION berdasarkan POSISI kolom, bukan nama: nama kolom hasil
    // diambil dari cabang kiri (perilaku Oracle/MySQL).
    if (L.degree !== R.degree) {
      throw new SqlError(`UNION: jumlah kolom berbeda — kiri ${L.degree}, kanan ${R.degree}`);
    }
    const R2 = new Relation(R.name, L.attrs, R.rows);
    const out = node.all ? A.unionAll(L, R2, 'UNION') : A.union(L, R2, 'UNION');
    ctx.plan = { op: node.all ? 'UNION ALL' : 'UNION', rows: out.cardinality, children: [ctx.plan] };
    return out;
  }
  return evalSelect(node, ctx, opts);
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

function evalSelect(q, ctx, opts) {
  const plan = { op: 'SELECT', children: [] };

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
    grouped = A.select(grouped, (row) => truthy(evalExpr(q.having, row, ctx, opts, aggAliases)));
    plan.children.push({ op: 'FILTER (HAVING)', detail: exprToString(q.having), rowsIn: before, rows: grouped.cardinality });
  }

  // 5. SELECT list (proyeksi + ekspresi turunan)
  let out = projectList(grouped, q, ctx, opts, aggAliases);

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
    if (!r) throw new SqlError(`Tabel "${ref.table}" tidak ada. Tersedia: ${Object.keys(ctx.db).join(', ')}`);
    base = r;
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
    for (const key of ['l', 'r', 'e', 'lo', 'hi', 'pat', 'arg']) if (e[key]) walk(e[key]);
    if (e.args) e.args.forEach(walk);
    if (e.list) e.list.forEach(walk);
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
  if (i < 0) throw new SqlError(`Kolom "${want}" tidak ada. Tersedia: ${R.attrs.join(', ')}`);
  return R.attrs[i];
}

// --------------------------------------------------------- evaluasi ekspresi

export function evalExpr(e, row, ctx, opts = {}, aggAliases = null) {
  switch (e.k) {
    case 'num': return e.v;
    case 'str': return e.v;
    case 'null': return null;
    case 'col': return lookupCol(e, row);
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
        const sub = evalNode(e.sub, { ...ctx, plan: null }, opts);
        if (sub.degree !== 1) throw new SqlError('Subquery pada IN harus mengembalikan tepat satu kolom');
        vals = sub.rows.map((r) => r[0]);
      }
      const r = vals.some((x) => A.compareValues(x, v) === 0);
      return e.not ? !r : r;
    }
    case 'scalarsub': {
      const sub = evalNode(e.sub, { ...ctx, plan: null }, opts);
      if (sub.cardinality === 0) return null;
      return sub.rows[0][0];
    }
    case 'func': return callFunc(e, row, ctx, opts, aggAliases);
    case 'star': return 1;
    default: throw new SqlError(`Ekspresi tidak dikenal: ${e.k}`);
  }
}

function lookupCol(e, row) {
  const want = e.table ? `${e.table}.${e.name}` : e.name;
  if (want in row) return row[want];
  const keys = Object.keys(row);
  const lower = want.toLowerCase();
  const exact = keys.find((k) => k.toLowerCase() === lower);
  if (exact) return row[exact];
  if (!e.table) {
    const matches = keys.filter((k) => k.split('.').pop().toLowerCase() === e.name.toLowerCase());
    if (matches.length === 1) return row[matches[0]];
    if (matches.length > 1) throw new SqlError(`Kolom "${e.name}" ambigu (ada di ${matches.join(', ')}). Pakai nama berkualifikasi.`);
  }
  throw new SqlError(`Kolom "${want}" tidak ada. Tersedia: ${keys.filter((k) => !k.startsWith('__')).join(', ')}`);
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
};

function callFunc(e, row, ctx, opts, aggAliases) {
  const f = SCALAR[e.name];
  if (!f) throw new SqlError(`Fungsi "${e.name}" tidak didukung. Tersedia: ${Object.keys(SCALAR).join(', ')}`);
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
