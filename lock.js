// ---- v20: kunci aplikasi (biometrik WebAuthn + PIN). Pengaturan hanya di perangkat ini: localStorage mm_lock_<UID>. ----
// Catatan: ini kunci layar di sisi klien. Ia mencegah akses iseng, bukan penyerang yang membuka DevTools.
Object.assign(P, {
  finger: '<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>',
  bs: '<path d="M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/><path d="m12 9 6 6"/><path d="m18 9-6 6"/>'
});
const lockCfg = () => { try { const c = JSON.parse(localStorage['mm_lock_' + UID] || 'null'); return c && (c.pin || c.cred) ? c : null } catch (e) { return null } };
const lockSave = c => { if (c && (c.pin || c.cred)) localStorage['mm_lock_' + UID] = JSON.stringify(c); else localStorage.removeItem('mm_lock_' + UID) };
const eb = u => btoa(String.fromCharCode(...new Uint8Array(u))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
// Tanda tangan ECDSA dari WebAuthn berformat DER; WebCrypto butuh r||s mentah 64 byte
const der2raw = d => { const rl = d[3], r = d.slice(4, 4 + rl), j = 4 + rl, sl = d[j + 1], s = d.slice(j + 2, j + 2 + sl), o = new Uint8Array(64), f = (x, off) => { x = x.length > 32 ? x.slice(x.length - 32) : x; o.set(x, off + 32 - x.length) }; f(r, 0); f(s, 32); return o };
const pinHash = async (p, s) => eb(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: s, iterations: 150000, hash: 'SHA-256' }, await crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveBits']), 256));

async function bioEnroll() {
  const c = await navigator.credentials.create({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: 'Mirai Management', id: location.hostname }, user: { id: new TextEncoder().encode(UID).slice(0, 64), name: US, displayName: FNM || US }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }, attestation: 'none', timeout: 60000 } });
  const pk = c.response.getPublicKey && c.response.getPublicKey();
  return { id: eb(c.rawId), pk: pk ? eb(pk) : '', alg: c.response.getPublicKeyAlgorithm ? c.response.getPublicKeyAlgorithm() : -7 }
}
// Memeriksa tantangan, origin, flag UP+UV, dan (bila kunci publik tersimpan) tanda tangan
async function bioAuth(cfg) {
  const ch = crypto.getRandomValues(new Uint8Array(32)), a = await navigator.credentials.get({ publicKey: { challenge: ch, rpId: location.hostname, allowCredentials: [{ type: 'public-key', id: b64u(cfg.cred.id), transports: ['internal'] }], userVerification: 'required', timeout: 60000 } });
  const r = a.response, ad = new Uint8Array(r.authenticatorData), cd = JSON.parse(new TextDecoder().decode(r.clientDataJSON));
  if (cd.type != 'webauthn.get' || cd.origin != location.origin || cd.challenge != eb(ch) || (ad[32] & 5) != 5) throw 0;
  if (cfg.cred.pk) {
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', r.clientDataJSON)), m = new Uint8Array(ad.length + 32); m.set(ad); m.set(h, ad.length);
    const ec = cfg.cred.alg != -257, k = await crypto.subtle.importKey('spki', b64u(cfg.cred.pk), ec ? { name: 'ECDSA', namedCurve: 'P-256' } : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify(ec ? { name: 'ECDSA', hash: 'SHA-256' } : 'RSASSA-PKCS1-v1_5', k, ec ? der2raw(new Uint8Array(r.signature)) : r.signature, m)) throw 0
  }
}
async function pinTry(p) {
  const fk = 'mm_lockf_' + UID, f = JSON.parse(localStorage[fk] || '{"n":0,"until":0}'), c = lockCfg();
  if (Date.now() < f.until) return 'Terlalu banyak percobaan. Coba lagi dalam ' + Math.ceil((f.until - Date.now()) / 1000) + ' detik.';
  if (await pinHash(p, b64u(c.pin.s)) == c.pin.h) { localStorage.removeItem(fk); unlock(); return '' }
  f.n++; if (f.n >= 10) { localStorage.removeItem(fk); logout(true); return 'Terlalu banyak percobaan. Silakan masuk ulang.' }
  if (f.n >= 5) f.until = Date.now() + 30000 * (f.n - 4); localStorage[fk] = JSON.stringify(f); return 'PIN salah. Sisa percobaan: ' + (10 - f.n) + '.'
}
async function bioGo(auto) { try { await bioAuth(lockCfg()); $('#lke').textContent = ''; unlock() } catch (x) { if (!auto) $('#lke').textContent = 'Biometrik gagal atau dibatalkan. Gunakan PIN atau kata sandi.' } }

