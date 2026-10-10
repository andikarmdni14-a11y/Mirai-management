const { test, expect } = require('@playwright/test');
const { start, device, waitFor, BASE, UID } = require('./helpers');
let srv; test.beforeAll(async () => { srv = await start() });
const submit = '#chf button:not([type=button])';

test('Ringkasan: Dompet = slide geser, kartu berwarna sesuai bank, akun terhubung ikut di slide yang sama', async ({ browser }) => {
  const at = new Date(Date.now() - 3 * 864e5).toISOString(), b = BASE();
  b.W.push({ id: 'w10', n: 'Tabungan BCA', o: 5200000 }, { id: 'w11', n: 'Kas Kecil', o: 150000 });
  b.LK = [{ p: 'dana', m: '\u2022\u20228007', b: 2399000, at, sb: 1, x: 0 }, { p: 'gopay', m: '\u2022\u20220467', b: 4630000, at, sb: 1, x: 0 }];
  srv.be.seed(UID, b); const d = await device(browser, srv); await d.open('/'); const p = d.page;
  await p.waitForSelector('#wl .wc.lk >> nth=1');
  const sl = () => p.$eval('#wl', l => Math.round(l.scrollLeft)), cur = () => p.$eval('#wdt button[aria-current=true]', e => +e.dataset.i);
  expect(await p.locator('.bkc, #lka').count()).toBe(0);                                  // desain besar berwarna lama sudah hilang
  expect(await p.locator('#wl .wc').count()).toBe(3 + 2 + 2 + 1);                          // 3 bawaan + 2 dompet baru + 2 akun terhubung + tombol tambah
  const c1 = await p.$$eval('#wl .wc:not(.add)', e => Object.fromEntries(e.map(x => [x.querySelector('.wn > span:last-child').textContent, getComputedStyle(x).getPropertyValue('--c1').trim().toUpperCase()])));
  expect(c1['Tabungan BCA']).toBe('#0A5CA8'); expect(c1['DANA']).toBe('#0F7AC9'); expect(c1['GoPay']).toBe('#00880F');   // warna mengikuti nama bank / akun terhubung
  expect(c1['Uang Tunai']).not.toBe(c1['Rekening Bank']); expect(c1['Kas Kecil']).toBe('#64748B');                      // bawaan beda-beda; nama biasa = netral
  expect(await p.$$eval('#wl .wc:not(.add)', e => e.every(x => getComputedStyle(x).backgroundImage.includes('linear-gradient')))).toBeTruthy();
  const hs = await p.$$eval('#wl .wc:not(.add)', e => e.map(x => Math.round(x.getBoundingClientRect().height)));
  expect(Math.max(...hs)).toBeLessThan(230);                                               // kartu tetap ringkas
  expect(await p.$eval('#wl', l => l.scrollWidth > l.clientWidth + 100)).toBeTruthy();     // isi lebih lebar dari layar = bisa digeser
  expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();   // halaman tidak ikut bergeser
  const txt = await p.locator('#wl .wc.lk').first().innerText();
  expect(txt).toContain('DANA'); expect(txt).toContain('Data simulasi'); expect(txt).toContain('dari total saldo'); expect(txt).toContain('sinkron 3 hari lalu');

  // panah, titik, keyboard
  await p.evaluate(() => document.querySelector('#wl').scrollIntoView({ block: 'center' }));
  await p.waitForSelector('#wdt button >> nth=7');                                       // penunjuk digambar setelah CSS terpasang; jangan menghitung langsung
  expect(await p.locator('#wdt button').count()).toBe(8); expect(await cur()).toBe(0); expect(await p.isDisabled('#wpv')).toBeTruthy();
  await p.click('#wnx'); await waitFor(async () => (await cur()) === 1 && (await sl()) > 200);
  await p.click('#wdt button[data-i=\"4\"]'); await waitFor(async () => (await sl()) > 800);
  await p.focus('#wl'); await p.keyboard.press('ArrowLeft'); await waitFor(async () => (await cur()) === 3);

  // posisi geser bertahan saat kartu digambar ulang (sertakan/keluarkan akun memanggil lnkRender + dash)
  await p.locator('#wl .wc.lk[data-p=dana]').scrollIntoViewIfNeeded(); await waitFor(async () => { const a = await sl(); await p.waitForTimeout(150); return a === await sl() });
  const before = await sl();
  await p.click('#wl [data-a=i][data-p=dana]');                                            // sertakan/keluarkan dari total tetap berfungsi
  await waitFor(() => p.evaluate(() => LK.find(l => l.p == 'dana').x === 1));
  await p.waitForSelector('#wl .wc.lk[data-p=dana] :text(\"Tidak dihitung di total saldo\")');
  expect(await p.locator('#wl .wc.lk').count()).toBe(2);                                   // tidak dobel setelah digambar ulang
  expect(Math.abs((await sl()) - before)).toBeLessThan(4);                                 // tetap di slide yang sama
  expect(d.page.errs || []).toEqual([]);
  await d.ctx.close();
});

