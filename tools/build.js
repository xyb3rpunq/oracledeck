// build.js — generator situs statis ORACLEDECK. Nol dependensi.
// Keluaran: docs/ (siap dilayani GitHub Pages)
//
// Jalankan: node tools/build.js

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { MATERI, LAB, PRAKTIKUM } from '../src/content/materi.js';
import { CONTOH } from '../src/content/contoh-sql.js';
import { BANK_SOAL } from '../src/content/soal.js';
import * as TERM from '../engine/core/terminal.js';
import { COBA_MATERI } from '../src/content/coba-materi.js';
import { KASUS_GALAT } from '../src/content/kasus-galat-oracle.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'docs');

export const SITUS = {
  nama: 'ORACLEDECK',
  tagline: 'Laboratorium Sistem Basis Data Terdistribusi',
  deskripsi: 'Empat belas topik CTI313, enam belas laboratorium interaktif, dan bank soal praktikum yang dinilai otomatis. Mesin relasionalnya ditulis dari nol, hasilnya diverifikasi silang terhadap SQLite, dan rancangannya diterjemahkan menjadi DDL Oracle sungguhan.',
  penulis: 'Daniel Hutajulu',
  npm: '20210801207',
  matkul: 'CTI313 — Sistem Basis Data Terdistribusi',
  kampus: 'Universitas Esa Unggul',
  repo: 'https://github.com/xyb3rpunq/oracledeck',
  url: 'https://xyb3rpunq.github.io/oracledeck',
  tahun: 2026,
};

let VERSI_ASET = 'dev';
let GLOSARIUM = [];
let UJI_ORACLE = null;
let VERIF_ORACLE = null;
const statistikBlokSql = { dapatDijalankan: 0, hanyaOracle: 0 };

/**
 * Tentukan preset terminal tempat sebuah blok SQL benar-benar bisa dijalankan tanpa galat.
 * Hanya blok yang lolos yang diberi tombol "Jalankan" — tidak ada tombol yang berujung galat.
 */
export function presetUntukSql(sql) {
  const urutan = ['rumahsakit', 'akademik', 'terdistribusi', 'dreamhome', 'kependudukan', 'kosong'];
  for (const p of urutan) {
    try {
      const blok = TERM.jalankan(TERM.buatSesi(p), sql).blok;
      if (blok.length && !blok.some((b) => b.jenis === 'galat')) return p;
    } catch { /* coba preset berikutnya */ }
  }
  return null;
}

function blokSql(isi) {
  const preset = presetUntukSql(isi);
  if (preset) statistikBlokSql.dapatDijalankan++;
  else statistikBlokSql.hanyaOracle++;
  return `<pre${preset ? ` data-sql="${esc(isi)}" data-db="${preset}"` : ''}><code>${warnaSql(isi)}</code></pre>`;
}

export const slugIstilah = (s) => `g-${String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

/**
 * Tandai kemunculan PERTAMA setiap istilah glosarium di dalam teks biasa sebuah halaman,
 * sehingga definisinya muncul sebagai catatan kecil saat disorot/difokus.
 * Tag, isi <code>/<pre>/<a>/<h*>, dan atribut tidak pernah disentuh.
 */
export function sisipIstilah(html, glosarium, terpakai = new Set()) {
  const daftar = glosarium
    .flatMap((g) => [g.istilah, ...(g.alias || [])].map((nama) => ({ g, nama })))
    .filter((x) => x.nama.length >= 3)
    .sort((a, b) => b.nama.length - a.nama.length);
  const bagian = String(html).split(/(<[^>]+>)/);
  let terlarang = 0;
  for (let i = 0; i < bagian.length; i++) {
    const b = bagian[i];
    if (b.startsWith('<')) {
      const m = /^<(\/?)(code|pre|a|h[1-6]|summary|abbr|button|script|style|th|kbd)\b/i.exec(b);
      if (m) terlarang += m[1] ? -1 : 1;
      if (terlarang < 0) terlarang = 0;
      continue;
    }
    if (terlarang > 0 || !b.trim()) continue;
    let teks = b;
    const potongan = [];
    const simpan = (html) => `\u0000${potongan.push(html) - 1}\u0000`;
    for (const { g, nama } of daftar) {
      const re = new RegExp(`(^|[^A-Za-z0-9\u00C0-\u024F\u0000])(${nama.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=$|[^A-Za-z0-9\u00C0-\u024F\u0000])`, 'gi');
      // setiap kemunculan frasa ini "dikunci" agar istilah yang lebih pendek tidak menandai
      // sebagian darinya (mis. "Fragmentasi" di dalam "Fragmentasi horizontal")
      teks = teks.replace(re, (_, depan, kata) => {
        if (terpakai.has(g.istilah)) return `${depan}${simpan(kata)}`;
        terpakai.add(g.istilah);
        return `${depan}${simpan(`<abbr class="istilah" tabindex="0" data-g="${slugIstilah(g.istilah)}" data-istilah="${esc(g.istilah)}"${g.en ? ` data-en="${esc(g.en)}"` : ''} data-arti="${esc(g.arti.replace(/<[^>]+>/g, ''))}"${g.detail ? ` data-detail="${esc(g.detail)}"` : ''}${g.contoh ? ` data-contoh="${esc(g.contoh)}"` : ''}${g.lab ? ` data-lab="${g.lab}" data-lab-judul="${esc((LAB.find((l) => l.slug === g.lab) || {}).judul || g.lab)}"` : ''}>${kata}</abbr>`)}`;
      });
    }
    let sebelumnya;
    do { sebelumnya = teks; teks = teks.replace(/\u0000(\d+)\u0000/g, (_, n) => potongan[Number(n)]); } while (teks !== sebelumnya);
    bagian[i] = teks;
  }
  return bagian.join('');
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// --------------------------------------------------------------- pewarna SQL

const KATA_SQL = /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|JOIN|LEFT|RIGHT|FULL|INNER|OUTER|CROSS|ON|AS|AND|OR|NOT|IN|IS|NULL|BETWEEN|LIKE|UNION|ALL|DISTINCT|LIMIT|OFFSET|CREATE|TABLE|VIEW|INDEX|MATERIALIZED|DATABASE|LINK|SYNONYM|TABLESPACE|PARTITION|BY|LIST|RANGE|HASH|REFERENCE|VALUES|LESS|THAN|DEFAULT|PRIMARY|KEY|FOREIGN|REFERENCES|CONSTRAINT|CHECK|UNIQUE|NOT NULL|INSERT|INTO|UPDATE|SET|DELETE|COMMIT|ROLLBACK|FORCE|GRANT|ALTER|SESSION|SYSTEM|DROP|CASCADE|CONSTRAINTS|EXPLAIN|PLAN|FOR|REFRESH|FAST|COMPLETE|BUILD|IMMEDIATE|ENABLE|QUERY|REWRITE|WITH|USING|CONNECT|TO|IDENTIFIED|PUBLIC|LOCAL|GLOBAL|PARTITIONS|STORE|INTERVAL|EXEC|BEGIN|END|DECLARE|AT|SITE|USER|DATAFILE|SIZE|AUTOEXTEND|NEXT|MAXSIZE|EXTENT|MANAGEMENT|SEGMENT|SPACE|AUTO|QUOTA|UNLIMITED|CHAR|VARCHAR2|NUMBER|DATE|TIMESTAMP|CLOB|TRANSACTION|NAME|ORDER|CONTAINER|CREATE OR REPLACE)\b/gi;

export function warnaSql(kode) {
  const baris = esc(kode).split('\n');
  return baris.map((b) => {
    const idx = b.indexOf('--');
    let kode2 = idx >= 0 ? b.slice(0, idx) : b;
    const komentar = idx >= 0 ? b.slice(idx) : '';
    kode2 = kode2
      .replace(/'([^']*)'/g, '\u0001$1\u0002')
      .replace(KATA_SQL, (m) => `\u0003${m}\u0004`)
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '\u0005$1\u0006')
      .replace(/\b(COUNT|SUM|AVG|MIN|MAX|UPPER|LOWER|LENGTH|SUBSTR|ROUND|COALESCE|NVL|SYSDATE|DBMS_XPLAN|DBMS_MVIEW|DBMS_STATS|DBMS_REFRESH|DBMS_TRANSACTION)\b/g, '\u0007$1\u0008')
      .replace(/\u0001([^\u0002]*)\u0002/g, '<span class="sql-s">\'$1\'</span>')
      .replace(/\u0003([^\u0004]*)\u0004/g, '<span class="sql-k">$1</span>')
      .replace(/\u0005([^\u0006]*)\u0006/g, '<span class="sql-n">$1</span>')
      .replace(/\u0007([^\u0008]*)\u0008/g, '<span class="sql-f">$1</span>');
    return kode2 + (komentar ? `<span class="sql-c">${komentar}</span>` : '');
  }).join('\n');
}

// ------------------------------------------------------------------ template

function halaman({ judul, deskripsi, isi, aktif = '', dalam = 0, skrip = null, kanonik = '', kunciHalaman = '', remah = null }) {
  const naik = '../'.repeat(dalam);
  const tautan = [
    ['', 'Beranda'],
    ['materi/', 'Materi'],
    ['lab/', 'Laboratorium'],
    ['oracle.html', 'Oracle'],
    ['audit.html', 'Audit'],
    ['glosarium.html', 'Glosarium'],
    ['kualitas.html', 'Kualitas'],
  ];
  const judulPenuh = judul === SITUS.nama ? `${SITUS.nama} — ${SITUS.tagline}` : `${judul} · ${SITUS.nama}`;
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(judulPenuh)}</title>
<meta name="description" content="${esc(deskripsi)}">
<meta name="author" content="${esc(SITUS.penulis)}">
<link rel="canonical" href="${SITUS.url}/${kanonik}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(judulPenuh)}">
<meta property="og:description" content="${esc(deskripsi)}">
<meta property="og:url" content="${SITUS.url}/${kanonik}">
<meta property="og:site_name" content="${SITUS.nama}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#0b0e13">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230b0e13'/%3E%3Cellipse cx='16' cy='10' rx='9' ry='3.6' fill='none' stroke='%23f04438' stroke-width='2'/%3E%3Cpath d='M7 10v12c0 2 4 3.6 9 3.6s9-1.6 9-3.6V10' fill='none' stroke='%23f04438' stroke-width='2'/%3E%3Cpath d='M7 16c0 2 4 3.6 9 3.6s9-1.6 9-3.6' fill='none' stroke='%23f04438' stroke-width='2'/%3E%3C/svg%3E">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="manifest" href="${naik}manifest.webmanifest">
<link rel="stylesheet" href="${naik}styles.css?v=${VERSI_ASET}">
<script src="${naik}tema.js?v=${VERSI_ASET}"></script>
</head>
<body${kunciHalaman ? ` data-halaman="${kunciHalaman}"` : ''}>
<a class="lewati" href="#isi">Lewati ke isi</a>
<header class="site">
  <div class="wrap">
    <a class="brand" href="${naik}index.html"><span class="dot"></span>ORACLE<b>DECK</b></a>
    <nav class="top">
      ${tautan.map(([h, t]) => {
    const href = h === '' ? `${naik}index.html` : h.endsWith('/') ? `${naik}${h}index.html` : `${naik}${h}`;
    const kunci = h === '' ? 'beranda' : h.replace(/[/.].*$/, '');
    return `<a href="${href}"${aktif === kunci ? ' class="aktif"' : ''}>${t}</a>`;
  }).join('\n      ')}
      <a href="${SITUS.repo}" rel="noopener">GitHub</a>
    </nav>
    <div class="alat-header">
      <button type="button" data-cari-buka aria-label="Cari di situs (Ctrl+K)">Cari<kbd>Ctrl K</kbd></button>
      <button type="button" data-tema-toggle aria-label="Ganti tema">☀</button>
    </div>
  </div>
</header>
<main id="isi" tabindex="-1"><div class="wrap">
${remah ? `<nav class="remah" aria-label="Remah roti">${remah.map(([h, t]) => (h ? `<a href="${h}">${t}</a>` : `<span aria-current="page">${t}</span>`)).join(' / ')}</nav>` : ''}
${isi}
</div></main>
${skrip === 'lab/js/sql.js' ? '' : '<button type="button" class="tombol-terminal" data-terminal-buka aria-label="Buka Terminal SQL (Ctrl+`)">&gt;_ Terminal SQL</button>'}
<footer class="site"><div class="wrap">
  <div><strong>${SITUS.nama}</strong> — ${SITUS.tagline}</div>
  <div>${esc(SITUS.matkul)} · ${esc(SITUS.kampus)}</div>
  <div>${esc(SITUS.penulis)} (${SITUS.npm}) · <a href="${SITUS.repo}" rel="noopener">kode sumber</a></div>
  <div class="kecil">Tidak berafiliasi dengan Oracle Corporation. Nama Oracle dipakai hanya sebagai rujukan teknis.</div>
