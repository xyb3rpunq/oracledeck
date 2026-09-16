// deadlock.js — manajemen deadlock (Topik 11).
// Deteksi terpusat vs terdistribusi, pencegahan berbasis cap waktu,
// pemilihan korban, dan deadlock semu (phantom deadlock) yang muncul justru
// karena informasi antar situs tidak pernah benar-benar serentak.

/**
 * @typedef {{tx:string, menunggu:string, item:string, situs:string}} Tunggu
 * @typedef {{simpul:string[], sisi:Array<{dari:string,ke:string,item?:string,situs?:string}>}} Graf
 */

/** Bangun Wait-For Graph dari daftar penantian kunci. */
export function waitForGraph(tunggu) {
  const simpul = [...new Set(tunggu.flatMap((t) => [t.tx, t.menunggu]))].sort();
  const sisi = tunggu.map((t) => ({ dari: t.tx, ke: t.menunggu, item: t.item, situs: t.situs }));
  return { simpul, sisi };
}

/** Semua siklus sederhana pada graf berarah (Johnson sederhana lewat DFS). */
export function findAllCycles(graf, batas = 200) {
  const adj = new Map(graf.simpul.map((s) => [s, []]));
  for (const e of graf.sisi) adj.get(e.dari)?.push(e.ke);
  const hasil = [];
  const seen = new Set();
  const dfs = (mulai, kini, jalur, dikunjungi) => {
    if (hasil.length >= batas) return;
    for (const v of adj.get(kini) || []) {
      if (v === mulai) {
        const norm = normalizeCycle(jalur);
        if (!seen.has(norm)) { seen.add(norm); hasil.push([...jalur, mulai]); }
        continue;
      }
      if (dikunjungi.has(v)) continue;
      if (v < mulai) continue; // hindari mengulang siklus yang sama dari titik berbeda
      dikunjungi.add(v);
      dfs(mulai, v, [...jalur, v], dikunjungi);
      dikunjungi.delete(v);
    }
  };
  for (const s of graf.simpul) dfs(s, s, [s], new Set([s]));
  return hasil;
}

function normalizeCycle(jalur) {
  const n = jalur.length;
  let best = null;
  for (let i = 0; i < n; i++) {
    const rot = [...jalur.slice(i), ...jalur.slice(0, i)].join('>');
    if (best === null || rot < best) best = rot;
  }
  return best;
}

/**
 * Deteksi deadlock terpusat: satu situs koordinator mengumpulkan WFG lokal
 * dari semua situs, menyatukannya, lalu mencari siklus pada graf global.
 */
export function centralizedDetection(tungguPerSitus, { koordinator = 'S1' } = {}) {
  const semua = Object.entries(tungguPerSitus).flatMap(([situs, ts]) => ts.map((t) => ({ ...t, situs })));
  const lokal = Object.fromEntries(Object.entries(tungguPerSitus).map(([s, ts]) => [s, waitForGraph(ts.map((t) => ({ ...t, situs: s })))]));
  const global = waitForGraph(semua);
  const siklus = findAllCycles(global);
  const siklusLokal = Object.fromEntries(Object.entries(lokal).map(([s, g]) => [s, findAllCycles(g)]));
  const hanyaGlobal = siklus.filter((c) => {
    const situsPadaSiklus = new Set(edgesOfCycle(global, c).map((e) => e.situs));
    return situsPadaSiklus.size > 1;
  });
  return {
    metode: 'terpusat',
    koordinator,
    grafLokal: lokal,
    grafGlobal: global,
    siklus,
    siklusLintasSitus: hanyaGlobal,
    adaDeadlock: siklus.length > 0,
    pesanJaringan: Object.keys(tungguPerSitus).length, // tiap situs mengirim WFG-nya
    catatan: [
      'Kelebihan: algoritmanya sederhana dan deteksi pasti menemukan seluruh siklus.',
      'Kekurangan: koordinator menjadi titik kegagalan tunggal dan bottleneck lalu lintas.',
      hanyaGlobal.length ? 'Ada siklus yang tidak terlihat dari WFG situs mana pun secara terpisah — hanya muncul setelah digabung.' : 'Semua siklus (bila ada) sudah terlihat di tingkat lokal.',
    ],
  };
}

function edgesOfCycle(graf, siklus) {
  const out = [];
  for (let i = 0; i < siklus.length - 1; i++) {
    const e = graf.sisi.find((x) => x.dari === siklus[i] && x.ke === siklus[i + 1]);
    if (e) out.push(e);
  }
  return out;
}

/**
 * Deteksi terdistribusi gaya path-pushing (Obermarck).
 * Tiap situs menambahkan simpul semu "External" untuk transaksi yang menunggu
 * di situs lain, lalu mendorong jalurnya ke situs berikutnya.
 */
