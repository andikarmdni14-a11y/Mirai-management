// Kode pemulihan 2FA. Satu fungsi: /api/recovery/status | generate | use
// Kode (10 karakter, ~50 bit) tidak disimpan: hanya HMAC-SHA256 dengan RECOVERY_SECRET milik server.
// "use" membutuhkan sesi sah tingkat apa pun (kata sandi sudah benar tetapi HP hilang), membatasi percobaan, lalu
// melepas semua autentikator lewat Admin API supaya pengguna bisa memasang yang baru, dan mengeluarkan sesi lain.
const { c, S, H, APP, rest, user, mail, shell, wib, geo, label, J, guard } = require('../_lib');
const AL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', MAXF = 5, LOCK = 15 * 60e3;
const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const hmac = (uid, code) => c.createHmac('sha256', process.env.RECOVERY_SECRET || '').update(uid + ':' + code).digest('hex');
const mk = () => { let s = ''; for (let i = 0; i < 10; i++) s += AL[c.randomInt(AL.length)]; return s };
const fmt = s => s.slice(0, 5) + '-' + s.slice(5);
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && c.timingSafeEqual(x, y) };

module.exports = async (req, res) => {
  try {
    if (!guard(req, res)) return;
    if (!process.env.RECOVERY_SECRET) return J(res, 503, { error: 'RECOVERY_SECRET belum diatur di server' });
    const a = req.query.a;
    if (a === 'use') {
      if (req.method !== 'POST') return J(res, 405, { error: 'Metode tidak didukung' });
      const u = await user(req, 'any'); if (!u) return J(res, 401, { error: 'Sesi tidak valid. Masuk dengan kata sandi dulu.' });
      const st = (await (await rest(`recovery_state?select=fails,locked_until&user_id=eq.${u.id}`)).json())[0];
      if (st && st.locked_until && Date.parse(st.locked_until) > Date.now()) return J(res, 429, { error: 'Terlalu banyak percobaan. Coba lagi dalam ' + Math.ceil((Date.parse(st.locked_until) - Date.now()) / 6e4) + ' menit.' });
      const code = norm((req.body || {}).code); if (code.length !== 10) return J(res, 400, { error: 'Kode pemulihan harus 10 karakter.' });
      const rows = await (await rest(`recovery_codes?select=id,code_hash&user_id=eq.${u.id}&used_at=is.null`)).json(), h = hmac(u.id, code);
      let hit = false; for (const r of rows) if (same(r.code_hash, h)) hit = true; // periksa semua baris agar waktu respons tidak membocorkan posisi
      if (!hit) {
        const f = (st ? st.fails : 0) + 1, lock = f >= MAXF;
        await rest('recovery_state', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ user_id: u.id, fails: lock ? 0 : f, locked_until: lock ? new Date(Date.now() + LOCK).toISOString() : null }) });
        return J(res, 400, { error: lock ? 'Terlalu banyak percobaan salah. Dikunci 15 menit.' : 'Kode pemulihan salah atau sudah dipakai.' });
      }
      // Kode cocok: lepas semua faktor 2FA. Kode baru dianggap terpakai HANYA bila pelepasan berhasil.
      const au = await (await fetch(`${S}/auth/v1/admin/users/${u.id}`, { headers: H })).json(), facs = au.factors || [];
      for (const f of facs) { const d = await fetch(`${S}/auth/v1/admin/users/${u.id}/factors/${f.id}`, { method: 'DELETE', headers: H }); if (!d.ok) return J(res, 502, { error: 'Gagal melepas autentikator lama. Kode Anda belum terpakai, coba lagi.' }) }
      await rest(`recovery_codes?user_id=eq.${u.id}`, { method: 'DELETE' }); // semua kode lama dibatalkan setelah 2FA direset
      await rest(`recovery_state?user_id=eq.${u.id}`, { method: 'DELETE' });
      try { await fetch(S + '/auth/v1/logout?scope=others', { method: 'POST', headers: { apikey: H.apikey, Authorization: 'Bearer ' + u.jwt } }) } catch (e) { }
      const g = geo(req);
      await mail(u.email, 'Kode pemulihan 2FA dipakai di akun Mirai Anda', shell('Kode pemulihan dipakai', `<p>Pada <b>${wib(Date.now())}</b>, kode pemulihan dipakai untuk mereset 2FA akun <b>${u.email}</b> dari <b>${label(req.headers['user-agent'])}</b>${g.city || g.country ? ' (' + [g.city, g.country].filter(Boolean).join(', ') + ')' : ''}.</p><p>Sesi di perangkat lain sudah dikeluarkan dan autentikator lama dilepas. Jika ini <b>bukan Anda</b>, segera ganti kata sandi dan pasang 2FA baru.</p>`, ['Buka Mirai', APP]));
      return J(res, 200, { ok: true });
    }
    const u = await user(req); if (!u) return J(res, 401, { error: 'Sesi tidak valid atau belum lolos 2FA' });
    if (a === 'status') { const rows = await (await rest(`recovery_codes?select=id&user_id=eq.${u.id}&used_at=is.null`)).json(); return J(res, 200, { remaining: rows.length }) }
    if (a === 'generate') {
      if (req.method !== 'POST') return J(res, 405, { error: 'Metode tidak didukung' });
      const codes = Array.from({ length: 10 }, mk);
      await rest(`recovery_codes?user_id=eq.${u.id}`, { method: 'DELETE' });
      const r = await rest('recovery_codes', { method: 'POST', body: JSON.stringify(codes.map(x => ({ user_id: u.id, code_hash: hmac(u.id, x) }))) });
      if (!r.ok) return J(res, 500, { error: 'Gagal menyimpan kode' });
      return J(res, 200, { codes: codes.map(fmt) });
    }
    return J(res, 404, { error: 'Aksi tidak dikenal' });
  } catch (e) { return J(res, 500, { error: e.message }) }
};
