// @ts-check
// UI/UX v23: 2FA lewat kode email (bawaan), "Coba cara lain", toggle Aplikasi Autentikator di Setelan, banner pasang PWA, dan satu hijau utama.
// Server dan Supabase tiruan (tests/fixtures). Logika server sungguhan diuji di tests/unit/twofa.test.js.
const { test, expect } = require('@playwright/test');
const { start, device, ready, BASE, UID } = require('./helpers');
let srv; test.beforeAll(async () => { srv = await start() });
test.afterAll(async () => { await srv.close() });

const GREEN = 'rgb(4, 120, 87)';
// Halaman masuk dengan sesi yang baru lolos kata sandi (aal1), sehingga modal 2FA terbuka.
async function loginAal1(browser, totp) {
  const t = srv.be.tfa; t.verified.clear(); t.sent = 0; t.wrongs = 0; t.mailFail = false;
  const d = await device(browser, srv);
  await d.ctx.addInitScript(x => { if (!localStorage.getItem('mm_fake_aal')) localStorage.setItem('mm_fake_aal', 'aal1'); if (x) localStorage.setItem('mm_fake_totp', '1') }, !!totp);
  await d.page.goto(srv.url + '/login.html'); await d.page.waitForSelector('#modal:not([hidden])');
  return d;
}
const boxesEmpty = page => page.evaluate(() => [...document.querySelectorAll('#otp input')].every(i => !i.value));

test('2FA bawaan: kode email 6 kotak, terkirim otomatis di kotak ke-6 (tanpa klik Verifikasi), salah dikosongkan, benar masuk', async ({ browser }) => {
  const d = await loginAal1(browser), p = d.page;
  expect(await p.textContent('#m-title')).toBe('Cek email Anda');
  expect(await p.textContent('#m-desc')).toContain('t***@example.com');                // email disamarkan
  expect(await p.locator('#otp input').count()).toBe(6);
  await expect(p.locator('#m-msg')).toContainText('Kode terkirim'); expect(srv.be.tfa.sent).toBe(1);
  await expect(p.locator('#alt-link')).toBeVisible(); expect(await p.textContent('#alt-link')).toBe('Coba cara lain');
  // Salah: diketik, kotak ke-6 terisi -> langsung diproses
  await p.locator('#otp input').first().click(); await p.keyboard.type('000000');
  await expect(p.locator('#m-msg')).toContainText('Kode salah'); expect(srv.be.tfa.wrongs).toBe(1);
  await expect(p.locator('#otp input').first()).toBeEnabled(); expect(await boxesEmpty(p)).toBeTruthy();
  expect(await p.evaluate(() => document.activeElement === document.querySelector('#otp input'))).toBeTruthy();   // fokus balik ke kotak pertama
  // Tempel 6 digit salah: juga terkirim otomatis
  await p.evaluate(() => { const dt = new DataTransfer(); dt.setData('text', '111111'); document.querySelector('#otp input').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })) });
  await expect.poll(() => srv.be.tfa.wrongs).toBe(2);
  await expect(p.locator('#otp input').first()).toBeEnabled();
  // Benar: masuk ke aplikasi, tanpa menyentuh tombol Verifikasi
  await p.locator('#otp input').first().click(); await p.keyboard.type('123456');
  await p.waitForURL(/index\.html/, { timeout: 15000 }); await ready(p);
  expect(d.page.errs || []).toEqual([]); await d.ctx.close();
});

test('2FA: pengiriman kode gagal menampilkan pesan dan tombol Kirim Ulang langsung aktif', async ({ browser }) => {
  srv.be.tfa.verified.clear(); srv.be.tfa.mailFail = true;
  const d = await device(browser, srv); await d.ctx.addInitScript(() => localStorage.setItem('mm_fake_aal', 'aal1'));
  await d.page.goto(srv.url + '/login.html'); await d.page.waitForSelector('#modal:not([hidden])');
  await expect(d.page.locator('#m-msg')).toContainText('belum bisa dikirim'); await expect(d.page.locator('#resend')).toBeEnabled();
  srv.be.tfa.mailFail = false; await d.page.click('#resend'); await expect(d.page.locator('#m-msg')).toContainText('Kode terkirim'); await d.ctx.close();
});

