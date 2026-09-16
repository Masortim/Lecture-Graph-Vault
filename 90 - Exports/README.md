---
tags: [dashboard]
---
# 90 - Exports

Сюда плагин **Lecture Graph** кладёт выгрузки: `lecture-names-<дата>.json` (названия вершин —
`id`, `name`, `name_zh`; этот же файл принимает обратно кнопка `⤒ JSON`), `lecture-graph-<дата>.json`
(граф целиком), `lecture-graph-<дата>.svg`, `lecture-labels-<дата>.csv`, `Labels table.md`.
Файлы пересоздаются; их можно удалять. Эти папки исключены из графа
(настройки плагина → `Exclude folders`, и фильтр во встроенном графе).
