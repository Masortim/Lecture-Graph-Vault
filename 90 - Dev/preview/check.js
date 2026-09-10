/*
 * Дымовая проверка предпросмотра: поднимает preview/server.js, открывает страницу
 * в jsdom (реальный bundle.js + реальное хранилище) и смотрит, что граф построился,
 * подписи читаемые, кнопки зума на месте, а выделение красит связи своим цветом.
 *
 *   node "90 - Dev/preview/check.js"
 */
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const PORT = Number(process.env.PORT || 3111);
const url = "http://127.0.0.1:" + PORT + "/";
const server = require("child_process").spawn(process.execPath, [path.join(__dirname, "server.js"), String(PORT)], {
  cwd: path.resolve(__dirname, ".."),
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

let pass = 0;
const fails = [];
function ok(name, fn) {
  try {
    fn();
    pass++;
    console.log("  ok   " + name);
  } catch (e) {
    fails.push(name);
    console.log("  FAIL " + name + "\n       " + (e && e.message ? e.message : e));
  }
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** То же, что ok(), но для проверок, которым нужно ждать асинхронную работу плагина. */
async function okAsync(name, fn) {
  try {
    await fn();
    pass++;
    console.log("  ok   " + name);
  } catch (e) {
    fails.push(name);
    console.log("  FAIL " + name + "\n       " + (e && e.message ? e.message : e));
  }
}

(async function main() {
  await wait(700); // сервер успел подняться
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => console.log("  [страница] " + (e && e.message ? e.message : e)));
  const dom = await JSDOM.fromURL(url, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const win = dom.window;
  for (let i = 0; i < 120 && !win.__LG_VIEW__; i++) await wait(250);
  const view = win.__LG_VIEW__;
  const doc = win.document;

  ok("предпросмотр открылся и построил граф", () => {
    if (!view) throw new Error("представление не создано\n" + serverLog.slice(0, 800));
    if (!view.graph || !view.graph.nodes.length) throw new Error("граф пустой");
  });
  if (!view) {
    server.kill();
    process.exit(1);
  }
  console.log("       вершин " + view.graph.stats.nodes + ", рёбер " + view.graph.stats.edges +
    ", k после fit " + view.view.k.toFixed(4));

  ok("на холсте есть кнопки «+» и «−» и индикатор масштаба", () => {
    const btns = Array.from(doc.querySelectorAll("button.lg-zoom__btn")).map((b) => b.textContent.trim());
    if (!btns.includes("+") || !btns.includes("\u2212")) throw new Error("кнопки: " + JSON.stringify(btns));
    if (!doc.querySelector(".lg-zoom__val")) throw new Error("нет индикатора масштаба");
  });

  ok("кнопки зума меняют масштаб", () => {
    const k0 = view.view.k;
    const plus = Array.from(doc.querySelectorAll("button.lg-zoom__btn")).find((b) => b.textContent.trim() === "+");
    plus.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    if (!(view.view.k > k0 * 1.2)) throw new Error("«+» не увеличил: " + k0 + " -> " + view.view.k);
    const minus = Array.from(doc.querySelectorAll("button.lg-zoom__btn")).find((b) => b.textContent.trim() === "\u2212");
    minus.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    if (Math.abs(view.view.k - k0) > 1e-9) throw new Error("«−» не вернул: " + view.view.k);
  });

  ok("вершины и подписи читаемы на весь граф", () => {
    view.fit();
    const nodes = view.graph.nodes.filter((n) => view.visible[n.id]);
    const rs = nodes.map((n) => parseFloat(view.nodeEls[n.id].querySelector("circle").getAttribute("r")) * view.view.k)
      .sort((a, b) => a - b);
    const rMin = rs[0], rMed = rs[rs.length >> 1];
    const labels = nodes.filter((n) => view.nodeEls[n.id].__t.getAttribute("style") === "display:block");
    const fMin = Math.min(...labels.map((n) => parseFloat(view.nodeEls[n.id].__t.getAttribute("font-size")) * view.view.k));
    const fMax = Math.max(...labels.map((n) => parseFloat(view.nodeEls[n.id].__t.getAttribute("font-size")) * view.view.k));
    if (!(rMin > 1.2)) throw new Error("вершина мельче 1.2 px: " + rMin.toFixed(2));
    if (!(rMed > 2)) throw new Error("медианная вершина мельче 2 px: " + rMed.toFixed(2));
    if (!(fMin > 8)) throw new Error("кегль мельче 8 px: " + fMin.toFixed(2));
    if (!(fMax < 40)) throw new Error("кегль больше 40 px: " + fMax.toFixed(2));
    if (labels.length < 12) throw new Error("подписей видно слишком мало: " + labels.length);
    // круги не должны слипаться в пятно: потолок радиуса — половина расстояния до соседа
    const pts = nodes.map((n) => ({ x: n.x, y: n.y, r: parseFloat(view.nodeEls[n.id].querySelector("circle").getAttribute("r")) }));
    const cell = 220, grid = {};
    pts.forEach((p, i) => { const key = Math.round(p.x / cell) + ":" + Math.round(p.y / cell); (grid[key] = grid[key] || []).push(i); });
    let pairs = 0;
    for (let i = 0; i < pts.length; i++) {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const lst = grid[(Math.round(pts[i].x / cell) + dx) + ":" + (Math.round(pts[i].y / cell) + dy)];
        if (!lst) continue;
        for (const j of lst) if (j > i && Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < pts[i].r + pts[j].r - 0.5) pairs++;
      }
    }
    console.log("       видно подписей " + labels.length + ", кегль " + fMin.toFixed(1) + "–" + fMax.toFixed(1) + " px");
    console.log("       радиус вершин " + rs[0].toFixed(2) + "–" + rs[rs.length - 1].toFixed(2) + " px (медиана " +
      rs[rs.length >> 1].toFixed(2) + "), слипшихся пар кругов " + pairs + " из " + nodes.length + " вершин");
    if (pairs > nodes.length * 0.12) throw new Error("круги слипаются: " + pairs + " пар");
  });

  ok("A+ увеличивает подписи, A− возвращает", () => {
    const n = view.graph.nodes.find((x) => x.type === "chapter");
    const fontOf = () => parseFloat(view.nodeEls[n.id].__t.getAttribute("font-size")) * view.view.k;
    const before = fontOf();
    Array.from(doc.querySelectorAll("button")).find((b) => b.textContent.trim() === "A+")
      .dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    if (!(fontOf() > before * 1.1)) throw new Error("A+ не увеличил: " + before.toFixed(1) + " -> " + fontOf().toFixed(1));
    Array.from(doc.querySelectorAll("button")).find((b) => b.textContent.trim() === "A\u2212")
      .dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    if (Math.abs(fontOf() - before) > 0.1) throw new Error("A− не вернул: " + fontOf().toFixed(1));
  });

  ok("выбор вершины подсвечивает все её связи", () => {
    const n = view.graph.nodes.find((x) => x.type === "chapter");
    const deg = view.graph.edges.filter((e) => e.source === n.id || e.target === n.id).length;
    view.select(n.id);
    const d = view.edgesSel.getAttribute("d") || "";
    if ((d.match(/M/g) || []).length !== deg) throw new Error("нарисовано " + (d.match(/M/g) || []).length + " дуг из " + deg);
    const css = require("fs").readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
    const rule = (css.match(/\.lg-edges--sel\s*\{[^}]*\}/) || [""])[0];
    if (!/interactive-accent/.test(rule)) throw new Error("цвет выделения не акцентный: " + rule);
    view.select(null);
  });

  await okAsync("Delete у выделенной вершины: окно с последствиями, отмена, удаление и Undo", async () => {
    const plugin = win.__LG_PLUGIN__;
    const n = view.graph.nodes.find((x) => x.type === "heading");
    const siblings = view.graph.nodes.length;
    view.select(n.id, true);
    if (view.delBtn.disabled) throw new Error("кнопка удаления выключена при выделенной вершине");
    win.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    let deadline = Date.now() + 30000;
    while (Date.now() < deadline && !plugin.deleteModal) await wait(120);
    const modal = plugin.deleteModal;
    if (!modal || !modal.isOpen) throw new Error("окно удаления не открылось по клавише Delete");
    const text = modal.contentEl.textContent;
    if (text.indexOf(n.path) < 0) throw new Error("в окне нет пути заметки");
    const plan = await plugin.deletePlan(n.id);
    if (plan.refs.length && text.indexOf("Ссылки снимутся в " + plan.refs.length) < 0)
      throw new Error("число ссылающихся заметок не совпало с планом (" + plan.refs.length + ")");
    if (plan.children.length && text.indexOf("Дочерних вершин: " + plan.children.length) < 0)
      throw new Error("число детей не совпало с планом (" + plan.children.length + ")");
    const cancel = Array.from(modal.contentEl.querySelectorAll("button")).find((b) => b.textContent === "Отмена");
    cancel.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    if (modal.isOpen) throw new Error("окно не закрылось по «Отмена»");
    if (view.graph.nodes.length !== siblings) throw new Error("отмена изменила граф");

    const res = await plugin.deleteNode(plan);
    if (!res || res.plan.node.id !== n.id) throw new Error("удаление не прошло");
    let g2 = await plugin.getGraph(false);
    if (g2._byId[n.id]) throw new Error("вершина осталась в графе предпросмотра");
    if (g2.stats.unresolved !== 0) throw new Error("битые ссылки после удаления: " + g2.stats.unresolved);
    if (g2.nodes.length !== siblings - 1) throw new Error("вершин: " + g2.nodes.length + " вместо " + (siblings - 1));
    await plugin.undoDelete();
    g2 = await plugin.getGraph(false);
    if (!g2._byId[n.id]) throw new Error("Undo не вернул вершину");
    if (g2.stats.unresolved !== 0) throw new Error("битые ссылки после отмены: " + g2.stats.unresolved);
  });

  dom.window.close();
  server.kill();
  console.log("\n" + pass + " проверок пройдено" + (fails.length ? ", упало: " + fails.join("; ") : ""));
  process.exit(fails.length ? 1 : 0);
})();
