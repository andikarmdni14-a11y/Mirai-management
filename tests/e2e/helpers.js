// Pembantu uji E2E: server uji + "perangkat" (konteks browser) yang sudah masuk sebagai pengguna uji.
const fs = require('fs'), path = require('path'), { start } = require('../fixtures/server');
const cfg = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');
const STORE_KEY = 'sb-' + new URL(cfg.match(/SB_URL = '([^']+)'/)[1]).hostname.split('.')[0] + '-auth-token';
const TOS = cfg.match(/TOS_VER = '([^']+)'/)[1], UID = 'u-test-1';
const BASE = () => ({ OP: 0, T: [], B: { Makanan: 1e6, Transportasi: 1e6, Belanja: 1e6, Tagihan: 1e6, Hiburan: 1e6, Kesehatan: 1e6 }, G: [], OUT: ['Makanan', 'Transportasi', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan'], IN: ['Gaji', 'Freelance', 'Lainnya'], BL: [], EM: false, W: [{ id: 'w1', n: 'Uang Tunai', o: 0 }, { id: 'w2', n: 'Rekening Bank', o: 1000000 }, { id: 'w3', n: 'e-Wallet', o: 0 }], LK: [] });
const tx = (id, desc, amt, extra) => Object.assign({ id, w: 'w2', date: '2026-10-05', type: 'out', cat: 'Makanan', desc, amt }, extra);

// Membuat perangkat baru. opts.sw = izinkan service worker; opts.uid = ganti pengguna; opts.guest = belum masuk.
async function device(browser, srv, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ serviceWorkers: opts.sw ? 'allow' : 'block', viewport: { width: 390, height: 820 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  if (!opts.guest) await ctx.addInitScript(([uid, key, tos, prov, dev]) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ access_token: 'tok-' + uid, user: { id: uid, email: 'tester@example.com', user_metadata: tos ? { tos } : {}, app_metadata: { providers: prov } } })); if (dev) localStorage.mm_dev = dev }, [opts.uid || UID, STORE_KEY, opts.tos === undefined ? TOS : opts.tos, opts.providers || ['email'], opts.dev || '']);
  const page = await ctx.newPage(); page.on('pageerror', e => (page.errs ||= []).push(e.message));
  return { ctx, page, async open(p) { await page.goto(srv.url + (p || '/')); await ready(page) } };
}
// Menunggu splash selesai dan aplikasi tampil.
const ready = page => page.waitForFunction(() => document.documentElement.classList.contains('rev') && !document.getElementById('app').hidden, null, { timeout: 20000 });
const addTx = async (page, desc, amt, opts) => { opts = opts || {}; await page.click('#fab'); await page.fill('#d', desc); await page.fill('#a', String(amt)); if (opts.cat) await page.selectOption('#c', opts.cat); await page.click('#tf button:not([type=button]):not([data-close])') };
const waitFor = (fn, ms) => new Promise((ok, no) => { const t0 = Date.now(), f = async () => { try { if (await fn()) return ok() } catch (e) { } Date.now() - t0 > (ms || 10000) ? no(new Error('waitFor timeout')) : setTimeout(f, 100) }; f() });
module.exports = { start, device, ready, addTx, waitFor, BASE, tx, UID, STORE_KEY, TOS };
