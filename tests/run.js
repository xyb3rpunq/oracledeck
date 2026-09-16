// run.js — penjalan seluruh berkas uji. Jalankan: node tests/run.js [pola]
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { daftar } from './harness.js';

const here = dirname(fileURLToPath(import.meta.url));
const pola = process.argv[2] || '';

const berkas = readdirSync(here)
  .filter((f) => f.endsWith('.test.js'))
  .sort();

for (const f of berkas) {
  await import(pathToFileURL(join(here, f)).href);
}

const dipilih = pola ? daftar.filter((t) => `${t.grup} ${t.nama}`.toLowerCase().includes(pola.toLowerCase())) : daftar;

let lulus = 0;
const gagal = [];
const mulai = Date.now();
let grupTerakhir = null;

for (const t of dipilih) {
  if (t.grup !== grupTerakhir) {
    grupTerakhir = t.grup;
    process.stdout.write(`\n  ${t.grup}\n`);
  }
  try {
    await t.fn();
    lulus++;
    process.stdout.write(`    [32m+[0m ${t.nama}\n`);
  } catch (e) {
    gagal.push({ ...t, error: e });
    process.stdout.write(`    [31mx ${t.nama}[0m\n`);
  }
}

const durasi = Date.now() - mulai;
process.stdout.write(`\n${'='.repeat(64)}\n`);
if (gagal.length) {
  process.stdout.write(`\n[31m${gagal.length} UJI GAGAL[0m\n\n`);
  for (const g of gagal) {
    process.stdout.write(`  [${g.grup}] ${g.nama}\n    ${String(g.error.message).split('\n').join('\n    ')}\n`);
    if (g.error.name !== 'GagalUji' && g.error.stack) {
      process.stdout.write(`    ${g.error.stack.split('\n').slice(1, 4).join('\n    ')}\n`);
    }
    process.stdout.write('\n');
  }
}
process.stdout.write(`${lulus}/${dipilih.length} uji lulus dalam ${durasi} ms (${berkas.length} berkas)\n`);
process.exit(gagal.length ? 1 : 0);
