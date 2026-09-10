#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Финализация: обновляет копию инструментария в 90 - Dev/, проверяет согласованность
и пересобирает архив хранилища. Запускать после всего пайплайна."""
import json
import re
import os
import shutil
import subprocess
import sys

from vault_root import vault_root  # корень хранилища: <dev>/.. или <dev>/../Lecture-Graph-Vault

DEV = os.path.dirname(os.path.abspath(__file__))
HOME = os.path.abspath(os.path.join(DEV, ".."))
# <dev>/.. — когда инструментарий лежит ВНУТРИ хранилища (как в этом репозитории),
# <dev>/../Lecture-Graph-Vault — когда рядом с ним; копия инструментария в 90 - Dev
# едет вместе с хранилищем, поэтому «источник» и «копия» могут совпадать.
VAULT = vault_root(DEV)
DEVDIR = os.path.join(VAULT, "90 - Dev")
SELF_COPY = os.path.abspath(DEVDIR) == os.path.abspath(DEV)
PLUGIN = os.path.join(VAULT, ".obsidian", "plugins", "lecture-graph")

FILES = [
    "generate_vault.py", "write_config.py", "write_docs.py", "write_stats.js",
    "validate_links.py", "audit_vault.py", "build.js", "render_previews.js", "test-core.js",
    "test-view.js", "obsidian-stub.js", "package.json", "README.md", "finalize.py",
    "check_label_metrics.py", "diag_graph.js", "write_captions.py", "apply_captions.js",
    "write_index.js", "vault-notes.js", "write_abstracts.py", "apply_keywords.js",
    "probe_modes.js", "vault-root.js", "vault_root.py",
]
fails = []


def count_chapters_sections(root):
    n = 0
    for d_ in ("10 - Chapters", "20 - Sections"):
        for r_, _dirs, files in os.walk(os.path.join(root, d_)):
            n += sum(1 for f in files if f.endswith(".md"))
    return n


def check(name, cond, detail=""):
    print(("  ok   " if cond else "  FAIL ") + name + ("" if not detail else " — " + detail))
    if not cond:
        fails.append(name)


print("== копия инструментария в 90 - Dev/ ==")
os.makedirs(DEVDIR, exist_ok=True)
if SELF_COPY:
    # источник и есть 90 - Dev хранилища: копировать нечего и, главное, нельзя
    # (rmtree по «копии» снёс бы сами исходники)
    print("  источник совпадает с 90 - Dev хранилища — копирование пропущено")
else:
    for f in FILES:
        src = os.path.join(DEV, f)
        if not os.path.exists(src):
            check("копия " + f, False, "нет исходника")
            continue
        shutil.copy2(src, os.path.join(DEVDIR, f))
    for folder in ("src", "preview"):
        if os.path.isdir(os.path.join(DEV, folder)):
            if os.path.isdir(os.path.join(DEVDIR, folder)):
                shutil.rmtree(os.path.join(DEVDIR, folder))
            shutil.copytree(os.path.join(DEV, folder), os.path.join(DEVDIR, folder))
    # стаб obsidian для тестов из копии
    stub_src = os.path.join(DEV, "node_modules", "obsidian")
    if os.path.isdir(stub_src):
        dst = os.path.join(DEVDIR, "node_modules", "obsidian")
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if os.path.isdir(dst):
            shutil.rmtree(dst)
        shutil.copytree(stub_src, dst)
    print("  скопировано:", len(FILES) + 1, "файлов + src/ и preview/")

print("== согласованность ==")
# 1. data.json против DEFAULTS ядра
core = subprocess.run(["node", "-e",
                       "const c=require('./src/graph-core.js');console.log(JSON.stringify(c.DEFAULTS));"],
                      cwd=DEV, capture_output=True, text=True)
d = json.loads(core.stdout) if core.returncode == 0 else {}
cfg = json.load(open(os.path.join(PLUGIN, "data.json"), encoding="utf-8"))
for key in ("minRadius", "maxRadius", "degreeGamma", "degreeBase", "sizeMode",
            "labelFontSize", "labelFontMin", "labelFontMax", "labelFontBySize"):
    if key in cfg:
        check("data.json:%s == DEFAULTS (%s)" % (key, cfg[key]),
              json.dumps(cfg[key]) == json.dumps(d.get(key)), "в ядре " + str(d.get(key)))
for key in ("linkDistance", "repel", "gravity", "radius", "radialStrength", "iterations", "polish", "collide",
            "fdpIters", "neatoIters", "twopiRankSep", "neatoScale", "neatoRepel", "frStruct", "clusterPull",
            "postLabels", "postCircles", "dispCap", "polishGrow", "packLabels", "clusterFill", "clusterPad"):
    if key in cfg.get("layout", {}):
        check("data.json:layout.%s == DEFAULTS (%s)" % (key, cfg["layout"][key]),
              json.dumps(cfg["layout"][key]) == json.dumps(d["layout"].get(key)),
              "в ядре " + str(d["layout"].get(key)))

# 2. стили плагина == исходник
a = open(os.path.join(PLUGIN, "styles.css"), encoding="utf-8").read()
b = open(os.path.join(DEV, "src", "styles.css"), encoding="utf-8").read()
check("styles.css совпадает с src/", a.strip() == b.strip())
check("нигде не осталось старой панели (.lg-panel)", ".lg-panel" not in a and "lg-panel" not in open(os.path.join(PLUGIN, "main.js"), encoding="utf-8").read())
check("есть правила полноэкранного режима", "lg-root--full" in a and "lg-root--full" in open(os.path.join(PLUGIN, "main.js"), encoding="utf-8").read())

# 2b. кодировки: ни NUL, ни «заменителя» быть не должно (двойное экранирование в heredoc'ах — частая причина)
import glob
bad = []
for pat in ("**/*.md", "**/*.css", "**/*.js", "**/*.json"):
    for f in glob.glob(os.path.join(VAULT, pat), recursive=True):
        rel = f.replace(os.sep, "/")
        # node_modules — чужой код (и там есть КАТАЛОГИ с именем вида decimal.js:
        # glob не различает файлы и папки, поэтому каталоги пропускаем по isfile)
        if "/node_modules/" in rel or not os.path.isfile(f):
            continue
        t = open(f, encoding="utf-8").read()
        if "\x00" in t or "\ufffd" in t:
            bad.append(f)
check("нет битых символов (NUL/U+FFFD) в заметках, CSS и JS", not bad, ", ".join(bad[:3]))

# 2c. оглавление детерминированно: повторный запуск меняет только метку пересборки
idx = os.path.join(VAULT, "Course Index.md")
def body_no_stamp():
    txt = open(idx, encoding="utf-8").read()
    return "\n".join(l for l in txt.split("\n") if not l.startswith("*пересобрано:"))
before = body_no_stamp()
r = subprocess.run(["node", "write_index.js"], cwd=DEV, capture_output=True, text=True)
check("Course Index детерминирован (повторный запуск меняет только дату)",
      r.returncode == 0 and before == body_no_stamp(),
      ("rc=%s %s" % (r.returncode, (r.stdout or r.stderr).strip()[:110])))
check("Course Index: все вершины курса присутствуют в оглавлении",
      before.count("[[") >= 1000 and before.count("\n## Ch") == 9, "строк со ссылками: %d" % before.count("[["))

# 2d. оглавление — вне графа, и опции про вершину-оглавление в плагине нет
data = json.load(open(os.path.join(PLUGIN, "data.json"), encoding="utf-8"))
left = [k for k in ("indexInGraph", "indexRadius", "indexEdges") if k in data]
check("data.json: настроек вершины-оглавления нет", not left, repr(left))
check("data.json: типа index нет в фильтрах", "index" not in data.get("filters", {}).get("types", {}))
check("data.json: цвета index нет", "index" not in data.get("colors", {}))
gj = json.load(open(os.path.join(VAULT, ".obsidian", "graph.json"), encoding="utf-8"))
check("graph.json: папка дашбордов (и оглавление) исключена из встроенного графа",
      '-path:"50 - Dashboard"' in gj.get("search", ""), gj.get("search", "")[:110])
check("graph.json: для оглавления нет группы цвета",
      not any("Course Index" in (g.get("template", {}).get("query", "")) for g in gj.get("colorGroups", [])))
# заметку можно создать в любой папке (пункт контекстного меню) — от графа её там держит тег
check("graph.json: оглавление исключено и по метке #index",
      "-tag:#index" in gj.get("search", ""), gj.get("search", "")[:60])
css = open(os.path.join(PLUGIN, "styles.css"), encoding="utf-8").read()
check("styles.css: стилей вершины-оглавления нет",
      ".lg-node--index" not in css and ".lg-edges--toc" not in css)
js = open(os.path.join(PLUGIN, "main.js"), encoding="utf-8").read()
check("main.js: кода вершины-оглавления нет, правка adoptGraph на месте",
      "indexInGraph" not in js and "indexShape" not in js and "edgesToc" not in js and "adoptGraph" in js)
check("main.js: в контекстном меню «Проводника» есть пункт оглавления",
      "indexMenuAction" in js and "Создать оглавление курса" in js and "Обновить оглавление курса" in js)
check("main.js: имя файла оглавления берётся из настройки indexNote",
      "indexBaseName" in js and js.count("this.settings.indexNote") >= 2)
mani = json.load(open(os.path.join(PLUGIN, "manifest.json"), encoding="utf-8"))
doc3 = open(os.path.join(VAULT, "00 - Start Here", "03 Plugins \u2014 что установлено.md"), encoding="utf-8").read()
check("03 Plugins: версия плагина в таблице = manifest.json",
      "| Lecture Graph | `lecture-graph` | %s |" % mani.get("version") in doc3, mani.get("version"))
check("03 Plugins: упомянут пункт меню оглавления и путь по умолчанию",
      "правый клик в «Проводнике»" in doc3 and "Course Index.md" in doc3 and "корне" in doc3)
st_h = json.load(open(os.path.join(VAULT, ".vault-stats.json"), encoding="utf-8"))
extra = [k for k in ("hasIndexVertex", "tocEdges", "nodesWithHub", "indexDegreeShift") if k in st_h]
check("статистика: метрик хаба нет, оглавление покрывает все вершины",
      not extra and st_h.get("indexLinks") == st_h.get("nodes"),
      "extra=%s nodes=%s links=%s" % (extra, st_h.get("nodes"), st_h.get("indexLinks")))
idx_rel = str(data.get("indexNote") or "Course Index.md").replace("\\", "/")
if not idx_rel.lower().endswith(".md"):
    idx_rel += ".md"
check("data.json: путь оглавления — корень хранилища (как в документации)",
      idx_rel == "Course Index.md", idx_rel)
legacy = os.path.join(VAULT, "50 - Dashboard", "Course Index.md")
check("в 50 - Dashboard нет старой копии оглавления", not os.path.exists(legacy), legacy)
idx_note = open(os.path.join(VAULT) + os.sep + idx_rel.replace("/", os.sep), encoding="utf-8").read()
check("Course Index: frontmatter помечает заметку указателем, а не вершиной графа",
      "type: index" in idx_note and "\nname:" not in idx_note and "name_zh:" not in idx_note)

# 2f. раунд 15: пузырёк сообщения вместо таблицы свойств, дуги, легенда, JSON, полный экран
ui_src = open(os.path.join(DEV, "src", "ui.js"), encoding="utf-8").read()
check("src/ui.js: строки состояния, карточки свойств и боковой панели нет",
      not any(t in ui_src for t in ("lg-status", "statusEl", "statusBarItem", "attachStatusBar",
                                    "renderStatus", "lg-card", "renderCard", "lg-panel")))
check("src/ui.js: пузырёк ставится у вершины и не перекрывает её (placeBubble)",
      "bubbleEl" in ui_src and "renderBubble" in ui_src and "placeBubble" in ui_src
      and ui_src.count("this.placeBubble()") >= 2 and "lg-bubble--open" in ui_src)
check("src/ui.js: текст сообщения берётся из заметки caption:, есть кнопка создания и правки",
      "captionText" in ui_src and "createCaption" in ui_src and "openCaption" in ui_src
      and "lg-btn--cta" in ui_src and "readTemplate" in ui_src)
check("src/ui.js: клик по вершине отдельно рисует её рёбра (слой .lg-edges--sel)",
      "edgesSel" in ui_src and "lg-edges--sel" in ui_src and "core.neighborhood" in ui_src)
check("src/ui.js: статус — тост, а не постоянная строка", "lg-toast" in ui_src and "toastEl" in ui_src)
check("src/ui.js: легенда цветов по главам и изоляция главы по клику",
      "renderLegend" in ui_src and "lg-legend__chip" in ui_src and "isolateChapter" in ui_src)
check("src/ui.js: полный экран (класс + immersive + requestFullscreen) и экспорт JSON",
      "lg-root--full" in ui_src and "lg-immersive" in ui_src and "requestFullscreen" in ui_src
      and "toGraphJson" in ui_src and "exportJSON" in ui_src)
check("src/ui.js: подписи режет ядро (labelShown/labelEn), а не фиксированный порог",
      "core.labelShown" in ui_src and "labelEn" in ui_src and "applySizesNow" in ui_src)
core_src = open(os.path.join(DEV, "src", "graph-core.js"), encoding="utf-8").read()
check("ядро: дуги (arcPath/edgePath), size:/color:/caption:, toGraphJson",
      "function arcPath" in core_src and "function edgePath" in core_src
      and "sizeRaw" in core_src and "colorProp" in core_src and "caption: linkTargetOf" in core_src
      and "function toGraphJson" in core_src)
check("ядро: кегль подписи ∝ размеру вершины", "baseFont" in core_src and "sizeFactor" in core_src)
check("main.js: собрано с пузырьком и без карточки", "lg-bubble" in js and "lg-card" not in js)
check("styles.css: есть пузырёк/тост/легенда/выделенные рёбра, нет карточки",
      all(t in css for t in (".lg-bubble {", ".lg-toast {", ".lg-legend__chip", ".lg-edges--sel", ".lg-btn--cta"))
      and ".lg-card" not in css and "lg-status" not in css)
check("styles.css: в полноэкранном режиме не остаётся ничего, кроме графа",
      re.search(r"\.lg-root--full \.lg-bar, \.lg-root--full \.lg-legend \{ display: none", css) is not None)

MODES5 = ("fdp", "neato", "twopi", "clusters", "force")
lay = data.get("layout", {})
check("data.json: режим раскладки — один из движков, по умолчанию fdp; кривизна рёбер nonzero",
      lay.get("mode") == "fdp" and float(data.get("curvature", 0)) > 0,
      "mode=%s curvature=%s" % (lay.get("mode"), data.get("curvature")))
check("data.json: режим совпадает с DEFAULTS ядра (иначе Obsidian и CLI расходятся)",
      lay.get("mode") == d.get("layout", {}).get("mode"),
      "data.json %s vs ядро %s" % (lay.get("mode"), d.get("layout", {}).get("mode")))
check("data.json: ключи движков на месте",
      all(lay.get(k) is not None for k in ("fdpIters", "neatoIters", "twopiRankSep", "clusterPull",
                                           "postLabels", "postCircles", "dispCap")),
      repr(sorted(lay)))
ui = open(os.path.join(DEV, "src", "ui.js"), encoding="utf-8").read()
js_main = open(os.path.join(PLUGIN, "main.js"), encoding="utf-8").read()
wc = open(os.path.join(DEV, "write_config.py"), encoding="utf-8").read()
Q = chr(34)
check("ui.js: панель предлагает ровно пять режимов и она подписана",
      all(("[%s%s" % (Q, m)) in ui for m in MODES5) and 'var gLayout = group("Раскладка")' in ui,
      "группа/опции раскладки не найдены")
check("ui.js и main.js: режима «кольца по уровням» (radial) больше нет",
      (Q + "radial" + Q) not in ui and (Q + "radial" + Q) not in js_main, "остался режим radial")
check("main.js: режим по умолчанию — fdp",
      ("mode: " + Q + "fdp" + Q) in js_main, "в собранном main.js другой дефолт")
check("write_config.py: отдаёт в data.json режим fdp и ключи движков",
      ("Q1modeQ1: Q1fdpQ1".replace("Q1", Q)) in wc
      and all((Q + k + Q) in wc for k in ("fdpIters", "twopiRankSep", "clusterPull", "dispCap")),
      "в конфиг-генераторе нет части ключей")
check("data.json: группировка цветов по главам включена, палитра на 9+ глав",
      data.get("chapterColors") is True and len(data.get("chapterPalette", [])) >= 9,
      str(len(data.get("chapterPalette", []))))
check("data.json: папки корпуса и сообщений исключены из обхода",
      all(f in data.get("excludeFolders", []) for f in ("35 - Abstracts", "45 - Captions")),
      repr(data.get("excludeFolders")))
check("data.json: keys размера/цвета/сообщения заданы",
      all(data.get(k) for k in ("sizeKey", "colorKey", "captionKey")),
      repr([data.get(k) for k in ("sizeKey", "colorKey", "captionKey")]))
types_json = json.load(open(os.path.join(VAULT, ".obsidian", "types.json"), encoding="utf-8"))["types"]
check("types.json: size/color/caption объявлены текстовыми свойствами",
      all(types_json.get(k) == "text" for k in ("size", "color", "caption")), repr(types_json.get("size")))
gj2 = json.load(open(os.path.join(VAULT, ".obsidian", "graph.json"), encoding="utf-8"))
check("graph.json: папки сообщений и корпуса исключены из встроенного графа",
      '-path:"45 - Captions"' in gj2.get("search", "") and '-path:"35 - Abstracts"' in gj2.get("search", ""),
      gj2.get("search", "")[:120])
_gq = [g.get("template", {}).get("query", "") for g in gj2.get("colorGroups", [])]
check("graph.json: во встроенном графе цвета по главам — 9 групп по id глав первыми, затем 4 по типам",
      _gq[:9] == ['path:"Ch0%d"' % i for i in range(1, 10)] and len(_gq) == 13,
      "первые: " + " | ".join(_gq[:2]) + " · всего " + str(len(_gq)))

# заметки сообщений: по одной на каждую главу и секцию, тип caption, вершиной не стали
cap_dir = os.path.join(VAULT, "45 - Captions")
caps = [f for f in os.listdir(cap_dir) if f.endswith(".md")] if os.path.isdir(cap_dir) else []
check("45 - Captions: заметок сообщения ровно по числу глав и секций",
      len(caps) == count_chapters_sections(VAULT), "%d файлов" % len(caps))
def is_caption_note(p):
    t = open(p, encoding="utf-8").read()[:600]
    return "type: caption" in t and "lg-node" not in t
check("45 - Captions: все заметки type: caption и без cssclasses lg-node (в граф не попадут)",
      all(is_caption_note(os.path.join(cap_dir, f)) for f in caps))
tpl_dir = os.path.join(VAULT, "40 - Templates")
CAP_TPL = ("T Caption Chapter.md", "T Caption Section.md", "T Caption Heading.md", "T Caption Block.md")
check("40 - Templates: четыре шаблона сообщения (по типу вершины), все с плейсхолдерами",
      all(os.path.exists(os.path.join(tpl_dir, f)) and "{{title}}" in open(os.path.join(tpl_dir, f), encoding="utf-8").read()
          for f in CAP_TPL)
      and sorted(f for f in os.listdir(tpl_dir) if f.startswith("T Caption")) == sorted(CAP_TPL),
      repr(sorted(os.listdir(tpl_dir))))
check("main.js: сообщение можно создать для вершины любого типа (отказа «только для глав» нет)",
      "только для глав и секций" not in js and "CAPTION_TPL_KEY" in js,
      "в сборке остался отказ или нет карты шаблонов")
check("35 - Abstracts: папка корпуса есть и с объяснением формата",
      os.path.isdir(os.path.join(VAULT, "35 - Abstracts"))
      and any("ключев" in f.lower() or f.startswith("00") for f in os.listdir(os.path.join(VAULT, "35 - Abstracts"))))
# у каждой главы и секции свойство caption: ведёт на существующий файл
miss = []
for d_, typ in (("10 - Chapters", "chapter"), ("20 - Sections", "section")):
    for root, _dirs, files in os.walk(os.path.join(VAULT, d_)):
        for fn in files:
            if not fn.endswith(".md"):
                continue
            head = open(os.path.join(root, fn), encoding="utf-8").read()
            m = re.search(r'^caption: *"?\[\[([^\]]+)\]\]"? *$', head, re.M)
            if not m:
                miss.append(os.path.join(d_, root.split(os.sep)[-1], fn) + " — нет caption:")
            elif not os.path.exists(os.path.join(cap_dir, m.group(1).strip() + ".md")):
                miss.append(fn + " -> " + m.group(1) + " (файла нет)")
check("caption: проставлен у всех глав и секций и ведёт на существующую заметку", not miss, "; ".join(miss[:3]))

doc2 = open(os.path.join(VAULT, "00 - Start Here", "02 Graph \u2014 как читать и править.md"), encoding="utf-8").read()
check("02 Graph: описаны пузырёк, дуги, JSON, полный экран и size:/color:/caption:",
      all(t in doc2 for t in ("пузырёк", "Экспорт графа в", "Кластеры глав", "дуги", "size:", "color:", "caption:"))
      and "левом нижнем углу холста" not in doc2)
doc1 = open(os.path.join(VAULT, "00 - Start Here", "01 Conventions \u2014 правила разметки.md"), encoding="utf-8").read()
check("01 Conventions: §1.1 перечисляет size:/color:/caption:/keywords_en:/weight:",
      "1.1. Поля внешнего вида" in doc1 and "35 - Abstracts" in doc1 and "keywords_en:" in doc1 and "weight:" in doc1)
doc0 = open(os.path.join(VAULT, "00 - Start Here", "00 Read Me \u2014 как устроено хранилище.md"), encoding="utf-8").read()
check("00 Read Me: служебные папки 35 - Abstracts и 45 - Captions перечислены",
      "35 - Abstracts" in doc0 and "45 - Captions" in doc0)
# превью: рёбра — дуги
ov = open(os.path.join(VAULT, "90 - Exports", "graph-overview.svg"), encoding="utf-8").read()
# 2f-2. подписи: ширина по РЕАЛЬНЫМ метрикам шрифта (не по оценке ядра) -> 0 наездов
for m in ("fdp", "clusters", "twopi"):
    dg = subprocess.run(["node", "diag_graph.js", "--mode", m], cwd=DEV, capture_output=True, text=True)
    tail = (dg.stdout or "").strip().splitlines()
    check("diag_graph.js --mode %s: инварианты чистые (0 наложений кругов и подписей)" % m,
          dg.returncode == 0 and any("инварианты: ok" in ln for ln in tail),
          "; ".join([ln for ln in tail if "инварианты" in ln][:1] or [dg.stderr.strip()[:160]]))
lm = subprocess.run(["python3", "check_label_metrics.py", "34", "6"], cwd=DEV,
                    capture_output=True, text=True, timeout=900)
lm_out = (lm.stdout or lm.stderr).strip()
if "No module named" in lm_out or "мерить нечем" in lm_out:
    check("подписи не наезжают по реальным метрикам шрифтов", True, "пропущено: нет Pillow/шрифтов")
else:
    check("подписи не наезжают по реальным метрикам шрифтов (PIL, maxRadius 34 и 6)",
          lm.returncode == 0, lm_out.replace("\n", " | ")[-220:])
_dsegs = [x.split(chr(34))[0] for x in ov.split("d=" + chr(34))[1:]]
check("ядро: ширина подписи считается по типам глифов (CJK шире латиницы)",
      "function textUnits" in core_src and "1.05" in core_src and "wideGlyph" in core_src)
check("превью SVG: структурные рёбра — кривые (Q), прямых линий нет",
      ov.count("Q") > 100 and len(_dsegs) > 100 and all("L" not in x for x in _dsegs),
      "дуг: %d, сегментов d: %d" % (ov.count("Q"), len(_dsegs)))

# 2g. Course Index: цветные вертикальные полоски по уровням
vs = json.load(open(os.path.join(VAULT, ".vault-stats.json"), encoding="utf-8"))


def cnt_pref(text, pref):
    return sum(1 for line in text.split("\n") if line.startswith(pref))


bars = {
    "chapter": "> [!chapter]+ ",
    "section": "> > [!section]+ ",
    "heading": "> > > [!heading]+ ",
}
got = {k: cnt_pref(before, v) for k, v in bars.items()}
want = {"chapter": vs.get("chapters"), "section": vs.get("sections"), "heading": vs.get("headings")}
check("Course Index: у глав/секций/заголовков своя цветная полоска нужного уровня",
      got == want, "в файле %s, вершин %s" % (got, want))
check("Course Index: все блоки сидят под полоской 4-го уровня",
      cnt_pref(before, "> > > > - [[") == vs.get("blocks"), "строк блоков: %d, блоков: %s"
      % (cnt_pref(before, "> > > > - [["), vs.get("blocks")))
check("Course Index: группы блоков не больше, чем заголовков",
      0 < cnt_pref(before, "> > > > [!block] ") <= want["heading"],
      "групп: %d" % cnt_pref(before, "> > > > [!block] "))
check("Course Index: главы остались заголовками ## (якоря таблицы живые)",
      before.count("\n## Ch") == vs.get("chapters"))
snip = open(os.path.join(VAULT, ".obsidian", "snippets", "lecture-nodes.css"), encoding="utf-8").read()
check("сниппет: четыре цвета полосок оглавления из палитры графа",
      all(('data-callout="%s"' % t) in snip for t in ("chapter", "section", "heading", "block"))
      and "border-left: 4px solid rgb(var(--lg-bar))" in snip
      and all(("%s, %s, %s" % c) in snip for c in ((242, 179, 61), (74, 158, 218), (89, 201, 138), (192, 122, 216))))
check("сниппет: серые полосы цитат-обёрток нейтрализованы, color-adjust в печати есть",
      ".lg-index blockquote { border-left: 0" in snip and "print-color-adjust: exact" in snip)
appr = json.load(open(os.path.join(VAULT, ".obsidian", "appearance.json"), encoding="utf-8"))
check("appearance.json: сниппет lecture-nodes включён (иначе полоски не раскрасятся)",
      "lecture-nodes" in appr.get("enabledCssSnippets", []), repr(appr.get("enabledCssSnippets")))

# 3. main.js чист и собирается
js = open(os.path.join(PLUGIN, "main.js"), encoding="utf-8").read()
check("main.js: нет питоновских True/False/None", not any(
    s in js for s in (": True", ": False", "= True", "= False", "None,")))
r = subprocess.run(["node", "--check", os.path.join(PLUGIN, "main.js")], capture_output=True, text=True)
check("main.js: node --check", r.returncode == 0, r.stderr.strip()[:200])

# 4. цифры в .vault-stats.json против реальных файлов
stats = json.load(open(os.path.join(VAULT, ".vault-stats.json"), encoding="utf-8"))
real = {"chapter": 0, "section": 0, "heading": 0, "block": 0}
for d_ in ("10 - Chapters", "20 - Sections", "25 - Headings", "30 - Blocks"):
    for root, _dirs, files in os.walk(os.path.join(VAULT, d_)):
        for fn in files:
            if fn.endswith(".md"):
                real[{"10 - Chapters": "chapter", "20 - Sections": "section",
                       "25 - Headings": "heading", "30 - Blocks": "block"}[d_]] += 1
check("файлов в хранилище столько, сколько в .vault-stats.json",
      real["chapter"] == stats["chapters"] and real["section"] == stats["sections"]
      and real["heading"] == stats["headings"] and real["block"] == stats["blocks"],
      "на диске %s, в статистике %s" % (real, [stats["chapters"], stats["sections"], stats["headings"], stats["blocks"]]))
check("документация без устаревших чисел",
      all(tok not in open(os.path.join(VAULT, "00 - Start Here", f), encoding="utf-8").read()
          for f in os.listdir(os.path.join(VAULT, "00 - Start Here"))
          for tok in ("6523", "8302", "максимум 57")))

# 5. превью свежие (не старше main.js)
for svg in ("graph-overview.svg", "graph-full.svg", "graph-fdp.svg", "graph-neato.svg",
            "graph-twopi.svg", "graph-clusters.svg"):
    p = os.path.join(VAULT, "90 - Exports", svg)
    fresh = os.path.getmtime(p) >= os.path.getmtime(os.path.join(PLUGIN, "main.js"))
    check(svg + " пересобран после main.js", fresh and os.path.getsize(p) > 50000,
          "mtime %s, %d байт" % ("свежий" if fresh else "устарел", os.path.getsize(p)))

# подстановки пишут в документы настоящие числа из .vault-stats.json; незаменённый токен
# означает, что в генераторе документации опечатались в ключе. Проверяем только папки,
# которые генерирует write_docs.py/write_captions.py: в dev/README токены поименованы нарочно
import re as _re0
leftover = []
for folder in ("00 - Start Here", "35 - Abstracts", "40 - Templates", "50 - Dashboard"):
    base = os.path.join(VAULT, folder)
    for root_, _, names in os.walk(base):
        for x in names:
            if not x.endswith(".md"):
                continue
            txt = open(os.path.join(root_, x), encoding="utf-8").read()
            for m in _re0.findall(r"__[A-Z][A-Z_]*__", txt):
                leftover.append("%s: %s" % (os.path.relpath(os.path.join(root_, x), VAULT), m))
check("в документации не осталось неподставленных подстановок", not leftover, str(leftover[:3]))

print("== этап 2: ключевые фразы ==")
import re as _re


def read_all(folder, ext=".md"):
    out = {}
    for root_, _, names in os.walk(os.path.join(VAULT, folder)):
        for x in names:
            if x.endswith(ext):
                pth = os.path.join(root_, x)
                out[os.path.relpath(pth, VAULT).replace(os.sep, "/")] = open(pth, encoding="utf-8").read()
    return out


# README папки — не аннотация: в его тексте «type: abstract» встречается как пример формата,
# поэтому корпус считаем по именам, которые гарантирует генератор (см. dev/write_abstracts.py).
abs_notes = {k: v for k, v in read_all("35 - Abstracts").items() if k.endswith(" — abstract.md")}
check("корпус: аннотация на каждую секцию курса", len(abs_notes) == stats["sections"],
      "аннотаций %d, секций %d (README папки не считается)" % (len(abs_notes), stats["sections"]))
blocks = read_all("30 - Blocks")
kw_notes = {k: v for k, v in blocks.items() if _re.search(r"(?m)^keywords_en:", v)}
check("список фраз есть у заметной части блоков", len(kw_notes) >= stats["blocks"] // 6,
      "блоков со списком: %d из %d" % (len(kw_notes), stats["blocks"]))
noref = [k for k, v in kw_notes.items() if "<!-- keywords:begin -->" not in v or "<!-- keywords:end -->" not in v]
check("у блока с фразами есть материализованный регион", not noref, str(noref[:2]))
untouched = [k for k, v in blocks.items() if "keywords_en:" not in v and "keywords:begin" in v]
check("регион не остался у блока без списка фраз", not untouched, str(untouched[:2]))
plain = [k for k, v in blocks.items() if "keywords_en:" not in v and "keywords:begin" not in v]
check("блоки без фраз не тронуты алгоритмом", len(plain) >= stats["blocks"] // 4, "чистых блоков: %d" % len(plain))
# вес в заметке обязан равняться числу вхождений, которое видит ядро, иначе цифры в UI расходятся
stale_w = []
for k, v in kw_notes.items():
    m = _re.search(r"(?m)^weight:\s*(\d+)", v)
    if not m:
        stale_w.append(k + " (нет weight:)")
        continue
    reg = v[v.index("<!-- keywords:begin -->"):v.index("<!-- keywords:end -->")]
    # ровно то же правило, что читает ядро: «×N» в псевдониме = вес ребра, без × — 1
    s_ = 0
    for _t, _alias in _re.findall(r"\[\[([^\]\n|]+)\|([^\]\n]*)\]\]", reg):
        _m2 = _re.search(r"\u00d7(\d+)\s*$", _alias)
        s_ += int(_m2.group(1)) if _m2 else 1
    if int(m.group(1)) != s_:
        stale_w.append("%s: weight %s против %d по ссылкам" % (k, m.group(1), s_))
check("weight: в заметке = сумме весов материализованных ссылок", not stale_w, str(stale_w[:2]))
main_js = open(os.path.join(PLUGIN, "main.js"), encoding="utf-8").read()
check("в сборке есть команда пересчёта фраз", "recompute-keywords" in main_js and "Recompute keyword links" in main_js)
check("в сборке есть тумблер счёта по фразам", "keywordLinks" in main_js and "Считать рёбра по ключевым фразам" in main_js)
check("35 - Abstracts исключена из обхода графа", "35 - Abstracts" in cfg.get("excludeFolders", ""), cfg.get("excludeFolders", "")[:60])
conv = open(os.path.join(VAULT, "00 - Start Here", "01 Conventions — правила разметки.md"), encoding="utf-8").read()
check("§7 описывает реализацию, а не намерения",
      "реализация впереди" not in conv and "keywords:begin" in conv and "keywords_en" in conv)
tpl = open(os.path.join(VAULT, "40 - Templates", "T Block.md"), encoding="utf-8").read()
# упоминуть parent:/chapter: в пояснении шаблон вправе — их не должно быть СВОЙСТВАМИ
prompts = _re.findall(r"(?m)^(parent|chapter):", tpl)
check("новый блок создаётся пустым: две строки подписи + keywords_en, без parent:/chapter:",
      not prompts and "keywords_en" in tpl and "type: block" in tpl,
      "в свойствах шаблона есть %s" % prompts if prompts else "")
r = subprocess.run(["node", "apply_keywords.js", "--check"], cwd=DEV, capture_output=True, text=True)
check("ссылки по ключевым фразам свежие (apply_keywords --check)", r.returncode == 0,
      (r.stdout or r.stderr).strip().split("\n")[-1][:150])

print("== проверки целостности ==")
for script, name in (("validate_links.py", "ссылки (по имени файла, без алиасов)"),
                     ("audit_vault.py", "аудит хранилища глазами Obsidian"),
                     ("test-core.js", "тесты ядра"),
                     ("test-view.js", "e2e плагина")):
    exe = ["python3", script] if script.endswith(".py") else ["node", script]
    r = subprocess.run(exe, cwd=DEV, capture_output=True, text=True)
    tail = (r.stdout or r.stderr).strip().split("\n")[-1] if (r.stdout or r.stderr).strip() else ""
    check(name, r.returncode == 0, tail[:160])

print("== архив ==")
# архив кладём РЯДОМ с хранилищем (не внутрь): когда инструментарий лежит в самом
# хранилище, HOME — это оно и есть, и zip пытался бы упаковать несуществующий путь
OUT_DIR = os.path.dirname(os.path.abspath(VAULT))
zip_path = os.path.join(OUT_DIR, "Lecture-Graph-Vault.zip")
if os.path.exists(zip_path):
    os.remove(zip_path)
# .git и node_modules — служебные (они же перечислены в userIgnoreFilters Obsidian),
# в архив-артефакт они не едут: это не содержимое хранилища
name = os.path.basename(VAULT)
r = subprocess.run(["zip", "-qr9", zip_path, name,
                    "-x", name + "/.git/*", "-x", name + "/*/node_modules/*"],
                   cwd=OUT_DIR, capture_output=True, text=True)
check("zip собран", r.returncode == 0, r.stderr.strip()[:200])
r = subprocess.run(["unzip", "-t", zip_path], capture_output=True, text=True)
check("zip цел (unzip -t)", r.returncode == 0 and "No errors detected" in r.stdout)
n = int(subprocess.run(["unzip", "-Z1", zip_path], capture_output=True, text=True).stdout.count("\n"))
print("  %s: %.1f MiB, %d файлов" % (os.path.basename(zip_path), os.path.getsize(zip_path) / 1048576, n))

print(("ВСЁ ЧИСТО" if not fails else "ЕСТЬ ПРОБЛЕМЫ: " + "; ".join(fails)))
sys.exit(1 if fails else 0)
