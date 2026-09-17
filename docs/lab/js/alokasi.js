// Lab 05 — Alokasi & Replikasi.
import { DEFAULT_SITES, DEFAULT_NETWORK } from '../../engine/data/datasets.js?v=b04806ea2d';
import * as AL from '../../engine/ddb/allocate.js?v=b04806ea2d';
import * as U from './ui.js?v=b04806ea2d';

const SITUS = DEFAULT_SITES.map((s) => ({ ...s, keandalan: 0.97 }));

const FRAGMEN = [
  { nama: 'PASIEN_JKT', ukuranKB: 120 },
  { nama: 'PASIEN_BDG', ukuranKB: 90 },
  { nama: 'PASIEN_SBY', ukuranKB: 100 },
  { nama: 'DOKTER', ukuranKB: 40 },
];

const QUERIES = [
  { nama: 'Q1 rawat jalan Jakarta', situsAsal: 'S1', baca: { PASIEN_JKT: 200, DOKTER: 150 }, perbarui: { PASIEN_JKT: 30 } },
  { nama: 'Q2 rawat jalan Bandung', situsAsal: 'S2', baca: { PASIEN_BDG: 150, DOKTER: 120 }, perbarui: { PASIEN_BDG: 25 } },
  { nama: 'Q3 rawat jalan Surabaya', situsAsal: 'S3', baca: { PASIEN_SBY: 160, DOKTER: 130 }, perbarui: { PASIEN_SBY: 28 } },
  { nama: 'Q4 laporan nasional', situsAsal: 'S1', baca: { PASIEN_JKT: 10, PASIEN_BDG: 10, PASIEN_SBY: 10, DOKTER: 10 }, perbarui: {} },
];

const state = { queries: JSON.parse(JSON.stringify(QUERIES)), keandalan: 0.97 };

function render() {
  U.pasang(`
${U.catatan('Empat kelompok informasi pada Modul 7 — basis data, aplikasi, situs, dan jaringan — dipakai persis sebagai masukan model biaya. Ubah angkanya, lalu lihat kapan replikasi menjadi menguntungkan dan kapan justru merugikan.')}

<h2>Masukan model biaya</h2>
<div class="grid dua">
  <div class="kartu">
    <h3>Informasi situs dan jaringan</h3>
    ${U.tabel(['Situs', 'Kota', 'Biaya simpan', 'Biaya proses', 'Keandalan'],
    SITUS.map((s) => [`<strong>${s.id}</strong>`, s.nama, s.biayaSimpan, s.biayaProses, U.persen(s.keandalan, 0)]), { kelasNum: [2, 3, 4] })}
    <h4>Latensi antar situs (ms)</h4>
    ${U.tabel(['', ...SITUS.map((s) => s.id)],
    SITUS.map((a) => [`<strong>${a.id}</strong>`, ...SITUS.map((b) => DEFAULT_NETWORK.latency[a.id][b.id])]), { kelasNum: [1, 2, 3] })}
    <h4>Bandwidth antar situs (Mbps)</h4>
    ${U.tabel(['', ...SITUS.map((s) => s.id)],
    SITUS.map((a) => [`<strong>${a.id}</strong>`, ...SITUS.map((b) => DEFAULT_NETWORK.bandwidth[a.id][b.id])]), { kelasNum: [1, 2, 3] })}
  </div>
  <div class="kartu">
    <h3>Informasi basis data dan aplikasi</h3>
    <p class="kecil">Matriks penggunaan fragmen: berapa kali tiap kueri membaca dan memperbarui tiap fragmen. Angka boleh diubah.</p>
    <div id="matriks"></div>
    <div class="kontrol" style="margin-top:12px">
      ${U.bidang('Keandalan tiap situs', '<input type="range" id="keandalan" min="80" max="999" value="970">')}
      <span id="keandalan-label" class="mono"></span>
      ${U.tombol('reset', 'Kembalikan angka awal', 'hantu')}
    </div>
  </div>
</div>

<div id="keluaran"></div>
`);
  gambarMatriks();
  document.getElementById('keandalan').addEventListener('input', (e) => {
    state.keandalan = Number(e.target.value) / 1000;
    hitung();
  });
  document.getElementById('reset').addEventListener('click', () => {
    state.queries = JSON.parse(JSON.stringify(QUERIES));
    state.keandalan = 0.97;
    document.getElementById('keandalan').value = 970;
    gambarMatriks();
    hitung();
  });
  hitung();
}

