// terminal.js — sesi SQL interaktif di balik "Terminal SQL" pada situs.
//
// Satu sesi = satu basis data salinan yang boleh diubah sebebasnya, lengkap dengan:
//   - SELECT / WITH / operasi himpunan, INSERT / UPDATE / DELETE (kendala ditegakkan)
//   - DDL: CREATE TABLE [AS SELECT], CREATE [OR REPLACE] VIEW, CREATE [UNIQUE] INDEX,
//          DROP TABLE [CASCADE CONSTRAINTS] / VIEW / INDEX, TRUNCATE TABLE
//   - transaksi gaya Oracle: autocommit MATI, COMMIT, ROLLBACK, SAVEPOINT, ROLLBACK TO,
//     DDL melakukan COMMIT implisit
//   - kamus data: user_tables, user_views, user_tab_columns, user_constraints,
//     user_indexes, dba_2pc_pending
//   - preset terdistribusi 3 situs: tabel@situs lewat database link, view global
//     UNION ALL (transparansi lokasi), COMMIT lintas situs memakai Two-Phase Commit
//     dari engine/ddb/twophase.js — termasuk transaksi ragu-ragu (in-doubt) yang
//     diselesaikan dengan COMMIT FORCE / ROLLBACK FORCE
//   - perintah meta berawalan garis miring terbalik: \d, \db, \c, \kunci, \gagal, ...
//
// Kode galat mengikuti Oracle (ORA-xxxxx) agar bisa dicocokkan dengan dokumentasi resmi.
// Nol dependensi; modul yang sama diuji di Node dan dijalankan di peramban.

import { Relation } from './relation.js';
import { tokenize, parse, evalNode, planToText, exprToString, SqlError } from './sql.js';
import { executeScript } from './dml.js';
import {
  akademik, rumahsakit, dreamhome, kependudukan,
  RS_KEYS, RS_KEYS_CASCADE, RS_TIPE, TIPE_LAIN,
} from '../data/datasets.js';
import { inferType, ident, literal } from '../oracle/emit.js';
import { runTwoPhaseCommit } from '../ddb/twophase.js';

// ------------------------------------------------------------------ utilitas

const kecil = (s) => String(s).toLowerCase();
const cari = (peta, nama) => Object.keys(peta).find((k) => kecil(k) === kecil(nama));
const situsDari = (nama) => (String(nama).includes('@') ? kecil(String(nama).split('@')[1]) : null);
const angkaBaris = (n) => `${n} baris`;

/** 'NUMBER(12,2)' -> {tipe:'NUMBER', panjang:12, skala:2} */
export function uraiTipe(teks) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(\s*(\d+)\s*(?:,\s*(\d+)\s*)?\))?\s*$/.exec(String(teks));
  if (!m) return { tipe: String(teks).toUpperCase(), panjang: null, skala: null };
  return { tipe: m[1].toUpperCase(), panjang: m[2] ? Number(m[2]) : null, skala: m[3] ? Number(m[3]) : null };
}

export function tulisTipe(k) {
  if (k.panjang === null || k.panjang === undefined) return k.tipe;
  return `${k.tipe}(${k.panjang}${k.skala !== null && k.skala !== undefined ? `,${k.skala}` : ''})`;
}

