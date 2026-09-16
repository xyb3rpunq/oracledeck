import { grup, uji, sama, benar, salah, melempar, memuat } from './harness.js';
import { TONO_RENTAL_CASE } from '../engine/data/datasets.js';
import * as E from '../engine/ddb/erd.js';

grup('ddb/erd');

const tono = () => ({ entitas: TONO_RENTAL_CASE.entitas, relasi: TONO_RENTAL_CASE.relasi });

uji('validateERD meloloskan kasus Tono Rental', () => {
  const v = E.validateERD(tono());
  benar(v.valid);
  sama(v.masalah.filter((m) => m.tingkat === 'galat'), []);
});

uji('validateERD menolak entitas tanpa primary key', () => {
  const v = E.validateERD({ entitas: [{ nama: 'X', atribut: ['a'] }], relasi: [] });
  salah(v.valid);
  memuat(v.masalah[0].pesan, 'tidak punya primary key');
});

uji('validateERD menolak PK yang tidak terdaftar sebagai atribut', () => {
  const v = E.validateERD({ entitas: [{ nama: 'X', pk: 'id', atribut: ['a'] }], relasi: [] });
  salah(v.valid);
  memuat(v.masalah[0].pesan, 'tidak terdaftar');
});

uji('validateERD menolak nama entitas ganda', () => {
  const v = E.validateERD({ entitas: [{ nama: 'X', pk: 'a', atribut: ['a'] }, { nama: 'X', pk: 'b', atribut: ['b'] }], relasi: [] });
  salah(v.valid);
  benar(v.masalah.some((m) => m.pesan.includes('ganda')));
});

uji('validateERD menolak relasi ke entitas yang tidak ada', () => {
  const v = E.validateERD({ entitas: [{ nama: 'X', pk: 'a', atribut: ['a'] }], relasi: [{ dari: 'X', ke: 'Y', nama: 'r', kardinalitas: '1:N' }] });
  salah(v.valid);
  memuat(v.masalah[0].pesan, 'tidak ada');
});

uji('validateERD menolak kardinalitas asing', () => {
  const v = E.validateERD({
    entitas: [{ nama: 'X', pk: 'a', atribut: ['a'] }, { nama: 'Y', pk: 'b', atribut: ['b'] }],
    relasi: [{ dari: 'X', ke: 'Y', nama: 'r', kardinalitas: '7:7' }],
  });
  salah(v.valid);
  memuat(v.masalah[0].pesan, 'tidak dikenal');
});

uji('validateERD memperingatkan entitas yatim', () => {
  const v = E.validateERD({
    entitas: [{ nama: 'X', pk: 'a', atribut: ['a'] }, { nama: 'Y', pk: 'b', atribut: ['b'] }, { nama: 'Z', pk: 'c', atribut: ['c'] }],
    relasi: [{ dari: 'X', ke: 'Y', nama: 'r', kardinalitas: '1:N' }],
  });
  benar(v.valid);
  benar(v.masalah.some((m) => m.tingkat === 'peringatan' && m.pesan.includes('Z')));
});

uji('validateERD menolak entitas lemah tanpa induk', () => {
  const v = E.validateERD({ entitas: [{ nama: 'X', pk: 'a', atribut: ['a'], lemah: true }], relasi: [] });
  salah(v.valid);
  memuat(v.masalah[0].pesan, 'entitas induknya');
});

uji('erdToSchema menghasilkan empat tabel untuk Tono Rental', () => {
  const s = E.erdToSchema(tono());
  sama(s.tabel.map((t) => t.nama), ['TONO_RENTAL', 'MOBIL', 'CUSTOMER', 'RENTAL']);
});

uji('relasi 1:N menanam kunci di sisi banyak', () => {
  const s = E.erdToSchema(tono());
  const mobil = s.tabel.find((t) => t.nama === 'MOBIL');
  benar(mobil.kolom.includes('npwp'));
  sama(mobil.fk[0].ref, 'TONO_RENTAL');
});

uji('relasi N:1 juga menanam kunci di sisi banyak', () => {
  const s = E.erdToSchema(tono());
  const rental = s.tabel.find((t) => t.nama === 'RENTAL');
  benar(rental.kolom.includes('kode_mobil'));
  benar(rental.kolom.includes('no_ktp'));
  sama(rental.fk.length, 2);
});

uji('relasi N:M menjadi tabel penghubung dengan kunci gabungan', () => {
  const s = E.erdToSchema({
    entitas: [
      { nama: 'MHS', pk: 'nim', atribut: ['nim', 'nama'] },
      { nama: 'MK', pk: 'kode', atribut: ['kode', 'judul'] },
    ],
    relasi: [{ dari: 'MHS', ke: 'MK', nama: 'NILAI', kardinalitas: 'N:M', atribut: ['nilai'] }],
  });
  const n = s.tabel.find((t) => t.nama === 'NILAI');
  sama(n.pk, ['nim', 'kode']);
  benar(n.kolom.includes('nilai'));
  sama(n.fk.length, 2);
  sama(n.asal, 'relasi N:M');
});

