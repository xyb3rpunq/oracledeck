// export_for_verify.js — jalankan seluruh kueri acuan lewat mesin ORACLEDECK,
// lalu tulis dataset + hasilnya ke JSON agar dapat dibandingkan dengan SQLite.
// Dipakai oleh tools/verify_sqlite.py.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { akademik, rumahsakit, dreamhome } from '../engine/data/datasets.js';
import { query } from '../engine/core/sql.js';
import { executeScript, salinDb } from '../engine/core/dml.js';

const here = dirname(fileURLToPath(import.meta.url));
const db = { ...akademik(), ...rumahsakit(), ...dreamhome() };

/**
 * Kueri acuan. Semua ditulis dalam subset SQL yang juga sah di SQLite,
 * sehingga perbedaan hasil benar-benar menunjukkan galat mesin, bukan dialek.
 */
export const KUERI = [
  // Praktikum 3 — agregasi & operator WHERE
  ['p3-semua', 'SELECT * FROM mata_kuliah'],
  ['p3-sem1', 'SELECT * FROM mata_kuliah WHERE sem = 1'],
  ['p3-bukan-sem1', 'SELECT * FROM mata_kuliah WHERE sem <> 1'],
  ['p3-like', "SELECT * FROM mata_kuliah WHERE nama_kul LIKE '%Informatika%'"],
  ['p3-like-and', "SELECT * FROM mata_kuliah WHERE nama_kul LIKE '%Informatika%' AND sks = 3"],
  ['p3-count', 'SELECT COUNT(*) AS c FROM mata_kuliah'],
  ['p3-minmaxavg', 'SELECT MIN(sks) AS a, MAX(sks) AS b, AVG(sks) AS c FROM mata_kuliah'],
  ['p3-sum', 'SELECT SUM(sks) AS total FROM mata_kuliah'],
  ['p3-between', 'SELECT kode_kul, sks FROM mata_kuliah WHERE sks BETWEEN 2 AND 3'],
  ['p3-in', 'SELECT kode_kul FROM mata_kuliah WHERE sem IN (1, 3)'],
  ['p3-not', 'SELECT kode_kul FROM mata_kuliah WHERE NOT sem = 1'],

  // Praktikum 4 — query dari relasi tabel
  ['p4-join-where', "SELECT mhs.nama_mhs, nilai.nilai FROM mhs, nilai WHERE mhs.nim = nilai.nim AND nilai.kode_kul = 'IT0401'"],
  ['p4-tiga-tabel', 'SELECT k.nama_kul, m.nama_mhs, n.nilai FROM mhs m, nilai n, mata_kuliah k WHERE m.nim = n.nim AND n.kode_kul = k.kode_kul ORDER BY n.nilai ASC'],

  // Praktikum 5 — JOIN
  ['p5-inner', 'SELECT m.nama_mhs, n.kode_kul, n.nilai FROM mhs m JOIN nilai n ON m.nim = n.nim'],
  ['p5-left', 'SELECT m.nama_mhs, n.nilai FROM mhs m LEFT JOIN nilai n ON m.nim = n.nim'],
  ['p5-left-null', 'SELECT m.nama_mhs FROM mhs m LEFT JOIN nilai n ON m.nim = n.nim WHERE n.nilai IS NULL'],
  ['p5-union', 'SELECT nim FROM mhs UNION SELECT nim FROM nilai'],
  ['p5-union-all', 'SELECT nim FROM mhs UNION ALL SELECT nim FROM nilai'],

  // Agregasi berkelompok
  ['agg-group', 'SELECT sem, COUNT(*) AS jml, SUM(sks) AS tot FROM mata_kuliah GROUP BY sem'],
  ['agg-having', 'SELECT sem, COUNT(*) AS jml FROM mata_kuliah GROUP BY sem HAVING COUNT(*) > 1'],
  ['agg-order', 'SELECT sem, COUNT(*) AS jml FROM mata_kuliah GROUP BY sem ORDER BY jml DESC, sem ASC'],
  ['agg-distinct', 'SELECT COUNT(DISTINCT sks) AS c FROM mata_kuliah'],

  // Rumah sakit — kueri laporan
  ['rs-riwayat', `SELECT p.nama_pasien, d.nama_dokter, pd.waktu_periksa, pd.resep
                  FROM pasien p JOIN pasien_dokter pd ON p.id_pasien = pd.id_pasien
                  JOIN dokter d ON pd.id_dokter = d.id_dokter
                  ORDER BY pd.waktu_periksa, p.nama_pasien`],
  ['rs-statistik', `SELECT d.nama_dokter, COUNT(*) AS jumlah_periksa, SUM(pd.biaya) AS total_biaya
                    FROM dokter d JOIN pasien_dokter pd ON d.id_dokter = pd.id_dokter
                    GROUP BY d.nama_dokter ORDER BY jumlah_periksa DESC, d.nama_dokter ASC`],
  ['rs-kota', 'SELECT kota, COUNT(*) AS jml FROM pasien GROUP BY kota ORDER BY kota'],
  ['rs-sering', `SELECT p.nama_pasien, COUNT(*) AS n FROM pasien p
                 JOIN pasien_dokter pd ON p.id_pasien = pd.id_pasien
                 GROUP BY p.nama_pasien HAVING COUNT(*) > 1 ORDER BY p.nama_pasien`],
  ['rs-subquery', `SELECT nama_pasien FROM pasien WHERE id_pasien IN
                   (SELECT id_pasien FROM pasien_dokter WHERE biaya > 400000) ORDER BY nama_pasien`],
  ['rs-admin-daftar', `SELECT a.nama_admin, COUNT(*) AS jml FROM administrator a
                       JOIN daftar df ON a.id_admin = df.id_admin GROUP BY a.nama_admin ORDER BY a.nama_admin`],

  // DreamHome — contoh modul
  ['dh-manager', "SELECT fname, lname FROM STAFF WHERE position = 'Manager' ORDER BY staffno"],
  ['dh-subquery', "SELECT fname, lname FROM STAFF WHERE staffno IN (SELECT staffno FROM STAFF WHERE position = 'Manager') ORDER BY staffno"],
  ['dh-fragmen-b3', "SELECT staffno, fname, lname FROM STAFF WHERE branchno = 'B3' ORDER BY staffno"],
  ['dh-join-branch', `SELECT s.fname, s.lname, b.city FROM STAFF s JOIN BRANCH b ON s.branchno = b.branchno ORDER BY s.staffno`],
  ['dh-property', `SELECT s.lname, COUNT(*) AS jml FROM STAFF s JOIN PROPERTY p ON s.staffno = p.staffno
                   GROUP BY s.lname ORDER BY jml DESC, s.lname ASC`],
  ['dh-salary-range', 'SELECT staffno, salary FROM STAFF WHERE salary BETWEEN 9000 AND 18000 ORDER BY salary DESC, staffno'],
  ['dh-avg-branch', 'SELECT branchno, AVG(salary) AS rata FROM STAFF GROUP BY branchno ORDER BY branchno'],

  // Ekspresi & fungsi
  ['fn-upper', 'SELECT UPPER(nama_pasien) AS n FROM pasien ORDER BY id_pasien'],
  ['fn-length', 'SELECT nama_pasien, LENGTH(nama_pasien) AS n FROM pasien ORDER BY id_pasien'],
  ['fn-arit', 'SELECT kode_kul, sks * 2 AS dua FROM mata_kuliah ORDER BY kode_kul'],
  ['fn-round', 'SELECT ROUND(AVG(sks), 2) AS r FROM mata_kuliah'],

  // SQL lanjutan: CASE, EXISTS berkorelasi, subquery skalar berkorelasi, WITH, operasi himpunan
  ['lj-case', "SELECT kode_kul, CASE WHEN sks >= 3 THEN 'berat' ELSE 'ringan' END AS bobot FROM mata_kuliah ORDER BY kode_kul"],
  ['lj-case-sederhana', "SELECT kode_kul, CASE sem WHEN 1 THEN 'satu' WHEN 2 THEN 'dua' ELSE 'lain' END AS s FROM mata_kuliah ORDER BY kode_kul"],
  ['lj-case-agregat', 'SELECT SUM(CASE WHEN sks = 3 THEN 1 ELSE 0 END) AS tiga, COUNT(*) AS semua FROM mata_kuliah'],
  ['lj-exists', 'SELECT m.nama_mhs FROM mhs m WHERE EXISTS (SELECT 1 FROM nilai n WHERE n.nim = m.nim) ORDER BY m.nama_mhs'],
  ['lj-not-exists', 'SELECT m.nama_mhs FROM mhs m WHERE NOT EXISTS (SELECT 1 FROM nilai n WHERE n.nim = m.nim) ORDER BY m.nama_mhs'],
  ['lj-skalar-korelasi', 'SELECT m.nama_mhs, (SELECT MAX(n.nilai) FROM nilai n WHERE n.nim = m.nim) AS terbaik FROM mhs m ORDER BY m.nim'],
  ['lj-with', 'WITH rata AS (SELECT nim, AVG(nilai) AS r FROM nilai GROUP BY nim) SELECT m.nama_mhs, rata.r FROM mhs m JOIN rata ON m.nim = rata.nim ORDER BY rata.r DESC'],
  ['lj-with-dua', 'WITH a AS (SELECT kode_kul, sks FROM mata_kuliah WHERE sem = 1), b AS (SELECT kode_kul FROM a WHERE sks = 3) SELECT * FROM b'],
  ['lj-intersect', 'SELECT nim FROM mhs INTERSECT SELECT nim FROM nilai'],
  ['lj-except', 'SELECT nim FROM mhs EXCEPT SELECT nim FROM nilai'],
  ['lj-union-order', 'SELECT nama_mhs AS nama FROM mhs UNION SELECT nama_kul FROM mata_kuliah ORDER BY nama DESC'],
  ['lj-union-limit', 'SELECT nama_mhs AS nama FROM mhs UNION SELECT nama_kul FROM mata_kuliah ORDER BY nama LIMIT 3 OFFSET 2'],
  ['lj-in-korelasi', "SELECT k.nama_kul FROM mata_kuliah k WHERE 80 < (SELECT MAX(n.nilai) FROM nilai n WHERE n.kode_kul = k.kode_kul) ORDER BY k.nama_kul"],
  ['lj-rs-exists', 'SELECT d.nama_dokter FROM dokter d WHERE EXISTS (SELECT 1 FROM pasien_dokter pd WHERE pd.id_dokter = d.id_dokter AND pd.biaya > 400000) ORDER BY d.nama_dokter'],
];

