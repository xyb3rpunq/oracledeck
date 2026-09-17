// uji_oracle.mjs — jalankan SELURUH skrip oracle/ pada Oracle sungguhan (container
// gvenzl/oracle-free), di situs dan sebagai pengguna yang tertulis di kepala tiap skrip.
//
//   node tools/uji_oracle.mjs              siapkan dari nol lalu jalankan semua skrip
//   node tools/uji_oracle.mjs --tanpa-reset  jangan hapus situs/pengguna lama dulu
//
// Keluaran: oracle/HASIL_UJI.md, oracle/hasil-uji.json, dan log per skrip di oracle/bukti/.
// Keluar dengan kode 1 bila ada pemeriksaan GAGAL, galat yang tidak diharapkan,
// atau galat peragaan yang dijanjikan skrip ternyata tidak muncul.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, KONFIG, siapkanKontainer, sqlplus, kodeGalat, bannerOracle, acak, layanan } from './oracle_docker.mjs';

const ORACLE = join(ROOT, 'oracle');
const BUKTI = join(ORACLE, 'bukti');
const log = (s) => process.stdout.write(`${s}\n`);

// galat pendamping yang selalu menyertai galat utama dari situs remote
const PENDAMPING = new Set(['ORA-02063']);

export function bacaKepala(isi) {
  const j = /^-- @jalankan situs=(\S+) sebagai=(\S+)/m.exec(isi);
  if (!j) return null;
  const g = /^-- @galat-diharapkan (.+)$/m.exec(isi);
  return { situs: j[1].split(','), sebagai: j[2], galat: g ? g[1].trim().split(/\s+/) : [] };
}

export function nilaiKeluaran(keluaran, kepala) {
  const lulus = [...keluaran.matchAll(/^\s*LULUS: (.+?)\s*$/gm)].map((m) => m[1]);
  const gagal = [...keluaran.matchAll(/^\s*GAGAL: (.+?)\s*$/gm)].map((m) => m[1]);
  const muncul = [...new Set(kodeGalat(keluaran))];
  const takTerduga = muncul.filter((k) => !kepala.galat.includes(k) && !PENDAMPING.has(k));
  const tidakMuncul = kepala.galat.filter((k) => !muncul.includes(k));
  return { lulus, gagal, muncul, takTerduga, tidakMuncul };
}

function reset(sandiApp) {
  log('reset: hapus PDB BANDUNG/SURABAYA, pengguna RS_APP, dan tablespace lama');
  sqlplus(`ALTER SYSTEM ENABLE DISTRIBUTED RECOVERY;
BEGIN
  FOR p IN (SELECT name FROM v$pdbs WHERE name IN ('BANDUNG', 'SURABAYA')) LOOP
    BEGIN EXECUTE IMMEDIATE 'ALTER PLUGGABLE DATABASE ' || p.name || ' CLOSE IMMEDIATE'; EXCEPTION WHEN OTHERS THEN NULL; END;
    EXECUTE IMMEDIATE 'DROP PLUGGABLE DATABASE ' || p.name || ' INCLUDING DATAFILES';
  END LOOP;
END;
/`, { situs: 'cdb', sebagai: 'sys' });
  const r = sqlplus(`BEGIN
  FOR t IN (SELECT local_tran_id, state FROM dba_2pc_pending) LOOP
    BEGIN
      IF t.state = 'prepared' THEN DBMS_TRANSACTION.ROLLBACK_FORCE(t.local_tran_id); COMMIT; END IF;
      DBMS_TRANSACTION.PURGE_LOST_DB_ENTRY(t.local_tran_id); COMMIT;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END;
/
BEGIN
  FOR u IN (SELECT username FROM dba_users WHERE username IN ('RS_APP', 'VERIF')) LOOP
    EXECUTE IMMEDIATE 'DROP USER ' || u.username || ' CASCADE';
  END LOOP;
  FOR t IN (SELECT tablespace_name FROM dba_tablespaces WHERE tablespace_name IN ('TS_JAKARTA', 'TS_BANDUNG', 'TS_SURABAYA', 'TS_VERIF')) LOOP
    EXECUTE IMMEDIATE 'DROP TABLESPACE ' || t.tablespace_name || ' INCLUDING CONTENTS AND DATAFILES';
  END LOOP;
END;
/
SELECT 'SISA=' || (SELECT COUNT(*) FROM dba_users WHERE username = 'RS_APP') AS sisa FROM dual;`, { situs: 'jakarta', sebagai: 'sys' });
  if (!/SISA=0/.test(r.keluaran)) throw new Error(`reset gagal:\n${r.keluaran}`);
  void sandiApp;
}

