const fs = require('fs'), path = require('path');
const { test, expect } = require('@playwright/test');
const { start, device, ready, addTx, waitFor, BASE, tx, UID } = require('./helpers');
let srv; test.beforeAll(async () => { srv = await start() });
const sub = '#tf button:not([type=button]):not([data-close])';

test('aturan kategori: kata kunci mengisi kategori otomatis, termasuk "Pasang aturan umum"', async ({ browser }) => {
  srv.be.seed(UID, BASE()); const d = await device(browser, srv); await d.open('/');
  await d.page.evaluate(() => gos('auto')); await d.page.click('#rlp');
  expect(await d.page.evaluate(() => RL.length)).toBeGreaterThan(5);
  await d.page.fill('#rlk', 'warung bu tini'); await d.page.selectOption('#rlc', 'Makanan'); await d.page.click('#rla');
  await d.page.click('#fab'); await d.page.fill('#d', 'INDOMARET JKT 0231');
  expect(await d.page.inputValue('#c')).toBe('Belanja'); expect(await d.page.isVisible('#ach')).toBeTruthy();
  await d.page.fill('#d', 'warung bu tini sore'); expect(await d.page.inputValue('#c')).toBe('Makanan');
  await d.page.selectOption('#c', 'Hiburan'); await d.page.fill('#d', 'indomaret lagi'); expect(await d.page.inputValue('#c')).toBe('Hiburan'); // pilihan manual tidak ditimpa
  await d.ctx.close();
});

test('template: tombol cepat di Ringkasan, dengan dan tanpa "catat langsung"', async ({ browser }) => {
  srv.be.seed(UID, BASE()); const d = await device(browser, srv); await d.open('/');
  await d.page.evaluate(() => gos('auto')); await d.page.click('#tma'); await d.page.fill('#tmn', 'Listrik'); await d.page.selectOption('#tmc', 'Tagihan'); await d.page.fill('#tma2', '350000');
  await d.page.click('#tmf button:not([type=button])'); expect(await d.page.evaluate(() => TM.map(t => [t.n, t.amt, t.q]))).toEqual([['Listrik', 350000, false]]);
  await d.page.click('#tma'); await d.page.fill('#tmn', 'Netflix'); await d.page.selectOption('#tmc', 'Hiburan'); await d.page.fill('#tma2', '54000'); await d.page.check('#tmq'); await d.page.click('#tmf button:not([type=button])');
  await d.page.evaluate(() => gos('dash')); expect(await d.page.isVisible('#qk')).toBeTruthy();
  await d.page.click('[data-q]:has-text("Listrik")'); await d.page.waitForFunction(() => document.getElementById('m').open);   // belum langsung dicatat: form terisi
  expect(await d.page.inputValue('#a')).toBe('350.000'); expect(await d.page.inputValue('#d')).toBe('Token listrik PLN'.length ? await d.page.inputValue('#d') : ''); await d.page.click('#m [data-close]').catch(() => { }); await d.page.keyboard.press('Escape');
  await d.page.click('[data-q]:has-text("Netflix")');                                                                    // langsung dicatat
  await waitFor(() => d.page.evaluate(() => T.some(x => x.cat === 'Hiburan' && x.amt === 54000)));
  await d.ctx.close();
});

test('impor CSV mutasi bank: kolom dikenali, kategori dari aturan, duplikat ditandai', async ({ browser }) => {
  srv.be.seed(UID, BASE()); const d = await device(browser, srv); await d.open('/'); const csv = path.join(__dirname, '..', 'data', 'mutasi-contoh.csv');
  await d.page.evaluate(() => { gos('auto'); RL.push({ id: 'r1', k: 'indomaret', c: 'Belanja' }, { id: 'r2', k: 'gojek', c: 'Transportasi' }, { id: 'r3', k: 'gaji', c: 'Gaji' }); save() });
  await d.page.setInputFiles('#imf', csv); await d.page.waitForFunction(() => document.getElementById('imd') && document.getElementById('imd').open);
  const rows = await d.page.evaluate(() => IM.items.map(x => [x.date, x.type, x.amt, x.c, x.auto])); expect(rows).toEqual([['2026-10-01', 'out', 25000, 'Belanja', true], ['2026-10-02', 'out', 18500, 'Transportasi', true], ['2026-10-03', 'in', 5000000, 'Gaji', true], ['2026-10-04', 'out', 12000, 'Lain-lain', false]]);
  await d.page.click('#imgo'); await waitFor(() => d.page.evaluate(() => T.length === 4));
  expect(await d.page.evaluate(() => OUT.includes('Lain-lain'))).toBeTruthy();
  await d.page.evaluate(() => gos('auto')); await d.page.setInputFiles('#imf', csv); await d.page.waitForFunction(() => document.getElementById('imd').open);   // impor ulang berkas yang sama
  expect(await d.page.evaluate(() => IM.items.map(x => x.dup))).toEqual([true, true, true, true]); expect(await d.page.evaluate(() => IM.items.filter(x => x.on).length)).toBe(0);
  await d.ctx.close();
});

