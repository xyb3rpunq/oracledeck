# Verifikasi mesin ORACLEDECK terhadap Oracle sungguhan

Dijalankan `node tools/verifikasi_oracle.mjs` pada **2026-09-17** — Oracle AI Database 26ai Free Release 23.26.3.0.0 - Develop, Learn, and Run for Free Version 23.26.3.0.0.

| Pemeriksaan | Lulus |
|---|---|
| Kueri acuan: isi hasil identik | 53/53 |
| Skrip DML: keadaan tabel identik | 7/7 |
| Kasus galat: kode ORA sama | 39/39 |
| \ekspor Terminal SQL: jalan di Oracle, jumlah baris sama | 4/4 |

Catatan metode: tabel data dimuat sebagai NUMBER/VARCHAR2 (tanggal disimpan sebagai teks YYYY-MM-DD);
`LIMIT n OFFSET m` pada kueri acuan diterjemahkan ke `OFFSET m ROWS FETCH NEXT n ROWS ONLY`;
sesi Oracle memakai `NLS_DATE_FORMAT = 'YYYY-MM-DD'`.

## Kode galat

| Kasus | Arti | Diharapkan | Oracle | Mesin | Status |
|---|---|---|---|---|---|
| `pk-ganda` | nilai PRIMARY KEY sudah dipakai | ORA-00001 | ORA-00001 | ORA-00001 | LULUS |
| `unique-ganda` | nilai UNIQUE sudah dipakai | ORA-00001 | ORA-00001 | ORA-00001 | LULUS |
| `not-null` | kolom NOT NULL tidak diisi | ORA-01400 | ORA-01400 | ORA-01400 | LULUS |
| `terlalu-panjang` | teks melebihi panjang VARCHAR2 | ORA-12899 | ORA-12899 | ORA-12899 | LULUS |
| `presisi` | angka melebihi presisi NUMBER(p,s) | ORA-01438 | ORA-01438 | ORA-01438 | LULUS |
| `bukan-angka` | teks dimasukkan ke kolom NUMBER | ORA-01722 | ORA-01722 | ORA-01722 | LULUS |
| `check` | kendala CHECK dilanggar | ORA-02290 | ORA-02290 | ORA-02290 | LULUS |
| `fk-induk-hilang` | nilai FOREIGN KEY tidak ada di tabel induk | ORA-02291 | ORA-02291 | ORA-02291 | LULUS |
| `fk-anak-ada` | baris induk masih dirujuk (tanpa CASCADE) | ORA-02292 | ORA-02292 | ORA-02292 | LULUS |
| `tabel-tidak-ada` | tabel atau view tidak ada | ORA-00942 | ORA-00942 | ORA-00942 | LULUS |
| `kolom-tidak-ada` | kolom tidak dikenal | ORA-00904 | ORA-00904 | ORA-00904 | LULUS |
| `kolom-ambigu` | nama kolom ada di dua tabel yang di-join | ORA-00918 | ORA-00918 | ORA-00918 | LULUS |
| `nama-dipakai` | nama objek sudah dipakai | ORA-00955 | ORA-00955 | ORA-00955 | LULUS |
| `kolom-ganda` | nama kolom ganda | ORA-00957 | ORA-00957 | ORA-00957 | LULUS |
| `drop-induk` | tabel induk masih dirujuk kunci asing | ORA-02449 | ORA-02449 | ORA-02449 | LULUS |
| `truncate-induk` | TRUNCATE tabel induk yang anaknya masih berisi baris | ORA-02266 | ORA-02266 | ORA-02266 | LULUS |
| `group-by` | kolom SELECT tidak ikut GROUP BY | ORA-00979 | ORA-00979 | ORA-00979 | LULUS |
| `single-group` | kolom biasa bercampur fungsi agregat tanpa GROUP BY | ORA-00937 | ORA-00937 | ORA-00937 | LULUS |
| `agregat-di-where` | fungsi agregat di WHERE (seharusnya HAVING) | ORA-00934 | ORA-00934 | ORA-00934 | LULUS |
| `view-jumlah-kolom` | daftar nama kolom view tidak sama dengan kolom kueri | ORA-01730 | ORA-01730 | ORA-01730 | LULUS |
| `unique-index-ganda` | UNIQUE INDEX pada data yang sudah ganda | ORA-01452 | ORA-01452 | ORA-01452 | LULUS |
| `dml-view-union` | DML pada view gabungan UNION ALL | ORA-01732 | ORA-01732 | ORA-01732 | LULUS |
| `fk-bukan-kunci` | kunci asing merujuk kolom yang bukan PRIMARY KEY/UNIQUE | ORA-02270 | ORA-02270 | ORA-02270 | LULUS |
| `fk-induk-tanpa-pk` | tabel induk tidak punya PRIMARY KEY | ORA-02268 | ORA-02268 | ORA-02268 | LULUS |
| `fk-jumlah-kolom` | jumlah kolom kunci asing tidak sama dengan kunci induk | ORA-02256 | ORA-02256 | ORA-02256 | LULUS |
| `varchar2-tanpa-panjang` | VARCHAR2 tanpa panjang | ORA-00906 | ORA-00906 | ORA-00906 | LULUS |
| `check-kolom-menyebut-lain` | CHECK tingkat kolom menyebut kolom lain | ORA-02438 | ORA-02438 | ORA-02438 | LULUS |
| `check-tabel-kolom-asing` | CHECK tingkat tabel menyebut kolom yang tidak ada | ORA-00904 | ORA-00904 | ORA-00904 | LULUS |
| `savepoint-tidak-ada` | ROLLBACK TO savepoint yang belum dibuat | ORA-01086 | ORA-01086 | ORA-01086 | LULUS |
| `indeks-tidak-ada` | DROP INDEX yang tidak ada | ORA-01418 | ORA-01418 | ORA-01418 | LULUS |
| `commit-force-salah` | COMMIT FORCE untuk ID transaksi yang tidak ragu-ragu | ORA-02058 | ORA-02058 | ORA-02058 | LULUS |
| `fungsi-tidak-ada` | fungsi tidak dikenal | ORA-00904 | ORA-00904 | ORA-00904 | LULUS |
| `tanggal-sisa-input` | tanggal gaya DD/MM/YYYY pada format YYYY-MM-DD: masih ada sisa input | ORA-01830 | ORA-01830 | ORA-01830 | LULUS |
| `tanggal-bulan-salah` | bulan 13 | ORA-01843 | ORA-01843 | ORA-01843 | LULUS |
| `tanggal-hari-salah` | hari 32 | ORA-01847 | ORA-01847 | ORA-01847 | LULUS |
| `tanggal-tidak-ada` | 29 Februari pada tahun bukan kabisat | ORA-01839 | ORA-01839 | ORA-01839 | LULUS |
| `tanggal-pendek` | tanggal tanpa hari | ORA-01840 | ORA-01840 | ORA-01840 | LULUS |
| `tanggal-bukan-angka` | teks yang bukan tanggal | ORA-01841 | ORA-01841 | ORA-01841 | LULUS |
| `desc-tidak-ada` | DESC objek yang tidak ada | ORA-04043 | ORA-04043 | ORA-04043 | LULUS |

