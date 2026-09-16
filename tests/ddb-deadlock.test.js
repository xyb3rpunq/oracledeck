import { grup, uji, sama, benar, salah, melempar, memuat } from './harness.js';
import * as D from '../engine/ddb/deadlock.js';

grup('ddb/deadlock — graf & deteksi');

const siklusLintasSitus = () => ({
  S1: [{ tx: 'T1', menunggu: 'T2', item: 'pasien:7' }],
  S2: [{ tx: 'T2', menunggu: 'T3', item: 'dokter:3' }],
  S3: [{ tx: 'T3', menunggu: 'T1', item: 'daftar:9' }],
});

uji('waitForGraph menyusun simpul dan sisi', () => {
  const g = D.waitForGraph([{ tx: 'T1', menunggu: 'T2', item: 'x', situs: 'S1' }]);
  sama(g.simpul, ['T1', 'T2']);
  sama(g.sisi[0].dari, 'T1');
  sama(g.sisi[0].situs, 'S1');
});

uji('findAllCycles menemukan siklus sederhana', () => {
  const g = D.waitForGraph([
    { tx: 'T1', menunggu: 'T2', item: 'x' },
    { tx: 'T2', menunggu: 'T1', item: 'y' },
  ]);
  const c = D.findAllCycles(g);
  sama(c.length, 1);
  sama(c[0].length, 3);
});

uji('findAllCycles tidak melaporkan siklus pada rantai lurus', () => {
  const g = D.waitForGraph([
    { tx: 'T1', menunggu: 'T2', item: 'x' },
    { tx: 'T2', menunggu: 'T3', item: 'y' },
  ]);
  sama(D.findAllCycles(g), []);
});

uji('findAllCycles tidak melaporkan siklus yang sama berulang kali', () => {
  const g = D.waitForGraph([
    { tx: 'T1', menunggu: 'T2', item: 'x' },
    { tx: 'T2', menunggu: 'T3', item: 'y' },
    { tx: 'T3', menunggu: 'T1', item: 'z' },
  ]);
  sama(D.findAllCycles(g).length, 1);
});

uji('centralizedDetection menemukan siklus lintas situs', () => {
  const c = D.centralizedDetection(siklusLintasSitus());
  benar(c.adaDeadlock);
  sama(c.siklusLintasSitus.length, 1);
  sama(c.pesanJaringan, 3);
  benar(c.catatan.some((x) => x.includes('tidak terlihat dari WFG situs mana pun')));
});

uji('centralizedDetection menyimpan WFG lokal tiap situs', () => {
  const c = D.centralizedDetection(siklusLintasSitus());
  sama(Object.keys(c.grafLokal), ['S1', 'S2', 'S3']);
  sama(c.grafLokal.S1.sisi.length, 1);
});

uji('centralizedDetection tidak melaporkan deadlock bila tidak ada siklus', () => {
  const c = D.centralizedDetection({ S1: [{ tx: 'T1', menunggu: 'T2', item: 'x' }] });
  salah(c.adaDeadlock);
});

uji('pathPushingDetection menemukan deadlock yang sama', () => {
  const p = D.pathPushingDetection(siklusLintasSitus());
  benar(p.adaDeadlock);
  benar(p.pesanJaringan > 0);
  benar(p.jejak.some((j) => j.aksi === 'dorong jalur'));
});

uji('pathPushingDetection mencatat sisi eksternal per situs', () => {
  const p = D.pathPushingDetection(siklusLintasSitus());
  benar(p.lokal.S1.eksternal.length > 0);
});

uji('edgeChasingDetection mengembalikan probe ke inisiator', () => {
  const e = D.edgeChasingDetection(siklusLintasSitus());
  benar(e.adaDeadlock);
  sama(e.jalurDeadlock[0], e.jalurDeadlock[e.jalurDeadlock.length - 1]);
  benar(e.probes.length > 0);
});

uji('edgeChasingDetection dapat memakai inisiator pilihan', () => {
  const e = D.edgeChasingDetection(siklusLintasSitus(), { inisiator: 'T2' });
  sama(e.inisiator, 'T2');
  benar(e.adaDeadlock);
});

uji('edgeChasingDetection berhenti tanpa deadlock pada rantai lurus', () => {
  const e = D.edgeChasingDetection({ S1: [{ tx: 'T1', menunggu: 'T2', item: 'x' }] });
  salah(e.adaDeadlock);
  sama(e.jalurDeadlock, null);
});

