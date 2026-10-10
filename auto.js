// ---- v22: aturan auto-kategori, template transaksi, dan impor mutasi bank (CSV). Dimuat malas lewat mod('auto'). ----
// Logika murni (parser, pencocokan aturan) ada di core.js dan diuji di tests/unit.
// MC, mkDlg, allCats, catsOf didefinisikan di app.js (dipakai bersama modul lain)

function autoView() {
  $('#rlc').innerHTML = allCats().map(c => `<option>${E(c)}</option>`).join('');
  $('#imw').innerHTML = W.map(w => `<option value="${w.id}">${E(w.n)}</option>`).join(''); $('#imw').value = (W.find(w => w.id == 'w2') || W[0]).id; // mutasi bank: bawaan ke Rekening Bank
  const pre = MC.PRESET_TPL.filter(p => !TM.some(t => t.n == p.n));
  $('#tml').innerHTML = TM.map(t => `<div class="li"><span class="ic ${t.type}">${ic(t.type == 'in' ? 'down' : 'up', 15)}</span><div><b>${E(t.n)}</b><small>${t.type == 'in' ? 'Pemasukan' : 'Pengeluaran'}, ${E(t.cat)}, ${wn(t.w)}${t.amt ? ', ' + R(t.amt) : ', jumlah diisi saat dipakai'}${t.q ? ', catat langsung' : ''}</small></div><span><button class="bt s g" data-tme="${t.id}" aria-label="Ubah template ${E(t.n)}">Ubah</button> <button class="bt s g" data-tmd="${t.id}" aria-label="Hapus template ${E(t.n)}">Hapus</button></span></div>`).join('')
    + (pre.length ? `<small class="mt-12">Tambah dari contoh:</small><div class="tpc mt-8">${pre.map(p => `<button type="button" class="tpb" data-tmp="${E(p.n)}">${E(p.n)}</button>`).join('')}</div>` : '')
    || '';
  if (!TM.length && !pre.length) $('#tml').innerHTML = '<small>Belum ada template.</small>';
  $('#rll').innerHTML = RL.map(r => `<div class="li"><div><b>${E(r.k)}</b><small>masuk ke kategori <span class="tag">${E(r.c)}</span></small></div><button class="bt s g" data-rld="${r.id}" aria-label="Hapus aturan ${E(r.k)}">Hapus</button></div>`).join('') || '<small class="mt-12">Belum ada aturan. Tekan "Pasang aturan umum" untuk memulai dengan Indomaret, Gojek, Netflix, PLN, dan sejenisnya.</small>';
}

/* ---------- Template ---------- */
function tplDlg(t) {
  t = t || { type: 'out', n: '', amt: 0, desc: '', cat: OUT[0], w: 'w2' };
  const d = mkDlg('tmdlg', `<form id="tmf"><h3 class="ct">${t.id ? 'Ubah template' : 'Template baru'}</h3>
    <div><label class="lb" for="tmn">Nama tombol</label><input id="tmn" maxlength="20" required value="${E(t.n)}" placeholder="mis. Listrik"></div>
    <select id="tmt" aria-label="Jenis"><option value="out">Pengeluaran</option><option value="in">Pemasukan</option></select>
    <select id="tmc" aria-label="Kategori"></select><select id="tmw" aria-label="Dompet">${W.map(w => `<option value="${w.id}">${E(w.n)}</option>`).join('')}</select>
    <input id="tma2" inputmode="numeric" data-cur autocomplete="off" aria-label="Jumlah tetap (opsional)" placeholder="Jumlah tetap (opsional)" value="${t.amt ? fmtN(t.amt) : ''}">
    <input id="tmd2" maxlength="60" aria-label="Deskripsi" placeholder="Deskripsi transaksi" value="${E(t.desc || '')}">
    <label class="opt"><input type="checkbox" id="tmq"${t.q ? ' checked' : ''}><span><b>Catat langsung saat diketuk</b><small>Tanpa membuka form. Hanya jika jumlahnya tetap, mis. langganan.</small></span></label>
    <div class="rw"><button type="button" class="bt g" data-close="tmdlg">Batal</button><button class="bt">Simpan</button></div></form>`);
  const fillc = () => $('#tmc').innerHTML = catsOf($('#tmt').value).map(c => `<option>${E(c)}</option>`).join('');
  $('#tmt').value = t.type; fillc(); if (catsOf(t.type).includes(t.cat)) $('#tmc').value = t.cat; if (W.some(w => w.id == t.w)) $('#tmw').value = t.w;
  $('#tmt').onchange = fillc;
  $('#tmf').onsubmit = e => {
    e.preventDefault(); const n = $('#tmn').value.trim().replace(/[<>&"'\\]/g, '').slice(0, 20), amt = num($('#tma2').value); if (!n) return toast('Isi nama template');
    const q = $('#tmq').checked && amt > 0, o = { id: t.id || 'tm' + nid(), n, type: $('#tmt').value, cat: $('#tmc').value, w: $('#tmw').value, amt, desc: $('#tmd2').value.trim().replace(/[<>]/g, '').slice(0, 60), q };
    t.id ? TM[TM.findIndex(x => x.id == t.id)] = o : TM.push(o); save(); d.close(); autoView(); toast('Template disimpan')
  };
  d.showModal(); $('#tmn').focus();
}
$('#tma').onclick = () => tplDlg();
$('#tml').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.tme) tplDlg(TM.find(x => x.id == b.dataset.tme));
  else if (b.dataset.tmd) { const t = TM.find(x => x.id == b.dataset.tmd); ask('Hapus template', `Hapus template "${t.n}"? Transaksi yang sudah dicatat tidak berubah.`, 'Ya, hapus', () => { TM = TM.filter(x => x.id != t.id); save(); autoView() }) }
  else if (b.dataset.tmp) { const p = MC.PRESET_TPL.find(x => x.n == b.dataset.tmp), l = catsOf(p.type); TM.push({ id: 'tm' + nid(), ...p, cat: l.includes(p.cat) ? p.cat : l[0], w: (W.find(w => w.id == 'w2') || W[0]).id, q: false }); save(); autoView() }
};

