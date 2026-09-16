// Lab 10 — Kendali Konkurensi: keterserialan, 2PL, timestamp ordering.
import * as C from '../../engine/ddb/concurrency.js?v=8e172babd6';
import * as U from './ui.js?v=8e172babd6';

const CONTOH = [
  { nama: 'Jadwal serial', jadwal: 'r1[x] w1[x] c1 r2[x] w2[x] c2', cerita: 'Dua transaksi berjalan bergantian tanpa tumpang tindih. Selalu serializable, selalu strict.' },
  { nama: 'Lost update', jadwal: 'r1[x] r2[x] w1[x] w2[x] c1 c2', cerita: 'Keduanya membaca nilai lama, lalu keduanya menulis. Pembaruan T1 hilang tanpa jejak. Graf presedensinya bersiklus.' },
  { nama: 'Dirty read tidak recoverable', jadwal: 'w1[x] r2[x] w2[y] c2 c1', cerita: 'T2 membaca data T1 yang belum commit, lalu T2 commit lebih dulu. Bila T1 batal, T2 sudah terlanjur permanen.' },
  { nama: 'Dirty read tetapi recoverable', jadwal: 'w1[x] r2[x] c1 c2', cerita: 'T2 membaca data yang belum commit, tetapi T2 baru commit setelah T1. Recoverable, tetapi belum cascadeless.' },
  { nama: 'Tulis kotor', jadwal: 'w1[x] w2[x] c1 c2', cerita: 'T2 menimpa tulisan T1 yang belum commit. Cascadeless tetap terjaga karena tidak ada yang membaca, tetapi tidak strict.' },
  { nama: 'Upgrade deadlock', jadwal: 'r1[x] r2[x] w1[x] w2[x] c1 c2', cerita: 'Keduanya memegang kunci S pada x, lalu keduanya minta naik ke X. Inilah deadlock peningkatan yang paling sering terjadi.' },
  { nama: 'Unrepeatable read', jadwal: 'r1[x] w2[x] c2 r1[x] c1', cerita: 'T1 membaca x dua kali dan mendapat nilai berbeda karena T2 menyisip di antaranya.' },
  { nama: 'Tiga transaksi, dua item', jadwal: 'r1[x] r2[y] w1[y] w2[x] r3[x] w3[y] c1 c2 c3', cerita: 'Jadwal yang lebih ramai — perhatikan siklus mana yang terbentuk di graf presedensi.' },
  { nama: 'Aturan tulis Thomas', jadwal: 'w2[x] w1[x] c1 c2', cerita: 'Pada timestamp ordering, tulisan T1 yang lebih tua diabaikan tanpa rollback karena pasti tertimpa.' },
];

let jadwalTeks = CONTOH[1].jadwal;
let varian = 'ketat';

function render() {
  U.pasang(`
${U.catatan('Ketik jadwal operasi dalam notasi ringkas — <code>r1[x]</code> berarti transaksi T1 membaca item x, <code>w2[y]</code> berarti T2 menulis y, <code>c1</code> commit, <code>a1</code> abort. Ketiga sudut pandang dihitung bersamaan: keterserialan, 2PL, dan timestamp ordering.')}

<div class="grid dua">
  <div class="kartu">
    <h3>Jadwal</h3>
    <input type="text" id="jadwal" value="${U.esc(jadwalTeks)}" style="width:100%;font-family:var(--mono)">
    <div class="kontrol" style="margin-top:10px">
      ${U.tombol('jalan', 'Analisis')}
      ${U.bidang('Varian 2PL', U.pilih('varian', [
    { nilai: 'ketat', teks: 'Strict 2PL' },
    { nilai: 'dasar', teks: '2PL dasar' },
    { nilai: 'tegas', teks: 'Rigorous 2PL' },
  ], varian))}
    </div>
  </div>
  <div class="kartu">
    <h3>Contoh</h3>
    <div class="grid" style="gap:6px">
${CONTOH.map((c, i) => `<button type="button" class="hantu kecil contoh" data-i="${i}" style="text-align:left"><span class="mono">${U.esc(c.jadwal)}</span><br><span class="kecil">${U.esc(c.nama)}</span></button>`).join('')}
    </div>
  </div>
</div>

<div id="cerita"></div>
<div id="keluaran"></div>
`);

  document.getElementById('jalan').addEventListener('click', hitung);
  document.getElementById('jadwal').addEventListener('keydown', (e) => { if (e.key === 'Enter') hitung(); });
  document.getElementById('varian').addEventListener('change', (e) => { varian = e.target.value; hitung(); });
  U.$$('.contoh').forEach((b) => b.addEventListener('click', () => {
    const c = CONTOH[Number(b.dataset.i)];
    document.getElementById('jadwal').value = c.jadwal;
    document.getElementById('cerita').innerHTML = U.catatan(U.esc(c.cerita), 'info');
    hitung();
  }));
  document.getElementById('cerita').innerHTML = U.catatan(U.esc(CONTOH[1].cerita), 'info');
  hitung();
}

