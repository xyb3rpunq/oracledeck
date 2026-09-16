// upgrade.test.js — uji untuk fungsi yang ditambahkan pada putaran upgrade:
// integritas lintas situs, penilai bank soal, gateway ODBC di 2PC/3PC,
// fase 4 pada 2PC, dan parser jadwal yang ketat.

import { grup, uji, sama, benar, salah, melempar, memuat } from './harness.js';
import { Relation } from '../engine/core/relation.js';
import { kependudukan, bankSoalDb, PENDUDUK_ATTRS } from '../engine/data/datasets.js';
import * as I from '../engine/ddb/integrity.js';
import * as G from '../engine/core/grader.js';
import * as TP from '../engine/ddb/twophase.js';
import * as C from '../engine/ddb/concurrency.js';
import { BANK_SOAL, JUDUL_PRAKTIKUM } from '../src/content/soal.js';

const desa = () => {
  const d = kependudukan();
  return ['KARANGANYAR', 'JATILUHUR', 'PLARANGAN'].map((n) => ({ nama: n, relasi: d[n] }));
};

grup('upgrade — dataset kependudukan');

uji('tiga desa, catatan kematian, dan catatan pindah tersedia', () => {
  const d = kependudukan();
  sama(Object.keys(d).sort(), ['JATILUHUR', 'KARANGANYAR', 'KEMATIAN', 'PINDAH', 'PLARANGAN']);
  sama(d.KARANGANYAR.attrs, PENDUDUK_ATTRS);
});

uji('seluruh NIK memakai segmen 9999 agar mustahil bertabrakan dengan NIK asli', () => {
  const d = kependudukan();
  for (const n of ['KARANGANYAR', 'JATILUHUR', 'PLARANGAN', 'KEMATIAN', 'PINDAH']) {
    const i = d[n].indexOf('nik');
    d[n].rows.forEach((r) => {
      sama(String(r[i]).length, 16, `panjang NIK ${r[i]}`);
      memuat(String(r[i]).slice(6, 10), '9999');
    });
  }
});

grup('upgrade — integritas lintas situs');

uji('localUniqueCheck lulus pada setiap desa', () => {
  desa().forEach((f) => benar(I.localUniqueCheck(f, 'nik').lulus, f.nama));
});

uji('localUniqueCheck menangkap NIK ganda di dalam satu situs', () => {
  const r = new Relation('X', ['nik'], [['1'], ['1'], ['2']]);
  const hasil = I.localUniqueCheck({ nama: 'X', relasi: r }, 'nik');
  salah(hasil.lulus);
  sama(hasil.ganda, ['1']);
});

uji('localUniqueCheck menolak kolom yang tidak ada', () => {
  melempar(() => I.localUniqueCheck(desa()[0], 'nomor'), 'tidak ada');
});

uji('globalUniqueViolations menemukan NIK ganda yang lolos seluruh pemeriksaan lokal', () => {
  const g = I.globalUniqueViolations(desa(), 'nik', { abaikan: ['desa'] });
  salah(g.lulus);
  sama(g.temuan.length, 3);
  sama(g.identik, 2);
  sama(g.konflik, 1);
});

uji('konflik isi melaporkan atribut yang berbeda', () => {
  const g = I.globalUniqueViolations(desa(), 'nik', { abaikan: ['desa'] });
  const k = g.temuan.find((t) => t.jenis === 'konflik');
  sama(k.nilai, '3305019999000005');
  sama(k.atributBerbeda, ['nama', 'tgl_lahir']);
  sama(k.situs, ['KARANGANYAR', 'JATILUHUR']);
});

uji('tanpa mengabaikan kolom desa, salinan identik terbaca sebagai konflik', () => {
  const g = I.globalUniqueViolations(desa(), 'nik');
  sama(g.identik, 0);
  sama(g.konflik, 3);
});

uji('consistencyReport memadukan data desa dengan catatan kecamatan', () => {
  const d = kependudukan();
  const lap = I.consistencyReport({ fragmen: desa(), kematian: d.KEMATIAN, pindah: d.PINDAH });
  benar(lap.lokalLulusSemua);
  salah(lap.konsisten);
  const jenis = lap.masalah.map((m) => m.jenis);
  sama(jenis.filter((j) => j === 'Meninggal masih aktif').length, 2);
  sama(jenis.filter((j) => j === 'Pindah belum dihapus').length, 1);
  sama(jenis.filter((j) => j.startsWith('NIK ganda')).length, 2);
  sama(lap.totalBaris, 15);
  sama(lap.nikUnik, 12);
  sama(lap.barisBerlebih, 3);
});