/** Jarak Levenshtein — untuk saran "maksud Anda ...?" pada nama yang salah ketik. */
export function jarakEdit(a, b) {
  a = kecil(a); b = kecil(b);
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

export function saranNama(nama, kandidat, maks = 3) {
  const polos = kecil(String(nama).split('.').pop());
  return kandidat
    .map((k) => ({ k, j: jarakEdit(polos, String(k).split('.').pop()) }))
    .filter((x) => x.j <= Math.max(2, Math.floor(polos.length / 3)))
    .sort((x, y) => x.j - y.j || String(x.k).localeCompare(String(y.k)))
    .slice(0, maks)
    .map((x) => x.k);
}

function kolomDari(rel, peta, notNull = []) {
  return rel.attrs.map((a, i) => ({
    nama: a,
    ...uraiTipe(peta[a] || inferType(rel.rows.map((r) => r[i]), a)),
    notNull: notNull.includes(a),
    default: null,
  }));
}

function lengkapiKunci(tabel, kunciDasar, peta) {
  const out = {};
  for (const [nama, rel] of Object.entries(tabel)) {
    const k = kunciDasar[nama] || { pk: [], fk: [] };
    out[nama] = {
      pk: [...(k.pk || [])],
      fk: (k.fk || []).map((f) => ({ ...f })),
      unik: (k.unik || []).map((u) => ({ ...u })),
      cek: (k.cek || []).map((c) => ({ ...c })),
      kolom: kolomDari(rel, peta, [...(k.pk || []), ...(k.notNull || [])]),
    };
  }
  return out;
}

const cekIn = (kolom, nilai) => ({
  nama: null,
  expr: { k: 'in', e: { k: 'col', table: null, name: kolom }, list: nilai.map((v) => ({ k: 'str', v })), not: false },
});
const cekSama = (kolom, nilai) => ({
  nama: null,
  expr: { k: 'binop', op: '=', l: { k: 'col', table: null, name: kolom }, r: { k: 'str', v: nilai } },
});

// ------------------------------------------------------------------ preset

export const SITUS_RS = [
  { id: 'jakarta', kota: 'Jakarta' },
  { id: 'bandung', kota: 'Bandung' },
  { id: 'surabaya', kota: 'Surabaya' },
];

function presetRumahSakit() {
  const tabel = rumahsakit();
  const kunci = lengkapiKunci(tabel, RS_KEYS_CASCADE, RS_TIPE);
  kunci.pasien.cek.push({ ...cekIn('jenis_kelamin', ['L', 'P']), nama: 'ck_pasien_jk' });
  return { tabel, kunci, view: [], situs: null };
}

function presetAkademik() {
  const tabel = akademik();
  const dasar = {
    mhs: { pk: ['nim'], fk: [] },
    mata_kuliah: { pk: ['kode_kul'], fk: [] },
    nilai: {
      pk: ['nim', 'kode_kul'],
      fk: [
        { cols: ['nim'], ref: 'mhs', refCols: ['nim'], onDelete: 'CASCADE' },
        { cols: ['kode_kul'], ref: 'mata_kuliah', refCols: ['kode_kul'] },
      ],
    },
  };
  const kunci = lengkapiKunci(tabel, dasar, TIPE_LAIN);
  kunci.nilai.cek.push({ nama: 'ck_nilai_rentang', expr: { k: 'between', e: { k: 'col', table: null, name: 'nilai' }, lo: { k: 'num', v: 0 }, hi: { k: 'num', v: 100 }, not: false } });
  // nama tabel pada soal Praktikum 3 adalah matakuliah (tanpa garis bawah)
  return { tabel, kunci, view: [{ nama: 'matakuliah', sql: 'SELECT * FROM mata_kuliah' }], situs: null };
}

function presetDreamHome() {
  const tabel = dreamhome();
  const dasar = {
    BRANCH: { pk: ['branchno'], fk: [] },
    STAFF: { pk: ['staffno'], fk: [{ cols: ['branchno'], ref: 'BRANCH', refCols: ['branchno'] }] },
    PROPERTY: {
      pk: ['propertyno'],
      fk: [
        { cols: ['staffno'], ref: 'STAFF', refCols: ['staffno'], onDelete: 'SET NULL' },
        { cols: ['branchno'], ref: 'BRANCH', refCols: ['branchno'] },
      ],
    },
  };
  return { tabel, kunci: lengkapiKunci(tabel, dasar, TIPE_LAIN), view: [], situs: null };
}

function presetKependudukan() {
  const tabel = kependudukan();
  const dasar = {
    KARANGANYAR: { pk: ['nik'], fk: [] },
    JATILUHUR: { pk: ['nik'], fk: [] },
    PLARANGAN: { pk: ['nik'], fk: [] },
    KEMATIAN: { pk: ['nik'], fk: [] },
    PINDAH: { pk: ['nik', 'tgl_pindah'], fk: [] },
  };
  const view = [{
    nama: 'penduduk_semua',
    sql: 'SELECT * FROM KARANGANYAR UNION ALL SELECT * FROM JATILUHUR UNION ALL SELECT * FROM PLARANGAN',
  }];
  return { tabel, kunci: lengkapiKunci(tabel, dasar, TIPE_LAIN), view, situs: null };
}

/**
 * Rumah sakit 3 situs. Fragmentasi mengikuti Lab Fragmentasi & skrip oracle/:
 *   pasien, dokter, administrator  : horizontal primer menurut kota (CHECK menjaga predikatnya)
 *   pasien_dokter, daftar          : horizontal turunan dari pasien
 *   dokter_admin                   : horizontal turunan dari dokter
 * Kunci asing hanya dideklarasikan bila induknya satu situs; Oracle tidak mengizinkan
 * kunci asing yang merujuk tabel di basis data lain.
 */
function presetTerdistribusi() {
  const rs = rumahsakit();
  const tabel = {};
  const kunciDasar = {};
  const idx = (rel, a) => rel.attrs.indexOf(a);
  for (const s of SITUS_RS) {
    const pas = rs.pasien.rows.filter((r) => r[idx(rs.pasien, 'kota')] === s.kota);
    const dok = rs.dokter.rows.filter((r) => r[idx(rs.dokter, 'kota')] === s.kota);
    const adm = rs.administrator.rows.filter((r) => r[idx(rs.administrator, 'kota')] === s.kota);
    const idPasien = new Set(pas.map((r) => r[0]));
    const idDokter = new Set(dok.map((r) => r[0]));
    const nm = (t) => `${t}@${s.id}`;
    tabel[nm('pasien')] = new Relation(nm('pasien'), rs.pasien.attrs, pas);
    tabel[nm('dokter')] = new Relation(nm('dokter'), rs.dokter.attrs, dok);
    tabel[nm('administrator')] = new Relation(nm('administrator'), rs.administrator.attrs, adm);
    tabel[nm('pasien_dokter')] = new Relation(nm('pasien_dokter'), rs.pasien_dokter.attrs, rs.pasien_dokter.rows.filter((r) => idPasien.has(r[idx(rs.pasien_dokter, 'id_pasien')])));
    tabel[nm('daftar')] = new Relation(nm('daftar'), rs.daftar.attrs, rs.daftar.rows.filter((r) => idPasien.has(r[idx(rs.daftar, 'id_pasien')])));
    tabel[nm('dokter_admin')] = new Relation(nm('dokter_admin'), rs.dokter_admin.attrs, rs.dokter_admin.rows.filter((r) => idDokter.has(r[idx(rs.dokter_admin, 'id_dokter')])));

    kunciDasar[nm('pasien')] = { pk: ['id_pasien'], fk: [], cek: [{ ...cekSama('kota', s.kota), nama: `ck_pasien_${s.id}` }, { ...cekIn('jenis_kelamin', ['L', 'P']), nama: 'ck_pasien_jk' }] };
    kunciDasar[nm('dokter')] = { pk: ['id_dokter'], fk: [], cek: [{ ...cekSama('kota', s.kota), nama: `ck_dokter_${s.id}` }] };
    kunciDasar[nm('administrator')] = { pk: ['id_admin'], fk: [], cek: [{ ...cekSama('kota', s.kota), nama: `ck_admin_${s.id}` }] };
    kunciDasar[nm('pasien_dokter')] = { pk: ['id'], fk: [{ cols: ['id_pasien'], ref: nm('pasien'), refCols: ['id_pasien'], onDelete: 'CASCADE' }] };
    kunciDasar[nm('daftar')] = { pk: ['id_daftar'], fk: [{ cols: ['id_pasien'], ref: nm('pasien'), refCols: ['id_pasien'], onDelete: 'CASCADE' }] };
    kunciDasar[nm('dokter_admin')] = { pk: ['id_data'], fk: [{ cols: ['id_dokter'], ref: nm('dokter'), refCols: ['id_dokter'], onDelete: 'CASCADE' }] };
  }
  const view = ['pasien', 'dokter', 'administrator', 'pasien_dokter', 'daftar', 'dokter_admin'].map((t) => ({
    nama: t,
    sql: SITUS_RS.map((s) => `SELECT * FROM ${t}@${s.id}`).join(' UNION ALL '),
  }));
  return { tabel, kunci: lengkapiKunci(tabel, kunciDasar, RS_TIPE), view, situs: SITUS_RS.map((s) => s.id) };
}

export const PRESET = {
  rumahsakit: { judul: 'Rumah sakit — Praktikum 2', ringkas: 'Enam tabel rumah sakit, FK ON DELETE/UPDATE CASCADE sesuai lembar praktikum.', bangun: presetRumahSakit },
  akademik: { judul: 'Akademik — Praktikum 3–5', ringkas: 'mhs, mata_kuliah, nilai; nilai dibatasi CHECK 0–100.', bangun: presetAkademik },
  terdistribusi: { judul: 'Rumah sakit terdistribusi — 3 situs', ringkas: 'Fragmen tabel@jakarta/bandung/surabaya lewat database link, view global UNION ALL, COMMIT lintas situs = 2PC.', bangun: presetTerdistribusi },
  dreamhome: { judul: 'DreamHome — Modul 6 & 7', ringkas: 'STAFF, BRANCH, PROPERTY (Connolly & Begg).', bangun: presetDreamHome },
  kependudukan: { judul: 'Kependudukan — studi kasus skripsi', ringkas: 'Tiga desa dengan NIK ganda lintas situs; semua NIK fiktif (segmen 9999).', bangun: presetKependudukan },
  kosong: { judul: 'Skema kosong', ringkas: 'Tanpa tabel — buat sendiri dengan CREATE TABLE.', bangun: () => ({ tabel: {}, kunci: {}, view: [], situs: null }) },
};

// ------------------------------------------------------------------ sesi

/** Buat sesi baru dari preset. */
export function buatSesi(presetId = 'rumahsakit') {
  const preset = PRESET[presetId];
  if (!preset) throw new SqlError(`Preset "${presetId}" tidak ada. Pilihan: ${Object.keys(PRESET).join(', ')}`);
  const b = preset.bangun();
  const sesi = {
    preset: presetId,
    judul: preset.judul,
    tabel: b.tabel,
    kunci: b.kunci,
    view: [],
    indeks: [],
    situs: b.situs,
    lokal: b.situs ? b.situs[0] : null,
    komit: null,
    savepoint: [],
    tertunda: 0,
    tulisSitus: new Set(),
    gagal: null,
    ragu: null,
    nomorTransaksi: 17,
    modeKunci: presetId === 'rumahsakit' ? 'cascade' : 'bawaan',
  };
  for (const v of b.view) {
    const ast = parse(v.sql);
    sesi.view.push({ nama: v.nama, sql: v.sql, ast, kolom: null });
  }
  sesi.komit = { ...sesi.tabel };
  return sesi;
}

export function promptSesi(sesi) {
  const ragu = sesi.ragu ? ' [RAGU]' : '';
  const tunda = sesi.tertunda ? '*' : '';
  return `${sesi.lokal ? `SQL@${sesi.lokal}` : 'SQL'}${tunda}${ragu}>`;
}

export function statusTransaksi(sesi) {
  return {
    tertunda: sesi.tertunda,
    savepoint: sesi.savepoint.map((s) => s.nama),
    situsTertulis: [...sesi.tulisSitus],
    ragu: sesi.ragu ? { id: sesi.ragu.id, situs: sesi.ragu.situs } : null,
    gagal: sesi.gagal,
  };
}

const cariView = (sesi, nama) => sesi.view.find((v) => kecil(v.nama) === kecil(nama)) || null;

/** Daftar objek: tabel dan view beserta ukurannya. */
export function daftarObjek(sesi) {
  const out = Object.entries(sesi.tabel).map(([nama, rel]) => ({
    nama, jenis: 'TABLE', baris: rel.cardinality, kolom: rel.degree, situs: situsDari(nama),
  }));
  for (const v of sesi.view) {
    let baris = null; let kolom = null;
    try { const r = materialisasiView(sesi, v, new Set()); baris = r.cardinality; kolom = r.degree; } catch { /* view rusak */ }
    out.push({ nama: v.nama, jenis: 'VIEW', baris, kolom, situs: null });
  }
  return out.sort((a, b) => a.jenis.localeCompare(b.jenis) || a.nama.localeCompare(b.nama));
}

// ------------------------------------------------------------------ kamus data

const KAMUS = ['user_tables', 'user_views', 'user_tab_columns', 'user_constraints', 'user_indexes', 'dba_2pc_pending'];

function kamusData(sesi, nama) {
  const up = (s) => String(s).toUpperCase();
  switch (kecil(nama)) {
    case 'user_tables':
      return new Relation('user_tables', ['table_name', 'num_rows', 'tablespace_name'],
        Object.entries(sesi.tabel).map(([n, r]) => [up(n), r.cardinality, situsDari(n) ? `TS_${up(situsDari(n))}` : 'USERS']));
    case 'user_views':
      return new Relation('user_views', ['view_name', 'text_length', 'text'], sesi.view.map((v) => [up(v.nama), v.sql.length, v.sql]));
    case 'user_tab_columns': {
      const rows = [];
      for (const [n, def] of Object.entries(sesi.kunci)) {
        (def.kolom || []).forEach((k, i) => rows.push([up(n), up(k.nama), k.tipe, k.panjang, k.skala, k.notNull ? 'N' : 'Y', i + 1]));
      }
      return new Relation('user_tab_columns', ['table_name', 'column_name', 'data_type', 'data_length', 'data_scale', 'nullable', 'column_id'], rows);
    }
    case 'user_constraints': {
      const rows = [];
      for (const [n, def] of Object.entries(sesi.kunci)) {
        const t = up(n).replace('@', '_');
        if (def.pk && def.pk.length) rows.push([`PK_${t}`, 'P', up(n), null, null, null]);
        (def.fk || []).forEach((f, i) => rows.push([up(f.nama || `FK_${t}_${i + 1}`), 'R', up(n), up(f.ref), f.onDelete || 'NO ACTION', null]));
        (def.unik || []).forEach((u, i) => rows.push([up(u.nama || `UQ_${t}_${i + 1}`), 'U', up(n), null, null, null]));
        (def.cek || []).forEach((c, i) => rows.push([up(c.nama || `CK_${t}_${i + 1}`), 'C', up(n), null, null, exprToString(c.expr)]));
      }
      return new Relation('user_constraints', ['constraint_name', 'constraint_type', 'table_name', 'r_table_name', 'delete_rule', 'search_condition'], rows);
    }
    case 'user_indexes':
      return new Relation('user_indexes', ['index_name', 'table_name', 'uniqueness', 'columns'],
        sesi.indeks.map((x) => [up(x.nama), up(x.table), x.unik ? 'UNIQUE' : 'NONUNIQUE', x.kolom.join(', ')]));
    case 'dba_2pc_pending':
      return new Relation('dba_2pc_pending', ['local_tran_id', 'global_tran_id', 'state', 'mixed', 'advice', 'tran_comment'],
        sesi.ragu ? [[sesi.ragu.id, `ORACLEDECK.${sesi.ragu.id}`, 'prepared', 'no', null, `situs: ${sesi.ragu.situs.join(', ')}`]] : []);
    default:
      return null;
  }
}

// ------------------------------------------------------------------ resolusi objek

/** Kumpulkan semua nama tabel/view yang dirujuk sebuah AST. */
export function namaDirujuk(node, out = new Set()) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) { node.forEach((n) => namaDirujuk(n, out)); return out; }
  if (node.type === 'select') {
    for (const ref of [...node.from, ...node.joins.map((j) => j.ref)]) if (ref.table) out.add(kecil(ref.table));
  }
  if (['insert', 'update', 'delete'].includes(node.type) && node.table) out.add(kecil(node.table));
  for (const [k, v] of Object.entries(node)) {
    if (k === 'rentang') continue;
    if (v && typeof v === 'object') namaDirujuk(v, out);
  }
  return out;
}

