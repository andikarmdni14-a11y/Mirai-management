// Server uji: menyajikan aplikasi dari akar repo, mengganti SDK Supabase dengan versi tiruan, dan menjalankan "basis data" tiruan
// yang meniru perilaku yang dipakai aplikasi: updated_at ditentukan server, update bersyarat (compare-and-swap), snapshot otomatis,
// RLS per pengguna. Dipakai di dalam proses uji sehingga tes bisa memeriksa isi basis data secara langsung.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..'), MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain' };

class Backend {
  constructor() { this.rows = {}; this.history = []; this.tick = 0; this.revoked = new Set(); this.devices = {}; this.requests = 0; this.writes = 0; this.failWrites = 0; this.rc = 10; this.tables = {}; this.seq = 0 }
  stamp() { this.tick++; return new Date(Date.UTC(2026, 9, 9, 0, 0, 0, this.tick)).toISOString().replace('Z', '000+00:00') }
  uid(token) { return token && token.startsWith('tok-') ? token.slice(4) : null }
  seed(uid, data) { this.rows[uid] = { user_id: uid, data, updated_at: this.stamp() } }
  data(uid) { return this.rows[uid] && this.rows[uid].data }
  match(r, f) { return f.every(([c, op, v]) => op === 'in' ? v.includes(r[c]) : String(r[c]) === String(v)) }
  table(b) {
    const uid = this.uid(b.token); if (!uid) return { error: { code: '42501', message: 'row-level security: not authenticated' } };
    const t = b.table; this.requests++;
    if (t === 'user_data') {
      const mine = this.rows[uid] ? [this.rows[uid]] : [], hit = mine.filter(r => this.match(r, b.filters));
      if (b.op === 'select') return { data: hit.map(r => ({ ...r })) };
      if (this.failWrites > 0) { this.failWrites--; return { error: { message: 'TypeError: Failed to fetch' } } }
      const write = (row, data) => { if (row && JSON.stringify(row.data) !== JSON.stringify(data)) { const last = this.history.filter(h => h.user_id === uid && h.reason === 'auto').pop(); if (!last) this.history.push({ id: this.history.length + 1, user_id: uid, data: row.data, taken_at: new Date().toISOString(), reason: 'auto', tx_count: (row.data.T || []).length, size_bytes: JSON.stringify(row.data).length }) } this.writes++; return this.rows[uid] = { user_id: uid, data, updated_at: this.stamp() } };
      if (b.op === 'insert') { if (this.rows[uid]) return { error: { code: '23505', message: 'duplicate key' } }; return { data: [{ ...write(null, b.values.data) }] } }
      if (b.op === 'update') { if (!hit.length) return { data: [] }; return { data: [{ ...write(this.rows[uid], b.values.data) }] } }
      if (b.op === 'upsert') return { data: [{ ...write(this.rows[uid], b.values.data) }] };
    }
    if (t === 'user_data_history') { const rows = this.history.filter(h => h.user_id === uid && this.match(h, b.filters)); return { data: rows } }
    // Tabel generik (Ruang Bersama): penyimpanan dalam memori tanpa meniru RLS (RLS diuji terpisah lewat schema.sql, bukan di sini)
    const rows = this.tables[t] ||= [], hit = rows.filter(r => this.match(r, b.filters));
    if (b.op === 'select') return { data: hit.map(r => ({ ...r })) };
    if (b.op === 'insert') { const L = (Array.isArray(b.values) ? b.values : [b.values]).map(v => ({ id: 'id' + (++this.seq), ...v })); L.forEach(v => { if (t === 'space_tx' && rows.some(r => r.space_id === v.space_id && r.user_id === v.user_id && r.client_id === v.client_id)) throw Object.assign(new Error('dup'), { dup: 1 }) }); rows.push(...L); return { data: L.map(v => ({ ...v })) } }
    if (b.op === 'update') { hit.forEach(r => Object.assign(r, b.values)); return { data: hit.map(r => ({ ...r })) } }
    if (b.op === 'delete') { this.tables[t] = rows.filter(r => !hit.includes(r)); return { data: hit } }
    return { data: [] };
  }
  rpc(b) {
    const uid = this.uid(b.token), T = n => this.tables[n] ||= [];
    if (b.name === 'create_space') { const id = 'sp' + (++this.seq); T('spaces').push({ id, name: b.args.p_name, created_by: uid }); T('space_members').push({ space_id: id, user_id: uid, role: 'owner', display_name: b.args.p_display, joined_at: new Date().toISOString() }); return { data: id } }
    if (b.name === 'create_invite') { const c = 'CODE' + (++this.seq); T('space_invites').push({ code: c, space_id: b.args.p_space }); return { data: c } }
    if (b.name === 'peek_invite') { const i = T('space_invites').find(x => x.code === b.args.p_code && !x.used); if (!i) return { data: [] }; return { data: [{ space_name: T('spaces').find(x => x.id === i.space_id).name, inviter: 'Pengundang', members: T('space_members').filter(m => m.space_id === i.space_id).length }] } }
    if (b.name === 'join_space') { const i = T('space_invites').find(x => x.code === b.args.p_code && !x.used); if (!i) return { error: { message: 'Kode undangan tidak valid atau sudah kedaluwarsa' } }; i.used = 1; T('space_members').push({ space_id: i.space_id, user_id: uid, role: 'member', display_name: b.args.p_display, joined_at: new Date().toISOString() }); return { data: i.space_id } }
    return this.rpc0(b) }
  rpc0(b) { const uid = this.uid(b.token); if (b.name === 'take_snapshot' && uid && this.rows[uid]) { this.history.push({ id: this.history.length + 1, user_id: uid, data: this.rows[uid].data, taken_at: new Date().toISOString(), reason: 'manual', tx_count: (this.rows[uid].data.T || []).length, size_bytes: 1 }); return { data: null } } return { data: null } }
}

