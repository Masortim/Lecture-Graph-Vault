/* Этап 2: материализует связи по ключевым фразам в сами заметки блоков.

   Алгоритм живёт в graph-core.js (те же функции зовёт плагин командой
   «Lecture Graph: Recompute keyword links»): список `keywords_en:` блока ищется точными
   совпадениями по аннотациям из `35 - Abstracts`, каждая найденная область даёт ссылку на
   вершину (секцию или заголовок), вес ребра = числу вхождений.

   Сюда попадают ДВЕ вещи:
   1) блок wiki-ссылок между маркерами `<!-- keywords:begin/end -->` в теле заметки —
      их и считает ядро как рёбра, так что источник правды для графа остаётся один;
   2) свойство `weight:` в frontmatter — суммарное число вхождений, удобно для CSV/дашборда.

   Идемпотентно: повторный прогон не меняет файлы. --check ничего не пишет и выходит с
   кодом 1, если на диске устаревшие связи (используется finalize.py). */
const fs = require("fs");
const path = require("path");
const core = require("./src/graph-core.js");
const vaultNotes = require("./vault-notes.js");

// корень хранилища: <dev>/.. (инструментарий внутри) или <dev>/../Lecture-Graph-Vault
const ROOT = require("./vault-root.js")(__dirname);
const CHECK = process.argv.indexOf("--check") >= 0;
const settingsPath = path.join(ROOT, ".obsidian", "plugins", "lecture-graph", "data.json");
const settings = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, "utf8")) : {};
const weightKey = settings.weightKey || core.DEFAULTS.weightKey;
const folder = settings.keywordFolder || core.DEFAULTS.keywordFolder;

const { notes } = vaultNotes.collect(ROOT, settings);
const graph = core.buildGraph(notes, settings);

// корпус намеренно исключён из графа — читаем его отдельно, той же функцией
const absNotes = vaultNotes.walk(path.join(ROOT, folder)).map((abs) => {
  return vaultNotes.readNote(ROOT, path.relative(ROOT, abs).split(path.sep).join("/"));
});
if (!absNotes.length) {
  console.log("НЕТ КОРПУСА: " + folder + " пуст — запускать dev/write_abstracts.py");
  process.exit(1);
}
const corpus = core.buildKeywordCorpus(absNotes, graph, settings);

let wrote = 0, same = 0, noKw = 0, recolored = 0, maxW = 0;
const stale = [], top = [], unmatchedPhrases = new Set();
for (const n of graph.nodes) {
  if (n.type !== "block" || !n.path) continue;
  const plan = core.planBlockKeywords(n.data, corpus, n.chapter, settings);
  if (!plan.keywords.length) { noKw++; }
  plan.unmatched.forEach((p) => unmatchedPhrases.add(p));
  const want = core.keywordRegionText(plan, settings);
  const file = path.join(ROOT, n.path);
  if (!fs.existsSync(file)) { stale.push(n.path + " (нет файла)"); continue; }
  const raw = fs.readFileSync(file, "utf8");
  const patch = {};
  patch[weightKey] = plan.keywords.length ? plan.weight : "";
  const next = core.setFrontmatterValues(core.applyKeywordRegion(raw, want), patch);
  const own = n.chapter;
  if (plan.dominant && own && plan.dominant !== own) recolored++;
  if (plan.weight > maxW) maxW = plan.weight;
  if (plan.weight > 0) top.push({ id: n.id, w: plan.weight, t: plan.targets.length, ch: plan.dominant, own: own });
  if (next === raw) { same++; continue; }
  wrote++;
  if (CHECK) stale.push(n.path);
  else fs.writeFileSync(file, next);
}
top.sort((a, b) => b.w - a.w || (a.id < b.id ? -1 : 1));

const edges = graph.edges.filter((e) => e.kind === "keyword").length;
const kwNodes = graph.nodes.filter((n) => n.kwWeight > 0).length;
console.log(
  [
    "аннотаций: " + corpus.stats.notes + " · областей: " + corpus.stats.regions +
      (corpus.stats.unmatched ? " · НЕ СОПОСТАВЛЕНО заголовков: " + corpus.stats.unmatched : ""),
    "блоков без ключевых фраз: " + noKw + " (остались только с ручными ссылками)",
    "ссылок в графе вида «ключевые фразы»: " + edges + " · вершин с весом: " + kwNodes,
    "максимальный вес: " + maxW + " · перекрашено в чужую главу: " + recolored,
    (CHECK ? "проверка" : "обновлено") + ": изменено файлов " + wrote + " · без изменений " + same,
  ].join("\n")
);
if (top.length) {
  console.log("тяжёлые блоки: " + top.slice(0, 5).map((x) => x.id + " (" + x.w + ")", ).join(", "));
}
if (unmatchedPhrases.size) {
  console.log("ФРАЗЫ БЕЗ ВХОЖДЕНИЙ В КОРПУСЕ: " + unmatchedPhrases.size + " — " + [...unmatchedPhrases].slice(0, 6).join(" | "));
}
if (stale.length) {
  console.log((CHECK ? "УСТАРЕВШИЕ ЗАМЕТКИ: " : "") + stale.length + " — " + stale.slice(0, 5).join(", "));
  if (CHECK) process.exit(1);
}
