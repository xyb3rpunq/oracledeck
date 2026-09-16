// site.js — perilaku bersama di semua halaman ORACLEDECK. Nol dependensi.
//   1. tema terang/gelap (pilihan disimpan)
//   2. pencarian cepat Ctrl+K atau "/" atas indeks yang dibangun build
//   3. laci Terminal SQL: tombol "Jalankan" pada setiap blok SQL yang bisa dieksekusi
//   4. catatan istilah: definisi glosarium muncul saat istilah disorot atau difokus
//   5. kemajuan belajar: halaman materi/lab yang sudah dibuka ditandai

const AKAR = new URL('./', import.meta.url);
const simpan = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* mode privat */ } };
const baca = (k, b) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : b; } catch { return b; } };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ------------------------------------------------------------------ 1. tema

function pasangTema() {
  const tombol = document.querySelector('[data-tema-toggle]');
  if (!tombol) return;
  const terapkan = (t) => {
    document.documentElement.dataset.tema = t;
    tombol.setAttribute('aria-label', t === 'terang' ? 'Ganti ke tema gelap' : 'Ganti ke tema terang');
    tombol.textContent = t === 'terang' ? '☾' : '☀';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = t === 'terang' ? '#f7f8fa' : '#0b0e13';
  };
  terapkan(document.documentElement.dataset.tema === 'terang' ? 'terang' : 'gelap');
  tombol.addEventListener('click', () => {
    const baru = document.documentElement.dataset.tema === 'terang' ? 'gelap' : 'terang';
    terapkan(baru);
    simpan('oracledeck-tema', baru);
  });
}

// ------------------------------------------------------------------ 2. pencarian

let indeks = null;
async function muatIndeks() {
  if (indeks) return indeks;
  const r = await fetch(new URL(`cari.json${import.meta.url.includes('?v=') ? `?${import.meta.url.split('?')[1]}` : ''}`, AKAR));
  indeks = await r.json();
  return indeks;
}

const normal = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function skorCari(entri, kata) {
  const judul = normal(entri.j);
  const isi = normal(`${entri.k || ''} ${entri.t || ''}`);
  let skor = 0;
  for (const k of kata) {
    if (judul === k) skor += 40;
    else if (judul.startsWith(k)) skor += 25;
    else if (judul.includes(k)) skor += 15;
    else if (isi.includes(k)) skor += 4;
    else return 0;
  }
  return skor + (entri.b || 0);
}

function pasangCari() {
  const dialog = document.createElement('div');
  dialog.className = 'cari-lapis';
  dialog.hidden = true;
  dialog.innerHTML = `<div class="cari-kotak" role="dialog" aria-modal="true" aria-label="Pencarian situs">
  <input type="search" placeholder="Cari materi, lab, istilah, contoh SQL, soal…" aria-label="Kata kunci" autocomplete="off">
  <ul class="cari-hasil" role="listbox"></ul>
  <div class="cari-kaki"><kbd>↑</kbd><kbd>↓</kbd> pilih · <kbd>Enter</kbd> buka · <kbd>Esc</kbd> tutup</div>
</div>`;
  document.body.appendChild(dialog);
  const input = dialog.querySelector('input');
  const ul = dialog.querySelector('ul');
  let hasil = [];
  let pilih = 0;
  let pemicu = null;

  const gambar = () => {
    ul.innerHTML = hasil.length
      ? hasil.map((h, i) => `<li role="option" aria-selected="${i === pilih}" data-i="${i}"><span class="jenis">${esc(h.g)}</span><b>${esc(h.j)}</b>${h.k ? `<small>${esc(h.k)}</small>` : ''}</li>`).join('')
      : `<li class="kosong">${input.value.trim() ? 'Tidak ada yang cocok.' : 'Ketik untuk mencari.'}</li>`;
  };
  const cari = async () => {
    const data = await muatIndeks();
    const kata = normal(input.value).split(/\s+/).filter(Boolean);
    hasil = kata.length ? data.map((e) => ({ ...e, s: skorCari(e, kata) })).filter((e) => e.s > 0).sort((a, b) => b.s - a.s).slice(0, 12) : [];
    pilih = 0;
    gambar();
  };
  const buka = (h) => {
    if (!h) return;
    if (h.sql) { tutup(); bukaTerminal(h.sql, h.db); return; }
    location.href = new URL(h.u, AKAR).href;
  };
  const tutup = () => { dialog.hidden = true; if (pemicu) pemicu.focus(); };
  const bukaDialog = () => {
    pemicu = document.activeElement;
    dialog.hidden = false;
    input.value = '';
    hasil = [];
    gambar();
    input.focus();
    muatIndeks().catch(() => { ul.innerHTML = '<li class="kosong">Indeks pencarian gagal dimuat.</li>'; });
  };

  input.addEventListener('input', cari);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!hasil.length) return;
      pilih = (pilih + (e.key === 'ArrowDown' ? 1 : -1) + hasil.length) % hasil.length;
      gambar();
    } else if (e.key === 'Enter') { e.preventDefault(); buka(hasil[pilih]); } else if (e.key === 'Escape') tutup();
  });
  ul.addEventListener('click', (e) => { const li = e.target.closest('[data-i]'); if (li) buka(hasil[Number(li.dataset.i)]); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) tutup(); });
  document.querySelectorAll('[data-cari-buka]').forEach((b) => b.addEventListener('click', bukaDialog));
  document.addEventListener('keydown', (e) => {
    const mengetik = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); bukaDialog(); } else if (e.key === '/' && !mengetik) { e.preventDefault(); bukaDialog(); }
  });
}

