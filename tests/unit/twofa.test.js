'use strict';
// Menguji api/twofa (kode email) dan pemeriksaan sesi bersama di api/_lib.js dengan Supabase dan Resend tiruan di memori.
// Fungsi SQL email_otp_issue / email_otp_check ditiru di sini dengan aturan yang sama seperti schema.sql (v23);
// ini menguji logika server kita, bukan SQL atau perilaku Supabase sungguhan (lihat docs/SETUP-V22.md, uji manual v23).
const test = require('node:test'), assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'http://sb.test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc'; process.env.RESEND_API_KEY = 're'; process.env.FROM_EMAIL = 'Mirai <no-reply@x.id>'; process.env.APP_URL = 'https://app.test'; process.env.RECOVERY_SECRET = 'rahasia-uji';
const twofa = require('../../api/twofa/[a].js'), account = require('../../api/account/[a].js');

const jwt = o => 'h.' + Buffer.from(JSON.stringify(o)).toString('base64url') + '.s';
const A1 = jwt({ aal: 'aal1', session_id: 'S1' }), A1b = jwt({ aal: 'aal1', session_id: 'S2' }), A2 = jwt({ aal: 'aal2', session_id: 'S9' });
let db, calls, now;
function reset(extra) {
  now = Date.parse('2026-10-12T03:00:00Z');
  db = { session_2fa: [], email_otps: [], user_devices: [], recovery_codes: [{ id: 1, user_id: 'U1' }], recovery_state: [], factors: [{ id: 'f1' }], failFactor: false, failMail: false, ...extra };
  calls = { mail: [], factorDel: [] };
}
// Tiruan SQL: aturan sama dengan schema.sql
const issue = ({ p_user, p_hash, p_ttl_min }) => {
  const r = db.email_otps.find(x => x.user_id === p_user); let n = 1, ws = now;
  if (r) {
    if (r.sent_at > now - 30e3) return 'wait:' + Math.max(1, Math.ceil((r.sent_at + 30e3 - now) / 1e3));
    if (r.window_start > now - 3600e3) { if (r.sent_count >= 6) return 'cap:' + Math.max(1, Math.ceil((r.window_start + 3600e3 - now) / 6e4)); n = r.sent_count + 1; ws = r.window_start }
  }
  db.email_otps = db.email_otps.filter(x => x.user_id !== p_user);
  db.email_otps.push({ user_id: p_user, code_hash: p_hash, expires_at: now + p_ttl_min * 6e4, attempts: 0, sent_at: now, sent_count: n, window_start: ws });
  return 'ok';
};
const check = ({ p_user, p_hash }) => {
  const r = db.email_otps.find(x => x.user_id === p_user);
  if (!r || r.expires_at < now) return 'expired';
  if (r.attempts >= 5) return 'locked';
  if (r.code_hash === p_hash) { db.email_otps = db.email_otps.filter(x => x !== r); return 'ok' }
  r.attempts++; return r.attempts >= 5 ? 'locked' : 'bad:' + (5 - r.attempts);
};
const match = (r, q) => [...q.entries()].every(([k, v]) => {
  if (['select', 'order', 'limit'].includes(k)) return true;
  if (v === 'is.null') return r[k] == null; if (v === 'not.is.null') return r[k] != null;
  if (v.startsWith('lt.')) return Date.parse(r[k]) < Date.parse(v.slice(3));
  return String(r[k]) === v.replace(/^eq\./, '');
});
global.fetch = async (url, o = {}) => {
  const u = new URL(url), m = (o.method || 'GET').toUpperCase(), body = o.body ? JSON.parse(o.body) : null, ok = (d, s = 200) => ({ ok: s < 300, status: s, json: async () => d });
  if (u.hostname === 'api.resend.com') { if (db.failMail) return ok({}, 500); calls.mail.push(body); return ok({}) }
  if (u.pathname === '/auth/v1/user') { const t = (o.headers.Authorization || '').replace('Bearer ', ''); return t === 'bad' ? ok({}, 401) : ok({ id: 'U1', email: 'tes@x.id' }) }
  if (u.pathname === '/auth/v1/admin/users/U1' && m === 'GET') return ok({ id: 'U1', factors: db.factors });
  if (u.pathname.startsWith('/auth/v1/admin/users/U1/factors/')) { if (db.failFactor) return ok({}, 500); const id = u.pathname.split('/').pop(); calls.factorDel.push(id); db.factors = db.factors.filter(f => f.id !== id); return ok({}) }
  if (u.pathname === '/rest/v1/rpc/email_otp_issue') return ok(issue(body));
  if (u.pathname === '/rest/v1/rpc/email_otp_check') return ok(check(body));
  if (u.pathname.startsWith('/rest/v1/')) {
    const t = u.pathname.split('/').pop();
    if (m === 'GET') return ok(db[t].filter(r => match(r, u.searchParams)).map(r => ({ ...r })));
    if (m === 'POST') { const L = Array.isArray(body) ? body : [body]; if (t === 'session_2fa') L.forEach(b => { db[t] = db[t].filter(r => !(r.user_id === b.user_id && r.session_id === b.session_id)) }); L.forEach(r => db[t].push({ ...r })); return ok({}, 201) }
    if (m === 'DELETE') { const hit = new Set(db[t].filter(r => match(r, u.searchParams))); db[t] = db[t].filter(r => !hit.has(r)); return ok({}) }
  }
  throw new Error('fetch tidak ditangani: ' + m + ' ' + url);
};
const call = async (h, { a, method = 'POST', token, body }) => {
  let st = 0, out; const res = { status(s) { st = s; return this }, json(o) { out = o; return this } };
  await h({ method, query: { a }, body, headers: { authorization: token ? 'Bearer ' + token : '', 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile Safari/537.36', 'x-forwarded-for': '203.0.113.77', 'x-vercel-ip-city': 'Jakarta', 'x-vercel-ip-country': 'ID' } }, res); return { st, out };
};
const sentCode = () => { const m = /^(\d{6}) adalah/.exec(calls.mail.at(-1).subject); return m && m[1] };
const send = token => call(twofa, { a: 'send', token });
const verify = (token, code) => call(twofa, { a: 'verify', token, body: { code } });

test('sesi kata sandi saja (aal1) tidak lolos pemeriksaan 2FA sebelum kode email dimasukkan', async () => {
  reset();
  assert.equal((await call(account, { a: 'devices', token: A1 })).st, 401);
  assert.deepEqual((await call(twofa, { a: 'status', method: 'GET', token: A1 })).out, { verified: false, method: null });
  assert.equal((await call(twofa, { a: 'status', method: 'GET', token: 'bad' })).st, 401);
  assert.deepEqual((await call(twofa, { a: 'status', method: 'GET', token: A2 })).out, { verified: true, method: 'totp' });
});

test('alur lengkap: kirim kode, kode salah, kode benar, sesi diakui setara aal2', async () => {
  reset();
  const s = await send(A1); assert.equal(s.st, 200); assert.equal(s.out.ok, true);
  assert.equal(calls.mail.length, 1); assert.equal(calls.mail[0].to, 'tes@x.id'); const code = sentCode(); assert.match(code, /^\d{6}$/);
  assert.ok(calls.mail[0].html.includes(code)); assert.ok(!JSON.stringify(db.email_otps).includes(code), 'kode asli tidak boleh tersimpan, hanya HMAC-nya');
  const wrong = code === '000000' ? '111111' : '000000';
  const bad = await verify(A1, wrong); assert.equal(bad.st, 400); assert.match(bad.out.error, /Sisa 4 percobaan/);
  assert.equal((await call(account, { a: 'devices', token: A1 })).st, 401);           // masih belum lolos
  const good = await verify(A1, code); assert.equal(good.st, 200); assert.equal(good.out.ok, true);
  assert.deepEqual(db.session_2fa.map(r => [r.user_id, r.session_id]), [['U1', 'S1']]);
  assert.equal(db.email_otps.length, 0, 'kode sekali pakai');
  assert.equal((await call(account, { a: 'devices', token: A1 })).st, 200);           // sekarang lolos
  assert.equal((await call(account, { a: 'devices', token: A1b })).st, 401);          // sesi lain tidak ikut lolos
  assert.deepEqual((await call(twofa, { a: 'status', method: 'GET', token: A1 })).out, { verified: true, method: 'email' });
  assert.equal((await verify(A1, code)).st, 400);                                     // kode yang sama tidak bisa dipakai lagi
});

test('verify: 5 tebakan salah mengunci kode (kode benar pun ditolak), harus minta kode baru', async () => {
  reset(); await send(A1); const code = sentCode(), wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 4; i++) assert.equal((await verify(A1, wrong)).st, 400);
  const last = await verify(A1, wrong); assert.equal(last.st, 429); assert.equal(last.out.renew, true);
  const after = await verify(A1, code); assert.equal(after.st, 429); assert.equal(db.session_2fa.length, 0);
  now += 31e3; await send(A1); assert.equal((await verify(A1, sentCode())).st, 200);   // kode baru berfungsi
});

test('verify: kode kedaluwarsa setelah 10 menit; format salah ditolak sebelum menyentuh database', async () => {
  reset(); await send(A1); const code = sentCode();
  assert.equal((await verify(A1, '12')).st, 400); assert.equal(db.email_otps[0].attempts, 0);
  now += 10 * 60e3 + 1000; const r = await verify(A1, code); assert.equal(r.st, 400); assert.equal(r.out.renew, true); assert.equal(db.session_2fa.length, 0);
});

test('send: jeda 30 detik, maksimal 6 kode per jam, lalu pulih; tanpa sesi ditolak', async () => {
  reset();
  assert.equal((await send(null)).st, 401); assert.equal((await send('bad')).st, 401);
  assert.equal((await send(A1)).st, 200);
  const w = await send(A1); assert.equal(w.st, 429); assert.ok(w.out.wait >= 1 && w.out.wait <= 30); assert.equal(calls.mail.length, 1);
  for (let i = 0; i < 5; i++) { now += 31e3; assert.equal((await send(A1)).st, 200) }
  now += 31e3; const cap = await send(A1); assert.equal(cap.st, 429); assert.match(cap.out.error, /Coba lagi dalam \d+ menit/); assert.equal(calls.mail.length, 6);
  now += 3600e3; assert.equal((await send(A1)).st, 200);
});

test('send: email gagal terkirim tidak meninggalkan kode atau batas; server belum dikonfigurasi memberi 503', async () => {
  reset({ failMail: true }); const r = await send(A1); assert.equal(r.st, 502); assert.equal(db.email_otps.length, 0);
  db.failMail = false; assert.equal((await send(A1)).st, 200);                         // langsung bisa coba lagi, tanpa tunggu 30 detik
  const key = process.env.RESEND_API_KEY; delete process.env.RESEND_API_KEY; try { assert.equal((await send(A1)).st, 503) } finally { process.env.RESEND_API_KEY = key }
});

test('send dan verify hanya menerima POST', async () => {
  reset(); assert.equal((await call(twofa, { a: 'send', method: 'GET', token: A1 })).st, 405); assert.equal((await call(twofa, { a: 'verify', method: 'GET', token: A1 })).st, 405);
});

test('totp-off: wajib sesi lolos 2FA; autentikator dilepas, sesi tetap diakui, kode pemulihan dihapus, pemilik diberi tahu', async () => {
  reset({ user_devices: [{ user_id: 'U1', device_id: 'd1', session_id: 'S5', revoked_at: null }, { user_id: 'U1', device_id: 'd2', session_id: 'S6', revoked_at: '2026-10-01T00:00:00Z' }] });
  assert.equal((await call(twofa, { a: 'totp-off', token: A1 })).st, 401); assert.deepEqual(calls.factorDel, []);
  const r = await call(twofa, { a: 'totp-off', token: A2 }); assert.equal(r.st, 200);
  assert.deepEqual(calls.factorDel, ['f1']); assert.deepEqual(db.factors, []);
  assert.deepEqual(db.session_2fa.map(x => x.session_id).sort(), ['S5', 'S9'], 'sesi ini dan sesi aktif lain diakui; sesi yang dikeluarkan tidak');
  assert.equal(db.recovery_codes.length, 0); assert.equal(calls.mail.length, 1); assert.match(calls.mail[0].subject, /dimatikan/);
});

test('totp-off: bila autentikator gagal dilepas, tidak ada yang berubah', async () => {
  reset({ failFactor: true }); const r = await call(twofa, { a: 'totp-off', token: A2 }); assert.equal(r.st, 502);
  assert.equal(db.session_2fa.length, 0); assert.equal(db.recovery_codes.length, 1); assert.equal(calls.mail.length, 0);
});

test('send: galat database dilaporkan jelas (fungsi belum ada / tanpa izin / lain) dan penyebab aslinya dicatat ke log', async () => {
  const real = global.fetch, errs = [], orig = console.error; console.error = (...a) => errs.push(a.join(' '));
  const failRpc = (status, body) => { global.fetch = async (url, o) => String(url).includes('/rpc/email_otp_issue') ? { ok: false, status, text: async () => JSON.stringify(body), json: async () => body } : real(url, o) };
  try {
    reset();
    failRpc(404, { code: 'PGRST202', message: 'Could not find the function public.email_otp_issue' });
    let r = await send(A1); assert.equal(r.st, 500); assert.equal(r.out.code, 'PGRST202'); assert.match(r.out.error, /schema\.sql/); assert.equal(calls.mail.length, 0);
    failRpc(403, { code: '42501', message: 'permission denied for function email_otp_issue' });
    r = await send(A1); assert.equal(r.st, 500); assert.match(r.out.error, /SUPABASE_SERVICE_ROLE_KEY/);
    failRpc(500, { code: 'XX000', message: 'boom' });
    r = await send(A1); assert.equal(r.st, 500); assert.equal(r.out.error, 'Gagal menyiapkan kode. Coba lagi.');
    assert.ok(errs.some(e => e.includes('PGRST202') && e.includes('email_otp_issue')), 'penyebab sebenarnya harus tercatat di log');
  } finally { global.fetch = real; console.error = orig }
});
