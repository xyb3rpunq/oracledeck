// datasets.js — data contoh yang dipakai seluruh lab.
// Semua dataset diambil persis dari materi kuliah CTI313 / praktikum SBDT.

import { Relation } from '../core/relation.js?v=b04806ea2d';

// ---------------------------------------------------------------------------
// 1) DreamHome (Connolly & Begg) — dipakai Modul 6 & Modul 7 untuk contoh
//    fragmentasi S1, S2, S21, S22, S23 dan tangga transparansi.
// ---------------------------------------------------------------------------

export const STAFF_ATTRS = ['staffno', 'fname', 'lname', 'position', 'sex', 'dob', 'salary', 'branchno'];

export const STAFF_ROWS = [
  ['SL21', 'John',    'White',  'Manager',    'M', '1945-10-01', 30000, 'B5'],
  ['SG37', 'Ann',     'Beech',  'Assistant',  'F', '1960-11-10', 12000, 'B3'],
  ['SG14', 'David',   'Ford',   'Supervisor', 'M', '1958-03-24', 18000, 'B3'],
  ['SA9',  'Mary',    'Howe',   'Assistant',  'F', '1970-02-19',  9000, 'B7'],
  ['SG5',  'Susan',   'Brand',  'Manager',    'F', '1940-06-03', 24000, 'B3'],
  ['SL41', 'Julie',   'Lee',    'Assistant',  'F', '1965-06-13',  9000, 'B5'],
  ['SL22', 'Peter',   'Nugroho','Supervisor', 'M', '1972-09-02', 17000, 'B5'],
  ['SA11', 'Rina',    'Sitorus','Manager',    'F', '1968-01-25', 27000, 'B7'],
  ['SA14', 'Bimo',    'Prasetyo','Assistant', 'M', '1980-12-05',  9500, 'B7'],
  ['SG21', 'Clara',   'Munthe', 'Assistant',  'F', '1977-07-17', 11000, 'B3'],
];

export const BRANCH_ATTRS = ['branchno', 'street', 'city', 'postcode'];
export const BRANCH_ROWS = [
  ['B3', '163 Main St',   'Glasgow',  'G11 9QX'],
  ['B5', '22 Deer Rd',    'London',   'SW1 4EH'],
  ['B7', '16 Argyll St',  'Aberdeen', 'AB2 3SU'],
];

export const PROPERTY_ATTRS = ['propertyno', 'street', 'city', 'type', 'rooms', 'rent', 'staffno', 'branchno'];
export const PROPERTY_ROWS = [
  ['PA14', '16 Holhead',   'Aberdeen', 'House', 6, 650, 'SA9',  'B7'],
  ['PL94', '6 Argyll St',  'London',   'Flat',  4, 400, 'SL41', 'B5'],
  ['PG4',  '6 Lawrence St','Glasgow',  'Flat',  3, 350, 'SG37', 'B3'],
  ['PG36', '2 Manor Rd',   'Glasgow',  'Flat',  3, 375, 'SG37', 'B3'],
  ['PG21', '18 Dale Rd',   'Glasgow',  'House', 5, 600, 'SG37', 'B3'],
  ['PG16', '5 Novar Dr',   'Glasgow',  'Flat',  4, 450, 'SG14', 'B3'],
  ['PA20', '9 Union Rd',   'Aberdeen', 'Flat',  2, 300, 'SA14', 'B7'],
  ['PL18', '3 Baker St',   'London',   'House', 5, 700, 'SL22', 'B5'],
];

export function dreamhome() {
  return {
    STAFF: new Relation('STAFF', STAFF_ATTRS, STAFF_ROWS),
    BRANCH: new Relation('BRANCH', BRANCH_ATTRS, BRANCH_ROWS),
    PROPERTY: new Relation('PROPERTY', PROPERTY_ATTRS, PROPERTY_ROWS),
  };
}

