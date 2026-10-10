'use strict';
// Menguji logika fungsi API (kode pemulihan, perangkat, hapus akun) dengan Supabase dan Resend tiruan di memori.
// Ini menguji logika kita, bukan perilaku Supabase sungguhan (terutama endpoint Admin API): lihat docs/SETUP-V22.md untuk uji manual.
const test = require('node:test'), assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'http://sb.test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc'; process.env.RESEND_API_KEY = 're'; process.env.FROM_EMAIL = 'Mirai <no-reply@x.id>'; process.env.APP_URL = 'https://app.test'; process.env.RECOVERY_SECRET = 'rahasia-uji';
const recovery = require('../../api/recovery/[a].js'), account = require('../../api/account/[a].js');

const jwt = (o) => 'h.' + Buffer.from(JSON.stringify(o)).toString('base64url') + '.s';
const A2 = jwt({ aal: 'aal2', session_id: 'S1' }), A1 = jwt({ aal: 'aal1', session_id: 'S1' }), A2b = jwt({ aal: 'aal2', session_id: 'S2' });
let db, calls;
function reset(extra) { db = { recovery_codes: [], recovery_state: [], user_devices: [], factors: [{ id: 'f1' }, { id: 'f2' }], failFactor: false, ...extra }; calls = { mail: [], logout: [], del: [], factorDel: [] } }
const rows = (t, q) => db[t].filter(r => [...q.entries()].every(([k, v]) => { if (['select', 'order', 'limit'].includes(k)) return true; if (v === 'is.null') return r[k] == null; if (v === 'not.is.null') return r[k] != null; return String(r[k]) === v.replace(/^eq\./, '') }));
global.fetch = async (url, o = {}) => {
  const u = new URL(url), m = (o.method || 'GET').toUpperCase(), body = o.body ? JSON.parse(o.body) : null, ok = (d, s = 200) => ({ ok: s < 300, status: s, json: async () => d });
  if (u.hostname === 'api.resend.com') { calls.mail.push(body); return ok({}) }
  if (u.pathname === '/auth/v1/user') { const t = (o.headers.Authorization || '').replace('Bearer ', ''); return t === 'bad' ? ok({}, 401) : ok({ id: 'U1', email: 'tes@x.id' }) }
  if (u.pathname === '/auth/v1/logout') { calls.logout.push(u.searchParams.get('scope')); return ok({}, 204) }
  if (u.pathname === '/auth/v1/admin/users/U1' && m === 'GET') return ok({ id: 'U1', factors: db.factors });
  if (u.pathname === '/auth/v1/admin/users/U1' && m === 'DELETE') { calls.del.push('U1'); return ok({}) }
  if (u.pathname.startsWith('/auth/v1/admin/users/U1/factors/')) { if (db.failFactor) return ok({}, 500); const id = u.pathname.split('/').pop(); calls.factorDel.push(id); db.factors = db.factors.filter(f => f.id !== id); return ok({}) }
  if (u.pathname.startsWith('/rest/v1/')) {
    const t = u.pathname.split('/').pop();
    if (m === 'GET') return ok(rows(t, u.searchParams).map(r => ({ ...r })));
    if (m === 'POST') { const L = Array.isArray(body) ? body : [body]; if (t === 'recovery_state') db[t] = db[t].filter(r => r.user_id !== body.user_id); L.forEach(r => db[t].push({ id: db[t].length + 1, ...r })); return ok({}, 201) }
    if (m === 'PATCH') { rows(t, u.searchParams).forEach(r => Object.assign(r, body)); return ok({}) }
    if (m === 'DELETE') { const hit = new Set(rows(t, u.searchParams)); db[t] = db[t].filter(r => !hit.has(r)); return ok({}) }
  }
  throw new Error('fetch tidak ditangani: ' + m + ' ' + url);
};
const call = async (h, { a, method = 'POST', token, body, query = {}, ua = 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile Safari/537.36', ip = '203.0.113.77', city = 'Jakarta' }) => {
  let st = 0, out; const res = { status(s) { st = s; return this }, json(o) { out = o; return this } };
  await h({ method, query: { a, ...query }, body, headers: { authorization: token ? 'Bearer ' + token : '', 'user-agent': ua, 'x-forwarded-for': ip, 'x-vercel-ip-city': city, 'x-vercel-ip-country': 'ID' } }, res); return { st, out };
};

test('recovery/generate: wajib aal2, 10 kode berformat, hanya hash yang disimpan, membuat ulang mengganti', async () => {
  reset(); assert.equal((await call(recovery, { a: 'generate', token: A1 })).st, 401);
  const r = await call(recovery, { a: 'generate', token: A2, body: {} }); assert.equal(r.st, 200); assert.equal(r.out.codes.length, 10);
  for (const c of r.out.codes) assert.match(c, /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
  assert.equal(db.recovery_codes.length, 10); for (const c of r.out.codes) assert.ok(!db.recovery_codes.some(x => x.code_hash.includes(c.replace('-', ''))));
  assert.equal((await call(recovery, { a: 'status', token: A2 })).out.remaining, 10);
  const r2 = await call(recovery, { a: 'generate', token: A2, body: {} }); assert.equal(db.recovery_codes.length, 10); assert.notDeepEqual(r.out.codes, r2.out.codes);
});

test('recovery/use: kode benar melepas semua 2FA, membatalkan semua kode, mengeluarkan sesi lain, mengirim email; kode tak bisa dipakai dua kali', async () => {
  reset(); const { out } = await call(recovery, { a: 'generate', token: A2, body: {} });
  const r = await call(recovery, { a: 'use', token: A1, body: { code: out.codes[3].toLowerCase() } });   // sesi aal1 (HP hilang), huruf kecil diterima
  assert.equal(r.st, 200); assert.deepEqual(calls.factorDel.sort(), ['f1', 'f2']); assert.equal(db.recovery_codes.length, 0); assert.deepEqual(calls.logout, ['others']);
  assert.equal(calls.mail.length, 1); assert.match(calls.mail[0].subject, /pemulihan/i);
  const again = await call(recovery, { a: 'use', token: A1, body: { code: out.codes[3] } }); assert.equal(again.st, 400);
});

test('recovery/use: salah 5x mengunci 15 menit, bahkan kode benar ditolak saat terkunci', async () => {
  reset(); const { out } = await call(recovery, { a: 'generate', token: A2, body: {} }); let last;
  for (let i = 0; i < 5; i++) last = await call(recovery, { a: 'use', token: A1, body: { code: 'AAAAA-AAAAA' } });
  assert.equal(last.st, 400); assert.match(last.out.error, /Dikunci/);
  const locked = await call(recovery, { a: 'use', token: A1, body: { code: out.codes[0] } }); assert.equal(locked.st, 429); assert.equal(calls.factorDel.length, 0);
});

test('recovery/use: gagal melepas autentikator -> 502 dan kode belum terpakai', async () => {
  reset({ failFactor: true }); const { out } = await call(recovery, { a: 'generate', token: A2, body: {} });
  const r = await call(recovery, { a: 'use', token: A1, body: { code: out.codes[0] } }); assert.equal(r.st, 502); assert.equal(db.recovery_codes.length, 10); assert.equal(calls.mail.length, 0);
});

test('recovery/use: tanpa sesi 401, kode tidak lengkap 400; tanpa RECOVERY_SECRET 503', async () => {
  reset(); assert.equal((await call(recovery, { a: 'use', token: 'bad', body: { code: 'AAAAA-AAAAA' } })).st, 401);
  assert.equal((await call(recovery, { a: 'use', token: A1, body: { code: 'ABC' } })).st, 400);
  const s = process.env.RECOVERY_SECRET; delete process.env.RECOVERY_SECRET; assert.equal((await call(recovery, { a: 'status', token: A2 })).st, 503); process.env.RECOVERY_SECRET = s;
});

test('account/device: perangkat pertama tanpa email, perangkat baru dikabari, IP tersamar, label terbaca', async () => {
  reset(); const d1 = await call(account, { a: 'device', token: A2, body: { id: 'devicepertama1' } }); assert.deepEqual(d1.out, { revoked: false, isNew: false }); assert.equal(calls.mail.length, 0);
  assert.equal(db.user_devices[0].ip, '203.0.113.x'); assert.equal(db.user_devices[0].label, 'Chrome di Android'); assert.equal(db.user_devices[0].city, 'Jakarta');
  const d2 = await call(account, { a: 'device', token: A2, body: { id: 'deviceduaxxxx2' }, ua: 'Mozilla/5.0 (Windows NT 10.0) Firefox/121.0' }); assert.equal(d2.out.isNew, true);
  assert.equal(calls.mail.length, 1); assert.match(calls.mail[0].subject, /Login baru/); assert.match(calls.mail[0].html, /Firefox di Windows/);
  const d3 = await call(account, { a: 'device', token: A2, body: { id: 'deviceduaxxxx2' } }); assert.equal(d3.out.isNew, false); assert.equal(calls.mail.length, 1);
  assert.equal((await call(account, { a: 'device', token: A2, body: { id: '../x' } })).st, 400);
});

test('account: perangkat dikeluarkan terdeteksi, login ulang (sesi baru) diizinkan, dan sesi yang dikeluarkan ditolak di semua endpoint', async () => {
  reset(); await call(account, { a: 'device', token: A2, body: { id: 'deviceduaxxxx2' } });
  await call(account, { a: 'revoke', token: A2, body: { id: 'deviceduaxxxx2' } }); assert.ok(db.user_devices[0].revoked_at);
  assert.equal((await call(account, { a: 'device', token: A2, body: { id: 'deviceduaxxxx2' } })).st, 401);       // sesi S1 sudah dikeluarkan: ditolak sebelum sampai ke logika
  const re = await call(account, { a: 'device', token: A2b, body: { id: 'deviceduaxxxx2' } }); assert.deepEqual(re.out, { revoked: false, isNew: false }); assert.equal(db.user_devices[0].revoked_at, null);
});

test('account/logout-all menandai semua perangkat dan memanggil logout global; delete butuh konfirmasi lalu menghapus pengguna', async () => {
  reset(); await call(account, { a: 'device', token: A2, body: { id: 'devicepertama1' } }); await call(account, { a: 'device', token: A2, body: { id: 'deviceduaxxxx2' } });
  const r = await call(account, { a: 'logout-all', token: A2, body: {} }); assert.equal(r.st, 200); assert.ok(db.user_devices.every(d => d.revoked_at)); assert.deepEqual(calls.logout, ['global']);
  reset(); assert.equal((await call(account, { a: 'delete', token: A2, body: { confirm: 'hapus' } })).st, 400); assert.deepEqual(calls.del, []);
  const d = await call(account, { a: 'delete', token: A2, body: { confirm: 'HAPUS' } }); assert.equal(d.st, 200); assert.deepEqual(calls.del, ['U1']); assert.match(calls.mail[0].subject, /dihapus/);
  assert.equal((await call(account, { a: 'devices', token: A1 })).st, 401);                                    // aal1 tidak boleh melihat perangkat
});
