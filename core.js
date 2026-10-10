// ---- v22: logika murni (tanpa DOM) untuk aturan auto-kategori, impor CSV mutasi bank, dan penggabungan data antar-perangkat. ----
// Dimuat di browser sebagai window.MiraiCore dan diuji di Node (tests/unit). Jangan menaruh akses DOM/localStorage di sini.
(function (root, factory) {
  const c = factory();
  if (typeof module === 'object' && module.exports) module.exports = c; else root.MiraiCore = c;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ===================== Umum ===================== */
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  // JSON dengan urutan kunci stabil: jsonb Postgres mengurutkan ulang kunci, jadi perbandingan tidak boleh bergantung pada urutan.
  const stable = v => {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (isObj(v)) return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  };
  const eq = (a, b) => stable(a) === stable(b);
  // Hash djb2 deterministik (dipakai memberi id pada tujuan lama yang belum punya id, supaya sama di semua perangkat)
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) };
  const pad = n => String(n).padStart(2, '0');
  const isoDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  // Pembuat id numerik yang selalu naik (impor ratusan baris dalam satu milidetik tidak boleh bentrok)
  const makeNid = (clock = Date.now) => { let last = 0; return () => (last = Math.max(clock(), last + 1)) };

  /* ===================== Aturan auto-kategori ===================== */
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
  const ruleKeys = r => String(r && r.k || '').split(/[,;\n]/).map(norm).filter(Boolean);
  // Kata kunci terpanjang menang ("grabfood" mengalahkan "grab"); seri dimenangkan aturan yang lebih dulu.
  // cats (opsional): hanya aturan yang kategorinya ada di daftar ini yang dipertimbangkan (mis. daftar kategori pengeluaran).
  function matchRule(rules, desc, cats) {
    const d = norm(desc); if (!d) return null; let best = null;
    for (const r of rules || []) {
      if (!r || !r.c || (cats && !cats.includes(r.c))) continue;
      for (const k of ruleKeys(r)) if (d.includes(k) && (!best || k.length > best.len)) best = { c: r.c, rule: r, key: k, len: k.length };
    }
    return best;
  }
  // Aturan umum untuk pengguna Indonesia. Hanya dipasang bila kategorinya ada.
  const PRESET_RULES = [
    ['indomaret, alfamart, alfamidi, superindo, lotte mart, hypermart, giant, transmart', 'Belanja'],
    ['shopee, tokopedia, lazada, blibli, tiktok shop, bukalapak', 'Belanja'],
    ['gofood, grabfood, shopeefood, kfc, mcd, mcdonald, starbucks, kopi kenangan, janji jiwa, warung, resto, bakso, nasi, ayam, kopi', 'Makanan'],
    ['gojek, gocar, goride, grab, maxim, indrive, krl, commuterline, transjakarta, mrt, lrt, tol, parkir, pertamina, spbu, shell, bbm, kai, bluebird', 'Transportasi'],
    ['pln, token listrik, pdam, telkom, indihome, biznet, myrepublic, pulsa, paket data, telkomsel, xl, indosat, smartfren, bpjs, asuransi, cicilan', 'Tagihan'],
    ['netflix, spotify, youtube, disney, vidio, hbo, bioskop, cgv, xxi, steam, playstation, google play, apple.com', 'Hiburan'],
    ['apotek, kimia farma, guardian, halodoc, alodokter, klinik, rumah sakit, rs , dokter, lab ', 'Kesehatan'],
    ['gaji, salary, payroll, thr, bonus', 'Gaji'],
    ['freelance, honor, fee proyek, project', 'Freelance']
  ];
  const presetRuleList = cats => PRESET_RULES.filter(([, c]) => cats.includes(c)).map(([k, c]) => ({ k, c }));
  // Template transaksi contoh (jumlah dikosongkan: diisi pengguna).
  const PRESET_TPL = [
    { n: 'Gaji', type: 'in', cat: 'Gaji', amt: 0, desc: 'Gaji bulanan' },
    { n: 'Listrik', type: 'out', cat: 'Tagihan', amt: 0, desc: 'Token listrik PLN' },
    { n: 'Internet', type: 'out', cat: 'Tagihan', amt: 0, desc: 'Internet rumah' },
    { n: 'Netflix', type: 'out', cat: 'Hiburan', amt: 0, desc: 'Langganan Netflix' },
    { n: 'Spotify', type: 'out', cat: 'Hiburan', amt: 0, desc: 'Langganan Spotify' },
    { n: 'Pulsa/Data', type: 'out', cat: 'Tagihan', amt: 0, desc: 'Pulsa dan paket data' }
  ];

  /* ===================== CSV ===================== */
  function splitLine(line, d) { // pemisah kolom sadar-kutip (untuk deteksi pemisah)
    const o = []; let f = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"') { if (line[i + 1] === '"') { f += '"'; i++ } else q = false } else f += c }
      else if (c === '"' && !f.trim()) { q = true; f = '' }
      else if (c === d) { o.push(f); f = '' }
      else f += c;
    }
    o.push(f); return o;
  }
  function detectDelim(text) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim()).slice(0, 20); let best = ',', bs = 0;
    for (const d of [',', ';', '\t', '|']) {
      const cnt = lines.map(l => splitLine(l, d).length), freq = {}; cnt.forEach(n => freq[n] = (freq[n] || 0) + 1);
      let mode = 1, mf = 0; for (const n in freq) if (freq[n] > mf || (freq[n] === mf && +n > mode)) { mode = +n; mf = freq[n] }
      const score = mode > 1 ? mf * (mode - 1) : 0; if (score > bs) { bs = score; best = d }
    }
    return best;
  }
  function parseCSV(text, delim) {
    text = String(text).replace(/^\uFEFF/, ''); delim = delim || detectDelim(text);
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++ } else q = false } else f += c }
      else if (c === '"' && !f.trim()) { q = true; f = '' }
      else if (c === delim) { row.push(f); f = '' }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; rows.push(row); row = [] }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row) }
    return rows.map(r => r.map(x => x.trim())).filter(r => r.some(x => x !== ''));
  }

  /* ---- Jumlah: "1.234.567,89", "1,234,567.89", "Rp 50.000", "(25.000)", "50000.00 CR", "10.000,00 DB" ---- */
  function parseAmount(s) {
    if (s == null) return null; let t = String(s).trim(); if (!t) return null;
    let neg = false, dc = null;
    if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1).trim() }
    let m;
    if ((m = t.match(/^(.*[\d.,)])\s*(DB|DR|D|DEBIT|DEBET)\.?$/i))) { dc = 'D'; t = m[1] }
    else if ((m = t.match(/^(.*[\d.,)])\s*(CR|KR|K|C|CREDIT|KREDIT)\.?$/i))) { dc = 'C'; t = m[1] }
    else if ((m = t.match(/^(DB|DR|D|DEBIT|DEBET)\s+([\d(].*)$/i))) { dc = 'D'; t = m[2] }
    else if ((m = t.match(/^(CR|KR|K|C|CREDIT|KREDIT)\s+([\d(].*)$/i))) { dc = 'C'; t = m[2] }
    t = t.replace(/^(rp\.?|idr)\s*/i, '').replace(/^[-−–+]\s*(rp\.?\s*)?/i, x => { if (/[-−–]/.test(x[0])) neg = true; return '' });
    if (/[-−–]$/.test(t)) { neg = true; t = t.slice(0, -1) }
    t = t.replace(/[^\d.,]/g, ''); if (!/\d/.test(t)) return null;
    const ld = t.lastIndexOf('.'), lc = t.lastIndexOf(','); let ip, dec = '';
    if (ld > -1 && lc > -1) { const i = Math.max(ld, lc); ip = t.slice(0, i); dec = t.slice(i + 1) }
    else if (ld > -1 || lc > -1) {
      const sep = ld > -1 ? '.' : ',', p = t.split(sep);
      if (p.length > 2) ip = p.join(''); else if (p[1].length === 3 && p[0] !== '' && p[0] !== '0') ip = p[0] + p[1]; else { ip = p[0]; dec = p[1] }
    } else ip = t;
    ip = ip.replace(/[.,]/g, '');
    const n = Math.round(parseFloat((ip || '0') + (dec ? '.' + dec.replace(/\D/g, '') : '')));
    return Number.isFinite(n) ? { n, neg, dc } : null;
  }

  /* ---- Tanggal: dd/mm/yyyy (hari lebih dulu), yyyy-mm-dd, dd/mm (tanpa tahun), "05 Okt 2026", "Oct 5, 2026" ---- */
  const MON = { jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mar: 3, maret: 3, march: 3, apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, agu: 8, agt: 8, agus: 8, agustus: 8, aug: 8, august: 8, sep: 9, sept: 9, september: 9, okt: 10, oct: 10, oktober: 10, october: 10, nov: 11, nopember: 11, november: 11, des: 12, dec: 12, desember: 12, december: 12 };
  const dimo = (y, m) => new Date(y, m, 0).getDate();
  function mkDate(y, m, d) { if (y < 100) y += 2000; if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= dimo(y, m)) || y < 1990 || y > 2100) return null; return y + '-' + pad(m) + '-' + pad(d) }
  function parseDate(s, ref) {
    ref = ref || new Date(); let t = String(s == null ? '' : s).trim(), m; if (!t) return null;
    t = t.replace(/[T\s]+\d{1,2}[:.]\d{2}([:.]\d{2})?(\s?(AM|PM|WIB|WITA|WIT))?$/i, '').replace(/^[A-Za-z]+,\s*/, '').trim();
    if ((m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return mkDate(+m[1], +m[2], +m[3]);
    if ((m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) { let a = +m[1], b = +m[2]; if (b > 12 && a <= 12) [a, b] = [b, a]; return mkDate(+m[3], b, a) }
    if ((m = t.match(/^(\d{1,2})[-/.](\d{1,2})$/))) { // tanpa tahun (mis. BCA): pakai tahun ini, mundur setahun bila jatuh di masa depan
      const a = +m[1], b = +m[2]; let y = ref.getFullYear(), r = mkDate(y, b, a); if (r && r > isoDate(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + 2))) r = mkDate(y - 1, b, a); return r;
    }
    if ((m = t.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{2,4})$/)) && MON[m[2].toLowerCase()]) return mkDate(+m[3], MON[m[2].toLowerCase()], +m[1]);
    if ((m = t.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/)) && MON[m[1].toLowerCase()]) return mkDate(+m[3], MON[m[1].toLowerCase()], +m[2]);
    return null;
  }

  /* ---- Deteksi kolom ---- */
  const HDR = {
    date: /^(tanggal|tgl|date|waktu|tanggal transaksi|tgl transaksi|posting date|trans(action)? date|value date)\b/i,
    desc: /(keterangan|deskripsi|uraian|description|remarks?|berita|transaksi|detail|memo|catatan|narasi|merchant|penerima|rincian)/i,
    debit: /^(debet|debit|keluar|pengeluaran|db|dr|withdrawals?|uang keluar|mutasi debet|mutasi debit|jumlah debet|jumlah debit)$/i,
    credit: /^(kredit|credit|masuk|pemasukan|cr|kr|deposits?|uang masuk|mutasi kredit|jumlah kredit)$/i,
    amount: /(jumlah|amount|nominal|mutasi|nilai)/i,
    type: /^(tipe|type|jenis|d\/c|db\/cr|dk|d\/k|cr\/db|jenis mutasi)$/i,
    balance: /(saldo|balance)/i
  };
  const DCV = /^(DB|CR|DR|KR|D|K|C|DEBIT|DEBET|KREDIT|CREDIT)$/i;
  function mapHeader(row) {
    const map = {}; let hits = 0;
    row.forEach((h, i) => {
      const t = norm(h); if (!t) return;
      for (const k of ['date', 'type', 'debit', 'credit', 'balance', 'amount', 'desc']) {
        if (map[k] === undefined && HDR[k].test(t) && !(k === 'desc' && /^tanggal|^tgl|^date/i.test(t)) && !(k === 'amount' && /saldo|balance/i.test(t))) { map[k] = i; hits++; break }
      }
    });
    return { map, hits };
  }
  // Mengembalikan { head: indeks baris judul (-1 bila tidak ada), map: {date,desc,debit,credit,amount,type,balance} }
  function detectColumns(rows, ref) {
    let head = -1, best = { map: {}, hits: 0 };
    rows.slice(0, 40).forEach((r, i) => { const m = mapHeader(r); if (m.map.date !== undefined && m.hits > best.hits && m.hits >= 2) { best = m; head = i } });
    if (head >= 0) {
      const map = best.map; if (map.amount !== undefined && (map.amount === map.debit || map.amount === map.credit)) delete map.amount;
      if (map.desc === undefined) { const used = new Set(Object.values(map)), w = rows[head].findIndex((_, i) => !used.has(i)); if (w >= 0) map.desc = w }
      return { head, map };
    }
    // Tanpa judul: tebak dari isi kolom
    const body = rows.slice(0, 60), n = Math.max(...body.map(r => r.length)), col = i => body.map(r => r[i] || '').filter(Boolean);
    const sc = (i, f) => { const c = col(i); return c.length ? c.filter(f).length / c.length : 0 };
    const map = {}; let bd = 0.6;
    for (let i = 0; i < n; i++) { const s = sc(i, x => !!parseDate(x, ref)); if (s >= bd) { bd = s; map.date = i } }
    const used = () => new Set(Object.values(map)), nums = [];
    for (let i = 0; i < n; i++) if (!used().has(i) && sc(i, x => !!parseAmount(x) && /^[\s\dRpIDRrp.,()+\-−–DBCRKdbcrk]*$/.test(x)) >= 0.7) nums.push(i);
    for (let i = 0; i < n; i++) if (!used().has(i) && !nums.includes(i) && sc(i, x => DCV.test(x)) >= 0.8) map.type = i;
    if (nums.length) { map.amount = nums[0]; if (nums.length > 1) map.balance = nums[nums.length - 1] }
    let bl = 0; for (let i = 0; i < n; i++) if (!used().has(i) && !nums.includes(i)) { const a = col(i).reduce((s, x) => s + x.length, 0) / (col(i).length || 1); if (a > bl) { bl = a; map.desc = i } }
    return { head: -1, map };
  }
  // Menerapkan pemetaan ke baris data. opts.defType: 'out'|'in' bila baris tak punya tanda.
  function extractRows(rows, head, map, opts) {
    opts = opts || {}; const items = [], skipped = []; const ref = opts.ref;
    rows.slice(head + 1).forEach((r, k) => {
      const line = head + 2 + k, date = map.date !== undefined ? parseDate(r[map.date], ref) : null;
      const desc = map.desc !== undefined ? String(r[map.desc] || '').replace(/\s+/g, ' ').trim() : '';
      if (!date) { skipped.push({ line, why: 'tanggal tidak valid', raw: r }); return }
      let amt = 0, type = null;
      const outCol = map.debit !== undefined ? map.debit : map.amount; // kolom "debit/keluar" atau kolom jumlah tunggal
      const a1 = outCol !== undefined ? parseAmount(r[outCol]) : null, a2 = map.credit !== undefined ? parseAmount(r[map.credit]) : null;
      if (map.credit !== undefined && outCol !== undefined) { // dua kolom: debit dan kredit
        if (a1 && a1.n > 0) { amt = a1.n; type = 'out' } else if (a2 && a2.n > 0) { amt = a2.n; type = 'in' }
      } else if (a1) {
        amt = a1.n; const tv = map.type !== undefined ? String(r[map.type] || '').trim() : '';
        if (/^(DB|DR|D|DEBIT|DEBET)$/i.test(tv) || a1.dc === 'D') type = 'out';
        else if (/^(CR|KR|K|C|CREDIT|KREDIT)$/i.test(tv) || a1.dc === 'C') type = 'in';
        else if (a1.neg) type = opts.negIn ? 'in' : 'out';
        else type = opts.defType || (opts.signed ? 'in' : 'out');
      }
      if (!amt || !type) { skipped.push({ line, why: 'jumlah kosong atau nol', raw: r }); return }
      items.push({ line, date, desc: desc || (type === 'in' ? 'Pemasukan' : 'Pengeluaran'), amt, type });
    });
    return { items, skipped };
  }
  // Menandai baris yang mungkin sudah ada (tanggal + jenis + jumlah sama); hitungannya memperhitungkan jumlah kejadian.
  function markDuplicates(items, existing) {
    const key = x => x.date + '|' + x.type + '|' + x.amt, left = {};
    (existing || []).forEach(x => { if (!x.tr) { const k = key(x); left[k] = (left[k] || 0) + 1 } });
    items.forEach(x => { const k = key(x); if (left[k] > 0) { x.dup = true; left[k]-- } else x.dup = false });
    return items;
  }
  // Baca teks dari ArrayBuffer: UTF-8, dan jika ada karakter pengganti (�) coba windows-1252 (umum pada berkas bank lama).
  function decodeBytes(buf) {
    const u8 = new Uint8Array(buf); let t = new TextDecoder('utf-8').decode(u8);
    if (t.includes('\uFFFD')) { try { t = new TextDecoder('windows-1252').decode(u8) } catch (e) { } }
    return t;
  }

  /* ===================== Penggabungan tiga arah (base, lokal, jauh) ===================== */
  // Prinsip: tidak ada data yang hilang diam-diam. Perubahan lokal dan jauh pada catatan berbeda digabung;
  // hapus-vs-ubah dimenangkan "ubah"; perubahan pada catatan/kolom yang sama dimenangkan lokal (yang baru saja Anda lakukan).
  const KEYS = { LK: 'p' };
  function mergeList(b, l, r, key) {
    const all = [...b, ...l, ...r];
    if (!all.some(isObj)) { // daftar nilai sederhana (mis. kategori): himpunan dengan urutan jauh
      const bs = new Set(b.map(stable)), ls = new Set(l.map(stable)), out = [], seen = new Set();
      for (const x of r) { const s = stable(x); if (bs.has(s) && !ls.has(s)) continue; out.push(x); seen.add(s) }
      for (const x of l) { const s = stable(x); if (!seen.has(s) && !bs.has(s)) { out.push(x); seen.add(s) } }
      return out;
    }
    key = key || 'id'; const idOf = x => isObj(x) && x[key] != null ? String(x[key]) : null;
    if (all.some(x => idOf(x) === null)) return l; // tanpa id tidak bisa digabung aman: lokal menang
    const bm = new Map(b.map(x => [idOf(x), x])), lm = new Map(l.map(x => [idOf(x), x])), out = [], done = new Set();
    for (const x of r) {
      const id = idOf(x); done.add(id);
      if (!lm.has(id)) { if (bm.has(id) && eq(x, bm.get(id))) continue; out.push(x); continue } // dihapus lokal (jauh tak berubah) -> hapus; selain itu pertahankan
      out.push(bm.has(id) ? mergeRec(bm.get(id), lm.get(id), x) : lm.get(id));
    }
    for (const x of l) { const id = idOf(x); if (done.has(id)) continue; if (bm.has(id) && eq(x, bm.get(id))) continue; out.push(x) } // tambahan lokal; atau dihapus jauh (lokal tak berubah) -> buang
    return out;
  }
  function mergeRec(b, l, r) {
    if (eq(l, b)) return r; if (eq(r, b)) return l;
    if (!isObj(l) || !isObj(r)) return l;
    b = isObj(b) ? b : {}; const o = {};
    for (const k of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
      const bv = b[k], lv = l[k], rv = r[k]; let v;
      if (Array.isArray(lv) || Array.isArray(rv)) v = eq(lv, bv) ? rv : eq(rv, bv) ? lv : mergeList(Array.isArray(bv) ? bv : [], Array.isArray(lv) ? lv : [], Array.isArray(rv) ? rv : [], 'id');
      else if (eq(lv, bv)) v = rv; else v = lv;
      if (v !== undefined) o[k] = v;
    }
    return o;
  }
  function merge3(base, local, remote) {
    base = base || {}; local = local || {}; remote = remote || {}; const out = {};
    for (const k of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
      const bv = base[k], lv = local[k], rv = remote[k]; let v;
      if (eq(lv, bv)) v = rv; else if (eq(rv, bv)) v = lv;
      else if (Array.isArray(lv) || Array.isArray(rv)) v = mergeList(Array.isArray(bv) ? bv : [], Array.isArray(lv) ? lv : [], Array.isArray(rv) ? rv : [], KEYS[k]);
      else if (isObj(lv) && isObj(rv)) v = mergeRec(bv || {}, lv, rv);
      else v = lv;
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  // Jumlah perubahan lokal yang belum terkirim (untuk penanda "N perubahan menunggu sinkron").
  function diffCount(base, local) {
    base = base || {}; local = local || {}; let n = 0;
    for (const k of new Set([...Object.keys(base), ...Object.keys(local)])) {
      const bv = base[k], lv = local[k]; if (eq(bv, lv)) continue;
      if (Array.isArray(bv) || Array.isArray(lv)) {
        const b = Array.isArray(bv) ? bv : [], l = Array.isArray(lv) ? lv : [];
        if ([...b, ...l].some(isObj)) {
          const key = KEYS[k] || 'id', bm = new Map(b.map(x => [x && x[key], stable(x)])), lm = new Map(l.map(x => [x && x[key], stable(x)]));
          for (const [id, s] of lm) if (!bm.has(id) || bm.get(id) !== s) n++;
          for (const id of bm.keys()) if (!lm.has(id)) n++;
        } else { const bs = new Set(b.map(stable)), ls = new Set(l.map(stable)); bs.forEach(x => ls.has(x) || n++); ls.forEach(x => bs.has(x) || n++) }
      } else if (isObj(bv) || isObj(lv)) { const b = bv || {}, l = lv || {}; for (const c of new Set([...Object.keys(b), ...Object.keys(l)])) if (!eq(b[c], l[c])) n++ }
      else n++;
    }
    return n;
  }

  /* ===================== Utang, piutang, cicilan ===================== */
  const debtPaid = d => (d.pays || []).reduce((s, p) => s + p.amt, 0);
  const debtLeft = d => Math.max(0, d.amt - debtPaid(d));
  // Tabungan Amal (charity.js), saldo terpisah dari dompet. Catatan: { k:'in' (saldo ditambahkan) | 'out' (disalurkan ke penerima), amt }.
  const amalSum = (list, k) => (list || []).filter(c => c.k === k).reduce((s, c) => s + (+c.amt || 0), 0);
  const amalBal = list => amalSum(list, 'in') - amalSum(list, 'out');
  // Cicilan: n0 = angsuran yang sudah dibayar sebelum dicatat di Mirai; pays = pembayaran yang dicatat; first = jatuh tempo angsuran pertama yang belum dibayar.
  const instPaidN = c => (c.n0 || 0) + (c.pays || []).length;
  const instLeftN = c => Math.max(0, c.months - instPaidN(c));
  const instLeft = c => instLeftN(c) * c.per;
  const addMonths = (s, k, d0) => { const t = new Date(s + 'T00:00'), y = t.getFullYear(), mo = t.getMonth() + k, dd = Math.min(d0 || t.getDate(), new Date(y, mo + 1, 0).getDate()); return isoDate(new Date(y, mo, dd)) };

  const instNext = c => addMonths(c.first, (c.pays || []).length, c.dd);

  return { isObj, stable, eq, hash, pad, isoDate, makeNid, norm, matchRule, presetRuleList, PRESET_RULES, PRESET_TPL, parseCSV, detectDelim, parseAmount, parseDate, detectColumns, extractRows, markDuplicates, decodeBytes, merge3, mergeList, mergeRec, diffCount, debtPaid, debtLeft, amalSum, amalBal, instPaidN, instLeftN, instLeft, instNext, addMonths };
});
