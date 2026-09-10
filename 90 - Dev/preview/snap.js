/*
 * Снимок ЖИВОГО графа в SVG: то, что видит пользователь в окне плагина (с учётом
 * зума, читаемых подписей и выделения), а не модельный экспорт core.toSVG().
 *
 *   node "90 - Dev/preview/snap.js" out.svg [--zoom 1|--node Ch01|--fit]
 *
 * Стиль инлайнится в сам файл: снаружи CSS плагина нет. Толщины линий переведены
 * из «экранных пикселей» (vector-effect: non-scaling-stroke) в модельные, чтобы
 * растр совпадал с картинкой в Obsidian.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const PORT = Number(process.env.PORT || 3112);
const W = 1400, H = 900;
const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--")) || path.join(__dirname, "snap.svg");
const flag = (name) => {
  const a = args.find((x) => x.startsWith("--" + name + "="));
  return a ? a.slice(name.length + 3) : null;
};

const server = require("child_process").spawn(process.execPath, [path.join(__dirname, "server.js"), String(PORT)], {
  cwd: path.resolve(__dirname, ".."),
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
server.stdout.on("data", (d) => (log += d));
server.stderr.on("data", (d) => (log += d));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async function main() {
  await wait(700);
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => console.log("  [страница] " + (e && e.message ? e.message : e)));
  const dom = await JSDOM.fromURL("http://127.0.0.1:" + PORT + "/", {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const win = dom.window;
  for (let i = 0; i < 120 && !win.__LG_VIEW__; i++) await wait(250);
  const view = win.__LG_VIEW__;
  if (!view) {
    console.log("представление не создано\n" + log);
    server.kill();
    process.exit(1);
  }
  // окно фиксированного размера: иначе jsdom отдаёт clientWidth = 0
  view.width = () => W;
  view.height = () => H;
  view.fit();
  const z = flag("zoom");
  if (z) view.zoomBy(Number(z));
  const nodeId = flag("node");
  if (nodeId) {
    const n = view.graph.nodes.find((x) => x.id === nodeId || x.name === nodeId);
    if (n) {
      // приближаем к вершине, чтобы было видно подписи и выделенные связи
      const p = { x: n.x * view.view.k + view.view.x, y: n.y * view.view.k + view.view.y };
      view.view.x += W / 2 - p.x;
      view.view.y += H / 2 - p.y;
      view.zoomBy(Number(flag("zoom") || 4));
      view.select(n.id);
    }
  }
  view.redraw();
  view.updateLabels();

  const k = view.view.k;
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  const rule = (sel) => ((css.match(new RegExp("\\" + sel + "\\s*\\{[^}]*\\}")) || [""])[0] || "");
  const style = [
    rule(".lg-edges--ref"), rule(".lg-edges--struct"), rule(".lg-edges--sel"),
    rule(".lg-node circle"), rule(".lg-label"), rule(".lg-label-en"), rule(".lg-label-zh"),
    rule(".lg-node--selected circle"), rule(".lg-node--neigh circle"), rule(".lg-node--dim"),
  ].join("\n").replace(/var\(--background-primary\)/g, "#1e1e1e")
    .replace(/var\(--text-muted\)/g, "#999").replace(/var\(--text-faint\)/g, "#6b6b6b")
    .replace(/var\(--text-normal\)/g, "#dadada").replace(/var\(--interactive-accent[^)]*\)/g, "#8a7bf5")
    // «экранные» толщины -> модельные (k текущего вида)
    .replace(/stroke-width:\s*([\d.]+)px/g, (m, v) => "stroke-width: " + (Number(v) / k).toFixed(2) + "px")
    .replace(/stroke-width:\s*([\d.]+);/g, (m, v) => "stroke-width: " + (Number(v) / k).toFixed(2) + ";");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="100%" height="100%" fill="#1e1e1e"/><style>${style}</style>` +
    view.svg.innerHTML.replace(/ style="display: ?none;?"/g, "") +
    "</svg>";
  fs.writeFileSync(out, svg);
  console.log(out + ": k=" + k.toFixed(4) + ", " + fs.statSync(out).size + " байт");
  dom.window.close();
  server.kill();
  process.exit(0);
})();