</div></footer>
<script type="module" src="${naik}site.js?v=${VERSI_ASET}"></script>
${skrip ? `<script type="module" src="${naik}${skrip}?v=${VERSI_ASET}"></script>` : ''}
</body>
</html>`;
}

// ------------------------------------------------------------ render bagian

function renderBagian(b) {
  const out = [];
  if (b.h) out.push(`<h2 id="${slugify(b.h)}">${b.h}</h2>`);
  if (b.p) out.push(...[].concat(b.p).map((x) => `<p>${x}</p>`));
  if (b.ul) out.push(`<ul>${b.ul.map((x) => `<li>${x}</li>`).join('')}</ul>`);
  if (b.ol) out.push(`<ol>${b.ol.map((x) => `<li>${x}</li>`).join('')}</ol>`);
  if (b.tabel) {
    out.push(`<div class="tabel-bungkus"><table><thead><tr>${b.tabel.kepala.map((k) => `<th>${k}</th>`).join('')}</tr></thead><tbody>${b.tabel.baris.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
  }
  if (b.kode) out.push(b.kode.bahasa === 'sql' ? blokSql(b.kode.isi) : `<pre><code>${esc(b.kode.isi)}</code></pre>`);
  if (b.catatan) out.push(`<div class="catatan ${b.catatan.jenis}"><p>${b.catatan.teks}</p></div>`);
  if (b.p2) out.push(...[].concat(b.p2).map((x) => `<p>${x}</p>`));
  return out.join('\n');
}

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// --------------------------------------------------------------- halaman-halaman