/* ---------- Aturan ---------- */
$('#rla').onclick = () => {
  const k = $('#rlk').value.trim().replace(/[<>]/g, '').slice(0, 80), c = $('#rlc').value; if (!k || !c) return toast('Isi kata kunci dan pilih kategori');
  const ks = MC.norm(k); if (RL.some(r => MC.norm(r.k) == ks)) return toast('Kata kunci itu sudah punya aturan');
  RL.push({ id: 'rl' + nid(), k, c }); save(); $('#rlk').value = ''; autoView(); toast('Aturan ditambahkan')
};
$('#rlk').onkeydown = e => { if (e.key == 'Enter') { e.preventDefault(); $('#rla').click() } };
$('#rll').onclick = e => { const b = e.target.closest('[data-rld]'); if (b) { RL = RL.filter(r => r.id != b.dataset.rld); save(); autoView() } };
$('#rlp').onclick = () => {
  const have = new Set(RL.map(r => MC.norm(r.k) + '|' + r.c)), add = MC.presetRuleList(allCats()).filter(r => !have.has(MC.norm(r.k) + '|' + r.c));
  if (!add.length) return toast('Aturan umum sudah terpasang semua');
  RL.push(...add.map(r => ({ id: 'rl' + nid(), ...r }))); save(); autoView(); toast(add.length + ' aturan umum dipasang. Ubah atau hapus sesuka Anda')
};

