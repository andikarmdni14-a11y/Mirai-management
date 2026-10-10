// ---- v22: utang, piutang, dan cicilan/paylater. Dimuat malas lewat mod('debt'). ----
// Model data (ikut disinkronkan lewat sync.js):
//  DT: { id, k:'utang'|'piutang', who, amt, due?, note?, pays:[{id,date,amt,tx?}], otx? }
//  CL: { id, k:'cicilan'|'paylater', n, per, months, n0, first, dd, cat, w, pays:[{id,date,tx?}] }
// Arus kas ke dompet dicatat sebagai transaksi bertanda `tr` (seperti transfer): saldo dompet berubah, tetapi TIDAK dihitung
// sebagai pemasukan/pengeluaran di laporan (meminjam uang bukan penghasilan). Pembayaran cicilan adalah pengeluaran biasa.
let DBT = 'utang';
const dpaid = d => MC.debtPaid(d), dleft = d => MC.debtLeft(d), ndue = s => due({ due: s });
const defW = () => (W.find(w => w.id == 'w2') || W[0]).id;
const wOpts = sel => W.map(w => `<option value="${w.id}"${w.id == sel ? ' selected' : ''}>${E(w.n)}</option>`).join('');

function debtView() {
  const U = DT.filter(d => d.k == 'utang'), P = DT.filter(d => d.k == 'piutang'), ym = ds(0).slice(0, 7);
  const act = CL.filter(c => MC.instLeftN(c) > 0), bln = act.filter(c => MC.instNext(c).slice(0, 7) <= ym).reduce((s, c) => s + c.per, 0);
  $('#dbs').innerHTML = `<div class="card"><small>Sisa utang saya</small><div class="big">${RM(U.reduce((s, d) => s + dleft(d), 0))}</div></div><div class="card"><small>Sisa piutang (belum dikembalikan)</small><div class="big in">${RM(P.reduce((s, d) => s + dleft(d), 0))}</div></div><div class="card"><small>Cicilan dan PayLater bulan ini</small><div class="big">${RM(bln)}</div><small>Sisa seluruh cicilan ${RM(act.reduce((s, c) => s + MC.instLeft(c), 0))}</small></div>`;
  const tabs = [['utang', 'Utang saya'], ['piutang', 'Piutang'], ['cicilan', 'Cicilan dan PayLater']];
  $('#dbtab').innerHTML = tabs.map(([k, l]) => `<button type="button" class="bt s${DBT == k ? '' : ' g'}" data-tab="${k}" aria-pressed="${DBT == k}">${l}</button>`).join('');
  $('#dbadd').textContent = { utang: 'Tambah utang', piutang: 'Tambah piutang', cicilan: 'Tambah cicilan' }[DBT];
  $('#dbl').innerHTML = DBT == 'cicilan' ? clList() : dtList(DBT);
}
function dtList(k) {
  const L = DT.filter(d => d.k == k).sort((a, b) => (dleft(a) == 0) - (dleft(b) == 0) || (a.due || '9').localeCompare(b.due || '9'));
  if (!L.length) return k == 'utang' ? emp('Tidak ada utang tercatat', 'Catat pinjaman dari teman, keluarga, atau koperasi agar cicilannya tidak terlupa.', '', 'landmark') : emp('Tidak ada piutang tercatat', 'Catat uang yang Anda pinjamkan supaya mudah menagih dan tidak lupa.', '', 'landmark');
  return L.map(d => {
    const left = dleft(d), p = Math.min(100, dpaid(d) / d.amt * 100), n = d.due ? ndue(d.due) : null, k2 = !left ? 'var(--a1)' : n !== null && n < 0 ? 'var(--rd)' : n !== null && n <= 7 ? 'var(--wr)' : 'var(--mu)';
    return `<div class="card"><div class="rw"><b>${E(d.who)}</b><b>${RM(left)}</b></div><div class="bar"><i style="width:${p}%;background:var(--em)"></i></div>
      <small>Total ${RM(d.amt)}, ${k == 'utang' ? 'sudah dibayar' : 'sudah diterima'} ${RM(dpaid(d))}${d.note ? ', ' + E(d.note) : ''}</small>
      <div class="rw mt-12"><b style="color:${k2}">${!left ? 'Lunas' : d.due ? dtxt(n) + ', ' + fdl(d.due) : 'Tanpa jatuh tempo'}</b><span>${left ? `<button class="bt s" data-dpay="${d.id}">${k == 'utang' ? 'Catat bayar' : 'Catat terima'}</button> ` : ''}<button class="bt s g" data-ddel="${d.id}" aria-label="Hapus ${E(d.who)}">Hapus</button></span></div>
      ${(d.pays || []).length ? `<details class="mt-8"><summary><small>Riwayat (${d.pays.length})</small></summary>${[...d.pays].reverse().map(p => `<div class="rw"><small>${fdl(p.date)}</small><small>${RM(p.amt)}</small></div>`).join('')}</details>` : ''}</div>`
  }).join('')
}
function clList() {
  if (!CL.length) return emp('Belum ada cicilan', 'Catat cicilan motor, HP, KPR, atau tagihan PayLater. Pengingat jatuh tempo ikut masuk ke Notifikasi.', '', 'bill');
  return [...CL].sort((a, b) => (MC.instLeftN(a) == 0) - (MC.instLeftN(b) == 0) || MC.instNext(a).localeCompare(MC.instNext(b))).map(c => {
    const pn = MC.instPaidN(c), left = MC.instLeftN(c), nx = MC.instNext(c), n = ndue(nx), p = Math.min(100, pn / c.months * 100), k2 = !left ? 'var(--a1)' : n < 0 ? 'var(--rd)' : n <= 7 ? 'var(--wr)' : 'var(--mu)';
    return `<div class="card"><div class="rw"><b>${E(c.n)} <span class="tag">${c.k == 'paylater' ? 'PayLater' : 'Cicilan'}</span></b><b>${RM(c.per)}</b></div><div class="bar"><i style="width:${p}%;background:var(--em)"></i></div>
      <small>${left ? 'Angsuran ke-' + (pn + 1) + ' dari ' + c.months + ', sisa ' + RM(MC.instLeft(c)) : 'Semua ' + c.months + ' angsuran sudah dibayar'}, kategori ${E(c.cat)}</small>
      <div class="rw mt-12"><b style="color:${k2}">${!left ? 'Lunas' : dtxt(n) + ', ' + fdl(nx)}</b><span>${left ? `<button class="bt s" data-cpay="${c.id}">Bayar angsuran</button> ` : ''}<button class="bt s g" data-cdel="${c.id}" aria-label="Hapus ${E(c.n)}">Hapus</button></span></div></div>`
  }).join('')
}

