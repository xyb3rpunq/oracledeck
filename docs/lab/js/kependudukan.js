// Lab 16 — Studi Kasus: konsistensi data kependudukan lintas desa.
import { kependudukan } from '../../engine/data/datasets.js?v=76a896ebe2';
import * as I from '../../engine/ddb/integrity.js?v=76a896ebe2';
import * as TP from '../../engine/ddb/twophase.js?v=76a896ebe2';
import { query } from '../../engine/core/sql.js?v=76a896ebe2';
import * as U from './ui.js?v=76a896ebe2';

const DATA = kependudukan();
const DESA = ['KARANGANYAR', 'JATILUHUR', 'PLARANGAN'];

const state = { situs: 3, latensi: 25, ketersediaan: 980, interval: 24 };

function fragmen() { return DESA.map((n) => ({ nama: n, relasi: DATA[n] })); }

function render() {
  const lap = I.consistencyReport({ fragmen: fragmen(), kematian: DATA.KEMATIAN, pindah: DATA.PINDAH });
  const plan = I.reconciliationPlan(lap);
  const gab = query('SELECT nik, nama, desa FROM KARANGANYAR UNION ALL SELECT nik, nama, desa FROM JATILUHUR UNION ALL SELECT nik, nama, desa FROM PLARANGAN', DATA);

  U.pasang(`
${U.catatan('Studi kasus ini berangkat dari skripsi di folder mata kuliah: <b>"Implementasi Basis Data Terdistribusi untuk Meningkatkan Konsistensi Data Kependudukan"</b> (‘Afin Hilman Akhyari, UIN Sunan Kalijaga, 2016). Kecamatan memakai Oracle XE, desa memakai MySQL dan Microsoft Excel, dan keduanya disambung database link lewat ODBC. Nama desa mengikuti skripsi; <b>seluruh penduduk dan NIK di lab ini adalah data karangan</b>.')}

<h2>Masalah yang diangkat skripsi</h2>
<div class="grid dua">
  <div class="kartu">
    <h3>Di lapangan</h3>
    <ul>
      <li>Desa mengolah data di Excel, dicetak, lalu diketik ulang di kecamatan — kerja dua kali</li>
      <li>Data desa dan data kecamatan tidak cocok satu sama lain</li>
      <li>Ditemukan NIK ganda, padahal NIK wajib unik (PP 37/2007)</li>
      <li>Daftar Pemilih Tetap memuat penduduk yang sudah wafat atau sudah pindah</li>
    </ul>
  </div>
  <div class="kartu">
    <h3>Rancangan dalam skripsi</h3>
    <ul>
      <li><b>Sistem heterogen</b>: Oracle XE (kecamatan), MySQL dan Excel (desa)</li>
      <li><b>Database link</b> dengan driver ODBC sebagai middleware</li>
      <li><b>Replikasi horizontal</b> data desa ke server kecamatan</li>
      <li><b>Sinkronisasi manual per tabel</b> di samping sinkronisasi otomatis</li>
    </ul>
  </div>
</div>

<h2>Data tiga desa</h2>
<div class="grid tiga">
${fragmen().map((f) => `<div class="kartu">${U.tabelRelasi(f.relasi, { maks: 8, judul: `${f.nama} — ${f.relasi.cardinality} penduduk` })}</div>`).join('')}
</div>
<div class="grid dua">
  <div class="kartu">${U.tabelRelasi(DATA.KEMATIAN, { judul: 'Catatan kematian (kecamatan)' })}</div>
  <div class="kartu">${U.tabelRelasi(DATA.PINDAH, { judul: 'Catatan pindah (kecamatan)' })}</div>
</div>

<h2>Pemeriksaan lokal vs global</h2>
${U.tabel(['Situs', 'UNIQUE(nik) lokal', 'Keterangan'], lap.lokal.map((l) => [
    `<strong>${l.fragmen}</strong>`,
    U.lulusGagal(l.lulus),
    l.lulus ? 'DBMS desa tidak menemukan pelanggaran apa pun' : `NIK ganda: ${l.ganda.join(', ')}`,
  ]))}
${U.catatan(`<b>Setiap desa lulus UNIQUE(nik).</b> Tetapi gabungan ketiganya berisi ${lap.totalBaris} baris untuk hanya ${lap.nikUnik} NIK berbeda — ${lap.barisBerlebih} baris berlebih. Tidak ada satu DBMS pun yang melihatnya, karena setiap DBMS hanya memeriksa datanya sendiri. Inilah kelemahan ke-4 DDBS pada Modul 1: <i>pengontrolan integritas lebih sulit</i>.`, 'peringatan')}

<h2>Laporan konsistensi</h2>
${U.tabel(['Jenis', 'NIK', 'Situs', 'Rincian', 'Tingkat'], lap.masalah.map((m) => [
    `<strong>${U.esc(m.jenis)}</strong>`,
    `<code>${U.esc(m.nik)}</code>`,
    m.situs.map((s) => `<code>${s}</code>`).join(' '),
    U.esc(m.rincian),
    U.lencana(m.tingkat, m.tingkat === 'tinggi' ? 'gagal' : 'warn'),
  ]))}

<h2>Rencana rekonsiliasi</h2>
<div class="grid dua">
  <div class="kartu">
    <h3>Aman dikerjakan otomatis ${U.lencana(String(plan.otomatis.length), 'ok')}</h3>
    <ul class="kecil">${plan.otomatis.map((m) => `<li>${U.esc(m.tindakan)}</li>`).join('')}</ul>
  </div>
  <div class="kartu">
    <h3>Wajib diverifikasi petugas ${U.lencana(String(plan.manual.length), 'warn')}</h3>
    <ul class="kecil">${plan.manual.map((m) => `<li>${U.esc(m.tindakan)}</li>`).join('')}</ul>
  </div>
</div>
${U.catatan(U.esc(plan.catatan), 'info')}

<h2>Mendeteksi di Oracle</h2>
${U.preSql(I.oracleDuplicateSql([
    { nama: 'Karanganyar' },
    { nama: 'Jatiluhur', link: 'DESA_JATILUHUR' },
    { nama: 'Plarangan', link: 'DESA_PLARANGAN' },
  ]))}
<p class="kecil">Kueri yang sama dijalankan mesin ORACLEDECK atas data di atas:</p>
${U.tabelRelasi(query('SELECT nik, COUNT(*) AS jumlah FROM (SELECT nik FROM KARANGANYAR UNION ALL SELECT nik FROM JATILUHUR UNION ALL SELECT nik FROM PLARANGAN) g GROUP BY nik HAVING COUNT(*) > 1 ORDER BY nik', DATA))}
<p class="kecil">Baris gabungan yang diperiksa: ${gab.cardinality}.</p>

<h2>Tiga cara menegakkan keunikan NIK</h2>
<div class="kartu">
  <div class="kontrol">
    ${U.bidang('Jumlah situs', '<input type="range" id="situs" min="2" max="12" value="3"><span id="situs-v" class="mono"></span>')}
    ${U.bidang('Latensi antar situs (ms)', '<input type="range" id="latensi" min="5" max="300" value="25"><span id="latensi-v" class="mono"></span>')}
    ${U.bidang('Ketersediaan tiap situs', '<input type="range" id="ketersediaan" min="800" max="999" value="980"><span id="ketersediaan-v" class="mono"></span>')}
    ${U.bidang('Interval rekonsiliasi (jam)', '<input type="range" id="interval" min="1" max="168" value="24"><span id="interval-v" class="mono"></span>')}
  </div>
  <div id="strategi"></div>
</div>

<h2>Kritik terhadap rancangan skripsi</h2>
<p>Skripsi menyimpulkan bahwa <i>data yang sedang diproses tidak akan hilang karena sudah direplikasi ke server kecamatan</i>. Ada satu hal yang tidak dibahas, dan hal itu penting bagi mata kuliah ini.</p>
${U.catatan('Dokumentasi Oracle Database Gateway for ODBC menyatakan gateway itu <b>"cannot participate in distributed transactions; only single-site transactions supported"</b>. Pada mode <code>SINGLE_SITE_AUTOCOMMIT</code>, <b>"any update is committed immediately"</b>. Sumber: <a href="https://docs.oracle.com/en/database/oracle/oracle-database/12.2/odbcu/database-gateway-for-odbc-features.html" rel="noopener">Oracle Database Gateway for ODBC Features and Restrictions</a>.', 'bahaya')}
<p>Artinya, satu transaksi yang mengubah data di Oracle kecamatan <i>dan</i> di MySQL desa sekaligus <b>tidak dapat dijamin atomik</b>. Simulasinya di bawah memakai mesin 2PC yang sama dengan Lab 2PC &amp; 3PC:</p>
<div class="kontrol">
  ${U.bidang('Desa Plarangan memberi suara', U.pilihan('suara', [{ nilai: 'COMMIT', teks: 'VOTE-COMMIT' }, { nilai: 'ABORT', teks: 'VOTE-ABORT' }], 'ABORT'))}
</div>
<div id="gateway"></div>
${U.catatan('Ini persis keterbatasan gateway yang disebut Modul 1: gateway tidak mendukung manajemen transaksi dan pada dasarnya hanya menerjemahkan kueri di antara dua sistem. Rancangan skripsi tetap berguna untuk sinkronisasi dan pelaporan, tetapi klaim konsistensinya bergantung pada tidak adanya kegagalan di tengah transaksi lintas DBMS.', 'info')}

<h2>Rekomendasi bila rancangan ini dibangun ulang</h2>
<ol>
  <li><b>Biarkan NIK hanya diterbitkan satu otoritas</b> (Dinas Dukcapil), lalu kirim ke kecamatan dan desa sebagai replika baca-saja. Keunikan ditegakkan satu DBMS, bukan dirakit dari banyak DBMS — dan desa tidak pernah membuat NIK sendiri.</li>
  <li><b>Jangan pernah mengubah Oracle dan MySQL dalam satu transaksi.</b> Pakai pola <i>outbox</i>: desa menulis perubahan ke tabel antrean lokal, kecamatan mengambilnya dan menerapkannya dalam transaksi Oracle tersendiri, lalu menandai antrean selesai. Setiap langkah dapat diulang tanpa efek ganda.</li>
  <li><b>Tinggalkan Excel sebagai sumber data.</b> Excel tidak punya batasan integritas sama sekali; ia boleh menjadi format ekspor, bukan tempat data hidup.</li>
  <li><b>Jadwalkan rekonsiliasi</b> dengan kueri NIK ganda di atas dan simpan hasilnya sebagai daftar kerja petugas — mesin menandai, manusia memutuskan.</li>
</ol>
`);

  const ikat = (id) => document.getElementById(id).addEventListener('input', (e) => { state[id] = Number(e.target.value); gambarStrategi(); });
  ['situs', 'latensi', 'ketersediaan', 'interval'].forEach(ikat);
  U.ikatPilihan('suara', gambarGateway);
  gambarStrategi();
  gambarGateway('ABORT');
}

