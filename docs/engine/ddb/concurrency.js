// concurrency.js — pemrosesan konkuren dan kendali (Topik 10).
// Tiga hal yang dijalankan sungguhan, bukan digambarkan saja:
//   1. Uji keterserialan konflik lewat graf presedensi (deteksi siklus)
//   2. Penjadwal Two-Phase Locking (2PL dasar, ketat, dan tegas)
//   3. Penjadwal Timestamp Ordering dengan cap waktu global gaya Lamport
//
// Notasi operasi: r1[x] w2[y] c1 a2  ->  {tx:'T1', op:'r', item:'x'}

/** @typedef {{tx:string, op:'r'|'w'|'c'|'a', item?:string, situs?:string}} Operasi */

/** Uraikan jadwal ringkas: "r1[x] w2[x] c1 c2" */
export function parseSchedule(teks) {
  const token = String(teks).trim().split(/[\s,;]+/).filter(Boolean);
  if (token.length === 0) throw new Error('Jadwal kosong atau format tidak dikenali. Contoh: r1[x] w2[x] c1 c2');
  // setiap token wajib sah — token asing tidak boleh diabaikan diam-diam, karena
  // jadwal yang terbaca sebagian menghasilkan analisis yang menyesatkan
  return token.map((t) => {
    const m = /^([rwca])(\d+)(?:\[\s*([A-Za-z_][A-Za-z0-9_]*)\s*\])?$/.exec(t);
    if (!m) throw new Error(`Token "${t}" tidak dikenali. Pakai r1[x], w2[y], c1, atau a2.`);
    const [, op, n, item] = m;
    if ((op === 'r' || op === 'w') && !item) throw new Error(`Operasi ${op}${n} wajib menyebut item data, mis. ${op}${n}[x]`);
    if ((op === 'c' || op === 'a') && item) throw new Error(`Operasi ${op}${n} tidak menyebut item data`);
    return { tx: `T${n}`, op, item: item || null };
  });
}

export function scheduleToString(ops) {
  return ops.map((o) => `${o.op}${o.tx.replace(/^T/, '')}${o.item ? `[${o.item}]` : ''}`).join(' ');
}

// ---------------------------------------------- keterserialan konflik

/** Dua operasi berkonflik bila pada item sama, transaksi beda, dan minimal satu tulis. */
export function conflicts(a, b) {
  if (!a.item || !b.item) return false;
  if (a.item !== b.item) return false;
  if (a.tx === b.tx) return false;
  return a.op === 'w' || b.op === 'w';
}

/** Graf presedensi: sisi Ti -> Tj bila operasi Ti mendahului operasi Tj yang berkonflik. */
export function precedenceGraph(ops) {
  const tx = [...new Set(ops.map((o) => o.tx))];
  const sisi = new Map();
  for (let i = 0; i < ops.length; i++) {
    for (let j = i + 1; j < ops.length; j++) {
      if (!conflicts(ops[i], ops[j])) continue;
      const k = `${ops[i].tx}->${ops[j].tx}`;
      if (!sisi.has(k)) sisi.set(k, { dari: ops[i].tx, ke: ops[j].tx, sebab: [] });
      sisi.get(k).sebab.push(`${ops[i].op}${ops[i].tx}[${ops[i].item}] mendahului ${ops[j].op}${ops[j].tx}[${ops[j].item}]`);
    }
  }
  return { simpul: tx, sisi: [...sisi.values()] };
}

/** Cari siklus pada graf berarah (DFS dengan penanda warna). */
export function findCycle(graf) {
  const adj = new Map(graf.simpul.map((s) => [s, []]));
  for (const e of graf.sisi) adj.get(e.dari)?.push(e.ke);
  const warna = new Map(graf.simpul.map((s) => [s, 0])); // 0 putih, 1 abu, 2 hitam
  const induk = new Map();
  let siklus = null;
  const dfs = (u) => {
    warna.set(u, 1);
    for (const v of adj.get(u) || []) {
      if (siklus) return;
      if (warna.get(v) === 0) { induk.set(v, u); dfs(v); }
      else if (warna.get(v) === 1) {
        const jalur = [v];
        let x = u;
        while (x !== v && x !== undefined) { jalur.push(x); x = induk.get(x); }
        jalur.push(v);
        siklus = jalur.reverse();
        return;
      }
    }
    warna.set(u, 2);
  };
  for (const s of graf.simpul) if (warna.get(s) === 0 && !siklus) dfs(s);
  return siklus;
}

