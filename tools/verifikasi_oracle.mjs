// verifikasi_oracle.mjs — bandingkan mesin ORACLEDECK dengan Oracle sungguhan.
//
//   1. 53 kueri acuan + 7 skrip DML: isi hasil wajib identik (seperti verify_sqlite.py)
//   2. kasus galat bersama (src/content/kasus-galat-oracle.js): kode ORA wajib sama
//   3. skrip \ekspor Terminal SQL dari empat preset: wajib jalan tanpa galat dan
//      jumlah baris setiap tabel wajib sama dengan sesi asalnya
//
// Semua berjalan di skema VERIF pada situs pusat container oracledeck-oracle.
// Jalankan: node tools/verifikasi_oracle.mjs   (butuh Docker; lihat tools/oracle_docker.mjs)
// Keluaran: oracle/verifikasi-mesin.json dan oracle/VERIFIKASI_MESIN.md

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, siapkanKontainer, sqlplus, kodeGalat, bannerOracle, acak } from './oracle_docker.mjs';
import { KUERI, SKRIP } from './export_for_verify.js';
import { akademik, rumahsakit, dreamhome } from '../engine/data/datasets.js';
import { query } from '../engine/core/sql.js';
import { executeScript, salinDb } from '../engine/core/dml.js';
import * as T from '../engine/core/terminal.js';
import { KASUS_GALAT } from '../src/content/kasus-galat-oracle.js';

const log = (s) => process.stdout.write(`${s}\n`);
const db = { ...akademik(), ...rumahsakit(), ...dreamhome() };

const PEMBUKA = [
  'SET MARKUP CSV ON QUOTE ON',
  'SET FEEDBACK OFF',
  'SET NUMWIDTH 38',
  "ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD';",
  "ALTER SESSION SET NLS_NUMERIC_CHARACTERS = '.,';",
].join('\n');

// ------------------------------------------------------------------ bantu

/** Dialek: LIMIT n [OFFSET m] (dipakai kueri acuan SQLite) -> sintaks Oracle. */
export function keOracle(sql) {
  return String(sql).replace(/\bLIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?\s*$/i, (_, n, m) => `${m ? `OFFSET ${m} ROWS ` : ''}FETCH NEXT ${n} ROWS ONLY`);
}

/** Urai CSV SQL*Plus (QUOTE ON): string berkutip, angka polos, NULL kosong. */
export function uraiCsv(teks) {
  const baris = [];
  for (const b of String(teks).split('\n')) {
    if (!b.trim()) continue;
    const sel = [];
    let i = 0;
    while (i <= b.length) {
      if (b[i] === '"') {
        let j = i + 1; let v = '';
        while (j < b.length) {
          if (b[j] === '"' && b[j + 1] === '"') { v += '"'; j += 2; continue; }
          if (b[j] === '"') break;
          v += b[j]; j++;
        }
        sel.push({ s: v });
        i = j + 2;
      } else {
        const j = b.indexOf(',', i);
        const mentah = (j < 0 ? b.slice(i) : b.slice(i, j)).trim();
        sel.push(mentah === '' ? null : Number(mentah));
        i = j < 0 ? b.length + 1 : j + 1;
      }
    }
    baris.push(sel.map((x) => (x && typeof x === 'object' ? x.s : x)));
  }
  return baris;
}

const normal = (v) => {
  if (v === null || v === undefined || v === '') return null; // Oracle: string kosong = NULL
  if (typeof v === 'number') return Math.round(v * 1e6) / 1e6;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return String(v);
};
const kunciBaris = (r) => JSON.stringify(r.map(normal));

export function bandingkan(harap, dapat, berurut) {
  if (harap.length !== dapat.length) return `jumlah baris berbeda: mesin ${harap.length}, Oracle ${dapat.length}`;
  if (berurut) {
    for (let i = 0; i < harap.length; i++) {
      if (kunciBaris(harap[i]) !== kunciBaris(dapat[i])) return `baris ke-${i + 1} berbeda: mesin ${kunciBaris(harap[i])}, Oracle ${kunciBaris(dapat[i])}`;
    }
    return null;
  }
  const hitung = (rows) => rows.reduce((m, r) => m.set(kunciBaris(r), (m.get(kunciBaris(r)) || 0) + 1), new Map());
  const a = hitung(harap); const b = hitung(dapat);
  for (const [k, n] of a) if (b.get(k) !== n) return `isi berbeda pada ${k}: mesin ${n}×, Oracle ${b.get(k) || 0}×`;
  return null;
}

