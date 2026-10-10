#!/usr/bin/env python3
"""Perapi CSS: satu deklarasi per baris, indentasi 4 spasi, satu selektor per baris.

    python tools/cssfmt.py style.css login.css      # menimpa berkas

Hanya mengubah spasi dan baris. Setelah memformat, isi dibandingkan dengan aslinya
(tanpa spasi); jika ada selisih, berkas TIDAK ditulis.
"""
import re
import sys

IND = "    "


def _scan(s, i, stops):
    """Maju dari i sampai salah satu karakter `stops` pada kedalaman 0 (melewati string, komentar, kurung)."""
    depth = 0
    while i < len(s):
        c = s[i]
        if c in "\"'":
            i += 1
            while i < len(s) and s[i] != c:
                i += 2 if s[i] == "\\" else 1
        elif s.startswith("/*", i):
            i = s.index("*/", i) + 1
        elif c in "([":
            depth += 1
        elif c in ")]":
            depth -= 1
        elif depth == 0 and c in stops:
            return i
        i += 1
    return i


def parse(s, i=0):
    """Hasil: daftar ('c', komentar) | ('d', deklarasi) | ('b', kepala, anak)."""
    items = []
    while True:
        while i < len(s) and s[i].isspace():
            i += 1
        if i >= len(s):
            return items, i
        if s[i] == "}":
            return items, i + 1
        if s.startswith("/*", i):
            j = s.index("*/", i) + 2
            items.append(("c", s[i:j]))
            i = j
            continue
        j = _scan(s, i, ";{}")
        head = s[i:j].strip()
        if j >= len(s) or s[j] in ";}":
            if head:
                items.append(("d", head))
            i = j + 1 if j < len(s) and s[j] == ";" else j
        else:
            kids, i = parse(s, j + 1)
            items.append(("b", head, kids))


def _copy_string(v, i):
    q, j = v[i], i + 1
    while j < len(v) and v[j] != q:
        j += 2 if v[j] == "\\" else 1
    return v[i:j + 1], j + 1


def fmt_value(v):
    out, i = [], 0
    while i < len(v):
        c = v[i]
        if c in "\"'":
            txt, i = _copy_string(v, i)
            out.append(txt)
        elif v[i:i + 4].lower() == "url(":
            j = i + 4
            while j < len(v) and v[j].isspace():
                j += 1
            if j < len(v) and v[j] in "\"'":
                _, j = _copy_string(v, j)
            j = v.index(")", j)
            out.append(v[i:j + 1])
            i = j + 1
        elif c.isspace():
            if out and not out[-1].endswith(" "):
                out.append(" ")
            i += 1
        elif c == ",":
            out.append(", ")
            i += 1
            while i < len(v) and v[i].isspace():
                i += 1
        else:
            out.append(c)
            i += 1
    return re.sub(r"\s*!\s*important\s*$", " !important", "".join(out).strip(), flags=re.I)


def fmt_decl(head):
    k = _scan(head, 0, ":")
    if k >= len(head) or head.startswith("@"):
        return re.sub(r"\s+", " ", head) + ";"
    return head[:k].strip() + ": " + fmt_value(head[k + 1:]) + ";"


def fmt_selector(h, pad):
    parts, cur, depth, i = [], [], 0, 0
    while i < len(h):
        c = h[i]
        if c in "\"'":
            txt, i = _copy_string(h, i)
            cur.append(txt)
            continue
        if c in "([":
            depth += 1
        elif c in ")]":
            depth -= 1
        if c == "," and depth == 0:
            parts.append("".join(cur))
            cur = []
        else:
            cur.append(c)
        i += 1
    parts.append("".join(cur))
    return (",\n" + pad).join(_spaces(p) for p in parts if p.strip())


def _spaces(sel):
    sel, out, depth, i = re.sub(r"\s+", " ", sel.strip()), [], 0, 0
    while i < len(sel):
        c = sel[i]
        if c in "\"'":
            txt, i = _copy_string(sel, i)
            out.append(txt)
            continue
        if c in "([":
            depth += 1
        elif c in ")]":
            depth -= 1
        if depth == 0 and c in ">+~":
            while out and out[-1] == " ":
                out.pop()
            out.append(" " + c + " ")
            i += 1
            while i < len(sel) and sel[i] == " ":
                i += 1
            continue
        out.append(c)
        i += 1
    return "".join(out)


def fmt_at(h):
    h = re.sub(r"\s+", " ", h).strip()
    m = re.match(r"@(media|supports|container)\s*(.*)$", h, re.I)
    if not m:
        return h
    rest = re.sub(r"\(\s*([A-Za-z-]+)\s*:\s*", r"(\1: ", m.group(2))
    rest = re.sub(r"\)\s*and\s*\(", ") and (", rest)
    return ("@" + m.group(1) + " " + re.sub(r"\s+", " ", rest)).strip()


def _comment(txt, pad):
    lines = txt.strip().split("\n")
    out = [pad + lines[0].strip()]
    for ln in lines[1:]:
        ln = ln.strip()
        out.append(pad + (" " + ln if ln.startswith("*") else ln))
    return "\n".join(out)


def emit(items, lvl=0):
    pad, out, prev = IND * lvl, [], None
    for it in items:
        kind = it[0]
        if out and ((kind == "b" and prev != "c") or (kind == "c" and prev != "c") or (kind == "d" and prev == "b")):
            out.append("")
        if kind == "c":
            out.append(_comment(it[1], pad))
        elif kind == "d":
            out.append(pad + fmt_decl(it[1]))
        else:
            head = fmt_at(it[1]) if it[1].startswith("@") else fmt_selector(it[1], pad)
            if it[2]:
                out.append(pad + head + " {")
                out.append(emit(it[2], lvl + 1))
                out.append(pad + "}")
            else:
                out.append(pad + head + " {}")
        prev = kind
    return "\n".join(out)


def _norm(s):
    return re.sub(r"\s+", "", s).replace(";}", "}")


def format_css(text):
    out = emit(parse(text)[0]) + "\n"
    if _norm(out) != _norm(text):
        raise ValueError("hasil format tidak sama dengan aslinya (selain spasi)")
    return out


if __name__ == "__main__":
    for path in sys.argv[1:]:
        src = open(path, encoding="utf-8").read()
        try:
            new = format_css(src)
        except ValueError as e:
            sys.exit(f"{path}: {e}")
        open(path, "w", encoding="utf-8").write(new)
        print(f"{path}: {src.count(chr(10))} -> {new.count(chr(10))} baris")
