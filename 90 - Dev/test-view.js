/*
 * e2e-тест собранного main.js плагина lecture-graph в jsdom со стабом API Obsidian.
 * Работает на КОПИИ хранилища в /tmp — реальные файлы не трогаются.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("assert");
const { JSDOM } = require("jsdom");
const core = require("./src/graph-core.js");

// Dev находится внутри корня vault, поэтому fixture — родительская папка.
const ROOT = path.resolve(__dirname, "..");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lg-vault-"));
const PLUGIN_DIR = path.join(ROOT, ".obsidian", "plugins", "lecture-graph");

/* ---------- jsdom ---------- */
const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
  pretendToBeVisual: true,
  url: "app://obsidian.md/",
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.getComputedStyle = dom.window.getComputedStyle;
global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

/* резолвим require("obsidian") из плагина на наш стаб (плагин лежит вне dev/) */
const Module = require("module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === "obsidian") return path.join(__dirname, "node_modules", "obsidian", "index.js");
  return origResolve.call(this, request, ...args);
};

const obsidian = require("obsidian"); // стаб
obsidian.installDomExtensions(dom.window); // createEl/createDiv — как в Obsidian
dom.window.__lgDomInstalled = true;
assert.strictEqual(typeof dom.window.document.createElement("div").createDiv, "function",
  "стаб не навесил DOM-расширения: тесты пойдут не туда");
const PluginClass = require(path.join(PLUGIN_DIR, "main.js"));
const { Vault, Workspace, MetadataCache, Notice, TFile } = obsidian;

/* ---------- копия хранилища ---------- */
function copyVault(src, dst, rel) {
  rel = rel || "";
  for (const ent of fs.readdirSync(path.join(src, rel), { withFileTypes: true })) {
    if (ent.name.startsWith(".") || ent.name === "node_modules") continue;
    const r = rel ? rel + "/" + ent.name : ent.name;
    if (ent.isDirectory()) copyVault(src, dst, r);
    else if (r.endsWith(".md")) {
      const to = path.join(dst, r);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(path.join(src, r), to);
    }
  }
}
copyVault(ROOT, TMP);
// настройки плагина — ровно из поставки: иначе e2e проверяет конфигурацию, которой
// у пользователя нет (в прошлых раундах на этом уже ловились расхождения)
{
  const dst = path.join(TMP, ".obsidian", "plugins", "lecture-graph");
  fs.mkdirSync(dst, { recursive: true });
  fs.copyFileSync(path.join(ROOT, ".obsidian", "plugins", "lecture-graph", "data.json"), path.join(dst, "data.json"));
}

let pass = 0;
async function ok(name, fn) {
  try {
    await fn();
    pass++;
    console.log("  ok   " + name);
  } catch (e) {
    console.log("  FAIL " + name + "\n       " + (e && e.stack ? e.stack.split("\n").slice(0, 4).join("\n       ") : e));
    process.exitCode = 1;
  }
}

/* ---------- приложение ---------- */
const app = { };
app.vault = new Vault(TMP);
app.metadataCache = new MetadataCache(app.vault);
app.workspace = new Workspace(app);
app.keymap = { pushScope() {}, popScope() {} };
app.scope = new obsidian.Scope();
app.fileManager = new obsidian.FileManager(app);
app.configDir = path.join(TMP, ".obsidian");
const manifest = JSON.parse(fs.readFileSync(path.join(PLUGIN_DIR, "manifest.json"), "utf8"));
const STATS = JSON.parse(fs.readFileSync(path.join(ROOT, ".vault-stats.json"), "utf8"));
const NODES = STATS.nodes; // вершины курса: оглавление в граф не входит
const plugin = new PluginClass(app, manifest);

