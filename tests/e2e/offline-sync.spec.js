const { test, expect } = require('@playwright/test');
const { start, device, addTx, waitFor, BASE, tx, UID } = require('./helpers');
let srv; test.beforeAll(async () => { srv = await start() });

test('catatan dibuat offline, antre, lalu terkirim otomatis saat online', async ({ browser }) => {
  srv.be.seed(UID, BASE()); const d = await device(browser, srv); await d.open('/');
  await d.ctx.setOffline(true); await d.page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await addTx(d.page, 'Makan siang offline', 25000);
  const pending = await d.page.evaluate(() => pendingCount()); expect(pending).toBe(1);
  expect(await d.page.textContent('#sy')).toContain('menunggu sinkron');
  expect(srv.be.data(UID).T).toHaveLength(0);                       // belum sampai server
  await d.ctx.setOffline(false); await d.page.evaluate(() => window.dispatchEvent(new Event('online')));
  await waitFor(() => srv.be.data(UID).T.length === 1);
  expect(srv.be.data(UID).T[0].desc).toBe('Makan siang offline');
  await waitFor(async () => await d.page.evaluate(() => pendingCount()) === 0);
  expect(await d.page.isHidden('#sy')).toBeTruthy();
  await d.ctx.close();
});

test('perangkat lain menulis duluan: data digabung, tidak ada yang hilang, snapshot dibuat', async ({ browser }) => {
  srv.be.seed(UID, { ...BASE(), T: [tx(1, 'awal', 1000)] }); srv.be.history.length = 0;
  const A = await device(browser, srv), B = await device(browser, srv); await A.open('/'); await B.open('/');
  await addTx(B.page, 'dari B', 2000); await waitFor(() => srv.be.data(UID).T.length === 2);
  await addTx(A.page, 'dari A', 3000);                              // A masih memegang versi lama: harus bentrok lalu digabung
  await waitFor(() => srv.be.data(UID).T.length === 3);
  expect(srv.be.data(UID).T.map(x => x.desc).sort()).toEqual(['awal', 'dari A', 'dari B']);
  await waitFor(async () => (await A.page.evaluate(() => T.map(x => x.desc).sort())).length === 3);
  expect(srv.be.history.length).toBeGreaterThan(0);                 // pemicu snapshot server berjalan
  await A.ctx.close(); await B.ctx.close();
});

test('hapus di satu perangkat dan tambah di perangkat lain sama-sama bertahan', async ({ browser }) => {
  srv.be.seed(UID, { ...BASE(), T: [tx(1, 'akan dihapus', 1000), tx(2, 'tetap', 2000)] });
  const A = await device(browser, srv), B = await device(browser, srv); await A.open('/'); await B.open('/');
  await B.page.evaluate(() => { T = T.filter(x => x.id != 1); save() }); await waitFor(() => srv.be.data(UID).T.length === 1);
  await A.page.evaluate(() => { T.push({ id: nid(), w: 'w2', date: '2026-10-06', type: 'out', cat: 'Makanan', desc: 'baru di A', amt: 500 }); save() });
  await waitFor(() => srv.be.data(UID).T.length === 2);
  expect(srv.be.data(UID).T.map(x => x.desc).sort()).toEqual(['baru di A', 'tetap']);
  await A.ctx.close(); await B.ctx.close();
});

test('perubahan offline yang tertunda bertahan setelah aplikasi ditutup dan dibuka lagi', async ({ browser }) => {
  srv.be.seed(UID, BASE()); const d = await device(browser, srv); await d.open('/');
  await d.ctx.setOffline(true); await d.page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await d.page.evaluate(() => { T.push({ id: nid(), w: 'w2', date: '2026-10-06', type: 'out', cat: 'Makanan', desc: 'tertunda', amt: 7000 }); save() });
  await d.ctx.setOffline(false);                                    // buka kembali dengan jaringan hidup: harus digabung, bukan dibuang
  await d.page.reload(); await d.page.waitForFunction(() => document.documentElement.classList.contains('rev'));
  await waitFor(() => srv.be.data(UID).T.some(x => x.desc === 'tertunda'));
  await d.ctx.close();
});

test('gagal menulis karena jaringan: tetap tertunda, lalu berhasil pada percobaan berikutnya', async ({ browser }) => {
  srv.be.seed(UID, BASE()); const d = await device(browser, srv); await d.open('/'); srv.be.failWrites = 1;
  await d.page.evaluate(() => { T.push({ id: nid(), w: 'w2', date: '2026-10-06', type: 'out', cat: 'Makanan', desc: 'coba lagi', amt: 100 }); save() });
  await d.page.waitForTimeout(1200); expect(await d.page.evaluate(() => pendingCount())).toBe(1);
  await d.page.evaluate(() => syncNow()); await waitFor(() => srv.be.data(UID).T.some(x => x.desc === 'coba lagi'));
  await d.ctx.close();
});

test.afterAll(async () => { await srv.close() });
