// Lab 07 — Lokalisasi Data: program lokalisasi dan reduksi fragmen.
import { dreamhome } from '../../engine/data/datasets.js?v=849b085103';
import * as Fg from '../../engine/ddb/fragment.js?v=849b085103';
import * as L from '../../engine/ddb/localize.js?v=849b085103';
import * as U from './ui.js?v=849b085103';

const { STAFF, PROPERTY } = dreamhome();
const a = L.atom;

const FRAG_H = Fg.horizontalByAttribute(STAFF, 'branchno', { prefix: 'STAFF_B' })
  .map((f, i) => ({ ...f, konjungsi: [a('branchno', '=', ['B3', 'B5', 'B7'][i])], situs: `S${i + 1}` }));

const FRAG_V = Fg.vertical(STAFF, [
  { nama: 'V_GAJI', atribut: ['position', 'salary'] },
  { nama: 'V_IDENTITAS', atribut: ['fname', 'lname', 'branchno'] },
], 'staffno');

const FRAG_D = Fg.derived(PROPERTY, FRAG_H, 'branchno');

const state = { attr: 'branchno', op: '=', nilai: 'B3', proyeksi: ['fname', 'lname'] };

function render() {
  U.pasang(`
${U.catatan('Lapisan lokalisasi menerjemahkan kueri atas relasi <b>global</b> menjadi kueri atas <b>fragmen fisik</b>, lalu membuang fragmen yang predikatnya bertentangan dengan predikat kueri. Setiap reduksi di sini diverifikasi: hasil dari fragmen dibandingkan dengan hasil kueri atas relasi global, dan keduanya wajib sama.')}

<h2>Skema fragmentasi yang dipakai</h2>
${U.tabel(['Fragmen', 'Tipe', 'Predikat / atribut', 'Situs', 'Baris'], [
    ...FRAG_H.map((f) => [`<strong>${f.nama}</strong>`, 'horizontal', `<code>${U.esc(f.teks)}</code>`, `<code>${f.situs}</code>`, f.relasi.cardinality]),
    ...FRAG_V.map((f) => [`<strong>${f.nama}</strong>`, 'vertikal', `<code>${U.esc(f.relasi.attrs.join(', '))}</code>`, '—', f.relasi.cardinality]),
  ], { kelasNum: [4] })}

<h2>Program lokalisasi</h2>
<div class="grid dua">
  <div class="kartu">
    <h4>Fragmentasi horizontal</h4>
    ${U.pre(L.localizationProgram('STAFF', FRAG_H).teks)}
    <p class="kecil">Relasi global dibentuk kembali dengan UNION.</p>
  </div>
  <div class="kartu">
    <h4>Fragmentasi vertikal</h4>
    ${U.pre(L.localizationProgram('STAFF', FRAG_V).teks)}
    <p class="kecil">Relasi global dibentuk kembali dengan NATURAL JOIN atas kunci.</p>
  </div>
</div>

<h2>Reduksi horizontal primer</h2>
<div class="kontrol">
  ${U.bidang('Predikat kueri', `<select id="attr">
    <option value="branchno">branchno</option>
    <option value="salary">salary</option>
    <option value="position">position</option>
  </select>`)}
  ${U.bidang('Operator', `<select id="op"><option>=</option><option>&lt;&gt;</option><option>&lt;</option><option>&gt;</option><option>&lt;=</option><option>&gt;=</option></select>`)}
  ${U.bidang('Nilai', '<input type="text" id="nilai" value="B3" style="width:120px">')}
  ${U.tombol('jalan', 'Reduksi')}
</div>
<div id="reduksi"></div>

<h2>Reduksi vertikal</h2>
<p>Fragmen vertikal yang tidak menyumbang satu pun atribut yang diminta kueri dibuang dari join. Pilih atribut hasil yang diinginkan:</p>
<div class="kontrol" id="pilihan-atribut">
${['fname', 'lname', 'branchno', 'position', 'salary'].map((x) => `<label class="kecil" style="margin-right:12px"><input type="checkbox" value="${x}"${state.proyeksi.includes(x) ? ' checked' : ''}> ${x}</label>`).join('')}
</div>
<div id="vertikal"></div>

<h2>Reduksi join atas fragmen horizontal</h2>
<p>Bila kedua relasi difragmentasi pada atribut join yang sama, sebagian besar pasangan fragmen pasti kosong dan tidak perlu dikirim ke mana pun.</p>
<div id="join"></div>

<h2>Reduksi pada fragmentasi turunan</h2>
<p>Pada fragmentasi turunan, kesepadanan fragmen sudah dijamin oleh definisinya: fragmen anak hanya mungkin berpasangan dengan fragmen induk asalnya.</p>
<div id="turunan"></div>
`);

  document.getElementById('attr').addEventListener('change', (e) => { state.attr = e.target.value; hitungReduksi(); });
  document.getElementById('op').addEventListener('change', (e) => { state.op = e.target.value; hitungReduksi(); });
  document.getElementById('nilai').addEventListener('input', (e) => { state.nilai = e.target.value; hitungReduksi(); });
  document.getElementById('jalan').addEventListener('click', hitungReduksi);
  U.$$('#pilihan-atribut input').forEach((c) => c.addEventListener('change', () => {
    state.proyeksi = U.$$('#pilihan-atribut input:checked').map((x) => x.value);
    hitungVertikal();
  }));

  hitungReduksi();
  hitungVertikal();
  hitungJoin();
  hitungTurunan();
}

