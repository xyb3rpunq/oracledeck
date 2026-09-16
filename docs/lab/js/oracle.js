// Lab 14 — Generator DDL Oracle dari rancangan terdistribusi.
import { rumahsakit, RS_KEYS, dreamhome, DEFAULT_SITES } from '../../engine/data/datasets.js?v=76a896ebe2';
import * as O from '../../engine/oracle/emit.js?v=76a896ebe2';
import * as U from './ui.js?v=76a896ebe2';

const db = rumahsakit();
const { STAFF } = dreamhome();

const state = {
  tabel: 'pasien',
  strategi: 'LIST',
  kolomPartisi: 'kota',
  replikasi: true,
  refresh: 'FAST',
  jadwal: 'ON DEMAND',
};

const TIPE = {
  id_pasien: 'NUMBER(8)', id_dokter: 'NUMBER(4)', id_admin: 'NUMBER(4)',
  id: 'NUMBER(8)', id_data: 'NUMBER(8)', id_daftar: 'NUMBER(8)',
  nama_pasien: 'VARCHAR2(60)', nama_dokter: 'VARCHAR2(60)', nama_admin: 'VARCHAR2(60)',
  alamat_pasien: 'VARCHAR2(150)', alamat_dokter: 'VARCHAR2(150)',
  jenis_kelamin: 'CHAR(1)', penyakit: 'VARCHAR2(100)',
  no_hp: 'VARCHAR2(20)', kota: 'VARCHAR2(40)',
  tanggal_lahir: 'DATE', waktu_periksa: 'DATE', tanggal_daftar: 'DATE',
  spesialis: 'VARCHAR2(40)', waktu_kerja: 'VARCHAR2(60)', waktu_jaga: 'VARCHAR2(30)',
  resep: 'VARCHAR2(150)', biaya: 'NUMBER(12,2)',
};

function render() {
  U.pasang(`
${U.catatan('Rancangan yang Anda susun di lab-lab sebelumnya diterjemahkan menjadi objek Oracle sungguhan. Penghasil DDL-nya berkas yang sama dengan yang dipakai <code>tools/gen_oracle.js</code> untuk menulis dua belas skrip di halaman <a href="../oracle.html">Oracle</a> — jadi tidak mungkin menyimpang.')}

<div class="kartu">
  <h3>Rancangan</h3>
  <div class="kontrol">
    ${U.bidang('Tabel', U.pilih('tabel', Object.keys(db).map((k) => ({ nilai: k, teks: k })), state.tabel))}
    ${U.bidang('Strategi partisi', U.pilih('strategi', [
    { nilai: 'LIST', teks: 'LIST — satu nilai per fragmen' },
    { nilai: 'RANGE', teks: 'RANGE — rentang nilai' },
    { nilai: 'HASH', teks: 'HASH — sebaran merata' },
    { nilai: 'NONE', teks: 'Tanpa partisi' },
  ], state.strategi))}
    ${U.bidang('Kolom partisi', `<select id="kolomPartisi"></select>`)}
  </div>
  <div class="kontrol">
    ${U.bidang('Replikasi tabel referensi', '<label class="kecil"><input type="checkbox" id="replikasi" checked> buat materialized view untuk DOKTER</label>')}
    ${U.bidang('Mode refresh', U.pilih('refresh', [{ nilai: 'FAST', teks: 'FAST (butuh MV log)' }, { nilai: 'COMPLETE', teks: 'COMPLETE' }], state.refresh))}
    ${U.bidang('Jadwal', U.pilih('jadwal', [
    { nilai: 'ON DEMAND', teks: 'ON DEMAND (asinkron)' },
    { nilai: 'ON COMMIT', teks: 'ON COMMIT (sinkron)' },
    { nilai: 'START WITH', teks: 'Berkala tiap 15 menit' },
  ], state.jadwal))}
  </div>
</div>

<div id="keluaran"></div>
`);

  isiKolom();
  ['tabel', 'strategi', 'kolomPartisi', 'refresh', 'jadwal'].forEach((id) => {
    document.getElementById(id).addEventListener('change', (e) => {
      state[id] = e.target.value;
      if (id === 'tabel') isiKolom();
      gambar();
    });
  });
  document.getElementById('replikasi').addEventListener('change', (e) => { state.replikasi = e.target.checked; gambar(); });
  gambar();
}

