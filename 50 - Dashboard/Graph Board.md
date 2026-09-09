---
tags: [dashboard]
cssclasses: ["lg-dashboard"]
---
# Graph Board

> Иерархия всего курса деревом с цветными полосками по уровням — в [[Course Index|оглавлении курса]],
> здесь — срезы по данным графа.

![[graph-full.svg]]

Сводка по графу лекций. Числа считает Dataview, граф рисует плагин **Lecture Graph**
(`Ctrl+P → Lecture Graph: Open graph view`). Вершин в графе 1017 — ровно все заметки курса; сама
заметка [[Course Index]] (она лежит в корне хранилища) в граф не входит, а её 1017 ссылок
вычтены и из запросов ниже,
чтобы `refs` на доске совпадали с `refs` во frontmatter и с размером вершин.

## Топ вершин по входящим ссылкам

```dataview
TABLE WITHOUT ID
  file.link AS "вершина",
  name AS "EN (1-я строка)",
  name_zh AS "中文 (2-я строка)",
  length(filter(file.inlinks, (l) => l.path != "Course Index.md")) AS "ссылок на неё",
  type AS "тип"
FROM "10 - Chapters" OR "20 - Sections" OR "25 - Headings" OR "30 - Blocks"
SORT length(filter(file.inlinks, (l) => l.path != "Course Index.md")) DESC
LIMIT 25
```

## Где перевода (2-й строки) ещё нет

```dataview
TABLE WITHOUT ID file.link AS "вершина", name AS "EN"
FROM "10 - Chapters" OR "20 - Sections" OR "25 - Headings" OR "30 - Blocks"
WHERE !name_zh OR name_zh = ""
SORT file.name ASC
```

## Заглушки, которые осталось заполнить

```dataview
TABLE length(rows) AS "заметок со статусом placeholder"
FROM "10 - Chapters" OR "20 - Sections" OR "25 - Headings" OR "30 - Blocks"
WHERE status = "placeholder"
GROUP BY type
```

## Сироты: на вершину никто не ссылается

```dataview
TABLE WITHOUT ID file.link AS "вершина", type AS "тип", length(file.outlinks) AS "исходящих"
FROM "10 - Chapters" OR "20 - Sections" OR "25 - Headings" OR "30 - Blocks"
WHERE length(filter(file.inlinks, (l) => l.path != "Course Index.md")) = 0
SORT file.name ASC
LIMIT 40
```

## Блоки без формул (нарушение конвенции)

```dataview
TABLE WITHOUT ID file.link AS "блок"
FROM "30 - Blocks"
WHERE !regex("/\$\$/").test(file.frontmatter.name) AND length(filter(file.inlinks, (l) => l.path != "Course Index.md")) > 0
LIMIT 20
```

> [!note]
> Запросы видят ссылки так, как их проиндексировал Obsidian, но ссылки самой заметки [[Course Index]]
> (вершины-хаба, 1017 штук) вычтены: иначе «ссылок на неё» разошлось бы с `refs` во frontmatter и с размером вершин.
> Плагин при этом считает входящие отдельно по типам (текстовые / структурные / врезки) — разбивку показывает
> карточка вершины в левом нижнем углу холста (появляется по клику на вершину).
