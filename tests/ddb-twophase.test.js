import { grup, uji, sama, benar, salah, memuat, tidakMemuat } from './harness.js';
import * as TP from '../engine/ddb/twophase.js';

grup('ddb/twophase — 2PC');

const peserta = () => ([{ id: 'Jakarta' }, { id: 'Bandung' }, { id: 'Surabaya' }]);

uji('jalur normal berakhir GLOBAL-COMMIT di semua situs', () => {
  const r = TP.runTwoPhaseCommit({ peserta: peserta() });
  sama(r.keputusan, 'GLOBAL-COMMIT');
  salah(r.memblokir);
  Object.values(r.keadaanAkhir).forEach((v) => sama(v, TP.KEADAAN.COMMIT));
});

uji('satu suara ABORT membatalkan seluruh transaksi', () => {
  const r = TP.runTwoPhaseCommit({ peserta: [{ id: 'A' }, { id: 'B', vote: 'ABORT' }, { id: 'C' }] });
  sama(r.keputusan, 'GLOBAL-ABORT');
  Object.values(r.keadaanAkhir).forEach((v) => sama(v, TP.KEADAAN.ABORT));
  benar(r.analisis.some((a) => a.includes('semua atau tidak sama sekali')));
});

uji('peserta yang diam membuat koordinator timeout lalu abort', () => {
  const r = TP.runTwoPhaseCommit({ peserta: [{ id: 'A' }, { id: 'B', jatuhPada: 2 }] });
  sama(r.keputusan, 'GLOBAL-ABORT');
  sama(r.keadaanAkhir.B, TP.KEADAAN.DOWN);
  sama(r.suara.B, 'TIMEOUT');
});

uji('peserta menulis catatan READY sebelum mengirim suara', () => {
  const r = TP.runTwoPhaseCommit({ peserta: [{ id: 'A' }] });
  const t = TP.jejakToText(r);
  const iReady = t.indexOf('TULIS ready');
  const iVote = t.indexOf('VOTE-COMMIT');
  benar(iReady >= 0 && iVote > iReady, 'catatan ready harus ditulis sebelum suara dikirim');
});

uji('koordinator jatuh pada fase 3 membuat peserta READY terblokir', () => {
  const r = TP.runTwoPhaseCommit({ peserta: peserta(), koordinatorJatuhPada: 3 });
  benar(r.memblokir);
  memuat(r.keputusan, 'TIDAK PASTI');
  peserta().forEach((p) => sama(r.keadaanAkhir[p.id], TP.KEADAAN.BLOCKED));
  benar(r.analisis.some((a) => a.includes('kelemahan 2PC')));
});

uji('koordinator jatuh pada fase 1 hanya membuat peserta abort sepihak', () => {
  const r = TP.runTwoPhaseCommit({ peserta: peserta(), koordinatorJatuhPada: 1 });
  salah(r.memblokir);
  peserta().forEach((p) => sama(r.keadaanAkhir[p.id], TP.KEADAAN.ABORT));
});

uji('partisi jaringan memutus PREPARE sehingga peserta terpisah abort', () => {
  const r = TP.runTwoPhaseCommit({ peserta: peserta(), partisi: [['Koordinator', 'Jakarta'], ['Bandung', 'Surabaya']] });
  sama(r.keputusan, 'GLOBAL-ABORT');
  sama(r.keadaanAkhir.Bandung, TP.KEADAAN.ABORT);
});

uji('jejak mencatat urutan pesan yang benar', () => {
  const t = TP.jejakToText(TP.runTwoPhaseCommit({ peserta: [{ id: 'A' }] }));
  benar(t.indexOf('PREPARE') < t.indexOf('VOTE-COMMIT'));
  benar(t.indexOf('VOTE-COMMIT') < t.indexOf('GLOBAL-COMMIT'));
  memuat(t, 'end_of_transaction');
});

grup('ddb/twophase — 3PC');

uji('3PC jalur normal melewati PRE-COMMIT', () => {
  const r = TP.runThreePhaseCommit({ peserta: peserta() });
  sama(r.keputusan, 'GLOBAL-COMMIT');
  memuat(TP.jejakToText(r), 'PRE-COMMIT');
  salah(r.memblokir);
});

uji('3PC melewatkan PRE-COMMIT bila keputusannya abort', () => {
  const r = TP.runThreePhaseCommit({ peserta: [{ id: 'A' }, { id: 'B', vote: 'ABORT' }] });
  sama(r.keputusan, 'GLOBAL-ABORT');
  tidakMemuat(TP.jejakToText(r), 'PRE-COMMIT');
});

uji('3PC tidak memblokir saat koordinator jatuh sebelum PRE-COMMIT', () => {
  const r = TP.runThreePhaseCommit({ peserta: peserta(), koordinatorJatuhPada: 3 });
  salah(r.memblokir);
  sama(r.keputusan, 'GLOBAL-ABORT');
});

