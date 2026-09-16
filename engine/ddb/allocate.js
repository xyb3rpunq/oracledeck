// allocate.js — alokasi dan replikasi fragmen ke situs.
// Masukan model biaya diambil persis dari daftar informasi pada Modul 7
// ("Teknik Lokalisasi Data"): informasi basis data, aplikasi, situs, dan jaringan.
//
// Biaya total = biaya simpan + biaya baca (ambil replika terdekat)
//             + biaya perbarui (wajib menyentuh SEMUA replika).
// Itulah pertukaran inti replikasi: baca jadi murah, tulis jadi mahal.

/**
 * @typedef {{nama:string, ukuranKB:number}} FragmentInfo
 * @typedef {{id:string, nama?:string, biayaSimpan:number, biayaProses:number, keandalan?:number}} SiteInfo
 * @typedef {{nama:string, situsAsal:string, baca:Object<string,number>, perbarui:Object<string,number>}} QueryInfo
 * @typedef {{latency:Object, bandwidth:Object}} NetworkInfo
 */

/** Biaya kirim data ukuranKB dari situs a ke b (satuan biaya abstrak). */
export function transferCost(a, b, ukuranKB, net) {
  if (a === b) return 0;
  const lat = net.latency?.[a]?.[b] ?? net.latency?.[b]?.[a] ?? 0;
  const bw = net.bandwidth?.[a]?.[b] ?? net.bandwidth?.[b]?.[a] ?? 1;
  // biaya = komponen tunda (per pesan) + komponen volume (KB / Mbps)
  return lat / 10 + (ukuranKB * 8) / Math.max(bw, 0.001);
}

/**
 * Hitung biaya satu rencana alokasi.
 * @param {Object<string,string[]>} alokasi peta namaFragmen -> daftar id situs
 */
export function evaluateAllocation(alokasi, { fragmen, situs, queries, jaringan }) {
  const fmap = Object.fromEntries(fragmen.map((f) => [f.nama, f]));
  const smap = Object.fromEntries(situs.map((s) => [s.id, s]));
  const rincian = { simpan: 0, baca: 0, perbarui: 0 };
  const perFragmen = {};

  for (const f of fragmen) {
    const sites = alokasi[f.nama] || [];
    if (sites.length === 0) throw new Error(`Alokasi tidak sah: fragmen "${f.nama}" tidak ditempatkan di situs mana pun`);
    const biaya = sites.reduce((acc, s) => acc + f.ukuranKB * (smap[s]?.biayaSimpan ?? 1), 0);
    rincian.simpan += biaya;
    perFragmen[f.nama] = { simpan: biaya, baca: 0, perbarui: 0, replika: sites.length, situs: sites.slice() };
  }

  for (const q of queries) {
    for (const [fn, n] of Object.entries(q.baca || {})) {
      if (!n) continue;
      const f = fmap[fn];
      if (!f) throw new Error(`Query "${q.nama}" membaca fragmen "${fn}" yang tidak terdaftar`);
      const sites = alokasi[fn];
      // ambil replika termurah dari situs asal query
      const best = Math.min(...sites.map((s) => transferCost(q.situsAsal, s, f.ukuranKB, jaringan) + (smap[s]?.biayaProses ?? 1)));
      const biaya = n * best;
      rincian.baca += biaya;
      perFragmen[fn].baca += biaya;
    }
    for (const [fn, n] of Object.entries(q.perbarui || {})) {
      if (!n) continue;
      const f = fmap[fn];
      if (!f) throw new Error(`Query "${q.nama}" memperbarui fragmen "${fn}" yang tidak terdaftar`);
      const sites = alokasi[fn];
      // pembaruan harus menyentuh SELURUH replika
      const biaya = n * sites.reduce((acc, s) => acc + transferCost(q.situsAsal, s, f.ukuranKB, jaringan) + (smap[s]?.biayaProses ?? 1), 0);
      rincian.perbarui += biaya;
      perFragmen[fn].perbarui += biaya;
    }
  }

  const total = rincian.simpan + rincian.baca + rincian.perbarui;
  return { total: round(total), rincian: mapRound(rincian), perFragmen: roundNested(perFragmen), alokasi };
}

