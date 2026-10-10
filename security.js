// ---- v22: keamanan dan kepercayaan. Dimuat malas lewat mod('security'). ----
// Kode pemulihan 2FA, perangkat aktif, riwayat cadangan otomatis, ekspor data, hapus akun, dan persetujuan Syarat/Privasi.
// Server: api/recovery/[a].js dan api/account/[a].js (memakai service role). Tabel: lihat schema.sql (v22).
const devId = () => { let d = localStorage.mm_dev; if (!d) { d = [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join(''); localStorage.mm_dev = d } return d };
async function sapi(path, body, method) {
  await getSb(); const { data } = await sb.auth.getSession(); if (!data.session) throw new Error('Sesi berakhir. Masuk ulang.');
  const r = await fetch('/api/' + path, { method: method || (body ? 'POST' : 'GET'), headers: { Authorization: 'Bearer ' + data.session.access_token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'Server menolak permintaan'), { status: r.status, j }); return j
}
const dlFile = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1e3) };
const agoTxt = s => { const m = Math.round((Date.now() - new Date(s)) / 6e4); return m < 1 ? 'baru saja' : m < 60 ? m + ' menit lalu' : m < 1440 ? Math.round(m / 60) + ' jam lalu' : Math.round(m / 1440) + ' hari lalu' };
const fdt = s => new Date(s).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const cancelOff = d => d.addEventListener('cancel', e => e.preventDefault());

/* ---------- Perangkat: daftar, cek dikeluarkan, notifikasi login baru (di server) ---------- */
async function devCheck() {
  try {
    const r = await sapi('account/device', { id: devId() });
    if (r.revoked) { try { sessionStorage.mm_msg = 'Perangkat ini telah dikeluarkan dari akun Anda. Masuk lagi untuk melanjutkan.' } catch (e) { } await forceOut(); return true }
  } catch (x) { /* server belum dipasang atau offline: abaikan, RLS tetap melindungi data */ }
  return false
}
async function forceOut() { try { ['mm_cache_', 'mm_base_'].forEach(k => localStorage.removeItem(k + UID)); await getSb(); await sb.auth.signOut({ scope: 'local' }) } catch (x) { } location.replace('login.html') }

/* ---------- Setelah masuk: persetujuan, kode pemulihan, undangan ---------- */
async function secAfterLogin(user) {
  if (user.user_metadata?.tos !== TOS_VER) return tosDlg(() => secNext());
  secNext()
}
async function secNext() {
  try { if (sessionStorage.mm_join) mod('space').then(() => spJoinPrompt()).catch(() => { }) } catch (e) { }
  try { const r = await sapi('recovery/status'); if (r.remaining === 0 && !sessionStorage.mm_rc_skip) rcDlg(true) } catch (x) { }
}
function tosDlg(done) {
  const d = mkDlg('tosd', `<form id="tosf"><h3 class="ct">Syarat dan Privasi diperbarui</h3>
    <p>Untuk terus memakai Mirai, mohon baca dan setujui <a href="syarat.html" target="_blank" rel="noopener">Syarat &amp; Ketentuan</a> serta <a href="privasi.html" target="_blank" rel="noopener">Kebijakan Privasi</a> kami. Di sana dijelaskan data apa yang kami simpan, untuk apa, berapa lama, dan hak Anda untuk mengunduh atau menghapus data.</p>
    <label class="opt"><input type="checkbox" id="tosc"><span><b>Saya telah membaca dan menyetujuinya</b></span></label><div class="err" id="tose"></div>
    <div class="rw"><button type="button" class="bt g" id="tosx">Keluar</button><button class="bt" id="tosy" disabled>Setuju dan lanjut</button></div></form>`);
  let acc = false; cancelOff(d); d.onclose = () => { if (!acc) d.showModal() }; // Chrome tetap menutup dialog bila Esc ditekan tanpa interaksi pengguna: buka lagi sampai setuju
  $('#tosc').onchange = e => $('#tosy').disabled = !e.target.checked; $('#tosx').onclick = () => logout(true);
  $('#tosf').onsubmit = async e => {
    e.preventDefault(); $('#tosy').disabled = true;
    try { await getSb(); const { error } = await sb.auth.updateUser({ data: { tos: TOS_VER, tos_at: new Date().toISOString() } }); if (error) throw error; acc = true; d.close(); done && done() }
    catch (x) { $('#tose').textContent = navigator.onLine ? 'Gagal menyimpan persetujuan: ' + (x.message || '') : 'Butuh koneksi internet untuk menyimpan persetujuan.'; $('#tosy').disabled = false }
  };
  d.showModal()
}