/**
 * Skrip DML acuan: perintah dijalankan berurutan pada salinan data, lalu kueri
 * penutup dibandingkan. Tanpa batasan kunci, agar sama persis dengan SQLite.
 */
export const SKRIP = [
  ['dml-insert', ["INSERT INTO mhs (nim, nama_mhs, alamat_mhs) VALUES ('11010099', 'Baru', 'Serang'), ('11010098', 'Lagi', NULL)"], 'SELECT * FROM mhs ORDER BY nim'],
  ['dml-insert-select', ['INSERT INTO mhs (nim, nama_mhs) SELECT kode_kul, nama_kul FROM mata_kuliah WHERE sem = 2'], 'SELECT nim, nama_mhs, alamat_mhs FROM mhs ORDER BY nim'],
  ['dml-update', ["UPDATE mata_kuliah SET sks = sks + 1, nama_kul = UPPER(nama_kul) WHERE sem = 1"], 'SELECT * FROM mata_kuliah ORDER BY kode_kul'],
  ['dml-update-subquery', ['UPDATE nilai SET nilai = nilai + 5 WHERE nim IN (SELECT nim FROM mhs WHERE alamat_mhs = \'Depok\')'], 'SELECT * FROM nilai ORDER BY nim, kode_kul'],
  ['dml-delete', ['DELETE FROM nilai WHERE nilai < 80'], 'SELECT * FROM nilai ORDER BY nim, kode_kul'],
  ['dml-delete-exists', ['DELETE FROM mhs WHERE NOT EXISTS (SELECT 1 FROM nilai n WHERE n.nim = mhs.nim)'], 'SELECT * FROM mhs ORDER BY nim'],
  ['dml-rangkaian', [
    "INSERT INTO pasien (id_pasien, nama_pasien, jenis_kelamin, kota) VALUES (50, 'Uji', 'P', 'Bogor')",
    "UPDATE pasien SET kota = 'Depok' WHERE id_pasien = 50",
    "DELETE FROM pasien WHERE kota = 'Surabaya'",
  ], 'SELECT id_pasien, nama_pasien, kota FROM pasien ORDER BY id_pasien'],
];

