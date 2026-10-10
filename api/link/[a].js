// Open Banking (OAuth 2.0 Authorization Code + PKCE). Satu fungsi: /api/link/start | callback | sandbox | sync | unlink
// Token disimpan terenkripsi (AES-256-GCM) di tabel bank_links dan TIDAK PERNAH dikirim ke browser.
const c = require('crypto');
const S = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, APP = process.env.APP_URL || 'https://mirai-management.vercel.app', H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const NAMES = { dana: 'DANA', gopay: 'GoPay', ovo: 'OVO', bca: 'BCA', bri: 'BRI', bni: 'BNI', jago: 'Bank Jago', superbank: 'Superbank', bsi: 'BSI' };
const KEY = () => c.createHash('sha256').update(process.env.LINK_SECRET || '').digest();
const seal = o => { const iv = c.randomBytes(12), x = c.createCipheriv('aes-256-gcm', KEY(), iv), ct = Buffer.concat([x.update(JSON.stringify(o)), x.final()]); return Buffer.concat([iv, x.getAuthTag(), ct]).toString('base64url') };
const open = s => { const b = Buffer.from(s, 'base64url'), x = c.createDecipheriv('aes-256-gcm', KEY(), b.subarray(0, 12)); x.setAuthTag(b.subarray(12, 28)); return JSON.parse(Buffer.concat([x.update(b.subarray(28)), x.final()]).toString()) };
// Konfigurasi per penyedia lewat env: LINK_<ID>_ID, _SECRET, _AUTH, _TOKEN, _BAL (wajib); _SCOPE, _PATH (jalur JSON saldo, bawaan "balance"), _MASKPATH (opsional)
const env = (p, k) => process.env['LINK_' + p.toUpperCase() + '_' + k];
const live = p => ['ID', 'SECRET', 'AUTH', 'TOKEN', 'BAL'].every(k => env(p, k));
const mode = p => live(p) ? 'live' : process.env.LINK_SANDBOX == '1' ? 'sandbox' : null;
const pick = (o, p) => p.split('.').reduce((a, k) => a && a[k], o);
const esc = s => String(s).replace(/[&<>"]/g, ch => '&#' + ch.charCodeAt(0) + ';');
const sbx = (uid, p) => { const h = c.createHash('sha256').update(uid + p).digest(); return { b: 500000 + Math.round(h.readUInt32BE(0) % 9500000 / 1000) * 1000, m: '••' + String(h.readUInt16BE(4) % 10000).padStart(4, '0') } };
// Hanya sesi yang valid DAN sudah lolos 2FA (aal2), sama dengan kebijakan RLS
const user = async req => { const jwt = (req.headers.authorization || '').replace(/^Bearer /, ''); if (!jwt) return null; const r = await fetch(S + '/auth/v1/user', { headers: { apikey: K, Authorization: 'Bearer ' + jwt } }); if (!r.ok) return null; let aal; try { aal = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url')).aal } catch (e) { } return aal == 'aal2' ? r.json() : null };
const tokenReq = async (p, form) => {
  const r = await fetch(env(p, 'TOKEN'), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ ...form, client_id: env(p, 'ID'), client_secret: env(p, 'SECRET') }) }), j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Penyedia menolak penukaran token'); return { a: j.access_token, r: j.refresh_token || form.refresh_token, e: Date.now() + (j.expires_in || 3600) * 1e3 }
};
const store = (uid, p, t) => fetch(S + '/rest/v1/bank_links', { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ user_id: uid, provider: p, tokens: seal(t), updated_at: new Date().toISOString() }) });