function beranda(statistik) {
  const isi = `
<section class="hero">
  <p class="kicker">${esc(SITUS.matkul)}</p>
  <h1>Basis data terdistribusi, dijalankan — bukan sekadar dibaca.</h1>
  <p class="lede">${esc(SITUS.deskripsi)}</p>
  <div class="pita">
    <span>nol dependensi runtime</span>
    <span>${statistik.uji} uji otomatis</span>
    <span>diverifikasi silang terhadap SQLite</span>
    <span>${statistik.berkasOracle} skrip Oracle</span>
    <span>statis — tanpa server, tanpa pelacak</span>
  </div>
  <div class="statbar">
    <div class="stat"><b>${MATERI.length}</b><span>topik kuliah</span></div>
    <div class="stat"><b>${LAB.length}</b><span>laboratorium</span></div>
    <div class="stat"><b>${statistik.uji}</b><span>uji lulus</span></div>
    <div class="stat"><b>${statistik.kueriVerif}</b><span>kueri terverifikasi</span></div>
    <div class="stat"><b>${statistik.fungsi}</b><span>fungsi mesin</span></div>
  </div>
  <div class="kemajuan" data-kemajuan="${[...MATERI.map((m) => `materi-${m.no}`), ...LAB.map((l) => `lab-${l.slug}`)].join(',')}">
    <p><b>Kemajuan belajar Anda</b> · <span data-kemajuan-teks>belum ada halaman yang dibuka</span></p>
    <div class="bar"><i data-kemajuan-bar></i></div>
    <p class="kecil">Tersimpan di peramban ini saja. <a href="materi/01-${MATERI[0].slug}.html" data-kemajuan-lanjut hidden>Mulai dari topik 1 →</a></p>
  </div>
</section>

<h2>Terminal SQL Live</h2>
<div class="grid dua">
  <div class="kartu">
    <h3>Setiap kueri di situs ini bisa dijalankan</h3>
    <p>Blok SQL bertombol <b>▶ Jalankan</b> di halaman materi dibuka langsung di terminal. Ketik kueri sendiri, hasil pratinjau muncul saat mengetik. DML, DDL, <code>COMMIT</code>/<code>ROLLBACK</code>, kamus data Oracle, dan tiga situs lewat <code>tabel@situs</code> — termasuk two-phase commit sungguhan saat <code>COMMIT</code> menyentuh dua situs.</p>
    <p><a href="lab/sql.html">Buka Terminal SQL →</a> · atau tekan <kbd>Ctrl</kbd>+<kbd>&#96;</kbd> di halaman mana pun.</p>
  </div>
  <div class="kartu">
    <h3>Mulai dari sini</h3>
    <ol>
      <li><a href="materi/01-${MATERI[0].slug}.html">Baca Topik 1</a> — istilah bergaris titik-titik menampilkan definisinya saat disorot.</li>
      <li><a href="lab/sql.html#db=rumahsakit&amp;sql=SELECT%20kota%2C%20COUNT(*)%20AS%20pasien%20FROM%20pasien%20GROUP%20BY%20kota%3B">Jalankan kueri pertama</a> di Terminal SQL.</li>
      <li><a href="lab/fragmentasi.html">Pecah tabel pasien</a> menjadi fragmen per kota.</li>
      <li><a href="lab/sql.html#db=terdistribusi&amp;sql=SELECT%20*%20FROM%20pasien%40bandung%3B">Kueri fragmen lewat database link</a>, lalu <a href="lab/duafase.html">uji 2PC</a>.</li>
      <li><a href="lab/soal.html">Kerjakan bank soal</a> — dinilai otomatis.</li>
    </ol>
  </div>
</div>

<h2>Laboratorium</h2>
<p>Setiap lab menjalankan perhitungan sungguhan di peramban Anda. Tidak ada hasil yang disiapkan sebelumnya — ubah masukannya, angkanya ikut berubah.</p>
<div class="grid tiga">
${LAB.map((l) => `  <a class="tile" href="lab/${l.slug}.html" data-kunci-halaman="lab-${l.slug}" data-judul="${esc(l.judul)}">
    <div class="no">LAB ${String(l.no).padStart(2, '0')}</div>
    <h3>${l.judul}</h3>
    <p>${l.ringkas}</p>
  </a>`).join('\n')}
</div>

<h2>Empat belas topik</h2>
<p>Disusun mengikuti Rencana Pembelajaran Semester pada Modul 1. Tiap topik menautkan ke lab yang menjalankan konsepnya.</p>
<div class="grid dua">
${MATERI.map((m) => `  <a class="tile" href="materi/${String(m.no).padStart(2, '0')}-${m.slug}.html" data-kunci-halaman="materi-${m.no}" data-judul="Topik ${m.no}. ${esc(m.judul)}">
    <div class="no">TOPIK ${String(m.no).padStart(2, '0')}</div>
    <h3>${m.judul}</h3>
    <p>${m.ringkas}</p>
  </a>`).join('\n')}
</div>

<h2>Praktikum</h2>
<p>Lima lembar praktikum dari folder mata kuliah, seluruhnya dapat dijalankan ulang di Terminal SQL Live dan Lab Perancang ERD.</p>
<div class="tabel-bungkus"><table>
<thead><tr><th class="num">#</th><th>Praktikum</th><th>Isi</th><th>Jalankan di</th></tr></thead>
<tbody>
${PRAKTIKUM.map((p) => `<tr><td class="num">${p.no}</td><td><strong>${p.judul}</strong></td><td>${p.isi}</td><td><a href="lab/${p.lab}.html">Lab ${LAB.find((l) => l.slug === p.lab).judul}</a></td></tr>`).join('\n')}
</tbody></table></div>

<h2>Cara kerjanya</h2>
<div class="grid tiga">
  <div class="kartu">
    <h3>Mesin relasional sendiri</h3>
    <p>Aljabar relasional lengkap, parser SQL, perencana kueri, dan seluruh algoritma terdistribusi ditulis dari nol dalam JavaScript tanpa satu pun dependensi. Berkas yang sama dipakai uji di Node dan halaman di peramban.</p>
  </div>
  <div class="kartu">
    <h3>Diverifikasi silang</h3>
    <p>${statistik.kueriVerif} kueri acuan dijalankan di mesin ini <i>dan</i> di SQLite lewat Python, lalu hasilnya dibandingkan baris demi baris. Kalau berbeda, build gagal.</p>
  </div>
  <div class="kartu">
    <h3>Bermuara ke Oracle</h3>
    <p>Tiga basis data Oracle sungguhan: PARTITION BY LIST dan REFERENCE, database link, materialized view, two-phase commit, sampai <code>COMMIT FORCE</code> pada transaksi ragu-ragu — dijalankan otomatis dan memeriksa hasilnya sendiri.</p>
  </div>
</div>

${UJI_ORACLE ? `<div class="catatan baik">
  <p><b>Terbukti di Oracle sungguhan.</b> ${UJI_ORACLE.skripLulus} dari ${UJI_ORACLE.skrip} skrip lulus dengan ${UJI_ORACLE.cekLulus} pemeriksaan mandiri pada ${esc(UJI_ORACLE.oracle.replace(/ - Develop.*$/, ''))}${VERIF_ORACLE ? `; ${VERIF_ORACLE.kueri.lulus + VERIF_ORACLE.dml.lulus} kueri &amp; DML menghasilkan isi identik dan ${VERIF_ORACLE.galat.lulus} kode galat terminal sama dengan Oracle` : ''}. <a href="oracle.html">Lihat bukti →</a></p>
</div>` : ''}
`;
  return halaman({ judul: SITUS.nama, deskripsi: SITUS.deskripsi, isi, aktif: 'beranda', kanonik: '' });
}

function daftarMateri() {
  const isi = `
<p class="kicker">Materi</p>
<h1>Empat belas topik CTI313</h1>
<p class="lede">Disusun mengikuti Rencana Pembelajaran Semester pada Modul 1. Isinya diambil dari modul kuliah di folder mata kuliah, bukan dari ringkasan pihak ketiga.</p>

<div class="grid dua" style="margin-top:22px">
${MATERI.map((m) => `  <a class="tile" href="${String(m.no).padStart(2, '0')}-${m.slug}.html" data-kunci-halaman="materi-${m.no}">
    <div class="no">TOPIK ${String(m.no).padStart(2, '0')}</div>
    <h2>${m.judul}</h2>
    <p>${m.ringkas}</p>
  </a>`).join('\n')}
</div>
`;
  return halaman({ judul: 'Materi', deskripsi: 'Empat belas topik kuliah Sistem Basis Data Terdistribusi CTI313.', isi, aktif: 'materi', dalam: 1, kanonik: 'materi/' });
}

