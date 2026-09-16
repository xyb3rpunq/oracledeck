// Lab 03 — Mesin SQL. Menjalankan SQL sungguhan atas data praktikum.
import { akademik, rumahsakit, dreamhome } from '../../engine/data/datasets.js';
import { execute, planToText } from '../../engine/core/sql.js';
import * as U from './ui.js';

const DB = { ...akademik(), ...rumahsakit(), ...dreamhome() };

const CONTOH = [
  { kel: 'Praktikum 3 — agregasi', judul: 'Mata kuliah semester 1', sql: 'SELECT * FROM mata_kuliah WHERE sem = 1' },
  { kel: 'Praktikum 3 — agregasi', judul: 'Selain semester 1', sql: 'SELECT * FROM mata_kuliah WHERE sem <> 1' },
  { kel: 'Praktikum 3 — agregasi', judul: 'Mengandung "Informatika" dan 3 SKS', sql: "SELECT * FROM mata_kuliah\nWHERE nama_kul LIKE '%Informatika%' AND sks = 3" },
  { kel: 'Praktikum 3 — agregasi', judul: 'COUNT, MIN, MAX, AVG, SUM', sql: 'SELECT COUNT(*) AS jumlah,\n       MIN(sks) AS sks_min,\n       MAX(sks) AS sks_maks,\n       AVG(sks) AS sks_rata,\n       SUM(sks) AS sks_total\n  FROM mata_kuliah' },
  { kel: 'Praktikum 4 — relasi tabel', judul: 'Nilai mata kuliah IT0401', sql: "SELECT mhs.nama_mhs, nilai.nilai\n  FROM mhs, nilai\n WHERE mhs.nim = nilai.nim\n   AND nilai.kode_kul = 'IT0401'" },
  { kel: 'Praktikum 4 — relasi tabel', judul: 'Tiga tabel, urut nilai menaik', sql: 'SELECT k.nama_kul, m.nama_mhs, n.nilai\n  FROM mhs m, nilai n, mata_kuliah k\n WHERE m.nim = n.nim AND n.kode_kul = k.kode_kul\n ORDER BY n.nilai ASC' },
  { kel: 'Praktikum 5 — JOIN', judul: 'INNER JOIN', sql: 'SELECT m.nama_mhs, n.kode_kul, n.nilai\n  FROM mhs m JOIN nilai n ON m.nim = n.nim' },
  { kel: 'Praktikum 5 — JOIN', judul: 'LEFT JOIN — mahasiswa tanpa nilai', sql: 'SELECT m.nama_mhs, n.kode_kul, n.nilai\n  FROM mhs m LEFT JOIN nilai n ON m.nim = n.nim' },
  { kel: 'Praktikum 5 — JOIN', judul: 'RIGHT JOIN', sql: 'SELECT m.nama_mhs, n.nilai\n  FROM mhs m RIGHT JOIN nilai n ON m.nim = n.nim' },
  { kel: 'Praktikum 5 — JOIN', judul: 'FULL OUTER JOIN', sql: 'SELECT m.nama_mhs, n.nilai\n  FROM mhs m FULL OUTER JOIN nilai n ON m.nim = n.nim' },
  { kel: 'Praktikum 5 — JOIN', judul: 'UNION', sql: "SELECT nama_mhs AS nama FROM mhs WHERE alamat_mhs = 'Bekasi'\nUNION\nSELECT nama_kul FROM mata_kuliah WHERE sks = 2" },
  { kel: 'Rumah sakit', judul: 'Riwayat pemeriksaan', sql: 'SELECT p.nama_pasien, d.nama_dokter, pd.waktu_periksa, pd.resep\n  FROM pasien p\n  JOIN pasien_dokter pd ON p.id_pasien = pd.id_pasien\n  JOIN dokter d ON pd.id_dokter = d.id_dokter\n ORDER BY pd.waktu_periksa' },
  { kel: 'Rumah sakit', judul: 'Statistik per dokter', sql: 'SELECT d.nama_dokter, d.spesialis,\n       COUNT(*) AS jumlah_periksa,\n       SUM(pd.biaya) AS total_biaya\n  FROM dokter d JOIN pasien_dokter pd ON d.id_dokter = pd.id_dokter\n GROUP BY d.nama_dokter, d.spesialis\n ORDER BY jumlah_periksa DESC' },
  { kel: 'Rumah sakit', judul: 'Pasien lebih dari satu kali periksa', sql: 'SELECT p.nama_pasien, COUNT(*) AS n\n  FROM pasien p JOIN pasien_dokter pd ON p.id_pasien = pd.id_pasien\n GROUP BY p.nama_pasien\nHAVING COUNT(*) > 1' },
  { kel: 'Rumah sakit', judul: 'Subquery: biaya di atas 400 ribu', sql: 'SELECT nama_pasien, kota FROM pasien\n WHERE id_pasien IN (SELECT id_pasien FROM pasien_dokter WHERE biaya > 400000)\n ORDER BY nama_pasien' },
  { kel: 'Rumah sakit', judul: 'Jumlah pasien per kota (kunci fragmentasi)', sql: 'SELECT kota, COUNT(*) AS jumlah FROM pasien GROUP BY kota ORDER BY kota' },
  { kel: 'DreamHome (Modul 6)', judul: 'Manajer — kueri transparansi fragmentasi', sql: "SELECT fname, lname FROM STAFF WHERE position = 'Manager'" },
  { kel: 'DreamHome (Modul 6)', judul: 'Fragmen cabang B3', sql: "SELECT staffno, fname, lname, salary FROM STAFF WHERE branchno = 'B3'" },
  { kel: 'DreamHome (Modul 6)', judul: 'Rata-rata gaji per cabang', sql: 'SELECT branchno, COUNT(*) AS staf, AVG(salary) AS gaji_rata\n  FROM STAFF GROUP BY branchno ORDER BY branchno' },
  { kel: 'DreamHome (Modul 6)', judul: 'Join staf dengan properti', sql: 'SELECT s.lname, b.city, COUNT(*) AS properti\n  FROM STAFF s JOIN BRANCH b ON s.branchno = b.branchno\n  JOIN PROPERTY p ON s.staffno = p.staffno\n GROUP BY s.lname, b.city ORDER BY properti DESC' },
  { kel: 'Kesalahan yang sengaja', judul: 'Kolom ambigu', sql: 'SELECT nim FROM mhs m JOIN nilai n ON m.nim = n.nim' },
  { kel: 'Kesalahan yang sengaja', judul: 'Tabel tidak ada', sql: 'SELECT * FROM tabel_hantu' },
  { kel: 'Kesalahan yang sengaja', judul: 'Fungsi tidak didukung', sql: 'SELECT MEDIAN(sks) FROM mata_kuliah' },
];