// ------------------------------------------------------------------ 3. laci terminal

let laci = null;
let terminalLaci = null;
let siapLaci = null;
const versi = () => (import.meta.url.includes('?v=') ? `?${import.meta.url.split('?')[1]}` : '');

async function bukaTerminal(sql = '', db = null) {
  const halaman = window.__oracledeckTerminal;
  if (halaman) {
    halaman.muat(sql, { preset: db });
    document.getElementById('terminal-utama')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (!siapLaci) siapLaci = buatLaci();
  await siapLaci;
  laci.hidden = false;
  document.body.classList.add('laci-buka');
  if (sql) terminalLaci.muat(sql, { preset: db });
  else terminalLaci.fokus();
}

async function buatLaci() {
  laci = document.createElement('section');
    laci.className = 'laci-terminal';
    laci.setAttribute('aria-label', 'Terminal SQL');
    laci.innerHTML = `<header><b>Terminal SQL</b><span class="kecil">sesi pribadi di peramban ini</span><a href="${new URL('lab/sql.html', AKAR).href}" class="kecil">halaman penuh ↗</a><button type="button" class="hantu kecil" data-tutup aria-label="Tutup terminal">tutup ✕</button></header><div class="laci-isi"><p class="kosong">Memuat mesin SQL…</p></div>`;
    document.body.appendChild(laci);
    laci.querySelector('[data-tutup]').addEventListener('click', () => { laci.hidden = true; document.body.classList.remove('laci-buka'); });
  const { pasangTerminal } = await import(new URL(`lab/js/terminal-ui.js${versi()}`, AKAR).href);
  terminalLaci = pasangTerminal(laci.querySelector('.laci-isi'), { ringkas: true });
}

let mesinTerminal = null;
const antreCalon = new Set();
let calonDijadwalkan = false;

/** SQL buatan lab diperiksa di latar: tombol hanya muncul bila ada preset yang menjalankannya tanpa galat. */
function periksaCalon() {
  calonDijadwalkan = false;
  const kerjakan = async (tenggat) => {
    if (!mesinTerminal) {
      mesinTerminal = await import(new URL(`engine/core/terminal.js${import.meta.url.includes('?v=') ? `?${import.meta.url.split('?')[1]}` : ''}`, AKAR).href);
    }
    for (const pre of [...antreCalon]) {
      if (tenggat && tenggat.timeRemaining() < 4) break;
      antreCalon.delete(pre);
      if (!pre.isConnected || pre.dataset.sql) continue;
      const sql = pre.dataset.sqlCalon;
      for (const p of ['rumahsakit', 'akademik', 'terdistribusi', 'dreamhome', 'kependudukan', 'kosong']) {
        try {
          const blok = mesinTerminal.jalankan(mesinTerminal.buatSesi(p), sql).blok;
          if (blok.length && !blok.some((b) => b.jenis === 'galat')) { pre.dataset.sql = sql; pre.dataset.db = p; break; }
        } catch { /* coba preset berikutnya */ }
      }
    }
    pasangTombolPada(document);
    if (antreCalon.size) jadwalkanCalon();
  };
  const idle = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 50 }), 30));
  idle((t) => { kerjakan(t).catch((e) => console.error('site.js: pemeriksaan SQL gagal', e)); });
}
function jadwalkanCalon() { if (!calonDijadwalkan) { calonDijadwalkan = true; periksaCalon(); } }

function kumpulkanCalon(akar) {
  akar.querySelectorAll?.('pre[data-sql-calon]:not([data-sql])').forEach((pre) => { if (pre.dataset.sqlCalon.length < 4000) antreCalon.add(pre); });
  if (antreCalon.size) jadwalkanCalon();
}

function pasangTombolPada(akar) {
  akar.querySelectorAll('pre[data-sql]').forEach((pre) => {
    if (pre.querySelector('.jalan-sql')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'jalan-sql kecil';
    b.textContent = '▶ Jalankan';
    b.title = `Jalankan di Terminal SQL (basis data: ${pre.dataset.db})`;
    b.dataset.terminalSql = pre.dataset.sql;
    b.dataset.terminalDb = pre.dataset.db;
    pre.appendChild(b);
  });
}

function pasangTombolJalankan() {
  pasangTombolPada(document);
  kumpulkanCalon(document);
  const lab = document.getElementById('lab');
  if (lab) new MutationObserver(() => kumpulkanCalon(lab)).observe(lab, { childList: true, subtree: true });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-terminal-sql]');
    if (t) { e.preventDefault(); bukaTerminal(t.dataset.terminalSql, t.dataset.terminalDb || null); }
    const buka = e.target.closest('[data-terminal-buka]');
    if (buka) { e.preventDefault(); bukaTerminal(); }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === '`') { e.preventDefault(); if (laci && !laci.hidden) { laci.hidden = true; document.body.classList.remove('laci-buka'); } else bukaTerminal(); }
  });
}