function halamanMateri(m, i) {
  const sebelum = MATERI[i - 1];
  const sesudah = MATERI[i + 1];
  const labTerkait = m.lab.map((s) => LAB.find((l) => l.slug === s)).filter(Boolean);
  const daftarIsi = m.bagian.filter((b) => b.h).map((b) => `<li><a href="#${slugify(b.h)}">${b.h}</a></li>`).join('')
    + (m.tugas ? '<li><a href="#tugas">Tugas modul</a></li>' : '')
    + ((COBA_MATERI[m.no] || []).length ? '<li><a href="#coba">Coba di terminal</a></li>' : '');
  const isi = `
<div class="dua-kolom">
  <aside class="toc">
    <h4>Isi topik</h4>
    <ol>${daftarIsi}</ol>
  </aside>
  <article>
    <p class="kicker">Topik ${String(m.no).padStart(2, '0')}</p>
    <h1>${m.judul}</h1>
    <p class="lede">${m.ringkas}</p>
    <div class="catatan baik"><p><b>Kemampuan akhir yang diharapkan.</b> ${m.tujuan}</p></div>

${sisipIstilah(m.bagian.map(renderBagian).join('\n\n') + (m.tugas ? `\n<h2 id="tugas">${m.tugas.judul}</h2>\n${m.tugas.butir.map((t, i) => `<details${i === 0 ? ' open' : ''}><summary>${i + 1}. ${t.tanya}</summary><p>${t.jawab}</p></details>`).join('')}` : ''), GLOSARIUM)}

${(COBA_MATERI[m.no] || []).length ? `<h2 id="coba">Coba di terminal</h2>
<p>Kueri di bawah memperagakan konsep topik ini pada data sungguhan. Tekan <b>▶ Jalankan</b> untuk membukanya di Terminal SQL, lalu ubah sesuka hati — sesi terminal adalah salinan pribadi di peramban Anda.</p>
${COBA_MATERI[m.no].map((c) => `<h3>${esc(c.judul)}</h3>
<p>${sisipIstilah(esc(c.ket), GLOSARIUM, new Set())} <span class="lencana netral">${esc(c.db)}</span>${c.galat ? ` <span class="lencana warn">galat disengaja: ${esc(c.galat.join(', '))}</span>` : ''}</p>
<pre data-sql="${esc(c.sql)}" data-db="${c.db}"><code>${warnaSql(c.sql)}</code></pre>`).join('\n')}` : ''}

${labTerkait.length ? `<h2 id="lab">Jalankan sendiri</h2>
<div class="grid dua">
${labTerkait.map((l) => `  <a class="tile" href="../lab/${l.slug}.html"><div class="no">LAB ${String(l.no).padStart(2, '0')}</div><h3>${l.judul}</h3><p>${l.ringkas}</p></a>`).join('\n')}
</div>` : ''}

    <p class="kecil" style="margin-top:28px">Sumber: ${esc(m.sumber)}</p>
    <div class="nav-bawah">
      <div>${sebelum ? `<a href="${String(sebelum.no).padStart(2, '0')}-${sebelum.slug}.html">&larr; ${sebelum.judul}</a>` : '<a href="index.html">&larr; Daftar materi</a>'}</div>
      <div>${sesudah ? `<a href="${String(sesudah.no).padStart(2, '0')}-${sesudah.slug}.html">${sesudah.judul} &rarr;</a>` : '<a href="../lab/index.html">Laboratorium &rarr;</a>'}</div>
    </div>
  </article>
</div>
`;
  return halaman({
    judul: `${String(m.no).padStart(2, '0')}. ${m.judul}`,
    deskripsi: m.ringkas,
    isi,
    aktif: 'materi',
    dalam: 1,
    kanonik: `materi/${String(m.no).padStart(2, '0')}-${m.slug}.html`,
    kunciHalaman: `materi-${m.no}`,
    remah: [['../index.html', 'Beranda'], ['index.html', 'Materi'], [null, `Topik ${m.no}`]],
  });
}

function daftarLab() {
  const isi = `
<p class="kicker">Laboratorium</p>
<h1>${LAB.length} lab yang benar-benar menghitung</h1>
<p class="lede">Semua perhitungan berjalan di peramban Anda memakai mesin yang sama dengan yang diuji ${bacaStatistik().uji} kali di Node. Tidak ada jawaban yang disiapkan sebelumnya.</p>
<div class="grid dua" style="margin-top:22px">
${LAB.map((l) => `  <a class="tile" href="${l.slug}.html" data-kunci-halaman="lab-${l.slug}">
    <div class="no">LAB ${String(l.no).padStart(2, '0')} · topik ${l.topik.join(', ')}</div>
    <h2>${l.judul}</h2>
    <p>${l.ringkas}</p>
  </a>`).join('\n')}
</div>
`;
  return halaman({ judul: 'Laboratorium', deskripsi: `${LAB.length} laboratorium interaktif basis data terdistribusi.`, isi, aktif: 'lab', dalam: 1, kanonik: 'lab/' });
}

function halamanLab(l, i) {
  const sebelum = LAB[i - 1];
  const sesudah = LAB[i + 1];
  const topik = l.topik.map((n) => MATERI.find((m) => m.no === n)).filter(Boolean);
  const isi = `
<p class="kicker">Lab ${String(l.no).padStart(2, '0')}</p>
<h1>${l.judul}</h1>
<p class="lede">${sisipIstilah(l.ringkas, GLOSARIUM)}</p>
<p class="kecil">Topik terkait: ${topik.map((m) => `<a href="../materi/${String(m.no).padStart(2, '0')}-${m.slug}.html">${m.no}. ${m.judul}</a>`).join(' · ')}</p>

<div id="lab" data-lab="${l.slug}">
  <p class="kosong">Memuat mesin…</p>
</div>

<div class="nav-bawah">
  <div>${sebelum ? `<a href="${sebelum.slug}.html">&larr; ${sebelum.judul}</a>` : '<a href="index.html">&larr; Daftar lab</a>'}</div>
  <div>${sesudah ? `<a href="${sesudah.slug}.html">${sesudah.judul} &rarr;</a>` : '<a href="../oracle.html">Skrip Oracle &rarr;</a>'}</div>
</div>
`;
  return halaman({
    judul: l.judul,
    deskripsi: l.ringkas,
    isi,
    aktif: 'lab',
    dalam: 1,
    skrip: `lab/js/${l.slug}.js`,
    kanonik: `lab/${l.slug}.html`,
    kunciHalaman: `lab-${l.slug}`,
    remah: [['../index.html', 'Beranda'], ['index.html', 'Laboratorium'], [null, `Lab ${String(l.no).padStart(2, '0')}`]],
  });
}

const TOPOLOGI_SVG = `<svg class="topologi" viewBox="0 0 640 230" role="img" aria-labelledby="topologi-judul">
  <title id="topologi-judul">Topologi uji: situs Jakarta terhubung ke Bandung dan Surabaya lewat database link</title>
  <rect x="235" y="14" width="170" height="86" rx="10"/>
  <text x="320" y="42" class="t-judul">JAKARTA (pusat)</text>
  <text x="320" y="62">FREEPDB1</text>
  <text x="320" y="80" class="t-kecil">skema global · partisi · view global</text>
  <rect x="24" y="140" width="190" height="76" rx="10"/>
  <text x="119" y="168" class="t-judul">BANDUNG</text>
  <text x="119" y="188" class="t-kecil">fragmen PASIEN &amp; DAFTAR</text>
  <text x="119" y="204" class="t-kecil">replika MV_DOKTER</text>
  <rect x="426" y="140" width="190" height="76" rx="10"/>
  <text x="521" y="168" class="t-judul">SURABAYA</text>
  <text x="521" y="188" class="t-kecil">fragmen PASIEN &amp; DAFTAR</text>
  <line x1="265" y1="100" x2="150" y2="140"/>
  <line x1="375" y1="100" x2="490" y2="140"/>
  <text x="170" y="116" class="t-link">SITUS_BANDUNG</text>
  <text x="470" y="116" class="t-link">SITUS_SURABAYA</text>
</svg>`;

