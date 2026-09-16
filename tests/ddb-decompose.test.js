import { grup, uji, sama, benar, salah, memuat, tidakMemuat } from './harness.js';
import { RS_SCHEMA } from '../engine/data/datasets.js';
import { parse } from '../engine/core/sql.js';
import * as D from '../engine/ddb/decompose.js';
import { treeToText } from '../engine/ddb/localize.js';

grup('ddb/decompose — 1) normalisasi');

const skema = () => ({ ...RS_SCHEMA });
const where = (sql) => parse(sql).where;

uji('pushNegations menerapkan De Morgan', () => {
  const e = where('SELECT * FROM t WHERE NOT (a = 1 AND b = 2)');
  const p = D.pushNegations(e);
  sama(p.op, 'OR');
  sama(p.l.op, '<>');
  sama(p.r.op, '<>');
});

uji('pushNegations membalik operator pembanding', () => {
  const p = D.pushNegations(where('SELECT * FROM t WHERE NOT a < 5'));
  sama(p.op, '>=');
});

uji('pushNegations membalik IS NULL, LIKE, IN, BETWEEN', () => {
  sama(D.pushNegations(where('SELECT * FROM t WHERE NOT a IS NULL')).not, true);
  sama(D.pushNegations(where("SELECT * FROM t WHERE NOT a LIKE 'x'")).not, true);
  sama(D.pushNegations(where('SELECT * FROM t WHERE NOT a IN (1,2)')).not, true);
  sama(D.pushNegations(where('SELECT * FROM t WHERE NOT a BETWEEN 1 AND 2')).not, true);
});

uji('negasi ganda saling meniadakan', () => {
  const p = D.pushNegations(where('SELECT * FROM t WHERE NOT (NOT a = 1)'));
  sama(p.op, '=');
});

uji('flatten meratakan rantai AND', () => {
  sama(D.flatten(where('SELECT * FROM t WHERE a = 1 AND b = 2 AND c = 3'), 'AND').length, 3);
});

uji('toCNF mendistribusikan OR ke dalam AND', () => {
  const c = D.toCNF(where('SELECT * FROM t WHERE a = 1 OR (b = 2 AND c = 3)'));
  sama(c.jumlahKlausa, 2);
  memuat(c.teks, ' AND ');
});

uji('toDNF mendistribusikan AND ke dalam OR', () => {
  const d = D.toDNF(where('SELECT * FROM t WHERE a = 1 AND (b = 2 OR c = 3)'));
  sama(d.jumlahTerm, 2);
  memuat(d.teks, ' OR ');
});

uji('CNF dan DNF atas konjungsi murni', () => {
  const e = where('SELECT * FROM t WHERE a = 1 AND b = 2');
  sama(D.toCNF(e).jumlahKlausa, 2);
  sama(D.toDNF(e).jumlahTerm, 1);
});

grup('ddb/decompose — 2) analisis');

uji('menerima kueri yang benar', () => {
  const r = D.decompose("SELECT p.nama_pasien FROM pasien p JOIN daftar d ON p.id_pasien = d.id_pasien WHERE p.kota = 'Jakarta'", skema());
  benar(r.analisis.diterima);
  benar(r.analisis.graf.terhubung);
});

uji('menolak relasi yang tidak ada di skema global', () => {
  const r = D.decompose('SELECT * FROM tabel_hantu', skema());
  salah(r.analisis.diterima);
  memuat(r.analisis.masalah[0].pesan, 'tidak ada dalam skema global');
});

uji('menolak atribut yang tidak ada', () => {
  const r = D.decompose('SELECT kolom_hantu FROM pasien', skema());
  salah(r.analisis.diterima);
  sama(r.analisis.masalah[0].jenis, 'salah tipe');
});

uji('menolak alias yang tidak dideklarasikan', () => {
  const r = D.decompose('SELECT z.nama_pasien FROM pasien p', skema());
  salah(r.analisis.diterima);
  memuat(r.analisis.masalah[0].pesan, 'tidak dideklarasikan');
});

uji('menandai atribut ambigu', () => {
  const r = D.decompose('SELECT id_pasien FROM pasien p, daftar d', skema());
  benar(r.analisis.masalah.some((m) => m.jenis === 'ambigu'));
});

uji('menolak graf kueri yang tidak terhubung', () => {
  const r = D.decompose("SELECT p.nama_pasien, d.nama_dokter FROM pasien p, dokter d WHERE p.kota = 'Jakarta'", skema());
  salah(r.analisis.diterima);
  memuat(r.analisis.masalah[0].pesan, 'kartesian');
});

uji('menolak kualifikasi yang selalu salah', () => {
  const r = D.decompose("SELECT * FROM pasien WHERE kota = 'Jakarta' AND kota = 'Bandung'", skema());
  salah(r.analisis.diterima);
  benar(r.analisis.masalah.some((m) => m.jenis === 'selalu salah'));
});

uji('queryGraph menghitung simpul dan sisi', () => {
  const ast = parse('SELECT 1 FROM pasien p JOIN daftar d ON p.id_pasien = d.id_pasien JOIN administrator a ON d.id_admin = a.id_admin');
  const g = D.queryGraph(ast);
  sama(g.simpul, ['p', 'd', 'a']);
  sama(g.sisi.length, 2);
  benar(g.terhubung);
});

uji('queryGraph atas satu relasi tetap dianggap terhubung', () => {
  sama(D.queryGraph(parse('SELECT 1 FROM pasien p')).terhubung, true);
});

grup('ddb/decompose — 3) eliminasi redundansi');

