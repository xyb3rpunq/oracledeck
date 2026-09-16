// Lab 15 — Bank Soal Praktikum, dinilai otomatis.
import { bankSoalDb } from '../../engine/data/datasets.js';
import { gradeQuery } from '../../engine/core/grader.js';
import { BANK_SOAL, JUDUL_PRAKTIKUM } from '../../content/soal.js';
import * as U from './ui.js';

const DB = bankSoalDb();
const KUNCI_SIMPAN = 'oracledeck-bank-soal-v1';

function muat() {
  try { return JSON.parse(localStorage.getItem(KUNCI_SIMPAN) || '{}'); } catch { return {}; }
}
function simpan(d) {
  try { localStorage.setItem(KUNCI_SIMPAN, JSON.stringify(d)); } catch { /* peramban menolak penyimpanan: abaikan */ }
}

const state = { jawaban: muat(), skor: {} };

function render() {
  const praktikum = [...new Set(BANK_SOAL.map((s) => s.praktikum))].sort();
  U.pasang(`
${U.catatan(`${BANK_SOAL.length} soal dari lembar Praktikum 2 sampai 5, termasuk ke-12 soal Praktikum 3 pada dokumen tugas. Penilai menjalankan jawaban Anda dan kunci jawaban, lalu membandingkan <b>hasilnya</b> — bukan teks kuerinya. <code>sem &lt;&gt; 1</code> dan <code>NOT sem = 1</code> sama-sama benar. Jawaban tersimpan di peramban ini saja.`)}

<div class="statbar" id="rekap"></div>

<div class="kontrol" style="margin-top:14px">
  ${U.tombol('nilai-semua', 'Nilai semua jawaban')}
  ${U.tombol('hapus-semua', 'Hapus semua jawaban', 'hantu')}
</div>

<div class="kartu">
  <h3>Skema yang tersedia</h3>
  <p class="kecil mono">matakuliah(kode_kul, nama_kul, sks, sem) · mata_kuliah(sama) · mhs(nim, nama_mhs, alamat_mhs) · nilai(nim, kode_kul, nilai) · pasien · dokter · administrator · pasien_dokter · dokter_admin · daftar</p>
</div>

${praktikum.map((p) => `
<h2>${U.esc(JUDUL_PRAKTIKUM[p])}</h2>
${BANK_SOAL.filter((s) => s.praktikum === p).map((s, i) => `
<div class="kartu soal" data-id="${s.id}">
  <h3>Soal ${i + 1} — ${U.esc(s.judul)} <span class="lencana netral" data-skor="${s.id}">belum dinilai</span></h3>
  <p>${U.esc(s.soal)}</p>
  <textarea rows="3" spellcheck="false" data-jawab="${s.id}" placeholder="Tulis SQL di sini…">${U.esc(state.jawaban[s.id] || '')}</textarea>
  <div class="kontrol" style="margin-top:8px">
    <button type="button" class="kecil" data-nilai="${s.id}">Nilai</button>
    <button type="button" class="kecil hantu" data-petunjuk="${s.id}">Petunjuk</button>
    <button type="button" class="kecil hantu" data-kunci="${s.id}">Lihat kunci</button>
  </div>
  <div data-hasil="${s.id}"></div>
</div>`).join('')}`).join('')}
`);

  U.$$('[data-jawab]').forEach((t) => t.addEventListener('input', () => {
    state.jawaban[t.dataset.jawab] = t.value;
    simpan(state.jawaban);
  }));
  U.$$('[data-jawab]').forEach((t) => t.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); nilai(t.dataset.jawab); }
  }));
  U.$$('[data-nilai]').forEach((b) => b.addEventListener('click', () => nilai(b.dataset.nilai)));
  U.$$('[data-petunjuk]').forEach((b) => b.addEventListener('click', () => {
    const s = BANK_SOAL.find((x) => x.id === b.dataset.petunjuk);
    document.querySelector(`[data-hasil="${s.id}"]`).innerHTML = U.catatan(`<b>Petunjuk:</b> ${U.esc(s.petunjuk)}`, 'info');
  }));
  U.$$('[data-kunci]').forEach((b) => b.addEventListener('click', () => {
    const s = BANK_SOAL.find((x) => x.id === b.dataset.kunci);
    document.querySelector(`[data-hasil="${s.id}"]`).innerHTML = `<h4>Salah satu kunci jawaban</h4>${U.preSql(s.kunci)}<p class="kecil">Kueri lain yang menghasilkan isi sama juga dinilai benar.</p>`;
  }));
  document.getElementById('nilai-semua').addEventListener('click', () => BANK_SOAL.forEach((s) => nilai(s.id)));
  document.getElementById('hapus-semua').addEventListener('click', () => {
    state.jawaban = {}; state.skor = {};
    simpan({});
    U.$$('[data-jawab]').forEach((t) => { t.value = ''; });
    U.$$('[data-hasil]').forEach((h) => { h.innerHTML = ''; });
    U.$$('[data-skor]').forEach((l) => { l.className = 'lencana netral'; l.textContent = 'belum dinilai'; });
    rekap();
  });
  rekap();
}

function nilai(id) {
  const s = BANK_SOAL.find((x) => x.id === id);
  const jawab = state.jawaban[id] || '';
  const r = gradeQuery(jawab, s.kunci, DB);
  state.skor[id] = r.skor;
  const lencana = document.querySelector(`[data-skor="${id}"]`);
  lencana.className = `lencana ${r.benar ? 'ok' : r.skor >= 60 ? 'warn' : 'gagal'}`;
  lencana.textContent = r.benar ? 'benar · 100' : `${r.skor}/100`;
  const wadah = document.querySelector(`[data-hasil="${id}"]`);
  wadah.innerHTML = `
${r.benar ? U.catatan('Hasil kueri Anda identik dengan kunci.', 'baik') : ''}
${r.alasan.length ? `<ul class="kecil">${r.alasan.map((a) => `<li>${U.esc(a)}</li>`).join('')}</ul>` : ''}
${r.petunjuk.length ? U.catatan(r.petunjuk.map(U.esc).join('<br>'), r.galat ? 'bahaya' : 'info') : ''}
${r.hasilJawaban && !r.benar ? `<div class="grid dua">
  <div>${U.tabelRelasi(r.hasilJawaban, { maks: 8, judul: 'Hasil Anda' })}</div>
  <div>${U.tabelRelasi(r.hasilKunci, { maks: 8, judul: 'Hasil yang diharapkan' })}</div>
</div>` : ''}`;
  rekap();
}

function rekap() {
  const dinilai = Object.keys(state.skor).length;
  const benar = Object.values(state.skor).filter((x) => x === 100).length;
  const total = Object.values(state.skor).reduce((a, b) => a + b, 0);
  const terisi = BANK_SOAL.filter((s) => (state.jawaban[s.id] || '').trim()).length;
  document.getElementById('rekap').innerHTML = `
<div class="stat"><b>${BANK_SOAL.length}</b><span>soal</span></div>
<div class="stat"><b>${terisi}</b><span>terjawab</span></div>
<div class="stat"><b>${dinilai}</b><span>dinilai</span></div>
<div class="stat"><b>${benar}</b><span>benar</span></div>
<div class="stat"><b>${dinilai ? Math.round(total / dinilai) : 0}</b><span>rata-rata skor</span></div>`;
}

render();