function materialisasiView(sesi, v, jalur) {
  if (jalur.has(kecil(v.nama))) throw new SqlError(`ORA-01731: definisi view melingkar pada ${v.nama}`);
  jalur.add(kecil(v.nama));
  const db = dbUntuk(sesi, v.ast, jalur);
  let rel;
  try {
    rel = evalNode(v.ast, { db, steps: [], plan: null }, {});
  } catch (e) {
    throw new SqlError(`ORA-04063: view ${v.nama} bermasalah — ${e.message}`);
  }
  const attrs = rel.attrs.map((a) => a.split('.').pop());
  if (v.kolom && v.kolom.length !== attrs.length) throw new SqlError(`ORA-01730: jumlah nama kolom view ${v.nama} (${v.kolom.length}) tidak sama dengan kolom kueri (${attrs.length})`);
  const nama = v.kolom || attrs;
  if (new Set(nama.map(kecil)).size !== nama.length) throw new SqlError(`ORA-00957: nama kolom ganda pada view ${v.nama} — beri alias berbeda`);
  jalur.delete(kecil(v.nama));
  return new Relation(v.nama, nama, rel.rows);
}

/** Basis data eksekusi: tabel + view dan kamus data yang dirujuk AST (dimaterialisasi seperlunya). */
function dbUntuk(sesi, ast, jalur = new Set()) {
  const db = {};
  for (const [k, v] of Object.entries(sesi.tabel)) db[kecil(k)] = v;
  for (const nama of namaDirujuk(ast)) {
    if (db[nama]) continue;
    const v = cariView(sesi, nama);
    if (v) { db[nama] = materialisasiView(sesi, v, jalur); continue; }
    const kamus = kamusData(sesi, nama);
    if (kamus) db[nama] = kamus;
  }
  return db;
}

/** Situs yang disentuh sebuah AST (view diurai sampai tabel dasarnya). */
export function analisisAkses(sesi, ast) {
  const situs = new Map();
  const kunjungi = (node, jalur) => {
    for (const nama of namaDirujuk(node)) {
      const v = cariView(sesi, nama);
      if (v && !jalur.has(nama)) { kunjungi(v.ast, new Set([...jalur, nama])); continue; }
      const kunciTabel = cari(sesi.tabel, nama);
      const s = situsDari(nama);
      if (!s || !kunciTabel) continue;
      if (!situs.has(s)) situs.set(s, { situs: s, lokal: s === sesi.lokal, tabel: [], baris: 0 });
      const e = situs.get(s);
      if (!e.tabel.includes(kunciTabel)) { e.tabel.push(kunciTabel); e.baris += sesi.tabel[kunciTabel].cardinality; }
    }
  };
  kunjungi(ast, new Set());
  const daftar = [...situs.values()].sort((a, b) => Number(b.lokal) - Number(a.lokal) || a.situs.localeCompare(b.situs));
  return {
    situs: daftar,
    remote: daftar.filter((x) => !x.lokal).length,
    barisRemote: daftar.filter((x) => !x.lokal).reduce((n, x) => n + x.baris, 0),
  };
}

function tandaiRemote(plan, lokal) {
  if (!plan) return plan;
  const out = { ...plan };
  if (plan.op === 'SCAN' && plan.detail && plan.detail.includes('@')) {
    const s = situsDari(plan.detail.split(' ')[0]);
    out.op = s === lokal ? 'SCAN' : 'REMOTE';
    out.detail = `${plan.detail}${s === lokal ? ' (lokal)' : ` (via database link ${s})`}`;
  }
  if (plan.children) out.children = plan.children.map((c) => tandaiRemote(c, lokal));
  return out;
}

// ------------------------------------------------------------------ petunjuk galat

export function petunjukGalat(sesi, pesan) {
  const p = [];
  const objek = [...Object.keys(sesi.tabel), ...sesi.view.map((v) => v.nama), ...KAMUS];
  let m = /Tabel "([^"]+)" tidak ada/.exec(pesan);
  if (m) {
    const s = saranNama(m[1], objek);
    if (s.length) p.push(`Maksud Anda: ${s.join(', ')}?`);
    if (sesi.situs && !m[1].includes('@')) p.push(`Di preset terdistribusi, fragmen ditulis tabel@situs (mis. pasien@${sesi.situs[1]}); nama tanpa @ adalah view global.`);
    p.push('Ketik \\d untuk melihat semua tabel dan view.');
  }
  m = /Kolom "([^"]+)" tidak ada\. Tersedia: (.*)$/.exec(pesan);
  if (m) {
    const s = saranNama(m[1], [...new Set(m[2].split(', ').filter(Boolean).map((x) => x.split('.').pop()))]);
    if (s.length) p.push(`Maksud Anda: ${s.join(', ')}?`);
    if (m[1].includes('.')) p.push('Awalan sebelum titik harus alias yang ditulis di FROM/JOIN.');
  }
  if (/ambigu/.test(pesan)) p.push('Kolom dengan nama sama ada di dua tabel — tulis alias.kolom, mis. m.nim.');
  if (/ORA-02292/.test(pesan)) p.push('Aturan rujukan saat ini menolak penghapusan induk. Hapus baris anak dulu, atau ubah aturan dengan \\kunci cascade.');
  if (/ORA-02291/.test(pesan)) p.push('Sisipkan dulu baris induknya, atau pakai nilai kunci yang sudah ada.');
  if (/ORA-00001/.test(pesan)) p.push('Nilai kunci sudah dipakai. Cari dulu: SELECT ... WHERE kolom_kunci = nilai.');
  if (/ORA-02290/.test(pesan) && sesi.situs) p.push('Pada fragmen horizontal, CHECK menjaga predikat fragmentasi: pasien kota Bandung hanya boleh masuk pasien@bandung.');
  if (/ORA-01591/.test(pesan)) p.push("Selesaikan dulu transaksi ragu-ragu: SELECT * FROM dba_2pc_pending; lalu COMMIT FORCE 'id' atau ROLLBACK FORCE 'id'.");
  if (/tidak ditutup tanda petik/.test(pesan)) p.push("Setiap ' pembuka butuh ' penutup. Untuk petik di dalam teks, tulis dua kali: 'O''Brien'.");
  if (/Ekspresi terpotong/.test(pesan)) p.push('Perintah berakhir terlalu cepat — lengkapi kondisi setelah WHERE/AND/OR.');
  m = /Perintah "([^"]+)" tidak dikenal/.exec(pesan);
  if (m) {
    const s = saranNama(m[1], ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'DESC', 'EXPLAIN', 'WITH', 'TRUNCATE']);
    if (s.length) p.push(`Maksud Anda: ${s.join(', ')}?`);
  }
  m = /Fungsi "([^"]+)" tidak didukung\. Tersedia: (.*)$/.exec(pesan);
  if (m) {
    const s = saranNama(m[1], m[2].split(', '));
    if (s.length) p.push(`Maksud Anda: ${s.join(', ')}?`);
  }
  if (/ORA-00937|ORA-00979/.test(pesan)) p.push('Contoh benar: SELECT kota, COUNT(*) FROM pasien GROUP BY kota');
  return p;
}

// ------------------------------------------------------------------ transaksi

function idTransaksi(sesi) {
  sesi.nomorTransaksi += 1;
  return `1.${sesi.nomorTransaksi}.${400 + sesi.nomorTransaksi * 3}`;
}

function bersihkanTransaksi(sesi) {
  sesi.komit = { ...sesi.tabel };
  sesi.savepoint = [];
  sesi.tertunda = 0;
  sesi.tulisSitus = new Set();
}

