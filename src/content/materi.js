// materi.js — isi 14 topik kuliah CTI313 Sistem Basis Data Terdistribusi.
// Disusun dari Modul 1, Modul 2, Modul Pertemuan 3, Modul 6, Modul Pertemuan 7,
// dan Rencana Pembelajaran Semester pada Modul 1.

export const MATERI = [
  // ------------------------------------------------------------------- 01
  {
    no: 1,
    slug: 'pengantar',
    judul: 'Pengantar Basis Data Terdistribusi',
    ringkas: 'Beda basis data terpusat dan terdistribusi, klasifikasi model data, serta untung-rugi DDBS.',
    tujuan: 'Memahami dan mengenali konteks basis data objek terdistribusi, dan dapat membedakannya dengan basis data terpusat.',
    lab: ['ketersediaan', 'kependudukan'],
    bagian: [
      {
        h: 'Kebutuhan sistem basis data',
        p: ['Sistem basis data adalah kumpulan file atau tabel yang saling berhubungan dan memungkinkan beberapa pengguna mengakses serta memanipulasi data yang sama. Dorongannya satu: menyatukan data operasional agar pengaksesannya terkontrol.'],
        ul: [
          'Mengklasifikasikan data agar mudah dipahami pengguna',
          'Menghindari duplikasi data',
          'Memudahkan penyimpanan dan pengaksesan data',
          'Mendukung kinerja aplikasi dalam menyimpan data',
          'Menjamin kualitas data dan informasi',
        ],
      },
      {
        h: 'Terpusat vs terdistribusi',
        p: ['Basis data terpusat menyimpan seluruh data di satu tempat — mainframe atau server tunggal. Basis data terdistribusi menyimpan data di perangkat yang berada di lokasi fisik berbeda, tetapi secara logis tetap satu basis data.'],
        tabel: {
          kepala: ['Aspek', 'Terpusat', 'Terdistribusi'],
          baris: [
            ['Lokasi penyimpanan', 'Satu lokasi, terhubung ke server', 'Beberapa lokasi geografis, dikelola DBMS pusat'],
            ['Pemeliharaan', 'Lebih mudah — semua di satu tempat', 'Butuh kerja dan perangkat lunak tambahan'],
            ['Integritas data', 'Lebih mudah dipertahankan', 'Lebih sulit; replikasi harus dijaga'],
            ['Beban akses', 'Semua permintaan ke satu entitas → risiko macet', 'Paralel antar server → beban seimbang'],
            ['Biaya', 'Lebih murah', 'Biaya pemeliharaan dan kompleksitas naik'],
            ['Rancangan', 'Lebih sederhana', 'Lebih kompleks'],
          ],
        },
      },
      {
        h: 'Klasifikasi model basis data',
        p: ['Model basis data non-spasial secara umum terbagi empat: flat-file, hierarki, jaringan, dan relasional. Basis data terdistribusi sendiri terbagi menjadi BDT terpartisi dan BDT terreplikasi.'],
        tabel: {
          kepala: ['Model', 'Ciri', 'Kelebihan', 'Kekurangan'],
          baris: [
            ['Flat-file', 'Satu field per baris, posisi kolom menentukan makna', 'Sangat sederhana', 'Logika baca-tulis harus ditulis manual'],
            ['Hierarki', 'Hubungan parent–child, satu induk per anak', 'Retrieve cepat, integritas mudah diatur', 'Redundansi data, pengguna harus paham susunannya'],
            ['Jaringan', 'Anak boleh punya banyak induk', 'Query kompleks lebih mudah, akses cepat', 'Struktur sulit dimodifikasi'],
            ['Relasional', 'Tabel, tupel, atribut, kunci utama dan asing', 'Cepat, akurat, mudah diubah', 'Pengguna harus paham relasi antar tabel dan SQL'],
          ],
        },
      },
      {
        h: 'Karakteristik DDBS',
        p: ['Satu basis data logis dibagi menjadi beberapa fragmen; tiap fragmen disimpan di satu atau lebih komputer di bawah kendali DBMS yang terpisah, dihubungkan jaringan komunikasi.'],
        ul: [
          'Kumpulan data logis yang digunakan bersama-sama',
          'Data dibagi menjadi beberapa fragmen',
          'Fragmen mungkin mempunyai salinan (replika)',
          'Fragmen atau replikanya dialokasikan ke situs yang memakainya',
          'Setiap situs terhubung jaringan komunikasi',
          'Data di tiap situs di bawah pengawasan DBMS masing-masing',
          'DBMS tiap situs dapat menangani aplikasi lokal secara otonom',
          'Setiap DBMS berpartisipasi pada paling tidak satu aplikasi global',
        ],
        catatan: {
          jenis: 'peringatan',
          teks: '<b>Pemrosesan terdistribusi bukan basis data terdistribusi.</b> Pemrosesan terdistribusi adalah mengakses basis data <i>tersentralisasi</i> dari komputer jauh lewat jaringan. Basis datanya tetap satu dan tetap di satu tempat.',
        },
      },
      {
        h: 'Tujuh kelebihan DDBS',
        tabel: {
          kepala: ['Kelebihan', 'Isi'],
          baris: [
            ['1. Merefleksikan struktur organisasi', 'Organisasi yang bercabang secara alami punya data yang tersebar mengikuti cabangnya.'],
            ['2. Penggunaan bersama & otonomi lokal', 'Data ditempatkan dekat penggunanya; DBA lokal mengatur DBMS lokal secara otonom.'],
            ['3. Ketersediaan meningkat', 'Kegagalan satu situs tidak mematikan seluruh operasional DBMS.'],
            ['4. Keandalan meningkat', 'Fragmen direplikasi; bila satu salinan tak terjangkau, salinan lain dipakai.'],
            ['5. Kinerja meningkat', 'Data berada dekat pengguna; setiap situs hanya menangani sebagian beban.'],
            ['6. Ekonomi', "Grosch's Law: beberapa komputer kecil lebih murah daripada satu superkomputer berdaya setara."],
            ['7. Perkembangan modular', 'Situs baru ditambahkan tanpa mengganggu situs yang sudah ada.'],
          ],
        },
      },
      {
        h: 'Empat kelemahan DDBS',
        tabel: {
          kepala: ['Kelemahan', 'Isi'],
          baris: [
            ['Kompleksitas', 'DBA harus menyediakan akses cepat, andal, dan mutakhir sekaligus atas data yang direplikasi.'],
            ['Biaya', 'Biaya jaringan, biaya komunikasi berjalan, dan biaya tenaga ahli pengelola.'],
            ['Keamanan', 'Bukan hanya replikasi data yang harus dikontrol, jaringannya juga.'],
            ['Kontrol integritas', 'Menegakkan batasan integritas kerap memerlukan akses ke data dalam jumlah besar di banyak situs.'],
          ],
        },
      },
      {
        h: 'Homogen dan heterogen',
        p: ['Pada sistem homogen semua situs memakai produk DBMS yang sama. Pada sistem heterogen produk dan bahkan model datanya berbeda — relasional, jaringan, hierarki, atau berorientasi objek dalam satu sistem.'],
        ul: [
          'Perbedaan perangkat keras saja: yang diubah kode dan panjang kata',
          'Perbedaan produk DBMS: perlu pemetaan struktur data antar model (mis. SELECT → FIND/GET)',
          'Perbedaan keduanya: kedua jenis konversi diperlukan sekaligus',
        ],
        p2: ['Untuk menjembatani perbedaan dipakai <b>gateway</b>, yang mengonversi bahasa dan model data ke bahasa relasional. Keterbatasannya nyata: gateway <i>tidak</i> mendukung manajemen transaksi — ia hanya penerjemah kueri, sehingga kontrol konkurensi dan pemulihan lintas DBMS tidak terkoordinasi.'],
      },
    ],
    sumber: 'Modul 1 — CTI313 Pengantar Basis Data Terdistribusi (Ir. Nixon Erzed, MT)',
  },

  // ------------------------------------------------------------------- 02
  {
    no: 2,
    slug: 'sistem-komputer-modern',
    judul: 'Sistem Komputer Modern dan Tren Layanan',
    ringkas: 'Jaringan LAN/MAN/WAN, topologi, protokol, sistem informasi global, dan komputasi awan.',
    tujuan: 'Memiliki wawasan tentang tren perkembangan sistem komunikasi data dan kebutuhan layanan sistem komputer dan informasi.',
    lab: ['alokasi'],
    bagian: [
      {
        h: 'Jaringan menurut jangkauan',
        tabel: {
          kepala: ['Jenis', 'Jangkauan', 'Ciri', 'Dampak bagi BDT'],
          baris: [
            ['LAN', 'Gedung / kampus', 'Laju data tinggi, tanpa jalur sewa operator', 'Biaya komunikasi kecil — biaya I/O dan CPU tidak boleh diabaikan'],
            ['MAN', 'Kota', 'Cakupan lebih luas, pemeliharaan lama', 'Perantara; biaya komunikasi mulai terasa'],
            ['WAN', 'Antar kota / negara', 'Biaya operasional tinggi, rentan penyadapan', 'Biaya komunikasi mendominasi — optimasi kueri fokus ke byte terkirim'],
          ],
        },
        catatan: {
          jenis: 'info',
          teks: 'Pilihan jaringan menentukan fungsi biaya pengoptimal kueri. Pada WAN dengan bandwidth kecil, optimasi boleh mengabaikan I/O dan CPU. Pada LAN, tidak boleh.',
        },
      },
      {
        h: 'Klasifikasi lain',
        ul: [
          '<b>Berdasarkan kelas transmisi</b> — jaringan point-to-point dan jaringan broadcast',
          '<b>Berdasarkan fungsi</b> — client-server dan peer-to-peer',
          '<b>Berdasarkan topologi</b> — bus, star, ring, mesh, tree',
          '<b>Berdasarkan distribusi sumber data</b> — terpusat dan terdistribusi',
          '<b>Berdasarkan media transmisi</b> — berkabel dan nirkabel',
        ],
      },
      {
        h: 'Sistem informasi global',
        p: ['Perusahaan multinasional beroperasi di banyak negara sehingga arus datanya melintasi batas yurisdiksi. Jenis data yang mengalir lintas negara: data operasional (transaksi pembelian dan penjualan), data pribadi individu, transfer data elektronik antarnegara, serta data teknik dan ilmiah.'],
        catatan: {
          jenis: 'peringatan',
          teks: 'Data pribadi yang melintasi batas negara kini tunduk pada UU PDP No. 27/2022 di Indonesia. Keputusan alokasi fragmen bukan lagi semata soal biaya — ada syarat hukum tentang di mana data warga boleh disimpan.',
        },
      },
      {
        h: 'Komputasi awan',
        tabel: {
          kepala: ['Keuntungan', 'Penjelasan'],
          baris: [
            ['Skalabilitas', 'Kapasitas dapat ditambah tanpa membeli perangkat baru'],
            ['Aksesibilitas', 'Data dapat diakses kapan pun dan di mana pun'],
            ['Keamanan', 'Keamanan dijamin penyedia layanan, dengan konsekuensi ketergantungan'],
            ['Kreasi', 'Pengguna dapat mengembangkan proyek tanpa investasi infrastruktur'],
            ['Kecemasan berkurang', 'Data tetap aman saat bencana menimpa lokasi fisik pengguna'],
          ],
        },
      },
    ],
    sumber: 'Modul 2 — CTI313 Modern Computer Systems (Ir. Nixon Erzed, MT)',
  },

  // ------------------------------------------------------------------- 03
  {
    no: 3,
    slug: 'arsitektur',
    judul: 'Fungsi dan Arsitektur Basis Data Terdistribusi',
    ringkas: 'Empat arsitektur sistem, model struktural DDBS tiga lapis, model ANSI/SPARC, dan arsitektur N-tier.',
    tujuan: 'Memahami model arsitektur dan fungsi-fungsi pada BDT dan dapat menerapkannya dalam merancang BDT.',
    lab: ['erd'],
    bagian: [
      {
        h: 'Empat alternatif arsitektur',
        tabel: {
          kepala: ['Arsitektur', 'Penempatan', 'Cocok untuk', 'Kelemahan utama'],
          baris: [
            ['Stand-alone', 'DBMS, basis data, dan aplikasi di satu komputer', 'Latihan, apotek kecil, wartel, hotel kecil', 'Hanya satu pengguna'],
            ['Terpusat', 'DBMS dan basis data di satu server, banyak terminal', 'Startup, situs internet, instansi kecil', 'Server mati → seluruh aktivitas berhenti'],
            ['Client-server', 'Aplikasi di klien, mesin basis data di server', 'Bisnis kecil hingga menengah', 'Skalabilitas terbatas, koneksi terus dijaga, sulit diamankan'],
            ['Terdistribusi', 'Data tersebar di banyak situs, logis satu kesatuan', 'Organisasi bercabang, lintas kota', 'Kompleksitas dan biaya pengelolaan'],
          ],
        },
      },
      {
        h: 'Dua jenis transaksi pada sistem terdistribusi',
        ul: [
          '<b>Transaksi lokal</b> — hanya mengakses data pada situs tempat transaksi dijalankan',
          '<b>Transaksi global</b> — mengakses data pada beberapa situs berbeda',
        ],
      },
      {
        h: 'Alasan membangun sistem terdistribusi',
        ul: [
          '<b>Data bersama</b> — pengguna di satu situs memakai data yang ada di situs lain, seperti antar cabang bank',
          '<b>Ketersediaan</b> — jika satu situs gagal, situs lain melanjutkan operasi sampai selesai',
          '<b>Otonomi</b> — tiap situs mengontrol data lokalnya; administrator global bertanggung jawab atas keseluruhan sistem',
        ],
      },
      {
        h: 'Karakteristik menurut fungsionalitas',
        tabel: {
          kepala: ['Karakteristik', 'Isi'],
          baris: [
            ['Multiple processes', 'Setiap proses memiliki thread mandiri, eksplisit maupun implisit'],
            ['Interprocess communication', 'Proses berkomunikasi lewat pesan; waktu tempuh pesan bergantung media'],
            ['Disjoint address spaces', 'Ruang alamat tiap proses terpisah, fisik maupun virtual'],
            ['Collective goal', 'Proses harus berinteraksi untuk tujuan bersama — tanpa interaksi bukan sistem terdistribusi'],
          ],
        },
      },
      {
        h: 'Tiga lapis arsitektur D-DBS',
        tabel: {
          kepala: ['Lapis', 'Isi', 'Tugas'],
          baris: [
            ['1. D-DBS Global Clients', 'Pengguna dan klien global', 'Mengirim kueri ke lapisan server DDBMS'],
            ['2. D-DBMS Server', 'Proses D-DBMS + direktori global (GD/D-DB)', 'Menyediakan mekanisme deskripsi, manipulasi, dan kontrol'],
            ['3. Distributed Database', 'Node berisi LDBMS dan basis data lokal (L-DB)', 'Menyimpan data terdistribusi'],
          ],
        },
      },
      {
        h: 'Model datalogical ANSI/SPARC',
        ul: [
          '<b>GES</b> (Global External Schema) — rangkaian skema eksternal yang dilihat aplikasi',
          '<b>GCS</b> (Global Conceptual Schema) — skema konseptual global, penghubung gambaran pengguna dengan gambaran terdistribusi',
          '<b>GIS</b> (Global Internal Schema) — informasi yang dibutuhkan untuk mengakses data terdistribusi dan LDBMS',
          '<b>LCS / LIS</b> — skema konseptual dan internal basis data lokal di tiap situs',
        ],
        catatan: {
          jenis: 'info',
          teks: 'GCS adalah <i>nexus</i> rancangan: seluruh transparansi distribusi bertumpu padanya. Fragmentasi dan alokasi didefinisikan sebagai pemetaan dari GCS ke LCS.',
        },
      },
      {
        h: 'Arsitektur 3-tier dan N-tier',
        tabel: {
          kepala: ['Tier', 'Komponen', 'Isi'],
          baris: [
            ['1', 'Client application', 'Berjalan di komputer pengguna; tidak bisa mencapai RDBMS tanpa melewati tier 2'],
            ['2', 'Application server', 'Berisi package, objek, method, fungsi, dan aktivitas kueri'],
            ['3', 'RDBMS application', 'Kumpulan basis data dan data resource manager'],
          ],
        },
        p: ['N-tier adalah bentuk umum dengan tiga komputer atau lebih. Keuntungannya: tiap tingkat dapat berjalan pada prosesor dan sistem operasi yang sesuai, dan dapat diperbarui secara independen dari tingkat lain.'],
      },
    ],
    sumber: 'Modul Pertemuan 3 — Arsitektur Basis Data Objek Terdistribusi (Sawali Wahyu, S.Kom, M.Kom)',
  },

  // ------------------------------------------------------------------- 04
  {
    no: 4,
    slug: 'perancangan',
    judul: 'Perancangan Basis Data Terdistribusi',
    ringkas: 'Pendekatan top-down dan bottom-up, dari ERD sampai skema fragmen dan alokasi.',
    tujuan: 'Memahami pendekatan-pendekatan dalam merancang basis data terdistribusi.',
    lab: ['erd', 'normalisasi', 'fragmentasi'],
    bagian: [
      {
        h: 'Dua pendekatan',
        tabel: {
          kepala: ['Aspek', 'Top-down', 'Bottom-up'],
          baris: [
            ['Titik mulai', 'Belum ada basis data — dirancang dari nol', 'Sudah ada basis data yang berjalan di tiap situs'],
            ['Urutan', 'Analisis kebutuhan → skema konseptual global → fragmentasi → alokasi → skema lokal', 'Skema lokal → penerjemahan ke model bersama → integrasi menjadi skema global'],
            ['Cocok untuk', 'Sistem homogen yang dibangun serentak', 'Sistem heterogen hasil penggabungan organisasi'],
            ['Masalah utama', 'Menebak pola akses yang belum terjadi', 'Konflik nama, konflik struktur, dan konflik semantik antar skema'],
          ],
        },
      },
      {
        h: 'Langkah perancangan top-down',
        ol: [
          'Analisis kebutuhan: entitas, atribut, volume, dan frekuensi akses',
          'Perancangan konseptual: ERD → skema relasional → normalisasi',
          'Perancangan fragmentasi: horizontal, vertikal, turunan, atau campuran',
          'Perancangan alokasi: fragmen mana ditempatkan di situs mana, direplikasi atau tidak',
          'Perancangan fisik: indeks, tablespace, dan parameter penyimpanan di tiap situs',
        ],
      },
      {
        h: 'Informasi yang wajib dikumpulkan sebelum alokasi',
        tabel: {
          kepala: ['Kelompok', 'Rincian'],
          baris: [
            ['Informasi basis data', 'Skema konseptual, jumlah situs, jumlah/ukuran/selektivitas fragmen per relasi global'],
            ['Informasi aplikasi', 'Jumlah kueri, rata-rata akses baca dan akses update per fragmen, matriks kueri–fragmen, situs asal tiap kueri'],
            ['Informasi situs', 'Unit cost penyimpanan dan unit cost pemrosesan di tiap situs'],
            ['Informasi jaringan', 'Bandwidth dan latensi antar pasangan situs'],
          ],
        },
        catatan: {
          jenis: 'info',
          teks: 'Keempat kelompok inilah masukan Lab Alokasi &amp; Replikasi. Tanpa angka-angka ini, keputusan replikasi hanya tebakan.',
        },
      },
      {
        h: 'Kesalahan perancangan yang paling sering',
        ul: [
          'Memfragmentasi tabel referensi kecil yang justru dibaca semua situs — seharusnya direplikasi',
          'Mereplikasi tabel transaksi yang sering di-update — biaya tulis naik berlipat karena 2PC menyentuh semua salinan',
          'Memilih atribut fragmentasi yang tidak pernah muncul di klausa WHERE — reduksi lokalisasi tidak pernah terjadi',
          'Melupakan kunci pada fragmen vertikal — rekonstruksi menjadi lossy',
        ],
      },
    ],
    sumber: 'Modul 1 (RPS pekan 4) dan Modul Pertemuan 7',
  },

  // ------------------------------------------------------------------- 05
  {
    no: 5,
    slug: 'fragmentasi-alokasi-replikasi',
    judul: 'Basis Data Relasional Terdistribusi',
    ringkas: 'Fragmentasi horizontal, vertikal, turunan, dan campuran; aturan kebenaran; alokasi dan replikasi.',
    tujuan: 'Memahami penerapan basis data relasional dalam sistem terdistribusi.',
    lab: ['fragmentasi', 'alokasi'],
    bagian: [
      {
        h: 'Mengapa relasi dipecah',
        p: ['Pada DBMS terdistribusi, relasi disimpan di beberapa tempat. Mengakses relasi yang disimpan di sisi jauh menimbulkan biaya pengiriman pesan. Untuk menguranginya, relasi dipartisi atau difragmentasi, lalu fragmen dikirim ke tempat fragmen itu paling sering diakses.'],
      },
      {
        h: 'Empat jenis fragmentasi',
        tabel: {
          kepala: ['Jenis', 'Operator', 'Isi fragmen', 'Rekonstruksi'],
          baris: [
            ['Horizontal primer', 'σ (selection)', 'Subset baris dari relasi asal', 'UNION seluruh fragmen'],
            ['Vertikal', 'π (projection)', 'Subset kolom, selalu memuat kunci', 'NATURAL JOIN atas kunci'],
            ['Horizontal turunan', '⋉ (semijoin)', 'Baris anak yang induknya ada di fragmen induk', 'UNION seluruh fragmen'],
            ['Campuran (hybrid)', 'σ∘π', 'Vertikal lalu horizontal, atau sebaliknya', 'Kebalikan urutan pembentukannya'],
          ],
        },
      },
      {
        h: 'Tiga aturan kebenaran fragmentasi',
        tabel: {
          kepala: ['Aturan', 'Horizontal', 'Vertikal'],
          baris: [
            ['<b>Kelengkapan</b>', 'Setiap tupel relasi asal ada di minimal satu fragmen', 'Setiap atribut relasi asal ada di minimal satu fragmen'],
            ['<b>Rekonstruksi</b>', 'R = F₁ ∪ F₂ ∪ … ∪ Fₙ', 'R = F₁ ⋈ F₂ ⋈ … ⋈ Fₙ atas kunci'],
            ['<b>Kedisjoinan</b>', 'Fragmen tidak tumpang tindih (disjoint)', 'Hanya atribut kunci yang boleh berulang'],
          ],
        },
        catatan: {
          jenis: 'bahaya',
          teks: 'Untuk menjamin fragmentasi vertikal bersifat <b>lossless-join</b>, sistem wajib menyediakan id tupel yang unik pada setiap fragmen. Tanpa kunci di setiap fragmen, hasil join kembali bukan relasi aslinya.',
        },
      },
      {
        h: 'Contoh dari Modul 6 dan 7',
        kode: {
          bahasa: 'relasional',
          isi: `S1  = π staffno, position, sex, DOB, salary (STAFF)        ditempatkan di site 3
S2  = π staffno, fname, lname, branchno, sex, DOB, salary (STAFF)

S21 = σ Bno = B3 (S2)     ditempatkan di site 3
S22 = σ Bno = B5 (S2)     ditempatkan di site 5
S23 = σ Bno = B7 (S2)     ditempatkan di site 7`,
        },
        p: ['STAFF dipecah vertikal menjadi S1 dan S2, lalu S2 dipecah horizontal per cabang menjadi S21, S22, dan S23. Inilah fragmentasi campuran. Lab Fragmentasi menjalankan skema persis ini atas data sungguhan dan memeriksa ketiga aturan kebenarannya.'],
      },
      {
        h: 'Alokasi dan replikasi',
        p: ['Setelah relasi dipecah, tiap fragmen harus ditempatkan. Keputusannya menyangkut tiga hal sekaligus: di situs mana, berapa salinan, dan siapa yang menanggung biaya pembaruan.'],
        tabel: {
          kepala: ['Strategi', 'Biaya baca', 'Biaya tulis', 'Ketersediaan', 'Cocok untuk'],
          baris: [
            ['Terpusat (satu situs)', 'Mahal untuk situs jauh', 'Murah — satu salinan', 'Rendah', 'Sistem kecil, satu lokasi dominan'],
            ['Terfragmentasi tanpa replika', 'Murah bila akses lokal', 'Murah', 'Sedang', 'Data yang jelas terpisah per wilayah'],
            ['Replikasi penuh', 'Sangat murah', 'Sangat mahal — semua salinan disentuh', 'Tinggi', 'Tabel referensi yang jarang berubah'],
            ['Replikasi selektif', 'Murah untuk fragmen panas', 'Sedang', 'Tinggi untuk yang direplikasi', 'Pilihan praktis pada hampir semua kasus'],
          ],
        },
      },
    ],
    sumber: 'Modul 1 (RPS pekan 5), Modul Pertemuan 7 bagian Alokasi Data',
  },

  // ------------------------------------------------------------------- 06
  {
    no: 6,
    slug: 'transparansi',
    judul: 'Manajemen Data Terdistribusi: Transparansi',
    ringkas: 'Empat jenis transparansi, lima tingkat transparansi distribusi, dan klasifikasi transaksi DRDA.',
    tujuan: 'Memahami konsep-konsep transparansi dalam pengelolaan basis data terdistribusi.',
    lab: ['transparansi'],
    bagian: [
      {
        h: 'Apa itu transparansi',
        p: ['Transparansi pada basis data terdistribusi berarti menyembunyikan rincian implementasi dari pengguna. Basis data yang sebenarnya terpecah dan tersebar harus terlihat dan terasa seperti satu basis data tunggal yang dioperasikan pada satu komputer.'],
      },
      {
        h: 'Empat jenis transparansi',
        tabel: {
          kepala: ['Jenis', 'Isi', 'Yang disembunyikan'],
          baris: [
            ['Transparansi Distribusi', 'Fragmentasi, lokasi, replikasi, pemetaan lokal, penamaan', 'Bahwa data dipecah dan tersebar'],
            ['Transparansi Transaksi', 'Konkurensi dan kegagalan', 'Bahwa transaksi dipecah menjadi subtransaksi di banyak situs'],
            ['Transparansi Kinerja', 'Distributed Query Processor dan fungsi biaya', 'Bahwa sebagian data harus diambil lewat jaringan'],
            ['Transparansi DBMS', 'Independensi data logis dan fisik, transparansi jaringan', 'Bahwa DBMS di tiap situs bisa berbeda'],
          ],
        },
      },
      {
        h: 'Lima tingkat transparansi distribusi',
        tabel: {
          kepala: ['Tingkat', 'Nama', 'Yang harus diketahui pengguna'],
          baris: [
            ['1 (tertinggi)', 'Transparansi fragmentasi', 'Tidak ada — menulis kueri seperti basis data terpusat'],
            ['2', 'Transparansi lokasi', 'Nama fragmen, tetapi bukan lokasinya'],
            ['3', 'Transparansi replikasi', 'Tidak tahu ada berapa salinan maupun salinan mana yang dipakai'],
            ['4 (terendah)', 'Transparansi pemetaan lokal', 'Nama fragmen <i>dan</i> situs penyimpanannya'],
            ['—', 'Tanpa transparansi', 'Seluruh rute akses, termasuk nama database link'],
          ],
        },
        catatan: {
          jenis: 'info',
          teks: 'Keuntungan utama transparansi lokasi: basis data dapat diorganisasi ulang secara fisik tanpa memengaruhi aplikasi yang mengaksesnya. Lab Transparansi menunjukkan berapa kali lipat SQL memanjang tiap kali satu tingkat transparansi dilepas.',
        },
      },
      {
        h: 'Transparansi penamaan',
        p: ['Setiap objek basis data terdistribusi harus punya nama unik. Ada tiga pendekatan, masing-masing dengan harganya sendiri.'],
        tabel: {
          kepala: ['Pendekatan', 'Contoh', 'Kendala'],
          baris: [
            ['Server nama terpusat', 'Branch', 'Otonomi lokal berkurang, bottleneck kinerja, ketersediaan rendah'],
            ['Awalan situs pembuat', 'S1.Branch.F3.C2', 'Transparansi distribusi hilang — letak terbaca di namanya'],
            ['Alias / sinonim', 'Localbranch → S1.Branch.F3.C2', 'Perlu katalog pemetaan yang konsisten di semua situs'],
          ],
        },
        p2: ['Sistem R* membedakan <b>printname</b> (yang dipakai pengguna) dari <b>system-wide name</b> (identifier internal yang dijamin tidak pernah berubah). System-wide name terdiri dari empat bagian: Creator ID, Creator site ID, Local name, dan Birth-site ID — contohnya <code>Manager@London.localbranch@glasgow</code>.'],
      },
      {
        h: 'Transparansi transaksi',
        p: ['Transaksi terdistribusi dipecah menjadi beberapa subtransaksi, satu untuk setiap situs yang harus diakses. Setiap subtransaksi diwakili sebuah <i>agent</i>. DDBMS wajib menjamin bukan hanya kesatuan transaksi global, tetapi juga sinkronisasi tiap subtransaksi dengan transaksi lokal lain yang berjalan bersamaan di situs yang sama.'],
      },
      {
        h: 'Empat tipe transaksi menurut IBM DRDA',
        tabel: {
          kepala: ['Tingkat', 'Nama', 'Isi'],
          baris: [
            ['1', 'Remote Request', 'Satu perintah SQL dikirim ke satu situs jauh, dieksekusi utuh di sana'],
            ['2', 'Remote Unit of Work', 'Seluruh perintah SQL satu transaksi dikirim ke satu situs jauh; situs lokal memutuskan commit atau rollback'],
            ['3', 'Distributed Unit of Work', 'Perintah SQL boleh tersebar ke beberapa situs, tetapi tiap perintah dieksekusi utuh di satu situs'],
            ['4', 'Distributed Request', 'Satu perintah SQL saja dapat mengakses data di beberapa situs — join atau union lintas fragmen'],
          ],
        },
      },
      {
        h: 'Transparansi kinerja',
        p: ['Distributed Query Processor (DQP) memetakan permintaan data menjadi urutan operasi pada basis data lokal. DQP harus memutuskan tiga hal: fragmen mana yang diakses, salinan fragmen mana yang dipakai bila direplikasi, dan situs mana yang mengerjakannya.'],
        ul: [
          '<b>Biaya I/O</b> — waktu akses data fisik pada disk',
          '<b>Biaya CPU</b> — waktu melaksanakan operasi di memori utama',
          '<b>Biaya komunikasi</b> — transmisi data melalui jaringan',
        ],
        p2: ['Pada sistem tersentralisasi hanya faktor pertama yang dipertimbangkan. Pada WAN dengan bandwidth kecil, biaya komunikasi mendominasi sampai-sampai optimasi boleh mengabaikan I/O dan CPU. Pada LAN, tidak boleh.'],
      },
    ],
    tugas: {
      judul: 'Tugas Modul 6 — contoh jawaban',
      butir: [
        {
          tanya: 'Apa yang dimaksud dengan transparansi basis data?',
          jawab: 'Transparansi adalah penyembunyian rincian implementasi dari pengguna. Pada basis data terdistribusi, yang disembunyikan adalah fakta bahwa data dipecah menjadi fragmen, disimpan di situs berbeda, mungkin punya beberapa salinan, dan diproses oleh DBMS lokal yang terpisah. Pengguna menulis kueri terhadap skema global seolah-olah semuanya berada di satu basis data.',
        },
        {
          tanya: 'Apa keuntungan dari transparansi?',
          jawab: 'Pertama, aplikasi tidak perlu diubah ketika data dipindahkan, dipecah ulang, atau direplikasi — cukup pemetaannya yang diubah (di Oracle: sinonim atau view). Kedua, kueri menjadi jauh lebih pendek dan tidak rawan salah sebut situs; Lab Tangga Transparansi menunjukkan SQL memanjang berlipat saat transparansi dilepas. Ketiga, DDBMS bebas memilih fragmen, salinan, dan situs termurah untuk setiap kueri, karena keputusan itu tidak dikunci di kode aplikasi.',
        },
        {
          tanya: 'Definisikan implementasi transparansi basis data pada proyek kelompok.',
          jawab: 'Untuk proyek rumah sakit: (1) transparansi fragmentasi — tabel PASIEN dipartisi per kota (PARTITION BY LIST), tetapi aplikasi tetap menulis SELECT ... FROM PASIEN; (2) transparansi lokasi — partisi Bandung dan Surabaya diakses lewat database link yang dibungkus sinonim PASIEN_BANDUNG dan PASIEN_SURABAYA; (3) transparansi replikasi — tabel DOKTER direplikasi ke tiap situs sebagai materialized view, dan aplikasi tidak pernah memilih salinan; (4) transparansi transaksi — rujukan pasien lintas kota ditulis sebagai satu transaksi dengan satu COMMIT, dan Oracle menjalankan 2PC sendiri. Skripnya ada di folder oracle/, berkas 03, 06, 07, dan 08.',
        },
      ],
    },
    sumber: 'Modul 6 — CTI313 Manajemen Basis Data Terdistribusi (Ir. Nixon Erzed, MT)',
  },

  // ------------------------------------------------------------------- 07
  {
    no: 7,
    slug: 'independensi',
    judul: 'Independensi Basis Data Terdistribusi',
    ringkas: 'Independensi perangkat keras, sistem operasi, jaringan, dan basis data.',
    tujuan: 'Memahami konsep independensi dan kebutuhan penerapannya dalam basis data terdistribusi.',
    lab: ['transparansi', 'kependudukan'],
    bagian: [
      {
        h: 'Empat tingkat independensi',
        tabel: {
          kepala: ['Tingkat', 'Arti', 'Diuji dengan pertanyaan'],
          baris: [
            ['Perangkat keras', 'Sistem berjalan tanpa peduli arsitektur mesin dan panjang kata', 'Bisakah satu situs diganti server merek lain tanpa mengubah aplikasi?'],
            ['Sistem operasi', 'Sistem berjalan di atas OS yang berbeda-beda', 'Bisakah satu situs pakai Linux dan lainnya Windows?'],
            ['Jaringan', 'Perintah yang sama berlaku lokal maupun lintas mesin', 'Apakah <code>cp</code> dan <code>rcp</code> masih dibedakan pengguna?'],
            ['Basis data', 'Produk DBMS di tiap situs boleh berbeda', 'Bisakah satu situs pakai Oracle dan lainnya PostgreSQL?'],
          ],
        },
      },
      {
        h: 'Dua jenis kebebasan data',
        ul: [
          '<b>Kebebasan data logis</b> — kekebalan aplikasi terhadap perubahan struktur logis. Menambah atribut baru pada relasi tidak boleh memengaruhi aplikasi yang hanya memakai sebagian atribut.',
          '<b>Kebebasan data fisik</b> — penyembunyian rincian struktur penyimpanan. Saat aplikasi ditulis, organisasi fisik data tidak perlu diperhatikan.',
        ],
      },
      {
        h: 'Siapa yang menyediakan transparansi',
        tabel: {
          kepala: ['Lapis', 'Penyedia', 'Kenyataannya'],
          baris: [
            ['1', 'Bahasa pemrograman', 'Compiler atau interpreter menerjemahkan permintaan layanan ke operasi; tidak ada layanan transparan untuk compiler itu sendiri'],
            ['2', 'Sistem operasi', 'Akses transparan ke sumber daya diperluas ke distribusi — sayangnya tidak semua OS punya manajemen jaringan ini'],
            ['3', 'DBMS', 'DBMS menanggung hampir semua penerjemahan dari OS ke antarmuka pengguna tingkat tinggi'],
          ],
        },
        catatan: {
          jenis: 'peringatan',
          teks: 'Karena lapis 1 dan 2 jarang menyediakan transparansi yang memadai, beban itu jatuh hampir seluruhnya ke DBMS. Itulah sebabnya fitur seperti database link dan sinonim ada di Oracle, bukan di sistem operasi.',
        },
      },
    ],
    sumber: 'Modul 6 bagian Transparansi pada DDBMS; Modul 1 (RPS pekan 7)',
  },

  // ------------------------------------------------------------------- 08
  {
    no: 8,
    slug: 'prinsip',
    judul: 'Prinsip Basis Data Terdistribusi',
    ringkas: 'Dua belas aturan Date, otonomi sistem, tidak bergantung situs pusat, dan operasi berkelanjutan.',
    tujuan: 'Memahami prinsip-prinsip dasar basis data terdistribusi.',
    lab: ['ketersediaan'],
    bagian: [
      {
        h: 'Aturan dasar',
        p: ['Satu aturan mendasari semuanya: <b>bagi pengguna, sistem terdistribusi harus terlihat persis seperti sistem yang tidak terdistribusi.</b> Dua belas aturan berikut adalah penjabarannya.'],
        tabel: {
          kepala: ['#', 'Prinsip', 'Arti praktis'],
          baris: [
            ['1', 'Otonomi lokal', 'Situs mengelola datanya sendiri; tidak ada operasi lokal yang bergantung situs lain'],
            ['2', 'Tidak bergantung situs pusat', 'Tidak ada satu situs yang, bila mati, mematikan seluruh sistem'],
            ['3', 'Operasi berkelanjutan', 'Menambah situs atau mengubah skema tidak memerlukan penghentian sistem'],
            ['4', 'Independensi lokasi', 'Pengguna tidak perlu tahu di mana data disimpan'],
            ['5', 'Independensi fragmentasi', 'Pengguna tidak perlu tahu data dipecah'],
            ['6', 'Independensi replikasi', 'Pengguna tidak perlu tahu ada berapa salinan'],
            ['7', 'Pemrosesan kueri terdistribusi', 'Satu kueri boleh menyentuh banyak situs dan tetap dioptimasi'],
            ['8', 'Manajemen transaksi terdistribusi', 'Atomicity dan durability tetap berlaku lintas situs'],
            ['9', 'Independensi perangkat keras', 'Bebas arsitektur mesin'],
            ['10', 'Independensi sistem operasi', 'Bebas OS'],
            ['11', 'Independensi jaringan', 'Bebas topologi dan protokol jaringan'],
            ['12', 'Independensi DBMS', 'Bebas produk DBMS — inilah yang paling jarang tercapai'],
          ],
        },
      },
      {
        h: 'Mengapa aturan ke-2 sering dilanggar',
        p: ['Server nama terpusat melanggar aturan 1, 2, dan 3 sekaligus: otonomi lokal berkurang, ada titik kegagalan tunggal, dan bila situs pusat gagal situs lain tidak dapat membuat objek baru. Itulah sebabnya pendekatan awalan situs dan alias lebih disukai walau lebih rumit.'],
        catatan: {
          jenis: 'bahaya',
          teks: 'Koordinator 2PC juga merupakan titik kegagalan tunggal — bukan untuk seluruh sistem, tetapi untuk setiap transaksi global yang sedang berjalan. Lab 2PC/3PC menunjukkan persis kapan hal itu berubah menjadi blokir.',
        },
      },
    ],
    sumber: 'Modul 1 (RPS pekan 8); C.J. Date, dua belas aturan basis data terdistribusi',
  },

  // ------------------------------------------------------------------- 09
  {
    no: 9,
    slug: 'transaksi',
    judul: 'Manajemen Transaksi Terdistribusi',
    ringkas: 'ACID lintas situs, manajer transaksi, scheduler, agent, dan model koordinasi.',
    tujuan: 'Mengetahui lingkup transaksi terdistribusi dan kebutuhan pengelolaannya.',
    lab: ['duafase', 'konkurensi'],
    bagian: [
      {
        h: 'Komponen manajemen transaksi',
        tabel: {
          kepala: ['Komponen', 'Tugas'],
          baris: [
            ['Transaction Manager', 'Mengoordinasi transaksi yang berasal dari situsnya; memecah transaksi global menjadi subtransaksi'],
            ['Scheduler', 'Menentukan urutan eksekusi operasi agar tetap serializable'],
            ['Recovery Manager', 'Mengembalikan basis data ke keadaan konsisten setelah kegagalan'],
            ['Buffer Manager', 'Mengatur perpindahan data antara memori utama dan penyimpanan'],
            ['Agent', 'Wakil subtransaksi di situs tempat data berada'],
          ],
        },
      },
      {
        h: 'Contoh transaksi terdistribusi dari Modul 6',
        p: ['Transaksi T mencetak nama seluruh staf memakai skema fragmentasi S1, S2, S22, dan S23. Subtransaksi TS3, TS5, dan TS7 mewakili agent di lokasi 3, 5, dan 7.'],
        tabel: {
          kepala: ['Waktu', 'TS3', 'TS5', 'TS7'],
          baris: [
            ['t1', 'Begin transaction', 'Begin transaction', 'Begin transaction'],
            ['t2', 'Read(fname, lname)', 'Read(fname, lname)', 'Read(fname, lname)'],
            ['t3', 'Print(fname, lname)', 'Print(fname, lname)', 'Print(fname, lname)'],
            ['t4', 'End_transaction', 'End_transaction', 'End_transaction'],
          ],
        },
      },
      {
        h: 'ACID pada lingkungan terdistribusi',
        tabel: {
          kepala: ['Sifat', 'Pada satu situs', 'Yang berubah pada banyak situs'],
          baris: [
            ['Atomicity', 'Log + rollback lokal', 'Perlu protokol komit atomik (2PC/3PC) agar semua situs sepakat'],
            ['Consistency', 'Constraint diperiksa saat commit', 'Constraint lintas situs mahal — kerap dilonggarkan'],
            ['Isolation', 'Locking atau timestamp lokal', 'Perlu penjadwalan global; deadlock bisa lintas situs'],
            ['Durability', 'Log ditulis ke disk sebelum commit', 'Setiap situs menulis lognya sendiri sebelum menjawab PREPARE'],
          ],
        },
      },
      {
        h: 'Model koordinasi',
        ul: [
          '<b>Terpusat</b> — satu koordinator per transaksi, biasanya situs asal. Sederhana, tetapi koordinator menjadi titik kritis.',
          '<b>Hierarkis</b> — koordinator memiliki subkoordinator; cocok untuk banyak situs.',
          '<b>Terdesentralisasi</b> — setiap peserta berkomunikasi dengan semua peserta lain. Tidak ada titik kegagalan tunggal, tetapi jumlah pesan membengkak menjadi O(n²).',
        ],
      },
    ],
    sumber: 'Modul 6 bagian Transparansi Transaksi; Modul 1 (RPS pekan 9)',
  },

  // ------------------------------------------------------------------- 10
  {
    no: 10,
    slug: 'konkurensi',
    judul: 'Pemrosesan Konkuren dan Kendali',
    ringkas: 'Keterserialan, protokol locking dua fase, timestamp ordering, dan kendali konkurensi terdistribusi.',
    tujuan: 'Memahami pemrosesan konkuren dan implementasinya dalam pengendalian proses pada basis data terdistribusi.',
    lab: ['konkurensi', 'deadlock'],
    bagian: [
      {
        h: 'Masalah yang harus dicegah',
        tabel: {
          kepala: ['Masalah', 'Contoh jadwal', 'Akibat'],
          baris: [
            ['Lost update', 'r1[x] r2[x] w1[x] w2[x]', 'Pembaruan T1 tertimpa T2 dan hilang tanpa jejak'],
            ['Dirty read', 'w1[x] r2[x] a1', 'T2 membaca nilai yang kemudian dibatalkan'],
            ['Unrepeatable read', 'r1[x] w2[x] c2 r1[x]', 'T1 membaca nilai berbeda untuk item yang sama'],
            ['Phantom', 'σ1[p] i2[p] σ1[p]', 'Baris baru muncul di antara dua pembacaan dengan predikat sama'],
          ],
        },
      },
      {
        h: 'Keterserialan konflik',
        p: ['Sebuah jadwal disebut <i>conflict-serializable</i> bila graf presedensinya asiklik. Sisi Ti → Tj dibuat bila operasi Ti mendahului operasi Tj yang berkonflik — yaitu pada item data yang sama, dari transaksi berbeda, dan minimal salah satunya operasi tulis.'],
        catatan: {
          jenis: 'info',
          teks: 'Lab Konkurensi membangun graf presedensi dari jadwal yang Anda ketik, mencari siklusnya, dan bila asiklik menunjukkan urutan serial yang setara.',
        },
      },
      {
        h: 'Two-Phase Locking',
        tabel: {
          kepala: ['Varian', 'Aturan', 'Menjamin'],
          baris: [
            ['2PL dasar', 'Setelah melepas satu kunci, transaksi tidak boleh meminta kunci baru', 'Serializable, tetapi cascading abort masih mungkin'],
            ['2PL ketat (strict)', 'Semua kunci tulis dipegang sampai commit/abort', 'Serializable + cascadeless'],
            ['2PL tegas (rigorous)', 'Semua kunci, baca maupun tulis, dipegang sampai commit/abort', 'Serializable + strict; urutan commit = urutan serial'],
          ],
        },
        p: ['Harga 2PL adalah deadlock. Peningkatan kunci S ke X saat transaksi lain juga memegang S menghasilkan deadlock peningkatan yang paling sering terjadi di praktik.'],
      },
      {
        h: 'Timestamp Ordering',
        p: ['Setiap transaksi diberi cap waktu saat mulai. Operasi yang melanggar urutan cap waktu ditolak dan transaksinya di-rollback — tidak ada penantian, sehingga tidak ada deadlock.'],
        tabel: {
          kepala: ['Operasi', 'Syarat', 'Bila dilanggar'],
          baris: [
            ['read(x) oleh T', 'TS(T) ≥ WTS(x)', 'Rollback T — hendak membaca nilai yang sudah ditimpa transaksi lebih muda'],
            ['write(x) oleh T', 'TS(T) ≥ RTS(x)', 'Rollback T — nilainya sudah dibaca transaksi lebih muda'],
            ['write(x) oleh T', 'TS(T) ≥ WTS(x)', 'Abaikan tulisan (aturan tulis Thomas) — tulisan usang aman dibuang'],
          ],
        },
        catatan: {
          jenis: 'info',
          teks: 'Pada sistem terdistribusi, cap waktu harus unik lintas situs. Solusinya cap waktu majemuk &lt;jam lokal, id situs&gt;, sehingga dua situs tidak pernah menghasilkan cap waktu yang sama.',
        },
      },
      {
        h: 'Replikasi memperumit konkurensi',
        p: ['Jika salinan data yang direplikasi diperbarui, perubahan itu harus segera disebarkan ke semua salinan. Bila salah satu situs pemegang salinan tidak terjangkau, transaksi tertunda sampai situs itu pulih. Semakin banyak salinan, semakin besar kemungkinan transaksi konkuren gagal.'],
        ul: [
          '<b>Sinkron (eager)</b> — semua salinan diperbarui dalam satu transaksi. Konsisten, tetapi rapuh dan lambat.',
          '<b>Asinkron (lazy)</b> — salinan diperbarui setelah transaksi asli commit. Cepat, tetapi ada jendela ketidakkonsistenan mulai dari beberapa detik sampai beberapa jam.',
        ],
      },
    ],
    sumber: 'Modul 1 (RPS pekan 10); Modul 6 bagian Transparansi Konkurensi',
  },

  // ------------------------------------------------------------------- 11
  {
    no: 11,
    slug: 'deadlock',
    judul: 'Manajemen Deadlock',
    ringkas: 'Wait-for graph, deteksi terpusat dan terdistribusi, deadlock semu, pencegahan, dan pemilihan korban.',
    tujuan: 'Memahami kejadian deadlock dan dapat mengenalinya dalam pemrosesan data terdistribusi.',
    lab: ['deadlock'],
    bagian: [
      {
        h: 'Empat syarat Coffman',
        ul: [
          '<b>Mutual exclusion</b> — sumber daya hanya bisa dipegang satu transaksi',
          '<b>Hold and wait</b> — transaksi memegang sumber daya sambil menunggu yang lain',
          '<b>No preemption</b> — sumber daya tidak bisa direbut paksa',
          '<b>Circular wait</b> — ada rantai penantian yang melingkar',
        ],
        p: ['Mencegah salah satu syarat berarti mencegah deadlock. Skema wait-die dan wound-wait menyerang syarat keempat.'],
      },
      {
        h: 'Tiga metode deteksi',
        tabel: {
          kepala: ['Metode', 'Cara kerja', 'Kelebihan', 'Kekurangan'],
          baris: [
            ['Terpusat', 'Satu situs mengumpulkan WFG lokal semua situs dan menyatukannya', 'Pasti menemukan semua siklus, sederhana', 'Titik kegagalan tunggal, bottleneck, deadlock semu'],
            ['Path pushing', 'Tiap situs mendorong jalur tunggu yang melibatkan transaksi luar ke situs berikutnya', 'Tanpa koordinator; pesan sebanding panjang siklus', 'Informasi antar situs tidak serentak'],
            ['Edge chasing', 'Transaksi menunggu mengirim probe (i, j, k); deadlock bila probe kembali ke pengirim', 'Beban pesan paling ringan', 'Tiap transaksi menunggu harus memulai probe sendiri'],
          ],
        },
      },
      {
        h: 'Deadlock semu (phantom deadlock)',
        p: ['WFG dari situs A dan situs B tidak pernah diambil pada saat yang benar-benar sama. Sisi yang sebenarnya sudah dilepas masih tercatat, dan siklus palsu terbentuk. Detektor lalu mengorbankan satu transaksi yang sesungguhnya tidak buntu.'],
        catatan: {
          jenis: 'peringatan',
          teks: 'Ini bukan bug yang bisa diperbaiki, melainkan konsekuensi langsung dari tidak adanya waktu global pada sistem terdistribusi. Yang bisa dilakukan hanya mengurangi frekuensinya — misalnya dengan memperpendek jeda pengumpulan WFG.',
        },
      },
      {
        h: 'Pencegahan berbasis cap waktu',
        tabel: {
          kepala: ['Skema', 'Peminta lebih tua', 'Peminta lebih muda', 'Sifat'],
          baris: [
            ['Wait-Die', 'Menunggu', 'Mati lalu restart dengan cap waktu lama', 'Non-preemptive'],
            ['Wound-Wait', 'Melukai pemegang (pemegang di-rollback)', 'Menunggu', 'Preemptive'],
          ],
        },
        p: ['Pada kedua skema, arah sisi tunggu selalu searah cap waktu, sehingga siklus mustahil terbentuk. Transaksi yang di-restart mempertahankan cap waktu lamanya agar tidak kelaparan selamanya.'],
      },
      {
        h: 'Pemilihan korban',
        ul: [
          '<b>Termuda</b> — paling sedikit kerja yang terbuang',
          '<b>Kunci paling sedikit</b> — paling murah dibatalkan',
          '<b>Kerja paling sedikit</b> — meminimalkan pengulangan',
          '<b>Prioritas terendah</b> — transaksi bisnis paling tidak kritis dikorbankan lebih dulu',
        ],
      },
    ],
    sumber: 'Modul 1 (RPS pekan 11)',
  },

  // ------------------------------------------------------------------- 12
  {
    no: 12,
    slug: 'kegagalan',
    judul: 'Kegagalan pada Sistem Basis Data Terdistribusi',
    ringkas: 'Jenis kegagalan, pengaruhnya terhadap pemulihan, dan protokol komitmen dua fase.',
    tujuan: 'Memahami kejadian kegagalan di lingkungan pemrosesan data terdistribusi.',
    lab: ['duafase', 'kependudukan'],
    bagian: [
      {
        h: 'Jenis kegagalan',
        tabel: {
          kepala: ['Jenis', 'Ada di sistem terpusat?', 'Dampak khas pada DDBMS'],
          baris: [
            ['Kegagalan transaksi', 'Ya', 'Rollback lokal; subtransaksi lain harus ikut dibatalkan'],
            ['Sistem crash', 'Ya', 'Log dipakai untuk redo/undo saat situs pulih'],
            ['Kesalahan media', 'Ya', 'Pemulihan dari backup dan arsip log'],
            ['Kehilangan pesan', 'Tidak', 'Koordinator timeout dan menganggapnya suara abort'],
            ['Kegagalan jalur komunikasi', 'Tidak', 'Situs tidak terjangkau meski hidup'],
            ['Kegagalan situs', 'Tidak', 'Subtransaksi menggantung di situs itu'],
            ['Partisi jaringan', 'Tidak', 'Sistem terbelah menjadi dua kelompok yang saling tak terlihat'],
          ],
        },
      },
      {
        h: 'Protokol komitmen dua fase',
        tabel: {
          kepala: ['Fase', 'Koordinator', 'Peserta'],
          baris: [
            ['1 — Voting', 'Tulis <code>begin_commit</code>, kirim PREPARE ke semua peserta', 'Tulis catatan <code>ready</code>, balas VOTE-COMMIT atau VOTE-ABORT'],
            ['2 — Decision', 'Tulis keputusan, kirim GLOBAL-COMMIT / GLOBAL-ABORT', 'Terapkan keputusan, kirim ACK, tulis <code>end_of_transaction</code>'],
          ],
        },
        catatan: {
          jenis: 'bahaya',
          teks: 'Begitu peserta menulis catatan <b>ready</b>, ia menyerahkan hak memutuskan kepada koordinator. Jika koordinator jatuh tepat setelah itu, peserta <b>tidak boleh</b> commit maupun abort sendiri — ia terblokir, dan kunci yang dipegangnya ikut menahan transaksi lain.',
        },
      },
      {
        h: 'Protokol terminasi kooperatif',
        p: ['Peserta yang menggantung boleh bertanya ke peserta lain. Bila ada peserta yang sudah tahu keputusan, keputusan itu disalin. Bila semua peserta sama-sama berada di keadaan READY, tidak ada informasi baru dan semuanya tetap terblokir — inilah batas kemampuan 2PC.'],
      },
      {
        h: 'Yang terjadi di Oracle',
        p: ['Oracle menjalankan 2PC secara otomatis begitu satu transaksi menyentuh lebih dari satu basis data lewat database link. Tidak ada perintah khusus — cukup <code>COMMIT</code>. Transaksi yang menggantung muncul di <code>DBA_2PC_PENDING</code> dengan STATE bernilai <code>prepared</code>.'],
        kode: {
          bahasa: 'sql',
          isi: `SELECT local_tran_id, global_tran_id, state, mixed, host
  FROM dba_2pc_pending
 ORDER BY fail_time;

-- Hanya setelah keputusan koordinator dipastikan:
COMMIT FORCE '1.15.1234';
-- atau ROLLBACK FORCE '1.15.1234';
EXEC DBMS_TRANSACTION.PURGE_LOST_DB_ENTRY('1.15.1234');`,
        },
        catatan: {
          jenis: 'bahaya',
          teks: 'Memaksa keputusan yang berbeda dari keputusan koordinator menghasilkan <b>mixed outcome</b> — kolom MIXED bernilai yes, sebagian situs commit dan sebagian rollback. Basis data kehilangan konsistensi global dan harus diperbaiki manual.',
        },
      },
    ],
    sumber: 'Modul 1 (RPS pekan 12); Modul 6 bagian Transparansi Kegagalan',
  },

  // ------------------------------------------------------------------- 13
  {
    no: 13,
    slug: 'pemulihan',
    judul: 'Pemulihan Sistem Basis Data Terdistribusi',
    ringkas: 'Komitmen tiga fase, partisi jaringan, kuorum, dan CAP.',
    tujuan: 'Memahami teknik pemulihan kegagalan pemrosesan data terdistribusi.',
    lab: ['duafase', 'ketersediaan'],
    bagian: [
      {
        h: 'Mengapa 3PC ada',
        p: ['Kelemahan 2PC bukan kelalaian implementasi, melainkan sifat protokolnya: keadaan READY bertetangga langsung dengan COMMIT maupun ABORT, sehingga peserta di keadaan itu tidak punya dasar untuk memilih. 3PC menyisipkan satu keadaan antara — PRE-COMMIT — yang hanya bertetangga dengan COMMIT.'],
        tabel: {
          kepala: ['Fase', 'Koordinator', 'Peserta'],
          baris: [
            ['1 — Voting', 'Kirim PREPARE', 'Balas VOTE-COMMIT / VOTE-ABORT, masuk READY'],
            ['2 — Pre-commit', 'Kirim PRE-COMMIT bila semua setuju', 'Masuk PRE-COMMIT, balas ACK — kini tahu keputusan global pasti COMMIT'],
            ['3 — Commit', 'Kirim GLOBAL-COMMIT', 'Commit dan balas ACK'],
          ],
        },
      },
      {
        h: 'Aturan terminasi 3PC',
        ul: [
          'Ada peserta di keadaan COMMIT → semua commit',
          'Ada peserta di keadaan ABORT → semua abort',
          'Ada peserta di keadaan PRE-COMMIT → semua commit, karena PRE-COMMIT hanya dikirim setelah semua suara masuk',
          'Tidak ada satu pun di PRE-COMMIT → semua abort, karena berarti keputusan commit belum pernah dibuat',
        ],
        catatan: {
          jenis: 'baik',
          teks: '3PC menambah satu putaran pesan sehingga lebih lambat pada jalur normal. Imbalannya: tidak ada keadaan yang bertetangga dengan COMMIT dan ABORT sekaligus, sehingga peserta selalu bisa memutuskan sendiri.',
        },
      },
      {
        h: 'Partisi jaringan',
        p: ['Jaringan terbelah menjadi dua kelompok yang saling tak terlihat. Tidak ada protokol yang dapat menjamin konsistensi <i>sekaligus</i> ketersediaan di kedua sisi — inilah isi teorema CAP.'],
        tabel: {
          kepala: ['Strategi', 'Yang dikorbankan', 'Contoh sistem'],
          baris: [
            ['CP — hanya sisi mayoritas melayani tulis', 'Ketersediaan di sisi minoritas', 'Oracle RAC dengan voting disk, etcd, ZooKeeper'],
            ['AP — kedua sisi tetap melayani', 'Konsistensi (diselesaikan belakangan)', 'Cassandra, DynamoDB, Oracle GoldenGate asinkron'],
            ['CA — asumsi partisi tidak terjadi', 'Toleransi partisi, yang tidak boleh dikorbankan', 'Basis data satu mesin'],
          ],
        },
        p2: ['PACELC melengkapi CAP: <b>kalau ada Partisi</b> pilih A atau C; <b>Else</b> (jaringan sehat) pilih L (latensi rendah) atau C (konsistensi). Pertukaran tetap ada bahkan ketika tidak ada kegagalan sama sekali.'],
      },
      {
        h: 'Kuorum',
        p: ['Dengan N salinan, kuorum baca R dan kuorum tulis W, konsistensi kuat dijamin bila <b>R + W &gt; N</b> — himpunan baca dan himpunan tulis pasti beririsan sehingga pembaca selalu melihat tulisan terakhir. Bila W &gt; N/2, urutan tulis juga terjamin.'],
      },
      {
        h: 'RTO dan RPO',
        tabel: {
          kepala: ['Strategi replikasi', 'RPO (data yang mungkin hilang)', 'Harga'],
          baris: [
            ['Sinkron', '0 — tidak ada transaksi hilang', 'Setiap commit menunggu situs jauh; latensi naik'],
            ['Asinkron', 'Sebesar jeda replikasi (detik sampai menit)', 'Commit lokal tetap cepat'],
            ['Backup berkala', 'Sebesar interval backup (jam)', 'Paling murah, paling banyak kehilangan'],
          ],
        },
      },
    ],
    sumber: 'Modul 1 (RPS pekan 13)',
  },

  // ------------------------------------------------------------------- 14
  {
    no: 14,
    slug: 'query-optimizer',
    judul: 'Query Optimizer dan DDBMS',
    ringkas: 'Dekomposisi kueri, lokalisasi data, join terdistribusi, dan optimasi global.',
    tujuan: 'Memahami optimasi pada data terdistribusi dan mengenali DDBMS beserta fungsionalitasnya.',
    lab: ['dekomposisi', 'lokalisasi', 'join', 'sql', 'soal'],
    bagian: [
      {
        h: 'Empat lapisan pemrosesan kueri',
        tabel: {
          kepala: ['Lapisan', 'Masukan', 'Keluaran', 'Peduli distribusi?'],
          baris: [
            ['1. Dekomposisi kueri', 'Kueri kalkulus relasional (SQL)', 'Kueri aljabar atas relasi global', 'Tidak — sama untuk sistem terpusat'],
            ['2. Lokalisasi data', 'Kueri aljabar atas relasi global', 'Kueri aljabar atas fragmen fisik', 'Ya — memakai skema fragmen'],
            ['3. Optimasi global', 'Kueri atas fragmen', 'Rencana eksekusi beserta urutan dan situsnya', 'Ya — memakai statistik dan biaya jaringan'],
            ['4. Optimasi lokal', 'Bagian kueri untuk satu situs', 'Rencana akses fisik di situs itu', 'Tidak — tugas DBMS lokal'],
          ],
        },
      },
      {
        h: 'Empat langkah dekomposisi kueri',
        tabel: {
          kepala: ['Langkah', 'Tujuan', 'Teknik'],
          baris: [
            ['1. Normalisasi', 'Mengubah kualifikasi WHERE ke bentuk normal', 'Bentuk normal konjungtif (CNF) atau disjungtif (DNF)'],
            ['2. Analisis', 'Menolak kueri yang salah tipe atau salah semantik', 'Pemeriksaan tipe terhadap skema global + graf kueri'],
            ['3. Eliminasi redundansi', 'Membuang predikat berlebih', 'Hukum idempoten: p∧p≡p, p∧(p∨q)≡p, p∧¬p≡false'],
            ['4. Penulisan ulang', 'Mengubah kueri menjadi pohon operator', 'Daun = relasi, akar = proyeksi hasil'],
          ],
        },
        catatan: {
          jenis: 'info',
          teks: 'Kueri disebut <b>salah tipe</b> bila atribut atau relasinya tidak ada dalam skema global, atau operasi diterapkan pada tipe yang salah. Disebut <b>salah semantik</b> bila graf kuerinya tidak terhubung — hasilnya perkalian kartesian yang hampir pasti bukan yang dimaksud pengguna.',
        },
      },
      {
        h: 'Lokalisasi data dan reduksi',
        p: ['Lapisan lokalisasi menerjemahkan kueri aljabar atas relasi global menjadi kueri atas fragmen fisik, memakai <b>program lokalisasi</b>: UNION untuk fragmen horizontal, JOIN untuk fragmen vertikal. Kueri hasilnya lalu direduksi.'],
        ul: [
          '<b>Reduksi horizontal primer</b> — σ<sub>p</sub>(F<sub>i</sub>) = ∅ bila p bertentangan dengan predikat fragmen',
          '<b>Reduksi vertikal</b> — fragmen yang tidak menyumbang atribut hasil dibuang dari join',
          '<b>Reduksi join</b> — pasangan fragmen dengan predikat bertentangan pada atribut join dibuang',
          '<b>Reduksi turunan</b> — fragmen anak hanya dipasangkan dengan fragmen induknya',
        ],
      },
      {
        h: 'Strategi join terdistribusi',
        tabel: {
          kepala: ['Strategi', 'Yang dikirim', 'Pesan', 'Menang bila'],
          baris: [
            ['Kirim R utuh', 'Seluruh relasi R', '1', 'R kecil atau hampir semua barisnya berpasangan'],
            ['Kirim S utuh', 'Seluruh relasi S', '1', 'S jauh lebih kecil daripada R'],
            ['Semijoin', 'π kolom join dari S, lalu R yang tersaring', '2', 'R besar dan selektivitasnya rendah'],
            ['Bloom join', 'Penapis Bloom, lalu R yang tersaring', '2', 'Sama seperti semijoin, dengan pesan pertama jauh lebih kecil'],
          ],
        },
        p: ['Semijoin memakai identitas R ⋈ S = (R ⋉ S) ⋈ S. Bloom join menggantikan daftar nilai join dengan penapis Bloom yang jauh lebih ringkas, dengan imbalan positif palsu yang baru tersaring saat join akhir — hasil akhirnya tetap identik.'],
      },
      {
        h: 'Optimasi global',
        ul: [
          'Urutan join — ruang pencariannya tumbuh faktorial, sehingga dipakai heuristik atau pemrograman dinamis',
          'Pemilihan salinan — replika mana yang paling murah diakses dari situs asal kueri',
          'Penempatan operasi — di situs mana tiap operator dijalankan',
          'Dorong selection dan projection sedekat mungkin ke daun, sebelum data melintasi jaringan',
        ],
        catatan: {
          jenis: 'baik',
          teks: 'Di Oracle, bukti bahwa reduksi benar-benar terjadi ada pada kolom PSTART/PSTOP (partition pruning) dan operasi REMOTE pada rencana eksekusi. Kolom OTHER berisi SQL yang sesungguhnya dikirim ke situs jauh.',
        },
      },
    ],
    sumber: 'Modul Pertemuan 7 — Dekomposisi Kueri dan Lokalisasi Data; Modul 1 (RPS pekan 14)',
  },
];

