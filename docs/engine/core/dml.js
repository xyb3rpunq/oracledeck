// dml.js — INSERT, UPDATE, DELETE, dan eksekusi skrip beberapa perintah.
// Menutup poin "k) Update" dan "l) Delete" pada lembar Praktikum 2, termasuk
// pilihan CASCADE pada relasi yang diminta lembar itu.
//
// Batasan integritas ditegakkan bila `kunci` diberikan:
//   primary key : wajib terisi dan unik
//   foreign key : nilai wajib ada di tabel induk (NULL boleh)
//   ON DELETE   : CASCADE (anak ikut terhapus), SET NULL, atau RESTRICT (ditolak)
//   ON UPDATE   : CASCADE atau RESTRICT
//   kolom       : NOT NULL, tipe data & panjang (NUMBER(p,s), VARCHAR2(n), DATE), DEFAULT
//   unik        : UNIQUE pada satu atau beberapa kolom (NULL tidak dianggap bentrok)
//   cek         : CHECK (ekspresi) — dilanggar hanya bila hasilnya FALSE, bukan NULL
// Pelanggaran membatalkan SELURUH perintah — tidak ada perubahan setengah jalan.
// Kode galat mengikuti Oracle agar pesan di sini dapat dicari di dokumentasi resminya.

import { Relation, canon } from './relation.js?v=849b085103';
import { parseScript, evalNode, evalExpr, normalizeDb, truthy, SqlError, exprToString } from './sql.js?v=849b085103';

const TIPE_ANGKA = new Set(['NUMBER', 'NUMERIC', 'DECIMAL', 'DEC', 'INTEGER', 'INT', 'SMALLINT', 'FLOAT', 'REAL', 'DOUBLE', 'BINARY_FLOAT', 'BINARY_DOUBLE']);
const TIPE_TEKS = new Set(['VARCHAR2', 'VARCHAR', 'NVARCHAR2', 'CHAR', 'NCHAR', 'TEXT', 'CLOB', 'NCLOB', 'STRING']);
const TIPE_TANGGAL = new Set(['DATE', 'TIMESTAMP']);

/** Temukan kunci asli pada peta db tanpa peduli huruf besar-kecil. */
function kunciDb(db, nama) {
  const k = Object.keys(db).find((x) => x.toLowerCase() === String(nama).toLowerCase());
  if (!k) throw new SqlError(`Tabel "${nama}" tidak ada. Tersedia: ${Object.keys(db).join(', ')}`);
  return k;
}

function definisiKunci(kunci, tabel) {
  if (!kunci) return null;
  const k = Object.keys(kunci).find((x) => x.toLowerCase() === String(tabel).toLowerCase());
  return k ? kunci[k] : null;
}

const sama = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const kunciBaris = (rel, row, kolom) => JSON.stringify(kolom.map((c) => canon(row[rel.indexOf(c)])));

/** Objek baris dengan nama berkualifikasi alias.kolom maupun nama polos. */
function objekBaris(rel, row, alias) {
  const o = {};
  rel.attrs.forEach((a, i) => { o[`${alias}.${a}`] = row[i]; });
  return o;
}

// ------------------------------------------------------------- pemeriksaan

function periksaPk(rel, def, rows) {
  if (!def || !def.pk || !def.pk.length) return;
  const lihat = new Map();
  for (const r of rows) {
    const nilai = def.pk.map((c) => r[rel.indexOf(c)]);
    if (nilai.some((v) => v === null || v === undefined)) {
      throw new SqlError(`${rel.name}: primary key (${def.pk.join(', ')}) tidak boleh NULL — mirip ORA-01400`);
    }
    const k = JSON.stringify(nilai.map(canon));
    if (lihat.has(k)) {
      throw new SqlError(`${rel.name}: primary key ${def.pk.join(', ')} = ${nilai.join(', ')} sudah ada — pelanggaran unik, mirip ORA-00001`);
    }
    lihat.set(k, true);
  }
}

/**
 * Periksa dan normalkan nilai per kolom: NOT NULL, tipe, panjang, presisi.
 * Mengembalikan baris baru (nilai hasil konversi implisit, mis. '12' -> 12 pada NUMBER).
 */