function halamanOracle(skrip) {
  const uji = UJI_ORACLE;
  const ver = VERIF_ORACLE;
  const statusUji = new Map((uji?.hasil || []).map((h) => [h.berkas, h]));
  const galat = (ver?.hasil || []).filter((h) => h.jenis === 'galat');
  const kasus = new Map(KASUS_GALAT.map((k) => [k.id, k]));
  const tautanLog = (log) => `${SITUS.repo}/blob/main/oracle/${log}`;
  const isi = `
<p class="kicker">Oracle</p>
<h1>Terbukti di Oracle sungguhan</h1>
<p class="lede">${skrip.length} skrip yang menerjemahkan konsep kuliah menjadi objek Oracle — tiga basis data, database link, partisi, replikasi, two-phase commit, sampai transaksi ragu-ragu. Semuanya dibangkitkan dari mesin yang sama dengan lab, lalu <b>dijalankan otomatis pada Oracle sungguhan</b> dan memeriksa hasilnya sendiri.</p>

${uji ? `<div class="statbar">
  <div class="stat"><b>${uji.skripLulus}/${uji.skrip}</b><span>skrip lulus</span></div>
  <div class="stat"><b>${uji.cekLulus}</b><span>pemeriksaan LULUS</span></div>
  <div class="stat"><b>${uji.cekGagal}</b><span>GAGAL</span></div>
  ${ver ? `<div class="stat"><b>${ver.kueri.lulus + ver.dml.lulus}/${ver.kueri.jumlah + ver.dml.jumlah}</b><span>kueri &amp; DML identik</span></div>
  <div class="stat"><b>${ver.galat.lulus}/${ver.galat.jumlah}</b><span>kode galat sama</span></div>` : ''}
</div>
<p class="kecil">${esc(uji.oracle)} · image <code>${esc(uji.kontainer)}</code> · diuji ${esc(uji.tanggal)} · ${uji.durasiDetik} detik. Log SQL*Plus lengkap setiap skrip ada di folder <a href="${SITUS.repo}/tree/main/oracle/bukti" rel="noopener">oracle/bukti</a>.</p>` : '<div class="catatan peringatan"><p>Hasil uji Oracle belum dibangkitkan. Jalankan <code>node tools/uji_oracle.mjs</code>.</p></div>'}

<h2 id="topologi">Topologi uji</h2>
<div class="diagram">${TOPOLOGI_SVG}</div>
<p>Setiap situs adalah <i>pluggable database</i> terpisah dengan kamus data, pengguna, dan catatan transaksinya sendiri. Di produksi ketiganya berada di server berbeda; di sini ketiganya berbagi satu container agar bisa diulang di laptop — database link, 2PC, dan <code>DBA_2PC_PENDING</code> tetap sungguhan.</p>

<h2 id="temuan">Yang hanya ketahuan setelah dijalankan di Oracle</h2>
${U_TABEL(['Temuan', 'Gejala di Oracle', 'Perbaikan'], [
    ['Reference partitioning butuh ROW MOVEMENT', '<code>ORA-14661</code> saat tabel anak dibuat, karena induknya sudah <code>ENABLE ROW MOVEMENT</code>', 'Tabel anak ikut <code>ENABLE ROW MOVEMENT</code>'],
    ['Catatan in-doubt ditulis asinkron', 'Tepat setelah <code>ORA-02054</code>, <code>DBA_2PC_PENDING</code> masih kosong; baris baru muncul beberapa detik kemudian', 'Skrip menunggu dengan polling sebelum membaca ID transaksi'],
    ['Kueri lewat link membuka transaksi', '<code>ORA-02043</code>: COMMIT FORCE ditolak karena SELECT ke <code>dba_2pc_pending@SITUS_BANDUNG</code> belum diakhiri', '<code>COMMIT</code> sebelum <code>COMMIT FORCE</code>'],
    ['Membersihkan catatan 2PC butuh hak SYS', '<code>DBMS_TRANSACTION.PURGE_LOST_DB_ENTRY</code> gagal sebagai pemilik skema', 'Dipindah ke langkah 14d sebagai SYS'],
    ['Oracle memeriksa kolom saat parse', 'Kolom salah pada tabel kosong tetap <code>ORA-00904</code>/<code>ORA-00918</code>/<code>ORA-00979</code>; mesin terminal lama meloloskannya', 'Validasi semantik statis di mesin SQL'],
    ['SELECT atas baris terkunci in-doubt', '<code>ORA-01591</code> — pembaca pun ditolak, bukan melihat data lama', 'Terminal menolak baca/tulis tabel yang dikunci transaksi ragu-ragu'],
    ['TRUNCATE, CHECK kolom, dan format tanggal', 'TRUNCATE induk lolos bila anak kosong; CHECK kolom yang menyebut kolom lain <code>ORA-02438</code>; <code>31/12/2025</code> → <code>ORA-01830</code>', 'Mesin terminal meniru ketiganya persis'],
  ])}

${ver ? `<h2 id="kode-galat">${ver.galat.jumlah} kode galat: Oracle vs Terminal SQL</h2>
<p>Perintah yang sama dijalankan di Oracle dan di terminal ORACLEDECK. Tekan <b>Coba</b> untuk menjalankannya sendiri di terminal.</p>
<div class="tabel-bungkus"><table>
<thead><tr><th>Arti</th><th>Oracle</th><th>Terminal</th><th></th></tr></thead>
<tbody>
${galat.map((h) => {
    const k = kasus.get(h.id);
    const sql = k ? [...k.persiapan, k.perintah].map((x) => `${x};`).join('\n') : '';
    return `<tr><td>${esc(h.arti)}${k ? `<br><code class="kecil">${esc(k.perintah)}</code>` : ''}</td><td class="mono">${esc(h.kodeOracle)}</td><td class="mono">${h.status === 'LULUS' ? '' : '≠ '}${esc(h.kodeMesin)}</td><td>${k ? `<button type="button" class="kecil hantu" data-terminal-sql="${esc(sql)}" data-terminal-db="kosong">Coba</button>` : ''}</td></tr>`;
  }).join('\n')}
</tbody></table></div>
<p class="kecil">Hasil lengkap termasuk ${ver.kueri.jumlah} kueri, ${ver.dml.jumlah} skrip DML, dan ${ver.ekspor.jumlah} skrip <code>\\ekspor</code>: <a href="${SITUS.repo}/blob/main/oracle/VERIFIKASI_MESIN.md" rel="noopener">VERIFIKASI_MESIN.md</a>.</p>` : ''}

<h2 id="pemetaan">Pemetaan konsep ke fitur Oracle</h2>
${U_TABEL(['Konsep kuliah', 'Fitur Oracle', 'Skrip'], [
    ['Tiga situs', 'Pluggable database + database link', '01, 02, 10'],
    ['Fragmentasi horizontal primer', '<code>ALTER TABLE ... MODIFY PARTITION BY LIST ... ONLINE</code>', '06'],
    ['Fragmentasi horizontal turunan', '<code>PARTITION BY REFERENCE</code>', '07'],
    ['Fragmentasi vertikal', 'Tabel terpisah + VIEW perekat atas kunci', '08'],
    ['Alokasi fragmen', 'Tablespace per situs; fragmen di PDB situsnya', '03, 09'],
    ['Transparansi lokasi', 'SYNONYM + VIEW <code>UNION ALL</code>', '10, 15'],
    ['Replikasi asinkron', 'MV log di sumber + <code>REFRESH FAST ON DEMAND</code> di replika', '11, 12'],
    ['Two-phase commit', '<code>COMMIT</code> atas dua basis data', '13'],
    ['Transaksi ragu-ragu', '<code>ORA-2PC-CRASH-TEST-7</code>, <code>DBA_2PC_PENDING</code>, <code>COMMIT FORCE</code>', '14a–14d'],
    ['Reduksi lokalisasi', 'Partition pruning: <code>PARTITION LIST SINGLE</code>', '07, 16'],
    ['Join terdistribusi', 'Operasi <code>REMOTE</code> pada rencana eksekusi', '16'],
  ])}

<h2 id="skrip">${skrip.length} skrip</h2>
${skrip.map((f) => {
    const h = statusUji.get(f.nama);
    return `
<details>
  <summary>${esc(f.nama)} ${h ? `<span class="lencana ${h.status === 'LULUS' ? 'ok' : 'gagal'}">${h.status} · ${h.lulus.length} cek</span> <span class="lencana netral">${esc(h.situs.join(', '))} · ${esc(h.sebagai)}</span>` : `<span class="lencana netral">${f.baris} baris</span>`}</summary>
  ${h && h.lulus.length ? `<ul class="kecil">${h.lulus.map((l) => `<li>LULUS: ${esc(l)}</li>`).join('')}</ul>` : ''}
  ${h && h.galatDiharapkan.length ? `<p class="kecil">Galat peragaan yang memang harus muncul: ${h.galatDiharapkan.map((k) => `<code>${esc(k)}</code>`).join(' ')}</p>` : ''}
  ${h ? `<p class="kecil">Log SQL*Plus: ${h.log.map((l) => `<a href="${tautanLog(l)}" rel="noopener">${esc(l.replace('bukti/', ''))}</a>`).join(' · ')}</p>` : ''}
  <pre><code>${warnaSql(f.isi)}</code></pre>
</details>`;
  }).join('\n')}

<h2 id="menjalankan">Menjalankan sendiri</h2>
<p>Otomatis (butuh Docker; image <code>gvenzl/oracle-free:23-slim</code> ±2,8 GB):</p>
<pre><code>${esc('node tools/uji_oracle.mjs          # siapkan 3 situs dari nol, jalankan semua skrip\nnode tools/verifikasi_oracle.mjs   # bandingkan mesin terminal dengan Oracle')}</code></pre>
<p>Manual dengan SQL*Plus: baris <code>-- @jalankan situs=... sebagai=...</code> di awal setiap skrip menyebut basis data dan pengguna yang dipakai; sandi diminta lewat variabel <code>&amp;&amp;sandi_rs_app</code>. Urutan lengkap ada di <a href="${SITUS.repo}/blob/main/oracle/00_URUTAN_JALANKAN.md" rel="noopener">00_URUTAN_JALANKAN.md</a>.</p>
`;
  return halaman({ judul: 'Skrip Oracle', deskripsi: `${skrip.length} skrip Oracle yang diuji otomatis pada Oracle sungguhan: tiga situs, database link, partisi, replikasi, 2PC, dan transaksi ragu-ragu.`, isi, aktif: 'oracle', kanonik: 'oracle.html' });
}

