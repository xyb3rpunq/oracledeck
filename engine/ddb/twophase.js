// twophase.js — protokol komitmen terdistribusi: 2PC dan 3PC.
// Menutup Topik 12 (Kegagalan pada SBDT, Komitmen Dua Fase) dan
// Topik 13 (Pemulihan, Komitmen Tiga Fase, Partisi Jaringan).
//
// Simulator ini menjalankan mesin keadaan sungguhan dengan injeksi kegagalan,
// lalu MEMBUKTIKAN sifat yang dibahas di kuliah:
//   - 2PC memblokir bila koordinator jatuh setelah peserta masuk keadaan READY
//   - 3PC tidak memblokir pada kegagalan yang sama, berkat fase PRE-COMMIT

export const KEADAAN = {
  INITIAL: 'INITIAL',
  WAIT: 'WAIT',
  READY: 'READY',
  PRECOMMIT: 'PRE-COMMIT',
  COMMIT: 'COMMIT',
  ABORT: 'ABORT',
  BLOCKED: 'BLOCKED',
  DOWN: 'DOWN',
};

/**
 * @typedef {{id:string, vote?:'COMMIT'|'ABORT', jatuhPada?:number}} Peserta
 * @typedef {{peserta:Peserta[], koordinatorJatuhPada?:number, partisi?:string[][]}} Skenario
 */

class Jejak {
  constructor() { this.langkah = []; this.t = 0; }
  catat(fase, dari, ke, pesan, keterangan = '') {
    this.t += 1;
    this.langkah.push({ t: this.t, fase, dari, ke, pesan, keterangan });
    return this;
  }
}

function terpisah(partisi, a, b) {
  if (!partisi || partisi.length === 0) return false;
  const grupA = partisi.findIndex((g) => g.includes(a));
  const grupB = partisi.findIndex((g) => g.includes(b));
  if (grupA === -1 || grupB === -1) return false;
  return grupA !== grupB;
}

// ------------------------------------------------------------------- 2PC

/**
 * Jalankan Two-Phase Commit.
 * @param {Skenario} skenario
 * @returns {{protokol:string, jejak:object[], keadaanAkhir:object, keputusan:string, memblokir:boolean, analisis:string[]}}
 */
