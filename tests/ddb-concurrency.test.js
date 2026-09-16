import { grup, uji, sama, benar, salah, melempar, memuat } from './harness.js';
import * as C from '../engine/ddb/concurrency.js';

grup('ddb/concurrency — jadwal & keterserialan');

uji('parseSchedule membaca notasi ringkas', () => {
  sama(C.parseSchedule('r1[x] w2[y] c1 a2'), [
    { tx: 'T1', op: 'r', item: 'x' },
    { tx: 'T2', op: 'w', item: 'y' },
    { tx: 'T1', op: 'c', item: null },
    { tx: 'T2', op: 'a', item: null },
  ]);
});

uji('parseSchedule menolak baca/tulis tanpa item', () => {
  melempar(() => C.parseSchedule('r1 c1'), 'wajib menyebut item');
});

uji('parseSchedule menolak masukan kosong', () => {
  melempar(() => C.parseSchedule('   '), 'kosong atau format');
});

uji('scheduleToString membalik parseSchedule', () => {
  const s = 'r1[x] w2[x] c1 c2';
  sama(C.scheduleToString(C.parseSchedule(s)), s);
});

uji('conflicts hanya untuk item sama, transaksi beda, minimal satu tulis', () => {
  const r1 = { tx: 'T1', op: 'r', item: 'x' };
  const r2 = { tx: 'T2', op: 'r', item: 'x' };
  const w2 = { tx: 'T2', op: 'w', item: 'x' };
  const w2y = { tx: 'T2', op: 'w', item: 'y' };
  salah(C.conflicts(r1, r2));
  benar(C.conflicts(r1, w2));
  salah(C.conflicts(r1, w2y));
  salah(C.conflicts(r1, { tx: 'T1', op: 'w', item: 'x' }));
  salah(C.conflicts(r1, { tx: 'T2', op: 'c', item: null }));
});

uji('precedenceGraph membangun sisi dari konflik', () => {
  const g = C.precedenceGraph(C.parseSchedule('r1[x] w2[x] c1 c2'));
  sama(g.simpul, ['T1', 'T2']);
  sama(g.sisi.length, 1);
  sama(g.sisi[0].dari, 'T1');
  benar(g.sisi[0].sebab.length > 0);
});

uji('jadwal serial dinyatakan serializable', () => {
  const r = C.isSerializable(C.parseSchedule('r1[x] w1[x] c1 r2[x] w2[x] c2'));
  benar(r.serializable);
  sama(r.urutanSerialSetara, ['T1', 'T2']);
});

uji('lost update terdeteksi tidak serializable', () => {
  const r = C.isSerializable(C.parseSchedule('r1[x] r2[x] w1[x] w2[x] c1 c2'));
  salah(r.serializable);
  benar(r.siklus.length >= 3);
  memuat(r.alasan, 'siklus');
});

uji('findCycle mengembalikan null pada graf asiklik', () => {
  sama(C.findCycle({ simpul: ['A', 'B'], sisi: [{ dari: 'A', ke: 'B' }] }), null);
});

uji('topologicalOrder mengembalikan null pada graf bersiklus', () => {
  sama(C.topologicalOrder({ simpul: ['A', 'B'], sisi: [{ dari: 'A', ke: 'B' }, { dari: 'B', ke: 'A' }] }), null);
});

uji('topologicalOrder menghasilkan urutan yang menghormati sisi', () => {
  const o = C.topologicalOrder({ simpul: ['A', 'B', 'C'], sisi: [{ dari: 'C', ke: 'B' }, { dari: 'B', ke: 'A' }] });
  sama(o, ['C', 'B', 'A']);
});

grup('ddb/concurrency — pemulihan');

uji('dirty read membuat jadwal tidak recoverable', () => {
  const r = C.recoverability(C.parseSchedule('w1[x] r2[x] w2[y] c2 c1'));
  salah(r.recoverable);
  salah(r.cascadeless);
  benar(r.catatan.some((c) => c.includes('tidak recoverable')));
});

uji('membaca data belum commit tetapi commit setelahnya masih recoverable', () => {
  const r = C.recoverability(C.parseSchedule('w1[x] r2[x] c1 c2'));
  benar(r.recoverable);
  salah(r.cascadeless);
});

uji('jadwal tanpa dirty read bersifat cascadeless dan strict', () => {
  const r = C.recoverability(C.parseSchedule('r1[x] w1[x] c1 r2[x] w2[x] c2'));
  benar(r.recoverable);
  benar(r.cascadeless);
  benar(r.strict);
});

grup('ddb/concurrency — 2PL');

uji('kunci S berbagi, kunci X eksklusif', () => {
  const l = C.twoPhaseLocking(C.parseSchedule('r1[x] r2[x] c1 c2'));
  salah(l.adaTunggu);
  const l2 = C.twoPhaseLocking(C.parseSchedule('w1[x] r2[x] c1 c2'));
  benar(l2.adaTunggu);
});

