'use strict';
(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const card = $('#card');

/* Logo: sembunyikan jika berkas gambar gagal dimuat (pengganti atribut onerror) */
$$('.logo img').forEach(img => {
  const hide = () => (img.style.display = 'none');
  img.addEventListener('error', hide);
  if (img.complete && !img.naturalWidth) hide();
});

/* 1. Sliding / carousel: satu class `up` mengatur desktop (overlay) & mobile (carousel) */
function go(to) {
  const up = to === 'up';
  card.classList.toggle('up', up);
  document.title = (up ? 'Daftar' : 'Masuk') + ' | Mirai Management';
  $('#panel-in').inert = up;      // cegah fokus keyboard ke form yang tersembunyi
  $('#panel-up').inert = !up;
}
$$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
$('#panel-up').inert = true;

/* 2. Show / hide password */
$$('.eye').forEach(btn => btn.addEventListener('click', () => {
  const input = btn.parentElement.querySelector('input');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.firstElementChild.className = show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
  btn.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
}));

/* 3. Indikator kekuatan password: merah / kuning / hijau */
const bar = $('#bar'), barTxt = $('#bar-txt');
$('#up-pass').addEventListener('input', e => {
  const v = e.target.value;
  let score = 0;
  if (v.length >= 8) score++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++;
  if (/\d/.test(v)) score++;
  if (/[^A-Za-z0-9]/.test(v) || v.length >= 12) score++;
  const lvl = !v ? 0 : score <= 2 ? 1 : score === 3 ? 2 : 3;
  const set = [[0, '', ''], [34, 'var(--red)', 'Lemah'], [67, 'var(--yel)', 'Sedang'], [100, 'var(--g)', 'Kuat']][lvl];
  bar.style.width = set[0] + '%';
  bar.style.background = set[1];
  barTxt.textContent = set[2];
  barTxt.style.color = set[1];
});

/* 4. Auto-format Rupiah: 1000000 -> 1.000.000 */
$('#up-saldo').addEventListener('input', e => {
  const digits = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  e.target.value = digits ? new Intl.NumberFormat('id-ID').format(digits) : '';
});

/* 5. Konfigurasi & helper (getSb() berasal dari config.js, memakai Supabase yang sama dengan aplikasi) */
const APP_URL = 'index.html';   // halaman aplikasi setelah berhasil masuk
const MIN_LOADING = 2000;       // lama minimum efek "Memproses..." (ms)
const wait = ms => new Promise(r => setTimeout(r, ms));
const NET = 'Gagal terhubung. Periksa config.js dan koneksi internet.';
const MSG = { 'Invalid login credentials': 'Email atau kata sandi salah.', 'Email not confirmed': 'Email belum diverifikasi. Daftar ulang untuk menerima kode baru.', 'User already registered': 'Email ini sudah terdaftar. Silakan masuk.' };
const tr = m => MSG[m] || (/rate limit|too many/i.test(m) ? 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' : m);
const redirect = fresh => { if (fresh) try { sessionStorage.setItem('mm_fresh', '1') } catch (x) { } setTimeout(() => location.replace(APP_URL), 600) };
const PAGE = location.href.split(/[?#]/)[0];
const rem = on => typeof setRemember === 'function' && setRemember(on);   // dari config.js
const flash = (t, ok) => { const e = $('.err', $('#form-in')); e.className = ok ? 'err ok' : 'err'; e.textContent = t; go('in'); };

async function busy(btn, fn) {
  btn.classList.add('loading'); btn.disabled = true; btn.textContent = 'Memproses...';
  try { await Promise.all([fn(), wait(MIN_LOADING)]); }
  finally { btn.classList.remove('loading'); btn.disabled = false; btn.textContent = btn.dataset.label; }
}

/* 6. Alur 2FA (sama seperti auth.js aplikasi): sudah punya faktor -> minta kode; belum -> daftarkan QR */
async function after() {
  const s = await getSb();
  const { data: a } = await s.auth.mfa.getAuthenticatorAssuranceLevel();
  if (a.currentLevel === 'aal2') return redirect();
  const { data: f } = await s.auth.mfa.listFactors();
  if (f.totp.length) { fid = f.totp[0].id; openModal('twofa'); } else await enroll(s);
}
async function enroll(s) {
  const { data: f } = await s.auth.mfa.listFactors();
  for (const x of f.all.filter(x => x.status === 'unverified')) await s.auth.mfa.unenroll({ factorId: x.id });
  const { data, error } = await s.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Mirai ' + Date.now() });
  if (error) throw error;
  fid = data.id;
  const raw = data.totp.qr_code.replace(/^data:image\/svg\+xml;[^,]*,/, ''), svg = raw.startsWith('<') ? raw : decodeURIComponent(raw);
  const img = new Image(); img.alt = 'QR 2FA'; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const key = document.createElement('code'); key.textContent = data.totp.secret;
  $('#m-qr').replaceChildren(img, key);
  openModal('setup');
}
async function ver(code) {
  const s = await getSb();
  const { data: c, error: e } = await s.auth.mfa.challenge({ factorId: fid });
  if (e) return e;
  const { error } = await s.auth.mfa.verify({ factorId: fid, challengeId: c.id, code });
  return error;
}

/* 7. Form masuk, daftar, Google, lupa sandi */
$('#form-in').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, err = $('.err', f);
  if (!f.reportValidity()) return;
  err.textContent = ''; err.className = 'err';
  await busy($('.primary', f), async () => {
    try {
      const s = await getSb();
      rem($('#in-remember').checked);
      const { error } = await s.auth.signInWithPassword({ email: $('#in-email').value.trim(), password: $('#in-pass').value });
      if (error) err.textContent = tr(error.message); else await after();
    } catch (x) { err.textContent = NET; }
  });
});

$('#form-up').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, err = $('.err', f);
  if (!f.reportValidity()) return;
  err.textContent = ''; err.className = 'err';
  const email = $('#up-email').value.trim();
  await busy($('.primary', f), async () => {
    try {
      const s = await getSb();
      const ob = Number($('#up-saldo').value.replace(/\D/g, '')) || 0;
      rem(true);
      const { data, error } = await s.auth.signUp({ email, password: $('#up-pass').value, options: { data: { ob, tos: TOS_VER, tos_at: new Date().toISOString() } } });
      if (error) err.textContent = tr(error.message);
      else if (data.user && data.user.identities && !data.user.identities.length) err.textContent = MSG['User already registered'];
      else if (data.session) await after();
      else { pendingEmail = email; openModal('signup'); }   // butuh konfirmasi email -> modal OTP
    } catch (x) { err.textContent = NET; }
  });
});

