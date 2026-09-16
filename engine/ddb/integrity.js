// integrity.js — integritas data lintas situs.
// Menutup kelemahan ke-4 DDBS pada Modul 1 ("Pengontrolan integritas lebih sulit")
// dan studi kasus skripsi "Implementasi Basis Data Terdistribusi untuk Meningkatkan
// Konsistensi Data Kependudukan" yang ada di folder mata kuliah.
//
// Inti masalahnya: batasan UNIQUE dan FOREIGN KEY hanya ditegakkan DBMS LOKAL.
// Tiap desa bisa lulus UNIQUE(nik) di basis datanya sendiri, sementara NIK yang
// sama tercatat di dua desa sekaligus. Tidak ada satu DBMS pun yang melihatnya.

import { Relation, canon } from '../core/relation.js';

/** Apakah kunci unik di dalam SATU fragmen? (yang ditegakkan DBMS lokal) */
export function localUniqueCheck(fragmen, kunci) {
  const i = fragmen.relasi.indexOf(kunci);
  if (i < 0) throw new Error(`localUniqueCheck: kolom "${kunci}" tidak ada di ${fragmen.nama}`);
  const hitung = new Map();
  for (const r of fragmen.relasi.rows) {
    const k = canon(r[i]);
    hitung.set(k, (hitung.get(k) || 0) + 1);
  }
  const ganda = [...hitung.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  return { fragmen: fragmen.nama, lulus: ganda.length === 0, ganda };
}

/**
 * Pelanggaran keunikan GLOBAL: nilai kunci yang muncul di lebih dari satu fragmen.
 * Tiap temuan diklasifikasikan:
 *   identik — baris sama persis (salinan yang tidak dihapus, mis. penduduk pindah)
 *   konflik — kunci sama tetapi isi berbeda (salah input atau pemalsuan)
 */
export function globalUniqueViolations(fragments, kunci, { abaikan = [] } = {}) {
  const peta = new Map();
  for (const f of fragments) {
    const i = f.relasi.indexOf(kunci);
    if (i < 0) throw new Error(`globalUniqueViolations: kolom "${kunci}" tidak ada di ${f.nama}`);
    f.relasi.rows.forEach((r) => {
      const k = canon(r[i]);
      if (!peta.has(k)) peta.set(k, []);
      peta.get(k).push({ situs: f.nama, baris: f.relasi.attrs.reduce((o, a, j) => ({ ...o, [a]: r[j] }), {}) });
    });
  }
  const temuan = [];
  for (const [nilai, muncul] of peta.entries()) {
    const situs = [...new Set(muncul.map((m) => m.situs))];
    if (situs.length < 2) continue;
    const bandingkan = (b) => JSON.stringify(Object.entries(b).filter(([a]) => !abaikan.includes(a)).sort());
    const identik = muncul.every((m) => bandingkan(m.baris) === bandingkan(muncul[0].baris));
    const beda = identik ? [] : Object.keys(muncul[0].baris).filter((a) => !abaikan.includes(a)
      && new Set(muncul.map((m) => JSON.stringify(m.baris[a]))).size > 1);
    temuan.push({ nilai, situs, jenis: identik ? 'identik' : 'konflik', atributBerbeda: beda, muncul });
  }
  return {
    lulus: temuan.length === 0,
    temuan,
    identik: temuan.filter((t) => t.jenis === 'identik').length,
    konflik: temuan.filter((t) => t.jenis === 'konflik').length,
  };
}

/**
 * Laporan konsistensi kependudukan: memadukan data desa dengan catatan peristiwa
 * di tingkat kecamatan (kematian dan kepindahan).
 */
export function consistencyReport({ fragmen, kematian = null, pindah = null, kunci = 'nik', kolomStatus = 'status', kolomDesa = 'desa' }) {
  const lokal = fragmen.map((f) => localUniqueCheck(f, kunci));
  const global = globalUniqueViolations(fragmen, kunci, { abaikan: [kolomDesa] });
  const masalah = [];

  // NIK ganda yang sudah dijelaskan catatan pindah dilaporkan sebagai "pindah belum
  // dihapus" saja, supaya satu penduduk tidak muncul sebagai dua masalah berbeda.
  const nikPindah = new Set(pindah ? pindah.rows.map((r) => canon(r[pindah.indexOf(kunci)])) : []);
  for (const t of global.temuan) {
    if (t.jenis === 'identik' && nikPindah.has(t.nilai)) continue;
    masalah.push({
      jenis: t.jenis === 'identik' ? 'NIK ganda (salinan)' : 'NIK ganda (isi berbeda)',
      nik: t.nilai,
      situs: t.situs,
      rincian: t.jenis === 'identik'
        ? `tercatat identik di ${t.situs.join(' dan ')}`
        : `data berbeda pada ${t.atributBerbeda.join(', ')} di ${t.situs.join(' dan ')}`,
      tingkat: t.jenis === 'identik' ? 'sedang' : 'tinggi',
    });
  }

  if (kematian) {
    const iNik = kematian.indexOf(kunci);
    const wafat = new Set(kematian.rows.map((r) => canon(r[iNik])));
    for (const f of fragmen) {
      const iK = f.relasi.indexOf(kunci);
      const iS = f.relasi.indexOf(kolomStatus);
      f.relasi.rows.forEach((r) => {
        if (wafat.has(canon(r[iK])) && iS >= 0 && r[iS] === 'hidup') {
          masalah.push({ jenis: 'Meninggal masih aktif', nik: r[iK], situs: [f.nama], rincian: `tercatat wafat di kecamatan, masih berstatus hidup di ${f.nama}`, tingkat: 'tinggi' });
        }
      });
    }
  }

  if (pindah) {
    const iNik = pindah.indexOf(kunci);
    const iDari = pindah.indexOf('dari');
    const iKe = pindah.indexOf('ke');
    for (const p of pindah.rows) {
      const asal = fragmen.find((f) => f.nama === p[iDari]);
      if (!asal) continue;
      const iK = asal.relasi.indexOf(kunci);
      const iS = asal.relasi.indexOf(kolomStatus);
      const masih = asal.relasi.rows.find((r) => canon(r[iK]) === canon(p[iNik]) && (iS < 0 || r[iS] === 'hidup'));
      if (masih) {
        masalah.push({ jenis: 'Pindah belum dihapus', nik: p[iNik], situs: [p[iDari]], rincian: `pindah ke ${p[iKe]} tetapi masih aktif di ${p[iDari]}`, tingkat: 'sedang' });
      }
    }
  }

  const totalBaris = fragmen.reduce((a, f) => a + f.relasi.cardinality, 0);
  const nikUnik = new Set(fragmen.flatMap((f) => f.relasi.rows.map((r) => canon(r[f.relasi.indexOf(kunci)])))).size;
  return {
    lokalLulusSemua: lokal.every((l) => l.lulus),
    lokal,
    global,
    masalah,
    totalBaris,
    nikUnik,
    barisBerlebih: totalBaris - nikUnik,
    konsisten: masalah.length === 0,
  };
}

/**
 * Tiga strategi menegakkan keunikan NIK lintas situs, beserta harganya.
 *  sinkron      — setiap INSERT di desa memeriksa seluruh situs lain lewat database link
 *  terpusat     — NIK hanya boleh diterbitkan server pusat (Dukcapil)
 *  asinkron     — desa bebas insert, rekonsiliasi berkala mendeteksi ganda
 */
export function enforcementStrategies({ jumlahSitus = 3, latensiMs = 25, ketersediaanSitus = 0.98, insertPerHari = 200, intervalRekonsiliasiJam = 24 } = {}) {
  const lain = jumlahSitus - 1;
  const r = (x) => Math.round(x * 1e6) / 1e6;
  return [
    {
      id: 'sinkron',
      nama: 'Cek global sinkron',
      cara: 'Sebelum INSERT, desa menanyakan NIK ke seluruh situs lain lewat database link.',
      latensiTambahanMs: lain * latensiMs * 2,
      ketersediaanInsert: r(Math.pow(ketersediaanSitus, jumlahSitus)),
      jendelaInkonsistensiJam: 0,
      pesanPerHari: insertPerHari * lain * 2,
      kelemahan: 'Satu desa mati, seluruh desa lain tidak bisa mendaftarkan penduduk. Ketersediaan tulis turun setiap kali situs bertambah.',
      catatanOracle: 'Kueri lewat database link hanya membaca; cek-lalu-insert tetap punya celah balapan tanpa kunci lintas situs.',
    },
    {
      id: 'terpusat',
      nama: 'Penerbit NIK terpusat',
      cara: 'Desa meminta NIK ke server pusat; hanya pusat yang menerbitkan dan mencatatnya.',
      latensiTambahanMs: latensiMs * 2,
      ketersediaanInsert: r(ketersediaanSitus * ketersediaanSitus),
      jendelaInkonsistensiJam: 0,
      pesanPerHari: insertPerHari * 2,
      kelemahan: 'Melanggar prinsip "tidak bergantung situs pusat": pusat mati, pendaftaran se-kecamatan berhenti.',
      catatanOracle: 'Wujud Oracle-nya SEQUENCE di satu situs yang diakses lewat database link.',
    },
    {
      id: 'asinkron',
      nama: 'Rekonsiliasi asinkron',
      cara: 'Desa insert secara lokal; job berkala di kecamatan mencari NIK ganda dan menandainya.',
      latensiTambahanMs: 0,
      ketersediaanInsert: r(ketersediaanSitus),
      jendelaInkonsistensiJam: intervalRekonsiliasiJam,
      pesanPerHari: Math.ceil(24 / Math.max(intervalRekonsiliasiJam, 1)) * lain,
      kelemahan: `Selama ${intervalRekonsiliasiJam} jam, NIK ganda bisa ada dan dipakai (mis. untuk DPT).`,
      catatanOracle: 'Wujud Oracle-nya DBMS_SCHEDULER yang menjalankan kueri UNION ALL lintas link lalu GROUP BY nik HAVING COUNT(*) > 1.',
    },
  ];
}

/** SQL Oracle untuk mendeteksi NIK ganda lintas situs. */
export function oracleDuplicateSql(situs, { tabel = 'PENDUDUK', kunci = 'NIK' } = {}) {
  const cabang = situs.map((s) => `  SELECT ${kunci}, '${s.nama}' AS SITUS FROM ${tabel}${s.link ? `@${s.link}` : ''}`);
  return [
    '-- NIK yang tercatat di lebih dari satu desa.',
    '-- UNIQUE(NIK) di tiap desa TIDAK bisa menangkap ini: tiap DBMS hanya melihat datanya sendiri.',
    `SELECT ${kunci}, COUNT(*) AS JUMLAH, LISTAGG(SITUS, ', ') WITHIN GROUP (ORDER BY SITUS) AS DI_DESA`,
    'FROM (',
    cabang.join('\n  UNION ALL\n'),
    ')',
    `GROUP BY ${kunci}`,
    'HAVING COUNT(*) > 1;',
  ].join('\n');
}

/** Tindakan perbaikan yang aman dilakukan otomatis vs yang wajib diverifikasi petugas. */
export function reconciliationPlan(laporan) {
  const otomatis = [];
  const manual = [];
  for (const m of laporan.masalah) {
    if (m.jenis === 'Pindah belum dihapus') otomatis.push({ ...m, tindakan: `nonaktifkan NIK ${m.nik} di ${m.situs[0]} (bukti: catatan pindah)` });
    else if (m.jenis === 'Meninggal masih aktif') otomatis.push({ ...m, tindakan: `ubah status NIK ${m.nik} menjadi meninggal (bukti: catatan kematian)` });
    else if (m.jenis === 'NIK ganda (salinan)') manual.push({ ...m, tindakan: `tentukan domisili sah NIK ${m.nik} — tidak ada catatan pindah yang menjelaskannya` });
    else manual.push({ ...m, tindakan: `verifikasi dokumen fisik NIK ${m.nik}; isi berbeda tidak boleh diputuskan mesin` });
  }
  return { otomatis, manual, catatan: 'Perbaikan otomatis hanya dilakukan bila ada bukti peristiwa tercatat. Konflik isi tidak pernah diputuskan oleh mesin.' };
}

export { Relation };
