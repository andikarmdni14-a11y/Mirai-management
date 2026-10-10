(function () {
  var d = document, h = d.documentElement, sp = d.getElementById('splash'); if (!sp) return;
  var bar = d.getElementById('spb'), txt = d.getElementById('spt'), pb = d.getElementById('spp'), rt = d.getElementById('spr'), gf = d.getElementById('gf'), last = -1;
  var seen = h.classList.contains('seen'), MIN_FIRST = 3000, MIN_REFRESH = 3000, MIN = seen ? MIN_REFRESH : MIN_FIRST, t0 = Date.now(), n = 0, ready = false, fin = false;
  var rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var others = [].filter.call(d.body.children, function (e) { return e !== sp && e.tagName !== 'SCRIPT' });
  others.forEach(function (e) { e.setAttribute('inert', '') });
  function step() { n++ }
  var msgs = ['Menginisialisasi ruang kerja...', 'Mengamankan koneksi...', 'Menyinkronkan data keuangan...'], mi = 0;
  var iv = setInterval(function () { if (mi < msgs.length - 1) { mi++; txt.textContent = msgs[mi]; txt.classList.remove('chg'); void txt.offsetWidth; txt.classList.add('chg') } }, 500);
  /* Tiga sinyal nyata: dokumen dan aset (window load), font Geist, dan sesi/data aplikasi (maks. 5 detik) */
  var pDom = new Promise(function (r) { d.readyState === 'complete' ? r() : addEventListener('load', r) }).then(step);
  /* CSS font kini dimuat tanpa memblokir render, jadi tunggu stylesheet-nya dulu (maks. 4 dtk) baru cek berkas font */
  var cssFont = new Promise(function (r) { if (!gf || gf.sheet) return r(); gf.addEventListener('load', r); gf.addEventListener('error', r); setTimeout(r, 4000) });
  var pFont = cssFont.then(function () { return d.fonts && d.fonts.load ? Promise.all([d.fonts.load('400 14px Geist'), d.fonts.load('600 16px Geist')]).then(function () { return d.fonts.ready }) : 0 }).catch(function () { }).then(step);
  var pApp = new Promise(function (r) { window.__gate = r; setTimeout(r, 5000) }).then(step);
  Promise.all([pDom, pFont, pApp]).then(function () { ready = true });
  var tick = setInterval(function () {
    var real = n >= 3 ? 100 : Math.round(n / 3 * 100), p = Math.min(real, Math.round((Date.now() - t0) / MIN * 100));
    if (p !== last) { last = p; bar.style.transform = 'scaleX(' + p / 100 + ')'; pb.setAttribute('aria-valuenow', p) }
    if (p >= 100 && ready && !fin) finish();
  }, 80);
  var to = setTimeout(function () { if (fin) return; clearInterval(iv); txt.textContent = 'Koneksi lambat'; rt.hidden = false }, 10000);
  function finish() {
    fin = true; clearInterval(tick); clearInterval(iv); clearTimeout(to); rt.hidden = true;
    try { sessionStorage.hasSeenLoading = '1' } catch (e) { }
    var c = d.querySelectorAll('#v-dash .card,#v-dash .wc'); for (var k = 0; k < c.length; k++)c[k].style.setProperty('--i', k);
    others.forEach(function (e) { e.removeAttribute('inert') });
    sp.setAttribute('aria-busy', 'false'); sp.classList.add('out'); h.classList.add('rev');
    setTimeout(function () { sp.remove() }, rm ? 450 : 800);
  }
})();