$$('.google').forEach(b => b.addEventListener('click', async () => {
  const err = $('.err', b.closest('form'));
  err.textContent = ''; err.className = 'err';
  const tc = $('.terms input', b.closest('form')); if (tc && !tc.checked) { err.textContent = 'Centang persetujuan Syarat & Ketentuan dan Kebijakan Privasi dulu.'; return; }
  try {
    const s = await getSb();
    rem(b.closest('form').id === 'form-in' ? $('#in-remember').checked : true);
    const { error } = await s.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: PAGE } });
    if (error) err.textContent = tr(error.message);
  } catch (x) { err.textContent = NET; }
}));


/* 8. Modal OTP: tiga mode (kode email, 2FA, aktivasi 2FA) */
const modal = $('#modal'), boxes = $$('#otp input'), msg = $('#m-msg');
const MODES = {
  signup: { icon: 'fa-regular fa-envelope', title: 'Verifikasi Email Anda', text: 'Kami telah mengirimkan 6 digit kode ke email Anda.', btn: 'Verifikasi' },
  twofa: { icon: 'fa-solid fa-shield-halved', title: 'Verifikasi Dua Langkah', text: 'Masukkan 6 digit kode dari aplikasi autentikator Anda.', btn: 'Verifikasi' },
  setup: { icon: 'fa-solid fa-qrcode', title: 'Aktifkan 2FA', text: 'Pindai QR dengan Google Authenticator atau Authy, lalu masukkan 6 digit kodenya.', btn: 'Aktifkan dan masuk' },
  reset: { icon: 'fa-solid fa-shield-halved', title: 'Verifikasi Dua Langkah', text: 'Masukkan 6 digit kode dari aplikasi autentikator untuk melanjutkan reset kata sandi.', btn: 'Verifikasi' },
  recover: { icon: 'fa-solid fa-key', title: 'Kode Pemulihan', text: 'Masukkan salah satu kode pemulihan 2FA Anda (format XXXXX-XXXXX). Setelah berhasil, autentikator lama dilepas dan Anda memasang yang baru.', btn: 'Pulihkan akses' }
};
let mode = 'signup', prevMode = 'twofa', fid = '', pendingEmail = '', lastFocus;

