// Lab 01 — Perancang ERD: kasus Tono Rental dan lainnya.
import { TONO_RENTAL_CASE } from '../../engine/data/datasets.js?v=8e172babd6';
import * as E from '../../engine/ddb/erd.js?v=8e172babd6';
import * as U from './ui.js?v=8e172babd6';

const KASUS = {
  tono: {
    nama: 'Tono Rental (Praktikum 1)',
    narasi: TONO_RENTAL_CASE.narasi,
    erd: { entitas: TONO_RENTAL_CASE.entitas, relasi: TONO_RENTAL_CASE.relasi },
  },
  rumahsakit: {
    nama: 'Rumah sakit (Praktikum 2)',
    narasi: 'Rumah sakit mencatat data pasien, dokter, dan administrator. Seorang pasien dapat diperiksa banyak dokter, dan seorang dokter memeriksa banyak pasien; setiap pemeriksaan dicatat waktu dan resepnya. Administrator melayani pendaftaran pasien dan mengelola jadwal dokter.',
    erd: {
      entitas: [
        { nama: 'PASIEN', pk: 'id_pasien', atribut: ['id_pasien', 'nama_pasien', 'alamat_pasien', 'jenis_kelamin', 'penyakit', 'no_hp', 'kota'] },
        { nama: 'DOKTER', pk: 'id_dokter', atribut: ['id_dokter', 'nama_dokter', 'alamat_dokter', 'tanggal_lahir', 'no_hp', 'spesialis', 'waktu_kerja'] },
        { nama: 'ADMINISTRATOR', pk: 'id_admin', atribut: ['id_admin', 'nama_admin', 'waktu_jaga'] },
      ],
      relasi: [
        { dari: 'PASIEN', ke: 'DOKTER', nama: 'PASIEN_DOKTER', kardinalitas: 'N:M', atribut: ['waktu_periksa', 'resep', 'biaya'] },
        { dari: 'DOKTER', ke: 'ADMINISTRATOR', nama: 'DOKTER_ADMIN', kardinalitas: 'N:M' },
        { dari: 'PASIEN', ke: 'ADMINISTRATOR', nama: 'DAFTAR', kardinalitas: 'N:M', atribut: ['tanggal_daftar'] },
      ],
    },
  },
  akademik: {
    nama: 'Akademik (Praktikum 4 & 5)',
    narasi: 'Mahasiswa mengambil mata kuliah dan memperoleh nilai. Seorang mahasiswa mengambil banyak mata kuliah, dan satu mata kuliah diambil banyak mahasiswa. Mahasiswa juga punya atribut hobi yang bisa lebih dari satu.',
    erd: {
      entitas: [
        { nama: 'MHS', pk: 'nim', atribut: ['nim', 'nama_mhs', 'alamat_mhs', 'hobi'], multinilai: ['hobi'] },
        { nama: 'MATA_KULIAH', pk: 'kode_kul', atribut: ['kode_kul', 'nama_kul', 'sks', 'sem'] },
      ],
      relasi: [{ dari: 'MHS', ke: 'MATA_KULIAH', nama: 'NILAI', kardinalitas: 'N:M', atribut: ['nilai'] }],
    },
  },
  lemah: {
    nama: 'Entitas lemah — faktur dan barisnya',
    narasi: 'Satu faktur terdiri dari beberapa baris. Nomor baris hanya bermakna di dalam fakturnya sendiri, sehingga BARIS merupakan entitas lemah yang bergantung pada FAKTUR.',
    erd: {
      entitas: [
        { nama: 'FAKTUR', pk: 'no_faktur', atribut: ['no_faktur', 'tgl_faktur', 'no_ktp'] },
        { nama: 'BARIS', pk: 'no_baris', atribut: ['no_baris', 'kode_mobil', 'jumlah', 'harga_sewa'], lemah: true, induk: 'FAKTUR' },
      ],
      relasi: [{ dari: 'FAKTUR', ke: 'BARIS', nama: 'berisi', kardinalitas: '1:N' }],
    },
  },
  cacat: {
    nama: '⚠ ERD yang belum sah',
    narasi: 'ERD ini sengaja dibuat bermasalah: satu entitas tanpa primary key, satu relasi merujuk entitas yang tidak ada, dan satu entitas yang tidak terhubung ke mana pun.',
    erd: {
      entitas: [
        { nama: 'PELANGGAN', pk: 'id', atribut: ['id', 'nama'] },
        { nama: 'PESANAN', atribut: ['no_pesanan', 'tanggal'] },
        { nama: 'YATIM', pk: 'kode', atribut: ['kode'] },
      ],
      relasi: [{ dari: 'PELANGGAN', ke: 'PESANAN', nama: 'membuat', kardinalitas: '1:N' }],
    },
  },
};

