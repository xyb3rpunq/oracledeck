// availability.js — keandalan, ketersediaan, kuorum, dan CAP/PACELC.
// Menopang klaim pada Modul 1 ("Keberadaan data yang ditingkatkan", "Keandalan
// yang ditingkatkan") dengan angka, bukan sekadar kalimat.

/** Ketersediaan satu situs dari MTBF dan MTTR: A = MTBF / (MTBF + MTTR). */
export function siteAvailability(mtbfJam, mttrJam) {
  if (mtbfJam <= 0) throw new Error('MTBF harus lebih besar dari nol');
  const a = mtbfJam / (mtbfJam + mttrJam);
  return {
    ketersediaan: r6(a),
    persen: r4(a * 100),
    menitPadamPerTahun: r2((1 - a) * 365 * 24 * 60),
    kelas: kelasNines(a),
  };
}

export function kelasNines(a) {
  const n = -Math.log10(1 - a);
  if (!Number.isFinite(n)) return '100%';
  // dibulatkan ke satu desimal lebih dulu: 0.999 menghasilkan 2.9999999… pada
  // aritmetika titik-mengambang dan akan salah dibaca sebagai "2.9 nine".
  return `${Math.round(n * 10) / 10} nine`;
}

/** Komponen paralel (replika): tersedia bila minimal satu hidup. */
export function parallelAvailability(daftar) {
  const p = daftar.reduce((acc, a) => acc * (1 - a), 1);
  return r6(1 - p);
}

/** Komponen seri: semua harus hidup (mis. transaksi global menyentuh N situs). */
export function seriesAvailability(daftar) {
  return r6(daftar.reduce((acc, a) => acc * a, 1));
}

/**
 * Ketersediaan rancangan terdistribusi.
 * - Baca fragmen : paralel atas replikanya
 * - Transaksi global: seri atas seluruh fragmen yang disentuh (2PC butuh semuanya)
 */
export function designAvailability(alokasi, ketersediaanSitus) {
  const perFragmen = {};
  for (const [f, situs] of Object.entries(alokasi)) {
    const a = situs.map((s) => {
      const v = ketersediaanSitus[s];
      if (v === undefined) throw new Error(`Ketersediaan situs "${s}" belum ditentukan`);
      return v;
    });
    perFragmen[f] = { ketersediaanBaca: parallelAvailability(a), replika: situs.length, situs: situs.slice() };
  }
  const bacaSemua = seriesAvailability(Object.values(perFragmen).map((x) => x.ketersediaanBaca));
  const situsUnik = [...new Set(Object.values(alokasi).flat())];
  const tulisSemuaReplika = seriesAvailability(Object.values(alokasi).flatMap((ss) => ss.map((s) => ketersediaanSitus[s])));
  return {
    perFragmen,
    bacaTransaksiGlobal: bacaSemua,
    tulisSerentakSemuaReplika: r6(tulisSemuaReplika),
    situsTerlibat: situsUnik.length,
    catatan: [
      'Baca ikut naik seiring jumlah replika: cukup satu replika hidup.',
      'Tulis justru ikut turun: 2PC menuntut SELURUH replika hidup pada saat yang sama.',
      'Itulah harga replikasi — dan alasan replikasi asinkron (materialized view) sering dipilih di praktik.',
    ],
  };
}

/**
 * Sistem kuorum (N, R, W). Konsistensi kuat dijamin bila R + W > N,
 * dan tulis serial terurut bila W > N/2.
 */
export function quorum(N, R, W) {
  if (R > N || W > N || R < 1 || W < 1) throw new Error(`Kuorum tidak sah: N=${N}, R=${R}, W=${W}`);
  const konsistenKuat = R + W > N;
  const tulisTerurut = W > N / 2;
  return {
    N, R, W,
    konsistenKuat,
    tulisTerurut,
    tahanKegagalanBaca: N - R,
    tahanKegagalanTulis: N - W,
    penjelasan: konsistenKuat
      ? `R + W = ${R + W} > N = ${N}: himpunan baca dan himpunan tulis pasti beririsan, jadi pembaca selalu melihat tulisan terakhir.`
      : `R + W = ${R + W} ≤ N = ${N}: irisan tidak dijamin, pembaca bisa mendapat data basi (konsistensi akhir / eventual).`,
    contoh: [
      { nama: 'Baca cepat', R: 1, W: N, sifat: 'baca sangat murah, tulis mahal dan rapuh' },
      { nama: 'Tulis cepat', R: N, W: 1, sifat: 'tulis sangat murah, baca mahal' },
      { nama: 'Kuorum mayoritas', R: Math.floor(N / 2) + 1, W: Math.floor(N / 2) + 1, sifat: 'seimbang, tahan ⌊(N-1)/2⌋ situs mati' },
    ],
  };
}