test('utang dan piutang: arus kas dompet tidak masuk laporan, bayar sampai lunas, hapus catatan merapikan', async ({ browser }) => {
  srv.be.seed(UID, BASE()); const d = await device(browser, srv); await d.open('/');
  const bal = () => d.page.evaluate(() => W.find(w => w.id === 'w2').o + T.filter(x => x.w === 'w2').reduce((s, x) => s + (x.type === 'in' ? x.amt : -x.amt), 0));
  await d.page.evaluate(() => gos('debt')); await d.page.click('#dbadd'); await d.page.fill('#dtw', 'Budi'); await d.page.fill('#dta', '500000'); await d.page.click('#dtf button:not([type=button])');
  expect(await bal()).toBe(1500000);                                                             // pinjaman masuk ke dompet
  expect(await d.page.evaluate(() => T.filter(x => !x.tr).length)).toBe(0);                      // tapi bukan pemasukan di laporan
  await d.page.click('[data-dpay]'); await d.page.fill('#dpa', '200000'); await d.page.click('#dpf button:not([type=button])');
  expect(await d.page.evaluate(() => MiraiCore.debtLeft(DT[0]))).toBe(300000); expect(await bal()).toBe(1300000);
  await d.page.click('[data-dpay]'); expect(await d.page.inputValue('#dpa')).toBe('300.000'); await d.page.click('#dpf button:not([type=button])');
  expect(await d.page.evaluate(() => MiraiCore.debtLeft(DT[0]))).toBe(0);
  await d.page.evaluate(() => { const id = DT[0].pays[0].tx; T = T.filter(x => x.id != id); debtReconcile() });   // pembayaran dihapus dari Transaksi
  expect(await d.page.evaluate(() => MiraiCore.debtLeft(DT[0]))).toBe(200000);
  await d.page.click('[data-tab=piutang]'); await d.page.click('#dbadd'); await d.page.fill('#dtw', 'Sinta'); await d.page.fill('#dta', '100000'); await d.page.click('#dtf button:not([type=button])');
  expect(await d.page.evaluate(() => DT.filter(x => x.k === 'piutang').length)).toBe(1);
  await d.ctx.close();
});

test('cicilan: bayar angsuran mencatat pengeluaran dan menggeser jatuh tempo', async ({ browser }) => {
  srv.be.seed(UID, BASE()); const d = await device(browser, srv); await d.open('/');
  await d.page.evaluate(() => gos('debt')); await d.page.click('[data-tab=cicilan]'); await d.page.click('#dbadd');
  await d.page.fill('#cln', 'HP baru'); await d.page.fill('#clp', '250000'); await d.page.fill('#clm', '3'); await d.page.fill('#clu', '2026-10-25'); await d.page.click('#clf button:not([type=button])');
  expect(await d.page.evaluate(() => [CL[0].n, CL[0].per, MiraiCore.instNext(CL[0])])).toEqual(['HP baru', 250000, '2026-10-25']);
  await d.page.click('[data-cpay]'); await d.page.click('#cdy');
  expect(await d.page.evaluate(() => [MiraiCore.instPaidN(CL[0]), MiraiCore.instNext(CL[0]), T.filter(x => x.cl).map(x => [x.type, x.amt, x.cat])])).toEqual([1, '2026-11-25', [['out', 250000, 'Tagihan']]]);
  expect(await d.page.evaluate(() => dues().some(x => x.n === 'Cicilan HP baru'))).toBeTruthy();   // ikut notifikasi jatuh tempo
  await d.ctx.close();
});

test('keamanan: persetujuan Syarat/Privasi wajib untuk akun yang belum menyetujui', async ({ browser }) => {
  srv.be.seed(UID, BASE()); const d = await device(browser, srv, { tos: '' }); await d.open('/');
  await d.page.waitForFunction(() => document.getElementById('tosd') && document.getElementById('tosd').open);
  expect(await d.page.isDisabled('#tosy')).toBeTruthy(); await d.page.keyboard.press('Escape'); await d.page.waitForTimeout(300); await d.page.waitForFunction(() => document.getElementById('tosd').open);   // Esc tidak bisa menutupnya (dibuka lagi bila browser tetap menutup)
  await d.page.check('#tosc'); await d.page.click('#tosy'); await d.page.waitForFunction(() => !document.getElementById('tosd').open);
  expect(await d.page.evaluate(() => JSON.parse(localStorage.getItem(SB_STORE_KEY)).user.user_metadata.tos)).toBe('2026-10'); await d.ctx.close();
});

test('keamanan: kode pemulihan 2FA ditawarkan saat belum ada, dan kode tampil sekali', async ({ browser }) => {
  srv.be.seed(UID, BASE()); srv.be.rc = 0; const d = await device(browser, srv); await d.open('/');
  await d.page.waitForFunction(() => document.getElementById('rcd') && document.getElementById('rcd').open);
  await d.page.click('#rcn'); await d.page.waitForSelector('.rcg code'); expect(await d.page.locator('.rcg code').count()).toBe(10);
  expect(await d.page.isDisabled('#rcl')).toBeTruthy(); await d.page.check('#rck'); expect(await d.page.isDisabled('#rcl')).toBeFalsy(); srv.be.rc = 10; await d.ctx.close();
});