test('Lainnya > Tabungan Amal: saldo terpisah dari dompet; tambah, salurkan, riwayat, hapus', async ({ browser }) => {
  srv.be.seed(UID, BASE()); const d = await device(browser, srv); await d.open('/'); const p = d.page;
  const w2 = () => p.evaluate(() => wb(W.find(w => w.id == 'w2'))), total = () => p.evaluate(() => wt());
  const before = await total();
  await p.click('#mre'); expect(await p.locator('#mol [data-v=amal]').innerText()).toContain('Tabungan Amal');
  await p.click('#mol [data-v=amal]'); await p.waitForSelector('#v-amal:not([hidden])'); await p.waitForSelector('#chh .big');   // modul dimuat malas: tunggu isinya tergambar
  expect(await p.innerText('#chh')).toContain('Rp0'); expect(await p.isDisabled('#chout')).toBeTruthy();   // belum ada saldo: tidak bisa salurkan
  expect(await p.locator('#chl .empty').count()).toBe(1);

  await p.click('#chin'); expect(await p.locator('#chw').count()).toBe(0);                                   // tidak ada pilihan dompet: saldo amal berdiri sendiri
  await p.fill('#cha', '0'); await p.click(submit); expect(await p.evaluate(() => AMAL.length)).toBe(0);
  await p.fill('#cha', '2000000'); await p.fill('#chn', 'Zakat penghasilan'); await p.click(submit);        // lebih besar dari saldo dompet: tetap boleh
  await waitFor(() => p.evaluate(() => MiraiCore.amalBal(AMAL) === 2000000));
  expect(await p.innerText('#chh')).toContain('Rp2.000.000');
  expect(await w2()).toBe(1000000); expect(await total()).toBe(before);                                      // dompet dan Total saldo tidak berubah
  expect(await p.evaluate(() => T.length)).toBe(0);                                                          // tidak ada transaksi dibuat
  expect(await p.evaluate(() => sum('out', 1))).toBe(0);

  await p.click('#chout'); await p.fill('#cht', 'Masjid Al-Ikhlas'); await p.fill('#cha', '2500000'); await p.click(submit);   // melebihi saldo amal
  expect(await p.evaluate(() => AMAL.length)).toBe(1);
  await p.fill('#cha', '75000'); await p.fill('#chn', 'Jumat berkah'); await p.click(submit);
  await waitFor(() => p.evaluate(() => AMAL.length === 2));
  expect(await p.innerText('#chh')).toContain('Rp1.925.000');
  expect(await w2()).toBe(1000000);                                                                          // menyalurkan juga tidak menyentuh dompet
  expect(await p.locator('#chl .card').count()).toBe(2);
  expect(await p.innerText('#chl')).toContain('Masjid Al-Ikhlas'); expect(await p.innerText('#chl')).toContain('Zakat penghasilan'); expect(await p.innerText('#chl')).toContain('Jumat berkah');
  expect(await p.innerText('#chs')).toContain('Rp2.000.000'); expect(await p.innerText('#chs')).toContain('Rp75.000');
  await p.click('#chtab [data-f=out]'); expect(await p.locator('#chl .card').count()).toBe(1);
  await p.click('#chtab [data-f=in]'); expect(await p.locator('#chl .card').count()).toBe(1);
  await p.click('#chtab [data-f=all]');

  await p.click('#chout'); await p.fill('#cht', 'Panti Asuhan'); await p.fill('#cha', '1925000'); await p.click(submit);   // habiskan saldo
  await waitFor(() => p.evaluate(() => MiraiCore.amalBal(AMAL) === 0));
  await p.click('#chl .card:has-text("Saldo ditambahkan") [data-del]'); expect(await p.evaluate(() => AMAL.length)).toBe(3);   // ditolak: saldo akan minus
  await p.click('#chl .card:has-text("Panti Asuhan") [data-del]'); await p.click('#cdy'); await waitFor(() => p.evaluate(() => AMAL.length === 2));
  await p.click('#chl .card:has-text("Masjid") [data-del]'); await p.click('#cdy'); await waitFor(() => p.evaluate(() => AMAL.length === 1));
  await p.click('#chl .card:has-text("Saldo ditambahkan") [data-del]'); await p.click('#cdy'); await waitFor(() => p.evaluate(() => AMAL.length === 0));
  expect(await w2()).toBe(1000000); expect(await total()).toBe(before);                                      // dompet tetap sama dari awal sampai akhir
  expect(p.errs || []).toEqual([]);
  await d.ctx.close();
});

