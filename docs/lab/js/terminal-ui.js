// terminal-ui.js — antarmuka Terminal SQL Live. Dipakai halaman Lab Terminal SQL dan
// laci terminal yang bisa dibuka dari halaman mana pun (tombol "Jalankan" di blok SQL).
//
// Mesin sesinya engine/core/terminal.js; berkas ini hanya menggambar dan menangani input.
// Prinsip: setiap ketikan langsung memicu pratinjau baca-saja (ketikan beruntun digabung),
// perintah pengubah data baru dijalankan saat Enter/Ctrl+Enter.

import * as T from '../../engine/core/terminal.js?v=849b085103';
import { planToText as T_planText } from '../../engine/core/sql.js?v=849b085103';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const KATA = /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|JOIN|LEFT|RIGHT|FULL|INNER|OUTER|CROSS|ON|AS|AND|OR|NOT|IN|IS|NULL|BETWEEN|LIKE|UNION|ALL|INTERSECT|MINUS|EXCEPT|EXISTS|DISTINCT|LIMIT|OFFSET|FETCH|FIRST|NEXT|ROWS|ONLY|CASE|WHEN|THEN|ELSE|END|WITH|CREATE|OR REPLACE|TABLE|VIEW|INDEX|UNIQUE|PRIMARY|KEY|FOREIGN|REFERENCES|CONSTRAINT|CHECK|DEFAULT|INSERT|INTO|VALUES|UPDATE|SET|DELETE|DROP|TRUNCATE|CASCADE|CONSTRAINTS|COMMIT|ROLLBACK|SAVEPOINT|TO|FORCE|DESC|DESCRIBE|EXPLAIN|PLAN|FOR|NUMBER|VARCHAR2|CHAR|DATE|INTEGER)\b/gi;

/** Sorot sintaks SQL menjadi HTML (tanpa pembungkus). */
export function sorotSql(teks) {
  return esc(teks).split('\n').map((b) => {
    const i = b.indexOf('--');
    let kode = i >= 0 ? b.slice(0, i) : b;
    const kom = i >= 0 ? b.slice(i) : '';
    kode = kode
      .replace(/'([^']*)'/g, '\u0001$1\u0002')
      .replace(KATA, (m) => `\u0003${m}\u0004`)
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '\u0005$1\u0006')
      .replace(/\b(COUNT|SUM|AVG|MIN|MAX|UPPER|LOWER|LENGTH|SUBSTR|ROUND|COALESCE|NVL|DECODE|TO_CHAR|TRUNC|INITCAP|LPAD|RPAD|INSTR|REPLACE|MOD|GREATEST|LEAST)\b/gi, '\u0007$1\u0008')
      .replace(/\u0001([^\u0002]*)\u0002/g, '<span class="sql-s">\'$1\'</span>')
      .replace(/\u0003([^\u0004]*)\u0004/g, '<span class="sql-k">$1</span>')
      .replace(/\u0005([^\u0006]*)\u0006/g, '<span class="sql-n">$1</span>')
      .replace(/\u0007([^\u0008]*)\u0008/g, '<span class="sql-f">$1</span>');
    return kode + (kom ? `<span class="sql-c">${kom}</span>` : '');
  }).join('\n');
}

