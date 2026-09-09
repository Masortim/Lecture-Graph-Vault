#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Конфиг .obsidian, сниппеты, шаблоны Templater, дашборды Dataview и документация."""
import os
import json

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "Lecture-Graph-Vault"))
OBS = os.path.join(ROOT, ".obsidian")


def write(rel, text):
    full = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as fh:
        fh.write(text if text.endswith("\n") else text + "\n")
    print("  wrote", rel)


def jwrite(rel, obj):
    write(rel, json.dumps(obj, ensure_ascii=False, indent=2))


def rgb(h):
    h = h.lstrip("#")
    return int(h, 16)


# ---------------------------------------------------------------- .obsidian
jwrite(".obsidian/app.json", {
    "alwaysUpdateLinks": True,
    "newLinkFormat": "shortest",
    "useMarkdownLinks": False,
    "attachmentFolderPath": "99 - Attachments",
    "promptDelete": True,
    "strictLineBreaks": False,
    "readableLineLength": False,
    "defaultViewMode": "preview",
    "livePreview": True,
    "propertiesInDocument": "visible",
    "showUnsupportedFiles": False,
    "userIgnoreFilters": ["node_modules/", ".git/"],
    "trashUploads": False,
})

jwrite(".obsidian/appearance.json", {
    "theme": "obsidian",
    "cssTheme": "",
    "enabledCssSnippets": ["lecture-nodes"],
    "accentColor": "#4a9eda",
    "baseFontSize": 16,
    "interfaceFontFamily": "",
    "textFontFamily": "Segoe UI, Noto Sans, PingFang SC",
    "monospaceFontFamily": "JetBrains Mono, Consolas",
})

jwrite(".obsidian/core-plugins.json", [
    "file-explorer", "global-search", "switcher", "graph", "backlink", "outgoing-link",
    "tag-pane", "page-preview", "properties", "note-composer", "command-palette",
    "editor-status", "bookmarks", "outline", "word-count", "file-recovery",
])

jwrite(".obsidian/types.json", {
    "types": {
        "type": "text",
        "id": "text",
        "name": "text",
        "name_zh": "text",
        "status": "text",
        "parent": "text",
        "chapter": "text",
        "keywords_en": "text",
        "weight": "number",
        "refs": "number",
        "size": "text",
        "color": "text",
        "caption": "text",
        "node": "text",
        "level": "text",
        "aliases": "aliases",
        "cssclasses": "cssclasses",
        "kind": "text",
        "num": "text",
        "tags": "tags",
    }
})

jwrite(".obsidian/community-plugins.json", [
    "templater-obsidian",
    "dataview",
    "obsidian-excalidraw-plugin",
    "dark-pdf-export",
    "lecture-graph",
])

CHAPTER_PALETTE = ["#f2b33d", "#4a9eda", "#59c98a", "#c07ad8", "#ff7a6b",
                   "#5fd3c4", "#f58fc2", "#b9cf5e", "#9a8cff", "#f2c14e"]
CHAPTER_IDS = ["Ch%02d" % i for i in range(1, 10)]
CHAPTER_COLORS = CHAPTER_PALETTE