/** Enumerasi seluruh kombinasi alokasi (eksak) selama ruangnya masih wajar. */
export function optimalAllocation(input, { maxKombinasi = 200000 } = {}) {
  const { fragmen, situs } = input;
  const subsets = nonEmptySubsets(situs.map((s) => s.id));
  const ruang = Math.pow(subsets.length, fragmen.length);
  if (ruang > maxKombinasi) {
    return { metode: 'greedy', ruangPencarian: ruang, ...greedyAllocation(input) };
  }
  let best = null;
  const cur = {};
  const rec = (i) => {
    if (i === fragmen.length) {
      const ev = evaluateAllocation({ ...cur }, input);
      if (!best || ev.total < best.total) best = ev;
      return;
    }
    for (const sub of subsets) {
      cur[fragmen[i].nama] = sub;
      rec(i + 1);
    }
  };
  rec(0);
  return { metode: 'eksak (enumerasi penuh)', ruangPencarian: ruang, ...best };
}

/** Heuristik greedy: mulai dari situs terbaik per fragmen, tambah replika bila menurunkan biaya. */
export function greedyAllocation(input) {
  const { fragmen, situs } = input;
  const alokasi = {};
  for (const f of fragmen) {
    let best = null;
    for (const s of situs) {
      const trial = { ...alokasi, [f.nama]: [s.id] };
      for (const g of fragmen) if (!trial[g.nama]) trial[g.nama] = [situs[0].id];
      const ev = evaluateAllocation(trial, input);
      if (!best || ev.total < best.total) best = { total: ev.total, situs: s.id };
    }
    alokasi[f.nama] = [best.situs];
  }
  let improved = true;
  while (improved) {
    improved = false;
    const base = evaluateAllocation({ ...alokasi }, input).total;
    for (const f of fragmen) {
      for (const s of situs) {
        if (alokasi[f.nama].includes(s.id)) continue;
        const trial = { ...alokasi, [f.nama]: [...alokasi[f.nama], s.id] };
        const ev = evaluateAllocation(trial, input);
        if (ev.total < base - 1e-9) { alokasi[f.nama] = trial[f.nama]; improved = true; }
      }
    }
  }
  return evaluateAllocation(alokasi, input);
}

/** Alokasi "semua direplikasi penuh" — pembanding batas atas. */
export function fullReplication(input) {
  const alokasi = Object.fromEntries(input.fragmen.map((f) => [f.nama, input.situs.map((s) => s.id)]));
  return evaluateAllocation(alokasi, input);
}

/** Alokasi tersentralisasi di satu situs — pembanding batas bawah penyimpanan. */
export function centralized(input, situsId) {
  const id = situsId || input.situs[0].id;
  const alokasi = Object.fromEntries(input.fragmen.map((f) => [f.nama, [id]]));
  return evaluateAllocation(alokasi, input);
}

/**
 * Ketersediaan fragmen = 1 - Π(1 - keandalan situs replika).
 * Ini angka yang dipakai untuk membenarkan replikasi pada Modul 1
 * ("Keberadaan data yang ditingkatkan", "Keandalan yang ditingkatkan").
 */
export function availability(alokasi, situs) {
  const smap = Object.fromEntries(situs.map((s) => [s.id, s]));
  const out = {};
  for (const [f, sites] of Object.entries(alokasi)) {
    const p = sites.reduce((acc, s) => acc * (1 - (smap[s]?.keandalan ?? 0.99)), 1);
    out[f] = { ketersediaan: round6(1 - p), replika: sites.length, situs: sites.slice() };
  }
  const nilai = Object.values(out).map((o) => o.ketersediaan);
  return { perFragmen: out, sistem: round6(nilai.reduce((a, b) => a * b, 1)), terlemah: round6(Math.min(...nilai)) };
}

/** Matriks penggunaan fragmen: berapa kali tiap query membaca/menulis tiap fragmen. */
export function usageMatrix(fragmen, queries) {
  return {
    kolom: fragmen.map((f) => f.nama),
    baris: queries.map((q) => ({
      query: q.nama,
      situsAsal: q.situsAsal,
      baca: fragmen.map((f) => q.baca?.[f.nama] || 0),
      perbarui: fragmen.map((f) => q.perbarui?.[f.nama] || 0),
    })),
  };
}

export function nonEmptySubsets(items) {
  const out = [];
  for (let mask = 1; mask < (1 << items.length); mask++) {
    out.push(items.filter((_, i) => mask & (1 << i)));
  }
  return out;
}

const round = (x) => Math.round(x * 1000) / 1000;
const round6 = (x) => Math.round(x * 1e6) / 1e6;
const mapRound = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, round(v)]));
const roundNested = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { ...v, simpan: round(v.simpan), baca: round(v.baca), perbarui: round(v.perbarui) }]));
