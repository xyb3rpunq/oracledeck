// praktikum.test.js — uji ujung-ke-ujung yang mereproduksi tugas praktikum
// dan contoh-contoh pada modul, supaya isi situs tidak pernah menyimpang dari materi.

import { grup, uji, sama, benar, salah, memuat, relasiSama } from './harness.js';
import { Relation } from '../engine/core/relation.js';
import { akademik, rumahsakit, dreamhome, RS_SCHEMA, RS_KEYS, TONO_RENTAL_CASE, DEFAULT_SITES, DEFAULT_NETWORK } from '../engine/data/datasets.js';
import { query } from '../engine/core/sql.js';
import * as Fg from '../engine/ddb/fragment.js';
import * as L from '../engine/ddb/localize.js';
import * as T from '../engine/ddb/transparency.js';
import * as E from '../engine/ddb/erd.js';
import * as AL from '../engine/ddb/allocate.js';
import * as O from '../engine/oracle/emit.js';

grup('dataset');

uji('rumahsakit memuat enam tabel sesuai Praktikum 2', () => {
  const db = rumahsakit();
  sama(Object.keys(db).sort(), ['administrator', 'daftar', 'dokter', 'dokter_admin', 'pasien', 'pasien_dokter']);
});

uji('skema rumahsakit memuat seluruh kolom pada lembar praktikum', () => {
  ['id_pasien', 'nama_pasien', 'alamat_pasien', 'jenis_kelamin', 'penyakit', 'no_hp'].forEach((k) => benar(RS_SCHEMA.pasien.includes(k)));
  ['id_dokter', 'nama_dokter', 'alamat_dokter', 'tanggal_lahir', 'no_hp', 'spesialis', 'waktu_kerja'].forEach((k) => benar(RS_SCHEMA.dokter.includes(k)));
  ['id_admin', 'nama_admin', 'waktu_jaga'].forEach((k) => benar(RS_SCHEMA.administrator.includes(k)));
});

uji('integritas referensial dataset rumahsakit terjaga', () => {
  const db = rumahsakit();
  for (const [tabel, def] of Object.entries(RS_KEYS)) {
    for (const fk of def.fk) {
      const induk = new Set(db[fk.ref].rows.map((r) => r[db[fk.ref].indexOf(fk.refCols[0])]));
      const i = db[tabel].indexOf(fk.cols[0]);
      db[tabel].rows.forEach((r) => benar(induk.has(r[i]), `${tabel}.${fk.cols[0]} = ${r[i]} tidak ada di ${fk.ref}`));
    }
  }
});

uji('primary key dataset rumahsakit unik', () => {
  const db = rumahsakit();
  for (const [tabel, def] of Object.entries(RS_KEYS)) {
    const i = db[tabel].indexOf(def.pk[0]);
    const nilai = db[tabel].rows.map((r) => r[i]);
    sama(nilai.length, new Set(nilai).size, `${tabel}.${def.pk[0]} tidak unik`);
  }
});

uji('dataset DreamHome sesuai contoh Modul 6 (10 staf, 3 cabang)', () => {
  const { STAFF, BRANCH } = dreamhome();
  sama(STAFF.cardinality, 10);
  sama(BRANCH.cardinality, 3);
  sama([...new Set(STAFF.rows.map((r) => r[7]))].sort(), ['B3', 'B5', 'B7']);
});

uji('dataset akademik menyisakan mahasiswa tanpa nilai agar LEFT JOIN terlihat', () => {
  const { mhs, nilai } = akademik();
  const punyaNilai = new Set(nilai.rows.map((r) => r[0]));
  benar(mhs.rows.some((r) => !punyaNilai.has(r[0])));
});

uji('topologi bawaan memuat tiga situs dan matriks jaringan simetris', () => {
  sama(DEFAULT_SITES.length, 3);
  for (const a of DEFAULT_SITES) {
    for (const b of DEFAULT_SITES) {
      sama(DEFAULT_NETWORK.latency[a.id][b.id], DEFAULT_NETWORK.latency[b.id][a.id]);
      sama(DEFAULT_NETWORK.bandwidth[a.id][b.id], DEFAULT_NETWORK.bandwidth[b.id][a.id]);
    }
  }
});