function hitung() {
  const w = document.getElementById('keluaran');
  let ops;
  try { ops = C.parseSchedule(document.getElementById('jadwal').value); } catch (e) {
    w.innerHTML = `<div class="catatan bahaya"><p class="galat">${U.esc(e.message)}</p></div>`;
    return;
  }
  const ser = C.isSerializable(ops);
  const rec = C.recoverability(ops);
  const lock = C.twoPhaseLocking(ops, { varian });
  const ts = C.timestampOrdering(ops);
  const tx = [...new Set(ops.map((o) => o.tx))];
  const item = [...new Set(ops.map((o) => o.item).filter(Boolean))];

  w.innerHTML = `
<h2>Jadwal terbaca</h2>
${gridJadwal(ops, tx)}

<h2>Keterserialan konflik ${ser.serializable ? U.lencana('SERIALIZABLE', 'ok') : U.lencana('TIDAK SERIALIZABLE', 'gagal')}</h2>
<div class="grid dua">
  <div class="kartu">
    <h4>Graf presedensi</h4>
    ${grafSvg(ser.graf, ser.siklus)}
    <p class="kecil">${U.esc(ser.alasan)}</p>
  </div>
  <div class="kartu">
    <h4>Pasangan operasi yang berkonflik</h4>
    ${ser.graf.sisi.length
    ? U.tabel(['Sisi', 'Sebab'], ser.graf.sisi.map((e) => [`<code>${e.dari} → ${e.ke}</code>`, `<span class="kecil">${e.sebab.map(U.esc).join('<br>')}</span>`]))
    : '<p class="kosong">Tidak ada konflik antar transaksi.</p>'}
  </div>
</div>

<h2>Sifat pemulihan</h2>
<div class="grid tiga">
  <div class="kartu"><h3>Recoverable ${U.lulusGagal(rec.recoverable, 'YA', 'TIDAK')}</h3><p class="kecil">Setiap transaksi commit setelah transaksi yang datanya ia baca ikut commit.</p></div>
  <div class="kartu"><h3>Cascadeless ${U.lulusGagal(rec.cascadeless, 'YA', 'TIDAK')}</h3><p class="kecil">Tidak ada transaksi yang membaca data dari transaksi yang belum commit.</p></div>
  <div class="kartu"><h3>Strict ${U.lulusGagal(rec.strict, 'YA', 'TIDAK')}</h3><p class="kecil">Tidak membaca maupun menimpa data yang penulisnya belum commit.</p></div>
</div>
${rec.catatan.length ? `<ul class="kecil">${rec.catatan.map((x) => `<li>${U.esc(x)}</li>`).join('')}</ul>` : ''}

<h2>Two-Phase Locking (${U.esc(varian)})</h2>
${U.tabel(['Transaksi', 'Aksi', 'Item', 'Keterangan'], lock.jejak.map((j) => [
    `<code>${j.tx}</code>`,
    j.aksi.startsWith('MENUNGGU') || j.aksi === 'DITOLAK' ? U.lencana(j.aksi, 'gagal') : j.aksi.startsWith('lock') || j.aksi.startsWith('upgrade') ? U.lencana(j.aksi, 'info') : U.esc(j.aksi),
    `<code>${U.esc(j.item)}</code>`,
    `<span class="kecil">${U.esc(j.keterangan)}</span>`,
  ]))}
${lock.adaTunggu
    ? U.catatan(`<b>${lock.ringkas}.</b> Graf tunggu: ${lock.graphTunggu.map((e) => `<code>${e.dari} → ${e.ke}</code>`).join(', ')}. ${lock.graphTunggu.length >= 2 && lock.graphTunggu.some((a) => lock.graphTunggu.some((b) => a.dari === b.ke && a.ke === b.dari)) ? 'Ada penantian melingkar — <b>deadlock</b>.' : ''}`, 'peringatan')
    : U.catatan(lock.ringkas, 'baik')}
${lock.tertunda.length ? U.catatan(`${lock.tertunda.length} permintaan kunci ditolak karena melanggar aturan 2PL (meminta kunci baru setelah fase menyusut dimulai).`, 'bahaya') : ''}

<h2>Timestamp Ordering</h2>
<p class="kecil">Cap waktu: ${Object.entries(ts.capWaktu).map(([t, v]) => `<code>TS(${t})=${v}</code>`).join(' ')}</p>
${U.tabel(['Operasi', 'Aksi', 'Alasan'], ts.jejak.map((j) => [
    `<code>${j.op}${j.tx.replace('T', '')}${j.item ? `[${j.item}]` : ''}</code>`,
    j.aksi.includes('TOLAK') ? U.lencana(j.aksi, 'gagal') : j.aksi.includes('abaikan') ? U.lencana(j.aksi, 'warn') : U.esc(j.aksi),
    `<span class="kecil">${U.esc(j.alasan)}</span>`,
  ]))}
${U.catatan(ts.ringkas, ts.dibatalkan.length ? 'peringatan' : 'baik')}
<p class="kecil">Cap akhir: ${item.map((i) => `<code>RTS(${i})=${ts.rts[i] || 0}, WTS(${i})=${ts.wts[i] || 0}</code>`).join(' · ')}</p>

<h2>Perbandingan kedua penjadwal</h2>
${U.tabel(['Aspek', '2PL', 'Timestamp Ordering'], [
    ['Cara kerja', 'Menunda operasi sampai kunci tersedia', 'Menolak dan me-rollback operasi yang melanggar urutan cap waktu'],
    ['Deadlock', 'Mungkin terjadi — perlu deteksi atau pencegahan', 'Mustahil — tidak ada transaksi yang menunggu'],
    ['Rollback', 'Hanya bila deadlock', 'Bisa sering, terutama pada beban tulis tinggi'],
    ['Pada sistem terdistribusi', 'Perlu deteksi deadlock global lintas situs', 'Perlu cap waktu unik lintas situs: ⟨jam lokal, id situs⟩'],
    ['Hasil pada jadwal ini', lock.adaTunggu ? `${lock.menunggu.length} penundaan` : 'tanpa penundaan', ts.dibatalkan.length ? `${ts.dibatalkan.length} rollback` : 'tanpa rollback'],
  ])}
`;
}

