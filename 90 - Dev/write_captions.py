#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Служебные папки раунда 15.

1) 40 - Templates/T Caption Chapter.md и T Caption Section.md — шаблоны информационного
   сообщения (редактируемые, с плейсхолдерами Templater).
2) 45 - Captions/<id> — caption.md — сами заметки сообщений для 9 глав и 36 секций.
   В граф они не попадают (папка исключена и в настройках плагина, и во встроенном графе),
   а вершина ссылается на них свойством `caption:`.
3) 35 - Abstracts/ — корпус для ключевых фраз (этап 2) и его README.

manifest dev/captions.json — какой id какой заметкой сопровождается; по нему
apply_captions.js прописывает caption: в frontmatter заметок-вершин. Идемпотентно:
готовый текст сообщения перезаписывается, только если в нём остался наш маркер.
"""
import io
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "Lecture-Graph-Vault")
CAP_FOLDER = "45 - Captions"
ABS_FOLDER = "35 - Abstracts"
MARK = "%% lecture-graph: заготовка сообщения — замените этот абзац своим текстом %%"
PAL = ["#f2b33d", "#4a9eda", "#59c98a", "#c07ad8", "#ff7a6b",
       "#5fd3c4", "#f58fc2", "#b9cf5e", "#9a8cff", "#f2c14e"]
NL = chr(10)


def rd(rel):
    p = os.path.join(ROOT, *rel.split("/"))
    return io.open(p, encoding="utf-8").read() if os.path.exists(p) else None


def wr(rel, text):
    p = os.path.join(ROOT, *rel.split("/"))
    d = os.path.dirname(p)
    if not os.path.isdir(d):
        os.makedirs(d)
    io.open(p, "w", encoding="utf-8", newline=NL).write(text)


def fm(text):
    """Плоский frontmatter -> dict (вложенные списки здесь не нужны)."""
    m = re.match(r"^---" + NL + r"(.*?)" + NL + r"---", text or "", re.S)
    out = {}
    if not m:
        return out
    for line in m.group(1).split(NL):
        k = re.match(r"^([A-Za-z_][\w\-]*):\s*(.*)$", line)
        if k:
            out[k.group(1)] = k.group(2).strip().strip('"')
    return out


# ------------------------------------------------------------- что есть в хранилище
chapters, sections, counts = {}, {}, {}
for dirpath, _dirs, files in os.walk(ROOT):
    rel = os.path.relpath(dirpath, ROOT).replace(os.sep, "/")
    for fn in files:
        if not fn.endswith(".md"):
            continue
        path = fn if rel == "." else rel + "/" + fn
        data = fm(rd(path))
        t = data.get("type")
        if t in ("chapter", "section") and data.get("id"):
            rec = {"name": data.get("name", fn[:-3]), "name_zh": data.get("name_zh", ""),
                   "parent": data.get("parent", ""), "path": path}
            (chapters if t == "chapter" else sections)[data["id"]] = rec
    m = re.match(r"^(25 - Headings|30 - Blocks)/(Ch[0-9]+)$", rel)
    if m:
        key = "headings" if m.group(1).endswith("Headings") else "blocks"
        counts.setdefault(m.group(2), {})[key] = len([f for f in files if f.endswith(".md")])
for cid in chapters:
    counts.setdefault(cid, {})
    counts[cid]["sections"] = len([1 for k in sections if sections[k].get("parent") == cid])

# ------------------------------------------------------------- шаблоны сообщений
TPL_CHAPTER = NL.join([
    "---", "type: template", "tags: [template]", 'cssclasses: ["lg-caption"]', "---", "",
    "# Сообщение для главы (шаблон)", "",
    "Плагин показывает этот текст «пузырьком» рядом с вершиной главы на графе: ЛКМ по вершине —",
    "сообщение появилось, второй клик по той же — скрылось. Правится прямо здесь, как текстовый",
    "прямоугольник на слайде: одна-две фразы, без таблиц и свойств.", "",
    "## Заполняемые поля", "",
    "- Глава: {{title}} · {{title_zh}}",
    "- Зачем она нужна: *что читатель уносит из главы* —",
    "- Когда возвращаться: *например, перед разбором полноты* —",
    "- Не трогать: {{id}} (по нему вершина находит это сообщение)", "",
    "Ниже — тело сообщения. 1–3 предложения, формула уместна:",
    "$d(x,y)=\\\\lVert x-y\\\\rVert$ .", "",
    "{{body}}", "",
])

TPL_SECTION = NL.join([
    "---", "type: template", "tags: [template]", 'cssclasses: ["lg-caption"]', "---", "",
    "# Сообщение для секции (шаблон)", "",
    "Тот же механизм, что у глав, только вершина — секция.", "",
    "## Заполняемые поля", "",
    "- Секция: {{title}} · {{title_zh}}",
    "- Глава: {{id}}",
    "- Что здесь нового: *чем секция отличается от соседних* —",
    "- На что опирается: *что прочитать раньше* —", "",
    "Тело сообщения: 1–2 предложения, можно сослаться на блок вида",
    "`[[Ch01-S01-H01 - Definition Vector Space|Definition: Vector Space]]`.", "",
    "{{body}}", "",
])
TPL_HEADING = NL.join([
    "---", "type: template", "tags: [template]", 'cssclasses: ["lg-caption"]', "---", "",
    "# Сообщение для заголовка (шаблон)", "",
    "Тот же механизм, что у глав и секций, только вершина — заголовок раздела.", "",
    "## Заполняемые поля", "",
    "- Заголовок: {{title}} · {{title_zh}}",
    "- Раздел: {{id}}",
    "- Что здесь вводится: *термин, формула, свойство* —",
    "- Где пригодится: *в каких дальше главах это используется* —", "",
    "Тело сообщения: одно-два предложения, можно сослаться на блок:",
    "`[[Ch01-S01-H01-B01 - Block Definition|Definition]]`.", "",
    "{{body}}", "",
])

TPL_BLOCK = NL.join([
    "---", "type: template", "tags: [template]", 'cssclasses: ["lg-caption"]', "---", "",
    "# Сообщение для блока (шаблон)", "",
    "Блок — это фрагмент текста, на который ссылаются. Сообщение объясняет, зачем он в курсе;", "",
    "сам текст блока правится в заметке блока, а не здесь.", "",
    "## Заполняемые поля", "",
    "- Блок: {{title}} · {{title_zh}}",
    "- Раздел: {{id}}",
    "- Зачем нужен: *что он доказывает или где повторяется* —",
    "- Опора: *что нужно прочитать раньше* —", "",
    "{{body}}", "",
])
wr("40 - Templates/T Caption Chapter.md", TPL_CHAPTER)
wr("40 - Templates/T Caption Section.md", TPL_SECTION)
wr("40 - Templates/T Caption Heading.md", TPL_HEADING)
wr("40 - Templates/T Caption Block.md", TPL_BLOCK)

# ------------------------------------------------------------- заметки сообщений
def cap_name(node_id):
    return node_id + " — caption"


manifest = []
for cid in sorted(chapters):
    c = chapters[cid]
    n = counts.get(cid, {})
    body = NL.join([
        "**" + c["name"] + "** — " + c["name_zh"],
        "",
        "Глава курса: {sec} секции, {head} заголовка, {blk} ссылаемых блоков. Смысл один — его и".format(
            sec=n.get("sections", 0), head=n.get("headings", 0), blk=n.get("blocks", 0)),
        "помнят; остальное открывается кликом по вершине.",
        "",
        MARK,
        "",
    ])
    col = PAL[(int(cid[2:]) - 1) % len(PAL)]
    text = NL.join(["---", "type: caption", "node: " + cid, "level: chapter", "color: " + col,
                    'cssclasses: ["lg-caption"]', "---", ""]) + NL + body
    path = CAP_FOLDER + "/" + cap_name(cid) + ".md"
    cur = rd(path)
    if cur is None or MARK in cur:
        wr(path, text)
    manifest.append({"id": cid, "path": c["path"], "caption": cap_name(cid), "level": "chapter"})

for sid in sorted(sections):
    sec = sections[sid]
    body = NL.join([
        "**" + sec["name"] + "** — " + sec["name_zh"],
        "",
        "Секция главы " + (sec["parent"] or "—") + ". Читать после тех разделов, на которые она",
        "ссылается: её блоки — то, на что потом опираются тексты курса.",
        "",
        MARK,
        "",
    ])
    text = NL.join(["---", "type: caption", "node: " + sid, "level: section", "---", ""]) + NL + body
    path = CAP_FOLDER + "/" + cap_name(sid) + ".md"
    cur = rd(path)
    if cur is None or MARK in cur:
        wr(path, text)
    manifest.append({"id": sid, "path": sec["path"], "caption": cap_name(sid), "level": "section"})

io.open(os.path.join(HERE, "captions.json"), "w", encoding="utf-8", newline=NL).write(
    json.dumps(manifest, ensure_ascii=False, indent=1) + NL)

# ------------------------------------------------------------- корпус (этап 2)
ABS_README = NL.join([
    "---", "type: doc", "tags: [doc]", "---", "",
    "# 35 - Abstracts — корпус для ключевых фраз", "",
    "Здесь обычные заметки: одна аннотация = одна секция курса. Строка `# …` — имя вершины-секции,"
    " дальше текст, затем `## название заголовка` и текст под ним, и так до конца. Вершинами графа они"
    " не считаются (папка исключена в настройках плагина и во встроенном графе), но по ним считаются"
    " связи и вес блоков.", "",
    "Как это работает:", "",
    "1. У блока в свойствах перечисляются ключевые фразы через `;` — `keywords_en: \"duality gap; compact operator\"` (ключ `keywords:` принимается как алиас).",
    "2. Каждая фраза ищется во всех заметках папки: точное совпадение целыми словами, регистр и лишние пробелы не важны.",
    "3. Фраза в тексте до первого `##` → ребро к вершине секции; фраза внутри региона `## …` → ребро к вершине этого заголовка. Строка `## Имя` вхождением не считается.",
    "4. Вес вершины = суммарное число вхождений (не число заметок); для блоков с фразами он задаёт и размер вершины.",
    "5. Цвет блока — цвет главы, собравшей больше всего вхождений (при равенстве остаётся своя глава, `color:` перебивает оба правила).",
    "6. Ссылки алгоритм материализует в конец заметки блока, между маркерами `<!-- keywords:begin -->` и `<!-- keywords:end -->`; число после `×` в псевдониме = вес ребра, его и читает ядро.",
    "",
    "Ссылки между самими блоками остаются ручными, как и были: `[[…]]` и `^якоря` в тексте.",
    "",
    "Считать: `Ctrl+P → Lecture Graph: Recompute keyword links` (или `node dev/apply_keywords.js`,"
    " сборка корпуса — `python3 dev/write_abstracts.py`). Правила целиком — §7 заметки"
    " `00 - Start Here/01 Conventions — правила разметки.md`.",
    "",
    "Хотите свой корпус: заведите заметку с `type: abstract`, `section: Ch07-S02` и регионами `## …`"
    " — имена регионов обязаны совпадать с `name:` вершин-заголовков (несовпадение плагин показывает"
    " в уведомлении, а не молчит).",
    "",
])
abs_path = ABS_FOLDER + "/00 - как считать ключевые фразы.md"
if rd(abs_path) != ABS_README:
    wr(abs_path, ABS_README)

print("caption: глав {c}, секций {s} → заметок сообщения {n}".format(
    c=len(chapters), s=len(sections), n=len(manifest)))
print("шаблоны: T Caption {Chapter,Section,Heading,Block}.md; корпус:", ABS_FOLDER)
