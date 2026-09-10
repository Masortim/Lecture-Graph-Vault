/* Считает статистику графа по хранилищу и дописывает её в .vault-stats.json (для документации).
   Тот же код, что работает в плагине: набор заметок берётся из общего правила
   (vault-notes.collect), а не переписывается заново. */
const fs = require("fs");
const path = require("path");
const core = require("./src/graph-core.js");
const vaultNotes = require("./vault-notes.js");
// корень хранилища: <dev>/.. (инструментарий внутри) или <dev>/../Lecture-Graph-Vault
const ROOT = require("./vault-root.js")(__dirname);

const settingsPath = path.join(ROOT, ".obsidian", "plugins", "lecture-graph", "data.json");
const settings = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, "utf8")) : {};
const collected = vaultNotes.collect(ROOT, settings);
const g = core.buildGraph(collected.notes, settings);
const comp = core.components(g);
const deg = {};
const radii = {};
["chapter", "section", "heading", "block"].forEach((t) => {
  const arr = g.nodes.filter((n) => n.type === t).map((n) => n.degree);
  deg[t] = { min: Math.min.apply(null, arr), max: Math.max.apply(null, arr), uniq: new Set(arr).size };
  const rr = g.nodes.filter((n) => n.type === t).map((n) => n.r);
  radii[t] = { min: Math.min.apply(null, rr), max: Math.max.apply(null, rr) };
});

// Сколько вершин курса покрывает оглавление: нужно документации (доски вычитают его ссылки
// из file.inlinks, и это число должно совпадать с реальным содержимым заметки).
// Считаем по ТОМУ ЖЕ сгенерированному markdown, что пишет `write_index.js`/команда плагина:
// так не зависит от порядка запуска скриптов и от того, лежит ли уже файл на диске.
// Путь при этом берётся из настройки indexNote — единого источника (его правит и контекстное меню).
function countIndexLinks(md, g) {
  const stems = new Set(g.nodes.map((n) => n.stem));
  const seen = new Set();
  core.extractLinks(md).forEach((l) => {
    const t = String(l.path || "").split("|")[0].split("#")[0].replace(/\.md$/i, "").trim();
    if (t && stems.has(t)) seen.add(t);
  });
  return seen.size;
}
let indexLinks = 0;
{
  const app = { vault: { getMarkdownFiles: () => vaultNotes.walk(ROOT).map((rel) => ({ basename: rel.split("/").pop().replace(/\.md$/i, "") })) } };
  const doc = String(settings.indexGraphDoc || "").trim();
  const md = core.toIndexMarkdown(g, {
    stamp: "measurement",
    graphDoc: doc,
    resolve: (stem) => app.vault.getMarkdownFiles().some((f) => f.basename === stem),
  });
  indexLinks = countIndexLinks(md, g);
  let rel = String(settings.indexNote || "Course Index.md").trim().replace(/^\.\//, "");
  if (!/\.md$/i.test(rel)) rel += ".md";
  const abs = path.join(ROOT, rel);
  // если файл на диске есть — сверяемся с ним: он обязан совпадать с генерацией
  if (fs.existsSync(abs)) {
    const onDisk = countIndexLinks(core.parseFrontmatter(fs.readFileSync(abs, "utf8")).body, g);
    if (onDisk !== indexLinks) {
      console.error("Course Index на диске покрывает " + onDisk + " вершин, генерация — " + indexLinks + ": файл устарел, перегоните write_index.js");
      process.exitCode = 1;
    }
    indexLinks = onDisk;
  }
}

// этап 2: вес по ключевым фразам — документация обязана печатать настоящие числа
const kwNodes = g.nodes.filter((n) => n.kwWeight > 0);
const maxKwWeight = kwNodes.reduce((a, n) => Math.max(a, n.kwWeight), 0);
const statsPath = path.join(ROOT, ".vault-stats.json");
const stats = Object.assign(JSON.parse(fs.readFileSync(statsPath, "utf8")), {
  edges: g.stats.edges,
  maxDegree: g.stats.maxDegree,
  keywordEdges: g.edges.filter((e) => e.kind === "keyword").length,
  keywordNodes: kwNodes.length,
  maxKeywordWeight: maxKwWeight,
  keywordBlocksShare: Math.round((100 * kwNodes.length) / Math.max(1, g.nodes.filter((n) => n.type === "block").length)),
  unresolved: g.stats.unresolved,
  orphans: g.stats.orphanNodes,
  components: comp.count,
  degreeByType: deg,
  radiusByType: radii,
  indexLinks: indexLinks, // вершин курса, на которые ссылается оглавление
});
// метрики, которые отношлись к вершине-оглавлению, вычищаем: Object.assign выше
// дополняет файл, а не заменяет, и иначе они навсегда остались бы в поставке
["nodesWithHub", "tocEdges", "tocEdgesMeasured", "hasIndexVertex", "indexDegreeShift", "indexRadius", "indexInGraph"].forEach((k) => delete stats[k]);
// «нет фраз ни у одного блока» — не то, что должно быть в поставке: этап 2 обязан быть виден
if (!stats.keywordNodes || !stats.keywordEdges) {
  console.error("ключевые фразы не материализованы: блоков с весом " + stats.keywordNodes + ", рёбер " + stats.keywordEdges + " — запустите node apply_keywords.js");
  process.exitCode = 1;
}
fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      nodes: g.stats.nodes,
      edges: stats.edges,
      maxDegree: stats.maxDegree,
      keywordEdges: stats.keywordEdges,
      keywordNodes: stats.keywordNodes,
      maxKeywordWeight: stats.maxKeywordWeight,
      unresolved: stats.unresolved,
      orphans: stats.orphans,
      components: stats.components,
      indexLinks: stats.indexLinks,
      indexMissing: g.stats.nodes - stats.indexLinks, // вершин, которых нет в оглавлении
    },
    null,
    1
  )
);
if (g.stats.nodes !== stats.indexLinks) {
  console.error("оглавление покрывает не все вершины курса: " + stats.indexLinks + " из " + g.stats.nodes);
  process.exitCode = 1;
}
