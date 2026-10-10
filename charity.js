// ---- v23: Tabungan Amal (menu Lainnya). Dimuat malas lewat mod('charity'). ----
// Model data (ikut disinkronkan lewat sync.js, kunci AMAL):
//  AMAL: { id, date, k:'in'|'out', amt, note?, to? }
//   'in'  = menambah saldo Tabungan Amal. Saldo amal TERPISAH dari dompet: tidak mengubah saldo dompet mana pun,
//           tidak masuk Total saldo, dan tidak dibuatkan transaksi. (Catatan lama v23 awal boleh membawa `w` dan `tx`:
//           saat itu uangnya dipindahkan dari dompet; penanganannya dipertahankan agar data lama tidak rusak.)
//   'out' = menyalurkan donasi/sedekah kepada `to`. Mengurangi saldo amal.
// Saldo amal = total 'in' - total 'out' (MiraiCore.amalBal). Aplikasi hanya MENCATAT; pembayaran ke penerima
// dilakukan pengguna lewat kanalnya sendiri (transfer, QRIS, kotak amal).
let CHF = 'all';
const chClean = (v, n) => String(v || '').trim().replace(/[<>&"'\\]/g, '').slice(0, n);

function amalView() {
  const bal = MC.amalBal(AMAL), tin = MC.amalSum(AMAL, 'in'), tout = MC.amalSum(AMAL, 'out'), nOut = AMAL.filter(c => c.k == 'out').length;
  $('#chh').innerHTML = `<small>Saldo Tabungan Amal</small><div class="big nm">${RM(bal)}</div>
    <small>${bal < 0 ? 'Saldo minus. Tambahkan saldo atau hapus catatan penyaluran yang terkait.' : 'Saldo khusus amal, terpisah dari dompet dan tidak dihitung di Total saldo.'}</small>
    <div class="rw jc-start mt-12"><button type="button" class="bt" id="chout"${bal > 0 ? '' : ' disabled'}>${ic('heart', 16)} Salurkan donasi</button><button type="button" class="bt g" id="chin">${ic('plus', 16)} Tambah saldo</button></div>
    ${bal > 0 ? '' : '<small class="mt-8">Tambahkan saldo amal lebih dulu agar bisa disalurkan.</small>'}`;
  $('#chs').innerHTML = `<div class="card"><small>Total ditambahkan</small><div class="big nm">${RM(tin)}</div></div><div class="card"><small>Total disalurkan</small><div class="big nm">${RM(tout)}</div><small>${nOut} kali penyaluran</small></div>`;
  $('#chtab').innerHTML = [['all', 'Semua'], ['out', 'Disalurkan'], ['in', 'Ditambahkan']].map(([k, l]) => `<button type="button" class="bt s${CHF == k ? '' : ' g'}" data-f="${k}" aria-pressed="${CHF == k}">${l}</button>`).join('');
  const L = AMAL.filter(c => CHF == 'all' || c.k == CHF).sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id), undefined, { numeric: true }));
  $('#chl').innerHTML = L.length ? L.map(c => {
    const o = c.k == 'out';
    return `<div class="card"><div class="rw"><b>${o ? 'Disalurkan kepada ' + E(c.to) : c.tx ? 'Disisihkan dari ' + E(wn(c.w)) : 'Saldo ditambahkan'}</b><b class="nm" style="color:${o ? 'var(--tx)' : 'var(--a1)'}">${o ? '\u2212' : '+'}${RM(c.amt)}</b></div>
      <small>${fdl(c.date)}${c.note ? ', ' + E(c.note) : ''}</small>
      <div class="rw mt-12"><span class="tag">${o ? 'Sedekah' : 'Tambah saldo'}</span><button type="button" class="bt s g" data-del="${c.id}" aria-label="Hapus catatan ${o ? 'penyaluran' : 'penambahan saldo'} tanggal ${fdl(c.date)}">Hapus</button></div></div>`
  }).join('') : emp(CHF == 'all' ? 'Belum ada catatan sedekah' : CHF == 'out' ? 'Belum ada donasi yang disalurkan' : 'Belum ada saldo yang ditambahkan', CHF == 'out' ? 'Setelah menyalurkan donasi, riwayatnya muncul di sini.' : 'Tambahkan saldo amal, lalu catat penyalurannya di sini.', '', 'heart');
}

