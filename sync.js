// ---- v22: sinkronisasi data. Menggantikan model lama "yang terakhir menulis menang". ----
// Cara kerja:
//  1. Semua perubahan langsung disimpan di perangkat (mm_cache_<uid>) dan tetap bisa dibuat saat offline.
//  2. Salinan data terakhir yang SAMA dengan server disimpan sebagai "dasar" (mm_base_<uid>: versi updated_at + isi).
//     Perubahan yang menunggu terkirim = selisih antara data sekarang dan dasar itu (tidak ada antrean terpisah yang bisa hilang).
//  3. Saat online: baca baris server. Bila server tidak berubah sejak dasar, kirim dengan syarat updated_at masih sama
//     (compare-and-swap). Bila server sudah berubah (perangkat lain menulis), data digabung tiga arah (core.js: merge3)
//     lalu dikirim dengan syarat yang sama. Bentrok saat menulis diulang otomatis.
//  4. Sebelum timpa paksa (reset, pulihkan) server mengambil snapshot (lihat schema.sql: take_snapshot dan pemicu otomatis).
const SYNC = { base: null, busy: false, again: false, err: '', last: 0, t: 0, n: -1, toastAt: 0, errAt: 0 };
const snap = () => ({ T, B, G, OUT, IN, OP, BL, EM, W, LK, RL, TM, DT, CL, AMAL });
const baseKey = () => 'mm_base_' + UID;
const baseLoad = () => { try { return JSON.parse(localStorage[baseKey()] || 'null') } catch (e) { return null } };
const baseSave = (v, d) => { SYNC.base = { v, d }; SYNC.n = -1; try { localStorage[baseKey()] = JSON.stringify(SYNC.base) } catch (e) { /* kuota penuh: dasar tetap ada di memori */ } };
const cacheNow = () => { try { localStorage['mm_cache_' + UID] = JSON.stringify(snap()) } catch (x) { } };
const pendingCount = () => { if (!SYNC.base) return 0; if (SYNC.n < 0) SYNC.n = MiraiCore.diffCount(SYNC.base.d, snap()); return SYNC.n };

function syUI() {
  const e = $('#sy'), o = $('#off'); if (!e) return; const n = UID ? pendingCount() : 0, on = navigator.onLine;
  let t = '', k = '';
  if (SYNC.busy && n) { t = 'Menyinkronkan…'; k = 'go' }
  else if (!on) { t = n ? n + ' menunggu sinkron' : 'Offline'; k = 'off' }
  else if (n) { t = n + ' menunggu sinkron'; k = 'wait' }
  else if (SYNC.err) { t = 'Gagal sinkron'; k = 'err' }
  e.hidden = !t; e.textContent = t; e.dataset.k = k; e.title = SYNC.err || '';
  if (o) o.textContent = on ? 'Koneksi tersambung kembali.' : 'Anda sedang offline. Catatan tetap bisa dibuat dan terkirim otomatis saat online' + (n ? ' (' + n + ' menunggu).' : '.');
}

// Dipanggil setiap data berubah.
function save() {
  if (!UID) return; cacheNow(); SYNC.n = -1; syUI();
  if (!navigator.onLine) { if (Date.now() - SYNC.toastAt > 20000) { SYNC.toastAt = Date.now(); toast('Tersimpan di perangkat. Akan dikirim otomatis saat online') } return }
  clearTimeout(SYNC.t); SYNC.t = setTimeout(() => syncNow(), 400);
}

const isNet = x => !navigator.onLine || /fetch|network|load failed|failed to fetch|timeout/i.test(String(x && (x.message || x)));
const isRls = x => x && (x.code === '42501' || /row-level security/i.test(x.message || ''));

// Menerapkan data hasil gabungan ke layar tanpa menutup dialog yang sedang terbuka.
function applyLive(d) { apply(d); cats(); const v = cur; try { go(v) } catch (e) { } }

