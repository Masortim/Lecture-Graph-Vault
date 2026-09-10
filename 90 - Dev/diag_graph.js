/* Диагностика геометрии графа лекций: пересечения рёбер-структуры, наложения кругов и
   подписей, судьба вершин глав. Работает на реальных данных хранилища тем же кодом, что
   и плагин (src/graph-core.js), поэтому цифры можно сверять с тем, что видно в Obsidian.
   Запуск: node diag_graph.js [--sizes N] [--mode fdp|neato|twopi|clusters|force]
   (--sizes имитирует перетаскивание ползунка «Размер вершин» при выключенной физике — баг №2;
   --mode проверяет геометрию конкретного движка). Провал, если остались наложения кругов или
   подписей (это инвариант для всех режимов) либо пересечения структуры в режиме clusters. */
const fs = require("fs");
const path = require("path");
const core = require("./src/graph-core.js");
const vaultNotes = require("./vault-notes.js");

// корень хранилища: <dev>/.. (инструментарий внутри) или <dev>/../Lecture-Graph-Vault
const ROOT = require("./vault-root.js")(__dirname);
const settings = JSON.parse(fs.readFileSync(path.join(ROOT, ".obsidian/plugins/lecture-graph/data.json"), "utf8"));
const args = process.argv.slice(2);
const sizeTo = args.includes("--sizes") ? Number(args[args.indexOf("--sizes") + 1] || 0) : 0;
if (args.includes("--mode")) settings.layout.mode = args[args.indexOf("--mode") + 1];
const MODE = settings.layout.mode;
const ENGINE = MODE === "fdp" || MODE === "neato" || MODE === "twopi";
const fails = [];

const { notes } = vaultNotes.collect(ROOT, settings);
const graph = core.buildGraph(notes, settings);
const cfg = Object.assign({}, core.DEFAULTS, settings);
core.applySizes(graph.nodes, settings);
core.initPositions(graph.nodes, { width: 1400, height: 900, graph, layout: settings.layout });
core.run(graph, { layout: settings.layout, width: 1400, height: 900 });
let rep2 = null;
if (sizeTo) {
  // как это делает view.applySizesNow(): пересчитали радиусы -> упаковали заново,
  // физику при этом никто не включает (баг №2: граф «съезжался» в кучу)
  settings.maxRadius = sizeTo;
  core.applySizes(graph.nodes, settings);
  if (ENGINE) {
    rep2 = core.polishNoOverlap(graph, Object.assign({}, settings, settings.layout), { labels: true });
  } else {
    graph.nodes.forEach((n) => { n.tx = n.x; n.ty = n.y; });
    core.packAroundAnchors(graph, { layout: settings.layout, passes: 20, pull: 0.45 });
  }
}
const ctrOf = () => graph._center || (() => {
  const b = core.bounds(graph.nodes);
  return { cx: b.cx, cy: b.cy, R: Math.max(b.w, b.h) / 2 };
})();

const vis = core.filterNodes(graph, {
  types: core.TYPES.filter((t) => (settings.filters.types || {})[t] !== false),
  minDegree: settings.filters.minDegree || 0,
  chapter: settings.filters.chapter || null,
  hidePlaceholders: !!settings.filters.hidePlaceholders,
  query: "",
});
const nodes = vis.length ? vis : graph.nodes;
const byType = {};
graph.nodes.forEach((n) => (byType[n.type] = (byType[n.type] || 0) + 1));
const visByType = {};
nodes.forEach((n) => (visByType[n.type] = (visByType[n.type] || 0) + 1));
console.log("вершин всего:", byType, " видимых:", visByType, " (фильтры из data.json)");

const ch = graph.nodes.filter((n) => n.type === "chapter");
console.log("\nглавы: r / степень / координаты / сколько соседей на том же месте");
ch.forEach((n) => {
  const near = graph.nodes.filter((m) => m !== n && Math.hypot(m.x - n.x, m.y - n.y) < n.r).length;
  console.log("  %s r=%s deg=%s  x=%s y=%s  совпадают с %d другими", n.id, n.r.toFixed(1), n.degree,
    n.x.toFixed(1), n.y.toFixed(1), near);
});

/* наложения кругов */
let overlaps = 0, worst = [];
for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const need = (a.r || 6) + (b.r || 6);
    if (d < need - 0.5) {
      overlaps++;
      if (worst.length < 5) worst.push(a.id + "×" + b.id + " (" + (need - d).toFixed(1) + " px)");
    }
  }
}
console.log("\nналожений кругов:", overlaps, worst.join(", "));

/* наложения подписей: ровно тем же способом, каким подпись измеряет и рисует плагин
   (core.labelRectOf: две строки EN + 中文, обрезанные до labelChars) */
function labelBox(n) {
  const r = core.labelRectOf(n);
  if (!r) return null;
  return { x: r.x0, y: r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0, id: n.id };
}
const boxes = nodes.map(labelBox).filter(Boolean);
let lab = 0, labEx = [];
for (let i = 0; i < boxes.length; i++) {
  for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
      lab++;
      if (labEx.length < 5) labEx.push(a.id + "×" + b.id);
    }
  }
}
console.log("подписей показано:", boxes.length, " пересечений подписей:", lab, labEx.join(", "));