function inti2PC(skenario) {
  const { peserta, koordinatorJatuhPada = null, partisi = [] } = skenario;
  const K = 'Koordinator';
  const j = new Jejak();
  const keadaan = { [K]: KEADAAN.INITIAL };
  peserta.forEach((p) => { keadaan[p.id] = KEADAAN.INITIAL; });
  const analisis = [];

  // langkah 1: koordinator menulis catatan BEGIN_COMMIT lalu mengirim PREPARE
  keadaan[K] = KEADAAN.WAIT;
  j.catat(1, K, '(log)', 'TULIS begin_commit', 'catatan ditulis lebih dulu — write-ahead logging');
  if (koordinatorJatuhPada === 1) return akhiriKoordinatorJatuh(j, keadaan, peserta, K, 1, analisis, '2PC', partisi);
  for (const p of peserta) {
    if (terpisah(partisi, K, p.id)) { j.catat(1, K, p.id, 'PREPARE (hilang: partisi jaringan)', 'pesan tidak sampai'); continue; }
    j.catat(1, K, p.id, 'PREPARE', '');
  }

  // langkah 2: peserta memberi suara
  const suara = {};
  for (const p of peserta) {
    if (p.jatuhPada === 2) { keadaan[p.id] = KEADAAN.DOWN; j.catat(2, p.id, K, '(diam: peserta jatuh)', 'koordinator akan kena timeout'); suara[p.id] = 'TIMEOUT'; continue; }
    if (terpisah(partisi, K, p.id)) { keadaan[p.id] = KEADAAN.INITIAL; j.catat(2, p.id, K, '(tidak menerima PREPARE)', 'membatalkan sepihak setelah timeout'); keadaan[p.id] = KEADAAN.ABORT; suara[p.id] = 'TIMEOUT'; continue; }
    const v = p.vote || 'COMMIT';
    if (v === 'COMMIT') {
      keadaan[p.id] = KEADAAN.READY;
      j.catat(2, p.id, '(log)', 'TULIS ready', 'peserta menyerahkan haknya memutuskan sendiri');
      j.catat(2, p.id, K, 'VOTE-COMMIT', 'masuk keadaan READY — TIDAK BOLEH memutuskan sendiri lagi');
    } else {
      keadaan[p.id] = KEADAAN.ABORT;
      j.catat(2, p.id, K, 'VOTE-ABORT', 'boleh membatalkan sepihak karena belum READY');
    }
    suara[p.id] = v;
  }

  // langkah 3: koordinator memutuskan
  const semuaSetuju = peserta.every((p) => suara[p.id] === 'COMMIT');
  const keputusan = semuaSetuju ? 'GLOBAL-COMMIT' : 'GLOBAL-ABORT';
  j.catat(3, K, '(log)', `TULIS ${keputusan.toLowerCase()}`, semuaSetuju ? 'semua peserta setuju' : 'ada suara abort atau timeout');
  if (koordinatorJatuhPada === 3) return akhiriKoordinatorJatuh(j, keadaan, peserta, K, 3, analisis, '2PC', partisi);
  keadaan[K] = semuaSetuju ? KEADAAN.COMMIT : KEADAAN.ABORT;

  // langkah 4: sebar keputusan
  for (const p of peserta) {
    if (keadaan[p.id] === KEADAAN.DOWN) { j.catat(4, K, p.id, `${keputusan} (tertunda)`, 'dikirim ulang saat peserta pulih'); continue; }
    if (terpisah(partisi, K, p.id)) { j.catat(4, K, p.id, `${keputusan} (hilang: partisi)`, 'peserta tetap menggantung'); if (keadaan[p.id] === KEADAAN.READY) keadaan[p.id] = KEADAAN.BLOCKED; continue; }
    j.catat(4, K, p.id, keputusan, '');
    keadaan[p.id] = semuaSetuju && keadaan[p.id] !== KEADAAN.ABORT ? KEADAAN.COMMIT : KEADAAN.ABORT;
    j.catat(4, p.id, K, 'ACK', '');
  }
  j.catat(4, K, '(log)', 'TULIS end_of_transaction', '');
  if (koordinatorJatuhPada === 4) {
    keadaan[K] = KEADAAN.DOWN;
    j.catat(4, K, '-', 'KOORDINATOR JATUH', 'keputusan sudah sampai ke seluruh peserta');
    analisis.push('2PC tidak punya fase PRE-COMMIT. Jatuh pada titik ini berarti keputusan sudah tersebar, sehingga tidak ada peserta yang terblokir — koordinator cukup membaca lognya saat pulih.');
  }

  const memblokir = Object.values(keadaan).includes(KEADAAN.BLOCKED);
  if (memblokir) analisis.push('Ada peserta yang menggantung di keadaan READY: ia tidak boleh commit maupun abort sendiri.');
  if (!semuaSetuju) analisis.push('Satu suara ABORT sudah cukup membatalkan seluruh transaksi global — sifat "semua atau tidak sama sekali".');
  return { protokol: '2PC', jejak: j.langkah, keadaanAkhir: keadaan, keputusan, memblokir, analisis, suara };
}