// ---------------------------------------------------------------------------
// 2) rumahsakit — skema Praktikum 2 (SQL & DML) dan Project UAS Kelompok 3.
//    Enam tabel: pasien, dokter, administrator, pasien_dokter, dokter_admin, daftar.
// ---------------------------------------------------------------------------

export const RS_SCHEMA = {
  pasien: ['id_pasien', 'nama_pasien', 'alamat_pasien', 'jenis_kelamin', 'penyakit', 'no_hp', 'kota'],
  dokter: ['id_dokter', 'nama_dokter', 'alamat_dokter', 'tanggal_lahir', 'no_hp', 'spesialis', 'waktu_kerja', 'kota'],
  administrator: ['id_admin', 'nama_admin', 'waktu_jaga', 'kota'],
  pasien_dokter: ['id', 'id_dokter', 'id_pasien', 'waktu_periksa', 'resep', 'biaya'],
  dokter_admin: ['id_data', 'id_dokter', 'id_admin'],
  daftar: ['id_daftar', 'id_pasien', 'id_admin', 'tanggal_daftar'],
};

const PASIEN_ROWS = [
  [1,  'Budi Santoso',    'Jl. Merdeka 12',   'L', 'Demam Berdarah', '081234567001', 'Jakarta'],
  [2,  'Siti Aminah',     'Jl. Kenanga 5',    'P', 'Tifus',          '081234567002', 'Jakarta'],
  [3,  'Andi Wijaya',     'Jl. Melati 9',     'L', 'Asma',           '081234567003', 'Bandung'],
  [4,  'Rina Marlina',    'Jl. Anggrek 21',   'P', 'Anemia',         '081234567004', 'Bandung'],
  [5,  'Joko Susilo',     'Jl. Mawar 3',      'L', 'Diabetes',       '081234567005', 'Surabaya'],
  [6,  'Dewi Lestari',    'Jl. Dahlia 7',     'P', 'Hipertensi',     '081234567006', 'Surabaya'],
  [7,  'Agus Setiawan',   'Jl. Cempaka 14',   'L', 'Demam Berdarah', '081234567007', 'Jakarta'],
  [8,  'Nurul Hidayah',   'Jl. Flamboyan 2',  'P', 'Migrain',        '081234567008', 'Bandung'],
  [9,  'Hendra Gunawan',  'Jl. Teratai 18',   'L', 'Patah Tulang',   '081234567009', 'Surabaya'],
  [10, 'Maya Anggraini',  'Jl. Sakura 30',    'P', 'Tifus',          '081234567010', 'Jakarta'],
  [11, 'Rudi Hartono',    'Jl. Kamboja 11',   'L', 'Asma',           '081234567011', 'Bandung'],
  [12, 'Lina Wahyuni',    'Jl. Bougenville 6','P', 'Anemia',         '081234567012', 'Surabaya'],
];

const DOKTER_ROWS = [
  [1, 'dr. Surya Atmaja',   'Jl. Diponegoro 1', '1975-04-12', '082100000001', 'Penyakit Dalam', 'Senin-Rabu',  'Jakarta'],
  [2, 'dr. Anita Kusuma',   'Jl. Sudirman 44',  '1982-08-30', '082100000002', 'Anak',           'Selasa-Kamis','Jakarta'],
  [3, 'dr. Bambang Riyadi', 'Jl. Asia Afrika 8','1969-01-05', '082100000003', 'Bedah',          'Rabu-Jumat',  'Bandung'],
  [4, 'dr. Citra Dewanti',  'Jl. Braga 19',     '1988-11-21', '082100000004', 'Saraf',          'Senin-Kamis', 'Bandung'],
  [5, 'dr. Eko Prabowo',    'Jl. Tunjungan 2',  '1979-06-17', '082100000005', 'Jantung',        'Selasa-Sabtu','Surabaya'],
  [6, 'dr. Farah Nadia',    'Jl. Pemuda 27',    '1985-02-09', '082100000006', 'Paru',           'Senin-Jumat', 'Surabaya'],
];