/** Potong keluaran per penanda PROMPT @@<id>. */
function potong(keluaran) {
  const bagian = new Map();
  let kini = null;
  for (const b of keluaran.split('\n')) {
    const m = /^@@(\S+)\s*$/.exec(b.trim());
    if (m) { kini = m[1]; bagian.set(kini, []); continue; }
    if (kini) bagian.get(kini).push(b);
  }
  return new Map([...bagian].map(([k, v]) => [k, v.join('\n')]));
}

const literal = (v) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

// ------------------------------------------------------------------ skema VERIF

function siapkanSkema(sandi) {
  const r = sqlplus(`BEGIN
  FOR u IN (SELECT username FROM dba_users WHERE username = 'VERIF') LOOP EXECUTE IMMEDIATE 'DROP USER VERIF CASCADE'; END LOOP;
  FOR t IN (SELECT tablespace_name FROM dba_tablespaces WHERE tablespace_name = 'TS_VERIF') LOOP EXECUTE IMMEDIATE 'DROP TABLESPACE TS_VERIF INCLUDING CONTENTS AND DATAFILES'; END LOOP;
END;
/
ALTER SYSTEM SET db_create_file_dest = '/opt/oracle/oradata' SCOPE = BOTH;
CREATE TABLESPACE TS_VERIF DATAFILE SIZE 50M AUTOEXTEND ON NEXT 10M MAXSIZE 1G;
CREATE USER VERIF IDENTIFIED BY "${sandi}" DEFAULT TABLESPACE TS_VERIF QUOTA UNLIMITED ON TS_VERIF;
GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, FORCE TRANSACTION TO VERIF;
SELECT 'SIAP=' || COUNT(*) FROM dba_users WHERE username = 'VERIF';`, { situs: 'jakarta', sebagai: 'sys' });
  if (!/SIAP=1/.test(r.keluaran)) throw new Error(`skema VERIF gagal dibuat:\n${r.keluaran}`);
}

const verif = (sql, sandi) => sqlplus(sql.replace(/^/, ''), { situs: 'jakarta', sebagai: 'rs_app', sandiApp: sandi, definisi: {} });

function sambungVerif(sql, sandi) {
  // sqlplus() menyambung sebagai rs_app; untuk skema VERIF nama pengguna diganti lewat CONNECT di awal
  return sqlplus(`CONNECT verif/"${sandi}"@//localhost:1521/FREEPDB1\n${sql}`, { situs: 'jakarta', sebagai: 'sys', sandiApp: sandi });
}

function muatData(sandi) {
  const perintah = [];
  for (const [nama, rel] of Object.entries(db)) {
    const kolom = rel.attrs.map((a, i) => {
      const nilai = rel.rows.map((r) => r[i]).filter((v) => v !== null);
      const angka = nilai.length > 0 && nilai.every((v) => typeof v === 'number');
      return `${a} ${angka ? 'NUMBER' : 'VARCHAR2(200)'}`;
    });
    perintah.push(`CREATE TABLE ${nama} (${kolom.join(', ')});`);
    for (const r of rel.rows) perintah.push(`INSERT INTO ${nama} VALUES (${r.map(literal).join(', ')});`);
  }
  perintah.push('COMMIT;');
  const r = sambungVerif(perintah.join('\n'), sandi);
  const galat = kodeGalat(r.keluaran);
  if (galat.length) throw new Error(`memuat data gagal (${galat.join(', ')}):\n${r.keluaran.slice(0, 2000)}`);
  return Object.keys(db).length;
}

// ------------------------------------------------------------------ 1. kueri & DML

function verifikasiKueri(sandi) {
  const hasil = [];
  const isi = [PEMBUKA];
  for (const [id, sql] of KUERI) isi.push(`PROMPT @@${id}`, `${keOracle(sql)};`);
  isi.push('PROMPT @@selesai');
  const bagian = potong(sambungVerif(isi.join('\n'), sandi).keluaran);
  for (const [id, sql] of KUERI) {
    const teks = bagian.get(id) || '';
    const kode = kodeGalat(teks);
    const harap = query(sql, db).rows;
    if (kode.length) { hasil.push({ id, jenis: 'kueri', status: 'GAGAL', alasan: `Oracle menolak: ${kode.join(', ')}` }); continue; }
    const rows = uraiCsv(teks).slice(1); // baris pertama = kepala kolom
    const beda = bandingkan(harap, rows, /ORDER BY/i.test(sql));
    hasil.push({ id, jenis: 'kueri', status: beda ? 'GAGAL' : 'LULUS', baris: harap.length, alasan: beda });
  }

  for (const [id, perintah, penutup] of SKRIP) {
    const salinan = salinDb(db);
    const r = executeScript(perintah.join(';\n'), salinan);
    const harap = r.galat ? null : query(penutup, salinan).rows;
    const keluaran = sambungVerif([PEMBUKA, ...perintah.map((p) => `${keOracle(p)};`), 'PROMPT @@hasil', `${keOracle(penutup)};`, 'PROMPT @@akhir', 'ROLLBACK;'].join('\n'), sandi).keluaran;
    const kodeSemua = kodeGalat(keluaran);
    if (kodeSemua.length || !harap) { hasil.push({ id, jenis: 'dml', status: 'GAGAL', alasan: kodeSemua.length ? `Oracle menolak: ${kodeSemua.join(', ')}` : `mesin gagal: ${r.galat}` }); continue; }
    const rows = uraiCsv(potong(keluaran).get('hasil') || '').slice(1);
    const beda = bandingkan(harap, rows, /ORDER BY/i.test(penutup));
    hasil.push({ id, jenis: 'dml', status: beda ? 'GAGAL' : 'LULUS', baris: harap.length, alasan: beda });
  }
  return hasil;
}

