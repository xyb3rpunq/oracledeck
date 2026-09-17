// oracle_docker.mjs — utilitas menjalankan SQL*Plus di container Oracle Free.
// Dipakai tools/uji_oracle.mjs dan tools/verifikasi_oracle.mjs. Nol dependensi.
//
// Konfigurasi lewat variabel lingkungan (semua opsional):
//   ORACLEDECK_KONTAINER  nama container          (bawaan: oracledeck-oracle)
//   ORACLEDECK_IMAGE      image Oracle            (bawaan: gvenzl/oracle-free:23-slim)
//   ORACLEDECK_PORT       port host               (bawaan: 1522)
//   ORACLE_PASSWORD       sandi SYS               (bawaan: dibaca/dibuat di tools/.cache/oracle-lokal.json)
//   ORACLEDECK_CDB        layanan CDB             (bawaan: FREE)
//   ORACLEDECK_PDB        PDB situs pusat         (bawaan: FREEPDB1)

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, '..');
const CACHE = join(ROOT, 'tools', '.cache');
const BERKAS_SANDI = join(CACHE, 'oracle-lokal.json');

export const KONFIG = {
  kontainer: process.env.ORACLEDECK_KONTAINER || 'oracledeck-oracle',
  image: process.env.ORACLEDECK_IMAGE || 'gvenzl/oracle-free:23-slim',
  port: process.env.ORACLEDECK_PORT || '1522',
  cdb: process.env.ORACLEDECK_CDB || 'FREE',
  pdb: process.env.ORACLEDECK_PDB || 'FREEPDB1',
};

export const layanan = (situs) => ({ cdb: KONFIG.cdb, jakarta: KONFIG.pdb, bandung: 'BANDUNG', surabaya: 'SURABAYA' }[situs] || situs);

const acak = () => randomBytes(12).toString('hex');

/** Sandi SYS: dari lingkungan, atau disimpan lokal (folder cache tidak ikut git). */
export function sandiSys() {
  if (process.env.ORACLE_PASSWORD) return process.env.ORACLE_PASSWORD;
  if (existsSync(BERKAS_SANDI)) return JSON.parse(readFileSync(BERKAS_SANDI, 'utf8')).sys;
  mkdirSync(CACHE, { recursive: true });
  const sys = acak();
  writeFileSync(BERKAS_SANDI, JSON.stringify({ sys }, null, 2));
  return sys;
}

