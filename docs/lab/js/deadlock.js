// Lab 11 — Manajemen Deadlock.
import * as D from '../../engine/ddb/deadlock.js?v=b04806ea2d';
import * as U from './ui.js?v=b04806ea2d';

const SKENARIO = {
  lintas: {
    nama: 'Deadlock lintas tiga situs',
    tunggu: {
      S1: [{ tx: 'T1', menunggu: 'T2', item: 'pasien:7' }],
      S2: [{ tx: 'T2', menunggu: 'T3', item: 'dokter:3' }],
      S3: [{ tx: 'T3', menunggu: 'T1', item: 'daftar:9' }],
    },
    cerita: 'Tidak satu pun situs melihat siklus pada WFG lokalnya. Siklus baru muncul setelah ketiga WFG disatukan — inilah alasan deteksi lokal tidak pernah cukup.',
  },
  lokal: {
    nama: 'Deadlock di dalam satu situs',
    tunggu: {
      S1: [{ tx: 'T1', menunggu: 'T2', item: 'x' }, { tx: 'T2', menunggu: 'T1', item: 'y' }],
      S2: [{ tx: 'T3', menunggu: 'T4', item: 'z' }],
    },
    cerita: 'Siklus sepenuhnya berada di S1. Detektor lokal sudah cukup — tidak perlu pesan lintas situs sama sekali.',
  },
  rantai: {
    nama: 'Rantai tunggu tanpa siklus',
    tunggu: {
      S1: [{ tx: 'T1', menunggu: 'T2', item: 'x' }],
      S2: [{ tx: 'T2', menunggu: 'T3', item: 'y' }],
      S3: [{ tx: 'T3', menunggu: 'T4', item: 'z' }],
    },
    cerita: 'Banyak transaksi menunggu, tetapi T4 tidak menunggu siapa pun. Begitu T4 selesai, seluruh rantai ikut terurai. Bukan deadlock.',
  },
  ganda: {
    nama: 'Dua siklus sekaligus',
    tunggu: {
      S1: [{ tx: 'T1', menunggu: 'T2', item: 'a' }, { tx: 'T2', menunggu: 'T1', item: 'b' }],
      S2: [{ tx: 'T3', menunggu: 'T4', item: 'c' }, { tx: 'T4', menunggu: 'T3', item: 'd' }],
    },
    cerita: 'Dua deadlock independen. Detektor harus menemukan keduanya dan memilih korban untuk masing-masing.',
  },
  panjang: {
    nama: 'Siklus panjang lima transaksi',
    tunggu: {
      S1: [{ tx: 'T1', menunggu: 'T2', item: 'a' }],
      S2: [{ tx: 'T2', menunggu: 'T3', item: 'b' }, { tx: 'T3', menunggu: 'T4', item: 'c' }],
      S3: [{ tx: 'T4', menunggu: 'T5', item: 'd' }, { tx: 'T5', menunggu: 'T1', item: 'e' }],
    },
    cerita: 'Semakin panjang siklusnya, semakin banyak pesan yang dibutuhkan path pushing dan edge chasing — tetapi deteksi terpusat tetap butuh satu pesan per situs.',
  },
};

const PROFIL = {
  T1: { umur: 300, kunciDipegang: 8, kerjaSelesai: 90, prioritas: 5 },
  T2: { umur: 120, kunciDipegang: 3, kerjaSelesai: 40, prioritas: 9 },
  T3: { umur: 20, kunciDipegang: 1, kerjaSelesai: 5, prioritas: 1 },
  T4: { umur: 210, kunciDipegang: 5, kerjaSelesai: 60, prioritas: 7 },
  T5: { umur: 60, kunciDipegang: 2, kerjaSelesai: 15, prioritas: 3 },
};

let skenario = 'lintas';
let strategi = 'termuda';

