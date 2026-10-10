// SDK Supabase tiruan untuk uji E2E. Menggantikan @supabase/supabase-js (server uji menyajikannya sebagai SB_SDK).
// Semua data hidup di server uji (tests/fixtures/server.js) lewat /__db, jadi dua "perangkat" (konteks browser) berbagi satu basis data.
(function () {
  const net = () => ({ data: null, error: { message: 'TypeError: Failed to fetch' } });
  async function call(token, body) {
    if (!navigator.onLine) return net();
    try { const r = await fetch('/__db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...body }) }); return await r.json() } catch (e) { return net() }
  }
  window.supabase = {
    createClient(url, key, opts) {
      const store = (opts && opts.auth && opts.auth.storage) || localStorage, K = typeof SB_STORE_KEY === 'string' ? SB_STORE_KEY : 'sb-fake-auth-token';
      const sess = () => { try { return JSON.parse(store.getItem(K)) } catch (e) { return null } }, tok = () => (sess() || {}).access_token;
      const from = table => {
        const q = { table, op: 'select', filters: [], values: null, mode: 'rows', onConflict: null };
        const api = {
          select() { return api }, insert(v) { q.op = 'insert'; q.values = v; return api }, update(v) { q.op = 'update'; q.values = v; return api },
          upsert(v, o) { q.op = 'upsert'; q.values = v; q.onConflict = o && o.onConflict; return api }, delete() { q.op = 'delete'; return api },
          eq(c, v) { q.filters.push([c, 'eq', v]); return api }, in(c, v) { q.filters.push([c, 'in', v]); return api }, order() { return api }, limit() { return api },
          single() { q.mode = 'single'; return api }, maybeSingle() { q.mode = 'maybe'; return api },
          then(res, rej) {
            return call(tok(), { kind: 'table', ...q }).then(r => {
              if (r.error) return r; let d = r.data;
              if (q.mode !== 'rows') { d = Array.isArray(d) ? d[0] : d; if (d === undefined) d = null; if (q.mode === 'single' && d === null) return { data: null, error: { code: 'PGRST116', message: 'no rows' } } }
              return { data: d, error: null }
            }).then(res, rej)
          }
        };
        return api;
      };
      const auth = {
        async getSession() { const s = sess(); return { data: { session: s }, error: null } },
        async getUser() { const s = sess(); return { data: { user: s && s.user }, error: null } },
        async refreshSession() { return { data: { session: sess() }, error: null } },
        async signOut() { store.removeItem(K); return { error: null } },
        async updateUser(p) { const s = sess(); if (!s) return { data: null, error: { message: 'no session' } }; if (p.data) s.user.user_metadata = { ...s.user.user_metadata, ...p.data }; store.setItem(K, JSON.stringify(s)); return { data: { user: s.user }, error: null } },
        async signInWithPassword() { return { data: null, error: { message: 'Invalid login credentials' } } },
        onAuthStateChange() { return { data: { subscription: { unsubscribe() { } } } } },
        mfa: {
          async getAuthenticatorAssuranceLevel() { return { data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null } },
          async listFactors() { return { data: { all: [], totp: [] }, error: null } }
        }
      };
      return { auth, from, rpc: (name, args) => call(tok(), { kind: 'rpc', name, args }) };
    }
  };
})();
