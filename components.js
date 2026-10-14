/* Komponen UI Mirai (v24). Tiap komponen = fungsi murni yang mengembalikan string HTML.
   ID lama dipertahankan supaya app.js, sync.js, dan tes e2e tetap berjalan.
   Cara pakai: di index.html taruh <div data-c="NamaKomponen"></div>; berkas ini menggantinya saat dimuat (sebelum app.js). */
(() => {
  const S = (d, z = 18) => `<svg class="i" width="${z}" height="${z}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const BELL = '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>';
  const USER = '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>';
  const PLUS = '<path d="M12 5v14M5 12h14"/>';
  const BACK = '<path d="m15 18-6-6 6-6"/>', NEXT = '<path d="m9 18 6-6-6-6"/>';

  /* Routing bersih: kunci tampilan -> path (tanpa .html). Dipasangkan dengan "rewrites" di vercel.json. */
  const ROUTES = { dash: 'ringkasan', tx: 'transaksi', bud: 'anggaran', goal: 'tujuan', bill: 'tagihan', rep: 'laporan', sp: 'ruang-bersama', debt: 'utang-cicilan', auto: 'otomatis', amal: 'tabungan-amal' };
  const viewFromPath = (p = location.pathname) => Object.keys(ROUTES).find(k => '/' + ROUTES[k] === p.replace(/\/+$/, ''));
  const syncPath = v => {
    const p = '/' + ROUTES[v]; if (!ROUTES[v] || location.pathname === p) return;
    history[viewFromPath() ? 'pushState' : 'replaceState'](null, '', p + location.search + location.hash)
  };

  /* Avatar: foto bulat; bila belum ada foto, tampil siluet bawaan. p = awalan id ('av' di TopBar, 'ps' di dialog profil). */
  const Avatar = p => `<img class="avimg" id="${p}i" alt="Foto profil" width="44" height="44" decoding="async" hidden><span class="avfb" id="${p}f">${S(USER, 22)}</span>`;

  const TopBar = () => `<header class="top"><div class="tb"><img src="img/logo-160.webp" alt="" class="brand-logo" width="32" height="32" decoding="async"><span>Mirai Management</span></div><span class="sy" id="sy" role="status" aria-live="polite" hidden></span><div class="tbr"><button type="button" class="ib bellb" id="bell" aria-label="Notifikasi" aria-expanded="false">${S(BELL, 20)}<span class="bdg" id="bc" hidden></span></button><button class="avb" id="avb" type="button" aria-haspopup="dialog" aria-label="Menu profil">${Avatar('av')}</button></div></header>`;

  const SidebarNavigation = () => `<nav class="nav" id="nv" aria-label="Navigasi utama"><div class="br"><img src="img/logo-160.webp" alt="Mirai Logo" class="brand-logo" width="40" height="40" decoding="async"><span>Mirai Management</span></div></nav>`;
  /* Item menu diisi app.js (daftar N ada di sana). href berisi path bersih; klik biasa ditangani tanpa muat ulang halaman. */
  const NavLinks = (items, sec, icon) => items.map(n => `<a href="/${ROUTES[n[0]]}" data-v="${n[0]}"${sec.includes(n[0]) ? ' class="sec"' : ''}>${icon(n[1])}<span>${n[2]}</span></a>`).join('') + `<button type="button" class="more" id="mre" aria-haspopup="dialog">${icon('more')}<span>Lainnya</span></button>`;

  const SummaryCard = ({ cls = '', label, id, tone = '' }) => `<div class="card ${cls}"><small>${label}</small><div class="big ${tone}" id="${id}"></div></div>`;
  const SummaryCards = () => `<div class="grid g3"><div class="card hero"><div class="rw"><span class="rw jc-start gap-4"><small>Total saldo</small><button class="eyeb" id="eye" aria-label="Sembunyikan saldo" aria-pressed="false"></button></span><span class="chipmark">MIRAI</span></div><div class="big" id="bal"></div><small id="net"></small></div>${SummaryCard({ cls: 'sc-in', label: 'Pemasukan bulan ini', id: 'inc', tone: 'in' })}${SummaryCard({ cls: 'sc-out', label: 'Pengeluaran bulan ini', id: 'exp' })}</div>`;

  const WalletSlider = () => `<div class="minw-0"><div class="rw mb-10"><h3 class="ct m-0">Dompet</h3><span class="rw"><button class="bt s g" data-act="link-account">Hubungkan akun</button><button class="bt s g" data-act="transfer">Transfer</button></span></div><div id="wl" role="region" aria-label="Daftar dompet. Geser ke samping untuk melihat dompet lainnya" tabindex="0"></div><div class="wnv" id="wnv" hidden><button type="button" class="wnb" id="wpv" aria-label="Dompet sebelumnya">${S(BACK, 16)}</button><div class="wdt" id="wdt"></div><button type="button" class="wnb" id="wnx" aria-label="Dompet berikutnya">${S(NEXT, 16)}</button></div></div>`;

  const QuickActions = () => `<div class="card mb-16" id="qk" hidden><div class="rw mb-10"><h3 class="ct m-0">Catat cepat</h3><button class="bt s g" data-act="go-auto">Atur template</button></div><div class="tpc" id="qkl"></div></div>`;
  /* Chip template (mis. Gaji) + chip outline "+ Tambah Kategori" di sebelahnya. tm = daftar template, E = escape HTML, R = format rupiah. */
  const QuickChips = (tm, E, R) => (tm.length ? tm.map(t => `<button type="button" class="tpb" data-q="${t.id}">${E(t.n)}${t.amt ? '<small>' + R(t.amt) + '</small>' : ''}</button>`).join('') : '<small>Buat template untuk gaji, listrik, atau langganan agar mencatat cukup satu ketukan.</small>')
    + `<button type="button" class="tpb tpb-add" data-act="add-cat">${S(PLUS, 16)}<span>Tambah Kategori</span></button>`;

  /* Tingkat keparahan (data-sv) diatur app.js: 3 = anggaran terlampaui -> latar merah muda (lihat style.css). */
  const AlertBanner = () => `<div class="card insight" id="ab" role="status" aria-live="polite"><span class="ico" id="ii"></span><div><small>Wawasan prediktif <span id="ict"></span></small><p id="it"></p></div></div>`;

  const C = { TopBar, SidebarNavigation, SummaryCards, WalletSlider, QuickActions, AlertBanner };
  document.querySelectorAll('[data-c]').forEach(el => { const f = C[el.dataset.c]; if (f) el.outerHTML = f() });
  window.MiraiUI = { ...C, SummaryCard, Avatar, NavLinks, QuickChips, ROUTES, viewFromPath, syncPath };
})();
