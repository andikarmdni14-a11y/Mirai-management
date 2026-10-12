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

async function busy(btn, fn, min = MIN_LOADING) {
  btn.classList.add('loading'); btn.disabled = true; btn.textContent = 'Memproses...';
  try { await Promise.all([fn(), wait(min)]); }
  finally { btn.classList.remove('loading'); btn.disabled = false; btn.textContent = btn.dataset.label; }
}

/* 6. Alur 2FA setelah kata sandi benar. Bawaan: kode 6 digit lewat email (api/twofa). "Aplikasi Autentikator" hanya muncul di
      "Coba cara lain" dan hanya bila pengguna sudah mengaktifkannya di Setelan (ada faktor TOTP terverifikasi).
      Sesi dianggap lolos bila aal2 (autentikator) atau tercatat di session_2fa (kode email). */
async function tfa(path, body) {
  const s = await getSb(), { data } = await s.auth.getSession();
  if (!data.session) throw new Error('Sesi berakhir. Masuk ulang.');
  const r = await fetch('/api/twofa/' + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + data.session.access_token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) };
}
const maskMail = e => { const [u, d] = String(e || '').split('@'); return d ? u.slice(0, 1) + '***@' + d : ''; };
async function after() {
  const s = await getSb();
  const { data: a } = await s.auth.mfa.getAuthenticatorAssuranceLevel();
  if (a.currentLevel === 'aal2') return redirect();
  const st = await tfa('status').catch(() => null);               // null = server tidak terjangkau (offline)
  const { data: g0 } = await s.auth.getSession();
  if (st && st.ok && st.j.verified) { tfaMark(g0.session); return redirect(); }   // sesi ini sudah lolos lewat kode email
  if (!st && tfaKnown(g0.session)) return redirect();             // offline: percaya penanda lokal; RLS tetap memutuskan akses data
  const [{ data: f }, { data: g }] = await Promise.all([s.auth.mfa.listFactors(), s.auth.getSession()]);
  totpId = f && f.totp && f.totp.length ? f.totp[0].id : '';      // listFactors().totp hanya berisi faktor terverifikasi: ada = toggle di Setelan menyala
  mailTo = g.session && g.session.user ? g.session.user.email : '';
  openModal('email');
  sendCode();
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


/* 8. Modal OTP. Mode: signup (kode email pendaftaran), email (2FA bawaan), totp (autentikator), reset (autentikator saat reset sandi), recover (kode pemulihan).
      Layar "Coba cara lain" (alt) berisi daftar metode alternatif. Semua layar 6 kotak terkirim otomatis begitu kotak ke-6 terisi. */
const modal = $('#modal'), boxes = $$('#otp input'), msg = $('#m-msg'), main = $('#m-main'), alt = $('#m-alt');
const MODES = {
  signup: { icon: 'fa-regular fa-envelope', title: 'Verifikasi Email Anda', text: 'Kami telah mengirimkan 6 digit kode ke email Anda.', btn: 'Verifikasi' },
  email: { icon: 'fa-regular fa-envelope', title: 'Cek email Anda', text: '', btn: 'Verifikasi' },
  totp: { icon: 'fa-solid fa-shield-halved', title: 'Aplikasi Autentikator', text: 'Masukkan 6 digit kode dari aplikasi autentikator Anda.', btn: 'Verifikasi' },
  reset: { icon: 'fa-solid fa-shield-halved', title: 'Verifikasi Dua Langkah', text: 'Masukkan 6 digit kode dari aplikasi autentikator untuk melanjutkan reset kata sandi.', btn: 'Verifikasi' },
  recover: { icon: 'fa-solid fa-key', title: 'Kode Pemulihan', text: 'Masukkan salah satu kode pemulihan 2FA Anda (format XXXXX-XXXXX). Setelah berhasil, autentikator lama dilepas dan Anda lanjut dengan kode email.', btn: 'Pulihkan akses' }
};
let mode = 'signup', prevMode = 'totp', fid = '', totpId = '', mailTo = '', pendingEmail = '', lastFocus, cdTimer = 0;

function openModal(m = 'signup') {
  const c = MODES[m], v = $('#verify'), d = $('#m-desc');
  mode = m;
  if (modal.hidden) lastFocus = document.activeElement;
  main.hidden = false; alt.hidden = true;
  $('#m-i').className = c.icon; $('#m-title').textContent = c.title;
  if (m === 'email') { const b = document.createElement('b'); b.textContent = maskMail(mailTo); d.replaceChildren('Kami mengirim kode 6 digit ke ', b, '. Masukkan kode untuk melanjutkan.'); } else d.textContent = c.text;
  $('#resend-row').hidden = !(m === 'signup' || m === 'email');
  $('#alt-row').hidden = m !== 'email';
  $('#m-back').hidden = !(m === 'totp' || m === 'recover');
  if (m !== 'recover') prevMode = m;   // untuk tombol kembali dari mode pemulihan
  $('#otp').hidden = m === 'recover'; $('#rc-field').hidden = m !== 'recover'; $('#rc-row').hidden = !(m === 'totp' || m === 'reset' || m === 'recover');
  $('#rc-link').textContent = m === 'recover' ? 'Kembali ke kode autentikator' : 'Kehilangan HP? Pakai kode pemulihan'; $('#rc-in').value = '';
  v.dataset.label = c.btn; v.textContent = c.btn;
  boxes.forEach(b => { b.value = ''; b.disabled = false; }); msg.textContent = ''; msg.className = 'm-msg';
  modal.hidden = false; (m === 'recover' ? $('#rc-in') : boxes[0]).focus();
}
function closeModal() { clearInterval(cdTimer); modal.hidden = true; lastFocus && lastFocus.focus(); }
const code = () => boxes.map(b => b.value).join('');
function fill(digits, from = 0) {
  digits.split('').slice(0, boxes.length - from).forEach((d, i) => (boxes[from + i].value = d));
  boxes[Math.min(from + digits.length, boxes.length - 1)].focus();
  if (code().length === boxes.length) submit();   // kirim otomatis
}
function fail(text) {
  const otp = $('#otp');
  msg.className = 'm-msg'; msg.textContent = text;
  otp.classList.remove('err'); void otp.offsetWidth; otp.classList.add('err');
}
const note = (text, cls = '') => { msg.className = 'm-msg ' + cls; msg.textContent = text; };

// Hitung mundur tombol "Kirim Ulang" (0 = langsung aktif)
function cooldown(sec) {
  clearInterval(cdTimer);
  const b = $('#resend'), tick = () => {
    if (sec <= 0) { clearInterval(cdTimer); b.disabled = false; b.textContent = 'Kirim Ulang'; return; }
    b.disabled = true; b.textContent = 'Kirim Ulang (' + sec-- + ')';
  };
  tick(); if (sec > 0) cdTimer = setInterval(tick, 1000);
}
// Minta server mengirim kode 6 digit ke email akun (batas kirim dijaga server)
async function sendCode() {
  const b = $('#resend'); clearInterval(cdTimer); b.disabled = true; b.textContent = 'Mengirim...';
  note('Mengirim kode ke email Anda...', 'info');
  try {
    const r = await tfa('send', {});
    if (r.ok) { note('Kode terkirim. Berlaku ' + (r.j.ttl || 10) + ' menit.', 'ok'); cooldown(r.j.wait || 30); }
    else if (r.status === 429 && r.j.wait <= 30) { note('Kode sebelumnya masih berlaku. Cek email Anda.', 'info'); cooldown(r.j.wait); }
    else if (r.status === 429) { note(r.j.error); cooldown(Math.min(r.j.wait || 60, 60)); }
    else { note(r.j.error || 'Kode belum bisa dikirim. Coba lagi.'); cooldown(0); }
  } catch (x) { note(x.message === 'Sesi berakhir. Masuk ulang.' ? x.message : NET); cooldown(0); }
}

// Layar "Coba cara lain"
function openAlt() {
  mode = 'alt'; main.hidden = true; alt.hidden = false; $('#m-back').hidden = false;
  const list = $('#methods'); list.replaceChildren();
  const add = (id, icon, title, sub) => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.className = 'method'; b.dataset.m = id;
    b.innerHTML = '<i class="' + icon + '" aria-hidden="true"></i><span><b></b><small></small></span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i>';
    $('b', b).textContent = title; $('small', b).textContent = sub; li.append(b); list.append(li);
  };
  add('email', 'fa-regular fa-envelope', 'Kode lewat email', 'Kirim kode baru ke ' + maskMail(mailTo));
  if (totpId) add('totp', 'fa-solid fa-shield-halved', 'Aplikasi Autentikator', 'Kode dari Google Authenticator, Authy, atau sejenisnya');   // hanya bila sudah diaktifkan di Setelan
  list.querySelector('button').focus();
}
$('#alt-link').addEventListener('click', openAlt);
$('#methods').addEventListener('click', e => {
  const b = e.target.closest('.method'); if (!b) return;
  if (b.dataset.m === 'email') { openModal('email'); sendCode(); } else { fid = totpId; openModal('totp'); }
});
$('#m-back').addEventListener('click', () => { if (mode === 'alt') openModal('email'); else if (mode === 'totp') openAlt(); else if (mode === 'recover') openModal(prevMode); });

