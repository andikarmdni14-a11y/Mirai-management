/* Memuat CSS non-kritis tanpa memblokir render (pengganti atribut onload pada <link data-async>). */
(function () {
  function done(link) {
    if (link.rel === 'preload') link.rel = 'stylesheet'; // style.css: preload -> stylesheet
    else link.media = 'all'; // Google Fonts: media=print -> all
  }
  document.querySelectorAll('link[data-async]').forEach(function (link) {
    if (link.sheet) return done(link);
    link.addEventListener('load', function () { done(link); }, { once: true });
    // Jaring pengaman jika peristiwa load terlewat
    addEventListener('load', function () { if (link.rel === 'preload' || link.media === 'print') done(link); }, { once: true });
  });
})();
