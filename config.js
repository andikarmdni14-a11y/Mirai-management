// Isi dari Supabase: Project Settings > API (Project URL dan anon/publishable key).
// Kunci ini aman berada di browser karena data dilindungi Row Level Security (lihat schema.sql).
const SB_URL = 'https://igawcyxqkyirdrganwvn.supabase.co', SB_KEY = 'sb_publishable_gg7aE3scG0CrW1DInKO3ag_cCB2ldpa';

// Google Analytics 4: isi Measurement ID asli (contoh G-AB12CD34EF).
// Selama masih G-XXXXXXXXXX (placeholder), skrip analitik TIDAK dimuat sama sekali.
const GA_ID = 'G-XXXXXXXXXX';

// v22: versi Syarat & Ketentuan / Kebijakan Privasi yang berlaku. Ubah nilai ini saat dokumen berubah: semua pengguna diminta setuju ulang.
const TOS_VER = '2026-10';

// v22: Sentry (pemantauan galat). Kosongkan = tidak aktif dan tidak ada skrip Sentry yang dimuat. Isi DSN proyek JavaScript/Browser Anda.
const SENTRY_DSN = '';

// ---- v18: pemuat skrip malas (lazy) ----
// Pustaka berat (Supabase, Chart.js, QR, jsPDF, GA) tidak lagi dimuat saat halaman dibuka.
// Masing-masing dimuat sekali, tepat saat dibutuhkan. Gagal memuat boleh dicoba lagi.
const loadScript = (() => {
  const m = {};
  return src => m[src] ??= new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => ok();
    s.onerror = () => { delete m[src]; s.remove(); no(new Error('Gagal memuat ' + src)) };
    document.head.append(s)
  })
})();

// Supabase SDK: dimuat saat ada sesi tersimpan / tautan konfirmasi di URL, atau saat tamu mulai mengisi formulir masuk.
const SB_SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
let sb = null, sbp = null;
// v21 "Ingat Saya": pilihan disimpan di localStorage['mm_remember']. '0' = sesi hanya di sessionStorage (hilang saat tab/browser ditutup).
const SB_STORE_KEY = 'sb-' + new URL(SB_URL).hostname.split('.')[0] + '-auth-token';
const sbPick = () => localStorage.getItem('mm_remember') === '0' ? sessionStorage : localStorage;
const sbStore = { getItem: k => sbPick().getItem(k), setItem: (k, v) => sbPick().setItem(k, v), removeItem: k => { localStorage.removeItem(k); sessionStorage.removeItem(k) } };
const setRemember = on => { localStorage.setItem('mm_remember', on ? '1' : '0'); (on ? sessionStorage : localStorage).removeItem(SB_STORE_KEY) };
const getSb = () => sbp ??= loadScript(SB_SDK).then(() => sb = supabase.createClient(SB_URL, SB_KEY, { auth: { storage: sbStore } })).catch(e => { sbp = null; throw e });
// Kunci sesi Supabase: sb-<project-ref>-auth-token. Parameter URL mencakup tautan konfirmasi email / magic link / PKCE.
const hasAuthHint = () => {
  try {
    const ref = new URL(SB_URL).hostname.split('.')[0];
    return !!(localStorage.getItem('sb-' + ref + '-auth-token') || sessionStorage.getItem('sb-' + ref + '-auth-token')) || /[#?&](access_token|refresh_token|code|token_hash|error_description|type)=/.test(location.hash + location.search)
  } catch (e) { return true }
};

// Analitik: hanya bila ID asli, dan baru dimuat setelah interaksi pertama atau 8 detik setelah halaman selesai dimuat.
(() => {
  if (!/^G-[A-Z0-9]{6,}$/i.test(GA_ID) || /^G-X+$/i.test(GA_ID)) return;
  let on = 0;
  const start = () => {
    if (on++) return;
    window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments) };
    gtag('js', new Date()); gtag('config', GA_ID, { anonymize_ip: true });
    loadScript('https://www.googletagmanager.com/gtag/js?id=' + GA_ID).catch(() => { })
  };
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(ev => addEventListener(ev, start, { once: true, passive: true }));
  addEventListener('load', () => setTimeout(start, 8000))
})();

// Web Push (VAPID): jalankan `node tools/gen-vapid.js`, isi kunci publik di sini, dan simpan VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT di env Vercel.
const VAPID_PUBLIC = 'BM7pmccOHjeLaswf_1JC8jlg13paK-PmsBok5LZsvpPC8s0xtelwEvXU6vqq-lRgg-uPEUSFafEGrzkFNnlRyMc';