function render() {
  U.pasang(`
${U.catatan('Tiga metode deteksi dijalankan atas situasi yang sama. Ketiganya wajib sepakat tentang ada-tidaknya deadlock; yang berbeda hanya beban pesannya dan siapa yang menanggung beban itu.')}

<div class="kontrol">
  ${U.bidang('Situasi', U.pilihan('skenario', Object.entries(SKENARIO).map(([k, v]) => ({ nilai: k, teks: v.nama })), skenario))}
</div>

<div id="keluaran"></div>

<h2>Pencegahan berbasis cap waktu</h2>
<p>Alih-alih mendeteksi lalu mengorbankan, deadlock dapat dicegah sejak awal: arah sisi tunggu dipaksa selalu searah cap waktu, sehingga siklus mustahil terbentuk.</p>
<div class="kontrol">
  ${U.bidang('TS transaksi A', '<input type="number" id="tsa" value="10" min="1" max="100" style="width:80px">')}
  ${U.bidang('TS transaksi B', '<input type="number" id="tsb" value="25" min="1" max="100" style="width:80px">')}
</div>
<div id="pencegahan"></div>
`);

  U.ikatPilihan('skenario', (v) => { skenario = v; gambar(); });
  ['tsa', 'tsb'].forEach((id) => document.getElementById(id).addEventListener('input', gambarPencegahan));
  gambar();
  gambarPencegahan();
}

function gambar() {
  const s = SKENARIO[skenario];
  const c = D.compareDetection(s.tunggu);
  const semua = Object.entries(s.tunggu).flatMap(([situs, ts]) => ts.map((t) => ({ ...t, situs })));
  const graf = D.waitForGraph(semua);
  const siklus = c.terpusat.siklus;
  const korban = siklus.length ? D.pickVictim(siklus[0], PROFIL, strategi) : null;

  document.getElementById('keluaran').innerHTML = `
${U.catatan(U.esc(s.cerita), 'info')}

<h2>Penantian kunci</h2>
${U.tabel(['Situs', 'Transaksi', 'Menunggu', 'Item'], semua.map((t) => [
    `<code>${t.situs}</code>`, `<code>${t.tx}</code>`, `<code>${t.menunggu}</code>`, `<code>${U.esc(t.item)}</code>`,
  ]))}

<h2>Wait-for graph global ${c.terpusat.adaDeadlock ? U.lencana('DEADLOCK', 'gagal') : U.lencana('aman', 'ok')}</h2>
${wfgSvg(graf, siklus[0])}
${siklus.length
    ? `<p>Siklus ditemukan: ${siklus.map((x) => `<code>${x.join(' → ')}</code>`).join(', ')}</p>`
    : '<p class="kosong">Tidak ada penantian melingkar. Setiap transaksi pada akhirnya akan mendapat sumber dayanya.</p>'}

<h2>Tiga metode deteksi</h2>
${U.tabel(['Metode', 'Deadlock ditemukan?', 'Pesan jaringan', 'Cara kerja'], [
    ['<strong>Terpusat</strong>', c.terpusat.adaDeadlock ? U.lencana('ya', 'gagal') : U.lencana('tidak', 'ok'), c.bebanPesan.terpusat, 'Setiap situs mengirim WFG lokalnya ke koordinator'],
    ['<strong>Path pushing</strong>', c.pathPushing.adaDeadlock ? U.lencana('ya', 'gagal') : U.lencana('tidak', 'ok'), c.bebanPesan.pathPushing, 'Situs mendorong jalur tunggu berisi transaksi luar ke situs berikutnya'],
    ['<strong>Edge chasing</strong>', c.edgeChasing.adaDeadlock ? U.lencana('ya', 'gagal') : U.lencana('tidak', 'ok'), c.bebanPesan.edgeChasing, 'Transaksi menunggu mengirim probe mengikuti sisi tunggu'],
  ], { kelasNum: [2] })}
${U.catatan(`Ketiga metode ${c.sepakat ? '<b>sepakat</b>' : '<b>TIDAK sepakat</b> — ini menandakan bug'}.`, c.sepakat ? 'baik' : 'bahaya')}

<div class="grid dua">
  <div class="kartu">
    <h3>Deteksi terpusat</h3>
    <h4>WFG per situs sebelum disatukan</h4>
    ${U.tabel(['Situs', 'Sisi lokal', 'Siklus lokal?'], Object.entries(c.terpusat.grafLokal).map(([situs, g]) => [
    `<code>${situs}</code>`,
    g.sisi.map((e) => `<code>${e.dari}→${e.ke}</code>`).join(' ') || '—',
    D.findAllCycles(g).length ? U.lencana('ada', 'gagal') : U.lencana('tidak ada', 'netral'),
  ]))}
    <ul class="kecil">${c.terpusat.catatan.map((x) => `<li>${U.esc(x)}</li>`).join('')}</ul>
  </div>
  <div class="kartu">
    <h3>Edge chasing — jejak probe</h3>
    ${c.edgeChasing.probes.length
    ? U.tabel(['Probe', 'Jalur'], c.edgeChasing.probes.map((p) => [`<code>${U.esc(p.probe)}</code>`, `<code class="kecil">${U.esc(p.jalur)}</code>`]))
    : '<p class="kosong">Tidak ada transaksi yang menunggu.</p>'}
    ${c.edgeChasing.jalurDeadlock ? U.catatan(`Probe kembali ke inisiatornya lewat <code>${c.edgeChasing.jalurDeadlock.join(' → ')}</code> — deadlock dipastikan.`, 'peringatan') : ''}
    <ul class="kecil">${c.edgeChasing.catatan.map((x) => `<li>${U.esc(x)}</li>`).join('')}</ul>
  </div>
</div>

<h2>Path pushing — jejak</h2>
${U.tabel(['Situs', 'Aksi', 'Detail'], c.pathPushing.jejak.map((j) => [`<code>${U.esc(j.situs)}</code>`, U.esc(j.aksi), `<span class="kecil">${U.esc(j.detail)}</span>`]))}

${siklus.length ? `
<h2>Pemilihan korban</h2>
<div class="kontrol">
  ${U.bidang('Strategi', U.pilihan('strategi', [
    { nilai: 'termuda', teks: 'Termuda' },
    { nilai: 'kunci-paling-sedikit', teks: 'Kunci paling sedikit' },
    { nilai: 'kerja-paling-sedikit', teks: 'Kerja paling sedikit' },
    { nilai: 'prioritas-terendah', teks: 'Prioritas terendah' },
  ], strategi))}
</div>
${U.tabel(['Transaksi', 'Umur (detik)', 'Kunci dipegang', 'Kerja selesai (%)', 'Prioritas', 'Keputusan'], korban.peringkat.map((p) => [
    `<code>${p.tx}</code>`, p.umur, p.kunciDipegang, p.kerjaSelesai, p.prioritas,
    p.tx === korban.korban ? U.lencana('KORBAN', 'gagal') : U.lencana('dipertahankan', 'ok'),
  ]), { kelasNum: [1, 2, 3, 4] })}
${U.catatan(`Korban yang dipilih: <b>${korban.korban}</b> — ${U.esc(korban.alasan)}.`, 'peringatan')}
` : ''}

<h2>Deadlock semu</h2>
<p>WFG dari situs berbeda tidak pernah diambil pada saat yang benar-benar sama. Sisi yang sebenarnya sudah dilepas masih tercatat, dan siklus palsu terbentuk.</p>
${phantomHtml()}
`;

  U.ikatPilihan('strategi', (v) => { strategi = v; gambar(); });
}

