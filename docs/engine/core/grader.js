// grader.js — penilai otomatis jawaban SQL.
// Jawaban mahasiswa dijalankan, kunci dijalankan, lalu HASILNYA dibandingkan.
// Yang dinilai isi hasil, bukan teks kueri: `sem <> 1` dan `NOT sem = 1` sama benar.

import { execute, parse, query } from './sql.js?v=849b085103';
import { executeScript, salinDb } from './dml.js?v=849b085103';
import { RS_KEYS_CASCADE } from '../data/datasets.js?v=849b085103';

function normalkan(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Math.round(v * 1e6) / 1e6;
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Math.round(Number(v) * 1e6) / 1e6;
  return String(v);
}

const kunciBaris = (r) => JSON.stringify(r.map(normalkan));

/**
 * Apakah hasil kueri terurut secara eksplisit?
 * ORDER BY di akhir UNION/INTERSECT/MINUS sudah diangkat parser ke simpul
 * himpunan, dan WITH dinilai dari badannya.
 */
export function punyaOrderBy(sql) {
  try {
    let ast = parse(sql);
    while (ast.type === 'with') ast = ast.body;
    return (ast.orderBy || []).length > 0;
  } catch {
    return /order\s+by/i.test(sql);
  }
}

/**
 * Nilai satu jawaban.
 * @returns {{benar:boolean, skor:number, alasan:string[], petunjuk:string[], hasilJawaban?:object, hasilKunci:object, galat?:string}}
 */
export function gradeQuery(sqlJawaban, sqlKunci, db, { urutWajib = null } = {}) {
  const kunci = execute(sqlKunci, db).relation;
  const wajibUrut = urutWajib ?? punyaOrderBy(sqlKunci);

  if (!String(sqlJawaban || '').trim()) {
    return { benar: false, skor: 0, alasan: ['Jawaban masih kosong.'], petunjuk: [], hasilKunci: kunci };
  }

  let jawaban;
  try {
    jawaban = execute(sqlJawaban, db).relation;
  } catch (e) {
    return { benar: false, skor: 0, alasan: ['Kueri tidak dapat dijalankan.'], petunjuk: [e.message], galat: e.message, hasilKunci: kunci };
  }

  const alasan = [];
  const petunjuk = [];
  let skor = 0;

  // 1) jumlah kolom — 20%
  const kolomSama = jawaban.degree === kunci.degree;
  if (kolomSama) skor += 20;
  else {
    alasan.push(`Jumlah kolom ${jawaban.degree}, seharusnya ${kunci.degree}.`);
    petunjuk.push(`Kolom yang diharapkan: ${kunci.attrs.join(', ')}.`);
  }

  // 2) jumlah baris — 20%
  const barisSama = jawaban.cardinality === kunci.cardinality;
  if (barisSama) skor += 20;
  else {
    alasan.push(`Jumlah baris ${jawaban.cardinality}, seharusnya ${kunci.cardinality}.`);
    petunjuk.push(jawaban.cardinality > kunci.cardinality
      ? 'Terlalu banyak baris — periksa kondisi WHERE atau syarat join yang kurang.'
      : 'Terlalu sedikit baris — periksa kondisi WHERE yang terlalu ketat, atau jenis JOIN yang dipakai.');
  }

  // 3) isi sebagai multiset — 45%
  let isiSama = false;
  if (kolomSama) {
    const A = new Map();
    for (const r of jawaban.rows) A.set(kunciBaris(r), (A.get(kunciBaris(r)) || 0) + 1);
    const B = new Map();
    for (const r of kunci.rows) B.set(kunciBaris(r), (B.get(kunciBaris(r)) || 0) + 1);
    isiSama = A.size === B.size && [...A.entries()].every(([k, n]) => B.get(k) === n);
    if (isiSama) skor += 45;
    else {
      const cocok = [...A.entries()].reduce((s, [k, n]) => s + Math.min(n, B.get(k) || 0), 0);
      const porsi = kunci.cardinality ? cocok / Math.max(kunci.cardinality, jawaban.cardinality) : 0;
      skor += Math.round(45 * porsi);
      alasan.push(`Isi hasil berbeda: ${cocok} dari ${kunci.cardinality} baris cocok.`);
      if (!barisSama) { /* petunjuk jumlah baris sudah diberikan */ } else petunjuk.push('Jumlah baris sudah benar tetapi nilainya berbeda — periksa kolom yang dipilih atau urutan kolomnya.');
    }
  }

  // 4) urutan — 15% (hanya bila kunci memakai ORDER BY)
  if (wajibUrut) {
    const urutSama = isiSama && jawaban.rows.every((r, i) => kunciBaris(r) === kunciBaris(kunci.rows[i]));
    if (urutSama) skor += 15;
    else if (isiSama) {
      alasan.push('Isi sudah benar tetapi urutan baris berbeda.');
      petunjuk.push('Soal ini meminta hasil terurut — tambahkan atau periksa ORDER BY.');
    }
  } else if (isiSama) {
    skor += 15;
  }

  const benar = skor === 100;
  if (benar) {
    const namaBeda = jawaban.attrs.some((a, i) => a !== kunci.attrs[i]);
    if (namaBeda) petunjuk.push(`Hasil benar. Catatan: nama kolom Anda (${jawaban.attrs.join(', ')}) berbeda dari kunci (${kunci.attrs.join(', ')}) — tidak memengaruhi nilai.`);
  }
  return { benar, skor, alasan, petunjuk, hasilJawaban: jawaban, hasilKunci: kunci };
}