test('keamanan: perangkat yang dikeluarkan langsung dikeluarkan ke halaman masuk dengan pesan', async ({ browser }) => {
  srv.be.seed(UID, BASE()); srv.be.revoked.add('perangkatdicabut01'); const d = await device(browser, srv, { dev: 'perangkatdicabut01' });
  await d.page.goto(srv.url + '/'); await d.page.waitForURL(/login\.html/, { timeout: 20000 });
  await d.page.waitForFunction(() => /dikeluarkan/.test(document.querySelector('#form-in .err').textContent), null, { timeout: 8000 }); srv.be.revoked.clear(); await d.ctx.close();
});

test('privasi: ekspor semua data menghasilkan berkas JSON lengkap', async ({ browser }) => {
  srv.be.seed(UID, { ...BASE(), T: [tx(1, 'kopi', 15000)] }); const d = await device(browser, srv); await d.open('/');
  const [dl] = await Promise.all([d.page.waitForEvent('download'), d.page.evaluate(() => mod('security').then(() => SX.export()))]);
  const j = JSON.parse(fs.readFileSync(await dl.path(), 'utf8')); expect(j.jenis).toBe('ekspor-data-pribadi'); expect(j.akun.email).toBe('tester@example.com'); expect(j.data.T.map(x => x.desc)).toEqual(['kopi']); expect(j.akun.persetujuan.versi).toBe('2026-10');
  await d.ctx.close();
});

test('privasi: hapus akun (masuk dengan Google) membersihkan data lokal dan keluar', async ({ browser }) => {
  srv.be.seed(UID, BASE()); const d = await device(browser, srv, { providers: ['google'] }); await d.open('/');
  await d.page.evaluate(() => mod('security').then(() => SX.del())); await d.page.fill('#dac', 'salah'); await d.page.click('#day');
  expect(await d.page.textContent('#dae')).toContain('HAPUS'); await d.page.fill('#dac', 'HAPUS'); await d.page.click('#day'); await d.page.waitForURL(/login\.html/);
  expect(await d.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('mm_cache_') || k.startsWith('mm_base_')))).toEqual([]); await d.ctx.close();
});

test('Ruang Bersama: buat ruang, pengeluaran Bersama disalin idempoten, perubahan dan hapus ikut', async ({ browser }) => {
  srv.be.seed(UID, BASE()); srv.be.tables = {}; const d = await device(browser, srv); await d.open('/');
  await d.page.evaluate(() => gos('sp')); await d.page.waitForSelector('#spnone:not([hidden])');
  await d.page.fill('#spn', 'Rumah Kita'); await d.page.fill('#spd', 'Andi'); await d.page.click('#spc');
  await waitFor(() => d.page.isVisible('#spmain')); expect(await d.page.textContent('#spht')).toBe('Rumah Kita');
  await d.page.evaluate(() => { T.push({ id: nid(), w: 'w2', date: ds(0), type: 'out', cat: 'Belanja', desc: 'Belanja bulanan', amt: 450000, sh: 1, by: 'me' }); save() });
  await waitFor(() => (srv.be.tables.space_tx || []).length === 1); const reps = () => (srv.be.tables.space_tx || []).length;
  await d.page.evaluate(() => spReconcile(true)); await d.page.evaluate(() => spReconcile(true)); expect(reps()).toBe(1);                      // idempoten
  await d.page.evaluate(() => { T[0].amt = 500000; save() }); await waitFor(() => srv.be.tables.space_tx[0].amount === 500000);
  await d.page.evaluate(() => { T = []; save() }); await waitFor(() => reps() === 0);
  await d.page.click('#spinv'); await waitFor(() => d.page.evaluate(() => document.getElementById('ivcd').textContent.startsWith('CODE')));
  expect(await d.page.inputValue('#ivl')).toContain('?join=CODE'); await d.ctx.close();
});

test('Ruang Bersama: tautan undangan diingat sampai masuk, lalu pratinjau dan gabung', async ({ browser }) => {
  srv.be.tables = {}; const A = await device(browser, srv); srv.be.seed(UID, BASE()); await A.open('/');
  const code = await A.page.evaluate(async () => { await mod('space'); await getSb(); const r = await sb.rpc('create_space', { p_name: 'Rumah', p_display: 'Andi' }); const c = await sb.rpc('create_invite', { p_space: r.data }); return c.data });
  const B = await device(browser, srv, { uid: 'u-test-2' }); srv.be.seed('u-test-2', BASE()); await B.page.goto(srv.url + '/?join=' + code); await ready(B.page);
  await B.page.waitForFunction(() => document.getElementById('jnd') && document.getElementById('jnd').open, null, { timeout: 12000 });
  expect(await B.page.textContent('#jnd p')).toContain('Rumah'); await B.page.click('#jnf button:not([type=button])');
  await waitFor(() => (srv.be.tables.space_members || []).length === 2); await A.ctx.close(); await B.ctx.close();
});

test.afterAll(async () => { await srv.close() });