function lakukanCommit(sesi, { implisit = false } = {}) {
  const blok = [];
  const situs = [...sesi.tulisSitus];
  if (sesi.tertunda === 0) {
    bersihkanTransaksi(sesi);
    if (!implisit) blok.push({ jenis: 'ok', pesan: 'Commit selesai.', detail: ['Tidak ada perubahan yang tertunda.'] });
    return blok;
  }
  if (situs.length >= 2) {
    const peserta = situs.map((s) => ({ id: s.toUpperCase(), vote: sesi.gagal && sesi.gagal.situs === s ? 'ABORT' : 'COMMIT' }));
    const skenario = { peserta };
    if (sesi.gagal && sesi.gagal.koordinator) skenario.koordinatorJatuhPada = 3;
    const hasil = runTwoPhaseCommit(skenario);
    const id = idTransaksi(sesi);
    blok.push({ jenis: '2pc', id, protokol: hasil.protokol, keputusan: hasil.keputusan, memblokir: hasil.memblokir, jejak: hasil.jejak, analisis: hasil.analisis, peserta: situs });
    sesi.gagal = null;
    if (hasil.memblokir) {
      sesi.ragu = { id, situs, tabelSesudah: { ...sesi.tabel }, tabelSebelum: sesi.komit };
      sesi.tabel = { ...sesi.komit };
      sesi.savepoint = []; sesi.tertunda = 0; sesi.tulisSitus = new Set();
      blok.push({ jenis: 'galat', pesan: `ORA-02054: transaksi ${id} ragu-ragu (in-doubt) — koordinator jatuh setelah peserta PREPARED`, petunjuk: ["Peserta menahan kunci. Lihat SELECT * FROM dba_2pc_pending; lalu putuskan dengan COMMIT FORCE '" + id + "' atau ROLLBACK FORCE '" + id + "'."] });
      return blok;
    }
    if (hasil.keputusan !== 'GLOBAL-COMMIT') {
      const n = sesi.tertunda;
      sesi.tabel = { ...sesi.komit };
      bersihkanTransaksi(sesi);
      blok.push({ jenis: 'galat', pesan: `ORA-02091: transaksi dibatalkan — ${hasil.keputusan}; ${n} perubahan di ${situs.length} situs di-rollback`, petunjuk: ['Satu situs memilih ABORT, jadi semua situs membatalkan: atomisitas global dijaga 2PC.'] });
      return blok;
    }
    const n = sesi.tertunda;
    bersihkanTransaksi(sesi);
    blok.push({ jenis: 'ok', pesan: `${implisit ? 'Commit implisit' : 'Commit'} selesai lewat Two-Phase Commit.`, detail: [`${n} perubahan di ${situs.length} situs (${situs.join(', ')}) disimpan permanen secara atomik.`] });
    return blok;
  }
  const n = sesi.tertunda;
  bersihkanTransaksi(sesi);
  blok.push({ jenis: 'ok', pesan: implisit ? 'Commit implisit sebelum DDL.' : 'Commit selesai.', detail: [`${n} perubahan disimpan permanen${situs.length === 1 ? ` di situs ${situs[0]} (satu fase — hanya satu situs yang berubah)` : ''}.`] });
  return blok;
}

// ------------------------------------------------------------------ DDL

function pastikanBelumAda(sesi, nama) {
  if (cari(sesi.tabel, nama) || cariView(sesi, nama) || KAMUS.includes(kecil(nama))) {
    throw new SqlError(`ORA-00955: nama ${nama} sudah dipakai objek lain`);
  }
}

function kolomAda(def, nama) { return def.kolom.some((k) => kecil(k.nama) === kecil(nama)); }

function periksaKolomEkspresi(expr, def, konteks) {
  const telusuri = (e) => {
    if (!e || typeof e !== 'object') return;
    if (e.k === 'col' && !kolomAda(def, e.name)) throw new SqlError(`ORA-00904: "${e.name}" bukan kolom yang valid pada ${konteks}`);
    for (const v of Object.values(e)) if (v && typeof v === 'object') telusuri(v);
  };
  telusuri(expr);
}

function buatTabel(sesi, ast) {
  if (ast.table.includes('@')) throw new SqlError('ORA-02021: operasi DDL tidak diizinkan pada basis data remote — hubungkan dulu ke situs itu (\\c nama_situs) lalu buat tabel tanpa @');
  pastikanBelumAda(sesi, ast.table);
  const catatan = [];
  if (ast.sebagai) {
    const db = dbUntuk(sesi, ast.sebagai);
    const rel = evalNode(ast.sebagai, { db, steps: [], plan: null }, {});
    const attrs = rel.attrs.map((a) => a.split('.').pop());
    if (new Set(attrs.map(kecil)).size !== attrs.length) throw new SqlError('ORA-00957: nama kolom ganda — beri alias berbeda pada SELECT');
    const baru = new Relation(ast.table, attrs, rel.rows);
    sesi.tabel[ast.table] = baru;
    sesi.kunci[ast.table] = { pk: [], fk: [], unik: [], cek: [], kolom: kolomDari(baru, {}) };
    return { pesan: 'Tabel dibuat.', detail: [`${angkaBaris(rel.cardinality)} disalin. CREATE TABLE AS SELECT tidak menyalin PRIMARY KEY, FOREIGN KEY, maupun CHECK.`] };
  }
  const def = { pk: [], fk: [], unik: [], cek: [], kolom: [] };
  const lihat = new Set();
  for (const k of ast.kolom) {
    if (lihat.has(kecil(k.nama))) throw new SqlError(`ORA-00957: nama kolom ganda: ${k.nama}`);
    lihat.add(kecil(k.nama));
    def.kolom.push({ nama: k.nama, tipe: k.tipe, panjang: k.panjang, skala: k.skala, notNull: k.notNull, default: k.default });
    if (k.tipe === 'VARCHAR2' && k.panjang === null) throw new SqlError(`ORA-00906: VARCHAR2 pada kolom ${k.nama} wajib diberi panjang, mis. VARCHAR2(50)`);
  }
  for (const c of ast.pk) if (!kolomAda(def, c)) throw new SqlError(`ORA-00904: "${c}" pada PRIMARY KEY bukan kolom tabel ${ast.table}`);
  def.pk = ast.pk.map((c) => def.kolom.find((k) => kecil(k.nama) === kecil(c)).nama);
  def.pk.forEach((c) => { def.kolom.find((k) => k.nama === c).notNull = true; });
  for (const u of ast.unik) {
    for (const c of u.cols) if (!kolomAda(def, c)) throw new SqlError(`ORA-00904: "${c}" pada UNIQUE bukan kolom tabel ${ast.table}`);
    def.unik.push({ nama: u.nama, cols: u.cols });
  }
  for (const c of ast.cek) {
    periksaKolomEkspresi(c.expr, def, `CHECK tabel ${ast.table}`);
    def.cek.push({ nama: c.nama, expr: c.expr });
  }
  for (const f of ast.fk) {
    if (String(f.ref).includes('@')) {
      throw new SqlError(`ORA-02021: kunci asing tidak boleh merujuk ${f.ref} — di Oracle tabel induk dan anak wajib berada di basis data yang sama. Tegakkan integritas lintas situs lewat trigger atau aplikasi.`);
    }
    for (const c of f.cols) if (!kolomAda(def, c)) throw new SqlError(`ORA-00904: "${c}" pada FOREIGN KEY bukan kolom tabel ${ast.table}`);
    const namaInduk = kecil(f.ref) === kecil(ast.table) ? ast.table : cari(sesi.tabel, f.ref);
    if (!namaInduk) throw new SqlError(`ORA-00942: tabel induk ${f.ref} tidak ada`);
    const defInduk = namaInduk === ast.table ? def : sesi.kunci[namaInduk];
    let refCols = f.refCols;
    if (!refCols) {
      if (!defInduk || !defInduk.pk.length) throw new SqlError(`ORA-02268: tabel induk ${f.ref} tidak punya primary key untuk dirujuk`);
      refCols = defInduk.pk;
    }
    if (refCols.length !== f.cols.length) throw new SqlError(`ORA-02256: jumlah kolom perujuk (${f.cols.length}) harus sama dengan kolom yang dirujuk (${refCols.length})`);
    const cocokKunci = (cols) => cols.length === refCols.length && cols.every((c, i) => kecil(c) === kecil(refCols[i]));
    const kunciInduk = defInduk ? [defInduk.pk, ...(defInduk.unik || []).map((u) => u.cols)] : [];
    if (!kunciInduk.some(cocokKunci)) throw new SqlError(`ORA-02270: kolom ${refCols.join(', ')} pada ${f.ref} bukan primary key atau unique key`);
    if (f.onUpdate === 'CASCADE') catatan.push('ON UPDATE CASCADE bukan sintaks Oracle (milik MySQL/PostgreSQL); diterima di sini agar sama dengan lembar praktikum.');
    def.fk.push({ nama: f.nama, cols: f.cols, ref: namaInduk, refCols, onDelete: f.onDelete || null, onUpdate: f.onUpdate || null });
  }
  sesi.tabel[ast.table] = new Relation(ast.table, def.kolom.map((k) => k.nama), []);
  sesi.kunci[ast.table] = def;
  if (sesi.situs) catatan.push(`Tabel lokal di situs ${sesi.lokal}.`);
  return { pesan: 'Tabel dibuat.', detail: [`${def.kolom.length} kolom${def.pk.length ? `, PRIMARY KEY (${def.pk.join(', ')})` : ', tanpa primary key'}${def.fk.length ? `, ${def.fk.length} FOREIGN KEY` : ''}${def.unik.length ? `, ${def.unik.length} UNIQUE` : ''}${def.cek.length ? `, ${def.cek.length} CHECK` : ''}.`, ...catatan] };
}

function buatView(sesi, ast) {
  const ada = cariView(sesi, ast.view);
  if (cari(sesi.tabel, ast.view) || KAMUS.includes(kecil(ast.view))) throw new SqlError(`ORA-00955: nama ${ast.view} sudah dipakai objek lain`);
  if (ada && !ast.ganti) throw new SqlError(`ORA-00955: view ${ast.view} sudah ada — pakai CREATE OR REPLACE VIEW`);
  const sqlKueri = String(ast.teks || '').replace(/^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:FORCE\s+)?VIEW\s+[\w@$]+\s*(?:\([^)]*\))?\s*AS\s+/i, '').trim();
  const calon = { nama: ast.view, sql: sqlKueri, ast: ast.query, kolom: ast.kolom };
  const sementara = ada ? sesi.view.map((v) => (v === ada ? calon : v)) : [...sesi.view, calon];
  const lama = sesi.view;
  sesi.view = sementara;
  try {
    const rel = materialisasiView(sesi, calon, new Set());
    if (ast.kolom && ast.kolom.length !== rel.degree) throw new SqlError(`ORA-01730: jumlah nama kolom view (${ast.kolom.length}) tidak sama dengan kolom kueri (${rel.degree})`);
    return { pesan: ada ? 'View diganti.' : 'View dibuat.', detail: [`${rel.degree} kolom, saat ini ${angkaBaris(rel.cardinality)}. View tidak menyimpan data — isinya dihitung ulang setiap dibaca.`] };
  } catch (e) {
    sesi.view = lama;
    throw e;
  }
}

