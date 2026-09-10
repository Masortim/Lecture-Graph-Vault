#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Независимая проверка подписей: ширина текста берётся НЕ из оценки ядра, а из реальных
метриков шрифтов (PIL + DejaVu для латиницы, Noto Serif CJK для иероглифов).

Зачем: упаковка меток считает наезды по ширине, которую предсказывает graph-core (textUnits).
Если оценка оптимистичнее, чем рисует браузер, «чистый» тест и наложение на экране — разные
вещи. Этот скрипт сверяет их: рисует ровно те строки, что идут в DOM (.lg-label-en жирным,
.lg-label-zh обычным), и ищет пересечения прямоугольников в мировых координатах.

Запуск: python3 check_label_metrics.py [maxRadius ...]
"""
import json
import os
import subprocess
import sys

from PIL import ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
from vault_root import vault_root  # корень хранилища: <dev>/.. или <dev>/../Lecture-Graph-Vault

VAULT = vault_root(HERE)
DUMP = r"""
const fs=require("fs"),path=require("path");
const core=require("./src/graph-core.js"),vaultNotes=require("./vault-notes.js");
const ROOT=require("./vault-root.js")(__dirname);
const settings=JSON.parse(fs.readFileSync(path.join(ROOT,".obsidian/plugins/lecture-graph/data.json"),"utf8"));
const R=Number(process.argv[2]||0);
if(R) settings.maxRadius=R;
const {notes}=vaultNotes.collect(ROOT,settings);
const g=core.buildGraph(notes,settings);
core.applySizes(g.nodes,settings);
core.initPositions(g.nodes,{width:1400,height:900,graph:g,layout:settings.layout});
core.run(g,{layout:settings.layout,width:1400,height:900});
if(R){core.applySizes(g.nodes,settings);g.nodes.forEach(n=>{n.tx=n.x;n.ty=n.y;});
  core.packAroundAnchors(g,{layout:settings.layout,passes:24,pull:0.6});}
const out=g.nodes.filter(n=>n.labelShown&&(n.labelEn||n.labelZh)).map(n=>({
  id:n.id,type:n.type,x:n.x,y:n.y,r:n.r,font:n.font,lw:n.lw,lh:n.lh,en:n.labelEn,zh:n.labelZh}));
process.stdout.write(JSON.stringify(out));
"""

LATIN_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
]
LATIN_REG = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
]
CJK_CANDIDATES = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
]
WIDE = [(0x1100, 0x115F), (0x2E80, 0x33FF), (0x3400, 0x4DBF), (0x4E00, 0x9FFF),
        (0xA000, 0xA4CF), (0xAC00, 0xD7A3), (0xF900, 0xFAFF), (0xFE30, 0xFE6F),
        (0xFF00, 0xFF60), (0xFFE0, 0xFFE6), (0x2026, 0x2026)]


def is_wide(cp):
    return any(a <= cp <= b for a, b in WIDE)


def first_path(cands):
    for p in cands:
        if os.path.exists(p):
            return p
    return None


class Measurer:
    """Ширина строки в px: латиница — DejaVu, широкие глифы — CJK-шрифт. Кэш по (текст, кегль)."""

    def __init__(self):
        self.cache = {}
        self.faces = {}

    def font(self, path, size, index=0):
        key = (path, int(size), index)
        if key not in self.faces:
            try:
                self.faces[key] = ImageFont.truetype(path, max(4, int(round(size))), index=index)
            except Exception:
                self.faces[key] = ImageFont.load_default()
        return self.faces[key]

    def width(self, text, size, bold):
        key = (text, int(size), bold)
        if key in self.cache:
            return self.cache[key]
        lp = first_path(LATIN_CANDIDATES if bold else LATIN_REG)
        cp = first_path(CJK_CANDIDATES)
        total = 0.0
        i = 0
        while i < len(text):
            wide = is_wide(ord(text[i]))
            j = i
            while j < len(text) and is_wide(ord(text[j])) == wide:
                j += 1
            run = text[i:j]
            path = cp if (wide and cp) else lp
            total += self._measure(run, path, size)
            i = j
        self.cache[key] = total
        return total

    def _measure(self, text, path, size):
        if not text:
            return 0.0
        f = self.font(path, size)
        try:
            return float(f.getlength(text))
        except Exception:
            return len(text) * size * 0.62


def dump(radius):
    cmd = ["node", "-e", DUMP, str(radius or 0)]
    r = subprocess.run(cmd, cwd=HERE, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit("node -e упал: " + (r.stderr or r.stdout)[-400:])
    return json.loads(r.stdout)


def check(radius, m):
    nodes = dump(radius)
    rects = []
    for n in nodes:
        we = m.width(n["en"], n["font"], True)
        wz = m.width(n["zh"], n["font"], False)
        w = max(we, wz) + 4.0          # +4 px на «вынос» засечек и лигатуры
        y0 = n["y"] + n["r"] + 1
        rects.append((n["id"], n["x"] - w / 2, n["x"] + w / 2, y0, y0 + n["lh"], w, n["lw"]))
    bad = []
    for i in range(len(rects)):
        a = rects[i]
        for j in range(i + 1, len(rects)):
            b = rects[j]
            ox = min(a[2], b[2]) - max(a[1], b[1])
            oy = min(a[4], b[4]) - max(a[3], b[3])
            if ox > 0.5 and oy > 0.5:
                bad.append((ox * oy, a[0], b[0], round(ox, 1), round(oy, 1)))
    ratio = sorted((r[5] / r[6] for r in rects), reverse=True)
    print("maxRadius=%s: подписей %d · пересечений по РЕАЛЬНЫМ метрикам: %d · "
          "отношение ширина(PIL)/оценка(ядро): медиана %.2f, максимум %.2f"
          % (radius or "data.json", len(rects), len(bad),
             ratio[len(ratio) // 2], ratio[0]))
    for x in sorted(bad, reverse=True)[:6]:
        print("    %s × %s  по x %.1f, по y %.1f" % (x[1], x[2], x[3], x[4]))
    return len(bad)


def main():
    radii = [int(a) for a in sys.argv[1:] if a.isdigit()] or [0, 6, 12, 22, 34, 60]
    m = Measurer()
    if not first_path(LATIN_CANDIDATES):
        raise SystemExit("нет DejaVu — мерить нечем")
    total = 0
    for r in radii:
        total += check(r, m)
    print("ИТОГО пересечений: %d" % total)
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
