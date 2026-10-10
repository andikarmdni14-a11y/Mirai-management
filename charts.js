// ---- v18: modul grafik. Dimuat malas bersama Chart.js lewat mod('charts') di app.js ----
let CH = {};

// Nama dan warna kategori: SATU sumber untuk pie, legenda, dan grafik batang (warna mengikuti urutan kategori di OUT).
const catName = c => (typeof c == 'string' && c.trim()) || 'Tanpa kategori';
const catColor = c => { const i = OUT.indexOf(c); return COL[(i >= 0 ? i : OUT.length + [...c].reduce((h, k) => h + k.charCodeAt(0), 0)) % COL.length] };

// Sumbu waktu dinamis: mulai dari bulan transaksi PERTAMA yang masuk jendela n bulan, sampai bulan ini.
// Tanpa bulan kosong di awal. Transfer antar-dompet tidak dihitung. Minimal 1 bulan.
function mon(n) {
  const d0 = new Date(), mk = d => (d0.getFullYear() - d.getFullYear()) * 12 + d0.getMonth() - d.getMonth();
  let k0 = 0; T.forEach(x => { if (x.tr) return; const k = mk(new Date(x.date + 'T00:00')); if (k >= 0 && k < n && k > k0) k0 = k });
  n = k0 + 1; const L = [], I = Array(n).fill(0), X = Array(n).fill(0), K = {}; OUT.forEach(c => K[c] = Array(n).fill(0));
  for (let i = 0; i < n; i++)L.push(new Date(d0.getFullYear(), d0.getMonth() - n + 1 + i, 1).toLocaleDateString('id-ID', { month: 'short' }));
  T.forEach(x => { if (x.tr) return; const k = mk(new Date(x.date + 'T00:00')); if (k < 0 || k >= n) return; const j = n - 1 - k, v = x.amt / 1e6; if (x.type == 'in') I[j] += v; else { X[j] += v; (K[catName(x.cat)] ??= Array(n).fill(0))[j] += v } }); return [L, I, X, K]
}
const ln = (label, data, col, fill = false) => ({ label, data, borderColor: col, borderWidth: 1.5, tension: 0, cubicInterpolationMode: 'monotone', fill, pointRadius: data.length < 2 ? 4 : 0, pointHoverRadius: 4, pointHoverBackgroundColor: col, pointBackgroundColor: col, backgroundColor: c => { const g = c.chart.ctx.createLinearGradient(0, 0, 0, c.chart.height); g.addColorStop(0, col + '24'); g.addColorStop(1, col + '00'); return g } });
const LGL = chart => chart.data.datasets.map((d, i) => ({ text: d.label, fillStyle: d.borderColor, strokeStyle: d.borderColor, lineWidth: 0, pointStyle: 'circle', hidden: !chart.isDatasetVisible(i), datasetIndex: i }));
function ch(id, cfg) {
  const cvs = document.getElementById(id);
  // 1) Null check: kanvas harus ada dan terpasang di DOM, dan library Chart.js harus termuat
  if (!window.Chart || !cvs || !cvs.isConnected || cvs.tagName != 'CANVAS') { if (CH[id]) { CH[id].destroy(); delete CH[id] } return null }
  // 2) Hancurkan instance lama (milik registri CH maupun yang masih menempel di kanvas ini)
  const old = Chart.getChart(cvs); if (old) old.destroy();
  if (CH[id] && CH[id] !== old) { try { CH[id].destroy() } catch (e) { } }
  const c = getComputedStyle(root); Chart.defaults.color = c.getPropertyValue('--mu'); Chart.defaults.borderColor = c.getPropertyValue('--bd'); Chart.defaults.font.family = "'Geist','Inter',sans-serif"; Chart.defaults.plugins.tooltip.enabled = !HB; Object.assign(Chart.defaults.plugins.tooltip, { backgroundColor: '#09090B', borderColor: '#27272A', borderWidth: 1, titleColor: '#FAFAFA', bodyColor: '#A1A1AA', padding: 10, cornerRadius: 8, boxPadding: 4 }); cfg.options = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, generateLabels: c => ((Chart.overrides[c.config.type]?.plugins?.legend?.labels?.generateLabels) || Chart.defaults.plugins.legend.labels.generateLabels)(c).map(l => { const d = c.data.datasets[l.datasetIndex]; if (c.config.type === 'line' && d && typeof d.borderColor === 'string') { l.fillStyle = d.borderColor; l.strokeStyle = d.borderColor } return l }) } } }, ...cfg.options }; if (cfg.type === 'line' && cfg.options.plugins && cfg.options.plugins.legend && cfg.options.plugins.legend.labels) cfg.options.plugins.legend.labels.generateLabels = LGL; try { CH[id] = new Chart(cvs, cfg) } catch (e) { console.error('Gagal membuat grafik #' + id, e); CH[id] = null } return CH[id]
}
// 3) Bebaskan grafik milik halaman yang sedang disembunyikan (cegah memory leak)
function pruneCharts() { Object.keys(CH).forEach(k => { const c = document.getElementById(k), s = c && c.closest('section'); if (!c || !c.isConnected || (s && s.hidden)) { try { if (CH[k]) CH[k].destroy() } catch (e) { } delete CH[k] } }) }
const jt = { y: { ticks: { callback: v => v + ' jt', get display() { return !HB } } } };

