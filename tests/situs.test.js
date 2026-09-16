// situs.test.js — pembantu build (tombol Jalankan, catatan istilah, indeks cari),
// pencarian di site.js, pemeriksaan aksesibilitas, kueri per topik, dan anggaran kinerja terminal.

import { grup, uji, sama, benar, salah, memuat, tidakMemuat } from './harness.js';
import { presetUntukSql, sisipIstilah, slugIstilah, indeksCari } from '../tools/build.js';
import { periksaAksesibilitas } from '../tools/cek_situs.js';
import { skorCari } from '../src/site.js';
import { COBA_MATERI } from '../src/content/coba-materi.js';
import { CONTOH } from '../src/content/contoh-sql.js';
import { MATERI } from '../src/content/materi.js';
import * as T from '../engine/core/terminal.js';
import { LAB } from '../src/content/materi.js';
import { readFileSync } from 'node:fs';

grup('situs — tombol Jalankan pada blok SQL');

uji('presetUntukSql memilih preset pertama yang menjalankan SQL tanpa galat', () => {
  sama(presetUntukSql('SELECT COUNT(*) FROM pasien'), 'rumahsakit');
  sama(presetUntukSql('SELECT nama_mhs FROM mhs'), 'akademik');
  sama(presetUntukSql('SELECT * FROM pasien@bandung'), 'terdistribusi');
  sama(presetUntukSql('SELECT fname FROM STAFF'), 'dreamhome');
  sama(presetUntukSql('CREATE TABLE t (a NUMBER)'), 'rumahsakit');
});

uji('presetUntukSql menolak DDL khusus Oracle yang tidak bisa dijalankan terminal', () => {
  sama(presetUntukSql("CREATE TABLESPACE TS_S1 DATAFILE 's1.dbf' SIZE 100M"), null);
  sama(presetUntukSql('SELECT * FROM tabel_yang_tidak_ada'), null);
});

grup('situs — catatan istilah');

const G = [
  { istilah: 'Fragmentasi', en: 'fragmentation', arti: 'Pemecahan relasi.', topik: [5] },
  { istilah: 'Fragmentasi horizontal', arti: 'Pemecahan menurut <i>baris</i>.', topik: [5] },
  { istilah: 'Replikasi', arti: 'Penyalinan fragmen.', detail: 'Sinkron atau asinkron.', contoh: 'MV', topik: [5], lab: 'alokasi' },
];

uji('istilah terpanjang dicocokkan lebih dulu dan hanya kemunculan pertama ditandai', () => {
  const h = sisipIstilah('<p>Fragmentasi horizontal lalu fragmentasi horizontal lagi.</p>', G);
  sama((h.match(/class="istilah"/g) || []).length, 1);
  memuat(h, 'data-istilah="Fragmentasi horizontal"');
  memuat(h, 'lalu fragmentasi horizontal lagi.');
});

uji('istilah pendek tetap ditandai bila muncul sendiri di luar frasa panjang', () => {
  const h = sisipIstilah('<p>Fragmentasi horizontal berbeda dari fragmentasi pada umumnya.</p>', G);
  sama((h.match(/class="istilah"/g) || []).length, 2);
  memuat(h, '>fragmentasi</abbr> pada umumnya');
});

uji('kelas CSS pemeriksa aksesibilitas menangkap CSP yang hilang dan skrip inline', () => {
  const html = '<main><h1>x</h1></main>';
  sama(periksaAksesibilitas(html), []);
});

uji('istilah di dalam code, a, dan judul tidak disentuh', () => {
  const h = sisipIstilah('<h2>Replikasi</h2><p><code>Replikasi</code> <a href="#">Replikasi</a></p>', G);
  tidakMemuat(h, 'class="istilah"');
});

uji('atribut catatan istilah bersih dari tag dan memuat detail serta contoh', () => {
  const h = sisipIstilah('<p>Tentang fragmentasi horizontal dan replikasi.</p>', G);
  memuat(h, 'data-arti="Pemecahan menurut baris."');
  memuat(h, 'data-detail="Sinkron atau asinkron."');
  memuat(h, 'data-contoh="MV"');
  memuat(h, 'data-lab="alokasi" data-lab-judul="Alokasi &amp; Replikasi"');
  memuat(h, 'tabindex="0"');
});

uji('istilah tidak ditandai di tengah kata lain', () => {
  tidakMemuat(sisipIstilah('<p>Nonreplikasiku</p>', G), 'class="istilah"');
});

uji('slugIstilah stabil dan tanpa diakritik', () => {
  sama(slugIstilah('Two-Phase Commit (2PC)'), 'g-two-phase-commit-2pc');
  sama(slugIstilah('Réplika'), 'g-replika');
});

grup('situs — indeks pencarian');

uji('indeksCari memuat materi, subtopik, lab, istilah, contoh SQL, soal, dan halaman', () => {
  const idx = indeksCari([{ nama: '01.sql', baris: 3 }]);
  const jenis = new Set(idx.map((e) => e.g));
  for (const g of ['materi', 'subtopik', 'lab', 'SQL', 'soal', 'oracle', 'halaman']) benar(jenis.has(g), g);
  benar(idx.filter((e) => e.g === 'materi').length === MATERI.length);
  idx.filter((e) => e.g === 'SQL').forEach((e) => benar(Boolean(e.sql && e.db)));
  idx.filter((e) => e.g !== 'SQL').forEach((e) => benar(typeof e.u === 'string' && !e.u.startsWith('/'), e.j));
});