/* пересечения рёбер-структуры (глава/секция/заголовок) */
function segX(p1, p2, p3, p4) {
  const d = (b, a, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p2, p1, p3), d2 = d(p2, p1, p4), d3 = d(p4, p3, p1), d4 = d(p4, p3, p2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
const byId = {};
graph.nodes.forEach((n) => (byId[n.id] = n));
const struct = graph.edges.filter((e) => e.kind === "structure" && byId[e.source] && byId[e.target])
  .map((e) => ({ a: byId[e.source], b: byId[e.target] }))
  .filter((e) => e.a !== e.b);
let cross = 0, crossEx = [];
for (let i = 0; i < struct.length; i++) {
  for (let j = i + 1; j < struct.length; j++) {
    const u = struct[i], v = struct[j];
    if (u.a === v.a || u.a === v.b || u.b === v.a || u.b === v.b) continue; // общие концы — не пересечение
    if (segX(u.a, u.b, v.a, v.b)) {
      cross++;
      if (crossEx.length < 5) crossEx.push(u.a.id + "–" + u.b.id + " × " + v.a.id + "–" + v.b.id);
    }
  }
}
console.log("структурных рёбер:", struct.length, " пересечений между собой (прямыми):", cross, crossEx.join(", "));

/* то же самое, но дугами — как рисует redraw(): кривую Ребро разбиваем на 8 отрезков */
const _c0 = ctrOf();
const ctr = { x: _c0.cx, y: _c0.cy };
function arcPts(a, b, kind) {
  const path = core.edgePath(a, b, settings.curvature === undefined ? 0.24 : settings.curvature, ctr, kind);
  const m = path.match(/M([-\d.]+) ([-\d.]+)Q([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)/);
  if (!m) return [];
  const p0 = { x: +m[1], y: +m[2] }, p1 = { x: +m[3], y: +m[4] }, p2 = { x: +m[5], y: +m[6] };
  const out = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, u = 1 - t;
    out.push({ x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y });
  }
  return out;
}
const arcs = struct.map((e) => ({ id: e.a.id + "–" + e.b.id, a: e.a, b: e.b, pts: arcPts(e.a, e.b, "structure") }));
let arcCross = 0, arcEx = [];
for (let i = 0; i < arcs.length; i++) {
  for (let j = i + 1; j < arcs.length; j++) {
    const u = arcs[i], v = arcs[j];
    if (!u.pts.length || !v.pts.length) continue;
    if (u.a === v.a || u.a === v.b || u.b === v.a || u.b === v.b) continue; // общий конец — не пересечение
    let hit = false;
    for (let a = 0; a + 1 < u.pts.length && !hit; a++) {
      for (let b = 0; b + 1 < v.pts.length && !hit; b++) {
        if (segX(u.pts[a], u.pts[a + 1], v.pts[b], v.pts[b + 1])) hit = true;
      }
    }
    if (hit) { arcCross++; if (arcEx.length < 5) arcEx.push(u.id + " × " + v.id); }
  }
}
console.log("пересечений структурных дуг:", arcCross, arcEx.join(", "));
const _c = ctrOf();
console.log("режим:", MODE, " R =", Math.round(_c.R), " центр", Math.round(ctr.x) + "," + Math.round(ctr.y),
  ENGINE ? " · пост-обработка: проходов " + (rep2 ? rep2.passes : "—") : "");

/* инварианты: чистые метки и круги — у всех режимов; отсутствие пересечений структуры —
   только у clusters (пружинные движки по определению их не гарантируют) */
if (overlaps > 0) fails.push("наложения кругов: " + overlaps);
if (lab > 0) fails.push("пересечения подписей: " + lab);
if (graph.nodes.some((n) => !isFinite(n.x) || !isFinite(n.y))) fails.push("бесконечные координаты");
if (MODE === "clusters" && (cross > 0 || arcCross > 0)) fails.push("пересечения структуры: " + cross + "/" + arcCross);
console.log("\nинварианты:", fails.length ? "ПРОВАЛ — " + fails.join("; ") : "ok");
if (fails.length) process.exitCode = 1;

/* сколько дуг пришлось бы «выпрямить»: пересечения всех рёбер для справки */
const all = graph.edges.filter((e) => byId[e.source] && byId[e.target]).map((e) => ({ a: byId[e.source], b: byId[e.target] }));
let allc = 0;
for (let i = 0; i < all.length; i++) {
  for (let j = i + 1; j < all.length; j++) {
    const u = all[i], v = all[j];
    if (u.a === v.a || u.a === v.b || u.b === v.a || u.b === v.b) continue;
    if (segX(u.a, u.b, v.a, v.b)) allc++;
  }
}
console.log("всего рёбер:", all.length, " пересечений всех рёбер:", allc);
