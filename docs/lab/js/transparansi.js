// Lab 08 — Tangga Transparansi.
import * as T from '../../engine/ddb/transparency.js?v=849b085103';
import * as U from './ui.js?v=849b085103';

const SKEMA_MODUL = [
  { nama: 'S1', tipe: 'vertikal', atribut: ['staffno', 'position', 'sex', 'dob', 'salary'], situs: '3', kunci: ['staffno'] },
  { nama: 'S21', tipe: 'campuran', atribut: ['staffno', 'fname', 'lname', 'branchno'], situs: '3', predikat: "branchno = 'B3'" },
  { nama: 'S22', tipe: 'campuran', atribut: ['staffno', 'fname', 'lname', 'branchno'], situs: '5', predikat: "branchno = 'B5'", replika: ['5', '3'] },
  { nama: 'S23', tipe: 'campuran', atribut: ['staffno', 'fname', 'lname', 'branchno'], situs: '7', predikat: "branchno = 'B7'" },
];

const SKEMA_RS = [
  { nama: 'PASIEN_JKT', tipe: 'horizontal', atribut: ['id_pasien', 'nama_pasien', 'penyakit', 'jenis_kelamin', 'kota'], situs: 'S1', predikat: "kota = 'Jakarta'", kunci: ['id_pasien'] },
  { nama: 'PASIEN_BDG', tipe: 'horizontal', atribut: ['id_pasien', 'nama_pasien', 'penyakit', 'jenis_kelamin', 'kota'], situs: 'S2', predikat: "kota = 'Bandung'", kunci: ['id_pasien'] },
  { nama: 'PASIEN_SBY', tipe: 'horizontal', atribut: ['id_pasien', 'nama_pasien', 'penyakit', 'jenis_kelamin', 'kota'], situs: 'S3', predikat: "kota = 'Surabaya'", kunci: ['id_pasien'], replika: ['S3', 'S1'] },
];

const KASUS = {
  modul: {
    nama: 'Contoh Modul 6 — Staff DreamHome',
    skema: SKEMA_MODUL,
    kueri: { relasiGlobal: 'Staff', pilih: ['fname', 'lname'], kondisi: "position = 'Manager'", atributKondisi: 'position' },
    catatan: 'Atribut <code>position</code> berada di fragmen vertikal S1, sedangkan <code>fname</code> dan <code>lname</code> ada di S21/S22/S23. Karena itu tingkat 2 ke bawah harus memakai subquery lintas fragmen — persis seperti pada modul.',
  },
  rumahsakit: {
    nama: 'Rumah sakit — pasien per kota',
    skema: SKEMA_RS,
    kueri: { relasiGlobal: 'PASIEN', pilih: ['nama_pasien', 'penyakit'], kondisi: "jenis_kelamin = 'P'", atributKondisi: 'jenis_kelamin' },
    catatan: 'Semua atribut ada di setiap fragmen horizontal, sehingga tidak perlu subquery. Yang berubah hanya berapa banyak nama fragmen dan nama situs yang bocor ke aplikasi.',
  },
};

let kasus = 'modul';

function render() {
  U.pasang(`
${U.catatan('Satu kueri yang sama ditulis ulang pada lima tingkat transparansi. Yang diukur bukan selera, melainkan angka: berapa banyak nama fragmen dan nama situs yang terpaksa muncul di dalam kode aplikasi.')}

<div class="kontrol">
  ${U.bidang('Kasus', U.pilihan('kasus', [
    { nilai: 'modul', teks: 'Contoh Modul 6' },
    { nilai: 'rumahsakit', teks: 'Rumah sakit per kota' },
  ], kasus))}
</div>

<div id="keluaran"></div>

<h2>Empat jenis transparansi</h2>
<div class="grid dua">
${T.JENIS_TRANSPARANSI.map((j) => `<div class="kartu">
  <h3>${U.esc(j.nama)}</h3>
  <p>${U.esc(j.inti)}</p>
  <p class="kecil">Mencakup: ${j.isi.map((x) => `<code>${U.esc(x)}</code>`).join(' ')}</p>
</div>`).join('')}
</div>

<h2>Transparansi penamaan</h2>
<p>Setiap objek basis data terdistribusi wajib punya nama unik. Ada tiga pendekatan, masing-masing dengan harganya sendiri.</p>
<div id="penamaan"></div>

<h2>Klasifikasi transaksi DRDA</h2>
<p>Semakin tinggi tingkatnya, semakin kompleks interaksi dengan DBMS. Coba susun transaksi di bawah ini:</p>
<div class="kontrol">
  ${U.bidang('Jumlah situs disentuh', '<input type="number" id="drda-situs" value="2" min="1" max="5" style="width:70px">')}
  ${U.bidang('Jumlah perintah SQL', '<input type="number" id="drda-perintah" value="3" min="1" max="20" style="width:70px">')}
  ${U.bidang('Join lintas situs?', '<label class="kecil"><input type="checkbox" id="drda-join"> ya, satu perintah menyentuh banyak situs</label>')}
</div>
<div id="drda"></div>
`);

  U.ikatPilihan('kasus', (v) => { kasus = v; gambar(); });
  ['drda-situs', 'drda-perintah', 'drda-join'].forEach((id) => {
    document.getElementById(id).addEventListener('input', gambarDrda);
  });
  gambar();
  gambarPenamaan();
  gambarDrda();
}

