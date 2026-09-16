// build.js — generator situs statis ORACLEDECK. Nol dependensi.
// Keluaran: docs/ (siap dilayani GitHub Pages)
//
// Jalankan: node tools/build.js

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { MATERI, LAB, PRAKTIKUM } from '../src/content/materi.js';

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

function halaman({ judul, deskripsi, isi, aktif = '', dalam = 0, skrip = null, kanonik = '' }) {
  const naik = '../'.repeat(dalam);
  const tautan = [
    ['', 'Beranda'],
    ['materi/', 'Materi'],
    ['lab/', 'Laboratorium'],
    ['oracle.html', 'Oracle'],
    ['audit.html', 'Audit'],
    ['glosarium.html', 'Glosarium'],
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
<link rel="stylesheet" href="${naik}styles.css?v=${VERSI_ASET}">
</head>
<body>
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
  </div>
</header>
<main><div class="wrap">
${isi}
</div></main>
<footer class="site"><div class="wrap">
  <div><strong>${SITUS.nama}</strong> — ${SITUS.tagline}</div>
  <div>${esc(SITUS.matkul)} · ${esc(SITUS.kampus)}</div>
  <div>${esc(SITUS.penulis)} (${SITUS.npm}) · <a href="${SITUS.repo}" rel="noopener">kode sumber</a></div>
  <div class="kecil">Tidak berafiliasi dengan Oracle Corporation. Nama Oracle dipakai hanya sebagai rujukan teknis.</div>
</div></footer>
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
  if (b.kode) out.push(`<pre><code>${b.kode.bahasa === 'sql' ? warnaSql(b.kode.isi) : esc(b.kode.isi)}</code></pre>`);
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
</section>

<h2>Laboratorium</h2>
<p>Setiap lab menjalankan perhitungan sungguhan di peramban Anda. Tidak ada hasil yang disiapkan sebelumnya — ubah masukannya, angkanya ikut berubah.</p>
<div class="grid tiga">
${LAB.map((l) => `  <a class="tile" href="lab/${l.slug}.html">
    <div class="no">LAB ${String(l.no).padStart(2, '0')}</div>
    <h3>${l.judul}</h3>
    <p>${l.ringkas}</p>
  </a>`).join('\n')}
</div>

<h2>Empat belas topik</h2>
<p>Disusun mengikuti Rencana Pembelajaran Semester pada Modul 1. Tiap topik menautkan ke lab yang menjalankan konsepnya.</p>
<div class="grid dua">
${MATERI.map((m) => `  <a class="tile" href="materi/${String(m.no).padStart(2, '0')}-${m.slug}.html">
    <div class="no">TOPIK ${String(m.no).padStart(2, '0')}</div>
    <h3>${m.judul}</h3>
    <p>${m.ringkas}</p>
  </a>`).join('\n')}
</div>

<h2>Praktikum</h2>
<p>Lima lembar praktikum dari folder mata kuliah, seluruhnya dapat dijalankan ulang di Lab Mesin SQL dan Lab Perancang ERD.</p>
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
    <p>Rancangan yang Anda susun di lab diterjemahkan menjadi DDL Oracle sungguhan: PARTITION BY LIST, PARTITION BY REFERENCE, database link, materialized view, dan diagnosa <code>DBA_2PC_PENDING</code>.</p>
  </div>
</div>

<div class="catatan">
  <p><b>Batas yang jujur.</b> Skrip Oracle di repositori ini belum pernah dijalankan pada instans Oracle sungguhan — tidak ada Oracle di lingkungan pembuatannya. Yang diuji otomatis adalah pembangkitnya. Jalankan sendiri di Oracle XE untuk membuktikan bagian yang tidak bisa diuji tanpa basis data.</p>
</div>
`;
  return halaman({ judul: SITUS.nama, deskripsi: SITUS.deskripsi, isi, aktif: 'beranda', kanonik: '' });
}

function daftarMateri() {
  const isi = `
<p class="kicker">Materi</p>
<h1>Empat belas topik CTI313</h1>
<p class="lede">Disusun mengikuti Rencana Pembelajaran Semester pada Modul 1. Isinya diambil dari modul kuliah di folder mata kuliah, bukan dari ringkasan pihak ketiga.</p>

<div class="grid dua" style="margin-top:22px">
${MATERI.map((m) => `  <a class="tile" href="${String(m.no).padStart(2, '0')}-${m.slug}.html">
    <div class="no">TOPIK ${String(m.no).padStart(2, '0')}</div>
    <h3>${m.judul}</h3>
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
    + (m.tugas ? '<li><a href="#tugas">Tugas modul</a></li>' : '');
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

${m.bagian.map(renderBagian).join('\n\n')}

${m.tugas ? `<h2 id="tugas">${m.tugas.judul}</h2>
${m.tugas.butir.map((t, i) => `<details${i === 0 ? ' open' : ''}><summary>${i + 1}. ${t.tanya}</summary><p>${t.jawab}</p></details>`).join('')}` : ''}

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
  });
}

function daftarLab() {
  const isi = `
<p class="kicker">Laboratorium</p>
<h1>${LAB.length} lab yang benar-benar menghitung</h1>
<p class="lede">Semua perhitungan berjalan di peramban Anda memakai mesin yang sama dengan yang diuji ${bacaStatistik().uji} kali di Node. Tidak ada jawaban yang disiapkan sebelumnya.</p>
<div class="grid dua" style="margin-top:22px">
${LAB.map((l) => `  <a class="tile" href="${l.slug}.html">
    <div class="no">LAB ${String(l.no).padStart(2, '0')} · topik ${l.topik.join(', ')}</div>
    <h3>${l.judul}</h3>
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
<p class="lede">${l.ringkas}</p>
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
  });
}

function halamanOracle(skrip) {
  const isi = `
<p class="kicker">Oracle</p>
<h1>Dari rancangan ke Oracle</h1>
<p class="lede">Dua belas skrip yang menerjemahkan seluruh konsep kuliah menjadi objek Oracle sungguhan. Semuanya dihasilkan dari mesin yang sama dengan yang dipakai lab, sehingga tidak mungkin menyimpang dari rancangan yang ditampilkan.</p>

<h2>Pemetaan konsep ke fitur Oracle</h2>
<div class="tabel-bungkus"><table>
<thead><tr><th>Konsep kuliah</th><th>Fitur Oracle</th><th>Catatan</th></tr></thead>
<tbody>
<tr><td>Fragmentasi horizontal primer</td><td class="mono">PARTITION BY LIST / RANGE / HASH</td><td>Partisi DEFAULT menjamin kelengkapan</td></tr>
<tr><td>Fragmentasi horizontal turunan</td><td class="mono">PARTITION BY REFERENCE</td><td>Khas Oracle; baris anak selalu separtisi dengan induknya</td></tr>
<tr><td>Fragmentasi vertikal</td><td class="mono">Tabel terpisah + VIEW perekat</td><td>Kunci wajib ada di setiap tabel agar lossless-join</td></tr>
<tr><td>Alokasi fragmen ke situs</td><td class="mono">TABLESPACE per partisi</td><td>Satu tablespace per situs</td></tr>
<tr><td>Replikasi</td><td class="mono">MATERIALIZED VIEW + MV LOG</td><td>ON COMMIT = sinkron, ON DEMAND = asinkron</td></tr>
<tr><td>Transparansi lokasi</td><td class="mono">DATABASE LINK + SYNONYM</td><td>Pindah situs cukup ubah sinonim</td></tr>
<tr><td>Program lokalisasi horizontal</td><td class="mono">VIEW ... UNION ALL</td><td>Oracle memangkas cabang lewat predicate pushdown</td></tr>
<tr><td>Reduksi lokalisasi</td><td class="mono">Partition pruning (PSTART/PSTOP)</td><td>Terbaca langsung pada rencana eksekusi</td></tr>
<tr><td>Komitmen dua fase</td><td class="mono">COMMIT otomatis lintas link</td><td>Tidak ada perintah khusus — cukup COMMIT</td></tr>
<tr><td>Transaksi menggantung</td><td class="mono">DBA_2PC_PENDING</td><td>STATE = prepared berarti terblokir</td></tr>
<tr><td>Deteksi deadlock</td><td class="mono">ORA-00060 + trace file</td><td>Oracle mendeteksi sendiri dan mengorbankan satu sesi</td></tr>
<tr><td>Join terdistribusi</td><td class="mono">Operasi REMOTE pada rencana</td><td>Kolom OTHER berisi SQL yang benar-benar dikirim</td></tr>
</tbody></table></div>

<div class="catatan peringatan">
  <p><b>Belum dijalankan pada Oracle sungguhan.</b> Repositori ini dibangun tanpa akses ke instans Oracle. Yang diuji otomatis adalah <i>pembangkit</i> skripnya — bentuk DDL, nama objek, dan klausa partisi diperiksa oleh 40+ uji di <code>tests/oracle-emit.test.js</code>. Sintaks yang hanya bisa dibuktikan oleh parser Oracle belum diverifikasi. Jalankan sendiri di Oracle XE atau <code>gvenzl/oracle-free</code> untuk membuktikannya.</p>
</div>

<h2>Dua belas skrip</h2>
${skrip.map((s) => `
<details>
  <summary>${esc(s.nama)} <span class="lencana netral">${s.baris} baris</span></summary>
  <pre><code>${warnaSql(s.isi)}</code></pre>
</details>`).join('\n')}

<h2>Menjalankan cepat</h2>
<pre><code>${esc(`docker run -d --name oracle-free -p 1521:1521 -e ORACLE_PASSWORD=oracle \\
  gvenzl/oracle-free:23-slim

sqlplus sys/oracle@//localhost:1521/FREEPDB1 as sysdba
SQL> @01_tablespace_dan_user.sql
SQL> CONNECT RS_APP/sandi@//localhost:1521/FREEPDB1
SQL> @02_skema_global.sql
SQL> @12_data_contoh.sql`)}</code></pre>
`;
  return halaman({ judul: 'Skrip Oracle', deskripsi: 'Dua belas skrip Oracle: partisi, database link, materialized view, dan diagnosa two-phase commit.', isi, aktif: 'oracle', kanonik: 'oracle.html' });
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
<p class="lede">Setiap istilah ditulis ulang dalam bahasa Indonesia yang jelas, bukan disalin dari modul. Istilah teknis yang memang tidak punya padanan mapan dibiarkan dalam bentuk aslinya.</p>
<p class="pita">${huruf.map((h) => `<span><a href="#h-${h}">${h}</a></span>`).join('')}</p>
${huruf.map((h) => `
<h2 id="h-${h}">${h}</h2>
<div class="tabel-bungkus"><table>
<thead><tr><th style="width:22%">Istilah</th><th>Arti</th><th style="width:16%">Topik</th></tr></thead>
<tbody>
${istilah.filter((i) => i.istilah[0].toUpperCase() === h).map((i) => `<tr><td><strong>${esc(i.istilah)}</strong>${i.en ? `<br><span class="kecil">${esc(i.en)}</span>` : ''}</td><td>${i.arti}</td><td class="kecil">${(i.topik || []).map((n) => `<a href="materi/${String(n).padStart(2, '0')}-${MATERI.find((m) => m.no === n).slug}.html">${n}</a>`).join(', ')}</td></tr>`).join('\n')}
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
      const tag = Math.min(n + 1, 4);
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

  // aset
  cpSync(join(SRC, 'styles.css'), join(OUT, 'styles.css'));
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

  const glosarium = JSON.parse(readFileSync(join(SRC, 'content', 'glosarium.json'), 'utf8'));
  writeFileSync(join(OUT, 'glosarium.html'), halamanGlosarium(glosarium));

  // peta situs
  const url = [
    '', 'materi/', 'lab/', 'oracle.html', 'audit.html', 'glosarium.html',
    ...MATERI.map((m) => `materi/${String(m.no).padStart(2, '0')}-${m.slug}.html`),
    ...LAB.map((l) => `lab/${l.slug}.html`),
  ];
  writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${url.map((u) => `  <url><loc>${SITUS.url}/${u}</loc></url>`).join('\n')}
</urlset>`);
  writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITUS.url}/sitemap.xml\n`);

  const jumlah = 6 + MATERI.length + LAB.length;
  process.stdout.write(`Situs dibangun ke docs/\n  ${jumlah} halaman HTML\n  ${statistik.uji} uji · ${statistik.fungsi} fungsi mesin · ${statistik.kueriVerif} kueri terverifikasi · ${skrip.length} skrip Oracle\n`);
}

main();