function openModal(m = 'signup') {
  const c = MODES[m], v = $('#verify');
  mode = m;
  if (modal.hidden) lastFocus = document.activeElement;
  $('#m-i').className = c.icon; $('#m-title').textContent = c.title; $('#m-desc').textContent = c.text;
  $('#resend-row').hidden = m !== 'signup'; $('#m-qr').hidden = m !== 'setup';
  if (m !== 'recover') prevMode = m;   // untuk tombol kembali dari mode pemulihan
  $('#otp').hidden = m === 'recover'; $('#rc-field').hidden = m !== 'recover'; $('#rc-row').hidden = !(m === 'twofa' || m === 'reset' || m === 'recover');
  $('#rc-link').textContent = m === 'recover' ? 'Kembali ke kode autentikator' : 'Kehilangan HP? Pakai kode pemulihan'; $('#rc-in').value = '';
  v.dataset.label = c.btn; v.textContent = c.btn;
  boxes.forEach(b => (b.value = '')); msg.textContent = '';
  modal.hidden = false; (m === 'recover' ? $('#rc-in') : boxes[0]).focus();
}
function closeModal() { modal.hidden = true; lastFocus && lastFocus.focus(); }
const code = () => boxes.map(b => b.value).join('');
function fill(digits, from = 0) {
  digits.split('').slice(0, boxes.length - from).forEach((d, i) => (boxes[from + i].value = d));
  boxes[Math.min(from + digits.length, boxes.length - 1)].focus();
}
function fail(text) {
  const otp = $('#otp');
  msg.className = 'm-msg'; msg.textContent = text;
  otp.classList.remove('err'); void otp.offsetWidth; otp.classList.add('err');
}

boxes.forEach((box, i) => {
  box.addEventListener('input', () => {
    const d = box.value.replace(/\D/g, '');
    box.value = d.slice(-1);
    if (d && i < boxes.length - 1) boxes[i + 1].focus();   // maju otomatis
  });
  box.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && !box.value && i > 0) {     // mundur otomatis
      boxes[i - 1].value = ''; boxes[i - 1].focus(); e.preventDefault();
    } else if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
    else if (e.key === 'ArrowRight' && i < boxes.length - 1) boxes[i + 1].focus();
    else if (e.key === 'Enter') $('#verify').click();
  });
  box.addEventListener('focus', () => box.select());
  box.addEventListener('paste', e => {                      // dukung copy-paste 6 digit
    e.preventDefault();
    const d = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
    if (d) fill(d, d.length >= boxes.length ? 0 : i);
  });
});