uji('ketiga metode selalu sepakat', () => {
  const kasus = [
    siklusLintasSitus(),
    { S1: [{ tx: 'T1', menunggu: 'T2', item: 'x' }] },
    { S1: [{ tx: 'A', menunggu: 'B', item: 'x' }, { tx: 'B', menunggu: 'A', item: 'y' }] },
    { S1: [{ tx: 'A', menunggu: 'B', item: 'x' }], S2: [{ tx: 'B', menunggu: 'C', item: 'y' }], S3: [{ tx: 'C', menunggu: 'D', item: 'z' }] },
  ];
  for (const k of kasus) benar(D.compareDetection(k).sepakat);
});

uji('compareDetection melaporkan beban pesan tiap metode', () => {
  const c = D.compareDetection(siklusLintasSitus());
  benar('terpusat' in c.bebanPesan && 'pathPushing' in c.bebanPesan && 'edgeChasing' in c.bebanPesan);
});

grup('ddb/deadlock — deadlock semu');

uji('phantomDeadlock mengenali siklus yang sudah bubar', () => {
  const p = D.phantomDeadlock(
    [{ tx: 'T1', menunggu: 'T2', item: 'x', situs: 'S1' }, { tx: 'T2', menunggu: 'T1', item: 'y', situs: 'S2' }],
    [{ tx: 'T1', menunggu: 'T2', item: 'x', situs: 'S1' }],
  );
  benar(p.semu);
  sama(p.sisiYangSudahLepas.length, 1);
  memuat(p.penjelasan, 'sudah bubar');
});

uji('phantomDeadlock tidak melaporkan apa-apa bila siklus masih ada', () => {
  const sama2 = [{ tx: 'T1', menunggu: 'T2', item: 'x' }, { tx: 'T2', menunggu: 'T1', item: 'y' }];
  const p = D.phantomDeadlock(sama2, sama2);
  salah(p.semu);
});

grup('ddb/deadlock — korban & pencegahan');

const profil = () => ({
  T1: { umur: 300, kunciDipegang: 8, kerjaSelesai: 90, prioritas: 5 },
  T2: { umur: 120, kunciDipegang: 3, kerjaSelesai: 40, prioritas: 9 },
  T3: { umur: 20, kunciDipegang: 1, kerjaSelesai: 5, prioritas: 1 },
});

uji('pickVictim termuda memilih transaksi paling muda', () => {
  sama(D.pickVictim(['T1', 'T2', 'T3', 'T1'], profil(), 'termuda').korban, 'T3');
});

uji('pickVictim kunci paling sedikit', () => {
  sama(D.pickVictim(['T1', 'T2', 'T3'], profil(), 'kunci-paling-sedikit').korban, 'T3');
});

uji('pickVictim kerja paling sedikit', () => {
  sama(D.pickVictim(['T1', 'T2'], profil(), 'kerja-paling-sedikit').korban, 'T2');
});

uji('pickVictim prioritas terendah', () => {
  sama(D.pickVictim(['T1', 'T2', 'T3'], profil(), 'prioritas-terendah').korban, 'T3');
});

uji('pickVictim menolak strategi tidak dikenal', () => {
  melempar(() => D.pickVictim(['T1'], profil(), 'acak'), 'tidak dikenal');
});

uji('pickVictim mengembalikan null bila tak ada kandidat berprofil', () => {
  sama(D.pickVictim(['TX'], profil(), 'termuda'), null);
});

uji('waitDie: yang tua menunggu, yang muda mati', () => {
  benar(D.waitDie(10, 25).menunggu);
  salah(D.waitDie(25, 10).menunggu);
  memuat(D.waitDie(25, 10).hasil, 'MATI');
});

uji('woundWait: yang tua melukai, yang muda menunggu', () => {
  benar(D.woundWait(10, 25).melukai);
  salah(D.woundWait(25, 10).melukai);
  memuat(D.woundWait(25, 10).hasil, 'MENUNGGU');
});

uji('kedua skema pencegahan selalu searah cap waktu', () => {
  const p = D.preventionComparison(10, 25);
  benar(p.waitDie['A minta kunci B'].menunggu !== p.waitDie['B minta kunci A'].menunggu);
  benar(p.woundWait['A minta kunci B'].melukai !== p.woundWait['B minta kunci A'].melukai);
  memuat(p.inti, 'satu arah');
});
