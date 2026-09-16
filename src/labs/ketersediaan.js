// Lab 13 — Ketersediaan, kuorum, CAP, dan PACELC.
import * as AV from '../../engine/ddb/availability.js';
import * as U from './ui.js';

const state = {
  mtbf: 720, mttr: 4, replika: 2, fragmen: 4,
  N: 3, R: 2, W: 2,
  cap: 'CP',
  replikasi: 'asinkron', tunda: 5, backup: 60, pulih: 30,
};

function render() {
  U.pasang(`
${U.catatan('Modul 1 menyebut "keberadaan data yang ditingkatkan" dan "keandalan yang ditingkatkan" sebagai kelebihan DDBS. Lab ini mengubah kalimat itu menjadi angka — termasuk angka yang tidak enak didengar: <b>replikasi menaikkan ketersediaan baca dan menurunkan ketersediaan tulis serentak</b>.')}

<h2>Ketersediaan satu situs</h2>
<div class="kartu">
  <div class="kontrol">
    ${U.bidang('MTBF (jam antar kegagalan)', '<input type="range" id="mtbf" min="24" max="8760" step="24" value="720"><span id="mtbf-v" class="mono"></span>')}
    ${U.bidang('MTTR (jam perbaikan)', '<input type="range" id="mttr" min="1" max="72" value="4"><span id="mttr-v" class="mono"></span>')}
  </div>
  <div id="situs"></div>
</div>

<h2>Ketersediaan rancangan terdistribusi</h2>
<div class="kartu">
  <div class="kontrol">
    ${U.bidang('Jumlah replika per fragmen', '<input type="range" id="replika" min="1" max="5" value="2"><span id="replika-v" class="mono"></span>')}
    ${U.bidang('Jumlah fragmen disentuh transaksi', '<input type="range" id="fragmen" min="1" max="8" value="4"><span id="fragmen-v" class="mono"></span>')}
  </div>
  <div id="rancangan"></div>
</div>

<h2>Sistem kuorum</h2>
<div class="kartu">
  <div class="kontrol">
    ${U.bidang('N (jumlah salinan)', '<input type="number" id="N" value="3" min="1" max="9" style="width:70px">')}
    ${U.bidang('R (kuorum baca)', '<input type="number" id="R" value="2" min="1" max="9" style="width:70px">')}
    ${U.bidang('W (kuorum tulis)', '<input type="number" id="W" value="2" min="1" max="9" style="width:70px">')}
  </div>
  <div id="kuorum"></div>
</div>

<h2>CAP dan PACELC</h2>
<div class="kontrol">
  ${U.bidang('Pilihan saat partisi', U.pilihan('cap', [
    { nilai: 'CP', teks: 'CP — utamakan konsistensi' },
    { nilai: 'AP', teks: 'AP — utamakan ketersediaan' },
    { nilai: 'CA', teks: 'CA — anggap partisi tak terjadi' },
  ], state.cap))}
</div>
<div id="cap"></div>

<h2>RTO dan RPO</h2>
<div class="kartu">
  <div class="kontrol">
    ${U.bidang('Strategi replikasi', U.pilih('replikasi', [
    { nilai: 'sinkron', teks: 'Sinkron (ON COMMIT)' },
    { nilai: 'asinkron', teks: 'Asinkron (ON DEMAND)' },
    { nilai: 'backup', teks: 'Backup berkala saja' },
  ], state.replikasi))}
    ${U.bidang('Tunda replikasi (detik)', '<input type="number" id="tunda" value="5" min="1" max="600" style="width:80px">')}
    ${U.bidang('Interval backup (menit)', '<input type="number" id="backup" value="60" min="5" max="1440" style="width:80px">')}
    ${U.bidang('Waktu pulih (menit)', '<input type="number" id="pulih" value="30" min="1" max="600" style="width:80px">')}
  </div>
  <div id="rto"></div>
</div>
`);

  const ikat = (id, kunci, fn) => document.getElementById(id).addEventListener('input', (e) => {
    state[kunci] = Number(e.target.value);
    fn();
  });
  ikat('mtbf', 'mtbf', () => { hitungSitus(); hitungRancangan(); });
  ikat('mttr', 'mttr', () => { hitungSitus(); hitungRancangan(); });
  ikat('replika', 'replika', hitungRancangan);
  ikat('fragmen', 'fragmen', hitungRancangan);
  ['N', 'R', 'W'].forEach((k) => ikat(k, k, hitungKuorum));
  U.ikatPilihan('cap', (v) => { state.cap = v; hitungCap(); });
  document.getElementById('replikasi').addEventListener('change', (e) => { state.replikasi = e.target.value; hitungRto(); });
  ['tunda', 'backup', 'pulih'].forEach((k) => ikat(k, k, hitungRto));

  hitungSitus(); hitungRancangan(); hitungKuorum(); hitungCap(); hitungRto();
}

