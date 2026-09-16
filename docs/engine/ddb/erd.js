// erd.js — konversi Entity Relationship Diagram menjadi skema relasional.
// Menutup Praktikum 1 (Membuat ERD) dan menjadi pintu masuk Praktikum 2 (SQL & DML).
//
// Aturan transformasi yang dipakai (Connolly & Begg bab 16-17):
//   1:1  -> kunci salah satu entitas ditanam sebagai foreign key di entitas lain
//   1:N  -> kunci sisi "1" ditanam sebagai foreign key di sisi "N"
//   N:M  -> relasi menjadi tabel penghubung dengan kunci gabungan
//   atribut multinilai -> tabel tersendiri (syarat 1NF)
//   entitas lemah        -> kunci entitas kuat menjadi bagian kunci gabungan

/**
 * @typedef {{nama:string, pk:string, atribut:string[], lemah?:boolean, induk?:string,
 *            multinilai?:string[]}} Entitas
 * @typedef {{dari:string, ke:string, nama:string, kardinalitas:'1:1'|'1:N'|'N:1'|'N:M',
 *            atribut?:string[], wajib?:boolean}} Relasi
 */

/** Periksa kesehatan ERD sebelum dikonversi. */
export function validateERD({ entitas, relasi }) {
  const masalah = [];
  const nama = new Set();
  for (const e of entitas) {
    if (!e.pk) masalah.push({ tingkat: 'galat', pesan: `Entitas ${e.nama} tidak punya primary key` });
    if (e.pk && !e.atribut.includes(e.pk)) masalah.push({ tingkat: 'galat', pesan: `Primary key "${e.pk}" tidak terdaftar pada atribut ${e.nama}` });
    if (nama.has(e.nama)) masalah.push({ tingkat: 'galat', pesan: `Nama entitas ganda: ${e.nama}` });
    nama.add(e.nama);
    if (e.lemah && !e.induk) masalah.push({ tingkat: 'galat', pesan: `Entitas lemah ${e.nama} harus menyebut entitas induknya` });
    const dup = e.atribut.find((a, i) => e.atribut.indexOf(a) !== i);
    if (dup) masalah.push({ tingkat: 'galat', pesan: `Atribut ganda "${dup}" pada ${e.nama}` });
  }
  for (const r of relasi) {
    if (!nama.has(r.dari)) masalah.push({ tingkat: 'galat', pesan: `Relasi "${r.nama}" merujuk entitas "${r.dari}" yang tidak ada` });
    if (!nama.has(r.ke)) masalah.push({ tingkat: 'galat', pesan: `Relasi "${r.nama}" merujuk entitas "${r.ke}" yang tidak ada` });
    if (!['1:1', '1:N', 'N:1', 'N:M'].includes(r.kardinalitas)) masalah.push({ tingkat: 'galat', pesan: `Kardinalitas "${r.kardinalitas}" pada relasi "${r.nama}" tidak dikenal` });
  }
  const terhubung = new Set(relasi.flatMap((r) => [r.dari, r.ke]));
  for (const e of entitas) if (!terhubung.has(e.nama) && entitas.length > 1) {
    masalah.push({ tingkat: 'peringatan', pesan: `Entitas ${e.nama} tidak terhubung ke entitas mana pun` });
  }
  return { valid: masalah.every((m) => m.tingkat !== 'galat'), masalah };
}