boxes.forEach((box, i) => {
  box.addEventListener('input', () => {
    const d = box.value.replace(/\D/g, '');
    if (d.length > 1) return fill(d, d.length >= boxes.length ? 0 : i);   // isi otomatis dari autofill SMS/email
    box.value = d;
    if (d && i < boxes.length - 1) boxes[i + 1].focus();   // maju otomatis
    if (code().length === boxes.length) submit();           // kirim otomatis di kotak ke-6
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
// Pakai kode pemulihan: server memverifikasi, melepas autentikator lama, dan mengeluarkan sesi lain. Setelah itu lanjut dengan kode email.
async function useRecovery(c) {
  const s = await getSb(), { data } = await s.auth.getSession();
  const r = await fetch('/api/recovery/use', { method: 'POST', headers: { Authorization: 'Bearer ' + data.session.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ code: c }) }), j = await r.json().catch(() => ({}));
  if (!r.ok) return j.error || 'Kode pemulihan salah.';
  await s.auth.refreshSession();
  return '';
}
async function submit() {
  const v = $('#verify'); if (v.disabled) return;           // sudah diproses (kirim otomatis + tombol tidak boleh ganda)
  if (mode === 'recover') {
    if ($('#rc-in').value.replace(/-/g, '').length < 10) return fail('Masukkan kode pemulihan lengkap (10 karakter).');
    msg.textContent = '';
    return busy(v, async () => {
      try {
        const er = await useRecovery($('#rc-in').value); if (er) return fail(er);
        if (prevMode === 'reset') { modal.hidden = true; openPw('new'); } else { note('Autentikator lama dilepas. Lanjut dengan kode email.', 'ok'); await after(); }
      } catch (x) { fail(NET); }
    });
  }
  if (code().length < boxes.length) return fail('Masukkan 6 digit kode verifikasi.');
  msg.textContent = '';
  boxes.forEach(b => (b.disabled = true));
  let good = false;
  await busy(v, async () => {
    try {
      let error, text = 'Kode salah atau kedaluwarsa.', renew = false;
      if (mode === 'signup') ({ error } = await (await getSb()).auth.verifyOtp({ email: pendingEmail, token: code(), type: 'signup' }));
      else if (mode === 'email') { const r = await tfa('verify', { code: code() }); if (!r.ok) { error = true; text = r.j.error || text; renew = !!r.j.renew; } else tfaMark((await (await getSb()).auth.getSession()).data.session); }
      else error = await ver(code());
      if (error) { fail(text); if (renew) cooldown(0); return; }
      good = true; note('Berhasil diverifikasi.', 'ok');
      if (mode === 'signup') await after();                 // email terverifikasi -> lanjut ke 2FA
      else if (mode === 'reset') { modal.hidden = true; openPw('new'); }   // 2FA lolos -> buat sandi baru
      else redirect(true);
    } catch (x) { fail(NET); }
  }, 700);
  if (!good) { boxes.forEach(b => { b.value = ''; b.disabled = false; }); boxes[0].focus(); }   // salah: kosongkan supaya bisa langsung ketik ulang
}
$('#verify').addEventListener('click', submit);

$('#resend').addEventListener('click', async e => {
  boxes.forEach(x => (x.value = '')); boxes[0].focus();
  if (mode === 'email') return sendCode();
  const b = e.currentTarget; cooldown(30);
  try {
    const { error } = await (await getSb()).auth.resend({ type: 'signup', email: pendingEmail });
    note(error ? tr(error.message) : 'Kode baru telah dikirim.', error ? '' : 'ok');
  } catch (x) { note(NET); }
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