uji('latensi ke situs sendiri nol', () => {
  DEFAULT_SITES.forEach((s) => sama(DEFAULT_NETWORK.latency[s.id][s.id], 0));
});

grup('praktikum 1 — ERD Tono Rental');

uji('ERD Tono Rental memuat empat entitas dan tiga relasi', () => {
  sama(TONO_RENTAL_CASE.entitas.length, 4);
  sama(TONO_RENTAL_CASE.relasi.length, 3);
  sama(TONO_RENTAL_CASE.entitas.map((e) => e.nama), ['TONO_RENTAL', 'MOBIL', 'CUSTOMER', 'RENTAL']);
});

uji('atribut pada narasi soal semuanya termodelkan', () => {
  const semua = TONO_RENTAL_CASE.entitas.flatMap((e) => e.atribut);
  ['npwp', 'nama_rental', 'alamat', 'no_tlp', 'kode_mobil', 'jenis_mobil', 'tahun_mobil', 'harga_sewa',
    'no_ktp', 'nama', 'no_sewa', 'tgl_sewa', 'tgl_kembali', 'denda'].forEach((a) => benar(semua.includes(a), `atribut ${a} hilang`));
});

uji('ERD dikonversi menjadi empat tabel dengan foreign key yang benar', () => {
  const s = E.erdToSchema({ entitas: TONO_RENTAL_CASE.entitas, relasi: TONO_RENTAL_CASE.relasi });
  sama(s.tabel.length, 4);
  const rental = s.tabel.find((t) => t.nama === 'RENTAL');
  sama(rental.fk.map((f) => f.ref).sort(), ['CUSTOMER', 'MOBIL']);
});

grup('praktikum 2 — SQL & DML rumah sakit');

uji('SELECT sederhana dan bersyarat', () => {
  const db = rumahsakit();
  sama(query('SELECT * FROM pasien', db).cardinality, 12);
  sama(query("SELECT * FROM pasien WHERE jenis_kelamin = 'P'", db).cardinality, 6);
});

uji('UPDATE dan DELETE disimulasikan lewat aljabar relasional', () => {
  const db = rumahsakit();
  const sisa = query("SELECT * FROM pasien WHERE kota <> 'Bandung'", db);
  sama(sisa.cardinality, 8);
});

uji('join antar tabel relasi rumah sakit', () => {
  const db = rumahsakit();
  const r = query(`SELECT p.nama_pasien, d.nama_dokter, pd.waktu_periksa
                   FROM pasien p
                   JOIN pasien_dokter pd ON p.id_pasien = pd.id_pasien
                   JOIN dokter d ON pd.id_dokter = d.id_dokter`, db);
  sama(r.cardinality, 14);
});

grup('praktikum 3 — fungsi agregasi');

uji('kelima fungsi agregasi pada tabel mata_kuliah', () => {
  const db = akademik();
  sama(query('SELECT COUNT(*) FROM mata_kuliah', db).rows[0][0], 5);
  sama(query('SELECT SUM(sks) FROM mata_kuliah', db).rows[0][0], 13);
  sama(query('SELECT MIN(sks) FROM mata_kuliah', db).rows[0][0], 2);
  sama(query('SELECT MAX(sks) FROM mata_kuliah', db).rows[0][0], 3);
  sama(query('SELECT AVG(sks) FROM mata_kuliah', db).rows[0][0], 2.6);
});