jwrite(".obsidian/graph.json", {
    "showTags": False,
    "showAttachments": False,
    "hideUnresolved": True,
    "showOrphans": False,
    "collapse-color-groups": False,
    # первой идёт группа главы: встроенный граф красит главу, её секции, заголовки и
    # блоки одним цветом (тот же порядок и та же палитра, что в плагине: chapterPalette
    # по отсортированным id). Группы по типам остаются как «остальные».
    "colorGroups": [
        {"template": {"query": 'path:"' + _id + '"', "color": {"a": 1, "rgb": rgb(_c)}}, "display": {"color": _c}}
        for _id, _c in zip(CHAPTER_IDS, CHAPTER_COLORS[: len(CHAPTER_IDS)])
    ] + [
        {"template": {"query": 'path:"10 - Chapters"', "color": {"a": 1, "rgb": rgb("#f2b33d")}}, "display": {"color": "#f2b33d"}},
        {"template": {"query": 'path:"20 - Sections"', "color": {"a": 1, "rgb": rgb("#4a9eda")}}, "display": {"color": "#4a9eda"}},
        {"template": {"query": 'path:"25 - Headings"', "color": {"a": 1, "rgb": rgb("#59c98a")}}, "display": {"color": "#59c98a"}},
        {"template": {"query": 'path:"30 - Blocks"', "color": {"a": 1, "rgb": rgb("#c07ad8")}}, "display": {"color": "#c07ad8"}},
    ],
    "collapse-display": False,
    "showArrow": True,
    "textFadeMultiplier": 0,
    "nodeSizeMultiplier": 1.25,
    "lineSizeMultiplier": 1,
    "collapse-forces": False,
    "centerStrength": 0.4,
    "repelStrength": 12,
    "linkStrength": 1,
    "linkDistance": 220,
    "scale": 0.55,
    # папка дашбордов (в т.ч. оглавление) во встроенном графе не участвует
    # -tag:#index держит вне графа заметку оглавления в ЛЮБОЙ папке: создать её можно
    # правым кликом в проводнике, а ссылки на все разделы в графе плодить не должны
    # 45 - Captions (заметки сообщений) и 35 - Abstracts (корпус для ключевых фраз) —
    # служебные папки, вершинами графа они быть не должны
    "search": ('-tag:#template -tag:#index -path:"40 - Templates" -path:"45 - Captions" '
               '-path:"50 - Dashboard" -path:"00 - Start Here" -path:"35 - Abstracts" '
               '-path:"90 - Exports" -path:"60 - Drawings"'),
})

# только реально существующие ключи settings Templater (проверено по main.js 2.25.0)
jwrite(".obsidian/plugins/templater-obsidian/data.json", {
    "templates_folder": "40 - Templates",
    "trigger_on_file_creation": False,
    "auto_jump_to_cursor": True,
    "enable_system_commands": False,
    "shell_path": "",
    "user_scripts_folder": "",
    "enable_folder_templates": False,
    "folder_templates": [],
    "file_templates": [],
    "syntax_highlighting": True,
    "enabled_templates_hotkeys": [],
    "startup_templates": [],
})

# у Excalidraw 2.27 реальный ключ папки — folder (default "Excalidraw")
jwrite(".obsidian/plugins/obsidian-excalidraw-plugin/data.json", {
    "folder": "60 - Drawings",
})

jwrite(".obsidian/plugins/dark-pdf-export/data.json", {
    "enabled": True,
    "pageMargin": "14mm 16mm",
})

