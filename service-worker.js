// Ubah nama versi (V) setiap kali Anda mengubah file aplikasi agar cache lama terganti.
const V = 'mirai-v26b';
// CORE wajib ada agar service worker terpasang (tanpa service worker aplikasi tidak bisa dipasang di HP). MORE berhasil-atau-lewati:
// satu berkas yang gagal diunduh tidak boleh menggagalkan pemasangan. Pustaka CDN di-cache otomatis oleh handler fetch saat pertama dipakai.
const CORE = ['./', 'index.html', 'login.html', 'login.css', 'login.js', 'critical.css', 'splash.css', 'theme-init.js', 'load-css.js', 'splash.js', 'style.css', 'core.js', 'sync.js', 'pwa.js', 'app.js', 'auth.js', 'lock.js', 'config.js', 'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png'];
const MORE = ['charts.js', 'reports.js', 'space.js', 'auto.js', 'debt.js', 'charity.js', 'security.js', 'accounts.js', 'monitor.js', 'legal.css', 'syarat.html', 'privasi.html', 'img/logo-160.webp', 'icons/favicon-48.png'];
// cache:'reload' = lewati cache HTTP browser agar versi baru benar-benar terunduh
const get = u => new Request(u, { cache: 'reload' });
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(CORE.map(get)).then(() => Promise.all(MORE.map(u => c.add(get(u)).catch(() => { })))))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())));
// Versi baru menunggu sampai pengguna mengetuk "Update Aplikasi" (pwa.js mengirim pesan ini). Tanpa ini, tombolnya tidak bisa mengaktifkan versi baru.
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting() });
// Stale-while-revalidate untuk aset. Data Supabase dan /api tidak pernah di-cache.
// Navigasi (mis. ./?act=expense dari pintasan ikon, ?pay=ID, ?join=KODE) dicocokkan tanpa query supaya tetap terbuka saat offline.
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || !u.protocol.startsWith('http') || u.hostname.endsWith('supabase.co') || u.hostname.includes('google') || u.hostname.includes('sentry') || u.pathname.startsWith('/api/')) return;
  const nav = r.mode === 'navigate', opt = nav ? { ignoreSearch: true } : undefined;
  e.respondWith(caches.match(r, opt).then(hit => {
    const net = fetch(r).then(res => { if ((res.ok || res.type === 'opaque') && !nav) { const c = res.clone(); caches.open(V).then(x => x.put(r, c)).catch(() => { }) } else if (res.ok && nav && !u.search) { const c = res.clone(); caches.open(V).then(x => x.put(r, c)).catch(() => { }) } return res }).catch(() => hit || (nav ? caches.match('index.html') : Response.error()));
    return hit || net;
  }));
});

// Push: notifikasi OS (logo Mirai, tombol Bayar). Halaman yang sedang terbuka juga diberi pesan untuk menampilkan banner dalam aplikasi.
self.addEventListener('push', e => {
  let d; try { d = e.data.json() } catch (x) { d = { title: 'Mirai Management', body: e.data ? e.data.text() : '' } }
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title || 'Mirai Management', { body: d.body, icon: 'icons/icon-192.png', tag: d.tag, lang: 'id', data: { url: d.url || './' }, actions: d.bill ? [{ action: 'pay', title: 'Bayar' }, { action: 'close', title: 'Tutup' }] : [] }),
    self.clients.matchAll({ type: 'window' }).then(l => l.forEach(c => c.postMessage({ push: d })))
  ]));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); if (e.action == 'close') return;
  const u = new URL(e.notification.data.url, self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => { const c = l.find(x => x.url.startsWith(self.location.origin)); return c ? c.focus().then(() => c.navigate ? c.navigate(u) : c) : self.clients.openWindow(u) }));
});
