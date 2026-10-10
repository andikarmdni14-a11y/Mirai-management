// v26: kunci aplikasi HANYA setelah 5 menit tidak dipakai. Meninggalkan aplikasi sebentar atau membukanya lagi dalam < 5 menit tidak meminta PIN.
const { test, expect } = require('@playwright/test');
const { start, device, BASE, UID } = require('./helpers');
let srv; test.beforeAll(async () => { srv = await start() });

const MIN = 60000;
// Perangkat dengan PIN terpasang dan baru saja dipakai (cap waktu aktivitas = sekarang, jadi tidak terkunci saat dibuka). Jam palsu dipasang di
// konteks agar init script ini dan aplikasi membaca waktu yang sama. Hash PIN palsu cukup: tes ini hanya memeriksa KAPAN layar kunci muncul.
async function pinDevice(browser) {
  srv.be.seed(UID, BASE());
  const d = await device(browser, srv); await d.ctx.clock.install({ time: new Date('2026-10-10T08:00:00+07:00') });
  await d.ctx.addInitScript(uid => { if (!localStorage['mm_lock_' + uid]) { localStorage['mm_lock_' + uid] = JSON.stringify({ pin: { s: 'AAAAAAAAAAAAAAAAAAAAAA', h: 'x' } }); localStorage['mm_act_' + uid] = Date.now() } }, UID);
  return d;
}
const locked = page => page.evaluate(() => !document.getElementById('lk').hidden);
// Meniru aplikasi dikirim ke latar belakang / dibuka lagi (visibilitychange)
const vis = (page, hidden) => page.evaluate(h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => h ? 'hidden' : 'visible' }); document.dispatchEvent(new Event('visibilitychange')) }, hidden);

test('meninggalkan aplikasi sebentar (< 5 menit) lalu kembali TIDAK terkunci', async ({ browser }) => {
  const d = await pinDevice(browser); await d.open('/'); expect(await locked(d.page)).toBe(false);
  await vis(d.page, true); expect(await locked(d.page)).toBe(false); // dulu: langsung terkunci saat ditinggalkan
  await d.ctx.clock.fastForward(2 * MIN); await vis(d.page, false); expect(await locked(d.page)).toBe(false);
  expect(d.page.errs || []).toEqual([]); await d.ctx.close();
});

test('tidak dipakai 5 menit (layar tetap terbuka) → terkunci', async ({ browser }) => {
  const d = await pinDevice(browser); await d.open('/');
  await d.ctx.clock.fastForward(4 * MIN); expect(await locked(d.page)).toBe(false);
  await d.ctx.clock.fastForward(1.2 * MIN); expect(await locked(d.page)).toBe(true); await d.ctx.close();
});

test('aktivitas (ketuk/gulir/ketik) memperpanjang waktu; kunci 5 menit setelah aktivitas TERAKHIR', async ({ browser }) => {
  const d = await pinDevice(browser); await d.open('/');
  await d.ctx.clock.fastForward(4 * MIN); await d.page.mouse.move(50, 60); await d.page.mouse.move(80, 90);
  await d.ctx.clock.fastForward(4 * MIN); expect(await locked(d.page)).toBe(false); // 8 menit sejak buka, tapi baru 4 menit sejak aktivitas
  await d.ctx.clock.fastForward(1.5 * MIN); expect(await locked(d.page)).toBe(true); await d.ctx.close();
});

test('pewaktu beku di latar belakang: kembali setelah >= 5 menit langsung terkunci, tanpa menunggu pewaktu', async ({ browser }) => {
  const d = await pinDevice(browser); await d.open('/');
  await vis(d.page, true); await d.ctx.clock.setSystemTime(new Date('2026-10-10T08:07:00+07:00')); // waktu jalan, setTimeout tidak sempat berjalan
  expect(await locked(d.page)).toBe(false); await vis(d.page, false); expect(await locked(d.page)).toBe(true); await d.ctx.close();
});

test('tanpa PIN/biometrik: tetap terkunci (minta kata sandi) setelah 5 menit, tidak saat ditinggalkan sebentar', async ({ browser }) => {
  srv.be.seed(UID, BASE()); const d = await device(browser, srv); await d.ctx.clock.install({ time: new Date('2026-10-10T08:00:00+07:00') }); await d.open('/');
  await vis(d.page, true); await vis(d.page, false); expect(await locked(d.page)).toBe(false);
  await d.ctx.clock.fastForward(5.2 * MIN); expect(await locked(d.page)).toBe(true); await d.ctx.close();
});

test('buka ulang aplikasi (muat ulang halaman): < 5 menit sejak dipakai tidak terkunci, >= 5 menit terkunci', async ({ browser }) => {
  const d = await pinDevice(browser); await d.open('/'); await d.page.mouse.move(10, 10); // memberi cap waktu aktivitas
  await d.page.waitForFunction(uid => +localStorage['mm_act_' + uid] > 0, UID);
  await d.ctx.clock.fastForward(2 * MIN); await d.open('/'); expect(await locked(d.page)).toBe(false);
  await d.page.evaluate(uid => localStorage['mm_act_' + uid] = Date.now() - 6 * 60000, UID); await d.open('/'); expect(await locked(d.page)).toBe(true); await d.ctx.close();
});

test('layar kunci tidak dihitung sebagai pemakaian: menggerakkan mouse di layar kunci tidak memperbarui cap waktu', async ({ browser }) => {
  const d = await pinDevice(browser); await d.open('/'); await d.ctx.clock.fastForward(5.2 * MIN); expect(await locked(d.page)).toBe(true);
  const t0 = await d.page.evaluate(uid => localStorage['mm_act_' + uid], UID); await d.ctx.clock.fastForward(30000); await d.page.mouse.move(120, 130);
  expect(await d.page.evaluate(uid => localStorage['mm_act_' + uid], UID)).toBe(t0); await d.ctx.close();
});
