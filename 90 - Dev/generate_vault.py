#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Генератор каркаса Obsidian-хранилища «Lecture Graph Vault».

Структура: 9 глав -> по 4 секции -> по 6 заголовков -> по 3-4 блока текста.
Каждый элемент — отдельная заметка, поэтому на него можно ссылаться
(и он становится вершиной и во встроенном графе, и в графе плагина).

Все тексты — заглушки (frontmatter: status: placeholder), чтобы их можно
было заменить реальными, не трогая id и ссылки.
"""
import os
import json
import random

from vault_root import vault_root  # корень хранилища: <dev>/.. или <dev>/../Lecture-Graph-Vault

ROOT = vault_root(os.path.dirname(os.path.abspath(__file__)))

F_CHapters = "10 - Chapters"
F_Sections = "20 - Sections"
F_Headings = "25 - Headings"
F_Blocks = "30 - Blocks"

N_CHAPTERS = 9
N_SECTIONS = 4
N_HEADINGS = 6

# ---------------------------------------------------------------- bilingual pools

CHAPTERS = [
    ("Metric Spaces and Completion", "度量空间与完备化"),
    ("Normed Spaces and Operators", "赋范空间与算子"),
    ("Inner Products and Orthogonality", "内积与正交性"),
    ("Banach Space Theorems", "巴拿赫空间定理"),
    ("Hilbert Space Geometry", "希尔伯特空间几何"),
    ("Spectral Theory", "谱理论"),
    ("Convexity and Duality", "凸性与对偶性"),
    ("Concentration and Probability", "集中性与概率"),
    ("Learning Theory and Regularization", "学习理论与正则化"),
]

SECTIONS = [
    ("Setup and Notation", "预备知识与记号"),
    ("Core Theory", "核心理论"),
    ("Main Results", "主要结果"),
    ("Applications and Limits", "应用与局限"),
]

HEADING_KINDS = [
    ("Definition", "定义"),
    ("Notation", "记号约定"),
    ("Basic Properties", "基本性质"),
    ("Key Lemma", "关键引理"),
    ("Main Theorem", "主定理"),
    ("Proof and Consequences", "证明与推论"),
]

TERMS = [
    ("Vector Space", "向量空间"),
    ("Linear Operator", "线性算子"),
    ("Compact Set", "紧集"),
    ("Metric Completion", "度量完备化"),
    ("Orthogonal Projection", "正交投影"),
    ("Basis and Coordinates", "基与坐标"),
    ("Dual Space", "对偶空间"),
    ("Adjoint Operator", "伴随算子"),
    ("Spectral Theorem", "谱定理"),
    ("Norm Equivalence", "范数等价"),
    ("Contraction Mapping", "压缩映射"),
    ("Fixed Point", "不动点"),
    ("Banach Limit", "巴拿赫极限"),
    ("Hilbert Decomposition", "希尔伯特分解"),
    ("Weak Convergence", "弱收敛"),
    ("Density Argument", "稠密性论证"),
    ("Kernel and Range", "核与值域"),
    ("Eigenvalue Bounds", "特征值估计"),
    ("Singular Values", "奇异值"),
    ("Trace Class", "迹类"),
    ("Convex Hull", "凸包"),
    ("Separation Theorem", "分离定理"),
    ("Hahn-Banach Extension", "哈恩-巴拿赫延拓"),
    ("Open Mapping", "开映射"),
    ("Closed Graph", "闭图像"),
    ("Uniform Boundedness", "一致有界性"),
    ("Approximation Error", "逼近误差"),
    ("Radon-Nikodym Derivative", "拉东-尼科迪姆导数"),
    ("Entropy Bound", "熵界"),
    ("Concentration Inequality", "集中不等式"),
    ("Gradient Descent", "梯度下降"),
    ("Lipschitz Continuity", "利普希茨连续性"),
    ("Duality Gap", "对偶间隙"),
    ("Regularization", "正则化"),
    ("Feature Map", "特征映射"),
    ("Kernel Matrix", "核矩阵"),
    ("Sample Complexity", "样本复杂度"),
    ("Generalization Bound", "泛化界"),
    ("Spectral Gap", "谱隙"),
    ("Markov Chain", "马尔可夫链"),
]

# 4 вида текста блока: у каждого свой способ показать математику
BLOCK_KINDS = [
    ("statement", "命题", "Proposition",
     "For every $x \\in X$ the quantity below is finite and controls the rest of the section:",
     "$$\n\\lVert Tx \\rVert \\;\\le\\; L\\,\\lVert x \\rVert_{X}, \\qquad L = \\sup_{\\lVert x \\rVert_{X}=1} \\lVert Tx \\rVert_{Y}.\n$$",
     "该命题是本节后续结果的出发点。"),
    ("identity", "恒等式", "Identity",
     "The pairing is computed in coordinates, which gives the identity we quote later:",
     "$$\n\\langle x, y \\rangle \\;=\\; \\sum_{i=1}^{n} x_i \\overline{y_i}\n \\;=\\; \\lVert P_{M} x \\rVert^{2} + \\lVert P_{M^{\\perp}} x \\rVert^{2}.\n$$",
     "恒等式在正交投影的讨论中反复使用。"),
    ("estimate", "估计", "Estimate",
     "A standard symmetrisation argument yields the quantitative bound:",
     "$$\n\\mathbb{P}\\bigl\\{\\,|f(X)-\\mathbb{E}f| \\ge t\\,\\bigr\\}\n \\;\\le\\; 2\\exp\\!\\left(-\\frac{2nt^{2}}{(b-a)^{2}}\\right),\n \\qquad t>0.\n$$",
     "此估计决定了样本复杂度的阶。"),
    ("example", "例子", "Example",
     "The model case below shows that the hypothesis cannot be dropped:",
     "$$\nT e_k \\;=\\; \\lambda_k e_k, \\qquad\n\\sum_{k=1}^{\\infty} |\\lambda_k| \\;<\\; \\infty,\n \\qquad \\lVert T \\rVert_{\\mathrm{tr}} = \\sum_{k} |\\lambda_k|.\n$$",
     "去掉条件后结论不再成立。"),
]

# ---------------------------------------------------------------- helpers


def yq(s):
    """YAML: безопасная двойная кавычка."""
    return json.dumps(s, ensure_ascii=False)


def write(path, text):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as fh:
        fh.write(text)


def fm(type_, id_, name, name_zh, parent, chapter, extra=None):
    lines = [
        "---",
        f"type: {type_}",
        f"id: {id_}",
        f"name: {yq(name)}",
        f"name_zh: {yq(name_zh)}",
        f'aliases: {json.dumps([id_], ensure_ascii=False)}',
        "status: placeholder",
    ]
    if parent:
        lines.append(f"parent: {parent}")
    lines.append(f"chapter: {chapter}")
    if extra:
        for k, v in extra.items():
            lines.append(f"{k}: {v}")
    lines.append(f'cssclasses: ["lg-node", "lg-node--{type_}"]')
    lines.append("---")
    return "\n".join(lines) + "\n"


def part_of(link, label, zh_label):
    return f"⬆️ Part of [[{link}|{label}]] · [[{link}|{zh_label}]]\n"


# ---------------------------------------------------------------- inventory

class Model:
    def __init__(self):
        self.chapters = []
        self.sections = []
        self.headings = []
        self.blocks = []
        term_i = 0
        for ci in range(N_CHAPTERS):
            ch_en, ch_zh = CHAPTERS[ci]
            ch_id = f"Ch{ci + 1:02d}"
            ch = {
                "i": ci, "id": ch_id, "en": ch_en, "zh": ch_zh,
                "file": f"{ch_id} - {ch_en}",
                "folder": F_CHapters,
                "sections": [],
            }
            self.chapters.append(ch)
            for si in range(N_SECTIONS):
                sec_en, sec_zh = SECTIONS[si]
                sec_id = f"{ch_id}-S{si + 1:02d}"
                sec = {
                    "chapter": ch, "i": si, "id": sec_id,
                    "en": f"{sec_en} — {ch_en}",
                    "zh": f"{ch_zh}：{sec_zh}",
                    "kind_en": sec_en, "kind_zh": sec_zh,
                    "file": f"{sec_id} - {sec_en}",
                    "folder": f"{F_Sections}/{ch_id}",
                    "headings": [],
                }
                self.sections.append(sec)
                ch["sections"].append(sec)
                for hi in range(N_HEADINGS):
                    k_en, k_zh = HEADING_KINDS[hi]
                    t_en, t_zh = TERMS[term_i % len(TERMS)]
                    term_i += 1
                    h_id = f"{sec_id}-H{hi + 1:02d}"
                    h = {
                        "section": sec, "i": hi, "id": h_id,
                        "kind_en": k_en, "kind_zh": k_zh,
                        "term_en": t_en, "term_zh": t_zh,
                        "en": f"{k_en}: {t_en}",
                        "zh": f"{t_zh}：{k_zh}",
                        "file": f"{h_id} - {k_en} {t_en}",
                        "folder": f"{F_Headings}/{ch_id}",
                        "blocks": [],
                    }
                    self.headings.append(h)
                    sec["headings"].append(h)
                    n_blocks = 3 + (len(self.headings) % 2)  # 3 или 4: чередование по глобальному индексу
                    for bi in range(n_blocks):
                        bk_en, bk_zh, bk_kind, bk_prose, bk_math, bk_note = BLOCK_KINDS[(hi + bi) % 4]
                        b_id = f"{h_id}-B{bi + 1:02d}"
                        num = f"{ci + 1}.{si + 1}.{hi + 1}{chr(ord('a') + bi)}"
                        b = {
                            "heading": h, "i": bi, "id": b_id, "kind": bk_en, "num": num,
                            "kind_zh": bk_zh, "kind_cap": bk_kind,
                            "prose": bk_prose, "math": bk_math, "note_zh": bk_note,
                            "en": f"{h['term_en']} {bk_kind} {num}",
                            "zh": f"{h['term_zh']}{bk_zh} {num}",
                            "file": f"{b_id} - {bk_kind} {num}",
                            "folder": f"{F_Blocks}/{ch_id}",
                        }
                        self.blocks.append(b)
                        h["blocks"].append(b)

    # удобные словари
    def by_id(self, items):
        return {x["id"]: x for x in items}


def wiki(item, text=None):
    return f"[[{item['file']}|{text or item['en']}]]"


def wiki_id(item, text=None):
    """Короткая ссылка по id. В генераторе не используется: `[[id]]` резолвится только через
    `aliases` (и то при корректном типе свойства в .obsidian/types.json). Надёжная форма —
    полное имя файла: `[[Ch01-S03-H06-B03 - Example 1.3.6c|Example 1.3.6c]]`."""
    return f"[[{item['id']}|{text or item['en']}]]"


def landmark_pool(blocks, k=4):
    """Опорные блоки курса: на них ссылается КАЖДАЯ секция -> максимальный размер вершины."""
    idxs = [round(i * (len(blocks) - 1) / (k - 1)) for i in range(k)]
    return [blocks[i] for i in idxs]


def clean_generated():
    """Удаляет сгенерированные папки: иначе остаются файлы прошлой генерации."""
    import shutil, fnmatch
    for pat in ["10 - Chapters", "20 - Sections", "25 - Headings", "30 - Blocks"]:
        d = os.path.join(ROOT, pat)
        if os.path.isdir(d):
            shutil.rmtree(d)
    for d in os.listdir(ROOT):
        if fnmatch.fnmatch(d, "*.md") and os.path.isfile(os.path.join(ROOT, d)):
            pass  # служебные файлы хранилища не трогаем


def main():
    random.seed(20240908)
    os.makedirs(ROOT, exist_ok=True)
    clean_generated()
    m = Model()
    blocks_by_id = m.by_id(m.blocks)
    headings_by_id = m.by_id(m.headings)

    LANDMARKS = landmark_pool(m.blocks, 4)

    # Лестница popular-вершин по каждому уровню: (цель, сколько секций на неё ссылается).
    # Без этого все секции/заголовки получают одинаковое число ссылок и выглядят одноразмерно.
    LADDER = {
        "chapter": [(m.chapters[0], 36), (m.chapters[4], 18), (m.chapters[8], 9), (m.chapters[2], 5)],
        "section": [(m.sections[0], 36), (m.sections[10], 20), (m.sections[25], 11),
                    (m.sections[33], 6), (m.sections[5], 3)],
        "heading": [(m.headings[0], 36), (m.headings[41], 24), (m.headings[90], 16),
                    (m.headings[131], 10), (m.headings[174], 6), (m.headings[203], 3)],
        "block": [(b, 24) for b in LANDMARKS[:2]] + [(b, 12) for b in LANDMARKS[2:4]],
    }


    def landmarks(sec):
        # все 4 ориентира курса цитируются в каждой секции
        return LANDMARKS if sec["i"] % 2 == 0 else list(reversed(LANDMARKS))

    # блоки и заголовки цитируем короткой ссылкой по id, секции и главы — полным именем файла
    # (оба способа должны работать одинаково)
    # «ключевые» блоки: на них ссылается каждая секция своей главы -> крупные вершины
    key_blocks = {}
    for ch in m.chapters:
        hs = [h for h in ch["sections"][0]["headings"]]
        key_blocks[ch["id"]] = [hs[0]["blocks"][0], hs[2]["blocks"][0], hs[-1]["blocks"][0]]

    all_blocks = m.blocks
    n = len(all_blocks)
    written = {"chapters": 0, "sections": 0, "headings": 0, "blocks": 0}
    # ссылки известны заранее (иначе перекрёстные ссылки блоков ссылаются на ещё не записанные id)
    # ВАЖНО: ссылка всегда по полному имени файла (`[[<id> - <EN title>|подпись]]`), а не по голому
    # id: базовое разрешение ссылок Obsidian работает по имени/пути, а `[[id]]` зависит от алиасов.
    link_index = {b["id"]: wiki(b, f"{b['kind_cap']} {b['num']}") for b in m.blocks}
    link_index.update({h["id"]: wiki(h, h["en"]) for h in m.headings})
    link_index.update({s["id"]: wiki(s, s["kind_en"]) for s in m.sections})
    link_index.update({c["id"]: wiki(c, c["en"]) for c in m.chapters})

    # ---------------- blocks
    for idx, b in enumerate(all_blocks):
        h, s, c = b["heading"], b["heading"]["section"], b["heading"]["section"]["chapter"]
        body = [fm("block", b["id"], b["en"], b["zh"], h["id"], c["id"])]
        body.append(f"\n# {b['en']}\n\n**{b['zh']}** · {b['kind']} · {b['num']}\n\n")
        body.append(part_of(h["file"], h["en"], h["zh"]) + "\n")
        body.append(b["prose"] + "\n\n")
        body.append(b["math"] + "\n\n")
        body.append(b["note_zh"] + "\n")
        # перекрёстные ссылки блоков (создают рёбра блок -> блок и «нагрузку» на вершины)
        refs = []
        for k in range(2):
            t = all_blocks[(idx * 7 + 13 + k * 101 + s["i"] * 3) % n]
            if t["id"] != b["id"]:
                refs.append(t)
        if refs:
            body.append("\nUsed together with: " +
                        ", ".join(link_index[t["id"]] for t in refs) + ".\n")

        write(f"{b['folder']}/{b['file']}.md", "".join(body))
        written["blocks"] += 1

    # ---------------- headings
    for hi, h in enumerate(m.headings):
        s, c = h["section"], h["section"]["chapter"]
        body = [fm("heading", h["id"], h["en"], h["zh"], s["id"], c["id"])]
        body.append(f"\n# {h['en']}\n\n**{h['zh']}**\n\n")
        body.append(part_of(s["file"], s["kind_en"], s["kind_zh"]) + "\n")
        body.append(f"This heading owns {len(h['blocks'])} referable blocks. "
                    f"They are quoted from the section text below the `### {h['kind_en']}` heading, "
                    f"so every block has at least one inbound reference:\n\n")
        for b in h["blocks"]:
            body.append(f"- {link_index[b['id']]} — {b['prose'].split('.')[0].replace('$', '')}\n")
        body.append(f"\nСсылка на заголовок по-китайски: {wiki(h, h['zh'])}。\n")
        # заголовок иногда ссылается на заголовок-сосед (другая секция той же главы)
        other = s["chapter"]["sections"][(s["i"] + 1) % N_SECTIONS]["headings"][(h["i"] + 1) % N_HEADINGS]
        body.append(f"\nCompare with " + link_index[other["id"]] + f" ({other['zh']}).\n")
        write(f"{h['folder']}/{h['file']}.md", "".join(body))
        written["headings"] += 1

    # ---------------- sections
    for gidx, sec in enumerate(m.sections):
        sec["_gidx"] = gidx
        c = sec["chapter"]
        body = [fm("section", sec["id"], sec["en"], sec["zh"], c["id"], c["id"])]
        body.append(f"\n# {sec['en']}\n\n**{sec['zh']}**\n\n")
        body.append(part_of(c["file"], c["en"], c["zh"]) + "\n")
        body.append("Blocks collected in this section: " +
                    f"{len(sec['headings'])} headings, "
                    f"{sum(len(h['blocks']) for h in sec['headings'])} referable blocks.\n\n")
        body.append("---\n")
        for h in sec["headings"]:
            body.append(f"\n### {link_index[h['id']]}\n\n")
            # текст ПОД заголовком: именно здесь стоят ссылки на блоки
            own = ", ".join(link_index[b["id"]] for b in h["blocks"])
            body.append(
                f"We record {len(h['blocks'])} referable statements under this heading: {own}. "
                f"The first one is the working definition used throughout the chapter.\n\n")
            other_hs = [x for x in sec["headings"] if x["id"] != h["id"]]
            pick1 = other_hs[(h["i"] * 2) % len(other_hs)]
            pick2 = other_hs[(h["i"] * 2 + 3) % len(other_hs)]
            b1 = pick1["blocks"][0]
            b2 = pick2["blocks"][min(1, len(pick2["blocks"]) - 1)]
            body.append(
                f"Compared with {link_index[b1['id']]} we only gain a constant, "
                f"see also {link_index[b2['id']]} and the heading "
                f"{link_index[pick2['id']]}.\n\n")
            if h["i"] == 0:
                body.append(
                    f"中文说明：本段在 *{h['kind_zh']}* 之下，引用了 "
                    f"{link_index[h['blocks'][0]['id']]} 与 {link_index[b1['id']]}；"
                    f"记号沿用 {wiki(c, c['zh'])}。\n")
            else:
                sib = c["sections"][(sec["i"] + h["i"]) % N_SECTIONS]
                body.append(
                    f"中文说明：本段在 *{h['kind_zh']}* 之下，引用了 "
                    f"{link_index[h['blocks'][0]['id']]} 与 {link_index[b1['id']]}；"
                    f"另见 {link_index[sib['id']]}。\n")

        # ---- перекрёстные ссылки: блоки, заголовки, секции, главы.
        # Они стоят в тексте под последним ### заголовком секции (а не в отдельном разделе),
        # чтобы «ссылки встречались в текстах под заголовками», как устроены лекции.
        # ссылки на главы / секции / заголовки того же уровня и выше — тоже в тексте под заголовком
        lvl_links = []
        for kind in ("chapter", "section", "heading", "block"):
            targets = [t for (t, w) in LADDER[kind] if w > sec["_gidx"]]
            if targets:
                lvl_links.append(
                    {"chapter": "Chapters in scope", "section": "Sections revisited",
                     "heading": "Headings referenced here", "block": "Blocks referenced here"}[kind]
                    + ": " + " · ".join(link_index[t["id"]] for t in targets))
        body.append("\n" + "\n\n".join(lvl_links) + "\n\n"
                    "Внутри главы на блоки " + " / ".join(link_index[b["id"]] for b in key_blocks[c["id"]])
                    + " ссылки ведут из каждой секции.\n")
        # глобальные «ориентиры» курса: 12 блоков,size-разброс 1..~40
        body.append("\nCourse landmarks: " +
                    ", ".join(link_index[b["id"]] for b in landmarks(sec)) +
                    ".\n")
        nxt = c["sections"][(sec["i"] + 1) % N_SECTIONS]
        if nxt["id"] != sec["id"]:
            body.append(f"\nNext: {link_index[nxt['id']]} ({nxt['kind_zh']}).\n")
        else:
            nb = m.chapters[(c["i"] + 1) % N_CHAPTERS]["sections"][0]
            body.append(f"\nNext chapter starts at {wiki(nb, 'Section 1 of ' + nb['chapter']['en'])}.\n")
        write(f"{sec['folder']}/{sec['file']}.md", "".join(body))
        written["sections"] += 1

    # ---------------- chapters
    for ci, c in enumerate(m.chapters):
        body = [fm("chapter", c["id"], c["en"], c["zh"], None, c["id"])]
        body.append(f"\n# {c['en']}\n\n**{c['zh']}**\n\n")
        body.append("Placeholder chapter of the demo lecture course. Replace the prose, keep the `id`.\n\n")
        body.append("## Sections\n\n")
        for s in c["sections"]:
            nb = sum(len(h["blocks"]) for h in s["headings"])
            body.append(f"- {link_index[s['id']]} — {s['zh']} · {len(s['headings'])} headings, {nb} blocks\n")
        body.append("\n## 中文说明\n\n本章共 "
                    f"{len(c['sections'])} 节、{sum(len(s['headings']) for s in c['sections'])} 个标题。\n")
        if ci + 1 < len(m.chapters):
            body.append("\nUp next: " + wiki(m.chapters[ci + 1], m.chapters[ci + 1]["en"]) + ".\n")
        write(f"{c['folder']}/{c['file']}.md", "".join(body))
        written["chapters"] += 1

    # индекс имён -> файл (для README и для быстрой вставки ссылок)
    stats = {
        "chapters": written["chapters"],
        "sections": written["sections"],
        "headings": written["headings"],
        "blocks": written["blocks"],
        "nodes": written["chapters"] + written["sections"] + written["headings"] + written["blocks"],
        "key_blocks": [b["file"] for b in sum(key_blocks.values(), [])],
        "landmarks": [b["id"] for b in LANDMARKS],
    }
    with open(os.path.join(ROOT, ".vault-stats.json"), "w", encoding="utf-8") as fh:
        json.dump(stats, fh, ensure_ascii=False, indent=2)
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
