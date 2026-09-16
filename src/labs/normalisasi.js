// Lab 02 — Normalisasi 1NF sampai BCNF.
import * as F from '../../engine/core/fd.js';
import * as U from './ui.js';

const CONTOH = [
  {
    nama: 'Task 7 — tabel Abnormal',
    attrs: 'nik, nama, alamat, kota, kodeperusahaan, namaperusahaan, kategoriperusahaan, deskripsiperusahaan',
    fds: 'nik -> nama, alamat, kota, kodeperusahaan\nkodeperusahaan -> namaperusahaan, kategoriperusahaan\nkategoriperusahaan -> deskripsiperusahaan',
    cerita: 'Contoh dari dokumentasi Task 7. Ada dua rantai transitif: nik → kodeperusahaan → namaperusahaan, dan kodeperusahaan → kategoriperusahaan → deskripsiperusahaan.',
  },
  {
    nama: 'Praktikum 4 — nilai mahasiswa',
    attrs: 'nim, kode_kul, nilai, nama_mhs, nama_kul, sks',
    fds: 'nim, kode_kul -> nilai\nnim -> nama_mhs\nkode_kul -> nama_kul, sks',
    cerita: 'Tabel gabungan mhs + mata_kuliah + nilai. Ketergantungan parsial pada sebagian kunci gabungan membuatnya belum 2NF.',
  },
  {
    nama: 'Rumah sakit — tabel gabungan',
    attrs: 'id_pasien, nama_pasien, kota, id_dokter, nama_dokter, spesialis, waktu_periksa, resep',
    fds: 'id_pasien -> nama_pasien, kota\nid_dokter -> nama_dokter, spesialis\nid_pasien, id_dokter, waktu_periksa -> resep',
    cerita: 'Jika enam tabel rumah sakit disatukan menjadi satu tabel besar, inilah bentuknya. Normalisasi mengembalikannya menjadi tabel-tabel praktikum.',
  },
  {
    nama: '3NF tetapi bukan BCNF',
    attrs: 'A, B, C',
    fds: 'A, B -> C\nC -> B',
    cerita: 'Kasus klasik: candidate key-nya AB dan AC, semua atribut prime, jadi 3NF terpenuhi. Tetapi C → B melanggar BCNF karena C bukan superkey.',
  },
  {
    nama: 'Sudah BCNF',
    attrs: 'staffno, fname, lname, position, salary, branchno',
    fds: 'staffno -> fname, lname, position, salary, branchno',
    cerita: 'Satu candidate key tunggal dan tidak ada ketergantungan lain. Ini bentuk paling aman untuk difragmentasi.',
  },
];

const state = { attrs: CONTOH[0].attrs, fds: CONTOH[0].fds, atomik: true };

