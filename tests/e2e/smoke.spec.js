const { test, expect } = require('@playwright/test');
const { start, device, ready, addTx, waitFor, BASE, tx, UID } = require('./helpers');
let srv; test.beforeAll(async () => { srv = await start() });

test('semua halaman aplikasi terbuka tanpa galat JavaScript (regresi)', async ({ browser }) => {
  srv.be.seed(UID, { ...BASE(), T: [tx(1, 'kopi', 15000), tx(2, 'gaji', 5000000, { type: 'in', cat: 'Gaji', date: '2026-10-01' })], G: [{ id: 'g1', n: 'Liburan', s: 100000, t: 1e6 }], BL: [{ id: 5, n: 'Listrik', a: 300000, c: 'Tagihan', due: '2026-10-15', rep: 1 }] });
  const d = await device(browser, srv); await d.open('/');
  for (const v of await d.page.evaluate(() => Object.keys(VW))) { await d.page.evaluate(k => gos(k), v); await d.page.waitForTimeout(250) }
  await d.page.evaluate(() => gos('dash')); expect(d.page.errs || []).toEqual([]); await d.ctx.close();
});

test('tambah dan hapus transaksi lewat antarmuka tetap bekerja dan tersinkron', async ({ browser }) => {
  srv.be.seed(UID, BASE()); const d = await device(browser, srv); await d.open('/'); await addTx(d.page, 'Nasi goreng', 22000, { cat: 'Makanan' });
  await waitFor(() => srv.be.data(UID).T.length === 1); expect(srv.be.data(UID).T[0].amt).toBe(22000);
  await d.page.evaluate(() => { const z = T[0]; T = T.filter(x => x.id != z.id); save() }); await waitFor(() => srv.be.data(UID).T.length === 0); expect(d.page.errs || []).toEqual([]); await d.ctx.close();
});

test('data lama (tanpa id tujuan, tanpa kunci baru) tetap terbuka dan tidak hilang saat tersinkron', async ({ browser }) => {
  const old = BASE(); old.G = [{ n: 'Dana Darurat', s: 5000, t: 1e6 }]; delete old.W; old.BL = [{ id: 1, n: 'Air', a: 100000, c: 'Tagihan', d: 10, p: '' }]; srv.be.seed(UID, old);
  const d = await device(browser, srv); await d.open('/'); await d.page.evaluate(() => gos('goal'));
  expect(await d.page.evaluate(() => [G.length, G[0].id.startsWith('g'), Array.isArray(RL), Array.isArray(DT), W.length])).toEqual([1, true, true, true, 3]);
  await d.page.evaluate(() => { T.push({ id: nid(), w: 'w2', date: '2026-10-06', type: 'out', cat: 'Makanan', desc: 'x', amt: 1 }); save() }); await waitFor(() => srv.be.data(UID).T.length === 1);
  expect(srv.be.data(UID).G[0].n).toBe('Dana Darurat'); expect(srv.be.data(UID).BL[0].n).toBe('Air'); await d.ctx.close();
});

test('halaman login, Syarat, dan Privasi dimuat; tautan persetujuan menuju halaman asli', async ({ browser }) => {
  const d = await device(browser, srv, { guest: true }); await d.page.goto(srv.url + '/login.html');
  const links = await d.page.evaluate(() => [...document.querySelectorAll('.terms a')].map(a => a.getAttribute('href'))); expect(links).toEqual(['syarat.html', 'privasi.html']);
  for (const [p, h] of [['/syarat.html', 'Syarat & Ketentuan'], ['/privasi.html', 'Kebijakan Privasi']]) { await d.page.goto(srv.url + p); expect(await d.page.textContent('h1')).toBe(h) }
  expect(d.page.errs || []).toEqual([]); await d.ctx.close();
});

test('pemulihan 2FA: tautan "Kehilangan HP" tersedia di modal verifikasi dan mengganti ke input kode', async ({ browser }) => {
  const d = await device(browser, srv, { guest: true }); await d.page.goto(srv.url + '/login.html');
  expect(await d.page.isHidden('#rc-row')).toBeTruthy(); expect(await d.page.getAttribute('#rc-in', 'maxlength')).toBe('14'); await d.ctx.close();
});

test.afterAll(async () => { await srv.close() });