uji('NIK ganda yang dijelaskan catatan pindah tidak dilaporkan dua kali', () => {
  const d = kependudukan();
  const lap = I.consistencyReport({ fragmen: desa(), kematian: d.KEMATIAN, pindah: d.PINDAH });
  const soalPindah = lap.masalah.filter((m) => m.nik === '3305019999000003');
  sama(soalPindah.length, 1);
  sama(soalPindah[0].jenis, 'Pindah belum dihapus');
});

uji('consistencyReport tanpa catatan peristiwa hanya memeriksa keunikan', () => {
  const lap = I.consistencyReport({ fragmen: desa() });
  benar(lap.masalah.every((m) => m.jenis.startsWith('NIK ganda')));
  sama(lap.masalah.length, 3);
});

uji('data yang bersih dinyatakan konsisten', () => {
  const bersih = [
    { nama: 'A', relasi: new Relation('A', PENDUDUK_ATTRS, [['1', 'x', 'L', '2000-01-01', 'A', 'hidup']]) },
    { nama: 'B', relasi: new Relation('B', PENDUDUK_ATTRS, [['2', 'y', 'P', '2000-01-01', 'B', 'hidup']]) },
  ];
  benar(I.consistencyReport({ fragmen: bersih }).konsisten);
});

uji('reconciliationPlan memisahkan tindakan otomatis dari verifikasi manual', () => {
  const d = kependudukan();
  const plan = I.reconciliationPlan(I.consistencyReport({ fragmen: desa(), kematian: d.KEMATIAN, pindah: d.PINDAH }));
  sama(plan.otomatis.length, 3);
  sama(plan.manual.length, 2);
  benar(plan.manual.some((m) => m.jenis === 'NIK ganda (isi berbeda)'));
  benar(plan.otomatis.every((m) => m.jenis !== 'NIK ganda (isi berbeda)'), 'konflik isi tidak boleh diputuskan mesin');
});

uji('enforcementStrategies menunjukkan pertukaran ketersediaan dan jendela inkonsistensi', () => {
  const [sinkron, terpusat, asinkron] = I.enforcementStrategies({ jumlahSitus: 3, ketersediaanSitus: 0.98, intervalRekonsiliasiJam: 12 });
  sama(sinkron.id, 'sinkron');
  benar(sinkron.ketersediaanInsert < terpusat.ketersediaanInsert);
  benar(terpusat.ketersediaanInsert < asinkron.ketersediaanInsert);
  sama(asinkron.jendelaInkonsistensiJam, 12);
  sama(sinkron.jendelaInkonsistensiJam, 0);
  sama(asinkron.latensiTambahanMs, 0);
  benar(sinkron.latensiTambahanMs > terpusat.latensiTambahanMs);
});

uji('ketersediaan cek sinkron turun saat situs bertambah', () => {
  const tiga = I.enforcementStrategies({ jumlahSitus: 3 })[0].ketersediaanInsert;
  const tujuh = I.enforcementStrategies({ jumlahSitus: 7 })[0].ketersediaanInsert;
  benar(tujuh < tiga);
});

uji('oracleDuplicateSql menyusun UNION ALL lintas database link', () => {
  const sql = I.oracleDuplicateSql([{ nama: 'Karanganyar' }, { nama: 'Jatiluhur', link: 'DESA_JATILUHUR' }]);
  memuat(sql, 'FROM PENDUDUK@DESA_JATILUHUR');
  memuat(sql, 'UNION ALL');
  memuat(sql, 'HAVING COUNT(*) > 1');
});

grup('upgrade — penilai bank soal');

const db = () => bankSoalDb();

uji('bankSoalDb menyediakan alias matakuliah sesuai soal Praktikum 3', () => {
  const d = db();
  benar('matakuliah' in d && 'mata_kuliah' in d);
  sama(d.matakuliah.cardinality, d.mata_kuliah.cardinality);
});

uji('setiap kunci bank soal dapat dijalankan dan lulus terhadap dirinya sendiri', () => {
  for (const s of BANK_SOAL) {
    const r = G.gradeQuery(s.kunci, s.kunci, db());
    benar(r.benar, `${s.id}: ${r.alasan.join('; ')}`);
  }
});

