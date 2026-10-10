// ---- v18: modul Laporan, ekspor, dan cadangan data. Dimuat malas saat Laporan dibuka (butuh charts.js) ----
// Laporan: sumbu X dinamis (lihat mon), dan keadaan kosong bila belum ada transaksi.
let yr = false;
function rep() {
  const n = yr ? 12 : 6, [L, I, X, K] = mon(n), a = I.reduce((p, q) => p + q, 0), b = X.reduce((p, q) => p + q, 0), has = T.some(x => !x.tr);
  $('#r6').classList.toggle('g', yr); $('#r12').classList.toggle('g', !yr);
  $('#rs').innerHTML = `<div class="card"><small>Total pemasukan</small><div class="big in">${R(a * 1e6)}</div></div><div class="card"><small>Total pengeluaran, rata-rata ${R(b / L.length * 1e6)} per bulan</small><div class="big">${R(b * 1e6)}</div></div><div class="card"><small>Tingkat tabungan</small><div class="big">${a ? Math.round((1 - b / a) * 100) : 0}%</div></div>`;
  $('#rcharts').hidden = !has; $('#rempty').hidden = has;
  if (!has) { $('#rempty').innerHTML = emp('Belum ada data laporan', 'Grafik muncul setelah Anda mencatat transaksi pertama.', '<button class="bt" onclick="fab.click()">Catat transaksi</button>', 'rep'); pruneCharts(); return }
  ch('bar', { type: 'bar', data: { labels: L, datasets: [{ label: 'Pemasukan', data: I, backgroundColor: cv('--a1'), borderRadius: 4, maxBarThickness: 56 }, { label: 'Pengeluaran', data: X, backgroundColor: cv('--a2'), borderRadius: 4, maxBarThickness: 56 }] }, options: { scales: jt } });
  let z = OPT() + sum('in') - sum('out') - (a - b) * 1e6;
  ch('bal2', { type: 'line', data: { labels: L, datasets: [ln('Saldo', I.map((v, i) => (z += (v - X[i]) * 1e6) / 1e6), cv('--a1'), true)] }, options: { scales: jt, plugins: { legend: { display: false } } } });
  ch('rcat', { type: 'bar', data: { labels: L, datasets: Object.keys(K).filter(c => K[c].some(v => v > 0)).map(c => ({ label: c, data: K[c], backgroundColor: catColor(c) })) }, options: { scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: v => v + ' jt' } } } } })
}
$('#r6').onclick = () => { yr = false; rep() }; $('#r12').onclick = () => { yr = true; rep() };
function csv() { const r = ['Tanggal,Tipe,Dompet,Kategori,Deskripsi,Jumlah,Ruang', ...sorted().map(x => [x.date, x.type == 'in' ? 'Pemasukan' : 'Pengeluaran', wn(x.w), x.cat, '"' + x.desc.replace(/"/g, '""') + '"', x.amt, x.sh ? 'Bersama' : 'Pribadi'].join(','))], a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + r.join('\n')], { type: 'text/csv' })); a.download = 'transaksi-mirai.csv'; a.click() }
$('#csvb').onclick = csv;

const bkDate = () => new Date().toLocaleDateString('sv-SE'), bkName = e => 'Mirai_Backup_' + bkDate() + '.' + e;
const bkSave = (b, n) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = n; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1e3) };
const bkData = () => { cacheNow(); const d = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('mm_') && !k.startsWith('mm_lock')) d[k] = localStorage.getItem(k) } return d };
$('#bkp').onclick = () => { bkSave(new Blob([JSON.stringify({ app: 'Mirai', v: 1, at: new Date().toISOString(), data: bkData() }, null, 1)], { type: 'application/json' }), bkName('json')); toast('Cadangan data berhasil diunduh') };
$('#bkc').onclick = () => { const q = s => '"' + String(s).replace(/"/g, '""') + '"', r = ['Kunci,Nilai', ...Object.entries(bkData()).map(([k, v]) => q(k) + ',' + q(v))]; bkSave(new Blob(['\ufeff' + r.join('\n')], { type: 'text/csv' }), bkName('csv')); toast('Cadangan CSV berhasil diunduh') };
$('#bkf').onclick = async () => {
  if (!window.jspdf) await loadScript(PDF_LIB).catch(() => { });
  if (!window.jspdf) return toast('Gagal membuat PDF: pustaka belum termuat, coba saat online');
  const d = new window.jspdf.jsPDF(), L = sorted(), c = [14, 38, 54, 82, 108], rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID'); let y = 18;
  d.setFontSize(16); d.text('Cadangan Data Mirai Management', 14, y); y += 8; d.setFontSize(9); d.text('Dibuat ' + bkDate() + ' | ' + US + ' | ' + L.length + ' transaksi', 14, y); y += 9;
  [['Tanggal', 'Tipe', 'Dompet', 'Kategori', 'Deskripsi', 'Jumlah'], ...L.map(x => [x.date, x.type == 'in' ? 'Masuk' : 'Keluar', wn(x.w), x.cat, x.desc, rp(x.amt)])].forEach((r, n) => { if (y > 282) { d.addPage(); y = 16 } d.setFont(undefined, n ? 'normal' : 'bold'); r.slice(0, 5).forEach((t, i) => d.text(String(t).slice(0, i == 2 || i == 3 ? 14 : 30), c[i], y)); d.text(r[5], 196, y, { align: 'right' }); y += 6 });
  d.save(bkName('pdf')); toast('Cadangan PDF berhasil diunduh')
};
$('#rsb').onclick = () => $('#rsf').click();
$('#rsf').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  let b;
  try { b = JSON.parse(await f.text()); }
  catch (x) { return toast('Gagal memulihkan: berkas bukan JSON yang valid'); }
  const d = b && b.app == 'Mirai' && b.data;
  if (!d || typeof d != 'object' || Object.values(d).some(v => typeof v != 'string'))
    return toast('Gagal memulihkan: berkas bukan cadangan Mirai yang valid');
  const kp = Object.keys(localStorage).filter(k => k.startsWith('mm_lock')).map(k => [k, localStorage[k]]);
  localStorage.clear(); kp.forEach(([k, v]) => localStorage.setItem(k, v));
  Object.entries(d).forEach(([k, v]) => localStorage.setItem(k, v));
  location.reload();
};