/** Urutan topologis — urutan serial yang setara bila jadwal memang serializable. */
export function topologicalOrder(graf) {
  const derajat = new Map(graf.simpul.map((s) => [s, 0]));
  const adj = new Map(graf.simpul.map((s) => [s, []]));
  for (const e of graf.sisi) { adj.get(e.dari).push(e.ke); derajat.set(e.ke, derajat.get(e.ke) + 1); }
  const antre = graf.simpul.filter((s) => derajat.get(s) === 0).sort();
  const out = [];
  while (antre.length) {
    const u = antre.shift();
    out.push(u);
    for (const v of adj.get(u)) {
      derajat.set(v, derajat.get(v) - 1);
      if (derajat.get(v) === 0) { antre.push(v); antre.sort(); }
    }
  }
  return out.length === graf.simpul.length ? out : null;
}

/** Apakah jadwal conflict-serializable? Plus urutan serial setaranya. */
export function isSerializable(ops) {
  const graf = precedenceGraph(ops);
  const siklus = findCycle(graf);
  const urutan = siklus ? null : topologicalOrder(graf);
  return {
    serializable: !siklus,
    graf,
    siklus,
    urutanSerialSetara: urutan,
    alasan: siklus
      ? `graf presedensi memuat siklus ${siklus.join(' -> ')}, jadi tidak ada urutan serial yang setara`
      : `graf presedensi asiklik; jadwal setara dengan urutan serial ${urutan ? urutan.join(' , ') : '-'}`,
  };
}

/**
 * Apakah jadwal recoverable / cascadeless / strict?
 *
 *   recoverable  : tiap transaksi commit SETELAH transaksi yang datanya ia baca commit
 *   cascadeless  : tidak ada transaksi yang membaca data yang penulisnya belum commit
 *   strict       : tidak ada BACA maupun TULIS atas data yang penulisnya belum commit
 *
 * Penilaian dilakukan sambil menelusuri jadwal, karena yang menentukan bukan
 * "siapa penulis terakhir" melainkan "apakah penulis itu sudah commit SAAT ITU".
 */
export function recoverability(ops) {
  const commitPada = {};
  ops.forEach((o, i) => { if (o.op === 'c') commitPada[o.tx] = i; });

  const penulisBelumCommit = {}; // item -> tx yang menulis dan belum commit/abort
  let recoverable = true; let cascadeless = true; let strict = true;
  const catatan = [];

  ops.forEach((o, i) => {
    if (o.op === 'c' || o.op === 'a') {
      for (const [item, tx] of Object.entries(penulisBelumCommit)) if (tx === o.tx) delete penulisBelumCommit[item];
      return;
    }
    const penulis = penulisBelumCommit[o.item];
    if (penulis && penulis !== o.tx) {
      if (o.op === 'r') {
        cascadeless = false;
        strict = false;
        catatan.push(`${o.tx} membaca ${o.item} yang ditulis ${penulis} sebelum ${penulis} commit — cascading abort mungkin terjadi`);
        const cW = commitPada[penulis];
        const cR = commitPada[o.tx];
        if (cR !== undefined && (cW === undefined || cW > cR)) {
          recoverable = false;
          catatan.push(`${o.tx} commit pada posisi ${cR} sebelum ${penulis} — jadwal tidak recoverable`);
        }
      } else {
        strict = false;
        catatan.push(`${o.tx} menimpa ${o.item} yang ditulis ${penulis} sebelum ${penulis} commit — tulis kotor`);
      }
    }
    if (o.op === 'w') penulisBelumCommit[o.item] = o.tx;
    void i;
  });

  return { recoverable, cascadeless, strict, catatan };
}

// -------------------------------------------------- Two-Phase Locking

export const MODE = { S: 'S', X: 'X' };

/**
 * Penjadwal 2PL.
 * @param {Operasi[]} ops
 * @param {{varian:'dasar'|'ketat'|'tegas'}} opsi
 *   dasar : kunci dilepas setelah fase menyusut dimulai
 *   ketat : kunci X dipegang sampai commit/abort (strict 2PL)
 *   tegas : semua kunci (S dan X) dipegang sampai commit/abort (rigorous 2PL)
 */
