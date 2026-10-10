const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)], m = $('#m'), root = document.documentElement;
const R = n => (n < 0 ? '−' : '') + 'Rp' + Math.abs(Math.round(n)).toLocaleString('id-ID'), E = s => String(s).replace(/[&<>"]/g, c => '&#' + c.charCodeAt(0) + ';');
const ds = d => { const t = new Date(Date.now() - d * 864e5); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0') }, fd = s => new Date(s + 'T00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
const DO = ['Makanan', 'Transportasi', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan'], DI = ['Gaji', 'Freelance', 'Lainnya']; let OUT = [...DO], IN = [...DI]; const COL = ['#3B82F6', '#1E3A8A', '#93C5FD', '#2563EB', '#DBEAFE', '#60A5FA', '#1E40AF'];
let US = '', UID = '', T = [], OP = 0, BL = [], EM = false, W = [], LK = [], RL = [], TM = [], DT = [], CL = [], AMAL = [];
const MC = MiraiCore, mkDlg = (id, html) => { let d = document.getElementById(id); if (!d) { d = document.createElement('dialog'); d.id = id; document.getElementById('app').append(d) } d.innerHTML = html; return d }, allCats = () => [...OUT, ...IN], catsOf = t => t == 'in' ? IN : OUT;
const nid = MiraiCore.makeNid(), clone = o => JSON.parse(JSON.stringify(o)); // v22: id numerik yang selalu naik (impor banyak baris tidak bentrok)
let B = {};
let G = [];
function apply(d) { T = d.T || []; B = d.B || {}; G = (d.G || []).map(g => { g.id ??= 'g' + MiraiCore.hash(g.n + '|' + g.t); return g }); OUT = d.OUT || [...DO]; IN = d.IN || [...DI]; OP = d.OP || 0; BL = (d.BL || []).map(mig); EM = !!d.EM; LK = d.LK || []; RL = d.RL || []; TM = d.TM || []; DT = d.DT || []; CL = d.CL || []; AMAL = d.AMAL || []; W = d.W || [{ id: 'w1', n: 'Uang Tunai', o: 0 }, { id: 'w2', n: 'Rekening Bank', o: OP }, { id: 'w3', n: 'e-Wallet', o: 0 }]; $('#em2').checked = EM; OUT.forEach(c => B[c] ??= 1e6) }
// cacheNow, save, dan sinkronisasi ada di sync.js (v22)
const P = {
  dash: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  tx: '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
  bud: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  goal: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  bill: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  rep: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  dl: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>', up: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/>',
  up: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  down: '<path d="M17 7 7 17"/><path d="M17 17H7V7"/>',
  alert: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  banknote: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  landmark: '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  pair: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  award: '<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  trend: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  sparkles: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>'
};
const ic = (n, z = 18) => `<svg class="i" width="${z}" height="${z}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
$$('[data-i]').forEach(e => e.outerHTML = ic(e.dataset.i));
const N = [['dash', 'dash', 'Ringkasan', 'Halo, Raka'], ['tx', 'tx', 'Transaksi', 'Riwayat transaksi'], ['bud', 'bud', 'Anggaran', 'Anggaran bulanan'], ['goal', 'goal', 'Tujuan', 'Tujuan keuangan'], ['bill', 'bill', 'Tagihan', 'Tagihan berulang'], ['rep', 'rep', 'Laporan', 'Laporan dan ekspor'], ['sp', 'pair', 'Ruang Bersama', 'Ruang Bersama'], ['debt', 'landmark', 'Utang & Cicilan', 'Utang, piutang, dan cicilan'], ['auto', 'sparkles', 'Otomatis', 'Aturan, template, dan impor'], ['amal', 'heart', 'Tabungan Amal', 'Tabungan amal dan sedekah']];
const mo = x => x.date.slice(0, 7) == ds(0).slice(0, 7), sum = (t, p) => T.filter(x => !x.tr && x.type == t && (!p || mo(x))).reduce((a, x) => a + x.amt, 0), spent = c => T.filter(x => x.type == 'out' && x.cat == c && mo(x)).reduce((a, x) => a + x.amt, 0), sorted = () => [...T].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
const pc = () => getComputedStyle(root).getPropertyValue('--pr').trim();
const sg = n => n == 'in' ? '+' : '−', row = x => `<div class="li"><span class="ic ${x.type}">${ic(x.type == 'in' ? 'down' : 'up', 15)}</span><div><b>${E(x.desc)}</b><small>${x.cat}, ${wn(x.w)}, ${fd(x.date)}${x.sh ? ', Bersama' : ''}</small></div><b class="${x.type == 'in' ? 'in' : ''}">${sg(x.type)}${RM(x.amt)}</b></div>`;
const emp = (t, s, b = '', i = 'bud') => `<div class="empty"><div class="orb">${ic(i, 20)}</div><h3>${t}</h3><p>${s}</p>${b}</div>`;
const cv = n => getComputedStyle(root).getPropertyValue(n).trim();

// ---- v18: modul fitur dimuat malas (code splitting) ----
// Grafik (Chart.js), Laporan/ekspor/cadangan, dan Ruang Bersama tidak dimuat sampai benar-benar dibuka.
const CHART_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js', QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js', PDF_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const MODS = {};
const mod = n => MODS[n] ??= (n == 'charts' ? Promise.all([loadScript('charts.js'), loadScript(CHART_LIB)]) : n == 'reports' ? Promise.all([loadScript('reports.js'), mod('charts')]) : loadScript(n + '.js')).then(() => { }).catch(e => { delete MODS[n]; throw e });
const failMod = () => toast('Gagal memuat halaman. Periksa koneksi Anda.');
let DIO;
// Gambar grafik Ringkasan: langsung bila modul sudah ada, jika belum tunggu kartu grafik mendekati layar lalu muat modulnya.
function dashCharts() {
  const box = $('#dm'); if (DIO) DIO.disconnect(); if (!box || box.hidden) return;
  if (window.Chart && typeof drawDash == 'function') return drawDash();
  const run = () => mod('charts').then(() => cur == 'dash' && drawDash()).catch(() => { });
  if (!('IntersectionObserver' in window)) return run();
  DIO = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { DIO.disconnect(); run() } }, { rootMargin: '200px 0px' }); DIO.observe(box)
}
let cur = 'dash';
function renW(id) { const w = W.find(x => x.id == id); pbox('Ubah nama dompet', [{ l: 'Nama dompet', v: w.n }], ([a]) => { const n = a.trim().replace(/[<>&"'\\]/g, '').slice(0, 20); if (!n) return toast('Isi nama dompet'); w.n = n; save(); cats(); go(cur); toast('Nama dompet diperbarui') }) }
function delW(id) {
  if (W.length < 2) return toast('Minimal harus ada satu dompet'); const w = W.find(x => x.id == id), d = W.find(x => x.id != id);
  ask('Hapus dompet', `Hapus dompet "${w.n}"? Seluruh transaksi dan saldo awalnya akan dipindahkan ke "${d.n}".`, 'Ya, hapus', () => { T.forEach(x => { if ((x.w || 'w2') == id) x.w = d.id }); d.o += w.o; W = W.filter(x => x.id != id); save(); cats(); go(cur); toast('Dompet berhasil dihapus') })
}
function xfer() { if (W.length < 2) return toast('Butuh minimal dua dompet'); const o = W.map(w => `<option value="${w.id}">${w.n}</option>`).join(''); $('#xa').innerHTML = o; $('#xb').innerHTML = o; $('#xb').selectedIndex = 1; $('#xe').textContent = ''; $('#xd').showModal() }
$('#xf').onsubmit = e => {
  e.preventDefault(); const a = $('#xa').value, b = $('#xb').value, v = num($('#xm').value), A = W.find(w => w.id == a), Z = W.find(w => w.id == b);
  if (a == b) return $('#xe').textContent = 'Pilih dua dompet yang berbeda.'; if (!v) return $('#xe').textContent = 'Isi jumlah transfer.'; if (v > wb(A)) return $('#xe').textContent = 'Saldo ' + A.n + ' tidak cukup (' + R(wb(A)) + ').';
  const t = nid(), t2 = nid(), d = ds(0); T.push({ id: t, tr: t, w: a, date: d, type: 'out', cat: 'Transfer', desc: 'Transfer ke ' + Z.n, amt: v }, { id: t2, tr: t, w: b, date: d, type: 'in', cat: 'Transfer', desc: 'Transfer dari ' + A.n, amt: v });
  save(); $('#xd').close(); e.target.reset(); toast('Transfer dicatat'); go(cur)
};
let HB = localStorage.mm_hide == '1';
const RM = n => HB ? '\u2022\u2022\u2022\u2022\u2022\u2022' : R(n);
const num = v => +String(v).replace(/\./g, '') || 0, fmtN = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
function eyeUp() { const b = $('#eye'); b.innerHTML = ic(HB ? 'eyeoff' : 'eye', 16); b.setAttribute('aria-pressed', String(HB)); b.setAttribute('aria-label', HB ? 'Tampilkan saldo' : 'Sembunyikan saldo') }
$('#eye').onclick = () => { HB = !HB; localStorage.mm_hide = HB ? '1' : '0'; eyeUp(); dash() }; eyeUp();
const wI = { w1: 'banknote', w2: 'landmark', w3: 'smartphone' };
// v25: warna kartu dompet mengikuti bank/e-wallet. Dipakai juga oleh accounts.js (BK). Palet perkiraan dari identitas visual tiap institusi,
// sudah digelapkan seperlunya agar teks di kartu tetap terbaca (kontras minimal 4,5:1). k = kata kunci nama dompet yang cocok.
const BKC = {
  bca: { c1: '#0A5CA8', c2: '#073F72', fg: '#fff', k: ['bca'] },
  bri: { c1: '#0A5EB0', c2: '#074078', fg: '#fff', k: ['bri', 'brimo'] },
  bni: { c1: '#00838B', c2: '#00595F', fg: '#fff', k: ['bni'] },
  mandiri: { c1: '#0B5FA5', c2: '#074170', fg: '#fff', k: ['mandiri', 'livin'] },
  jago: { c1: '#FFC81F', c2: '#E6B41C', fg: '#2B2200', k: ['jago'] },
  superbank: { c1: '#188751', c2: '#105C37', fg: '#fff', k: ['superbank'] },
  bsi: { c1: '#00847F', c2: '#005A56', fg: '#fff', k: ['bsi'] },
  cimb: { c1: '#E71B23', c2: '#9D1218', fg: '#fff', k: ['cimb', 'niaga'] },
  permata: { c1: '#008842', c2: '#005C2D', fg: '#fff', k: ['permata'] },
  danamon: { c1: '#C2561A', c2: '#843A12', fg: '#fff', k: ['danamon'] },
  ocbc: { c1: '#E2231A', c2: '#9A1812', fg: '#fff', k: ['ocbc'] },
  maybank: { c1: '#FFC20E', c2: '#E6AF0D', fg: '#2B2200', k: ['maybank'] },
  seabank: { c1: '#C2510E', c2: '#84370A', fg: '#fff', k: ['seabank'] },
  blu: { c1: '#007FAF', c2: '#005677', fg: '#fff', k: ['blu'] },
  jenius: { c1: '#007DA6', c2: '#005571', fg: '#fff', k: ['jenius'] },
  dana: { c1: '#0F7AC9', c2: '#0A5389', fg: '#fff', k: ['dana'] },
  gopay: { c1: '#00880F', c2: '#005C0A', fg: '#fff', k: ['gopay'] },
  ovo: { c1: '#4C2A86', c2: '#341D5B', fg: '#fff', k: ['ovo'] },
  shopeepay: { c1: '#D14428', c2: '#8E2E1B', fg: '#fff', k: ['shopeepay', 'spay'] },
  linkaja: { c1: '#E32428', c2: '#9A181B', fg: '#fff', k: ['linkaja'] }
};
// dompet bawaan (belum bernama bank) dan cadangan bila nama tidak cocok dengan bank mana pun (dipilih tetap menurut nama)
const WDEF = { w1: { c1: '#1A845A', c2: '#125A3D', fg: '#fff' }, w2: { c1: '#4F5BD5', c2: '#363E91', fg: '#fff' }, w3: { c1: '#C93C95', c2: '#892965', fg: '#fff' } };
const WFB = [{ c1: '#64748B', c2: '#444F5F', fg: '#fff' }, { c1: '#E11D48', c2: '#991431', fg: '#fff' }, { c1: '#B26205', c2: '#794303', fg: '#fff' }, { c1: '#07809D', c2: '#05576B', fg: '#fff' }, { c1: '#7C3AED', c2: '#5427A1', fg: '#fff' }, { c1: '#51820A', c2: '#375807', fg: '#fff' }];
function wcol(w) {
  const tk = String(w.n || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean), j = tk.join(''), ids = Object.keys(BKC);
  for (const t of tk) { const i = ids.find(x => BKC[x].k.includes(t)); if (i) return BKC[i] }                          // kata utuh: "Tabungan BCA", "Bank Jago"
  if (j.length >= 5) { const i = ids.find(x => BKC[x].k.some(k => k.length >= 5 && j.includes(k))); if (i) return BKC[i] }  // dieja terpisah: "Go Pay", "Sea Bank"
  return WDEF[w.id] || WFB[parseInt(MiraiCore.hash(String(w.n || w.id)), 36) % WFB.length]
}
const wvar = k => `--c1:${k.c1};--c2:${k.c2};--fg:${k.fg}`;
const wb = w => w.o + T.filter(x => (x.w || 'w2') == w.id).reduce((a, x) => a + (x.type == 'in' ? x.amt : -x.amt), 0), wt = () => W.reduce((a, w) => a + wb(w), 0) + LK.reduce((a, l) => a + (l.x ? 0 : l.b), 0), OPT = () => W.reduce((a, w) => a + w.o, 0), wn = id => (W.find(w => w.id == (id || 'w2')) || { n: 'Dompet' }).n;
// v25: Dompet = slide geser (scroll-snap) berisi kartu berwarna. Titik/panah/tombol panah keyboard mengikuti posisi geser.
// Posisi geser (WSL) dipertahankan saat kartu digambar ulang (wallets() lalu lnkRender() bisa terjadi berurutan dan sempat menyempitkan isi).
let WSL = 0, WLK = 0;
const wstep = () => { const c = $('#wl').children; return c.length > 1 ? c[1].offsetLeft - c[0].offsetLeft : (c[0] ? c[0].offsetWidth : 1) || 1 };
const wcur = () => { const l = $('#wl'), n = l.children.length; return !n ? 0 : l.scrollLeft + l.clientWidth >= l.scrollWidth - 2 ? n - 1 : Math.min(n - 1, Math.round(l.scrollLeft / wstep())) };
const wgo = (i, f) => $('#wl').scrollTo({ left: i * wstep(), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches || f ? 'auto' : 'smooth' });
function wslUpdate() {
  const l = $('#wl'), v = $('#wnv'), n = l.children.length; if (!v) return;
  const more = l.clientWidth > 0 && l.scrollWidth > l.clientWidth + 2; v.hidden = !more; if (!more) return;
  const a = wcur(), name = e => e.classList.contains('add') ? 'Tambah dompet' : (e.querySelector('.wn > span:last-child') || {}).textContent || 'Dompet';
  $('#wdt').innerHTML = n > 8 ? `<span class="wnc" aria-live="polite">${a + 1} / ${n}</span>` : [...l.children].map((e, i) => `<button type="button" data-i="${i}" aria-label="${name(e)}, ${i + 1} dari ${n}"${i == a ? ' aria-current="true"' : ''}></button>`).join('');
  $('#wpv').disabled = a <= 0; $('#wnx').disabled = l.scrollLeft + l.clientWidth >= l.scrollWidth - 2
}
// v26: style.css dimuat tanpa memblokir render. Bila kartu sempat digambar sebelum CSS terpasang, ukurannya berubah belakangan dan penunjuk (#wdt)
// tidak pernah dihitung ulang sampai pengguna menggeser (panah/titik tidak muncul di koneksi lambat). ResizeObserver menghitung ulang saat ukuran berubah.
let wro = null, wrq = 0;
function wslWatch() {
  if (typeof ResizeObserver != 'function') return; const l = $('#wl');
  if (!wro) wro = new ResizeObserver(() => { cancelAnimationFrame(wrq); wrq = requestAnimationFrame(wslUpdate) });
  wro.disconnect(); wro.observe(l); [...l.children].forEach(c => wro.observe(c))
}
addEventListener('load', () => requestAnimationFrame(wslUpdate));
function wslKeep(f) { const l = $('#wl'); WLK = 1; f(); l.scrollLeft = WSL; wslUpdate(); wslWatch(); requestAnimationFrame(() => { WLK = 0; wslUpdate() }) }
{
  let q = 0; const l = $('#wl');
  l.addEventListener('scroll', () => { if (WLK || q) return; q = requestAnimationFrame(() => { q = 0; if (!WLK) WSL = l.scrollLeft; wslUpdate() }) }, { passive: true });
  l.addEventListener('keydown', e => { if (e.target !== l || (e.key != 'ArrowRight' && e.key != 'ArrowLeft')) return; e.preventDefault(); wgo(Math.max(0, wcur() + (e.key == 'ArrowRight' ? 1 : -1))) });
  $('#wnv').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; wgo(b.id == 'wpv' ? Math.max(0, wcur() - 1) : b.id == 'wnx' ? Math.min(l.children.length - 1, wcur() + 1) : +b.dataset.i) });
  let r = 0; addEventListener('resize', () => { cancelAnimationFrame(r); r = requestAnimationFrame(wslUpdate) })
}
function wallets() { const t = Math.max(wt(), 1); wslKeep(() => { $('#wl').innerHTML = W.map(w => { const b = wb(w); return `<div class=\"wc\" style=\"${wvar(wcol(w))}\"><small class=\"wn\">${ic(wI[w.id] || 'bud', 14)}<span>${w.n}</span></small><div class=\"big\">${RM(b)}</div><small>${Math.round(Math.max(b, 0) / t * 100)}% dari total saldo</small><span class=\"wa\"><button onclick=\"renW('${w.id}')\" aria-label=\"Ubah nama ${w.n}\">${ic('pencil', 14)}</button><button onclick=\"delW('${w.id}')\" aria-label=\"Hapus ${w.n}\">${ic('trash', 14)}</button></span></div>` }).join('') + `<button class=\"wc add\" onclick=\"addW()\">${ic('plus', 16)}<span>Tambah dompet</span></button>` }) }
function addW() { pbox('Tambah dompet', [{ l: 'Nama dompet', v: '' }, { l: 'Saldo awal (Rp)', v: '0', c: 1 }], ([a, b]) => { const n = a.trim().replace(/[<>&"'\\]/g, '').slice(0, 20); if (!n) return toast('Isi nama dompet'); W.push({ id: 'w' + Date.now(), n, o: num(b) }); save(); cats(); go(cur); toast('Dompet berhasil ditambahkan') }) }
function streak() {
  const has = new Set(T.filter(x => !x.tr).map(x => x.date)), D = [...has].sort(), dn = s => Math.round(new Date(s + 'T00:00') / 864e5), td = ds(0), done = has.has(td); let n = 0, k = done ? 0 : 1; while (has.has(ds(k))) { n++; k++ }
  let best = 0, run = 0, prev = null; D.forEach(s => { run = prev !== null && dn(s) - prev == 1 ? run + 1 : 1; prev = dn(s); best = Math.max(best, run) }); const p = n ? ((n - 1) % 7) + 1 : 0;
  $('#stn').textContent = n + ' hari'; $('#rn').textContent = p + '/7'; $('#stt').textContent = done ? 'Hari ini sudah tercatat. Rekor terbaik ' + best + ' hari.' : n ? 'Catat transaksi hari ini agar streak ' + n + ' hari tidak terputus.' : 'Catat transaksi hari ini untuk memulai streak.';
  $('#rf').style.strokeDashoffset = 100 * (1 - p / 7);
  if (done && localStorage.mm_shine != td) { localStorage.mm_shine = td; const c = $('#stk'); c.classList.remove('shine'); void c.offsetWidth; c.classList.add('shine') }
}
let IT = 0, ITt;
function insights() {
  const d = new Date(), dd = d.getDate(), D = dim(d.getFullYear(), d.getMonth()), r = D - dd, pk = new Date(d.getFullYear(), d.getMonth() - 1, 1), pm = pk.getFullYear() + '-' + String(pk.getMonth() + 1).padStart(2, '0'), cm = ds(0).slice(0, 7), A = n => `<span class="nm">${RM(n)}</span>`;
  // Bandingkan periode yang sama (tanggal 1 sampai hari ini) agar bulan berjalan tidak dibandingkan dengan bulan lalu yang penuh
  const ex = (k, to) => T.filter(x => !x.tr && x.type == 'out' && x.date.slice(0, 7) == k && +x.date.slice(8) <= to).reduce((s, x) => s + x.amt, 0), o = ex(cm, dd), p = ex(pm, dd), L = [];
  OUT.forEach(c => {
    const b = B[c], s = spent(c); if (!b || !s) return; const left = b - s, rate = s / dd;
    if (left <= 0) L.push([3, 'warn', `Anggaran <b>${E(c)}</b> sudah terlampaui ${A(-left)}. Tahan dulu pengeluaran di pos ini sampai akhir bulan.`]);
    else if (r > 0 && s + rate * r > b) L.push([2, 'warn', `Batas anggaran <b>${E(c)}</b> sisa ${A(left)} untuk ${r} hari ke depan. Dengan pola sekarang (${A(rate)} per hari), dananya habis sekitar ${Math.floor(left / rate)} hari lagi. Batasi maksimal ${A(left / r)} per hari, yuk lebih hemat!`])
  });
  const up = dues().filter(x => x.k != 'pt' && due(x) >= 0 && due(x) <= 7); if (up.length) L.push([2, 'bill', `${up.length} kewajiban (tagihan, cicilan, utang) senilai ${A(up.reduce((s, b) => s + b.a, 0))} jatuh tempo dalam 7 hari ke depan.`]);
  if (dd >= 3 && p > 0 && o > 0) { const pct = Math.round((1 - o / p) * 100); if (pct >= 5) L.push([0, 'award', `Bulan ini kamu berhasil berhemat ${pct}% dari bulan lalu pada periode yang sama (tanggal 1 sampai ${dd}).`]); else if (pct <= -10) L.push([1, 'trend', `Pengeluaranmu ${-pct}% lebih tinggi dari bulan lalu pada periode yang sama.`]) }
  const i = sum('in', 1); if (i && o && r > 0) { const pr = o / dd * D; L.push([pr > i ? 2 : 0, pr > i ? 'warn' : 'trend', `Jika pola ini berlanjut, pengeluaran akhir bulan sekitar ${A(pr)}, ${pr > i ? 'melebihi' : 'masih di bawah'} pemasukanmu bulan ini.`]) }
  if (!L.length) L.push([0, 'sparkles', 'Catat beberapa transaksi lagi, dan analisis prediktif keuanganmu akan muncul di sini.']);
  L.sort((x, y) => y[0] - x[0]);
  clearInterval(ITt); IT = 0; const show = () => { const e = $('#it'), n = IT % L.length, [sv, icn, html] = L[n]; e.innerHTML = html; $('#ii').innerHTML = ic(icn, 18); $('#ii').dataset.sv = sv; $('#ict').textContent = L.length > 1 ? (n + 1) + ' dari ' + L.length : ''; e.classList.remove('fu'); void e.offsetWidth; e.classList.add('fu'); IT++ }; show(); if (L.length > 1) ITt = setInterval(show, 7000)
}
function dash() {
  if (!bnDone) { bnDone = 1; setTimeout(() => { billBanner(); lnkReturn() }, 3600) }
  const i = sum('in', 1), o = sum('out', 1), none = !T.length; $('#dm').hidden = none; $('#de').hidden = !none; wallets(); streak(); insights();
  if (none) $('#de').innerHTML = emp('Wah, dompetmu masih sepi hari ini.', 'Yuk, mulai kebiasaan baik dengan mencatat pengeluaran pertamamu!', '<button class="bt" onclick="fab.click()">Catat pengeluaran pertama</button>');
  $('#bal').textContent = RM(wt()); $('#inc').textContent = RM(i); $('#exp').textContent = RM(o); $('#net').textContent = (i >= o ? 'Surplus ' : 'Defisit ') + RM(Math.abs(i - o)) + ' bulan ini';
  $('#recent').innerHTML = sorted().slice(0, 5).map(row).join('') || '<small>Belum ada transaksi. Tekan tombol + untuk mencatat yang pertama.</small>';
  qkRender(); dashCharts(); if (LK.length) mod('accounts').then(() => cur == 'dash' && lnkRender()).catch(() => { })
}
function tx() { tx0(); selUpd() }
function tx0() {
  const f = $('#f1').value, c = $('#f2').value, a = num($('#f3').value), q = $('#fq').value.trim().toLowerCase(), L = sorted().filter(x => (!f || x.date >= f) && (!c || x.cat == c) && x.amt >= a && (!q || x.desc.toLowerCase().includes(q)));
  $('#tb').innerHTML = L.map(x => `<tr><td class="noprint" data-l="Pilih"><label class="chk"><input type="checkbox" class="sel" value="${x.id}" aria-label="Pilih transaksi ${E(x.desc)}"></label></td><td data-l="Tanggal">${fd(x.date)}</td><th scope="row" data-l="Deskripsi"><b>${E(x.desc)}</b><small>${wn(x.w)}</small></th><td data-l="Kategori"><span><span class="tag">${E(x.cat)}</span>${x.sh ? ' <span class="tag">Bersama</span>' : ''}</span></td><td data-l="Jumlah" class="am ${x.type == 'in' ? 'in' : ''}">${sg(x.type)}${R(x.amt)}</td><td class="noprint"><button class="bt s g" onclick="del(${x.id})" aria-label="Hapus transaksi ${E(x.desc)}">Hapus</button></td></tr>`).join('') || `<tr class="er"><td colspan="6">${T.length ? emp('Tidak ada yang cocok', 'Coba longgarkan filter tanggal, kategori, atau jumlahnya.') : emp('Belum ada cerita di sini', 'Setiap rupiah punya cerita. Catat transaksi pertamamu, sisanya biar kami yang rapikan.', '<button class="bt" onclick="fab.click()">Catat transaksi pertama</button>', 'tx')}</td></tr>`
}
function del(id) { const z = T.find(v => v.id == id); ask('Hapus transaksi', z && z.tr ? 'Hapus transfer ini? Kedua sisi transfer akan dihapus.' : 'Hapus transaksi ini? Tindakan ini tidak dapat dibatalkan.', 'Ya, hapus', () => { T = T.filter(v => z && z.tr ? v.tr != z.tr : v.id != id); debtReconcile(); save(); tx(); toast('Transaksi berhasil dihapus') }) }
function bud() {
  $('#bl').innerHTML = OUT.map(c => {
    const s = spent(c), p = s / B[c] * 100, k = p >= 90 ? 'var(--rd)' : p >= 70 ? 'var(--wr)' : 'var(--em)';
    return `<div class="card"><div class="rw"><b>${c}</b><b style="color:${k}">${Math.round(p)}%</b></div><div class="bar"><i style="width:${Math.min(p, 100)}%;background:${k}"></i></div><div class="rw bl"><small>${R(s)} terpakai</small><label><small>Batas bulanan</small><input type="text" inputmode="numeric" data-cur autocomplete="off" value="${fmtN(B[c])}" aria-label="Batas bulanan ${c}" onchange="B['${c}']=num(this.value)||1;save();bud()"></label></div>${p >= 100 ? `<small style="color:var(--rd)">Melebihi batas ${R(s - B[c])}</small>` : ''}</div>`
  }).join(''); cl()
}
function cl() { $('#cl').innerHTML = [['out', OUT, 'Pengeluaran'], ['in', IN, 'Pemasukan']].map(([t, L, n]) => `<small style="margin:12px 0 6px">${n}</small>` + L.map(c => `<span class="tag chip">${c}<button onclick="dc('${t}','${c}')" aria-label="Hapus ${c}">${ic('x', 12)}</button></span>`).join('')).join('') }
$('#ca').onclick = () => { const t = $('#ct').value, L = t == 'in' ? IN : OUT, n = $('#cn').value.trim().replace(/[<>&"'\\]/g, ''); if (!n) return; if ([...OUT, ...IN].some(c => c.toLowerCase() == n.toLowerCase())) return toast('Kategori sudah ada'); L.push(n); if (t == 'out') B[n] = 1e6; save(); $('#cn').value = ''; cats(); bud() };
function dc(t, c) { if (T.some(x => x.cat == c) || BL.some(b => b.c == c) || TM.some(x => x.cat == c) || CL.some(x => x.cat == c)) return toast('Kategori masih dipakai transaksi, tagihan, template, atau cicilan'); const L = t == 'in' ? IN : OUT; L.splice(L.indexOf(c), 1); delete B[c]; RL = RL.filter(r => r.c != c); save(); cats(); bud() }
function goal() { $('#gl').innerHTML = G.map((g, i) => { const p = Math.min(100, g.s / g.t * 100); return `<div class="card"><div class="rw"><b>${g.n}</b><b class="in">${Math.round(p)}%</b></div><div class="bar"><i style="width:${p}%;background:var(--em)"></i></div><div class="rw"><small>${R(g.s)} dari ${R(g.t)}</small><span><button class="bt s" onclick="dep(${i})" aria-label="Setor ke ${g.n}">Setor</button> <button class="bt s g" onclick="G.splice(${i},1);save();goal()" aria-label="Hapus tujuan ${g.n}">Hapus</button></span></div></div>` }).join('') || emp('Mimpi besar dimulai dari langkah kecil', 'Beri nama tujuanmu, misalnya dana darurat atau liburan, lalu setor sedikit demi sedikit.', '', 'goal') }
function dep(i) { pbox('Setor ke tujuan', [{ l: 'Jumlah setoran (Rp)', v: '', c: 1 }], ([a]) => { const v = num(a); if (v > 0) { G[i].s += v; save(); goal(); toast('Setoran berhasil dicatat') } else toast('Isi jumlah setoran') }) }
$('#ga').onclick = () => { const n = E($('#gn').value.trim().slice(0, 30)), t = num($('#gt').value); if (!n || t <= 0) return toast('Isi nama dan target'); G.push({ id: 'g' + nid(), n, s: 0, t }); save(); $('#gn').value = $('#gt').value = ''; goal() };
const dim = (y, m) => new Date(y, m + 1, 0).getDate();
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const addM = (s, k, d0) => { const t = new Date(s + 'T00:00'), y = t.getFullYear(), mo = t.getMonth() + k; return iso(new Date(y, mo, Math.min(d0 || t.getDate(), dim(y, mo)))) };
// Tagihan lama (tanggal 1-31 + bulan lunas) otomatis diubah ke tanggal penuh yang berulang tiap bulan
function mig(b) { if (!b.due) { const t = new Date(), k = b.p == ds(0).slice(0, 7) ? 1 : 0; b.due = iso(new Date(t.getFullYear(), t.getMonth() + k, Math.min(b.d || 1, dim(t.getFullYear(), t.getMonth() + k)))); b.rep = true; b.dd = b.d } return b }
function due(b) { return Math.round((new Date(b.due + 'T00:00') - new Date(ds(0) + 'T00:00')) / 864e5) }
const fdl = s => new Date(s + 'T00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
const dtxt = n => n < 0 ? `Terlambat ${-n} hari` : n == 0 ? 'Jatuh tempo hari ini' : `${n} hari lagi`;
function bill() { $('#bk').innerHTML = BL.map((b, i) => { const n = due(b), k = b.done ? 'var(--a1)' : n < 0 ? 'var(--rd)' : n <= 7 ? 'var(--wr)' : 'var(--mu)'; return `<div class="card"><div class="rw"><b>${b.n}</b><b>${R(b.a)}</b></div><small>Jatuh tempo ${fdl(b.due)}, ${b.rep ? 'berulang tiap bulan' : 'sekali bayar'}, kategori ${b.c}</small><div class="rw" style="margin-top:12px"><b style="color:${k}">${b.done ? 'Lunas' : dtxt(n)}</b><span>${b.done ? '' : `<button class="bt s" onclick="pay(${i})" aria-label="Tandai lunas ${b.n}">Tandai lunas</button> `}<button class="bt s g" onclick="BL.splice(${i},1);save();bill()" aria-label="Hapus tagihan ${b.n}">Hapus</button></span></div></div>` }).join('') || emp('Tidak ada tagihan yang mengintai', 'Tambahkan tagihanmu, nanti kami ingatkan 7 hari sebelum jatuh tempo.', '', 'bill') }
function pay(i) { const b = BL[i]; T.push({ id: nid(), w: (W.find(w => w.id == 'w2') || W[0]).id, date: ds(0), type: 'out', cat: b.c, desc: 'Tagihan ' + b.n, amt: b.a }); if (b.rep) b.due = addM(b.due, 1, b.dd); else b.done = 1; save(); bill(); toast('Dicatat sebagai pengeluaran') }
$('#ba').onclick = () => { const n = E($('#bn').value.trim().slice(0, 30)), a = num($('#bm').value), d = $('#bd').value; if (!n || a <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return toast('Isi nama, jumlah, dan tanggal jatuh tempo'); BL.push({ id: nid(), n, a, c: $('#bcat').value, due: d, dd: +d.slice(8), rep: $('#br').checked }); save();['bn', 'bm', 'bd'].forEach(k => $('#' + k).value = ''); bill() };
$('#em2').onchange = e => { EM = e.target.checked; save(); toast(EM ? 'Pengingat email aktif' : 'Pengingat email dimatikan') };
// v22: semua yang punya jatuh tempo (tagihan, cicilan/paylater, utang yang harus dibayar, piutang yang akan diterima)
const dues = () => [...BL.filter(b => !b.done).map(b => ({ n: 'Tagihan ' + b.n, a: b.a, due: b.due, k: 'bill' })), ...CL.filter(c => MiraiCore.instLeftN(c) > 0).map(c => ({ n: (c.k == 'paylater' ? 'PayLater ' : 'Cicilan ') + c.n, a: c.per, due: MiraiCore.instNext(c), k: 'cl' })), ...DT.filter(d => d.due && MiraiCore.debtLeft(d) > 0).map(d => ({ n: d.k == 'utang' ? 'Utang ke ' + d.who : 'Piutang dari ' + d.who, a: MiraiCore.debtLeft(d), due: d.due, k: d.k == 'utang' ? 'dt' : 'pt' }))];
const debtReconcile = () => { DT.forEach(d => { d.pays = (d.pays || []).filter(p => !p.tx || T.some(x => x.id == p.tx)) }); CL.forEach(c => { c.pays = (c.pays || []).filter(p => !p.tx || T.some(x => x.id == p.tx)) }); AMAL = AMAL.filter(c => c.k != 'in' || !c.tx || T.some(x => x.id == c.tx)) };
function notif() {
  const L = OUT.filter(c => B[c] && spent(c) / B[c] >= .9).map(c => [`Anggaran ${c} hampir habis`, `${Math.round(spent(c) / B[c] * 100)}% terpakai bulan ini`]).concat(dues().filter(x => due(x) <= 7).sort((x, y) => due(x) - due(y)).map(x => [x.n, dtxt(due(x))]));
  $('#nl').innerHTML = L.map(([a, b]) => `<div class="li"><span class="ic">${ic('alert', 15)}</span><div><b>${a}</b><small>${b}</small></div></div>`).join('') || '<small>Semua tenang. Tidak ada yang perlu dikhawatirkan.</small>'; $('#bc').textContent = L.length; $('#bc').hidden = !L.length; $('#avd').hidden = !L.length
}
const VW = { dash, tx, bud, goal, bill, rep: () => mod('reports').then(() => cur == 'rep' && rep()).catch(failMod), sp: () => mod('space').then(() => cur == 'sp' && ruang()).catch(failMod), debt: () => mod('debt').then(() => cur == 'debt' && debtView()).catch(failMod), auto: () => mod('auto').then(() => cur == 'auto' && autoView()).catch(failMod), amal: () => mod('charity').then(() => cur == 'amal' && amalView()).catch(failMod) };
function go(v) { cur = v; Object.keys(VW).forEach(k => $('#v-' + k).hidden = k != v); $$('#nv a').forEach(a => { const on = a.dataset.v == v; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current') }); $('#mre')?.classList.toggle('on', SEC.includes(v)); $('#ttl').hidden = v == 'dash'; $('#ttl').textContent = v == 'dash' ? '' : N.find(n => n[0] == v)[3]; prof(); VW[v](); notif(); typeof pruneCharts == 'function' && pruneCharts() }
const SEC = ['goal', 'bill', 'sp', 'debt', 'auto', 'amal'];
$('#nv').insertAdjacentHTML('beforeend', N.map(n => `<a href="#" data-v="${n[0]}"${SEC.includes(n[0]) ? ' class="sec"' : ''}>${ic(n[1])}<span>${n[2]}</span></a>`).join('') + `<button type="button" class="more" id="mre" aria-haspopup="dialog">${ic('more')}<span>Lainnya</span></button>`);
$('#mol').innerHTML = N.filter(n => SEC.includes(n[0])).map(n => `<button type="button" class="mi" data-v="${n[0]}">${ic(n[1], 22)}<span><b>${n[2]}</b><small>${n[3]}</small></span></button>`).join('');
$('#mre').onclick = () => $('#mo').showModal();
$('#mol').onclick = e => { const b = e.target.closest('button'); if (b) { $('#mo').close(); gos(b.dataset.v); scrollTo(0, 0) } };
$('#mo').onclick = e => { if (e.target === e.currentTarget) $('#mo').close() };
$('#nv').onclick = e => { const a = e.target.closest('a'); if (a) { e.preventDefault(); gos(a.dataset.v); scrollTo(0, 0) } };
['f1', 'f2', 'f3', 'fq'].forEach(i => $('#' + i).oninput = tx);
const fill = () => $('#c').innerHTML = ($('#ty').value == 'in' ? IN : OUT).map(c => `<option>${c}</option>`).join(''); $('#ty').onchange = fill; function cats() { $('#f2').innerHTML = '<option value="">Semua kategori</option>' + [...OUT, ...IN, 'Transfer', 'Utang', 'Piutang'].map(c => `<option>${c}</option>`).join(''); $('#bcat').innerHTML = OUT.map(c => `<option>${c}</option>`).join(''); $('#wsel').innerHTML = W.map(w => `<option value="${w.id}">${w.n}</option>`).join(''); fill() }
// v22: dialog tambah transaksi dengan template cepat dan kategori otomatis dari aturan
let acOn = true;
function tplChips() { const b = $('#tpc'); b.hidden = !TM.length; b.innerHTML = TM.slice(0, 8).map(t => `<button type=\"button\" class=\"tpb\" data-tp=\"${t.id}\">${E(t.n)}</button>`).join('') }
function useTpl(t) {
  if (!t) return; $('#ty').value = t.type; fill(); scv(); if ([...OUT, ...IN].includes(t.cat)) $('#c').value = t.cat; if (W.some(w => w.id == t.w)) $('#wsel').value = t.w;
  $('#a').value = t.amt ? fmtN(t.amt) : ''; $('#d').value = t.desc || t.n; acOn = false; $('#ach').hidden = true; $('#a').focus()
}
function openAdd(p) { p = p || {}; $('#dt').value = ds(0); acOn = true; $('#ach').hidden = true; if (p.type) { $('#ty').value = p.type; fill(); scv() } tplChips(); if (!m.open) m.showModal() }
$('#fab').onclick = () => openAdd();
$('#tpc').onclick = e => { const b = e.target.closest('[data-tp]'); if (b) useTpl(TM.find(x => x.id == b.dataset.tp)) };
$('#c').addEventListener('change', () => acOn = false);
$('#d').addEventListener('input', () => { if (!acOn) return; const h = MiraiCore.matchRule(RL, $('#d').value, $('#ty').value == 'in' ? IN : OUT), a = $('#ach'); if (h) { $('#c').value = h.c; a.textContent = 'Kategori otomatis: ' + h.c + ' (aturan \"' + h.key + '\")'; a.hidden = false } else a.hidden = true });
$('#ty').addEventListener('change', () => $('#d').dispatchEvent(new Event('input')));
// Template dengan tanda \"catat langsung\": satu ketukan mencatat transaksi hari ini
function quickTpl(id) {
  const t = TM.find(x => x.id == id); if (!t) return;
  if (!(t.q && t.amt > 0)) { openAdd(); return useTpl(t) }
  T.push({ id: nid(), w: W.some(w => w.id == t.w) ? t.w : (W.find(w => w.id == 'w2') || W[0]).id, date: ds(0), type: t.type, cat: t.cat, desc: t.desc || t.n, amt: t.amt }); save(); toast(t.n + ' dicatat: ' + R(t.amt)); go(cur)
}
function qkRender() {
  const e = $('#qk'); if (!e) return; e.hidden = false;
  $('#qkl').innerHTML = TM.length ? TM.slice(0, 8).map(t => `<button type=\"button\" class=\"tpb\" data-q=\"${t.id}\">${E(t.n)}${t.amt ? '<small>' + R(t.amt) + '</small>' : ''}</button>`).join('') : '<small>Buat template untuk gaji, listrik, atau langganan agar mencatat cukup satu ketukan.</small>'
}
const toast = t => { const w = $('#toasts'), e = document.createElement('div'), x = document.createElement('span'); e.className = 'tt'; e.innerHTML = ic(/^(Gagal|Isi|Pilih|Saldo|Minimal|Butuh|Kategori|Mode)/.test(t) ? 'alert' : 'check', 16); x.textContent = t; e.append(x); w.append(e); try { if ($('dialog[open]') || !w.matches(':popover-open')) { try { w.hidePopover() } catch (z) { } w.showPopover() } } catch (z) { } setTimeout(() => { e.classList.add('out'); setTimeout(() => e.remove(), 300) }, 3000) };
$('#tf').onsubmit = e => { e.preventDefault(); if (!num($('#a').value)) return toast('Isi jumlah transaksi'); const sh = shTag(); T.push({ id: nid(), ...sh, w: $('#wsel').value, date: $('#dt').value || ds(0), type: $('#ty').value, cat: $('#c').value, desc: $('#d').value.trim(), amt: num($('#a').value) }); save(); m.close(); e.target.reset(); fill(); toast(sh.sh ? 'Disimpan sebagai pengeluaran bersama' : 'Transaksi disimpan'); go(cur) };
$('#bell').onclick = () => { $('#ps').close(); const h = ($('#np').hidden = !$('#np').hidden); $('#bell').setAttribute('aria-expanded', String(!h)); $('#bc').hidden = true };
root.dataset.theme = localStorage.mm_theme || root.dataset.theme || 'dark';
const thi = () => { const d = root.dataset.theme == 'dark'; $('#th').innerHTML = ic(d ? 'sun' : 'moon', 22) + '<span><b>Tampilan</b><small>' + (d ? 'Gelap, ketuk untuk Terang' : 'Terang, ketuk untuk Gelap') + '</small></span>' }; thi();
const TB = { dark: '#09090B', light: '#FAFAFA' }, setTh = t => { root.dataset.theme = t; root.style.background = TB[t]; root.style.colorScheme = t; $('#tc')?.setAttribute('content', TB[t]); thi() };
$('#th').onclick = () => { const t = root.dataset.theme == 'dark' ? 'light' : 'dark'; localStorage.mm_theme = t; setTh(t); go(cur) };
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => { if (/^(light|dark)$/.test(localStorage.mm_theme || localStorage.theme || '')) return; setTh(e.matches ? 'dark' : 'light'); if (!$('#app').hidden) go(cur) });

// Pemasangan aplikasi (PWA), service worker, dan pintasan ikon ada di pwa.js (v22)

// ---- v12: pilih banyak, hapus massal, reset, konfirmasi, skip link ----
function selUpd() { const n = $$('.sel:checked').length; $('#bulk').hidden = !n; $('#bcnt').textContent = n; $('#selall').checked = n > 0 && n == $$('.sel').length; $('#sc').textContent = n ? n + ' transaksi dipilih' : '' }
$('#tb').onchange = e => { if (e.target.classList.contains('sel')) selUpd() };
$('#selall').onchange = e => { $$('.sel').forEach(c => c.checked = e.target.checked); selUpd() };
function ask(t, msg, ok, fn) { $('#cdt').textContent = t; $('#cdm').textContent = msg; $('#cdy').textContent = ok; $('#cdy').onclick = () => { $('#cd').close(); fn() }; $('#cd').showModal(); $('#cdn').focus() }
$('#cdn').onclick = () => $('#cd').close();
$('#bulk').onclick = () => { const ids = new Set($$('.sel:checked').map(c => c.value)); ask('Hapus transaksi terpilih', 'Hapus ' + ids.size + ' transaksi yang dipilih? Tindakan ini tidak dapat dibatalkan.', 'Ya, hapus', () => { const tr = new Set(T.filter(x => ids.has(String(x.id)) && x.tr).map(x => x.tr)); T = T.filter(x => !ids.has(String(x.id)) && !(x.tr && tr.has(x.tr))); debtReconcile(); save(); tx(); toast(ids.size + ' transaksi berhasil dihapus') }) };
$('#rst').onclick = () => ask('Reset semua data', 'Apakah Anda yakin ingin mereset seluruh data transaksi dan saldo? Tindakan ini tidak dapat dibatalkan.', 'Ya', resetAll);
async function resetAll() {
  clearTimeout(SYNC.t); apply({}); SP = null; ['mm_shine', 'mm_d_' + US, 'mm_sp_' + UID].forEach(k => localStorage.removeItem(k));
  try { await pushForce() } catch (x) { return toast('Gagal mereset: ' + (x.message || 'koneksi bermasalah')) } // snapshot server diambil dulu, jadi reset masih bisa dibatalkan lewat Riwayat cadangan
  cats(); go('dash'); toast('Data berhasil direset')
}
$('.skip').onclick = e => { e.preventDefault(); const t = $('#app').hidden ? $('#login') : $('#main'); t.tabIndex = -1; t.focus() };

// ---- v13: format rupiah, kotak input, skeleton, auto-lock, pintasan, offline ----
document.addEventListener('input', e => { const t = e.target; if (!t.dataset || !t.dataset.cur) return; const p = t.selectionStart, L = t.value.length; t.value = t.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); const q = Math.max(0, p + t.value.length - L); try { t.setSelectionRange(q, q) } catch (x) { } });
function pbox(t, f, fn) {
  $('#pt').textContent = t;[0, 1].forEach(i => { const o = f[i], n = $('#p' + i); $('#pg' + i).hidden = !o; if (o) { $('#pl' + i).textContent = o.l; n.value = o.c ? fmtN(num(o.v)) : o.v; n.inputMode = o.c ? 'numeric' : 'text'; n.dataset.cur = o.c ? '1' : '' } });
  $('#pd').showModal(); $('#p0').focus(); $('#pf').onsubmit = e => { e.preventDefault(); $('#pd').close(); fn(f.map((o, i) => $('#p' + i).value)) }
}
let skt;
function gos(v) {
  go(v); $$('.skel').forEach(x => x.remove()); $$('.ld').forEach(x => x.classList.remove('ld')); const s = $('#v-' + v); s.classList.add('ld'); s.setAttribute('aria-busy', 'true');
  s.insertAdjacentHTML('afterbegin', '<div class="skel" aria-hidden="true"><div class="grid g3"><div class="sb"></div><div class="sb"></div><div class="sb"></div></div><div class="grid g2"><div class="sb t"></div><div class="sb t"></div></div><div class="sb l"></div></div>');
  clearTimeout(skt); skt = setTimeout(() => { const k = s.querySelector(':scope>.skel'); if (k) k.remove(); s.classList.remove('ld'); s.removeAttribute('aria-busy'); s.classList.add('fi'); setTimeout(() => s.classList.remove('fi'), 600) }, 1000)
}
// v26: aplikasi terkunci HANYA bila 5 menit tidak dipakai. Waktu aktivitas terakhir (lastAct) disimpan juga di localStorage supaya
// membuka ulang PWA dalam < 5 menit tidak meminta PIN. Pewaktu dibekukan peramban saat di latar belakang, jadi lockCheck() menghitung dari lastAct
// (bukan mengandalkan setTimeout) dan dipanggil lagi saat aplikasi kembali tampil (lock.js).
const LOCK_MS = 300000;
let lt = 0, lastAct = Date.now(), actW = 0;
const lockStale = () => { try { const t = +localStorage['mm_act_' + UID], n = Date.now(); return !(t > 0 && t <= n && n - t < LOCK_MS) } catch (e) { return true } };
function lockReset() {
  if ($('#app').hidden || !$('#lk').hidden) return; // layar kunci tidak dihitung sebagai pemakaian
  const n = lastAct = Date.now(); if (n - actW > 5000) { actW = n; try { localStorage['mm_act_' + UID] = n } catch (e) { } }
  if (!lt) lt = setTimeout(lockCheck, LOCK_MS)
}
function lockCheck() {
  clearTimeout(lt); lt = 0; if ($('#app').hidden || !$('#lk').hidden) return;
  const r = LOCK_MS - (Date.now() - lastAct); if (r <= 0) lockNow(); else lt = setTimeout(lockCheck, r)
}
function lockNow() { $$('dialog[open]').forEach(d => d.close()); $('#np').hidden = true;[$('#app'), $('.foot')].forEach(x => x.setAttribute('inert', '')); $('#lk').hidden = false; $('#lkp').value = ''; $('#lke').textContent = ''; $('#lkp').focus() }
function unlock() { $('#lk').hidden = true;[$('#app'), $('.foot')].forEach(x => x.removeAttribute('inert')); lockReset(); actRun() }
['mousemove', 'keydown', 'pointerdown', 'touchstart', 'wheel', 'scroll'].forEach(ev => addEventListener(ev, lockReset, { passive: true, capture: true }));
$('#lko').onclick = () => logout(true);
$('#lkf').onsubmit = async e => {
  e.preventDefault(); const p = $('#lkp').value, b = $('#lku'); if (!p) return; b.disabled = true;
  try {
    await getSb(); const t = supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }); const { error } = await t.auth.signInWithPassword({ email: US, password: p });
    if (error) $('#lke').textContent = navigator.onLine ? 'Kata sandi salah.' : 'Tidak bisa memverifikasi saat offline.'; else unlock()
  } catch (x) { $('#lke').textContent = 'Gagal memverifikasi. Periksa koneksi Anda.' } b.disabled = false
};
addEventListener('keydown', e => {
  if (!$('#lk').hidden) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == 'k') { e.preventDefault(); if ($('#app').hidden) return; if (cur != 'tx') go('tx'); $('#fq').focus(); $('#fq').select() }
  else if (e.key == 'Escape') { $$('dialog[open]').forEach(d => d.close()); if (!$('#np').hidden) { $('#np').hidden = true; $('#bell').setAttribute('aria-expanded', 'false') } }
});
const offUp = () => { const o = !navigator.onLine, b = $('#off'); if (o) { b.hidden = false; requestAnimationFrame(() => b.classList.add('show')) } else { b.classList.remove('show'); setTimeout(() => { if (navigator.onLine) b.hidden = true }, 300) } syUI() };
// v22: offline tidak lagi baca-saja. Catatan disimpan di perangkat dan dikirim otomatis (sync.js).
addEventListener('offline', () => { offUp(); toast('Koneksi terputus. Catatan tetap disimpan di perangkat') }); addEventListener('online', () => { offUp(); toast('Koneksi tersambung kembali. Menyinkronkan...') }); offUp();

// ---- v15 (bagian inti): status Ruang Bersama dan penanda transaksi bersama. Tampilan Ruang Bersama ada di space.js ----
let SP = null;
const shTag = () => $('#ty').value == 'out' && $('input[name=sc]:checked').value == 'b' ? { sh: 1, by: 'me' } : {};
const scv = () => $('#scf').hidden = $('#ty').value == 'in';
$('#ty').addEventListener('change', scv); $('#tf').addEventListener('reset', () => setTimeout(scv));
$('#fab').addEventListener('click', () => { if (cur == 'sp') $('input[name=sc][value=b]').checked = true; scv() });


// ---- v19: profil, privasi otomatis, banner tagihan, push ----
let FNM = '', pvInit = 0, bnDone = 0;
const pvOn = () => !!UID && localStorage['mm_pv_' + UID] == '1', pvApply = () => document.body.classList.toggle('pv', pvOn());
function prof() { const fn = FNM.trim() || US.split('@')[0] || '?', l = fn[0].toUpperCase(); $('#avl').textContent = l; $('#psa').textContent = l; $('#psn').textContent = fn; $('#pse').textContent = US; if (!pvInit) { pvInit = 1; pvApply() } }
$('#avb').onclick = () => { prof(); $('#ps').showModal() };
$('#psx').onclick = () => $('#ps').close();
$('#ps').onclick = e => { if (e.target === e.currentTarget) $('#ps').close() };
$('#pset').onclick = () => { $('#ps').close(); $('#sdn').value = FNM; $('#sdp').checked = pvOn(); navigator.serviceWorker?.ready.then(r => r.pushManager.getSubscription()).then(s => $('#sdq').checked = !!s && Notification.permission == 'granted').catch(() => { }); $('#sd').showModal() };
$('#sdf').onsubmit = async e => { e.preventDefault(); const n = $('#sdn').value.trim().replace(/[<>&"'\\]/g, '').slice(0, 40); try { await getSb(); const { error } = await sb.auth.updateUser({ data: { full_name: n } }); if (error) throw error; FNM = n; prof(); $('#sd').close(); toast('Setelan disimpan') } catch (x) { toast('Gagal menyimpan: ' + (x.message || 'koneksi bermasalah')) } };
$('#sdp').onchange = e => { localStorage['mm_pv_' + UID] = e.target.checked ? '1' : '0'; pvApply() };
const b64u = s => Uint8Array.from(atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
$('#sdq').onchange = async e => {
  const on = e.target.checked;
  try {
    const reg = await navigator.serviceWorker.ready; await getSb();
    if (on) { if (!VAPID_PUBLIC || await Notification.requestPermission() != 'granted') throw 0; const j = (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(VAPID_PUBLIC) })).toJSON(), { error } = await sb.from('push_subs').upsert({ user_id: UID, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' }); if (error) throw error; toast('Notifikasi push aktif') }
    else { const s = await reg.pushManager.getSubscription(); if (s) { await sb.from('push_subs').delete().eq('endpoint', s.endpoint); await s.unsubscribe() } toast('Notifikasi push dimatikan') }
  } catch (x) { e.target.checked = !on; toast('Gagal mengubah notifikasi push. Periksa izin browser dan VAPID_PUBLIC di config.js') }
};
// Privasi otomatis: blur nominal saat aplikasi dibuka atau ditinggalkan; ketuk atau usap angka untuk menampilkan 6 detik
const PVS = '#bal,#inc,#exp,#net,.nm,.wc .big,.li>b:last-child,td.am,#rs .big';
const pvRev = e => { const t = document.body.classList.contains('pv') && e.target.closest && e.target.closest(PVS); if (t) { t.classList.add('rv'); setTimeout(() => t.classList.remove('rv'), 6000) } };
let sx = 0; addEventListener('click', pvRev); addEventListener('pointerdown', e => sx = e.clientX); addEventListener('pointermove', e => { if (e.pointerType == 'touch' && Math.abs(e.clientX - sx) > 24) pvRev(e) });
document.addEventListener('visibilitychange', () => { if (document.hidden) pvApply() });
// Banner dalam aplikasi (juga dipakai untuk push saat aplikasi terbuka) dan tautan ?pay=ID dari email/notifikasi
function banner(t, s, fn) {
  const e = document.createElement('div'), hide = () => { e.classList.add('out'); setTimeout(() => e.remove(), 350) }; e.className = 'bn';
  e.innerHTML = `<img src="img/logo-160.webp" alt="" class="brand-logo" width="36" height="36"><div><b></b><small></small></div><button type="button" class="bt s">Bayar</button><button type="button" class="ib" aria-label="Tutup">${ic('x', 16)}</button>`;
  e.querySelector('b').textContent = t; e.querySelector('small').textContent = s; const [py, cl] = e.querySelectorAll('button'); py.onclick = () => { hide(); fn() }; cl.onclick = hide; $('#bnr').append(e); setTimeout(hide, 9000)
}
const payAsk = b => { go('bill'); ask('Bayar tagihan', `Catat pembayaran ${b.n} sebesar ${R(b.a)} sebagai lunas?`, 'Ya, catat', () => pay(BL.indexOf(b))) };
function billBanner() {
  const q = new URLSearchParams(location.search).get('pay'); if (q) { history.replaceState(null, '', location.pathname); const b = BL.find(x => String(x.id) == q); if (b && !b.done) return payAsk(b) }
  const k = 'mm_bn_' + UID, day = ds(0); let s = {}; try { s = JSON.parse(localStorage[k] || '{}') } catch (x) { }
  const b = BL.filter(x => !x.done && due(x) <= 7 && s[x.id] != day).sort((x, y) => due(x) - due(y))[0]; if (!b) return;
  s[b.id] = day; localStorage[k] = JSON.stringify(s); banner(b.n, RM(b.a) + ', ' + dtxt(due(b)).toLowerCase(), () => payAsk(b))
}
navigator.serviceWorker?.addEventListener('message', e => { const p = e.data && e.data.push; if (p && p.bill && !document.hidden) { const b = BL.find(x => x.id == p.bill.id); banner(p.title, p.body, () => b ? payAsk(b) : go('bill')) } });

// Kembali dari halaman izin penyedia (?linked=ID atau ?link_error=1)
function lnkReturn() { const p = new URLSearchParams(location.search), l = p.get('linked'); if (!l && !p.get('link_error')) return; history.replaceState(null, '', location.pathname); if (l) mod('accounts').then(() => lnkSync(l)).catch(failMod); else toast('Gagal menghubungkan akun: izin ditolak atau kedaluwarsa') }

// Tombol di index.html memakai data-act / data-close (pengganti atribut onclick). Modul lain boleh menambah isi ACT.
const ACT = {
  reload: () => location.reload(),
  'link-account': () => navigator.onLine ? mod('accounts').then(lnkOpen).catch(failMod) : toast('Menghubungkan akun butuh koneksi internet'),
  transfer: () => xfer(), print: () => print(), logout: () => logout(),
  'go-auto': () => gos('auto'), 'go-debt': () => gos('debt'), 'go-bill': () => gos('bill')
};
// Keamanan dan privasi (security.js dimuat saat dibutuhkan)
['rc', 'dev', 'snap', 'export', 'del'].forEach(k => ACT['sec-' + k] = () => mod('security').then(() => SX[k]()).catch(failMod));
document.addEventListener('click', e => {
  const q = e.target.closest('[data-q]'); if (q) return quickTpl(q.dataset.q);
  const b = e.target.closest('[data-act],[data-close]');
  if (!b) return;
  if (b.dataset.close) return document.getElementById(b.dataset.close).close();
  ACT[b.dataset.act]?.();
});