uji('id bank soal unik dan setiap praktikum punya judul', () => {
  const id = BANK_SOAL.map((s) => s.id);
  sama(id.length, new Set(id).size);
  BANK_SOAL.forEach((s) => benar(Boolean(JUDUL_PRAKTIKUM[s.praktikum]), s.id));
});

uji('ke-12 soal Praktikum 3 dari dokumen tugas tercakup', () => {
  benar(BANK_SOAL.filter((s) => s.praktikum === 3).length >= 12);
});

uji('jawaban berbeda teks tetapi setara hasil dinilai benar', () => {
  const kunci = BANK_SOAL.find((s) => s.id === 'p3-02').kunci;
  sama(G.gradeQuery('SELECT * FROM matakuliah WHERE NOT sem = 1', kunci, db()).skor, 100);
  sama(G.gradeQuery('SELECT * FROM mata_kuliah WHERE sem != 1', kunci, db()).skor, 100);
});

uji('nama alias berbeda tidak mengurangi nilai tetapi diberi catatan', () => {
  const kunci = BANK_SOAL.find((s) => s.id === 'p3-11').kunci;
  const r = G.gradeQuery('SELECT MIN(sks) a, MAX(sks) b, AVG(sks) c FROM matakuliah', kunci, db());
  benar(r.benar);
  benar(r.petunjuk.some((p) => p.includes('nama kolom')));
});

uji('baris berlebih diberi nilai sebagian dan petunjuk WHERE', () => {
  const kunci = BANK_SOAL.find((s) => s.id === 'p3-01').kunci;
  const r = G.gradeQuery('SELECT * FROM matakuliah', kunci, db());
  salah(r.benar);
  benar(r.skor > 0 && r.skor < 100);
  benar(r.petunjuk.some((p) => p.includes('WHERE')));
});

uji('jumlah kolom yang salah dilaporkan', () => {
  const kunci = BANK_SOAL.find((s) => s.id === 'p3-01').kunci;
  const r = G.gradeQuery('SELECT kode_kul FROM matakuliah WHERE sem = 1', kunci, db());
  salah(r.benar);
  benar(r.alasan.some((a) => a.includes('Jumlah kolom')));
});

uji('urutan dinilai hanya bila kunci memakai ORDER BY', () => {
  const kunciUrut = BANK_SOAL.find((s) => s.id === 'p4-04').kunci;
  const tanpaUrut = 'SELECT k.nama_kul, m.nama_mhs, n.nilai FROM mhs m, nilai n, mata_kuliah k WHERE m.nim = n.nim AND n.kode_kul = k.kode_kul';
  const r = G.gradeQuery(tanpaUrut, kunciUrut, db());
  sama(r.skor, 85);
  benar(r.alasan.some((a) => a.includes('urutan')));
  const kunciBebas = BANK_SOAL.find((s) => s.id === 'p4-03').kunci;
  sama(G.gradeQuery(`${tanpaUrut} ORDER BY n.nilai DESC`, kunciBebas, db()).skor, 100);
});

uji('kueri yang galat bernilai nol dengan pesan galatnya', () => {
  const r = G.gradeQuery('SELECT * FROM tabel_hantu', BANK_SOAL[0].kunci, db());
  sama(r.skor, 0);
  memuat(r.galat, 'tidak ada');
});

uji('jawaban kosong bernilai nol', () => {
  const r = G.gradeQuery('   ', BANK_SOAL[0].kunci, db());
  sama(r.skor, 0);
  memuat(r.alasan[0], 'kosong');
});

uji('perbedaan angka 3 dan 3.0 tidak dianggap salah', () => {
  const r = G.gradeQuery('SELECT SUM(sks) * 1.0 FROM matakuliah', 'SELECT SUM(sks) FROM matakuliah', db());
  benar(r.benar);
});

uji('punyaOrderBy membaca AST, termasuk cabang UNION', () => {
  benar(G.punyaOrderBy('SELECT a FROM t ORDER BY a'));
  salah(G.punyaOrderBy('SELECT a FROM t'));
  salah(G.punyaOrderBy("SELECT 'order by' FROM t"));
});

uji('gradeAll menghitung nilai akhir', () => {
  const dua = BANK_SOAL.slice(0, 2);
  const r = G.gradeAll({ [dua[0].id]: dua[0].kunci }, dua, db());
  sama(r.benar, 1);
  sama(r.jumlah, 2);
  sama(r.nilai, 50);
});