let pinBuf = '', lkd0 = '';
const pinDots = () => $('#pdots').innerHTML = Array.from({ length: 6 }, (_, i) => `<i class="${i < pinBuf.length ? 'on' : ''}"></i>`).join('');
const pinKey = k => { if (k != '<' && pinBuf.length >= 6) return; pinBuf = k == '<' ? pinBuf.slice(0, -1) : pinBuf + k; pinDots(); if (pinBuf.length == 6) pinTry(pinBuf).then(m => { $('#lke').textContent = m; pinBuf = ''; pinDots() }) };
$('#ppad').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '<'].map(k => k ? `<button type="button" class="pk" data-k="${k}" aria-label="${k == '<' ? 'Hapus' : k}">${k == '<' ? ic('bs', 22) : k}</button>` : '<span></span>').join('');
$('#ppad').onclick = e => { const b = e.target.closest('button'); if (b) pinKey(b.dataset.k) };
addEventListener('keydown', e => { if ($('#lk').hidden || $('#lkpin').hidden || e.target.tagName == 'INPUT') return; if (/^\d$/.test(e.key)) pinKey(e.key); else if (e.key == 'Backspace') pinKey('<') });
$('#lkbio').innerHTML = ic('finger', 20) + '<span>Buka dengan biometrik</span>'; $('#lkbio').onclick = () => bioGo(false);
$('#lkw').onclick = () => { $('#lkp').hidden = $('#lku').hidden = false; $('#lkw').hidden = true; $('#lkp').focus() };

function lkUI() {
  const c = lockCfg(), b = $('#lkb'); lkd0 = lkd0 || $('#lkd').textContent;
  if (!c) { b.hidden = true; $('#lkp').hidden = $('#lku').hidden = false; $('#lkd').textContent = lkd0; return }
  $('#lkd').textContent = 'Demi keamanan data Anda, buka dengan ' + (c.cred && c.pin ? 'biometrik atau PIN' : c.cred ? 'biometrik' : 'PIN') + '.';
  $('#lkp').hidden = $('#lku').hidden = true; b.hidden = false; $('#lkw').hidden = false; $('#lkbio').hidden = !c.cred; $('#lkpin').hidden = !c.pin; pinBuf = ''; pinDots();
  if (c.cred && document.visibilityState == 'visible') bioGo(true)
}
const _ln = lockNow; lockNow = function () { _ln(); lkUI() };
// v26: meninggalkan aplikasi TIDAK lagi langsung mengunci. Kunci hanya setelah 5 menit tidak dipakai (app.js: lockReset/lockCheck).
// Saat kembali: bila belum terkunci, periksa selisih dari aktivitas terakhir (pewaktu bisa beku di latar belakang); bila sudah terkunci, minta biometrik.
const lkBack = () => { if ($('#app').hidden || document.hidden) return; if ($('#lk').hidden) lockCheck(); else { const c = lockCfg(); if (c && c.cred) bioGo(true) } };
document.addEventListener('visibilitychange', lkBack);
addEventListener('pageshow', e => { if (e.persisted) lkBack() });

function lkSet() { const c = lockCfg() || {}; $('#sdbio').textContent = c.cred ? 'Matikan biometrik' : 'Aktifkan biometrik'; $('#sdpin').textContent = c.pin ? 'Hapus PIN' : 'Atur PIN'; $('#sdbio').hidden = !window.PublicKeyCredential && !c.cred }
$('#pset').addEventListener('click', lkSet);
$('#sdbio').onclick = async () => { const c = lockCfg() || {}; try { if (c.cred) delete c.cred; else { if (!await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) return toast('Gagal: perangkat tidak punya biometrik atau kunci layar'); c.cred = await bioEnroll() } lockSave(c); lkSet(); toast(c.cred ? 'Biometrik aktif' : 'Biometrik dimatikan') } catch (x) { toast('Gagal mengaktifkan biometrik') } };
$('#sdpin').onclick = () => {
  const c = lockCfg() || {}; if (c.pin) { delete c.pin; lockSave(c); lkSet(); return toast('PIN dihapus') }
  pbox('Atur PIN 6 digit', [{ l: 'PIN (6 angka)', v: '' }, { l: 'Ulangi PIN', v: '' }], async ([a, b]) => { if (!/^\d{6}$/.test(a) || a != b) return toast('Isi PIN 6 angka yang sama di kedua kolom'); const s = crypto.getRandomValues(new Uint8Array(16)); c.pin = { s: eb(s), h: await pinHash(a, s) }; lockSave(c); lkSet(); toast('PIN diatur') });
  [$('#p0'), $('#p1')].forEach(i => { i.type = 'password'; i.inputMode = 'numeric'; i.maxLength = 6 });
  $('#pd').addEventListener('close', () => [$('#p0'), $('#p1')].forEach(i => { i.type = 'text'; i.removeAttribute('maxlength') }), { once: true })
};