/* ---------- Tambah saldo amal (terpisah dari dompet) ---------- */
function chDlgIn() {
  const d = mkDlg('chd', `<form id="chf"><h3 class="ct">Tambah saldo amal</h3><small>Saldo amal terpisah dari dompet. Menambah saldo di sini tidak mengubah saldo dompet mana pun dan tidak dihitung di laporan.</small>
    <input id="cha" inputmode="numeric" data-cur="1" autocomplete="off" required aria-label="Jumlah" placeholder="Jumlah (Rp)">
    <input id="chdt" type="date" aria-label="Tanggal" value="${ds(0)}">
    <input id="chn" maxlength="60" aria-label="Catatan" placeholder="Catatan (opsional), mis. Zakat, sedekah Jumat">
    <div class="rw"><button type="button" class="bt g" data-close="chd">Batal</button><button class="bt">Simpan</button></div></form>`);
  $('#chf').onsubmit = e => {
    e.preventDefault(); const amt = num($('#cha').value), dt = /^\d{4}-\d{2}-\d{2}$/.test($('#chdt').value) ? $('#chdt').value : ds(0);
    if (amt <= 0) return toast('Isi jumlah');
    AMAL.push({ id: 'h' + nid(), date: dt, k: 'in', amt, note: chClean($('#chn').value, 60) }); save(); d.close(); amalView(); toast('Saldo amal bertambah')
  };
  d.showModal(); $('#cha').focus()
}

/* ---------- Salurkan donasi: Tabungan Amal -> penerima ---------- */
function chDlgOut() {
  const bal = MC.amalBal(AMAL);
  const d = mkDlg('chd', `<form id="chf"><h3 class="ct">Salurkan donasi</h3><small>Saldo Tabungan Amal ${RM(bal)}. Mirai mencatat penyaluran; pembayaran ke penerima Anda lakukan lewat transfer, QRIS, atau kotak amal.</small>
    <div><label class="lb" for="cht">Disalurkan kepada</label><input id="cht" maxlength="40" required placeholder="mis. Masjid Al-Ikhlas, panti asuhan"></div>
    <input id="cha" inputmode="numeric" data-cur="1" autocomplete="off" required aria-label="Jumlah" placeholder="Jumlah (Rp)">
    <input id="chdt" type="date" aria-label="Tanggal" value="${ds(0)}">
    <input id="chn" maxlength="60" aria-label="Catatan" placeholder="Catatan (opsional)">
    <div class="rw"><button type="button" class="bt g" data-close="chd">Batal</button><button class="bt">Simpan</button></div></form>`);
  $('#chf').onsubmit = e => {
    e.preventDefault(); const to = chClean($('#cht').value, 40), amt = num($('#cha').value), dt = /^\d{4}-\d{2}-\d{2}$/.test($('#chdt').value) ? $('#chdt').value : ds(0);
    if (!to || amt <= 0) return toast('Isi penerima dan jumlah');
    if (amt > MC.amalBal(AMAL)) return toast('Saldo Tabungan Amal tidak cukup');
    AMAL.push({ id: 'h' + nid(), date: dt, k: 'out', amt, to, note: chClean($('#chn').value, 60) }); save(); d.close(); amalView(); toast('Donasi dicatat. Semoga berkah!')
  };
  d.showModal(); $('#cht').focus()
}

function chDel(id) {
  const c = AMAL.find(x => x.id == id); if (!c) return;
  if (c.k == 'in' && MC.amalBal(AMAL) - c.amt < 0) return toast('Saldo amal akan minus. Hapus catatan penyaluran lebih dulu');
  const lama = c.k == 'in' && c.tx; // catatan lama: uangnya dulu dipindahkan dari dompet, jadi dikembalikan ke dompet
  ask(c.k == 'in' ? 'Hapus penambahan saldo' : 'Hapus catatan penyaluran',
    c.k == 'in' ? `Hapus penambahan saldo ${R(c.amt)}? Saldo amal berkurang sebesar itu.${lama ? ' Uangnya dikembalikan ke dompet ' + E(wn(c.w)) + '.' : ' Saldo dompet tidak berubah.'}` : `Hapus catatan penyaluran ${R(c.amt)} kepada ${E(c.to)}? Saldo Tabungan Amal bertambah kembali.`,
    'Ya, hapus', () => { if (lama) T = T.filter(x => x.id != c.tx && x.tr != c.tx); AMAL = AMAL.filter(x => x.id != id); save(); amalView(); toast('Catatan dihapus') })
}

$('#chh').onclick = e => { const b = e.target.closest('button'); if (!b || b.disabled) return; if (b.id == 'chin') chDlgIn(); else if (b.id == 'chout') chDlgOut() };
$('#chtab').onclick = e => { const b = e.target.closest('[data-f]'); if (b) { CHF = b.dataset.f; amalView() } };
$('#chl').onclick = e => { const b = e.target.closest('[data-del]'); if (b) chDel(b.dataset.del) };