export function pathPushingDetection(tungguPerSitus) {
  const situs = Object.keys(tungguPerSitus);
  const jejak = [];
  const semua = Object.entries(tungguPerSitus).flatMap(([s, ts]) => ts.map((t) => ({ ...t, situs: s })));
  const grafGlobal = waitForGraph(semua);

  // 1) tiap situs membangun WFG lokal + sisi eksternal
  const lokal = {};
  for (const s of situs) {
    const ts = tungguPerSitus[s].map((t) => ({ ...t, situs: s }));
    const g = waitForGraph(ts);
    const txLokal = new Set(ts.flatMap((t) => [t.tx, t.menunggu]));
    const eksternal = semua.filter((t) => t.situs !== s && (txLokal.has(t.tx) || txLokal.has(t.menunggu)));
    lokal[s] = { graf: g, eksternal: eksternal.map((e) => `${e.dari || e.tx} -> ${e.menunggu} @${e.situs}`) };
    jejak.push({ situs: s, aksi: 'bangun WFG lokal', detail: `${g.sisi.length} sisi lokal, ${eksternal.length} sisi menuju/keluar situs lain` });
  }

  // 2) jalur didorong ke situs berikutnya sampai siklus ditemukan
  const siklus = findAllCycles(grafGlobal);
  let pesan = 0;
  for (const c of siklus) {
    const s = edgesOfCycle(grafGlobal, c).map((e) => e.situs);
    const unik = [...new Set(s)];
    pesan += Math.max(0, unik.length - 1);
    jejak.push({ situs: unik.join(' -> '), aksi: 'dorong jalur', detail: `jalur ${c.join(' -> ')} melintasi ${unik.length} situs` });
  }

  return {
    metode: 'terdistribusi (path pushing)',
    lokal,
    siklus,
    adaDeadlock: siklus.length > 0,
    pesanJaringan: pesan,
    jejak,
    catatan: [
      'Tidak ada koordinator tunggal: setiap situs hanya mengirim jalur yang melibatkan transaksi luar.',
      'Jumlah pesan bergantung panjang siklus, bukan jumlah seluruh situs.',
      'Risikonya: informasi antar situs tidak serentak sehingga bisa muncul deadlock semu.',
    ],
  };
}

/**
 * Deteksi edge-chasing (Chandy-Misra-Haas): transaksi yang menunggu mengirim
 * probe (i, j, k). Bila probe kembali ke pengirim asal, ada deadlock.
 */
export function edgeChasingDetection(tungguPerSitus, { inisiator = null } = {}) {
  const semua = Object.entries(tungguPerSitus).flatMap(([s, ts]) => ts.map((t) => ({ ...t, situs: s })));
  const graf = waitForGraph(semua);
  const adj = new Map(graf.simpul.map((s) => [s, []]));
  for (const e of graf.sisi) adj.get(e.dari).push(e);

  const mulai = inisiator || graf.simpul.find((s) => (adj.get(s) || []).length > 0) || graf.simpul[0];
  const probes = [];
  let deadlock = false;
  let jalurDeadlock = null;

  const kirim = (asal, dari, ke, jalur, kedalaman) => {
    if (kedalaman > graf.simpul.length + 1) return;
    probes.push({ probe: `(${asal}, ${dari}, ${ke})`, jalur: [...jalur, ke].join(' -> ') });
    if (ke === asal) { deadlock = true; jalurDeadlock = [...jalur, ke]; return; }
    for (const e of adj.get(ke) || []) {
      if (deadlock) return;
      kirim(asal, ke, e.ke, [...jalur, ke], kedalaman + 1);
    }
  };
  for (const e of adj.get(mulai) || []) { if (!deadlock) kirim(mulai, mulai, e.ke, [mulai], 1); }

  return {
    metode: 'terdistribusi (edge chasing / probe)',
    inisiator: mulai,
    probes,
    adaDeadlock: deadlock,
    jalurDeadlock,
    pesanJaringan: probes.length,
    catatan: [
      'Probe berbentuk (inisiator, pengirim, penerima) dan hanya mengalir mengikuti sisi tunggu.',
      'Deadlock dinyatakan hanya bila probe kembali ke inisiatornya sendiri.',
      'Beban pesan paling ringan di antara ketiga metode, tetapi tiap transaksi menunggu harus memulai probe sendiri.',
    ],
  };
}

/**
 * Deadlock semu: WFG situs A dan situs B diambil pada waktu berbeda. Sebuah sisi
 * yang sebenarnya sudah lepas masih tercatat, sehingga siklus palsu terbentuk.
 */
export function phantomDeadlock(snapshotLama, snapshotBaru) {
  const grafLama = waitForGraph(snapshotLama);
  const grafBaru = waitForGraph(snapshotBaru);
  const siklusLama = findAllCycles(grafLama);
  const siklusBaru = findAllCycles(grafBaru);
  const hilang = grafLama.sisi.filter((a) => !grafBaru.sisi.some((b) => b.dari === a.dari && b.ke === a.ke));
  return {
    siklusPadaSnapshotLama: siklusLama,
    siklusPadaSnapshotBaru: siklusBaru,
    sisiYangSudahLepas: hilang,
    semu: siklusLama.length > 0 && siklusBaru.length === 0,
    penjelasan: siklusLama.length > 0 && siklusBaru.length === 0
      ? `Detektor akan mengorbankan satu transaksi padahal deadlock-nya sudah bubar: sisi ${hilang.map((h) => `${h.dari}->${h.ke}`).join(', ')} sudah dilepas sebelum WFG global sempat disatukan.`
      : 'Snapshot ini tidak menghasilkan deadlock semu.',
  };
}