// ------------------------------------------------------------------ 2. kode galat

function verifikasiGalat(sandi) {
  const isi = [PEMBUKA];
  for (const k of KASUS_GALAT) {
    isi.push(`PROMPT @@siap-${k.id}`, ...k.persiapan.map((p) => `${p};`), `PROMPT @@uji-${k.id}`, `${k.perintah};`);
  }
  isi.push('PROMPT @@selesai');
  const bagian = potong(sambungVerif(isi.join('\n'), sandi).keluaran);
  return KASUS_GALAT.map((k) => {
    const s = T.buatSesi('kosong');
    T.jalankan(s, k.persiapan.map((p) => `${p};`).join('\n'));
    const blok = T.jalankan(s, k.perintah).blok.pop();
    const kodeMesin = blok.jenis === 'galat' ? ((/ORA-\d{5}/.exec(blok.pesan) || [])[0] || '(tanpa kode)') : '(tidak galat)';
    const siap = kodeGalat(bagian.get(`siap-${k.id}`) || '');
    const kodeOracle = kodeGalat(bagian.get(`uji-${k.id}`) || '')[0] || '(tidak galat)';
    const status = !siap.length && kodeOracle === k.kode && kodeMesin === k.kode ? 'LULUS' : 'GAGAL';
    return { id: k.id, jenis: 'galat', status, kodeDiharapkan: k.kode, kodeOracle, kodeMesin, persiapanGagal: siap, arti: k.arti };
  });
}

// ------------------------------------------------------------------ 3. ekspor terminal

function verifikasiEkspor(sandi) {
  const hasil = [];
  for (const preset of ['rumahsakit', 'akademik', 'dreamhome', 'kependudukan']) {
    const sesi = T.buatSesi(preset);
    const skrip = T.eksporSql(sesi);
    const bersihkan = `BEGIN
  FOR v IN (SELECT view_name FROM user_views) LOOP EXECUTE IMMEDIATE 'DROP VIEW "' || v.view_name || '"'; END LOOP;
  FOR t IN (SELECT table_name FROM user_tables) LOOP EXECUTE IMMEDIATE 'DROP TABLE "' || t.table_name || '" CASCADE CONSTRAINTS PURGE'; END LOOP;
END;
/`;
    const hitungan = Object.keys(sesi.tabel).map((t) => `SELECT '${t.toUpperCase()}=' || COUNT(*) FROM ${t};`).join('\n');
    const keluaran = sambungVerif(`SET DEFINE OFF\n${bersihkan}\n${skrip}\nSET MARKUP CSV OFF\nSET HEADING OFF\nSET FEEDBACK OFF\n${hitungan}`, sandi).keluaran;
    const kode = kodeGalat(keluaran);
    const beda = Object.entries(sesi.tabel).filter(([t, rel]) => !new RegExp(`^${t.toUpperCase()}=${rel.cardinality}\\s*$`, 'm').test(keluaran)).map(([t]) => t);
    hasil.push({
      id: `ekspor-${preset}`, jenis: 'ekspor', status: !kode.length && !beda.length ? 'LULUS' : 'GAGAL',
      tabel: Object.keys(sesi.tabel).length, view: sesi.view.length,
      alasan: kode.length ? `Oracle menolak: ${[...new Set(kode)].join(', ')}` : beda.length ? `jumlah baris berbeda: ${beda.join(', ')}` : null,
      cuplikanGalat: kode.length ? keluaran.split('\n').filter((b) => /^(ORA|SP2)-\d+:|^\S.*\n?\s*\*$/.test(b)).slice(0, 6) : [],
    });
  }
  return hasil;
}

