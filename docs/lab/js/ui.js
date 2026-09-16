// ui.js — pembantu tampilan bersama untuk seluruh lab. Nol dependensi.

export const $ = (sel, induk = document) => induk.querySelector(sel);
export const $$ = (sel, induk = document) => [...induk.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Buat elemen dari HTML. */
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Pasang isi lab ke wadahnya. */
export function pasang(html) {
  const w = document.getElementById('lab');
  w.innerHTML = html;
  return w;
}

/** Tabel dari Relation mesin. */
export function tabelRelasi(rel, { maks = 50, judul = null } = {}) {
  if (!rel || rel.cardinality === 0) {
    return `${judul ? `<h4>${esc(judul)}</h4>` : ''}<p class="kosong">Tidak ada baris.</p>`;
  }
  const baris = rel.rows.slice(0, maks);
  const numerik = rel.attrs.map((_, i) => rel.rows.every((r) => r[i] === null || typeof r[i] === 'number'));
  return `${judul ? `<h4>${esc(judul)}</h4>` : ''}<div class="tabel-bungkus"><table>
<thead><tr>${rel.attrs.map((a, i) => `<th${numerik[i] ? ' class="num"' : ''}>${esc(a)}</th>`).join('')}</tr></thead>
<tbody>${baris.map((r) => `<tr>${r.map((c, i) => `<td${numerik[i] ? ' class="num"' : ''}>${c === null ? '<span class="kosong">NULL</span>' : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
</table></div>${rel.cardinality > maks ? `<p class="kecil">Menampilkan ${maks} dari ${rel.cardinality} baris.</p>` : `<p class="kecil">${rel.cardinality} baris.</p>`}`;
}

/** Tabel dari array objek. */
export function tabel(kepala, baris, { kelasNum = [] } = {}) {
  if (!baris.length) return '<p class="kosong">Tidak ada data.</p>';
  return `<div class="tabel-bungkus"><table>
<thead><tr>${kepala.map((k, i) => `<th${kelasNum.includes(i) ? ' class="num"' : ''}>${k}</th>`).join('')}</tr></thead>
<tbody>${baris.map((r) => `<tr>${r.map((c, i) => `<td${kelasNum.includes(i) ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody>
</table></div>`;
}

export function lencana(teks, jenis = 'netral') {
  return `<span class="lencana ${jenis}">${esc(teks)}</span>`;
}

export function lulusGagal(ok, teksOk = 'LULUS', teksGagal = 'GAGAL') {
  return lencana(ok ? teksOk : teksGagal, ok ? 'ok' : 'gagal');
}

export function catatan(teks, jenis = '') {
  return `<div class="catatan ${jenis}"><p>${teks}</p></div>`;
}

export function kartu(judul, isi) {
  return `<div class="kartu">${judul ? `<h3>${esc(judul)}</h3>` : ''}${isi}</div>`;
}

export function pre(teks) { return `<pre><code>${esc(teks)}</code></pre>`; }

const KATA_SQL = /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|JOIN|LEFT|RIGHT|FULL|INNER|OUTER|CROSS|ON|AS|AND|OR|NOT|IN|IS|NULL|BETWEEN|LIKE|UNION|ALL|DISTINCT|LIMIT|OFFSET|CREATE|OR REPLACE|TABLE|VIEW|INDEX|MATERIALIZED|DATABASE|LINK|SYNONYM|TABLESPACE|PARTITION|BY|LIST|RANGE|HASH|REFERENCE|VALUES|LESS|THAN|DEFAULT|PRIMARY|KEY|FOREIGN|REFERENCES|CONSTRAINT|CHECK|UNIQUE|INSERT|INTO|UPDATE|SET|DELETE|COMMIT|ROLLBACK|FORCE|ALTER|DROP|CASCADE|EXPLAIN|PLAN|FOR|REFRESH|FAST|COMPLETE|BUILD|IMMEDIATE|ENABLE|QUERY|REWRITE|WITH|USING|CONNECT|TO|IDENTIFIED|PUBLIC|LOCAL|GLOBAL|PARTITIONS|EXEC|AT|SITE|CHAR|VARCHAR2|NUMBER|DATE)\b/gi;

/** Pewarna SQL ringan untuk keluaran lab. */
export function preSql(teks) {
  const hasil = esc(teks).split('\n').map((b) => {
    const i = b.indexOf('--');
    let kode = i >= 0 ? b.slice(0, i) : b;
    const kom = i >= 0 ? b.slice(i) : '';
    kode = kode
      .replace(/&#039;/g, "'")
      .replace(/'([^']*)'/g, '\u0001$1\u0002')
      .replace(KATA_SQL, (m) => `\u0003${m}\u0004`)
      .replace(/\b(COUNT|SUM|AVG|MIN|MAX|UPPER|LOWER|LENGTH|SUBSTR|ROUND|COALESCE|NVL|SYSDATE|DBMS_XPLAN|DBMS_MVIEW)\b/g, '\u0005$1\u0006')
      .replace(/\u0001([^\u0002]*)\u0002/g, '<span class="sql-s">&#039;$1&#039;</span>')
      .replace(/\u0003([^\u0004]*)\u0004/g, '<span class="sql-k">$1</span>')
      .replace(/\u0005([^\u0006]*)\u0006/g, '<span class="sql-f">$1</span>');
    return kode + (kom ? `<span class="sql-c">${kom}</span>` : '');
  }).join('\n');
  return `<pre><code>${hasil}</code></pre>`;
}

/** Kelompok tombol pilihan tunggal. */
export function pilihan(nama, opsi, terpilih) {
  return `<div class="pilihan-kelompok" data-pilihan="${nama}">
${opsi.map((o) => `<button type="button" data-nilai="${esc(o.nilai)}" aria-pressed="${o.nilai === terpilih}">${esc(o.teks)}</button>`).join('\n')}
</div>`;
}

/** Pasang perilaku pada kelompok pilihan. */
export function ikatPilihan(nama, fn, induk = document) {
  const grup = induk.querySelector(`[data-pilihan="${nama}"]`);
  if (!grup) return;
  grup.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    [...grup.querySelectorAll('button')].forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    fn(b.dataset.nilai);
  });
}

export function bidang(label, isiHtml) {
  return `<div class="bidang"><label>${esc(label)}</label>${isiHtml}</div>`;
}

export function angka(id, nilai, { min = 0, max = 1e9, step = 1, lebar = 90 } = {}) {
  return `<input type="number" id="${id}" value="${nilai}" min="${min}" max="${max}" step="${step}" style="width:${lebar}px">`;
}

export function pilih(id, opsi, terpilih) {
  return `<select id="${id}">${opsi.map((o) => `<option value="${esc(o.nilai ?? o)}"${(o.nilai ?? o) === terpilih ? ' selected' : ''}>${esc(o.teks ?? o)}</option>`).join('')}</select>`;
}

export function bar(nilai, maks, kelas = '') {
  const p = maks > 0 ? Math.min(100, (nilai / maks) * 100) : 0;
  return `<div class="bar ${kelas}"><i style="width:${p.toFixed(1)}%"></i></div>`;
}

export function fmt(n, desimal = 2) {
  if (n === null || n === undefined) return '—';
  if (typeof n !== 'number') return esc(n);
  if (Number.isInteger(n)) return n.toLocaleString('id-ID');
  return n.toLocaleString('id-ID', { minimumFractionDigits: desimal, maximumFractionDigits: desimal });
}

export function persen(x, desimal = 1) {
  return `${(x * 100).toFixed(desimal)}%`;
}

/** Tangkap galat agar lab tidak pernah berhenti tanpa penjelasan. */
export function aman(fn, wadah) {
  try { return fn(); } catch (e) {
    if (wadah) wadah.innerHTML = `<div class="catatan bahaya"><p><b>Galat:</b></p><p class="galat">${esc(e.message)}</p></div>`;
    else console.error(e);
    return null;
  }
}

/** Pohon operator sebagai teks berindentasi. */
export function pohon(teks) {
  return `<div class="diagram"><div class="pohon">${esc(teks)}</div></div>`;
}

/** Jejak pesan protokol. */
export function jejak(langkah) {
  return `<div class="diagram"><div class="jejak">${langkah.map((l) => `<span class="t">t${String(l.t).padStart(2, '0')} [fase ${l.fase}]</span> <span class="msg">${esc(l.dari)} → ${esc(l.ke)}: <b>${esc(l.pesan)}</b></span>${l.keterangan ? ` <span class="ket">(${esc(l.keterangan)})</span>` : ''}`).join('<br>')}</div></div>`;
}

/** Judul bagian di dalam lab. */
export function bagian(judul, isi, id = null) {
  return `<h2${id ? ` id="${id}"` : ''}>${esc(judul)}</h2>${isi}`;
}

export function tombol(id, teks, kelas = '') {
  return `<button type="button" id="${id}"${kelas ? ` class="${kelas}"` : ''}>${esc(teks)}</button>`;
}
