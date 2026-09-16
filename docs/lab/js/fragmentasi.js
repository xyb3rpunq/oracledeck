// Lab 04 — Perancang Fragmentasi.
import { dreamhome, rumahsakit } from '../../engine/data/datasets.js?v=8e172babd6';
import * as Fg from '../../engine/ddb/fragment.js?v=8e172babd6';
import * as U from './ui.js?v=8e172babd6';

const { STAFF, PROPERTY } = dreamhome();
const { pasien, pasien_dokter } = rumahsakit();

let mode = 'campuran';

function bangunFragmen(m) {
  switch (m) {
    case 'horizontal':
      return {
        induk: STAFF,
        frag: Fg.horizontalByAttribute(STAFF, 'branchno', { prefix: 'STAFF_B' }),
        kunci: 'staffno',
        cerita: 'STAFF dipecah per cabang. Tiap cabang menyimpan datanya sendiri, sehingga kueri "staf cabang B3" cukup menyentuh satu fragmen.',
      };
    case 'vertikal':
      return {
        induk: STAFF,
        frag: Fg.vertical(STAFF, [
          { nama: 'S1', atribut: ['position', 'sex', 'dob', 'salary'] },
          { nama: 'S2', atribut: ['fname', 'lname', 'branchno'] },
        ], 'staffno'),
        kunci: 'staffno',
        cerita: 'Kolom gaji dipisahkan dari kolom identitas. S1 hanya boleh dibaca bagian SDM, S2 dibaca semua orang. Perhatikan <code>staffno</code> ada di kedua fragmen — tanpa itu rekonstruksinya lossy.',
      };
    case 'turunan': {
      const induk = Fg.horizontalByAttribute(STAFF, 'branchno', { prefix: 'STAFF_B' });
      return {
        induk: PROPERTY,
        frag: Fg.derived(PROPERTY, induk, 'branchno'),
        kunci: 'propertyno',
        cerita: 'PROPERTY mengikuti fragmentasi STAFF lewat semijoin. Akibatnya join STAFF ⋈ PROPERTY selalu berpasangan di situs yang sama — tidak ada lalu lintas jaringan.',
        fragInduk: induk,
      };
    }
    case 'rumahsakit':
      return {
        induk: pasien,
        frag: Fg.horizontalByAttribute(pasien, 'kota', { prefix: 'PASIEN_' }),
        kunci: 'id_pasien',
        cerita: 'Skema praktikum rumah sakit difragmentasi per kota. Inilah rancangan yang diterjemahkan menjadi <code>PARTITION BY LIST (KOTA)</code> pada skrip Oracle.',
      };
    case 'rusak':
      return {
        induk: STAFF,
        frag: Fg.horizontal(STAFF, [
          { nama: 'F_TINGGI', predikat: (r) => r.salary >= 12000, teks: 'salary >= 12000' },
          { nama: 'F_SEDANG', predikat: (r) => r.salary >= 9000, teks: 'salary >= 9000' },
        ]),
        kunci: 'staffno',
        cerita: 'Rancangan yang <b>sengaja salah</b>: kedua predikat tumpang tindih, sehingga staf bergaji 12.000 ke atas masuk dua fragmen sekaligus. Perhatikan audit kedisjoinan gagal.',
      };
    case 'campuran-bersih':
      return {
        induk: STAFF,
        frag: Fg.mixed(STAFF, {
          key: 'staffno',
          verticalGroups: [
            { nama: 'S1', atribut: ['position', 'sex', 'dob', 'salary'] },
            { nama: 'S2', atribut: ['fname', 'lname', 'branchno'] },
          ],
          horizontalOn: 'branchno',
          targetFragment: 'S2',
        }),
        kunci: 'staffno',
        cerita: 'Versi yang diperbaiki: <code>sex</code>, <code>DOB</code>, dan <code>salary</code> hanya disimpan di S1. S2 cukup memuat <code>staffno</code>, <code>fname</code>, <code>lname</code>, dan <code>branchno</code>. Ketiga aturan kini lulus, dan tiap pembaruan gaji hanya perlu menyentuh satu fragmen.',
      };
    default: // campuran
      return {
        induk: STAFF,
        frag: Fg.mixed(STAFF, {
          key: 'staffno',
          verticalGroups: [
            { nama: 'S1', atribut: ['position', 'sex', 'dob', 'salary'] },
            { nama: 'S2', atribut: ['fname', 'lname', 'branchno', 'sex', 'dob', 'salary'] },
          ],
          horizontalOn: 'branchno',
          targetFragment: 'S2',
        }),
        kunci: 'staffno',
        cerita: 'Skema persis dari Modul 6 dan Modul 7: STAFF dipecah vertikal menjadi S1 dan S2, lalu S2 dipecah horizontal per cabang menjadi S21 (B3, situs 3), S22 (B5, situs 5), dan S23 (B7, situs 7). <b>Temuan:</b> modul menaruh <code>sex</code>, <code>DOB</code>, dan <code>salary</code> di S1 <i>dan</i> di S2, sehingga aturan kedisjoinan vertikal gagal. Rancangan ini tetap lengkap dan lossless, tetapi setiap perubahan gaji harus ditulis ke dua fragmen di situs yang berbeda — dan bisa tidak sinkron. Bandingkan dengan pilihan <i>Campuran (diperbaiki)</i>.',
      };
  }
}