function akhiriKoordinatorJatuh(j, keadaan, peserta, K, pada, analisis, protokol, partisi) {
  keadaan[K] = KEADAAN.DOWN;
  j.catat(pada, K, '-', 'KOORDINATOR JATUH', 'tidak ada lagi yang menyebarkan keputusan');
  let memblokir = false;
  for (const p of peserta) {
    if (keadaan[p.id] === KEADAAN.READY) {
      if (protokol === '2PC') {
        keadaan[p.id] = KEADAAN.BLOCKED;
        memblokir = true;
        j.catat(pada, p.id, '-', 'TERBLOKIR', 'sudah READY, hak memutuskan sudah diserahkan ke koordinator');
      }
    } else if (keadaan[p.id] === KEADAAN.INITIAL) {
      keadaan[p.id] = KEADAAN.ABORT;
      j.catat(pada, p.id, '-', 'ABORT sepihak', 'belum READY, masih boleh memutuskan sendiri');
    }
  }
  // protokol terminasi kooperatif: peserta saling bertanya
  const terminasi = terminationProtocol(keadaan, peserta, protokol);
  terminasi.langkah.forEach((l) => j.catat(pada, l.dari, l.ke, l.pesan, l.keterangan));
  Object.assign(keadaan, terminasi.keadaan);
  memblokir = Object.values(keadaan).includes(KEADAAN.BLOCKED);
  if (memblokir) {
    analisis.push('INILAH kelemahan 2PC: koordinator jatuh tepat setelah peserta masuk READY, dan peserta tidak punya dasar untuk memutuskan sendiri.');
    analisis.push('Sumber daya (kunci baris) tetap dipegang sampai koordinator pulih — transaksi lain ikut tertahan.');
  }
  return {
    protokol,
    jejak: j.langkah,
    keadaanAkhir: keadaan,
    keputusan: memblokir ? 'TIDAK PASTI (menunggu koordinator pulih)' : (Object.values(keadaan).includes(KEADAAN.COMMIT) ? 'GLOBAL-COMMIT' : 'GLOBAL-ABORT'),
    memblokir,
    analisis,
    partisi,
  };
}

/**
 * Protokol terminasi kooperatif: peserta yang menggantung bertanya ke peserta lain.
 * 2PC: hanya menolong bila ada peserta yang sudah tahu keputusan.
 * 3PC: cukup ada satu peserta di PRE-COMMIT untuk memutuskan commit.
 */
export function terminationProtocol(keadaan, peserta, protokol) {
  const langkah = [];
  const out = {};
  const nilai = peserta.map((p) => keadaan[p.id]);
  const adaCommit = nilai.includes(KEADAAN.COMMIT);
  const adaAbort = nilai.includes(KEADAAN.ABORT);
  const adaPrecommit = nilai.includes(KEADAAN.PRECOMMIT);
  const menggantung = peserta.filter((p) => keadaan[p.id] === KEADAAN.READY || keadaan[p.id] === KEADAAN.BLOCKED || keadaan[p.id] === KEADAAN.PRECOMMIT);

  if (menggantung.length === 0) return { langkah, keadaan: out };
  langkah.push({ dari: menggantung[0].id, ke: 'semua peserta', pesan: 'TANYA-KEADAAN', keterangan: 'protokol terminasi kooperatif' });

  if (adaCommit) {
    menggantung.forEach((p) => { out[p.id] = KEADAAN.COMMIT; langkah.push({ dari: p.id, ke: '-', pesan: 'COMMIT (menyalin peserta lain)', keterangan: 'ada peserta yang sudah commit' }); });
    return { langkah, keadaan: out };
  }
  if (adaAbort) {
    menggantung.forEach((p) => { out[p.id] = KEADAAN.ABORT; langkah.push({ dari: p.id, ke: '-', pesan: 'ABORT (menyalin peserta lain)', keterangan: 'ada peserta yang sudah abort' }); });
    return { langkah, keadaan: out };
  }
  if (protokol === '3PC' && adaPrecommit) {
    menggantung.forEach((p) => { out[p.id] = KEADAAN.COMMIT; langkah.push({ dari: p.id, ke: '-', pesan: 'COMMIT', keterangan: 'ada peserta di PRE-COMMIT: berarti keputusan global pasti COMMIT' }); });
    return { langkah, keadaan: out };
  }
  if (protokol === '3PC') {
    menggantung.forEach((p) => { out[p.id] = KEADAAN.ABORT; langkah.push({ dari: p.id, ke: '-', pesan: 'ABORT', keterangan: 'tidak ada peserta di PRE-COMMIT: aman membatalkan' }); });
    return { langkah, keadaan: out };
  }
  menggantung.forEach((p) => { out[p.id] = KEADAAN.BLOCKED; langkah.push({ dari: p.id, ke: '-', pesan: 'TETAP TERBLOKIR', keterangan: 'semua peserta sama-sama READY — tidak ada informasi baru' }); });
  return { langkah, keadaan: out };
}