/* ---------- Tambah utang / piutang ---------- */
function dtAdd() {
  const d = mkDlg('dtd', `<form id="dtf"><h3 class="ct">${DBT == 'utang' ? 'Tambah utang' : 'Tambah piutang'}</h3>
    <div><label class="lb" for="dtw">${DBT == 'utang' ? 'Berutang kepada' : 'Dipinjam oleh'}</label><input id="dtw" maxlength="40" required placeholder="Nama orang atau lembaga"></div>
    <input id="dta" inputmode="numeric" data-cur autocomplete="off" required aria-label="Jumlah" placeholder="Jumlah (Rp)">
    <div><label class="lb" for="dtu">Jatuh tempo (opsional)</label><input id="dtu" type="date"></div>
    <input id="dtn" maxlength="60" aria-label="Catatan" placeholder="Catatan (opsional)">
    <label class="opt"><input type="checkbox" id="dtc" checked><span><b>${DBT == 'utang' ? 'Uang pinjaman masuk ke dompet saya' : 'Uang keluar dari dompet saya'}</b><small>${DBT == 'utang' ? 'Menambah saldo dompet.' : 'Mengurangi saldo dompet.'} Tidak dihitung sebagai pemasukan/pengeluaran di laporan. Matikan bila hanya ingin mencatat.</small></span></label>
    <select id="dtwl" aria-label="Dompet">${wOpts(defW())}</select>
    <div class="rw"><button type="button" class="bt g" data-close="dtd">Batal</button><button class="bt">Simpan</button></div></form>`);
  $('#dtc').onchange = () => $('#dtwl').hidden = !$('#dtc').checked;
  $('#dtf').onsubmit = e => {
    e.preventDefault(); const who = $('#dtw').value.trim().replace(/[<>&"'\\]/g, '').slice(0, 40), amt = num($('#dta').value), du = $('#dtu').value;
    if (!who || amt <= 0) return toast('Isi nama dan jumlah'); if (du && !/^\d{4}-\d{2}-\d{2}$/.test(du)) return toast('Tanggal jatuh tempo tidak valid');
    const o = { id: 'd' + nid(), k: DBT, who, amt, due: du || '', note: $('#dtn').value.trim().replace(/[<>]/g, '').slice(0, 60), pays: [] };
    if ($('#dtc').checked) o.otx = flow(o, 'open', amt, ds(0), $('#dtwl').value);
    DT.push(o); save(); d.close(); debtView(); toast(DBT == 'utang' ? 'Utang dicatat' : 'Piutang dicatat')
  };
  d.showModal(); $('#dtw').focus()
}
// utang: dibuka = uang masuk, dibayar = uang keluar. piutang: dibuka = uang keluar, dibayar = uang masuk.
function flow(d, kind, amt, date, w) {
  const type = (d.k == 'utang') == (kind == 'open') ? 'in' : 'out', t = nid(), who = d.who;
  T.push({ id: t, tr: t, w, date, type, cat: d.k == 'utang' ? 'Utang' : 'Piutang', desc: (d.k == 'utang' ? (kind == 'open' ? 'Pinjaman dari ' : 'Bayar utang ke ') : (kind == 'open' ? 'Pinjaman ke ' : 'Pelunasan dari ')) + who, amt, debt: d.id }); return t
}
function dtPay(id) {
  const o = DT.find(x => x.id == id), left = dleft(o), has = !!o.otx || (o.pays || []).some(p => p.tx);
  const d = mkDlg('dpd', `<form id="dpf"><h3 class="ct">${o.k == 'utang' ? 'Catat pembayaran' : 'Catat penerimaan'}</h3><small>${E(o.who)}, sisa ${R(left)}</small>
    <input id="dpa" inputmode="numeric" data-cur autocomplete="off" required aria-label="Jumlah" value="${fmtN(left)}">
    <input id="dpt" type="date" aria-label="Tanggal" value="${ds(0)}">
    <label class="opt"><input type="checkbox" id="dpc"${has || !o.pays.length ? ' checked' : ''}><span><b>Catat ke dompet</b><small>${o.k == 'utang' ? 'Mengurangi' : 'Menambah'} saldo dompet yang dipilih.</small></span></label>
    <select id="dpw" aria-label="Dompet">${wOpts(defW())}</select>
    <div class="rw"><button type="button" class="bt g" data-close="dpd">Batal</button><button class="bt">Simpan</button></div></form>`);
  $('#dpc').onchange = () => $('#dpw').hidden = !$('#dpc').checked;
  $('#dpf').onsubmit = e => {
    e.preventDefault(); const amt = num($('#dpa').value), dt = $('#dpt').value || ds(0); if (amt <= 0) return toast('Isi jumlah');
    if (amt > left) return toast('Jumlah melebihi sisa ' + R(left));
    const p = { id: 'p' + nid(), date: dt, amt }; if ($('#dpc').checked) p.tx = flow(o, 'pay', amt, dt, $('#dpw').value);
    o.pays.push(p); save(); d.close(); debtView(); toast(dleft(o) ? 'Pembayaran dicatat' : 'Lunas!')
  };
  d.showModal(); $('#dpa').select()
}
function dtDel(id) {
  const o = DT.find(x => x.id == id), n = T.filter(x => x.debt == id).length;
  ask('Hapus catatan', `Hapus "${o.who}"? ${n ? n + ' catatan arus kas dompet yang terkait ikut dihapus dan saldo dompet kembali seperti sebelum dicatat.' : 'Tidak ada arus kas dompet yang terkait.'}`, 'Ya, hapus', () => { T = T.filter(x => x.debt != id); DT = DT.filter(x => x.id != id); save(); debtView(); toast('Catatan dihapus') })
}

/* ---------- Cicilan / PayLater ---------- */
function clAdd() {
  const nx = MC.addMonths(ds(0), 1), d = mkDlg('cld', `<form id="clf"><h3 class="ct">Tambah cicilan</h3>
    <div><label class="lb" for="cln">Nama</label><input id="cln" maxlength="30" required placeholder="mis. Cicilan motor, Shopee PayLater"></div>
    <select id="clk" aria-label="Jenis"><option value="cicilan">Cicilan (kredit)</option><option value="paylater">PayLater</option></select>
    <input id="clp" inputmode="numeric" data-cur autocomplete="off" required aria-label="Angsuran per bulan" placeholder="Angsuran per bulan (Rp)">
    <input id="clm" type="number" inputmode="numeric" min="1" max="360" required aria-label="Tenor dalam bulan" placeholder="Tenor (bulan), mis. 12">
    <input id="cl0" type="number" inputmode="numeric" min="0" max="359" aria-label="Angsuran yang sudah dibayar" placeholder="Sudah dibayar berapa kali (0 bila baru)">
    <div><label class="lb" for="clu">Jatuh tempo angsuran berikutnya</label><input id="clu" type="date" required value="${nx}"></div>
    <select id="clc" aria-label="Kategori pembayaran">${OUT.map(c => `<option${c == 'Tagihan' ? ' selected' : ''}>${E(c)}</option>`).join('')}</select>
    <select id="clw" aria-label="Dompet pembayaran">${wOpts(defW())}</select>
    <div class="rw"><button type="button" class="bt g" data-close="cld">Batal</button><button class="bt">Simpan</button></div></form>`);
  $('#clf').onsubmit = e => {
    e.preventDefault(); const n = $('#cln').value.trim().replace(/[<>&"'\\]/g, '').slice(0, 30), per = num($('#clp').value), months = Math.round(+$('#clm').value), n0 = Math.round(+$('#cl0').value || 0), first = $('#clu').value;
    if (!n || per <= 0 || !(months >= 1 && months <= 360)) return toast('Isi nama, angsuran, dan tenor (1 sampai 360 bulan)'); if (n0 < 0 || n0 >= months) return toast('Angsuran yang sudah dibayar harus kurang dari tenor'); if (!/^\d{4}-\d{2}-\d{2}$/.test(first)) return toast('Isi tanggal jatuh tempo');
    CL.push({ id: 'c' + nid(), k: $('#clk').value, n, per, months, n0, first, dd: +first.slice(8), cat: $('#clc').value, w: $('#clw').value, pays: [] }); save(); d.close(); debtView(); toast('Cicilan dicatat')
  };
  d.showModal(); $('#cln').focus()
}
function clPay(id) {
  const c = CL.find(x => x.id == id), k = MC.instPaidN(c) + 1, w = W.some(x => x.id == c.w) ? c.w : defW();
  ask('Bayar angsuran', `Catat pembayaran angsuran ke-${k} dari ${c.months} untuk ${c.n} sebesar ${R(c.per)}? Dicatat sebagai pengeluaran (${c.cat}) dari dompet ${wn(w)}.`, 'Ya, catat', () => {
    const t = nid(); T.push({ id: t, w, date: ds(0), type: 'out', cat: OUT.includes(c.cat) ? c.cat : OUT[0], desc: (c.k == 'paylater' ? 'PayLater ' : 'Cicilan ') + c.n + ' (' + k + '/' + c.months + ')', amt: c.per, cl: c.id });
    c.pays.push({ id: 'p' + nid(), date: ds(0), tx: t }); save(); debtView(); toast(MC.instLeftN(c) ? 'Angsuran dicatat' : 'Cicilan lunas!')
  })
}
function clDel(id) {
  const c = CL.find(x => x.id == id);
  ask('Hapus cicilan', `Hapus "${c.n}" dari daftar? Pengeluaran angsuran yang sudah dicatat tetap ada di Transaksi.`, 'Ya, hapus', () => { CL = CL.filter(x => x.id != id); save(); debtView(); toast('Cicilan dihapus') })
}

$('#dbtab').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { DBT = b.dataset.tab; debtView() } };
$('#dbadd').onclick = () => DBT == 'cicilan' ? clAdd() : dtAdd();
$('#dbl').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; const D = b.dataset;
  if (D.dpay) dtPay(D.dpay); else if (D.ddel) dtDel(D.ddel); else if (D.cpay) clPay(D.cpay); else if (D.cdel) clDel(D.cdel)
};
