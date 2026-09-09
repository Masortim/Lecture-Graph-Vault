# -*- coding: utf-8 -*-
"""Корпус для ключевых фраз (этап 2) — заметки в 35 - Abstracts.

Одна заметка = одна секция курса: заголовок заметки = имя вершины-секции, дальше `## <имя
вершины-заголовка>` и текст под ним. По этому корпусу алгоритм ищет фразы из свойства
`keywords_en:` блока: вхождение ВНУТРИ региона заголовка даёт ребро к вершине-заголовку,
вхождение в тексте ДО первого `##` — ребро к вершине-секции; вес = суммарное число вхождений.

Детерминированность важна: файл перезаписывается байт-в-байт (проверяется `node
apply_keywords.js --check` и finalize.py), а числа вхождений — единственный источник весов.
"""
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "Lecture-Graph-Vault"))
ABS_FOLDER = "35 - Abstracts"
F_SEC, F_HEAD, F_BLOCK = "20 - Sections", "25 - Headings", "30 - Blocks"

# ------------------------------------------------------------------ чтение курса
def rd(rel):
    with io.open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def fm_of(text):
    """Только те поля, что нужны здесь: плоские `key: value` из frontmatter."""
    m = re.match(r"^---\s*\n(.*?)\n---", text, re.S)
    out = {}
    if not m:
        return out
    for line in m.group(1).split("\n"):
        kv = re.match(r"^([A-Za-z_][\w-]*):\s*(.*?)\s*$", line)
        if kv:
            out[kv.group(1)] = kv.group(2).strip().strip('"')
    return out


def list_md(folder):
    d = os.path.join(ROOT, folder)
    if not os.path.isdir(d):
        return []
    out = []
    for sub in sorted(os.listdir(d)):
        p = os.path.join(d, sub)
        if os.path.isdir(p):
            out += [os.path.join(folder, sub, f) for f in sorted(os.listdir(p)) if f.endswith(".md")]
    return out


sections = {}   # id -> {id, name, file, rel, chapter}
for rel in list_md(F_SEC):
    base = os.path.basename(rel)[:-3]
    txt = rd(rel)
    data = fm_of(txt)
    if data.get("type") != "section" or not data.get("id"):
        continue
    sid = data["id"]
    sections[sid] = {"id": sid, "name": data.get("name", base), "file": base, "rel": rel,
                     "chapter": data.get("chapter") or sid.split("-")[0]}

headings = {}   # id -> {...}
by_section = {}
for rel in list_md(F_HEAD):
    base = os.path.basename(rel)[:-3]
    data = fm_of(rd(rel))
    if data.get("type") != "heading" or not data.get("id"):
        continue
    hid = data["id"]
    parent = data.get("parent")
    headings[hid] = {"id": hid, "name": data.get("name", base), "file": base, "section": parent,
                     "chapter": data.get("chapter") or (parent or "").split("-")[0]}
    by_section.setdefault(parent, []).append(hid)
for sid in by_section:
    by_section[sid].sort()

blocks = []
for rel in list_md(F_BLOCK):
    data = fm_of(rd(rel))
    if data.get("type") != "block":
        continue
    blocks.append({"id": data.get("id") or os.path.basename(rel)[:-3].split(" - ")[0],
                   "rel": rel, "parent": data.get("parent"), "name": data.get("name"),
                   "keywords": data.get("keywords_en") or data.get("keywords") or ""})

print("секций: %d, заголовков: %d, блоков: %d" % (len(sections), len(headings), len(blocks)))
assert len(sections) == 36 and len(headings) == 216, "ожидается полный курс 9×4×6"

# ------------------------------------------------------------------ числа вхождений
def h32(*parts):
    """Стабильный хеш от id (не python-овский hash, чтобы не зависеть от запуска)."""
    x = 2166136261
    for s in "".join(parts).encode("utf-8"):
        x = ((x ^ s) * 16777619) & 0xFFFFFFFF
    return x


def term_of(hid):
    """Термин заголовка — то, что ищут ключевые фразы: имя после «Kind: »."""
    nm = headings[hid]["name"]
    return nm.split(":", 1)[1].strip() if ":" in nm else nm


# таблица: (регион, фраза) -> число вхождений. Регион = ("h", hid) или ("s", sid) — преамбула.
table = {}


def bump(region, phrase, n):
    if n <= 0:
        return
    k = (region, phrase.lower())
    table[k] = table.get(k, 0) + n


ALL_H = sorted(headings)
# Правило корпуса: в регионе заголовка его термин стоит 1–2 раза (аннотация пересказывает
# тему, а не переписывает термины подряд), чужие термины упоминаются редко. Из этого
# автоматически растёт и «доминирующая глава»: своя глава набирает свои 1–2 вхождения плюс
# соседи по главе, чужая — только редкие упоминания, поэтому перекрас редкий, а не массовый.
for i, hid in enumerate(ALL_H):
    bump(("h", hid), term_of(hid), 1 + h32(hid, "own") % 2)
    if i % 6 == 0:                       # редкая ссылка на чужую главу
        other = ALL_H[(i * 7 + 13) % len(ALL_H)]
        if headings[other]["chapter"] != headings[hid]["chapter"]:
            bump(("h", hid), term_of(other), 1)

for sid in sorted(sections):
    # текст ДО первого ## (преамбула) даёт рёбра к вершине секции
    for hid in by_section.get(sid, []):
        if h32(sid, hid, "pre") % 3 == 0:
            bump(("s", sid), term_of(hid), 1)