export const LAB = [
  { slug: 'erd', no: 1, judul: 'Perancang ERD', ringkas: 'Kasus Tono Rental: ERD → skema relasional → DDL Oracle, lengkap dengan jejak transformasinya.', topik: [3, 4] },
  { slug: 'normalisasi', no: 2, judul: 'Normalisasi 1NF–BCNF', ringkas: 'Penutupan atribut, candidate key, pelanggaran per tingkat, sintesis 3NF, dan uji lossless-join.', topik: [4, 14] },
  { slug: 'sql', no: 3, judul: 'Mesin SQL', ringkas: 'Jalankan SQL sungguhan atas data praktikum, lengkap dengan rencana eksekusinya.', topik: [14] },
  { slug: 'fragmentasi', no: 4, judul: 'Perancang Fragmentasi', ringkas: 'Horizontal, vertikal, turunan, campuran — dengan audit kelengkapan, rekonstruksi, dan kedisjoinan.', topik: [4, 5] },
  { slug: 'alokasi', no: 5, judul: 'Alokasi & Replikasi', ringkas: 'Model biaya empat kelompok informasi, pencarian alokasi optimal, dan hitungan ketersediaan.', topik: [2, 5] },
  { slug: 'dekomposisi', no: 6, judul: 'Dekomposisi Kueri', ringkas: 'Normalisasi CNF/DNF, analisis graf kueri, eliminasi redundansi, dan pohon operator.', topik: [14] },
  { slug: 'lokalisasi', no: 7, judul: 'Lokalisasi Data', ringkas: 'Program lokalisasi dan reduksi fragmen, diverifikasi terhadap hasil kueri global.', topik: [14] },
  { slug: 'transparansi', no: 8, judul: 'Tangga Transparansi', ringkas: 'Satu kueri ditulis ulang pada lima tingkat transparansi, dengan ukuran kebocoran detailnya.', topik: [6, 7] },
  { slug: 'join', no: 9, judul: 'Join Terdistribusi', ringkas: 'Kirim utuh, semijoin, dan bloom join dijalankan sungguhan lalu dibandingkan biayanya.', topik: [14] },
  { slug: 'konkurensi', no: 10, judul: 'Kendali Konkurensi', ringkas: 'Graf presedensi, 2PL, timestamp ordering, dan sifat pemulihan sebuah jadwal.', topik: [9, 10] },
  { slug: 'deadlock', no: 11, judul: 'Manajemen Deadlock', ringkas: 'Deteksi terpusat, path pushing, edge chasing, deadlock semu, dan pencegahan cap waktu.', topik: [11] },
  { slug: 'duafase', no: 12, judul: 'Simulator 2PC & 3PC', ringkas: 'Injeksi kegagalan koordinator, peserta, dan partisi jaringan — lalu lihat siapa yang terblokir.', topik: [12, 13] },
  { slug: 'ketersediaan', no: 13, judul: 'Ketersediaan & CAP', ringkas: 'MTBF/MTTR, ketersediaan replika, kuorum R+W>N, CAP dan PACELC, RTO dan RPO.', topik: [1, 8, 13] },
  { slug: 'oracle', no: 14, judul: 'Generator DDL Oracle', ringkas: 'Rancangan terdistribusi diterjemahkan menjadi partisi, database link, dan materialized view.', topik: [5, 6, 12] },
  { slug: 'soal', no: 15, judul: 'Bank Soal Praktikum', ringkas: '32 soal Praktikum 2–5, termasuk ke-12 soal Praktikum 3, dinilai otomatis dengan membandingkan hasil kueri.', topik: [14] },
  { slug: 'kependudukan', no: 16, judul: 'Studi Kasus Kependudukan', ringkas: 'Skripsi Oracle XE + MySQL lewat ODBC: NIK ganda yang lolos UNIQUE lokal, dan mengapa gateway tidak bisa 2PC.', topik: [1, 7, 12] },
];

export const PRAKTIKUM = [
  { no: 1, judul: 'Membuat ERD', isi: 'Kasus rental mobil Tono: empat entitas, tiga relasi, lengkap dengan kunci utama dan kunci asing.', lab: 'erd' },
  { no: 2, judul: 'SQL dan DML', isi: 'Enam tabel basis data rumah sakit: pasien, dokter, administrator, pasien_dokter, dokter_admin, daftar.', lab: 'sql' },
  { no: 3, judul: 'Fungsi Agregasi', isi: 'AVG, COUNT, MAX, MIN, SUM beserta seluruh operator klausa WHERE.', lab: 'sql' },
  { no: 4, judul: 'Query dari Relasi Tabel', isi: 'Kueri lintas tabel mhs, mata_kuliah, dan nilai lewat kunci penghubung.', lab: 'sql' },
  { no: 5, judul: 'Relasi Tabel dengan JOIN', isi: 'Inner join, left join, right join, full outer join, dan union.', lab: 'sql' },
];