/** Konversi ERD -> daftar tabel relasional lengkap dengan kunci dan foreign key. */
export function erdToSchema({ entitas, relasi }) {
  const cek = validateERD({ entitas, relasi });
  if (!cek.valid) throw new Error(`ERD belum sah: ${cek.masalah.filter((m) => m.tingkat === 'galat').map((m) => m.pesan).join('; ')}`);

  const tabel = new Map();
  const jejak = [];

  for (const e of entitas) {
    const kolom = e.atribut.filter((a) => !(e.multinilai || []).includes(a));
    const pk = [e.pk];
    if (e.lemah && e.induk) {
      const induk = entitas.find((x) => x.nama === e.induk);
      if (induk && !kolom.includes(induk.pk)) kolom.unshift(induk.pk);
      if (induk) pk.unshift(induk.pk);
      jejak.push(`Entitas lemah ${e.nama}: kunci induk ${e.induk}.${induk?.pk} ikut menjadi bagian primary key gabungan.`);
    }
    tabel.set(e.nama, {
      nama: e.nama,
      kolom,
      pk,
      fk: e.lemah && e.induk ? [{ cols: [entitas.find((x) => x.nama === e.induk).pk], ref: e.induk, refCols: [entitas.find((x) => x.nama === e.induk).pk] }] : [],
      asal: 'entitas',
    });
    jejak.push(`Entitas ${e.nama} -> tabel ${e.nama}(${kolom.join(', ')}) dengan PK ${pk.join(', ')}.`);

    for (const mv of e.multinilai || []) {
      const n = `${e.nama}_${mv}`;
      tabel.set(n, { nama: n, kolom: [e.pk, mv], pk: [e.pk, mv], fk: [{ cols: [e.pk], ref: e.nama, refCols: [e.pk] }], asal: 'atribut multinilai' });
      jejak.push(`Atribut multinilai ${e.nama}.${mv} -> tabel ${n}. Tanpa ini tabel ${e.nama} melanggar 1NF.`);
    }
  }

  for (const r of relasi) {
    const A = entitas.find((x) => x.nama === r.dari);
    const B = entitas.find((x) => x.nama === r.ke);
    if (r.kardinalitas === 'N:M') {
      const n = r.nama.toUpperCase().replace(/\s+/g, '_');
      tabel.set(n, {
        nama: n,
        kolom: [A.pk, B.pk, ...(r.atribut || [])],
        pk: [A.pk, B.pk],
        fk: [
          { cols: [A.pk], ref: A.nama, refCols: [A.pk] },
          { cols: [B.pk], ref: B.nama, refCols: [B.pk] },
        ],
        asal: 'relasi N:M',
      });
      jejak.push(`Relasi N:M "${r.nama}" -> tabel penghubung ${n} dengan kunci gabungan (${A.pk}, ${B.pk}).`);
      continue;
    }
    if (r.kardinalitas === '1:N' || r.kardinalitas === 'N:1') {
      const satu = r.kardinalitas === '1:N' ? A : B;
      const banyak = r.kardinalitas === '1:N' ? B : A;
      const t = tabel.get(banyak.nama);
      if (!t.kolom.includes(satu.pk)) t.kolom.push(satu.pk);
      t.fk.push({ cols: [satu.pk], ref: satu.nama, refCols: [satu.pk], wajib: r.wajib !== false });
      if (r.atribut?.length) {
        for (const a of r.atribut) if (!t.kolom.includes(a)) t.kolom.push(a);
        jejak.push(`Atribut relasi "${r.nama}" (${r.atribut.join(', ')}) ikut ditanam di ${banyak.nama}.`);
      }
      jejak.push(`Relasi ${r.kardinalitas} "${r.nama}" -> ${satu.pk} menjadi foreign key di tabel ${banyak.nama} (sisi "banyak").`);
      continue;
    }
    // 1:1 -> tanam pada sisi yang partisipasinya wajib agar tidak banyak NULL
    const target = r.wajib === false ? A : B;
    const sumber = target === A ? B : A;
    const t = tabel.get(target.nama);
    if (!t.kolom.includes(sumber.pk)) t.kolom.push(sumber.pk);
    t.fk.push({ cols: [sumber.pk], ref: sumber.nama, refCols: [sumber.pk], unik: true });
    jejak.push(`Relasi 1:1 "${r.nama}" -> ${sumber.pk} ditanam sebagai foreign key UNIQUE di ${target.nama} (sisi partisipasi wajib, supaya NULL paling sedikit).`);
  }

  return { tabel: [...tabel.values()], jejak, peringatan: cek.masalah.filter((m) => m.tingkat === 'peringatan') };
}

