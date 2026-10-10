// ---- v22: pemantauan galat (Sentry). Dimuat di login.html dan index.html. ----
// Tanpa SENTRY_DSN di config.js: tidak ada skrip pihak ketiga dimuat dan tidak ada data keluar; galat hanya ditahan di memori.
// Dengan DSN: bundel Sentry dimuat setelah halaman idle/interaksi pertama, galat sebelum itu ikut terkirim.
// Privasi (aplikasi keuangan): tanpa PII, tanpa breadcrumb (klik/konsol/jaringan bisa memuat jumlah uang dan deskripsi),
// tanpa Session Replay dan tanpa tracing; URL dibersihkan dari query/hash (bisa memuat token tautan).
(() => {
  'use strict';
  const buf = []; let ready = false;
  const keep = e => { if (buf.length < 20) buf.push(e instanceof Error ? e : new Error(String(e && e.message || e))) };
  const onErr = ev => ready ? 0 : keep(ev.error || ev.message), onRej = ev => ready ? 0 : keep(ev.reason);
  addEventListener('error', onErr); addEventListener('unhandledrejection', onRej);
  window.MiraiMonitor = { report: e => ready && window.Sentry ? Sentry.captureException(e) : keep(e) };
  if (typeof SENTRY_DSN !== 'string' || !SENTRY_DSN || /localhost|127\.0\.0\.1/.test(location.hostname)) return;
  // Versi bundel: ganti ke rilis terbaru dari https://docs.sentry.io/platforms/javascript/install/loader/ dan tambahkan atribut integrity (SRI) dari halaman CDN Sentry.
  const SDK = 'https://browser.sentry-cdn.com/8.55.0/bundle.min.js', clean = u => { try { const x = new URL(u, location.href); return x.origin + x.pathname } catch (e) { return '' } };
  const boot = () => {
    if (boot.done) return; boot.done = true;
    loadScript(SDK).then(() => {
      Sentry.init({
        dsn: SENTRY_DSN, release: 'mirai@v22', environment: 'production', sendDefaultPii: false, tracesSampleRate: 0, maxBreadcrumbs: 0,
        integrations: i => i.filter(x => x.name !== 'Breadcrumbs'), beforeBreadcrumb: () => null,
        ignoreErrors: ['ResizeObserver loop', 'Failed to fetch', 'Load failed', 'NetworkError', 'AbortError'],
        beforeSend: ev => { delete ev.user; if (ev.request) ev.request = { url: clean(ev.request.url) }; ev.server_name = undefined; return ev }
      });
      Sentry.setTag('standalone', String(matchMedia('(display-mode: standalone)').matches));
      ready = true; removeEventListener('error', onErr); removeEventListener('unhandledrejection', onRej); buf.splice(0).forEach(e => Sentry.captureException(e));
    }).catch(() => { });
  };
  ['pointerdown', 'keydown'].forEach(t => addEventListener(t, boot, { once: true, passive: true }));
  addEventListener('load', () => setTimeout(boot, 6000));
})();