// ------------------------------------------------------------------ utama

function main() {
  siapkanKontainer({ log });
  const banner = bannerOracle();
  log(banner);
  const sandi = acak();
  siapkanSkema(sandi);
  log(`skema VERIF siap, ${muatData(sandi)} tabel dimuat`);

  const kueri = verifikasiKueri(sandi);
  const galat = verifikasiGalat(sandi);
  const ekspor = verifikasiEkspor(sandi);
  const semua = [...kueri, ...galat, ...ekspor];
  for (const h of semua) if (h.status !== 'LULUS') log(`  x ${h.jenis} ${h.id}: ${h.alasan || `mesin ${h.kodeMesin}, Oracle ${h.kodeOracle}, diharapkan ${h.kodeDiharapkan}`}`);

  const lulus = (d) => d.filter((h) => h.status === 'LULUS').length;
  const ringkas = {
    oracle: banner,
    tanggal: new Date().toISOString().slice(0, 10),
    kueri: { lulus: lulus(kueri.filter((h) => h.jenis === 'kueri')), jumlah: kueri.filter((h) => h.jenis === 'kueri').length },
    dml: { lulus: lulus(kueri.filter((h) => h.jenis === 'dml')), jumlah: kueri.filter((h) => h.jenis === 'dml').length },
    galat: { lulus: lulus(galat), jumlah: galat.length },
    ekspor: { lulus: lulus(ekspor), jumlah: ekspor.length },
    hasil: semua,
  };
  writeFileSync(join(ROOT, 'oracle', 'verifikasi-mesin.json'), `${JSON.stringify(ringkas, null, 2)}\n`);
  writeFileSync(join(ROOT, 'oracle', 'VERIFIKASI_MESIN.md'), `${[
    '# Verifikasi mesin ORACLEDECK terhadap Oracle sungguhan',
    '',
    `Dijalankan \`node tools/verifikasi_oracle.mjs\` pada **${ringkas.tanggal}** — ${banner}.`,
    '',
    '| Pemeriksaan | Lulus |',
    '|---|---|',
    `| Kueri acuan: isi hasil identik | ${ringkas.kueri.lulus}/${ringkas.kueri.jumlah} |`,
    `| Skrip DML: keadaan tabel identik | ${ringkas.dml.lulus}/${ringkas.dml.jumlah} |`,
    `| Kasus galat: kode ORA sama | ${ringkas.galat.lulus}/${ringkas.galat.jumlah} |`,
    `| \\ekspor Terminal SQL: jalan di Oracle, jumlah baris sama | ${ringkas.ekspor.lulus}/${ringkas.ekspor.jumlah} |`,
    '',
    'Catatan metode: tabel data dimuat sebagai NUMBER/VARCHAR2 (tanggal disimpan sebagai teks YYYY-MM-DD);',
    '`LIMIT n OFFSET m` pada kueri acuan diterjemahkan ke `OFFSET m ROWS FETCH NEXT n ROWS ONLY`;',
    "sesi Oracle memakai `NLS_DATE_FORMAT = 'YYYY-MM-DD'`.",
    '',
    '## Kode galat',
    '',
    '| Kasus | Arti | Diharapkan | Oracle | Mesin | Status |',
    '|---|---|---|---|---|---|',
    ...galat.map((h) => `| \`${h.id}\` | ${h.arti} | ${h.kodeDiharapkan} | ${h.kodeOracle} | ${h.kodeMesin} | ${h.status} |`),
    '',
    '## Kueri, DML, dan ekspor',
    '',
    '| Id | Jenis | Status | Keterangan |',
    '|---|---|---|---|',
    ...[...kueri, ...ekspor].map((h) => `| \`${h.id}\` | ${h.jenis} | ${h.status} | ${h.alasan || (h.baris !== undefined ? `${h.baris} baris` : `${h.tabel} tabel, ${h.view} view`)} |`),
  ].join('\n')}\n`);

  log(`kueri ${ringkas.kueri.lulus}/${ringkas.kueri.jumlah} · DML ${ringkas.dml.lulus}/${ringkas.dml.jumlah} · kode galat ${ringkas.galat.lulus}/${ringkas.galat.jumlah} · ekspor ${ringkas.ekspor.lulus}/${ringkas.ekspor.jumlah}`);
  if (semua.some((h) => h.status !== 'LULUS')) process.exit(1);
}

void verif;
if (process.argv[1] && /verifikasi_oracle\.mjs$/.test(process.argv[1].replace(/\\/g, '/'))) main();
