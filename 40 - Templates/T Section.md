--
type: section
id: <%*
    const ch = await tp.system.prompt("Код главы", "Ch01");
    const n = await tp.system.prompt("Номер секции", "01");
    tR += `${ch}-S${String(n).padStart(2, "0")}`;
_%>
name: "<%* tR += (await tp.system.prompt("Название секции (EN)")) || "Section title (EN)"; %>"
name_zh: "<%* tR += (await tp.system.prompt("Название секции (中文)")) || "小节中文标题"; %>"
status: placeholder
parent: <%* tR += (await tp.system.prompt("Родитель — код главы", "Ch01")); %>
chapter: <%* tR += (await tp.system.prompt("Код главы", "Ch01")); %>
cssclasses: ["lg-node", "lg-node--section"]
tags: [template]
---
<%*
    const id = tp.frontmatter.id, name = tp.frontmatter.name, zh = tp.frontmatter.name_zh;
    await tp.file.rename(`${id} - ${name}`);
_%>
# <% id %> · <% name %>

**<% zh %>**

⬆️ Part of <%* const _p = tp.frontmatter.parent, _f = app.vault.getMarkdownFiles().find((f) => f.basename === _p || f.basename.startsWith(_p + " - ")); tR += _f ? `[[${_f.basename}|${_f.basename.slice(_p.length + 3)}]]` : `[[${_p}]]`; %>

### Heading one

<!-- Каждый заголовок секции = строка-ссылка на заметку заголовка. Вставляйте её через
     `[[` + автодополнение Obsidian, чтобы подставилось полное имя файла, то есть вида
     `### [[Ch01-S01-H01 - Heading one|Heading one]]`. Короткая `[[Ch01-S01-H01]]` зависит
     от алиасов и без них станет «Заметка не существует». -->

Text under the first heading. Links to referable blocks live HERE, in the running text, и
тоже по полному имени файла: `[[Ch01-S01-H01-B01 - Statement 1.1.1a|Statement 1.1.1a]]`.

中文说明：本节引用区块 `[[Ch01-S01-H01-B01 - Statement 1.1.1a|命题 1.1.1a]]`。

---

Правила: см. [[01 Conventions — правила разметки]]. Под строкой заголовка идёт текст со ссылками
на блоки — именно они и создают рёбра графа.