async function syncNow(opt) {
  if (!UID) return;
  if (SYNC.busy) { SYNC.again = true; return }
  if (!navigator.onLine) return syUI();
  SYNC.busy = true; SYNC.again = false; syUI(); let ok = false;
  try {
    await getSb();
    for (let i = 0; i < 4 && !ok; i++) {
      const local = snap(), base = SYNC.base;
      const { data: row, error } = await sb.from('user_data').select('data,updated_at').maybeSingle(); if (error) throw error;
      if (!row) { // belum ada baris di server: kirim data lokal
        const r = await sb.from('user_data').insert({ user_id: UID, data: local }).select('updated_at').single();
        if (r.error) { if (r.error.code === '23505') continue; throw r.error }
        baseSave(r.data.updated_at, local); ok = true; break;
      }
      const dirty = !!base && MiraiCore.diffCount(base.d, local) > 0, moved = !base || base.v !== row.updated_at;
      if (!dirty) { // tidak ada perubahan lokal: cukup ambil versi server bila berbeda
        if (moved) { applyLive(row.data); baseSave(row.updated_at, clone(snap())); cacheNow() } // dasar = data setelah migrasi bentuk lama, agar tidak dianggap perubahan
        ok = true; break;
      }
      const merged = moved ? MiraiCore.merge3(base.d, local, row.data) : local;
      const r = await sb.from('user_data').update({ data: merged }).eq('user_id', UID).eq('updated_at', row.updated_at).select('updated_at');
      if (r.error) throw r.error;
      if (!r.data || !r.data.length) continue; // perangkat lain menulis saat kita menulis: ulangi dari baca
      baseSave(r.data[0].updated_at, merged);
      if (moved) { // data gabungan memuat perubahan perangkat lain; pertahankan juga ketikan baru selama permintaan berjalan
        const cur = snap(), fin = MiraiCore.merge3(local, cur, merged); applyLive(fin); cacheNow();
      }
      ok = true;
    }
    if (!ok) throw new Error('Terjadi bentrok berulang saat menyimpan. Coba lagi sebentar lagi.');
    SYNC.err = ''; SYNC.last = Date.now();
    try { if (localStorage['mm_spid_' + UID]) mod('space').then(() => spReconcile()).catch(() => { }) } catch (e) { } // salin pengeluaran 'Bersama' ke Ruang Bersama
  } catch (x) {
    if (isRls(x)) { mod('security').then(() => devCheck(true)).catch(() => { }); SYNC.err = 'Akses ditolak' }
    else if (!isNet(x)) { SYNC.err = x.message || 'Gagal menyimpan'; if (Date.now() - SYNC.errAt > 60000) { SYNC.errAt = Date.now(); toast('Gagal menyimpan: ' + SYNC.err) } }
  }
  SYNC.busy = false; SYNC.n = -1; syUI();
  if (SYNC.again || (ok && pendingCount())) { SYNC.again = false; setTimeout(() => syncNow(), 300) }
  return ok;
}

// Timpa server dengan data lokal (reset, pulihkan dari snapshot/cadangan). Snapshot server diambil dulu agar bisa dibatalkan.
async function pushForce() {
  await getSb(); try { await sb.rpc('take_snapshot') } catch (e) { }
  const local = snap(), r = await sb.from('user_data').upsert({ user_id: UID, data: local }).select('updated_at').single();
  if (r.error) throw r.error; baseSave(r.data.updated_at, local); cacheNow(); syUI();
}

// Titik awal setelah masuk: tentukan data mana yang dipakai. Mengembalikan true bila sedang offline (memakai salinan perangkat).
async function syncStart() {
  SYNC.base = baseLoad(); const raw = localStorage['mm_cache_' + UID]; let cache = null; try { cache = raw && JSON.parse(raw) } catch (e) { }
  let row = null, off = false;
  if (navigator.onLine) { try { const r = await sb.from('user_data').select('data,updated_at').maybeSingle(); if (r.error) throw r.error; row = r.data } catch (x) { if (!cache) throw x; off = true } } else off = true;
  if (off) { // tanpa sinyal: pakai salinan perangkat; bila belum ada dasar, anggap salinan itu = server
    if (!cache) throw new Error('koneksi bermasalah');
    if (!SYNC.base) baseSave(null, cache); apply(cache); return true;
  }
  if (!row) { const legacy = JSON.parse(localStorage['mm_d_' + US] || 'null'); apply(cache || legacy || { OP: num(window.__ob) }); SYNC.base = null; save(); return false }
  const dirty = !!(SYNC.base && cache && MiraiCore.diffCount(SYNC.base.d, cache) > 0);
  if (dirty) { apply(cache); setTimeout(() => syncNow(), 1200) } // ada catatan offline yang belum terkirim: gabungkan nanti, jangan dibuang
  else { apply(row.data); baseSave(row.updated_at, clone(snap())); cacheNow() }
  return false;
}

addEventListener('online', () => { syUI(); clearTimeout(SYNC.t); SYNC.t = setTimeout(() => syncNow(), 800) });
addEventListener('offline', syUI);
document.addEventListener('visibilitychange', () => { if (!document.hidden && UID && Date.now() - SYNC.last > 15000) syncNow() });
setInterval(() => { if (UID && !document.hidden && navigator.onLine && Date.now() - SYNC.last > 100000) syncNow() }, 30000);
