// transparency.js — tangga transparansi distribusi (Modul 6 & Modul 7).
// Satu kueri global ditulis ulang pada lima tingkat transparansi, dari yang
// paling menyembunyikan detail sampai yang paling telanjang:
//
//   1. Transparansi fragmentasi   — pengguna menulis kueri seperti basis data terpusat
//   2. Transparansi lokasi        — nama fragmen muncul, lokasi tidak
//   3. Transparansi replikasi     — salinan mana yang dipakai tidak disebut
//   4. Transparansi pemetaan lokal— nama fragmen DAN situs harus disebut
//   5. Tanpa transparansi         — ditambah rute akses eksplisit (database link Oracle)

/**
 * @typedef {{nama:string, tipe:string, atribut:string[], situs:string, predikat?:string, kunci?:string[]}} FragmentSpec
 * @typedef {{relasiGlobal:string, pilih:string[], kondisi:string, atributKondisi:string}} QuerySpec
 */

/** Tingkat 1 — pengguna tidak tahu data difragmentasi sama sekali. */
export function levelFragmentation(q) {
  return {
    tingkat: 1,
    nama: 'Transparansi fragmentasi',
    keterangan: 'Tingkat tertinggi. Akses memakai skema global; nama fragmen maupun situs tidak pernah muncul.',
    sql: `SELECT ${q.pilih.join(', ')}\nFROM ${q.relasiGlobal}\nWHERE ${q.kondisi};`,
    jumlahFragmenDisebut: 0,
    jumlahSitusDisebut: 0,
  };
}

/** Tingkat 2 — nama fragmen muncul; UNION dirakit pengguna, lokasi masih tersembunyi. */
export function levelLocation(q, fragments) {
  const relevan = fragmenRelevan(q, fragments);
  const vertikalKunci = pemilikKondisi(q, fragments, relevan);
  const kunci = kunciGlobal(q, fragments);
  const cabang = relevan.map((f) => {
    if (vertikalKunci && vertikalKunci.nama !== f.nama) {
      return `SELECT ${q.pilih.join(', ')} FROM ${f.nama}\n  WHERE ${kunci} IN (SELECT ${kunci} FROM ${vertikalKunci.nama} WHERE ${q.kondisi})`;
    }
    return `SELECT ${q.pilih.join(', ')} FROM ${f.nama} WHERE ${q.kondisi}`;
  });
  return {
    tingkat: 2,
    nama: 'Transparansi lokasi',
    keterangan: 'Tingkat menengah. Pengguna tahu data difragmentasi dan harus menyebut nama fragmen, tetapi tidak perlu tahu fragmen itu disimpan di situs mana.',
    sql: `${cabang.join('\nUNION\n')};`,
    jumlahFragmenDisebut: cabang.length + (vertikalKunci ? 1 : 0),
    jumlahSitusDisebut: 0,
    fragmen: relevan.map((f) => f.nama),
  };
}

/** Tingkat 3 — replikasi disembunyikan: pengguna tidak memilih salinan. */
export function levelReplication(q, fragments) {
  const loc = levelLocation(q, fragments);
  const replikasi = fragments.filter((f) => (f.replika || []).length > 1);
  return {
    tingkat: 3,
    nama: 'Transparansi replikasi',
    keterangan: 'Pengguna tidak tahu ada berapa salinan fragmen, apalagi salinan mana yang dipakai. Sistem yang memilih. Bisa ada tanpa transparansi lokasi.',
    sql: loc.sql,
    catatan: replikasi.length
      ? `Fragmen bereplika: ${replikasi.map((f) => `${f.nama} (${f.replika.length} salinan: ${f.replika.join(', ')})`).join('; ')}. Pemilihan salinan dikerjakan DDBMS.`
      : 'Tidak ada fragmen yang direplikasi pada rancangan ini.',
    jumlahFragmenDisebut: loc.jumlahFragmenDisebut,
    jumlahSitusDisebut: 0,
  };
}

/** Tingkat 4 — pengguna menyebut fragmen DAN situs (contoh "AT SITE 3" pada Modul 6). */
export function levelLocalMapping(q, fragments) {
  const relevan = fragmenRelevan(q, fragments);
  const vertikalKunci = pemilikKondisi(q, fragments, relevan);
  const kunci = kunciGlobal(q, fragments);
  const cabang = relevan.map((f) => {
    if (vertikalKunci && vertikalKunci.nama !== f.nama) {
      return `SELECT ${q.pilih.join(', ')} FROM ${f.nama} AT SITE ${f.situs}\n  WHERE ${kunci} IN (SELECT ${kunci} FROM ${vertikalKunci.nama} AT SITE ${vertikalKunci.situs} WHERE ${q.kondisi})`;
    }
    return `SELECT ${q.pilih.join(', ')} FROM ${f.nama} AT SITE ${f.situs} WHERE ${q.kondisi}`;
  });
  return {
    tingkat: 4,
    nama: 'Transparansi pemetaan lokal',
    keterangan: 'Tingkat paling rendah. Pengguna wajib menyebut nama fragmen sekaligus lokasi penyimpanannya.',
    sql: `${cabang.join('\nUNION\n')};`,
    jumlahFragmenDisebut: cabang.length + (vertikalKunci ? 1 : 0),
    jumlahSitusDisebut: new Set([...relevan.map((f) => f.situs), ...(vertikalKunci ? [vertikalKunci.situs] : [])]).size,
    fragmen: relevan.map((f) => `${f.nama}@${f.situs}`),
  };
}