function phantomHtml() {
  const p = D.phantomDeadlock(
    [{ tx: 'T1', menunggu: 'T2', item: 'x', situs: 'S1' }, { tx: 'T2', menunggu: 'T1', item: 'y', situs: 'S2' }],
    [{ tx: 'T1', menunggu: 'T2', item: 'x', situs: 'S1' }],
  );
  return `<div class="grid dua">
  <div class="kartu">
    <h4>Snapshot t=0 (WFG S1 diambil)</h4>
    ${U.pre('T1 → T2  @S1\nT2 → T1  @S2')}
    <p>${p.siklusPadaSnapshotLama.length ? U.lencana('siklus terdeteksi', 'gagal') : U.lencana('aman', 'ok')}</p>
  </div>
  <div class="kartu">
    <h4>Snapshot t=1 (WFG S2 baru diambil)</h4>
    ${U.pre('T1 → T2  @S1')}
    <p>${p.siklusPadaSnapshotBaru.length ? U.lencana('siklus terdeteksi', 'gagal') : U.lencana('aman', 'ok')}</p>
  </div>
</div>
${U.catatan(U.esc(p.penjelasan), 'peringatan')}
${U.catatan('Ini bukan bug yang bisa diperbaiki, melainkan konsekuensi langsung dari tidak adanya waktu global pada sistem terdistribusi. Yang bisa dilakukan hanya memperkecil frekuensinya, misalnya dengan memperpendek jeda pengumpulan WFG.', 'info')}`;
}