function buatIndeks(sesi, ast) {
  const t = cari(sesi.tabel, ast.table);
  if (!t) throw new SqlError(`ORA-00942: tabel ${ast.table} tidak ada`);
  if (sesi.indeks.some((x) => kecil(x.nama) === kecil(ast.indeks))) throw new SqlError(`ORA-00955: nama ${ast.indeks} sudah dipakai`);
  const rel = sesi.tabel[t];
  for (const c of ast.kolom) if (rel.indexOf(c) < 0) throw new SqlError(`ORA-00904: "${c}" bukan kolom tabel ${t}`);
  if (ast.unik) {
    const lihat = new Set();
    for (const r of rel.rows) {
      const k = JSON.stringify(ast.kolom.map((c) => r[rel.indexOf(c)]));
      if (lihat.has(k)) throw new SqlError(`ORA-01452: CREATE UNIQUE INDEX gagal — data ${t} sudah berisi nilai ganda pada (${ast.kolom.join(', ')})`);
      lihat.add(k);
    }
    sesi.kunci[t].unik.push({ nama: ast.indeks, cols: ast.kolom, dariIndeks: true });
  }
  sesi.indeks.push({ nama: ast.indeks, table: t, kolom: ast.kolom, unik: ast.unik });
  return { pesan: 'Indeks dibuat.', detail: [ast.unik ? 'UNIQUE INDEX ikut menolak nilai ganda pada INSERT/UPDATE berikutnya.' : 'Indeks hanya mengubah jalur akses, bukan hasil kueri.'] };
}

function hapusTabel(sesi, ast) {
  const t = cari(sesi.tabel, ast.nama);
  if (!t) {
    if (cariView(sesi, ast.nama)) throw new SqlError(`ORA-00942: ${ast.nama} adalah VIEW — pakai DROP VIEW`);
    throw new SqlError(`ORA-00942: tabel ${ast.nama} tidak ada`);
  }
  if (t.includes('@')) throw new SqlError('ORA-02021: operasi DDL tidak diizinkan pada basis data remote');
  const anak = Object.entries(sesi.kunci).filter(([n, d]) => n !== t && (d.fk || []).some((f) => kecil(f.ref) === kecil(t)));
  if (anak.length && !ast.kaskade) {
    throw new SqlError(`ORA-02449: ${t} masih dirujuk kunci asing dari ${anak.map(([n]) => n).join(', ')} — pakai DROP TABLE ${t} CASCADE CONSTRAINTS`);
  }
  anak.forEach(([, d]) => { d.fk = d.fk.filter((f) => kecil(f.ref) !== kecil(t)); });
  delete sesi.tabel[t];
  delete sesi.kunci[t];
  sesi.indeks = sesi.indeks.filter((x) => x.table !== t);
  delete sesi.komit[t];
  const rusak = sesi.view.filter((v) => namaDirujuk(v.ast).has(kecil(t))).map((v) => v.nama);
  const detail = [];
  if (anak.length) detail.push(`Kunci asing di ${anak.map(([n]) => n).join(', ')} ikut dihapus.`);
  if (rusak.length) detail.push(`View ${rusak.join(', ')} kini INVALID (ORA-04063 bila dibaca).`);
  return { pesan: 'Tabel dihapus.', detail };
}

function potongTabel(sesi, ast) {
  const t = cari(sesi.tabel, ast.table);
  if (!t) throw new SqlError(`ORA-00942: tabel ${ast.table} tidak ada`);
  const anak = Object.entries(sesi.kunci).filter(([n, d]) => n !== t && (d.fk || []).some((f) => kecil(f.ref) === kecil(t)));
  if (anak.length) throw new SqlError(`ORA-02266: ${t} dirujuk kunci asing aktif dari ${anak.map(([n]) => n).join(', ')} — TRUNCATE ditolak`);
  const n = sesi.tabel[t].cardinality;
  sesi.tabel[t] = new Relation(sesi.tabel[t].name, sesi.tabel[t].attrs, []);
  sesi.komit[t] = sesi.tabel[t];
  return { pesan: 'Tabel dikosongkan.', detail: [`${angkaBaris(n)} dibuang. TRUNCATE adalah DDL: tidak bisa di-ROLLBACK.`] };
}

function jelaskanObjek(sesi, nama) {
  const t = cari(sesi.tabel, nama);
  if (t) {
    const def = sesi.kunci[t] || { kolom: kolomDari(sesi.tabel[t], {}), pk: [], fk: [], unik: [], cek: [] };
    const rel = new Relation(`DESC ${t}`, ['nama', 'null?', 'tipe'], def.kolom.map((k) => [k.nama.toUpperCase(), k.notNull ? 'NOT NULL' : '', tulisTipe(k)]));
    const kendala = [];
    if (def.pk.length) kendala.push(`PRIMARY KEY (${def.pk.join(', ')})`);
    (def.fk || []).forEach((f) => kendala.push(`FOREIGN KEY (${f.cols.join(', ')}) REFERENCES ${f.ref}(${f.refCols.join(', ')})${f.onDelete ? ` ON DELETE ${f.onDelete}` : ''}${f.onUpdate ? ` ON UPDATE ${f.onUpdate}` : ''}`));
    (def.unik || []).forEach((u) => kendala.push(`UNIQUE (${u.cols.join(', ')})`));
    (def.cek || []).forEach((c) => kendala.push(`CHECK ${exprToString(c.expr)}`));
    const dirujuk = Object.entries(sesi.kunci).flatMap(([n, d]) => (d.fk || []).filter((f) => kecil(f.ref) === kecil(t)).map((f) => `${n}(${f.cols.join(', ')})`));
    const s = situsDari(t);
    return { jenis: 'tabel', judul: `${t} — ${angkaBaris(sesi.tabel[t].cardinality)}${s ? ` · situs ${s}` : ''}`, relation: rel, detail: [...kendala, ...(dirujuk.length ? [`Dirujuk oleh: ${dirujuk.join(', ')}`] : [])] };
  }
  const v = cariView(sesi, nama);
  if (v) {
    const r = materialisasiView(sesi, v, new Set());
    return { jenis: 'tabel', judul: `VIEW ${v.nama} — ${angkaBaris(r.cardinality)}`, relation: new Relation(`DESC ${v.nama}`, ['nama'], r.attrs.map((a) => [a.toUpperCase()])), detail: [`Definisi: ${v.sql}`] };
  }
  const k = kamusData(sesi, nama);
  if (k) return { jenis: 'tabel', judul: `Kamus data ${nama.toUpperCase()}`, relation: new Relation(`DESC ${nama}`, ['nama'], k.attrs.map((a) => [a.toUpperCase()])), detail: [] };
  const s = saranNama(nama, [...Object.keys(sesi.tabel), ...sesi.view.map((x) => x.nama)]);
  throw new SqlError(`ORA-04043: objek ${nama} tidak ada${s.length ? ` — maksud Anda ${s.join(', ')}?` : ''}`);
}

// ------------------------------------------------------------------ DML

function jalankanDml(sesi, ast) {
  const nama = ast.table;
  if (cariView(sesi, nama)) {
    throw new SqlError(`ORA-01732: ${ast.type.toUpperCase()} tidak sah pada view ${nama}${sesi.situs ? ` — tulis langsung ke fragmennya, mis. ${nama}@${sesi.lokal}` : ''}. View gabungan hanya bisa diubah lewat INSTEAD OF trigger.`);
  }
  if (KAMUS.includes(kecil(nama))) throw new SqlError(`ORA-01031: hak akses tidak cukup — ${nama.toUpperCase()} adalah kamus data, hanya bisa dibaca`);
  const t = cari(sesi.tabel, nama);
  if (!t) {
    const s = saranNama(nama, Object.keys(sesi.tabel));
    throw new SqlError(`ORA-00942: tabel ${nama} tidak ada${s.length ? ` — maksud Anda ${s.join(', ')}?` : ''}`);
  }
  const target = situsDari(t);
  if (sesi.ragu && target && sesi.ragu.situs.includes(target)) {
    throw new SqlError(`ORA-01591: kunci ditahan transaksi terdistribusi ragu-ragu ${sesi.ragu.id} di situs ${target}`);
  }
  const db = dbUntuk(sesi, ast);
  // tabel dasar dipetakan dengan nama aslinya agar perubahan bisa ditulis balik
  for (const [k, v] of Object.entries(sesi.tabel)) { delete db[kecil(k)]; db[k] = v; }
  const r = executeScript([ast], db, { kunci: sesi.kunci });
  if (r.galat) throw new SqlError(r.galat);
  const h = r.hasil[0];
  const berubah = Object.keys(sesi.tabel).filter((k) => db[k] !== sesi.tabel[k]);
  berubah.forEach((k) => { sesi.tabel[k] = db[k]; });
  const kaskadeBaris = (h.kaskade || []).reduce((n, k) => n + k.baris, 0);
  if (h.terdampak + kaskadeBaris > 0) {
    sesi.tertunda += h.terdampak + kaskadeBaris;
    berubah.map(situsDari).filter(Boolean).forEach((s) => sesi.tulisSitus.add(s));
  }
  const kata = { INSERT: 'disisipkan', UPDATE: 'diperbarui', DELETE: 'dihapus' }[h.jenis];
  const detail = (h.kaskade || []).map((k) => `${k.aksi}: ${angkaBaris(k.baris)} di ${k.tabel}`);
  detail.push(...peringatanGlobal(sesi, t, ast));
  if (h.terdampak === 0 && ast.where) detail.push('Tidak ada baris yang memenuhi WHERE.');
  if (h.terdampak > 0 && !ast.where && h.jenis !== 'INSERT') detail.push(`Tanpa WHERE: SELURUH ${angkaBaris(h.terdampak)} ${t} terkena. Bisa dibatalkan dengan ROLLBACK selama belum COMMIT.`);
  return { jenis: 'ok', pesan: `${angkaBaris(h.terdampak)} ${kata}.`, detail, kaskade: h.kaskade || [], terdampak: h.terdampak };
}

