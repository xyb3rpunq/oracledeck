// Lab 12 — Simulator 2PC & 3PC dengan injeksi kegagalan.
import * as TP from '../../engine/ddb/twophase.js?v=b04806ea2d';
import * as U from './ui.js?v=b04806ea2d';

const state = {
  peserta: [
    { id: 'Jakarta', vote: 'COMMIT', jatuhPada: null },
    { id: 'Bandung', vote: 'COMMIT', jatuhPada: null },
    { id: 'Surabaya', vote: 'COMMIT', jatuhPada: null },
  ],
  koordinatorJatuhPada: null,
  partisi: false,
};

const SKENARIO = [
  { id: 'normal', nama: 'Jalur normal', terap: () => { state.peserta.forEach((p) => { p.vote = 'COMMIT'; p.jatuhPada = null; p.gateway = false; }); state.koordinatorJatuhPada = null; state.partisi = false; } },
  { id: 'abort', nama: 'Satu peserta menolak', terap: () => { state.peserta.forEach((p) => { p.vote = 'COMMIT'; p.jatuhPada = null; p.gateway = false; }); state.peserta[1].vote = 'ABORT'; state.koordinatorJatuhPada = null; state.partisi = false; } },
  { id: 'peserta-jatuh', nama: 'Peserta jatuh sebelum memberi suara', terap: () => { state.peserta.forEach((p) => { p.vote = 'COMMIT'; p.jatuhPada = null; p.gateway = false; }); state.peserta[2].jatuhPada = 2; state.koordinatorJatuhPada = null; state.partisi = false; } },
  { id: 'koor-3', nama: '⚠ Koordinator jatuh setelah semua READY', terap: () => { state.peserta.forEach((p) => { p.vote = 'COMMIT'; p.jatuhPada = null; p.gateway = false; }); state.koordinatorJatuhPada = 3; state.partisi = false; } },
  { id: 'koor-4', nama: 'Koordinator jatuh setelah PRE-COMMIT', terap: () => { state.peserta.forEach((p) => { p.vote = 'COMMIT'; p.jatuhPada = null; p.gateway = false; }); state.koordinatorJatuhPada = 4; state.partisi = false; } },
  { id: 'koor-1', nama: 'Koordinator jatuh sebelum PREPARE', terap: () => { state.peserta.forEach((p) => { p.vote = 'COMMIT'; p.jatuhPada = null; p.gateway = false; }); state.koordinatorJatuhPada = 1; state.partisi = false; } },
  { id: 'partisi', nama: 'Partisi jaringan', terap: () => { state.peserta.forEach((p) => { p.vote = 'COMMIT'; p.jatuhPada = null; p.gateway = false; }); state.koordinatorJatuhPada = null; state.partisi = true; } },
  { id: 'gateway', nama: '⚠ Bandung di balik gateway ODBC, Surabaya menolak', terap: () => { state.peserta.forEach((p) => { p.vote = 'COMMIT'; p.jatuhPada = null; p.gateway = false; }); state.peserta[1].gateway = true; state.peserta[2].vote = 'ABORT'; state.koordinatorJatuhPada = null; state.partisi = false; } },
];

function skenarioAktif() {
  return {
    peserta: state.peserta.map((p) => ({ id: p.id, vote: p.vote, jatuhPada: p.jatuhPada, gateway: Boolean(p.gateway) })),
    koordinatorJatuhPada: state.koordinatorJatuhPada,
    partisi: state.partisi ? [['Koordinator', 'Jakarta'], ['Bandung', 'Surabaya']] : [],
  };
}

function render() {
  U.pasang(`
${U.catatan('Simulator ini menjalankan mesin keadaan 2PC dan 3PC yang sesungguhnya, lalu <b>membuktikan</b> sifat yang dibahas di kuliah: 2PC memblokir bila koordinator jatuh setelah peserta masuk keadaan READY, 3PC tidak.')}

<h2>Skenario</h2>
<div class="grid tiga">
${SKENARIO.map((s) => `<button type="button" class="hantu kecil skenario" data-id="${s.id}" style="text-align:left">${U.esc(s.nama)}</button>`).join('')}
</div>

<div class="kartu" style="margin-top:14px">
  <h3>Atur sendiri</h3>
  <div id="pengatur"></div>
</div>

<div id="keluaran"></div>
`);

  U.$$('.skenario').forEach((b) => b.addEventListener('click', () => {
    SKENARIO.find((s) => s.id === b.dataset.id).terap();
    gambarPengatur();
    hitung();
  }));
  gambarPengatur();
  hitung();
}

