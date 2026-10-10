// ---- v20: akun terhubung (e-wallet dan bank lewat Open Banking OAuth 2.0). Token hanya disimpan di server (api/link). ----
Object.assign(P, {
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'
});
// Warna tiap institusi ada di BKC (app.js, juga dipakai kartu dompet); sesuaikan di sana. Logo resmi: taruh berkas di img/banks/<id>.svg (lihat README di folder itu).
const BK = {
  bca: { n: 'BCA', t: 'bank', ...BKC.bca },
  bri: { n: 'BRI', t: 'bank', ...BKC.bri, ac: '#F58220' },
  bni: { n: 'BNI', t: 'bank', ...BKC.bni, ac: '#F58220' },
  jago: { n: 'Bank Jago', s: 'JG', t: 'bank', ...BKC.jago },
  superbank: { n: 'Superbank', s: 'SB', t: 'bank', ...BKC.superbank },
  bsi: { n: 'BSI', t: 'bank', ...BKC.bsi, ac: '#F9A51A' },
  dana: { n: 'DANA', t: 'ewallet', ...BKC.dana },
  gopay: { n: 'GoPay', t: 'ewallet', ...BKC.gopay },
  ovo: { n: 'OVO', t: 'ewallet', ...BKC.ovo }
};
const ago = s => { const m = Math.round((Date.now() - new Date(s)) / 6e4); return m < 1 ? 'baru saja' : m < 60 ? m + ' menit lalu' : m < 1440 ? Math.round(m / 60) + ' jam lalu' : Math.round(m / 1440) + ' hari lalu' };
async function api(a, body) {
  await getSb(); const { data } = await sb.auth.getSession(), r = await fetch('/api/link/' + a, { method: 'POST', headers: { Authorization: 'Bearer ' + data.session.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Server menolak permintaan'); return j
}
// v23: akun terhubung memakai kartu yang sama dengan dompet biasa dan menyatu di Dompet (#wl). v25: Dompet kini slide geser dan kartunya berwarna sesuai bank (--c1/--c2/--fg).
// wallets() (app.js) menggambar ulang #wl setiap dash(); dash() memanggil lnkRender() lagi setelah modul ini dimuat.
function lnkRender() {
  const w = $('#wl'); if (!w) return;
  const t = Math.max(wt(), 1);
  const html = LK.map(l => {
    const k = BK[l.p], pct = Math.round(Math.max(l.b, 0) / t * 100);
    return `<article class="wc lk" data-p="${l.p}" style="${wvar(k)}"><small class="wn"><span class="bkd" aria-hidden="true">${k.s || k.n.slice(0, 2).toUpperCase()}</span><span>${k.n}</span></small><div class="big">${RM(l.b)}</div><small>${l.x ? 'Tidak dihitung di total saldo' : pct + '% dari total saldo'}</small><small class="lkm">${k.t == 'bank' ? 'Rekening' : 'E-wallet'} ${E(l.m || '')}, sinkron ${ago(l.at)}</small>${l.sb ? '<span class="bkt">Data simulasi</span>' : ''}<span class="wa"><button type="button" data-a="s" data-p="${l.p}" aria-label="Sinkronkan ${k.n}">${ic('refresh', 16)}</button><button type="button" data-a="i" data-p="${l.p}" aria-pressed="${!l.x}" aria-label="Sertakan ${k.n} di total saldo">${ic(l.x ? 'eyeoff' : 'eye', 16)}</button><button type="button" data-a="u" data-p="${l.p}" aria-label="Putuskan ${k.n}">${ic('x', 16)}</button></span></article>`
  }).join('');
  wslKeep(() => {
    w.querySelectorAll('.wc.lk').forEach(e => e.remove());
    const add = w.querySelector('.wc.add');
    add ? add.insertAdjacentHTML('beforebegin', html) : w.insertAdjacentHTML('beforeend', html)
  })
}
async function lnkSync(p, say) {
  try { const j = await api('sync', { provider: p }), a = j.accounts[0], i = LK.findIndex(x => x.p == p), o = { p, m: a.m, b: a.b, at: a.at, sb: j.sandbox ? 1 : 0, x: i >= 0 ? LK[i].x : 0 }; i >= 0 ? LK[i] = o : LK.push(o); save(); lnkRender(); dash(); toast(say ? 'Saldo ' + BK[p].n + ' diperbarui' : BK[p].n + ' terhubung') }
  catch (x) { toast('Gagal sinkron: ' + x.message) }
}
$('#wl').onclick = e => {
  const b = e.target.closest('button[data-a]'); if (!b) return; const p = b.dataset.p, l = LK.find(x => x.p == p);
  if (b.dataset.a == 's') lnkSync(p, true);
  else if (b.dataset.a == 'i') { l.x = l.x ? 0 : 1; save(); lnkRender(); dash() }
  else ask('Putuskan akun', `Putuskan ${BK[p].n}? Izin akses dihapus dari server Mirai dan saldonya tidak lagi dihitung di total.`, 'Ya, putuskan', async () => { try { await api('unlink', { provider: p }); LK = LK.filter(x => x.p != p); save(); lnkRender(); dash(); toast('Akun diputuskan') } catch (x) { toast('Gagal memutuskan: ' + x.message) } })
};
function lnkOpen() {
  $('#lnl').innerHTML = [['ewallet', 'E-Wallet'], ['bank', 'Bank']].map(([t, h]) => `<small style="margin:10px 8px 4px">${h}</small>` + Object.entries(BK).filter(([, k]) => k.t == t).map(([id, k]) => { const on = LK.some(l => l.p == id); return `<button type="button" class="mi" data-p="${id}"${on ? ' disabled' : ''}><span class="bkd" style="background:linear-gradient(135deg,${k.c1},${k.c2});color:${k.fg}">${k.s || k.n.slice(0, 2).toUpperCase()}</span><span><b>${k.n}</b><small>${on ? 'Terhubung' : 'Hubungkan lewat Open Banking'}</small></span></button>` }).join('')).join(''); $('#lnd').showModal()
}
$('#lnl').onclick = async e => { const b = e.target.closest('button[data-p]'); if (!b || b.disabled) return; b.disabled = true; try { location.href = (await api('start', { provider: b.dataset.p })).url } catch (x) { b.disabled = false; toast('Gagal menghubungkan: ' + x.message) } };
$('#lnd').onclick = e => { if (e.target === e.currentTarget) $('#lnd').close() };
lnkRender();