export function periksaKolom(rel, def, rows) {
  if (!def || !def.kolom || !def.kolom.length) return rows;
  const aturan = def.kolom.map((k) => ({ ...k, i: rel.indexOf(k.nama) })).filter((k) => k.i >= 0);
  return rows.map((row) => {
    const out = row.slice();
    for (const k of aturan) {
      let v = out[k.i];
      if (v === '') v = null; // Oracle memperlakukan string kosong sebagai NULL
      if (v === null || v === undefined) {
        if (k.notNull) throw new SqlError(`ORA-01400: tidak dapat menyisipkan NULL ke ${rel.name}.${k.nama}`);
        out[k.i] = null;
        continue;
      }
      const tipe = String(k.tipe || '').toUpperCase();
      if (TIPE_ANGKA.has(tipe)) {
        const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : NaN);
        if (Number.isNaN(n) || typeof v === 'boolean') throw new SqlError(`ORA-01722: bilangan tidak valid — "${v}" untuk kolom ${rel.name}.${k.nama} bertipe ${tipe}`);
        let nilai = n;
        const skala = ['INTEGER', 'INT', 'SMALLINT'].includes(tipe) ? 0 : k.skala;
        if (skala !== null && skala !== undefined) nilai = Math.round(nilai * 10 ** skala) / 10 ** skala;
        if (k.panjang !== null && k.panjang !== undefined && tipe !== 'FLOAT') {
          const digitBulat = Math.trunc(Math.abs(nilai)).toString().replace(/^0$/, '').length;
          if (digitBulat > k.panjang - (skala || 0)) {
            throw new SqlError(`ORA-01438: nilai ${v} melebihi presisi ${tipe}(${k.panjang}${k.skala !== null && k.skala !== undefined ? `,${k.skala}` : ''}) pada ${rel.name}.${k.nama}`);
          }
        }
        out[k.i] = nilai;
      } else if (TIPE_TEKS.has(tipe)) {
        const t = String(v);
        if (k.panjang !== null && k.panjang !== undefined && t.length > k.panjang) {
          throw new SqlError(`ORA-12899: nilai terlalu besar untuk ${rel.name}.${k.nama} (sebenarnya: ${t.length}, maksimum: ${k.panjang})`);
        }
        out[k.i] = t;
      } else if (TIPE_TANGGAL.has(tipe)) {
        const t = String(v);
        if (!/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?$/.test(t) || Number.isNaN(Date.parse(t.slice(0, 10)))) {
          throw new SqlError(`ORA-01861: literal "${t}" tidak cocok dengan format tanggal YYYY-MM-DD pada ${rel.name}.${k.nama}`);
        }
        out[k.i] = t;
      }
    }
    return out;
  });
}

function periksaUnik(rel, def, rows) {
  if (!def || !def.unik) return;
  for (const u of def.unik) {
    const lihat = new Set();
    for (const r of rows) {
      const nilai = u.cols.map((c) => r[rel.indexOf(c)]);
      if (nilai.every((v) => v === null || v === undefined)) continue;
      const k = JSON.stringify(nilai.map(canon));
      if (lihat.has(k)) {
        throw new SqlError(`ORA-00001: kendala unik${u.nama ? ` ${u.nama}` : ''} dilanggar — ${rel.name}(${u.cols.join(', ')}) = ${nilai.join(', ')} sudah ada`);
      }
      lihat.add(k);
    }
  }
}

function periksaCek(rel, def, rows, opts) {
  if (!def || !def.cek || !def.cek.length) return;
  for (const r of rows) {
    const o = objekBaris(rel, r, rel.name);
    for (const c of def.cek) {
      const v = evalExpr(c.expr, o, { db: {}, steps: [], plan: null }, opts);
      if (v === false || v === 0) {
        throw new SqlError(`ORA-02290: kendala CHECK${c.nama ? ` ${c.nama}` : ''} dilanggar — ${exprToString(c.expr)} bernilai FALSE untuk baris (${r.map((v) => (v === null || v === undefined ? 'NULL' : v)).join(', ')})`);
      }
    }
  }
}