/* ---------- Impor mutasi bank ---------- */
let IM = null; // { rows, head, map, items, skipped, file }
const MAXROWS = 1000, MAPS = [['date', 'Tanggal'], ['desc', 'Deskripsi'], ['amount', 'Jumlah / Debit'], ['credit', 'Kredit (jika terpisah)'], ['type', 'DB/CR (jika ada)']];
$('#imb').onclick = () => $('#imf').click();
$('#imf').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (f.size > 5e6) return toast('Gagal: berkas terlalu besar (maks. 5 MB)');
  try {
    const rows = MC.parseCSV(MC.decodeBytes(await f.arrayBuffer()));
    if (rows.length < 2) return toast('Gagal: berkas kosong atau bukan CSV');
    const { head, map } = MC.detectColumns(rows); if (map.debit !== undefined && map.amount === undefined) map.amount = map.debit;
    IM = { rows, head, map, file: f.name, defType: 'out', w: $('#imw').value, over: {} }; imExtract();
    if (!IM.items.length && !IM.skipped.length) return toast('Gagal: tidak ada baris data');
    imDlg();
  } catch (x) { toast('Gagal membaca berkas: ' + (x.message || 'format tidak dikenali')) }
};
function imExtract() {
  const r = MC.extractRows(IM.rows, IM.head, IM.map, { defType: IM.defType });
  IM.skipped = r.skipped; IM.items = r.items.slice(0, MAXROWS); IM.cut = r.items.length - IM.items.length; MC.markDuplicates(IM.items, T);
  IM.items.forEach(x => { const h = MC.matchRule(RL, x.desc, catsOf(x.type)); x.auto = !!h; x.c = h ? h.c : x.type == 'in' ? (IN.includes('Lainnya') ? 'Lainnya' : IN[IN.length - 1]) : 'Lain-lain'; x.on = !x.dup });
}
const imOpts = (t, sel) => (t == 'out' ? [...OUT, ...(OUT.includes('Lain-lain') ? [] : ['Lain-lain'])] : IN).map(c => `<option${c == sel ? ' selected' : ''}>${E(c)}</option>`).join('');
function imDlg() {
  const hd = IM.head >= 0 ? IM.rows[IM.head] : IM.rows[0].map((_, i) => 'Kolom ' + (i + 1)), col = (k, v) => `<option value=""${v === undefined ? ' selected' : ''}>—</option>` + hd.map((h, i) => `<option value="${i}"${v === i ? ' selected' : ''}>${E(h || 'Kolom ' + (i + 1))}</option>`).join('');
  const d = mkDlg('imd', `<div class="imb"><h3 class="ct">Tinjau impor</h3><small>${E(IM.file)}</small>
    <details class="mt-8"><summary>Kolom salah? Atur manual</summary><div class="imm mt-8">${MAPS.map(([k, l]) => `<label><small>${l}</small><select data-map="${k}">${col(k, IM.map[k])}</select></label>`).join('')}<label><small>Tanpa tanda, anggap</small><select id="imdt"><option value="out"${IM.defType == 'out' ? ' selected' : ''}>Pengeluaran</option><option value="in"${IM.defType == 'in' ? ' selected' : ''}>Pemasukan</option></select></label></div></details>
    <p id="ims" class="mt-8" aria-live="polite"></p>
    <div class="imt"><table class="tbl"><thead><tr><th scope="col"><input type="checkbox" id="imall" aria-label="Pilih semua baris"></th><th scope="col">Tanggal</th><th scope="col">Deskripsi</th><th scope="col">Kategori</th><th class="ta-right" scope="col">Jumlah</th></tr></thead><tbody id="imr"></tbody></table></div>
    <div class="fl cols-auto-170 mt-12 m-0"><select id="imw2" aria-label="Dompet tujuan">${W.map(w => `<option value="${w.id}"${w.id == IM.w ? ' selected' : ''}>${E(w.n)}</option>`).join('')}</select></div>
    <div class="rw"><button type="button" class="bt g" data-close="imd">Batal</button><button type="button" class="bt" id="imgo"></button></div></div>`);
  imRows(); d.querySelector('.imm').onchange = e => { const k = e.target.dataset.map; if (k) { const v = e.target.value; if (v === '') delete IM.map[k]; else IM.map[k] = +v; if (k == 'amount') delete IM.map.debit; if (k == 'credit' && v === '' ) delete IM.map.credit } else if (e.target.id == 'imdt') IM.defType = e.target.value; imExtract(); imRows() };
  $('#imw2').onchange = e => IM.w = e.target.value;
  $('#imall').onchange = e => { IM.items.forEach(x => x.on = e.target.checked); imRows() };
  $('#imr').onchange = e => { const i = e.target.dataset.i; if (i === undefined) return; if (e.target.type == 'checkbox') IM.items[i].on = e.target.checked; else { IM.items[i].c = e.target.value; IM.items[i].auto = false; IM.items[i].man = true } imSum() };
  $('#imgo').onclick = imGo; d.showModal()
}
function imRows() {
  $('#imr').innerHTML = IM.items.map((x, i) => `<tr><td data-l="Pilih"><label class="chk"><input type="checkbox" data-i="${i}"${x.on ? ' checked' : ''} aria-label="Impor baris ${i + 1}"></label></td><td data-l="Tanggal">${fd(x.date)}</td><th scope="row" data-l="Deskripsi"><b>${E(x.desc.slice(0, 80))}</b><small>${x.type == 'in' ? 'Pemasukan' : 'Pengeluaran'}${x.dup ? ', mungkin duplikat' : ''}${x.auto ? ', kategori otomatis' : ''}</small></th><td data-l="Kategori"><select data-i="${i}" aria-label="Kategori baris ${i + 1}">${imOpts(x.type, x.c)}</select></td><td data-l="Jumlah" class="am ${x.type == 'in' ? 'in' : ''}">${sg(x.type)}${R(x.amt)}</td></tr>`).join('') || '<tr class="er"><td colspan="5">Tidak ada baris yang bisa dibaca. Coba atur kolom secara manual.</td></tr>';
  imSum()
}
function imSum() {
  const on = IM.items.filter(x => x.on), au = on.filter(x => x.auto).length, dp = IM.items.filter(x => x.dup).length;
  $('#ims').textContent = `${IM.items.length} baris terbaca${IM.skipped.length ? ', ' + IM.skipped.length + ' dilewati (judul, total, atau tanggal tidak valid)' : ''}${dp ? ', ' + dp + ' mungkin duplikat (tidak dicentang)' : ''}${IM.cut ? '. ' + IM.cut + ' baris di atas batas ' + MAXROWS + ' tidak ikut, pisahkan berkasnya' : ''}.`;
  $('#imgo').textContent = on.length ? `Impor ${on.length} transaksi (${au} dikategorikan otomatis)` : 'Pilih baris untuk diimpor'; $('#imgo').disabled = !on.length;
  $('#imall').checked = IM.items.length > 0 && on.length == IM.items.length
}
function imGo() {
  const on = IM.items.filter(x => x.on); if (!on.length) return;
  if (on.some(x => x.type == 'out' && x.c == 'Lain-lain') && !OUT.includes('Lain-lain')) { OUT.push('Lain-lain'); B['Lain-lain'] ??= 1e6 }
  on.forEach(x => T.push({ id: nid(), w: IM.w, date: x.date, type: x.type, cat: x.c, desc: x.desc.slice(0, 120), amt: x.amt, imp: 1 }));
  save(); $('#imd').close(); cats(); toast(on.length + ' transaksi diimpor'); IM = null; gos('tx')
}