/* ---------- Kode pemulihan 2FA ---------- */
async function rcDlg(nudge) {
  let rem = null; try { rem = (await sapi('recovery/status')).remaining } catch (x) { return toast('Gagal memuat status kode pemulihan: ' + (x.message || '')) }
  const d = mkDlg('rcd', `<div class="ivb"><h3 class="ct">Kode pemulihan 2FA</h3>
    <p>${nudge ? '<b>Simpan kode pemulihan sekarang.</b> ' : ''}Jika HP dengan aplikasi autentikator hilang atau rusak, kode ini satu-satunya cara masuk lagi tanpa kehilangan data. Tiap kode hanya berlaku sekali.</p>
    <p id="rcs"><b>${rem}</b> kode tersisa.</p><div id="rcg"></div>
    <div class="rw"><button type="button" class="bt g" id="rcl">${nudge ? 'Nanti' : 'Tutup'}</button><button type="button" class="bt" id="rcn">${rem ? 'Buat kode baru' : 'Buat kode pemulihan'}</button></div>
    <small>Membuat kode baru membatalkan semua kode lama.</small></div>`);
  $('#rcl').onclick = () => { if (nudge) try { sessionStorage.mm_rc_skip = '1' } catch (e) { } d.close() };
  $('#rcn').onclick = async e => {
    const doIt = async () => {
      e.target.disabled = true;
      try {
        const { codes } = await sapi('recovery/generate', {});
        $('#rcs').textContent = 'Simpan kode berikut di tempat aman (pengelola kata sandi, kertas di brankas). Kode tidak ditampilkan lagi.';
        $('#rcg').innerHTML = `<div class="rcg">${codes.map(c => `<code>${c}</code>`).join('')}</div><div class="rw mt-12"><button type="button" class="bt s g" id="rcc">Salin</button><button type="button" class="bt s g" id="rcd2">Unduh .txt</button></div><label class="opt mt-12"><input type="checkbox" id="rck"><span><b>Saya sudah menyimpan kode ini</b></span></label>`;
        $('#rcc').onclick = async () => { try { await navigator.clipboard.writeText(codes.join('\n')); toast('Kode disalin') } catch (x) { toast('Gagal menyalin. Gunakan Unduh .txt') } };
        $('#rcd2').onclick = () => dlFile('Mirai-kode-pemulihan.txt', 'Kode pemulihan 2FA Mirai Management (' + US + ')\nDibuat ' + new Date().toLocaleString('id-ID') + '\nTiap kode hanya berlaku sekali. Simpan di tempat aman.\n\n' + codes.join('\n') + '\n', 'text/plain');
        e.target.hidden = true; $('#rcl').disabled = true; $('#rck').onchange = ev => $('#rcl').disabled = !ev.target.checked; $('#rcl').textContent = 'Selesai'
      } catch (x) { toast('Gagal membuat kode: ' + (x.message || '')); e.target.disabled = false }
    };
    rem ? ask('Buat kode baru?', 'Semua kode pemulihan lama akan berhenti berlaku.', 'Ya, buat baru', doIt) : doIt()
  };
  d.showModal()
}