function periksaFk(db, rel, def, rows) {
  if (!def || !def.fk) return;
  for (const fk of def.fk) {
    const induk = db[kunciDb(db, fk.ref)];
    const ada = new Set(induk.rows.map((r) => kunciBaris(induk, r, fk.refCols)));
    for (const r of rows) {
      const nilai = fk.cols.map((c) => r[rel.indexOf(c)]);
      if (nilai.some((v) => v === null || v === undefined)) continue;
      if (!ada.has(JSON.stringify(nilai.map(canon)))) {
        throw new SqlError(`${rel.name}: ${fk.cols.join(', ')} = ${nilai.join(', ')} tidak ada di ${fk.ref}(${fk.refCols.join(', ')}) — foreign key dilanggar, mirip ORA-02291`);
      }
    }
  }
}

/** Semua foreign key milik tabel lain yang merujuk tabel ini. */
function rujukanKe(kunci, tabel) {
  const out = [];
  if (!kunci) return out;
  for (const [anak, def] of Object.entries(kunci)) {
    for (const fk of def.fk || []) {
      if (String(fk.ref).toLowerCase() === String(tabel).toLowerCase()) out.push({ anak, fk });
    }
  }
  return out;
}

// ---------------------------------------------------------------- INSERT

function jalankanInsert(ast, db, opts) {
  const nama = kunciDb(db, ast.table);
  const rel = db[nama];
  const kolom = ast.columns || rel.attrs;
  for (const c of kolom) if (rel.indexOf(c) < 0) throw new SqlError(`INSERT: kolom "${c}" tidak ada di ${rel.name}`);

  let sumber;
  if (ast.rows) {
    sumber = ast.rows.map((exprs) => {
      if (exprs.length !== kolom.length) throw new SqlError(`INSERT: ${exprs.length} nilai untuk ${kolom.length} kolom`);
      return exprs.map((e) => evalExpr(e, {}, { db: normalizeDb(db) }, opts));
    });
  } else {
    const hasil = evalNode(ast.select, { db: normalizeDb(db), steps: [], plan: null }, opts);
    if (hasil.degree !== kolom.length) throw new SqlError(`INSERT ... SELECT: ${hasil.degree} kolom untuk ${kolom.length} kolom tujuan`);
    sumber = hasil.rows;
  }

  const def = definisiKunci(opts.kunci, nama);
  const bawaan = new Map((def && def.kolom ? def.kolom : []).filter((k) => k.default).map((k) => [rel.indexOf(k.nama), k.default]));
  let baru = sumber.map((nilai) => {
    const row = rel.attrs.map((_, i) => (bawaan.has(i) ? evalExpr(bawaan.get(i), {}, { db: {} }, opts) : null));
    kolom.forEach((c, i) => { row[rel.indexOf(c)] = nilai[i] === undefined ? null : nilai[i]; });
    return row;
  });
  baru = periksaKolom(rel, def, baru);
  const semua = [...rel.rows, ...baru];
  const hasilRel = new Relation(rel.name, rel.attrs, semua);
  periksaPk(hasilRel, def, semua);
  periksaUnik(hasilRel, def, semua);
  periksaCek(hasilRel, def, baru, opts);
  periksaFk(db, hasilRel, def, baru);
  return { perubahan: { [nama]: hasilRel }, terdampak: baru.length, kaskade: [] };
}

// ---------------------------------------------------------------- UPDATE