// ------------------------------------------------------------------ 4. catatan istilah

function pasangIstilah() {
  let pop = null;
  let aktif = null;
  const tutup = () => { if (pop) pop.hidden = true; if (aktif) aktif.setAttribute('aria-expanded', 'false'); aktif = null; };
  const tampil = (el) => {
    if (!pop) {
      pop = document.createElement('div');
      pop.className = 'istilah-pop';
      pop.setAttribute('role', 'tooltip');
      pop.id = 'istilah-pop';
      document.body.appendChild(pop);
    }
    aktif = el;
    el.setAttribute('aria-expanded', 'true');
    el.setAttribute('aria-describedby', 'istilah-pop');
    const d = el.dataset;
    pop.innerHTML = `<b>${esc(d.istilah)}</b>${d.en ? ` <i>(${esc(d.en)})</i>` : ''}<p>${esc(d.arti)}</p>${d.detail ? `<p class="detail">${esc(d.detail)}</p>` : ''}${d.contoh ? `<p class="contoh"><span>Contoh:</span> ${esc(d.contoh)}</p>` : ''}<p class="tautan-istilah"><a href="${new URL(`glosarium.html#${d.g}`, AKAR).href}">glosarium →</a>${d.lab ? ` · <a href="${new URL(`lab/${d.lab}.html`, AKAR).href}">coba di Lab ${esc(d.labJudul || d.lab)} →</a>` : ''}</p>`;
    pop.hidden = false;
    const r = el.getBoundingClientRect();
    const lebar = Math.min(360, window.innerWidth - 24);
    pop.style.width = `${lebar}px`;
    pop.style.left = `${Math.max(12, Math.min(window.innerWidth - lebar - 12, r.left + window.scrollX))}px`;
    const bawah = r.bottom + window.scrollY + 8;
    pop.style.top = `${bawah}px`;
    const tinggi = pop.offsetHeight;
    if (r.bottom + tinggi + 16 > window.innerHeight && r.top > tinggi + 16) pop.style.top = `${r.top + window.scrollY - tinggi - 8}px`;
  };
  document.querySelectorAll('.istilah').forEach((el) => {
    el.addEventListener('mouseenter', () => tampil(el));
    el.addEventListener('focus', () => tampil(el));
    el.addEventListener('click', (e) => { e.preventDefault(); if (aktif === el) tutup(); else tampil(el); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') tutup(); });
  });
  document.addEventListener('mouseover', (e) => {
    if (!aktif) return;
    if (e.target.closest('.istilah') || e.target.closest('.istilah-pop')) return;
    tutup();
  });
  document.addEventListener('focusin', (e) => { if (aktif && !e.target.closest('.istilah') && !e.target.closest('.istilah-pop')) tutup(); });
  window.addEventListener('scroll', () => { if (aktif) tampil(aktif); }, { passive: true });
}

// ------------------------------------------------------------------ 5. kemajuan

function pasangKemajuan() {
  const KUNCI = 'oracledeck-dikunjungi-v1';
  const dikunjungi = new Set(baca(KUNCI, []));
  const halaman = document.body.dataset.halaman;
  if (halaman) { dikunjungi.add(halaman); simpan(KUNCI, [...dikunjungi]); }
  document.querySelectorAll('[data-kunci-halaman]').forEach((el) => {
    if (dikunjungi.has(el.dataset.kunciHalaman)) el.classList.add('sudah');
  });
  document.querySelectorAll('[data-kemajuan]').forEach((el) => {
    const semua = el.dataset.kemajuan.split(',');
    const selesai = semua.filter((k) => dikunjungi.has(k)).length;
    const pct = semua.length ? Math.round((selesai / semua.length) * 100) : 0;
    el.querySelector('[data-kemajuan-teks]').textContent = `${selesai} dari ${semua.length} halaman materi & lab sudah dibuka (${pct}%)`;
    el.querySelector('[data-kemajuan-bar]').style.width = `${pct}%`;
    const lanjut = el.querySelector('[data-kemajuan-lanjut]');
    const berikut = semua.find((k) => !dikunjungi.has(k));
    if (lanjut && berikut) {
      const a = document.querySelector(`[data-kunci-halaman="${berikut}"]`);
      if (a && a.getAttribute('href')) { lanjut.href = a.getAttribute('href'); lanjut.textContent = `Lanjutkan: ${a.dataset.judul || berikut} →`; lanjut.hidden = false; }
    }
  });
}

// ------------------------------------------------------------------ mulai

function pasangLuring() {
  if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', AKAR).href, { scope: AKAR.pathname }).catch(() => { /* luring tidak wajib */ });
  });
}

function mulai() {
  const langkah = [pasangTema, pasangCari, pasangTombolJalankan, pasangIstilah, pasangKemajuan, pasangLuring];
  for (const f of langkah) {
    try { f(); } catch (e) { console.error(`site.js: ${f.name} gagal`, e); }
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai);
  else mulai();
}
