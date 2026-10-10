/* Zero FOUC: tentukan tema SEBELUM CSS utama dimuat, lalu warnai layar splash dan kanvas halaman. */
(function () {
  var d = document.documentElement, t; try { t = localStorage.mm_theme || localStorage.theme } catch (e) { }
  if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  d.dataset.theme = t; var bg = t === 'dark' ? '#09090B' : '#FAFAFA'; d.style.background = bg; d.style.colorScheme = t;
  var s = document.createElement('style'); s.textContent = '#splash{background-color:' + bg + '}'; document.head.appendChild(s);
  try { if (sessionStorage.hasSeenLoading) d.classList.add('seen') } catch (e) { }
  // Warna bilah status browser (<meta id="tc"> sudah di-parse sebelum skrip ini)
  var tc = document.getElementById('tc'); if (tc) tc.content = bg;
})();
