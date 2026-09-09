--
name: "<%* tR += (await tp.system.prompt("Название блока (EN) — 1-я строка подписи")) || "Block title (EN)"; %>"
name_zh: "<%* tR += (await tp.system.prompt("Название блока (中文) — 2-я строка подписи")) || "区块中文标题"; %>"
keywords_en: "<%* tR += await tp.system.prompt("Ключевые фразы через ; — по ним блок свяжется с главой курса", ""); %>"
type: block
status: placeholder
cssclasses: ["lg-node", "lg-node--block"]
tags: [template]
---
<%*
    const name = tp.frontmatter.name, zh = tp.frontmatter.name_zh;
    await tp.file.rename(name.replace(/[^\w\s\-·]/g, "").trim());
    await tp.file.move("30 - Blocks/" + name.replace(/[^\w\s\-·]/g, "").trim());
_%>
# <% name %>

**<% zh %>**

Вставьте сюда текст блока. Математика — на верхнем уровне заметки, `$$` на отдельной строке:

$$
\lVert T x \rVert \le L \, \lVert x \rVert_{X}, \qquad L = \sup_{\lVert x \rVert_{X}=1} \lVert T x \rVert_{Y}.
$$

Текст с inline-формулой: для $x \ne 0$ оценка точная. 该命题用于后续证明。

Здесь намеренно нет `parent:` и `chapter:` — связи (и размер вершины) блок получает от
ключевых фраз: запустите «Lecture Graph: Recompute keyword links», и он допишет ссылки между
маркерами `keywords:begin/end` по аннотациям из `35 - Abstracts`. Правила — §7 заметки
`00 - Start Here/01 Conventions — правила разметки.md`. Ссылки на другие блоки по-прежнему
только ручные: `[[Имя файла блока|что нужно из него]]`.