// ------------------------------------------------------------------- 3PC

/** Jalankan Three-Phase Commit — fase PRE-COMMIT membuatnya tidak memblokir. */
function inti3PC(skenario) {
  const { peserta, koordinatorJatuhPada = null, partisi = [] } = skenario;
  const K = 'Koordinator';
  const j = new Jejak();
  const keadaan = { [K]: KEADAAN.INITIAL };
  peserta.forEach((p) => { keadaan[p.id] = KEADAAN.INITIAL; });
  const analisis = [];

  keadaan[K] = KEADAAN.WAIT;
  j.catat(1, K, '(log)', 'TULIS begin_commit', '');
  if (koordinatorJatuhPada === 1) return akhiriKoordinatorJatuh(j, keadaan, peserta, K, 1, analisis, '3PC', partisi);
  for (const p of peserta) j.catat(1, K, p.id, 'PREPARE', '');

  const suara = {};
  for (const p of peserta) {
    if (p.jatuhPada === 2) { keadaan[p.id] = KEADAAN.DOWN; j.catat(2, p.id, K, '(diam: peserta jatuh)', ''); suara[p.id] = 'TIMEOUT'; continue; }
    const v = p.vote || 'COMMIT';
    keadaan[p.id] = v === 'COMMIT' ? KEADAAN.READY : KEADAAN.ABORT;
    j.catat(2, p.id, K, v === 'COMMIT' ? 'VOTE-COMMIT' : 'VOTE-ABORT', '');
    suara[p.id] = v;
  }

  const semuaSetuju = peserta.every((p) => suara[p.id] === 'COMMIT');
  if (!semuaSetuju) {
    j.catat(3, K, '(log)', 'TULIS global-abort', 'ada suara abort/timeout');
    keadaan[K] = KEADAAN.ABORT;
    for (const p of peserta) { if (keadaan[p.id] !== KEADAAN.DOWN) { j.catat(3, K, p.id, 'GLOBAL-ABORT', ''); keadaan[p.id] = KEADAAN.ABORT; } }
    return { protokol: '3PC', jejak: j.langkah, keadaanAkhir: keadaan, keputusan: 'GLOBAL-ABORT', memblokir: false, analisis: ['Fase PRE-COMMIT dilewati karena keputusan sudah pasti abort.'], suara };
  }

  // fase 2: PRE-COMMIT — inti dari 3PC
  j.catat(3, K, '(log)', 'TULIS prepare-to-commit', 'keputusan sudah pasti COMMIT, tetapi belum dieksekusi');
  if (koordinatorJatuhPada === 3) return akhiriKoordinatorJatuh(j, keadaan, peserta, K, 3, analisis, '3PC', partisi);
  keadaan[K] = KEADAAN.PRECOMMIT;
  for (const p of peserta) {
    if (keadaan[p.id] === KEADAAN.DOWN) continue;
    if (terpisah(partisi, K, p.id)) { j.catat(3, K, p.id, 'PRE-COMMIT (hilang: partisi)', ''); continue; }
    j.catat(3, K, p.id, 'PRE-COMMIT', 'peserta kini tahu: keputusan global pasti COMMIT');
    keadaan[p.id] = KEADAAN.PRECOMMIT;
    j.catat(3, p.id, K, 'ACK-PRE-COMMIT', '');
  }
  if (koordinatorJatuhPada === 4) return akhiriKoordinatorJatuh(j, keadaan, peserta, K, 4, analisis, '3PC', partisi);

  // fase 3: GLOBAL-COMMIT
  j.catat(4, K, '(log)', 'TULIS global-commit', '');
  keadaan[K] = KEADAAN.COMMIT;
  for (const p of peserta) {
    if (keadaan[p.id] === KEADAAN.DOWN) { j.catat(4, K, p.id, 'GLOBAL-COMMIT (tertunda)', ''); continue; }
    j.catat(4, K, p.id, 'GLOBAL-COMMIT', '');
    keadaan[p.id] = KEADAAN.COMMIT;
    j.catat(4, p.id, K, 'ACK', '');
  }
  analisis.push('3PC menambah satu putaran pesan, jadi lebih lambat dari 2PC pada jalur normal.');
  analisis.push('Imbalannya: tidak ada keadaan yang sekaligus bertetangga dengan COMMIT dan ABORT, sehingga peserta selalu bisa memutuskan sendiri.');
  return { protokol: '3PC', jejak: j.langkah, keadaanAkhir: keadaan, keputusan: 'GLOBAL-COMMIT', memblokir: false, analisis, suara };
}


