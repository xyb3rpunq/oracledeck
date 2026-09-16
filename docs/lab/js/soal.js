// Lab 15 — Bank Soal Praktikum, dinilai otomatis dan langsung saat mengetik.
// Soal kueri dinilai dari HASIL SELECT; soal DML dinilai dari KEADAAN TABEL setelah
// perintah dijalankan pada salinan data (basis data asli tidak pernah berubah).
import { bankSoalDb } from '../../engine/data/datasets.js?v=849b085103';
import { gradeSoal } from '../../engine/core/grader.js?v=849b085103';
import { BANK_SOAL, JUDUL_PRAKTIKUM } from '../../content/soal.js?v=849b085103';
import * as U from './ui.js?v=849b085103';

const DB = bankSoalDb();
const KUNCI_SIMPAN = 'oracledeck-bank-soal-v1';

function muat() {
  try { return JSON.parse(localStorage.getItem(KUNCI_SIMPAN) || '{}'); } catch { return {}; }
}
function simpan(d) {
  try { localStorage.setItem(KUNCI_SIMPAN, JSON.stringify(d)); } catch { /* peramban menolak penyimpanan: abaikan */ }
}

const state = { jawaban: muat(), skor: {}, jadwal: new Map() };

const presetSoal = (s) => (s.praktikum === 2 ? 'rumahsakit' : 'akademik');

function render() {
  const praktikum = [...new Set(BANK_SOAL.map((s) => s.praktikum))].sort();
  const jumlahDml = BANK_SOAL.filter((s) => s.periksa).length;
  U.pasang(`
${U.catatan(`${BANK_SOAL.length} soal dari lembar Praktikum 2 sampai 5, termasuk ke-12 soal Praktikum 3 pada dokumen tugas dan ${jumlahDml} soal INSERT/UPDATE/DELETE. Jawaban <b>dinilai langsung saat Anda mengetik</b>. Soal kueri dinilai dari <b>hasilnya</b> — <code>sem &lt;&gt; 1</code> dan <code>NOT sem = 1</code> sama-sama benar. Soal DML dinilai dari <b>keadaan tabel sesudah perintah</b>, pada salinan data sehingga bisa dicoba berulang kali. Jawaban tersimpan di peramban ini saja.`)}

<div class="statbar" id="rekap"></div>

<div class="kontrol" style="margin-top:14px">
  ${U.tombol('hapus-semua', 'Hapus semua jawaban', 'hantu')}
  <label class="kecil"><input type="checkbox" id="nilai-langsung" checked> nilai langsung saat mengetik</label>
</div>

<div class="kartu">
  <h3>Skema yang tersedia</h3>
  <p class="kecil mono">matakuliah(kode_kul, nama_kul, sks, sem) · mata_kuliah(sama) · mhs(nim, nama_mhs, alamat_mhs) · nilai(nim, kode_kul, nilai) · pasien(id_pasien, nama_pasien, alamat_pasien, jenis_kelamin, penyakit, no_hp, kota) · dokter(id_dokter, nama_dokter, alamat_dokter, tanggal_lahir, no_hp, spesialis, waktu_kerja, kota) · administrator · pasien_dokter(id, id_dokter, id_pasien, waktu_periksa, resep, biaya) · dokter_admin · daftar</p>
  <p class="kecil">Soal Praktikum 2 memakai kunci asing ON DELETE/UPDATE CASCADE, sama seperti lembar praktikum.</p>
</div>

${praktikum.map((p) => `
<h2>${U.esc(JUDUL_PRAKTIKUM[p])}</h2>
${BANK_SOAL.filter((s) => s.praktikum === p).map((s, i) => `
<div class="kartu soal" data-id="${s.id}">
  <h3>Soal ${i + 1} — ${U.esc(s.judul)} ${s.periksa ? U.lencana('DML', 'info') : ''} <span class="lencana netral" data-skor="${s.id}">belum dinilai</span></h3>
  <p>${U.esc(s.soal)}</p>
  <textarea rows="3" spellcheck="false" data-jawab="${s.id}" aria-label="Jawaban soal ${U.esc(s.judul)}" placeholder="Tulis SQL di sini…">${U.esc(state.jawaban[s.id] || '')}</textarea>
  <div class="kontrol" style="margin-top:8px">
    <button type="button" class="kecil" data-nilai="${s.id}">Nilai sekarang</button>
    <button type="button" class="kecil hantu" data-petunjuk="${s.id}">Petunjuk</button>
    <button type="button" class="kecil hantu" data-kunci="${s.id}">Lihat kunci</button>
    <button type="button" class="kecil hantu" data-coba="${s.id}" data-terminal-sql="" data-terminal-db="${presetSoal(s)}">Coba di terminal</button>
  </div>
  <div data-hasil="${s.id}" aria-live="polite"></div>
</div>`).join('')}`).join('')}
`);

  U.$$('[data-jawab]').forEach((t) => t.addEventListener('input', () => {
    const id = t.dataset.jawab;
    state.jawaban[id] = t.value;
    simpan(state.jawaban);
    if (!document.getElementById('nilai-langsung').checked) return;
    if (state.jadwal.has(id)) return;
    state.jadwal.set(id, setTimeout(() => { state.jadwal.delete(id); nilai(id); }, 0));
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
    document.querySelector(`[data-hasil="${s.id}"]`).innerHTML = `<h4>Salah satu kunci jawaban</h4>${U.preSql(s.kunci)}<p class="kecil">${s.periksa ? 'Perintah lain yang menghasilkan keadaan tabel sama juga dinilai benar.' : 'Kueri lain yang menghasilkan isi sama juga dinilai benar.'}</p>`;
  }));
  // tombol terminal membawa jawaban terkini; site.js yang membuka lacinya
  U.$$('[data-coba]').forEach((b) => b.addEventListener('click', () => {
    const s = BANK_SOAL.find((x) => x.id === b.dataset.coba);
    b.dataset.terminalSql = (state.jawaban[s.id] || '').trim() || (s.periksa ? `${s.periksa};` : '\\d');
  }));
  document.getElementById('hapus-semua').addEventListener('click', () => {
    state.jawaban = {}; state.skor = {};
    simpan({});
    U.$$('[data-jawab]').forEach((t) => { t.value = ''; });
    U.$$('[data-hasil]').forEach((h) => { h.innerHTML = ''; });
    U.$$('[data-skor]').forEach((l) => { l.className = 'lencana netral'; l.textContent = 'belum dinilai'; });
    rekap();
  });
  // jawaban tersimpan dinilai ulang saat halaman dibuka
  BANK_SOAL.filter((s) => (state.jawaban[s.id] || '').trim()).forEach((s) => nilai(s.id));
  rekap();
}

