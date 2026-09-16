// Lab 06 — Dekomposisi Kueri: empat langkah Modul 7.
import { RS_SCHEMA } from '../../engine/data/datasets.js?v=8e172babd6';
import * as D from '../../engine/ddb/decompose.js?v=8e172babd6';
import { treeToText } from '../../engine/ddb/localize.js?v=8e172babd6';
import * as U from './ui.js?v=8e172babd6';

const SKEMA = {
  ...RS_SCHEMA,
  STAFF: ['staffno', 'fname', 'lname', 'position', 'sex', 'dob', 'salary', 'branchno'],
  BRANCH: ['branchno', 'street', 'city', 'postcode'],
};

const CONTOH = [
  {
    judul: 'Kueri benar dengan join dan dua predikat',
    sql: "SELECT p.nama_pasien, d.nama_dokter\n  FROM pasien p\n  JOIN pasien_dokter pd ON p.id_pasien = pd.id_pasien\n  JOIN dokter d ON pd.id_dokter = d.id_dokter\n WHERE p.kota = 'Jakarta' AND d.spesialis = 'Anak'",
  },
  {
    judul: 'Predikat berulang (p ∧ p ≡ p)',
    sql: "SELECT nama_pasien FROM pasien\n WHERE kota = 'Jakarta' AND kota = 'Jakarta'",
  },
  {
    judul: 'Absorpsi (p ∧ (p ∨ q) ≡ p)',
    sql: "SELECT nama_pasien FROM pasien\n WHERE kota = 'Jakarta' AND (kota = 'Jakarta' OR penyakit = 'Tifus')",
  },
  {
    judul: 'Tautologi dalam klausa (p ∨ ¬p ≡ true)',
    sql: "SELECT nama_pasien FROM pasien\n WHERE (jenis_kelamin = 'L' OR jenis_kelamin <> 'L') AND kota = 'Bandung'",
  },
  {
    judul: 'Kontradiksi — kueri selalu kosong',
    sql: "SELECT * FROM pasien WHERE kota = 'Jakarta' AND kota = 'Bandung'",
  },
  {
    judul: 'Salah tipe — atribut tidak ada di skema global',
    sql: "SELECT nama_pasienX FROM pasien WHERE kota = 'Bandung'",
  },
  {
    judul: 'Salah tipe — relasi tidak ada',
    sql: 'SELECT * FROM rekam_medis',
  },
  {
    judul: 'Salah semantik — graf kueri tidak terhubung',
    sql: "SELECT p.nama_pasien, d.nama_dokter\n  FROM pasien p, dokter d\n WHERE p.kota = 'Jakarta'",
  },
  {
    judul: 'De Morgan — NOT didorong ke dalam',
    sql: "SELECT * FROM pasien\n WHERE NOT (kota = 'Jakarta' AND jenis_kelamin = 'L')",
  },
  {
    judul: 'Distribusi OR ke dalam AND (CNF vs DNF)',
    sql: "SELECT * FROM pasien\n WHERE kota = 'Jakarta' OR (penyakit = 'Asma' AND jenis_kelamin = 'P')",
  },
];

function render() {
  U.pasang(`
${U.catatan('Empat langkah dekomposisi kueri pada Modul 7 dijalankan atas SQL yang Anda ketik sendiri: <b>normalisasi</b> ke CNF dan DNF, <b>analisis</b> tipe dan graf kueri, <b>eliminasi redundansi</b> memakai hukum idempoten, lalu <b>penulisan ulang</b> menjadi pohon operator.')}

<div class="kartu">
  <h3>Kueri masukan</h3>
  <textarea id="sql" rows="6" spellcheck="false">${U.esc(CONTOH[0].sql)}</textarea>
  <div class="kontrol" style="margin-top:10px">${U.tombol('jalan', 'Dekomposisi')}</div>
</div>

<h3>Contoh</h3>
<div class="grid tiga">
${CONTOH.map((c) => `<button type="button" class="hantu kecil contoh" data-sql="${U.esc(c.sql)}" style="text-align:left">${U.esc(c.judul)}</button>`).join('')}
</div>

<div id="keluaran"></div>

<h2>Aturan idempoten yang dipakai</h2>
${U.tabel(['Aturan', 'Jenis'], D.ATURAN_IDEMPOTEN.map((a) => [`<code>${U.esc(a.nama)}</code>`, a.jenis]))}
`);
  document.getElementById('jalan').addEventListener('click', jalankan);
  U.$$('.contoh').forEach((b) => b.addEventListener('click', () => {
    document.getElementById('sql').value = b.dataset.sql;
    jalankan();
  }));
  jalankan();
}