function gambarPengatur() {
  document.getElementById('pengatur').innerHTML = `
${U.tabel(['Peserta', 'Suara', 'Jatuh pada fase', 'Di balik gateway ODBC'], state.peserta.map((p, i) => [
    `<strong>${U.esc(p.id)}</strong>`,
    `<select data-p="${i}" data-f="vote"><option value="COMMIT"${p.vote === 'COMMIT' ? ' selected' : ''}>VOTE-COMMIT</option><option value="ABORT"${p.vote === 'ABORT' ? ' selected' : ''}>VOTE-ABORT</option></select>`,
    `<select data-p="${i}" data-f="jatuhPada"><option value="">tidak jatuh</option><option value="2"${p.jatuhPada === 2 ? ' selected' : ''}>fase 2 (saat memberi suara)</option></select>`,
    `<label class="kecil"><input type="checkbox" data-gw="${i}"${p.gateway ? ' checked' : ''}> autocommit</label>`,
  ]))}
<div class="kontrol" style="margin-top:10px">
  ${U.bidang('Koordinator jatuh pada fase', `<select id="koor">
    <option value="">tidak jatuh</option>
    <option value="1"${state.koordinatorJatuhPada === 1 ? ' selected' : ''}>fase 1 — sebelum PREPARE</option>
    <option value="3"${state.koordinatorJatuhPada === 3 ? ' selected' : ''}>fase 3 — setelah semua READY</option>
    <option value="4"${state.koordinatorJatuhPada === 4 ? ' selected' : ''}>fase 4 — setelah PRE-COMMIT (3PC)</option>
  </select>`)}
  ${U.bidang('Partisi jaringan', `<label class="kecil"><input type="checkbox" id="partisi"${state.partisi ? ' checked' : ''}> Koordinator+Jakarta terpisah dari Bandung+Surabaya</label>`)}
</div>`;

  U.$$('#pengatur select[data-p]').forEach((s) => s.addEventListener('change', () => {
    const p = state.peserta[Number(s.dataset.p)];
    p[s.dataset.f] = s.dataset.f === 'jatuhPada' ? (s.value ? Number(s.value) : null) : s.value;
    hitung();
  }));
  U.$$('#pengatur input[data-gw]').forEach((c) => c.addEventListener('change', () => {
    state.peserta[Number(c.dataset.gw)].gateway = c.checked;
    hitung();
  }));
  document.getElementById('koor').addEventListener('change', (e) => {
    state.koordinatorJatuhPada = e.target.value ? Number(e.target.value) : null;
    hitung();
  });
  document.getElementById('partisi').addEventListener('change', (e) => {
    state.partisi = e.target.checked;
    hitung();
  });
}

const WARNA = {
  COMMIT: 'ok', ABORT: 'warn', BLOCKED: 'gagal', DOWN: 'netral',
  READY: 'info', 'PRE-COMMIT': 'info', WAIT: 'info', INITIAL: 'netral',
};

function keadaanHtml(keadaan) {
  return Object.entries(keadaan).map(([k, v]) => `<tr><td><strong>${U.esc(k)}</strong></td><td>${U.lencana(v, WARNA[v] || 'netral')}</td></tr>`).join('');
}