function hitungSitus() {
  const a = AV.siteAvailability(state.mtbf, state.mttr);
  document.getElementById('mtbf-v').textContent = `${state.mtbf} jam`;
  document.getElementById('mttr-v').textContent = `${state.mttr} jam`;
  document.getElementById('situs').innerHTML = `
${U.pre(`A = MTBF / (MTBF + MTTR) = ${state.mtbf} / (${state.mtbf} + ${state.mttr}) = ${a.ketersediaan}`)}
<div class="statbar">
  <div class="stat"><b>${a.persen}%</b><span>ketersediaan</span></div>
  <div class="stat"><b>${a.kelas}</b><span>kelas</span></div>
  <div class="stat"><b>${U.fmt(a.menitPadamPerTahun, 0)}</b><span>menit padam/tahun</span></div>
  <div class="stat"><b>${U.fmt(a.menitPadamPerTahun / 60, 1)}</b><span>jam padam/tahun</span></div>
</div>`;
}

function hitungRancangan() {
  const A = AV.siteAvailability(state.mtbf, state.mttr).ketersediaan;
  const situs = {};
  const alokasi = {};
  for (let f = 0; f < state.fragmen; f++) {
    const daftar = [];
    for (let r = 0; r < state.replika; r++) {
      const id = `S${(f * state.replika + r) % 9 + 1}`;
      situs[id] = A;
      daftar.push(id);
    }
    alokasi[`F${f + 1}`] = [...new Set(daftar)];
  }
  const d = AV.designAvailability(alokasi, situs);
  const bacaSatu = A;
  const bacaReplika = AV.parallelAvailability(Array(state.replika).fill(A));

  document.getElementById('replika-v').textContent = `${state.replika}×`;
  document.getElementById('fragmen-v').textContent = `${state.fragmen} fragmen`;
  document.getElementById('rancangan').innerHTML = `
${U.tabel(['Ukuran', 'Nilai', '', 'Arti'], [
    ['Ketersediaan satu situs', U.persen(bacaSatu, 4), U.bar(bacaSatu, 1, 'info'), `${U.fmt((1 - bacaSatu) * 525600, 0)} menit padam per tahun`],
    [`Baca satu fragmen (${state.replika} replika)`, U.persen(bacaReplika, 6), U.bar(bacaReplika, 1, 'ok'), 'cukup satu replika hidup'],
    [`Baca transaksi global (${state.fragmen} fragmen)`, U.persen(d.bacaTransaksiGlobal, 4), U.bar(d.bacaTransaksiGlobal, 1, 'ok'), 'seluruh fragmen harus terbaca'],
    ['Tulis serentak semua replika', U.persen(d.tulisSerentakSemuaReplika, 4), U.bar(d.tulisSerentakSemuaReplika, 1), '2PC menuntut SELURUH replika hidup bersamaan'],
  ])}
${U.catatan(`<b>Inilah pertukarannya.</b> Dengan ${state.replika} replika, baca satu fragmen naik dari ${U.persen(bacaSatu, 3)} menjadi ${U.persen(bacaReplika, 5)}. Tetapi tulis serentak turun menjadi ${U.persen(d.tulisSerentakSemuaReplika, 3)} — karena setiap salinan tambahan adalah satu lagi situs yang bisa menggagalkan 2PC.`, 'peringatan')}
<ul class="kecil">${d.catatan.map((c) => `<li>${U.esc(c)}</li>`).join('')}</ul>
${U.catatan('Solusinya di praktik: <b>replikasi asinkron</b>. Tulisan hanya menyentuh satu salinan, sisanya menyusul lewat materialized view. Konsistensi kuat ditukar dengan ketersediaan tulis.', 'info')}`;
}