/** Klasifikasi CAP saat partisi jaringan terjadi. */
export function capAnalysis({ pilihan = 'CP', N = 3, partisi = [[1], [2, 3]] } = {}) {
  const ukuran = partisi.map((p) => p.length);
  const mayoritas = ukuran.findIndex((u) => u > N / 2);
  const opsi = {
    CP: {
      nama: 'CP — Consistency + Partition tolerance',
      perilaku: mayoritas >= 0
        ? `Hanya sisi mayoritas (${partisi[mayoritas].length} situs) yang melayani tulis. Sisi minoritas menolak permintaan.`
        : 'Tidak ada sisi mayoritas: SELURUH sistem menolak tulis demi menjaga konsistensi.',
      korban: 'Ketersediaan',
      contoh: 'Oracle RAC dengan voting disk, etcd, ZooKeeper, sistem 2PC/3PC klasik.',
      cocokUntuk: 'Saldo rekening, stok obat, kursi pesawat — salah nilai lebih mahal daripada layanan berhenti.',
    },
    AP: {
      nama: 'AP — Availability + Partition tolerance',
      perilaku: 'Semua sisi tetap melayani baca dan tulis; perbedaan nilai diselesaikan belakangan (konsistensi akhir).',
      korban: 'Konsistensi',
      contoh: 'Cassandra, DynamoDB, replikasi asinkron Oracle GoldenGate.',
      cocokUntuk: 'Katalog, log kunjungan, cache — data basi sebentar masih bisa diterima.',
    },
    CA: {
      nama: 'CA — Consistency + Availability',
      perilaku: 'Hanya mungkin bila partisi jaringan diasumsikan tidak pernah terjadi — asumsi yang tidak berlaku pada sistem terdistribusi nyata.',
      korban: 'Toleransi partisi (yang sebenarnya tidak boleh dikorbankan)',
      contoh: 'Basis data terpusat pada satu mesin.',
      cocokUntuk: 'Sistem satu situs; begitu ada WAN, pilihan ini lenyap.',
    },
  };
  if (!opsi[pilihan]) throw new Error(`capAnalysis: pilihan "${pilihan}" harus CP, AP, atau CA`);
  return {
    pilihan,
    ...opsi[pilihan],
    partisi,
    adaMayoritas: mayoritas >= 0,
    semuaOpsi: opsi,
    pacelc: pacelc(pilihan),
  };
}

/**
 * PACELC (Abadi): kalau ada Partisi (P) pilih A atau C; Else (E) pilih L (latency) atau C.
 * Melengkapi CAP karena pertukaran tetap ada bahkan ketika jaringan sehat.
 */
export function pacelc(pilihanCAP) {
  const map = {
    CP: { kode: 'PC/EC', arti: 'Saat partisi memilih konsistensi; saat normal pun tetap memilih konsistensi meski latensinya lebih tinggi.', contoh: 'Oracle dengan 2PC sinkron, VoltDB, Spanner.' },
    AP: { kode: 'PA/EL', arti: 'Saat partisi memilih ketersediaan; saat normal memilih latensi rendah dan menerima replikasi tertunda.', contoh: 'Cassandra, DynamoDB dengan tulis kuorum longgar.' },
    CA: { kode: 'EC (tanpa P)', arti: 'Hanya masuk akal untuk sistem satu situs.', contoh: 'MySQL/Oracle instansi tunggal.' },
  };
  return map[pilihanCAP] || map.CP;
}

/** Waktu pemulihan dan jendela kehilangan data — RTO & RPO. */
export function rtoRpo({ intervalBackupMenit = 60, waktuPulihMenit = 30, replikasi = 'asinkron', tundaReplikasiDetik = 5 }) {
  const rpo = replikasi === 'sinkron' ? 0 : replikasi === 'asinkron' ? tundaReplikasiDetik / 60 : intervalBackupMenit;
  return {
    rpoMenit: r2(rpo),
    rtoMenit: waktuPulihMenit,
    strategi: replikasi,
    arti: replikasi === 'sinkron'
      ? 'RPO 0: tidak ada transaksi yang hilang, tetapi setiap commit menunggu situs jauh (latensi naik).'
      : replikasi === 'asinkron'
        ? `RPO ≈ ${r2(rpo)} menit: transaksi dalam jendela itu bisa hilang, tetapi commit lokal tetap cepat.`
        : `RPO = ${intervalBackupMenit} menit: seluruh perubahan sejak backup terakhir hilang.`,
  };
}

const r2 = (x) => Math.round(x * 100) / 100;
const r4 = (x) => Math.round(x * 10000) / 10000;
const r6 = (x) => Math.round(x * 1e6) / 1e6;