uji('relasi 1:1 memakai foreign key unik', () => {
  const s = E.erdToSchema({
    entitas: [
      { nama: 'PEGAWAI', pk: 'nip', atribut: ['nip', 'nama'] },
      { nama: 'LOKER', pk: 'kode_loker', atribut: ['kode_loker'] },
    ],
    relasi: [{ dari: 'PEGAWAI', ke: 'LOKER', nama: 'punya', kardinalitas: '1:1' }],
  });
  const loker = s.tabel.find((t) => t.nama === 'LOKER');
  benar(loker.kolom.includes('nip'));
  benar(loker.fk[0].unik);
});

uji('atribut multinilai dipisah menjadi tabel sendiri (syarat 1NF)', () => {
  const s = E.erdToSchema({
    entitas: [{ nama: 'MHS', pk: 'nim', atribut: ['nim', 'nama', 'hobi'], multinilai: ['hobi'] }],
    relasi: [],
  });
  const mhs = s.tabel.find((t) => t.nama === 'MHS');
  salah(mhs.kolom.includes('hobi'));
  const hobi = s.tabel.find((t) => t.nama === 'MHS_hobi');
  sama(hobi.pk, ['nim', 'hobi']);
  benar(s.jejak.some((j) => j.includes('1NF')));
});

uji('entitas lemah memakai kunci gabungan dengan induknya', () => {
  const s = E.erdToSchema({
    entitas: [
      { nama: 'FAKTUR', pk: 'no_faktur', atribut: ['no_faktur', 'tanggal'] },
      { nama: 'BARIS', pk: 'no_baris', atribut: ['no_baris', 'jumlah'], lemah: true, induk: 'FAKTUR' },
    ],
    relasi: [{ dari: 'FAKTUR', ke: 'BARIS', nama: 'berisi', kardinalitas: '1:N' }],
  });
  const baris = s.tabel.find((t) => t.nama === 'BARIS');
  sama(baris.pk, ['no_faktur', 'no_baris']);
});

uji('erdToSchema menolak ERD yang tidak sah', () => {
  melempar(() => E.erdToSchema({ entitas: [{ nama: 'X', atribut: ['a'] }], relasi: [] }), 'belum sah');
});

uji('jejak transformasi menjelaskan setiap langkah', () => {
  const s = E.erdToSchema(tono());
  benar(s.jejak.length >= 7);
  benar(s.jejak.some((j) => j.includes('foreign key')));
});

uji('urutkanMenurutKetergantungan menaruh tabel rujukan lebih dulu', () => {
  const s = E.erdToSchema(tono());
  const urut = E.urutkanMenurutKetergantungan(s.tabel).map((t) => t.nama);
  benar(urut.indexOf('TONO_RENTAL') < urut.indexOf('MOBIL'));
  benar(urut.indexOf('MOBIL') < urut.indexOf('RENTAL'));
  benar(urut.indexOf('CUSTOMER') < urut.indexOf('RENTAL'));
});

uji('urutkanMenurutKetergantungan tidak macet pada rujukan melingkar', () => {
  const tabel = [
    { nama: 'A', kolom: ['a', 'b'], pk: ['a'], fk: [{ cols: ['b'], ref: 'B', refCols: ['b'] }] },
    { nama: 'B', kolom: ['b', 'a'], pk: ['b'], fk: [{ cols: ['a'], ref: 'A', refCols: ['a'] }] },
  ];
  sama(E.urutkanMenurutKetergantungan(tabel).length, 2);
});

uji('schemaToOracle menghasilkan DDL yang lengkap', () => {
  const ddl = E.schemaToOracle(E.erdToSchema(tono()));
  memuat(ddl, 'CREATE TABLE TONO_RENTAL');
  memuat(ddl, 'CONSTRAINT PK_RENTAL PRIMARY KEY (NO_SEWA)');
  memuat(ddl, 'REFERENCES CUSTOMER (NO_KTP)');
  memuat(ddl, 'ON DELETE CASCADE');
  sama((ddl.match(/CREATE TABLE/g) || []).length, 4);
});

uji('schemaToOracle menebak tipe kolom yang masuk akal', () => {
  const ddl = E.schemaToOracle(E.erdToSchema(tono()));
  memuat(ddl, 'TGL_SEWA             DATE');
  memuat(ddl, 'TAHUN_MOBIL          NUMBER(4)');
  memuat(ddl, 'NO_KTP               VARCHAR2(20)');
  memuat(ddl, 'HARGA_SEWA           NUMBER(12,2)');
});

uji('schemaToOracle menerima pemetaan tipe kustom', () => {
  const ddl = E.schemaToOracle(E.erdToSchema(tono()), { tipe: { denda: 'NUMBER(10)' } });
  memuat(ddl, 'DENDA                NUMBER(10)');
});

uji('erdToText menggambar entitas dan relasi', () => {
  const t = E.erdToText(tono());
  memuat(t, 'npwp [PK]');
  memuat(t, 'TONO_RENTAL --< memiliki >-- MOBIL   [1:N]');
});

uji('erdToMermaid menghasilkan sintaks erDiagram', () => {
  const m = E.erdToMermaid(tono());
  memuat(m, 'erDiagram');
  memuat(m, '||--o{');
  memuat(m, 'string npwp PK');
});