function U_TABEL(kepala, baris) {
  return `<div class="tabel-bungkus"><table><thead><tr>${kepala.map((k) => `<th>${k}</th>`).join('')}</tr></thead><tbody>${baris.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function halamanKualitas(statistik) {
  const jumlahCoba = Object.values(COBA_MATERI).reduce((n, d) => n + d.length, 0);
  const baris = [
    ['Kesesuaian fungsional', 'functional suitability', `${statistik.uji} uji otomatis atas mesin; ${statistik.kueriVerif} kueri dan skrip DML diverifikasi silang terhadap SQLite${VERIF_ORACLE ? ` dan terhadap Oracle sungguhan (${VERIF_ORACLE.kueri.lulus + VERIF_ORACLE.dml.lulus}/${VERIF_ORACLE.kueri.jumlah + VERIF_ORACLE.dml.jumlah} identik, ${VERIF_ORACLE.galat.lulus}/${VERIF_ORACLE.galat.jumlah} kode galat sama)` : ''}${UJI_ORACLE ? `; ${UJI_ORACLE.skripLulus}/${UJI_ORACLE.skrip} skrip Oracle lulus ${UJI_ORACLE.cekLulus} pemeriksaan mandiri` : ''}; ${CONTOH.length} contoh terminal dan ${jumlahCoba} kueri per topik diuji berjalan persis seperti yang dijanjikan.`, 'tests/, tools/verify_sqlite.py, tools/uji_oracle.mjs, tools/verifikasi_oracle.mjs, oracle/HASIL_UJI.md'],
    ['Efisiensi kinerja', 'performance efficiency', 'Pratinjau terminal dan penilaian bank soal berjalan saat mengetik, dengan ketikan beruntun digabung menjadi satu evaluasi. Uji kinerja memastikan setiap contoh terminal selesai dalam anggaran waktu; pemeriksaan tombol Jalankan pada SQL buatan lab dikerjakan saat peramban senggang (requestIdleCallback).', 'tests/terminal.test.js (grup kinerja), src/labs/terminal-ui.js'],
    ['Kompatibilitas', 'compatibility', 'Situs statis tanpa server dan tanpa dependensi; modul ES standar. Skrip dari \\ekspor dan folder oracle/ ditulis dalam sintaks Oracle agar dapat dipindahkan ke instans sungguhan.', 'docs/, oracle/'],
    ['Kemampuan interaksi', 'interaction capability', 'Pencarian Ctrl+K, catatan istilah pada teks materi, pratinjau langsung, pelengkap otomatis, saran "maksud Anda", tema terang/gelap, tautan lewati-ke-isi, fokus keyboard terlihat, dan gerak dikurangi bila pengguna memintanya.', 'src/site.js, src/styles.css, tools/cek_situs.js (pemeriksaan aksesibilitas)'],
    ['Keandalan', 'reliability', 'Galat satu perintah tidak menghentikan perintah berikutnya; setiap lab dibungkus penangkap galat; situs bisa dibuka luring lewat service worker berversi.', 'engine/core/terminal.js, src/labs/ui.js, docs/sw.js'],
    ['Keamanan', 'security', 'Content-Security-Policy membatasi skrip ke asal situs sendiri; tidak ada skrip pihak ketiga, pelacak, cookie, atau formulir yang mengirim data; semua keluaran pengguna di-escape; pemeriksa situs menolak alamat surel dan nomor telepon yang bocor.', 'tools/build.js (meta CSP), tools/cek_situs.js, SECURITY.md'],
    ['Kemudahan pemeliharaan', 'maintainability', `${statistik.fungsi} fungsi mesin ditulis sebagai modul kecil tanpa dependensi, diuji di Node dengan berkas yang sama yang dijalankan peramban. CI menolak keluaran docs/ dan oracle/ yang basi.`, '.github/workflows/verifikasi.yml'],
    ['Fleksibilitas', 'flexibility', 'Enam preset basis data, skema kosong untuk CREATE TABLE sendiri, perpindahan situs lokal, aturan kunci asing yang bisa diubah, dan ekspor ke Oracle.', 'engine/core/terminal.js'],
    ['Keselamatan', 'safety', 'Tidak ada operasi yang menyentuh sistem nyata: semua DML/DDL terjadi pada salinan data di memori peramban. Data kependudukan memakai NIK fiktif bersegmen 9999.', 'engine/data/datasets.js'],
  ];
  const isi = `
<p class="kicker">Standar kualitas</p>
<h1>Kualitas produk yang bisa diperiksa</h1>
<p class="lede">Halaman ini memetakan ORACLEDECK ke sembilan karakteristik mutu produk <b>ISO/IEC 25010:2023</b> dan menunjuk bukti yang bisa Anda periksa sendiri di repositori. ORACLEDECK <b>mengacu</b> pada standar ini; ia <b>tidak</b> disertifikasi dan belum diaudit pihak ketiga.</p>

<h2>Sembilan karakteristik ISO/IEC 25010:2023</h2>
<div class="tabel-bungkus"><table>
<thead><tr><th style="width:20%">Karakteristik</th><th>Yang diterapkan</th><th style="width:26%">Bukti</th></tr></thead>
<tbody>
${baris.map(([id, en, apa, bukti]) => `<tr><td><strong>${esc(id)}</strong><br><span class="kecil">${esc(en)}</span></td><td>${esc(apa)}</td><td class="mono kecil">${esc(bukti)}</td></tr>`).join('\n')}
</tbody></table></div>

<h2>Aksesibilitas</h2>
<p>Target rujukan: <b>WCAG 2.2 tingkat AA</b>. Yang sudah diperiksa otomatis setiap build: atribut <code>lang</code>, satu <code>&lt;h1&gt;</code> per halaman, landmark <code>&lt;main&gt;</code>, urutan judul tanpa loncatan, teks alternatif gambar, nama yang dapat dibaca untuk tombol dan kolom isian statis. Yang <b>belum</b> diperiksa otomatis: kontras warna setiap kombinasi, isi yang digambar skrip lab, dan pengujian dengan pembaca layar sungguhan.</p>

<h2>Proses</h2>
<ul>
  <li><b>Versi</b> mengikuti Semantic Versioning; perubahan dicatat di <code>CHANGELOG.md</code> dengan format Keep a Changelog.</li>
  <li><b>Pelaporan celah keamanan</b> diatur di <code>SECURITY.md</code>.</li>
  <li><b>Setiap push</b> menjalankan uji, verifikasi SQLite, pembangkitan ulang skrip Oracle dan situs, lalu pemeriksa situs. Keluaran yang berbeda dari yang di-commit menggagalkan CI.</li>
</ul>

<h2>Batas yang jujur</h2>
<div class="catatan peringatan"><p>Skrip Oracle diuji pada Oracle AI Database 26ai Free di satu container dengan tiga PDB, bukan tiga server di jaringan sungguhan — latensi dan kegagalan jaringan tidak ikut teruji. Rencana eksekusi terminal mengikuti evaluasi logis mesin ini, bukan pengoptimal biaya Oracle. Teks pesan galat terminal ditulis ulang dalam bahasa Indonesia; yang dijamin sama dengan Oracle adalah kodenya, dan hanya untuk kasus yang terdaftar.</p></div>

<p class="kecil">Rujukan: <a href="https://www.iso.org/standard/78176.html" rel="noopener">ISO/IEC 25010:2023</a> · <a href="https://quality.arc42.org/standards/iso-25010" rel="noopener">ringkasan model mutu arc42</a> · <a href="https://www.w3.org/TR/WCAG22/" rel="noopener">WCAG 2.2</a> · <a href="https://semver.org/lang/id/" rel="noopener">Semantic Versioning</a> · <a href="https://keepachangelog.com/id-ID/1.1.0/" rel="noopener">Keep a Changelog</a></p>
`;
  return halaman({ judul: 'Standar Kualitas', deskripsi: 'Pemetaan ORACLEDECK ke sembilan karakteristik ISO/IEC 25010:2023 dan WCAG 2.2 AA beserta bukti yang dapat diperiksa.', isi, aktif: 'kualitas', kanonik: 'kualitas.html' });
}

function halamanAudit(teks) {
  const isi = `
<p class="kicker">Audit</p>
<h1>Audit materi dan proyek terdahulu</h1>
<p class="lede">Pemeriksaan jujur terhadap skema praktikum, laporan Project UAS Kelompok 3, dan proyek ini sendiri — beserta perbaikan yang sudah diterapkan.</p>
${markdownRingan(teks)}
`;
  return halaman({ judul: 'Audit', deskripsi: 'Audit skema praktikum, laporan Project UAS, dan proyek ORACLEDECK sendiri.', isi, aktif: 'audit', kanonik: 'audit.html' });
}

function halamanGlosarium(istilah) {
  const huruf = [...new Set(istilah.map((i) => i.istilah[0].toUpperCase()))].sort();
  const isi = `
<p class="kicker">Glosarium</p>
<h1>${istilah.length} istilah basis data terdistribusi</h1>
<p class="lede">Setiap istilah ditulis ulang dalam bahasa Indonesia yang jelas, bukan disalin dari modul, lengkap dengan rincian cara kerjanya, contoh konkret, dan lab tempat konsep itu bisa dicoba. Di halaman materi, istilah yang bergaris titik-titik menampilkan catatan yang sama saat disorot atau difokus dengan keyboard.</p>
<p class="pita">${huruf.map((h) => `<span><a href="#h-${h}">${h}</a></span>`).join('')}</p>
${huruf.map((h) => `
<h2 id="h-${h}">${h}</h2>
<div class="tabel-bungkus"><table>
<thead><tr><th style="width:22%">Istilah</th><th>Arti, rincian, dan contoh</th><th style="width:18%">Topik &amp; lab</th></tr></thead>
<tbody>
${istilah.filter((i) => i.istilah[0].toUpperCase() === h).map((i) => `<tr id="${slugIstilah(i.istilah)}"><td><strong>${esc(i.istilah)}</strong>${i.en ? `<br><span class="kecil">${esc(i.en)}</span>` : ''}</td><td>${i.arti}${i.detail ? `<br><span class="kecil">${esc(i.detail)}</span>` : ''}${i.contoh ? `<br><span class="kecil"><b>Contoh:</b> ${esc(i.contoh)}</span>` : ''}</td><td class="kecil">${(i.topik || []).map((n) => `<a href="materi/${String(n).padStart(2, '0')}-${MATERI.find((m) => m.no === n).slug}.html">${n}</a>`).join(', ')}${i.lab ? `<br><a href="lab/${i.lab}.html">Lab ${esc(LAB.find((l) => l.slug === i.lab).judul)}</a>` : ''}</td></tr>`).join('\n')}
</tbody></table></div>`).join('\n')}
`;
  return halaman({ judul: 'Glosarium', deskripsi: `${istilah.length} istilah basis data terdistribusi dengan penjelasan berbahasa Indonesia.`, isi, aktif: 'glosarium', kanonik: 'glosarium.html' });
}

/** Markdown seadanya: cukup untuk AUDIT.md — judul, daftar, tabel, kode, tebal. */
export function markdownRingan(md) {
  const baris = String(md).split('\n');
  const out = [];
  let dalamKode = false;
  let dalamDaftar = false;
  let tabel = null;
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  const tutupDaftar = () => { if (dalamDaftar) { out.push('</ul>'); dalamDaftar = false; } };
  const tutupTabel = () => {
    if (!tabel) return;
    out.push(`<div class="tabel-bungkus"><table><thead><tr>${tabel.kepala.map((k) => `<th>${inline(k)}</th>`).join('')}</tr></thead><tbody>${tabel.baris.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    tabel = null;
  };

  for (const b of baris) {
    if (b.startsWith('```')) {
      tutupDaftar(); tutupTabel();
      out.push(dalamKode ? '</code></pre>' : '<pre><code>');
      dalamKode = !dalamKode;
      continue;
    }
    if (dalamKode) { out.push(esc(b)); continue; }

    if (/^\|/.test(b)) {
      tutupDaftar();
      const sel = b.split('|').slice(1, -1).map((x) => x.trim());
      if (/^[-: ]+$/.test(sel.join(''))) continue;
      if (!tabel) tabel = { kepala: sel, baris: [] };
      else tabel.baris.push(sel);
      continue;
    }
    tutupTabel();

    if (/^#{1,4} /.test(b)) {
      tutupDaftar();
      const n = b.match(/^#+/)[0].length;
      const t = b.replace(/^#+ /, '');
      const tag = Math.min(Math.max(n, 2), 4);
      out.push(`<h${tag} id="${slugify(t)}">${inline(t)}</h${tag}>`);
      continue;
    }
    if (/^[-*] /.test(b)) {
      if (!dalamDaftar) { out.push('<ul>'); dalamDaftar = true; }
      out.push(`<li>${inline(b.replace(/^[-*] /, ''))}</li>`);
      continue;
    }
    tutupDaftar();
    if (/^---+$/.test(b.trim())) { out.push('<hr>'); continue; }
    if (b.trim() === '') continue;
    if (/^> /.test(b)) { out.push(`<div class="catatan"><p>${inline(b.replace(/^> /, ''))}</p></div>`); continue; }
    out.push(`<p>${inline(b)}</p>`);
  }
  tutupDaftar(); tutupTabel();
  return out.join('\n');
}


/** Sidik jari isi seluruh aset: berubah hanya bila ada berkas yang berubah. */
function sidikAset(dirs) {
  const h = createHash('sha256');
  const jalan = (d) => {
    for (const f of readdirSync(d, { withFileTypes: true }).sort((a, c) => (a.name < c.name ? -1 : 1))) {
      const p = join(d, f.name);
      if (f.isDirectory()) jalan(p);
      else if (/\.(js|css|json)$/.test(f.name)) { h.update(f.name); h.update(readFileSync(p, 'utf8').replace(/\r\n/g, '\n')); }
    }
  };
  dirs.forEach(jalan);
  return h.digest('hex').slice(0, 10);
}

/**
 * Tambahkan ?v=<sidik> pada setiap impor relatif .js di keluaran. Tanpa ini, peramban
 * pengunjung dapat terus memakai modul lama dari cache setelah situs diperbarui —
 * halaman baru berpasangan dengan mesin lama, dan hasilnya salah tanpa pesan galat.
 */
function versikanImpor(dir, versi) {
  let n = 0;
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) { n += versikanImpor(p, versi); continue; }
    if (!f.name.endsWith('.js')) continue;
    const asli = readFileSync(p, 'utf8');
    const baru = asli.replace(/(from\s+['"])(\.{1,2}\/[^'"?]+\.js)(['"])/g, `$1$2?v=${versi}$3`);
    if (baru !== asli) { writeFileSync(p, baru); n++; }
  }
  return n;
}

