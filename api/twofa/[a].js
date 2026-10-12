// 2FA lewat kode email (v23). Satu fungsi: /api/twofa/status | send | verify | totp-off
// Kode 6 digit tidak disimpan: hanya HMAC-SHA256 dengan RECOVERY_SECRET. Berlaku 10 menit, maksimal 5 tebakan per kode,
// kirim ulang paling cepat tiap 30 detik dan paling banyak 6 kali per jam. Batas itu dijaga di database oleh fungsi
// email_otp_issue / email_otp_check (atomik, tahan permintaan paralel). Setelah kode benar, sesi dicatat di session_2fa dan
// dianggap setara aal2 oleh RLS (public.authed()) dan oleh user() di api/_lib.js.
const { c, S, H, esc, rest, user, mail, shell, wib, geo, label, J, guard, dbFail } = require('../_lib');
const TTL = 10;                                                  // menit
const hmac = (uid, code) => c.createHmac('sha256', process.env.RECOVERY_SECRET || '').update('otp:' + uid + ':' + code).digest('hex');
const rpc = (fn, args) => rest('rpc/' + fn, { method: 'POST', body: JSON.stringify(args) });
const mailOn = () => !!(process.env.RESEND_API_KEY && process.env.FROM_EMAIL);

// Menandai sesi sebagai sudah lolos 2FA. Sekaligus membersihkan catatan sesi yang sudah lebih dari setahun.
async function mark(uid, sids) {
  const rows = [...new Set(sids.filter(Boolean))].map(session_id => ({ user_id: uid, session_id, verified_at: new Date().toISOString() }));
  if (rows.length) { const r = await rest('session_2fa', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(rows) }); if (!r.ok) { await dbFail('twofa mark session_2fa', r); return false } }
  await rest(`session_2fa?user_id=eq.${uid}&verified_at=lt.${encodeURIComponent(new Date(Date.now() - 365 * 864e5).toISOString())}`, { method: 'DELETE' }).catch(() => { });
  return true;
}