/** Di preset terdistribusi, UNIQUE lokal tidak melihat fragmen di situs lain. */
function peringatanGlobal(sesi, t, ast) {
  if (!sesi.situs || !t.includes('@') || ast.type === 'delete') return [];
  const dasar = t.split('@')[0];
  const def = sesi.kunci[t];
  if (!def || !def.pk.length) return [];
  const rel = sesi.tabel[t];
  const kunciLokal = new Set(rel.rows.map((r) => JSON.stringify(def.pk.map((c) => r[rel.indexOf(c)]))));
  const bentrok = [];
  for (const s of sesi.situs) {
    const lain = `${dasar}@${s}`;
    if (lain === t || !sesi.tabel[lain]) continue;
    const rl = sesi.tabel[lain];
    for (const r of rl.rows) {
      const k = JSON.stringify(def.pk.map((c) => r[rl.indexOf(c)]));
      if (kunciLokal.has(k)) bentrok.push(`${def.pk.join(', ')} = ${JSON.parse(k).join(', ')} juga ada di ${lain}`);
    }
  }
  if (!bentrok.length) return [];
  return [`PERINGATAN integritas global: ${bentrok.slice(0, 3).join('; ')}. PRIMARY KEY hanya unik per situs — basis data tidak melihat fragmen lain (lihat Lab 16 Kependudukan).`];
}

// ------------------------------------------------------------------ eksekusi perintah

function jalankanPerintah(sesi, ast, teks) {
  const t0 = now();
  const selesai = (blok) => ({ ...blok, perintah: teks, ms: now() - t0 });
  switch (ast.type) {
    case 'select': case 'union': case 'setop': case 'with': {
      const db = dbUntuk(sesi, ast);
      const ctx = { db, steps: [], plan: null };
      const relation = evalNode(ast, ctx, {});
      const bersih = new Relation(relation.name, relation.attrs.map((a) => a.split('.').pop()).map((a, i, arr) => (arr.indexOf(a) !== i ? relation.attrs[i] : a)), relation.rows);
      return selesai({ jenis: 'hasil', relation: bersih, plan: tandaiRemote(ctx.plan, sesi.lokal), akses: sesi.situs ? analisisAkses(sesi, ast) : null });
    }
    case 'explain': {
      const db = dbUntuk(sesi, ast.query);
      const ctx = { db, steps: [], plan: null };
      evalNode(ast.query, ctx, {});
      const akses = sesi.situs ? analisisAkses(sesi, ast.query) : null;
      return selesai({ jenis: 'rencana', teks: planToText(tandaiRemote(ctx.plan, sesi.lokal)), akses, detail: ['Rencana dari mesin ORACLEDECK; urutan operator mengikuti evaluasi logis, bukan pengoptimal biaya Oracle.'] });
    }
    case 'insert': case 'update': case 'delete':
      return selesai(jalankanDml(sesi, ast));
    case 'commit': {
      if (ast.force) return selesai(selesaikanRagu(sesi, ast.force, true));
      return lakukanCommit(sesi).map((b) => selesai(b));
    }
    case 'rollback': {
      if (ast.force) return selesai(selesaikanRagu(sesi, ast.force, false));
      if (ast.savepoint) {
        const i = sesi.savepoint.map((s) => kecil(s.nama)).lastIndexOf(kecil(ast.savepoint));
        if (i < 0) throw new SqlError(`ORA-01086: savepoint ${ast.savepoint} tidak pernah dibuat dalam transaksi ini`);
        const sp = sesi.savepoint[i];
        sesi.tabel = { ...sp.tabel };
        sesi.tertunda = sp.tertunda;
        sesi.tulisSitus = new Set(sp.tulisSitus);
        sesi.savepoint = sesi.savepoint.slice(0, i + 1);
        return selesai({ jenis: 'ok', pesan: 'Rollback ke savepoint selesai.', detail: [`Perubahan setelah SAVEPOINT ${sp.nama} dibatalkan; yang sebelumnya tetap tertunda (${sesi.tertunda}).`] });
      }
      const n = sesi.tertunda;
      sesi.tabel = { ...sesi.komit };
      bersihkanTransaksi(sesi);
      return selesai({ jenis: 'ok', pesan: 'Rollback selesai.', detail: [n ? `${n} perubahan sejak COMMIT terakhir dibatalkan.` : 'Tidak ada perubahan yang tertunda.'] });
    }
    case 'savepoint':
      sesi.savepoint.push({ nama: ast.nama, tabel: { ...sesi.tabel }, tertunda: sesi.tertunda, tulisSitus: [...sesi.tulisSitus] });
      return selesai({ jenis: 'ok', pesan: 'Savepoint dibuat.', detail: [`ROLLBACK TO ${ast.nama} akan kembali ke titik ini.`] });
    case 'describe':
      return selesai(jelaskanObjek(sesi, ast.table));
    case 'create_table': case 'create_view': case 'create_index': case 'drop_table': case 'drop_view': case 'drop_index': case 'truncate': {
      const pra = lakukanCommit(sesi, { implisit: true });
      const f = {
        create_table: buatTabel, create_view: buatView, create_index: buatIndeks, drop_table: hapusTabel, truncate: potongTabel,
        drop_view: (s, a) => {
          const v = cariView(s, a.nama);
          if (!v) throw new SqlError(`ORA-00942: view ${a.nama} tidak ada`);
          s.view = s.view.filter((x) => x !== v);
          return { pesan: 'View dihapus.', detail: [] };
        },
        drop_index: (s, a) => {
          const x = s.indeks.find((i) => kecil(i.nama) === kecil(a.nama));
          if (!x) throw new SqlError(`ORA-01418: indeks ${a.nama} tidak ada`);
          s.indeks = s.indeks.filter((i) => i !== x);
          if (x.unik && s.kunci[x.table]) s.kunci[x.table].unik = s.kunci[x.table].unik.filter((u) => !(u.dariIndeks && kecil(u.nama) === kecil(x.nama)));
          return { pesan: 'Indeks dihapus.', detail: [] };
        },
      }[ast.type];
      const r = f(sesi, ast);
      sesi.komit = { ...sesi.tabel };
      return [...pra.map((b) => selesai(b)), selesai({ jenis: 'ok', ...r })];
    }
    default:
      throw new SqlError(`Perintah ${ast.type} belum didukung terminal`);
  }
}

function selesaikanRagu(sesi, id, commit) {
  if (!sesi.ragu || sesi.ragu.id !== id) {
    throw new SqlError(`ORA-02058: tidak ada transaksi ragu-ragu dengan ID '${id}'${sesi.ragu ? ` (yang ada: '${sesi.ragu.id}')` : ''}`);
  }
  const r = sesi.ragu;
  sesi.ragu = null;
  if (commit) {
    sesi.tabel = { ...r.tabelSesudah };
    sesi.komit = { ...sesi.tabel };
    return { jenis: 'ok', pesan: 'Commit paksa selesai.', detail: [`Transaksi ${id} di situs ${r.situs.join(', ')} dipaksa COMMIT. DBA wajib memastikan situs lain mengambil keputusan yang SAMA, atau terjadi hasil campuran.`] };
  }
  sesi.tabel = { ...r.tabelSebelum };
  sesi.komit = { ...sesi.tabel };
  return { jenis: 'ok', pesan: 'Rollback paksa selesai.', detail: [`Transaksi ${id} dibatalkan di situs ${r.situs.join(', ')}.`] };
}

const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

// ------------------------------------------------------------------ pemecah skrip

/**
 * Pecah masukan menjadi potongan: baris meta (\...) dan perintah SQL yang dipisah titik koma.
 * Pemisahan memakai tokenizer, sehingga titik koma di dalam string tidak memotong perintah.
 */
export function pecahMasukan(teks) {
  const out = [];
  const baris = String(teks).split('\n');
  let sql = [];
  let offset = 0;
  let awalSql = 0;
  const siramSql = () => {
    const potong = sql.join('\n');
    if (potong.trim()) out.push({ jenis: 'sql', teks: potong, awal: awalSql });
    sql = [];
  };
  for (const b of baris) {
    if (/^\s*\\/.test(b)) { siramSql(); out.push({ jenis: 'meta', teks: b.trim(), awal: offset }); }
    else { if (!sql.length) awalSql = offset; sql.push(b); }
    offset += b.length + 1;
  }
  siramSql();

  const hasil = [];
  for (const p of out) {
    if (p.jenis === 'meta') { hasil.push(p); continue; }
    let token;
    try { token = tokenize(p.teks); } catch (e) { hasil.push({ jenis: 'galat-token', teks: p.teks.trim(), pesan: e.message }); continue; }
    let mulai = null;
    let akhir = null;
    const dorong = () => {
      if (mulai !== null) hasil.push({ jenis: 'sql', teks: p.teks.slice(mulai, akhir).trim() });
      mulai = null; akhir = null;
    };
    for (const t of token) {
      if (t.type === 'punct' && t.value === ';') { dorong(); continue; }
      if (mulai === null) mulai = t.pos;
      akhir = t.end;
    }
    dorong();
  }
  return hasil;
}