function isiKolom() {
  const rel = db[state.tabel];
  const sel = document.getElementById('kolomPartisi');
  sel.innerHTML = rel.attrs.map((a) => `<option value="${a}">${a}</option>`).join('');
  if (!rel.attrs.includes(state.kolomPartisi)) state.kolomPartisi = rel.attrs.includes('kota') ? 'kota' : rel.attrs[0];
  sel.value = state.kolomPartisi;
}

function partisiDari(rel, kolom) {
  const i = rel.indexOf(kolom);
  const nilai = [...new Set(rel.rows.map((r) => r[i]))].sort();
  return nilai.slice(0, 8).map((v, k) => ({
    nama: `P_${String(v).toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 20)}`,
    nilai: [v],
    situs: DEFAULT_SITES[k % DEFAULT_SITES.length].id,
  }));
}

function gambar() {
  const rel = db[state.tabel];
  const kunci = RS_KEYS[state.tabel];
  const opsi = {
    tipe: TIPE,
    pk: kunci.pk,
    fk: kunci.fk.map((f) => ({ ...f, onDelete: 'CASCADE' })),
    notNull: kunci.fk.flatMap((f) => f.cols),
  };

  let ddl;
  let catatanPartisi = '';
  if (state.strategi === 'NONE') {
    ddl = O.createTable(rel, { ...opsi, tablespace: 'TS_S1' });
    catatanPartisi = 'Tanpa partisi, seluruh tabel berada di satu tablespace — setara dengan alokasi terpusat.';
  } else if (state.strategi === 'LIST') {
    const bagian = partisiDari(rel, state.kolomPartisi);
    ddl = O.horizontalAsPartitions(rel, state.kolomPartisi, bagian, opsi);
    catatanPartisi = `${bagian.length} partisi LIST, satu per nilai <code>${U.esc(state.kolomPartisi)}</code>, masing-masing ke tablespace situsnya. Partisi DEFAULT menjamin kelengkapan bila muncul nilai baru.`;
  } else if (state.strategi === 'RANGE') {
    const i = rel.indexOf(state.kolomPartisi);
    const nilai = [...new Set(rel.rows.map((r) => r[i]))].sort();
    const potong = [nilai[Math.floor(nilai.length / 3)], nilai[Math.floor((nilai.length * 2) / 3)]];
    ddl = O.createTable(rel, {
      ...opsi,
      partisi: {
        tipe: 'RANGE',
        kolom: state.kolomPartisi,
        partisi: potong.map((b, k) => ({ nama: `P_R${k + 1}`, batas: b, tablespace: `TS_${DEFAULT_SITES[k % 3].id}` })),
        maxvalue: 'P_R_MAX',
      },
    });
    catatanPartisi = 'RANGE cocok untuk kolom terurut seperti tanggal atau nomor. Partisi MAXVALUE wajib ada agar nilai di atas batas terakhir tetap punya tempat.';
  } else {
    ddl = O.createTable(rel, {
      ...opsi,
      partisi: { tipe: 'HASH', kolom: kunci.pk[0], jumlah: 4, tablespaces: DEFAULT_SITES.map((s) => `TS_${s.id}`) },
    });
    catatanPartisi = 'HASH menyebar baris merata tanpa peduli isinya. Bagus untuk meratakan beban, tetapi <b>partition pruning hanya bekerja pada pencarian nilai persis</b> — bukan pada rentang.';
  }

  const link = DEFAULT_SITES.slice(1).map((s) => O.createDatabaseLink({
    nama: `SITUS_${s.kota.toUpperCase()}`,
    user: 'RS_APP',
    tns: `//${s.kota.toLowerCase()}-db:1521/XEPDB1`,
  })).join('\n\n');

  const mv = state.replikasi ? O.materializedView({
    nama: 'MV_DOKTER',
    sumber: 'DOKTER',
    link: 'SITUS_JAKARTA',
    kunci: ['id_dokter'],
    refresh: state.refresh,
    jadwal: state.jadwal,
    interval: 'SYSDATE + 15/1440',
    tablespace: 'TS_S2',
  }) : '';

  const vertikal = O.verticalAsTables(STAFF, [
    { nama: 'S1_STAFF', atribut: ['position', 'sex', 'dob', 'salary'], situs: 'S3' },
    { nama: 'S2_STAFF', atribut: ['fname', 'lname', 'branchno'], situs: 'S1' },
  ], 'staffno');

  document.getElementById('keluaran').innerHTML = `
<h2>1. Tablespace per situs</h2>
<p class="kecil">Alokasi fragmen ke situs diwujudkan sebagai penempatan partisi ke tablespace yang berbeda.</p>
${U.preSql(DEFAULT_SITES.map((s) => `-- Situs ${s.id} — ${s.nama}
CREATE TABLESPACE TS_${s.id}
  DATAFILE '${s.id.toLowerCase()}_rs01.dbf' SIZE 100M AUTOEXTEND ON NEXT 10M MAXSIZE 2G;`).join('\n\n'))}

<h2>2. Tabel dan fragmentasi horizontal</h2>
${U.catatan(catatanPartisi, 'info')}
${U.preSql(ddl)}

<h2>3. Fragmentasi vertikal</h2>
<p class="kecil">Kolom gaji dipisahkan dari kolom identitas, lalu disatukan kembali lewat VIEW. Perhatikan <code>STAFFNO</code> ada di kedua tabel — tanpa itu rekonstruksinya lossy.</p>
${U.preSql(vertikal.sql)}

<h2>4. Database link dan transparansi lokasi</h2>
${U.preSql(link)}
${U.preSql(O.locationTransparencySynonyms(DEFAULT_SITES.slice(1).map((s) => ({
    alias: `PASIEN_${s.kota.toUpperCase()}`, objek: 'PASIEN', link: `SITUS_${s.kota.toUpperCase()}`,
  }))))}
${U.catatan('<b>Inilah transparansi lokasi versi Oracle.</b> Aplikasi cukup menulis <code>FROM PASIEN_BANDUNG</code>; bila tabelnya dipindahkan ke situs lain, yang diubah hanya sinonimnya — tidak satu baris pun kode aplikasi disentuh.', 'baik')}

<h2>5. Program lokalisasi sebagai VIEW</h2>
${U.preSql(O.unionAllView('V_PASIEN_NASIONAL', [
    { objek: 'PASIEN', predikat: "KOTA = 'Jakarta'" },
    ...DEFAULT_SITES.slice(1).map((s) => ({ objek: 'PASIEN', link: `SITUS_${s.kota.toUpperCase()}`, predikat: `KOTA = '${s.kota}'` })),
  ]))}

${state.replikasi ? `<h2>6. Replikasi</h2>
${U.catatan(jadwalCatatan(), state.jadwal === 'ON COMMIT' ? 'peringatan' : 'info')}
${U.preSql(mv)}
${U.preSql(O.refreshGroup('RG_REFERENSI', ['MV_DOKTER'], 'SYSDATE + 15/1440'))}` : ''}

<h2>${state.replikasi ? '7' : '6'}. Transaksi terdistribusi</h2>
${U.preSql(O.distributedTransaction({
    situs: ['Jakarta', 'Bandung'],
    namaTransaksi: 'RUJUK_PASIEN_LINTAS_KOTA',
    operasi: [
      { situs: 'Jakarta (lokal)', sql: "UPDATE PASIEN SET KOTA = 'Bandung' WHERE ID_PASIEN = 1" },
      { situs: 'Bandung (jauh)', sql: 'INSERT INTO DAFTAR@SITUS_BANDUNG (ID_DAFTAR, ID_PASIEN, ID_ADMIN, TANGGAL_DAFTAR) VALUES (99, 1, 3, SYSDATE)' },
    ],
  }))}

<h2>${state.replikasi ? '8' : '7'}. Bukti reduksi lokalisasi</h2>
<p class="kecil">Kolom PSTART/PSTOP pada rencana eksekusi menunjukkan partisi mana yang benar-benar disentuh. Inilah wujud nyata reduksi yang disimulasikan di Lab Lokalisasi Data.</p>
${U.preSql(O.pruningProof(state.tabel.toUpperCase(), state.kolomPartisi, db[state.tabel].rows[0][db[state.tabel].indexOf(state.kolomPartisi)]))}

<h2>${state.replikasi ? '9' : '8'}. Diagnosa two-phase commit dan deadlock</h2>
${U.preSql(O.twoPhaseDiagnostics())}

<h2>Pemetaan konsep ke fitur Oracle</h2>
${U.tabel(['Konsep kuliah', 'Fitur Oracle', 'Lab terkait'], [
    ['Fragmentasi horizontal primer', '<code>PARTITION BY LIST / RANGE / HASH</code>', '<a href="fragmentasi.html">Fragmentasi</a>'],
    ['Fragmentasi horizontal turunan', '<code>PARTITION BY REFERENCE</code>', '<a href="fragmentasi.html">Fragmentasi</a>'],
    ['Fragmentasi vertikal', 'Tabel terpisah + VIEW perekat', '<a href="fragmentasi.html">Fragmentasi</a>'],
    ['Alokasi ke situs', '<code>TABLESPACE</code> per partisi', '<a href="alokasi.html">Alokasi</a>'],
    ['Replikasi', '<code>MATERIALIZED VIEW</code> + MV log', '<a href="alokasi.html">Alokasi</a>'],
    ['Transparansi lokasi', '<code>DATABASE LINK</code> + <code>SYNONYM</code>', '<a href="transparansi.html">Transparansi</a>'],
    ['Program lokalisasi', '<code>VIEW ... UNION ALL</code>', '<a href="lokalisasi.html">Lokalisasi</a>'],
    ['Reduksi lokalisasi', 'Partition pruning (PSTART/PSTOP)', '<a href="lokalisasi.html">Lokalisasi</a>'],
    ['Komitmen dua fase', '<code>COMMIT</code> otomatis lintas link', '<a href="duafase.html">2PC &amp; 3PC</a>'],
    ['Transaksi menggantung', '<code>DBA_2PC_PENDING</code>', '<a href="duafase.html">2PC &amp; 3PC</a>'],
    ['Deteksi deadlock', 'ORA-00060 + trace file', '<a href="deadlock.html">Deadlock</a>'],
    ['Strategi join terdistribusi', 'Operasi REMOTE pada rencana', '<a href="join.html">Join</a>'],
  ])}

${U.catatan('<b>Belum dijalankan pada Oracle sungguhan.</b> Repositori ini dibangun tanpa akses ke instans Oracle. Yang diuji otomatis adalah pembangkit DDL-nya — bentuk perintah, nama objek, dan klausa partisi diperiksa 40+ uji. Sintaks yang hanya bisa dibuktikan parser Oracle belum diverifikasi. Jalankan sendiri di Oracle XE atau <code>gvenzl/oracle-free</code>.', 'peringatan')}
`;
}

function jadwalCatatan() {
  if (state.jadwal === 'ON COMMIT') {
    return '<b>ON COMMIT = replikasi sinkron.</b> RPO nol — tidak ada transaksi yang hilang. Harganya: setiap COMMIT di situs sumber ikut menunggu penyegaran replika selesai, dan transaksi gagal bila replika tak terjangkau.';
  }
  if (state.jadwal === 'START WITH') {
    return '<b>Penyegaran berkala tiap 15 menit.</b> RPO sekitar 15 menit. Cocok untuk tabel referensi yang jarang berubah seperti daftar dokter.';
  }
  return '<b>ON DEMAND = replikasi asinkron.</b> COMMIT di situs sumber tetap cepat, tetapi replika bisa tertinggal sampai penyegaran berikutnya dijalankan.';
}

render();
