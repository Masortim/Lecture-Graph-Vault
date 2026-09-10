#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Аудит хранилища глазами Obsidian: всё, что кроме разрешимости ссылок (её проверяет
validate_links.py). Каждое нарушение — потенциальный «синий»/жёлтый маркер в интерфейсе
или «Заметка не существует»."""
import json
import os
import re
import sys

from vault_root import vault_root  # корень хранилища: <dev>/.. или <dev>/../Lecture-Graph-Vault

ROOT = vault_root(os.path.dirname(os.path.abspath(__file__)))
FENCE = re.compile(r"^```[\s\S]*?^```[ \t]*$", re.M)
INLINE_CODE = re.compile(r"`[^`\n]*`")
HTML_COMMENT = re.compile(r"<!--[\s\S]*?-->", re.S)  # Obsidian не делает из комментариев ссылки
problems = {}


def add(kind, *msg):
    parts = []
    for m in msg:
        if isinstance(m, (list, tuple)):
            parts.extend(str(x) for x in m)
        elif m:
            parts.append(str(m))
    problems.setdefault(kind, []).append(": ".join(parts))


md, other = {}, {}
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if not d.startswith(".") and d != "node_modules"]
    for fn in filenames:
        p = os.path.join(dirpath, fn)
        rel = os.path.relpath(p, ROOT).replace(os.sep, "/")
        if fn.endswith(".md"):
            md[rel] = open(p, encoding="utf-8").read()
        else:
            other.setdefault(fn.lower(), []).append(rel)

# 1. одинаковые имена файлов: короткая ссылка становится неоднозначной
byname = {}
for rel in list(md) + [r for ps in other.values() for r in ps]:
    byname.setdefault(os.path.basename(rel).lower(), []).append(rel)
for name, ps in sorted(byname.items()):
    if len(ps) > 1 and not name.startswith("readme"):
        add("дубли имён файлов (ссылки вида [[имя]] будут неоднозначны)", name, ps)
for name, ps in sorted(byname.items()):
    if len(ps) > 1 and name.startswith("readme"):
        pass  # readme.md в каждой папке — намеренно, на них никто не ссылается

# 2. frontmatter: парсится ли, нет ли дублей ключей, не «съедены» ли двоеточия
fm_cache = {}
for rel, text in md.items():
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not m:
        if text.startswith("---"):
            add("битый frontmatter", rel, "нет закрывающего '---'")
        continue
    fm_cache[rel] = m.group(1)
    keys = []
    for line in m.group(1).split("\n"):
        if re.match(r"^\S+\s*:", line):
            keys.append(line.split(":", 1)[0].strip())
            val = line.split(":", 1)[1].strip()
            if val and not re.match(r'^(\[.*\]|".*"|\'.*\'|[\d.]+|true|false|null|)$', val) and ": " in val:
                add("неэкранированное ': ' в значении свойства (YAML сломается)", rel, line.strip())
    dup = {k for k in keys if keys.count(k) > 1}
    if dup:
        add("дубли ключей в frontmatter", rel, ", ".join(sorted(dup)))

try:
    import yaml  # если PyYAML есть — проверяем по-настоящему
    for rel, fm in fm_cache.items():
        try:
            yaml.safe_load(fm)
        except Exception as e:
            add("YAML не парсится", rel, str(e).split("\n")[0][:120])
    yaml_checked = True
except ImportError:
    yaml_checked = False

# 3. aliases: коллизии с именами других файлов и между собой
alias_owner = {}
for rel, fm in fm_cache.items():
    am = re.search(r'^aliases:\s*\[(.*?)\]', fm, re.M)
    if not am:
        continue
    for a in [x.strip().strip('"').strip("'") for x in am.group(1).split(",") if x.strip()]:
        alias_owner.setdefault(a.lower(), []).append(rel)
for a, owners in sorted(alias_owner.items()):
    if len(owners) > 1:
        add("один alias у нескольких заметок (Autocomplete запутается)", a, ", ".join(owners[:3]))
    if a in byname and byname[a] != owners:
        add("alias совпадает с именем другого файла", a, " && ".join(byname[a] + owners))

# 4. тематические заметки: `type` и `parent`/`chapter` должны вести на существующий id
ids = {}
for rel, fm in fm_cache.items():
    im = re.search(r"^id:\s*(.+)$", fm, re.M)
    if im:
        ids[im.group(1).strip().strip('"')] = rel
for rel, fm in fm_cache.items():
    tm = re.search(r"^type:\s*(.+)$", fm, re.M)
    if not tm or tm.group(1).strip() not in ("chapter", "section", "heading", "block"):
        continue
    for key in ("parent", "chapter"):
        km = re.search(r"^%s:\s*(.+)$" % key, fm, re.M)
        if not km:
            if key == "parent" and tm.group(1).strip() != "chapter":
                add("нет свойства parent у не-главы", rel, tm.group(1).strip())
            continue
        v = km.group(1).strip().strip('"')
        if v.startswith("[[") or "|" in v or v.count(" ") > 0:
            add("свойство %s должно содержать id, а не ссылку/подпись" % key, rel, v)
        elif v not in ids:
            add("свойство %s ссылается на несуществующий id" % key, rel, "%s -> %s" % (v, rel))

# 5. формулы: `$$` должны быть сбалансированы и не стоять внутри списков/callout'ов
for rel, text in md.items():
    body = INLINE_CODE.sub("", HTML_COMMENT.sub("", FENCE.sub("", text)))
    if body.count("$$") % 2:
        add("нечётное число `$$` (формула не закроется)", rel, "")
    for mm in re.finditer(r"^[ \t]+(\$\$|\\\[)", body, re.M):
        line_no = body[:mm.start()].count("\n") + 1
        add("формула с отступом (внутри списка — Obsidian не отрендерит)", rel, "строка %d" % line_no)
    for mm in re.finditer(r"^\s*([-*>]\s+.*)?\$\$\s*$", body, re.M):
        if mm.group(1):
            add("`$$` в строке списка/callout", rel, mm.group(0).strip())
            break

# 6. wiki-ссылки на заголовки: заголовок обязан существовать (дублирует validate_links, но
#    здесь проверяем ещё и явные [[#...]] внутри заметки)
for rel, text in md.items():
    body = INLINE_CODE.sub("", HTML_COMMENT.sub("", FENCE.sub("", text)))
    own = {re.sub(r"[#*_`>]", "", h).strip().lower() for h in re.findall(r"^#{1,6}\s+(.+?)\s*$", text, re.M)}
    for raw in re.findall(r"\[\[([^\]\|\n]*#[^\]\|\n]*)(?:\|[^\]\n]*)?\]\]", body):
        head = raw.split("#", 1)[1].strip()
        if head.startswith("^"):
            continue
        norm = re.sub(r"\s+", " ", re.sub(r"[#*_`>]", "", head)).strip().lower()
        if not raw.split("#")[0].strip() and norm and norm not in own:
            add("[[#Заголовок]] на несуществующий заголовок этой же заметки", rel, head)

# 7. конфиги
def load(rel):
    p = os.path.join(ROOT, rel)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else None


app = load(".obsidian/app.json") or {}
if app.get("alwaysUpdateLinks") is not True:
    add("app.json", "alwaysUpdateLinks", "включите, иначе переименование файла порвёт ссылки")
tj = load(".obsidian/types.json") or {}
for key, want in (("aliases", "aliases"), ("cssclasses", "cssclasses"), ("tags", "tags")):
    got = (tj.get("types") or {}).get(key)
    if got != want:
        add("types.json: неверный тип свойства", key, "сейчас %r, нужно %r" % (got, want))
cp = load(".obsidian/core-plugins.json")
if isinstance(cp, list):
    for need in ("file-explorer", "global-search", "switcher", "graph", "backlink",
                 "outgoing-link", "tag-pane", "page-preview", "properties", "command-palette"):
        if need not in cp:
            add("core-plugins.json", "не включён встроенный плагин %s" % need)
mani = load(".obsidian/plugins/lecture-graph/manifest.json") or {}
if not mani.get("dir") and not mani.get("id"):
    add("manifest.json плагина", "нет ни id, ни dir")
for plug in ("templater-obsidian", "dataview", "obsidian-excalidraw-plugin", "dark-pdf-export", "lecture-graph"):
    d = os.path.join(ROOT, ".obsidian", "plugins", plug)
    for f in ("manifest.json", "main.js"):
        if not os.path.exists(os.path.join(d, f)):
            add("плагин не доставлен", plug, "нет %s" % f)
    if plug == "dark-pdf-export" and not os.path.exists(os.path.join(d, "styles.css")):
        add("dark-pdf-export", "нет styles.css (тёмный экспорт PDF опирается на него)")

n_links = sum(len(re.findall(r"\[\[", INLINE_CODE.sub("", HTML_COMMENT.sub("", FENCE.sub("", t))))) for t in md.values())
print("заметок: %d, всего [[ -ссылок: %d, PyYAML: %s" % (len(md), n_links, "да" if yaml_checked else "нет (использован эвристика-парсер)"))
if not problems:
    print("ПРОБЛЕМ НЕ НАЙДЕНО")
    sys.exit(0)
total = 0
for kind, items in sorted(problems.items(), key=lambda kv: -len(kv[1])):
    total += len(items)
    print("\n%s — %d:" % (kind, len(items)))
    for it in items[:6]:
        print("   " + str(it))
print("\nИТОГО замечаний: %d" % total)
sys.exit(1)
