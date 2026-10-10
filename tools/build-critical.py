#!/usr/bin/env python3
"""Ekstrak CSS kritis dari style.css lalu tulis ke critical.css (dimuat index.html lewat <link>).

Kritis = aturan yang cocok dengan elemen yang benar-benar dirender pada layar awal
(splash + formulir masuk + footer), diuji pada tema terang/gelap dan layar ponsel/desktop.
Jalankan ulang setiap kali Anda mengubah tampilan login, splash, atau footer di style.css:

    python tools/build-critical.py [folder_proyek]

Butuh: pip install playwright && playwright install chromium
"""
import os, re, subprocess, sys, time
from playwright.sync_api import sync_playwright
from cssfmt import format_css

PROJ = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
PORT = 8899

JS = r"""
() => {
  const sheet = [...document.styleSheets].find(s => s.href && /style\.css/.test(s.href));
  if (!sheet) return { err: 'style.css belum terpasang' };
  const live = [...document.querySelectorAll('*')].filter(e => e.getClientRects().length > 0);
  const STRIP = /::?(before|after|placeholder|backdrop|selection|-webkit-[a-z-]+|-moz-[a-z-]+)|:(hover|active|focus|focus-visible|focus-within|checked|disabled|visited|placeholder-shown|valid|invalid|required|optional|read-only|popover-open|modal|open|target)\b/g;
  const matches = sel => /\[hidden\]/.test(sel) || sel.split(',').some(p => {   // aturan penyembunyi [hidden] wajib ikut (elemen tersembunyi tidak 'hidup')
    p = p.replace(STRIP, '').trim(); if (!p) return true;
    if (/^(\*|html|body|:root)\b/.test(p) && !/[ >+~]/.test(p.replace(/\[[^\]]*\]/g, ''))) return true;
    try { return live.some(e => e.matches(p)) || document.documentElement.matches(p) } catch (x) { return true }
  });
  const used = [], names = new Set();
  const walk = (rules, path) => [...rules].forEach((r, i) => {
    const k = path.concat(i).join('.');
    if (r.type === 1) { if (matches(r.selectorText)) used.push(k) }
    else if (r.type === 4 || r.type === 12) {                       // @media / @supports
      if (/print/.test(r.conditionText || r.media?.mediaText || '')) return;
      const before = used.length; walk(r.cssRules, path.concat(i)); if (used.length > before) used.push(k)
    }
  });
  walk(sheet.cssRules, []);
  return { used, total: sheet.cssRules.length };
}
"""
DUMP = r"""
(used) => {
  const sheet = [...document.styleSheets].find(s => s.href && /style\.css/.test(s.href)); const out = [];
  const at = (rules, p) => p.reduce((r, i) => r.cssRules[i], { cssRules: rules });
  const keys = used.map(k => k.split('.').map(Number));
  const set = new Set(used);
  const emit = (rules, path) => [...rules].forEach((r, i) => {
    const k = path.concat(i).join('.');
    if (r.type === 1 && set.has(k)) out.push(r.cssText);
    else if ((r.type === 4 || r.type === 12) && set.has(k)) {
      const inner = []; [...r.cssRules].forEach((c, j) => { if (c.type === 1 && set.has(k + '.' + j)) inner.push(c.cssText) });
      out.push((r.type === 4 ? '@media ' + r.media.mediaText : '@supports ' + r.conditionText) + '{' + inner.join('') + '}')
    }
  });
  emit(sheet.cssRules, []);
  const kf = {}; [...sheet.cssRules].forEach(r => { if (r.type === 7) kf[r.name] = r.cssText });
  return { rules: out, kf };
}
"""

def collect():
    union = set(); total = 0
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for theme in ("light", "dark"):
            for vp, mobile in (({"width": 390, "height": 844}, True), ({"width": 1350, "height": 940}, False)):
                ctx = b.new_context(viewport=vp, is_mobile=mobile)
                ctx.route("**/*", lambda r: r.continue_() if r.request.url.startswith(f"http://127.0.0.1:{PORT}") else r.fulfill(status=204, body=""))
                ctx.add_init_script(f"localStorage.mm_theme='{theme}'")
                pg = ctx.new_page(); pg.goto(f"http://127.0.0.1:{PORT}/index.html?legacy"); pg.wait_for_timeout(1400)
                res = pg.evaluate(JS)
                if "err" in res: sys.exit(res["err"])
                union |= set(res["used"]); total = res["total"]; ctx.close()
        ctx = b.new_context(viewport={"width": 1350, "height": 940}); ctx.route("**/*", lambda r: r.continue_() if r.request.url.startswith(f"http://127.0.0.1:{PORT}") else r.fulfill(status=204, body=""))
        pg = ctx.new_page(); pg.goto(f"http://127.0.0.1:{PORT}/index.html?legacy"); pg.wait_for_timeout(1400)
        dump = pg.evaluate(DUMP, sorted(union)); b.close()
    return dump, total

def minify(c):
    c = re.sub(r"/\*.*?\*/", "", c, flags=re.S); c = re.sub(r"\s+", " ", c)
    c = re.sub(r"\s*([{};,>])\s*", r"\1", c); c = re.sub(r":\s+", ":", c); return c.replace(";}", "}").strip()

if __name__ == "__main__":
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=PROJ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(.8)
    try: dump, total = collect()
    finally: srv.terminate()
    body = "".join(dump["rules"])
    kf = "".join(v for n, v in dump["kf"].items() if re.search(r"animation[^;}]*\b" + re.escape(n) + r"\b", body))
    css = minify(body + kf)
    p = os.path.join(PROJ, "critical.css")
    open(p, "w", encoding="utf-8").write("/* Dibuat otomatis oleh tools/build-critical.py dari style.css. Jangan diedit manual. */\n" + format_css(css))
    print(f"CSS kritis: {len(dump['rules'])} aturan, {len(css)} byte (style.css penuh punya {total} aturan tingkat atas) -> critical.css")