module.exports = async (req, res) => {
  try {
    if (!guard(req, res)) return;
    const a = req.query.a;
    if (a === 'status') {
      const u = await user(req, 'any'); if (!u) return J(res, 401, { error: 'Sesi tidak valid. Masuk dengan kata sandi dulu.' });
      return J(res, 200, { verified: !!u.tfa, method: u.tfa });
    }
    if (req.method !== 'POST') return J(res, 405, { error: 'Metode tidak didukung' });

    if (a === 'send') {
      if (!process.env.RECOVERY_SECRET) return J(res, 503, { error: 'RECOVERY_SECRET belum diatur di server' });
      if (!mailOn()) return J(res, 503, { error: 'Pengiriman email belum diatur di server (RESEND_API_KEY dan FROM_EMAIL).' });
      const u = await user(req, 'any'); if (!u) return J(res, 401, { error: 'Sesi tidak valid. Masuk dengan kata sandi dulu.' });
      if (!u.email) return J(res, 400, { error: 'Akun ini tidak punya alamat email.' });
      const code = String(c.randomInt(0, 1e6)).padStart(6, '0');
      const r = await rpc('email_otp_issue', { p_user: u.id, p_hash: hmac(u.id, code), p_ttl_min: TTL });
      if (!r.ok) {
        const f = await dbFail('twofa/send rpc email_otp_issue', r);
        return J(res, 500, { code: f.code, error: f.kind === 'schema' ? 'Database belum diperbarui: fungsi email_otp_issue tidak ditemukan. Jalankan bagian v23 di schema.sql (SQL Editor Supabase), lalu coba lagi.'
          : f.kind === 'izin' ? 'Server tidak punya izin ke database. Periksa SUPABASE_SERVICE_ROLE_KEY di Vercel dan jalankan bagian v23.1 di schema.sql.' : 'Gagal menyiapkan kode. Coba lagi.' });
      }
      const st = String(await r.json());
      if (st.startsWith('wait:')) return J(res, 429, { error: 'Tunggu sebentar sebelum meminta kode baru.', wait: +st.slice(5) });
      if (st.startsWith('cap:')) return J(res, 429, { error: 'Terlalu banyak permintaan kode. Coba lagi dalam ' + st.slice(4) + ' menit.', wait: +st.slice(4) * 60 });
      const g = geo(req);
      const ok = await mail(u.email, code + ' adalah kode verifikasi Mirai Anda', shell('Kode verifikasi Anda',
        `<p>Masukkan kode ini untuk masuk ke Mirai Management:</p><p style="margin:16px 0;font-size:32px;font-weight:700;letter-spacing:8px;color:#09090b">${code}</p><p>Kode berlaku ${TTL} menit dan hanya bisa dipakai sekali. Permintaan datang dari <b>${label(req.headers['user-agent'])}</b>${g.city || g.country ? ' (' + [g.city, g.country].filter(Boolean).join(', ') + ')' : ''}.</p><p><b>Jangan bagikan kode ini kepada siapa pun</b>, termasuk yang mengaku dari Mirai. Bila bukan Anda yang masuk, abaikan email ini dan segera ganti kata sandi.</p>`));
      if (!ok) { await rest(`email_otps?user_id=eq.${u.id}`, { method: 'DELETE' }).catch(() => { }); return J(res, 502, { error: 'Kode belum bisa dikirim. Coba lagi sebentar.' }) }
      return J(res, 200, { ok: true, wait: 30, ttl: TTL });
    }

    if (a === 'verify') {
      if (!process.env.RECOVERY_SECRET) return J(res, 503, { error: 'RECOVERY_SECRET belum diatur di server' });
      const u = await user(req, 'any'); if (!u) return J(res, 401, { error: 'Sesi tidak valid. Masuk dengan kata sandi dulu.' });
      if (!u.sid) return J(res, 400, { error: 'Sesi tidak dikenali. Masuk ulang.' });
      const code = String((req.body || {}).code || '').replace(/\D/g, '');
      if (code.length !== 6) return J(res, 400, { error: 'Masukkan 6 digit kode.' });
      const r = await rpc('email_otp_check', { p_user: u.id, p_hash: hmac(u.id, code) });
      if (!r.ok) {
        const f = await dbFail('twofa/verify rpc email_otp_check', r);
        return J(res, 500, { code: f.code, error: f.kind === 'schema' ? 'Database belum diperbarui: fungsi email_otp_check tidak ditemukan. Jalankan bagian v23 di schema.sql (SQL Editor Supabase), lalu coba lagi.'
          : f.kind === 'izin' ? 'Server tidak punya izin ke database. Periksa SUPABASE_SERVICE_ROLE_KEY di Vercel dan jalankan bagian v23.1 di schema.sql.' : 'Gagal memeriksa kode. Coba lagi.' });
      }
      const st = String(await r.json());
      if (st === 'expired') return J(res, 400, { error: 'Kode kedaluwarsa atau belum diminta. Kirim kode baru.', renew: true });
      if (st === 'locked') return J(res, 429, { error: 'Terlalu banyak tebakan salah. Kirim kode baru.', renew: true });
      if (st.startsWith('bad:')) return J(res, 400, { error: 'Kode salah. Sisa ' + st.slice(4) + ' percobaan.' });
      if (st !== 'ok') return J(res, 500, { error: 'Jawaban server tidak dikenal' });
      if (!(await mark(u.id, [u.sid]))) return J(res, 500, { error: 'Kode benar, tetapi sesi gagal disimpan. Coba lagi.' });
      return J(res, 200, { ok: true });
    }

    if (a === 'totp-off') {
      // Mematikan Aplikasi Autentikator (pengaturan). Wajib sesi yang sudah lolos 2FA. Autentikator dilepas lewat Admin API.
      const u = await user(req); if (!u) return J(res, 401, { error: 'Sesi tidak valid atau belum lolos 2FA' });
      const au = await (await fetch(`${S}/auth/v1/admin/users/${u.id}`, { headers: H })).json();
      for (const f of (au.factors || [])) { const d = await fetch(`${S}/auth/v1/admin/users/${u.id}/factors/${f.id}`, { method: 'DELETE', headers: H }); if (!d.ok) return J(res, 502, { error: 'Gagal melepas autentikator. Coba lagi.' }) }
      // Sesi lain yang lolos lewat autentikator tetap diakui setelah faktornya hilang (mereka memang sudah lolos 2FA).
      let sids = [u.sid]; try { const x = await rest(`user_devices?select=session_id&user_id=eq.${u.id}&revoked_at=is.null&session_id=not.is.null`); if (x.ok) sids = sids.concat((await x.json()).map(r => r.session_id)) } catch (e) { }
      if (!(await mark(u.id, sids))) return J(res, 500, { error: 'Autentikator dilepas, tetapi sesi gagal disimpan. Masuk ulang dengan kode email.' });
      await rest(`recovery_codes?user_id=eq.${u.id}`, { method: 'DELETE' }).catch(() => { });
      await rest(`recovery_state?user_id=eq.${u.id}`, { method: 'DELETE' }).catch(() => { });
      const g = geo(req);
      await mail(u.email, 'Aplikasi Autentikator dimatikan di akun Mirai Anda', shell('Aplikasi Autentikator dimatikan', `<p>Pada <b>${wib(Date.now())}</b>, Aplikasi Autentikator dimatikan untuk akun <b>${esc(u.email)}</b> dari <b>${label(req.headers['user-agent'])}</b>${g.city || g.country ? ' (' + [g.city, g.country].filter(Boolean).join(', ') + ')' : ''}. Mulai sekarang, masuk memakai kode yang dikirim ke email.</p><p>Bila bukan Anda yang melakukannya, segera ganti kata sandi dan keluarkan semua perangkat lewat Setelan.</p>`));
      return J(res, 200, { ok: true });
    }
    return J(res, 404, { error: 'Aksi tidak dikenal' });
  } catch (e) { console.error('[twofa] galat tak terduga:', e); return J(res, 500, { error: e.message }) }
};