function render() {
  U.pasang(`
${U.catatan('Semua perhitungan di sini adalah algoritma sungguhan: penutupan atribut, pencarian candidate key secara lengkap, minimal cover, sintesis 3NF Bernstein, dan uji lossless-join dengan algoritma tabel chase.')}

<div class="grid dua">
  <div class="kartu">
    <h3>Atribut relasi</h3>
    <textarea id="attrs" rows="2" spellcheck="false">${U.esc(state.attrs)}</textarea>
    <h3 style="margin-top:14px">Ketergantungan fungsional</h3>
    <p class="kecil">Satu FD per baris. Format: <code>A, B -&gt; C, D</code></p>
    <textarea id="fds" rows="6" spellcheck="false">${U.esc(state.fds)}</textarea>
    <div class="kontrol" style="margin-top:10px">
      ${U.tombol('jalan', 'Analisis')}
      <label class="kecil"><input type="checkbox" id="atomik" checked> seluruh nilai sudah atomik (1NF terpenuhi)</label>
    </div>
  </div>
  <div class="kartu">
    <h3>Contoh</h3>
    <div class="grid" style="gap:6px">
${CONTOH.map((c, i) => `<button type="button" class="hantu kecil contoh" data-i="${i}" style="text-align:left">${U.esc(c.nama)}</button>`).join('')}
    </div>
    <div id="cerita" style="margin-top:12px"></div>
  </div>
</div>

<div id="keluaran"></div>

<h2>Tabel keputusan bentuk normal</h2>
${U.tabel(['Bentuk', 'Syarat', 'Anomali yang dicegah'], [
    ['<strong>1NF</strong>', 'Seluruh nilai atomik, tidak ada grup berulang, ada primary key', 'Data tidak bisa dikueri per elemen'],
    ['<strong>2NF</strong>', '1NF + tidak ada ketergantungan parsial pada sebagian candidate key', 'Anomali penyisipan dan penghapusan pada atribut yang bergantung sebagian kunci'],
    ['<strong>3NF</strong>', '2NF + setiap FD X→A: X superkey ATAU A atribut prime', 'Anomali pembaruan akibat ketergantungan transitif'],
    ['<strong>BCNF</strong>', 'Setiap FD non-trivial X→A: X wajib superkey', 'Sisa anomali pada relasi dengan candidate key bertindih'],
  ])}
`);

  document.getElementById('jalan').addEventListener('click', hitung);
  document.getElementById('atomik').addEventListener('change', (e) => { state.atomik = e.target.checked; hitung(); });
  U.$$('.contoh').forEach((b) => b.addEventListener('click', () => {
    const c = CONTOH[Number(b.dataset.i)];
    document.getElementById('attrs').value = c.attrs;
    document.getElementById('fds').value = c.fds;
    document.getElementById('cerita').innerHTML = U.catatan(c.cerita, 'info');
    hitung();
  }));
  document.getElementById('cerita').innerHTML = U.catatan(CONTOH[0].cerita, 'info');
  hitung();
}