function render() {
  U.pasang(`
${U.catatan('Fragmentasi bukan sekadar membelah tabel. Ada <b>tiga aturan kebenaran</b> yang wajib dipenuhi, dan lab ini memeriksanya dengan menjalankan operator relasional sungguhan atas data — bukan dengan memeriksa definisi di atas kertas.')}

<div class="kontrol">
  ${U.bidang('Skema fragmentasi', U.pilihan('mode', [
    { nilai: 'campuran', teks: 'Campuran (persis Modul 6)' },
    { nilai: 'campuran-bersih', teks: 'Campuran (diperbaiki)' },
    { nilai: 'horizontal', teks: 'Horizontal primer' },
    { nilai: 'vertikal', teks: 'Vertikal' },
    { nilai: 'turunan', teks: 'Turunan (derived)' },
    { nilai: 'rumahsakit', teks: 'Rumah sakit per kota' },
    { nilai: 'rusak', teks: '⚠ Rancangan cacat' },
  ], mode))}
</div>

<div id="keluaran"></div>
`);
  U.ikatPilihan('mode', (v) => { mode = v; gambar(); });
  gambar();
}

function gambar() {
  const { induk, frag, kunci, cerita, fragInduk } = bangunFragmen(mode);
  const audit = Fg.auditFragmentation(induk, frag, kunci);
  const prog = Fg.reconstructionExpression(induk, frag);
  const struktur = Fg.strukturFragmen(frag).mode;

  const ringkas = Fg.summarize(frag);
  const maksKard = Math.max(...frag.map((f) => f.relasi.cardinality), 1);

  document.getElementById('keluaran').innerHTML = `
${U.catatan(cerita, 'info')}

<h2>Relasi global</h2>
${U.tabelRelasi(induk, { maks: 12 })}

<h2>Definisi fragmen</h2>
${U.tabel(
    ['Fragmen', 'Tipe', 'Definisi aljabar', 'Baris', 'Sebaran'],
    frag.map((f, i) => [
      `<strong>${f.nama}</strong>`,
      U.lencana(f.tipe, f.tipe === 'campuran' ? 'info' : 'netral'),
      `<code>${U.esc(f.aljabar || f.definisi)}</code>`,
      f.relasi.cardinality,
      U.bar(f.relasi.cardinality, maksKard, 'info'),
    ]),
    { kelasNum: [3] },
  )}

<h2>Isi tiap fragmen</h2>
<div class="grid ${frag.length > 2 ? 'dua' : 'dua'}">
${frag.map((f) => `<div class="kartu">${U.tabelRelasi(f.relasi, { maks: 6, judul: f.nama })}</div>`).join('')}
</div>

<h2>Audit tiga aturan kebenaran</h2>
<div class="grid tiga">
  <div class="kartu">
    <h3>1. Kelengkapan ${U.lulusGagal(audit.kelengkapan.lengkap)}</h3>
    <p class="kecil">Setiap ${struktur === 'horizontal' ? 'tupel' : struktur === 'vertikal' ? 'atribut' : 'atribut, dan setiap tupel tiap kelompok horizontal,'} relasi asal harus ada di minimal satu fragmen.</p>
    <p>${U.esc(audit.kelengkapan.pesan)}</p>
  </div>
  <div class="kartu">
    <h3>2. Rekonstruksi ${U.lulusGagal(audit.rekonstruksi.dapatDirekonstruksi)}</h3>
    <p class="kecil">Relasi asal harus dapat dibentuk kembali dari fragmen-fragmennya.</p>
    <p><code>${U.esc(prog)}</code></p>
    <p>${U.esc(audit.rekonstruksi.pesan)}</p>
  </div>
  <div class="kartu">
    <h3>3. Kedisjoinan ${U.lulusGagal(audit.kedisjoinan.disjoint)}</h3>
    <p class="kecil">${struktur === 'horizontal' ? 'Fragmen tidak boleh tumpang tindih.' : struktur === 'vertikal' ? 'Hanya atribut kunci yang boleh berulang.' : 'Dinilai per tingkat: hanya kunci yang boleh berulang antar fragmen vertikal, dan tiap kelompok horizontal tidak boleh tumpang tindih.'}</p>
    <p>${U.esc(audit.kedisjoinan.pesan)}</p>
    ${audit.kedisjoinan.tumpangTindih.length ? `<p class="kecil galat">${U.esc(JSON.stringify(audit.kedisjoinan.tumpangTindih.slice(0, 4)))}</p>` : ''}
  </div>
</div>

${audit.valid
    ? U.catatan('Ketiga aturan terpenuhi. Rancangan ini aman dipakai — kueri atas relasi global selalu bisa dijawab dari fragmen-fragmennya tanpa kehilangan maupun penggandaan data.', 'baik')
    : U.catatan('<b>Rancangan ini belum sah.</b> Fragmentasi yang melanggar salah satu aturan akan menghasilkan jawaban kueri yang salah — baris hilang, baris ganda, atau relasi yang tidak bisa dibentuk kembali.', 'bahaya')}

<h2>Hasil rekonstruksi</h2>
<p class="kecil">Relasi di bawah ini dihitung ulang dari fragmen memakai operator <code>${U.esc(audit.rekonstruksi.operator)}</code>, lalu dibandingkan sebagai himpunan dengan relasi asal.</p>
${U.tabelRelasi(Fg.reconstruct(induk, frag).relasi, { maks: 12 })}

${fragInduk ? `<h2>Fragmen induk</h2>
<p class="kecil">Fragmentasi turunan mengikuti fragmen induk ini. Tanpa induk, tidak ada yang menentukan ke mana baris anak pergi.</p>
${U.tabel(['Fragmen induk', 'Baris', 'Predikat'], fragInduk.map((f) => [f.nama, f.relasi.cardinality, `<code>${U.esc(f.teks)}</code>`]), { kelasNum: [1] })}` : ''}

<h2>Predikat minterm</h2>
<p>Untuk merancang fragmentasi horizontal yang dijamin lengkap dan disjoint, predikat sederhana dikombinasikan dengan negasinya. Minterm yang tidak menghasilkan satu baris pun dibuang karena tidak relevan.</p>
${mintermHtml()}
`;
}

function mintermHtml() {
  const mt = Fg.mintermPredicates(STAFF, [
    { teks: "position = 'Manager'", predikat: (r) => r.position === 'Manager' },
    { teks: 'salary > 15000', predikat: (r) => r.salary > 15000 },
    { teks: "branchno = 'B3'", predikat: (r) => r.branchno === 'B3' },
  ]);
  const total = mt.reduce((a, b) => a + b.kardinalitas, 0);
  return `${U.tabel(['Minterm', 'Predikat', 'Baris'], mt.map((m) => [
    `<strong>${m.nama}</strong>`, `<code>${U.esc(m.teks)}</code>`, m.kardinalitas,
  ]), { kelasNum: [2] })}
<p class="kecil">${mt.length} minterm relevan dari 2³ = 8 kombinasi. Jumlah barisnya ${total}, sama dengan ${STAFF.cardinality} baris relasi asal — bukti bahwa minterm selalu lengkap dan disjoint.</p>`;
}

render();
