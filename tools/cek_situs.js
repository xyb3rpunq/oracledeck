// cek_situs.js — pemeriksa keluaran docs/ sebelum dipublikasikan. Nol dependensi.
//   1. setiap href/src internal menunjuk berkas yang ada
//   2. setiap impor modul .js di keluaran dapat diselesaikan
//   3. setiap halaman lab punya skrip yang cocok
//   4. judul halaman unik, lang="id", ada meta description
//   5. tidak ada teks "undefined" / "NaN" / "[object Object]" pada HTML statis
//   6. setiap URL di sitemap.xml ada berkasnya
//   7. tidak ada alamat surel atau nomor telepon internasional yang bocor
//   8. aksesibilitas statis (acuan WCAG 2.2): satu <h1>, landmark <main>, judul tanpa loncatan
//      tingkat, <img> ber-alt, tombol dan kolom isian punya nama yang terbaca
//   9. keamanan: meta Content-Security-Policy ada dan tidak mengizinkan skrip inline/eval
//  10. blok SQL bertombol Jalankan menyebut preset terminal yang dikenal
//
// Jalankan: node tools/cek_situs.js   (keluar dengan kode 1 bila ada masalah)

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DOCS = resolve(here, '..', 'docs');

// Pola mirip surel yang memang boleh muncul. Hanya diisi bila jelas BUKAN alamat surel.
const SUREL_DIIZINKAN = new Set([
  // contoh system-wide name Sistem R* pada Modul 6: Manager@London.localbranch@glasgow
  'manager@london.localbranch',
]);

function semuaBerkas(dir) {
  const out = [];
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) out.push(...semuaBerkas(p));
    else out.push(p);
  }
  return out;
}

const PRESET_TERMINAL = new Set(['rumahsakit', 'akademik', 'terdistribusi', 'dreamhome', 'kependudukan', 'kosong']);

/** Pemeriksaan aksesibilitas atas HTML statis. Mengembalikan daftar masalah. */
export function periksaAksesibilitas(isi) {
  const masalah = [];
  const tanpaSkrip = isi.replace(/<script[\s\S]*?<\/script>/g, '');
  const h1 = (tanpaSkrip.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) masalah.push(`harus ada tepat satu <h1>, ditemukan ${h1}`);
  if (!/<main[\s>]/.test(tanpaSkrip)) masalah.push('landmark <main> tidak ada');
  let sebelum = 0;
  for (const m of tanpaSkrip.matchAll(/<h([1-6])[\s>]/g)) {
    const t = Number(m[1]);
    if (sebelum && t > sebelum + 1) { masalah.push(`judul meloncat dari h${sebelum} ke h${t}`); break; }
    sebelum = t;
  }
  for (const m of tanpaSkrip.matchAll(/<img\b[^>]*>/g)) if (!/\balt="/.test(m[0])) masalah.push('<img> tanpa atribut alt');
  for (const m of tanpaSkrip.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const teks = m[2].replace(/<[^>]+>/g, '').trim();
    if (!teks && !/aria-label="[^"]+"/.test(m[1])) masalah.push('<button> tanpa teks maupun aria-label');
  }
  for (const m of tanpaSkrip.matchAll(/<(input|textarea|select)\b([^>]*)>/g)) {
    if (/type="(hidden|submit|button)"/.test(m[2])) continue;
    const id = (m[2].match(/\bid="([^"]+)"/) || [])[1];
    const berlabel = /aria-label(ledby)?="[^"]+"/.test(m[2]) || (id && new RegExp(`<label[^>]*for="${id}"`).test(tanpaSkrip));
    if (!berlabel) masalah.push(`<${m[1]}> tanpa label`);
  }
  return masalah;
}