## Kueri, DML, dan ekspor

| Id | Jenis | Status | Keterangan |
|---|---|---|---|
| `p3-semua` | kueri | LULUS | 5 baris |
| `p3-sem1` | kueri | LULUS | 2 baris |
| `p3-bukan-sem1` | kueri | LULUS | 3 baris |
| `p3-like` | kueri | LULUS | 2 baris |
| `p3-like-and` | kueri | LULUS | 1 baris |
| `p3-count` | kueri | LULUS | 1 baris |
| `p3-minmaxavg` | kueri | LULUS | 1 baris |
| `p3-sum` | kueri | LULUS | 1 baris |
| `p3-between` | kueri | LULUS | 5 baris |
| `p3-in` | kueri | LULUS | 3 baris |
| `p3-not` | kueri | LULUS | 3 baris |
| `p4-join-where` | kueri | LULUS | 3 baris |
| `p4-tiga-tabel` | kueri | LULUS | 7 baris |
| `p5-inner` | kueri | LULUS | 7 baris |
| `p5-left` | kueri | LULUS | 9 baris |
| `p5-left-null` | kueri | LULUS | 2 baris |
| `p5-union` | kueri | LULUS | 5 baris |
| `p5-union-all` | kueri | LULUS | 12 baris |
| `agg-group` | kueri | LULUS | 3 baris |
| `agg-having` | kueri | LULUS | 2 baris |
| `agg-order` | kueri | LULUS | 3 baris |
| `agg-distinct` | kueri | LULUS | 1 baris |
| `rs-riwayat` | kueri | LULUS | 14 baris |
| `rs-statistik` | kueri | LULUS | 6 baris |
| `rs-kota` | kueri | LULUS | 3 baris |
| `rs-sering` | kueri | LULUS | 2 baris |
| `rs-subquery` | kueri | LULUS | 4 baris |
| `rs-admin-daftar` | kueri | LULUS | 4 baris |
| `dh-manager` | kueri | LULUS | 3 baris |
| `dh-subquery` | kueri | LULUS | 3 baris |
| `dh-fragmen-b3` | kueri | LULUS | 4 baris |
| `dh-join-branch` | kueri | LULUS | 10 baris |
| `dh-property` | kueri | LULUS | 6 baris |
| `dh-salary-range` | kueri | LULUS | 7 baris |
| `dh-avg-branch` | kueri | LULUS | 3 baris |
| `fn-upper` | kueri | LULUS | 12 baris |
| `fn-length` | kueri | LULUS | 12 baris |
| `fn-arit` | kueri | LULUS | 5 baris |
| `fn-round` | kueri | LULUS | 1 baris |
| `lj-case` | kueri | LULUS | 5 baris |
| `lj-case-sederhana` | kueri | LULUS | 5 baris |
| `lj-case-agregat` | kueri | LULUS | 1 baris |
| `lj-exists` | kueri | LULUS | 3 baris |
| `lj-not-exists` | kueri | LULUS | 2 baris |
| `lj-skalar-korelasi` | kueri | LULUS | 5 baris |
| `lj-with` | kueri | LULUS | 3 baris |
| `lj-with-dua` | kueri | LULUS | 1 baris |
| `lj-intersect` | kueri | LULUS | 3 baris |
| `lj-except` | kueri | LULUS | 2 baris |
| `lj-union-order` | kueri | LULUS | 10 baris |
| `lj-union-limit` | kueri | LULUS | 3 baris |
| `lj-in-korelasi` | kueri | LULUS | 3 baris |
| `lj-rs-exists` | kueri | LULUS | 2 baris |
| `dml-insert` | dml | LULUS | 7 baris |
| `dml-insert-select` | dml | LULUS | 7 baris |
| `dml-update` | dml | LULUS | 5 baris |
| `dml-update-subquery` | dml | LULUS | 7 baris |
| `dml-delete` | dml | LULUS | 4 baris |
| `dml-delete-exists` | dml | LULUS | 3 baris |
| `dml-rangkaian` | dml | LULUS | 9 baris |
| `ekspor-rumahsakit` | ekspor | LULUS | 6 tabel, 0 view |
| `ekspor-akademik` | ekspor | LULUS | 3 tabel, 1 view |
| `ekspor-dreamhome` | ekspor | LULUS | 3 tabel, 0 view |
| `ekspor-kependudukan` | ekspor | LULUS | 5 tabel, 1 view |