function hitung() {
  const w = document.getElementById('keluaran');
  const attrs = document.getElementById('attrs').value.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
  let fds;
  try { fds = F.parseFds(document.getElementById('fds').value); } catch (e) {
    w.innerHTML = `<div class="catatan bahaya"><p class="galat">${U.esc(e.message)}</p></div>`;
    return;
  }
  const asing = [...new Set(fds.flatMap((f) => [...f.lhs, ...f.rhs]))].filter((a) => !attrs.includes(a));
  if (asing.length) {
    w.innerHTML = `<div class="catatan bahaya"><p>Atribut berikut muncul di FD tetapi tidak terdaftar sebagai atribut relasi: <code>${U.esc(asing.join(', '))}</code></p></div>`;
    return;
  }
  if (attrs.length > 20) {
    w.innerHTML = '<div class="catatan bahaya"><p>Maksimum 20 atribut — pencarian candidate key menelusuri seluruh subset.</p></div>';
    return;
  }

  const atomik = document.getElementById('atomik').checked;
  const keys = F.candidateKeys(attrs, fds);
  const prime = F.primeAttributes(attrs, fds);
  const cover = F.minimalCover(fds);
  const v2 = F.violations2NF(attrs, fds);
  const v3 = F.violations3NF(attrs, fds);
  const vb = F.violationsBCNF(attrs, fds);
  const bentuk = F.normalForm(attrs, fds, { atomic: atomik });
  const sintesis = F.synthesize3NF(attrs, fds);
  const skema = sintesis.map((r) => r.attrs);
  const chase = F.losslessChase(attrs, skema, fds);
  const preserve = F.preservesDependencies(skema, fds);

  const warnaBentuk = { '1NF belum terpenuhi': 'gagal', '1NF': 'gagal', '2NF': 'warn', '3NF': 'info', BCNF: 'ok' };

  w.innerHTML = `
<h2>Hasil analisis</h2>
<div class="statbar">
  <div class="stat"><b>${attrs.length}</b><span>atribut</span></div>
  <div class="stat"><b>${fds.length}</b><span>FD diberikan</span></div>
  <div class="stat"><b>${cover.length}</b><span>FD minimal cover</span></div>
  <div class="stat"><b>${keys.length}</b><span>candidate key</span></div>
  <div class="stat"><b>${prime.length}</b><span>atribut prime</span></div>
</div>

${U.catatan(`Relasi ini berada pada bentuk normal <b>${bentuk}</b>. ${
  bentuk === 'BCNF' ? 'Tidak ada pelanggaran yang tersisa.'
    : `Ada ${(bentuk === '3NF' ? vb : bentuk === '2NF' ? v3 : v2).length} pelanggaran yang membuatnya belum naik ke tingkat berikutnya.`}`, warnaBentuk[bentuk] === 'ok' ? 'baik' : warnaBentuk[bentuk] === 'gagal' ? 'bahaya' : 'peringatan')}

<div class="grid dua">
  <div class="kartu">
    <h3>Candidate key</h3>
    ${keys.length
    ? `<ul>${keys.map((k) => `<li><code>{ ${k.join(', ')} }</code> — penutupannya mencakup seluruh ${attrs.length} atribut</li>`).join('')}</ul>`
    : '<p class="kosong">Tidak ada candidate key: tidak ada himpunan atribut yang penutupannya mencakup seluruh relasi.</p>'}
    <h4>Atribut prime</h4>
    <p><code>${prime.length ? prime.join(', ') : '(tidak ada)'}</code></p>
    <h4>Atribut non-prime</h4>
    <p><code>${attrs.filter((a) => !prime.includes(a)).join(', ') || '(tidak ada)'}</code></p>
  </div>
  <div class="kartu">
    <h3>Minimal cover</h3>
    <p class="kecil">Himpunan FD terkecil yang setara dengan FD yang Anda berikan. Inilah masukan algoritma sintesis 3NF.</p>
    ${U.pre(cover.map(F.fdToString).join('\n'))}
  </div>
</div>

<h3>Penutupan tiap himpunan atribut</h3>
${U.tabel(['X', 'X⁺', 'Superkey?'], [...new Set([...fds.map((f) => f.lhs.join(', ')), ...attrs.map((a) => a)])].map((x) => {
    const himpunan = x.split(/,\s*/);
    const cl = F.closure(himpunan, fds);
    const superkey = cl.length === attrs.length;
    return [`<code>{ ${U.esc(x)} }</code>`, `<code class="kecil">{ ${cl.join(', ')} }</code>`, superkey ? U.lencana('ya', 'ok') : U.lencana('bukan', 'netral')];
  }))}

<h2>Pelanggaran per tingkat</h2>
<div class="grid tiga">
  <div class="kartu">
    <h3>2NF ${v2.length ? U.lencana(`${v2.length} pelanggaran`, 'gagal') : U.lencana('bersih', 'ok')}</h3>
    ${v2.length ? `<ul class="kecil">${v2.map((x) => `<li><code>${F.fdToString(x)}</code><br>${U.esc(x.alasan)}</li>`).join('')}</ul>` : '<p class="kosong">Tidak ada ketergantungan parsial.</p>'}
  </div>
  <div class="kartu">
    <h3>3NF ${v3.length ? U.lencana(`${v3.length} pelanggaran`, 'gagal') : U.lencana('bersih', 'ok')}</h3>
    ${v3.length ? `<ul class="kecil">${v3.map((x) => `<li><code>${F.fdToString(x)}</code><br>${U.esc(x.alasan)}</li>`).join('')}</ul>` : '<p class="kosong">Tidak ada ketergantungan transitif.</p>'}
  </div>
  <div class="kartu">
    <h3>BCNF ${vb.length ? U.lencana(`${vb.length} pelanggaran`, 'gagal') : U.lencana('bersih', 'ok')}</h3>
    ${vb.length ? `<ul class="kecil">${vb.map((x) => `<li><code>${F.fdToString(x)}</code><br>${U.esc(x.alasan)}</li>`).join('')}</ul>` : '<p class="kosong">Setiap ruas kiri adalah superkey.</p>'}
  </div>
</div>

<h2>Sintesis 3NF (algoritma Bernstein)</h2>
<p>Relasi dipecah menjadi satu relasi per kelompok FD dengan ruas kiri sama. Relasi yang termuat di relasi lain dibuang, lalu dipastikan ada relasi yang memuat candidate key.</p>
${U.tabel(['Relasi', 'Atribut', 'Kunci', 'FD yang dipertahankan', 'Bentuk normal'], sintesis.map((r) => [
    `<strong>${r.nama}</strong>`,
    `<code>${U.esc(r.attrs.join(', '))}</code>`,
    `<code>${U.esc(F.candidateKeys(r.attrs, r.fds).map((k) => k.join('+')).join(' / ') || '—')}</code>`,
    `<code class="kecil">${r.fds.map(F.fdToString).join('; ') || '—'}</code>`,
    U.lencana(F.normalForm(r.attrs, r.fds), 'ok'),
  ]))}

<div class="grid dua">
  <div class="kartu">
    <h3>Lossless-join ${U.lulusGagal(chase.lossless)}</h3>
    <p class="kecil">Algoritma tabel chase: bila ada satu baris yang seluruhnya berisi <code>a</code>, dekomposisinya lossless.</p>
    ${chaseHtml(chase)}
  </div>
  <div class="kartu">
    <h3>Ketergantungan dipertahankan ${U.lulusGagal(preserve.preserved)}</h3>
    ${preserve.preserved
    ? '<p>Seluruh FD asli dapat ditegakkan tanpa perlu menggabungkan kembali relasi hasil dekomposisi.</p>'
    : `<p>FD berikut hilang dan hanya bisa diperiksa dengan join lintas relasi:</p><ul class="kecil">${preserve.hilang.map((f) => `<li><code>${F.fdToString(f)}</code></li>`).join('')}</ul>`}
  </div>
</div>

${U.catatan('Dekomposisi 3NF Bernstein <b>selalu</b> lossless dan <b>selalu</b> mempertahankan ketergantungan. BCNF tidak menjamin yang kedua — itulah alasan 3NF masih dipakai di praktik.', 'info')}

<h2>Kaitan dengan basis data terdistribusi</h2>
<p>Normalisasi bukan sekadar urusan estetika skema. Pada sistem terdistribusi ia menentukan biaya jaringan:</p>
<ul>
  <li>Relasi yang belum 3NF menyimpan data berulang, sehingga <strong>setiap fragmen ikut membawa redundansinya</strong> dan biaya penyimpanan naik di semua situs</li>
  <li>Anomali pembaruan pada relasi belum ternormalisasi berarti satu perubahan logis menjadi banyak tulisan fisik — dan setiap tulisan pada data bereplika harus melewati 2PC</li>
  <li>Kunci yang jelas adalah syarat fragmentasi vertikal: <strong>tanpa kunci di setiap fragmen, rekonstruksi tidak pernah lossless</strong></li>
</ul>
`;
}

function chaseHtml(c) {
  return `<div class="tabel-bungkus"><table>
<thead><tr><th>Relasi</th>${c.atribut.map((a) => `<th class="kecil">${U.esc(a)}</th>`).join('')}</tr></thead>
<tbody>${c.tabel.map((r, i) => `<tr${i === c.barisPenuh ? ' style="background:rgba(52,211,153,.08)"' : ''}><td>R${i + 1}</td>${r.map((v) => `<td class="mono" style="color:${v === 'a' ? '#34d399' : '#6c7a90'}">${v}</td>`).join('')}</tr>`).join('')}</tbody>
</table></div>
<p class="kecil">${c.iterasi} iterasi chase. ${c.lossless ? `Baris R${c.barisPenuh + 1} seluruhnya berisi <code>a</code>.` : 'Tidak ada baris yang seluruhnya berisi <code>a</code> — dekomposisi ini kehilangan informasi.'}</p>`;
}

render();