test('Tabungan Amal: tersimpan ke server dan muncul lagi setelah muat ulang; modul lain dimuat lebih dulu tanpa bentrok', async ({ browser }) => {
  srv.be.seed(UID, BASE()); const d = await device(browser, srv); await d.open('/'); const p = d.page;
  await p.evaluate(() => gos('rep')); await p.waitForTimeout(500);                                         // memuat charts.js dulu: nama global tidak boleh bentrok dengan modul lain
  await p.evaluate(() => gos('amal')); await p.click('#chin'); await p.fill('#cha', '300000'); await p.click(submit);
  await waitFor(() => p.evaluate(() => AMAL.length === 1)); await waitFor(() => p.evaluate(() => pendingCount() === 0));
  expect(await waitFor(() => srv.be.data(UID).AMAL && srv.be.data(UID).AMAL.length === 1).then(() => true)).toBe(true);
  await p.reload(); await p.waitForFunction(() => document.documentElement.classList.contains('rev') && !document.getElementById('app').hidden);
  expect(await p.evaluate(() => MiraiCore.amalBal(AMAL))).toBe(300000); expect(p.errs || []).toEqual([]);
  await d.ctx.close();
});

test('Tabungan Amal: catatan lama (uang dulu dipindahkan dari dompet) tetap benar saat dihapus', async ({ browser }) => {
  const b = BASE(); b.T = [{ id: 777, tr: 777, w: 'w2', date: '2026-10-05', type: 'out', cat: 'Tabungan Amal', desc: 'Sisihkan ke Tabungan Amal', amt: 50000, amal: 1 }];
  b.AMAL = [{ id: 'h9', date: '2026-10-05', k: 'in', amt: 50000, w: 'w2', tx: 777 }];
  srv.be.seed(UID, b); const d = await device(browser, srv); await d.open('/'); const p = d.page;
  const w2 = () => p.evaluate(() => wb(W.find(w => w.id == 'w2')));
  expect(await w2()).toBe(950000);
  await p.evaluate(() => gos('amal')); await p.waitForSelector('#chl .card'); expect(await p.innerText('#chl')).toContain('Disisihkan dari');
  await p.click('#chl [data-del]'); await p.click('#cdy'); await waitFor(() => p.evaluate(() => AMAL.length === 0));
  expect(await w2()).toBe(1000000); expect(await p.evaluate(() => T.length)).toBe(0);                       // uang kembali ke dompet
  await d.ctx.close();
});