/* ---------- Perangkat aktif, keluarkan, keluar dari semua perangkat ---------- */
async function devDlg() {
  let L; try { L = (await sapi('account/devices?id=' + devId())).devices } catch (x) { return toast('Gagal memuat perangkat: ' + (x.message || '')) }
  const d = mkDlg('dvd', `<div class="ivb"><h3 class="ct">Perangkat aktif</h3><small>Perangkat yang pernah masuk ke akun ini. Tidak mengenali salah satunya? Keluarkan, lalu ganti kata sandi.</small><div id="dvl" class="mt-12">${L.map(v => `<div class="li"><span class="ic">${ic('smartphone', 15)}</span><div><b>${E(v.label || 'Perangkat')}${v.current ? ' <span class="tag">Perangkat ini</span>' : ''}${Date.now() - new Date(v.first_seen) < 864e5 && !v.current ? ' <span class="tag">Baru</span>' : ''}</b><small>${E([v.city, v.country].filter(Boolean).join(', ') || 'Lokasi tidak diketahui')}, ${E(v.ip || '')}, aktif ${agoTxt(v.last_seen)}</small></div>${v.current ? '' : `<button class="bt s g" data-rv="${E(v.id)}">Keluarkan</button>`}</div>`).join('') || '<small>Belum ada data perangkat.</small>'}</div>
    <div class="rw mt-12"><button type="button" class="bt g" data-close="dvd">Tutup</button><button type="button" class="bt danger" id="dvall">Keluar dari semua perangkat</button></div></div>`);
  $('#dvl').onclick = e => { const b = e.target.closest('[data-rv]'); if (b) ask('Keluarkan perangkat', 'Perangkat itu langsung tidak bisa membaca atau menyimpan data, dan harus masuk ulang dengan kata sandi dan 2FA.', 'Ya, keluarkan', async () => { try { await sapi('account/revoke', { id: b.dataset.rv }); toast('Perangkat dikeluarkan'); devDlg() } catch (x) { toast('Gagal: ' + (x.message || '')) } }) };
  $('#dvall').onclick = () => ask('Keluar dari semua perangkat', 'Semua sesi, termasuk perangkat ini, akan keluar. Anda harus masuk lagi dengan kata sandi dan 2FA. Catatan offline yang belum terkirim di perangkat ini akan dikirim dulu bila memungkinkan.', 'Ya, keluar semua', async () => {
    try { if (pendingCount() && navigator.onLine) await syncNow(); await sapi('account/logout-all', {}); try { sessionStorage.mm_msg = 'Anda telah keluar dari semua perangkat.' } catch (e) { } await forceOut() } catch (x) { toast('Gagal: ' + (x.message || '')) }
  });
  d.showModal()
}

/* ---------- Riwayat cadangan otomatis (snapshot server) ---------- */
async function snapDlg() {
  await getSb(); const { data, error } = await sb.from('user_data_history').select('id,taken_at,reason,tx_count,size_bytes').order('taken_at', { ascending: false }).limit(40);
  if (error) return toast('Gagal memuat riwayat cadangan: ' + error.message);
  const d = mkDlg('snd', `<div class="ivb"><h3 class="ct">Riwayat cadangan otomatis</h3><small>Server menyimpan salinan data Anda secara berkala dan sebelum reset atau pemulihan. Memulihkan akan menimpa data sekarang, tetapi data sekarang disimpan dulu sebagai salinan baru.</small>
    <div id="snl" class="mt-12">${(data || []).map(v => `<div class="li"><div><b>${fdt(v.taken_at)}</b><small>${v.tx_count ?? 0} transaksi, ${Math.max(1, Math.round((v.size_bytes || 0) / 1024))} KB, ${v.reason == 'manual' ? 'sebelum reset/pemulihan' : 'otomatis'}</small></div><button class="bt s g" data-sn="${v.id}">Pulihkan</button></div>`).join('') || '<small>Belum ada salinan. Salinan pertama dibuat saat data berubah.</small>'}</div>
    <div class="rw mt-12"><button type="button" class="bt g" data-close="snd">Tutup</button></div></div>`);
  $('#snl').onclick = e => { const b = e.target.closest('[data-sn]'); if (!b) return; ask('Pulihkan salinan ini?', 'Data Anda sekarang diganti dengan salinan ini di semua perangkat. Data sekarang tetap tersimpan di riwayat.', 'Ya, pulihkan', async () => {
    try { const r = await sb.from('user_data_history').select('data').eq('id', b.dataset.sn).single(); if (r.error) throw r.error; clearTimeout(SYNC.t); apply(r.data.data); await pushForce(); $('#snd').close(); $('#sd').close(); cats(); go('dash'); toast('Data dipulihkan') } catch (x) { toast('Gagal memulihkan: ' + (x.message || '')) }
  }) };
  d.showModal()
}