function gambarMatriks() {
  const m = document.getElementById('matriks');
  m.innerHTML = `<div class="tabel-bungkus"><table>
<thead><tr><th>Kueri</th><th>Situs</th>${FRAGMEN.map((f) => `<th class="num">${f.nama}</th>`).join('')}</tr></thead>
<tbody>
${state.queries.map((q, qi) => `
<tr><td rowspan="2"><strong>${U.esc(q.nama)}</strong></td><td class="kecil">baca</td>
${FRAGMEN.map((f) => `<td class="num"><input type="number" data-q="${qi}" data-op="baca" data-f="${f.nama}" value="${q.baca[f.nama] || 0}" min="0" style="width:62px"></td>`).join('')}</tr>
<tr><td class="kecil">tulis</td>
${FRAGMEN.map((f) => `<td class="num"><input type="number" data-q="${qi}" data-op="perbarui" data-f="${f.nama}" value="${q.perbarui[f.nama] || 0}" min="0" style="width:62px"></td>`).join('')}</tr>`).join('')}
<tr><td colspan="2" class="kecil">ukuran fragmen (KB)</td>
${FRAGMEN.map((f) => `<td class="num mono">${f.ukuranKB}</td>`).join('')}</tr>
</tbody></table></div>`;
  m.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', () => {
    const q = state.queries[Number(inp.dataset.q)];
    q[inp.dataset.op][inp.dataset.f] = Math.max(0, Number(inp.value) || 0);
    hitung();
  }));
}