module.exports = async (req, res) => {
  const a = req.query.a, J = (s, o) => res.status(s).json(o), go = u => { res.statusCode = 302; res.setHeader('Location', u); res.end() };
  try {
    if (!process.env.LINK_SECRET) return J(503, { error: 'LINK_SECRET belum diatur di server' });
    if (a == 'sandbox' || a == 'callback') {   // dibuka lewat navigasi browser (GET)
      let st; try { st = open(String(req.query.state)) } catch (e) { return a == 'callback' ? go(APP + '/?link_error=1') : J(400, { error: 'state tidak valid' }) }
      const cb = APP + '/api/link/callback?state=' + encodeURIComponent(req.query.state);
      if (a == 'sandbox') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.status(200).send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Izin akses (simulasi)</title><body style="font-family:system-ui,sans-serif;max-width:420px;margin:12vh auto;padding:0 20px"><p style="color:#b45309;font-weight:600">MODE SIMULASI: bukan bank sungguhan</p><h2>Izinkan Mirai membaca saldo ${esc(NAMES[st.p])}?</h2><p>Mirai hanya meminta izin baca saldo.</p><p><a href="${cb}&code=sbx" style="display:inline-block;background:#047857;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Izinkan</a> <a href="${cb}&error=access_denied" style="padding:12px 20px">Tolak</a></p>`) }
      const md = mode(st.p); if (!md || st.e < Date.now() || req.query.error || !req.query.code) return go(APP + '/?link_error=1');
      const t = md == 'live' ? await tokenReq(st.p, { grant_type: 'authorization_code', code: String(req.query.code), redirect_uri: APP + '/api/link/callback', code_verifier: st.v }) : { sbx: 1 };
      return go(APP + ((await store(st.u, st.p, t)).ok ? '/?linked=' + st.p : '/?link_error=1'))
    }
    if (req.method != 'POST') return J(405, { error: 'Metode tidak didukung' });
    const u = await user(req); if (!u) return J(401, { error: 'Sesi tidak valid atau belum lolos 2FA' });
    const p = String((req.body || {}).provider || ''); if (!NAMES[p]) return J(400, { error: 'Penyedia tidak dikenal' });
    if (a == 'start') {
      const md = mode(p); if (!md) return J(503, { error: NAMES[p] + ' belum dikonfigurasi di server' });
      const v = c.randomBytes(32).toString('base64url'), state = seal({ u: u.id, p, v, e: Date.now() + 6e5 });
      if (md == 'sandbox') return J(200, { sandbox: true, url: APP + '/api/link/sandbox?state=' + encodeURIComponent(state) });
      const q = new URLSearchParams({ response_type: 'code', client_id: env(p, 'ID'), redirect_uri: APP + '/api/link/callback', scope: env(p, 'SCOPE') || '', state, code_challenge: c.createHash('sha256').update(v).digest('base64url'), code_challenge_method: 'S256' });
      return J(200, { url: env(p, 'AUTH') + (env(p, 'AUTH').includes('?') ? '&' : '?') + q })
    }
    if (a == 'unlink') { await fetch(`${S}/rest/v1/bank_links?user_id=eq.${u.id}&provider=eq.${p}`, { method: 'DELETE', headers: H }); return J(200, { ok: true }) }
    if (a == 'sync') {
      const rows = await (await fetch(`${S}/rest/v1/bank_links?select=tokens&user_id=eq.${u.id}&provider=eq.${p}`, { headers: H })).json(); if (!rows.length) return J(404, { error: 'Akun belum terhubung' });
      let t = open(rows[0].tokens), at = new Date().toISOString();
      if (t.sbx) { const x = sbx(u.id, p); return J(200, { sandbox: true, accounts: [{ p, n: NAMES[p], m: x.m, b: x.b, at }] }) }
      if (t.e < Date.now() + 6e4 && t.r) { t = await tokenReq(p, { grant_type: 'refresh_token', refresh_token: t.r }); await store(u.id, p, t) }
      const r = await fetch(env(p, 'BAL'), { headers: { Authorization: 'Bearer ' + t.a, Accept: 'application/json' } }); if (!r.ok) return J(502, { error: 'Penyedia menolak permintaan saldo (status ' + r.status + ')' });
      const j = await r.json(), b = Number(pick(j, env(p, 'PATH') || 'balance')); if (!isFinite(b)) return J(502, { error: 'Format saldo tidak dikenali; periksa LINK_' + p.toUpperCase() + '_PATH' });
      return J(200, { sandbox: false, accounts: [{ p, n: NAMES[p], m: env(p, 'MASKPATH') ? '••' + String(pick(j, env(p, 'MASKPATH'))).slice(-4) : '', b, at }] })
    }
    return J(404, { error: 'Aksi tidak dikenal' })
  } catch (e) { return J(500, { error: e.message }) }
};
