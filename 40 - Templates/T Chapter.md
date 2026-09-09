--
type: chapter
id: <%*
    const n = await tp.system.prompt("Номер главы", "01");
    tR += "Ch" + String(n).padStart(2, "0");
_%>
name: "<%* tR += (await tp.system.prompt("Название главы (EN) — первая строка подписи")) || "Chapter title (EN)"; %>"
name_zh: "<%* tR += (await tp.system.prompt("Название главы (中文) — вторая строка подписи")) || "章节中文标题"; %>"
status: placeholder
cssclasses: ["lg-node", "lg-node--chapter"]
tags: [template]
---
<%*
    const id = tp.frontmatter.id, name = tp.frontmatter.name, zh = tp.frontmatter.name_zh;
    await tp.file.rename(`${id} - ${name}`);
_%>
# <% id %> · <% name %>

**<% zh %>**

Placeholder chapter. Replace the prose, keep `id`. Ссылки на главу ведутся по полному имени файла,
так что переименование безопасно: Obsidian обновит их сам.

## Sections

<!-- Список секций: ссылки вставляйте через [[ + автодополнение, получится
     `[[Ch01-S01 - Setup and Notation|Setup and Notation]]` — полное имя файла, 预备知识与记号 -->

-