// ------------------------------------------------------- gateway heterogen

/**
 * Peserta di balik Oracle Database Gateway for ODBC (mis. MySQL pada skripsi
 * kependudukan di folder mata kuliah). Menurut dokumentasi Oracle, gateway ini
 * "cannot participate in distributed transactions; only single-site transactions
 * supported", dan pada mode SINGLE_SITE_AUTOCOMMIT "any update is committed immediately".
 *
 * Akibatnya peserta itu TIDAK ikut PREPARE: perubahannya sudah permanen sebelum
 * koordinator memutuskan apa pun. Bila keputusan globalnya ABORT — atau belum pasti
 * karena koordinator jatuh — hasilnya campuran: sebagian situs commit, sebagian tidak.
 */
function denganGateway(inti, protokol, skenario) {
  const gateway = (skenario.peserta || []).filter((p) => p.gateway);
  if (gateway.length === 0) return { ...inti(skenario), gateway: [], hasilCampuran: false };

  const biasa = skenario.peserta.filter((p) => !p.gateway);
  const hasil = inti({ ...skenario, peserta: biasa });

  const awal = gateway.flatMap((g) => [
    { fase: 0, dari: g.id, ke: '(log)', pesan: 'UPDATE langsung di-commit', keterangan: 'SINGLE_SITE_AUTOCOMMIT — gateway ODBC tidak mengenal PREPARE' },
    { fase: 0, dari: 'Koordinator', ke: g.id, pesan: '(tidak ada PREPARE)', keterangan: 'peserta ini tidak dapat ikut transaksi terdistribusi' },
  ]);
  const jejak = [...awal, ...hasil.jejak].map((l, i) => ({ ...l, t: i + 1 }));
  const keadaanAkhir = { ...hasil.keadaanAkhir };
  gateway.forEach((g) => { keadaanAkhir[g.id] = KEADAAN.COMMIT; });

  const hasilCampuran = hasil.keputusan !== 'GLOBAL-COMMIT';
  const analisis = [...hasil.analisis];
  if (hasilCampuran) {
    analisis.push(`HASIL CAMPURAN: ${gateway.map((g) => g.id).join(', ')} sudah commit lewat gateway, sedangkan keputusan global ${hasil.keputusan}. Perubahan di situs itu tidak dapat dibatalkan oleh ${protokol}.`);
  } else {
    analisis.push(`Kebetulan selamat: keputusan globalnya COMMIT, sama dengan yang sudah terlanjur dilakukan ${gateway.map((g) => g.id).join(', ')}. Tidak ada jaminan ini terulang.`);
  }
  analisis.push('Inilah keterbatasan gateway yang disebut Modul 1: gateway hanya menerjemahkan kueri, tidak mengoordinasikan transaksi.');
  return { ...hasil, protokol, jejak, keadaanAkhir, analisis, gateway: gateway.map((g) => g.id), hasilCampuran };
}

/** Jalankan Two-Phase Commit. Peserta ber-flag `gateway: true` diperlakukan sebagai situs autocommit. */
export function runTwoPhaseCommit(skenario) { return denganGateway(inti2PC, '2PC', skenario); }

/** Jalankan Three-Phase Commit — fase PRE-COMMIT membuatnya tidak memblokir. */
export function runThreePhaseCommit(skenario) { return denganGateway(inti3PC, '3PC', skenario); }