function skemaHtml() {
  return Object.entries(DB).map(([nama, rel]) => `<tr>
    <td class="mono"><strong>${nama}</strong></td>
    <td class="num">${rel.cardinality}</td>
    <td class="mono kecil">${rel.attrs.join(', ')}</td>
  </tr>`).join('');
}

function render() {
  const kelompok = [...new Set(CONTOH.map((c) => c.kel))];
  U.pasang(`
${U.catatan('Mesin SQL ini ditulis dari nol — tokenizer, parser, perencana, dan eksekutornya ada di <code>engine/core/sql.js</code>. Hasilnya diverifikasi silang terhadap SQLite untuk 39 kueri acuan. Semua perhitungan berjalan di peramban Anda; tidak ada data yang dikirim ke mana pun.')}

<div class="grid dua">
  <div class="kartu">
    <h3>Kueri</h3>
    <textarea id="sql" rows="9" spellcheck="false">SELECT p.nama_pasien, d.nama_dokter, pd.resep
  FROM pasien p
  JOIN pasien_dokter pd ON p.id_pasien = pd.id_pasien
  JOIN dokter d ON pd.id_dokter = d.id_dokter
 WHERE p.kota = 'Jakarta'</textarea>
    <div class="kontrol" style="margin-top:10px">
      ${U.tombol('jalan', 'Jalankan')}
      ${U.tombol('bersih', 'Kosongkan', 'hantu')}
      <label class="kecil"><input type="checkbox" id="rencana" checked> tampilkan rencana eksekusi</label>
    </div>
  </div>
  <div class="kartu">
    <h3>Skema tersedia</h3>
    <div class="tabel-bungkus" style="max-height:240px;overflow:auto"><table>
      <thead><tr><th>Tabel</th><th class="num">Baris</th><th>Kolom</th></tr></thead>
      <tbody>${skemaHtml()}</tbody>
    </table></div>
  </div>
</div>

<div id="hasil"></div>

<h2>Kueri contoh</h2>
<p>Seluruh soal Praktikum 3, 4, dan 5 ada di sini, ditambah contoh dari Modul 6 dan tiga kueri yang sengaja salah untuk melihat pesan galatnya.</p>
${kelompok.map((k) => `
<h3>${U.esc(k)}</h3>
<div class="grid tiga">
${CONTOH.filter((c) => c.kel === k).map((c, i) => `<button type="button" class="hantu kecil contoh" data-sql="${U.esc(c.sql)}" style="text-align:left">${U.esc(c.judul)}</button>`).join('')}
</div>`).join('')}

<h2>Yang didukung mesin ini</h2>
${U.tabel(['Kelompok', 'Sintaks'], [
    ['Proyeksi', '<code>SELECT *</code>, <code>SELECT t.*</code>, alias kolom, ekspresi aritmetika, <code>||</code>'],
    ['Sumber', '<code>FROM</code> banyak tabel, alias, subquery pada FROM'],
    ['Join', '<code>JOIN ... ON</code>, <code>LEFT</code>, <code>RIGHT</code>, <code>FULL OUTER</code>, <code>CROSS</code>, join gaya koma'],
    ['Predikat', '<code>=</code> <code>&lt;&gt;</code> <code>&lt;</code> <code>&gt;</code> <code>&lt;=</code> <code>&gt;=</code>, <code>BETWEEN</code>, <code>LIKE</code>, <code>IN</code> (daftar & subquery), <code>IS NULL</code>, <code>NOT</code>, <code>AND</code>, <code>OR</code>'],
    ['Agregasi', '<code>COUNT</code>, <code>SUM</code>, <code>AVG</code>, <code>MIN</code>, <code>MAX</code>, <code>COUNT(DISTINCT x)</code>, <code>GROUP BY</code>, <code>HAVING</code>'],
    ['Urutan & batas', '<code>ORDER BY</code> (termasuk kolom di luar SELECT), <code>ASC</code>/<code>DESC</code>, <code>LIMIT</code>, <code>OFFSET</code>'],
    ['Himpunan', '<code>UNION</code>, <code>UNION ALL</code> — dipadankan menurut posisi kolom'],
    ['Fungsi', '<code>UPPER LOWER LENGTH TRIM ABS ROUND CEIL FLOOR SUBSTR CONCAT COALESCE NVL YEAR MONTH</code>'],
  ])}
${U.catatan('<b>Yang tidak didukung:</b> DDL (CREATE/ALTER/DROP), DML (INSERT/UPDATE/DELETE), window function, CTE (<code>WITH</code>), dan <code>EXISTS</code>. Untuk itu semua, pakai skrip Oracle di halaman <a href="../oracle.html">Oracle</a>.', 'peringatan')}
`);

  const jalankan = () => {
    const sql = document.getElementById('sql').value;
    const wadah = document.getElementById('hasil');
    const tampilRencana = document.getElementById('rencana').checked;
    const t0 = performance.now();
    try {
      const { relation, plan } = execute(sql, DB);
      const ms = performance.now() - t0;
      wadah.innerHTML = `
<h2>Hasil</h2>
<p class="kecil">${relation.cardinality} baris · ${relation.degree} kolom · ${ms.toFixed(2)} ms</p>
${U.tabelRelasi(relation, { maks: 100 })}
${tampilRencana ? `<h3>Rencana eksekusi</h3>${U.pohon(planToText(plan))}` : ''}`;
    } catch (e) {
      wadah.innerHTML = `<h2>Hasil</h2><div class="catatan bahaya"><p><b>${U.esc(e.name || 'Galat')}</b></p><p class="galat">${U.esc(e.message)}</p></div>`;
    }
    wadah.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  document.getElementById('jalan').addEventListener('click', jalankan);
  document.getElementById('bersih').addEventListener('click', () => {
    document.getElementById('sql').value = '';
    document.getElementById('hasil').innerHTML = '';
  });
  document.getElementById('sql').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); jalankan(); }
  });
  U.$$('.contoh').forEach((b) => b.addEventListener('click', () => {
    document.getElementById('sql').value = b.dataset.sql;
    jalankan();
  }));
  jalankan();
}

render();