/**
 * Nilai jawaban berupa perintah DML (INSERT/UPDATE/DELETE).
 * Jawaban dan kunci dijalankan pada dua salinan basis data yang terpisah, lalu
 * KEADAAN AKHIR tabel dibandingkan lewat kueri pemeriksa. Basis data asli tidak
 * pernah diubah, sehingga soal bisa dicoba berulang kali.
 */
export function gradeScript(sqlJawaban, sqlKunci, db, { periksa, kunci = null } = {}) {
  if (!periksa) throw new Error('gradeScript membutuhkan kueri pemeriksa (opsi periksa).');
  const dbKunci = salinDb(db);
  const rKunci = executeScript(sqlKunci, dbKunci, { kunci });
  if (rKunci.galat) throw new Error(`Kunci jawaban gagal dijalankan: ${rKunci.galat}`);
  const hasilKunci = query(periksa, dbKunci);

  if (!String(sqlJawaban || '').trim()) {
    return { benar: false, skor: 0, alasan: ['Jawaban masih kosong.'], petunjuk: [], hasilKunci };
  }
  const dbJawaban = salinDb(db);
  const rJawaban = executeScript(sqlJawaban, dbJawaban, { kunci });
  if (rJawaban.galat) {
    return { benar: false, skor: 0, alasan: ['Perintah tidak dapat dijalankan.'], petunjuk: [rJawaban.galat], galat: rJawaban.galat, hasilKunci };
  }
  const bukanDml = rJawaban.hasil.filter((h) => h.jenis === 'SELECT');
  const hasilJawaban = query(periksa, dbJawaban);

  const A = new Map();
  for (const r of hasilJawaban.rows) A.set(kunciBaris(r), (A.get(kunciBaris(r)) || 0) + 1);
  const B = new Map();
  for (const r of hasilKunci.rows) B.set(kunciBaris(r), (B.get(kunciBaris(r)) || 0) + 1);
  const cocok = [...A.entries()].reduce((n, [k, c]) => n + Math.min(c, B.get(k) || 0), 0);
  const pembagi = Math.max(hasilKunci.cardinality, hasilJawaban.cardinality);
  const identik = A.size === B.size && [...A.entries()].every(([k, c]) => B.get(k) === c);

  const alasan = [];
  const petunjuk = [];
  if (!identik) {
    alasan.push(`Keadaan tabel setelah perintah berbeda: ${cocok} dari ${hasilKunci.cardinality} baris sesuai.`);
    if (hasilJawaban.cardinality > hasilKunci.cardinality) petunjuk.push('Tabel berisi lebih banyak baris dari seharusnya — periksa WHERE pada DELETE, atau INSERT yang berlebih.');
    else if (hasilJawaban.cardinality < hasilKunci.cardinality) petunjuk.push('Tabel berisi lebih sedikit baris dari seharusnya — WHERE pada DELETE mungkin terlalu longgar.');
    else petunjuk.push('Jumlah baris sama tetapi nilainya berbeda — periksa klausa SET dan kondisi WHERE pada UPDATE.');
  }
  if (bukanDml.length) petunjuk.push('Jawaban memuat SELECT; soal ini meminta perintah yang MENGUBAH data.');
  const skor = identik ? 100 : Math.round(80 * (pembagi ? cocok / pembagi : 0));
  return {
    benar: identik,
    skor,
    alasan,
    petunjuk,
    hasilJawaban,
    hasilKunci,
    terdampak: rJawaban.hasil.reduce((n, h) => n + (h.terdampak || 0), 0),
  };
}

/** Nilai satu soal bank: soal ber-`periksa` dinilai sebagai DML, sisanya sebagai kueri. */
export function gradeSoal(soal, jawaban, db) {
  return soal.periksa
    ? gradeScript(jawaban, soal.kunci, db, { periksa: soal.periksa, kunci: soal.integritas === 'cascade' ? RS_KEYS_CASCADE : (soal.aturanKunci || null) })
    : gradeQuery(jawaban, soal.kunci, db);
}

/** Nilai seluruh bank soal sekaligus. */
export function gradeAll(jawabanPerSoal, bankSoal, db) {
  const hasil = bankSoal.map((s) => ({ id: s.id, ...gradeSoal(s, jawabanPerSoal[s.id] || '', db) }));
  const total = hasil.reduce((a, h) => a + h.skor, 0);
  return {
    hasil,
    benar: hasil.filter((h) => h.benar).length,
    jumlah: bankSoal.length,
    nilai: bankSoal.length ? Math.round((total / (bankSoal.length * 100)) * 1000) / 10 : 0,
  };
}