let kasus = 'tono';

function render() {
  U.pasang(`
${U.catatan('Aturan transformasi ERD ke skema relasional (Connolly &amp; Begg) dijalankan sungguhan: relasi 1:N menanam kunci di sisi banyak, relasi N:M menjadi tabel penghubung, atribut multinilai dipisah demi 1NF, dan entitas lemah memakai kunci gabungan.')}

<div class="kontrol">
  ${U.bidang('Kasus', U.pilihan('kasus', Object.entries(KASUS).map(([k, v]) => ({ nilai: k, teks: v.nama })), kasus))}
</div>

<div id="keluaran"></div>

<h2>Aturan transformasi</h2>
${U.tabel(['Konstruksi ERD', 'Menjadi', 'Alasan'], [
    ['Entitas kuat', 'Satu tabel; PK entitas menjadi PK tabel', 'Setiap entitas punya identitas sendiri'],
    ['Relasi 1:1', 'Kunci salah satu ditanam sebagai FK UNIQUE di sisi yang partisipasinya wajib', 'Menempatkan di sisi wajib meminimalkan kolom NULL'],
    ['Relasi 1:N', 'Kunci sisi "1" ditanam sebagai FK di sisi "N"', 'Satu baris di sisi N hanya boleh menunjuk satu induk'],
    ['Relasi N:M', 'Tabel penghubung dengan kunci gabungan dari kedua sisi', 'Tidak ada tempat menanam FK tanpa melanggar 1NF'],
    ['Atribut multinilai', 'Tabel tersendiri berisi kunci entitas + atribut itu', 'Nilai jamak dalam satu sel melanggar 1NF'],
    ['Entitas lemah', 'Kunci entitas kuat menjadi bagian kunci gabungan', 'Identitasnya tidak lengkap tanpa induknya'],
  ])}
`);
  U.ikatPilihan('kasus', (v) => { kasus = v; gambar(); });
  gambar();
}

function gambar() {
  const k = KASUS[kasus];
  const cek = E.validateERD(k.erd);
  const w = document.getElementById('keluaran');

  let skema = null;
  let ddl = '';
  if (cek.valid) {
    skema = E.erdToSchema(k.erd);
    ddl = E.schemaToOracle(skema);
  }

  w.innerHTML = `
<h2>Narasi kasus</h2>
${U.catatan(U.esc(k.narasi), 'info')}

<h2>Entity Relationship Diagram</h2>
${erdSvg(k.erd)}

<div class="grid dua">
  <div class="kartu">
    <h3>Entitas dan atribut</h3>
    ${U.pre(E.erdToText(k.erd))}
  </div>
  <div class="kartu">
    <h3>Mermaid (dapat ditempel ke laporan)</h3>
    ${U.pre(E.erdToMermaid(k.erd))}
  </div>
</div>

<h2>Pemeriksaan ERD ${cek.valid ? U.lencana('SAH', 'ok') : U.lencana('BELUM SAH', 'gagal')}</h2>
${cek.masalah.length
    ? U.tabel(['Tingkat', 'Masalah'], cek.masalah.map((m) => [U.lencana(m.tingkat, m.tingkat === 'galat' ? 'gagal' : 'warn'), U.esc(m.pesan)]))
    : U.catatan('Tidak ada masalah: setiap entitas punya primary key, setiap relasi merujuk entitas yang ada, dan tidak ada entitas yatim.', 'baik')}

${!cek.valid ? U.catatan('ERD ini tidak dapat dikonversi menjadi skema relasional sampai seluruh galat diperbaiki. Perbaiki dulu di tingkat konseptual — memperbaiki di tingkat fisik jauh lebih mahal.', 'bahaya') : ''}

${skema ? `
<h2>Jejak transformasi</h2>
<ol class="kecil">${skema.jejak.map((j) => `<li>${j}</li>`).join('')}</ol>

<h2>Skema relasional hasil</h2>
${U.tabel(['Tabel', 'Asal', 'Kolom', 'Primary key', 'Foreign key'], skema.tabel.map((t) => [
    `<strong>${t.nama}</strong>`,
    U.lencana(t.asal, t.asal === 'entitas' ? 'netral' : 'info'),
    `<code class="kecil">${U.esc(t.kolom.join(', '))}</code>`,
    `<code>${U.esc(t.pk.join(', '))}</code>`,
    t.fk.length ? t.fk.map((f) => `<code class="kecil">${U.esc(f.cols.join(','))} → ${f.ref}</code>`).join('<br>') : '—',
  ]))}

<h2>DDL Oracle</h2>
<p class="kecil">Tabel diurutkan menurut ketergantungan foreign key, sehingga skrip bisa dijalankan dari atas ke bawah tanpa galat referensi.</p>
${U.preSql(ddl)}
` : ''}
`;
}

