// Lab 09 — Join Terdistribusi: kirim utuh, semijoin, bloom join.
import { Relation } from '../../engine/core/relation.js?v=849b085103';
import { dreamhome, rumahsakit } from '../../engine/data/datasets.js?v=849b085103';
import * as J from '../../engine/ddb/joinstrat.js?v=849b085103';
import * as U from './ui.js?v=849b085103';

const { STAFF, PROPERTY } = dreamhome();
const { pasien, pasien_dokter } = rumahsakit();

const state = {
  kasus: 'sintetis',
  barisR: 500,
  cocok: 20,
  perPesan: 20,
  perByte: 0.02,
  bits: 512,
  k: 4,
};

function relasiKasus() {
  switch (state.kasus) {
    case 'dreamhome':
      return { R: PROPERTY, S: STAFF, attr: 'staffno', cerita: 'PROPERTY ⋈ STAFF pada relasi kecil dari Modul 6. Semua baris PROPERTY punya pasangan di STAFF, sehingga semijoin tidak mereduksi apa pun.' };
    case 'rumahsakit':
      return { R: pasien, S: pasien_dokter, attr: 'id_pasien', cerita: 'PASIEN ⋈ PASIEN_DOKTER dari skema praktikum rumah sakit.' };
    default: {
      const R = new Relation('BESAR', ['k', 'a', 'b', 'c'], Array.from({ length: state.barisR }, (_, i) => [i, `x${i}`, `y${i}`, `z${i}`]));
      const langkah = Math.max(1, Math.floor(state.barisR / Math.max(1, state.cocok)));
      const S = new Relation('KECIL', ['k', 'v'], Array.from({ length: state.cocok }, (_, i) => [i * langkah, `v${i}`]));
      return {
        R, S, attr: 'k',
        cerita: `Relasi sintetis: ${state.barisR} baris di situs kiri, ${state.cocok} baris di situs kanan. Selektivitasnya ${U.persen(state.cocok / state.barisR, 1)} — inilah kondisi tempat semijoin bersinar.`,
      };
    }
  }
}

function render() {
  U.pasang(`
${U.catatan('Keempat strategi benar-benar dijalankan atas relasi contoh, dan hasilnya dibandingkan sebagai himpunan. Perbedaannya hanya pada berapa byte yang menyeberangi jaringan — bukan pada jawaban yang dihasilkan.')}

<div class="kontrol">
  ${U.bidang('Kasus', U.pilihan('kasus', [
    { nilai: 'sintetis', teks: 'Sintetis (dapat diatur)' },
    { nilai: 'dreamhome', teks: 'DreamHome (Modul 6)' },
    { nilai: 'rumahsakit', teks: 'Rumah sakit' },
  ], state.kasus))}
</div>

<div class="kartu" id="pengatur">
  <h3>Parameter</h3>
  <div class="kontrol">
    ${U.bidang('Baris relasi R', '<input type="range" id="barisR" min="20" max="2000" step="20" value="500"><span id="barisR-v" class="mono"></span>')}
    ${U.bidang('Baris relasi S (yang berpasangan)', '<input type="range" id="cocok" min="1" max="200" value="20"><span id="cocok-v" class="mono"></span>')}
  </div>
  <div class="kontrol">
    ${U.bidang('Biaya per pesan (C₀)', '<input type="range" id="perPesan" min="0" max="200" value="20"><span id="perPesan-v" class="mono"></span>')}
    ${U.bidang('Biaya per byte (C₁)', '<input type="range" id="perByte" min="1" max="200" value="20"><span id="perByte-v" class="mono"></span>')}
  </div>
  <div class="kontrol">
    ${U.bidang('Ukuran penapis Bloom (bit)', U.pilih('bits', [64, 128, 256, 512, 1024, 2048], 512))}
    ${U.bidang('Jumlah fungsi hash (k)', U.pilih('k', [1, 2, 3, 4, 6, 8], 4))}
  </div>
</div>

<div id="keluaran"></div>
`);

  U.ikatPilihan('kasus', (v) => {
    state.kasus = v;
    document.getElementById('pengatur').style.display = v === 'sintetis' ? '' : 'none';
    hitung();
  });
  const ikat = (id, kunci, skala = 1) => {
    const inp = document.getElementById(id);
    if (!inp) return;
    inp.addEventListener('input', () => {
      state[kunci] = Number(inp.value) * skala;
      hitung();
    });
  };
  ikat('barisR', 'barisR');
  ikat('cocok', 'cocok');
  ikat('perPesan', 'perPesan');
  ikat('perByte', 'perByte', 0.001);
  document.getElementById('bits').addEventListener('change', (e) => { state.bits = Number(e.target.value); hitung(); });
  document.getElementById('k').addEventListener('change', (e) => { state.k = Number(e.target.value); hitung(); });
  hitung();
}

