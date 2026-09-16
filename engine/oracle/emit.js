// emit.js — penghasil DDL/DML Oracle dari rancangan basis data terdistribusi.
// Pemetaan konsep kuliah ke fitur Oracle yang benar-benar ada:
//
//   Fragmentasi horizontal  -> PARTITION BY LIST / RANGE / HASH
//   Fragmentasi turunan     -> PARTITION BY REFERENCE (khas Oracle)
//   Fragmentasi vertikal    -> tabel terpisah + VIEW perekat atas kunci
//   Alokasi ke situs        -> TABLESPACE per partisi
//   Replikasi               -> MATERIALIZED VIEW + MATERIALIZED VIEW LOG
//   Transparansi lokasi     -> DATABASE LINK + SYNONYM + VIEW
//   Transaksi terdistribusi -> 2PC bawaan Oracle, DBA_2PC_PENDING, COMMIT FORCE
//
// Semua keluaran berupa teks; tidak ada koneksi basis data yang dibuka.

const ORACLE_RESERVED = new Set([
  'ACCESS', 'ADD', 'ALL', 'ALTER', 'AND', 'ANY', 'AS', 'ASC', 'AUDIT', 'BETWEEN', 'BY', 'CHAR', 'CHECK',
  'CLUSTER', 'COLUMN', 'COMMENT', 'COMPRESS', 'CONNECT', 'CREATE', 'CURRENT', 'DATE', 'DECIMAL', 'DEFAULT',
  'DELETE', 'DESC', 'DISTINCT', 'DROP', 'ELSE', 'EXCLUSIVE', 'EXISTS', 'FILE', 'FLOAT', 'FOR', 'FROM',
  'GRANT', 'GROUP', 'HAVING', 'IDENTIFIED', 'IMMEDIATE', 'IN', 'INCREMENT', 'INDEX', 'INITIAL', 'INSERT',
  'INTEGER', 'INTERSECT', 'INTO', 'IS', 'LEVEL', 'LIKE', 'LOCK', 'LONG', 'MAXEXTENTS', 'MINUS', 'MLSLABEL',
  'MODE', 'MODIFY', 'NOAUDIT', 'NOCOMPRESS', 'NOT', 'NOWAIT', 'NULL', 'NUMBER', 'OF', 'OFFLINE', 'ON',
  'ONLINE', 'OPTION', 'OR', 'ORDER', 'PCTFREE', 'PRIOR', 'PUBLIC', 'RAW', 'RENAME', 'RESOURCE', 'REVOKE',
  'ROW', 'ROWID', 'ROWNUM', 'ROWS', 'SELECT', 'SESSION', 'SET', 'SHARE', 'SIZE', 'SMALLINT', 'START',
  'SUCCESSFUL', 'SYNONYM', 'SYSDATE', 'TABLE', 'THEN', 'TO', 'TRIGGER', 'UID', 'UNION', 'UNIQUE', 'UPDATE',
  'USER', 'VALIDATE', 'VALUES', 'VARCHAR', 'VARCHAR2', 'VIEW', 'WHENEVER', 'WHERE', 'WITH',
]);