SENT = [
    "We record the basic properties of {t}.",
    "The notion of {t} is used verbatim in what follows.",
    "Whenever {t} is available, the argument shortens.",
    "Estimates for {t} follow from the definition alone.",
    "The reader who knows {t} may skip the first paragraph.",
    "Only {t} and its linearity are needed here.",
    "A word of caution: {t} is stated for the whole space, not for a subspace.",
    "The proof below never leaves {t}.",
    "Everything reduces to {t} after one integration by parts.",
    "We do not claim anything beyond {t} in this part.",
]

# ------------------------------------------------------------------ корпус
def region_text(phrases, seed):
    """Фразы здесь стоят ровно столько раз, сколько записано в таблице."""
    lines = []
    for i, (phrase, n) in enumerate(sorted(phrases.items())):
        for j in range(n):
            lines.append(SENT[(h32(seed, phrase, str(j)) + i) % len(SENT)].format(t=phrase))
    if not lines:
        lines.append("Nothing beyond the standing notation is needed in this part.")
    out = []
    for i in range(0, len(lines), 2):
        out.append(" ".join(lines[i:i + 2]))
    return "\n\n".join(out) + "\n"


written = 0
for sid in sorted(sections):
    sec = sections[sid]
    rel = os.path.join(ABS_FOLDER, sec["chapter"], sec["id"] + " — abstract.md").replace(os.sep, "/")
    pre, regs = {}, {}
    for (region, phrase), n in table.items():
        if region[0] == "s" and region[1] == sid:
            pre[phrase] = pre.get(phrase, 0) + n
    for hid in by_section.get(sid, []):
        own = {}
        for (region, phrase), n in table.items():
            if region == ("h", hid):
                own[phrase] = n
        regs[hid] = own
    body = ["---", "type: abstract", "section: " + sid, "chapter: " + sec["chapter"],
            "tags: [abstract]", 'cssclasses: ["lg-abstract"]', "---", "",
            "# " + sec["name"], "",
            "Abstract of the section: the paragraphs before the first `##` are credited to the "
            "section itself, everything below a `##` line to the heading of that name.", "",
            region_text(pre, sid + ":pre")]
    for hid in by_section.get(sid, []):
        body.append("\n## " + headings[hid]["name"] + "\n")
        body.append(region_text(regs.get(hid, {}), hid))
    txt = "\n".join(body).rstrip() + "\n"
    txt = re.sub(r"\n{3,}", "\n\n", txt)
    full = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    old = io.open(full, encoding="utf-8").read() if os.path.exists(full) else None
    if old != txt:
        io.open(full, "w", encoding="utf-8").write(txt)
    written += 1
print("заметок корпуса:", written)

# ------------------------------------------------------------------ ключевые фразы блоков
# Свойство дописывается ТОЛЬКО если его ещё нет: правки пользователя не затираются.
# --reset снимает то, что дописал скрипт (и регион, и weight:), чтобы переназначить список
# заново — иначе старые значения остались бы висеть после смены вероятностей.
RESET = "--reset" in sys.argv[1:]
if RESET:
    cleared = 0
    for b in blocks:
        txt = rd(b["rel"])
        new = re.sub(r"(?m)^keywords_en:.*\n", "", txt)
        new = re.sub(r"(?m)^weight:.*\n", "", new)
        new = re.sub(r"\n*<!-- keywords:begin -->[\s\S]*?<!-- keywords:end -->\n*", "\n", new)
        if new != txt:
            io.open(os.path.join(ROOT, b["rel"]), "w", encoding="utf-8").write(new.rstrip() + "\n")
            cleared += 1
        b["keywords"] = ""
    print("--reset: сняты keywords_en:/weight:/регион в %d заметках" % cleared)
    blocks = [dict(b, keywords=fm_of(rd(b["rel"])).get("keywords_en", "")) for b in blocks]

added = skipped = 0
for b in blocks:
    if b["keywords"]:
        skipped += 1
        continue
    hid = b["parent"]
    if hid not in headings:
        continue
    r = h32(b["id"], "kw")
    if r % 100 >= 26:
        skipped += 1                     # ~74% блоков остаются только с ручными ссылками
        continue
    kws = [term_of(hid)]
    if 12 <= r % 100 < 26:               # ~14 из 26: вторая фраза из ДРУГОЙ главы
        other = ALL_H[(r // 7) % len(ALL_H)]
        if headings[other]["chapter"] != headings[hid]["chapter"]:
            kws.append(term_of(other))
    if r % 100 < 4:                       # ~4 из 26: соседний заголовок той же секции
        for h2 in by_section.get(headings[hid]["section"], []):
            if h2 != hid:
                kws.append(term_of(h2))
                break
    kws = [k for k in dict.fromkeys(k.lower() for k in kws)]
    txt = rd(b["rel"])
    if re.search(r"^keywords_en:", txt, re.M):
        skipped += 1
        continue
    new = re.sub(r"(?m)^(name_zh:.*)$", r"\1\nkeywords_en: " + '"' + "; ".join(kws) + '"', txt, count=1)
    assert new != txt, b["rel"]
    io.open(os.path.join(ROOT, b["rel"]), "w", encoding="utf-8").write(new)
    added += 1
print("keywords_en: дописано в %d блоков · уже было или не нужно: %d" % (added, skipped))

terms = sorted({p for (_, p) in table})
print("фраза в корпусе: %d уникальных, всего вхождений %d" % (len(terms), sum(table.values())))
print("корпус готов:", ABS_FOLDER, "(в граф не входит — папка исключена в data.json)")