/* ---------- Ekspor semua data pribadi (portabilitas data, UU PDP) ---------- */
async function exportAll() {
  await getSb(); const { data: { user } } = await sb.auth.getUser(); let devs = [], snaps = [];
  try { devs = (await sapi('account/devices?id=' + devId())).devices } catch (x) { }
  try { const r = await sb.from('user_data_history').select('id,taken_at,reason,tx_count').order('taken_at', { ascending: false }); snaps = r.data || [] } catch (x) { }
  const out = { app: 'Mirai Management', jenis: 'ekspor-data-pribadi', diekspor: new Date().toISOString(), akun: { id: user.id, email: user.email, dibuat: user.created_at, nama: user.user_metadata?.full_name || '', persetujuan: { versi: user.user_metadata?.tos || null, waktu: user.user_metadata?.tos_at || null }, masuk_dengan: user.app_metadata?.providers || [] }, data: snap(), perangkat: devs.map(v => ({ label: v.label, kota: v.city, negara: v.country, pertama_terlihat: v.first_seen, terakhir_aktif: v.last_seen })), riwayat_cadangan: snaps, catatan: 'Token akun bank/e-wallet yang terhubung tidak diekspor (hanya tersimpan terenkripsi di server dan tidak pernah dikirim ke browser). Kolom data.LK hanya memuat saldo dan nama penyedia.' };
  dlFile('Mirai_Data_Saya_' + new Date().toLocaleDateString('sv-SE') + '.json', JSON.stringify(out, null, 1)); toast('Data Anda diunduh. Berkas ini berisi data keuangan, simpan dengan hati-hati')
}

/* ---------- Hapus akun ---------- */
async function delDlg() {
  await getSb(); const { data: { user } } = await sb.auth.getUser(), pw = (user.app_metadata?.providers || []).includes('email');
  const d = mkDlg('dad', `<form id="daf"><h3 class="ct">Hapus akun</h3>
    <p>Semua data Anda dihapus <b>permanen</b>: transaksi, anggaran, tujuan, tagihan, utang, cicilan, riwayat cadangan, perangkat, langganan notifikasi, dan akun masuk. Jika Anda pemilik Ruang Bersama, ruang itu ikut dibubarkan. Tindakan ini tidak bisa dibatalkan.</p>
    <p><button type="button" class="bt s g" id="dax">Unduh data saya dulu</button></p>
    ${pw ? '<input id="dap" type="password" autocomplete="current-password" aria-label="Kata sandi" placeholder="Kata sandi akun">' : ''}
    <div><label class="lb" for="dac">Ketik HAPUS untuk mengonfirmasi</label><input id="dac" autocomplete="off" placeholder="HAPUS"></div><div class="err" id="dae"></div>
    <div class="rw"><button type="button" class="bt g" data-close="dad">Batal</button><button class="bt danger" id="day">Hapus akun saya</button></div></form>`);
  $('#dax').onclick = () => exportAll().catch(x => toast('Gagal mengunduh: ' + (x.message || '')));
  $('#daf').onsubmit = async e => {
    e.preventDefault(); const er = t => $('#dae').textContent = t; er(''); if ($('#dac').value.trim() != 'HAPUS') return er('Ketik HAPUS (huruf besar) untuk melanjutkan.');
    $('#day').disabled = true;
    try {
      if (pw) { const t = supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }); const { error } = await t.auth.signInWithPassword({ email: US, password: $('#dap').value }); if (error) { $('#day').disabled = false; return er('Kata sandi salah.') } }
      await sapi('account/delete', { confirm: 'HAPUS' });
      clearTimeout(SYNC.t); const keep = Object.keys(localStorage).filter(k => k.startsWith('mm_') && !k.startsWith('mm_dev') && !k.startsWith('mm_theme')); keep.forEach(k => localStorage.removeItem(k));
      try { await sb.auth.signOut({ scope: 'local' }) } catch (x) { } try { sessionStorage.mm_msg = 'Akun Anda telah dihapus. Terima kasih sudah memakai Mirai.' } catch (x) { } location.replace('login.html')
    } catch (x) { er('Gagal menghapus akun: ' + (x.message || 'coba lagi')); $('#day').disabled = false }
  };
  d.showModal()
}

const SX = { rc: () => rcDlg(false), dev: devDlg, snap: snapDlg, export: () => exportAll().catch(x => toast('Gagal mengunduh: ' + (x.message || ''))), del: delDlg };