function start(port) {
  const be = new Backend();
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'), send = (code, body, type) => { res.writeHead(code, { 'Content-Type': type || 'application/json', 'Cache-Control': 'no-cache' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)) };
    let buf = ''; req.on('data', c => buf += c); req.on('end', () => {
      let b = {}; try { b = buf ? JSON.parse(buf) : {} } catch (e) { }
      if (u.pathname === '/__db') { try { return send(200, b.kind === 'rpc' ? be.rpc(b) : be.table(b)) } catch (e) { return send(200, { error: { code: e.dup ? '23505' : 'X', message: e.message } }) } }
      if (u.pathname.startsWith('/api/')) {
        const uid = be.uid((req.headers.authorization || '').replace('Bearer ', ''));
        if (!uid) return send(401, { error: 'Sesi tidak valid atau belum lolos 2FA' });
        if (u.pathname === '/api/account/device') { const rv = be.revoked.has(b.id); (be.devices[uid] ||= {})[b.id] = { label: 'Chrome di Linux', last_seen: new Date().toISOString(), first_seen: new Date().toISOString() }; return send(200, { revoked: rv, isNew: false }) }
        if (u.pathname === '/api/account/devices') return send(200, { devices: Object.entries(be.devices[uid] || {}).map(([id, v]) => ({ id, ...v, ip: '203.0.113.x', city: 'Jakarta', country: 'ID', current: id === u.searchParams.get('id') })) });
        if (u.pathname === '/api/recovery/status') return send(200, { remaining: be.rc });
        if (u.pathname === '/api/recovery/generate') { be.rc = 10; return send(200, { codes: Array.from({ length: 10 }, (_, i) => 'ABCDE-FGH' + String.fromCharCode(74 + i)) }) }
        return send(200, { ok: true });
      }
      let p = u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname); const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(404, 'not found', 'text/plain');
      let body = fs.readFileSync(f); if (p === '/config.js') body = Buffer.from(body.toString().replace(/const SB_SDK = '[^']*'/, "const SB_SDK = '/tests/fixtures/fake-supabase.js'"));
      send(200, body, MIME[path.extname(f)] || 'application/octet-stream');
    });
  });
  return new Promise(ok => srv.listen(port || 0, '127.0.0.1', () => ok({ be, url: 'http://127.0.0.1:' + srv.address().port, close: () => new Promise(r => srv.close(r)) })));
}
module.exports = { start, Backend };