function hitung() {
  const situs = SITUS.map((s) => ({ ...s, keandalan: state.keandalan }));
  const input = { fragmen: FRAGMEN, situs, jaringan: DEFAULT_NETWORK, queries: state.queries };
  document.getElementById('keandalan-label').textContent = `${(state.keandalan * 100).toFixed(1)}%`;

  const opt = AL.optimalAllocation(input);
  const penuh = AL.fullReplication(input);
  const pusat = SITUS.map((s) => ({ id: s.id, hasil: AL.centralized(input, s.id) }));
  const pusatTerbaik = pusat.reduce((a, b) => (a.hasil.total < b.hasil.total ? a : b));
  const ket = AL.availability(opt.alokasi, situs);
  const ketPenuh = AL.availability(penuh.alokasi, situs);
  const maks = Math.max(opt.total, penuh.total, pusatTerbaik.hasil.total);

  document.getElementById('keluaran').innerHTML = `
<h2>Alokasi optimal</h2>
<p class="kecil">Metode: ${U.esc(opt.metode)} · ruang pencarian ${U.fmt(opt.ruangPencarian)} kombinasi.</p>
${U.tabel(['Fragmen', 'Ditempatkan di', 'Replika', 'Biaya simpan', 'Biaya baca', 'Biaya tulis', 'Ketersediaan'],
    FRAGMEN.map((f) => {
      const p = opt.perFragmen[f.nama];
      return [
        `<strong>${f.nama}</strong>`,
        p.situs.map((s) => `<code>${s}</code>`).join(' '),
        p.replika > 1 ? U.lencana(`${p.replika}×`, 'info') : U.lencana('tunggal', 'netral'),
        U.fmt(p.simpan),
        U.fmt(p.baca),
        U.fmt(p.perbarui),
        U.persen(ket.perFragmen[f.nama].ketersediaan, 3),
      ];
    }), { kelasNum: [3, 4, 5, 6] })}

<h2>Perbandingan strategi</h2>
${U.tabel(['Strategi', 'Biaya total', '', 'Simpan', 'Baca', 'Tulis', 'Ketersediaan sistem'], [
    [`<strong>Optimal (${opt.metode.startsWith('eksak') ? 'eksak' : 'greedy'})</strong>`, U.fmt(opt.total), U.bar(opt.total, maks, 'ok'), U.fmt(opt.rincian.simpan), U.fmt(opt.rincian.baca), U.fmt(opt.rincian.perbarui), U.persen(ket.sistem, 2)],
    ['Replikasi penuh', U.fmt(penuh.total), U.bar(penuh.total, maks), U.fmt(penuh.rincian.simpan), U.fmt(penuh.rincian.baca), U.fmt(penuh.rincian.perbarui), U.persen(ketPenuh.sistem, 2)],
    [`Terpusat di ${pusatTerbaik.id}`, U.fmt(pusatTerbaik.hasil.total), U.bar(pusatTerbaik.hasil.total, maks), U.fmt(pusatTerbaik.hasil.rincian.simpan), U.fmt(pusatTerbaik.hasil.rincian.baca), U.fmt(pusatTerbaik.hasil.rincian.perbarui), U.persen(AL.availability(pusatTerbaik.hasil.alokasi, situs).sistem, 2)],
  ], { kelasNum: [1, 3, 4, 5, 6] })}

${bacaKesimpulan(opt, penuh, pusatTerbaik)}

<h2>Terpusat di tiap situs</h2>
${U.tabel(['Situs pusat', 'Biaya total', ''], pusat.map((p) => [
    `<code>${p.id}</code> ${SITUS.find((s) => s.id === p.id).nama}`,
    U.fmt(p.hasil.total),
    U.bar(p.hasil.total, Math.max(...pusat.map((x) => x.hasil.total))),
  ]), { kelasNum: [1] })}

<h2>Mengapa replikasi bukan jawaban otomatis</h2>
<div class="grid dua">
  <div class="kartu">
    <h3>Yang naik saat direplikasi</h3>
    <ul>
      <li><strong>Biaya simpan</strong> — tiap salinan menempati ruang di situsnya</li>
      <li><strong>Biaya tulis</strong> — setiap pembaruan wajib menyentuh SELURUH salinan lewat 2PC</li>
      <li><strong>Kerapuhan tulis</strong> — transaksi gagal bila satu situs pemegang salinan tidak terjangkau</li>
    </ul>
  </div>
  <div class="kartu">
    <h3>Yang turun saat direplikasi</h3>
    <ul>
      <li><strong>Biaya baca</strong> — cukup ambil salinan terdekat</li>
      <li><strong>Risiko tidak tersedia</strong> — ketersediaan baca naik dari ${U.persen(state.keandalan, 2)} menjadi ${U.persen(1 - (1 - state.keandalan) ** 3, 4)} dengan tiga salinan</li>
    </ul>
  </div>
</div>
${U.catatan(`Aturan praktis yang muncul sendiri dari angka: <b>replikasi fragmen yang banyak dibaca dan jarang ditulis</b> (tabel referensi seperti DOKTER), <b>jangan replikasi fragmen yang sering ditulis</b> (tabel transaksi seperti PASIEN). Coba naikkan angka tulis DOKTER di matriks — replikanya akan berkurang sendiri.`, 'info')}
`;
}

function bacaKesimpulan(opt, penuh, pusat) {
  const hematPenuh = ((1 - opt.total / penuh.total) * 100).toFixed(1);
  const hematPusat = ((1 - opt.total / pusat.hasil.total) * 100).toFixed(1);
  const direplikasi = Object.entries(opt.alokasi).filter(([, s]) => s.length > 1).map(([f]) => f);
  return U.catatan(
    `Alokasi optimal ${hematPenuh}% lebih murah daripada replikasi penuh dan ${hematPusat}% lebih murah daripada terpusat di ${pusat.id}. `
    + (direplikasi.length
      ? `Fragmen yang layak direplikasi: <b>${direplikasi.join(', ')}</b> — karena dibaca banyak situs dan jarang diperbarui.`
      : 'Pada angka saat ini tidak ada fragmen yang layak direplikasi: setiap fragmen dominan dipakai satu situs saja.'),
    'baik',
  );
}

render();
