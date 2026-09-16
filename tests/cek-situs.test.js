// Uji pemeriksa situs: pastikan ia benar-benar menangkap masalah, bukan selalu lulus.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { grup, uji, sama, benar } from './harness.js';
import { periksa } from '../tools/cek_situs.js';

grup('tools/cek_situs');

const halaman = (judul, isi = '') => `<!doctype html><html lang="id"><head><title>${judul}</title><meta name="description" content="Deskripsi halaman yang cukup panjang untuk lolos."></head><body>${isi}</body></html>`;

function situsContoh(tambahan = {}) {
  const d = mkdtempSync(join(tmpdir(), 'oracledeck-cek-'));
  mkdirSync(join(d, 'lab', 'js'), { recursive: true });
  writeFileSync(join(d, '.nojekyll'), '');
  writeFileSync(join(d, 'index.html'), halaman('Beranda', '<a href="lab/a.html">a</a>'));
  writeFileSync(join(d, 'lab', 'a.html'), halaman('Lab A', '<script type="module" src="js/a.js?v=1"></script>'.replace('js/a.js', '../lab/js/a.js')));
  writeFileSync(join(d, 'lab', 'js', 'a.js'), "import './b.js?v=1';\n");
  writeFileSync(join(d, 'lab', 'js', 'b.js'), 'export const x = 1;\n');
  writeFileSync(join(d, 'sitemap.xml'), '<urlset><url><loc>https://contoh.io/situs/</loc></url><url><loc>https://contoh.io/situs/lab/a.html</loc></url></urlset>');
  for (const [nama, isi] of Object.entries(tambahan)) writeFileSync(join(d, nama), isi);
  return d;
}

uji('situs yang sehat tidak menghasilkan masalah', () => {
  const d = situsContoh();
  const r = periksa(d);
  sama(r.masalah, []);
  benar(r.statistik.tautan >= 2 && r.statistik.impor === 1);
  rmSync(d, { recursive: true, force: true });
});

uji('tautan rusak, judul ganda, NaN, dan surel bocor tertangkap', () => {
  const d = situsContoh({
    'x.html': halaman('Beranda', '<a href="tidak-ada.html">rusak</a><p>Nilai: NaN</p><p>hubungi orang@contoh.com</p>'),
  });
  const r = periksa(d);
  benar(r.masalah.some((m) => m.includes('tautan rusak')), 'tautan rusak');
  benar(r.masalah.some((m) => m.includes('judul sama')), 'judul ganda');
  benar(r.masalah.some((m) => m.includes('"NaN"')), 'NaN');
  benar(r.masalah.some((m) => m.includes('orang@contoh.com')), 'surel');
  rmSync(d, { recursive: true, force: true });
});

uji('impor modul yang hilang dan skrip lab yang hilang tertangkap', () => {
  const d = situsContoh({ 'lab/js/a.js': "import './hilang.js';\n", 'lab/c.html': halaman('Lab C') });
  const r = periksa(d);
  benar(r.masalah.some((m) => m.includes('impor tidak ditemukan')));
  benar(r.masalah.some((m) => m.includes('lab/js/c.js')));
  rmSync(d, { recursive: true, force: true });
});

uji('ketiadaan .nojekyll dan sitemap tertangkap', () => {
  const d = situsContoh();
  rmSync(join(d, '.nojekyll'));
  rmSync(join(d, 'sitemap.xml'));
  const r = periksa(d);
  benar(r.masalah.some((m) => m.includes('.nojekyll')));
  benar(r.masalah.some((m) => m.includes('sitemap.xml tidak ada')));
  rmSync(d, { recursive: true, force: true });
});

uji('nomor telepon internasional tertangkap', () => {
  const d = situsContoh({ 'y.html': halaman('Y', '<p>+6281234567890</p>') });
  benar(periksa(d).masalah.some((m) => m.includes('nomor telepon')));
  rmSync(d, { recursive: true, force: true });
});
