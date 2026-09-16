// Lab 03 — Terminal SQL Live. Semua contoh kueri kuliah bisa dijalankan, diubah, atau
// diganti dengan kueri sendiri; sesi berjalan penuh di peramban.
import { pasangTerminal } from './terminal-ui.js';
import * as U from './ui.js';
import { CONTOH } from '../../content/contoh-sql.js';


function render() {
  const kelompok = [...new Set(CONTOH.map((c) => c.kel))];
  U.pasang(`
<div class="catatan"><p><b>Cara pakai.</b> Pilih contoh di bawah atau ketik sendiri. Hasil <b>pratinjau</b> muncul seketika saat Anda mengetik (hanya untuk kueri baca). Tekan <kbd>Enter</kbd> setelah titik koma, atau <kbd>Ctrl</kbd>+<kbd>Enter</kbd>, untuk benar-benar menjalankan. <kbd>Tab</kbd> melengkapi nama tabel/kolom, <kbd>↑</kbd>/<kbd>↓</kbd> memanggil riwayat. Data Anda hanya ada di peramban ini.</p></div>

<div id="terminal-utama"></div>

<h2 id="contoh">Contoh siap jalan</h2>
<p>${CONTOH.length} contoh, dikelompokkan per praktikum dan topik. Klik untuk memuat ke terminal dan menjalankannya — preset basis data berpindah otomatis bila perlu.</p>
${kelompok.map((k) => `
<h3>${U.esc(k)}</h3>
<div class="grid tiga contoh-grid">
${CONTOH.map((c, i) => ({ c, i })).filter(({ c }) => c.kel === k).map(({ c, i }) => `<button type="button" class="hantu contoh" data-i="${i}"><b>${U.esc(c.judul)}</b><span>${U.esc(c.db)}</span></button>`).join('')}
</div>`).join('')}

<h2>Yang didukung terminal</h2>
${U.tabel(['Kelompok', 'Sintaks'], [
    ['Kueri', '<code>SELECT [DISTINCT]</code>, alias, ekspresi, <code>CASE WHEN</code>, <code>WITH</code> (CTE), subquery pada FROM/IN/EXISTS/skalar (boleh berkorelasi)'],
    ['Join & himpunan', '<code>JOIN ... ON</code>, <code>LEFT</code>/<code>RIGHT</code>/<code>FULL OUTER</code>/<code>CROSS</code>, gaya koma; <code>UNION [ALL]</code>, <code>INTERSECT</code>, <code>MINUS</code>/<code>EXCEPT</code>'],
    ['Agregasi & urutan', '<code>COUNT SUM AVG MIN MAX</code>, <code>GROUP BY</code>, <code>HAVING</code>, <code>ORDER BY</code>, <code>FETCH FIRST n ROWS ONLY</code>, <code>OFFSET</code>, <code>LIMIT</code>'],
    ['DML', '<code>INSERT ... VALUES</code> (banyak baris) / <code>INSERT ... SELECT</code>, <code>UPDATE ... SET</code>, <code>DELETE</code> — dengan PK, FK (CASCADE/SET NULL/RESTRICT), UNIQUE, CHECK, NOT NULL, tipe & panjang kolom'],
    ['DDL', '<code>CREATE TABLE</code> (+ <code>AS SELECT</code>), <code>CREATE [OR REPLACE] VIEW</code>, <code>CREATE [UNIQUE] INDEX</code>, <code>DROP ... [CASCADE CONSTRAINTS]</code>, <code>TRUNCATE</code>'],
    ['Transaksi', 'autocommit mati, <code>COMMIT</code>, <code>ROLLBACK</code>, <code>SAVEPOINT</code>, <code>ROLLBACK TO</code>, DDL = commit implisit, <code>COMMIT FORCE</code>/<code>ROLLBACK FORCE</code>'],
    ['Oracle', '<code>DUAL</code>, <code>DESC</code>, <code>EXPLAIN PLAN FOR</code>, <code>tabel@dblink</code>, kamus data <code>user_tables</code> <code>user_views</code> <code>user_tab_columns</code> <code>user_constraints</code> <code>user_indexes</code> <code>dba_2pc_pending</code>, kode galat ORA-xxxxx, <code>NVL DECODE TO_CHAR INITCAP LPAD INSTR TRUNC</code>'],
    ['Perintah meta', '<code>\\d</code>, <code>\\d nama</code>, <code>\\db</code>, <code>\\c situs</code>, <code>\\kunci</code>, <code>\\gagal</code>, <code>\\status</code>, <code>\\ekspor</code>, <code>\\reset</code>, <code>\\clear</code>, <code>\\?</code>'],
  ])}
${U.catatan('<b>Batas jujur.</b> Belum didukung: window function (<code>OVER</code>), <code>MERGE</code>, <code>ALTER TABLE</code>, PL/SQL, sequence, trigger, dan tipe <code>TIMESTAMP WITH TIME ZONE</code>. Rencana eksekusi mengikuti urutan evaluasi logis mesin ini, bukan pengoptimal biaya Oracle. Skrip dari <code>\\ekspor</code> ditulis dalam sintaks Oracle, tetapi belum diuji pada instans Oracle sungguhan.', 'peringatan')}
`);

  const hash = new URLSearchParams(location.hash.slice(1));
  const terminal = pasangTerminal(document.getElementById('terminal-utama'), {
    preset: hash.get('db') || undefined,
    sql: hash.get('sql') || undefined,
    jalankan: hash.get('jalan') !== '0',
  });
  window.__oracledeckTerminal = terminal;

  document.querySelectorAll('.contoh').forEach((b) => b.addEventListener('click', () => {
    const c = CONTOH[Number(b.dataset.i)];
    terminal.muat(c.sql, { preset: c.db });
    document.getElementById('terminal-utama').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

render();