uji('p ∧ p ≡ p', () => {
  const r = D.eliminateRedundancy(where("SELECT * FROM t WHERE a = 1 AND a = 1"));
  sama(r.klausaSisa, 1);
  benar(r.jejak.some((j) => j.aturan === 'p ∧ p ≡ p'));
});

uji('p ∧ (p ∨ q) ≡ p (absorpsi)', () => {
  const r = D.eliminateRedundancy(where("SELECT * FROM t WHERE a = 1 AND (a = 1 OR b = 2)"));
  sama(r.hasil, "(a = 1)");
  benar(r.jejak.some((j) => j.aturan.includes('absorpsi') || j.aturan === 'p ∧ (p ∨ q) ≡ p'));
});

uji('p ∨ ¬p ≡ true membuang klausa', () => {
  const r = D.eliminateRedundancy(where('SELECT * FROM t WHERE (a = 1 OR a <> 1) AND b = 2'));
  sama(r.hasil, '(b = 2)');
});

uji('p ∧ ¬p ≡ false', () => {
  const r = D.eliminateRedundancy(where('SELECT * FROM t WHERE a = 1 AND a <> 1'));
  benar(r.selaluSalah);
  sama(r.hasil, 'false');
});

uji('dua kesamaan berbeda nilai juga selalu salah', () => {
  const r = D.eliminateRedundancy(where("SELECT * FROM t WHERE kota = 'A' AND kota = 'B'"));
  benar(r.selaluSalah);
});

uji('kualifikasi yang sudah minimal tidak diubah', () => {
  const r = D.eliminateRedundancy(where('SELECT * FROM t WHERE a = 1 AND b = 2'));
  sama(r.klausaAsal, r.klausaSisa);
  sama(r.jejak.length, 0);
});

uji('daftar aturan idempoten tersedia untuk ditampilkan', () => {
  benar(D.ATURAN_IDEMPOTEN.length >= 8);
  benar(D.ATURAN_IDEMPOTEN.every((a) => a.nama && a.jenis));
});

grup('ddb/decompose — 4) penulisan ulang');

uji('toOperatorTree menempatkan proyeksi di akar dan relasi di daun', () => {
  const t = D.toOperatorTree(parse("SELECT nama_pasien FROM pasien WHERE kota = 'Jakarta'"));
  sama(t.op, 'project');
  const teks = treeToText(t);
  memuat(teks, 'π nama_pasien');
  memuat(teks, 'σ');
  memuat(teks, 'pasien');
});

uji('toOperatorTree memakai join untuk setiap JOIN ... ON', () => {
  const t = D.toOperatorTree(parse('SELECT 1 FROM pasien p JOIN daftar d ON p.id_pasien = d.id_pasien'));
  memuat(treeToText(t), '⋈');
});

uji('toOperatorTree memakai product untuk FROM berkoma tanpa predikat', () => {
  const t = D.toOperatorTree(parse('SELECT 1 FROM pasien p, dokter d'));
  memuat(JSON.stringify(t), 'product');
});

uji('toOperatorTree menambahkan simpul group, distinct, dan sort', () => {
  const t = D.toOperatorTree(parse('SELECT DISTINCT kota, COUNT(*) c FROM pasien GROUP BY kota ORDER BY c DESC'));
  const s = JSON.stringify(t);
  memuat(s, 'group');
  memuat(s, 'distinct');
  memuat(s, 'sort');
});

uji('toOperatorTree menangani UNION', () => {
  const t = D.toOperatorTree(parse('SELECT kota FROM pasien UNION SELECT kota FROM dokter'));
  sama(t.op, 'union');
  sama(t.children.length, 2);
});

uji('pushDownSelections mendorong predikat ke cabang yang tepat', () => {
  const r = D.decompose("SELECT p.nama_pasien, d.nama_dokter FROM pasien p JOIN pasien_dokter pd ON p.id_pasien = pd.id_pasien JOIN dokter d ON pd.id_dokter = d.id_dokter WHERE p.kota = 'Jakarta' AND d.spesialis = 'Anak'", skema());
  const teks = treeToText(r.dioptimasi.pohon);
  memuat(teks, "σ (p.kota = 'Jakarta')");
  memuat(teks, "σ (d.spesialis = 'Anak')");
  sama(r.dioptimasi.langkah.length, 2);
});

uji('push-down tidak merusak tanda kurung predikat', () => {
  const r = D.decompose("SELECT 1 FROM pasien p JOIN daftar d ON p.id_pasien = d.id_pasien WHERE (p.kota = 'Jakarta' OR p.kota = 'Bandung') AND d.id_admin = 1", skema());
  const teks = treeToText(r.dioptimasi.pohon);
  const buka = (teks.match(/\(/g) || []).length;
  const tutup = (teks.match(/\)/g) || []).length;
  sama(buka, tutup);
});

uji('push-down membiarkan predikat join di tempatnya', () => {
  const r = D.decompose('SELECT 1 FROM pasien p, daftar d WHERE p.id_pasien = d.id_pasien', skema());
  tidakMemuat(treeToText(r.dioptimasi.pohon).split('\n')[0], 'σ');
});

uji('decompose mengembalikan keempat langkah sekaligus', () => {
  const r = D.decompose("SELECT nama_pasien FROM pasien WHERE kota = 'Jakarta'", skema());
  benar(r.normalisasi.cnf !== null);
  benar(r.normalisasi.dnf !== null);
  benar(r.analisis.diterima);
  benar(r.redundansi.hasil.length > 0);
  benar(r.pohon.op === 'project');
});

uji('decompose atas kueri tanpa WHERE', () => {
  const r = D.decompose('SELECT nama_pasien FROM pasien', skema());
  sama(r.normalisasi.cnf, null);
  sama(r.redundansi.hasil, 'true');
});