function main() {
  const tanpaReset = process.argv.includes('--tanpa-reset');
  siapkanKontainer({ log });
  const banner = bannerOracle();
  log(banner);
  const sandiApp = acak();
  if (!tanpaReset) reset(sandiApp);

  rmSync(BUKTI, { recursive: true, force: true });
  mkdirSync(BUKTI, { recursive: true });

  const definisiDasar = {
    sandi_rs_app: sandiApp,
    dir_data: '/opt/oracle/oradata',
    tns_jakarta: `//localhost:1521/${layanan('jakarta')}`,
    tns_bandung: `//localhost:1521/${layanan('bandung')}`,
    tns_surabaya: `//localhost:1521/${layanan('surabaya')}`,
  };

  const skrip = readdirSync(ORACLE).filter((f) => /^\d{2}[a-z]?_.*\.sql$/.test(f)).sort();
  const hasil = [];
  let adaGagal = false;
  const t0 = Date.now();

  for (const f of skrip) {
    const isi = readFileSync(join(ORACLE, f), 'utf8');
    const kepala = bacaKepala(isi);
    if (!kepala) { log(`  ? ${f}: tanpa kepala @jalankan, dilewati`); continue; }
    const catatan = { berkas: f, situs: kepala.situs, sebagai: kepala.sebagai, galatDiharapkan: kepala.galat, jalan: [] };
    let keluaranGabung = '';
    for (const situs of kepala.situs) {
      const { keluaran, ms } = sqlplus(isi, {
        situs,
        sebagai: kepala.sebagai,
        sandiApp,
        echo: true,
        definisi: { ...definisiDasar, situs: situs.toUpperCase() },
      });
      keluaranGabung += keluaran;
      const namaLog = kepala.situs.length > 1 ? f.replace(/\.sql$/, `.${situs}.log`) : f.replace(/\.sql$/, '.log');
      writeFileSync(join(BUKTI, namaLog), `-- ${f} @ ${layanan(situs)} sebagai ${kepala.sebagai}\n${keluaran.replace(/[ \t]+$/gm, '')}`);
      catatan.jalan.push({ situs, ms, log: `bukti/${namaLog}` });
    }
    const n = nilaiKeluaran(keluaranGabung, kepala);
    Object.assign(catatan, n, { status: n.gagal.length || n.takTerduga.length || n.tidakMuncul.length ? 'GAGAL' : 'LULUS' });
    if (catatan.status === 'GAGAL') adaGagal = true;
    hasil.push(catatan);
    const ms = catatan.jalan.reduce((a, j) => a + j.ms, 0);
    log(`  ${catatan.status === 'LULUS' ? '+' : 'x'} ${f.padEnd(34)} ${String(n.lulus.length).padStart(2)} cek lulus${n.gagal.length ? `, ${n.gagal.length} GAGAL` : ''}${n.takTerduga.length ? `, galat tak terduga ${n.takTerduga.join(' ')}` : ''}${n.tidakMuncul.length ? `, galat dijanjikan tidak muncul ${n.tidakMuncul.join(' ')}` : ''} (${(ms / 1000).toFixed(1)} s)`);
    for (const g of n.gagal) log(`      GAGAL: ${g}`);
  }

  const totalCek = hasil.reduce((a, h) => a + h.lulus.length, 0);
  const totalGagal = hasil.reduce((a, h) => a + h.gagal.length, 0);
  const ringkas = {
    oracle: banner,
    tanggal: new Date().toISOString().slice(0, 10),
    kontainer: KONFIG.image,
    skrip: hasil.length,
    skripLulus: hasil.filter((h) => h.status === 'LULUS').length,
    cekLulus: totalCek,
    cekGagal: totalGagal,
    durasiDetik: Math.round((Date.now() - t0) / 1000),
    hasil: hasil.map(({ berkas, situs, sebagai, status, lulus, gagal, galatDiharapkan, muncul, takTerduga, tidakMuncul, jalan }) => ({
      berkas, situs, sebagai, status, lulus, gagal, galatDiharapkan, galatMuncul: muncul, takTerduga, tidakMuncul, log: jalan.map((j) => j.log),
    })),
  };
  writeFileSync(join(ORACLE, 'hasil-uji.json'), `${JSON.stringify(ringkas, null, 2)}\n`);

  const md = [
    '# Hasil uji skrip Oracle',
    '',
    `Dijalankan otomatis oleh \`node tools/uji_oracle.mjs\` pada **${ringkas.tanggal}**.`,
    '',
    '| | |',
    '|---|---|',
    `| Basis data | ${banner} |`,
    `| Image | \`${KONFIG.image}\` |`,
    '| Topologi | 3 pluggable database (JAKARTA pusat, BANDUNG, SURABAYA) + database link |',
    `| Skrip | ${ringkas.skripLulus} dari ${ringkas.skrip} lulus |`,
    `| Pemeriksaan mandiri | ${totalCek} LULUS, ${totalGagal} GAGAL |`,
    `| Durasi | ${ringkas.durasiDetik} detik |`,
    '',
    '## Per skrip',
    '',
    '| Skrip | Situs | Sebagai | Status | Cek lulus | Galat peragaan (sengaja) | Log |',
    '|---|---|---|---|---|---|---|',
    ...hasil.map((h) => `| \`${h.berkas}\` | ${h.situs.join(', ')} | ${h.sebagai} | ${h.status === 'LULUS' ? 'LULUS' : '**GAGAL**'} | ${h.lulus.length} | ${h.galatDiharapkan.length ? h.galatDiharapkan.join(', ') : '-'} | ${h.jalan.map((j) => `[${j.situs}](${j.log})`).join(' ')} |`),
    '',
    '## Seluruh pemeriksaan',
    '',
    ...hasil.flatMap((h) => [`### ${h.berkas}`, '', ...h.lulus.map((l) => `- LULUS: ${l}`), ...h.gagal.map((g) => `- **GAGAL: ${g}**`), ...h.takTerduga.map((k) => `- **galat tak terduga: ${k}**`), ...h.tidakMuncul.map((k) => `- **galat peragaan tidak muncul: ${k}**`), '']),
  ].join('\n');
  writeFileSync(join(ORACLE, 'HASIL_UJI.md'), `${md.trimEnd()}\n`);

  log(`\n${ringkas.skripLulus}/${ringkas.skrip} skrip lulus · ${totalCek} cek LULUS · ${totalGagal} GAGAL · ${ringkas.durasiDetik} detik`);
  if (adaGagal) process.exit(1);
}

if (process.argv[1] && /uji_oracle\.mjs$/.test(process.argv[1].replace(/\\/g, '/'))) main();