jwrite(".obsidian/plugins/lecture-graph/data.json", {
    "folders": "10 - Chapters,20 - Sections,25 - Headings,30 - Blocks",
    "excludeFolders": "40 - Templates,45 - Captions,50 - Dashboard,00 - Start Here,35 - Abstracts,60 - Drawings,90 - Exports,90 - Dev,99 - Attachments",
    "nameKey": "name",
    "nameZhKey": "name_zh",
    "typeKey": "type",
    "minRadius": 6,
    "maxRadius": 34,
    "degreeGamma": 0.55,
    "degreeBase": "min",
    "sizeMode": "hybrid",
    "labelFontSize": 10,
    "labelFontMin": 9,
    "labelFontMax": 19,
    "labelFontBySize": True,
    "countStructural": False,
    "includeInlineAnchors": False,
    # оглавление курса — в корне хранилища: вне папок сканирования, поэтому в граф не попадает
    "indexNote": "Course Index.md",
    "indexGraphDoc": "02 Graph \u2014 как читать и править",
    "labelCharsFor": {"chapter": 30, "section": 24, "heading": 12, "block": 12},
    # ширина подписи в пикселах на базовом кегле: у глав кольцо свободное, им - длинные
    # названия целиком; заголовкам и блокам - короткие (иначе граф раздувается впустую)
    "labelWidthFor": {"chapter": 520, "section": 380, "heading": 190, "block": 170},
    "labelMode": "size",
    "labelRadiusThreshold": 11,  # подписи заголовков не должны пропадать из-за веса по ключевым фразам
    "autoRefresh": True,
    "maxNodes": 4000,
    "exportFolder": "90 - Exports",
    "colors": {"chapter": "#f2b33d", "section": "#4a9eda", "heading": "#59c98a", "block": "#c07ad8"},
    # размеры: у глав/секций есть «пол», чтобы они не превращались в точку без подписи
    "sizeFloor": {"chapter": 16, "section": 13, "heading": 10},
    "labelAlwaysFor": {"chapter": True, "section": True},
    # размер и цвет вершины правятся свойствами заметки: size: / color: / caption: / keywords_en:
    "sizeKey": "size", "colorKey": "color", "captionKey": "caption",
    # этап 2: связи (и размер) по ключевым фразам; корпус — аннотации, они вне графа
    "keywordLinks": True, "keywordFolder": "35 - Abstracts", "weightKey": "weight",
    # цвет по главам: секции/заголовки/блоки наследуют цвет своей главы
    "chapterColors": True,
    "chapterPalette": ["#f2b33d", "#4a9eda", "#59c98a", "#c07ad8", "#ff7a6b",
                       "#5fd3c4", "#f58fc2", "#b9cf5e", "#9a8cff", "#f2c14e"],
    "curvature": 0.24,  # рёбра — дуги; 0 вернёт прямые линии
    # значения размеров/раскладки совпадают с DEFAULTS в graph-core.js (иначе хрупкие узлы слипаются)
    # mode: fdp | neato | twopi | clusters | force  (раскладка по уровням «radial» убрана)
    "layout": {
        "mode": "fdp", "linkDistance": 88, "repel": 2700, "gravity": 0.014,
        "friction": 0.82, "collide": True, "radius": 1300, "radialStrength": 0.05,
        "anchorStrength": 0.34, "packLabels": True, "packPasses": 70,
        "clusterBands": {"chapter": [0.2, 0.3], "section": [0.38, 0.6],
                         "heading": [0.8, 1.0], "block": [1.06, 1.26]},
        "clusterPad": 10, "clusterGap": 0.07, "clusterFill": 0.94,
        "autoTune": True, "iterations": 700, "polish": 26,
        # --- движки раскладки ---
        "fdpIters": 260, "frK": 1, "frRepel": 1, "frAttract": 1, "frStruct": 1.9,
        "frTemp": 0.55, "neatoIters": 80, "neatoScale": 2.2, "neatoRepel": 1.6,
        "twopiRoot": "", "twopiRankSep": 1,
        "clusterPull": 0.035, "postLabels": True, "postCircles": True,
        "dispCap": 0.5, "polishPasses": 0, "polishGrow": 6, "spreadMax": 12,
    },
    "filters": {
        "types": {"chapter": True, "section": True, "heading": True, "block": True},
        "minDegree": 0, "chapter": "", "hidePlaceholders": False,
    },
})

