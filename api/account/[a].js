// Akun dan perangkat. Satu fungsi: /api/account/device | devices | revoke | logout-all | delete
const { S, H, APP, esc, rest, user, label, geo, mail, shell, wib, J, guard } = require('../_lib');
const okId = s => typeof s === 'string' && /^[a-z0-9]{8,64}$/.test(s);

module.exports = async (req, res) => {
  try {
    if (!guard(req, res)) return;
    const a = req.query.a, u = await user(req); if (!u) return J(res, 401, { error: 'Sesi tidak valid atau belum lolos 2FA' });
    const body = req.body || {};
    if (a === 'device') { // dipanggil tiap aplikasi dibuka: daftarkan perangkat, deteksi dikeluarkan, kirim email bila perangkat baru
      if (req.method !== 'POST') return J(res, 405, { error: 'Metode tidak didukung' }); if (!okId(body.id)) return J(res, 400, { error: 'id perangkat tidak valid' });
      const q = `user_id=eq.${u.id}&device_id=eq.${body.id}`, row = (await (await rest(`user_devices?select=session_id,revoked_at&${q}`)).json())[0], g = geo(req), lb = label(req.headers['user-agent']), now = new Date().toISOString();
      if (row) {
        if (row.revoked_at && row.session_id && row.session_id === u.sid) return J(res, 200, { revoked: true });
        await rest(`user_devices?${q}`, { method: 'PATCH', body: JSON.stringify({ session_id: u.sid, last_seen: now, revoked_at: null, label: lb, ip: g.ip, city: g.city, country: g.country }) });
        return J(res, 200, { revoked: false, isNew: false });
      }
      const had = (await (await rest(`user_devices?select=device_id&user_id=eq.${u.id}&limit=1`)).json()).length > 0;
      await rest('user_devices', { method: 'POST', body: JSON.stringify({ user_id: u.id, device_id: body.id, session_id: u.sid, label: lb, ip: g.ip, city: g.city, country: g.country }) });
      if (had) await mail(u.email, 'Login baru ke akun Mirai Anda', shell('Login dari perangkat baru', `<p>Akun <b>${esc(u.email)}</b> baru saja dipakai masuk dari perangkat yang belum pernah kami lihat:</p><p><b>${esc(lb)}</b><br>${esc([g.city, g.country].filter(Boolean).join(', ') || 'Lokasi tidak diketahui')}${g.ip ? ' (IP ' + esc(g.ip) + ')' : ''}<br>${wib(Date.now())}</p><p>Jika ini Anda, abaikan email ini. Jika <b>bukan</b>, buka Mirai, keluarkan perangkat itu, lalu ganti kata sandi.</p>`, ['Tinjau perangkat aktif', APP + '/?act=security']));
      return J(res, 200, { revoked: false, isNew: had });
    }
    if (a === 'devices') {
      const rows = await (await rest(`user_devices?select=device_id,label,ip,city,country,first_seen,last_seen&user_id=eq.${u.id}&revoked_at=is.null&order=last_seen.desc&limit=20`)).json(), me = String(req.query.id || '');
      return J(res, 200, { devices: rows.map(r => ({ id: r.device_id, label: r.label, ip: r.ip, city: r.city, country: r.country, first_seen: r.first_seen, last_seen: r.last_seen, current: r.device_id === me })) });
    }
    if (req.method !== 'POST') return J(res, 405, { error: 'Metode tidak didukung' });
    if (a === 'revoke') { // RLS menolak data sesi itu seketika (lihat session_ok() di schema.sql)
      if (!okId(body.id)) return J(res, 400, { error: 'id perangkat tidak valid' });
      await rest(`user_devices?user_id=eq.${u.id}&device_id=eq.${body.id}`, { method: 'PATCH', body: JSON.stringify({ revoked_at: new Date().toISOString() }) }); return J(res, 200, { ok: true });
    }
    if (a === 'logout-all') {
      await rest(`user_devices?user_id=eq.${u.id}&revoked_at=is.null`, { method: 'PATCH', body: JSON.stringify({ revoked_at: new Date().toISOString() }) });
      const r = await fetch(S + '/auth/v1/logout?scope=global', { method: 'POST', headers: { apikey: H.apikey, Authorization: 'Bearer ' + u.jwt } });
      if (!r.ok && r.status !== 204) return J(res, 502, { error: 'Server autentikasi menolak permintaan keluar' });
      return J(res, 200, { ok: true });
    }
    if (a === 'delete') { // semua tabel memakai on delete cascade ke auth.users, jadi menghapus pengguna menghapus seluruh datanya
      if (body.confirm !== 'HAPUS') return J(res, 400, { error: 'Konfirmasi tidak sesuai' });
      await mail(u.email, 'Akun Mirai Anda telah dihapus', shell('Akun dihapus', `<p>Akun <b>${esc(u.email)}</b> dan seluruh datanya dihapus pada <b>${wib(Date.now())}</b>. Tindakan ini tidak bisa dibatalkan.</p><p>Jika bukan Anda yang meminta penghapusan ini, segera hubungi kami.</p>`));
      const d = await fetch(`${S}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
      if (!d.ok) return J(res, 502, { error: 'Gagal menghapus akun di server. Coba lagi.' });
      return J(res, 200, { ok: true });
    }
    return J(res, 404, { error: 'Aksi tidak dikenal' });
  } catch (e) { return J(res, 500, { error: e.message }) }
};