test('"Coba cara lain": tanpa Autentikator hanya kode email; panah Kembali ke layar OTP utama', async ({ browser }) => {
  const d = await loginAal1(browser), p = d.page;
  await p.click('#alt-link');
  await expect(p.locator('#m-alt')).toBeVisible(); await expect(p.locator('#m-main')).toBeHidden(); await expect(p.locator('#m-back')).toBeVisible();
  expect(await p.locator('.method').count()).toBe(1); expect(await p.textContent('#methods')).toContain('Kode lewat email'); expect(await p.textContent('#methods')).not.toContain('Autentikator');
  await p.click('#m-back'); await expect(p.locator('#m-main')).toBeVisible(); expect(await p.textContent('#m-title')).toBe('Cek email Anda'); await expect(p.locator('#m-back')).toBeHidden();
  await d.ctx.close();
});

test('"Coba cara lain": Aplikasi Autentikator muncul HANYA bila sudah diaktifkan; kode benar langsung masuk', async ({ browser }) => {
  const d = await loginAal1(browser, true), p = d.page;
  await p.click('#alt-link'); expect(await p.locator('.method').count()).toBe(2); expect(await p.textContent('#methods')).toContain('Aplikasi Autentikator');
  await p.click('.method[data-m=totp]');
  expect(await p.textContent('#m-title')).toBe('Aplikasi Autentikator'); await expect(p.locator('#rc-row')).toBeVisible(); await expect(p.locator('#alt-row')).toBeHidden(); await expect(p.locator('#resend-row')).toBeHidden();
  await p.click('#m-back'); await expect(p.locator('#m-alt')).toBeVisible();           // kembali ke daftar
  await p.click('.method[data-m=totp]'); await p.locator('#otp input').first().click(); await p.keyboard.type('123456');   // terkirim otomatis
  await p.waitForURL(/index\.html/, { timeout: 15000 }); await ready(p); await d.ctx.close();
});

test('Setelan > Keamanan: toggle Aplikasi Autentikator bawaan Off; menyalakan butuh kode benar; mematikan minta konfirmasi', async ({ browser }) => {
  srv.be.seed(UID, BASE()); srv.be.tfa.offAt = 0;
  const d = await device(browser, srv), p = d.page; await d.open('/');
  await p.click('#avb'); await p.click('#pset'); await expect(p.locator('#sd')).toBeVisible(); await expect(p.locator('#sda')).toBeEnabled();
  expect(await p.locator('#sd >> text=Keamanan').first().isVisible()).toBeTruthy();
  expect(await p.textContent('#sdsec')).toContain('Gunakan aplikasi pihak ketiga seperti Google Authenticator untuk keamanan ekstra.');
  expect(await p.isChecked('#sda')).toBe(false); await expect(p.locator('#sdrc')).toBeHidden();
  await p.click('#sda'); await expect(p.locator('#tgd')).toBeVisible(); expect(await p.isChecked('#sda')).toBe(false);   // belum menyala sebelum terverifikasi
  await p.fill('#tgc', '000000'); await expect(p.locator('#tge')).toContainText('salah'); expect(await p.isChecked('#sda')).toBe(false);
  await p.keyboard.type('123456');                                                      // fokus kembali ke kolom; terkirim otomatis di digit ke-6
  await expect(p.locator('#tgd')).toBeHidden(); await expect.poll(() => p.isChecked('#sda')).toBe(true); await expect(p.locator('#sdrc')).toBeVisible();
  await expect(p.locator('#rcd')).toBeVisible(); await p.click('#rcl'); await expect(p.locator('#rcd')).toBeHidden();   // ditawari simpan kode pemulihan
  // Mematikan
  await p.click('#sda'); await expect(p.locator('#cd')).toBeVisible(); expect(await p.isChecked('#sda')).toBe(true); await p.click('#cdy');
  await expect.poll(() => srv.be.tfa.offAt).toBe(1); await expect.poll(() => p.isChecked('#sda')).toBe(false);
  expect(d.page.errs || []).toEqual([]); await d.ctx.close();
});