$('#rc-link').addEventListener('click', () => openModal(mode === 'recover' ? prevMode : 'recover'));
$('#rc-in').addEventListener('input', e => { let v = e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 10); e.target.value = v.length > 5 ? v.slice(0, 5) + '-' + v.slice(5) : v; });
$('#rc-in').addEventListener('keydown', e => { if (e.key === 'Enter') $('#verify').click(); });
// Pakai kode pemulihan: server memverifikasi, melepas autentikator lama, dan mengeluarkan sesi lain. Lalu pasang autentikator baru.
async function useRecovery(c) {
  const s = await getSb(), { data } = await s.auth.getSession();
  const r = await fetch('/api/recovery/use', { method: 'POST', headers: { Authorization: 'Bearer ' + data.session.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ code: c }) }), j = await r.json().catch(() => ({}));
  if (!r.ok) return j.error || 'Kode pemulihan salah.';
  await s.auth.refreshSession();
  return '';
}
$('#verify').addEventListener('click', async e => {
  if (mode === 'recover') {
    if ($('#rc-in').value.replace(/-/g, '').length < 10) return fail('Masukkan kode pemulihan lengkap (10 karakter).');
    msg.textContent = '';
    return busy(e.currentTarget, async () => {
      try {
        const er = await useRecovery($('#rc-in').value); if (er) return fail(er);
        if (prevMode === 'reset') { modal.hidden = true; openPw('new'); } else { msg.className = 'm-msg ok'; msg.textContent = 'Berhasil. Pasang autentikator baru.'; await after(); }
      } catch (x) { fail(NET); }
    });
  }
  if (code().length < boxes.length) return fail('Masukkan 6 digit kode verifikasi.');
  msg.textContent = '';
  await busy(e.currentTarget, async () => {
    try {
      let error;
      if (mode === 'signup') ({ error } = await (await getSb()).auth.verifyOtp({ email: pendingEmail, token: code(), type: 'signup' }));
      else error = await ver(code());
      if (error) return fail('Kode salah atau kedaluwarsa.');
      msg.className = 'm-msg ok'; msg.textContent = 'Berhasil diverifikasi.';
      if (mode === 'signup') await after();                 // email terverifikasi -> lanjut ke 2FA
      else if (mode === 'reset') { modal.hidden = true; openPw('new'); }   // 2FA lolos -> buat sandi baru
      else redirect(true);
    } catch (x) { fail(NET); }
  });
});

$('#resend').addEventListener('click', async e => {
  const b = e.currentTarget;
  b.disabled = true; setTimeout(() => (b.disabled = false), 30000);
  boxes.forEach(x => (x.value = '')); boxes[0].focus();
  try {
    const { error } = await (await getSb()).auth.resend({ type: 'signup', email: pendingEmail });
    msg.className = error ? 'm-msg' : 'm-msg ok';
    msg.textContent = error ? tr(error.message) : 'Kode baru telah dikirim.';
  } catch (x) { msg.className = 'm-msg'; msg.textContent = NET; }
});

modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!modal.hidden) closeModal(); else closePw(); });

/* 9. Lupa & atur ulang kata sandi: kirim email -> tautan ke halaman ini -> (2FA) -> sandi baru */
const pw = $('#pw-modal'), pf = $('#p-form'), pa = $('#p-a'), pb = $('#p-b'), perr = $('#p-err'), pbtn = $('#p-btn');
const PM = {
  request: { icon: 'fa-solid fa-key', title: 'Lupa kata sandi?', text: 'Masukkan email akun Anda. Kami akan mengirim tautan untuk membuat kata sandi baru.', btn: 'Kirim tautan reset' },
  new: { icon: 'fa-solid fa-lock', title: 'Buat kata sandi baru', text: 'Gunakan minimal 8 karakter.', btn: 'Simpan kata sandi' }
};
let pmode = 'request';