function gridJadwal(ops, tx) {
  return `<div class="tabel-bungkus"><table>
<thead><tr><th class="num">t</th>${tx.map((t) => `<th>${t}</th>`).join('')}</tr></thead>
<tbody>${ops.map((o, i) => `<tr><td class="num kecil">${i + 1}</td>${tx.map((t) => `<td class="mono">${o.tx === t ? `${o.op}${o.tx.replace('T', '')}${o.item ? `[${o.item}]` : ''}` : ''}</td>`).join('')}</tr>`).join('')}</tbody>
</table></div>`;
}

function grafSvg(graf, siklus) {
  const n = graf.simpul.length;
  if (!n) return '<p class="kosong">Tidak ada transaksi.</p>';
  const lebar = 400; const tinggi = 190;
  const cx = lebar / 2; const cy = tinggi / 2;
  const jari = n === 1 ? 0 : 60 + n * 8;
  const pos = graf.simpul.map((s, i) => {
    const sudut = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { s, x: cx + Math.cos(sudut) * jari, y: cy + Math.sin(sudut) * (jari * 0.62) };
  });
  const cari = (nm) => pos.find((p) => p.s === nm);
  const diSiklus = (a, b) => {
    if (!siklus) return false;
    for (let i = 0; i < siklus.length - 1; i++) if (siklus[i] === a && siklus[i + 1] === b) return true;
    return false;
  };
  return `<div class="diagram"><svg viewBox="0 0 ${lebar} ${tinggi}" role="img" aria-label="Graf presedensi">
<defs><marker id="p1" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#6c7a90"/></marker>
<marker id="p2" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#f04438"/></marker></defs>
${graf.sisi.map((e) => {
    const a = cari(e.dari); const b = cari(e.ke);
    if (!a || !b) return '';
    const merah = diSiklus(e.dari, e.ke);
    const dx = b.x - a.x; const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const r = 24;
    return `<line x1="${a.x + (dx / d) * r}" y1="${a.y + (dy / d) * r}" x2="${b.x - (dx / d) * r}" y2="${b.y - (dy / d) * r}" stroke="${merah ? '#f04438' : '#6c7a90'}" stroke-width="${merah ? 2.2 : 1.5}" marker-end="url(#${merah ? 'p2' : 'p1'})"/>`;
  }).join('\n')}
${pos.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="22" fill="#131821" stroke="${siklus && siklus.includes(p.s) ? '#f04438' : '#2d3949'}" stroke-width="2"/>
<text x="${p.x}" y="${p.y + 4}" fill="#e6ebf2" font-size="12" text-anchor="middle" font-family="monospace">${p.s}</text>`).join('\n')}
</svg></div>`;
}

render();