/** Skema hasil konversi -> DDL Oracle. */
export function schemaToOracle(skema, { tipe = {} } = {}) {
  const urut = urutkanMenurutKetergantungan(skema.tabel);
  const out = [];
  for (const t of urut) {
    const kolom = t.kolom.map((k) => `  ${k.toUpperCase().padEnd(20)} ${tipe[k] || tebakTipe(k)}${t.pk.includes(k) ? ' NOT NULL' : ''}`);
    const kendala = [`  CONSTRAINT PK_${t.nama.toUpperCase()} PRIMARY KEY (${t.pk.map((x) => x.toUpperCase()).join(', ')})`];
    t.fk.forEach((f, i) => {
      kendala.push(`  CONSTRAINT FK_${t.nama.toUpperCase()}_${i + 1} FOREIGN KEY (${f.cols.map((x) => x.toUpperCase()).join(', ')}) REFERENCES ${f.ref.toUpperCase()} (${f.refCols.map((x) => x.toUpperCase()).join(', ')}) ON DELETE CASCADE`);
      if (f.unik) kendala.push(`  CONSTRAINT UQ_${t.nama.toUpperCase()}_${i + 1} UNIQUE (${f.cols.map((x) => x.toUpperCase()).join(', ')})`);
    });
    out.push(`-- ${t.asal}\nCREATE TABLE ${t.nama.toUpperCase()} (\n${[...kolom, ...kendala].join(',\n')}\n);`);
  }
  return out.join('\n\n');
}

function tebakTipe(nama) {
  if (/^(no_ktp|npwp|no_tlp|no_hp|nik)$/i.test(nama)) return 'VARCHAR2(20)';
  if (/^(id|kode|no)_|_(id|kode)$|^id$/i.test(nama)) return 'VARCHAR2(20)';
  if (/tgl|tanggal|waktu|date/i.test(nama)) return 'DATE';
  if (/^tahun/i.test(nama)) return 'NUMBER(4)';
  if (/^(sks|jumlah|umur)/i.test(nama)) return 'NUMBER(3)';
  if (/harga|denda|biaya|gaji|salary|nilai/i.test(nama)) return 'NUMBER(12,2)';
  if (/alamat|deskripsi|keterangan/i.test(nama)) return 'VARCHAR2(200)';
  return 'VARCHAR2(50)';
}

/** Urutkan tabel supaya tabel yang dirujuk dibuat lebih dulu (hindari galat FK). */
export function urutkanMenurutKetergantungan(tabel) {
  const peta = new Map(tabel.map((t) => [t.nama, t]));
  const hasil = [];
  const status = new Map();
  const kunjungi = (t, jalur = []) => {
    if (status.get(t.nama) === 'selesai') return;
    if (status.get(t.nama) === 'proses') {
      // Siklus referensi: tabel saling merujuk. Putus rekursinya di sini —
      // tabel ini akan tetap dimasukkan oleh pemanggilnya sendiri saat selesai,
      // jadi jangan didorong dua kali. Salah satu FK-nya perlu ditambahkan
      // belakangan lewat ALTER TABLE.
      return;
    }
    status.set(t.nama, 'proses');
    for (const f of t.fk) {
      const ref = peta.get(f.ref);
      if (ref && ref !== t) kunjungi(ref, [...jalur, t.nama]);
    }
    status.set(t.nama, 'selesai');
    hasil.push(t);
  };
  for (const t of tabel) kunjungi(t);
  return hasil;
}

/** Gambar ERD sebagai teks ASCII sederhana untuk laporan. */
export function erdToText({ entitas, relasi }) {
  const baris = ['ENTITAS', '-------'];
  for (const e of entitas) {
    baris.push(`${e.nama}${e.lemah ? ' (lemah)' : ''}`);
    for (const a of e.atribut) {
      const tanda = a === e.pk ? ' [PK]' : (e.multinilai || []).includes(a) ? ' [multinilai]' : '';
      baris.push(`  - ${a}${tanda}`);
    }
  }
  baris.push('', 'RELASI', '------');
  for (const r of relasi) baris.push(`${r.dari} --< ${r.nama} >-- ${r.ke}   [${r.kardinalitas}]${r.atribut?.length ? ` atribut: ${r.atribut.join(', ')}` : ''}`);
  return baris.join('\n');
}

/** Sintaks Mermaid erDiagram — bisa dirender langsung di peramban dan di GitHub. */
export function erdToMermaid({ entitas, relasi }) {
  const baris = ['erDiagram'];
  const kard = { '1:1': '||--||', '1:N': '||--o{', 'N:1': '}o--||', 'N:M': '}o--o{' };
  for (const r of relasi) {
    baris.push(`    ${r.dari} ${kard[r.kardinalitas]} ${r.ke} : "${r.nama}"`);
  }
  for (const e of entitas) {
    baris.push(`    ${e.nama} {`);
    for (const a of e.atribut) baris.push(`        string ${a}${a === e.pk ? ' PK' : ''}`);
    baris.push('    }');
  }
  return baris.join('\n');
}