function hitung() {
  const { R, S, attr, cerita } = relasiKasus();
  const opsi = { biaya: { perPesan: state.perPesan, perByte: state.perByte, perTupelLokal: 0.1 }, bits: state.bits, k: state.k };
  const c = J.compareStrategies(R, S, attr, opsi);
  const x = J.crossoverAnalysis(R, S, opsi);
  const maks = Math.max(...c.strategi.map((s) => s.total));
  const maksByte = Math.max(...c.strategi.map((s) => s.byteTerkirim));
  const bloom = c.strategi.find((s) => s.id === 'bloomjoin');

  ['barisR', 'cocok', 'perPesan'].forEach((id) => {
    const v = document.getElementById(`${id}-v`);
    if (v) v.textContent = state[id];
  });
  const pb = document.getElementById('perByte-v');
  if (pb) pb.textContent = state.perByte.toFixed(3);

  document.getElementById('keluaran').innerHTML = `
${U.catatan(cerita, 'info')}

<h2>Perbandingan strategi</h2>
${U.tabel(['Strategi', 'Pesan', 'Byte terkirim', '', 'Biaya total', '', 'Hasil identik'],
    [...c.strategi].sort((p, q) => p.total - q.total).map((s) => [
      `<strong>${U.esc(s.nama)}</strong>${s.id === c.terbaik ? ` ${U.lencana('termurah', 'ok')}` : ''}`,
      s.pesan,
      U.fmt(s.byteTerkirim),
      U.bar(s.byteTerkirim, maksByte, 'info'),
      U.fmt(s.total),
      U.bar(s.total, maks, s.id === c.terbaik ? 'ok' : ''),
      s.hasilSama ? U.lencana('ya', 'ok') : U.lencana('TIDAK', 'gagal'),
    ]), { kelasNum: [1, 2, 4] })}

${U.catatan(`Strategi termurah pada parameter ini: <b>${U.esc(c.strategi.find((s) => s.id === c.terbaik).nama)}</b>, ${c.penghematan}% lebih murah daripada strategi terburuk. Keempatnya menghasilkan relasi yang ${c.semuaHasilSama ? 'benar-benar identik' : 'BERBEDA — ini bug'}.`, c.semuaHasilSama ? 'baik' : 'bahaya')}

<h2>Langkah tiap strategi</h2>
<div class="grid dua">
${c.strategi.map((s) => `<div class="kartu">
  <h3>${U.esc(s.nama)}</h3>
  <ol class="kecil">${s.langkah.map((l) => `<li>${U.esc(l)}</li>`).join('')}</ol>
  <p class="kecil">Komunikasi ${U.fmt(s.biayaKomunikasi)} + lokal ${U.fmt(s.biayaLokal)} = <strong>${U.fmt(s.total)}</strong></p>
</div>`).join('')}
</div>

<h2>Titik impas semijoin</h2>
<p>Semijoin memakai identitas <code>R ⋈ S = (R ⋉ S) ⋈ S</code>. Ia menambah satu putaran pesan, jadi baru menang bila jumlah byte yang dihemat lebih besar daripada ongkos pesan tambahan.</p>
${U.pre(`Kirim R utuh  : C₀ + C₁ · |R| · d(R) · w
Semijoin      : 2·C₀ + C₁ · ( |S| · w  +  s · |R| · d(R) · w )

Semijoin menang bila  s < 1 − ( C₀ + C₁·|S|·w ) / ( C₁·|R|·d(R)·w )`)}
${x.layak
    ? U.catatan(`Pada ukuran relasi dan biaya saat ini, <b>titik impasnya ${U.persen(x.selektivitasImpas, 1)}</b>. ${U.esc(x.catatan)}`, 'baik')
    : U.catatan(U.esc(x.catatan), 'peringatan')}

<h2>Penapis Bloom</h2>
<p>Bloom join menggantikan daftar nilai join dengan vektor bit. Jauh lebih ringkas, tetapi memunculkan positif palsu — baris R yang lolos penapis padahal tidak punya pasangan. Positif palsu itu tersaring sendiri pada join akhir, sehingga hasilnya tetap benar.</p>
${U.tabel(['Ukuran penapis', 'Byte pesan pertama', 'Positif palsu nyata', 'Laju teoretis', 'Total biaya'],
    [64, 128, 256, 512, 1024, 2048].map((b) => {
      const r = J.bloomJoinStrategy(R, S, attr, { ...opsi, bits: b });
      return [
        `${b} bit${b === state.bits ? ` ${U.lencana('dipakai', 'info')}` : ''}`,
        U.fmt(Math.ceil(b / 8)),
        U.fmt(r.positifPalsu),
        U.persen(r.lajuPositifPalsuTeoretis, 2),
        U.fmt(r.total),
      ];
    }), { kelasNum: [1, 2, 3, 4] })}
${U.catatan(`Penapis ${state.bits} bit hanya ${bloom.byteTerkirim - (bloom.byteTerkirim - Math.ceil(state.bits / 8))} byte untuk pesan pertamanya, dibanding ${U.fmt(S.cardinality * 12)} byte bila daftar nilai join dikirim apa adanya. Harganya ${bloom.positifPalsu} positif palsu.`, 'info')}

<h2>Relasi masukan</h2>
<div class="grid dua">
  <div class="kartu">${U.tabelRelasi(R, { maks: 6, judul: `${R.name} (situs kiri) — ${R.cardinality} baris` })}</div>
  <div class="kartu">${U.tabelRelasi(S, { maks: 6, judul: `${S.name} (situs kanan) — ${S.cardinality} baris` })}</div>
</div>
`;
}

render();
