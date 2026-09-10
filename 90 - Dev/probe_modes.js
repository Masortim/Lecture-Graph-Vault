/* Быстрая проверка режимов раскладки: скорость, наложения, связность кластеров глав.
   Запуск: node probe_modes.js [iters] */
const fs = require("fs");
const path = require("path");
const core = require("./src/graph-core.js");
const vaultNotes = require("./vault-notes.js");

// корень хранилища: <dev>/.. (инструментарий внутри) или <dev>/../Lecture-Graph-Vault
const ROOT = require("./vault-root.js")(__dirname);
const settings = JSON.parse(fs.readFileSync(path.join(ROOT, ".obsidian/plugins/lecture-graph/data.json"), "utf8"));
const { notes } = vaultNotes.collect(ROOT, settings);
const iters = Number(process.argv[2] || 0);

const modes = ["fdp", "neato", "twopi", "clusters"];
for (const mode of modes) {
  const g = core.buildGraph(notes, settings);
  const cfg = Object.assign({}, core.DEFAULTS, settings);
  cfg.maxRadius = settings.maxRadius;
  core.applySizes(g.nodes, settings);
  const lay = Object.assign({}, settings.layout, { mode: mode });
  if (iters) lay[mode === "fdp" ? "fdpIters" : "neatoIters"] = iters;
  const t0 = Date.now();
  core.initPositions(g.nodes, { width: 1400, height: 900, graph: g, layout: lay, edges: g.edges });
  let rep = null;
  if (mode === "clusters") {
    core.run(g, { layout: lay, width: 1400, height: 900, config: settings });
  } else if (mode !== "twopi") {
    rep = core.run(g, { layout: lay, width: 1400, height: 900, config: settings });
  } else {
    rep = core.computeLayout(g, { layout: lay, width: 1400, height: 900, config: settings });
  }
  const ms = Date.now() - t0;
  // метрики
  core.applySizes(g.nodes, settings); // после сдвига вершин размеры те же, но пересчитаем флаги
  const ov = core.countPairsOverlap(g.nodes, cfg, true);
  let bad = 0;
  g.nodes.forEach((n) => { if (!isFinite(n.x) || !isFinite(n.y)) bad++; });
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  g.nodes.forEach((n) => { b.x0 = Math.min(b.x0, n.x); b.x1 = Math.max(b.x1, n.x); b.y0 = Math.min(b.y0, n.y); b.y1 = Math.max(b.y1, n.y); });
  // компактность глав: средний радиус пятна главы vs расстояние между центроидами
  const byId = {};
  g.nodes.forEach((n) => (byId[n.id] = n));
  const cen = {};
  g.nodes.forEach((n) => {
    const c = n.chapter;
    if (!c) return;
    (cen[c] || (cen[c] = { x: 0, y: 0, n: 0, r: 0 }));
    cen[c].x += n.x; cen[c].y += n.y; cen[c].n++;
  });
  Object.keys(cen).forEach((k) => { cen[k].x /= cen[k].n; cen[k].y /= cen[k].n; });
  let spread = 0, cnt = 0;
  g.nodes.forEach((n) => {
    const c = cen[n.chapter];
    if (!c) return;
    spread += Math.hypot(n.x - c.x, n.y - c.y); cnt++;
  });
  const ids = Object.keys(cen);
  let gap = 0;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++)
    gap = Math.max(gap, Math.hypot(cen[ids[i]].x - cen[ids[j]].x, cen[ids[i]].y - cen[ids[j]].y));
  // пересечения структурных рёбер (прямыми) — сколько пар пересекается
  const struct = g.edges.filter((e) => e.kind === "structure");
  let cross = 0;
  const seg = struct.map((e) => [byId[e.source], byId[e.target], e]).filter((s) => s[0] && s[1]);
  for (let i = 0; i < seg.length; i++) {
    for (let j = i + 1; j < seg.length; j++) {
      const A = seg[i], B = seg[j];
      if (A[2].source === B[2].source || A[2].source === B[2].target || A[2].target === B[2].source || A[2].target === B[2].target) continue;
      const o1 = (B[1].x - B[0].x) * (A[0].y - B[0].y) - (B[1].y - B[0].y) * (A[0].x - B[0].x);
      const o2 = (B[1].x - B[0].x) * (A[1].y - B[0].y) - (B[1].y - B[0].y) * (A[1].x - B[0].x);
      const o3 = (A[1].x - A[0].x) * (B[0].y - A[0].y) - (A[1].y - A[0].y) * (B[0].x - A[0].x);
      const o4 = (A[1].x - A[0].x) * (B[1].y - A[1].y) - (A[1].y - A[0].y) * (B[1].x - A[1].x);
      if ((o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0)) cross++;
    }
  }
  const labeled = g.nodes.filter((n) => n.labelShown).length;
  console.log(
    mode.padEnd(9),
    String(ms).padStart(6) + " ms",
    "· bbox " + Math.round(b.x1 - b.x0) + "×" + Math.round(b.y1 - b.y0),
    "· нечисловых " + bad,
    "· наложений(после polish) " + ov,
    "· подписей " + labeled,
    "· пересечений структуры " + cross,
    rep ? "· polish: проходов " + rep.passes + ", макс.сдвиг " + rep.maxShift + ", cap " + Math.round(rep.cap) : "",
    "· пятно/разлёт глав " + Math.round(spread / Math.max(1, cnt)) + "/" + Math.round(gap / 2)
  );
}