// ------------------------------------------------------- pemilihan korban

/**
 * @param {string[]} siklus
 * @param {Object<string,{umur:number, kunciDipegang:number, kerjaSelesai:number, prioritas?:number}>} profil
 */
export function pickVictim(siklus, profil, strategi = 'termuda') {
  const kandidat = [...new Set(siklus)].filter((t) => profil[t]);
  if (kandidat.length === 0) return null;
  const skor = {
    termuda: (t) => -profil[t].umur,
    'kunci-paling-sedikit': (t) => -profil[t].kunciDipegang,
    'kerja-paling-sedikit': (t) => -profil[t].kerjaSelesai,
    'prioritas-terendah': (t) => -(profil[t].prioritas ?? 0),
  }[strategi];
  if (!skor) throw new Error(`pickVictim: strategi "${strategi}" tidak dikenal`);
  const urut = kandidat.slice().sort((a, b) => skor(b) - skor(a) || (a < b ? -1 : 1));
  const korban = urut[0];
  return {
    korban,
    strategi,
    peringkat: urut.map((t) => ({ tx: t, ...profil[t] })),
    alasan: {
      termuda: 'transaksi paling muda paling sedikit kehilangan kerja bila diulang',
      'kunci-paling-sedikit': 'melepas transaksi dengan kunci paling sedikit membebaskan paling sedikit sumber daya tetapi paling murah',
      'kerja-paling-sedikit': 'kerja yang terbuang paling kecil',
      'prioritas-terendah': 'transaksi dengan prioritas bisnis terendah dikorbankan lebih dulu',
    }[strategi],
  };
}

// -------------------------------------------------------- pencegahan

/**
 * Wait-Die (non-preemptive): transaksi TUA boleh menunggu yang muda,
 * transaksi MUDA yang meminta kunci milik yang tua langsung mati (di-restart).
 */
export function waitDie(tsPeminta, tsPemegang) {
  const menunggu = tsPeminta < tsPemegang;
  return {
    skema: 'Wait-Die',
    hasil: menunggu ? 'MENUNGGU' : 'MATI (rollback lalu restart dengan cap waktu lama)',
    menunggu,
    alasan: menunggu
      ? `peminta (TS=${tsPeminta}) lebih tua dari pemegang (TS=${tsPemegang}), jadi boleh menunggu`
      : `peminta (TS=${tsPeminta}) lebih muda dari pemegang (TS=${tsPemegang}), jadi dimatikan agar tidak pernah terbentuk siklus`,
  };
}

/**
 * Wound-Wait (preemptive): transaksi TUA melukai (me-rollback) pemegang yang muda,
 * transaksi MUDA menunggu yang tua.
 */
export function woundWait(tsPeminta, tsPemegang) {
  const melukai = tsPeminta < tsPemegang;
  return {
    skema: 'Wound-Wait',
    hasil: melukai ? 'MELUKAI pemegang (pemegang di-rollback)' : 'MENUNGGU',
    melukai,
    alasan: melukai
      ? `peminta (TS=${tsPeminta}) lebih tua, jadi pemegang yang lebih muda (TS=${tsPemegang}) dikorbankan`
      : `peminta (TS=${tsPeminta}) lebih muda dari pemegang (TS=${tsPemegang}), jadi menunggu`,
  };
}

/** Kedua skema menjamin arah tunggu selalu searah cap waktu, sehingga siklus mustahil. */
export function preventionComparison(tsA, tsB) {
  return {
    waitDie: { 'A minta kunci B': waitDie(tsA, tsB), 'B minta kunci A': waitDie(tsB, tsA) },
    woundWait: { 'A minta kunci B': woundWait(tsA, tsB), 'B minta kunci A': woundWait(tsB, tsA) },
    inti: 'Pada kedua skema, sisi tunggu hanya boleh mengarah satu arah menurut cap waktu — graf tunggu jadi mustahil membentuk siklus.',
    bedanya: 'Wait-Die me-restart transaksi MUDA yang meminta; Wound-Wait me-restart transaksi MUDA yang sedang memegang.',
  };
}

/** Bandingkan ketiga metode deteksi atas satu situasi yang sama. */
export function compareDetection(tungguPerSitus) {
  const t = centralizedDetection(tungguPerSitus);
  const p = pathPushingDetection(tungguPerSitus);
  const e = edgeChasingDetection(tungguPerSitus);
  return {
    terpusat: t,
    pathPushing: p,
    edgeChasing: e,
    sepakat: t.adaDeadlock === p.adaDeadlock && p.adaDeadlock === e.adaDeadlock,
    bebanPesan: { terpusat: t.pesanJaringan, pathPushing: p.pesanJaringan, edgeChasing: e.pesanJaringan },
  };
}