function jalankan() {
  const sql = document.getElementById('sql').value;
  const w = document.getElementById('keluaran');
  let r;
  try { r = D.decompose(sql, SKEMA); } catch (e) {
    w.innerHTML = `<div class="catatan bahaya"><p><b>Kueri tidak dapat diurai:</b></p><p class="galat">${U.esc(e.message)}</p></div>`;
    return;
  }

  const a = r.analisis;
  const jenisMasalah = (j) => (j === 'ambigu' ? 'warn' : 'gagal');

  w.innerHTML = `
<h2>Langkah 1 — Normalisasi</h2>
${r.normalisasi.cnf ? `
<div class="grid dua">
  <div class="kartu">
    <h3>Bentuk normal konjungtif (CNF)</h3>
    <p class="kecil">Konjungsi dari disjungsi. Bentuk baku untuk pemrosesan lanjut.</p>
    ${U.pre(r.normalisasi.cnf.teks)}
    <p class="kecil">${r.normalisasi.cnf.jumlahKlausa} klausa.</p>
  </div>
  <div class="kartu">
    <h3>Bentuk normal disjungtif (DNF)</h3>
    <p class="kecil">Disjungsi dari konjungsi. Bentuk inilah yang dipakai menurunkan predikat minterm untuk fragmentasi horizontal.</p>
    ${U.pre(r.normalisasi.dnf.teks)}
    <p class="kecil">${r.normalisasi.dnf.jumlahTerm} term.</p>
  </div>
</div>` : '<p class="kosong">Kueri tidak punya klausa WHERE — tidak ada yang perlu dinormalkan.</p>'}

<h2>Langkah 2 — Analisis ${a.diterima ? U.lencana('DITERIMA', 'ok') : U.lencana('DITOLAK', 'gagal')}</h2>
${a.masalah.length
    ? `${U.tabel(['Jenis', 'Masalah'], a.masalah.map((m) => [U.lencana(m.jenis, jenisMasalah(m.jenis)), U.esc(m.pesan)]))}`
    : U.catatan('Tidak ada masalah tipe maupun semantik. Kueri boleh lanjut ke lapisan lokalisasi data.', 'baik')}

<h3>Graf kueri</h3>
<p class="kecil">Simpul = relasi pada FROM, sisi = predikat join. Graf yang tidak terhubung berarti hasilnya perkalian kartesian — hampir pasti bukan yang dimaksud pengguna.</p>
${grafHtml(a.graf)}

<h2>Langkah 3 — Eliminasi redundansi</h2>
<div class="grid dua">
  <div class="kartu">
    <h4>Sebelum</h4>
    ${U.pre(r.redundansi.asal)}
    <p class="kecil">${r.redundansi.klausaAsal} klausa</p>
  </div>
  <div class="kartu">
    <h4>Sesudah</h4>
    ${U.pre(r.redundansi.hasil)}
    <p class="kecil">${r.redundansi.klausaSisa} klausa</p>
  </div>
</div>
${r.redundansi.jejak.length
    ? U.tabel(['Aturan yang dipakai', 'Pada'], r.redundansi.jejak.map((j) => [`<code>${U.esc(j.aturan)}</code>`, `<code>${U.esc(j.pada)}</code>`]))
    : '<p class="kosong">Tidak ada predikat berlebih — kualifikasi sudah minimal.</p>'}
${r.redundansi.selaluSalah ? U.catatan('Kualifikasi ini <b>selalu bernilai salah</b>. Kueri dijamin mengembalikan nol baris tanpa perlu menyentuh satu fragmen pun.', 'bahaya') : ''}

<h2>Langkah 4 — Penulisan ulang menjadi pohon operator</h2>
<p class="kecil">Daun berisi relasi yang tersimpan, simpul non-daun berisi operator aljabar, akar berisi jawaban kueri. Urutan operasi dibaca dari daun menuju akar.</p>
<div class="grid dua">
  <div class="kartu">
    <h4>Pohon apa adanya</h4>
    ${U.pohon(treeToText(r.pohon))}
  </div>
  <div class="kartu">
    <h4>Setelah selection didorong ke daun</h4>
    ${U.pohon(treeToText(r.dioptimasi.pohon))}
    ${r.dioptimasi.langkah.length
    ? `<ul class="kecil">${r.dioptimasi.langkah.map((s) => `<li>${U.esc(s)}</li>`).join('')}</ul>`
    : '<p class="kosong">Tidak ada selection yang bisa didorong.</p>'}
  </div>
</div>
${U.catatan('Mendorong selection sedekat mungkin ke daun adalah optimasi tunggal dengan dampak terbesar pada sistem terdistribusi: data disaring <i>sebelum</i> menyeberangi jaringan, bukan sesudahnya.', 'info')}
`;
}

function grafHtml(g) {
  if (!g.simpul.length) return '<p class="kosong">Tidak ada relasi pada FROM.</p>';
  const lebar = 620;
  const r = 34;
  const n = g.simpul.length;
  const cx = lebar / 2;
  const cy = 110;
  const jari = n <= 1 ? 0 : Math.min(180, 60 + n * 28);
  const pos = g.simpul.map((s, i) => {
    const sudut = n === 1 ? 0 : (i / n) * Math.PI * 2 - Math.PI / 2;
    return { s, x: cx + Math.cos(sudut) * jari, y: cy + Math.sin(sudut) * (jari * 0.55) };
  });
  const cari = (nm) => pos.find((p) => p.s === nm);
  const warnaKomponen = ['#f04438', '#60a5fa', '#34d399', '#fbbf24'];
  const komponenDari = (s) => g.komponen.findIndex((c) => c.includes(s));
  return `<div class="diagram"><svg viewBox="0 0 ${lebar} 230" role="img" aria-label="Graf kueri">
${g.sisi.map((e) => {
    const a = cari(e.dari); const b = cari(e.ke);
    if (!a || !b) return '';
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#2d3949" stroke-width="2"/>
<text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 6}" fill="#6c7a90" font-size="10" text-anchor="middle" font-family="monospace">${U.esc(e.label)}</text>`;
  }).join('\n')}
${pos.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="#131821" stroke="${warnaKomponen[komponenDari(p.s) % 4]}" stroke-width="2"/>
<text x="${p.x}" y="${p.y + 4}" fill="#e6ebf2" font-size="12" text-anchor="middle" font-family="monospace">${U.esc(p.s)}</text>`).join('\n')}
<text x="12" y="216" fill="#6c7a90" font-size="11" font-family="monospace">${g.komponen.length} komponen ${g.terhubung ? '— terhubung' : '— TIDAK terhubung'}</text>
</svg></div>`;
}

render();