/** Tingkat 5 — tanpa transparansi: rute akses ditulis tangan (database link Oracle). */
export function levelNoTransparency(q, fragments, { linkSuffix = 'LINK' } = {}) {
  const relevan = fragmenRelevan(q, fragments);
  const vertikalKunci = pemilikKondisi(q, fragments, relevan);
  const kunci = kunciGlobal(q, fragments);
  const link = (f) => `${f.nama}@SITE${f.situs}_${linkSuffix}`;
  const cabang = relevan.map((f) => {
    if (vertikalKunci && vertikalKunci.nama !== f.nama) {
      return `SELECT ${q.pilih.join(', ')} FROM ${link(f)}\n  WHERE ${kunci} IN (SELECT ${kunci} FROM ${link(vertikalKunci)} WHERE ${q.kondisi})`;
    }
    return `SELECT ${q.pilih.join(', ')} FROM ${link(f)} WHERE ${q.kondisi}`;
  });
  return {
    tingkat: 5,
    nama: 'Tanpa transparansi (rute eksplisit)',
    keterangan: 'Aplikasi menuliskan sendiri rute akses lintas basis data. Di Oracle bentuknya nama_tabel@database_link.',
    sql: `${cabang.join('\nUNION ALL\n')};`,
    jumlahFragmenDisebut: cabang.length,
    jumlahSitusDisebut: new Set(relevan.map((f) => f.situs)).size,
    peringatan: 'Perubahan letak fisik data memaksa seluruh aplikasi diubah — inilah biaya yang ditanggung saat transparansi dilepas.',
  };
}

/** Bangun kelima tingkat sekaligus, plus metrik "berapa banyak yang bocor ke pengguna". */
export function ladder(q, fragments) {
  const t = [
    levelFragmentation(q, fragments),
    levelLocation(q, fragments),
    levelReplication(q, fragments),
    levelLocalMapping(q, fragments),
    levelNoTransparency(q, fragments),
  ];
  return t.map((x) => ({
    ...x,
    kebocoranDetail: x.jumlahFragmenDisebut + x.jumlahSitusDisebut,
    panjangSql: x.sql.replace(/\s+/g, ' ').trim().length,
  }));
}

function fragmenRelevan(q, fragments) {
  // cabang UNION dibentuk dari fragmen yang benar-benar memuat atribut hasil
  const pembawaHasil = fragments.filter((f) => q.pilih.every((a) => f.atribut.includes(a)));
  if (pembawaHasil.length) return pembawaHasil;
  const horizontal = fragments.filter((f) => f.tipe !== 'vertikal');
  return horizontal.length ? horizontal : fragments;
}

/**
 * Fragmen pemilik atribut yang dipakai pada kondisi WHERE. Bila atribut itu
 * tidak ada di fragmen pembawa hasil, kueri wajib memakai subquery lintas
 * fragmen vertikal — persis situasi S1 vs S21/S22/S23 pada Modul 6.
 */
function pemilikKondisi(q, fragments, relevan) {
  if (!q.atributKondisi) return null;
  if (relevan.every((f) => f.atribut.includes(q.atributKondisi))) return null;
  return fragments.find((f) => f.atribut.includes(q.atributKondisi)) || null;
}

/** Kunci penghubung antar fragmen vertikal. */
function kunciGlobal(q, fragments) {
  if (q.kunci) return q.kunci;
  const f = fragments.find((x) => x.kunci && x.kunci.length);
  if (f) return f.kunci[0];
  const semua = fragments.map((x) => x.atribut);
  const irisan = semua.reduce((acc, a) => acc.filter((x) => a.includes(x)), semua[0] || []);
  return irisan[0] || 'id';
}

// -------------------------------------------- transparansi lain pada Modul 6

/**
 * Transparansi penamaan: nama unik lintas situs.
 * Pendekatan server nama terpusat vs. awalan situs vs. alias (System R*).
 */