uji('3PC memutuskan COMMIT bila koordinator jatuh setelah PRE-COMMIT', () => {
  const r = TP.runThreePhaseCommit({ peserta: peserta(), koordinatorJatuhPada: 4 });
  salah(r.memblokir);
  sama(r.keputusan, 'GLOBAL-COMMIT');
  peserta().forEach((p) => sama(r.keadaanAkhir[p.id], TP.KEADAAN.COMMIT));
});

grup('ddb/twophase — perbandingan & pemulihan');

uji('compareProtocols menunjukkan 2PC memblokir sementara 3PC tidak', () => {
  const c = TP.compareProtocols({ peserta: peserta(), koordinatorJatuhPada: 3 });
  benar(c.duaFase.memblokir);
  salah(c.tigaFase.memblokir);
  memuat(c.kesimpulan, '3PC tidak');
});

uji('compareProtocols pada jalur normal menyatakan keduanya selesai', () => {
  const c = TP.compareProtocols({ peserta: peserta() });
  salah(c.duaFase.memblokir);
  salah(c.tigaFase.memblokir);
  memuat(c.kesimpulan, 'putaran pesan ekstra');
});

uji('3PC memakai lebih banyak pesan pada jalur normal', () => {
  const c = TP.compareProtocols({ peserta: peserta() });
  benar(c.jumlahPesan['3PC'] > c.jumlahPesan['2PC']);
});

uji('compareProtocols tidak saling mencemari skenario', () => {
  const s = { peserta: peserta(), koordinatorJatuhPada: 3 };
  TP.compareProtocols(s);
  sama(s.peserta.length, 3);
  sama(s.koordinatorJatuhPada, 3);
});

uji('terminationProtocol menyalin keputusan dari peserta yang sudah tahu', () => {
  const keadaan = { A: TP.KEADAAN.READY, B: TP.KEADAAN.COMMIT };
  const t = TP.terminationProtocol(keadaan, [{ id: 'A' }, { id: 'B' }], '2PC');
  sama(t.keadaan.A, TP.KEADAAN.COMMIT);
});

uji('terminationProtocol 2PC tetap buntu bila semua READY', () => {
  const keadaan = { A: TP.KEADAAN.READY, B: TP.KEADAAN.READY };
  const t = TP.terminationProtocol(keadaan, [{ id: 'A' }, { id: 'B' }], '2PC');
  sama(t.keadaan.A, TP.KEADAAN.BLOCKED);
});

uji('terminationProtocol 3PC memutuskan commit bila ada yang PRE-COMMIT', () => {
  const keadaan = { A: TP.KEADAAN.READY, B: TP.KEADAAN.PRECOMMIT };
  const t = TP.terminationProtocol(keadaan, [{ id: 'A' }, { id: 'B' }], '3PC');
  sama(t.keadaan.A, TP.KEADAAN.COMMIT);
});

uji('terminationProtocol 3PC memutuskan abort bila tak ada yang PRE-COMMIT', () => {
  const keadaan = { A: TP.KEADAAN.READY, B: TP.KEADAAN.READY };
  const t = TP.terminationProtocol(keadaan, [{ id: 'A' }, { id: 'B' }], '3PC');
  sama(t.keadaan.A, TP.KEADAAN.ABORT);
});

uji('terminationProtocol tidak melakukan apa-apa bila tak ada yang menggantung', () => {
  const t = TP.terminationProtocol({ A: TP.KEADAAN.COMMIT }, [{ id: 'A' }], '2PC');
  sama(t.langkah, []);
});

uji('oracleRecoverySql memberi COMMIT FORCE hanya saat ada yang terblokir', () => {
  const blokir = TP.runTwoPhaseCommit({ peserta: peserta(), koordinatorJatuhPada: 3 });
  const s = TP.oracleRecoverySql(blokir, { namaTransaksi: '1.15.999' });
  memuat(s, 'dba_2pc_pending');
  memuat(s, "COMMIT FORCE '1.15.999'");
  memuat(s, 'PURGE_LOST_DB_ENTRY');
  memuat(s, 'mixed outcome');
});

uji('oracleRecoverySql tidak menyarankan pemaksaan pada jalur normal', () => {
  const s = TP.oracleRecoverySql(TP.runTwoPhaseCommit({ peserta: peserta() }));
  tidakMemuat(s, "COMMIT FORCE '");
  memuat(s, 'RECO');
  memuat(s, 'ENABLE DISTRIBUTED RECOVERY');
});

uji('daftar keadaan lengkap', () => {
  sama(Object.keys(TP.KEADAAN).length, 8);
  sama(TP.KEADAAN.PRECOMMIT, 'PRE-COMMIT');
});