test('Setelan: membatalkan dialog pemasangan membiarkan toggle tetap Off', async ({ browser }) => {
  srv.be.seed(UID, BASE()); const d = await device(browser, srv), p = d.page; await d.open('/');
  await p.click('#avb'); await p.click('#pset'); await expect(p.locator('#sda')).toBeEnabled(); await p.click('#sda'); await expect(p.locator('#tgd')).toBeVisible();
  await p.click('#tgx'); await expect(p.locator('#tgd')).toBeHidden(); expect(await p.isChecked('#sda')).toBe(false); await d.ctx.close();
});

test('banner "Pasang Mirai di HP Anda": ikon X kecil di sudut kanan atas menutup dan mengingat pilihan', async ({ browser }) => {
  const d = await device(browser, srv, { guest: true }), p = d.page; await p.goto(srv.url + '/login.html');
  await p.evaluate(() => window.dispatchEvent(new Event('beforeinstallprompt')));
  await expect(p.locator('.pwa-bn')).toBeVisible(); await expect(p.locator('.pwa-bn .pwa-b')).toHaveText('Pasang');
  const bn = await p.locator('.pwa-bn').boundingBox(), x = await p.locator('.pwa-bn .pwa-x').boundingBox();
  expect(x.x + x.width).toBeGreaterThan(bn.x + bn.width - 14); expect(x.y).toBeLessThan(bn.y + 12);   // pojok kanan atas
  expect(x.width).toBeGreaterThanOrEqual(24); expect(x.height).toBeGreaterThanOrEqual(24);            // area sentuh memadai
  expect(await p.getAttribute('.pwa-bn .pwa-x', 'aria-label')).toBe('Tutup');
  await p.click('.pwa-bn .pwa-x'); await expect(p.locator('.pwa-bn')).toHaveCount(0);
  expect(await p.evaluate(() => +localStorage.getItem('mm_inst_x') > Date.now())).toBeTruthy(); await d.ctx.close();
});

test('satu hijau utama (#047857) untuk tombol Verifikasi, progress bar splash, toggle, tombol aplikasi; logo di petak putih tanpa invert', async ({ browser }) => {
  srv.be.seed(UID, BASE());
  const g = await device(browser, srv, { guest: true }); await g.page.goto(srv.url + '/login.html');
  expect(await g.page.evaluate(() => getComputedStyle(document.querySelector('#verify')).backgroundColor)).toBe(GREEN);
  expect(await g.page.evaluate(() => getComputedStyle(document.querySelector('.btn.primary')).backgroundColor)).toBe(GREEN);
  expect(await g.page.evaluate(() => { const l = document.querySelector('.logo'); return getComputedStyle(l).backgroundColor })).toBe('rgb(255, 255, 255)');
  expect(await g.page.textContent('.ov-in p')).toBe('Kelola data keuangan Anda dan maksimalkan ROI dengan mudah.'); await g.ctx.close();
  const d = await device(browser, srv), p = d.page; await p.goto(srv.url + '/'); await p.waitForSelector('#splash .sp-bar i', { state: 'attached' });
  expect(await p.evaluate(() => getComputedStyle(document.querySelector('#splash .sp-bar i')).backgroundColor)).toBe(GREEN);   // progress bar splash
  expect(await p.evaluate(() => getComputedStyle(document.querySelector('#splash .sp-logo img')).backgroundColor)).toBe('rgb(255, 255, 255)');
  await ready(p);
  for (const theme of ['dark', 'light']) {
    await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
    expect(await p.evaluate(() => getComputedStyle(document.querySelector('#fab')).backgroundColor)).toBe(GREEN);
    const logo = await p.evaluate(() => { const l = document.querySelector('.tb .brand-logo'), c = getComputedStyle(l); return [c.backgroundColor, c.filter] });
    expect(logo).toEqual(['rgb(255, 255, 255)', 'none']);
  }
  await p.click('#avb'); await p.click('#pset'); await expect(p.locator('#sdp')).toBeVisible(); await p.check('#sdp');
  for (const theme of ['dark', 'light']) { await p.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme); await expect.poll(() => p.evaluate(() => getComputedStyle(document.querySelector('#sdp')).backgroundColor)).toBe(GREEN) }   // toggle punya transisi 0,2 dtk
  await d.ctx.close();
});