uji('peningkatan S ke X menunggu bila pemegang S lain masih ada', () => {
  const l = C.twoPhaseLocking(C.parseSchedule('r1[x] r2[x] w1[x] w2[x] c1 c2'));
  benar(l.adaTunggu);
  sama(l.graphTunggu.length, 2);
  benar(l.graphTunggu.some((e) => e.dari === 'T1' && e.ke === 'T2'));
  benar(l.graphTunggu.some((e) => e.dari === 'T2' && e.ke === 'T1'));
});

uji('peningkatan S ke X langsung diberikan bila hanya satu pemegang', () => {
  const l = C.twoPhaseLocking(C.parseSchedule('r1[x] w1[x] c1'));
  salah(l.adaTunggu);
  benar(l.jejak.some((j) => j.aksi === 'upgrade S->X'));
});

uji('commit melepaskan seluruh kunci', () => {
  const l = C.twoPhaseLocking(C.parseSchedule('w1[x] c1 w2[x] c2'));
  salah(l.adaTunggu);
  sama(l.jejak.filter((j) => j.aksi === 'unlock-all').length, 2);
});

uji('permintaan kunci baru setelah fase menyusut ditolak', () => {
  const l = C.twoPhaseLocking(C.parseSchedule('w1[x] c1 w1[y]'));
  benar(l.tertunda.length > 0);
  benar(l.jejak.some((j) => j.aksi === 'DITOLAK'));
});

uji('graphTunggu tidak mengandung sisi ganda', () => {
  const l = C.twoPhaseLocking(C.parseSchedule('w1[x] r2[x] w2[x] c1 c2'));
  const kunci = l.graphTunggu.map((e) => `${e.dari}->${e.ke}@${e.item}`);
  sama(kunci.length, new Set(kunci).size);
});

grup('ddb/concurrency — Timestamp Ordering');

uji('TO menerima jadwal yang sesuai urutan cap waktu', () => {
  const t = C.timestampOrdering(C.parseSchedule('r1[x] w1[x] c1 r2[x] w2[x] c2'));
  sama(t.dibatalkan, []);
});

uji('TO me-rollback baca yang terlalu tua', () => {
  const t = C.timestampOrdering(C.parseSchedule('w2[x] r1[x]'), { capWaktu: { T1: 1, T2: 2 } });
  sama(t.dibatalkan, ['T1']);
  benar(t.jejak.some((j) => j.aksi.includes('TOLAK')));
});

uji('TO me-rollback tulis yang terlalu tua terhadap RTS', () => {
  const t = C.timestampOrdering(C.parseSchedule('r2[x] w1[x]'), { capWaktu: { T1: 1, T2: 2 } });
  sama(t.dibatalkan, ['T1']);
});

uji('aturan tulis Thomas mengabaikan tulisan usang tanpa rollback', () => {
  const t = C.timestampOrdering(C.parseSchedule('w2[x] w1[x]'), { capWaktu: { T1: 1, T2: 2 } });
  sama(t.dibatalkan, []);
  benar(t.jejak.some((j) => j.aksi.includes('Thomas')));
});

uji('operasi setelah rollback dilewati', () => {
  const t = C.timestampOrdering(C.parseSchedule('w2[x] r1[x] w1[y] c1'), { capWaktu: { T1: 1, T2: 2 } });
  benar(t.jejak.some((j) => j.aksi === 'dilewati'));
});

uji('abort eksplisit dicatat', () => {
  const t = C.timestampOrdering(C.parseSchedule('r1[x] a1'));
  sama(t.dibatalkan, ['T1']);
});

uji('cap waktu default diurutkan sesuai kemunculan', () => {
  const t = C.timestampOrdering(C.parseSchedule('r2[x] r1[x]'));
  benar(t.capWaktu.T2 < t.capWaktu.T1);
});

uji('globalTimestamp unik antar situs pada jam yang sama', () => {
  benar(C.globalTimestamp(10, 'S1') !== C.globalTimestamp(10, 'S2'));
  benar(C.globalTimestamp(9, 'S9') < C.globalTimestamp(10, 'S1'));
});

uji('compareSchedulers menyatukan ketiga sudut pandang', () => {
  const r = C.compareSchedulers(C.parseSchedule('r1[x] r2[x] w1[x] w2[x] c1 c2'));
  salah(r.keterserialan.serializable);
  benar(r.duaFaseKunci.adaTunggu);
  benar(r.capWaktu.dibatalkan.length > 0);
  sama(r.kesimpulan.length, 3);
  memuat(r.jadwal, 'r1[x]');
});

uji('tulis kotor merusak sifat strict tanpa merusak cascadeless', () => {
  const r = C.recoverability(C.parseSchedule('w1[x] w2[x] c1 c2'));
  salah(r.strict);
  benar(r.cascadeless);
  benar(r.recoverable);
});

uji('jadwal serial penuh memenuhi ketiga sifat', () => {
  const r = C.recoverability(C.parseSchedule('r1[x] w1[x] c1 r2[x] w2[x] c2 r3[y] w3[y] c3'));
  benar(r.recoverable && r.cascadeless && r.strict);
  sama(r.catatan, []);
});

uji('abort juga melepas status penulis belum commit', () => {
  const r = C.recoverability(C.parseSchedule('w1[x] a1 r2[x] c2'));
  benar(r.cascadeless);
});