/** Identifier Oracle: maksimal 128 karakter (12.2+), huruf besar, hindari kata kunci. */
export function ident(name) {
  const s = String(name).trim();
  const up = s.toUpperCase();
  if (s.length > 128) throw new Error(`Nama "${s}" melebihi 128 karakter — batas identifier Oracle`);
  if (ORACLE_RESERVED.has(up) || !/^[A-Za-z][A-Za-z0-9_$#]*$/.test(s)) return `"${up}"`;
  return up;
}

export function literal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return `DATE '${v}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Terka tipe kolom Oracle dari contoh nilai. */
export function inferType(values, nama = '') {
  const bersih = values.filter((v) => v !== null && v !== undefined && v !== '');
  const lebar = bersih.length ? Math.max(...bersih.map((v) => String(v).length)) : 0;
  const teks = () => {
    const n = lebar <= 2 ? Math.max(lebar, 1) : Math.min(4000, Math.ceil((lebar * 1.4) / 10) * 10);
    return `VARCHAR2(${n})`;
  };
  if (bersih.length === 0) return 'VARCHAR2(100)';

  // Kolom identitas (nomor telepon, NIK, NPWP, kode pos) TIDAK boleh jadi NUMBER:
  // nolnya di depan akan hilang dan nilainya tidak pernah dihitung secara aritmetika.
  if (/no_hp|no_tlp|telepon|phone|hp$|nik|npwp|ktp|kode_?pos|postcode|rekening/i.test(nama)) {
    return `VARCHAR2(${Math.max(20, lebar)})`;
  }
  if (bersih.some((v) => typeof v === 'string' && /^0\d+$/.test(v))) return teks();

  if (bersih.every((v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v)))) return 'DATE';
  if (bersih.every((v) => typeof v === 'number' ? Number.isInteger(v) : /^-?\d+$/.test(String(v)))) {
    const maks = Math.max(...bersih.map((v) => String(Math.abs(Number(v))).length));
    return `NUMBER(${Math.max(maks, 1)})`;
  }
  if (bersih.every((v) => typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v)))) return 'NUMBER(12,2)';
  return teks();
}

// --------------------------------------------------------------- CREATE TABLE

/**
 * @param {import('../core/relation.js').Relation} rel
 * @param {{pk?:string[], fk?:Array<{cols:string[],ref:string,refCols:string[],onDelete?:string}>,
 *          notNull?:string[], tablespace?:string, partisi?:object}} opsi
 */
export function createTable(rel, opsi = {}) {
  const kolom = rel.attrs.map((a, i) => {
    const t = opsi.tipe?.[a] || inferType(rel.rows.map((r) => r[i]), a);
    const nn = (opsi.pk || []).includes(a) || (opsi.notNull || []).includes(a) ? ' NOT NULL' : '';
    return `  ${ident(a).padEnd(22)} ${t}${nn}`;
  });
  const kendala = [];
  if (opsi.pk?.length) kendala.push(`  CONSTRAINT ${ident(`PK_${rel.name}`)} PRIMARY KEY (${opsi.pk.map(ident).join(', ')})`);
  for (const fk of opsi.fk || []) {
    kendala.push(`  CONSTRAINT ${ident(`FK_${rel.name}_${fk.ref}`)} FOREIGN KEY (${fk.cols.map(ident).join(', ')})\n    REFERENCES ${ident(fk.ref)} (${fk.refCols.map(ident).join(', ')})${fk.onDelete ? ` ON DELETE ${fk.onDelete}` : ''}`);
  }
  for (const ck of opsi.check || []) kendala.push(`  CONSTRAINT ${ident(ck.nama)} CHECK (${ck.ekspresi})`);
  const isi = [...kolom, ...kendala].join(',\n');
  const ts = opsi.tablespace ? `\nTABLESPACE ${ident(opsi.tablespace)}` : '';
  const part = opsi.partisi ? `\n${partitionClause(opsi.partisi)}` : '';
  return `CREATE TABLE ${ident(rel.name)} (\n${isi}\n)${ts}${part};`;
}

/** Klausa partisi = fragmentasi horizontal yang dijalankan mesin basis data. */
export function partitionClause(p) {
  if (p.tipe === 'LIST') {
    const bagian = p.partisi.map((x) => `  PARTITION ${ident(x.nama)} VALUES (${x.nilai.map(literal).join(', ')})${x.tablespace ? ` TABLESPACE ${ident(x.tablespace)}` : ''}`);
    if (p.default) bagian.push(`  PARTITION ${ident(p.default)} VALUES (DEFAULT)`);
    return `PARTITION BY LIST (${ident(p.kolom)}) (\n${bagian.join(',\n')}\n)`;
  }
  if (p.tipe === 'RANGE') {
    const bagian = p.partisi.map((x) => `  PARTITION ${ident(x.nama)} VALUES LESS THAN (${literal(x.batas)})${x.tablespace ? ` TABLESPACE ${ident(x.tablespace)}` : ''}`);
    bagian.push(`  PARTITION ${ident(p.maxvalue || `${p.kolom}_MAX`)} VALUES LESS THAN (MAXVALUE)`);
    return `PARTITION BY RANGE (${ident(p.kolom)}) (\n${bagian.join(',\n')}\n)`;
  }
  if (p.tipe === 'HASH') {
    return `PARTITION BY HASH (${ident(p.kolom)})\n  PARTITIONS ${p.jumlah}${p.tablespaces ? `\n  STORE IN (${p.tablespaces.map(ident).join(', ')})` : ''}`;
  }
  if (p.tipe === 'REFERENCE') {
    return `PARTITION BY REFERENCE (${ident(p.constraint)})`;
  }
  if (p.tipe === 'INTERVAL') {
    return `PARTITION BY RANGE (${ident(p.kolom)})\n  INTERVAL (${p.interval}) (\n  PARTITION ${ident(p.awal.nama)} VALUES LESS THAN (${literal(p.awal.batas)})\n)`;
  }
  throw new Error(`partitionClause: tipe "${p.tipe}" tidak dikenal (LIST/RANGE/HASH/REFERENCE/INTERVAL)`);
}

/**
 * Fragmentasi horizontal -> tabel terpartisi LIST.
 * Satu partisi per fragmen, tiap partisi diarahkan ke tablespace situsnya.
 */
export function horizontalAsPartitions(rel, kolom, petaFragmen, opsi = {}) {
  const partisi = {
    tipe: 'LIST',
    kolom,
    partisi: petaFragmen.map((f) => ({ nama: f.nama, nilai: f.nilai, tablespace: f.tablespace || (f.situs ? `TS_${f.situs}` : null) })),
    default: opsi.default || `P_${rel.name}_LAIN`,
  };
  return createTable(rel, { ...opsi, partisi });
}

/** Fragmentasi turunan -> reference partitioning: anak ikut partisi induknya. */
export function derivedAsReferencePartition(relAnak, namaConstraintFk, opsi = {}) {
  return createTable(relAnak, { ...opsi, partisi: { tipe: 'REFERENCE', constraint: namaConstraintFk } });
}

/**
 * Fragmentasi vertikal -> tabel-tabel terpisah + VIEW perekat.
 * Setiap tabel wajib memuat kunci, persis syarat lossless-join pada Modul 7.
 */
export function verticalAsTables(rel, grup, kunci, opsi = {}) {
  const keys = Array.isArray(kunci) ? kunci : [kunci];
  const bagian = grup.map((g) => {
    const attrs = [...keys, ...g.atribut.filter((a) => !keys.includes(a))];
    const sub = { name: g.nama, attrs, rows: rel.rows.map((r) => attrs.map((a) => r[rel.indexOf(a)])), indexOf: (a) => attrs.indexOf(a) };
    const pk = g.nama === grup[0].nama ? keys : keys;
    const fk = g.nama === grup[0].nama ? [] : [{ cols: keys, ref: grup[0].nama, refCols: keys, onDelete: 'CASCADE' }];
    return createTable(sub, { ...opsi, pk, fk, tablespace: g.tablespace || (g.situs ? `TS_${g.situs}` : null) });
  });
  const kolomSemua = [];
  for (const g of grup) for (const a of g.atribut) if (!kolomSemua.includes(a) && !keys.includes(a)) kolomSemua.push(a);
  const view = [
    `-- VIEW perekat: mengembalikan relasi global dari fragmen-fragmen vertikal.`,
    `-- Inilah "program lokalisasi" untuk fragmentasi vertikal: R = F1 JOIN F2 ... atas kunci.`,
    `CREATE OR REPLACE VIEW ${ident(rel.name)} AS`,
    `SELECT ${keys.map((k) => `${ident(grup[0].nama)}.${ident(k)}`).join(', ')},`,
    `       ${kolomSemua.map((a) => {
      const g = grup.find((x) => x.atribut.includes(a));
      return `${ident(g.nama)}.${ident(a)}`;
    }).join(',\n       ')}`,
    `  FROM ${ident(grup[0].nama)}`,
    ...grup.slice(1).map((g, i) => {
      const on = keys.map((k) => `${ident(grup[0].nama)}.${ident(k)} = ${ident(g.nama)}.${ident(k)}`).join(' AND ');
      return `  JOIN ${ident(g.nama)} ON ${on}${i === grup.length - 2 ? ';' : ''}`;
    }),
  ].join('\n');
  return { tabel: bagian, view, sql: `${bagian.join('\n\n')}\n\n${view}` };
}

// ------------------------------------------------------ database link & sinonim

export function createDatabaseLink({ nama, user, password = null, tns, publik = false }) {
  const baris = [
    `-- Database link: jalur akses ke basis data pada situs lain.`,
    `-- Tanpa link ini, tidak ada kueri terdistribusi yang bisa dijalankan Oracle.`,
    `CREATE ${publik ? 'PUBLIC ' : ''}DATABASE LINK ${ident(nama)}`,
    `  CONNECT TO ${ident(user)} IDENTIFIED BY "${password || '&sandi_situs'}"`,
    `  USING '${tns}';`,
    ``,
    `-- Uji sambungan:`,
    `SELECT SYSDATE FROM dual@${ident(nama)};`,
  ];
  return baris.join('\n');
}

/**
 * Transparansi lokasi lewat sinonim: aplikasi menulis FROM PASIEN,
 * Oracle yang menerjemahkan ke PASIEN@SITUS_BANDUNG.
 */
export function locationTransparencySynonyms(daftar) {
  const baris = [
    '-- Transparansi lokasi tingkat DDBMS: aplikasi cukup menyebut nama objek,',
    '-- letak fisiknya disembunyikan oleh sinonim. Pindah situs = ubah sinonim,',
    '-- aplikasi tidak perlu disentuh sama sekali.',
    '',
  ];
  for (const d of daftar) {
    baris.push(`CREATE OR REPLACE ${d.publik ? 'PUBLIC ' : ''}SYNONYM ${ident(d.alias)} FOR ${ident(d.objek)}${d.link ? `@${ident(d.link)}` : ''};`);
  }
  return baris.join('\n');
}

/** VIEW UNION ALL lintas situs = program lokalisasi untuk fragmentasi horizontal. */
export function unionAllView(namaGlobal, bagian) {
  const baris = [
    `-- Program lokalisasi fragmentasi horizontal: R = F1 UNION ALL F2 UNION ALL ...`,
    `-- Oracle memangkas cabang yang predikatnya bertentangan dengan WHERE kueri`,
    `-- (partition pruning / predicate pushdown) — inilah reduksi yang dibahas di Modul 7.`,
    `CREATE OR REPLACE VIEW ${ident(namaGlobal)} AS`,
  ];
  bagian.forEach((b, i) => {
    baris.push(`${i > 0 ? 'UNION ALL\n' : ''}SELECT * FROM ${ident(b.objek)}${b.link ? `@${ident(b.link)}` : ''}${b.predikat ? ` WHERE ${b.predikat}` : ''}`);
  });
  baris.push(';');
  return baris.join('\n');
}

// ------------------------------------------------------------ replikasi (MV)

/**
 * Replikasi Oracle = materialized view. REFRESH FAST butuh MV log di sumber.
 * ON COMMIT = sinkron (RPO 0, latensi naik); ON DEMAND = asinkron (RPO > 0).
 */
export function materializedView({ nama, sumber, link = null, kunci, refresh = 'FAST', jadwal = 'ON DEMAND', interval = 'SYSDATE + 1/24', predikat = null, tablespace = null }) {
  const baris = [
    `-- MV log di situs sumber: mencatat perubahan agar refresh cepat (FAST) mungkin.`,
    `CREATE MATERIALIZED VIEW LOG ON ${ident(sumber)}${link ? `@${ident(link)}` : ''}`,
    `  WITH PRIMARY KEY, ROWID, SEQUENCE INCLUDING NEW VALUES;`,
    ``,
    `-- Replika (salinan) di situs tujuan.`,
    `CREATE MATERIALIZED VIEW ${ident(nama)}`,
    tablespace ? `  TABLESPACE ${ident(tablespace)}` : null,
    `  BUILD IMMEDIATE`,
    `  REFRESH ${refresh} ${jadwal}${jadwal === 'START WITH' ? ` SYSDATE NEXT ${interval}` : ''}`,
    `  WITH PRIMARY KEY`,
    `  ENABLE QUERY REWRITE`,
    `AS SELECT * FROM ${ident(sumber)}${link ? `@${ident(link)}` : ''}${predikat ? ` WHERE ${predikat}` : ''};`,
    ``,
    `-- Segarkan manual:`,
    `EXEC DBMS_MVIEW.REFRESH('${String(nama).toUpperCase()}', '${refresh === 'FAST' ? 'F' : 'C'}');`,
    ``,
    `-- Periksa apakah FAST REFRESH memang bisa dipakai:`,
    `EXEC DBMS_MVIEW.EXPLAIN_MVIEW('${String(nama).toUpperCase()}');`,
    `SELECT capability_name, possible, msgtxt FROM mv_capabilities_table`,
    ` WHERE capability_name LIKE 'REFRESH_FAST%';`,
  ].filter((x) => x !== null);
  void kunci;
  return baris.join('\n');
}

/** Refresh group: beberapa MV disegarkan dalam satu transaksi agar tetap konsisten. */
export function refreshGroup(nama, daftarMv, interval = 'SYSDATE + 1/24') {
  return [
    `-- Refresh group menjaga konsistensi antar replika: seluruh MV di bawah ini`,
    `-- disegarkan dalam SATU transaksi, jadi tidak ada keadaan setengah jadi.`,
    `BEGIN`,
    `  DBMS_REFRESH.MAKE(`,
    `    name        => '${String(nama).toUpperCase()}',`,
    `    list        => '${daftarMv.map((m) => String(m).toUpperCase()).join(',')}',`,
    `    next_date   => SYSDATE,`,
    `    interval    => '${interval}',`,
    `    implicit_destroy => FALSE);`,
    `END;`,
    `/`,
    ``,
    `EXEC DBMS_REFRESH.REFRESH('${String(nama).toUpperCase()}');`,
  ].join('\n');
}

// ------------------------------------------------- transaksi & diagnosa 2PC

export function distributedTransaction({ situs, operasi, namaTransaksi = 'TRX_LINTAS_SITUS' }) {
  const baris = [
    `-- Transaksi terdistribusi. Oracle menjalankan two-phase commit SECARA OTOMATIS`,
    `-- begitu satu transaksi menyentuh lebih dari satu basis data lewat database link.`,
    `-- Tidak ada perintah khusus: cukup COMMIT.`,
    ``,
    `SET TRANSACTION NAME '${namaTransaksi}';`,
    ``,
  ];
  operasi.forEach((o) => {
    baris.push(`-- situs ${o.situs}`);
    baris.push(o.sql.trim().endsWith(';') ? o.sql.trim() : `${o.sql.trim()};`);
    baris.push('');
  });
  baris.push(`-- Satu COMMIT ini memicu PREPARE ke ${situs.length} situs, lalu COMMIT global.`);
  baris.push('COMMIT;');
  baris.push('');
  baris.push('-- Menunjuk situs commit point (paling tepercaya / paling jarang mati):');
  baris.push('-- ALTER SESSION SET COMMIT_POINT_STRENGTH = 200;  (parameter tingkat instans)');
  return baris.join('\n');
}

export function twoPhaseDiagnostics() {
  return [
    '-- Transaksi terdistribusi yang menggantung (in-doubt):',
    'SELECT local_tran_id, global_tran_id, state, mixed, advice, host, commit#',
    '  FROM dba_2pc_pending',
    ' ORDER BY fail_time;',
    '',
    '-- Sisi mana yang belum menjawab:',
    'SELECT local_tran_id, in_out, database, dbuser_owner, interface, dbid',
    '  FROM dba_2pc_neighbors;',
    '',
    '-- Kunci yang tertahan gara-gara transaksi in-doubt:',
    'SELECT s.sid, s.serial#, s.username, l.type, l.id1, l.id2, l.lmode, l.request',
    '  FROM v$lock l JOIN v$session s ON s.sid = l.sid',
    " WHERE l.type IN ('TX','TM') AND l.request > 0;",
    '',
    '-- Deadlock: Oracle mendeteksi sendiri dan melempar ORA-00060 ke salah satu sesi.',
    '-- Rinciannya ada di trace file yang ditunjuk:',
    "SELECT value FROM v$diag_info WHERE name = 'Default Trace File';",
    '',
    '-- Paksa keputusan HANYA bila keputusan koordinator sudah dipastikan:',
    "-- COMMIT FORCE '<local_tran_id>';",
    "-- ROLLBACK FORCE '<local_tran_id>';",
    "-- EXEC DBMS_TRANSACTION.PURGE_LOST_DB_ENTRY('<local_tran_id>');",
  ].join('\n');
}

// -------------------------------------------------------------- rencana kueri

export function explainPlan(sql, { nama = 'rencana_1' } = {}) {
  return [
    `EXPLAIN PLAN SET STATEMENT_ID = '${nama}' FOR`,
    sql.trim().replace(/;\s*$/, ''),
    ';',
    '',
    `SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, '${nama}', 'ALL +PARTITION +REMOTE'));`,
    '',
    '-- Kolom yang perlu dibaca:',
    '--   PSTART/PSTOP  -> partisi mana yang benar-benar disentuh (bukti partition pruning)',
    '--   OPERATION REMOTE -> bagian kueri yang dikirim ke situs lain',
    "--   Other-nya berisi SQL yang sesungguhnya dijalankan di situs jauh",
    '',
    '-- Rencana yang BENAR-BENAR dipakai (bukan perkiraan):',
    "SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST +PARTITION'));",
  ].join('\n');
}

/** Indeks lokal vs global pada tabel terpartisi. */
export function partitionedIndexes(tabel, { lokal = [], global = [] }) {
  const baris = [
    '-- Indeks LOCAL: satu segmen indeks per partisi. Operasi partisi (DROP/EXCHANGE)',
    '-- tidak membuat indeks partisi lain invalid. Pilihan default untuk fragmentasi.',
  ];
  for (const i of lokal) baris.push(`CREATE INDEX ${ident(i.nama)} ON ${ident(tabel)} (${i.kolom.map(ident).join(', ')}) LOCAL;`);
  baris.push('');
  baris.push('-- Indeks GLOBAL: satu pohon indeks untuk seluruh tabel. Lebih cepat untuk');
  baris.push('-- pencarian lintas partisi, tetapi operasi partisi membuatnya UNUSABLE');
  baris.push('-- kecuali dipakai UPDATE INDEXES.');
  for (const i of global) baris.push(`CREATE INDEX ${ident(i.nama)} ON ${ident(tabel)} (${i.kolom.map(ident).join(', ')}) GLOBAL PARTITION BY HASH (${i.kolom.map(ident)[0]}) PARTITIONS ${i.partisi || 4};`);
  return baris.join('\n');
}

/** Bukti partition pruning: kueri yang hanya menyentuh satu partisi. */
export function pruningProof(tabel, kolom, nilai) {
  return [
    `-- Reduksi fragmentasi horizontal versi Oracle: kueri di bawah HANYA menyentuh`,
    `-- satu partisi. Kolom PSTART/PSTOP pada rencana eksekusi membuktikannya.`,
    `EXPLAIN PLAN FOR`,
    `SELECT * FROM ${ident(tabel)} WHERE ${ident(kolom)} = ${literal(nilai)};`,
    `SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, 'BASIC +PARTITION'));`,
    ``,
    `-- Bandingkan dengan kueri tanpa predikat partisi (menyentuh SELURUH partisi):`,
    `EXPLAIN PLAN FOR SELECT * FROM ${ident(tabel)};`,
    `SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, 'BASIC +PARTITION'));`,
    ``,
    `-- Akses langsung ke satu partisi (setara "AT SITE" pada Modul 6):`,
    `SELECT * FROM ${ident(tabel)} PARTITION (${ident(`P_${String(nilai).toUpperCase()}`)});`,
  ].join('\n');
}

/** INSERT dari relasi contoh. */
export function insertRows(rel, { batch = true } = {}) {
  if (!rel.rows.length) return `-- ${rel.name}: tidak ada baris contoh`;
  const kolom = rel.attrs.map(ident).join(', ');
  if (!batch) {
    return rel.rows.map((r) => `INSERT INTO ${ident(rel.name)} (${kolom}) VALUES (${r.map(literal).join(', ')});`).join('\n');
  }
  const baris = rel.rows.map((r) => `  INTO ${ident(rel.name)} (${kolom}) VALUES (${r.map(literal).join(', ')})`);
  return `INSERT ALL\n${baris.join('\n')}\nSELECT * FROM dual;`;
}

/** Paket lengkap: skema + fragmentasi + alokasi + replikasi + diagnosa. */
export function emitFullDesign({ relasi, kunci, fragmentasi, situs, link = [], replikasi = [] }) {
  const bagian = [];
  bagian.push(`-- =====================================================================`);
  bagian.push(`-- Rancangan basis data terdistribusi -> DDL Oracle`);
  bagian.push(`-- Dihasilkan ORACLEDECK. Jalankan per bagian, jangan sekaligus.`);
  bagian.push(`-- =====================================================================\n`);

  bagian.push(`-- 1. TABLESPACE per situs (wadah fisik alokasi fragmen)`);
  for (const s of situs) {
    bagian.push(`CREATE TABLESPACE ${ident(`TS_${s.id}`)}`);
    bagian.push(`  DATAFILE '${String(s.id).toLowerCase()}_01.dbf' SIZE 100M AUTOEXTEND ON NEXT 10M`);
    bagian.push(`  SEGMENT SPACE MANAGEMENT AUTO;  -- situs ${s.nama || s.id}`);
  }
  bagian.push('');

  if (link.length) {
    bagian.push(`-- 2. DATABASE LINK antar situs`);
    for (const l of link) bagian.push(createDatabaseLink(l));
    bagian.push('');
  }

  bagian.push(`-- 3. Tabel dan fragmentasinya`);
  bagian.push(fragmentasi.tipe === 'vertikal'
    ? verticalAsTables(relasi, fragmentasi.grup, kunci).sql
    : horizontalAsPartitions(relasi, fragmentasi.kolom, fragmentasi.partisi, { pk: Array.isArray(kunci) ? kunci : [kunci] }));
  bagian.push('');

  if (replikasi.length) {
    bagian.push(`-- 4. Replikasi`);
    for (const r of replikasi) bagian.push(materializedView(r));
    bagian.push('');
  }

  bagian.push(`-- 5. Diagnosa transaksi terdistribusi`);
  bagian.push(twoPhaseDiagnostics());
  return bagian.join('\n');
}