export function namingSchemes(objek, situsPembuat, { fragmen = null, salinan = null, pengguna = 'Manager', situsSimpan = null } = {}) {
  const berawalan = fragmen && salinan
    ? `${situsPembuat}.${objek}.F${fragmen}.C${salinan}`
    : `${situsPembuat}.${objek}`;
  return {
    terpusat: {
      nama: objek,
      cara: 'Server nama terpusat mencatat seluruh nama sistem.',
      kendala: [
        'Otonomi lokal berkurang — situs tidak bebas membuat objek.',
        'Bottleneck kinerja pada server nama.',
        'Ketersediaan turun: server nama mati, situs lain tak bisa membuat objek.',
      ],
    },
    awalanSitus: {
      nama: berawalan,
      cara: 'Identitas situs pembuat dipakai sebagai awalan nama objek.',
      kendala: ['Transparansi distribusi hilang: letak objek ikut terbaca di namanya.'],
    },
    alias: {
      nama: 'Localbranch',
      merujuk: berawalan,
      cara: 'Pengguna memakai alias (sinonim); DDBMS memetakan alias ke objek sebenarnya.',
      kendala: ['Perlu katalog pemetaan alias yang konsisten di setiap situs.'],
    },
    systemWideName: {
      nama: `${pengguna}@${situsPembuat}.${objek.toLowerCase()}@${situsSimpan || situsPembuat}`,
      bagian: [
        { bagian: 'Creator ID', nilai: pengguna, arti: 'identitas pengguna pembuat objek' },
        { bagian: 'Creator site ID', nilai: situsPembuat, arti: 'situs tempat objek dibuat' },
        { bagian: 'Local name', nilai: objek.toLowerCase(), arti: 'nama lokal objek' },
        { bagian: 'Birth-site ID', nilai: situsSimpan || situsPembuat, arti: 'situs tempat objek disimpan' },
      ],
      cara: 'System R* membedakan printname (yang dilihat pengguna) dari system-wide name (identifier internal yang dijamin tidak pernah berubah).',
    },
  };
}

/** Empat tipe transaksi menurut arsitektur IBM DRDA (Modul 6). */
export const TIPE_TRANSAKSI_DRDA = [
  {
    tingkat: 1,
    nama: 'Remote Request',
    id: 'remote-request',
    ringkas: 'Satu perintah SQL dikirim ke satu situs jauh, dieksekusi utuh di sana.',
    jumlahSitus: 1,
    perintahPerTransaksi: 1,
    joinLintasSitus: false,
  },
  {
    tingkat: 2,
    nama: 'Remote Unit of Work',
    id: 'remote-uow',
    ringkas: 'Seluruh perintah SQL dalam satu transaksi dikirim ke satu situs jauh. Situs lokal yang memutuskan commit atau rollback.',
    jumlahSitus: 1,
    perintahPerTransaksi: 'banyak',
    joinLintasSitus: false,
  },
  {
    tingkat: 3,
    nama: 'Distributed Unit of Work',
    id: 'distributed-uow',
    ringkas: 'Perintah SQL dalam satu transaksi boleh tersebar ke beberapa situs, tetapi tiap perintah tetap dieksekusi utuh di satu situs.',
    jumlahSitus: 'banyak',
    perintahPerTransaksi: 'banyak',
    joinLintasSitus: false,
  },
  {
    tingkat: 4,
    nama: 'Distributed Request',
    id: 'distributed-request',
    ringkas: 'Satu perintah SQL saja boleh mengakses data di beberapa situs sekaligus (join atau union lintas fragmen).',
    jumlahSitus: 'banyak',
    perintahPerTransaksi: 'banyak',
    joinLintasSitus: true,
  },
];

/** Klasifikasikan sebuah transaksi ke salah satu tingkat DRDA. */
export function classifyDRDA({ situsDisentuh, perintah, adaJoinLintasSitus }) {
  const n = new Set(situsDisentuh).size;
  if (adaJoinLintasSitus) return TIPE_TRANSAKSI_DRDA[3];
  if (n > 1) return TIPE_TRANSAKSI_DRDA[2];
  if (perintah > 1) return TIPE_TRANSAKSI_DRDA[1];
  return TIPE_TRANSAKSI_DRDA[0];
}

/** Ringkasan empat jenis transparansi utama pada Modul 6. */
export const JENIS_TRANSPARANSI = [
  {
    id: 'distribusi',
    nama: 'Transparansi Distribusi',
    isi: ['Fragmentasi', 'Lokasi', 'Replikasi', 'Pemetaan lokal', 'Penamaan'],
    inti: 'Pengguna melihat basis data terdistribusi sebagai satu entitas logis tunggal.',
  },
  {
    id: 'transaksi',
    nama: 'Transparansi Transaksi',
    isi: ['Konkurensi', 'Kegagalan'],
    inti: 'Semua transaksi terdistribusi tetap menjaga konsistensi dan integritas, meski dipecah menjadi subtransaksi di banyak situs.',
  },
  {
    id: 'kinerja',
    nama: 'Transparansi Kinerja',
    isi: ['Distributed Query Processor', 'Biaya I/O', 'Biaya CPU', 'Biaya komunikasi'],
    inti: 'Sistem tidak boleh melambat hanya karena arsitekturnya terdistribusi; DQP memilih strategi eksekusi termurah.',
  },
  {
    id: 'dbms',
    nama: 'Transparansi DBMS',
    isi: ['Independensi data logis', 'Independensi data fisik', 'Transparansi jaringan'],
    inti: 'Rincian implementasi tingkat rendah disembunyikan dari semantik tingkat tinggi yang dipakai aplikasi.',
  },
];
