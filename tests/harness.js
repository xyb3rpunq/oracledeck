// harness.js — kerangka uji minimal, nol dependensi.

export const daftar = [];
let grupAktif = 'umum';

export function grup(nama) { grupAktif = nama; }

export function uji(nama, fn) { daftar.push({ grup: grupAktif, nama, fn }); }

export class GagalUji extends Error {
  constructor(pesan) { super(pesan); this.name = 'GagalUji'; }
}

function tampil(v) {
  if (typeof v === 'string') return JSON.stringify(v);
  if (v && typeof v === 'object' && 'attrs' in v && 'rows' in v) return `Relation(${v.name}: ${v.attrs.join(',')} x${v.rows.length})`;
  try { return JSON.stringify(v); } catch { return String(v); }
}

export function benar(nilai, pesan = '') {
  if (nilai !== true) throw new GagalUji(`${pesan || 'diharapkan true'} — dapat ${tampil(nilai)}`);
}

export function salah(nilai, pesan = '') {
  if (nilai !== false) throw new GagalUji(`${pesan || 'diharapkan false'} — dapat ${tampil(nilai)}`);
}

export function sama(aktual, harap, pesan = '') {
  const a = JSON.stringify(aktual);
  const b = JSON.stringify(harap);
  if (a !== b) throw new GagalUji(`${pesan ? `${pesan}: ` : ''}diharapkan ${b}, dapat ${a}`);
}

export function samaAngka(aktual, harap, toleransi = 1e-9, pesan = '') {
  if (typeof aktual !== 'number' || Number.isNaN(aktual)) throw new GagalUji(`${pesan ? `${pesan}: ` : ''}bukan angka — ${tampil(aktual)}`);
  if (Math.abs(aktual - harap) > toleransi) throw new GagalUji(`${pesan ? `${pesan}: ` : ''}diharapkan ${harap} (±${toleransi}), dapat ${aktual}`);
}

export function memuat(teks, potongan, pesan = '') {
  if (!String(teks).includes(potongan)) throw new GagalUji(`${pesan ? `${pesan}: ` : ''}teks tidak memuat ${tampil(potongan)}\n--- teks:\n${teks}`);
}

export function tidakMemuat(teks, potongan, pesan = '') {
  if (String(teks).includes(potongan)) throw new GagalUji(`${pesan ? `${pesan}: ` : ''}teks seharusnya tidak memuat ${tampil(potongan)}`);
}

export function melempar(fn, cocok = null, pesan = '') {
  let terlempar = false;
  let err = null;
  try { fn(); } catch (e) { terlempar = true; err = e; }
  if (!terlempar) throw new GagalUji(`${pesan || 'diharapkan melempar galat'}, tetapi tidak ada galat`);
  if (cocok && !String(err.message).includes(cocok)) {
    throw new GagalUji(`${pesan ? `${pesan}: ` : ''}pesan galat "${err.message}" tidak memuat "${cocok}"`);
  }
  return err;
}

export function relasiSama(aktual, harap, pesan = '') {
  if (!aktual.equals(harap)) {
    throw new GagalUji(`${pesan ? `${pesan}: ` : ''}relasi berbeda\n  aktual: ${tampil(aktual)} ${JSON.stringify(aktual.rows)}\n  harap : ${tampil(harap)} ${JSON.stringify(harap.rows)}`);
  }
}

export function barisSama(relasi, baris, pesan = '') {
  sama(relasi.rows, baris, pesan);
}
