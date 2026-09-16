// tema.js — terapkan tema tersimpan SEBELUM halaman digambar (menghindari kedipan).
// Sengaja skrip biasa (bukan modul) dan dimuat sinkron di <head>.
try {
  var tema = JSON.parse(localStorage.getItem('oracledeck-tema') || 'null');
  if (!tema && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) tema = 'terang';
  if (tema) document.documentElement.dataset.tema = tema;
} catch (e) { /* penyimpanan tidak tersedia: tetap tema gelap */ }
