// ---- v22: Ruang Bersama sungguhan (menggantikan simulasi v18). Dimuat malas lewat mod('space'). ----
// Data disimpan di tabel bersama (schema.sql bagian 4) dengan aturan akses per anggota (RLS):
//  - anggota hanya melihat ruangnya sendiri; mencatat/mengubah/menghapus hanya baris miliknya;
//  - bergabung hanya lewat kode undangan sekali pakai (berlaku 7 hari) melalui fungsi database join_space().
// Pengeluaran yang ditandai "Bersama" tetap ada di data pribadi (T, sh:1) lalu disalin ke space_tx secara idempoten
// (spReconcile): tambah yang belum ada, ubah yang berbeda, hapus yang sudah tidak bersama. Aman dijalankan berulang dan setelah offline.
let SPC = null; // { none } atau { id, name, role, members:[{id,name,role}], goals, deps, tx }
const SP_COLORS = ['var(--me)', 'var(--pa)', '#B45309', '#7C3AED'];
const av = (i, l, t) => `<span class="av${i == 1 ? ' pa' : ''}" style="${i > 1 ? 'background:' + SP_COLORS[i] + ';color:#fff' : ''}" role="img" aria-label="${E(t)}">${E(l)}</span>`;
const spMe = () => T.filter(x => x.sh && !x.tr && x.type == 'out'), spSum = a => a.filter(mo).reduce((s, x) => s + x.amt, 0);
const spUrl = c => location.origin + location.pathname.replace(/[^/]*$/, '') + '?join=' + c;
const spName = () => (FNM || (US || 'Saya').split('@')[0]).replace(/[<>&"'\\]/g, '').slice(0, 30);
const spErr = x => String((x && x.message) || x || 'koneksi bermasalah');

async function spFetch() {
  await getSb();
  const m = await sb.from('space_members').select('space_id,user_id,role,display_name,joined_at').order('joined_at'); if (m.error) throw m.error;
  if (!m.data.length) { try { localStorage.removeItem('mm_spid_' + UID) } catch (e) { } return SPC = { none: true } }
  const sid = m.data[0].space_id; try { localStorage['mm_spid_' + UID] = sid } catch (e) { }
  const [s, g, d, x] = await Promise.all([sb.from('spaces').select('id,name').eq('id', sid).single(), sb.from('space_goals').select('id,name,target,created_by').eq('space_id', sid).order('created_at'), sb.from('space_deposits').select('id,goal_id,user_id,amount').eq('space_id', sid), sb.from('space_tx').select('id,user_id,client_id,tx_date,cat,descr,amount').eq('space_id', sid).order('tx_date', { ascending: false }).limit(300)]);
  for (const r of [s, g, d, x]) if (r.error) throw r.error;
  const me = m.data.find(v => v.user_id == UID), members = [...m.data].sort((a, b) => (b.user_id == UID) - (a.user_id == UID) || a.joined_at.localeCompare(b.joined_at)).map(v => ({ id: v.user_id, name: v.display_name, role: v.role }));
  return SPC = { id: sid, name: s.data.name, role: me ? me.role : 'member', members, goals: g.data.map(v => ({ ...v, target: Number(v.target) })), deps: d.data.map(v => ({ ...v, amount: Number(v.amount) })), tx: x.data.map(v => ({ id: v.id, uid: v.user_id, cid: v.client_id, date: v.tx_date, cat: v.cat, desc: v.descr, amt: Number(v.amount) })) };
}

// Menyalin pengeluaran bersama milik sendiri ke space_tx. Dipanggil setelah tiap sinkron data (sync.js) dan saat Ruang dibuka.
let SP_SIG = '';
async function spReconcile(force) {
  const sid = (SPC && SPC.id) || (UID && localStorage['mm_spid_' + UID]); if (!sid || !navigator.onLine) return;
  const mine = spMe().map(x => ({ cid: String(x.id), tx_date: x.date, cat: x.cat, descr: (x.desc || '').slice(0, 120), amount: x.amt })), sig = MC.hash(JSON.stringify(mine));
  if (!force && sig == SP_SIG) return;
  try {
    await getSb(); const r = await sb.from('space_tx').select('id,client_id,tx_date,cat,descr,amount').eq('space_id', sid).eq('user_id', UID); if (r.error) throw r.error;
    const have = new Map(r.data.map(v => [v.client_id, v])), want = new Map(mine.map(v => [v.cid, v]));
    const ins = mine.filter(v => !have.has(v.cid)).map(v => ({ space_id: sid, user_id: UID, client_id: v.cid, tx_date: v.tx_date, cat: v.cat, descr: v.descr, amount: v.amount }));
    const upd = mine.filter(v => { const h = have.get(v.cid); return h && (h.tx_date != v.tx_date || h.cat != v.cat || h.descr != v.descr || Number(h.amount) != v.amount) });
    const del = r.data.filter(v => !want.has(v.client_id)).map(v => v.id);
    if (ins.length) { const e = (await sb.from('space_tx').insert(ins)).error; if (e) throw e }
    for (const v of upd) { const e = (await sb.from('space_tx').update({ tx_date: v.tx_date, cat: v.cat, descr: v.descr, amount: v.amount, updated_at: new Date().toISOString() }).eq('space_id', sid).eq('user_id', UID).eq('client_id', v.cid)).error; if (e) throw e }
    if (del.length) { const e = (await sb.from('space_tx').delete().in('id', del)).error; if (e) throw e }
    SP_SIG = sig
  } catch (x) { /* dicoba lagi pada sinkron berikutnya */ }
}

function ruang() {
  if (!SPC) { $('#sphs').textContent = navigator.onLine ? 'Memuat Ruang Bersama...' : 'Butuh koneksi internet untuk memuat Ruang Bersama.'; $('#spht').textContent = 'Ruang Bersama'; $('#spmain').hidden = true; $('#spnone').hidden = true; $('#spinv').hidden = true; $('#spend').hidden = true }
  else spRender();
  if (navigator.onLine) spFetch().then(async () => { await spReconcile(true); if (cur == 'sp') { await spFetch(); spRender() } }).catch(x => { if (cur == 'sp') toast('Gagal memuat Ruang Bersama: ' + spErr(x)) })
}
function spRender() {
  const S = SPC;
  if (S.none) { $('#spav').innerHTML = av(0, (US || '?')[0].toUpperCase(), 'Avatar Anda'); $('#spht').textContent = 'Kelola keuangan rumah tangga berdua'; $('#sphs').textContent = 'Buat ruang untuk berbagi pengeluaran dan tujuan tabungan dengan pasangan atau keluarga. Hanya yang ditandai Bersama yang terlihat; catatan pribadi tetap pribadi.'; $('#spnone').hidden = false; $('#spmain').hidden = true; $('#spinv').hidden = true; $('#spend').hidden = true; if (!$('#spd').value) $('#spd').value = spName(); return }
  const n = S.members.length, mine = spMe(), H = [...mine.map(x => ({ id: x.id, uid: UID, date: x.date, cat: x.cat, desc: x.desc, amt: x.amt })), ...S.tx.filter(x => x.uid != UID)].sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
  const sums = S.members.map(m => spSum(H.filter(x => x.uid == m.id))), tot = sums.reduce((a, b) => a + b, 0), pc = sums.map(v => tot ? Math.round(v / tot * 100) : 0), idx = id => Math.max(0, S.members.findIndex(m => m.id == id));
  $('#spnone').hidden = true; $('#spmain').hidden = false; $('#spinv').hidden = n >= 4; $('#spend').hidden = false; $('#spend').textContent = S.role == 'owner' ? 'Bubarkan ruang' : 'Keluar dari ruang';
  $('#spav').innerHTML = S.members.map((m, i) => av(i, m.name[0].toUpperCase(), m.id == UID ? 'Anda' : m.name)).join('');
  $('#spht').textContent = S.name; $('#sphs').textContent = n > 1 ? S.members.map(m => m.id == UID ? 'Anda' : m.name).join(', ') + '. Catatan yang ditandai Bersama terlihat oleh semua anggota.' : 'Baru Anda sendiri. Undang pasangan lewat tombol di samping.';
  const seg = (vals, lbl) => `<div class="seg" role="img" aria-label="${E(lbl)}">${vals.map((v, i) => `<i class="sg${i == 1 ? ' pa' : ''}" style="width:${v}%;${i > 1 ? 'background:' + SP_COLORS[i] : ''}"></i>`).join('')}</div>`;
  const leg = vals => `<div class="rw" style="flex-wrap:wrap;gap:10px">${S.members.map((m, i) => `<span class="lg"><i class="dot${i == 1 ? ' pa' : ''}" style="${i > 1 ? 'background:' + SP_COLORS[i] : ''}"></i>${E(m.id == UID ? 'Anda' : m.name)} ${vals[i]}</span>`).join('')}</div>`;
  $('#spk').innerHTML = '<h3 class="ct">Kontribusi tim bulan ini</h3>' + (tot ? `<div class="big">${RM(tot)}</div><small>dikeluarkan bersama untuk kebutuhan rumah tangga</small>${seg(pc, 'Kontribusi: ' + S.members.map((m, i) => m.name + ' ' + pc[i] + ' persen').join(', '))}${leg(pc.map(v => v + '%'))}` : '<small>Belum ada pengeluaran bersama bulan ini. Pilih Bersama saat mencatat transaksi, dan kontribusi tampil di sini.</small>');
  $('#spg').innerHTML = S.goals.map(g => {
    const ds = S.deps.filter(d => d.goal_id == g.id), per = S.members.map(m => ds.filter(d => d.user_id == m.id).reduce((s, d) => s + d.amount, 0)), t = per.reduce((a, b) => a + b, 0), w = per.map(v => Math.min(100, v / g.target * 100));
    return `<div class="card"><div class="rw"><b>${E(g.name)}</b><b>${Math.min(100, Math.round(t / g.target * 100))}%</b></div>${seg(w, g.name + ': ' + S.members.map((m, i) => m.name + ' ' + RM(per[i])).join(', ') + ', dari target ' + RM(g.target))}${leg(per.map(RM))}<div class="rw" style="margin-top:12px"><small>${RM(t)} dari ${RM(g.target)}</small><span><button class="bt s" data-spdep="${g.id}" aria-label="Setor ke ${E(g.name)}">Setor</button>${g.created_by == UID || S.role == 'owner' ? ` <button class="bt s g" data-spdel="${g.id}" aria-label="Hapus target ${E(g.name)}">Hapus</button>` : ''}</span></div></div>`
  }).join('') || emp('Belum ada target bersama', 'Tambahkan satu, misalnya Dana Darurat atau Liburan.', '', 'goal');
  $('#spl').innerHTML = H.slice(0, 20).map(x => { const i = idx(x.uid), m = S.members[i]; return `<div class="li">${av(i, m.name[0].toUpperCase(), 'Dicatat oleh ' + (x.uid == UID ? 'Anda' : m.name))}<div><b>${E(x.desc)}</b><small>${E(x.cat)}, ${fd(x.date)}, ${E(x.uid == UID ? 'Anda' : m.name)}</small></div><b>−${RM(x.amt)}</b></div>` }).join('') || '<small>Belum ada catatan bersama. Pengeluaran yang Anda tandai Bersama akan muncul di sini.</small>'
}

/* ---------- Buat ruang, gabung, undang, keluar ---------- */
$('#spc').onclick = async () => {
  const name = $('#spn').value.trim().replace(/[<>&"'\\]/g, '').slice(0, 40), dn = $('#spd').value.trim().replace(/[<>&"'\\]/g, '').slice(0, 30); if (!name || !dn) return toast('Isi nama ruang dan nama tampilan Anda');
  if (!navigator.onLine) return toast('Butuh koneksi internet');
  try {
    await getSb(); const r = await sb.rpc('create_space', { p_name: name, p_display: dn }); if (r.error) throw r.error;
    // Pindahkan tujuan dari mode simulasi lama (hanya yang berisi setoran Anda atau dibuat sendiri)
    try { const old = JSON.parse(localStorage['mm_sp_' + UID] || 'null'); if (old && old.g) for (const g of old.g.filter(g => g.me > 0 || g.id > 2)) { const ng = await sb.from('space_goals').insert({ space_id: r.data, name: String(g.n).slice(0, 40), target: g.t, created_by: UID }).select('id').single(); if (ng.data && g.me > 0) await sb.from('space_deposits').insert({ goal_id: ng.data.id, space_id: r.data, user_id: UID, amount: g.me }) } localStorage.removeItem('mm_sp_' + UID) } catch (e) { }
    SPC = null; toast('Ruang dibuat. Undang pasangan lewat tombol Undang'); ruang()
  } catch (x) { toast('Gagal membuat ruang: ' + spErr(x)) }
};
async function spJoinPrompt(code) {
  code = (code || sessionStorage.getItem('mm_join') || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); try { sessionStorage.removeItem('mm_join') } catch (e) { }
  if (!code) return; if (!navigator.onLine) return toast('Butuh koneksi internet untuk bergabung');
  try {
    await getSb(); const r = await sb.rpc('peek_invite', { p_code: code }); if (r.error) throw r.error;
    if (!r.data || !r.data.length) return toast('Kode undangan tidak valid atau sudah kedaluwarsa');
    const p = r.data[0], d = mkDlg('jnd', `<form id="jnf"><h3 class="ct">Gabung ke Ruang Bersama?</h3><p><b>${E(p.inviter)}</b> mengundang Anda ke ruang <b>${E(p.space_name)}</b> (${p.members} anggota). Anggota ruang melihat pengeluaran dan setoran yang Anda tandai Bersama. Catatan pribadi Anda tidak terlihat.</p>
      <input id="jnn" maxlength="30" required aria-label="Nama tampilan Anda" placeholder="Nama tampilan Anda" value="${E(spName())}"><div class="rw"><button type="button" class="bt g" data-close="jnd">Tidak</button><button class="bt">Gabung</button></div></form>`);
    $('#jnf').onsubmit = async e => { e.preventDefault(); const dn = $('#jnn').value.trim().replace(/[<>&"'\\]/g, '').slice(0, 30); if (!dn) return toast('Isi nama tampilan'); try { const j = await sb.rpc('join_space', { p_code: code, p_display: dn }); if (j.error) throw j.error; d.close(); SPC = null; toast('Berhasil bergabung'); gos('sp') } catch (x) { toast('Gagal bergabung: ' + spErr(x)) } };
    d.showModal()
  } catch (x) { toast('Gagal memeriksa undangan: ' + spErr(x)) }
}
$('#spjb').onclick = () => spJoinPrompt($('#spj').value);
$('#spinv').onclick = async () => {
  if (!SPC || !SPC.id) return; if (!navigator.onLine) return toast('Butuh koneksi internet');
  try { await getSb(); const r = await sb.rpc('create_invite', { p_space: SPC.id }); if (r.error) throw r.error; const u = spUrl(r.data); $('#ivl').value = u; $('#ivcd').textContent = r.data; $('#iv').showModal(); mkQR(u) } catch (x) { toast('Gagal membuat undangan: ' + spErr(x)) }
};
$('#ivx').onclick = () => $('#iv').close();
$('#ivc').onclick = async () => { const i = $('#ivl'); let ok = true; try { await navigator.clipboard.writeText(i.value) } catch (e) { i.select(); try { ok = document.execCommand('copy') } catch (x) { ok = false } } toast(ok ? 'Tautan berhasil disalin!' : 'Gagal menyalin. Tautan sudah terpilih, salin secara manual.') };
$('#spend').onclick = () => {
  if (!SPC || !SPC.id) return; const own = SPC.role == 'owner';
  ask(own ? 'Bubarkan ruang' : 'Keluar dari ruang', own ? 'Ruang dan SEMUA catatan bersama, target, serta setoran milik semua anggota dihapus permanen. Catatan pribadi tiap anggota tidak berubah.' : 'Catatan dan setoran bersama milik Anda dihapus dari ruang ini. Catatan pribadi Anda tidak berubah.', own ? 'Ya, bubarkan' : 'Ya, keluar', async () => {
    try {
      await getSb();
      if (own) { const r = await sb.from('spaces').delete().eq('id', SPC.id); if (r.error) throw r.error }
      else { const a = await sb.from('space_tx').delete().eq('space_id', SPC.id).eq('user_id', UID), b = await sb.from('space_deposits').delete().eq('space_id', SPC.id).eq('user_id', UID); if (a.error || b.error) throw a.error || b.error; const r = await sb.from('space_members').delete().eq('space_id', SPC.id).eq('user_id', UID); if (r.error) throw r.error }
      SPC = { none: true }; SP_SIG = ''; try { localStorage.removeItem('mm_spid_' + UID) } catch (e) { } ruang(); toast(own ? 'Ruang dibubarkan' : 'Anda keluar dari ruang')
    } catch (x) { toast('Gagal: ' + spErr(x)) }
  })
};

/* ---------- Target dan setoran ---------- */
$('#spadd').onclick = () => { if (!SPC || !SPC.id) return toast('Buat atau gabung ke ruang dulu'); pbox('Target tabungan bersama', [{ l: 'Nama target', v: '' }, { l: 'Target (Rp)', v: '', c: 1 }], async ([a, b]) => { const n = a.trim().replace(/[<>&"'\\]/g, '').slice(0, 40), t = num(b); if (!n || t <= 0) return toast('Isi nama dan target'); try { const r = await sb.from('space_goals').insert({ space_id: SPC.id, name: n, target: t, created_by: UID }); if (r.error) throw r.error; await spFetch(); spRender(); toast('Target bersama ditambahkan') } catch (x) { toast('Gagal: ' + spErr(x)) } }) };
$('#spg').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.spdep) { const g = SPC.goals.find(x => x.id == b.dataset.spdep); pbox('Setor ke ' + g.name, [{ l: 'Jumlah setoran (Rp)', v: '', c: 1 }], async ([a]) => { const v = num(a); if (v <= 0) return toast('Isi jumlah setoran'); try { const r = await sb.from('space_deposits').insert({ goal_id: g.id, space_id: SPC.id, user_id: UID, amount: v }); if (r.error) throw r.error; await spFetch(); spRender(); toast('Setoran berhasil dicatat') } catch (x) { toast('Gagal: ' + spErr(x)) } }) }
  else if (b.dataset.spdel) { const g = SPC.goals.find(x => x.id == b.dataset.spdel); ask('Hapus target', 'Hapus target "' + g.name + '"? Setoran semua anggota di target ini ikut terhapus.', 'Ya, hapus', async () => { try { const r = await sb.from('space_goals').delete().eq('id', g.id); if (r.error) throw r.error; await spFetch(); spRender(); toast('Target dihapus') } catch (x) { toast('Gagal: ' + spErr(x)) } }) }
};
setInterval(() => { if (cur == 'sp' && !document.hidden && navigator.onLine && SPC && SPC.id) spFetch().then(() => cur == 'sp' && spRender()).catch(() => { }) }, 45000);

function mkQR(u) {
  const q = $('#ivq'), fail = () => q.innerHTML = '<small style="color:#555;line-height:1.4;display:block;width:192px">QR belum termuat. Gunakan tombol Salin Tautan.</small>';
  q.innerHTML = '<small style="color:#555;display:block;width:192px">Memuat QR...</small>';
  loadScript(QR_LIB).then(() => { if (!window.QRCode) return fail(); q.innerHTML = ''; new QRCode(q, { text: u, width: 384, height: 384, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    // v21a: qrcodejs baru menampilkan <img> setelah uji data-URI async yang gagal di sebagian browser HP (QR kosong). Buat gambarnya sendiri dari canvas.
    const cv = q.querySelector('canvas');
    if (!cv) return fail();
    try { const im = new Image(); im.alt = 'QR Code tautan undangan'; im.src = cv.toDataURL('image/png'); q.replaceChildren(im) }
    catch (e) { cv.style.setProperty('display', 'block', 'important'); cv.style.width = cv.style.height = '192px' }
  }).catch(fail)
}