const ADMIN_ROWS = [
  [1, 'Ratna Sari',   'Pagi',  'Jakarta'],
  [2, 'Dimas Prakoso','Siang', 'Jakarta'],
  [3, 'Yuni Astuti',  'Malam', 'Bandung'],
  [4, 'Tono Saputra', 'Pagi',  'Surabaya'],
];

const PASIEN_DOKTER_ROWS = [
  [1,  1, 1,  '2025-09-01', 'Paracetamol 500mg',      250000],
  [2,  1, 2,  '2025-09-02', 'Amoxicillin 500mg',      275000],
  [3,  2, 7,  '2025-09-02', 'Oralit + Vitamin',       180000],
  [4,  2, 10, '2025-09-03', 'Ciprofloxacin',          320000],
  [5,  3, 3,  '2025-09-04', 'Salbutamol inhaler',     410000],
  [6,  4, 8,  '2025-09-04', 'Sumatriptan',            390000],
  [7,  3, 11, '2025-09-05', 'Salbutamol inhaler',     410000],
  [8,  4, 4,  '2025-09-05', 'Sulfas ferrosus',        210000],
  [9,  5, 5,  '2025-09-08', 'Metformin 850mg',        450000],
  [10, 5, 6,  '2025-09-08', 'Amlodipin 10mg',         380000],
  [11, 6, 12, '2025-09-09', 'Sulfas ferrosus',        215000],
  [12, 3, 9,  '2025-09-10', 'Gips + Analgesik',       850000],
  [13, 1, 1,  '2025-09-12', 'Kontrol - Paracetamol',  150000],
  [14, 5, 5,  '2025-09-15', 'Kontrol - Metformin',    175000],
];

const DOKTER_ADMIN_ROWS = [
  [1, 1, 1], [2, 2, 1], [3, 1, 2], [4, 2, 2],
  [5, 3, 3], [6, 4, 3], [7, 5, 4], [8, 6, 4],
];

const DAFTAR_ROWS = [
  [1,  1,  1, '2025-09-01'], [2,  2,  1, '2025-09-02'], [3,  7,  2, '2025-09-02'],
  [4,  10, 2, '2025-09-03'], [5,  3,  3, '2025-09-04'], [6,  8,  3, '2025-09-04'],
  [7,  11, 3, '2025-09-05'], [8,  4,  3, '2025-09-05'], [9,  5,  4, '2025-09-08'],
  [10, 6,  4, '2025-09-08'], [11, 12, 4, '2025-09-09'], [12, 9,  3, '2025-09-10'],
];

export function rumahsakit() {
  return {
    pasien: new Relation('pasien', RS_SCHEMA.pasien, PASIEN_ROWS),
    dokter: new Relation('dokter', RS_SCHEMA.dokter, DOKTER_ROWS),
    administrator: new Relation('administrator', RS_SCHEMA.administrator, ADMIN_ROWS),
    pasien_dokter: new Relation('pasien_dokter', RS_SCHEMA.pasien_dokter, PASIEN_DOKTER_ROWS),
    dokter_admin: new Relation('dokter_admin', RS_SCHEMA.dokter_admin, DOKTER_ADMIN_ROWS),
    daftar: new Relation('daftar', RS_SCHEMA.daftar, DAFTAR_ROWS),
  };
}

/**
 * Tipe kolom Oracle rumahsakit — satu sumber untuk skrip oracle/ (tools/gen_oracle.js)
 * dan preset terminal SQL, agar DESC di terminal sama dengan DDL yang diunduh.
 */
