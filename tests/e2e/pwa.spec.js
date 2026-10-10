const { test, expect } = require('@playwright/test');
const { start, device, ready, waitFor, BASE, UID } = require('./helpers');
let srv; test.beforeAll(async () => { srv = await start() });

test('manifest sah: pintasan, ikon, dan ikon pintasan bisa diunduh', async ({ browser }) => {
  const d = await device(browser, srv, { guest: true }); await d.page.goto(srv.url + '/login.html');
  const m = await d.page.evaluate(() => fetch('manifest.json').then(r => r.json()));
  expect(m.display).toBe('standalone'); expect(m.start_url).toBe('./'); expect(m.shortcuts.map(s => s.url)).toEqual(['./?act=expense', './?act=income', './?act=bills', './?act=report']);
  expect(m.shortcuts[0].name).toBe('Tambah pengeluaran');
  const sizes = m.icons.map(i => i.sizes); expect(sizes).toContain('192x192'); expect(sizes).toContain('512x512'); expect(m.icons.some(i => /maskable/.test(i.purpose || ''))).toBeTruthy();
  for (const s of [...m.icons, ...m.shortcuts.flatMap(s => s.icons)]) { const r = await d.page.evaluate(u => fetch(u).then(r => [r.status, r.headers.get('content-type')]), s.src); expect(r[0]).toBe(200); expect(r[1]).toContain('image/png') }
  await d.ctx.close();
});

test('halaman login (tamu) mendaftarkan service worker dan memenuhi syarat dipasang', async ({ browser }) => {
  const d = await device(browser, srv, { guest: true, sw: true }); await d.page.goto(srv.url + '/login.html');
  const active = await d.page.evaluate(() => navigator.serviceWorker.ready.then(r => !!r.active)); expect(active).toBeTruthy();
  const cdp = await d.ctx.newCDPSession(d.page); await cdp.send('Page.enable');
  const r = await cdp.send('Page.getInstallabilityErrors'); expect(r.installabilityErrors.map(e => e.errorId).filter(e => e !== 'in-incognito')).toEqual([]); // 'in-incognito' hanya artefak konteks uji
  const names = await d.page.evaluate(async () => (await caches.keys()).length ? (await (await caches.open((await caches.keys())[0])).keys()).map(x => new URL(x.url).pathname) : []);
  for (const f of ['/index.html', '/app.js', '/sync.js', '/core.js', '/pwa.js', '/login.html']) expect(names).toContain(f);
  await d.ctx.close();
});

test('pintasan ikon membuka form pengeluaran atau pemasukan langsung', async ({ browser }) => {
  srv.be.seed(UID, BASE());
  for (const [act, type] of [['expense', 'out'], ['income', 'in']]) {
    const d = await device(browser, srv); await d.page.goto(srv.url + '/?act=' + act); await ready(d.page);
    await d.page.waitForFunction(() => document.getElementById('m').open, null, { timeout: 8000 });
    expect(await d.page.inputValue('#ty')).toBe(type); expect(await d.page.evaluate(() => location.search)).toBe('');
    await d.ctx.close();
  }
});

test('tamu membuka pintasan: tujuan diingat sampai selesai masuk', async ({ browser }) => {
  const d = await device(browser, srv, { guest: true }); await d.page.goto(srv.url + '/?act=expense');
  await d.page.waitForURL(/login\.html/); expect(await d.page.evaluate(() => sessionStorage.getItem('mm_act'))).toBe('expense'); await d.ctx.close();
});

test('offline: aplikasi terbuka dari cache, pintasan tetap jalan, dan catatan bisa dibuat', async ({ browser }) => {
  srv.be.seed(UID, { ...BASE(), T: [{ id: 1, w: 'w2', date: '2026-10-05', type: 'out', cat: 'Makanan', desc: 'sudah ada', amt: 1000 }] });
  const d = await device(browser, srv, { sw: true }); await d.open('/');
  await d.page.evaluate(() => navigator.serviceWorker.ready); await d.page.reload(); await ready(d.page);       // muat ulang agar SDK ikut tersimpan oleh service worker
  await waitFor(() => d.page.evaluate(() => !!navigator.serviceWorker.controller));
  await d.ctx.setOffline(true);
  await d.page.goto(srv.url + '/?act=expense'); await ready(d.page);
  await d.page.waitForFunction(() => document.getElementById('m').open, null, { timeout: 8000 });
  expect(await d.page.evaluate(() => T.length)).toBe(1);                       // data dari salinan perangkat
  await d.page.fill('#d', 'catat tanpa sinyal'); await d.page.fill('#a', '12000'); await d.page.click('#tf button:not([type=button]):not([data-close])');
  expect(await d.page.evaluate(() => pendingCount())).toBe(1);
  await d.ctx.setOffline(false); await d.page.evaluate(() => window.dispatchEvent(new Event('online')));
  await waitFor(() => srv.be.data(UID).T.some(x => x.desc === 'catat tanpa sinyal'));
  await d.ctx.close();
});

test.afterAll(async () => { await srv.close() });