function hitung() {
  const sk = skenarioAktif();
  const c = TP.compareProtocols(sk);
  const dua = c.duaFase;
  const tiga = c.tigaFase;

  document.getElementById('keluaran').innerHTML = `
<h2>Hasil</h2>
<div class="grid dua">
  <div class="kartu">
    <h3>Two-Phase Commit ${dua.hasilCampuran ? U.lencana('HASIL CAMPURAN', 'gagal') : dua.memblokir ? U.lencana('MEMBLOKIR', 'gagal') : U.lencana('selesai', 'ok')}</h3>
    <p>Keputusan: <strong>${U.esc(dua.keputusan)}</strong></p>
    <div class="tabel-bungkus"><table><thead><tr><th>Simpul</th><th>Keadaan akhir</th></tr></thead><tbody>${keadaanHtml(dua.keadaanAkhir)}</tbody></table></div>
    <p class="kecil">${c.jumlahPesan['2PC']} pesan dikirim.</p>
  </div>
  <div class="kartu">
    <h3>Three-Phase Commit ${tiga.hasilCampuran ? U.lencana('HASIL CAMPURAN', 'gagal') : tiga.memblokir ? U.lencana('MEMBLOKIR', 'gagal') : U.lencana('selesai', 'ok')}</h3>
    <p>Keputusan: <strong>${U.esc(tiga.keputusan)}</strong></p>
    <div class="tabel-bungkus"><table><thead><tr><th>Simpul</th><th>Keadaan akhir</th></tr></thead><tbody>${keadaanHtml(tiga.keadaanAkhir)}</tbody></table></div>
    <p class="kecil">${c.jumlahPesan['3PC']} pesan dikirim.</p>
  </div>
</div>

${U.catatan(`<b>${U.esc(c.kesimpulan)}</b>`, dua.hasilCampuran ? 'bahaya' : dua.memblokir && !tiga.memblokir ? 'peringatan' : 'info')}
${dua.gateway && dua.gateway.length ? U.catatan('Peserta bertanda autocommit meniru Oracle Database Gateway for ODBC, yang menurut dokumentasi Oracle tidak dapat ikut transaksi terdistribusi dan langsung meng-commit setiap perubahan pada mode <code>SINGLE_SITE_AUTOCOMMIT</code>. Studi kasusnya ada di <a href="kependudukan.html">Lab Studi Kasus Kependudukan</a>.', 'info') : ''}

<h2>Jejak pesan — 2PC</h2>
${U.jejak(dua.jejak)}
${dua.analisis.length ? `<ul class="kecil">${dua.analisis.map((x) => `<li>${U.esc(x)}</li>`).join('')}</ul>` : ''}

<h2>Jejak pesan — 3PC</h2>
${U.jejak(tiga.jejak)}
${tiga.analisis.length ? `<ul class="kecil">${tiga.analisis.map((x) => `<li>${U.esc(x)}</li>`).join('')}</ul>` : ''}

<h2>Diagram keadaan</h2>
<div class="grid dua">
  <div class="kartu">
    <h4>2PC — keadaan READY bertetangga dengan COMMIT <i>dan</i> ABORT</h4>
    ${diagram2pc(dua.keadaanAkhir)}
    <p class="kecil">Karena itu peserta di READY tidak punya dasar untuk memilih saat koordinator hilang.</p>
  </div>
  <div class="kartu">
    <h4>3PC — PRE-COMMIT hanya bertetangga dengan COMMIT</h4>
    ${diagram3pc(tiga.keadaanAkhir)}
    <p class="kecil">Peserta yang melihat ada satu saja rekan di PRE-COMMIT boleh langsung menyimpulkan COMMIT.</p>
  </div>
</div>

<h2>Pemulihan di Oracle</h2>
<p>Oracle menjalankan 2PC otomatis. Bila transaksi menggantung, inilah yang dilakukan DBA:</p>
${U.preSql(TP.oracleRecoverySql(dua, { namaTransaksi: '1.15.1234' }))}
`;
}

function kotak(x, y, teks, aktif) {
  const w = 96; const h = 30;
  const warna = aktif ? '#f04438' : '#2d3949';
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${aktif ? 'rgba(240,68,56,.14)' : '#11151d'}" stroke="${warna}" stroke-width="${aktif ? 2 : 1.4}"/>
<text x="${x + w / 2}" y="${y + 19}" fill="#e6ebf2" font-size="11" text-anchor="middle" font-family="monospace">${teks}</text>`;
}

function panah(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2d3949" stroke-width="1.5" marker-end="url(#ah)"/>`;
}

const DEF = '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#2d3949"/></marker></defs>';

function diagram2pc(keadaan) {
  const ada = (s) => Object.values(keadaan).includes(s);
  return `<div class="diagram"><svg viewBox="0 0 330 200" role="img" aria-label="Diagram keadaan 2PC">${DEF}
${kotak(115, 8, 'INITIAL', ada('INITIAL'))}
${panah(163, 38, 163, 62)}
${kotak(115, 64, 'READY', ada('READY') || ada('BLOCKED'))}
${panah(140, 94, 70, 128)}
${panah(186, 94, 256, 128)}
${kotak(22, 130, 'COMMIT', ada('COMMIT'))}
${kotak(208, 130, 'ABORT', ada('ABORT'))}
<text x="165" y="186" fill="#6c7a90" font-size="10" text-anchor="middle" font-family="monospace">READY bertetangga dengan keduanya → blokir</text>
</svg></div>`;
}

function diagram3pc(keadaan) {
  const ada = (s) => Object.values(keadaan).includes(s);
  return `<div class="diagram"><svg viewBox="0 0 330 200" role="img" aria-label="Diagram keadaan 3PC">${DEF}
${kotak(115, 4, 'INITIAL', ada('INITIAL'))}
${panah(163, 34, 163, 50)}
${kotak(115, 52, 'READY', ada('READY'))}
${panah(140, 82, 70, 128)}
${panah(163, 82, 163, 96)}
${kotak(115, 98, 'PRE-COMMIT', ada('PRE-COMMIT'))}
${panah(186, 128, 236, 128)}
${kotak(22, 130, 'ABORT', ada('ABORT'))}
${kotak(208, 148, 'COMMIT', ada('COMMIT'))}
<text x="165" y="192" fill="#6c7a90" font-size="10" text-anchor="middle" font-family="monospace">PRE-COMMIT hanya menuju COMMIT → tidak blokir</text>
</svg></div>`;
}

render();