export function twoPhaseLocking(ops, { varian = 'ketat' } = {}) {
  const kunci = new Map(); // item -> {mode, pemegang:Set}
  const dipegang = new Map(); // tx -> Set(item)
  const fase = new Map(); // tx -> 'tumbuh' | 'menyusut'
  const jejak = [];
  const menunggu = [];
  const tertunda = [];
  const selesai = new Set();

  const txOf = (o) => o.tx;
  const ensure = (tx) => { if (!dipegang.has(tx)) dipegang.set(tx, new Set()); if (!fase.has(tx)) fase.set(tx, 'tumbuh'); };

  const bisaKunci = (tx, item, mode) => {
    const k = kunci.get(item);
    if (!k) return true;
    if (k.pemegang.size === 1 && k.pemegang.has(tx)) return true;
    if (mode === MODE.S && k.mode === MODE.S) return true;
    return false;
  };

  const ambilKunci = (tx, item, mode) => {
    const k = kunci.get(item);
    if (!k) { kunci.set(item, { mode, pemegang: new Set([tx]) }); }
    else { k.pemegang.add(tx); if (mode === MODE.X) k.mode = MODE.X; }
    dipegang.get(tx).add(item);
  };

  const lepasSemua = (tx, sebab) => {
    for (const item of dipegang.get(tx) || []) {
      const k = kunci.get(item);
      if (!k) continue;
      k.pemegang.delete(tx);
      if (k.pemegang.size === 0) kunci.delete(item);
    }
    dipegang.set(tx, new Set());
    jejak.push({ tx, aksi: 'unlock-all', item: '*', keterangan: sebab });
  };

  for (const o of ops) {
    ensure(txOf(o));
    const tx = txOf(o);
    if (o.op === 'c' || o.op === 'a') {
      fase.set(tx, 'menyusut');
      lepasSemua(tx, o.op === 'c' ? 'commit' : 'abort');
      jejak.push({ tx, aksi: o.op === 'c' ? 'commit' : 'abort', item: '-', keterangan: '' });
      selesai.add(tx);
      continue;
    }
    const mode = o.op === 'w' ? MODE.X : MODE.S;
    if (dipegang.get(tx).has(o.item)) {
      const k = kunci.get(o.item);
      if (mode === MODE.X && k.mode === MODE.S) {
        const lain = [...k.pemegang].filter((p) => p !== tx);
        if (lain.length > 0) {
          // peningkatan S->X saat pemegang S lain masih ada wajib menunggu.
          // Bila kedua transaksi sama-sama minta peningkatan, inilah upgrade deadlock.
          jejak.push({ tx, aksi: 'MENUNGGU upgrade S->X', item: o.item, keterangan: `kunci S masih dipegang ${lain.join(', ')}` });
          menunggu.push({ tx, item: o.item, mode, pemegang: lain, jenis: 'upgrade' });
          continue;
        }
        k.mode = MODE.X;
        jejak.push({ tx, aksi: 'upgrade S->X', item: o.item, keterangan: '' });
      }
      jejak.push({ tx, aksi: o.op === 'r' ? 'read' : 'write', item: o.item, keterangan: 'kunci sudah dipegang' });
      continue;
    }
    if (fase.get(tx) === 'menyusut') {
      jejak.push({ tx, aksi: 'DITOLAK', item: o.item, keterangan: 'melanggar 2PL: minta kunci baru setelah fase menyusut dimulai' });
      tertunda.push({ tx, item: o.item, sebab: 'pelanggaran 2PL' });
      continue;
    }
    if (!bisaKunci(tx, o.item, mode)) {
      const pemegang = [...(kunci.get(o.item)?.pemegang || [])];
      jejak.push({ tx, aksi: `MENUNGGU ${mode}`, item: o.item, keterangan: `dipegang ${pemegang.join(', ')} mode ${kunci.get(o.item)?.mode}` });
      menunggu.push({ tx, item: o.item, mode, pemegang });
      continue;
    }
    ambilKunci(tx, o.item, mode);
    jejak.push({ tx, aksi: `lock-${mode}`, item: o.item, keterangan: '' });
    jejak.push({ tx, aksi: o.op === 'r' ? 'read' : 'write', item: o.item, keterangan: '' });
    if (varian === 'dasar' && o.op === 'w') {
      // 2PL dasar boleh melepas lebih awal, tetapi hanya setelah fase menyusut dimulai
    }
  }

  return {
    varian,
    jejak,
    menunggu,
    tertunda,
    adaTunggu: menunggu.length > 0,
    graphTunggu: dedupeEdges(menunggu.flatMap((w) => w.pemegang.map((p) => ({ dari: w.tx, ke: p, item: w.item })))),
    ringkas: menunggu.length
      ? `${menunggu.length} permintaan kunci harus menunggu — sumber potensi deadlock`
      : 'tidak ada permintaan kunci yang bertabrakan',
  };
}