function tabelHtml(rel, maks = 200) {
  if (!rel) return '';
  if (rel.cardinality === 0) return `<div class="term-kosong">(0 baris) kolom: ${esc(rel.attrs.join(', '))}</div>`;
  const numerik = rel.attrs.map((_, i) => rel.rows.every((r) => r[i] === null || typeof r[i] === 'number'));
  const baris = rel.rows.slice(0, maks);
  return `<div class="term-tabel"><table>
<thead><tr>${rel.attrs.map((a, i) => `<th${numerik[i] ? ' class="num"' : ''}>${esc(a)}</th>`).join('')}</tr></thead>
<tbody>${baris.map((r) => `<tr>${r.map((c, i) => `<td${numerik[i] ? ' class="num"' : ''}>${c === null ? '<i class="null">NULL</i>' : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
</table></div>${rel.cardinality > maks ? `<div class="term-meta">menampilkan ${maks} dari ${rel.cardinality} baris</div>` : ''}`;
}

function aksesHtml(akses) {
  if (!akses || !akses.situs.length) return '';
  return `<div class="term-akses">${akses.situs.map((s) => `<span class="situs ${s.lokal ? 'lokal' : 'remote'}" title="${esc(s.tabel.join(', '))}">${s.lokal ? '●' : '⇄'} ${esc(s.situs)} · ${s.baris} baris ${s.lokal ? 'lokal' : 'via DB link'}</span>`).join('')}${akses.remote ? `<span class="term-meta">${akses.barisRemote} baris dibaca dari ${akses.remote} situs remote</span>` : ''}</div>`;
}

const fmtMs = (ms) => (ms === undefined ? '' : ms < 1 ? `${ms.toFixed(2)} ms` : `${ms.toFixed(1)} ms`);

function blokHtml(b, prompt) {
  const gema = b.perintah ? `<div class="term-gema" data-ulang="${esc(b.perintah)}" title="Klik untuk menyalin ke editor"><span class="prompt">${esc(prompt)}</span> <code>${sorotSql(b.perintah)}</code></div>` : '';
  switch (b.jenis) {
    case 'hasil':
      return `${gema}${tabelHtml(b.relation)}<div class="term-meta">${b.relation.cardinality} baris · ${b.relation.degree} kolom · ${fmtMs(b.ms)}</div>${aksesHtml(b.akses)}${b.plan ? `<details class="term-rencana"><summary>rencana eksekusi</summary><pre>${esc(T_planText(b.plan))}</pre></details>` : ''}`;
    case 'rencana':
      return `${gema}<pre class="term-pre">${esc(b.teks)}</pre>${aksesHtml(b.akses)}${(b.detail || []).map((d) => `<div class="term-meta">${esc(d)}</div>`).join('')}`;
    case 'ok':
      return `${gema}<div class="term-ok">${esc(b.pesan)}${b.ms !== undefined ? ` <span class="term-meta">${fmtMs(b.ms)}</span>` : ''}</div>${(b.detail || []).map((d) => `<div class="term-detail${/^PERINGATAN/.test(d) ? ' warn' : ''}">${esc(d)}</div>`).join('')}`;
    case 'galat':
      return `${gema}<div class="term-galat">${esc(b.pesan)}</div>${(b.petunjuk || []).map((p) => `<div class="term-petunjuk">→ ${esc(p)}</div>`).join('')}`;
    case 'tabel':
      return `${gema}<div class="term-judul">${esc(b.judul)}</div>${tabelHtml(b.relation)}${(b.detail || []).map((d) => `<div class="term-detail">${esc(d)}</div>`).join('')}`;
    case 'teks':
      return `${gema}<div class="term-judul">${esc(b.judul)} <button type="button" class="hantu kecil" data-salin>salin</button></div><pre class="term-pre" data-isi>${esc(b.isi)}</pre>`;
    case '2pc':
      return `${gema}<div class="term-judul">Two-Phase Commit · transaksi ${esc(b.id)} · peserta ${esc(b.peserta.join(', '))} · <b class="${b.keputusan === 'GLOBAL-COMMIT' ? 'ok' : 'gagal'}">${esc(b.memblokir ? 'TERBLOKIR' : b.keputusan)}</b></div>
<div class="term-jejak">${b.jejak.map((l) => `<div><span class="t">t${String(l.t).padStart(2, '0')} f${l.fase}</span> ${esc(l.dari)} → ${esc(l.ke)}: <b>${esc(l.pesan)}</b>${l.keterangan ? ` <i>${esc(l.keterangan)}</i>` : ''}</div>`).join('')}</div>${(b.analisis || []).map((a) => `<div class="term-detail">${esc(a)}</div>`).join('')}`;
    default:
      return `${gema}<div class="term-detail">${esc(JSON.stringify(b))}</div>`;
  }
}

const KUNCI_RIWAYAT = 'oracledeck-terminal-riwayat-v1';
const KUNCI_PRESET = 'oracledeck-terminal-preset-v1';

function baca(kunci, bawaan) {
  try { const v = localStorage.getItem(kunci); return v ? JSON.parse(v) : bawaan; } catch { return bawaan; }
}
function simpan(kunci, nilai) {
  try { localStorage.setItem(kunci, JSON.stringify(nilai)); } catch { /* penyimpanan tidak tersedia */ }
}

/**
 * Pasang terminal ke sebuah wadah.
 * @param {HTMLElement} wadah
 * @param {{preset?:string, sql?:string, jalankan?:boolean, ringkas?:boolean}} opsi
 */
export function pasangTerminal(wadah, opsi = {}) {
  let sesi = T.buatSesi(opsi.preset || baca(KUNCI_PRESET, 'rumahsakit'));
  let riwayat = baca(KUNCI_RIWAYAT, []);
  let posRiwayat = riwayat.length;
  let draf = '';
  let saran = { kandidat: [], dipilih: 0 };
  let pratinjauAktif = true;
  let jadwal = 0;

  wadah.classList.add('terminal');
  wadah.innerHTML = `
<div class="term-bar">
  <label class="term-pilih">basis data
    <select data-r="preset">${Object.entries(T.PRESET).map(([k, p]) => `<option value="${k}">${esc(p.judul)}</option>`).join('')}</select>
  </label>
  <label class="term-pilih" data-r="situs-bungkus" hidden>situs lokal
    <select data-r="situs"></select>
  </label>
  <span class="term-status" data-r="status" aria-live="polite"></span>
  <span class="term-spasi"></span>
  <label class="term-toggle"><input type="checkbox" data-r="pratinjau" checked> pratinjau langsung</label>
  <button type="button" class="hantu kecil" data-aksi="\\d" title="Daftar tabel dan view">\\d objek</button>
  <button type="button" class="hantu kecil" data-aksi="\\?" title="Semua perintah">bantuan</button>
  <button type="button" class="hantu kecil" data-aksi="\\ekspor" title="Skrip SQL Oracle dari sesi ini">ekspor</button>
  <button type="button" class="hantu kecil" data-aksi="\\reset" title="Kembalikan data awal">reset</button>
  <button type="button" class="hantu kecil" data-r="bersih" title="Bersihkan layar">bersihkan</button>
</div>
<div class="term-log" data-r="log" role="log" aria-label="Keluaran terminal" tabindex="0"></div>
<div class="term-editor">
  <span class="prompt" data-r="prompt"></span>
  <div class="term-input-bungkus">
    <textarea data-r="input" rows="${opsi.ringkas ? 3 : 4}" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Perintah SQL" placeholder="Ketik SQL lalu Enter (akhiri dengan ;) atau Ctrl+Enter. Tab = lengkapi nama. ↑/↓ = riwayat. \\? = bantuan"></textarea>
    <ul class="term-saran" data-r="saran" role="listbox" hidden></ul>
  </div>
  <button type="button" data-r="jalan" title="Ctrl+Enter">Jalankan</button>
</div>
<div class="term-pratinjau" data-r="pratinjau-isi" aria-live="polite"></div>`;

  const r = (n) => wadah.querySelector(`[data-r="${n}"]`);
  const input = r('input');
  const log = r('log');

  const perbaruiStatus = () => {
    r('preset').value = sesi.preset;
    r('prompt').textContent = T.promptSesi(sesi);
    const st = T.statusTransaksi(sesi);
    const bagian = [];
    if (st.tertunda) bagian.push(`<span class="warn">${st.tertunda} perubahan belum COMMIT</span>`);
    if (st.savepoint.length) bagian.push(`savepoint: ${esc(st.savepoint.join(', '))}`);
    if (st.situsTertulis.length) bagian.push(`ditulis di: ${esc(st.situsTertulis.join(', '))}`);
    if (st.ragu) bagian.push(`<span class="gagal">transaksi ragu-ragu ${esc(st.ragu.id)}</span>`);
    if (st.gagal) bagian.push(`<span class="gagal">injeksi: ${esc(st.gagal.koordinator ? 'koordinator jatuh' : `${st.gagal.situs} ABORT`)}</span>`);
    r('status').innerHTML = bagian.join(' · ') || '<span class="ok">bersih — tidak ada perubahan tertunda</span>';
    const sb = r('situs-bungkus');
    if (sesi.situs) {
      sb.hidden = false;
      r('situs').innerHTML = sesi.situs.map((s) => `<option value="${s}"${s === sesi.lokal ? ' selected' : ''}>${s}</option>`).join('');
    } else sb.hidden = true;
  };

  const tambahLog = (html) => {
    const d = document.createElement('div');
    d.className = 'term-blok';
    d.innerHTML = html;
    log.appendChild(d);
    while (log.children.length > 150) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  };

  const sambutan = () => {
    const p = T.PRESET[sesi.preset];
    tambahLog(`<div class="term-sambut"><b>ORACLEDECK SQL</b> · ${esc(p.judul)}<br><span>${esc(p.ringkas)}</span><br><span>Sesi ini salinan pribadi di peramban Anda: ubah, hapus, buat tabel sebebasnya — <code>\\reset</code> mengembalikan data awal. Autocommit MATI seperti Oracle.</span></div>`);
  };

  const jalankan = (teks, { dariEditor = true } = {}) => {
    const sql = String(teks ?? '').trim();
    if (!sql) return;
    if (dariEditor) {
      if (riwayat[riwayat.length - 1] !== sql) riwayat.push(sql);
      riwayat = riwayat.slice(-100);
      simpan(KUNCI_RIWAYAT, riwayat);
      posRiwayat = riwayat.length;
    }
    const prompt = T.promptSesi(sesi);
    const hasil = T.jalankan(sesi, sql);
    if (hasil.sesi !== sesi) {
      sesi = hasil.sesi;
      simpan(KUNCI_PRESET, sesi.preset);
    }
    for (const b of hasil.blok) {
      if (b.jenis === 'bersihkan') { log.innerHTML = ''; continue; }
      tambahLog(blokHtml(b, prompt));
    }
    perbaruiStatus();
    if (dariEditor) { input.value = ''; tutupSaran(); r('pratinjau-isi').innerHTML = ''; }
  };

  // ------------------------------------------------------------- pratinjau langsung
  const gambarPratinjau = () => {
    jadwal = 0;
    const w = r('pratinjau-isi');
    if (!pratinjauAktif) { w.innerHTML = ''; return; }
    const p = T.pratinjau(sesi, input.value);
    if (!p) { w.innerHTML = ''; return; }
    if (p.jenis === 'hasil') {
      w.innerHTML = `<div class="term-meta"><b>pratinjau</b> · ${p.relation.cardinality} baris · ${fmtMs(p.ms)} · belum dijalankan</div>${tabelHtml(p.relation, 8)}${aksesHtml(p.akses)}`;
    } else if (p.jenis === 'info') {
      w.innerHTML = `<div class="term-meta">${esc(p.pesan)}</div>`;
    } else {
      w.innerHTML = `<div class="term-galat lunak">${esc(p.pesan)}</div>${(p.petunjuk || []).map((x) => `<div class="term-petunjuk">→ ${esc(x)}</div>`).join('')}`;
    }
  };
  // digabung per putaran event loop: ketikan beruntun hanya memicu satu evaluasi, dan tetap
  // berjalan walau peramban tidak sedang menggambar frame (tab di latar, panel tersembunyi)
  const jadwalkanPratinjau = () => { if (!jadwal) jadwal = setTimeout(gambarPratinjau, 0); };

  // ------------------------------------------------------------- pelengkap otomatis
  const tutupSaran = () => { saran = { kandidat: [], dipilih: 0 }; r('saran').hidden = true; };
  const tampilSaran = () => {
    const s = T.saranLengkap(sesi, input.value, input.selectionStart);
    if (!s.awalan || !s.kandidat.length) { tutupSaran(); return; }
    saran = { ...s, dipilih: 0 };
    const ul = r('saran');
    ul.innerHTML = s.kandidat.map((k, i) => `<li role="option" data-i="${i}" aria-selected="${i === 0}">${esc(k)}</li>`).join('');
    ul.hidden = false;
  };
  const terimaSaran = (i = saran.dipilih) => {
    const k = saran.kandidat[i];
    if (!k) return;
    input.setRangeText(k, saran.awal, saran.akhir, 'end');
    tutupSaran();
    jadwalkanPratinjau();
  };
  const geserSaran = (d) => {
    saran.dipilih = (saran.dipilih + d + saran.kandidat.length) % saran.kandidat.length;
    [...r('saran').children].forEach((li, i) => li.setAttribute('aria-selected', String(i === saran.dipilih)));
  };

  // ------------------------------------------------------------- kejadian
  input.addEventListener('input', () => { jadwalkanPratinjau(); tampilSaran(); });
  input.addEventListener('keydown', (e) => {
    const adaSaran = !r('saran').hidden && saran.kandidat.length;
    if (adaSaran && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); geserSaran(e.key === 'ArrowDown' ? 1 : -1); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (adaSaran) terimaSaran();
      else input.setRangeText('  ', input.selectionStart, input.selectionEnd, 'end');
      return;
    }
    if (e.key === 'Escape') { tutupSaran(); return; }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); jalankan(input.value); return; }
    if (e.key === 'Enter' && adaSaran && !e.shiftKey) { e.preventDefault(); terimaSaran(); return; }
    if (e.key === 'Enter' && !e.shiftKey) {
      const v = input.value.trim();
      if (v.endsWith(';') || (/^\\/.test(v) && !v.includes('\n'))) { e.preventDefault(); jalankan(input.value); }
      return;
    }
    const diAwal = input.selectionStart === 0 || !input.value.slice(0, input.selectionStart).includes('\n');
    const diAkhir = !input.value.slice(input.selectionEnd).includes('\n');
    if (e.key === 'ArrowUp' && diAwal && riwayat.length) {
      e.preventDefault();
      if (posRiwayat === riwayat.length) draf = input.value;
      posRiwayat = Math.max(0, posRiwayat - 1);
      input.value = riwayat[posRiwayat];
      jadwalkanPratinjau();
    } else if (e.key === 'ArrowDown' && diAkhir && posRiwayat < riwayat.length) {
      e.preventDefault();
      posRiwayat += 1;
      input.value = posRiwayat === riwayat.length ? draf : riwayat[posRiwayat];
      jadwalkanPratinjau();
    }
  });
  input.addEventListener('blur', () => setTimeout(tutupSaran, 150));
  r('saran').addEventListener('mousedown', (e) => {
    const li = e.target.closest('li');
    if (li) { e.preventDefault(); terimaSaran(Number(li.dataset.i)); input.focus(); }
  });
  r('jalan').addEventListener('click', () => { jalankan(input.value); input.focus(); });
  r('bersih').addEventListener('click', () => { log.innerHTML = ''; input.focus(); });
  r('pratinjau').addEventListener('change', (e) => { pratinjauAktif = e.target.checked; gambarPratinjau(); });
  r('preset').addEventListener('change', (e) => { jalankan(`\\db ${e.target.value}`, { dariEditor: false }); jadwalkanPratinjau(); });
  r('situs').addEventListener('change', (e) => { jalankan(`\\c ${e.target.value}`, { dariEditor: false }); jadwalkanPratinjau(); });
  wadah.querySelectorAll('[data-aksi]').forEach((b) => b.addEventListener('click', () => jalankan(b.dataset.aksi, { dariEditor: false })));
  log.addEventListener('click', (e) => {
    const g = e.target.closest('[data-ulang]');
    if (g) { input.value = g.dataset.ulang; input.focus(); jadwalkanPratinjau(); return; }
    const salin = e.target.closest('[data-salin]');
    if (salin) {
      const isi = salin.closest('.term-blok').querySelector('[data-isi]').textContent;
      navigator.clipboard?.writeText(isi).then(() => { salin.textContent = 'tersalin'; }, () => { salin.textContent = 'gagal menyalin'; });
    }
  });

  perbaruiStatus();
  sambutan();

  const api = {
    /** Muat SQL ke editor; opsional pindah preset dan langsung jalankan. */
    muat(sql, { preset = null, jalankan: langsung = true } = {}) {
      if (preset && preset !== sesi.preset && T.PRESET[preset]) jalankan(`\\db ${preset}`, { dariEditor: false });
      input.value = sql;
      if (langsung) jalankan(sql);
      else jadwalkanPratinjau();
      input.focus({ preventScroll: true });
    },
    fokus() { input.focus(); },
    get sesi() { return sesi; },
  };
  if (opsi.sql) api.muat(opsi.sql, { preset: opsi.preset, jalankan: opsi.jalankan !== false });
  return api;
}