function hitungKuorum() {
  const w = document.getElementById('kuorum');
  try {
    const q = AV.quorum(state.N, state.R, state.W);
    w.innerHTML = `
<div class="statbar">
  <div class="stat"><b>${q.R} + ${q.W}</b><span>R + W</span></div>
  <div class="stat"><b>${q.N}</b><span>N</span></div>
  <div class="stat"><b>${q.konsistenKuat ? 'YA' : 'TIDAK'}</b><span>konsisten kuat</span></div>
  <div class="stat"><b>${q.tahanKegagalanBaca}</b><span>situs boleh mati (baca)</span></div>
  <div class="stat"><b>${q.tahanKegagalanTulis}</b><span>situs boleh mati (tulis)</span></div>
</div>
${U.catatan(U.esc(q.penjelasan), q.konsistenKuat ? 'baik' : 'peringatan')}
${U.tabel(['Konfigurasi', 'R', 'W', 'Konsisten kuat?', 'Sifat'], q.contoh.map((c) => [
    c.nama, c.R, c.W,
    c.R + c.W > q.N ? U.lencana('ya', 'ok') : U.lencana('tidak', 'warn'),
    U.esc(c.sifat),
  ]), { kelasNum: [1, 2] })}
${q.tulisTerurut ? U.catatan('W &gt; N/2 juga terpenuhi, sehingga dua operasi tulis tidak mungkin berjalan bersamaan tanpa saling melihat — urutan tulis terjamin.', 'baik') : U.catatan('W ≤ N/2: dua tulis bisa berjalan bersamaan pada himpunan salinan yang tidak beririsan, sehingga urutannya tidak terjamin.', 'peringatan')}`;
  } catch (e) {
    w.innerHTML = `<div class="catatan bahaya"><p class="galat">${U.esc(e.message)}</p></div>`;
  }
}

function hitungCap() {
  const c = AV.capAnalysis({ pilihan: state.cap, N: 3, partisi: [[1], [2, 3]] });
  document.getElementById('cap').innerHTML = `
${U.catatan(`<b>${U.esc(c.nama)}</b><br>${U.esc(c.perilaku)}<br><br>Yang dikorbankan: <b>${U.esc(c.korban)}</b>`, state.cap === 'CA' ? 'bahaya' : 'info')}
${U.tabel(['Pilihan', 'Perilaku saat partisi', 'Dikorbankan', 'Contoh sistem', 'Cocok untuk'], Object.entries(c.semuaOpsi).map(([k, o]) => [
    k === state.cap ? `<strong>${k}</strong> ${U.lencana('dipilih', 'info')}` : k,
    U.esc(o.perilaku),
    U.esc(o.korban),
    U.esc(o.contoh),
    U.esc(o.cocokUntuk),
  ]))}
<h3>PACELC</h3>
${U.catatan(`Kode PACELC untuk pilihan ini: <b>${U.esc(c.pacelc.kode)}</b>. ${U.esc(c.pacelc.arti)} Contoh: ${U.esc(c.pacelc.contoh)}.`, 'info')}
${U.pre(`if (Partition) {
    pilih Availability atau Consistency
} else {
    pilih Latency atau Consistency
}`)}
<p class="kecil">CAP hanya berbicara tentang keadaan partisi. PACELC menambahkan kenyataan yang lebih sering dihadapi: pertukaran tetap ada bahkan ketika jaringan sehat.</p>`;
}

function hitungRto() {
  const r = AV.rtoRpo({
    replikasi: state.replikasi,
    tundaReplikasiDetik: state.tunda,
    intervalBackupMenit: state.backup,
    waktuPulihMenit: state.pulih,
  });
  document.getElementById('rto').innerHTML = `
<div class="statbar">
  <div class="stat"><b>${U.fmt(r.rpoMenit, 2)}</b><span>RPO (menit)</span></div>
  <div class="stat"><b>${U.fmt(r.rtoMenit, 0)}</b><span>RTO (menit)</span></div>
</div>
${U.catatan(U.esc(r.arti), state.replikasi === 'sinkron' ? 'baik' : 'peringatan')}
${U.tabel(['Strategi', 'RPO', 'Harga', 'Wujud di Oracle'], [
    ['Sinkron', '0', 'Setiap commit menunggu situs jauh — latensi naik', '<code>REFRESH FAST ON COMMIT</code> atau Data Guard SYNC'],
    ['Asinkron', 'detik sampai menit', 'Ada jendela transaksi yang bisa hilang', '<code>REFRESH ON DEMAND</code> / GoldenGate'],
    ['Backup berkala', 'menit sampai jam', 'Paling murah, paling banyak kehilangan', 'RMAN + arsip redo log'],
  ])}`;
}

render();