function gambar() {
  const k = KASUS[kasus];
  const tangga = T.ladder(k.kueri, k.skema);
  const maksPanjang = Math.max(...tangga.map((t) => t.panjangSql));
  const maksBocor = Math.max(...tangga.map((t) => t.kebocoranDetail), 1);

  document.getElementById('keluaran').innerHTML = `
${U.catatan(k.catatan, 'info')}

<h2>Skema fragmentasi</h2>
${U.tabel(['Fragmen', 'Tipe', 'Atribut', 'Situs', 'Replika'], k.skema.map((f) => [
    `<strong>${f.nama}</strong>`,
    f.tipe,
    `<code class="kecil">${U.esc(f.atribut.join(', '))}</code>`,
    `<code>${f.situs}</code>`,
    f.replika ? `${f.replika.length}× (${f.replika.join(', ')})` : '1×',
  ]))}

<h2>Ringkasan lima tingkat</h2>
${U.tabel(['Tingkat', 'Nama', 'Fragmen disebut', 'Situs disebut', 'Detail bocor', 'Panjang SQL'], tangga.map((t) => [
    `<strong>${t.tingkat}</strong>`,
    t.nama,
    t.jumlahFragmenDisebut,
    t.jumlahSitusDisebut,
    U.bar(t.kebocoranDetail, maksBocor, t.kebocoranDetail === 0 ? 'ok' : ''),
    `${t.panjangSql} ${U.bar(t.panjangSql, maksPanjang, 'info')}`,
  ]), { kelasNum: [0, 2, 3] })}

${tangga.map((t) => `
<h3>Tingkat ${t.tingkat} — ${U.esc(t.nama)}</h3>
<p class="kecil">${U.esc(t.keterangan)}</p>
${U.preSql(t.sql)}
${t.catatan ? `<p class="kecil">${U.esc(t.catatan)}</p>` : ''}
${t.peringatan ? U.catatan(`<b>Harga yang dibayar:</b> ${U.esc(t.peringatan)}`, 'peringatan') : ''}
`).join('')}

${U.catatan(`Dari tingkat 1 ke tingkat 4, panjang SQL naik dari ${tangga[0].panjangSql} menjadi ${tangga[3].panjangSql} karakter — <b>${(tangga[3].panjangSql / tangga[0].panjangSql).toFixed(1)}×</b> lipat. Itu baru satu kueri. Bayangkan seluruh aplikasi harus ditulis ulang setiap kali satu fragmen dipindahkan situs.`, 'peringatan')}
`;
}

function gambarPenamaan() {
  const n = T.namingSchemes('Branch', 'S1', { fragmen: 3, salinan: 2, pengguna: 'Manager', situsSimpan: 'glasgow' });
  document.getElementById('penamaan').innerHTML = `
${U.tabel(['Pendekatan', 'Contoh nama', 'Cara kerja', 'Kendala'], [
    ['Server nama terpusat', `<code>${U.esc(n.terpusat.nama)}</code>`, U.esc(n.terpusat.cara), `<ul class="kecil">${n.terpusat.kendala.map((x) => `<li>${U.esc(x)}</li>`).join('')}</ul>`],
    ['Awalan situs pembuat', `<code>${U.esc(n.awalanSitus.nama)}</code>`, U.esc(n.awalanSitus.cara), `<ul class="kecil">${n.awalanSitus.kendala.map((x) => `<li>${U.esc(x)}</li>`).join('')}</ul>`],
    ['Alias / sinonim', `<code>${U.esc(n.alias.nama)}</code> → <code>${U.esc(n.alias.merujuk)}</code>`, U.esc(n.alias.cara), `<ul class="kecil">${n.alias.kendala.map((x) => `<li>${U.esc(x)}</li>`).join('')}</ul>`],
  ])}
<h3>System-wide name (Sistem R*)</h3>
${U.pre(n.systemWideName.nama)}
${U.tabel(['Bagian', 'Nilai', 'Arti'], n.systemWideName.bagian.map((b) => [`<strong>${U.esc(b.bagian)}</strong>`, `<code>${U.esc(b.nilai)}</code>`, U.esc(b.arti)]))}
<p class="kecil">${U.esc(n.systemWideName.cara)}</p>`;
}

function gambarDrda() {
  const n = Number(document.getElementById('drda-situs').value) || 1;
  const p = Number(document.getElementById('drda-perintah').value) || 1;
  const j = document.getElementById('drda-join').checked;
  const hasil = T.classifyDRDA({ situsDisentuh: Array.from({ length: n }, (_, i) => `S${i + 1}`), perintah: p, adaJoinLintasSitus: j });
  document.getElementById('drda').innerHTML = `
${U.catatan(`Transaksi ini tergolong <b>tingkat ${hasil.tingkat} — ${U.esc(hasil.nama)}</b>. ${U.esc(hasil.ringkas)}`, 'info')}
${U.tabel(['Tingkat', 'Nama', 'Ringkas', 'Situs', 'Perintah', 'Join lintas situs'], T.TIPE_TRANSAKSI_DRDA.map((t) => [
    t.tingkat === hasil.tingkat ? `<strong>${t.tingkat}</strong> ${U.lencana('ini', 'info')}` : String(t.tingkat),
    t.nama,
    U.esc(t.ringkas),
    String(t.jumlahSitus),
    String(t.perintahPerTransaksi),
    t.joinLintasSitus ? 'ya' : 'tidak',
  ]))}`;
}

render();