/** Bandingkan 2PC vs 3PC pada skenario yang sama. */
export function compareProtocols(skenario) {
  const dua = runTwoPhaseCommit(JSON.parse(JSON.stringify(skenario)));
  const tiga = runThreePhaseCommit(JSON.parse(JSON.stringify(skenario)));
  return {
    duaFase: dua,
    tigaFase: tiga,
    jumlahPesan: { '2PC': dua.jejak.filter((l) => l.ke !== '(log)' && l.ke !== '-').length, '3PC': tiga.jejak.filter((l) => l.ke !== '(log)' && l.ke !== '-').length },
    kesimpulan: dua.hasilCampuran || tiga.hasilCampuran
      ? 'Ada peserta di balik gateway yang sudah commit sendiri. Baik 2PC maupun 3PC tidak dapat menarik kembali perubahannya — masalahnya ada pada gateway, bukan pada protokol.'
      : dua.memblokir && !tiga.memblokir
      ? '2PC memblokir pada skenario ini, 3PC tidak. Itulah alasan 3PC ada.'
      : dua.memblokir && tiga.memblokir
        ? 'Kedua protokol terhambat — partisi jaringan total memang di luar jangkauan 3PC.'
        : 'Pada jalur ini kedua protokol sama-sama selesai; 3PC hanya membayar satu putaran pesan ekstra.',
  };
}

/** Ringkas jejak menjadi baris teks yang enak dibaca. */
export function jejakToText(hasil) {
  return hasil.jejak.map((l) => `t${String(l.t).padStart(2, '0')} [fase ${l.fase}] ${l.dari} -> ${l.ke}: ${l.pesan}${l.keterangan ? `  (${l.keterangan})` : ''}`).join('\n');
}

/**
 * Transaksi menggantung pada Oracle terlihat di DBA_2PC_PENDING.
 * Fungsi ini membangun perintah pemulihan manual yang sesuai keadaan.
 */
export function oracleRecoverySql(hasil, { namaTransaksi = '1.15.1234' } = {}) {
  const terblokir = Object.entries(hasil.keadaanAkhir).filter(([, v]) => v === KEADAAN.BLOCKED).map(([k]) => k);
  const baris = [
    '-- Lihat transaksi terdistribusi yang menggantung:',
    'SELECT local_tran_id, global_tran_id, state, mixed, host, commit#',
    '  FROM dba_2pc_pending;',
    '',
    '-- Lihat sisi koneksi yang belum tuntas:',
    "SELECT local_tran_id, in_out, database, dbuser_owner, interface FROM dba_2pc_neighbors;",
    '',
  ];
  if (terblokir.length) {
    baris.push(`-- ${terblokir.length} peserta terblokir (${terblokir.join(', ')}).`);
    baris.push('-- Paksa sesuai keputusan koordinator SETELAH keputusan itu dipastikan:');
    baris.push(`COMMIT FORCE '${namaTransaksi}';`);
    baris.push(`-- atau  ROLLBACK FORCE '${namaTransaksi}';`);
    baris.push('');
    baris.push('-- Setelah basis data sinkron kembali, bersihkan catatan:');
    baris.push(`EXEC DBMS_TRANSACTION.PURGE_LOST_DB_ENTRY('${namaTransaksi}');`);
    baris.push('');
    baris.push('-- PERINGATAN: memaksa keputusan yang berbeda dari koordinator menghasilkan');
    baris.push('-- mixed outcome (kolom MIXED = yes) — sebagian situs commit, sebagian rollback.');
  } else {
    baris.push('-- Tidak ada peserta yang terblokir pada skenario ini.');
    baris.push('-- Proses latar RECO menuntaskan sendiri begitu jalur komunikasi pulih;');
    baris.push('-- COMMIT FORCE / ROLLBACK FORCE tidak boleh dipakai di sini.');
    baris.push('-- Bila ingin memaksa RECO segera bekerja:');
    baris.push('ALTER SYSTEM ENABLE DISTRIBUTED RECOVERY;');
  }
  return baris.join('\n');
}