uji('seluruh operator WHERE pada Tabel 3.2 modul berjalan', () => {
  const db = akademik();
  const kasus = [
    ['SELECT * FROM mata_kuliah WHERE sks = 3', 3],
    ['SELECT * FROM mata_kuliah WHERE sks <> 3', 2],
    ['SELECT * FROM mata_kuliah WHERE sks < 3', 2],
    ['SELECT * FROM mata_kuliah WHERE sks > 2', 3],
    ['SELECT * FROM mata_kuliah WHERE sks <= 2', 2],
    ['SELECT * FROM mata_kuliah WHERE sks >= 3', 3],
    ['SELECT * FROM mata_kuliah WHERE sks BETWEEN 2 AND 3', 5],
    ["SELECT * FROM mata_kuliah WHERE nama_kul LIKE '%Sistem%'", 1],
    ['SELECT * FROM mata_kuliah WHERE sem IN (1, 3)', 3],
    ['SELECT * FROM mata_kuliah WHERE NOT sem = 1', 3],
    ['SELECT * FROM mata_kuliah WHERE sem = 1 AND sks = 3', 1],
    ['SELECT * FROM mata_kuliah WHERE sem = 3 OR sks = 2', 2],
  ];
  kasus.forEach(([sql, n]) => sama(query(sql, db).cardinality, n, sql));
});

grup('praktikum 4 — query dari relasi tabel');

uji('menampilkan nama mahasiswa dan nilai untuk mata kuliah IT0401', () => {
  const r = query("SELECT mhs.nama_mhs, nilai.nilai FROM mhs, nilai WHERE mhs.nim = nilai.nim AND nilai.kode_kul = 'IT0401'", akademik());
  sama(r.rows, [['Daniel Hutajulu', 88], ['Gita Pranata', 79], ['Rizky Ananda', 95]]);
});

uji('menampilkan nama mata kuliah, nama mahasiswa, dan nilai terurut menaik', () => {
  const r = query(`SELECT k.nama_kul, m.nama_mhs, n.nilai
                   FROM mhs m, nilai n, mata_kuliah k
                   WHERE m.nim = n.nim AND n.kode_kul = k.kode_kul
                   ORDER BY n.nilai ASC`, akademik());
  sama(r.cardinality, 7);
  sama(r.rows[0][2], 68);
  sama(r.rows[6][2], 95);
});

grup('praktikum 5 — JOIN');

uji('inner join dan join gaya WHERE memberi hasil identik', () => {
  const db = akademik();
  const a = query('SELECT m.nama_mhs, n.kode_kul, n.nilai FROM mhs m JOIN nilai n ON m.nim = n.nim', db);
  const b = query('SELECT m.nama_mhs, n.kode_kul, n.nilai FROM mhs m, nilai n WHERE m.nim = n.nim', db);
  relasiSama(a, b);
});

uji('left join menampilkan mahasiswa tanpa nilai sebagai NULL', () => {
  const r = query('SELECT m.nama_mhs, n.nilai FROM mhs m LEFT JOIN nilai n ON m.nim = n.nim', akademik());
  sama(r.cardinality, 9);
  sama(r.rows.filter((x) => x[1] === null).length, 2);
});

uji('right join menampilkan seluruh baris nilai', () => {
  const r = query('SELECT m.nama_mhs, n.nilai FROM mhs m RIGHT JOIN nilai n ON m.nim = n.nim', akademik());
  sama(r.cardinality, 7);
  salah(r.rows.some((x) => x[1] === null));
});

uji('union menggabungkan dua hasil query', () => {
  const r = query("SELECT nama_mhs AS nama FROM mhs WHERE alamat_mhs = 'Bekasi' UNION SELECT nama_kul FROM mata_kuliah WHERE sks = 2", akademik());
  sama(r.cardinality, 3);
});

grup('modul 6 & 7 — contoh fragmentasi dan transparansi');

uji('skema fragmentasi S1/S21/S22/S23 persis seperti modul', () => {
  const { STAFF } = dreamhome();
  const f = Fg.mixed(STAFF, {
    key: 'staffno',
    verticalGroups: [
      { nama: 'S1', atribut: ['position', 'sex', 'dob', 'salary'] },
      { nama: 'S2', atribut: ['fname', 'lname', 'branchno', 'sex', 'dob', 'salary'] },
    ],
    horizontalOn: 'branchno',
    targetFragment: 'S2',
  });
  sama(f.map((x) => x.nama), ['S1', 'S21', 'S22', 'S23']);
  benar(f[1].teks.includes('B3'));
  benar(f[2].teks.includes('B5'));
  benar(f[3].teks.includes('B7'));
});

