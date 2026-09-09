---
tags: [dashboard]
---
# Label Board — все подписи в одном месте

Быстрый способ пройтись по подписям, не открывая граф. Править удобнее всего так:
клик по вершине в **Lecture Graph** → `✎ label` (или двойной клик), либо свойства заметки
(`Ctrl+;` → поля `name` и `name_zh`).

## Главы

```dataview
TABLE WITHOUT ID file.link AS "файл", name AS "EN", name_zh AS "中文", length(filter(file.inlinks, (l) => l.path != "Course Index.md")) AS "refs"
FROM "10 - Chapters"
SORT file.name ASC
```

## Секции

```dataview
TABLE WITHOUT ID file.link AS "файл", name AS "EN", name_zh AS "中文", length(filter(file.inlinks, (l) => l.path != "Course Index.md")) AS "refs"
FROM "20 - Sections"
SORT file.name ASC
LIMIT 60
```

## Заголовки

```dataview
TABLE WITHOUT ID name AS "EN", name_zh AS "中文", length(filter(file.inlinks, (l) => l.path != "Course Index.md")) AS "refs"
FROM "25 - Headings"
SORT length(filter(file.inlinks, (l) => l.path != "Course Index.md")) DESC
LIMIT 40
```

## Блоки (крупнейшие по числу ссылок)

```dataview
TABLE WITHOUT ID name AS "EN", name_zh AS "中文", length(filter(file.inlinks, (l) => l.path != "Course Index.md")) AS "refs", kind AS "kind"
FROM "30 - Blocks"
SORT length(filter(file.inlinks, (l) => l.path != "Course Index.md")) DESC
LIMIT 40
```
