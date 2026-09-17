# Kebijakan keamanan

## Cakupan

ORACLEDECK adalah situs statis. Tidak ada server aplikasi, basis data daring, akun pengguna,
cookie, maupun pelacak. Seluruh SQL dijalankan oleh mesin JavaScript di peramban pengunjung
atas salinan data contoh di memori.

Yang termasuk cakupan laporan:

- Injeksi skrip (XSS) lewat masukan terminal, jawaban bank soal, atau parameter URL
  (`lab/sql.html#sql=…`).
- Celah pada Content-Security-Policy atau pemuatan modul.
- Kebocoran data pribadi di repositori maupun situs hasil build.
- Skrip di `oracle/` yang berbahaya bila dijalankan sesuai petunjuk (misalnya hak akses
  berlebihan atau sandi bawaan yang tidak diberi peringatan).

Di luar cakupan: "SQL injection" terhadap mesin terminal — mesin itu memang dirancang untuk
menjalankan SQL apa pun yang diketik pengguna, pada data salinan miliknya sendiri.

## Melaporkan celah

Laporkan secara privat lewat fitur **Security → Report a vulnerability** (GitHub Private
Vulnerability Reporting) di repositori ini. Jangan membuka issue publik untuk celah yang belum
diperbaiki.

Sertakan: langkah reproduksi, halaman atau berkas yang terdampak, dan dampak yang Anda amati.

## Tanggapan

| Tahap | Target |
|---|---|
| Konfirmasi laporan diterima | 3 hari kerja |
| Penilaian dan rencana perbaikan | 10 hari kerja |
| Perbaikan dirilis | secepatnya setelah penilaian; dicatat di CHANGELOG.md bagian *Keamanan* |

## Kontrol yang sudah diterapkan

- `Content-Security-Policy` dengan `script-src 'self'`, `object-src 'none'`, `base-uri 'self'`,
  `form-action 'none'` pada setiap halaman; pemeriksa situs menolak skrip inline.
- Seluruh teks dari pengguna dan hasil kueri di-escape sebelum dimasukkan ke HTML.
- Tanpa dependensi pihak ketiga saat runtime maupun build.
- Pemeriksa situs menolak alamat surel dan nomor telepon yang bocor ke keluaran.
- Data kependudukan memakai NIK fiktif bersegmen 9999; data pasien adalah karangan.
- Skrip Oracle tidak memuat sandi tertulis: sandi diminta saat dijalankan lewat variabel substitusi SQL\*Plus (`&&sandi_rs_app`). Runner uji membangkitkan sandi acak per jalannya dan menyamarkannya di log bukti.