uji('skorCari: semua kata wajib ada, judul lebih berbobot dari isi', () => {
  const a = { j: 'Two-Phase Commit', k: 'protokol', b: 0 };
  const b = { j: 'Pemulihan', k: 'memakai two-phase commit', b: 0 };
  benar(skorCari(a, ['two-phase']) > skorCari(b, ['two-phase']));
  sama(skorCari(a, ['two-phase', 'kuorum']), 0);
  benar(skorCari({ j: 'Replikasi', b: 5 }, ['replikasi']) > skorCari({ j: 'Replikasi', b: 0 }, ['replikasi']));
});

grup('situs — aksesibilitas statis');

const sehat = '<main><h1>A</h1><h2>B</h2><h3>C</h3><img src="x.png" alt="x"><button aria-label="tutup"></button><label for="q">Q</label><input id="q"></main>';

uji('halaman sehat tidak punya masalah aksesibilitas', () => {
  sama(periksaAksesibilitas(sehat), []);
});

uji('pemeriksa menangkap h1 ganda, main hilang, loncatan judul, img tanpa alt, tombol dan input tanpa nama', () => {
  const m = periksaAksesibilitas('<h1>a</h1><h1>b</h1><h4>c</h4><img src="x"><button></button><textarea></textarea>').join(' | ');
  for (const k of ['tepat satu <h1>', '<main>', 'meloncat', 'alt', '<button>', '<textarea>']) memuat(m, k);
});

uji('konten di dalam skrip tidak dihitung', () => {
  sama(periksaAksesibilitas(`${sehat}<script>const x = '<h1>palsu</h1>';</script>`), []);
});

grup('situs — kueri "Coba di terminal" per topik');

uji('setiap topik punya minimal dua kueri coba', () => {
  for (const m of MATERI) benar((COBA_MATERI[m.no] || []).length >= 2, `topik ${m.no}`);
});

uji('setiap kueri coba berjalan sesuai janji, termasuk galat yang disengaja', () => {
  for (const [no, daftar] of Object.entries(COBA_MATERI)) {
    for (const c of daftar) {
      benar(Boolean(T.PRESET[c.db]), `${no}/${c.judul}: preset`);
      benar(c.ket.length > 30, `${no}/${c.judul}: keterangan terlalu pendek`);
      const pesan = T.jalankan(T.buatSesi(c.db), c.sql).blok.filter((b) => b.jenis === 'galat').map((b) => b.pesan);
      if (c.galat) c.galat.forEach((k) => benar(pesan.some((p) => p.includes(k)), `${no}/${c.judul}: ${k} tidak muncul`));
      else sama(pesan, [], `${no}/${c.judul}`);
    }
  }
});

grup('situs — anggaran kinerja terminal');

uji('pratinjau setiap contoh selesai jauh di bawah satu detik dan median di bawah satu frame', () => {
  const waktu = [];
  for (const c of CONTOH) {
    const s = T.buatSesi(c.db);
    const t0 = performance.now();
    T.pratinjau(s, c.sql);
    waktu.push(performance.now() - t0);
  }
  waktu.sort((a, b) => a - b);
  const median = waktu[Math.floor(waktu.length / 2)];
  benar(median < 16, `median ${median.toFixed(2)} ms`);
  benar(waktu[waktu.length - 1] < 250, `maksimum ${waktu[waktu.length - 1].toFixed(2)} ms`);
});

uji('menjalankan seluruh contoh berurutan tetap cepat', () => {
  const t0 = performance.now();
  for (const c of CONTOH) T.jalankan(T.buatSesi(c.db), c.sql);
  benar(performance.now() - t0 < 2000);
});

uji('pelengkap otomatis cukup cepat untuk dipanggil setiap ketikan', () => {
  const s = T.buatSesi('terdistribusi');
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) T.saranLengkap(s, 'SELECT p.na FROM pasien@bandung p JOIN dokter d ON 1 = 1', 11);
  benar((performance.now() - t0) / 200 < 8);
});

grup('situs — glosarium lengkap');

uji('setiap istilah glosarium punya arti, detail, dan contoh; lab yang dirujuk ada', () => {
  const g = JSON.parse(readFileSync(new URL('../src/content/glosarium.json', import.meta.url), 'utf8'));
  benar(g.length >= 100);
  for (const x of g) {
    benar(x.arti.length > 20, `${x.istilah}: arti`);
    benar((x.detail || '').length > 40, `${x.istilah}: detail`);
    benar((x.contoh || '').length > 8, `${x.istilah}: contoh`);
    if (x.lab) benar(LAB.some((l) => l.slug === x.lab), `${x.istilah}: lab ${x.lab}`);
  }
  sama(new Set(g.map((x) => x.istilah.toLowerCase())).size, g.length);
});