// ------------------------------------------------------------------ perintah meta

const BANTUAN = [
  ['SELECT ... / WITH ... ', 'kueri; hasil ditampilkan sebagai tabel'],
  ['INSERT / UPDATE / DELETE', 'mengubah data sesi; kendala PK, FK, UNIQUE, CHECK, NOT NULL, tipe ditegakkan'],
  ['CREATE TABLE / VIEW / INDEX', 'DDL; melakukan COMMIT implisit seperti Oracle'],
  ['DROP TABLE t [CASCADE CONSTRAINTS]', 'hapus tabel'],
  ['COMMIT / ROLLBACK', 'autocommit MATI: perubahan tertunda sampai COMMIT'],
  ['SAVEPOINT s / ROLLBACK TO s', 'titik pemulihan di tengah transaksi'],
  ['DESC t', 'struktur tabel, kendala, dan siapa yang merujuknya'],
  ['EXPLAIN PLAN FOR SELECT ...', 'rencana eksekusi tanpa menampilkan baris'],
  ['SELECT * FROM user_tables', 'kamus data: user_tables, user_views, user_tab_columns, user_constraints, user_indexes, dba_2pc_pending'],
  ['\\d  atau  \\d nama', 'daftar objek, atau struktur satu objek'],
  ['\\db  atau  \\db nama', 'daftar preset basis data, atau pindah preset (sesi dimulai ulang)'],
  ['\\c situs', 'preset terdistribusi: pindah situs lokal (jakarta, bandung, surabaya)'],
  ['\\kunci cascade | restrict | setnull', 'ubah aturan ON DELETE semua kunci asing'],
  ['\\gagal situs | koordinator | off', 'injeksi kegagalan untuk COMMIT lintas situs berikutnya'],
  ['\\status', 'status transaksi: perubahan tertunda, savepoint, situs yang ditulis'],
  ['\\ekspor', 'skrip SQL Oracle (CREATE + INSERT) dari keadaan sesi saat ini'],
  ['\\reset', 'kembalikan preset ke data awal'],
  ['\\clear', 'bersihkan layar terminal'],
];

function jalankanMeta(sesi, baris) {
  const [perintah, ...arg] = baris.replace(/^\\/, '').trim().split(/\s+/);
  const a = arg.join(' ').trim();
  switch (kecil(perintah)) {
    case '?': case 'h': case 'help': case 'bantuan':
      return { jenis: 'tabel', judul: 'Bantuan terminal', relation: new Relation('bantuan', ['perintah', 'fungsi'], BANTUAN), detail: ['Ctrl+Enter menjalankan, ↑/↓ riwayat, Tab melengkapi nama tabel/kolom.'] };
    case 'd': case 'dt':
      if (a) return jelaskanObjek(sesi, a);
      return {
        jenis: 'tabel',
        judul: `${sesi.judul}${sesi.lokal ? ` · lokal: ${sesi.lokal}` : ''}`,
        relation: new Relation('objek', ['nama', 'jenis', 'baris', 'kolom', 'situs'], daftarObjek(sesi).map((o) => [o.nama, o.jenis, o.baris, o.kolom, o.situs || (o.jenis === 'VIEW' && sesi.situs ? 'global' : '')])),
        detail: [],
      };
    case 'db': {
      if (!a) return { jenis: 'tabel', judul: 'Preset basis data', relation: new Relation('preset', ['nama', 'judul', 'isi'], Object.entries(PRESET).map(([k, p]) => [k, p.judul, p.ringkas])), detail: [`Aktif: ${sesi.preset}. Pindah: \\db nama`] };
      if (!PRESET[kecil(a)]) throw new SqlError(`Preset "${a}" tidak ada. Pilihan: ${Object.keys(PRESET).join(', ')}`);
      return { jenis: 'ganti-preset', preset: kecil(a) };
    }
    case 'reset':
      return { jenis: 'ganti-preset', preset: sesi.preset };
    case 'c': case 'connect': {
      if (!sesi.situs) throw new SqlError('\\c hanya berlaku pada preset terdistribusi — ketik \\db terdistribusi');
      if (!sesi.situs.includes(kecil(a))) throw new SqlError(`Situs "${a}" tidak ada. Pilihan: ${sesi.situs.join(', ')}`);
      const blok = sesi.tertunda ? lakukanCommit(sesi, { implisit: true }) : [];
      sesi.lokal = kecil(a);
      return [...blok, { jenis: 'ok', pesan: `Terhubung ke situs ${sesi.lokal}.`, detail: [`Fragmen @${sesi.lokal} kini lokal; fragmen situs lain diakses lewat database link.`] }];
    }
    case 'kunci': {
      const peta = { cascade: 'CASCADE', restrict: 'RESTRICT', setnull: 'SET NULL', 'set-null': 'SET NULL', noaction: 'RESTRICT' };
      const aturan = peta[kecil(a)];
      if (!aturan) throw new SqlError('Pakai \\kunci cascade, \\kunci restrict, atau \\kunci setnull');
      let n = 0;
      for (const d of Object.values(sesi.kunci)) for (const f of d.fk || []) { f.onDelete = aturan; f.onUpdate = aturan === 'CASCADE' ? 'CASCADE' : null; n++; }
      sesi.modeKunci = kecil(a);
      return { jenis: 'ok', pesan: `Aturan ON DELETE semua kunci asing: ${aturan}.`, detail: [`${n} kunci asing diubah.${aturan === 'CASCADE' ? ' ON UPDATE CASCADE ikut aktif (bukan fitur Oracle).' : ''}`] };
    }
    case 'gagal': {
      if (!sesi.situs) throw new SqlError('\\gagal hanya berlaku pada preset terdistribusi');
      if (kecil(a) === 'off' || !a) { sesi.gagal = null; return { jenis: 'ok', pesan: 'Injeksi kegagalan dimatikan.', detail: [] }; }
      if (kecil(a) === 'koordinator') { sesi.gagal = { koordinator: true }; return { jenis: 'ok', pesan: 'Koordinator akan jatuh setelah peserta PREPARED pada COMMIT lintas situs berikutnya.', detail: ['Hasilnya transaksi ragu-ragu: lihat dba_2pc_pending, lalu COMMIT FORCE / ROLLBACK FORCE.'] }; }
      if (!sesi.situs.includes(kecil(a))) throw new SqlError(`Situs "${a}" tidak ada. Pilihan: ${sesi.situs.join(', ')}, koordinator, off`);
      sesi.gagal = { situs: kecil(a) };
      return { jenis: 'ok', pesan: `Situs ${kecil(a)} akan memilih VOTE-ABORT pada COMMIT lintas situs berikutnya.`, detail: ['Ubah data di minimal dua situs, lalu COMMIT.'] };
    }
    case 'status': {
      const st = statusTransaksi(sesi);
      return {
        jenis: 'tabel',
        judul: 'Status transaksi',
        relation: new Relation('status', ['butir', 'nilai'], [
          ['perubahan tertunda', st.tertunda],
          ['savepoint', st.savepoint.join(', ') || '-'],
          ['situs yang ditulis', st.situsTertulis.join(', ') || '-'],
          ['situs lokal', sesi.lokal || '-'],
          ['transaksi ragu-ragu', st.ragu ? `${st.ragu.id} (${st.ragu.situs.join(', ')})` : '-'],
          ['injeksi kegagalan', st.gagal ? (st.gagal.koordinator ? 'koordinator' : st.gagal.situs) : '-'],
        ]),
        detail: [],
      };
    }
    case 'ekspor': case 'export':
      return { jenis: 'teks', judul: 'Skrip SQL Oracle dari sesi ini', isi: eksporSql(sesi) };
    case 'clear': case 'cls':
      return { jenis: 'bersihkan' };
    default: {
      const s = saranNama(perintah, ['d', 'db', 'c', 'kunci', 'gagal', 'status', 'ekspor', 'reset', 'clear', 'help']);
      throw new SqlError(`Perintah meta \\${perintah} tidak dikenal${s.length ? ` — maksud Anda \\${s[0]}?` : ''}. Ketik \\? untuk bantuan.`);
    }
  }
}

// ------------------------------------------------------------------ API utama

/**
 * Jalankan masukan terminal (satu atau banyak perintah).
 * Mengembalikan blok keluaran berurutan; galat satu perintah tidak menghentikan
 * perintah berikutnya — sama seperti SQL*Plus dengan WHENEVER SQLERROR CONTINUE.
 * @returns {{blok: object[], sesi: object}}
 */