export const RS_TIPE = {
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

/** Tipe kolom Oracle untuk dataset akademik, DreamHome, dan kependudukan (preset terminal). */
export const TIPE_LAIN = {
  nim: 'VARCHAR2(10)', nama_mhs: 'VARCHAR2(60)', alamat_mhs: 'VARCHAR2(60)',
  kode_kul: 'VARCHAR2(10)', nama_kul: 'VARCHAR2(60)', sks: 'NUMBER(1)', sem: 'NUMBER(2)', nilai: 'NUMBER(3)',
  staffno: 'VARCHAR2(5)', fname: 'VARCHAR2(30)', lname: 'VARCHAR2(30)', position: 'VARCHAR2(20)', sex: 'CHAR(1)',
  dob: 'DATE', salary: 'NUMBER(9,2)', branchno: 'VARCHAR2(4)', street: 'VARCHAR2(40)', city: 'VARCHAR2(30)',
  postcode: 'VARCHAR2(10)', propertyno: 'VARCHAR2(5)', type: 'VARCHAR2(10)', rooms: 'NUMBER(2)', rent: 'NUMBER(7,2)',
  nik: 'VARCHAR2(16)', nama: 'VARCHAR2(60)', jk: 'CHAR(1)', tgl_lahir: 'DATE', desa: 'VARCHAR2(30)', status: 'VARCHAR2(10)',
  tgl_wafat: 'DATE', desa_lapor: 'VARCHAR2(30)', dari: 'VARCHAR2(20)', ke: 'VARCHAR2(20)', tgl_pindah: 'DATE',
};

/** Kunci & relasi referensial rumahsakit — dipakai lab ERD dan generator DDL. */
export const RS_KEYS = {
  pasien: { pk: ['id_pasien'], fk: [] },
  dokter: { pk: ['id_dokter'], fk: [] },
  administrator: { pk: ['id_admin'], fk: [] },
  pasien_dokter: {
    pk: ['id'],
    fk: [
      { cols: ['id_dokter'], ref: 'dokter', refCols: ['id_dokter'] },
      { cols: ['id_pasien'], ref: 'pasien', refCols: ['id_pasien'] },
    ],
  },
  dokter_admin: {
    pk: ['id_data'],
    fk: [
      { cols: ['id_dokter'], ref: 'dokter', refCols: ['id_dokter'] },
      { cols: ['id_admin'], ref: 'administrator', refCols: ['id_admin'] },
    ],
  },
  daftar: {
    pk: ['id_daftar'],
    fk: [
      { cols: ['id_pasien'], ref: 'pasien', refCols: ['id_pasien'] },
      { cols: ['id_admin'], ref: 'administrator', refCols: ['id_admin'] },
    ],
  },
};

/**
 * Kunci rumahsakit sesuai lembar Praktikum 2: setiap relasi diatur CASCADE pada
 * ON DELETE dan ON UPDATE ("pilih CASCADE pada on delete dan on update").
 * Catatan Oracle: ON UPDATE CASCADE tidak ada di Oracle; di sana perubahan kunci
 * induk harus lewat trigger atau dihindari dengan surrogate key.
 */
export const RS_KEYS_CASCADE = Object.fromEntries(Object.entries(RS_KEYS).map(([t, def]) => [t, {
  pk: [...def.pk],
  fk: def.fk.map((fk) => ({ ...fk, onDelete: 'CASCADE', onUpdate: 'CASCADE' })),
}]));

// ---------------------------------------------------------------------------
// 3) akademik — mhs / mata_kuliah / nilai (Praktikum 3, 4, 5).
//    Sengaja menyisakan mahasiswa tanpa nilai agar LEFT/RIGHT JOIN terlihat beda.
// ---------------------------------------------------------------------------

export function akademik() {
  const mhs = new Relation('mhs', ['nim', 'nama_mhs', 'alamat_mhs'], [
    ['11010011', 'Daniel Hutajulu', 'Tangerang'],
    ['11010012', 'Gita Pranata',    'Bekasi'],
    ['11010013', 'Rizky Ananda',    'Depok'],
    ['11010014', 'Sari Wulandari',  'Bogor'],
    ['11010015', 'Tomi Saputra',    'Jakarta'],
  ]);
  const mata_kuliah = new Relation('mata_kuliah', ['kode_kul', 'nama_kul', 'sks', 'sem'], [
    ['IT0401', 'Basis Data Terdistribusi', 3, 1],
    ['IT0402', 'Jaringan Komputer',        2, 1],
    ['IT0403', 'Rekayasa Informatika',     3, 2],
    ['IT0404', 'Sistem Operasi',           3, 2],
    ['IT0405', 'Etika Informatika',        2, 3],
  ]);
  const nilai = new Relation('nilai', ['nim', 'kode_kul', 'nilai'], [
    ['11010011', 'IT0401', 88],
    ['11010011', 'IT0402', 75],
    ['11010011', 'IT0403', 91],
    ['11010012', 'IT0401', 79],
    ['11010012', 'IT0404', 68],
    ['11010013', 'IT0401', 95],
    ['11010013', 'IT0405', 82],
  ]);
  return { mhs, mata_kuliah, nilai };
}

// ---------------------------------------------------------------------------
// 4) Tono Rental — kasus ERD Praktikum 1.
// ---------------------------------------------------------------------------

export const TONO_RENTAL_CASE = {
  narasi: 'Tono mendirikan rental mobil dengan NPWP. Rental bernama Tono Rental, '
        + 'Jl. Pramuka no. 36, telepon 081123123123. Rental memiliki banyak mobil '
        + '(kode_mobil, jenis_mobil, tahun_mobil, harga_sewa). Customer mendaftar '
        + '(no_ktp, nama, no_tlp, alamat) lalu menyewa mobil; pada saat menyewa '
        + 'dicatat no_sewa, tgl_sewa, tgl_kembali, denda.',
  entitas: [
    { nama: 'TONO_RENTAL', pk: 'npwp',       atribut: ['npwp', 'nama_rental', 'alamat', 'no_tlp'] },
    { nama: 'MOBIL',       pk: 'kode_mobil', atribut: ['kode_mobil', 'jenis_mobil', 'tahun_mobil', 'harga_sewa'] },
    { nama: 'CUSTOMER',    pk: 'no_ktp',     atribut: ['no_ktp', 'nama', 'no_tlp', 'alamat'] },
    { nama: 'RENTAL',      pk: 'no_sewa',    atribut: ['no_sewa', 'tgl_sewa', 'tgl_kembali', 'denda'] },
  ],
  relasi: [
    { dari: 'TONO_RENTAL', ke: 'MOBIL',    nama: 'memiliki',    kardinalitas: '1:N' },
    { dari: 'CUSTOMER',    ke: 'RENTAL',   nama: 'menyewa',     kardinalitas: '1:N' },
    { dari: 'RENTAL',      ke: 'MOBIL',    nama: 'menggunakan', kardinalitas: 'N:1' },
  ],
};

// ---------------------------------------------------------------------------
// 5) Topologi situs default — 3 kota, dipakai lab alokasi, 2PC, dan join.
// ---------------------------------------------------------------------------

export const DEFAULT_SITES = [
  { id: 'S1', nama: 'Jakarta',  kota: 'Jakarta',  biayaSimpan: 1.0, biayaProses: 1.0 },
  { id: 'S2', nama: 'Bandung',  kota: 'Bandung',  biayaSimpan: 0.8, biayaProses: 1.2 },
  { id: 'S3', nama: 'Surabaya', kota: 'Surabaya', biayaSimpan: 0.9, biayaProses: 1.1 },
];

/** Latensi (ms) dan bandwidth (Mbps) antar situs — simetris, diagonal = lokal. */
export const DEFAULT_NETWORK = {
  latency: {
    S1: { S1: 0, S2: 12, S3: 28 },
    S2: { S1: 12, S2: 0, S3: 24 },
    S3: { S1: 28, S2: 24, S3: 0 },
  },
  bandwidth: {
    S1: { S1: 10000, S2: 200, S3: 100 },
    S2: { S1: 200, S2: 10000, S3: 120 },
    S3: { S1: 100, S2: 120, S3: 10000 },
  },
};

// ---------------------------------------------------------------------------
// 6) Kependudukan — studi kasus skripsi "Implementasi Basis Data Terdistribusi
//    untuk Meningkatkan Konsistensi Data Kependudukan" (UIN Sunan Kalijaga, 2016).
//    Nama desa mengikuti skripsi; SELURUH penduduk dan NIK adalah data karangan.
//    Segmen 9999 pada NIK sengaja dipakai agar tidak mungkin bertabrakan dengan NIK asli.
// ---------------------------------------------------------------------------

export const PENDUDUK_ATTRS = ['nik', 'nama', 'jk', 'tgl_lahir', 'desa', 'status'];

export function kependudukan() {
  const karanganyar = new Relation('KARANGANYAR', PENDUDUK_ATTRS, [
    ['3305019999000001', 'Suparmi', 'P', '1968-04-12', 'Karanganyar', 'hidup'],
    ['3305019999000002', 'Wagiman', 'L', '1955-09-30', 'Karanganyar', 'hidup'],
    ['3305019999000003', 'Rohmat Hidayat', 'L', '1990-01-17', 'Karanganyar', 'hidup'],
    ['3305019999000004', 'Siti Khotijah', 'P', '1994-07-08', 'Karanganyar', 'hidup'],
    ['3305019999000005', 'Darsono', 'L', '1972-11-02', 'Karanganyar', 'hidup'],
    ['3305019999000006', 'Fitri Handayani', 'P', '2001-03-25', 'Karanganyar', 'hidup'],
  ]);
  const jatiluhur = new Relation('JATILUHUR', PENDUDUK_ATTRS, [
    ['3305019999000101', 'Sukinah', 'P', '1960-02-14', 'Jatiluhur', 'hidup'],
    ['3305019999000102', 'Mulyono', 'L', '1983-06-21', 'Jatiluhur', 'hidup'],
    ['3305019999000003', 'Rohmat Hidayat', 'L', '1990-01-17', 'Jatiluhur', 'hidup'],
    ['3305019999000104', 'Tri Wahyuni', 'P', '1999-12-30', 'Jatiluhur', 'hidup'],
    ['3305019999000005', 'Darsono Wibowo', 'L', '1972-11-20', 'Jatiluhur', 'hidup'],
  ]);
  const plarangan = new Relation('PLARANGAN', PENDUDUK_ATTRS, [
    ['3305019999000201', 'Paimin', 'L', '1949-08-05', 'Plarangan', 'hidup'],
    ['3305019999000202', 'Ngatiyem', 'P', '1952-05-19', 'Plarangan', 'hidup'],
    ['3305019999000203', 'Agus Riyanto', 'L', '1987-10-10', 'Plarangan', 'hidup'],
    ['3305019999000006', 'Fitri Handayani', 'P', '2001-03-25', 'Plarangan', 'hidup'],
  ]);
  const kematian = new Relation('KEMATIAN', ['nik', 'tgl_wafat', 'desa_lapor'], [
    ['3305019999000002', '2025-06-03', 'Karanganyar'],
    ['3305019999000201', '2025-08-11', 'Plarangan'],
  ]);
  const pindah = new Relation('PINDAH', ['nik', 'dari', 'ke', 'tgl_pindah'], [
    ['3305019999000003', 'KARANGANYAR', 'JATILUHUR', '2025-02-10'],
  ]);
  return { KARANGANYAR: karanganyar, JATILUHUR: jatiluhur, PLARANGAN: plarangan, KEMATIAN: kematian, PINDAH: pindah };
}

/** Basis data untuk bank soal: akademik + rumah sakit + alias `matakuliah` (nama tabel pada soal Praktikum 3). */
export function bankSoalDb() {
  const ak = akademik();
  return { ...ak, ...rumahsakit(), matakuliah: ak.mata_kuliah.rename('matakuliah') };
}