// ------------------------------------------------------------ pencarian & PWA

/** Indeks pencarian: materi (termasuk subjudul), lab, istilah, contoh SQL, soal, dan skrip Oracle. */
export function indeksCari(skrip = []) {
  const polos = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const out = [];
  for (const m of MATERI) {
    const teks = m.bagian.map((b) => [b.h, ...[].concat(b.p || []), ...(b.ul || [])].map(polos).join(' ')).join(' ');
    out.push({ g: 'materi', j: `${m.no}. ${m.judul}`, k: polos(m.ringkas), t: teks.slice(0, 1600), u: `materi/${String(m.no).padStart(2, '0')}-${m.slug}.html`, b: 6 });
    for (const b of m.bagian.filter((x) => x.h)) {
      out.push({ g: 'subtopik', j: polos(b.h), k: `Topik ${m.no}: ${m.judul}`, t: [].concat(b.p || []).map(polos).join(' ').slice(0, 300), u: `materi/${String(m.no).padStart(2, '0')}-${m.slug}.html#${slugify(b.h)}`, b: 2 });
    }
  }
  for (const l of LAB) out.push({ g: 'lab', j: l.judul, k: polos(l.ringkas), u: `lab/${l.slug}.html`, b: 7 });
  for (const g of GLOSARIUM) out.push({ g: 'istilah', j: g.istilah, k: polos(g.arti).slice(0, 160), t: `${g.en || ''} ${polos(g.detail || '')}`, u: `glosarium.html#${slugIstilah(g.istilah)}`, b: 3 });
  for (const c of CONTOH) out.push({ g: 'SQL', j: c.judul, k: `${c.kel} · ${c.db}`, t: c.sql, sql: c.sql, db: c.db, b: 1 });
  for (const s of BANK_SOAL) out.push({ g: 'soal', j: `${s.id} ${s.judul}`, k: polos(s.soal), u: 'lab/soal.html', b: 1 });
  for (const f of skrip) out.push({ g: 'oracle', j: f.nama, k: `${f.baris} baris skrip Oracle`, u: 'oracle.html', b: 1 });
  out.push({ g: 'halaman', j: 'Audit', k: 'Audit materi, proyek terdahulu, dan ORACLEDECK sendiri', u: 'audit.html', b: 2 });
  out.push({ g: 'halaman', j: 'Standar kualitas', k: 'Pemetaan ISO/IEC 25010 dan WCAG ke bukti yang bisa diperiksa', u: 'kualitas.html', b: 2 });
  return out;
}