function nilai(id) {
  const s = BANK_SOAL.find((x) => x.id === id);
  const jawab = state.jawaban[id] || '';
  const lencana = document.querySelector(`[data-skor="${id}"]`);
  const wadah = document.querySelector(`[data-hasil="${id}"]`);
  let r;
  try {
    r = gradeSoal(s, jawab, DB);
  } catch (e) {
    wadah.innerHTML = U.catatan(`<b>Penilai gagal:</b> ${U.esc(e.message)}`, 'bahaya');
    return;
  }
  if (!jawab.trim()) {
    delete state.skor[id];
    lencana.className = 'lencana netral';
    lencana.textContent = 'belum dinilai';
    wadah.innerHTML = '';
    rekap();
    return;
  }
  state.skor[id] = r.skor;
  lencana.className = `lencana ${r.benar ? 'ok' : r.skor >= 60 ? 'warn' : 'gagal'}`;
  lencana.textContent = r.benar ? 'benar · 100' : `${r.skor}/100`;
  const label = s.periksa ? ['Keadaan tabel Anda', 'Keadaan yang diharapkan'] : ['Hasil Anda', 'Hasil yang diharapkan'];
  wadah.innerHTML = `
${r.benar ? U.catatan(s.periksa ? `Keadaan tabel setelah perintah Anda identik dengan kunci${r.terdampak !== undefined ? ` (${r.terdampak} baris terdampak langsung)` : ''}.` : 'Hasil kueri Anda identik dengan kunci.', 'baik') : ''}
${r.alasan.length ? `<ul class="kecil">${r.alasan.map((a) => `<li>${U.esc(a)}</li>`).join('')}</ul>` : ''}
${r.petunjuk.length ? U.catatan(r.petunjuk.map(U.esc).join('<br>'), r.galat ? 'bahaya' : 'info') : ''}
${r.hasilJawaban && !r.benar ? `<div class="grid dua">
  <div>${U.tabelRelasi(r.hasilJawaban, { maks: 8, judul: label[0] })}</div>
  <div>${U.tabelRelasi(r.hasilKunci, { maks: 8, judul: label[1] })}</div>
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
<div class="stat"><b>${benar}</b><span>benar</span></div>
<div class="stat"><b>${dinilai ? Math.round(total / dinilai) : 0}</b><span>rata-rata skor</span></div>
<div class="stat"><b>${Math.round((benar / BANK_SOAL.length) * 100)}%</b><span>tuntas</span></div>`;
}

render();
