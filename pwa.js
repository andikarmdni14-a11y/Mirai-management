// ---- v22: PWA. Dimuat di login.html DAN index.html. ----
// Sebelumnya service worker hanya didaftarkan dari app.js (index.html). Tamu langsung dialihkan ke login.html sebelum
// peristiwa load, sehingga service worker tidak pernah terdaftar dan tombol "Pasang" tidak pernah muncul sebelum login.
(() => {
  'use strict';
  const d = document, ls = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v) } catch (e) { return null } };

  /* 1. Pintasan ikon (?act=) dan tautan undangan (?join=): simpan segera, sebelum pengalihan ke login.html menghapus URL */
  const q = new URLSearchParams(location.search);
  try { ['act', 'join'].forEach(k => { const v = q.get(k); if (v && /^[\w-]{1,40}$/.test(v)) sessionStorage.setItem('mm_' + k, v) }) } catch (e) { }
  // Dijalankan setelah aplikasi tampil dan tidak terkunci. Dipanggil dari auth.js (enter) dan setelah buka kunci.
  const ACTS = {
    expense: () => openAdd({ type: 'out' }), income: () => openAdd({ type: 'in' }),
    bills: () => gos('bill'), debt: () => gos('debt'), report: () => gos('rep'), import: () => gos('auto'),
    security: () => $('#pset').click()
  };
  window.actRun = (tries = 0) => {
    let a = null; try { a = sessionStorage.getItem('mm_act') } catch (e) { }
    if (!a || !ACTS[a]) { try { sessionStorage.removeItem('mm_act') } catch (e) { } return }
    const lk = d.getElementById('lk'), ready = d.documentElement.classList.contains('rev') && lk && lk.hidden && !d.getElementById('app').hidden;
    if (!ready) { if (tries < 40) setTimeout(() => window.actRun(tries + 1), 250); return } // tunggu splash selesai / buka kunci
    try { sessionStorage.removeItem('mm_act') } catch (e) { }
    if (q.has('act')) history.replaceState(null, '', location.pathname);
    ACTS[a]();
  };

  /* 2. Service worker: didaftarkan di semua halaman */
  const hasSW = 'serviceWorker' in navigator;
  const css = d.createElement('style');
  css.textContent = '.pwa-sn,.pwa-bn{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:700;display:flex;align-items:center;gap:12px;max-width:460px;margin:auto;padding:12px 14px;border-radius:12px;background:var(--cd,#fff);color:var(--tx,#09090B);border:1px solid var(--bd,#E4E4E7);box-shadow:0 12px 32px rgba(0,0,0,.25);font:500 13px/1.4 var(--fs,Geist,system-ui,sans-serif)}' +
    '.pwa-sn span,.pwa-bn span{flex:1}.pwa-sn b,.pwa-bn b{display:block;font-weight:600}.pwa-sn small,.pwa-bn small{display:block;color:var(--mu,#52525B);font-size:12px}' +
    '.pwa-b{border:0;border-radius:8px;padding:9px 14px;min-height:40px;background:var(--em,#047857);color:var(--prt,#fff);font:600 13px var(--fs,system-ui,sans-serif);cursor:pointer}.pwa-b.g{background:transparent;color:var(--tx,#09090B);border:1px solid var(--bd,#E4E4E7)}' +
    '.pwa-dlg{border:1px solid var(--bd,#E4E4E7);border-radius:14px;padding:22px;width:min(420px,92%);background:var(--cd,#fff);color:var(--tx,#09090B);font:400 14px/1.55 var(--fs,Geist,system-ui,sans-serif)}.pwa-dlg::backdrop{background:rgba(0,0,0,.6)}' +
    '.pwa-dlg h3{margin:0 0 8px;font-size:18px}.pwa-dlg ol{padding-left:20px;margin:10px 0 16px}.pwa-dlg li{margin:6px 0}.pwa-dlg .r{display:flex;justify-content:flex-end}';
  d.head.appendChild(css);

  const snack = (title, sub, label, fn, cls) => {
    const e = d.createElement('div'); e.className = cls || 'pwa-sn'; e.setAttribute('role', 'status');
    const s = d.createElement('span'), b = d.createElement('b'), m = d.createElement('small'), btn = d.createElement('button'), x = d.createElement('button');
    b.textContent = title; m.textContent = sub || ''; s.append(b, m); btn.className = 'pwa-b'; btn.type = 'button'; btn.textContent = label; x.className = 'pwa-b g'; x.type = 'button'; x.textContent = 'Nanti'; x.setAttribute('aria-label', 'Tutup');
    btn.onclick = () => { e.remove(); fn() }; x.onclick = () => e.remove(); e.append(s, btn, x); d.body.append(e); return e;
  };

  if (hasSW) {
    let swReg = null, updating = false, asked = false;
    const sw = navigator.serviceWorker;
    // Versi baru sudah terunduh dan menunggu: tampilkan tombol di Setelan (hanya ada di index.html) + spanduk sekali per sesi.
    const found = () => {
      const b = d.getElementById('upd'); if (b) b.hidden = false;
      if (!asked) { asked = true; snack('Versi baru Mirai tersedia', 'Ketuk Perbarui, atau buka Setelan lalu Update Aplikasi.', 'Perbarui', applyUpdate) }
    };
    // Dipanggil dari tombol "Update Aplikasi" dan spanduk. Memuat ulang hanya setelah versi baru benar-benar aktif.
    function applyUpdate() {
      const b = d.getElementById('updb'), m = d.getElementById('updm'), w = swReg && swReg.waiting;
      if (b) { b.disabled = true; b.textContent = 'Memperbarui...' } if (m) m.textContent = 'Memperbarui aplikasi, mohon tunggu sebentar.';
      updating = true;
      if (!w) return location.reload();       // tidak ada yang menunggu (sudah aktif): cukup muat ulang
      w.postMessage({ type: 'SKIP_WAITING' });
      setTimeout(() => location.reload(), 5000); // cadangan bila sinyal controllerchange tidak datang
    }
    // Hanya muat ulang bila pengguna yang memintanya. Pemasangan pertama juga memicu controllerchange (clients.claim) dan tidak boleh memuat ulang halaman.
    sw.addEventListener('controllerchange', () => { if (updating) location.reload() });
    d.addEventListener('click', e => { if (e.target.closest('#updb')) applyUpdate() });
    const reg = () => sw.register('service-worker.js').then(r => {
      swReg = r;
      if (r.waiting && sw.controller) found();  // versi baru sudah menunggu sejak kunjungan sebelumnya
      r.addEventListener('updatefound', () => { const w = r.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && sw.controller) found() }) });
      // Aplikasi terpasang jarang membuka halaman baru, jadi browser jarang memeriksa sendiri: periksa saat aplikasi kembali dibuka dan tiap jam.
      const chk = () => r.update().catch(() => { });
      d.addEventListener('visibilitychange', () => { if (!d.hidden) chk() }); setInterval(chk, 36e5);
      return r;
    }).catch(() => { });
    d.readyState === 'complete' ? reg() : addEventListener('load', reg);
  }

  /* 3. Pasang ke layar utama */
  const standalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let bip = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); bip = e; sync() });
  addEventListener('appinstalled', () => { bip = null; ls('mm_installed', '1'); sync(); d.querySelectorAll('.pwa-bn').forEach(x => x.remove()) });

  const steps = () => ios
    ? ['Buka Mirai di Safari (bukan di dalam aplikasi lain).', 'Ketuk tombol Bagikan (kotak dengan panah ke atas) di bilah bawah.', 'Gulir lalu pilih "Tambah ke Layar Utama", kemudian ketuk Tambah.']
    : ['Buka menu browser (titik tiga di pojok kanan atas).', 'Pilih "Pasang aplikasi" atau "Tambahkan ke layar utama".', 'Konfirmasi dengan mengetuk Pasang.'];
  function help() {
    const g = d.createElement('dialog'); g.className = 'pwa-dlg'; g.setAttribute('aria-labelledby', 'pwa-t');
    g.innerHTML = '<h3 id="pwa-t">Pasang Mirai di HP</h3><div>Ikuti langkah ini untuk menambahkan Mirai ke layar utama:</div><ol></ol><div class="r"><button class="pwa-b" type="button">Mengerti</button></div>';
    steps().forEach(t => { const li = d.createElement('li'); li.textContent = t; g.querySelector('ol').append(li) });
    g.querySelector('button').onclick = () => g.close(); g.addEventListener('close', () => g.remove()); d.body.append(g); g.showModal();
  }
  async function install() {
    if (standalone()) return;
    if (bip) { const p = bip; bip = null; p.prompt(); try { await p.userChoice } catch (e) { } sync(); return }
    help();
  }
  // Elemen "Pasang aplikasi" di menu profil (index.html): tampil selama belum terpasang. Spanduk di halaman login.
  function sync() {
    const b = d.getElementById('inst'); if (b) { b.hidden = standalone(); b.onclick = install }
    if (d.getElementById('card') && !standalone() && !d.querySelector('.pwa-bn') && (bip || ios) && !(+ls('mm_inst_x') > Date.now())) {
      const e = snack('Pasang Mirai di HP Anda', 'Buka dari layar utama, bisa dipakai tanpa sinyal.', 'Pasang', install, 'pwa-bn');
      e.querySelector('.pwa-b.g').onclick = () => { ls('mm_inst_x', String(Date.now() + 14 * 864e5)); e.remove() };
    }
  }
  d.addEventListener('DOMContentLoaded', sync); if (d.readyState !== 'loading') sync();
  window.MiraiPWA = { install, standalone, canPrompt: () => !!bip, isIOS: ios, help };
})();