function jalankanUpdate(ast, db, opts) {
  const nama = kunciDb(db, ast.table);
  const rel = db[nama];
  for (const s of ast.set) if (rel.indexOf(s.col) < 0) throw new SqlError(`UPDATE: kolom "${s.col}" tidak ada di ${rel.name}`);
  const ctx = { db: normalizeDb(db), steps: [], plan: null };
  const def = definisiKunci(opts.kunci, nama);
  const lama = [];
  const rows = rel.rows.map((row) => {
    const o = objekBaris(rel, row, ast.alias);
    if (ast.where && !truthy(evalExpr(ast.where, o, ctx, opts))) return row;
    let baru = row.slice();
    // seluruh ruas kanan dihitung dari nilai LAMA, sesuai SQL standar
    for (const s of ast.set) baru[rel.indexOf(s.col)] = evalExpr(s.expr, o, ctx, opts);
    [baru] = periksaKolom(rel, def, [baru]);
    lama.push({ sebelum: row, sesudah: baru });
    return baru;
  });

  const hasilRel = new Relation(rel.name, rel.attrs, rows);
  periksaPk(hasilRel, def, rows);
  periksaUnik(hasilRel, def, rows);
  periksaCek(hasilRel, def, lama.map((x) => x.sesudah), opts);
  periksaFk(db, hasilRel, def, lama.map((x) => x.sesudah));

  const perubahan = { [nama]: hasilRel };
  const kaskade = [];
  const pk = def && def.pk;
  if (pk && lama.some((x) => pk.some((c) => !sama(x.sebelum[rel.indexOf(c)], x.sesudah[rel.indexOf(c)])))) {
    for (const { anak, fk } of rujukanKe(opts.kunci, nama)) {
      const namaAnak = kunciDb(db, anak);
      const relAnak = perubahan[namaAnak] || db[namaAnak];
      let diubah = 0;
      const rowsAnak = relAnak.rows.map((r) => {
        const cocok = lama.find((x) => fk.cols.every((c, i) => sama(r[relAnak.indexOf(c)], x.sebelum[rel.indexOf(fk.refCols[i])]))
          && fk.refCols.some((c) => !sama(x.sebelum[rel.indexOf(c)], x.sesudah[rel.indexOf(c)])));
        if (!cocok) return r;
        if ((fk.onUpdate || 'RESTRICT').toUpperCase() !== 'CASCADE') {
          throw new SqlError(`UPDATE ${rel.name}: masih dirujuk ${relAnak.name}.${fk.cols.join(', ')} — mirip ORA-02292`);
        }
        const baru = r.slice();
        fk.cols.forEach((c, i) => { baru[relAnak.indexOf(c)] = cocok.sesudah[rel.indexOf(fk.refCols[i])]; });
        diubah++;
        return baru;
      });
      if (diubah) {
        perubahan[namaAnak] = new Relation(relAnak.name, relAnak.attrs, rowsAnak);
        kaskade.push({ tabel: relAnak.name, aksi: 'ON UPDATE CASCADE', baris: diubah });
      }
    }
  }
  return { perubahan, terdampak: lama.length, kaskade };
}

// ---------------------------------------------------------------- DELETE

function jalankanDelete(ast, db, opts) {
  const nama = kunciDb(db, ast.table);
  const rel = db[nama];
  const ctx = { db: normalizeDb(db), steps: [], plan: null };
  const dihapus = [];
  const sisa = [];
  for (const row of rel.rows) {
    const o = objekBaris(rel, row, ast.alias);
    if (!ast.where || truthy(evalExpr(ast.where, o, ctx, opts))) dihapus.push(row);
    else sisa.push(row);
  }
  const perubahan = { [nama]: new Relation(rel.name, rel.attrs, sisa) };
  const kaskade = [];
  hapusAnak(db, opts.kunci, nama, rel, dihapus, perubahan, kaskade, 0);
  return { perubahan, terdampak: dihapus.length, kaskade };
}