function nilaiTerketik() {
  const v = state.nilai;
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
}

function hitungReduksi() {
  const pred = [a(state.attr, state.op, nilaiTerketik())];
  const ver = L.verifyReduction(STAFF, FRAG_H, pred);
  const red = ver.reduksi;
  document.getElementById('reduksi').innerHTML = `
${U.tabel(['Fragmen', 'Predikat gabungan', 'Keputusan', 'Alasan'], red.hasil.map((h) => [
    `<strong>${h.fragmen}</strong>`,
    `<code>${U.esc(h.predikatGabungan)}</code>`,
    h.dipakai ? U.lencana('dipakai', 'ok') : U.lencana('dibuang', 'gagal'),
    U.esc(h.alasan),
  ]))}

<div class="grid dua" style="margin-top:12px">
  <div class="kartu">
    <h4>Kueri sebelum reduksi</h4>
    ${U.pre(`σ_{${L.conjToString(pred)}}( ${FRAG_H.map((f) => f.nama).join(' ∪ ')} )`)}
    <p class="kecil">Menyentuh ${FRAG_H.length} fragmen di ${new Set(FRAG_H.map((f) => f.situs)).size} situs.</p>
  </div>
  <div class="kartu">
    <h4>Kueri setelah reduksi</h4>
    ${U.pre(red.fragmenDipakai.length ? `σ_{${L.conjToString(pred)}}( ${red.fragmenDipakai.join(' ∪ ')} )` : '∅  (tidak ada fragmen yang mungkin memuat hasil)')}
    <p class="kecil">Menyentuh ${red.fragmenDipakai.length} fragmen di ${new Set(FRAG_H.filter((f) => red.fragmenDipakai.includes(f.nama)).map((f) => f.situs)).size} situs.</p>
  </div>
</div>

${U.catatan(`<b>Verifikasi:</b> hasil dari fragmen ${ver.setara ? U.lencana('SAMA', 'ok') : U.lencana('BERBEDA', 'gagal')} dengan hasil kueri atas relasi global — ${ver.barisLokal} baris berbanding ${ver.barisGlobal} baris. Reduksi tidak boleh mengubah semantik kueri, hanya menghemat pekerjaan.`, ver.setara ? 'baik' : 'bahaya')}

${U.tabelRelasi(ver.hasil, { maks: 10, judul: 'Hasil kueri' })}
`;
}

function hitungVertikal() {
  const r = L.reduceVertical(state.proyeksi, FRAG_V.map((f) => ({ nama: f.nama, atribut: f.relasi.attrs })), 'staffno');
  document.getElementById('vertikal').innerHTML = `
${U.tabel(['Fragmen', 'Atribut relevan', 'Keputusan', 'Alasan'], r.hasil.map((h) => [
    `<strong>${h.fragmen}</strong>`,
    h.atributRelevan.length ? `<code>${U.esc(h.atributRelevan.join(', '))}</code>` : '—',
    h.dipakai ? U.lencana('dipakai', 'ok') : U.lencana('dibuang', 'gagal'),
    U.esc(h.alasan),
  ]))}
${U.pre(`π_{${state.proyeksi.join(', ') || '(kosong)'}}( ${r.fragmenDipakai.join(' ⋈ ') || '∅'} )`)}
<p class="kecil">${r.fragmenDibuang.length} dari ${FRAG_V.length} fragmen tidak perlu disentuh sama sekali.</p>`;
}

function hitungJoin() {
  const kiri = FRAG_H.map((f) => ({ nama: f.nama, konjungsi: f.konjungsi }));
  const kanan = FRAG_H.map((f) => ({ nama: f.nama.replace('STAFF', 'PROP'), konjungsi: f.konjungsi }));
  const r = L.reduceJoin(kiri, kanan, 'branchno');
  document.getElementById('join').innerHTML = `
${U.tabel(['Pasangan', 'Keputusan', 'Alasan'], r.pasangan.map((p) => [
    `<code>${p.kiri} ⋈ ${p.kanan}</code>`,
    p.dipakai ? U.lencana('dipakai', 'ok') : U.lencana('dibuang', 'gagal'),
    U.esc(p.alasan),
  ]))}
${U.catatan(`Dari ${r.jumlahAsal} pasangan fragmen, hanya ${r.jumlahSisa} yang mungkin menghasilkan baris — penghematan <b>${r.penghematan}%</b> lalu lintas join.`, 'baik')}
${U.pre(r.ekspresi)}`;
}

function hitungTurunan() {
  const r = L.reduceDerived(FRAG_D.map((x) => ({ nama: x.nama, induk: x.induk })), FRAG_H.map((x) => ({ nama: x.nama })));
  document.getElementById('turunan').innerHTML = `
${U.tabel(['Fragmen anak', 'Baris', 'Diturunkan dari'], FRAG_D.map((f) => [
    `<strong>${f.nama}</strong>`, f.relasi.cardinality, `<code>${f.induk}</code>`,
  ]), { kelasNum: [1] })}
${U.catatan(`${r.jumlahSisa} dari ${r.jumlahAsal} pasangan yang perlu dievaluasi — penghematan <b>${r.penghematan}%</b>. Semua join berlangsung lokal karena fragmen anak dan induknya berada di situs yang sama.`, 'baik')}
${U.pre(r.ekspresi)}`;
}

render();
