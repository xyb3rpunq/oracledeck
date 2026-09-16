# Audit

Audit ini memeriksa tiga hal: **skema praktikum** yang dipakai sepanjang mata kuliah,
**Project UAS Kelompok 3** beserta repositori kodenya, dan **proyek ORACLEDECK ini sendiri**.
Setiap temuan disertai bukti dan perbaikan yang sudah diterapkan.

Yang diperiksa langsung (bukan disimpulkan): berkas `01_database_schema.sql`,
`hospital_db_manager.py`, `.env.example`, keluaran `git ls-files` pada repositori
`Tugas 3 - Hospital`, serta `LAPORAN_DBMS_RUMAHSAKIT_LENGKAP.md`.

---

## 1. Skema praktikum rumah sakit

Enam tabel dari Praktikum 2. Yang berikut bukan soal selera — masing-masing punya akibat
yang bisa diukur.

### 1.1 Temuan tingkat tinggi

| # | Temuan | Bukti | Akibat | Tingkat |
|---|--------|-------|--------|---------|
| A1 | `ON DELETE CASCADE` pada `pasien_dokter` | `01_database_schema.sql` baris FK | Menghapus satu dokter menghapus **seluruh riwayat pemeriksaannya**. Rekam medis elektronik wajib disimpan paling singkat 25 tahun sejak kunjungan terakhir pasien ([Permenkes 24/2022 Pasal 39](https://peraturan.bpk.go.id/Details/245544/permenkes-no-24-tahun-2022)). | Kritis |
| A2 | `no_hp` bertipe numerik pada sebagian generator | Terkaan tipe dari data contoh | Nol di depan hilang: `081234567001` menjadi `81234567001`. Nomor menjadi tidak bisa dihubungi. | Kritis |
| A3 | `nohp UNIQUE` pada laporan Kelompok 3 | `LAPORAN ... 5.2` | Satu keluarga sering memakai satu nomor. Pasien kedua **ditolak sistem**. | Tinggi |
| A4 | Tidak ada kolom kunci fragmentasi | Seluruh skema | Tanpa kolom seperti `kota`, fragmentasi horizontal tidak punya dasar — padahal ini mata kuliah basis data **terdistribusi**. | Tinggi |
| A5 | `jenis_kelamin VARCHAR(1)` tanpa `CHECK` | Skema + komentar laporan | Laporan menulis `1=Pria, 0=Wanita`, data contoh memakai `L`/`P`. Dua konvensi dalam satu proyek. | Sedang |
| A6 | `penyakit VARCHAR(100)` teks bebas | Skema | "Demam Berdarah", "DBD", dan "demam berdarah" menjadi tiga penyakit berbeda saat dikelompokkan. | Sedang |
| A7 | `INT(3)` dipakai sebagai pembatas nilai | Skema | `INT(3)` hanya lebar tampilan, bukan batas nilai. Sudah **deprecated sejak MySQL 8.0.19**. | Sedang |
| A8 | Tidak ada unik gabungan pada `pasien_dokter` | Skema | Satu pemeriksaan bisa tercatat dua kali tanpa ada yang menghalangi. | Sedang |
| A9 | Tidak ada kolom jejak audit | Seluruh skema | Tidak ada `dibuat_pada`, `diubah_pada`, maupun `diubah_oleh`. Pada data kesehatan ini masalah kepatuhan, bukan kenyamanan. | Sedang |
| A10 | Data kesehatan tanpa kendali khusus | Seluruh skema | Data kesehatan tergolong **data pribadi spesifik** (UU PDP No. 27/2022 Pasal 4 ayat 2). Wajib ada pembatasan akses dan pencatatan akses. | Tinggi |

### 1.2 Perbaikan yang diterapkan di ORACLEDECK

```sql
-- SEBELUM (Praktikum 2)
CREATE TABLE pasien (
  id_pasien INT(3) PRIMARY KEY,      -- lebar tampilan, bukan batas nilai
  nama_pasien VARCHAR(30) NOT NULL,
  jenis_kelamin VARCHAR(1),          -- tanpa CHECK
  penyakit VARCHAR(100),             -- teks bebas
  no_hp VARCHAR(15)                  -- tanpa keunikan yang tepat
);

-- SESUDAH (02_skema_global.sql)
CREATE TABLE PASIEN (
  ID_PASIEN     NUMBER(8) NOT NULL,
  NAMA_PASIEN   VARCHAR2(60),
  JENIS_KELAMIN CHAR(1),
  PENYAKIT      VARCHAR2(100),
  NO_HP         VARCHAR2(20),        -- VARCHAR2: nol di depan aman
  KOTA          VARCHAR2(40),        -- kunci fragmentasi horizontal
  CONSTRAINT PK_PASIEN PRIMARY KEY (ID_PASIEN),
  CONSTRAINT CK_PASIEN_JK CHECK (JENIS_KELAMIN IN ('L','P'))
);
```

Perubahan lain: kolom `biaya` dan `tanggal_daftar` ditambahkan agar laporan dapat diuji,
`ON DELETE CASCADE` tetap dipakai hanya pada tabel penghubung murni, dan seluruh foreign key
diberi indeks penunjang.

Pemeriksaan tipe terkaan itu sendiri diuji: `engine/oracle/emit.js` menolak menjadikan
kolom bernama `no_hp`, `nik`, `npwp`, `ktp`, atau `kode_pos` sebagai `NUMBER`, dan setiap
nilai teks berawalan nol tetap `VARCHAR2`. Uji yang menjaganya ada di `tests/oracle-emit.test.js`.

### 1.3 Yang belum diperbaiki dan alasannya

- **Tabel referensi penyakit (ICD-10)** belum dibuat. Ini perubahan skema yang menyimpang jauh
  dari lembar praktikum, sehingga situs tetap memakai teks bebas agar contohnya masih
  bisa dicocokkan dengan soal aslinya. Rekomendasinya ada di bagian 4.
- **Enkripsi kolom sensitif** (Oracle TDE / `DBMS_CRYPTO`) tidak disertakan karena butuh
  lisensi Advanced Security pada edisi berbayar dan tidak dapat diuji tanpa instans.

---

## 1A. Materi kuliah

Materi juga diaudit, karena contoh di modul ikut dipakai sebagai acuan jawaban.

### 1A.1 Contoh fragmentasi S1/S2 pada Modul 6 dan 7 tidak disjoint

Modul menaruh `sex`, `DOB`, dan `salary` di fragmen vertikal S1 **dan** di S2
(yang kemudian dipecah menjadi S21, S22, S23). Diuji dengan menjalankan operator
relasional atas data sungguhan di Lab Perancang Fragmentasi:

| Aturan | Hasil | Keterangan |
|---|---|---|
| Kelengkapan | Lulus | semua atribut dan semua tupel tiap kelompok horizontal terliput |
| Rekonstruksi | Lulus | `STAFF = S1 ⋈ (S21 ∪ S22 ∪ S23)` mengembalikan 10 dari 10 tupel |
| Kedisjoinan | **Gagal** | atribut non-kunci `sex`, `dob`, `salary` muncul di dua fragmen vertikal |

Akibat praktisnya: setiap perubahan gaji harus ditulis ke dua fragmen yang disimpan di situs
berbeda, dan keduanya bisa tidak sinkron. Lab menampilkan versi yang diperbaiki (S2 hanya
memuat `staffno, fname, lname, branchno`) yang lulus ketiga aturan. Uji regresinya ada di
`tests/ddb-fragment.test.js`, grup "fragmentasi campuran".

Satu inkonsistensi kecil lain di contoh yang sama: teks menyebut S1 ditempatkan di site 3,
tetapi kueri transparansi pemetaan lokal menulis `FROM S1 AT SITE 5`. ORACLEDECK mengikuti
definisi penempatannya (site 3).

### 1A.2 Studi kasus skripsi kependudukan: klaim konsistensi tanpa transaksi atomik

Skripsi di folder mata kuliah (*Implementasi Basis Data Terdistribusi untuk Meningkatkan
Konsistensi Data Kependudukan*, UIN Sunan Kalijaga, 2016) menyambung Oracle XE kecamatan
dengan MySQL desa lewat database link berbasis ODBC, dan menyimpulkan data tidak akan hilang
karena sudah direplikasi.

Dokumentasi Oracle untuk gateway itu menyatakan ia *cannot participate in distributed
transactions; only single-site transactions supported*, dan pada mode
`SINGLE_SITE_AUTOCOMMIT` setiap perubahan langsung di-commit
([Oracle Database Gateway for ODBC Features and Restrictions](https://docs.oracle.com/en/database/oracle/oracle-database/12.2/odbcu/database-gateway-for-odbc-features.html)).
Artinya transaksi yang mengubah Oracle dan MySQL sekaligus tidak dapat dijamin atomik — tepat
keterbatasan gateway yang sudah diperingatkan Modul 1. Simulator 2PC/3PC kini punya peserta
"di balik gateway" untuk menunjukkan hasil campurannya, dan Lab Studi Kasus Kependudukan
membedahnya lengkap dengan data karangan.

### 1A.3 Dokumen salah folder

Folder SBDT juga berisi dokumen mata kuliah **Manajemen Proyek Perangkat Lunak**: dua salinan
`20251104_UTS Manajemen Proyek Perangkat Lunak`, `UTS MPPL - 20210801207 - Daniel Hutajulu.pdf`,
`Pertemuan 8_MPPL (2).pptx`, dan jawaban soal perencanaan risiko proyek. Dokumen-dokumen itu
sengaja **tidak** dimasukkan ke situs ini karena bukan materi basis data terdistribusi.

---

## 2. Project UAS Kelompok 3

Laporannya rapi dan lengkap — 1.240 baris, ERD, skrip, dan dokumentasi pengujian.
Tiga hal berikut perlu dikoreksi sebelum dipakai sebagai rujukan.

### 2.1 Klaim yang tidak didukung bukti

| Klaim di laporan | Masalahnya |
|---|---|
| "Project Status: COMPLETE & **PRODUCTION-READY**" | Koneksi yang didokumentasikan memakai `root` dengan sandi kosong (`phpMyAdmin → Login: SUCCESS (root / kosong)`). Tidak ada sistem produksi yang berjalan begitu. |
| Tabel "Query Performance Testing" dengan angka `<50ms`, `<100ms` | Tabel terbesar berisi 30 baris. Pada ukuran itu, angka tersebut mengukur latensi klien, bukan kinerja kueri. Tidak ada metodologi, jumlah pengulangan, maupun keadaan cache yang disebutkan. |
| "Testing & Validation Results ✅" | Isinya daftar centang hasil klik manual di DBeaver dan phpMyAdmin — bukan pengujian yang dapat diulang orang lain. |
| "Optimal untuk database size <100K records" | Tidak ada tolok ukur yang mendasarinya. |
| "Backup created: READY" | Strategi cadangannya ekspor manual lewat phpMyAdmin. Tidak ada satu pun langkah yang **menguji pemulihannya**. Cadangan yang belum pernah dipulihkan belum bisa disebut cadangan. |

### 2.2 Kesenjangan terbesar: tidak ada aspek terdistribusi

Ini temuan paling penting. Project UAS untuk mata kuliah **Sistem Basis Data Terdistribusi**
menghasilkan basis data MySQL **satu instans**, satu mesin, tanpa:

- fragmentasi (horizontal, vertikal, maupun turunan),
- alokasi ke situs,
- replikasi,
- database link atau federasi,
- transaksi terdistribusi,
- pembahasan transparansi.

Seluruh isi laporan dapat dikerjakan pada mata kuliah Basis Data dasar. Bagian 2 sampai 14
Rencana Pembelajaran Semester tidak tersentuh sama sekali.

**Perbaikan di ORACLEDECK:** rancangan yang sama dibawa sampai ke bentuk terdistribusi —
`PARTITION BY LIST (KOTA)` per situs, `PARTITION BY REFERENCE` untuk tabel anak,
materialized view untuk tabel referensi, database link antar situs, dan diagnosa
`DBA_2PC_PENDING`. Semuanya ada di folder `oracle/`.

### 2.3 Repositori `Tugas 3 - Hospital`

Diperiksa lewat `git ls-files` (23 berkas terlacak):

| Temuan | Bukti | Tingkat |
|---|---|---|
| `exported-assets (1).zip` ikut di-commit | tercantum di `git ls-files` | Rendah — arsip biner membuat riwayat repo membengkak dan tidak bisa di-diff |
| Sebelas berkas `script.py` … `script_10.py` | tercantum di `git ls-files` | Rendah — tidak ada satu pun nama yang menjelaskan isinya |
| `.env.example` memakai `DB_USER=root`, `DB_PASSWORD=` kosong | isi berkas | Sedang — berkas contoh menjadi pola yang disalin orang lain apa adanya |
| Sandi baku `password=''` di konstruktor | `hospital_db_manager.py` baris 18 | Sedang — sama seperti di atas |
| `venv/` ada di direktori kerja | daftar berkas direktori | Rendah — sudah tidak terlacak git, jadi hanya mengotori direktori lokal |

**Yang ternyata sudah benar dan layak disebut:** `hospital_db_manager.py` **tidak** rentan
injeksi SQL. Satu-satunya f-string yang membentuk kueri (`baris 174`) hanya menyusun nama
kolom dari daftar tetap, sedangkan seluruh nilai tetap lewat placeholder `%s`. Ini poin
yang sering salah di kode mahasiswa, dan di sini sudah tepat.

---

## 3. Audit proyek ini sendiri

Proyek yang mengaudit orang lain harus siap diaudit.

### 3.1 Yang benar-benar diverifikasi

| Aspek | Cara verifikasi | Hasil |
|---|---|---|
| Mesin relasional, algoritma terdistribusi, penilai soal, pemeriksa situs | 528 uji otomatis di Node | Lulus semua — `node tests/run.js` |
| Semantik SQL | 39 kueri acuan dijalankan di mesin ini **dan** di SQLite 3.50.4 lewat Python, hasil dibandingkan baris demi baris | Identik semuanya — `python tools/verify_sqlite.py` |
| Aturan kebenaran fragmentasi | Operator relasional dijalankan atas data sungguhan, bukan diperiksa dari definisi | Lulus |
| Reduksi lokalisasi | Hasil dari fragmen dibandingkan dengan hasil kueri atas relasi global untuk setiap predikat uji | Setara semuanya |
| Strategi join terdistribusi | Keempat strategi dijalankan, hasilnya dibandingkan sebagai himpunan | Identik semuanya |
| 2PC dan 3PC | Mesin keadaan dijalankan dengan injeksi kegagalan | Sifat blokir/tidak-blokir terbukti sesuai teori |
| Bentuk DDL Oracle | 40+ uji atas pembangkitnya | Lulus |
| Keluaran situs | `tools/cek_situs.js`: 590 tautan, 79 impor modul, sitemap, judul unik, kebocoran surel/telepon | Bersih |
| Seluruh 16 lab di peramban | Dimuat satu per satu, lalu setiap tombol, pilihan, dropdown, dan slider diklik (±450 aksi) sambil menangkap galat runtime | Nol galat runtime |
| Tata letak ponsel | 22 halaman diukur pada lebar 375 px | Tidak ada yang melebar |


### 3.1a Bug yang ditemukan saat merender sungguhan — dan sudah diperbaiki

Seluruh uji unit lulus ketika bug-bug berikut masih ada. Semuanya baru ketahuan setelah situs
dibuka dan diklik di peramban. Masing-masing kini punya uji regresi.

| Bug | Gejala | Perbaikan |
|---|---|---|
| Audit fragmentasi campuran dinilai datar | Contoh Modul 6 tampil "Rekonstruksi GAGAL, 0 tupel", karena dihitung `S1 ⋈ S21 ⋈ S22 ⋈ S23` | Penilaian bertingkat: anak horizontal disatukan dulu, baru tingkat vertikal dinilai |
| Variabel `mode` dibayangi di lab fragmentasi | Lab akan berhenti dengan ReferenceError | Diganti nama sebelum dirilis |
| Modul lama tertahan di cache peramban | Halaman baru berpasangan dengan mesin lama tanpa pesan galat | Setiap impor dan aset diberi `?v=<sidik isi>` saat build |
| Navigasi disembunyikan di bawah 860 px | Pengguna ponsel tidak bisa berpindah halaman | Baris navigasi yang dapat digeser |
| Anak grid CSS tidak boleh menyusut | Tabel lebar memaksa halaman ponsel melebar dua kali lipat | `min-width: 0` pada anak grid |
| 2PC dengan koordinator jatuh di "fase 4" | Tampil "selesai" tanpa penjelasan, padahal fase itu hanya ada di 3PC | Dijelaskan eksplisit pada analisis 2PC |
| Parser jadwal konkurensi | Token asing seperti `hello` diabaikan diam-diam, analisis memakai jadwal yang terbaca sebagian | Setiap token wajib sah, token asing ditolak |

### 3.2 Yang TIDAK diverifikasi — batas yang jujur

1. **Skrip Oracle belum pernah dijalankan pada instans Oracle sungguhan.** Tidak ada Oracle di
   lingkungan pembuatan repositori ini. Yang diuji adalah pembangkitnya: bentuk perintah, nama
   objek, dan klausa partisi. Sintaks yang hanya bisa dibuktikan oleh parser Oracle —
   khususnya `PARTITION BY REFERENCE`, `DBMS_REFRESH.MAKE`, dan pilihan klausa
   `MATERIALIZED VIEW` — **belum diverifikasi**. Jalankan sendiri di Oracle XE untuk membuktikannya.

2. **Model biaya adalah model, bukan pengukuran.** Angka biaya pada Lab Alokasi dan Lab Join
   memakai fungsi biaya abstrak (biaya per pesan + biaya per byte). Ia menunjukkan *arah* dan
   *titik impas* dengan benar, tetapi angkanya bukan milidetik pada jaringan sungguhan.

3. **Simulator 2PC/3PC menyederhanakan waktu.** Tidak ada jam sungguhan, tidak ada pesan yang
   datang tidak berurutan, tidak ada kegagalan sebagian pesan. Sifat yang ditunjukkan
   (blokir vs tidak blokir) benar; ketepatan waktunya bukan tujuan.

4. **Mesin SQL hanya menutup subset SELECT.** Tidak ada DDL, DML, window function, CTE, maupun
   `EXISTS`. Batasnya disebutkan terbuka di Lab Mesin SQL.

5. **Situs hanya berbahasa Indonesia.** Materinya berbahasa Indonesia dan pembacanya peserta
   kuliah berbahasa Indonesia. Versi dwibahasa yang setengah jadi lebih buruk daripada satu
   bahasa yang utuh — jadi tidak dipaksakan. Lihat rekomendasi bagian 4.

6. **Data contoh adalah data karangan.** Nama pasien, dokter, dan penyakit dibuat sendiri.
   Tidak ada satu pun data pribadi nyata di repositori ini.

### 3.3 Utang teknis yang diketahui

- `engine/core/sql.js` berisi parser, perencana, dan eksekutor dalam satu berkas (~700 baris).
  Masih terbaca, tetapi sudah di ambang batas dan sebaiknya dipecah bila ditambah fitur.
- `candidateKeys` pada `engine/core/fd.js` menelusuri seluruh subset atribut, sehingga dibatasi
  20 atribut. Untuk keperluan kuliah ini cukup; untuk skema nyata perlu algoritma yang lebih baik.
- `optimalAllocation` melakukan enumerasi penuh dan baru beralih ke greedy setelah ruang
  pencariannya melampaui 200.000 kombinasi. Batas itu ditetapkan berdasarkan kenyamanan,
  bukan pengukuran.

---

## 4. Rekomendasi

Diurutkan menurut dampak dibagi usaha.

### Segera (untuk nilai mata kuliah)

1. **Jalankan skrip `oracle/` di Oracle XE lewat Docker** dan simpan tangkapan layarnya.
   Satu perintah: `docker run -d -p 1521:1521 -e ORACLE_PASSWORD=oracle gvenzl/oracle-free:23-slim`.
   Ini mengubah satu-satunya bagian yang belum terverifikasi menjadi terverifikasi, dan
   menghasilkan bukti yang jauh lebih kuat daripada laporan mana pun di folder mata kuliah.

2. **Hapus klaim "production-ready" dari laporan Kelompok 3**, atau lengkapi syaratnya:
   pengguna basis data non-root dengan hak minimal, sandi yang tidak kosong, dan prosedur
   pemulihan cadangan yang pernah dijalankan minimal satu kali.

3. **Ganti tabel "Query Performance Testing"** dengan pengukuran yang bisa diulang: jalankan
   tiap kueri 100 kali, laporkan median dan persentil ke-95, sebutkan apakah cache dikosongkan.
   Pada 30 baris, jawaban jujurnya adalah "terlalu kecil untuk diukur" — dan itu jawaban yang sah.

### Menengah

4. **Tambahkan tabel referensi penyakit** dengan kode ICD-10. Teks bebas membuat setiap
   pengelompokan tidak bisa dipercaya, dan pengelompokan itulah isi hampir semua laporan medis.

5. **Ganti `ON DELETE CASCADE` pada tabel rekam medis menjadi `ON DELETE RESTRICT`** ditambah
   kolom penanda nonaktif. Rekam medis tidak boleh hilang karena satu baris induk dihapus.

6. **Tambahkan kolom jejak audit** (`dibuat_pada`, `diubah_pada`, `diubah_oleh`) pada seluruh
   tabel yang memuat data kesehatan, dan catat setiap pembacaan data pasien. UU PDP No. 27/2022
   menuntut pengendali data dapat menunjukkan siapa mengakses apa.

### Jangka panjang

7. **Uji ketahanan sungguhan.** Jalankan dua kontainer Oracle, buat database link di antaranya,
   mulai transaksi terdistribusi, lalu matikan salah satu kontainer tepat setelah fase PREPARE.
   Amati `DBA_2PC_PENDING`. Itulah satu-satunya cara membuktikan sendiri bahwa 2PC memblokir —
   dan pengalaman itu tidak tergantikan simulasi mana pun.

8. **Versi bahasa Inggris** bila situs ini hendak dipakai di luar kelas. Kerjakan sebagai
   lapisan terpisah dengan kamus penuh dan uji kebocoran antarbahasa, bukan sebagai terjemahan
   sebagian.

9. **Bandingkan dengan sistem terdistribusi modern.** Konsep yang sama muncul lagi dengan nama
   berbeda: sharding di MongoDB, Raft di CockroachDB dan etcd, consistent hashing di Cassandra.
   Menautkan 2PC klasik ke konsensus modern akan membuat materi ini terasa hidup, bukan sejarah.