function gambarPencegahan() {
  const a = Number(document.getElementById('tsa').value) || 1;
  const b = Number(document.getElementById('tsb').value) || 1;
  const p = D.preventionComparison(a, b);
  document.getElementById('pencegahan').innerHTML = `
${U.tabel(['Skema', 'A meminta kunci yang dipegang B', 'B meminta kunci yang dipegang A'], [
    ['<strong>Wait-Die</strong><br><span class="kecil">non-preemptive</span>',
      `${U.lencana(p.waitDie['A minta kunci B'].hasil, p.waitDie['A minta kunci B'].menunggu ? 'info' : 'gagal')}<br><span class="kecil">${U.esc(p.waitDie['A minta kunci B'].alasan)}</span>`,
      `${U.lencana(p.waitDie['B minta kunci A'].hasil, p.waitDie['B minta kunci A'].menunggu ? 'info' : 'gagal')}<br><span class="kecil">${U.esc(p.waitDie['B minta kunci A'].alasan)}</span>`],
    ['<strong>Wound-Wait</strong><br><span class="kecil">preemptive</span>',
      `${U.lencana(p.woundWait['A minta kunci B'].hasil, p.woundWait['A minta kunci B'].melukai ? 'gagal' : 'info')}<br><span class="kecil">${U.esc(p.woundWait['A minta kunci B'].alasan)}</span>`,
      `${U.lencana(p.woundWait['B minta kunci A'].hasil, p.woundWait['B minta kunci A'].melukai ? 'gagal' : 'info')}<br><span class="kecil">${U.esc(p.woundWait['B minta kunci A'].alasan)}</span>`],
  ])}
${U.catatan(`<b>${U.esc(p.inti)}</b> ${U.esc(p.bedanya)}`, 'baik')}
${U.catatan('Transaksi yang di-restart <b>mempertahankan cap waktu lamanya</b>. Tanpa itu, transaksi yang sama bisa dimatikan berulang kali selamanya — kelaparan (starvation).', 'info')}`;
}

function wfgSvg(graf, siklus) {
  const n = graf.simpul.length;
  if (!n) return '<p class="kosong">Tidak ada penantian.</p>';
  const lebar = 460; const tinggi = 210;
  const cx = lebar / 2; const cy = tinggi / 2;
  const jari = n === 1 ? 0 : 65 + n * 9;
  const pos = graf.simpul.map((s, i) => {
    const sudut = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { s, x: cx + Math.cos(sudut) * jari, y: cy + Math.sin(sudut) * (jari * 0.6) };
  });
  const cari = (nm) => pos.find((p) => p.s === nm);
  const diSiklus = (a, b) => {
    if (!siklus) return false;
    for (let i = 0; i < siklus.length - 1; i++) if (siklus[i] === a && siklus[i + 1] === b) return true;
    return false;
  };
  const warnaSitus = { S1: '#60a5fa', S2: '#34d399', S3: '#a78bfa' };
  return `<div class="diagram"><svg viewBox="0 0 ${lebar} ${tinggi}" role="img" aria-label="Wait-for graph">
<defs><marker id="w1" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#6c7a90"/></marker>
<marker id="w2" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#f04438"/></marker></defs>
${graf.sisi.map((e) => {
    const a = cari(e.dari); const b = cari(e.ke);
    if (!a || !b) return '';
    const merah = diSiklus(e.dari, e.ke);
    const dx = b.x - a.x; const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const r = 24;
    const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
    return `<line x1="${a.x + (dx / d) * r}" y1="${a.y + (dy / d) * r}" x2="${b.x - (dx / d) * r}" y2="${b.y - (dy / d) * r}" stroke="${merah ? '#f04438' : '#6c7a90'}" stroke-width="${merah ? 2.2 : 1.5}" marker-end="url(#${merah ? 'w2' : 'w1'})"/>
<text x="${mx}" y="${my - 5}" fill="${warnaSitus[e.situs] || '#6c7a90'}" font-size="9.5" text-anchor="middle" font-family="monospace">${U.esc(e.situs || '')} ${U.esc(e.item || '')}</text>`;
  }).join('\n')}
${pos.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="22" fill="#131821" stroke="${siklus && siklus.includes(p.s) ? '#f04438' : '#2d3949'}" stroke-width="2"/>
<text x="${p.x}" y="${p.y + 4}" fill="#e6ebf2" font-size="12" text-anchor="middle" font-family="monospace">${p.s}</text>`).join('\n')}
</svg></div>`;
}

render();