function gambarStrategi() {
  const A = state.ketersediaan / 1000;
  document.getElementById('situs-v').textContent = state.situs;
  document.getElementById('latensi-v').textContent = `${state.latensi} ms`;
  document.getElementById('ketersediaan-v').textContent = U.persen(A, 1);
  document.getElementById('interval-v').textContent = `${state.interval} jam`;
  const st = I.enforcementStrategies({ jumlahSitus: state.situs, latensiMs: state.latensi, ketersediaanSitus: A, intervalRekonsiliasiJam: state.interval });
  document.getElementById('strategi').innerHTML = `
${U.tabel(['Strategi', 'Cara', 'Latensi tambahan per insert', 'Ketersediaan pendaftaran', 'Jendela NIK ganda', 'Kelemahan'], st.map((s) => [
    `<strong>${U.esc(s.nama)}</strong>`,
    `<span class="kecil">${U.esc(s.cara)}</span>`,
    `${s.latensiTambahanMs} ms`,
    `${U.persen(s.ketersediaanInsert, 2)} ${U.bar(s.ketersediaanInsert, 1, 'ok')}`,
    s.jendelaInkonsistensiJam ? `${s.jendelaInkonsistensiJam} jam` : U.lencana('nol', 'ok'),
    `<span class="kecil">${U.esc(s.kelemahan)}</span>`,
  ]), { kelasNum: [2] })}
${U.catatan(`Tidak ada pilihan yang gratis. Cek sinkron menutup jendela NIK ganda, tetapi pada ${state.situs} situs pendaftaran hanya tersedia ${U.persen(st[0].ketersediaanInsert, 1)} dari waktu. Rekonsiliasi asinkron menjaga pendaftaran tetap jalan (${U.persen(st[2].ketersediaanInsert, 1)}), dengan harga NIK ganda boleh hidup sampai ${state.interval} jam.`, 'info')}
<ul class="kecil">${st.map((s) => `<li><b>${U.esc(s.nama)}:</b> ${U.esc(s.catatanOracle)}</li>`).join('')}</ul>`;
}

function gambarGateway(suara) {
  const r = TP.runTwoPhaseCommit({
    peserta: [
      { id: 'Kecamatan (Oracle XE)' },
      { id: 'Desa Jatiluhur (MySQL via ODBC)', gateway: true },
      { id: 'Desa Plarangan (Oracle XE)', vote: suara },
    ],
  });
  document.getElementById('gateway').innerHTML = `
${U.tabel(['Situs', 'Keadaan akhir'], Object.entries(r.keadaanAkhir).map(([k, v]) => [
    `<strong>${U.esc(k)}</strong>`,
    U.lencana(v, v === 'COMMIT' ? 'ok' : v === 'ABORT' ? 'warn' : 'netral'),
  ]))}
${U.jejak(r.jejak)}
${U.catatan(r.analisis.map(U.esc).join('<br>'), r.hasilCampuran ? 'bahaya' : 'peringatan')}`;
}

render();