function tulisPwa() {
  writeFileSync(join(OUT, 'manifest.webmanifest'), JSON.stringify({
    name: `${SITUS.nama} — ${SITUS.tagline}`,
    short_name: SITUS.nama,
    description: SITUS.deskripsi,
    lang: 'id',
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: '#0b0e13',
    theme_color: '#0b0e13',
    icons: [{ src: 'ikon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  }, null, 2));
  writeFileSync(join(OUT, 'ikon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b0e13"/><ellipse cx="32" cy="20" rx="18" ry="7" fill="none" stroke="#f04438" stroke-width="4"/><path d="M14 20v24c0 4 8 7 18 7s18-3 18-7V20" fill="none" stroke="#f04438" stroke-width="4"/><path d="M14 32c0 4 8 7 18 7s18-3 18-7" fill="none" stroke="#f04438" stroke-width="4"/></svg>`);
  const berkas = [];
  const jalan = (d, awal = '') => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      if (f.isDirectory()) jalan(join(d, f.name), `${awal}${f.name}/`);
      else if (!/^(sw\.js|sitemap\.xml|robots\.txt|\.nojekyll)$/.test(f.name)) berkas.push(`${awal}${f.name}`);
    }
  };
  jalan(OUT);
  berkas.sort();
  writeFileSync(join(OUT, 'sw.js'), `// sw.js — dibangkitkan tools/build.js. Membuat situs tetap bisa dibuka tanpa jaringan.
// Strategi: HTML jaringan-dulu (isi terbaru bila online), aset lain cache-dulu (sudah berversi).
const CACHE = 'oracledeck-${VERSI_ASET}';
const BERKAS = ${JSON.stringify(berkas)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BERKAS.map((b) => new Request(b, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x.startsWith('oracledeck-') && x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const html = e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (html) {
    e.respondWith(fetch(e.request).then((r) => { const salin = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, salin)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
  } else {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
  }
});
`);
  return berkas.length;
}

// ------------------------------------------------------------------- main

function bacaStatistik() {
  let uji = 0;
  try {
    const berkasUji = readdirSync(join(ROOT, 'tests')).filter((f) => f.endsWith('.test.js'));
    for (const f of berkasUji) {
      uji += (readFileSync(join(ROOT, 'tests', f), 'utf8').match(/^uji\(/gm) || []).length;
    }
  } catch { /* abaikan */ }
  let fungsi = 0;
  const hitung = (dir) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      if (f.isDirectory()) hitung(join(dir, f.name));
      else if (f.name.endsWith('.js')) {
        fungsi += (readFileSync(join(dir, f.name), 'utf8').match(/^export (async )?function |^export class /gm) || []).length;
      }
    }
  };
  hitung(join(ROOT, 'engine'));
  let kueriVerif = 0;
  try {
    kueriVerif = (readFileSync(join(ROOT, 'tools', 'export_for_verify.js'), 'utf8').match(/^ {2}\['/gm) || []).length;
  } catch { /* abaikan */ }
  const berkasOracle = existsSync(join(ROOT, 'oracle')) ? readdirSync(join(ROOT, 'oracle')).filter((f) => f.endsWith('.sql')).length : 0;
  return { uji, fungsi, kueriVerif, berkasOracle };
}

function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, 'materi'), { recursive: true });
  mkdirSync(join(OUT, 'lab', 'js'), { recursive: true });

  const statistik = bacaStatistik();
  VERSI_ASET = sidikAset([join(ROOT, 'engine'), SRC]);
  GLOSARIUM = JSON.parse(readFileSync(join(SRC, 'content', 'glosarium.json'), 'utf8'));
  const bacaJson = (nama) => (existsSync(join(ROOT, 'oracle', nama)) ? JSON.parse(readFileSync(join(ROOT, 'oracle', nama), 'utf8')) : null);
  UJI_ORACLE = bacaJson('hasil-uji.json');
  VERIF_ORACLE = bacaJson('verifikasi-mesin.json');

  // aset
  cpSync(join(SRC, 'styles.css'), join(OUT, 'styles.css'));
  cpSync(join(SRC, 'site.js'), join(OUT, 'site.js'));
  cpSync(join(SRC, 'tema.js'), join(OUT, 'tema.js'));
  cpSync(join(ROOT, 'engine'), join(OUT, 'engine'), { recursive: true });
  cpSync(join(SRC, 'content'), join(OUT, 'content'), { recursive: true });
  if (existsSync(join(SRC, 'labs'))) {
    for (const f of readdirSync(join(SRC, 'labs'))) cpSync(join(SRC, 'labs', f), join(OUT, 'lab', 'js', f));
  }
  writeFileSync(join(OUT, '.nojekyll'), '');
  const berkasDiversi = versikanImpor(OUT, VERSI_ASET);

  // halaman
  writeFileSync(join(OUT, 'index.html'), beranda(statistik));
  writeFileSync(join(OUT, 'materi', 'index.html'), daftarMateri());
  MATERI.forEach((m, i) => writeFileSync(join(OUT, 'materi', `${String(m.no).padStart(2, '0')}-${m.slug}.html`), halamanMateri(m, i)));
  writeFileSync(join(OUT, 'lab', 'index.html'), daftarLab());
  LAB.forEach((l, i) => writeFileSync(join(OUT, 'lab', `${l.slug}.html`), halamanLab(l, i)));

  const skrip = existsSync(join(ROOT, 'oracle'))
    ? readdirSync(join(ROOT, 'oracle')).filter((f) => f.endsWith('.sql')).sort().map((f) => {
      const isi = readFileSync(join(ROOT, 'oracle', f), 'utf8');
      return { nama: f, isi, baris: isi.split('\n').length };
    })
    : [];
  writeFileSync(join(OUT, 'oracle.html'), halamanOracle(skrip));

  const audit = existsSync(join(ROOT, 'AUDIT.md')) ? readFileSync(join(ROOT, 'AUDIT.md'), 'utf8') : '# Audit\n\nBelum tersedia.';
  writeFileSync(join(OUT, 'audit.html'), halamanAudit(audit.replace(/^# .*\n/, '')));

  writeFileSync(join(OUT, 'glosarium.html'), halamanGlosarium(GLOSARIUM));
  writeFileSync(join(OUT, 'kualitas.html'), halamanKualitas(statistik));
  writeFileSync(join(OUT, 'cari.json'), JSON.stringify(indeksCari(skrip)));
  tulisPwa();

  // peta situs
  const url = [
    '', 'materi/', 'lab/', 'oracle.html', 'audit.html', 'glosarium.html', 'kualitas.html',
    ...MATERI.map((m) => `materi/${String(m.no).padStart(2, '0')}-${m.slug}.html`),
    ...LAB.map((l) => `lab/${l.slug}.html`),
  ];
  writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${url.map((u) => `  <url><loc>${SITUS.url}/${u}</loc></url>`).join('\n')}
</urlset>`);
  writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITUS.url}/sitemap.xml\n`);

  const jumlah = 7 + MATERI.length + LAB.length;
  process.stdout.write(`Situs dibangun ke docs/\n  ${jumlah} halaman HTML\n  blok SQL: ${statistikBlokSql.dapatDijalankan} bisa dijalankan di terminal, ${statistikBlokSql.hanyaOracle} khusus Oracle\n  ${statistik.uji} uji · ${statistik.fungsi} fungsi mesin · ${statistik.kueriVerif} kueri terverifikasi · ${skrip.length} skrip Oracle\n`);
}

// jalankan hanya bila dipanggil langsung, agar fungsi pembantunya bisa diuji
if (process.argv[1] && /build\.js$/.test(process.argv[1].replace(/\\/g, '/'))) main();
