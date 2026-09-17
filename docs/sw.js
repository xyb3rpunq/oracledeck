// sw.js — dibangkitkan tools/build.js. Membuat situs tetap bisa dibuka tanpa jaringan.
// Strategi: HTML jaringan-dulu (isi terbaru bila online), aset lain cache-dulu (sudah berversi).
const CACHE = 'oracledeck-b04806ea2d';
const BERKAS = ["audit.html","cari.json","content/coba-materi.js","content/contoh-sql.js","content/glosarium.json","content/kasus-galat-oracle.js","content/materi.js","content/soal.js","engine/core/algebra.js","engine/core/dml.js","engine/core/fd.js","engine/core/grader.js","engine/core/relation.js","engine/core/sql.js","engine/core/terminal.js","engine/data/datasets.js","engine/ddb/allocate.js","engine/ddb/availability.js","engine/ddb/concurrency.js","engine/ddb/deadlock.js","engine/ddb/decompose.js","engine/ddb/erd.js","engine/ddb/fragment.js","engine/ddb/integrity.js","engine/ddb/joinstrat.js","engine/ddb/localize.js","engine/ddb/transparency.js","engine/ddb/twophase.js","engine/index.js","engine/oracle/emit.js","glosarium.html","ikon.svg","index.html","kualitas.html","lab/alokasi.html","lab/deadlock.html","lab/dekomposisi.html","lab/duafase.html","lab/erd.html","lab/fragmentasi.html","lab/index.html","lab/join.html","lab/js/alokasi.js","lab/js/deadlock.js","lab/js/dekomposisi.js","lab/js/duafase.js","lab/js/erd.js","lab/js/fragmentasi.js","lab/js/join.js","lab/js/kependudukan.js","lab/js/ketersediaan.js","lab/js/konkurensi.js","lab/js/lokalisasi.js","lab/js/normalisasi.js","lab/js/oracle.js","lab/js/soal.js","lab/js/sql.js","lab/js/terminal-ui.js","lab/js/transparansi.js","lab/js/ui.js","lab/kependudukan.html","lab/ketersediaan.html","lab/konkurensi.html","lab/lokalisasi.html","lab/normalisasi.html","lab/oracle.html","lab/soal.html","lab/sql.html","lab/transparansi.html","manifest.webmanifest","materi/01-pengantar.html","materi/02-sistem-komputer-modern.html","materi/03-arsitektur.html","materi/04-perancangan.html","materi/05-fragmentasi-alokasi-replikasi.html","materi/06-transparansi.html","materi/07-independensi.html","materi/08-prinsip.html","materi/09-transaksi.html","materi/10-konkurensi.html","materi/11-deadlock.html","materi/12-kegagalan.html","materi/13-pemulihan.html","materi/14-query-optimizer.html","materi/index.html","oracle.html","site.js","styles.css","tema.js"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BERKAS.map((b) => new Request(b, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x.startsWith('oracledeck-') && x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const html = e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (html) {
    e.respondWith(fetch(e.request).then((r) => { const salin = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, salin)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
  } else {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
  }
});