uji('kueri transparansi fragmentasi memberi hasil yang sama dengan kueri global', () => {
  const { STAFF } = dreamhome();
  const global = query("SELECT fname, lname FROM STAFF WHERE position = 'Manager'", { STAFF });
  sama(global.cardinality, 3);
  const h = Fg.horizontalByAttribute(STAFF, 'branchno', { prefix: 'S2' });
  const dbFrag = Object.fromEntries(h.map((f) => [f.nama, f.relasi]));
  const lokal = query(`SELECT fname, lname FROM S21 WHERE position = 'Manager'
                       UNION SELECT fname, lname FROM S22 WHERE position = 'Manager'
                       UNION SELECT fname, lname FROM S23 WHERE position = 'Manager'`, dbFrag);
  relasiSama(lokal, global);
});

uji('tangga transparansi menghasilkan SQL yang makin panjang', () => {
  const fragments = [
    { nama: 'S1', tipe: 'vertikal', atribut: ['staffno', 'position'], situs: '3', kunci: ['staffno'] },
    { nama: 'S21', tipe: 'campuran', atribut: ['staffno', 'fname', 'lname'], situs: '3' },
    { nama: 'S22', tipe: 'campuran', atribut: ['staffno', 'fname', 'lname'], situs: '5' },
  ];
  const l = T.ladder({ relasiGlobal: 'Staff', pilih: ['fname', 'lname'], kondisi: "position = 'Manager'", atributKondisi: 'position' }, fragments);
  benar(l[0].panjangSql < l[1].panjangSql);
  benar(l[1].panjangSql < l[3].panjangSql);
});

uji('reduksi lokalisasi tidak pernah mengubah hasil kueri', () => {
  const { STAFF } = dreamhome();
  const h = Fg.horizontalByAttribute(STAFF, 'branchno', { prefix: 'S' })
    .map((f, i) => ({ ...f, konjungsi: [L.atom('branchno', '=', ['B3', 'B5', 'B7'][i])] }));
  for (const b of ['B3', 'B5', 'B7', 'B9']) {
    const v = L.verifyReduction(STAFF, h, [L.atom('branchno', '=', b)]);
    benar(v.setara, `reduksi untuk ${b} mengubah hasil`);
  }
});

grup('rantai penuh: ERD -> skema -> fragmentasi -> alokasi -> DDL Oracle');

uji('rancangan rumah sakit dapat ditempuh dari ERD sampai DDL Oracle', () => {
  const db = rumahsakit();

  // 1. fragmentasi horizontal per kota
  const frag = Fg.horizontalByAttribute(db.pasien, 'kota', { prefix: 'PASIEN_' });
  sama(frag.length, 3);
  benar(Fg.auditFragmentation(db.pasien, frag).valid);

  // 2. alokasi ke situs terdekat
  const input = {
    fragmen: frag.map((f) => ({ nama: f.nama, ukuranKB: f.relasi.cardinality * 2 })),
    situs: DEFAULT_SITES.map((s) => ({ ...s, keandalan: 0.97 })),
    jaringan: DEFAULT_NETWORK,
    queries: frag.map((f, i) => ({
      nama: `Q${i + 1}`,
      situsAsal: DEFAULT_SITES[i].id,
      baca: { [f.nama]: 200 },
      perbarui: { [f.nama]: 40 },
    })),
  };
  const opt = AL.optimalAllocation(input);
  frag.forEach((f, i) => sama(opt.alokasi[f.nama], [DEFAULT_SITES[i].id], `${f.nama} seharusnya di ${DEFAULT_SITES[i].id}`));

  // 3. DDL Oracle dengan partisi per situs
  const ddl = O.horizontalAsPartitions(db.pasien, 'kota', frag.map((f, i) => ({
    nama: `P_${DEFAULT_SITES[i].kota.toUpperCase()}`,
    nilai: [DEFAULT_SITES[i].kota],
    situs: DEFAULT_SITES[i].id,
  })), { pk: ['id_pasien'] });
  memuat(ddl, 'PARTITION P_JAKARTA');
  memuat(ddl, 'TABLESPACE TS_S3');
});
