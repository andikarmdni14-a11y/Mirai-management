const LEGACY = /[?&]legacy\b/.test(location.search); // index.html?legacy = tampilkan formulir masuk lama tanpa pengalihan (dipakai tools/build-critical.py)
let md = 'in', fid = '';
function ui() {
    const up = md == 'up', t = md == '2fa' || md == 'setup'; $('#s1').hidden = t; $('#s2').hidden = !t; $('#ob').hidden = !up; $('#sw').hidden = t; $('#er').textContent = '';
    $('#lt').textContent = { in: 'Masuk ke Mirai Management', up: 'Buat akun baru', '2fa': 'Verifikasi dua langkah', setup: 'Aktifkan 2FA' }[md];
    $('#lb').textContent = { in: 'Masuk', up: 'Daftar', '2fa': 'Verifikasi', setup: 'Aktifkan dan masuk' }[md]; $('#sw').textContent = up ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'; $('#sk').textContent = md == '2fa' ? 'Masukkan 6 digit kode dari aplikasi autentikator Anda.' : ''; $('#qr').innerHTML = ''
}
async function enroll() {
    md = 'setup'; ui(); await getSb(); const { data: f } = await sb.auth.mfa.listFactors(); for (const x of f.all.filter(x => x.status == 'unverified')) await sb.auth.mfa.unenroll({ factorId: x.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Mirai ' + Date.now() }); if (error) return $('#er').textContent = error.message; fid = data.id;
    { const raw = data.totp.qr_code.replace(/^data:image\/svg\+xml;[^,]*,/, ''), svg = raw.startsWith('<') ? raw : decodeURIComponent(raw), im = new Image(); im.alt = 'QR 2FA'; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); $('#qr').replaceChildren(im) } $('#sk').innerHTML = `Pindai QR dengan Google Authenticator atau Authy, atau masukkan kunci ini:<code class="key">${data.totp.secret}</code>`
}
async function after() { await getSb(); const { data: a } = await sb.auth.mfa.getAuthenticatorAssuranceLevel(); if (a.currentLevel == 'aal2') return enter(); const { data: f } = await sb.auth.mfa.listFactors(); if (f.totp.length) { fid = f.totp[0].id; md = '2fa'; ui(); $('#code').focus() } else enroll() }
async function ver(code) { await getSb(); const { data: c, error: e } = await sb.auth.mfa.challenge({ factorId: fid }); if (e) return e; const { error } = await sb.auth.mfa.verify({ factorId: fid, challengeId: c.id, code }); return error }
async function enter() {
    await getSb(); const { data: { session } } = await sb.auth.getSession(), user = session.user; US = user.email; UID = user.id; FNM = user.user_metadata?.full_name || ''; window.__ob = user.user_metadata?.ob; let off = false;
    // v22: perangkat yang sudah dikeluarkan dari akun tidak boleh membaca data (RLS juga menolak; ini memberi pesan yang jelas)
    const dc = navigator.onLine ? mod('security').then(() => devCheck()).catch(() => false) : Promise.resolve(false);
    try { off = await syncStart() } catch (x) { return $('#er').textContent = 'Gagal memuat data: ' + (x.message || 'koneksi bermasalah') }
    if (await dc) return;
    if (sessionStorage.getItem('mm_fresh')) { sessionStorage.removeItem('mm_fresh'); window.__fresh = 1 } const lk = !window.__fresh && lockCfg() && lockStale(); window.__fresh = 0; if (lk) lockNow(); $('#login').hidden = true; $('#app').hidden = false; cats(); (document.documentElement.classList.contains('rev') ? gos : go)('dash'); lockReset(); syUI(); if (off) toast('Mode offline: catatan baru disimpan di perangkat dan dikirim saat online')
    else { mod('security').then(() => secAfterLogin(user)).catch(() => { }); syncNow() }
    actRun()
}
async function logout(force) {
    // v22: kirim dulu catatan offline yang belum tersinkron; bila masih tertunda, tanya sebelum menghapusnya
    if (UID && typeof pendingCount == 'function' && pendingCount() && !force) {
        if (navigator.onLine) await syncNow().catch(() => { });
        if (pendingCount()) return ask('Ada catatan belum tersinkron', pendingCount() + ' perubahan masih ada di perangkat ini dan belum terkirim. Jika keluar sekarang, perubahan itu hilang. Tunggu sampai online, atau keluar saja?', 'Keluar, buang perubahan', () => logout(true));
    }
    try { ['mm_cache_', 'mm_base_'].forEach(k => localStorage.removeItem(k + UID)); await getSb(); await sb.auth.signOut() } catch (x) { } location.reload()
}
$('#sw').onclick = () => { md = md == 'in' ? 'up' : 'in'; ui() };
$('#lf').onsubmit = async e => {
    e.preventDefault(); window.__fresh = 1; const er = t => $('#er').textContent = t, em = $('#em').value.trim(), pw = $('#pw').value, b = $('#lb'); b.disabled = true;
    try {
        await getSb();
        if (md == 'up') { const { data, error } = await sb.auth.signUp({ email: em, password: pw, options: { data: { ob: num($('#ob').value) } } }); if (error) er(error.message); else if (data.session) after(); else { md = 'in'; ui(); er('Akun dibuat. Cek email Anda untuk konfirmasi, lalu masuk.') } }
        else if (md == 'in') { const { error } = await sb.auth.signInWithPassword({ email: em, password: pw }); if (error) er(error.message); else after() }
        else { const x = await ver($('#code').value.trim()); if (x) er('Kode salah atau kedaluwarsa.'); else enter() }
    }
    catch (x) { er('Gagal terhubung. Periksa config.js dan koneksi internet.') } b.disabled = false
};
ui(); const gate = () => window.__gate && window.__gate();
if (SB_URL.includes('YOUR-')) { $('#er').textContent = 'Isi SB_URL dan SB_KEY di config.js terlebih dulu.'; gate() }
else if (!hasAuthHint()) {
    // Tamu (belum ada sesi): tampilkan formulir segera. SDK Supabase baru dimuat saat pengguna mulai mengisi formulir,
    // dan pada kirim (submit) selalu dipastikan sudah termuat lewat getSb().
    if (LEGACY) gate(); else { location.replace('login.html'); setTimeout(gate, 1500) } // v21: tamu ke halaman masuk baru; formulir lama jadi cadangan
    ['pointerdown', 'focusin', 'keydown', 'touchstart'].forEach(ev => $('#lf').addEventListener(ev, () => getSb().catch(() => { }), { once: true, passive: true }))
}
else getSb().then(() => sb.auth.getSession()).then(async ({ data }) => { try { if (data.session) await after(); else if (!LEGACY) { location.replace('login.html'); setTimeout(gate, 1500); return } } finally { if (data.session || LEGACY) gate() } }).catch(gate);
