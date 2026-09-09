--
type: heading
id: <%*
    const sec = await tp.system.prompt("Код секции", "Ch01-S01");
    const n = await tp.system.prompt("Номер заголовка", "01");
    tR += `${sec}-H${String(n).padStart(2, "0")}`;
_%>
name: "<%* tR += (await tp.system.prompt("Заголовок (EN) — первая строка подписи вершины")) || "Heading title (EN)"; %>"
name_zh: "<%* tR += (await tp.system.prompt("Заголовок (中文) — вторая строка подписи")) || "标题中文"; %>"
status: placeholder
parent: <%* tR += (await tp.system.prompt("Родитель — код секции", "Ch01-S01")); %>
chapter: <%* tR += (await tp.system.prompt("Код главы", "Ch01")); %>
cssclasses: ["lg-node", "lg-node--heading"]
tags: [template]
---
<%*
    const id = tp.frontmatter.id, name = tp.frontmatter.name, zh = tp.frontmatter.name_zh;
    await tp.file.rename(`${id} - ${name}`);
_%>
# <% id %> · <% name %>

**<% zh %>**

⬆️ Part of <%* const _p = tp.frontmatter.parent, _f = app.vault.getMarkdownFiles().find((f) => f.basename === _p || f.basename.startsWith(_p + " - ")); tR += _f ? `[[${_f.basename}|${_f.basename.slice(_p.length + 3)}]]` : `[[${_p}]]`; %>

Blocks owned by this heading (создайте их шаблоном `T Block`, затем вставьте ссылки через `[[` +
автодополнение — имя файла подставится целиком, как в примере ниже):

- `[[<% id %>-B01 - Block 1|Block 1]]`
- `[[<% id %>-B02 - Block 2|Block 2]]`
- `[[<% id %>-B03 - Block 3|Block 3]]`
