#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Строгая проверка ссылок хранилища — так, как их разрешает Obsidian БЕЗ алиасов.

Смысл: ссылка `[[Ch01-S03-H06-B03]]` выглядит живой только потому, что у заметки есть
`aliases: ["Ch01-S03-H06-B03"]` и Obsidian распознаёт это свойство. Стоит типе свойства
съехать, заметке быть переименованной или индексу перестроиться — и половина графа станет
«Заметка не существует». Поэтому проверка разделяет:
  * resolved  — по пути или имени файла (это надёжно);
  * alias-only — только по aliases (это хрупко: считаем ошибкой, если не передан --allow-alias);
  * broken    — не резолвится никак.
Дополнительно проверяются заголовки `[[файл#Заголовок]]`, якоря `[[файл#^id]]` и свойства
в .obsidian/types.json.
"""
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "Lecture-Graph-Vault"))
WIKI = re.compile(r"(!?)\[\[([^\[\]\n]+)\]\]")
FENCE = re.compile(r"^```[\s\S]*?^```[ \t]*$", re.M)
INLINE_CODE = re.compile(r"`[^`\n]*`")
HTML_COMMENT = re.compile(r"<!--[\s\S]*?-->", re.S)  # Obsidian не делает из комментариев ссылки
ALLOW_ALIAS = "--allow-alias" in sys.argv


def norm_heading(t):
    """Как Obsidian: без решёток, звёздочек и подчёркиваний, регистр не важен."""
    t = re.sub(r"[#*_`>]", "", t)
    return re.sub(r"\s+", " ", t).strip().lower()


by_name, by_path, by_alias, aliases_of, files, headings_of, anchors_of = {}, {}, {}, {}, {}, {}, {}

for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if not d.startswith(".") and d != "node_modules"]
    for fn in filenames:
        full = os.path.join(dirpath, fn)
        rel = os.path.relpath(full, ROOT).replace(os.sep, "/")
        if not fn.endswith(".md"):
            # вложения: Obsidian резолвит и [[graph-full.svg]], и [[graph-full]]
            stem = os.path.splitext(fn)[0]
            by_name.setdefault(fn.lower(), rel)
            by_name.setdefault(stem.lower(), rel)
            by_path[rel.lower()] = rel
            continue
        text = open(full, encoding="utf-8").read()
        files[rel] = text
        by_name[fn[:-3].lower()] = rel
        by_path[rel.lower()] = rel
        m = re.match(r"^---\n(.*?)\n---", text, re.S)
        al = []
        if m:
            am = re.search(r"^aliases:\s*\[(.*?)\]", m.group(1), re.M | re.S)
            if am:
                al = [a.strip().strip('"').strip("'") for a in am.group(1).split(",") if a.strip()]
            else:
                lines = m.group(1).split("\n")
                try:
                    i = next(i for i, l in enumerate(lines) if re.match(r"^aliases:", l))
                    for l in lines[i + 1:]:
                        if re.match(r"^\s*-\s+", l):
                            al.append(l.split("-", 1)[1].strip().strip('"').strip("'"))
                        elif l.strip() == "":
                            continue
                        else:
                            break
                except StopIteration:
                    pass
        for a in al:
            by_alias.setdefault(a.lower(), rel)
        aliases_of[rel] = al
        headings_of[rel] = {norm_heading(h) for h in re.findall(r"^#{1,6}\s+(.+?)\s*$", text, re.M)}
        anchors_of[rel] = set(re.findall(r"[\n^]\^([A-Za-z0-9-]+)\s*$", text, re.M))

stats = {"resolved": 0, "alias-only": 0, "broken": 0, "skipped-templater": 0}
bad, alias_only, bad_anchor = [], [], []

for rel, text in files.items():
    body = INLINE_CODE.sub("", HTML_COMMENT.sub("", FENCE.sub("", text)))
    for mm in WIKI.finditer(body):
        raw = mm.group(2)
        target = raw.split("|", 1)[0]
        sub = ""
        if "#" in target:
            target, sub = target.split("#", 1)
        target = target.strip()
        if "<%" in raw or "%>" in raw:
            stats["skipped-templater"] += 1   # каркас Templater'а — ещё не ссылка
            continue
        key = target.lower()
        dest = by_path.get(key) or by_path.get(key + ".md") or by_name.get(key)
        how = "resolved" if dest else None
        if not dest:
            if not target:
                dest, how = rel, "resolved"   # [[#Заголовок]] — ссылка внутри своей заметки, алиасы ни при чём
            else:
                dest = by_alias.get(key)
                how = "alias-only" if dest else None
        if not dest:
            stats["broken"] += 1
            bad.append("%s -> [[%s]]" % (rel, raw[:80]))
            continue
        stats[how] += 1
        if how == "alias-only":
            alias_only.append("%s -> [[%s]]" % (rel, raw[:80]))
        if sub:
            sub = sub.strip()
            if sub.startswith("^"):
                anchor = sub[1:].strip()
                if anchor not in anchors_of.get(dest, set()):
                    bad_anchor.append("%s: нет якоря ^%s в %s" % (rel, anchor, dest))
            elif norm_heading(sub) not in headings_of.get(dest, set()):
                bad_anchor.append("%s: нет заголовка «%s» в %s" % (rel, sub, dest))

# --- конвенции: id в aliases, имя файла = "<id> - <метка>", метка согласована с name
def sanitize(t):
    return re.sub(r"\s+", " ", t.replace(":", "").replace("\u2019", "'")).strip()


conv_bad = []
for rel, text in files.items():
    m = re.match(r"^---\n(.*?)\n---", text, re.S)
    if not m:
        continue
    fm = m.group(1)
    nid = re.search(r"^id:\s*(.+)$", fm, re.M)
    if not nid:
        continue
    nid = nid.group(1).strip().strip('"')
    if not re.match(r"^Ch\d{2}-S\d{2}(-H\d{2}(-B\d{2})?)?$", nid):
        continue
    if nid not in aliases_of.get(rel, []):
        conv_bad.append(rel + ": id " + nid + " не в aliases")
    stem = os.path.splitext(os.path.basename(rel))[0]
    if not stem.startswith(nid + " - "):
        conv_bad.append("%s: имя файла не начинается с «%s - »" % (rel, nid))
        continue
    label = stem[len(nid) + 3:]
    name = re.search(r'^name:\s*"?([^"\n]+)"?$', fm, re.M)
    name = name.group(1).strip() if name else ""
    if not name:
        conv_bad.append(rel + ": пустое поле name")
    elif sanitize(name).find(label) < 0:
        # метка в имени файла обязана встречаться в name: иначе подпись в графе и файл «про разные заметки»
        conv_bad.append("%s: метка файла «%s» не содержится в name «%s»" % (rel, label, name))
    body = text[len(m.group(0)):]
    if "\n# " not in "\n" + body and "# " not in body:
        conv_bad.append(rel + ": в теле нет заголовка H1")

# --- types.json: алиасы должны быть объявлены как тип aliases, иначе [[id]] не резолвится
tj = json.load(open(os.path.join(ROOT, ".obsidian", "types.json"), encoding="utf-8"))
types = tj.get("types", {})
prop_bad = []
for key, want in (("aliases", "aliases"), ("cssclasses", "cssclasses"), ("tags", "tags")):
    got = types.get(key)
    if got != want:
        prop_bad.append("types.json: %s = %r, должно быть %r" % (key, got, want))

print(json.dumps({
    "files": len(files),
    "links_total": sum(v for k, v in stats.items() if k != "skipped-templater"),
    "by_name_or_path": stats["resolved"],
    "by_alias_only": stats["alias-only"],
    "broken": stats["broken"],
    "bad_heading_or_anchor": len(bad_anchor),
    "convention_violations": len(conv_bad),
    "skipped_templater_scaffolding": stats["skipped-templater"],
    "notes_with_aliases": sum(1 for v in aliases_of.values() if v),
}, ensure_ascii=False, indent=2))
for title, lst in (("битые ссылки", bad), ("ссылки только через aliases", alias_only),
                   ("несуществующие заголовки/якоря", bad_anchor),
                   ("нарушение конвенции id/aliases/имени файла", conv_bad),
                   ("свойства", prop_bad)):
    if lst:
        print("\n" + title + " (" + str(len(lst)) + "):")
        print("\n".join("  " + x for x in lst[:10]))

fail = bool(bad or bad_anchor or conv_bad or prop_bad or (alias_only and not ALLOW_ALIAS))
if fail:
    if alias_only and not ALLOW_ALIAS:
        print("\nИТОГ: ПРОВАЛ — %d ссылок живут только за счёт aliases. Исправьте на [[имя файла|подпись]]." % len(alias_only))
    else:
        print("\nИТОГ: ПРОВАЛ")
    sys.exit(1)
print("\nИТОГ: все %d ссылок разрешаются по имени файла или пути; заголовки, якоря и свойства целы."
      % stats["resolved"])
