import { grup, uji, sama, benar, salah, melempar, samaAngka, memuat } from './harness.js';
import * as AV from '../engine/ddb/availability.js';

grup('ddb/availability');

uji('siteAvailability memakai rumus MTBF/(MTBF+MTTR)', () => {
  const a = AV.siteAvailability(999, 1);
  samaAngka(a.ketersediaan, 0.999, 1e-6);
  samaAngka(a.persen, 99.9, 1e-4);
  benar(a.menitPadamPerTahun > 500 && a.menitPadamPerTahun < 530);
});

uji('siteAvailability menolak MTBF nol', () => {
  melempar(() => AV.siteAvailability(0, 1), 'lebih besar dari nol');
});

uji('kelasNines menghitung jumlah sembilan', () => {
  memuat(AV.kelasNines(0.999), '3');
  sama(AV.kelasNines(1), '100%');
});

uji('parallelAvailability naik seiring jumlah replika', () => {
  samaAngka(AV.parallelAvailability([0.9]), 0.9, 1e-9);
  samaAngka(AV.parallelAvailability([0.9, 0.9]), 0.99, 1e-9);
  samaAngka(AV.parallelAvailability([0.9, 0.9, 0.9]), 0.999, 1e-9);
});

uji('seriesAvailability turun seiring jumlah komponen', () => {
  samaAngka(AV.seriesAvailability([0.9, 0.9]), 0.81, 1e-9);
  benar(AV.seriesAvailability([0.99, 0.99, 0.99]) < 0.99);
});

uji('designAvailability memisahkan baca dan tulis', () => {
  const d = AV.designAvailability({ F1: ['S1', 'S2'], F2: ['S3'] }, { S1: 0.9, S2: 0.9, S3: 0.9 });
  samaAngka(d.perFragmen.F1.ketersediaanBaca, 0.99, 1e-6);
  samaAngka(d.perFragmen.F2.ketersediaanBaca, 0.9, 1e-6);
  benar(d.tulisSerentakSemuaReplika < d.perFragmen.F2.ketersediaanBaca);
  sama(d.situsTerlibat, 3);
});

uji('designAvailability menolak situs tanpa angka ketersediaan', () => {
  melempar(() => AV.designAvailability({ F: ['SX'] }, { S1: 0.9 }), 'belum ditentukan');
});

uji('replikasi menaikkan ketersediaan baca dan menurunkan ketersediaan tulis serentak', () => {
  const satu = AV.designAvailability({ F: ['S1'] }, { S1: 0.9, S2: 0.9 });
  const dua = AV.designAvailability({ F: ['S1', 'S2'] }, { S1: 0.9, S2: 0.9 });
  benar(dua.perFragmen.F.ketersediaanBaca > satu.perFragmen.F.ketersediaanBaca);
  benar(dua.tulisSerentakSemuaReplika < satu.tulisSerentakSemuaReplika);
});

uji('quorum menyatakan konsistensi kuat bila R+W>N', () => {
  benar(AV.quorum(3, 2, 2).konsistenKuat);
  salah(AV.quorum(3, 1, 1).konsistenKuat);
  benar(AV.quorum(3, 1, 3).konsistenKuat);
});

uji('quorum menghitung toleransi kegagalan', () => {
  const q = AV.quorum(5, 3, 3);
  sama(q.tahanKegagalanBaca, 2);
  sama(q.tahanKegagalanTulis, 2);
  benar(q.tulisTerurut);
});

uji('quorum menolak nilai tidak sah', () => {
  melempar(() => AV.quorum(3, 4, 2), 'tidak sah');
  melempar(() => AV.quorum(3, 0, 2), 'tidak sah');
});

uji('quorum menyertakan tiga contoh konfigurasi', () => {
  sama(AV.quorum(3, 2, 2).contoh.length, 3);
});

uji('capAnalysis CP mengutamakan sisi mayoritas', () => {
  const c = AV.capAnalysis({ pilihan: 'CP', N: 3, partisi: [[1], [2, 3]] });
  benar(c.adaMayoritas);
  memuat(c.perilaku, 'mayoritas');
  sama(c.korban, 'Ketersediaan');
});

uji('capAnalysis CP tanpa mayoritas menolak seluruh tulis', () => {
  const c = AV.capAnalysis({ pilihan: 'CP', N: 4, partisi: [[1, 2], [3, 4]] });
  salah(c.adaMayoritas);
  memuat(c.perilaku, 'SELURUH sistem menolak');
});

uji('capAnalysis AP mengorbankan konsistensi', () => {
  sama(AV.capAnalysis({ pilihan: 'AP' }).korban, 'Konsistensi');
});

uji('capAnalysis CA menandai asumsinya tidak realistis', () => {
  memuat(AV.capAnalysis({ pilihan: 'CA' }).perilaku, 'tidak pernah terjadi');
});

uji('capAnalysis menolak pilihan asing', () => {
  melempar(() => AV.capAnalysis({ pilihan: 'XY' }), 'harus CP, AP, atau CA');
});

uji('capAnalysis menyertakan seluruh opsi untuk perbandingan', () => {
  sama(Object.keys(AV.capAnalysis({}).semuaOpsi), ['CP', 'AP', 'CA']);
});

uji('pacelc memetakan pilihan CAP ke kode PACELC', () => {
  sama(AV.pacelc('CP').kode, 'PC/EC');
  sama(AV.pacelc('AP').kode, 'PA/EL');
  memuat(AV.pacelc('CA').kode, 'tanpa P');
});

uji('rtoRpo sinkron memberi RPO nol', () => {
  const r = AV.rtoRpo({ replikasi: 'sinkron', waktuPulihMenit: 10 });
  sama(r.rpoMenit, 0);
  sama(r.rtoMenit, 10);
  memuat(r.arti, 'tidak ada transaksi yang hilang');
});

uji('rtoRpo asinkron memberi RPO kecil tapi bukan nol', () => {
  const r = AV.rtoRpo({ replikasi: 'asinkron', tundaReplikasiDetik: 30 });
  samaAngka(r.rpoMenit, 0.5, 1e-9);
});

uji('rtoRpo backup memberi RPO sebesar interval backup', () => {
  const r = AV.rtoRpo({ replikasi: 'backup', intervalBackupMenit: 120 });
  sama(r.rpoMenit, 120);
  memuat(r.arti, '120 menit');
});