(async function main() {
  console.log("== загрузка плагина ==");
  await ok("onload: команды, ribbon, настройки, представление зарегистрированы", async () => {
    await plugin.onload();
    assert.ok(plugin.commands.length >= 6, "commands " + plugin.commands.length);
    const ids = plugin.commands.map((c) => c.id);
    ["open-view", "edit-label", "rebuild", "export-svg", "export-csv", "labels-note", "write-counts", "merge-duplicates", "merge-current-note-duplicates", "undo-merge-duplicates"].forEach((id) =>
      assert.ok(ids.includes(id), "missing command " + id)
    );
    assert.strictEqual(plugin.ribbon.length, 1);
    assert.strictEqual(plugin.settingTabs.length, 1);
    assert.ok(plugin.views["lecture-graph-view"], "view not registered");
    assert.strictEqual(plugin.settings.nameKey, "name");
    assert.strictEqual(plugin.settings.nameZhKey, "name_zh");
  });

  const leaf = await plugin.activateView();
  const view = leaf.view;
  await ok("представление открыто и граф построен из заметок", async () => {
    assert.ok(view, "no view");
    assert.ok(view.graph, "graph not built on onOpen");
    const s = view.graph.stats;
    assert.strictEqual(s.byType.chapter, STATS.chapters);
    assert.strictEqual(s.byType.section, STATS.sections);
    assert.strictEqual(s.byType.heading, STATS.headings);
    assert.strictEqual(s.byType.block, STATS.blocks);
    assert.strictEqual(s.unresolved, 0, "unresolved links " + s.unresolved);
    assert.strictEqual(s.nodes, NODES, "вершин: " + s.nodes);
    assert.strictEqual(s.byType.index || 0, 0, "в графе появилась вершина-оглавление");
    assert.strictEqual(s.edges, STATS.edges, "рёбра курса: " + s.edges + " vs " + STATS.edges);
    assert.ok(s.edges > 2500, "edges " + s.edges);
    // счётчики фильтра несёт карточка в углу холста (строки состояния больше нет)
    assert.ok(String(view.cardMsg).includes("nodes"), "нет счётчиков фильтра: " + view.cardMsg);
  });

  await ok("DOM: по одному узлу на вершину, координаты конечны, физика остановилась", async () => {
    view.frozen = true;
    view.stopLoop();
    assert.strictEqual(view.nodesLayer.querySelectorAll("circle").length, view.graph.stats.nodes, "кругов");
    assert.strictEqual(view.nodesLayer.querySelectorAll("rect").length, 0, "в сцене появился rect вершины-оглавления");
    assert.strictEqual(view.nodesLayer.querySelectorAll("g.lg-node").length, view.graph.stats.nodes);
    const bad = view.graph.nodes.filter((n) => !isFinite(n.x) || !isFinite(n.y));
    assert.strictEqual(bad.length, 0, "non-finite: " + bad.length);
    assert.ok(view.edgesRef.getAttribute("d").length > 1000, "edges path empty");
    assert.ok(view.edgesStruct.getAttribute("d").length > 1000, "structure path empty");
  });

  await ok("подпись вершины — ровно 2 строки: EN и 中文", async () => {
    const node = view.graph.nodes.find((n) => n.type === "chapter");
    const g = view.nodeEls[node.id];
    const tspans = g.querySelectorAll("tspan");
    assert.strictEqual(tspans.length, 2, "tspans " + tspans.length);
    // рисуем ОБРЕЗАННУЮ подпись (иначе длинные названия гарантированно наезжают друг
    // на друга); full name остаётся в данных и в свойствах заметки
    assert.strictEqual(tspans[0].textContent, node.labelEn);
    assert.strictEqual(tspans[1].textContent, node.labelZh);
    assert.ok(String(node.name).indexOf(String(node.labelEn).replace(/\u2026$/, "")) === 0,
      "подпись не является началом названия: " + node.labelEn + " / " + node.name);
    assert.ok(node.labelEn.length <= node.labelChars, "подпись длиннее разрешённой");
    assert.ok(node.name.length > node.labelEn.length ? /\u2026$/.test(node.labelEn) : true,
      "длинное название не обрезано многоточием");
    assert.doesNotMatch(tspans[0].textContent, /[一-鿿]/, "EN line contains CJK");
    assert.match(tspans[1].textContent, /[一-鿿]/, "ZH line has no CJK");
    assert.strictEqual(tspans[0].getAttribute("class"), "lg-label-en");
    assert.strictEqual(tspans[1].getAttribute("class"), "lg-label-zh");
  });

  await ok("радиус = число входящих ссылок (атрибут r в SVG следует за degree)", async () => {
    const blocks = view.graph.nodes.filter((n) => n.type === "block");
    const lo = blocks.reduce((a, b) => (b.degree < a.degree ? b : a));
    const hi = blocks.reduce((a, b) => (b.degree > a.degree ? b : a));
    const rLo = parseFloat(view.nodeEls[lo.id].querySelector("circle").getAttribute("r"));
    const rHi = parseFloat(view.nodeEls[hi.id].querySelector("circle").getAttribute("r"));
    assert.ok(hi.degree > lo.degree * 8, `degree spread ${lo.degree}..${hi.degree}`);
    assert.ok(rHi > rLo * 1.5, `radius spread ${rLo}..${rHi}`);
    const all = view.graph.nodes.map((n) => n.r);
    assert.ok(Math.min(...all) >= plugin.settings.minRadius - 1e-9);
    assert.ok(Math.max(...all) <= plugin.settings.maxRadius + 1e-9);
  });

  await ok("команда write-index: оглавление совпадает с поставленным и ссылки живые", async () => {
    const cmd = plugin.commands.find((c) => c.id === "write-index");
    assert.ok(cmd, "нет команды write-index");
    await plugin.getGraph(true); // грим граф, чтобы сравнивать без артефактов кэша
    const shipped = fs.readFileSync(path.join(ROOT, "Course Index.md"), "utf8");
    const file = await cmd.callback();
    assert.ok(file && file.path === "Course Index.md", "path " + (file && file.path));
    const written = fs.readFileSync(path.join(TMP, file.path), "utf8");
    const strip = (t) => t.split("\n").filter((l) => !l.startsWith("*пересобрано:")).join("\n");
    if (strip(written) !== strip(shipped)) {
      const A2 = strip(written).split("\n"), B2 = strip(shipped).split("\n"), out = [];
      for (let i = 0; i < Math.max(A2.length, B2.length) && out.length < 3; i++) {
        const X = B2[i] || "", Y = A2[i] || "";
        if (X === Y) continue;
        let k = 0;
        while (k < X.length && X[k] === Y[k]) k++;
        out.push("стр." + i + "@" + k + ": CLI …" + JSON.stringify(X.slice(Math.max(0, k - 14), k + 60)) +
          " | плагин …" + JSON.stringify(Y.slice(Math.max(0, k - 14), k + 60)));
      }
      throw new assert.AssertionError({ message: "оглавление из плагина отличается от CLI — строк " +
        A2.filter((l, i) => l !== B2[i]).length + " (A2=" + A2.length + ", B2=" + B2.length + ") | " + out.join(" ;; ") });
    }
    await cmd.callback();
    const again = fs.readFileSync(path.join(TMP, file.path), "utf8");
    assert.strictEqual(strip(again), strip(written), "повторный запуск изменил содержимое");
    assert.match(again, /^\*пересобрано: \d{4}-\d{2}-\d{2} \d{2}:\d{2}\*$/m, "нет свежей метки пересборки");
    assert.ok(/---\ntype: index\n/.test(written), "нет frontmatter");
    assert.match(written, /## Ch01 \u00B7 Metric Spaces and Completion/, "нет заголовка главы");
    // уровни оглавления — сворачиваемые callout'ы с цветной полоской (глубина цитаты = уровень)
    assert.match(written, /^> \[!chapter\]\+ .*\[\[Ch01 - Metric Spaces and Completion\|/m, "нет полоски главы");
    assert.match(written, /^> > \[!section\]\+ .*`Ch09-S04` \u00B7 \[\[Ch09-S04 - /m, "нет полоски секции Ch09-S04");
    assert.match(written, /^> > > \[!heading\]\+ .*\[\[Ch01-S01-H01 - /m, "нет полоски заголовка");
    assert.match(written, /^> > > > \[!block\] .*\u0431\u043b\u043e\u043a\u043e\u0432 \u00B7 [34]$/m, "нет группы блоков");
    assert.match(written, /^> > > > - \[\[Ch01-S01-H01-B01 - /m, "блок не встал под полоску 4-го уровня");
    assert.ok(/`\u21E0 \d+`/.test(written), "нет счётчиков ссылок");
    const names = new Set();
    (function walk(rel) {
      rel = rel || "";
      for (const e of fs.readdirSync(path.join(TMP, rel), { withFileTypes: true })) {
        if (e.name.startsWith(".")) continue;
        const r = rel ? rel + "/" + e.name : e.name;
        if (e.isDirectory()) walk(r);
        else names.add(e.name.replace(/\.(md|svg|png|pdf|csv|excalidraw)$/, ""));
      }
    })("");
    // цель ссылки = часть до НЕэкранированной `|`, без `#`-хвоста (в таблицах черта экранирована)
    const links = Array.from(written.matchAll(/\[\[([^\]]+)\]\]/g))
      .map((m) => m[1].split(/(?<!\\)\|/)[0].replace(/#.*$/, "").trim())
      .filter((x) => x.length > 0);
    const miss = links.filter((l) => !names.has(l) && !names.has(l + ".svg"));
    assert.strictEqual(miss.length, 0, "битых ссылок в оглавлении: " + miss.length + " " + miss.slice(0, 3).join(","));
    assert.ok(links.length > 1000, "ссылок в оглавлении: " + links.length);
    const g = await plugin.getGraph(false);
    const lost = g.nodes.filter((n) => !written.includes("[[" + n.stem + "|"));
    assert.strictEqual(lost.length, 0, "вершин не нашлось в оглавлении: " + lost.length);
    const heads = new Set(written.split("\n").filter((l) => /^#{2,3} /.test(l)).map((l) => l.replace(/^#+ /, "").trim()));
    const anchors = Array.from(written.matchAll(/\[\[#([^\]\|]+)/g)).map((m) => m[1].replace(/\\+$/, "").trim());
    assert.strictEqual(anchors.length, g.nodes.filter((n) => n.type === "chapter").length, "якорей: " + anchors.length);
    for (const a of anchors) assert.ok(heads.has(a), "битый якорь: " + a);
    assert.ok(Notice.all.some((m) => /Оглавление пересобрано/.test(m)), "нет уведомления");
    assert.ok(Notice.all.every((m) => !/Не удалось/.test(m)), "ошибка: " + Notice.all.filter((m) => /Не удалось/.test(m)).join("|"));
  });

  await ok("контекстное меню «Проводника»: оглавление создаётся в выбранной папке", async () => {
    const dir = "60 - Drawings"; // папка исключена из сканирования — граф от неё не меняется
    const target = dir + "/Course Index.md";
    const absTarget = path.join(TMP, target);
    const saved = plugin.settings.indexNote;
    try {
      const menu = new obsidian.Menu(app);
      app.workspace.trigger("file-menu", menu, new obsidian.TFolder(dir), null, "file-list");
      const item = menu.items.find((i) => i._t === "Создать оглавление курса");
      assert.ok(item, "нет пункта меню: " + menu.items.map((i) => i._t || "-").join(" / "));
      assert.strictEqual(item._s, "creation", "пункт не в группе «создание»");
      await item._cb();
      assert.ok(fs.existsSync(absTarget), "файл не создан в " + target);
      const txt = fs.readFileSync(absTarget, "utf8");
      assert.ok(/^type: index$/m.test(txt) && /^tags: \[index\]$/m.test(txt), "frontmatter оглавления сбился");
      assert.ok(!/^\s*name(_zh)?:/m.test(txt), "в оглавлении полезли поля вершины графа");
      assert.ok(txt.split("\n").filter((l) => l.includes("[[")).length > 1000, "ссылок в оглавлении мало");
      // путь по умолчанию едет за файлом: иначе команда палитры писала бы в другую заметку
      assert.strictEqual(plugin.settings.indexNote, target, "indexNote: " + plugin.settings.indexNote);

      const menu2 = new obsidian.Menu(app);
      app.workspace.trigger("file-menu", menu2, new obsidian.TFolder(dir), null, "file-list");
      const upd = menu2.items.find((i) => i._t === "Обновить оглавление курса");
      assert.ok(upd, "повторный клик не предлагает обновление: " + menu2.items.map((i) => i._t || "-").join(" / "));
      await upd._cb();
      assert.strictEqual(fs.readdirSync(path.join(TMP, dir)).filter((f) => /Course Index/.test(f)).length, 1, "завёлся дубль");
      const menu3 = new obsidian.Menu(app);
      app.workspace.trigger("file-menu", menu3, new TFile(target, absTarget), null, "file-list");
      assert.ok(menu3.items.some((i) => i._t === "Обновить оглавление курса"), "по самой заметке нет «Обновить»");

      const chap = view.graph.nodes.find((n) => n.type === "chapter");
      const menu4 = new obsidian.Menu(app);
      app.workspace.trigger("file-menu", menu4, new TFile(chap.path, path.join(TMP, chap.path)), null, "file-editor");
      assert.ok(menu4.items.some((i) => i._t === "Создать оглавление курса"), "на заметке курса нет пункта оглавления");
      assert.ok(menu4.items.some((i) => i._t === "Edit graph label"), "рядом пропала правка подписи");

      // оглавление поставки лежит в корне -> клик по пустому месту должен ПРЕДЛАГАТЬ ОБНОВИТЬ тот же файл
      const menuRoot = new obsidian.Menu(app);
      app.workspace.trigger("file-menu", menuRoot, new obsidian.TFolder("/"), null, "file-list");
      const rootItem = menuRoot.items.find((i) => /оглавление курса/.test(i._t || ""));
      assert.ok(rootItem, "в корне хранилища нет пункта оглавления");
      assert.strictEqual(rootItem._t, "Обновить оглавление курса", "пункт в корне не предлагает обновление: " + rootItem._t);
      const beforeRoot = fs.readFileSync(path.join(TMP, "Course Index.md"), "utf8");
      await rootItem._cb();
      const cut = (t) => t.replace(/^\*пересобрано:.*$/m, "").split("\n").join("\n");
      assert.strictEqual(cut(fs.readFileSync(path.join(TMP, "Course Index.md"), "utf8")), cut(beforeRoot), "обновление из меню изменило содержимое");
      assert.strictEqual(fs.readdirSync(TMP).filter((f) => /Course Index/.test(f)).length, 1, "в корне завёлся дубль оглавления");

      const png = "99 - Attachments/probe.png";
      fs.writeFileSync(path.join(TMP, png), "x");
      const menu5 = new obsidian.Menu(app);
      app.workspace.trigger("file-menu", menu5, new TFile(png, path.join(TMP, png)), null, "file-list");
      assert.ok(!menu5.items.some((i) => /оглавление курса/.test(i._t || "")), "пункт полез не в md-файлы");
      fs.rmSync(path.join(TMP, png), { force: true });
    } finally {
      plugin.settings.indexNote = saved;
      await plugin.saveSettings();
      fs.rmSync(absTarget, { force: true });
    }
    assert.strictEqual(plugin.settings.indexNote, saved, "настройка не вернулась");
    const g = await plugin.getGraph(true);
    assert.strictEqual(g.stats.nodes, NODES, "вершин после эксперимента: " + g.stats.nodes);
    assert.strictEqual(g.stats.edges, STATS.edges, "рёбер после эксперимента: " + g.stats.edges);
    assert.ok(!g.nodes.some((n) => /Course Index/.test(n.path)), "оглавление попало в граф");

    // теперь в папку, КОТОРАЯ сканируется: тип `index` вне TYPES, поэтому граф не должен
    // заметить ни вершины, ни лишних ссылок (это защита от «создал не туда»)
    const inScan = "10 - Chapters/Course Index.md";
    try {
      await plugin.writeIndex({ at: inScan });
      assert.ok(fs.existsSync(path.join(TMP, inScan)), "оглавление не создалось в сканируемой папке");
      const g2 = await plugin.getGraph(true);
      assert.strictEqual(g2.stats.nodes, NODES, "вершин после оглавления в 10 - Chapters: " + g2.stats.nodes);
      assert.strictEqual(g2.stats.edges, STATS.edges, "рёбер: " + g2.stats.edges);
      assert.ok(!g2.nodes.some((n) => /Course Index/.test(n.path)), "оглавление из 10 - Chapters попало в граф");
    } finally {
      fs.rmSync(path.join(TMP, inScan), { force: true });
      plugin.settings.indexNote = saved;
      await plugin.saveSettings();
      await plugin.getGraph(true);
    }
  });

  await ok("опции «Оглавление — вершина графа» в плагине больше нет", async () => {
    assert.strictEqual(plugin.settings.indexInGraph, undefined, "вернулась настройка indexInGraph");
    assert.strictEqual(plugin.settings.indexRadius, undefined, "вернулась настройка indexRadius");
    assert.strictEqual(plugin.settings.indexEdges, undefined, "вернулась настройка indexEdges");
    assert.strictEqual(view.edgesToc, undefined, "вернулся слой рёбер оглавления");
    const g = await plugin.getGraph(true);
    assert.ok(!g.nodes.some((n) => n.isIndex), "в графе появилась вершина-оглавление");
    assert.strictEqual(g.nodes.length, NODES, "вершин: " + g.nodes.length);
    assert.strictEqual(g.stats.edges, STATS.edges, "рёбра: " + g.stats.edges);
    assert.ok(app.vault.getAbstractFileByPath("Course Index.md"), "пропала сама заметка оглавления");
    assert.strictEqual(view.nodesLayer.querySelectorAll("g.lg-node--index").length, 0, "в DOM нарисован хаб");
    const tab = plugin.settingTabs[0];
    tab.display();
    const txt = tab.containerEl.textContent;
    assert.ok(!/вершина графа/.test(txt), "в настройках осталась опция «вершина графа»");
    assert.ok(!/связи оглавления/.test(txt), "в настройках остались «связи оглавления»");
    assert.ok(/оглавления/i.test(txt), "из настроек пропало поле пути к оглавлению");
  });

  await ok("редактирование подписи: модалка -> frontmatter, тело и формулы целые", async () => {
    // инвариант: вьюха работает с тем же экземпляром графа, что и кэш плагина
    // (иначе правка приходит в одну копию вершины, а рисуется из другой)
    const gg = await plugin.getGraph(false);
    assert.strictEqual(view.graph, gg, "вьюха и кэш разошлись: cache===" + (plugin.cache === gg) +
      " dirty=" + plugin.cacheDirty + " viewIsPluginView=" + (view === plugin.view()) +
      " leaves=" + plugin.app.workspace.getLeavesOfType("lecture-graph-view").length +
      " adopt=" + typeof view.adoptGraph + " nodes=" + gg.nodes.length + "/" + view.graph.nodes.length);
    const node = view.graph.nodes.find((n) => n.type === "heading" && /Ch03-S02-H04/.test(n.path));
    const abs = path.join(TMP, node.path);
    const beforeRaw = fs.readFileSync(abs, "utf8");
    global.__degBefore = node.degree;
    const before = obsidian_stub_parse(beforeRaw);
    await plugin.editLabel(node);
    const modal = document.querySelector(".modal .lg-modal");
    assert.ok(modal, "modal not rendered");
    const en = modal.querySelector("#lg-name");
    const zh = modal.querySelector("#lg-name-zh");
    assert.strictEqual(en.value, node.name);
    assert.strictEqual(zh.value, node.nameZh);
    en.value = "Renamed Heading EN";
    zh.value = "重命名后的中文标题";
    // предпросмотр обновляется на лету
    en.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    assert.strictEqual(modal.querySelector(".lg-line--en").textContent, "Renamed Heading EN");
    const btn = Array.from(modal.querySelectorAll("button")).find((b) => b.textContent === "Сохранить");
    assert.ok(btn, "save button missing");
    await new Promise((r) => btn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })) && r());
    await new Promise((r) => setTimeout(r, 20));
    const afterRaw = fs.readFileSync(abs, "utf8");
    const after = obsidian_stub_parse(afterRaw);
    assert.strictEqual(after.data.name, "Renamed Heading EN");
    assert.strictEqual(after.data.name_zh, "重命名后的中文标题");
    assert.strictEqual(after.data.type, before.data.type, "type must survive");
    assert.strictEqual(after.data.id, before.data.id, "id must survive");
    assert.strictEqual(after.data.parent, before.data.parent, "parent must survive");
    assert.strictEqual(after.body, before.body, "body must be byte-identical");
    assert.strictEqual((after.body.match(/\$\$/g) || []).length, (before.body.match(/\$\$/g) || []).length);
    assert.strictEqual(afterRaw.match(/^---$/gm).length, 2, "frontmatter markers");
    // вьюха должна показать новую подпись без перестройки
    assert.strictEqual(node.name, "Renamed Heading EN");
    assert.strictEqual(node.nameZh, "重命名后的中文标题");
    // на графе — обрезанная версия (полное название не влезает в кольцо без наездов),
    // при наведении — полное
    assert.strictEqual(node.labelEn, core.clipLabel("Renamed Heading EN", node.labelChars),
      "после правки подпись не пересчитана");
    assert.ok(node.lw > 8, "после правки не пересчитана ширина подписи (упаковка поедет)");
    var tspanNow = view.nodeEls[node.id].querySelectorAll("tspan")[0].textContent;
    assert.ok("Renamed Heading EN".indexOf(tspanNow.replace(/\u2026$/, "")) === 0, "на графе не новая подпись: " + tspanNow);
    view.hoverId = node.id;
    view.updateLabels();
    assert.strictEqual(view.nodeEls[node.id].querySelectorAll("tspan")[0].textContent, "Renamed Heading EN",
      "при наведении подпись не показана целиком");
    view.hoverId = null;
    view.updateLabels();
    assert.ok(Notice.all.every((m) => !/Не удалось/.test(m)), "error notice: " + Notice.all.join(" | "));
  });

  await ok("смена подписи не ломает ссылки и степени графа", async () => {
    const g2 = await plugin.getGraph(true);
    const n = g2.nodes.find((x) => /Ch03-S02-H04/.test(x.path));
    assert.ok(global.__degBefore > 1, "fixture degree unexpectedly small: " + global.__degBefore);
    assert.strictEqual(n.degree, global.__degBefore, "degree must not change after a rename");
    assert.strictEqual(g2.stats.unresolved, 0);
    assert.strictEqual(g2.stats.nodes, NODES);
  });

  await ok("клик по вершине: пузырёк с описанием, дугообразные рёбра связи, легенда глав", async () => {
    // боковая панель и строка состояния удалены; таблица свойств — тоже (её правит
    // пользователь в свойствах заметки)
    assert.ok(view.panel == null && view.renderPanel === undefined, "боковая панель вернулась");
    assert.strictEqual(view.statusEl, undefined, "view.statusEl остался");
    assert.strictEqual(view.statusBarItem, undefined, "элемент статус-бара не убран");
    assert.strictEqual(view.renderStatus, undefined, "renderStatus остался");
    assert.strictEqual(view.renderCard, undefined, "renderCard остался");
    [".lg-panel", ".lg-status", ".lg-card", ".lg-statusbar"].forEach((sel) =>
      assert.strictEqual(document.querySelector(sel), null, sel + " остался в DOM"));

    const bubble = view.bubbleEl;
    assert.ok(bubble && bubble.classList.contains("lg-bubble"), "нет пузырька .lg-bubble");
    assert.ok(bubble.parentNode && /lg-stage/.test(String(bubble.parentNode.className)),
      "пузырёк не поверх холста: " + String(bubble.parentNode.className));
    assert.ok(bubble.textContent.length === 0 || !bubble.classList.contains("lg-bubble--open"),
      "пузырёк открыт до выделения");
    assert.ok(view.edgesSel && view.edgesSel.classList.contains("lg-edges--sel"), "нет слоя выделенных рёбер");
    assert.ok(view.legendEl, "нет легенды");

    // ---------- пузырёк главы: текст из отдельной заметки-описания ----------
    const ch = view.graph.nodes.find((n) => n.type === "chapter" && n.id === "Ch01");
    assert.ok(ch, "главы Ch01 нет в графе");
    assert.ok(/10 - Chapters\/Ch01 - /.test(ch.path), "глава не та: " + ch.path);
    view.select(null);
    assert.ok(!bubble.classList.contains("lg-bubble--open"), "пузырёк открыт без выделения");
    view.select(ch.id);
    assert.strictEqual(view.selected, ch.id, "выделение не поставилось");
    assert.strictEqual(view.bubbleFor, ch.id, "пузырёк не привязан к вершине");
    assert.ok(bubble.classList.contains("lg-bubble--open"), "клик по главе не открыл пузырёк");
    assert.strictEqual(bubble.querySelector(".lg-bubble__type").getAttribute("data-type"), "chapter",
      "в шапке пузырька не тип «глава»");
    assert.ok(bubble.querySelector(".lg-bubble__name").textContent.includes(ch.name),
      "в шапке нет названия главы: " + bubble.querySelector(".lg-bubble__name").textContent);
    assert.ok(bubble.querySelector(".lg-bubble__zh").textContent.includes(ch.nameZh), "в шапке нет 中文");
    // текст сообщения лежит в отдельной заметке (caption:) — читается асинхронно
    await new Promise((r) => setTimeout(r, 80));
    view.renderBubble();
    const txt = bubble.querySelector(".lg-bubble__text");
    assert.ok(txt, "нет блока текста сообщения");
    assert.ok(txt.textContent.trim().length > 8, "текст сообщения пустой: " + JSON.stringify(txt.textContent));
    assert.ok(bubble.querySelector(".lg-bubble__src").textContent.includes(ch.id), "не указано, из какой заметки текст");
    assert.ok(bubble.querySelector(".lg-bubble__x"), "нет кнопки ✕");
    assert.ok(bubble.querySelector(".lg-bubble__act"), "нет кнопки «править текст»");
    assert.ok(!bubble.querySelector(".lg-btn--cta"), "у главы с описанием не должно быть кнопки создания");
    // никаких таблиц свойств в пузырьке нет — только текст (п.12 раунда 15 отменён)
    assert.ok(!/радиус вершины|ссылок на неё|потолок|типы заметок/.test(bubble.textContent),
      "пузырёк показывает свойства вершины: " + bubble.textContent.slice(0, 200));

    // рамка не должна закрывать ни саму вершину, ни её подпись
    Object.defineProperty(view.rootEl, "clientWidth", { value: 900, configurable: true });
    Object.defineProperty(view.rootEl, "clientHeight", { value: 600, configurable: true });
    view.placeBubble();
    const vv = view.view, sx = ch.x * vv.k + vv.x, sy = ch.y * vv.k + vv.y, rad = Math.max(4, ch.r * vv.k);
    const L0 = parseFloat(bubble.style.left), T0 = parseFloat(bubble.style.top);
    const W0 = bubble.offsetWidth || 260, H0 = bubble.offsetHeight || 90;
    assert.ok(isFinite(L0) && isFinite(T0), "пузырьку не заданы координаты: " + bubble.style.left + "/" + bubble.style.top);
    assert.ok(L0 >= sx + rad || L0 + W0 <= sx - rad || T0 >= sy + rad || T0 + H0 <= sy - rad,
      "пузырёк закрывает вершину: bubble " + [L0, T0, W0, H0] + " circle " + [sx, sy, rad]);
    assert.ok(L0 >= 0 && L0 + W0 <= 900 + 40 && T0 >= 0, "пузырёк вылез за холст: " + [L0, T0]);

    // вторым кликом по той же вершине — скрывается
    view.select(ch.id);
    assert.strictEqual(view.selected, null, "второй клик не снял выделение");
    assert.ok(!bubble.classList.contains("lg-bubble--open"), "второй клик не закрыл пузырёк");

    // ---------- пузырёк положен вершине ЛЮБОГО типа (запрос раунда 17) ----------
    const bubbleOpen = () => view.rootEl.querySelector(".lg-bubble");
    const texts = [];
    for (const type of ["chapter", "section", "heading", "block"]) {
      const n = view.graph.nodes.find((x) => x.type === type);
      assert.ok(n, "нет вершины типа " + type);
      view.select(null);
      view.select(n.id);
      // текст заметки сообщения читается асинхронно — ждём, пока пузырёк его дорисует
      await new Promise((r) => setTimeout(r, 30));
      const b = bubbleOpen();
      assert.ok(b.classList.contains("lg-bubble--open"), type + ": клик по вершине не открыл пузырёк");
      assert.ok(!b.querySelector(".lg-bubble__load"), type + ": пузырёк так и остался в состоянии чтения");
      assert.ok(b.textContent.indexOf(n.name || n.stem) >= 0, type + ": в пузырьке нет имени вершины");
      const chip = b.querySelector(".lg-bubble__type");
      assert.ok(chip && chip.getAttribute("data-type") === type, type + ": чип типа не показывает тип вершины");
      assert.ok(b.querySelector(".lg-bubble__act"), type + ": нет действия «править текст»");
      if (n.caption) {
        assert.ok(!b.querySelector(".lg-bubble__empty"), type + ": у вершины с сообщением показан текст «не написано»");
        assert.ok(b.querySelector(".lg-bubble__text").textContent.trim().length > 10,
          type + ": сообщение пустое: " + b.querySelector(".lg-bubble__text").textContent.slice(0, 60));
      } else {
        assert.ok(b.querySelector(".lg-bubble__cta, .lg-btn--cta"), type + ": у вершины без сообщения нет кнопки «Создать по шаблону»");
        texts.push(n);
      }
    }
    assert.ok(texts.length >= 2, "тест не дошёл до вершин без сообщений: " + texts.length);

    // «+ Создать по шаблону» работает для заголовка и блока: файл + caption: + текст в пузырьке
    for (const n of texts.slice(0, 2)) {
      const nodeFile = path.join(TMP, n.path);
      const before = fs.readFileSync(nodeFile, "utf8");
      const capRel = path.join(TMP, "45 - Captions", plugin.captionName(n) + ".md");
      fs.rmSync(capRel, { force: true });
      view.select(null);
      view.select(n.id);
      await new Promise((r) => setTimeout(r, 30)); // текст читается асинхронно
      const cta = bubbleOpen().querySelector(".lg-btn--cta");
      assert.ok(cta, n.type + ": кнопка «Создать по шаблону» не появилась: " + bubbleOpen().textContent.slice(0, 120));
      cta.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 40));
      assert.ok(fs.existsSync(capRel), n.type + ": заметка сообщения не создана: " + capRel);
      const capTxt = fs.readFileSync(capRel, "utf8");
      assert.ok(/^---[\s\S]*?type: caption[\s\S]*?node: /m.test(capTxt), n.type + ": у новой заметки не тот frontmatter:\n" + capTxt.slice(0, 160));
      assert.ok(capTxt.indexOf("type: template") < 0, n.type + ": новая заметка осталась шаблоном");
      assert.ok(capTxt.indexOf(n.id) >= 0, n.type + ": в заметку не подставлен id вершины");
      assert.ok(capTxt.indexOf("{{body}}") < 0, n.type + ": метка {{body}} осталась в готовой заметке");
      const noteTxt = fs.readFileSync(nodeFile, "utf8");
      assert.ok(/caption:/.test(noteTxt), n.type + ": caption: не дописан в свойства вершины");
      const b = bubbleOpen();
      assert.ok(b.textContent.indexOf("не написано") < 0, n.type + ": пузырёк не обновился после создания: " + b.textContent.slice(0, 120));
      assert.ok(b.querySelector(".lg-bubble__text").textContent.trim().length > 10,
        n.type + ": в пузырьке нет текста новой заметки");
      // откат: временное хранилище должно остаться в поставочном виде
      fs.rmSync(capRel, { force: true });
      fs.writeFileSync(nodeFile, before);
      plugin.captions = {};
    }
    view.select(null);

    // ---------- рёбра «вершина ↔ соседи» проявляются явно и они дуги ----------
    view.select(ch.id);
    const dSel = view.edgesSel.getAttribute("d") || "";
    const nSel = (dSel.match(/M/g) || []).length;
    assert.ok(nSel >= 4, "явных рёбер выбранной главы: " + nSel);
    assert.ok((dSel.match(/[QC]/g) || []).length === nSel, "выделенные рёбра не все дуги");
    const dStruct = view.edgesStruct.getAttribute("d") || "";
    const dRef = view.edgesRef.getAttribute("d") || "";
    assert.ok((dStruct.match(/M/g) || []).length > 900, "структурных рёбер в обычном слое: " + (dStruct.match(/M/g) || []).length);
    assert.ok(!/L/.test(dStruct) && (dStruct.match(/Q/g) || []).length === (dStruct.match(/M/g) || []).length,
      "структурные рёбра рисуются прямыми (п.5)");
    assert.ok(!/L/.test(dRef), "рёбра-ссылки рисуются прямыми (п.5)");
    // те же рёбра в обычном слое скрыты, а соседи подсвечены
    assert.ok(Object.keys(view.neigh).length >= 4, "соседи не посчитаны: " + Object.keys(view.neigh).length);
    const sec1 = view.graph.nodes.find((n) => n.type === "section" && n.chapter === "Ch01");
    assert.ok(view.nodeEls[sec1.id].getAttribute("class").includes("lg-node--neigh"), "сосед не подсвечен");
    assert.ok(view.nodeEls[ch.id].getAttribute("class").includes("lg-node--selected"), "выбранная вершина не подсвечена");
    assert.ok(view.nodeEls[ch.id].getAttribute("class").includes("lg-node--captioned"), "вершина с сообщением не помечена");
    const far = view.graph.nodes.find((n) => n.chapter === "Ch09" && n.type === "heading");
    assert.ok(view.nodeEls[far.id].getAttribute("class").includes("lg-node--dim"), "чужая вершина не приглушена");
    view.select(null);

    // ---------- легенда: по главе свой цвет, клик = показать только главу ----------
    assert.ok(/\u0426\u0432\u0435\u0442 \u043f\u043e \u0433\u043b\u0430\u0432\u0430\u043c/.test(view.legendEl.textContent),
      "легенда не про цвета глав: " + view.legendEl.textContent.slice(0, 80));
    const chips = Array.from(view.legendEl.querySelectorAll(".lg-legend__chip"));
    assert.strictEqual(chips.length, 9, "чипов в легенде: " + chips.length);
    assert.ok(chips.every((c) => /Ch0\d/.test(c.textContent)), "в чипе нет номера главы: " + chips[0].textContent);
    assert.ok(chips.every((c) => c.querySelector(".lg-legend__dot").getAttribute("style").includes("#")), "у чипа нет цвета");
    const distinct = new Set(chips.map((c) => c.querySelector(".lg-legend__dot").getAttribute("style")));
    assert.strictEqual(distinct.size, 9, "глава не получили разные цвета: " + distinct.size);
    const snap = { drawn: view.drawn, visible: view.visible, count: view.visibleCount, chapter: plugin.settings.filters.chapter };
    chips[2].dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.strictEqual(plugin.settings.filters.chapter, "Ch03", "клик по чипу не отфильтровал главу: " + plugin.settings.filters.chapter);
    assert.ok(Object.keys(view.visible).length < view.graph.nodes.length, "фильтр не сузил граф");
    chips[2].dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.strictEqual(plugin.settings.filters.chapter, "", "повторный клик не вернул все главы");
    plugin.settings.filters.chapter = snap.chapter;
    view.drawn = snap.drawn; view.visible = snap.visible; view.visibleCount = snap.count;
    Object.keys(view.nodeEls).forEach((id) => view.nodeEls[id].removeAttribute("style"));
    view.updateLabels(); view.redraw();
    // цвета по главам наследуются вниз по дереву
    assert.strictEqual(view.graph.colors[sec1.id], view.graph.colors[ch.id], "секция не унаследовала цвет главы");
    const h1 = view.graph.nodes.find((n) => n.type === "heading" && n.chapter === "Ch01");
    assert.strictEqual(view.graph.colors[h1.id], view.graph.colors[ch.id], "заголовок не унаследовал цвет главы");

    // ---------- вершина без описания: «создать по шаблону» есть у ЛЮБОГО типа ----------
    // раньше заголовкам и блокам объясняли отказ; теперь сообщение — у любой вершины
    const blk = view.graph.nodes.find((n) => n.type === "block");
    const nNotice0 = Notice.all.length;
    view.select(null);
    view.select(blk.id);
    await new Promise((r) => setTimeout(r, 30));
    assert.ok(bubble.classList.contains("lg-bubble--open"), "клик по блоку не открыл пузырёк");
    assert.ok(bubble.querySelector(".lg-btn--cta"), "у блока нет кнопки «+ Создать по шаблону»");
    assert.strictEqual(Notice.all.length, nNotice0, "блоку всё ещё объясняют отказ: " + Notice.all.slice(-1));

    const sec = view.graph.nodes.find((n) => n.type === "section" && n.chapter === "Ch01");
    const absNote = path.join(TMP, sec.path);
    const beforeRaw = fs.readFileSync(absNote, "utf8");
    const savedCaption = sec.caption;
    const capAbs = path.join(TMP, plugin.settings.captionFolder, plugin.captionName(sec) + ".md");
    const capBackup = fs.existsSync(capAbs) ? fs.readFileSync(capAbs, "utf8") : null;
    if (capBackup) fs.rmSync(capAbs);
    sec.caption = "";            // ни свойства, ни заметки — как у совсем новой вершины
    plugin.captions = {};
    view.select(sec.id);
    await new Promise((r) => setTimeout(r, 30)); // заметка сообщения читается асинхронно
    const createBtn = bubble.querySelector(".lg-btn--cta");
    assert.ok(createBtn, "для вершины без описания нет кнопки «+ Создать по шаблону»");
    assert.ok(/не написано/.test(bubble.textContent), "нет объяснения: " + bubble.textContent.slice(0, 200));
    createBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 120));
    assert.ok(fs.existsSync(capAbs), "заметка сообщения не создана: " + capAbs);
    const capRaw = fs.readFileSync(capAbs, "utf8");
    assert.ok(/^type: caption$/m.test(capRaw), "в созданной заметке нет type: caption:\n" + capRaw.slice(0, 200));
    assert.ok(!/cssclasses/.test(capRaw) || !/lg-node/.test(capRaw), "созданная заметка попадёт в граф");
    assert.ok(!/\{\{title\}\}/.test(capRaw), "плейсхолдер шаблона не заменён");
    assert.ok(capRaw.includes(sec.name) || capRaw.includes(sec.nameZh || "\""), "в тексте нет названия секции");
    const afterRaw = fs.readFileSync(absNote, "utf8");
    assert.ok(/\[\[Ch\d\d-S\d\d[^\]]*caption/.test(afterRaw) || /^caption: .*caption.*$/m.test(afterRaw),
      "в заметку вершины не записано caption:\n" + afterRaw.slice(0, 300));
    assert.strictEqual(afterRaw.replace(/^caption:.*$/m, ""), beforeRaw.replace(/^caption:.*$/m, ""),
      "правка caption: задела другие поля frontmatter");
    assert.ok(afterRaw.slice(afterRaw.indexOf("\n---\n", 4)) === beforeRaw.slice(beforeRaw.indexOf("\n---\n", 4)),
      "тело заметки вершины изменилось");
    sec.caption = savedCaption;
    if (capBackup) fs.writeFileSync(capAbs, capBackup); else fs.rmSync(capAbs, { force: true });
    fs.writeFileSync(absNote, beforeRaw);
    plugin.captions = {};
    view.select(null);

    // ---------- статус: всплывающее сообщение, а не строка под тулбаром ----------
    const toast = view.toastEl;
    assert.ok(toast && toast.classList.contains("lg-toast"), "нет .lg-toast");
    assert.ok(/lg-stage/.test(String(toast.parentNode.className)), "тост приложен не к холсту (.lg-stage): " + toast.parentNode.className);
    view.setStatus("проверочное сообщение", 30);
    assert.ok(toast.classList.contains("lg-toast--open"), "сообщение не показалось");
    assert.ok(toast.textContent.includes("проверочное сообщение"), "текста сообщения нет");
    await new Promise((r) => setTimeout(r, 120));
    assert.ok(!toast.classList.contains("lg-toast--open"), "сообщение не исчезло само");
    assert.ok(!view.contentEl.querySelector(".lg-status"), "строка состояния вернулась");

    // ---------- экспорт графа в *.json (п.9) ----------
    const dir = path.join(TMP, plugin.settings.exportFolder);
    const before = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.json$/.test(f)) : [];
    const file = await plugin.exportJSON();
    assert.ok(file && /\.json$/.test(file.path), "экспорт вернул не .json: " + (file && file.path));
    const after = fs.readdirSync(dir).filter((f) => /\.json$/.test(f));
    assert.strictEqual(after.length, before.length + 1, "файл JSON не появился: " + after.join(","));
    const raw = fs.readFileSync(path.join(dir, after[after.length - 1]), "utf8");
    const data = JSON.parse(raw);
    assert.strictEqual(data.nodes.length, view.graph.nodes.length, "в JSON не все вершины");
    assert.ok(data.edges.length >= 100, "в JSON мало рёбер: " + data.edges.length);
    assert.strictEqual(data.format, "lecture-graph/1", "формат выгрузки: " + data.format);
    assert.ok(data.stats && data.settings && data.generated, "в JSON нет stats/settings/generated: " + Object.keys(data).join(","));
    assert.strictEqual(data.stats.nodes, view.graph.nodes.length, "stats.nodes не совпадает");
    assert.ok(Object.keys(data.chapterColors).length === 9, "в JSON нет палитры глав: " + Object.keys(data.chapterColors).length);
    assert.ok(/"label_en"/.test(raw) && /"color"/.test(raw) && /"label_zh"/.test(raw), "в JSON нет подписей/цветов");
    const jn = data.nodes.find((n) => n.id === "Ch01");
    assert.ok(jn && jn.name && jn.label_en && jn.color && jn.caption, "вершина Ch01 выгружена неполно: " + JSON.stringify(jn));
    assert.ok(jn.refs && typeof jn.refs.text === "number" && jn.radius > 0, "в JSON нет refs/radius");
    assert.ok(data.nodes.every((n) => isFinite(n.x) && isFinite(n.y)), "в JSON координаты не числа");
    assert.ok(/"size_factor"/.test(raw) && /"radius"/.test(raw), "в JSON нет размеров вершин");
    assert.ok(/"x": [-\d.]/.test(raw) && /"edges": \[/.test(raw), "в JSON нет координат/списка рёбер");

    // ---------- CSS: пузырёк/тост/легенда/выделенные рёбра ----------
    const css = fs.readFileSync(path.join(PLUGIN_DIR, "styles.css"), "utf8").replace(/\r/g, "");
    assert.ok(/\.lg-bubble \{/.test(css) && /\.lg-bubble--open/.test(css), "нет стилей пузырька");
    assert.ok(/\.lg-bubble \{[^}]*border-radius:/.test(css), "у пузырька нет скруглённой рамки");
    assert.ok(/\.lg-bubble \{[^}]*position: absolute/.test(css), "пузырёк не позиционируется по холсту");
    assert.ok(/\.lg-edges--sel/.test(css), "нет стилей выделенных рёбер");
    assert.ok(/\.lg-legend__chip/.test(css), "нет стилей легенды");
    assert.ok(/\.lg-toast/.test(css), "нет стилей всплывающего статуса");
    assert.ok(/\.lg-btn--cta/.test(css), "нет стиля кнопки «создать по шаблону»");
    assert.ok(!/\.lg-card__rows/.test(css), "styles.css: остались правила таблицы свойств");
    assert.ok(/@media print[\s\S]{0,900}display: none/.test(css), "всплывающие элементы не скрыты при печати");
    assert.ok(/\.lg-root--full/.test(css), "styles.css: нет правил полноэкранного режима");
  });

  await ok("упаковка подписей в живом рендере: 0 наездов и подписи глав не исчезают (дефекты 1 и 2)", async () => {
    const v0 = { ...view.view };
    const s0 = { maxRadius: plugin.settings.maxRadius, labelMode: plugin.settings.labelMode };
    view.select(null);
    view.neigh = null;
    view.hoverId = null;
    const rects = () => {
      const k = view.view.k, out = [];
      view.graph.nodes.forEach((n) => {
        const el = view.nodeEls[n.id];
        if (!el || el.style.display === "none" || !view.visible[n.id]) return;
        const t = el.querySelector("text");
        if (!t || t.style.display === "none") return;
        const fsz = parseFloat(t.getAttribute("font-size") || "10");
        const w = parseFloat(t.getAttribute("data-lw") || "0");
        const cx = (n.x + view.view.x) * k;
        const top = (n.y + view.view.y) * k + parseFloat(t.getAttribute("y")) * k - fsz * 1.35 * k;
        out.push({ x: cx - w * k / 2, y: top, w: w * k, h: fsz * 2.6 * k, id: n.id });
      });
      return out;
    };
    const overlaps = (list) => {
      let n = 0;
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i], b = list[j];
          if (a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5) n++;
        }
      return n;
    };
    // Подписи теперь КРУПНЫЕ и читаемые: кегль на экране не зависит от зума, поэтому
    // на весь граф их влезает ровно сколько влезло по месту (десятки, не сотни —
    // сотня меток по 150 px друг на друге не уместится ни при какой раскладке).
    // Главное, что проверяем: наездов нет ни при каком размере вершин, а подписи
    // глав с экрана не пропадают — за место они в очереди первые.
    const screenFonts = (list) => list.map((r) => r.h / 2.6);
    [22, 12, 60].forEach((R) => {
      plugin.settings.maxRadius = R;
      view.neigh = null;
      view.applySizesNow();
      view.fit(); // весь граф в кадре: подпись рисуется только тому, кто на экране
      const list = rects();
      assert.ok(list.length >= 12, "при maxRadius " + R + " подписей видно: " + list.length);
      assert.strictEqual(overlaps(list), 0, "при maxRadius " + R + " наездов подписей: " + overlaps(list) + " (видно " + list.length + ")");
      const fs = screenFonts(list);
      assert.ok(Math.min(...fs) > 6, "при maxRadius " + R + " подпись мельче 6 px на экране: " + Math.min(...fs).toFixed(1));
      assert.ok(Math.max(...fs) < 40, "при maxRadius " + R + " подпись больше 40 px на экране: " + Math.max(...fs).toFixed(1));
      // Главы идут за место ПЕРВЫМИ (приоритет по уровню), поэтому подписаны почти все.
      // Строго «все» требовать нельзя: две главы на экране могут оказаться в 20 px друг
      // от друга, и обе подписи шириной в пол-экрана не влезут никуда — раньше их
      // разводила модельная упаковка (и за это платили кеглем 0.8 px на весь граф).
      const chapters = view.graph.nodes.filter((n) => n.type === "chapter");
      const labeled = chapters.filter((n) => view.nodeEls[n.id].querySelector("text").style.display !== "none");
      assert.ok(chapters.length >= 5, "глав слишком мало для проверки: " + chapters.length);
      assert.ok(labeled.length >= Math.ceil(chapters.length * 0.8),
        "при maxRadius " + R + " подписано только " + labeled.length + " глав из " + chapters.length + " (дефект 1)");
    });
    // приближение освобождает место и открывает новые подписи
    plugin.settings.maxRadius = s0.maxRadius;
    plugin.settings.labelMode = s0.labelMode;
    view.applySizesNow();
    const wide = rects().length;
    view.zoomBy(2.5);
    const near = rects().length;
    assert.ok(near > wide, "приближение не открыло подписей: видно " + wide + " -> " + near);
    assert.strictEqual(overlaps(rects()), 0, "после приближения появились наезды");
    view.zoomBy(1 / 2.5);
    plugin.settings.maxRadius = s0.maxRadius;
    plugin.settings.labelMode = s0.labelMode;
    view.applySizesNow();
    Object.assign(view.view, v0);
    view.redraw();
    view.updateLabels();
  });

  await ok("раскладка: движки в панели и в настройках, чистые метки в каждом режиме (раунд 16)", async () => {
    const core = require("./src/graph-core.js");
    const sel = view.layoutSel;
    assert.ok(sel, "в панели нет выбора раскладки");
    const title = sel.parentNode.querySelector(".lg-bar-title");
    assert.ok(title && title.textContent.indexOf("Раскладка") >= 0, "группа раскладки без подписи");
    const vals = Array.from(sel.querySelectorAll("option")).map((o) => o.value);
    assert.deepStrictEqual(vals, ["fdp", "neato", "twopi", "clusters", "force"], "набор режимов не тот: " + vals);
    assert.ok(vals.indexOf("radial") < 0, "режим «кольца по уровням» не удалён");
    assert.strictEqual(sel.value, plugin.settings.layout.mode, "в панели отражён не тот режим");

    const labelBad = (g) => {
      const boxes = [];
      g.nodes.forEach((n) => {
        if (!n.labelShown) return;
        const r = core.labelRectOf(n);
        if (r) boxes.push({ x: r.x0, y: r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0, id: n.id });
      });
      let bad = 0;
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          if (a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5) bad++;
        }
      return { bad, boxes: boxes.length };
    };
    const circleBad = (g) => {
      let bad = 0;
      for (let i = 0; i < g.nodes.length; i++)
        for (let j = i + 1; j < g.nodes.length; j++) {
          const a = g.nodes[i], b = g.nodes[j];
          if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r - 0.5) bad++;
        }
      return bad;
    };

    const bboxes = {};
    const poses = {};
    const before = view.graph.nodes.map((n) => Math.round(n.x) + ":" + Math.round(n.y));
    void before;
    ["fdp", "neato", "twopi", "clusters", "force"].forEach((m) => {
      plugin.settings.layout.mode = m;
      view.relayoutNow();
      const g = view.graph;
      assert.ok(g.nodes.every((n) => isFinite(n.x) && isFinite(n.y)), m + ": нечисловые координаты");
      const lb = labelBad(g);
      assert.ok(lb.boxes > 40, m + ": подписей видно слишком мало: " + lb.boxes);
      assert.strictEqual(lb.bad, 0, m + ": пересечений подписей " + lb.bad);
      assert.strictEqual(circleBad(g), 0, m + ": наложений кругов " + circleBad(g));
      const b = core.bounds(g.nodes);
      bboxes[m] = Math.round(Math.hypot(b.maxX - b.minX, b.maxY - b.minY));
      poses[m] = g.nodes.map((n) => [n.x, n.y]);
      if (m === "clusters") assert.ok(g._center && g._center.R > 100, "clusters: секторы не построены");
    });
    // режимы обязаны давать РАЗНЫЕ картинки (иначе выбор раскладки — декорация).
    // Мерим не размером bbox (два движка могут разложить по-разному, но в ту же площадь),
    // а средним сдвигом каждой вершины: именно он и есть настоящая «разная картинка».
    const rms = (a, b2) => {
      let acc = 0;
      for (let i = 0; i < a.length; i++) acc += (a[i][0] - b2[i][0]) ** 2 + (a[i][1] - b2[i][1]) ** 2;
      return Math.sqrt(acc / Math.max(1, a.length));
    };
    const span = Math.max(...Object.keys(bboxes).map((m) => bboxes[m]));
    const drift = { fdp_twopi: rms(poses.fdp, poses.twopi), neato_fdp: rms(poses.neato, poses.fdp) };
    assert.ok(drift.fdp_twopi / span > 0.05, "fdp и twopi дали одну картинку: сдвиг " +
      (drift.fdp_twopi / span).toFixed(3) + " от размера графа, bbox " + JSON.stringify(bboxes));
    assert.ok(drift.neato_fdp / span > 0.05, "neato и fdp дали одну картинку: сдвиг " +
      (drift.neato_fdp / span).toFixed(3) + " от размера графа, bbox " + JSON.stringify(bboxes));

    // выбор из панели: настройка сохраняется, граф перекладывается
    const posBefore = view.graph.nodes.map((n) => Math.round(n.x) + ":" + Math.round(n.y));
    sel.value = "twopi";
    sel.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    assert.strictEqual(plugin.settings.layout.mode, "twopi", "смена из панели не сохранена");
    assert.strictEqual(plugin._data.layout.mode, "twopi", "смена из панели не уехала в data.json");
    const posAfter = view.graph.nodes.map((n) => Math.round(n.x) + ":" + Math.round(n.y));
    assert.notDeepStrictEqual(posAfter, posBefore, "смена режима не двинула вершины");
    const rep = view.polishNow();
    assert.ok(rep && rep.overlaps === 0, "twopi: пост-обработка вернула не ноль: " + JSON.stringify(rep));

    // правка «size:» (applySizesNow) не должна ломать чистоту меток в режиме движка
    plugin.settings.layout.mode = "fdp";
    view.relayoutNow();
    plugin.settings.maxRadius = 60;
    view.applySizesNow();
    assert.strictEqual(labelBad(view.graph).bad, 0, "после роста вершин подписи наезжают");
    plugin.settings.maxRadius = 34;
    view.applySizesNow();

    // вкладка настроек: новые контролы на месте и подписаны
    const tab = plugin.settingTabs[0];
    tab.display();
    const txt = tab.containerEl.textContent;
    ["Чем раскладывать", "Стягивание по главам", "Итераций fdp", "Итераций neato", "Шаг слоя twopi", "Корень для twopi",
      "Расходиться подписями", "Расходиться кругами", "Предельный сдвиг при разведении"].forEach((name) =>
        assert.ok(txt.indexOf(name) >= 0, "в настройках нет контрола «" + name + "»"));
    assert.ok(txt.indexOf("кольца по уровням") < 0, "в настройках остался режим колец");
    const dd = tab.containerEl._all.find((x) => x.nameEl.textContent.indexOf("Чем раскладывать") >= 0);
    assert.ok(dd, "дропдаун режима не отрисован");
    assert.ok(dd.descEl && dd.descEl.textContent.length > 60, "у выбора режима нет описания");
    plugin.settings.layout.mode = "fdp";
    view.relayoutNow();
  });

  await ok("полный экран: кнопка, класс, Esc, команды (п.2)", async () => {
    const cmd = (id) => plugin.commands.find((c) => c.id === id);
    assert.ok(cmd("toggle-fullscreen"), "нет команды toggle-fullscreen");
    assert.ok(cmd("open-view-fullscreen"), "нет команды open-view-fullscreen");
    assert.ok(view.fullBtn, "нет кнопки во весь экран");
    assert.strictEqual(view.rootEl.classList.contains("lg-root--full"), false, "стартовал полноэкранным");
    view.fullBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.strictEqual(view.fullscreen, true, "клик по кнопке не открыл");
    assert.ok(view.rootEl.classList.contains("lg-root--full"), "нет класса lg-root--full");
    assert.ok(/Выйти/.test(view.fullBtn.textContent) && /Esc/.test(view.fullBtn.textContent), "подпись кнопки: " + view.fullBtn.textContent);
    dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    assert.ok(dom.window.__escSeen !== false, "keydown не дошёл до окна");
    assert.strictEqual(view.fullscreen, false, "Esc не вышел из полноэкранного режима");
    assert.strictEqual(view.rootEl.classList.contains("lg-root--full"), false, "класс не снят");
    // команда и двойное действие через activateView(true)
    await plugin.activateView(true);
    await new Promise((r) => setTimeout(r, 80)); // fit() отложен на кадр
    assert.strictEqual(leaf.view.fullscreen, true, "activateView(true) не открыл на весь экран");
    await cmd("toggle-fullscreen").callback();
    assert.strictEqual(leaf.view.fullscreen, false, "команда не переключила");
    await new Promise((r) => setTimeout(r, 60));
  });

  await ok("полный экран: граф по центру экрана, а не по центру прежней сцены", async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    // jsdom не считает layout: размер сцены задаём сами, как это делает Obsidian
    const setSize = (w, h) => {
      Object.defineProperty(view.svg, "clientWidth", { value: w, configurable: true });
      Object.defineProperty(view.svg, "clientHeight", { value: h, configurable: true });
    };
    const clearSize = () => {
      delete view.svg.clientWidth;
      delete view.svg.clientHeight;
      if (view.stageEl) {
        delete view.stageEl.clientWidth;
        delete view.stageEl.clientHeight;
      }
    };
    // центр НАРИСОВАННОГО графа по X: реальные r из DOM и камера слоя
    const centerX = () => {
      const v = view.view;
      let minX = Infinity, maxX = -Infinity;
      for (const id in view.nodeEls) {
        if (!view.visible[id]) continue;
        const n = view.byId[id];
        if (!n || !isFinite(n.x)) continue;
        const c = view.nodeEls[id].querySelector("circle");
        const r = (c ? parseFloat(c.getAttribute("r")) : n.r || 6) * v.k;
        const cx = n.x * v.k + v.x;
        minX = Math.min(minX, cx - r);
        maxX = Math.max(maxX, cx + r);
      }
      return (minX + maxX) / 2;
    };
    // камера досчитывается rAF-цепочкой: ждём результата, а не «на глаз» миллисекунд
    const centeredAt = async (x, what) => {
      for (let i = 0; i < 120 && Math.abs(centerX() - x) >= 1.5; i++) await wait(25);
      assert.ok(Math.abs(centerX() - x) < 1.5,
        what + ": центр " + centerX().toFixed(1) + " вместо " + x +
        " (сдвиг " + (centerX() - x).toFixed(1) + " px)");
    };
    const savedRO = global.ResizeObserver;
    try {
      // --- 1. вход в полный экран: сцена принимает новый размер ПОЗЖЕ ----------
      setSize(1180, 860);
      view.fit();
      await centeredAt(590, "в листе 1180");
      view.toggleFullscreen(true);
      await wait(80); // одинокий fit() «через 30 мс» к этому моменту уже отработал
      assert.ok(Math.abs(centerX() - 590) < 1.5, "камера пересчиталась до смены размера сцены");
      setSize(1920, 1080); // переход полноэкранного режима/перекладка закончились позже
      await centeredAt(960, "в полном экране 1920");
      const box = view.stageBox();
      assert.strictEqual(box.w + "x" + box.h, "1920x1080", "stageBox() врёт про размер: " + JSON.stringify(box));
      assert.strictEqual(view._fitBox.w, 1920, "камера не запомнила размер, под который посчитана");

      // --- 2. выход из полного экрана центрирует обратно по листу -------------
      setSize(1180, 860);
      view.toggleFullscreen(false);
      await centeredAt(590, "после выхода из полного экрана");

      // --- 3. смена размера сцены без изменения окна: onResize + ResizeObserver
      assert.strictEqual(typeof view.onResize, "function", "у представления нет хука onResize()");
      let fired = null;
      global.ResizeObserver = function (fn) {
        fired = fn;
        this.observe = function () {};
        this.disconnect = function () {};
      };
      view._stageRO = null;
      view.observeStage();
      assert.ok(view._stageRO, "ResizeObserver не подключён к сцене");
      setSize(1600, 900);
      fired(); // сцена сменила размер — окно Obsidian при этом не менялось
      await centeredAt(800, "после смены размера сцены");
      setSize(1400, 800);
      view.onResize();
      await centeredAt(700, "после onResize()");

      // --- 4. размер сцены берётся из DOM, а не из фантомных 1000×700 ---------
      // svg ещё не переложен (clientWidth = 0) — размер обязан прийти из контейнера,
      // иначе fit() центрирует граф в несуществующем окне и тот уезжает влево
      clearSize();
      Object.defineProperty(view.stageEl, "clientWidth", { value: 1400, configurable: true });
      Object.defineProperty(view.stageEl, "clientHeight", { value: 900, configurable: true });
      assert.strictEqual(view.width(), 1400, "width() не взял размер сцены: " + view.width());
      assert.strictEqual(view.height(), 900, "height() не взял размер сцены: " + view.height());
      view.fit();
      await centeredAt(700, "при непереложенном svg (сцена 1400)");
    } finally {
      // убираем за собой: дальше тесты живут с прежним (нулевым) размером сцены.
      // Осторожно и без собственных исключений: иначе ошибка finally перекроет
      // настоящую причину провала (так регрессия пряталась за TypeError)
      global.ResizeObserver = savedRO;
      if (view._stageRO && view._stageRO.disconnect) view._stageRO.disconnect();
      view._stageRO = null;
      if (typeof view.stopRefit === "function") view.stopRefit();
      clearSize();
      view.fit();
    }
  });

  await ok("кегль подписей: A−/A+, авто-масштаб и фиксированный (п.3)", async () => {
    const s = plugin.settings;
    s.labelFontBySize = true;
    view.fontAutoEl.checked = true;
    const scale0 = Number(s.labelScale) || 1;
    const big = view.graph.nodes.find((n) => n.type === "chapter");
    const small = view.graph.nodes.filter((n) => n.type === "block").sort((a, b) => a.degree - b.degree)[0];
    const mode0 = plugin.settings.labelMode;
    plugin.settings.labelMode = "always"; // подписи скрытых вершин тоже должны получать кегль
    view.updateLabels();
    // В DOM лежит модельный кегль × labelComp(k): на ЭКРАНЕ он ровно n.font, поэтому
    // «A+» видно сразу. Раньше кегль в DOM умножался на k≈0.07 — и кнопки «не работали».
    const fontOf = (n) => parseFloat(view.nodeEls[n.id].querySelector("text.lg-label").getAttribute("font-size"));
    const screenOf = (n) => fontOf(n) * view.view.k;
    assert.ok(Math.abs(screenOf(big) - big.font) < 0.05, "кегль на экране " + screenOf(big) + " != модель " + big.font);
    assert.ok(Math.abs(screenOf(small) - small.font) < 0.05, "кегль мелкой вершины не в DOM");
    assert.ok(big.font > small.font + 1, "в авто-режиме кегль не растёт с размером: " + big.font + " vs " + small.font);
    assert.ok(!isNaN(fontOf(small)), "у скрытой по порогу вершины нет font-size");
    const clickBtn = (txt) => Array.from(view.rootEl.querySelectorAll("button"))
      .find((b) => b.textContent.trim() === txt).dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    const before = screenOf(big);
    clickBtn("A+");
    assert.ok(Math.abs(s.labelScale - scale0 * 1.15) < 1e-6, "A+ не поднял множитель кегля: " + s.labelScale);
    assert.ok(screenOf(big) > before * 1.1, "A+ не увеличил кегль: " + before.toFixed(1) + " -> " + screenOf(big).toFixed(1));
    assert.strictEqual(plugin._data.labelScale, s.labelScale, "множитель не сохранён");
    // рядом с кнопками видно, чем кончилось: множитель и кегль в пикселях
    assert.ok(/×/.test(view.fontPxEl.textContent), "нет индикатора множителя: «" + view.fontPxEl.textContent + "»");
    assert.ok(/px/.test(view.fontRangeEl.textContent), "нет индикатора кегля: «" + view.fontRangeEl.textContent + "»");
    clickBtn("A\u2212");
    assert.ok(Math.abs(s.labelScale - scale0) < 1e-6, "A− не вернул назад: " + s.labelScale);
    assert.ok(Math.abs(screenOf(big) - before) < 0.05, "кегль не вернулся: " + screenOf(big));

    // команды палитры работают без мыши
    const up = plugin.commands.find((c) => c.id === "bump-font-up");
    assert.ok(up && plugin.commands.find((c) => c.id === "bump-font-down"), "нет команд A+/A-");
    up.callback();
    assert.ok(Math.abs(s.labelScale - scale0 * 1.15) < 1e-6, "команда A+ не сработала");
    plugin.commands.find((c) => c.id === "bump-font-down").callback();
    assert.ok(Math.abs(s.labelScale - scale0) < 1e-6, "команда A− не сработала");

    // выключенное авто -> единый кегль
    const fixed = 13;
    s.labelFontBySize = false;
    s.labelFontSize = fixed;
    view.fontAutoEl.checked = false;
    view.fontAutoEl.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    const fonts = view.graph.nodes.map((n) => n.font);
    assert.strictEqual(Math.max(...fonts), fixed, "разброс кегля при выключенном авто: " + Math.min(...fonts) + ".." + Math.max(...fonts));
    assert.strictEqual(Math.min(...fonts), fixed);
    assert.strictEqual(s.labelFontBySize, false, "настройка не сохранена");
    // включаем обратно и убеждаемся, что разброс вернулся
    s.labelFontBySize = true;
    view.fontAutoEl.checked = true;
    view.fontAutoEl.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    assert.ok(Math.max(...view.graph.nodes.map((n) => n.font)) > Math.min(...view.graph.nodes.map((n) => n.font)));
    plugin.settings.labelMode = mode0;
    view.updateLabels();
  });

  await ok("размер верхних уровней реально различается и меняется от режима (п.4)", async () => {
    const uniqR = (type) => new Set(view.graph.nodes.filter((n) => n.type === type).map((n) => n.r.toFixed(2))).size;
    const spread = (type) => {
      const a = view.graph.nodes.filter((n) => n.type === type).map((n) => n.r);
      return Math.max(...a) - Math.min(...a);
    };
    ["chapter", "section", "heading", "block"].forEach((t) => {
      assert.ok(uniqR(t) >= 3, "уровень " + t + ": всего " + uniqR(t) + " разных радиусов");
      assert.ok(spread(t) > 1, "уровень " + t + ": разброс радиусов " + spread(t).toFixed(2));
    });
    // главы должны быть крупнее блоков в среднем (иначе «иерархия» не читается)
    const mean = (t) => view.graph.nodes.filter((n) => n.type === t).reduce((a, n) => a + n.r, 0) / view.graph.nodes.filter((n) => n.type === t).length;
    assert.ok(mean("chapter") > mean("block") * 1.15, "главы не крупнее блоков: " + mean("chapter").toFixed(1) + " vs " + mean("block").toFixed(1));

    const graphBefore = view.graph;
    const radiusOf = (id) => view.graph.nodes.find((n) => n.id === id).r;
    const hubId = view.graph.nodes.find((n) => n.type === "section").id;
    view.normSel.value = "global";
    view.normSel.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    const rGlobal = radiusOf(hubId);
    assert.strictEqual(view.graph, graphBefore, "смена режима не должна перестраивать граф");
    view.normSel.value = "byType";
    view.normSel.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    const rByType = radiusOf(hubId);
    assert.ok(Math.abs(rGlobal - rByType) > 0.5, "режимы дали одинаковый радиус: " + rGlobal + " / " + rByType);
    assert.strictEqual(plugin.settings.sizeMode, "byType", "режим не сохранён");
    assert.strictEqual(plugin._data.sizeMode, "byType", "режим не уехал в data.json");
    assert.ok(rByType > rGlobal, "своё «максимум по уровню» должно добавлять размера: " + rByType + " vs " + rGlobal);
    // размер в SVG обновился на месте (тот же DOM-узел). В DOM лежит МОДЕЛЬНЫЙ радиус,
    // увеличенный под текущий зум: вершина не должна вырождаться в точку на экране
    const el = view.nodeEls[hubId].querySelector("circle");
    const hub = view.graph.nodes.find((n) => n.id === hubId);
    // в DOM пишется модельный радиус с поправкой на зум (вершина не должна стать точкой);
    // сравниваем с точностью до округления до 0.1, которое делает сам рендер
    assert.ok(Math.abs(parseFloat(el.getAttribute("r")) - view.radiusModel(hub, view.view.k)) < 0.06,
      "r в DOM = " + el.getAttribute("r") + ", ожидался модельный " + rByType + " с поправкой на зум (" +
      view.radiusModel(hub, view.view.k).toFixed(1) + ")");
    view.normSel.value = "hybrid";
    view.normSel.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    assert.ok(view.graph.stats.unresolved === 0);
  });

  await ok("фильтры: подписи чипов типов, поиск (в т.ч. по-китайски), мин. степень, глава", async () => {
    // у каждого чипа в группе Types обязана быть подпись (у block она однажды пропала)
    const chips = Array.from(view.rootEl.querySelectorAll(".lg-bar .lg-chip[data-type]"));
    assert.strictEqual(chips.length, 4, "чипов типов в панели: " + chips.length);
    const caps = {};
    chips.forEach((c) => { caps[c.getAttribute("data-type")] = c.querySelector("span").textContent.trim(); });
    assert.deepStrictEqual(caps, { chapter: "Chapter", section: "Section", heading: "Heading", block: "Block" },
      "подписи чипов: " + JSON.stringify(caps));
    const total = view.graph.stats.nodes;
    plugin.settings.filters.types.block = false;
    view.applyFilters();
    const hidden = view.graph.nodes.filter((n) => n.type === "block").length;
    assert.strictEqual(view.visibleCount, total - hidden, "block filter: " + view.visibleCount);
    assert.strictEqual(view.nodesLayer.querySelectorAll("g.lg-node--block").length, hidden); // скрытые остаются в DOM
    const hiddenStyles = view.graph.nodes.filter((n) => n.type === "block").every((n) => view.nodeEls[n.id].style.display === "none");
    assert.ok(hiddenStyles, "blocks not hidden");
    plugin.settings.filters.types.block = true;
    view.applyFilters();
    assert.strictEqual(view.visibleCount, total);

    view.searchEl.value = "谱定理";
    view.applyFilters();
    assert.ok(view.visibleCount > 0 && view.visibleCount < total, "CJK search: " + view.visibleCount);
    view.searchEl.value = "";
    view.applyFilters();

    view.minDegEl.value = "15";
    view.plugin.settings.filters.minDegree = 15;
    view.applyFilters();
    const shown = view.graph.nodes.filter((n) => view.visible[n.id]);
    assert.ok(shown.length > 0 && shown.every((n) => n.degree >= 15), "min degree filter broken: " + shown.length);
    assert.ok(shown.length < total, "min degree filter did nothing");
    view.minDegEl.value = "0";
    plugin.settings.filters.minDegree = 0;
    view.applyFilters();

    const chId = "Ch05";
    plugin.settings.filters.chapter = chId;
    view.applyFilters();
    const inCh = view.graph.nodes.filter((n) => view.visible[n.id]);
    assert.ok(inCh.length > 20 && inCh.every((n) => n.chapter === chId), "chapter filter: " + inCh.length);
    plugin.settings.filters.chapter = "";
    view.applyFilters();
    assert.strictEqual(view.visibleCount, total);
  });

  await ok("масштабирование: подписи включаются при увеличении (labelMode=size)", async () => {
    view.select(null); // снятие изоляции: соседняя подсветка скрывает подписи — проверено выше
    plugin.settings.labelMode = "size";
    view.updateLabels();
    // порог ставим по медиане радиусов: тест про поведение, а не про конкретные размеры демо-графа
    const rs = view.graph.nodes.map((n) => n.r).sort((a, b) => a - b);
    plugin.settings.labelRadiusThreshold = rs[Math.floor(rs.length / 2)];
    const small = view.graph.nodes.filter((n) => n.type === "block" && n.r < plugin.labelThreshold());
    const bigEnough = view.graph.nodes.filter((n) => n.r >= plugin.labelThreshold());
    assert.ok(small.length > 20 && bigEnough.length > 20, "порог делит граф некорректно: " + small.length + "/" + bigEnough.length);
    const visibleLabels = () => view.graph.nodes.filter((n) => view.visible[n.id] &&
      view.nodeEls[n.id].__t.getAttribute("style") === "display:block").length;
    const shown = small.filter((n) => view.nodeEls[n.id].__t.getAttribute("style") === "display:block").length;
    assert.strictEqual(shown, 0, "labels shown for small nodes");
    const big = bigEnough[0];
    assert.strictEqual(view.nodeEls[big.id].__t.getAttribute("style"), "display:block", "label hidden for r=" + big.r.toFixed(1));
    const sizeMode = visibleLabels();
    plugin.settings.labelMode = "always";
    view.updateLabels();
    // «всегда» добавляет кандидатов; на экране места хватает не всем, но меньше чем
    // было — точно не должно стать
    assert.ok(visibleLabels() >= sizeMode, "always-режим показал меньше подписей, чем size: " + sizeMode + " -> " + visibleLabels());
    // выбранная вершина получает подпись в любом режиме, даже если на экране тесно
    view.select(small[0].id);
    assert.strictEqual(view.nodeEls[small[0].id].__t.getAttribute("style"), "display:block", "у выбранной вершины нет подписи");
    view.select(null);
    // и наоборот: приближение открывает подписи мелких вершин
    plugin.settings.labelMode = "size";
    view.updateLabels();
    const wide = visibleLabels();
    view.zoomBy(3);
    assert.ok(visibleLabels() > wide, "приближение не открыло подписей: " + wide + " -> " + visibleLabels());
    view.fit();
  });

  await ok("взаимодействие: панорамирование, зум, перетаскивание вершины, dblclick", async () => {
    const ev = (type, x, y, target) => {
      const e = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
      if (target) e.target = target;
      return e;
    };
    const node = view.graph.nodes.find((n) => n.type === "section");
    const g = view.nodeEls[node.id];
    const x0 = node.x;
    // drag вершины
    view.onPointerDown({ button: 0, clientX: 500, clientY: 500, target: g, preventDefault() {} });
    assert.strictEqual(node.fixed, true, "node not pinned while dragging");
    node.x = x0 + 120;
    view.redraw();
    view.onPointerUp();
    assert.strictEqual(node.fixed, false, "node not released");
    assert.ok(Math.abs(node.x - x0 - 120) < 1e-6, "drag did not move node");
    // zoom
    const k0 = view.view.k;
    view.onWheel({ preventDefault() {}, deltaY: -240, clientX: 400, clientY: 300 });
    assert.ok(view.view.k > k0, "zoom-in failed");
    view.onWheel({ preventDefault() {}, deltaY: 2400, clientX: 400, clientY: 300 });
    assert.ok(view.view.k < 1, "zoom-out failed");
    // fit + pan
    view.fit();
    const vx = view.view.x;
    view.onPointerDown({ button: 0, clientX: 100, clientY: 100, target: view.svg, preventDefault() {} });
    view.onPointerMove({ clientX: 160, clientY: 120 });
    assert.strictEqual(view.view.x, vx + 60, "pan failed");
    view.onPointerUp();
    assert.ok(view.layer.getAttribute("transform").startsWith("translate("), "layer transform missing");
  });

  await ok("зум: кнопки «+»/«−» на холсте и читаемость на любом масштабе", async () => {
    view.select(null);
    view.neigh = null;
    view.fit();
    const btn = (txt) => Array.from(view.rootEl.querySelectorAll("button.lg-zoom__btn"))
      .find((b) => b.textContent.trim() === txt);
    assert.ok(btn("+") && btn("\u2212"), "на холсте нет кнопок зума «+»/«−»");
    assert.ok(view.zoomValEl, "нет индикатора масштаба");
    assert.ok(view.zoomInBtn.parentNode.classList.contains("lg-zoom"), "кнопки зума не на холсте");
    // кнопки лежат на сцене, а не в панели: в полноэкранном режиме панель спрятана
    assert.strictEqual(view.zoomInBtn.closest(".lg-bar"), null, "кнопки зума попали в панель управления");

    const k0 = view.view.k;
    assert.ok(k0 < 0.5, "весь граф должен уезжать на k<0.5, иначе проверка бессмысленна: " + k0.toFixed(3));
    btn("+").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.ok(Math.abs(view.view.k - k0 * 1.3) < 1e-6, "«+» не увеличил: " + view.view.k);
    btn("\u2212").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.ok(Math.abs(view.view.k - k0) < 1e-6, "«−» не вернул: " + view.view.k);
    assert.ok(/%/.test(view.zoomValEl.textContent), "индикатор масштаба пустой: «" + view.zoomValEl.textContent + "»");
    // команды палитры дублируют кнопки
    const zin = plugin.commands.find((c) => c.id === "zoom-in");
    const zout = plugin.commands.find((c) => c.id === "zoom-out");
    assert.ok(zin && zout && plugin.commands.find((c) => c.id === "zoom-fit"), "нет команд зума");
    zin.callback();
    assert.ok(view.view.k > k0 * 1.2, "команда zoom-in не сработала");
    zout.callback();
    assert.ok(Math.abs(view.view.k - k0) < 1e-6, "команда zoom-out не сработала");

    // ГЛАВНОЕ: вершины и подписи остаются видимыми при любом отдалении.
    // До правки на весь граф (k≈0.07) радиус 13 px давал 0.9 px, а кегль 11 px — 0.8 px.
    const sample = view.graph.nodes.filter((n) => view.visible[n.id]).slice(0, 400);
    const screenR = (n) => parseFloat(view.nodeEls[n.id].querySelector("circle").getAttribute("r")) * view.view.k;
    const screenF = (n) => parseFloat(view.nodeEls[n.id].__t.getAttribute("font-size")) * view.view.k;
    view.fit();
    const rsFit = sample.map(screenR).sort((a, b) => a - b);
    const rFit = rsFit[0], rMed = rsFit[rsFit.length >> 1];
    const fFit = Math.min(...sample.map(screenF));
    view.zoomBy(0.15); // отдаляемся ещё сильнее
    const rsOut = sample.map(screenR).sort((a, b) => a - b);
    const rOut = rsOut[0], fOut = Math.min(...sample.map(screenF));
    assert.ok(rFit > 1.2, "после Fit вершина мельче 1.2 px: " + rFit.toFixed(2));
    assert.ok(rMed > 2, "после Fit медианная вершина мельче 2 px: " + rMed.toFixed(2));
    assert.ok(rOut > 1.2, "при отдалении вершина вырождается в точку: " + rOut.toFixed(2));
    assert.ok(fFit > 8, "после Fit кегль мельче 8 px: " + fFit.toFixed(2));
    assert.ok(Math.abs(fOut - fFit) < 0.05, "кегль на экране не постоянен: " + fFit.toFixed(2) + " -> " + fOut.toFixed(2));
    // рёбра не должны исчезать: их толщина задана в экранных пикселях
    const css = fs.readFileSync(path.join(PLUGIN_DIR, "styles.css"), "utf8").replace(/\r/g, "");
    assert.ok(/\.lg-edges \{[^}]*non-scaling-stroke/.test(css), "толщина рёбер привязана к модели — при отдалении они исчезнут");
    view.fit();
  });

  await ok("выделение вершины: связанные дуги рисуются своим цветом", async () => {
    const css = fs.readFileSync(path.join(PLUGIN_DIR, "styles.css"), "utf8").replace(/\r/g, "");
    const rule = (css.match(/\.lg-edges--sel\s*\{[^}]*\}/) || [""])[0];
    assert.ok(rule, "нет правила для выделенных рёбер");
    assert.ok(/stroke:\s*var\(--interactive-accent/.test(rule), "выделенные рёбра не своим цветом: " + rule);
    assert.ok(!/stroke:\s*var\(--text-normal\)/.test(rule), "выделение обязано отличаться от обычного цвета");
    // regression: .lg-label не должен задавать font-size — иначе он перебьёт кегль
    // каждой вершины (presentation-атрибут проигрывает любому селектору) и A−/A+
    // перестанут что-либо менять на экране
    const labelRule = (css.match(/\.lg-label \{[^}]*\}/) || [""])[0];
    assert.ok(labelRule, "нет правила .lg-label");
    assert.ok(!/font-size/.test(labelRule), "в .lg-label снова задан font-size: " + labelRule);

    const node = view.graph.nodes.find((n) => n.type === "chapter");
    const degree = view.graph.edges.filter((e) => e.source === node.id || e.target === node.id).length;
    assert.ok(degree > 3, "у главы слишком мало связей для проверки: " + degree);
    view.select(null);
    assert.strictEqual(view.edgesSel.getAttribute("d") || "", "", "без выбора слой рёбер непустой");
    view.select(node.id);
    const d = view.edgesSel.getAttribute("d") || "";
    assert.ok(d.length > 20, "связи выбранной вершины не нарисованы");
    const segs = (d.match(/M/g) || []).length;
    assert.strictEqual(segs, degree, "нарисовано " + segs + " дуг из " + degree);
    // снятие выделения гасит слой
    view.select(node.id);
    assert.strictEqual(view.edgesSel.getAttribute("d") || "", "", "слой рёбер не погас");
  });

  await ok("экспорт SVG: только видимые вершины, CJK-шрифт, валидный XML", async () => {
    const file = await view.exportSVG();
    assert.ok(file && file.path.startsWith(plugin.settings.exportFolder), "path " + (file && file.path));
    const svg = fs.readFileSync(path.join(TMP, file.path), "utf8");
    const circles = (svg.match(/<circle /g) || []).length;
    assert.strictEqual(circles, view.visibleCount, "circles " + circles + " vs visible " + view.visibleCount);
    assert.ok(/Noto Sans CJK/.test(svg));
    assert.ok(/data-degree="\d+"/.test(svg), "degree not exported");
    assert.ok(svg.trim().endsWith("</svg>"));
    assert.strictEqual((svg.match(/<svg/g) || []).length, 1);
    assert.ok(!/undefined|NaN/.test(svg), "undefined/NaN leaked into svg");
  });

  await ok("команды: CSV/JSON/markdown-таблица подписей", async () => {
    Notice.all.length = 0;
    const cmd = (id) => plugin.commands.find((c) => c.id === id);
    await cmd("export-csv").callback();
    await cmd("labels-note").callback();
    const csvFile = fs.readdirSync(path.join(TMP, plugin.settings.exportFolder)).filter((f) => f.endsWith(".csv"));
    assert.ok(csvFile.length === 1, "csv files: " + csvFile.length);
    const csv = fs.readFileSync(path.join(TMP, plugin.settings.exportFolder, csvFile[0]), "utf8").trim().split("\n");
    assert.strictEqual(csv.length, NODES + 1, "csv rows " + csv.length);
    assert.ok(/\|"?$/.test(csv[0]) || csv[0].startsWith("path,id,type,name,name_zh"), csv[0]);
    const md = fs.readFileSync(path.join(TMP, plugin.settings.exportFolder, "Labels table.md"), "utf8");
    assert.ok(md.includes("## chapter") && md.includes("## block"));
    assert.ok(/[一-鿿]/.test(md), "labels note has no translation");
    assert.ok(Notice.all.every((m) => !/Не удалось/.test(m)), "errors: " + Notice.all.join("|"));
  });

  await ok("refs в frontmatter: значения равны степени в графе, тело не тронуто", async () => {
    const before = {};
    const sample = view.graph.nodes.filter((n) => n.type !== "inline").slice(0, 400);
    sample.forEach((n) => (before[n.path] = fs.readFileSync(path.join(TMP, n.path), "utf8")));
    await plugin.writeCounts();
    const g = await plugin.getGraph(false);
    const touched = new Set();
    for (const n of sample) {
      const raw = fs.readFileSync(path.join(TMP, n.path), "utf8");
      const parsed = obsidian_stub_parse(raw);
      if (Number(parsed.data.refs) === n.degree) touched.add(n.path);
      assert.strictEqual(parsed.body, obsidian_stub_parse(before[n.path]).body, "body changed: " + n.path);
      assert.ok(["chapter", "section", "heading", "block"].includes(parsed.data.type), "type lost: " + n.path);
      assert.ok(!/NaN|null/.test(raw), "bad value in " + n.path);
    }
    assert.ok(touched.size >= 300, "refs written for only " + touched.size + " notes");
    // идемпотентность: второй проход не меняет файлы
    const one = sample[0].path;
    const a = fs.readFileSync(path.join(TMP, one), "utf8");
    await plugin.writeCounts();
    assert.strictEqual(fs.readFileSync(path.join(TMP, one), "utf8"), a, "writeCounts not idempotent");
  });

  await ok("автообновление: изменение файла на диске обновляет кэш графа", async () => {
    plugin.settings.autoRefresh = true;
    const n = view.graph.nodes.find((x) => x.type === "section");
    const abs = path.join(TMP, n.path);
    const raw = fs.readFileSync(abs, "utf8");
    fs.writeFileSync(abs, raw.replace(/^status: placeholder$/m, "status: draft"));
    app.vault.trigger("modify", new TFile(n.path, abs));
    await new Promise((r) => setTimeout(r, 40));
    await new Promise((r) => setTimeout(r, 900));
    const raw2 = fs.readFileSync(abs, "utf8");
    assert.ok(raw2.includes("status: draft"), "fixture edit lost");
    assert.ok(plugin.cache === null || plugin.cache === undefined || plugin.cache.nodes.length === NODES, "cache invalidation failed");
  });

  await ok("settings tab отображается и сохраняет настройки", async () => {
    const tab = plugin.settingTabs[0];
    tab.display();
    const n = tab.containerEl._settings;
    assert.ok(n >= 18, "settings count " + n);
    assert.ok(tab.containerEl.textContent.includes("Папки для обхода"));
    assert.ok(tab.containerEl.textContent.includes("Ключ перевода"));
    assert.ok(tab.containerEl.textContent.includes("Файл иерархического оглавления"), "нет настройки пути к оглавлению");
    const names = Array.from(tab.containerEl.querySelectorAll(".setting-item-name")).map((e) => e.textContent.trim());
    ["Chapter", "Section", "Heading", "Block"].forEach((t) =>
      assert.ok(names.includes(t), "в разделе «Цвета по типам» нет строки " + t));
    assert.ok(names.every((x) => x.length > 0), "в настройках есть строка с пустым именем: " + JSON.stringify(names));
    assert.ok(plugin.settings.indexNote.endsWith("Course Index.md"), plugin.settings.indexNote);
    // поменяли минимальный радиус -> настройки сохранены, граф пересчитан
    const item = tab.containerEl._all.find((x) => x.nameEl.textContent.indexOf("Максимальный радиус") >= 0);
    assert.ok(item, "setting 'Максимальный радиус' not rendered");
    const slider = item.controls.filter((c) => c._onChange)[0];
    const before = JSON.stringify(plugin.settings.maxRadius);
    slider._onChange(50);
    await new Promise((r) => setTimeout(r, 5));
    assert.notStrictEqual(JSON.stringify(plugin.settings.maxRadius), before, "maxRadius not applied");
    assert.strictEqual(plugin._data.maxRadius, 50, "not persisted");
    assert.ok(plugin.cache, "graph should be rebuilt after settings change");
  });

  await ok("file-menu: команда редактирования подписи добавляется для md", async () => {
    const menu = new obsidian.Menu(app);
    app.workspace.trigger("file-menu", menu, new TFile(view.graph.nodes[0].path, path.join(TMP, view.graph.nodes[0].path)), null, "file-editor");
    const item = menu.items.find((i) => i._t === "Edit graph label");
    assert.ok(item, "no menu item");
    await item._cb();
    assert.ok(document.querySelector(".modal .lg-modal"), "modal not opened from menu");
    document.querySelector(".modal").parentNode.removeChild(document.querySelector(".modal"));
  });

  console.log("\n== раунд 18: ключевые фразы (этап 2) ==");

  await ok("команда палитры: «Recompute keyword links» registered и названа", async () => {
    const cmd = plugin.commands.find((c) => c.id === "recompute-keywords");
    assert.ok(cmd, "нет команды recompute-keywords");
    assert.ok(/keyword/i.test(cmd.name), "имя команды невнятное: " + cmd.name);
    const tab = plugin.settingTabs[0];
    tab.display();
    const txt = tab.containerEl.textContent;
    assert.ok(/Считать рёбра по ключевым фразам/.test(txt), "в настройках нет тумблера ключевых фраз");
    assert.ok(/Папка аннотаций/.test(txt), "нет настройки папки корпуса");
    assert.ok(/вхождени/i.test(txt), "тумблер не объясняет, что такое вхождения и корпус");
    assert.ok(/материализ|ссылк/i.test(txt), "в описании тумблера не сказано, что ссылки пишутся в заметку");
    // значение поля должно соответствовать тому, что реально лежит в data.json
    const vals = Array.from(tab.containerEl.querySelectorAll("input")).map((i) => i.value);
    assert.ok(vals.includes(plugin.settings.keywordFolder), "поле папки корпуса пустое: " + JSON.stringify(vals.slice(0, 8)));
    // строка именно с тумблером (не с текстовым полем) и она про ключевые фразы
    const boxes = Array.from(tab.containerEl.querySelectorAll('input[type="checkbox"]'));
    const kwRow = boxes.find((b) => /Считать рёбра по ключевым фразам/.test(String(b.parentNode.textContent)));
    assert.ok(kwRow, "у настройки ключевых фраз нет тумблера (чекбоксов: " + boxes.length + ")");
  });

  await ok("граф из коробки: блоки с ключевыми фразами уже материализованы и весят по вхождениям", async () => {
    const g = view.graph;
    const kw = g.nodes.filter((n) => n.kwWeight > 0);
    assert.ok(kw.length >= 100, "вершин с весом: " + kw.length);
    assert.ok(g.edges.some((e) => e.kind === "keyword"), "рёбер keyword в графе нет");
    kw.forEach((n) => assert.strictEqual(n.sizeValue, n.kwWeight, n.id + ": размер не по весу"));
    assert.ok(view.edgesRef.getAttribute("d").length > 1000, "дуги ссылок пустые");
  });

  await ok("материализация по команде: список фраз -> реальные ссылки, вес, идемпотентность", async () => {
    const node = view.graph.nodes.find((n) => n.type === "block" && !n.keywords.length && n.parent);
    assert.ok(node, "не нашлось блока без ключевых фраз");
    const abs = path.join(TMP, node.path);
    const raw = fs.readFileSync(abs, "utf8");
    fs.writeFileSync(abs, core.setFrontmatterValues(raw, { keywords_en: "vector space" }));
    const res = await plugin.recomputeKeywords();
    assert.ok(res && res.touched >= 1, "команда ничего не записала: " + JSON.stringify(res));
    const after = fs.readFileSync(abs, "utf8");
    assert.ok(after.indexOf("<!-- keywords:begin -->") >= 0, "регион не появился");
    assert.ok(after.indexOf("<!-- keywords:end -->") >= 0, "регион не закрыт");
    const parsed = obsidian_stub_parse(after);
    const w = Number(parsed.data.weight);
    assert.ok(w > 0, "вес не записан: " + parsed.data.weight);
    const links = (after.slice(after.indexOf("keywords:begin"), after.indexOf("keywords:end")).match(/\[\[/g) || []).length;
    assert.ok(links >= 1, "в регионе нет ни одной ссылки");
    const g = await plugin.getGraph(true);
    const n2 = g.nodes.find((x) => x.id === node.id);
    assert.strictEqual(n2.kwWeight, w, "вес в заметке (" + w + ") не равеносу в графе (" + n2.kwWeight + ")");
    assert.strictEqual(n2.sizeValue, w, "размер не по весу");
    assert.ok(n2.out.filter((o) => o.kind === "keyword").length === links, "ссылок в регионе и рёбер разное число");
    // идемпотентность: второй прогон не трогает файл
    const res2 = await plugin.recomputeKeywords();
    assert.ok(res2.touched === 0, "второй прогон что-то переписал: " + res2.touched);
    assert.strictEqual(fs.readFileSync(abs, "utf8"), after, "файл изменился при повторном запуске");
    // правка вне региона не тронута: всё, что было в теле, осталось префиксом нового
    const beforeBody = core.parseFrontmatter(raw).body;
    assert.ok(parsed.body.startsWith(beforeBody.replace(/\s+$/g, "")), "тело вне региона изменилось");
    assert.ok(/Used together with: \[\[/.test(after), "ручные ссылки блока пропали");
    assert.strictEqual(core.parseFrontmatter(core.setFrontmatterValues(raw, { keywords_en: "vector space" })).data.status, "placeholder", "прочие свойства поехали");
    fs.writeFileSync(abs, raw); // возвращаем как было
    await plugin.getGraph(true);
  });

  await ok("снятие keywords_en: убирает регион и weight: — мусор не остаётся", async () => {
    const g0 = await plugin.getGraph(true);
    const node = g0.nodes.find((n) => n.type === "block" && n.keywords.length);
    const abs = path.join(TMP, node.path);
    const withKw = fs.readFileSync(abs, "utf8");
    assert.ok(withKw.indexOf("keywords:begin") >= 0, "исходный блок без региона: " + node.path);
    const stripped = withKw.replace(/^keywords_en:.*\n/m, "");
    fs.writeFileSync(abs, stripped);
    const res = await plugin.recomputeKeywords();
    assert.ok(res.cleaned >= 1, "регион не снялся: " + JSON.stringify(res));
    const after = fs.readFileSync(abs, "utf8");
    assert.strictEqual(after.indexOf("keywords:"), -1, "после снятия списка остались следы");
    assert.strictEqual(core.parseFrontmatter(after).data.weight, undefined, "weight: остался в frontmatter");
    const body = core.parseFrontmatter(after).body;
    const origBody = core.parseFrontmatter(withKw).body;
    assert.ok(origBody.indexOf("keywords:begin") >= 0);
    const before = origBody.slice(0, origBody.indexOf("<!-- keywords:begin -->")).replace(/\s+$/g, "");
    assert.strictEqual(body.replace(/\s+$/g, ""), before, "вне региона тело изменилось");
    fs.writeFileSync(abs, withKw);
    await plugin.getGraph(true);
  });

  await ok("блоки без списка фраз команда не трогает", async () => {
    const g = await plugin.getGraph(true);
    const plain = g.nodes.filter((n) => n.type === "block" && !n.keywords.length).slice(0, 40);
    const before = plain.map((n) => fs.readFileSync(path.join(TMP, n.path), "utf8"));
    const res = await plugin.recomputeKeywords();
    assert.strictEqual(res.touched, 0, "переписаны блоки без фраз: " + res.touched);
    plain.forEach((n, i) => assert.strictEqual(fs.readFileSync(path.join(TMP, n.path), "utf8"), before[i], n.id + " тронут"));
  });

  await ok("тумблер настройки: рёбра корпуса исчезают, размер снова по ссылкам, пузырёк молчит", async () => {
    const g0 = await plugin.getGraph(true);
    const kwId = g0.nodes.filter((n) => n.kwWeight > 0)[0].id;
    plugin.settings.keywordLinks = false;
    const g1 = await plugin.getGraph(true);
    assert.strictEqual(g1.edges.filter((e) => e.kind === "keyword").length, 0, "тумблер не выключил рёбра корпуса");
    const n1 = g1.nodes.find((n) => n.id === kwId);
    assert.strictEqual(n1.kwWeight, 0, "вес остался при выключенном тумблере");
    assert.strictEqual(n1.sizeValue, n1.degree, "размер не вернулся к ссылкам");
    const bubble = view.bubbleEl;
    view.select(null);
    view.select(kwId);
    await new Promise((r) => setTimeout(r, 40));
    assert.ok(bubble.classList.contains("lg-bubble--open"), "пузырёк не открылся — проверка была бы пустой");
    // список фраз — это свойства заметки, он остаётся; а вот вес и глава-лидер при
    // выключенном счёте показаны быть не должны (иначе цифры врут про картинку)
    const offKw = bubble.querySelector(".lg-bubble__kw");
    assert.ok(offKw, "из пузырька пропал сам список фраз");
    assert.ok(/выключен/.test(offKw.textContent), "пузырёк не предупреждает, что счёт выключен: " + offKw.textContent);
    assert.ok(!/вес\s\d+ · глава/.test(offKw.textContent), "при выключенном счёте показывает вес: " + offKw.textContent);
    plugin.settings.keywordLinks = true;
    const g2 = await plugin.getGraph(true);
    assert.ok(g2.edges.some((e) => e.kind === "keyword"), "тумблер обратно не включил рёбра");
  });

  await ok("пузырёк блока: список фраз, вес и глава-лидер", async () => {
    const g = await plugin.getGraph(true);
    const n = g.nodes.filter((x) => x.kwWeight > 0 && x.kwChapter && x.kwChapter !== x.chapter)[0] || g.nodes.filter((x) => x.kwWeight > 0)[0];
    view.select(null);
    view.select(n.id);
    await new Promise((r) => setTimeout(r, 40));
    assert.ok(view.bubbleEl.classList.contains("lg-bubble--open"), "пузырёк не открылся");
    const kw = view.bubbleEl.querySelector(".lg-bubble__kw");
    assert.ok(kw, "в пузырье нет строки ключевых фраз");
    assert.ok(kw.textContent.includes(n.keywords[0]), "список фраз не показан: " + kw.textContent);
    assert.ok(new RegExp("вес\\s" + n.kwWeight).test(kw.textContent), "вес не совпадает: " + kw.textContent);
    if (n.kwChapter !== n.chapter) {
      assert.ok(kw.textContent.includes("глава " + n.kwChapter), "глава-лидер не показана: " + kw.textContent);
      assert.strictEqual(n.color, g.colorsByChapter[n.kwChapter], "цвет не глава-лидер");
    }
    view.select(null);
  });

  console.log("\n== раунд 19: создание узла правым кликом по пустому холсту ==");

  await ok("команда палитры «Create new node» зарегистрирована", async () => {
    const cmd = plugin.commands.find((c) => c.id === "create-node");
    assert.ok(cmd, "нет команды create-node");
    assert.ok(/create/i.test(cmd.name), "имя команды невнятное: " + cmd.name);
  });

  await ok("пустой холст: правый клик открывает меню с созданием узла, модалка живая", async () => {
    // подменяем Menu в стабе: главное — поймать экземпляр, который создаёт вид
    const OrigMenu = obsidian.Menu;
    let captured = null;
    obsidian.Menu = class extends OrigMenu {
      constructor(a) {
        super(a);
        captured = this;
      }
    };
    try {
      view.svg.dispatchEvent(
        new dom.window.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 40, clientY: 40 })
      );
      assert.ok(captured, "меню не создано");
      const titles = captured.items.filter((i) => !i.sep).map((i) => i._t);
      assert.ok(/Create node/i.test(titles.join(" | ")), "нет пункта создания узла: " + titles.join(" | "));
      const item = captured.items.find((i) => i._t && /Create node/i.test(i._t));
      await item._cb();
      const modal = document.querySelector(".modal .lg-create");
      assert.ok(modal, "модалка создания не открылась");
      assert.ok(modal.querySelector("#lg-new-name"), "нет поля названия (EN)");
      assert.ok(modal.querySelector("#lg-new-name-zh"), "нет поля названия (中文)");
      assert.ok(modal.querySelector("#lg-new-keywords"), "нет поля ключевых слов");
      assert.ok(modal.querySelector("#lg-new-type"), "нет выбора типа вершины");
      assert.ok(modal.querySelector("#lg-new-parent"), "нет выбора родителя");
    } finally {
      obsidian.Menu = OrigMenu;
    }
    // закрыть модалку — сама она не нужна, поток создания проверяем ниже
    document.querySelector(".modal").parentNode.removeChild(document.querySelector(".modal"));
  });

  await ok("создание узла: заметка + авторазместка + автоматический поиск тем из корпуса", async () => {
    const prevAutoMerge = plugin.settings.autoMergeDuplicates;
    plugin.settings.autoMergeDuplicates = false;
    try {
      const before = (await plugin.getGraph(false)).stats.nodes;
      const res = await plugin.createNewNode({
      type: "block",
      nameEn: "Manual Test Topic",
      nameZh: "Ручная тестовая тема",
      keywords: "vector space; compact set",
    });
    assert.ok(res && res.file, "createNewNode не вернул результат");
    const raw = fs.readFileSync(path.join(TMP, res.file.path), "utf8");
    const parsed = obsidian_stub_parse(raw);
    // конвенции заметки
    assert.ok(/^MN-\d+$/.test(parsed.data.id), "id не из серии MN: " + parsed.data.id);
    assert.strictEqual(parsed.data.type, "block");
    assert.strictEqual(parsed.data.name, "Manual Test Topic");
    assert.strictEqual(parsed.data.name_zh, "Ручная тестовая тема");
    assert.strictEqual(parsed.data.status, "draft");
    assert.ok(String(parsed.data.keywords_en).includes("vector space"), "keywords_en не записан");
    assert.ok(parsed.data.weight > 0, "вес по корпусу не записан");
    assert.ok(parsed.data.chapter, "глава-лидер не определилась");
    // заметка легла в папку блоков своей главы, регион материализован
    assert.ok(res.file.path.indexOf("30 - Blocks/") === 0, "не в папке блоков: " + res.file.path);
    assert.ok(raw.indexOf("<!-- keywords:begin -->") >= 0 && raw.indexOf("<!-- keywords:end -->") > 0, "нет региона ключевых фраз");
    assert.ok(/\[\[Ch\d+-S\d+(?:-H\d+)?[^\]]*\|/.test(raw), "в регионе нет ссылок на темы курса");
    // граф пересобран: вершина с рёбрами keyword, размер по весу, выбрана в виде
    const g = await plugin.getGraph(false);
    assert.strictEqual(g.stats.nodes, before + 1, "вершин не прибавилось");
    const n = g._byId[parsed.data.id];
    assert.ok(n, "новой вершины нет в графе");
    assert.strictEqual(n.kwWeight, parsed.data.weight, "вес в графе != weight: в заметке");
    assert.strictEqual(n.sizeValue, n.kwWeight, "размер не по весу");
    assert.ok(n.out.filter((o) => o.kind === "keyword").length >= 1, "рёбер keyword нет");
    assert.strictEqual(n.chapter, parsed.data.chapter, "глава в графе != главе в заметке");
    assert.strictEqual(view.selected, n.id, "новая вершина не выбрана в представлении");
    // второй узел — другой id и другой путь
    const res2 = await plugin.createNewNode({ type: "block", nameEn: "Second Manual Node" });
    assert.ok(res2 && res2.file, "второй узел не создался");
    assert.notStrictEqual(res2.id, res.id, "id повторился");
    assert.notStrictEqual(res2.file.path, res.file.path, "путь повторился");
      assert.ok(!res2.plan, "без ключевых фраз не должно быть плана корпуса");
    } finally {
      plugin.settings.autoMergeDuplicates = prevAutoMerge;
    }
  });

  await ok("создание с родителем: id по конвенции курса и структурное ребро", async () => {
    const prevAutoMerge = plugin.settings.autoMergeDuplicates;
    plugin.settings.autoMergeDuplicates = false;
    try {
      const res = await plugin.createNewNode({
      type: "block",
      nameEn: "Child of a Heading",
      nameZh: "ребёнок заголовка",
      parent: "Ch01-S01-H01",
    });
    assert.ok(res, "узел не создан");
    assert.ok(/^Ch01-S01-H01-B\d+$/.test(res.id), "id не по конвенции родителя: " + res.id);
    const parsed = obsidian_stub_parse(fs.readFileSync(path.join(TMP, res.file.path), "utf8"));
    assert.strictEqual(parsed.data.parent, "Ch01-S01-H01");
    assert.strictEqual(parsed.data.chapter, "Ch01", "глава не от родителя");
    const g = await plugin.getGraph(false);
      assert.ok(
        g.edges.some((e) => e.source === res.id && e.target === "Ch01-S01-H01" && e.kind === "structure"),
        "структурного ребра на родителя нет"
      );
    } finally {
      plugin.settings.autoMergeDuplicates = prevAutoMerge;
    }
  });

  await ok("создание узла: точное совпадение названия даёт связь с темой по имени", async () => {
    const prevAutoMerge = plugin.settings.autoMergeDuplicates;
    plugin.settings.autoMergeDuplicates = false;
    try {
      const ch = (await plugin.getGraph(false)).nodes.find((n) => n.type === "chapter" && n.name === "Hilbert Space Geometry");
    assert.ok(ch, "в курсе нет такой главы — тест пуст");
    const res = await plugin.createNewNode({
      type: "block",
      nameEn: ch.name,
      nameZh: "希尔伯特空间几何",
      keywords: "orthogonal projection",
    });
    assert.ok(res, "узел не создан");
    const raw = fs.readFileSync(path.join(TMP, res.file.path), "utf8");
    assert.ok(raw.indexOf("[[" + ch.stem + "|") >= 0, "нет ссылки на главу с совпавшим названием");
    assert.ok(/## Related topics/.test(raw), "нет раздела Related topics");
    const g = await plugin.getGraph(false);
    const n = g._byId[res.id];
    assert.ok(n.out.some((o) => o.id === ch.id && o.kind === "reference"), "связь с главой не стала ребром reference");
      // глава с совпавшим названием не дублируется в регионе корпуса (там только секции/заголовки)
      assert.ok(!n.out.some((o) => o.id === ch.id && o.kind === "keyword"), "дубль связи в корпусе");
    } finally {
      plugin.settings.autoMergeDuplicates = prevAutoMerge;
    }
  });

  await ok("модалка: сабмит создаёт заметку и закрывает окно", async () => {
    const prevAutoMerge = plugin.settings.autoMergeDuplicates;
    plugin.settings.autoMergeDuplicates = false;
    try {
      const modal = new PluginClass.CreateNodeModal(app, plugin, {});
    modal.open();
    const el = document.querySelector(".modal .lg-create");
    assert.ok(el, "модалка не открылась");
    el.querySelector("#lg-new-name").value = "Modal Made Node";
    el.querySelector("#lg-new-name-zh").value = "模态创建的节点";
    el.querySelector("#lg-new-keywords").value = "basis and coordinates";
    const btn = Array.from(el.querySelectorAll("button")).find((b) => b.textContent === "Создать");
    assert.ok(btn, "кнопки «Создать» нет");
    await new Promise((r) => btn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })) && r());
    await new Promise((r) => setTimeout(r, 30));
    assert.strictEqual(modal.isOpen, false, "модалка не закрылась после создания");
    const g = await plugin.getGraph(false);
    const n = g.nodes.find((x) => x.name === "Modal Made Node");
    assert.ok(n, "заметки из модалки нет в графе");
    assert.strictEqual(n.nameZh, "模态创建的节点");
    assert.ok(n.keywords.includes("basis and coordinates"), "ключевые фразы из модалки не дошли");
      const raw = fs.readFileSync(path.join(TMP, n.path), "utf8");
      assert.ok(/<!-- keywords:begin -->/.test(raw), "регион по фразам из модалки не построен");
    } finally {
      plugin.settings.autoMergeDuplicates = prevAutoMerge;
    }
  });

  await ok("созданный узел: повторный пересчёт фраз не меняет заметку (идемпотентность)", async () => {
    const g0 = await plugin.getGraph(false);
    const n = g0.nodes.filter((x) => /^MN-/.test(x.id) && x.keywords.length)[0];
    assert.ok(n, "нет созданного узла с фразами");
    const before = fs.readFileSync(path.join(TMP, n.path), "utf8");
    await plugin.recomputeKeywords();
    const after = fs.readFileSync(path.join(TMP, n.path), "utf8");
    assert.strictEqual(after, before, "пересчёт переписал созданную заметку");
    const g1 = await plugin.getGraph(false);
    const n1 = g1._byId[n.id];
    assert.strictEqual(n1.kwWeight, n.kwWeight, "вес изменился после пересчёта");
  });

  console.log("\n== раунд 20: ручная связь — ЛКМ по первому узлу, затем Ctrl+ЛКМ по второму ==");

  // пара без дуги между ними: блок из Ch01 и глава другой главы
  const gLink0 = await plugin.getGraph(false);
  const hasEdge = (s, t) => gLink0.edges.some((e) => e.source === s && e.target === t);
  const linkA = gLink0.nodes.find((n) => n.type === "block" && !n.inline && n.id === "Ch01-S01-H01-B01");
  const linkB = gLink0.nodes.find((n) => n.type === "chapter" && n.id !== linkA.chapter && !hasEdge(linkA.id, n.id));

  await ok("Ctrl+ЛКМ по второму узлу: ссылка в заметке, дуга в графе, позиции не прыгают", async () => {
    assert.ok(linkA && linkB, "фикстуры не найдены");
    assert.ok(!hasEdge(linkA.id, linkB.id), "дуга была ещё до теста");
    view.select(null);
    view.select(linkA.id);
    assert.strictEqual(view.selected, linkA.id, "первый узел не выделился");
    const ax = view.byId[linkA.id].x, ay = view.byId[linkA.id].y;
    assert.ok(isFinite(ax) && isFinite(ay), "у вершины нет координат");
    const edgesBefore = (await plugin.getGraph(false)).edges.length;
    view.nodeEls[linkB.id].dispatchEvent(
      new dom.window.MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, ctrlKey: true })
    );
    // linkSelectedTo асинхронный: ждём, пока дуга появится в кэше
    const deadline = Date.now() + 30000;
    let made = false;
    while (Date.now() < deadline) {
      const gg = await plugin.getGraph(false);
      if ((made = gg.edges.some((e) => e.source === linkA.id && e.target === linkB.id))) break;
      await new Promise((r) => setTimeout(r, 120));
    }
    assert.ok(made, "дуга не появилась после Ctrl+клика");
    const gg = await plugin.getGraph(false);
    const e = gg.edges.find((x) => x.source === linkA.id && x.target === linkB.id);
    assert.strictEqual(e.kind, "reference", "ручная связь — не ребро reference");
    assert.strictEqual(gg.edges.length, edgesBefore + 1, "лишние рёбра");
    // ссылка записана в заметку источника, в раздел «вне региона»
    const textAfter = fs.readFileSync(path.join(TMP, linkA.path), "utf8");
    assert.ok(textAfter.indexOf("[[" + linkB.stem + "|" + linkB.name + "]] — added via graph") > 0, "ссылка не записана в заметку");
    assert.ok(textAfter.indexOf("## Related topics") >= 0, "нет раздела Related topics");
    // выделение осталось на первом узле (можно тянуть дальше), координаты перенесены
    assert.strictEqual(view.selected, linkA.id, "выделение слетело с источника");
    assert.strictEqual(view.byId[linkA.id].x, ax, "x источника прыгнул после пересборки");
    assert.strictEqual(view.byId[linkA.id].y, ay, "y источника прыгнул после пересборки");
    // соседи подсветки обновлены: цель теперь в окрестности источника
    assert.ok(view.neigh && view.neigh[linkB.id], "новая цель не вошла в подсветку соседей");
  });

  await ok("повторный Ctrl+клик по той же паре — дубль не создаётся", async () => {
    const before = fs.readFileSync(path.join(TMP, linkA.path), "utf8");
    const edgesBefore = (await plugin.getGraph(false)).edges.length;
    view.nodeEls[linkB.id].dispatchEvent(
      new dom.window.MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, ctrlKey: true })
    );
    await new Promise((r) => setTimeout(r, 300));
    assert.strictEqual(fs.readFileSync(path.join(TMP, linkA.path), "utf8"), before, "заметка изменилась от дубля");
    assert.strictEqual((await plugin.getGraph(false)).edges.length, edgesBefore, "дубль ребра");
    assert.strictEqual(view.selected, linkA.id, "выделение слетело");
  });

  await ok("Ctrl+клик по тому же узлу и без выделения: связь с собой нельзя, пустое выделение делает клик первым шагом", async () => {
    const before = fs.readFileSync(path.join(TMP, linkA.path), "utf8");
    view.nodeEls[linkA.id].dispatchEvent(
      new dom.window.MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, ctrlKey: true })
    );
    await new Promise((r) => setTimeout(r, 200));
    assert.strictEqual(fs.readFileSync(path.join(TMP, linkA.path), "utf8"), before, "создана связь с собой");
    assert.strictEqual(view.selected, linkA.id, "выделение источника потеряно");
    // без выделения: узел становится первым шагом, а не целью
    view.select(null);
    view.nodeEls[linkB.id].dispatchEvent(
      new dom.window.MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, ctrlKey: true })
    );
    await new Promise((r) => setTimeout(r, 120));
    assert.strictEqual(view.selected, linkB.id, "Ctrl+клик без выделения не выбрал узел как источник");
  });

  await ok("контекстное меню при выделенной вершине: оба направления связи без Ctrl", async () => {
    const OrigMenu = obsidian.Menu;
    let captured = null;
    obsidian.Menu = class extends OrigMenu {
      constructor(a) { super(a); captured = this; }
    };
    try {
      view.select(null);
      view.select(linkB.id); // источник — глава
      // цель — другой блок, на который у главы ещё нет ссылки
      const gg = await plugin.getGraph(false);
      const has = (s, t) => gg.edges.some((e) => e.source === s && e.target === t);
      const tgt = gg.nodes.find((n) => n.type === "block" && !n.inline && n.chapter === "Ch02" && !has(linkB.id, n.id));
      assert.ok(tgt, "не нашлось цели для меню");
      view.nodeEls[tgt.id].dispatchEvent(
        new dom.window.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 30, clientY: 30 })
      );
      assert.ok(captured, "меню не создано");
      const titles = captured.items.filter((i) => !i.sep).map((i) => i._t);
      const fwd = captured.items.find((i) => i._t && i._t.indexOf("эта вершина") >= 0 && i._t.indexOf("→ эта") >= 0);
      assert.ok(fwd, "нет пункта «выбранная → эта»: " + titles.join(" | "));
      await fwd._cb();
      const deadline = Date.now() + 30000;
      let made = false;
      while (Date.now() < deadline) {
        const g2 = await plugin.getGraph(false);
        if ((made = g2.edges.some((e) => e.source === linkB.id && e.target === tgt.id))) break;
        await new Promise((r) => setTimeout(r, 120));
      }
      assert.ok(made, "дуга из меню не создана");
      const raw = fs.readFileSync(path.join(TMP, linkB.path), "utf8");
      assert.ok(raw.indexOf("[[" + tgt.stem + "|" + tgt.name + "]] — added via graph") > 0, "ссылка из меню не записана");
    } finally {
      obsidian.Menu = OrigMenu;
    }
  });


  console.log("\n== раунд 21: удаление выделенной вершины (Delete) ==");

  const gDel0 = await plugin.getGraph(false);
  const delTarget = gDel0.nodes.find((n) => n.type === "heading" && !n.inline && n.id === "Ch01-S01-H01");
  const delPlan0 = core.planNodeDelete(gDel0, delTarget.id, plugin.settings);

  await ok("меню и панель: пункт удаления с предупреждением, кнопка активна только при выделении", async () => {
    assert.ok(delTarget, "нет фикстуры для удаления");
    assert.ok(view.delBtn, "в панели нет кнопки удаления");
    view.select(null);
    assert.strictEqual(view.delBtn.disabled, true, "кнопка активна без выделения");
    view.select(delTarget.id);
    assert.strictEqual(view.delBtn.disabled, false, "кнопка неактивна при выделенной вершине");
    const OrigMenu = obsidian.Menu;
    let captured = null;
    obsidian.Menu = class extends OrigMenu {
      constructor(a) { super(a); captured = this; }
    };
    try {
      view.nodeEls[delTarget.id].dispatchEvent(
        new dom.window.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10, clientY: 10 })
      );
      const item = captured.items.find((i) => i._t && i._t.indexOf("Delete vertex") === 0);
      assert.ok(item, "в меню нет пункта удаления: " + captured.items.filter((i) => !i.sep).map((i) => i._t).join(" | "));
      assert.strictEqual(item._warning, true, "пункт удаления не помечен как опасный (setWarning)");
    } finally {
      obsidian.Menu = OrigMenu;
    }
    assert.ok(plugin.commands.some((c) => c.id === "delete-node"), "нет команды палитры delete-node");
    assert.ok(plugin.commands.some((c) => c.id === "undo-delete"), "нет команды палитры undo-delete");
  });

  await ok("Delete открывает окно с последствиями; «Отмена» ничего не меняет", async () => {
    view.select(delTarget.id, true);
    const before = fs.readFileSync(path.join(TMP, delTarget.path), "utf8");
    dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    const deadline = Date.now() + 40000;
    while (Date.now() < deadline && !plugin.deleteModal) await new Promise((r) => setTimeout(r, 100));
    const modal = plugin.deleteModal;
    assert.ok(modal && modal.isOpen, "окно подтверждения не открылось по клавише Delete");
    const text = modal.contentEl.textContent;
    assert.ok(text.indexOf(delTarget.path) >= 0, "в окне нет пути заметки");
    assert.ok(text.indexOf(delTarget.name) >= 0, "в окне нет названия вершины");
    assert.ok(text.indexOf(delTarget.nameZh) >= 0, "в окне нет второй строки подписи");
    assert.ok(new RegExp("Ссылки снимутся в " + delPlan0.refs.length).test(text),
      "число ссылающихся заметок не совпало с планом (" + delPlan0.refs.length + "): " + text.slice(0, 240));
    assert.ok(new RegExp("Дочерних вершин: " + delPlan0.children.length).test(text),
      "число детей не совпало с планом (" + delPlan0.children.length + ")");
    const cancel = Array.from(modal.contentEl.querySelectorAll("button")).find((b) => b.textContent === "Отмена");
    assert.ok(cancel, "нет кнопки «Отмена»");
    cancel.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    assert.strictEqual(modal.isOpen, false, "окно не закрылось");
    assert.strictEqual(plugin.deleteModal, null, "плагин помнит закрытое окно");
    assert.strictEqual(fs.readFileSync(path.join(TMP, delTarget.path), "utf8"), before, "отмена изменила заметку");
  });

  await ok("Delete в поле ввода и при пустом выделении вершину не удаляет", async () => {
    const other = (await plugin.getGraph(false)).nodes.find((n) => n.type === "block" && !n.inline && n.id !== delTarget.id);
    view.select(null);
    dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
    assert.ok(!plugin.deleteModal, "окно открылось без выделения");
    assert.ok(fs.existsSync(path.join(TMP, other.path)), "заметка удалена без выделения");
    view.select(other.id);
    view.searchEl.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
    assert.ok(!plugin.deleteModal, "клавиша Delete в поле поиска открыла окно удаления");
    assert.ok(fs.existsSync(path.join(TMP, other.path)), "клавиша в поле поиска удалила заметку");
    assert.strictEqual(view.selected, other.id, "выделение слетело");
  });

  let delBeforeTexts = {};
  let delTargetPath = "";
  let delTargetText = "";
  let delNodesBefore = 0;

  await ok("удаление: ссылки сняты, дети перевешены, заметка в корзине, граф чист", async () => {
    const gBefore = await plugin.getGraph(false);
    delNodesBefore = gBefore.nodes.length;
    const plan = core.planNodeDelete(gBefore, delTarget.id, plugin.settings);
    delTargetPath = plan.node.path;
    delTargetText = fs.readFileSync(path.join(TMP, delTargetPath), "utf8");
    delBeforeTexts = {};
    plan.refs.forEach((r) => (delBeforeTexts[r.path] = fs.readFileSync(path.join(TMP, r.path), "utf8")));
    plan.children.forEach((c) => (delBeforeTexts[c.path] = fs.readFileSync(path.join(TMP, c.path), "utf8")));
    assert.ok(plan.refs.length >= 5 && plan.children.length >= 2, "фикстура бедная: refs=" + plan.refs.length + ", дети=" + plan.children.length);
    view.select(delTarget.id, true);
    await plugin.confirmDeleteNode(delTarget.id);
    const modal = plugin.deleteModal;
    assert.ok(modal && modal.isOpen, "окно подтверждения не открылось");
    const del = Array.from(modal.contentEl.querySelectorAll("button")).find((b) => b.textContent === "Удалить");
    assert.ok(del, "нет кнопки «Удалить»");
    del.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline && fs.existsSync(path.join(TMP, delTargetPath))) await new Promise((r) => setTimeout(r, 150));
    assert.ok(!fs.existsSync(path.join(TMP, delTargetPath)), "заметка не удалена");
    assert.ok(fs.existsSync(path.join(TMP, ".trash", path.basename(delTargetPath))),
      "заметки нет ни в хранилище, ни в корзине (.trash) — удаление прошло мимо корзины");
    // ссылки в чужих заметках сняты, посторонние — целы
    plan.refs.forEach((r) => {
      const t = fs.readFileSync(path.join(TMP, r.path), "utf8");
      const links = core.extractLinks(t).map((l) => l.path);
      assert.ok(!links.some((p) => core.noteKeyMatch(p, plan.node)), "осталась ссылка на удалённую вершину: " + r.path);
      const before = core.extractLinks(delBeforeTexts[r.path]).map((l) => l.path);
      assert.strictEqual(links.filter((p) => !core.noteKeyMatch(p, plan.node)).length,
        before.filter((p) => !core.noteKeyMatch(p, plan.node)).length, "потерялись чужие ссылки: " + r.path);
      assert.ok(!/weight: 0\b/.test(t), "weight: обнулился вместо пересчёта/удаления: " + r.path);
    });
    // дети перевешены на родителя удаляемой вершины
    plan.children.forEach((c) => {
      const fm = core.parseFrontmatter(fs.readFileSync(path.join(TMP, c.path), "utf8")).data;
      assert.notStrictEqual(fm.parent, delTarget.id, "parent: остался на удалённой вершине: " + c.path);
      if (plan.newParent) assert.strictEqual(String(fm.parent), plan.newParent, "ребёнок перевешен не на родителя: " + c.path);
    });
    const gAfter = await plugin.getGraph(false);
    assert.ok(!gAfter._byId[delTarget.id], "вершина осталась в графе");
    assert.strictEqual(gAfter.nodes.length, gBefore.nodes.length - 1, "вершин: " + gAfter.nodes.length);
    assert.ok(!gAfter.edges.some((e) => e.source === delTarget.id || e.target === delTarget.id), "остались рёбра удалённой вершины");
    assert.strictEqual(gAfter.stats.unresolved, 0, "битые ссылки после удаления: " + gAfter.stats.unresolved);
    assert.strictEqual(view.selected, null, "выделение осталось на удалённой вершине");
    assert.strictEqual(view.delBtn.disabled, true, "кнопка удаления активна без выделения");
    assert.ok(Notice.all.some((m) => m.indexOf("удалена") >= 0), "нет уведомления об удалении");
    // снимок для отмены: заметка обязана быть, дети (им правили свойства) — тоже;
    // у заметки, ссылка в которой не изменилась, файла в снимке и не должно быть
    const snapshotPaths = plugin.lastDelete.files.map((f) => f.path);
    assert.ok(snapshotPaths.indexOf(plan.node.path) >= 0, "в снимке для отмены нет самой заметки");
    plan.children.forEach((c) => assert.ok(snapshotPaths.indexOf(c.path) >= 0, "в снимке нет ребёнка: " + c.path));
    const wentThrough = plan.refs.filter((r) => delBeforeTexts[r.path] !== fs.readFileSync(path.join(TMP, r.path), "utf8"));
    wentThrough.forEach((r) => assert.ok(snapshotPaths.indexOf(r.path) >= 0, "правленая заметка не попала в снимок: " + r.path));
    assert.ok(wentThrough.length >= 5, "ссылки почти не снялись: " + wentThrough.length);
  });

  await ok("Undo last vertex deletion: заметка и все правки возвращаются байт-в-байт", async () => {
    await plugin.undoDelete();
    assert.strictEqual(fs.readFileSync(path.join(TMP, delTargetPath), "utf8"), delTargetText, "текст заметки не совпал байт-в-байт");
    Object.keys(delBeforeTexts).forEach((p) => {
      assert.strictEqual(fs.readFileSync(path.join(TMP, p), "utf8"), delBeforeTexts[p], "не восстановлено байт-в-байт: " + p);
    });
    const g = await plugin.getGraph(false);
    assert.ok(g._byId[delTarget.id], "вершина не вернулась в граф");
    assert.strictEqual(g.nodes.length, delNodesBefore, "вершин после отмены: " + g.nodes.length + " вместо " + delNodesBefore);
    assert.strictEqual(g.stats.unresolved, 0, "битые ссылки после отмены: " + g.stats.unresolved);
    assert.ok(Notice.all.some((m) => /Удаление отменено/.test(m)), "нет уведомления об отмене");
    assert.strictEqual(plugin.lastDelete, null, "плагин помнит уже отменённое удаление");
    const again = await plugin.undoDelete();
    assert.strictEqual(again, null, "повторная отмена что-то сделала");
  });

  await ok("настройка «не спрашивать»: удаление идёт сразу, без окна; Undo всё возвращает", async () => {
    const victim = (await plugin.getGraph(false)).nodes.find((n) => n.type === "block" && !n.inline && n.id === "Ch01-S01-H01-B02");
    const text = fs.readFileSync(path.join(TMP, victim.path), "utf8");
    plugin.settings.confirmDelete = false;
    try {
      const res = await plugin.confirmDeleteNode(victim.id);
      assert.ok(res && !plugin.deleteModal, "окно открылось, хотя вопросы выключены");
      assert.ok(!fs.existsSync(path.join(TMP, victim.path)), "заметка не удалена без окна");
    } finally {
      plugin.settings.confirmDelete = true;
      await plugin.undoDelete();
    }
    assert.strictEqual(fs.readFileSync(path.join(TMP, victim.path), "utf8"), text, "отмена не вернула заметку байт-в-байт");
  });

  await ok("инлайн-блок: удаление убирает якорь, текст абзаца остаётся", async () => {
    const host = (await plugin.getGraph(false)).nodes.find((n) => n.type === "heading" && n.id === "Ch01-S01-H01");
    const hostPath = path.join(TMP, host.path);
    const original = fs.readFileSync(hostPath, "utf8");
    plugin.settings.includeInlineAnchors = true;
    try {
      fs.writeFileSync(hostPath, original.replace(/\s+$/, "\n") + "\nАбзац с якорем.\n\n^lg-test-anchor\n");
      plugin.markGraphDirty();
      const g = await plugin.getGraph(true);
      const inline = g.nodes.find((n) => n.inline && n.anchorName === "lg-test-anchor");
      assert.ok(inline, "инлайн-вершина не построена");
      await plugin.deleteNode(inline);
      const after = fs.readFileSync(hostPath, "utf8");
      assert.ok(after.indexOf("Абзац с якорем.") > 0, "текст абзаца пропал");
      assert.strictEqual(after.indexOf("^lg-test-anchor"), -1, "якорь остался");
      const g2 = await plugin.getGraph(false);
      assert.ok(!g2.nodes.some((n) => n.anchorName === "lg-test-anchor"), "инлайн-вершина осталась в графе");
    } finally {
      plugin.settings.includeInlineAnchors = false;
      await plugin.undoDelete(); // вернуть якорь в заметку
      fs.writeFileSync(hostPath, original);
      plugin.markGraphDirty();
      await plugin.getGraph(true);
    }
    assert.strictEqual(fs.readFileSync(hostPath, "utf8"), original, "заметка-хозяин не восстановлена");
  });

  await ok("Create node: новый дубль автоматически сливается с существующей вершиной", async () => {
    plugin.markGraphDirty();
    const before = await plugin.getGraph(true);
    const beforeCount = before.nodes.length;
    const res = await plugin.createNewNode({
      type: "block",
      nameEn: "Vector Space Proposition 1.1.1a",
      nameZh: "向量空间命题 1.1.1a",
      keywords: "vector space",
    });
    assert.ok(res && res.merged && res.merged.merged >= 1, "автослияние не сработало");
    plugin.markGraphDirty();
    const after = await plugin.getGraph(true);
    assert.strictEqual(after.nodes.length, beforeCount, "число вершин изменилось: " + after.nodes.length + " вместо " + beforeCount);
    assert.ok(!after._byId[res.createdId], "в графе остался только что созданный дубль " + res.createdId);
    assert.ok(after._byId[res.id], "итоговая вершина не найдена: " + res.id);
    const raw = fs.readFileSync(path.join(TMP, after._byId[res.id].path), "utf8");
    const parsed = obsidian_stub_parse(raw);
    const aliases = String(parsed.data.aliases || "");
    assert.ok(aliases.indexOf(res.createdId) >= 0, "id дубля не попал в aliases keeper: " + aliases);
  });

  await ok("Merge duplicates: ссылки, дети и тело дубля переносятся; Undo восстанавливает batch", async () => {
    const baseGraph = await plugin.getGraph(false);
    const keeper = baseGraph._byId["Ch01-S01-H01-B01"];
    assert.ok(keeper, "нет базовой вершины для merge-теста");
    const keeperPath = path.join(TMP, keeper.path);
    const keeperBefore = fs.readFileSync(keeperPath, "utf8");
    const dupId = "MN-77";
    const childId = "MN-78";
    const refId = "MN-79";
    const dupPath = "30 - Blocks/Ch01/MN-77 - Vector Space Proposition 1.1.1a duplicate.md";
    const childPath = "30 - Blocks/Ch01/MN-78 - Duplicate Child.md";
    const refPath = "30 - Blocks/Ch01/MN-79 - Duplicate Ref.md";
    let dupRaw = core.setFrontmatterValues(keeperBefore, {
      id: dupId,
      status: "draft",
      parent: keeper.parent || "Ch01-S01-H01",
      chapter: keeper.chapter || "Ch01",
      keywords_en: "merge duplicate proof",
    });
    dupRaw = dupRaw.replace(/\^[A-Za-z0-9_-]+/g, "^mn-dup-anchor");
    if (dupRaw.indexOf("^mn-dup-anchor") < 0) dupRaw = dupRaw.replace(/\s*$/, "\n\n^mn-dup-anchor\n");
    dupRaw = dupRaw.replace(/\s*$/, "\n\nExtra duplicate sentence for merge test.\n");
    const childRaw = [
      "---",
      "type: block",
      "id: " + childId,
      'name: "Duplicate Child"',
      "parent: " + dupId,
      "chapter: " + (keeper.chapter || "Ch01"),
      "---",
      "",
      "# Duplicate Child",
      "",
      "Body.",
      "",
    ].join("\n");
    const refRaw = [
      "---",
      "type: block",
      "id: " + refId,
      'name: "Duplicate Ref"',
      "parent: " + (keeper.parent || "Ch01-S01-H01"),
      "chapter: " + (keeper.chapter || "Ch01"),
      "---",
      "",
      "See [[" + dupId + "]] and [[" + dupId + "#^mn-dup-anchor|anchor]].",
      "",
    ].join("\n");
    await plugin.writeFile(dupPath, dupRaw);
    await plugin.writeFile(childPath, childRaw);
    await plugin.writeFile(refPath, refRaw);
    plugin.markGraphDirty();
    const g1 = await plugin.getGraph(true);
    assert.ok(g1._byId[dupId], "дубликат не попал в граф");
    const res = await plugin.mergeDuplicateNodes({ ids: [dupId], silent: true });
    assert.ok(res && res.merged >= 1, "mergeDuplicateNodes ничего не слил");
    const g2 = await plugin.getGraph(false);
    const keepId = res.focusId;
    assert.ok(keepId && g2._byId[keepId], "keeper после merge не найден: " + keepId);
    assert.ok(!g2._byId[dupId], "дубликат остался в графе после merge");
    assert.ok(!fs.existsSync(path.join(TMP, dupPath)), "файл дубля не удалён");
    const childAfter = obsidian_stub_parse(fs.readFileSync(path.join(TMP, childPath), "utf8"));
    assert.strictEqual(childAfter.data.parent, keepId, "ребёнок не перевешен на keeper");
    const refAfter = fs.readFileSync(path.join(TMP, refPath), "utf8");
    assert.strictEqual(refAfter.indexOf("[[" + dupId), -1, "в ссылках остался старый id дубля");
    assert.ok(refAfter.indexOf("#^mn-dup-anchor|anchor]]") >= 0, "ссылка на якорь не сохранена");
    const keeperAfter = fs.readFileSync(path.join(TMP, g2._byId[keepId].path), "utf8");
    assert.ok(keeperAfter.indexOf("Extra duplicate sentence for merge test.") >= 0, "тело дубля не перенесено в keeper");
    assert.ok(String(obsidian_stub_parse(keeperAfter).data.aliases || "").indexOf(dupId) >= 0, "aliases keeper не получили id дубля");
    assert.ok(plugin.lastMerge && plugin.lastMerge.files.length >= 3, "undo-снимок merge не сформирован");
    await plugin.undoDuplicateMerge();
    assert.strictEqual(fs.readFileSync(keeperPath, "utf8"), keeperBefore, "keeper не восстановлен байт-в-байт");
    assert.strictEqual(fs.readFileSync(path.join(TMP, dupPath), "utf8"), dupRaw, "дубликат не восстановлен байт-в-байт");
    assert.strictEqual(fs.readFileSync(path.join(TMP, refPath), "utf8"), refRaw, "реферер не восстановлен байт-в-байт");
    assert.strictEqual(fs.readFileSync(path.join(TMP, childPath), "utf8"), childRaw, "ребёнок не восстановлен байт-в-байт");
    assert.strictEqual(plugin.lastMerge, null, "lastMerge не очищен после undo");
  });

  console.log("\n== раунд 23: глобальное слияние дубликатов (пустой холст, предпросмотр) ==");

  await ok("команды палитры слияния: merge / preview / undo зарегистрированы", async () => {
    ["merge-duplicates", "merge-current-note-duplicates", "preview-duplicates", "preview-current-note-duplicates", "undo-merge-duplicates"].forEach((id) => {
      assert.ok(plugin.commands.some((c) => c.id === id), "нет команды палитры " + id);
    });
  });

  await ok("пустой холст: меню с глобальным слиянием и предпросмотром", async () => {
    const OrigMenu = obsidian.Menu;
    let captured = null;
    obsidian.Menu = class extends OrigMenu {
      constructor(a) { super(a); captured = this; }
    };
    try {
      view.svg.dispatchEvent(
        new dom.window.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 40, clientY: 40 })
      );
      assert.ok(captured, "меню не создано");
      const titles = captured.items.filter((i) => !i.sep).map((i) => i._t);
      assert.ok(titles.some((t) => t && t.indexOf("Preview duplicate groups") === 0), "нет предпросмотра: " + titles.join(" | "));
      assert.ok(titles.some((t) => t && t.indexOf("Merge all duplicate vertices") === 0), "нет глобального слияния: " + titles.join(" | "));
    } finally {
      obsidian.Menu = OrigMenu;
    }
  });

  await ok("вершина: меню с предпросмотром дубликатов", async () => {
    const g = await plugin.getGraph(false);
    const target = g._byId["Ch01"] || g.nodes[0];
    assert.ok(target && view.nodeEls[target.id], "нет вершины для меню");
    const OrigMenu = obsidian.Menu;
    let captured = null;
    obsidian.Menu = class extends OrigMenu {
      constructor(a) { super(a); captured = this; }
    };
    try {
      view.nodeEls[target.id].dispatchEvent(
        new dom.window.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10, clientY: 10 })
      );
      const titles = captured.items.filter((i) => !i.sep).map((i) => i._t);
      assert.ok(titles.indexOf("Merge duplicates of this vertex") >= 0, "нет прямого слияния: " + titles.join(" | "));
      assert.ok(titles.indexOf("Preview duplicates of this vertex…") >= 0, "нет предпросмотра: " + titles.join(" | "));
    } finally {
      obsidian.Menu = OrigMenu;
    }
  });

  await ok("предпросмотр: окно со списком групп, выбором keeper и слиянием выбранного", async () => {
    const g0 = await plugin.getGraph(false);
    const keeper = g0._byId["Ch02-S01-H01-B01"];
    assert.ok(keeper, "нет базовой вершины для preview-теста");
    const keeperRaw = fs.readFileSync(path.join(TMP, keeper.path), "utf8");
    const d1 = "MN-81", d2 = "MN-82";
    const p1 = "30 - Blocks/Ch02/MN-81 - Preview Dup One.md";
    const p2 = "30 - Blocks/Ch02/MN-82 - Preview Dup Two.md";
    const mk = (id, extra) => {
      let raw = core.setFrontmatterValues(keeperRaw, { id: id, status: "draft", parent: keeper.parent, chapter: keeper.chapter });
      return raw.replace(/\s*$/, "") + "\n\n" + extra + "\n";
    };
    await plugin.writeFile(p1, mk(d1, "First preview duplicate brings Galois theory remark about field extensions."));
    await plugin.writeFile(p2, mk(d2, "Second preview duplicate brings spectral gap remark about expander graphs."));
    plugin.markGraphDirty();
    const groups = await plugin.previewDuplicateNodes({ ids: [d1, d2], silent: true });
    assert.ok(groups && groups.length >= 1, "предпросмотр не нашёл группу");
    const modalEl = document.querySelector(".modal .lg-merge");
    assert.ok(modalEl, "окно предпросмотра не открылось");
    assert.ok(modalEl.querySelector(".lg-merge__group"), "в окне нет групп");
    const box = modalEl.querySelector('input[data-lg-group]');
    assert.ok(box && box.checked, "нет включённого чекбокса группы");
    const sel = modalEl.querySelector(".lg-merge__keeper select");
    assert.ok(sel && sel.options.length >= 2, "нет выбора keeper");
    // выбираем keeper вручную (второй дубль) и сливаем через окно
    sel.value = d2;
    sel.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    const btn = Array.from(modalEl.querySelectorAll(".lg-modal-btns button")).find((b) => /Merge selected/.test(b.textContent));
    assert.ok(btn && !btn.disabled, "нет активной кнопки слияния");
    btn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline && fs.existsSync(path.join(TMP, p1))) await new Promise((r) => setTimeout(r, 200));
    assert.ok(!fs.existsSync(path.join(TMP, p1)), "первый дубль не удалён после слияния из окна");
    const g2 = await plugin.getGraph(false);
    assert.ok(g2._byId[d2], "выбранный keeper не уцелел: " + d2);
    assert.ok(!g2._byId[d1], "первый дубль остался в графе");
    const keptRaw = fs.readFileSync(path.join(TMP, g2._byId[d2].path), "utf8");
    assert.ok(keptRaw.indexOf("First preview duplicate brings Galois theory remark about field extensions.") >= 0, "тело первого дубля не перенесено в keeper");
    assert.ok(keptRaw.indexOf("Second preview duplicate brings spectral gap remark about expander graphs.") >= 0, "свое предложение keeper потеряно");
    // Undo после слияния из окна возвращает оба файла
    await plugin.undoDuplicateMerge();
    assert.ok(fs.existsSync(path.join(TMP, p1)) && fs.existsSync(path.join(TMP, p2)), "undo не вернул файлы дублей");
  });

  await ok("пустой холст: после слияния в меню появляется отмена", async () => {
    const g0 = await plugin.getGraph(false);
    const keeper = g0._byId["Ch03-S01-H01-B01"];
    const d = "MN-83";
    const p = "30 - Blocks/Ch03/MN-83 - Undo Menu Dup.md";
    const raw = core.setFrontmatterValues(fs.readFileSync(path.join(TMP, keeper.path), "utf8"),
      { id: d, status: "draft", parent: keeper.parent, chapter: keeper.chapter }).replace(/\s*$/, "") + "\n\nUndo menu extra.\n";
    await plugin.writeFile(p, raw);
    plugin.markGraphDirty();
    const res = await plugin.mergeDuplicateNodes({ ids: [d], silent: true });
    assert.ok(res && res.merged >= 1, "слияние не сработало");
    const OrigMenu = obsidian.Menu;
    let captured = null;
    obsidian.Menu = class extends OrigMenu {
      constructor(a) { super(a); captured = this; }
    };
    try {
      view.svg.dispatchEvent(
        new dom.window.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 40, clientY: 40 })
      );
      const titles = captured.items.filter((i) => !i.sep).map((i) => i._t);
      assert.ok(titles.indexOf("Undo last duplicate merge") >= 0, "нет отмены в меню: " + titles.join(" | "));
    } finally {
      obsidian.Menu = OrigMenu;
    }
    await plugin.undoDuplicateMerge();
  });

  console.log("\n" + pass + " e2e-проверок пройдено; exitCode=" + (process.exitCode || 0));
  console.log("временное хранилище: " + TMP);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
})();

function obsidian_stub_parse(text) {
  // тот же парсер, что у плагина (берём из ядра бандла)
  const core = require("./src/graph-core.js");
  return core.parseFrontmatter(text);
}