function main() {
  const tabel = {};
  for (const [nama, rel] of Object.entries(db)) tabel[nama] = { attrs: rel.attrs, rows: rel.rows };

  const hasil = {};
  const galat = {};
  for (const [id, sql] of KUERI) {
    try {
      const r = query(sql, db);
      hasil[id] = { sql, attrs: r.attrs, rows: r.rows };
    } catch (e) {
      galat[id] = { sql, pesan: e.message };
    }
  }

  const skrip = {};
  for (const [id, perintah, penutup] of SKRIP) {
    const salinan = salinDb(db);
    const r = executeScript(perintah.join(';\n'), salinan);
    if (r.galat) { galat[id] = { sql: perintah.join('; '), pesan: r.galat }; continue; }
    const akhir = query(penutup, salinan);
    skrip[id] = { perintah, penutup, attrs: akhir.attrs, rows: akhir.rows };
  }

  const out = { tabel, hasil, skrip, galat, jumlahKueri: KUERI.length, jumlahSkrip: SKRIP.length };
  const dir = join(here, '.cache');
  mkdirSync(dir, { recursive: true });
  const berkas = join(dir, 'oracledeck-verify.json');
  writeFileSync(berkas, JSON.stringify(out, null, 1), 'utf8');
  process.stdout.write(`${KUERI.length} kueri dan ${SKRIP.length} skrip DML dijalankan mesin ORACLEDECK -> ${berkas}\n`);
  if (Object.keys(galat).length) {
    process.stdout.write(`GALAT pada ${Object.keys(galat).length} kueri:\n`);
    for (const [id, g] of Object.entries(galat)) process.stdout.write(`  ${id}: ${g.pesan}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('export_for_verify.js')) main();
