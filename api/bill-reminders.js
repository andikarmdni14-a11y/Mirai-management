// Vercel Cron harian (01:00 UTC = 08:00 WIB). Email dan push dikirim TEPAT 7 hari sebelum jatuh tempo.
const S = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const APP = process.env.APP_URL || 'https://mirai-management.vercel.app';
const rp = n => 'Rp' + Math.round(n).toLocaleString('id-ID'), esc = s => String(s).replace(/[&<>"]/g, c => '&#' + c.charCodeAt(0) + ';');
const pad = n => String(n).padStart(2, '0'), iso = d => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());

module.exports = async (req, res) => {
  if (req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) return res.status(401).send('unauthorized');
  const now = new Date(Date.now() + 7 * 36e5), y = now.getUTCFullYear(), m = now.getUTCMonth(), today = Date.UTC(y, m, now.getUTCDate());
  const dim = (a, b) => new Date(Date.UTC(a, b + 1, 0)).getUTCDate();
  const addM = (s, k, d0) => { const t = new Date(s + 'T00:00:00Z'), yy = t.getUTCFullYear(), mo = t.getUTCMonth() + k; return iso(new Date(Date.UTC(yy, mo, Math.min(d0 || t.getUTCDate(), dim(yy, mo))))) };
  // Tagihan lama (tanggal 1-31 + bulan lunas) diubah ke tanggal penuh, sama dengan mig() di app.js
  const norm = b => { if (b.due) return b.due; const k = b.p === y + '-' + pad(m + 1) ? 1 : 0; return iso(new Date(Date.UTC(y, m + k, Math.min(b.d || 1, dim(y, m + k))))) };
  let wp = null; try { wp = require('web-push'); wp.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE) } catch (e) { wp = null }

  const r = await fetch(`${S}/rest/v1/user_data?select=user_id,data`, { headers: H });
  if (!r.ok) return res.status(500).send(await r.text());
  let mail = 0, push = 0;
  for (const row of await r.json()) {
    // v22: selain tagihan, ingatkan juga angsuran cicilan/paylater dan utang yang harus dibayar (7 hari sebelumnya)
    const d = row.data, left = o => Math.max(0, o.amt - (o.pays || []).reduce((s, p) => s + p.amt, 0)), paid = c => (c.n0 || 0) + (c.pays || []).length;
    const L = [
      ...(d.BL || []).filter(b => !b.done).map(b => ({ b, due: norm(b), label: 'tagihan ' + b.n })),
      ...(d.CL || []).filter(c => c.months - paid(c) > 0 && c.first).map(c => ({ b: { id: 'cl' + c.id, n: c.n, a: c.per }, due: addM(c.first, (c.pays || []).length, c.dd), label: (c.k == 'paylater' ? 'PayLater ' : 'cicilan ') + c.n, url: './?act=debt' })),
      ...(d.DT || []).filter(x => x.k == 'utang' && x.due && left(x) > 0).map(x => ({ b: { id: 'dt' + x.id, n: x.who, a: left(x) }, due: x.due, label: 'utang ke ' + x.who, url: './?act=debt' }))
    ].filter(x => Math.round((Date.parse(x.due + 'T00:00:00Z') - today) / 864e5) === 7);
    if (!L.length) continue;
    const subs = wp ? await (await fetch(`${S}/rest/v1/push_subs?select=endpoint,p256dh,auth&user_id=eq.${row.user_id}`, { headers: H })).json() : [];
    let email = null; if (row.data.EM) email = (await (await fetch(`${S}/auth/v1/admin/users/${row.user_id}`, { headers: H })).json()).email;
    if (!email && !subs.length) continue;
    for (const { b, due, label, url } of L) {
      // Catat dulu: kunci unik mencegah kirim ganda bila cron dijalankan ulang
      const g = await fetch(`${S}/rest/v1/reminder_log`, { method: 'POST', headers: { ...H, Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify({ user_id: row.user_id, bill_id: String(b.id), due_date: due }) });
      if (!g.ok || !(await g.json()).length) continue;
      const tgl = new Date(due + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
      if (email) {
        const e = await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: process.env.FROM_EMAIL, to: email, subject: `Pengingat: ${label} jatuh tempo 7 hari lagi`, html: `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #e4e4e7;border-radius:14px"><img src="${APP}/icons/icon-192.png" width="44" height="44" alt="Mirai Management"><h2 style="margin:16px 0 4px">${esc(b.n)}</h2><p style="margin:0;color:#52525b">Jatuh tempo ${tgl} (7 hari lagi)</p><p style="font-size:28px;font-weight:600;margin:12px 0">${rp(b.a)}</p><a href="${url ? APP + url.slice(1) : APP + '/?pay=' + b.id}" style="display:inline-block;background:#047857;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${url ? 'Buka Mirai' : 'Bayar'}</a></div>` }),
        });
        if (e.ok) mail++;
      }
      for (const s of subs) {
        try { await wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: `${b.n} jatuh tempo 7 hari lagi`, body: `${rp(b.a)}, jatuh tempo ${tgl}`, tag: `bill-${b.id}-${due}`, url: url || `./?pay=${b.id}`, ...(url ? {} : { bill: { id: b.id } }) })); push++ }
        catch (x) { if (x.statusCode === 404 || x.statusCode === 410) await fetch(`${S}/rest/v1/push_subs?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE', headers: H }) }
      }
    }
  }
  res.json({ mail, push });
};