export function docker(args, { input = null, izinkanGagal = false } = {}) {
  const r = spawnSync('docker', args, { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`docker tidak dapat dijalankan: ${r.error.message}`);
  if (r.status !== 0 && !izinkanGagal) throw new Error(`docker ${args.join(' ')} gagal:\n${r.stderr || r.stdout}`);
  return r;
}

const tidur = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Pastikan container ada, berjalan, dan basis datanya siap menerima sambungan. */
export function siapkanKontainer({ log = () => {} } = {}) {
  const ada = docker(['inspect', '-f', '{{.State.Running}}', KONFIG.kontainer], { izinkanGagal: true });
  if (ada.status !== 0) {
    log(`membuat container ${KONFIG.kontainer} dari ${KONFIG.image} (port ${KONFIG.port})`);
    docker(['run', '-d', '--name', KONFIG.kontainer, '-p', `${KONFIG.port}:1521`, '-e', `ORACLE_PASSWORD=${sandiSys()}`, KONFIG.image]);
  } else if (ada.stdout.trim() !== 'true') {
    log(`menyalakan container ${KONFIG.kontainer}`);
    docker(['start', KONFIG.kontainer]);
  }
  const mulai = Date.now();
  for (;;) {
    const l = docker(['logs', KONFIG.kontainer], { izinkanGagal: true });
    if (/DATABASE IS READY TO USE/.test(`${l.stdout}${l.stderr}`)) {
      const uji = sqlplus('SELECT 1 AS siap FROM dual;', { situs: 'cdb', sebagai: 'sys' });
      if (/^\s*1\s*$/m.test(uji.keluaran)) break;
    }
    if (Date.now() - mulai > 15 * 60 * 1000) throw new Error('Oracle tidak siap dalam 15 menit');
    tidur(5000);
  }
  log(`Oracle siap (${Math.round((Date.now() - mulai) / 1000)} detik)`);
}

/**
 * Jalankan SQL lewat SQL*Plus di dalam container.
 * Definisi (termasuk sandi) dimuat dengan ECHO OFF; perintah skrip di-echo agar log bisa dibaca.
 * @returns {{keluaran:string, ms:number}}
 */
export function sqlplus(sql, { situs = 'jakarta', sebagai = 'rs_app', definisi = {}, sandiApp = null, echo = false } = {}) {
  const svc = layanan(situs);
  const sambung = sebagai === 'sys'
    ? `sys/${sandiSys()}@//localhost:1521/${svc} as sysdba`
    : `rs_app/${sandiApp}@//localhost:1521/${svc}`;
  const lokal = mkdtempSync(join(tmpdir(), 'oracledeck-sql-'));
  const nama = `jalan-${acak().slice(0, 8)}`;
  const def = [
    'SET ECHO OFF', 'SET VERIFY OFF', 'SET DEFINE ON', 'SET FEEDBACK ON', 'SET LINESIZE 250', 'SET PAGESIZE 500',
    'SET TRIMOUT ON', 'SET TRIMSPOOL ON', 'SET TAB OFF', 'SET SQLBLANKLINES ON', 'SET SERVEROUTPUT ON', 'SET LONG 4000',
    'WHENEVER SQLERROR CONTINUE', 'WHENEVER OSERROR CONTINUE',
    ...Object.entries(definisi).map(([k, v]) => `DEFINE ${k} = "${String(v).replace(/"/g, '')}"`),
  ].join('\n');
  writeFileSync(join(lokal, `${nama}-def.sql`), `${def}\n`);
  writeFileSync(join(lokal, `${nama}-isi.sql`), `${sql.replace(/\r\n/g, '\n')}\n`);
  writeFileSync(join(lokal, `${nama}.sql`), `@/tmp/oracledeck/${nama}-def.sql\n${echo ? 'SET ECHO ON\n' : ''}@/tmp/oracledeck/${nama}-isi.sql\nEXIT\n`);
  docker(['exec', KONFIG.kontainer, 'mkdir', '-p', '/tmp/oracledeck']);
  for (const f of [`${nama}-def.sql`, `${nama}-isi.sql`, `${nama}.sql`]) docker(['cp', join(lokal, f), `${KONFIG.kontainer}:/tmp/oracledeck/${f}`]);
  rmSync(lokal, { recursive: true, force: true });
  const t0 = Date.now();
  // mode senyap (-S) menekan ECHO; untuk log bukti dipakai mode biasa agar perintah ikut tercetak
  const r = docker(['exec', KONFIG.kontainer, 'sqlplus', ...(echo ? [] : ['-S']), '-L', sambung, `@/tmp/oracledeck/${nama}.sql`], { izinkanGagal: true });
  const ms = Date.now() - t0;
  docker(['exec', KONFIG.kontainer, 'rm', '-f', `/tmp/oracledeck/${nama}-def.sql`, `/tmp/oracledeck/${nama}-isi.sql`, `/tmp/oracledeck/${nama}.sql`], { izinkanGagal: true });
  let keluaran = `${r.stdout || ''}${r.stderr || ''}`.replace(/\r\n/g, '\n');
  for (const rahasia of [sandiSys(), sandiApp].filter(Boolean)) keluaran = keluaran.split(rahasia).join('********');
  return { keluaran, ms };
}

/**
 * Kode galat (ORA/SP2/PLS) yang benar-benar dilaporkan SQL*Plus: hanya baris yang DIAWALI kode.
 * Teks perintah yang di-echo (mis. komentar yang menyebut ORA-14661) tidak ikut terhitung.
 */
export function kodeGalat(keluaran) {
  return [...keluaran.matchAll(/^(?:ERROR: )?((?:ORA|SP2|PLS)-\d{4,5}):/gm)].map((m) => m[1]);
}

export function bannerOracle() {
  const r = sqlplus("SET HEADING OFF\nSET FEEDBACK OFF\nSELECT banner_full FROM v$version WHERE ROWNUM = 1;", { situs: 'cdb', sebagai: 'sys' });
  return r.keluaran.split('\n').map((x) => x.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ');
}

export { acak };