// Data pie dihitung langsung dari transaksi bulan ini (bukan dari OUT) sehingga selalu sama dengan total "Pengeluaran bulan ini".
function pieData() {
  const g = {}; T.forEach(x => { if (x.tr || x.type != 'out' || !mo(x)) return; const k = catName(x.cat); g[k] = (g[k] || 0) + (+x.amt || 0) });
  const rows = Object.entries(g).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([name, amt]) => ({ name, amt, color: catColor(name) })), tot = rows.reduce((s, r) => s + r.amt, 0);
  if (!tot) return { rows: [], tot: 0 };
  const raw = rows.map(r => r.amt / tot * 100), fl = raw.map(Math.floor); let sisa = 100 - fl.reduce((a, b) => a + b, 0);
  raw.map((v, i) => [v - fl[i], i]).sort((a, b) => b[0] - a[0]).slice(0, sisa).forEach(([, i]) => fl[i]++);
  rows.forEach((r, i) => r.pct = fl[i]); return { rows, tot }
}
// Legenda pie berupa HTML (bukan legenda bawaan Chart.js): teks kategori, warna, persentase, dan nominal berasal dari array yang sama dengan dataset.
function pieLegend(rows) {
  $('#pielg').innerHTML = rows.map(r => `<li><i class="dot" style="background:${r.color}"></i><span class="nm">${E(r.name)}</span><b class="pc">${r.pct || '<1'}%</b><span class="am">${RM(r.amt)}</span></li>`).join('')
}

function drawDash() {
  const { rows } = pieData(), [L, I, X] = mon(6), has = rows.length > 0;
  $('#piecv').hidden = !has; $('#pielg').hidden = !has; $('#pieem').hidden = has; $('#trn').hidden = L.length > 1;
  if (has) {
    pieLegend(rows); $('#pie').setAttribute('aria-label', 'Diagram lingkaran pengeluaran per kategori bulan ini: ' + rows.map(r => r.name + ' ' + (r.pct || '<1') + ' persen').join(', '));
    ch('pie', { type: 'pie', data: { labels: rows.map(r => r.name), datasets: [{ data: rows.map(r => r.amt), backgroundColor: rows.map(r => r.color), borderColor: cv('--cd'), borderWidth: 2 }] }, options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + c.label + ': ' + R(c.parsed) } } } } })
  } else if (CH.pie) { try { CH.pie.destroy() } catch (e) { } delete CH.pie }
  ch('line', { type: 'line', data: { labels: L, datasets: [ln('Pemasukan', I, cv('--a1'), true), ln('Pengeluaran', X, cv('--a2'))] }, options: { scales: jt } })
}