function erdSvg(erd) {
  const ent = erd.entitas;
  const n = ent.length;
  const lebar = 700;
  const kolom = Math.min(n, 3);
  const barisJml = Math.ceil(n / kolom);
  const kotakW = 180;
  const tinggiPerAtribut = 15;
  const pos = ent.map((e, i) => {
    const r = Math.floor(i / kolom);
    const c = i % kolom;
    const perBaris = Math.min(kolom, n - r * kolom);
    const jarak = lebar / (perBaris + 1);
    return {
      e,
      x: jarak * (c + 1) - kotakW / 2,
      y: 20 + r * 200,
      h: 34 + e.atribut.length * tinggiPerAtribut,
    };
  });
  const tinggi = 40 + barisJml * 200;
  const cari = (nm) => pos.find((p) => p.e.nama === nm);

  const garis = erd.relasi.map((r) => {
    const a = cari(r.dari); const b = cari(r.ke);
    if (!a || !b) return '';
    const ax = a.x + kotakW / 2; const ay = a.y + a.h / 2;
    const bx = b.x + kotakW / 2; const by = b.y + b.h / 2;
    const mx = (ax + bx) / 2; const my = (ay + by) / 2;
    return `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#2d3949" stroke-width="1.6"/>
<rect x="${mx - 52}" y="${my - 13}" width="104" height="26" rx="13" fill="#11151d" stroke="#f04438" stroke-width="1.3"/>
<text x="${mx}" y="${my + 4}" fill="#e6ebf2" font-size="10" text-anchor="middle" font-family="monospace">${U.esc(r.nama)}</text>
<text x="${mx}" y="${my + 24}" fill="#6c7a90" font-size="9.5" text-anchor="middle" font-family="monospace">${U.esc(r.kardinalitas)}</text>`;
  }).join('\n');

  const kotak = pos.map((p) => `
<rect x="${p.x}" y="${p.y}" width="${kotakW}" height="${p.h}" rx="7" fill="#131821" stroke="${p.e.lemah ? '#fbbf24' : '#2d3949'}" stroke-width="${p.e.lemah ? 2 : 1.4}"${p.e.lemah ? ' stroke-dasharray="5 3"' : ''}/>
<rect x="${p.x}" y="${p.y}" width="${kotakW}" height="26" rx="7" fill="#171c26"/>
<text x="${p.x + kotakW / 2}" y="${p.y + 18}" fill="#e6ebf2" font-size="12" font-weight="600" text-anchor="middle" font-family="monospace">${U.esc(p.e.nama)}${p.e.lemah ? ' (lemah)' : ''}</text>
${p.e.atribut.map((a, i) => {
    const pk = a === p.e.pk;
    const mv = (p.e.multinilai || []).includes(a);
    return `<text x="${p.x + 10}" y="${p.y + 42 + i * tinggiPerAtribut}" fill="${pk ? '#f04438' : mv ? '#fbbf24' : '#a9b4c4'}" font-size="10.5" font-family="monospace">${pk ? '🔑 ' : mv ? '≡ ' : '· '}${U.esc(a)}</text>`;
  }).join('\n')}`).join('\n');

  return `<div class="diagram"><svg viewBox="0 0 ${lebar} ${tinggi}" role="img" aria-label="Entity Relationship Diagram">
${garis}
${kotak}
</svg>
<p class="kecil" style="margin:8px 0 0">🔑 primary key · ≡ atribut multinilai · garis putus-putus = entitas lemah</p></div>`;
}

render();