export function jalankan(sesi, masukan) {
  const blok = [];
  let aktif = sesi;
  for (const p of pecahMasukan(masukan)) {
    if (p.jenis === 'galat-token') { blok.push({ jenis: 'galat', perintah: p.teks, pesan: p.pesan, petunjuk: petunjukGalat(aktif, p.pesan) }); continue; }
    try {
      if (p.jenis === 'meta') {
        const r = [].concat(jalankanMeta(aktif, p.teks));
        for (const b of r) {
          if (b.jenis === 'ganti-preset') {
            aktif = buatSesi(b.preset);
            blok.push({ jenis: 'ok', perintah: p.teks, pesan: `Preset ${aktif.judul} dimuat.`, detail: [PRESET[b.preset].ringkas, 'Semua perubahan sesi sebelumnya dibuang.'] });
          } else blok.push({ perintah: p.teks, ...b });
        }
        continue;
      }
      const ast = parse(p.teks);
      ast.teks = p.teks;
      blok.push(...[].concat(jalankanPerintah(aktif, ast, p.teks)));
    } catch (e) {
      const pesan = e instanceof SqlError ? e.message : `Galat internal: ${e.message}`;
      blok.push({ jenis: 'galat', perintah: p.teks, pesan, petunjuk: petunjukGalat(aktif, pesan) });
    }
  }
  return { blok, sesi: aktif };
}

/**
 * Pratinjau langsung untuk kueri yang sedang diketik: hanya perintah BACA yang
 * dijalankan, basis data tidak pernah diubah. Dipanggil pada setiap ketikan.
 */
export function pratinjau(sesi, masukan) {
  const bagian = pecahMasukan(masukan).filter((p) => p.jenis !== 'meta');
  if (!bagian.length) return null;
  const p = bagian[bagian.length - 1];
  if (p.jenis === 'galat-token') return { jenis: 'galat', pesan: p.pesan, petunjuk: petunjukGalat(sesi, p.pesan) };
  const t0 = now();
  try {
    const ast = parse(p.teks);
    if (!['select', 'union', 'setop', 'with'].includes(ast.type)) {
      return { jenis: 'info', pesan: `${ast.type.replace('_', ' ').toUpperCase()} mengubah sesi — pratinjau hanya menjalankan kueri baca. Tekan Ctrl+Enter untuk menjalankan.` };
    }
    const db = dbUntuk(sesi, ast);
    const ctx = { db, steps: [], plan: null };
    const rel = evalNode(ast, ctx, {});
    const relation = new Relation(rel.name, rel.attrs.map((a) => a.split('.').pop()).map((a, i, arr) => (arr.indexOf(a) !== i ? rel.attrs[i] : a)), rel.rows);
    return { jenis: 'hasil', relation, plan: tandaiRemote(ctx.plan, sesi.lokal), akses: sesi.situs ? analisisAkses(sesi, ast) : null, ms: now() - t0, perintah: p.teks };
  } catch (e) {
    return { jenis: 'galat', pesan: e.message, petunjuk: petunjukGalat(sesi, e.message), perintah: p.teks };
  }
}

const KATA_KUNCI = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN', 'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS NULL', 'DISTINCT', 'UNION', 'UNION ALL', 'INTERSECT', 'MINUS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'WITH', 'AS', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'CREATE VIEW', 'DROP TABLE', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'DESC', 'EXPLAIN PLAN FOR', 'FETCH FIRST', 'ROWS ONLY', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'NUMBER', 'VARCHAR2', 'DATE'];

/**
 * Saran pelengkap untuk kata yang sedang diketik di posisi kursor.
 * @returns {{awal:number, akhir:number, awalan:string, kandidat:string[]}}
 */
export function saranLengkap(sesi, teks, posisi = String(teks).length) {
  const sebelum = String(teks).slice(0, posisi);
  const m = /[\\A-Za-z0-9_@$.]*$/.exec(sebelum);
  const kata = m ? m[0] : '';
  const awal = posisi - kata.length;
  const hasil = (awalan, kandidat, geser = 0) => {
    const unik = [...new Set(kandidat)];
    const cocok = unik.filter((k) => kecil(k).startsWith(kecil(awalan)) && kecil(k) !== kecil(awalan));
    return { awal: awal + geser, akhir: posisi, awalan, kandidat: cocok.sort((a, b) => a.length - b.length || a.localeCompare(b)).slice(0, 12) };
  };
  if (kata.startsWith('\\')) return hasil(kata, ['\\d', '\\db', '\\c', '\\kunci', '\\gagal', '\\status', '\\ekspor', '\\reset', '\\clear', '\\?']);
  if (!kata) return { awal, akhir: posisi, awalan: '', kandidat: [] };

  const objek = [...Object.keys(sesi.tabel), ...sesi.view.map((v) => v.nama), ...KAMUS];
  const alias = new Map();
  for (const a of String(teks).matchAll(/\b(?:FROM|JOIN|UPDATE|INTO)\s+([A-Za-z_][\w@$]*)(?:\s+(?:AS\s+)?([A-Za-z_]\w*))?/gi)) {
    const t = a[1];
    const al = a[2] && !/^(WHERE|JOIN|ON|LEFT|RIGHT|FULL|INNER|CROSS|GROUP|ORDER|SET|VALUES|UNION|MINUS|INTERSECT|HAVING|FETCH|LIMIT)$/i.test(a[2]) ? a[2] : t;
    alias.set(kecil(al), t);
    alias.set(kecil(t), t);
  }
  const kolomObjek = (nama) => {
    const t = cari(sesi.tabel, nama);
    if (t) return sesi.tabel[t].attrs;
    const v = cariView(sesi, nama);
    if (v) { try { return materialisasiView(sesi, v, new Set()).attrs; } catch { return []; } }
    const k = kamusData(sesi, nama);
    return k ? k.attrs : [];
  };
  if (kata.includes('.')) {
    const [kiri, kanan] = [kata.slice(0, kata.lastIndexOf('.')), kata.slice(kata.lastIndexOf('.') + 1)];
    const t = alias.get(kecil(kiri)) || kiri;
    return hasil(kanan, kolomObjek(t), kiri.length + 1);
  }
  const kolom = [...alias.values()].flatMap(kolomObjek);
  return hasil(kata, [...objek, ...kolom, ...KATA_KUNCI]);
}

/** Skrip Oracle dari keadaan sesi: CREATE TABLE lengkap dengan kendala, INSERT, dan view. */
export function eksporSql(sesi) {
  const baris = [`-- Diekspor dari terminal ORACLEDECK · preset ${sesi.preset}`, '-- Jalankan di Oracle (SQL*Plus/SQL Developer). Tabel induk dibuat lebih dulu.', ''];
  const nama = Object.keys(sesi.tabel);
  const urut = [];
  const kunjung = new Set();
  const dfs = (n) => {
    if (kunjung.has(n)) return;
    kunjung.add(n);
    for (const f of (sesi.kunci[n] || {}).fk || []) if (f.ref !== n && sesi.tabel[f.ref]) dfs(f.ref);
    urut.push(n);
  };
  nama.forEach(dfs);
  const polos = (n) => ident(String(n).split('@')[0]);
  for (const n of urut) {
    const rel = sesi.tabel[n];
    const def = sesi.kunci[n] || { kolom: kolomDari(rel, {}), pk: [], fk: [], unik: [], cek: [] };
    const s = situsDari(n);
    if (s) baris.push(`-- fragmen situs ${s}: jalankan di basis data ${s.toUpperCase()}`);
    const isi = def.kolom.map((k) => `  ${ident(k.nama).padEnd(20)} ${tulisTipe(k)}${k.default ? ` DEFAULT ${exprToString(k.default)}` : ''}${k.notNull ? ' NOT NULL' : ''}`);
    const t = String(n).split('@')[0].toUpperCase();
    if (def.pk.length) isi.push(`  CONSTRAINT PK_${t} PRIMARY KEY (${def.pk.map(ident).join(', ')})`);
    (def.unik || []).filter((u) => !u.dariIndeks).forEach((u, i) => isi.push(`  CONSTRAINT ${u.nama ? ident(u.nama) : `UQ_${t}_${i + 1}`} UNIQUE (${u.cols.map(ident).join(', ')})`));
    (def.cek || []).forEach((c, i) => isi.push(`  CONSTRAINT ${c.nama ? ident(c.nama) : `CK_${t}_${i + 1}`} CHECK (${exprToString(c.expr)})`));
    (def.fk || []).forEach((f, i) => isi.push(`  CONSTRAINT ${f.nama ? ident(f.nama) : `FK_${t}_${i + 1}`} FOREIGN KEY (${f.cols.map(ident).join(', ')}) REFERENCES ${polos(f.ref)} (${f.refCols.map(ident).join(', ')})${f.onDelete && f.onDelete !== 'RESTRICT' ? ` ON DELETE ${f.onDelete}` : ''}`));
    baris.push(`CREATE TABLE ${polos(n)} (\n${isi.join(',\n')}\n);`);
    for (const r of rel.rows) {
      const nilai = r.map((v, i) => {
        const k = def.kolom[i];
        if (v !== null && k && k.tipe === 'DATE') return `DATE '${v}'`;
        return literal(v);
      });
      baris.push(`INSERT INTO ${polos(n)} (${rel.attrs.map(ident).join(', ')}) VALUES (${nilai.join(', ')});`);
    }
    baris.push('');
  }
  for (const x of sesi.indeks) baris.push(`CREATE ${x.unik ? 'UNIQUE ' : ''}INDEX ${ident(x.nama)} ON ${polos(x.table)} (${x.kolom.map(ident).join(', ')});`);
  for (const v of sesi.view) {
    const sql = v.sql.replace(/([A-Za-z_]\w*)@([A-Za-z_]\w*)/g, (_, t, s) => `${t.toUpperCase()}@${s.toUpperCase()}`);
    baris.push(`CREATE OR REPLACE VIEW ${ident(v.nama)}${v.kolom ? ` (${v.kolom.map(ident).join(', ')})` : ''} AS\n  ${sql};`);
  }
  baris.push('COMMIT;');
  return baris.join('\n');
}