# ---------------------------------------------------------------- CSS
write(".obsidian/snippets/lecture-nodes.css", """/* lecture-nodes: оформление заметок-узлов графа лекций и оглавления курса.
   Никаких правок рендера формул — только отступы, фон карточек, цвет свойств и «гиды» списков. */
.lg-node .inline-title { letter-spacing: -0.01em; }

.lg-node--chapter { --lg-accent: #f2b33d; }
.lg-node--section { --lg-accent: #4a9eda; }
.lg-node--heading { --lg-accent: #59c98a; }
.lg-node--block   { --lg-accent: #c07ad8; }

/* тонкая полоса слева по типу узла */
.markdown-source-view.mod-cm6.lg-node .cm-contentContainer,
.markdown-preview-view.lg-node .markdown-preview-sizer {
  border-left: 3px solid var(--lg-accent, transparent);
  padding-left: 10px;
}

/* свойство name / name_zh читаем сверху заметки */
.lg-node .metadata-container { background: var(--background-secondary); border-radius: 8px; padding: 6px 10px; }
.lg-node .metadata-property-key[data-property-key="name"] .metadata-property-key-input,
.lg-node .metadata-property-key[data-property-key="name_zh"] .metadata-property-key-input { font-weight: 600; }
.lg-node .metadata-property-key[data-property-key="name_zh"] { color: #7fb2ff; }

/* ссылки на блоки внутри текстов секций: чуть крупнее и с подчёркиванием */
.markdown-rendered a[data-href*=" - "], .cm-hmd-internal-link { text-decoration: none; border-bottom: 1px dotted currentColor; }

/* формулы не должны обрезаться в узких колонках */
.markdown-rendered .math.math-block .MathJaxed-element { overflow-x: auto; max-width: 100%; }

/* ── Course Index: иерархическое оглавление (cssclasses: lg-index) ─────────────── */
.lg-index .inline-title { letter-spacing: -0.02em; }
.lg-index h2 { margin-top: 2em; padding-top: .45em; border-top: 1px solid var(--background-modifier-border); }
.lg-index h2::before { content: "§ "; color: var(--text-faint); }
.lg-index h3 { margin-top: 1.35em; font-size: 1.03em; }
.lg-index h3::before { content: "▸ "; color: var(--text-faint); }
/* ── Course Index: цветные вертикальные полоски слева по уровням ─────────────────────
   Каждый уровень дерева — сворачиваемый callout своего цвета; палитра та же, что у
   вершин графа («Цвета по типам» в настройках) и что у чипов типов в панели плагина. */
.lg-index .callout[data-callout="chapter"] { --lg-bar: 242, 179, 61; }
.lg-index .callout[data-callout="section"] { --lg-bar: 74, 158, 218; }
.lg-index .callout[data-callout="heading"] { --lg-bar: 89, 201, 138; }
.lg-index .callout[data-callout="block"] { --lg-bar: 192, 122, 216; }
.lg-index .callout:is([data-callout="chapter"], [data-callout="section"], [data-callout="heading"], [data-callout="block"]) {
  border: 0; border-left: 4px solid rgb(var(--lg-bar)); border-radius: 0 7px 7px 0;
  background: rgba(var(--lg-bar), .06); box-shadow: none;
  margin-block: .3em; margin-inline-start: .5em; padding: .28em .7em;
}
.lg-index .callout:is([data-callout="chapter"], [data-callout="section"], [data-callout="heading"], [data-callout="block"]) > .callout-title { gap: .45em; font-weight: 600; font-size: .97em; }
.lg-index .callout:is([data-callout="chapter"], [data-callout="section"], [data-callout="heading"], [data-callout="block"]) .callout-content { margin: .1em 0 .2em; }
/* цитаты-обёртки не должны добавлять свои серые полосы: полоска одна, и она цветная */
.lg-index blockquote { border-left: 0; padding-left: 0; background: none; }
/* второй «гид» внутри группы блоков не нужен — за уровень отвечает цветная полоска */
.lg-index .callout[data-callout="block"] ul { border-left: 0; padding-inline-start: .9em; }

/* списки без маркеров, с вертикальными «гид»ами: иерархия читается как в проводнике */
.lg-index ul { list-style: none; padding-inline-start: 1.05em; margin-block: .15em .5em;
  border-left: 1px solid var(--background-modifier-border); }
.lg-index ul ul { border-left-style: dotted; }
.lg-index li { margin: .1em 0; line-height: 1.42; }
.lg-index li > p { margin: 0; }
.lg-index ul ul li { font-size: .95em; color: var(--text-muted); }
.lg-index ul ul li a { color: var(--text-normal); }
/* значки `⇠ N`, `∑`, `◌` — аккуратными чипами */
.lg-index :is(li, h2 + p, h3 + p, .callout-title) code { background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border); border-radius: 999px;
  padding: 0 .45em; font-size: .8em; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.lg-index table { font-variant-numeric: tabular-nums; font-size: .95em; }
.lg-index table th, .lg-index table td { padding: 3px 8px; }
.lg-index h2 + p, .lg-index h3 + p { color: var(--text-muted); margin-block: .2em .4em; }
@media print {
  /* цвет полосок — часть смысла оглавления, в PDF он обязан сохраниться */
  .lg-index .callout:is([data-callout="chapter"], [data-callout="section"], [data-callout="heading"], [data-callout="block"]) {
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    background: none; margin-inline-start: 0;
  }
  .lg-index ul { border-left: none; }
  .lg-index h2 { break-after: avoid; }
  .lg-index h3 { break-after: avoid; }
}
""")

# Стили плагина — единый источник: dev/src/styles.css, их копирует build.js.
# Здесь их быть не должно: иначе запуск write_config.py после сборки затрёт актуальные правила.

print("конфиги и CSS готовы")