// ------------------------------------------------ Timestamp Ordering

/**
 * Penjadwal Timestamp Ordering dasar.
 * Cap waktu global = (jam lokal, id situs) agar unik lintas situs — persis cara
 * DDBMS menghindari tabrakan cap waktu antar situs.
 */
export function timestampOrdering(ops, { capWaktu = null } = {}) {
  const ts = capWaktu || Object.fromEntries([...new Set(ops.map((o) => o.tx))].map((t, i) => [t, i + 1]));
  const rts = {};
  const wts = {};
  const jejak = [];
  const dibatalkan = new Set();

  for (const o of ops) {
    if (dibatalkan.has(o.tx)) { jejak.push({ ...o, aksi: 'dilewati', alasan: 'transaksi sudah dibatalkan' }); continue; }
    if (o.op === 'c') { jejak.push({ ...o, aksi: 'commit', alasan: '' }); continue; }
    if (o.op === 'a') { dibatalkan.add(o.tx); jejak.push({ ...o, aksi: 'abort', alasan: 'abort eksplisit' }); continue; }
    const T = ts[o.tx];
    const R = rts[o.item] || 0;
    const W = wts[o.item] || 0;
    if (o.op === 'r') {
      if (T < W) {
        dibatalkan.add(o.tx);
        jejak.push({ ...o, aksi: 'TOLAK + rollback', alasan: `TS(${o.tx})=${T} < WTS(${o.item})=${W}: hendak membaca nilai yang sudah ditimpa transaksi lebih muda` });
      } else {
        rts[o.item] = Math.max(R, T);
        jejak.push({ ...o, aksi: 'read', alasan: `RTS(${o.item}) := ${rts[o.item]}` });
      }
    } else {
      if (T < R) {
        dibatalkan.add(o.tx);
        jejak.push({ ...o, aksi: 'TOLAK + rollback', alasan: `TS(${o.tx})=${T} < RTS(${o.item})=${R}: nilainya sudah dibaca transaksi lebih muda` });
      } else if (T < W) {
        jejak.push({ ...o, aksi: 'abaikan (aturan tulis Thomas)', alasan: `TS(${o.tx})=${T} < WTS(${o.item})=${W}: tulisan usang, aman diabaikan` });
      } else {
        wts[o.item] = T;
        jejak.push({ ...o, aksi: 'write', alasan: `WTS(${o.item}) := ${T}` });
      }
    }
  }
  return {
    capWaktu: ts,
    jejak,
    dibatalkan: [...dibatalkan],
    rts, wts,
    ringkas: dibatalkan.size
      ? `${dibatalkan.size} transaksi di-rollback: ${[...dibatalkan].join(', ')}`
      : 'semua transaksi lolos tanpa rollback',
  };
}

/** Cap waktu global gaya Lamport: <jam lokal, id situs>. */
export function globalTimestamp(jamLokal, idSitus, jumlahSitus = 16) {
  return jamLokal * jumlahSitus + (Number(String(idSitus).replace(/\D/g, '')) || 0);
}

/** Bandingkan ketiga penjadwal atas jadwal yang sama. */
export function compareSchedulers(ops) {
  const ser = isSerializable(ops);
  const rec = recoverability(ops);
  const l = twoPhaseLocking(ops, { varian: 'ketat' });
  const t = timestampOrdering(ops);
  return {
    jadwal: scheduleToString(ops),
    keterserialan: ser,
    pemulihan: rec,
    duaFaseKunci: l,
    capWaktu: t,
    kesimpulan: [
      ser.serializable ? 'Jadwal ini conflict-serializable.' : 'Jadwal ini TIDAK conflict-serializable.',
      l.adaTunggu ? '2PL menunda sebagian operasi (risiko deadlock).' : '2PL menjalankan jadwal tanpa penundaan.',
      t.dibatalkan.length ? `Timestamp Ordering me-rollback ${t.dibatalkan.join(', ')} (tanpa risiko deadlock).` : 'Timestamp Ordering menerima jadwal apa adanya.',
    ],
  };
}

function dedupeEdges(edges) {
  const seen = new Set();
  const out = [];
  for (const e of edges) {
    const k = `${e.dari}->${e.ke}@${e.item}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}
