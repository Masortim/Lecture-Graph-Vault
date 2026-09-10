/* Рендерит SVG-превью графа (тот же код, что в плагине) — чтобы результат было видно без Obsidian. */
const fs = require("fs");
const path = require("path");
const core = require("./src/graph-core.js");
// корень хранилища: <dev>/.. (инструментарий внутри) или <dev>/../Lecture-Graph-Vault
const ROOT = require("./vault-root.js")(__dirname);
const vaultNotes = require("./vault-notes.js");

// те же настройки, что у плагина в хранилище, — чтобы превью совпадало с тем, что видит пользователь
const PLUG = JSON.parse(fs.readFileSync(path.join(ROOT, ".obsidian", "plugins", "lecture-graph", "data.json"), "utf8"));

// тот же набор заметок, что строит плагин: папки из data.json + точечно вершина-оглавление
const notes = vaultNotes.collect(ROOT, PLUG).notes;

function render(name, filterTypes, opts) {
  const settings = Object.assign({}, PLUG, opts);
  const g = core.buildGraph(notes.filter((n) => filterTypes.includes(String(n.frontmatter.type))), settings);
  core.initPositions(g.nodes, { width: 1500, height: 1000, graph: g, layout: g.config.layout });
  core.run(g, { iterations: g.nodes.length > 600 ? 420 : 700, width: 1500, height: 1000, layout: g.config.layout });
  const svg = core.toSVG(g, opts.svg || {});
  const out = path.join(ROOT, "90 - Exports", name);
  fs.writeFileSync(out, svg);
  console.log(name, ":", g.stats.nodes, "узлов,", g.stats.edges, "рёбер,", (fs.statSync(out).size / 1024).toFixed(0), "KiB");
  return g;
}

const spread = (radius, linkDistance) =>
  Object.assign({}, PLUG.layout, { radius, linkDistance, repel: 2700, gravity: 0.004, radialStrength: 0.02 });

// 45 вершин: даём подписям место (большой радиус раскладки), иначе надписи наползают друг на друга
const overview = render("graph-overview.svg", ["chapter", "section"], {
  minRadius: 18, maxRadius: 48, labelFontMin: 16, labelFontMax: 26,
  layout: spread(4200, 900), svg: { labelMinRadius: 0, labelChars: 20 },
});
// весь граф курса — это то, что видит плагин: оглавление в граф не входит, и не войдёт,
// в какой бы папке его ни создали (у заметки тег #index, а collectNotes берёт только 4 типа)
const fullOpts = {
  minRadius: 3, maxRadius: 26, labelFontMin: 11, labelFontMax: 15,
  layout: spread(2600, 110), svg: { labelMinRadius: 19, labelChars: 16, pad: 80 },
};
const full = render("graph-full.svg", ["chapter", "section", "heading", "block"], fullOpts);
console.log("статистика:", JSON.stringify(full.stats));

// один и тот же граф, разные движки - чтобы «варианты отображения» можно было сравнить глазами
["fdp", "neato", "twopi", "clusters"].forEach((m) => {
  render("graph-" + m + ".svg", ["chapter", "section", "heading", "block"],
    Object.assign({}, fullOpts, { layout: Object.assign({}, fullOpts.layout, { mode: m }) }));
  // и крупный план верхних уровней: там видно, КАК именно движок разложил главы.
  // «radius 4200 / linkDistance 900» нужны только секторам (там радиус = размер колец);
  // пружинным движкам такую ссылку пришлось бы считать «желаемой длиной связи», и они
  // спокойно раздувают холст до 30 тыс. px - для них берём штатную длину связи
  render("graph-overview-" + m + ".svg", ["chapter", "section"], {
    minRadius: 18, maxRadius: 48, labelFontMin: 16, labelFontMax: 26,
    layout: m === "clusters"
      ? Object.assign({}, spread(4200, 900), { mode: m })
      : Object.assign({}, PLUG.layout, { mode: m, linkDistance: 240 }),
    svg: { labelMinRadius: 0, labelChars: 20 },
  });
});
