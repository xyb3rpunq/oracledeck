import { grup, uji, sama, benar, memuat, tidakMemuat, melempar } from './harness.js';
import * as T from '../engine/ddb/transparency.js';

grup('ddb/transparency');

// Skema fragmentasi persis contoh Modul 6: S1 vertikal di situs 3,
// S21/S22/S23 hasil pemecahan horizontal S2 di situs 3, 5, dan 7.
const fragments = () => ([
  { nama: 'S1', tipe: 'vertikal', atribut: ['staffno', 'position', 'sex', 'dob', 'salary'], situs: '3', kunci: ['staffno'] },
  { nama: 'S21', tipe: 'campuran', atribut: ['staffno', 'fname', 'lname', 'branchno'], situs: '3', predikat: "branchno='B3'" },
  { nama: 'S22', tipe: 'campuran', atribut: ['staffno', 'fname', 'lname', 'branchno'], situs: '5', predikat: "branchno='B5'", replika: ['5', '3'] },
  { nama: 'S23', tipe: 'campuran', atribut: ['staffno', 'fname', 'lname', 'branchno'], situs: '7', predikat: "branchno='B7'" },
]);
const q = () => ({ relasiGlobal: 'Staff', pilih: ['fname', 'lname'], kondisi: "position = 'Manager'", atributKondisi: 'position' });

uji('tingkat 1 menulis kueri seperti basis data terpusat', () => {
  const lv = T.levelFragmentation(q(), fragments());
  memuat(lv.sql, 'FROM Staff');
  tidakMemuat(lv.sql, 'S21');
  tidakMemuat(lv.sql, 'SITE');
  sama(lv.jumlahFragmenDisebut, 0);
  sama(lv.jumlahSitusDisebut, 0);
});

uji('tingkat 2 menyebut nama fragmen tetapi bukan situs', () => {
  const lv = T.levelLocation(q(), fragments());
  memuat(lv.sql, 'S21');
  memuat(lv.sql, 'S22');
  memuat(lv.sql, 'S23');
  memuat(lv.sql, 'UNION');
  tidakMemuat(lv.sql, 'AT SITE');
  sama(lv.jumlahSitusDisebut, 0);
});

uji('tingkat 2 memakai subquery ke fragmen vertikal pemilik atribut kondisi', () => {
  const lv = T.levelLocation(q(), fragments());
  memuat(lv.sql, 'staffno IN (SELECT staffno FROM S1');
});

uji('kueri yang atributnya seluruhnya ada di fragmen hasil tidak butuh subquery', () => {
  const lv = T.levelLocation({ relasiGlobal: 'Staff', pilih: ['fname', 'lname'], kondisi: "branchno = 'B3'", atributKondisi: 'branchno' }, fragments());
  tidakMemuat(lv.sql, 'IN (SELECT');
});

uji('tingkat 3 menjelaskan fragmen mana yang bereplika', () => {
  const lv = T.levelReplication(q(), fragments());
  memuat(lv.catatan, 'S22');
  memuat(lv.catatan, '2 salinan');
  sama(lv.jumlahSitusDisebut, 0);
});

uji('tingkat 3 tanpa replika memberi catatan yang sesuai', () => {
  const tanpa = fragments().map((f) => ({ ...f, replika: undefined }));
  memuat(T.levelReplication(q(), tanpa).catatan, 'Tidak ada fragmen yang direplikasi');
});

uji('tingkat 4 menyebut fragmen sekaligus situs', () => {
  const lv = T.levelLocalMapping(q(), fragments());
  memuat(lv.sql, 'AT SITE 3');
  memuat(lv.sql, 'AT SITE 5');
  memuat(lv.sql, 'AT SITE 7');
  sama(lv.jumlahSitusDisebut, 3);
});

uji('tingkat 5 memakai database link Oracle', () => {
  const lv = T.levelNoTransparency(q(), fragments());
  memuat(lv.sql, '@SITE3_LINK');
  memuat(lv.sql, '@SITE5_LINK');
  memuat(lv.peringatan, 'seluruh aplikasi diubah');
});

uji('tingkat 5 menerima akhiran link kustom', () => {
  memuat(T.levelNoTransparency(q(), fragments(), { linkSuffix: 'DBL' }).sql, '@SITE3_DBL');
});

uji('ladder menghasilkan lima tingkat dengan kebocoran menaik', () => {
  const l = T.ladder(q(), fragments());
  sama(l.length, 5);
  sama(l[0].kebocoranDetail, 0);
  benar(l[1].kebocoranDetail > l[0].kebocoranDetail);
  benar(l[3].kebocoranDetail > l[1].kebocoranDetail);
  benar(l[0].panjangSql < l[1].panjangSql);
});

uji('semua tingkat menghasilkan SQL yang diakhiri titik koma', () => {
  T.ladder(q(), fragments()).forEach((lv) => memuat(lv.sql.trim().slice(-1), ';'));
});

uji('classifyDRDA mengenali keempat tingkat', () => {
  sama(T.classifyDRDA({ situsDisentuh: ['S1'], perintah: 1, adaJoinLintasSitus: false }).id, 'remote-request');
  sama(T.classifyDRDA({ situsDisentuh: ['S1'], perintah: 4, adaJoinLintasSitus: false }).id, 'remote-uow');
  sama(T.classifyDRDA({ situsDisentuh: ['S1', 'S2'], perintah: 4, adaJoinLintasSitus: false }).id, 'distributed-uow');
  sama(T.classifyDRDA({ situsDisentuh: ['S1', 'S2'], perintah: 1, adaJoinLintasSitus: true }).id, 'distributed-request');
});

uji('daftar tipe transaksi DRDA lengkap empat tingkat', () => {
  sama(T.TIPE_TRANSAKSI_DRDA.length, 4);
  sama(T.TIPE_TRANSAKSI_DRDA.map((x) => x.tingkat), [1, 2, 3, 4]);
});

uji('namingSchemes menyusun keempat pendekatan penamaan', () => {
  const n = T.namingSchemes('Branch', 'S1', { fragmen: 3, salinan: 2, pengguna: 'Manager', situsSimpan: 'glasgow' });
  sama(n.awalanSitus.nama, 'S1.Branch.F3.C2');
  sama(n.systemWideName.nama, 'Manager@S1.branch@glasgow');
  sama(n.systemWideName.bagian.length, 4);
  benar(n.terpusat.kendala.length === 3);
});

uji('namingSchemes tanpa fragmen memakai nama sederhana', () => {
  sama(T.namingSchemes('Branch', 'S1').awalanSitus.nama, 'S1.Branch');
});

uji('JENIS_TRANSPARANSI memuat empat jenis utama Modul 6', () => {
  sama(T.JENIS_TRANSPARANSI.length, 4);
  sama(T.JENIS_TRANSPARANSI.map((x) => x.id), ['distribusi', 'transaksi', 'kinerja', 'dbms']);
  benar(T.JENIS_TRANSPARANSI[0].isi.includes('Fragmentasi'));
});
