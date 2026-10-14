// Pembantu bersama untuk fungsi API (v22). Berkas berawalan "_" tidak dijadikan fungsi oleh Vercel.
const c = require('crypto');
const S = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, APP = process.env.APP_URL || 'https://mirai-management.vercel.app';
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => '&#' + ch.charCodeAt(0) + ';');
const claims = jwt => { try { return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url')) } catch (e) { return {} } };
const rest = (path, o) => fetch(S + '/rest/v1/' + path, { ...o, headers: { ...H, ...(o && o.headers) } });

// 2FA lewat kode email (v23): sesi yang lolos dicatat di tabel session_2fa dan setara dengan aal2 (sama seperti public.authed() di schema.sql).
async function emailOk(uid, sid) {
  if (!sid) return false;
  try { const x = await rest(`session_2fa?select=session_id&user_id=eq.${uid}&session_id=eq.${encodeURIComponent(sid)}&limit=1`); if (!x.ok) { await dbFail('emailOk session_2fa', x); return false } return (await x.json()).length > 0 } catch (e) { return false }
}
// Memeriksa sesi pengguna. level 'aal2' (bawaan): sesi harus sudah lolos 2FA (autentikator = aal2, atau kode email = session_2fa) dan belum dikeluarkan lewat "Perangkat aktif".
// level 'any': sesi valid tingkat apa pun (dipakai oleh kode pemulihan dan alur kode email, saat pengguna belum lolos 2FA).
// u.tfa: 'totp' | 'email' | null, sehingga pemanggil tahu lewat cara apa sesi ini lolos.
async function user(req, level) {
  const jwt = (req.headers.authorization || '').replace(/^Bearer /, ''); if (!jwt) return null;
  const r = await fetch(S + '/auth/v1/user', { headers: { apikey: K, Authorization: 'Bearer ' + jwt } }); if (!r.ok) return null;
  const cl = claims(jwt);
  const u = await r.json(); u.jwt = jwt; u.sid = cl.session_id || null; u.aal = cl.aal;
  u.tfa = cl.aal === 'aal2' ? 'totp' : (await emailOk(u.id, u.sid)) ? 'email' : null;
  if (level !== 'any' && !u.tfa) return null;
  if (level !== 'any' && u.sid) { const x = await rest(`user_devices?select=device_id&user_id=eq.${u.id}&session_id=eq.${encodeURIComponent(u.sid)}&revoked_at=not.is.null&limit=1`); if (x.ok && (await x.json()).length) return null }
  return u;
}
const label = ua => {
  ua = String(ua || ''); const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const o = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'perangkat tidak dikenal';
  return b + ' di ' + o;
};
// IP disimpan tersamar (3 blok pertama IPv4; 3 grup pertama IPv6) supaya cukup untuk dikenali pemilik tanpa menyimpan alamat penuh.
const mask = ip => { ip = String(ip || '').split(',')[0].trim(); if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip.replace(/\.\d+$/, '.x'); if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':') + ':…'; return '' };
const geo = req => { const h = req.headers, dec = s => { try { return decodeURIComponent(s || '') } catch (e) { return s || '' } }; return { ip: mask(h['x-forwarded-for'] || h['x-real-ip']), city: dec(h['x-vercel-ip-city']), country: h['x-vercel-ip-country'] || '' } };

// Email transaksional (Resend). Mengembalikan false bila belum dikonfigurasi atau gagal; tidak pernah melempar galat.
// mailTry mengembalikan alasan kegagalan dari Resend ({ ok:false, status, name, message }) dan mencatatnya ke Vercel Logs. Tanpa keadaan bersama,
// jadi aman dipanggil paralel. mail() tetap boolean untuk pemanggil lain.
async function mailTry(to, subject, html) {
  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL || !to) return { ok: false, status: 0, name: 'config', message: 'RESEND_API_KEY / FROM_EMAIL / penerima kosong' };
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.FROM_EMAIL, to, subject, html }) });
    if (r.ok) return { ok: true };
    let b = {}; try { b = await r.json() } catch (e) { }
    const f = { ok: false, status: r.status, name: String(b.name || ''), message: String(b.message || '').slice(0, 300) };
    console.error('[mail] Resend ' + f.status + ' ' + f.name + ' ' + f.message);
    return f;
  } catch (e) { console.error('[mail] Resend tidak terjangkau: ' + e.message); return { ok: false, status: 0, name: 'network', message: String(e.message || e) } }
}
const mail = async (to, subject, html) => (await mailTry(to, subject, html)).ok;
// Petunjuk yang bisa ditindaklanjuti dari galat Resend ('' bila penyebabnya tidak dikenali).
const mailHint = f => {
  const m = ((f.name || '') + ' ' + (f.message || '')).toLowerCase();
  if (f.status === 0 && f.name === 'config') return 'Pengiriman email belum diatur di server (RESEND_API_KEY dan FROM_EMAIL).';
  if (f.status === 401 || /api[ _]key|restricted/.test(m)) return 'RESEND_API_KEY tidak valid, dicabut, atau tidak boleh mengirim. Buat kunci baru (izin Sending access) di Resend lalu perbarui di Vercel.';
  if (f.status === 403 || /verify a domain|not verified|testing emails/.test(m)) return 'Resend menolak: domain pengirim (FROM_EMAIL) belum diverifikasi, atau akun Resend masih mode uji yang hanya boleh mengirim ke email pemilik akun. Verifikasi domain di resend.com/domains.';
  if (f.status === 422 || /invalid.*from|from.*invalid/.test(m)) return 'Format FROM_EMAIL tidak valid. Isi dengan: Mirai <no-reply@domain-anda.id> (tanpa tanda kutip tambahan).';
  if (f.status === 429) return 'Batas kirim Resend tercapai. Coba lagi nanti.';
  return '';
};
// Kerangka email bermerek Mirai (sama dengan email-templates/ untuk Supabase Auth).
const shell = (title, body, cta) => `<div style="background:#f4f4f5;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,sans-serif"><div style="max-width:440px;margin:auto;background:#fff;border:1px solid #e4e4e7;border-radius:14px;padding:28px"><img src="${APP}/icons/icon-192.png" width="44" height="44" alt="Mirai Management" style="border-radius:10px"><h2 style="margin:16px 0 8px;color:#09090b;font-size:20px">${esc(title)}</h2><div style="color:#3f3f46;font-size:14px;line-height:1.6">${body}</div>${cta ? `<p style="margin:20px 0 0"><a href="${cta[1]}" style="display:inline-block;background:#047857;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${esc(cta[0])}</a></p>` : ''}<p style="margin:24px 0 0;color:#71717a;font-size:12px">Email otomatis dari Mirai Management. Jangan membalas email ini.</p></div></div>`;
const wib = d => new Date(d).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB';
// Membaca galat Supabase (PostgREST) yang sebenarnya, mencatatnya ke Vercel Logs, lalu menggolongkan penyebabnya:
//   'schema' = fungsi/tabel belum ada di database (SQL belum dijalankan atau cache skema belum dimuat ulang)
//   'izin'   = kunci server salah atau role service_role belum punya hak akses
//   'lain'   = sebab lain (lihat Vercel Logs)
async function dbFail(tag, r) {
  let raw = '', b = {}; try { raw = await r.text(); b = JSON.parse(raw) } catch (e) { }
  const code = String(b.code || ''), msg = String(b.message || raw || '').slice(0, 300);
  console.error('[' + tag + '] Supabase ' + r.status + ' ' + code + ' ' + msg);
  const kind = (r.status === 404 || ['PGRST202', 'PGRST205', '42883', '42P01'].includes(code)) ? 'schema'
    : (r.status === 401 || r.status === 403 || code === '42501' || /jwt|api key|permission denied/i.test(msg)) ? 'izin' : 'lain';
  return { kind, code: code || String(r.status) };
}
const J = (res, s, o) => res.status(s).json(o);
const guard = (req, res) => { if (!S || !K) { J(res, 503, { error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diatur di server' }); return false } return true };
module.exports = { c, S, K, H, APP, esc, claims, rest, user, label, mask, geo, mail, shell, wib, J, guard, dbFail, mailTry, mailHint };