export function periksa(docs = DOCS) {
  if (!existsSync(docs)) return { masalah: [`folder ${docs} tidak ada — jalankan node tools/build.js dulu`], statistik: {} };
  const berkas = semuaBerkas(docs);
  const html = berkas.filter((f) => f.endsWith('.html'));
  const js = berkas.filter((f) => f.endsWith('.js'));
  const masalah = [];
  const rel = (p) => relative(docs, p).replace(/\\/g, '/');
  const bersihkan = (u) => u.split('#')[0].split('?')[0];
  let tautanDiperiksa = 0;

  const ada = (dariBerkas, target) => {
    const p = resolve(dirname(dariBerkas), target);
    if (!existsSync(p)) return false;
    if (statSync(p).isDirectory()) return existsSync(join(p, 'index.html'));
    return true;
  };

  const judul = new Map();
  for (const h of html) {
    const isi = readFileSync(h, 'utf8');
    if (!/<html lang="id">/.test(isi)) masalah.push(`${rel(h)}: atribut lang="id" tidak ada`);
    if (!/<meta name="description" content="[^"]{20,}">/.test(isi)) masalah.push(`${rel(h)}: meta description kosong atau terlalu pendek`);
    const t = (isi.match(/<title>([^<]*)<\/title>/) || [])[1];
    if (!t) masalah.push(`${rel(h)}: <title> tidak ada`);
    else {
      if (judul.has(t)) masalah.push(`${rel(h)}: judul sama dengan ${judul.get(t)} — "${t}"`);
      judul.set(t, rel(h));
    }

    // teks tampak (tanpa tag, skrip, dan atribut) tidak boleh memuat sisa galat templat
    const tampak = isi.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
    for (const buruk of ['undefined', 'NaN', '[object Object]']) {
      if (new RegExp(`(^|[^A-Za-z_])${buruk.replace(/[[\]]/g, '\\$&')}([^A-Za-z_]|$)`).test(tampak)) {
        masalah.push(`${rel(h)}: memuat teks "${buruk}"`);
      }
    }

    for (const m of isi.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const u = m[1];
      if (/^(https?:|mailto:|data:|#|javascript:)/.test(u)) continue;
      tautanDiperiksa++;
      const target = bersihkan(u);
      if (!target) continue;
      if (!ada(h, target)) masalah.push(`${rel(h)}: tautan rusak → ${u}`);
    }

    masalah.push(...periksaAksesibilitas(isi).map((m) => `${rel(h)}: ${m}`));
    const csp = (isi.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/) || [])[1];
    if (!csp) masalah.push(`${rel(h)}: meta Content-Security-Policy tidak ada`);
    else if (/unsafe-eval|script-src[^;]*unsafe-inline/.test(csp)) masalah.push(`${rel(h)}: CSP mengizinkan skrip inline atau eval`);
    if (/<script(?![^>]*\bsrc=)[^>]*>\s*\S/.test(isi)) masalah.push(`${rel(h)}: ada skrip inline — akan diblokir CSP`);
    for (const m of isi.matchAll(/data-db="([^"]*)"/g)) {
      if (!PRESET_TERMINAL.has(m[1])) masalah.push(`${rel(h)}: data-db="${m[1]}" bukan preset terminal`);
    }

    if (rel(h).startsWith('lab/') && !rel(h).endsWith('index.html')) {
      const slug = rel(h).slice(4, -5);
      if (!isi.includes(`lab/js/${slug}.js`)) masalah.push(`${rel(h)}: tidak memuat skrip lab/js/${slug}.js`);
      if (!existsSync(join(docs, 'lab', 'js', `${slug}.js`))) masalah.push(`${rel(h)}: berkas lab/js/${slug}.js tidak ada`);
    }
  }

  let imporDiperiksa = 0;
  for (const f of js) {
    const isi = readFileSync(f, 'utf8');
    for (const m of isi.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      imporDiperiksa++;
      const target = bersihkan(m[1]);
      if (!existsSync(resolve(dirname(f), target))) masalah.push(`${rel(f)}: impor tidak ditemukan → ${m[1]}`);
    }
  }

  const peta = join(docs, 'sitemap.xml');
  let urlSitemap = 0;
  if (existsSync(peta)) {
    const isi = readFileSync(peta, 'utf8');
    for (const m of isi.matchAll(/<loc>https?:\/\/[^/]+\/[^/]+\/([^<]*)<\/loc>/g)) {
      urlSitemap++;
      const target = m[1] === '' ? 'index.html' : m[1].endsWith('/') ? `${m[1]}index.html` : m[1];
      if (!existsSync(join(docs, target))) masalah.push(`sitemap.xml: ${m[1] || '/'} tidak punya berkas`);
    }
  } else masalah.push('sitemap.xml tidak ada');

  for (const f of berkas.filter((x) => /\.(html|js|json|css|xml|txt)$/.test(x))) {
    const isi = readFileSync(f, 'utf8');
    for (const m of isi.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}(?:\.[A-Za-z]{2,})?/g)) {
      const surel = m[0];
      if (/\.(js|css|html|png|svg)$/i.test(surel)) continue;
      if (SUREL_DIIZINKAN.has(surel.toLowerCase())) continue;
      masalah.push(`${rel(f)}: alamat surel bocor → ${surel}`);
    }
    for (const m of isi.matchAll(/\+62\s?8\d{8,11}/g)) masalah.push(`${rel(f)}: nomor telepon bocor → ${m[0]}`);
  }

  if (!existsSync(join(docs, '.nojekyll'))) masalah.push('.nojekyll tidak ada — GitHub Pages akan memproses situs dengan Jekyll');

  return {
    masalah,
    statistik: { html: html.length, js: js.length, tautan: tautanDiperiksa, impor: imporDiperiksa, sitemap: urlSitemap },
  };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/').replace(/^\//, '')}` || process.argv[1].endsWith('cek_situs.js')) {
  const { masalah, statistik } = periksa();
  process.stdout.write(`Diperiksa: ${statistik.html} HTML, ${statistik.js} JS, ${statistik.tautan} tautan, ${statistik.impor} impor, ${statistik.sitemap} URL sitemap\n`);
  if (masalah.length) {
    process.stdout.write(`\n${masalah.length} MASALAH:\n${masalah.map((m) => `  - ${m}`).join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write('Tidak ada masalah.\n');
}