grup('upgrade — gateway ODBC pada 2PC/3PC');

const pesertaHeterogen = (voteAbort = false) => ([
  { id: 'Kecamatan (Oracle)' },
  { id: 'Desa Jatiluhur (MySQL)', gateway: true },
  { id: 'Desa Plarangan (Oracle)', vote: voteAbort ? 'ABORT' : 'COMMIT' },
]);

uji('peserta gateway commit sebelum PREPARE dan tidak menerima PREPARE', () => {
  const r = TP.runTwoPhaseCommit({ peserta: pesertaHeterogen() });
  const t = TP.jejakToText(r);
  memuat(t, 'UPDATE langsung di-commit');
  memuat(t, '(tidak ada PREPARE)');
  benar(!r.jejak.some((l) => l.ke === 'Desa Jatiluhur (MySQL)' && l.pesan === 'PREPARE'));
  sama(r.gateway, ['Desa Jatiluhur (MySQL)']);
});

uji('keputusan ABORT dengan peserta gateway menghasilkan hasil campuran', () => {
  const r = TP.runTwoPhaseCommit({ peserta: pesertaHeterogen(true) });
  sama(r.keputusan, 'GLOBAL-ABORT');
  benar(r.hasilCampuran);
  sama(r.keadaanAkhir['Desa Jatiluhur (MySQL)'], TP.KEADAAN.COMMIT);
  sama(r.keadaanAkhir['Kecamatan (Oracle)'], TP.KEADAAN.ABORT);
  benar(r.analisis.some((a) => a.includes('HASIL CAMPURAN')));
});

uji('keputusan COMMIT dengan peserta gateway selamat, tetapi diberi peringatan', () => {
  const r = TP.runTwoPhaseCommit({ peserta: pesertaHeterogen() });
  salah(r.hasilCampuran);
  benar(r.analisis.some((a) => a.includes('Kebetulan selamat')));
});

uji('koordinator jatuh dengan peserta gateway tetap berisiko campuran', () => {
  const r = TP.runTwoPhaseCommit({ peserta: pesertaHeterogen(), koordinatorJatuhPada: 3 });
  benar(r.memblokir);
  benar(r.hasilCampuran);
});

uji('3PC pun tidak dapat menarik kembali perubahan gateway', () => {
  const c = TP.compareProtocols({ peserta: pesertaHeterogen(true) });
  benar(c.duaFase.hasilCampuran);
  benar(c.tigaFase.hasilCampuran);
  memuat(c.kesimpulan, 'masalahnya ada pada gateway');
});

uji('nomor langkah jejak tetap berurutan setelah entri gateway disisipkan', () => {
  const r = TP.runThreePhaseCommit({ peserta: pesertaHeterogen() });
  r.jejak.forEach((l, i) => sama(l.t, i + 1));
});

uji('tanpa peserta gateway perilaku protokol tidak berubah', () => {
  const r = TP.runTwoPhaseCommit({ peserta: [{ id: 'A' }, { id: 'B' }] });
  salah(r.hasilCampuran);
  sama(r.gateway, []);
  sama(r.keputusan, 'GLOBAL-COMMIT');
});

grup('upgrade — semantik fase 4 & parser jadwal');

uji('2PC dengan koordinator jatuh pada fase 4 tidak memblokir dan dijelaskan', () => {
  const r = TP.runTwoPhaseCommit({ peserta: [{ id: 'A' }, { id: 'B' }], koordinatorJatuhPada: 4 });
  salah(r.memblokir);
  sama(r.keputusan, 'GLOBAL-COMMIT');
  sama(r.keadaanAkhir.Koordinator, TP.KEADAAN.DOWN);
  benar(r.analisis.some((a) => a.includes('tidak punya fase PRE-COMMIT')));
});

uji('parser jadwal menolak token asing alih-alih mengabaikannya', () => {
  melempar(() => C.parseSchedule('hello r1[x] c1'), 'Token "hello"');
  melempar(() => C.parseSchedule('r1[x] x9 c1'), 'Token "x9"');
});

uji('parser jadwal menolak commit yang menyebut item', () => {
  melempar(() => C.parseSchedule('r1[x] c1[x]'), 'tidak menyebut item');
});

uji('parser jadwal menerima pemisah koma dan titik koma', () => {
  sama(C.parseSchedule('r1[x], w2[x]; c1 c2').length, 4);
});