/** Terapkan aturan ON DELETE ke semua tabel yang merujuk baris yang dihapus — rekursif. */
function hapusAnak(db, kunci, nama, rel, dihapus, perubahan, kaskade, kedalaman) {
  if (!dihapus.length || kedalaman > 16) return;
  for (const { anak, fk } of rujukanKe(kunci, nama)) {
    const namaAnak = kunciDb(db, anak);
    const relAnak = perubahan[namaAnak] || db[namaAnak];
    const kunciHapus = new Set(dihapus.map((r) => kunciBaris(rel, r, fk.refCols)));
    const kena = [];
    const tetap = [];
    for (const r of relAnak.rows) (kunciHapus.has(kunciBaris(relAnak, r, fk.cols)) ? kena : tetap).push(r);
    if (!kena.length) continue;
    const aturan = (fk.onDelete || 'RESTRICT').toUpperCase();
    if (aturan === 'CASCADE') {
      perubahan[namaAnak] = new Relation(relAnak.name, relAnak.attrs, tetap);
      kaskade.push({ tabel: relAnak.name, aksi: 'ON DELETE CASCADE', baris: kena.length });
      hapusAnak(db, kunci, namaAnak, relAnak, kena, perubahan, kaskade, kedalaman + 1);
    } else if (aturan === 'SET NULL') {
      const rows = relAnak.rows.map((r) => {
        if (!kunciHapus.has(kunciBaris(relAnak, r, fk.cols))) return r;
        const b = r.slice();
        fk.cols.forEach((c) => { b[relAnak.indexOf(c)] = null; });
        return b;
      });
      perubahan[namaAnak] = new Relation(relAnak.name, relAnak.attrs, rows);
      kaskade.push({ tabel: relAnak.name, aksi: 'ON DELETE SET NULL', baris: kena.length });
    } else {
      throw new SqlError(`DELETE ${rel.name}: ${kena.length} baris ${relAnak.name} masih merujuknya lewat ${fk.cols.join(', ')} — mirip ORA-02292 (child record found)`);
    }
  }
}

// ----------------------------------------------------------------- skrip

/**
 * Jalankan satu atau beberapa perintah SQL berurutan.
 * `db` DIUBAH di tempat untuk setiap DML yang berhasil — sama seperti sesi basis data.
 * Perintah yang gagal tidak mengubah apa pun dan menghentikan skrip.
 *
 * @returns {{hasil: Array<{jenis:string, perintah:string, relation?:Relation, terdampak?:number, kaskade?:object[], plan?:object}>, galat: string|null}}
 */
export function executeScript(sql, db, opts = {}) {
  const perintah = typeof sql === 'string' ? parseScript(sql) : [].concat(sql);
  const hasil = [];
  for (const ast of perintah) {
    try {
      if (ast.type === 'insert' || ast.type === 'update' || ast.type === 'delete') {
        const f = { insert: jalankanInsert, update: jalankanUpdate, delete: jalankanDelete }[ast.type];
        const r = f(ast, db, opts);
        Object.assign(db, r.perubahan);
        hasil.push({ jenis: ast.type.toUpperCase(), perintah: ringkasPerintah(ast), terdampak: r.terdampak, kaskade: r.kaskade });
      } else if (['select', 'union', 'setop', 'with'].includes(ast.type)) {
        const ctx = { db: normalizeDb(db), steps: [], plan: null };
        const rel = evalNode(ast, ctx, opts);
        hasil.push({ jenis: 'SELECT', perintah: 'SELECT', relation: rel, plan: ctx.plan });
      } else {
        throw new SqlError(`${String(ast.type).replace('_', ' ').toUpperCase()} adalah perintah sesi — jalankan lewat terminal (engine/core/terminal.js)`);
      }
    } catch (e) {
      return { hasil, galat: e.message, gagalPada: hasil.length + 1 };
    }
  }
  return { hasil, galat: null };
}

function ringkasPerintah(ast) {
  if (ast.type === 'insert') return `INSERT INTO ${ast.table}${ast.rows ? ` (${ast.rows.length} baris)` : ' ... SELECT'}`;
  if (ast.type === 'update') return `UPDATE ${ast.table} SET ${ast.set.map((s) => s.col).join(', ')}${ast.where ? ` WHERE ${exprToString(ast.where)}` : ''}`;
  return `DELETE FROM ${ast.table}${ast.where ? ` WHERE ${exprToString(ast.where)}` : ''}`;
}

/** Salinan dalam peta db — dipakai lab supaya tombol "setel ulang" selalu kembali ke data asli. */
export function salinDb(db) {
  return Object.fromEntries(Object.entries(db).map(([k, v]) => [k, new Relation(v.name, v.attrs, v.rows.map((r) => r.slice()))]));
}