function openPw(m, email = '') {
  const c = PM[m], n = m === 'new';
  pmode = m; pf.dataset.m = m;
  $('#p-i').className = c.icon; $('#p-title').textContent = c.title; $('#p-desc').textContent = c.text;
  pbtn.dataset.label = c.btn; pbtn.textContent = c.btn;
  pa.type = n ? 'password' : 'email'; pa.placeholder = n ? 'Kata sandi baru (min. 8 karakter)' : 'Email';
  pa.autocomplete = n ? 'new-password' : 'email'; pa.minLength = n ? 8 : 0; pb.required = n;
  $('#p-ia').className = (n ? 'fa-solid fa-lock' : 'fa-regular fa-envelope') + ' lead';
  $$('.eye i', pw).forEach(i => (i.className = 'fa-regular fa-eye'));
  $('#p-foot').hidden = n;
  pa.value = email; pb.value = ''; perr.className = 'err'; perr.textContent = '';
  pw.hidden = false; pa.focus();
}
const closePw = () => { if (pmode === 'request') pw.hidden = true; };   // saat membuat sandi baru, modal tidak bisa ditutup

$('#forgot').addEventListener('click', e => { e.preventDefault(); openPw('request', $('#in-email').value.trim()); });
$('#p-back').addEventListener('click', closePw);
pw.addEventListener('click', e => { if (e.target === pw) closePw(); });

pf.addEventListener('submit', async e => {
  e.preventDefault();
  perr.className = 'err'; perr.textContent = '';
  if (!pf.reportValidity()) return;
  if (pmode === 'new' && pa.value !== pb.value) { perr.textContent = 'Kata sandi tidak sama.'; return; }
  await busy(pbtn, async () => {
    try {
      const s = await getSb();
      if (pmode === 'request') {
        const { error } = await s.auth.resetPasswordForEmail(pa.value.trim(), { redirectTo: PAGE });
        if (error) perr.textContent = tr(error.message);
        else { perr.className = 'err ok'; perr.textContent = 'Jika email terdaftar, tautan reset telah dikirim. Cek kotak masuk atau folder spam.'; }
      } else {
        const { error } = await s.auth.updateUser({ password: pa.value });
        if (error) { perr.textContent = tr(error.message); return; }
        await s.auth.signOut();                       // akhiri sesi pemulihan, wajib masuk ulang (+2FA)
        history.replaceState(null, '', PAGE);
        pmode = 'request'; pw.hidden = true;
        flash('Kata sandi berhasil diperbarui. Silakan masuk dengan kata sandi baru.', true);
      }
    } catch (x) { perr.textContent = NET; }
  });
});

// Dibuka dari tautan email: pengguna ber-2FA wajib verifikasi kode dulu (syarat Supabase: sesi AAL2 untuk ganti sandi)
async function recovery() {
  try {
    const s = await getSb();
    const { data } = await s.auth.getSession();
    if (!data.session) return flash('Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru lewat "Lupa kata sandi?".');
    const { data: a } = await s.auth.mfa.getAuthenticatorAssuranceLevel();
    if (a.nextLevel === 'aal2' && a.currentLevel !== 'aal2') {
      const { data: f } = await s.auth.mfa.listFactors();
      fid = f.totp[0].id; openModal('reset');
    } else openPw('new');
  } catch (x) { flash(NET); }
}

/* 9b. Pesan dari halaman aplikasi (perangkat dikeluarkan, akun dihapus, keluar dari semua perangkat) */
try { const fm = sessionStorage.getItem('mm_msg'); if (fm) { sessionStorage.removeItem('mm_msg'); setTimeout(() => flash(fm, true), 0); } } catch (x) { }

/* 10. Saat halaman dibuka: tautan reset, galat dari URL (Google/tautan kedaluwarsa), atau sesi yang sudah ada */
const hp = new URLSearchParams(location.hash.slice(1) + '&' + location.search.slice(1));
const urlErr = hp.get('error_description');
if (urlErr) {
  flash(hp.get('error_code') === 'otp_expired' ? 'Tautan sudah kedaluwarsa. Minta tautan baru lewat "Lupa kata sandi?".' : urlErr);
  history.replaceState(null, '', PAGE);
} else if (hp.get('type') === 'recovery') recovery();
else if (hasAuthHint()) getSb().then(s => s.auth.getSession()).then(({ data }) => data.session && after()).catch(() => { });
})();
