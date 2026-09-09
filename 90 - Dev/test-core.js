/*
 * Тесты ядра графа: гоняются на РЕАЛЬНЫХ файлах хранилища (тот же код,
 * который инлайнится в main.js плагина).
 */
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const core = require("./src/graph-core.js");

const ROOT = path.resolve(__dirname, "..", "Lecture-Graph-Vault");
const NODE_DIRS = ["10 - Chapters", "20 - Sections", "25 - Headings", "30 - Blocks"];

let pass = 0;
function ok(name, fn) {
  try {
    fn();
    pass++;
    console.log("  ok   " + name);
  } catch (e) {
    console.log("  FAIL " + name + "\n       " + (e && e.message));
    process.exitCode = 1;
  }
}

function walk(dir, acc) {
  acc = acc || [];
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".") || ent.name === "node_modules") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name.endsWith(".md")) acc.push(p);
  }
  return acc;
}

function loadNotes(dirs) {
  return dirs.flatMap((d) => walk(path.join(ROOT, d))).map((p) => ({
    path: path.relative(ROOT, p).split(path.sep).join("/"),
    text: fs.readFileSync(p, "utf8"),
  }));
}

const STATS = JSON.parse(fs.readFileSync(path.join(ROOT, ".vault-stats.json"), "utf8"));
const N = { chapter: STATS.chapters, section: STATS.sections, heading: STATS.headings, block: STATS.blocks };
const NODES = STATS.nodes;
const notes = loadNotes(NODE_DIRS);

function blocksPerHeading(list) {
  const m = {};
  list.forEach((b) => { const h = b.id.split("-B")[0]; m[h] = (m[h] || 0) + 1; });
  return m;
}
// как в плагине: в граф идут только заметки из рабочих папок с валидным frontmatter type
const allNotes = walk(ROOT)
  .filter((p) => NODE_DIRS.includes(path.relative(ROOT, p).split(path.sep)[0]))
  .map((p) => {
    return {
      path: path.relative(ROOT, p).split(path.sep).join("/"),
      text: fs.readFileSync(p, "utf8"),
    };
  })
  .filter((n) => core.TYPES.includes(String(core.parseFrontmatter(n.text).data.type || "").toLowerCase()));
const untyped = walk(ROOT).length - allNotes.length; // шаблоны/докы не должны попадать в граф

console.log("== разбор заметок ==");
ok("все файлы прочитаны и имеют frontmatter", () => {
  assert.strictEqual(notes.length, NODES, "note count " + notes.length);
  {
    // сгенерированные папки должны быть чистыми: лишний файл = осиротевшая заметка прошлой генерации
    const heads = new Set(
      notes
        .filter((x) => x.path.startsWith("25 - Headings"))
        .map((x) => x.path.replace(/^.*\//, "").split(" - ")[0]) // код из имени файла
    );
    const stale = walk(path.join(ROOT, "30 - Blocks"))
      .map((p) => path.basename(p).split(" - ")[0])
      .filter((id) => !heads.has(id.split("-B")[0]));
    assert.deepStrictEqual(stale, [], "осиротевшие файлы блоков: " + stale.slice(0, 4).join(", "));
    assert.strictEqual(notes.filter((n) => n.path.startsWith("30 - Blocks")).length, N.block, "файлов блока на диске не столько, сколько обещано");
  }
  assert.ok(untyped >= 6, "служебные заметки должны оставаться вне графа, untyped=" + untyped);
  for (const n of notes) {
    const fm = core.parseFrontmatter(n.text);
    assert.ok(fm.hasFrontmatter, "no frontmatter: " + n.path);
    assert.ok(["chapter", "section", "heading", "block"].includes(fm.data.type), "bad type: " + n.path);
    assert.ok(typeof fm.data.name === "string" && fm.data.name.length > 0, "bad name: " + n.path);
    assert.ok(typeof fm.data.name_zh === "string" && fm.data.name_zh.length > 0, "bad name_zh: " + n.path);
    assert.ok(/[一-鿿]/.test(fm.data.name_zh), "name_zh has no CJK: " + n.path);
    // имя из frontmatter не должно содержать markdown-мусор
    assert.doesNotMatch(fm.data.name, /\[\[|\|\]/, "wikilink leaked into label: " + n.path);
  }
});

ok("frontmatter сохраняет тип/родителя/id и не содержит вложенных ссылок", () => {
  const fm = core.parseFrontmatter(notes.find((n) => /Ch01-S01-H01-B01/.test(n.path)).text).data;
  assert.strictEqual(fm.type, "block");
  assert.strictEqual(fm.parent, "Ch01-S01-H01");
  assert.strictEqual(fm.id, "Ch01-S01-H01-B01");
  assert.ok(!/\[\[/.test(JSON.stringify(fm)), "frontmatter must not hold links: " + JSON.stringify(fm));
});

console.log("== ссылки ==");
ok("извлечение wiki-ссылок: алиасы, якоря, врезки, отсутствие [[#..]]", () => {
  const t = "see [[A - B|Alias]] and ![[C]] plus [[D#Heading]] and [[E#^blk-1]] and [[#Own]] and `[[F]]`";
  const links = core.extractLinks(t);
  assert.deepStrictEqual(links.map((l) => l.path), ["A - B", "C", "D", "E"]);
  assert.strictEqual(links[0].alias, "Alias");
  assert.strictEqual(links[1].linkType, "embed");
  assert.strictEqual(links[2].anchor, "Heading");
  assert.strictEqual(links[3].blockId, "blk-1");
});

ok("ссылки в fenced code не считаются", () => {
  const t = "```md\n[[Ghost]]\n```\nreal [[Target]]";
  assert.deepStrictEqual(core.extractLinks(t).map((l) => l.path), ["Target"]);
});

ok("inline-якоря блока находятся, в т.ч. после формулы", () => {
  const t = "Para\n\n$$\na = b\n$$\n^eq-1\n\n> [!note] T\n> text\n> ^callout-block\n";
  const ids = core.extractAnchors(t).map((a) => a.id);
  assert.deepStrictEqual(ids, ["eq-1", "callout-block"]);
});

console.log("== построение графа ==");
const graph = core.buildGraph(allNotes);
const blocks = graph.nodes.filter((n) => n.type === "block");
const heads = graph.nodes.filter((n) => n.type === "heading");
const secs = graph.nodes.filter((n) => n.type === "section");
const chaps = graph.nodes.filter((n) => n.type === "chapter");

ok("4 уровня структуры присутствуют в ожидаемом количестве", () => {
  assert.strictEqual(chaps.length, N.chapter);
  assert.strictEqual(secs.length, N.section);
  assert.strictEqual(heads.length, N.heading);
  assert.strictEqual(blocks.length, N.block);
  assert.strictEqual(graph.stats.byType.chapter, N.chapter);
  assert.strictEqual(graph.stats.nodes, NODES, "узлов всего");
  // обещание «в каждом заголовке 3–4 блока» проверяем явно
  const per = blocksPerHeading(blocks);
  assert.strictEqual(Object.keys(per).length, N.heading, "заголовков с блоками");
  const sizes = [...new Set(Object.values(per))].sort();
  assert.deepStrictEqual(sizes, [3, 4], "чередование 3/4 не работает: " + JSON.stringify(sizes));
  assert.ok(Object.values(per).filter((x) => x === 3).length > 10, "слишком мало заголовков с 3 блоками");
});

ok("все ссылки разрешаются (0 висячих)", () => {
  assert.strictEqual(graph.stats.unresolved, 0, "unresolved=" + graph.stats.unresolved);
});

ok("каждый блок, на который есть ссылки, имеет ≥1 входящую ссылку", () => {
  const bad = blocks.filter((b) => b.inRefs < 1);
  assert.deepStrictEqual(bad.map((b) => b.id), []);
});

ok("ссылки на блоки стоят в текстах под заголовками секций", () => {
  const sec = allNotes.find((n) => n.path === "20 - Sections/Ch01/Ch01-S01 - Setup and Notation.md");
  const body = core.parseFrontmatter(sec.text).body;
  const h3s = body.split(/^### /m).slice(1);
  assert.strictEqual(h3s.length, 6, "headings under section: " + h3s.length);
  for (const chunk of h3s) {
    const links = core.extractLinks(chunk).filter((l) => /-B\d\d$/.test(l.path.split("|")[0].split("#")[0]) || /-B\d\d/.test(l.path));
    assert.ok(links.length >= 3, "no block refs in a heading text: " + links.length);
  }
});

ok("структурные рёбра ведут вверх по иерархии (block->heading->section->chapter)", () => {
  const byId = {};
  graph.nodes.forEach((n) => (byId[n.id] = n));
  for (const t of ["block", "heading", "section"]) {
    const arr = graph.nodes.filter((n) => n.type === t);
    const missing = arr.filter((n) => {
      const up = graph.edges.find((e) => e.source === n.id && e.kind === "structure" && byId[e.target]);
      return !up || byId[up.target].type !== (t === "block" ? "heading" : t === "heading" ? "section" : "chapter");
    });
    assert.deepStrictEqual(missing.map((n) => n.id), [], "bad structural parent for " + t + ": " + missing.length);
  }
});

// «водитель» размера: для вершин с ключевыми фразами это число вхождений, для остальных —
// число входящих ссылок (этап 2). Монотонность проверяем именно по водителю.
ok("размер монотонен по водителю: входящие ссылки либо вес по ключевым фразам (global/byType/hybrid)", () => {
  assert.ok(graph.stats.maxDegree >= 5, "maxDegree=" + graph.stats.maxDegree);
  const modes = { global: core.buildGraph(allNotes, { sizeMode: "global" }), byType: core.buildGraph(allNotes, { sizeMode: "byType" }), hybrid: core.buildGraph(allNotes, { sizeMode: "hybrid" }) };
  for (const [mode, g] of Object.entries(modes)) {
    const lo = Math.min.apply(null, g.nodes.map((n) => n.r));
    const hi = Math.max.apply(null, g.nodes.map((n) => n.r));
    assert.ok(lo >= core.DEFAULTS.minRadius - 1e-9 && hi <= core.DEFAULTS.maxRadius + 1e-9, mode + ": r вне диапазона " + lo + ".." + hi);
    const bad = [];
    const driver = (n) => (n.sizeValue === undefined ? n.degree : n.sizeValue);
    // при равном водителе радиусы могут различаться: это «пол по типу» (глава не имеет права
    // стать меньше заголовка), а не нарушение правила -> сравниваем только рост водителя
    const viol = (a, b) => driver(b) > driver(a) && b.r < a.r - 1e-9;
    if (mode === "global") {
      const sorted = g.nodes.slice().sort((a, b) => driver(a) - driver(b) || core.TYPES.indexOf(a.type) - core.TYPES.indexOf(b.type));
      for (let i = 1; i < sorted.length; i++) if (viol(sorted[i - 1], sorted[i])) bad.push(sorted[i].id);
    } else {
      for (const t of core.TYPES) {
        const arr = g.nodes.filter((n) => n.type === t).sort((a, b) => driver(a) - driver(b));
        for (let i = 1; i < arr.length; i++) if (viol(arr[i - 1], arr[i])) bad.push(arr[i].id);
      }
    }
    // и вес по фразам обязан быть водителем хотя бы у части блоков: иначе этап 2 ничего не меняет
    const byWeight = g.nodes.filter((n) => n.type === "block" && n.kwWeight > 0 && n.sizeValue === n.kwWeight);
    assert.ok(byWeight.length >= 100, "размер блоков почти не зависит от веса: " + byWeight.length);
    assert.deepStrictEqual(bad.slice(0, 5), [], mode + ": нарушение монотонности размера (" + bad.length + ")");
  }
  assert.strictEqual(core.radiusFor(0, core.DEFAULTS, 10), core.DEFAULTS.minRadius);
});

ok("размеры различаются на ВСЕХ уровнях, а не только у блоков (пункт 4)", () => {
  const res = {};
  // уровни курса обязаны различаться; «index» вне шкалы намеренно (фиксированный размер)
  const sized = core.TYPES.filter((t) => t !== "index" && graph.nodes.some((n) => n.type === t));
  assert.ok(sized.length === 4, "уровней для сверки: " + sized.join(","));
  for (const t of sized) {
    const arr = graph.nodes.filter((n) => n.type === t);
    const deg = arr.map((n) => n.degree);
    const r = arr.map((n) => n.r);
    const font = arr.map((n) => n.font);
    res[t] = { degUniq: new Set(deg).size, degRatio: Math.max(...deg) / Math.max(1, Math.min(...deg)), rRatio: Math.max(...r) / Math.min(...r), fontRatio: Math.max(...font) / Math.min(...font) };
  }
  console.log("       · " + sized.map((t) => `${t}: ссылки ${res[t].degRatio.toFixed(1)}×, радиус ${res[t].rRatio.toFixed(2)}×, кегль ${res[t].fontRatio.toFixed(2)}×`).join(" | "));
  for (const t of sized) {
    assert.ok(res[t].degUniq >= 4, t + ": степеней всего " + res[t].degUniq + " — ссылки на этот уровень не различаются");
    assert.ok(res[t].rRatio >= 1.2, t + ": разброс радиусов всего " + res[t].rRatio.toFixed(2));
    assert.ok(res[t].fontRatio >= 1.15, t + ": разброс кегля подписей всего " + res[t].fontRatio.toFixed(2));
  }
});

ok("кегль подписи: растёт с числом ссылок, либо фиксирован", () => {
  const auto = core.buildGraph(allNotes, { labelFontBySize: true, labelFontMin: 8, labelFontMax: 22 });
  const fonts = auto.nodes.map((n) => n.font);
  assert.ok(Math.max(...fonts) - Math.min(...fonts) > 6, "нет разброса кегля: " + Math.min(...fonts) + ".." + Math.max(...fonts));
  const drv = (n) => (n.sizeValue === undefined ? n.degree : n.sizeValue);
  const small = auto.nodes.filter((n) => drv(n) === Math.min.apply(null, auto.nodes.map(drv)))[0];
  const big = auto.nodes.reduce((a, b) => (drv(b) > drv(a) ? b : a));
  assert.ok(big.font > small.font, "крупная вершина не получила больший кегль");
  for (const t of core.TYPES) {
    const arr = auto.nodes.filter((n) => n.type === t).sort((a, b) => drv(a) - drv(b));
    for (let i = 1; i < arr.length; i++) assert.ok(arr[i].font >= arr[i - 1].font - 1e-9, t + ": кегль не монотонен");
  }
  const fixed = core.buildGraph(allNotes, { labelFontBySize: false, labelFontSize: 13 });
  assert.strictEqual(new Set(fixed.nodes.map((n) => n.font)).size, 1, "при выключенном авто кегль должен быть одинаковым");
  assert.strictEqual(fixed.nodes[0].font, 13);
});

ok("applySizes пересчитывает радиусы и кегль на месте, без перестройки", () => {
  const g = core.buildGraph(allNotes, { sizeMode: "global" });
  const snapshot = g.nodes.map((n) => ({ id: n.id, deg: n.degree, name: n.name }));
  core.applySizes(g.nodes, { sizeMode: "byType", minRadius: 5, maxRadius: 40, degreeGamma: 0.4, labelFontMin: 9, labelFontMax: 24, labelFontBySize: true });
  assert.deepStrictEqual(g.nodes.map((n) => ({ id: n.id, deg: n.degree, name: n.name })), snapshot, "applySizes не должен трогать степени и подписи");
  const hi = g.nodes.reduce((a, b) => (b.degree > a.degree ? b : a));
  assert.ok(Math.abs(hi.r - 40) < 1e-6, "максимум не дотянут до maxRadius: " + hi.r);
  core.applySizes(g.nodes, { sizeMode: "global", minRadius: 6, maxRadius: 34, degreeGamma: 0.4, labelFontBySize: false, labelFontSize: 11 });
  assert.ok(g.nodes.every((n) => n.font === 11));
});

ok("иерархия размеров: ориентир курса > блок главы > обычный блок", () => {
  const stats = JSON.parse(fs.readFileSync(path.join(ROOT, ".vault-stats.json"), "utf8"));
  const avg = blocks.reduce((a, b) => a + b.degree, 0) / blocks.length;
  const byId = {};
  graph.nodes.forEach((n) => (byId[n.id] = n));
  const landmarks = stats.landmarks.map((id) => byId[id]).filter(Boolean);
  assert.strictEqual(landmarks.length, 4, "landmarks found: " + landmarks.length);
  assert.ok(landmarks.every((b) => b.degree >= 30), "landmark degrees " + landmarks.map((b) => b.degree).join(","));
  const keyBlocks = stats.key_blocks
    .map((f) => graph.nodes.find((n) => n.stem === f.replace(/\.md$/, "")))
    .filter(Boolean)
    .filter((b) => stats.landmarks.indexOf(b.id) < 0); // не сравнивать ориентир с самим собой
  assert.ok(keyBlocks.length >= 20, "key blocks found " + keyBlocks.length);
  const keyAvg = keyBlocks.reduce((a, b) => a + b.degree, 0) / keyBlocks.length;
  const maxDeg = Math.max.apply(null, blocks.map((b) => b.degree));
  const minDeg = Math.min.apply(null, blocks.map((b) => b.degree));
  assert.ok(landmarks[0].degree === maxDeg, "top-degree node is not a landmark: " + maxDeg);
  assert.ok(keyAvg > avg * 1.4, `keyAvg ${keyAvg} avg ${avg}`);
  assert.ok(maxDeg / Math.max(1, minDeg) >= 15, "size spread too small: " + minDeg + ".." + maxDeg);
  assert.ok(landmarks[0].r > keyBlocks[0].r * 1.2, "radius must track references: " + landmarks[0].r + " vs " + keyBlocks[0].r);
});

ok("граф связный (одна компонента)", () => {
  const c = core.components(graph);
  assert.strictEqual(c.count, 1, "components: " + c.count + " sizes " + c.sizes.join(","));
  assert.strictEqual(c.largest, graph.stats.nodes);
});

ok("режим «считать только текстовые ссылки» отличается от «со структурными»", () => {
  const onlyRefs = core.buildGraph(allNotes, { countStructural: false });
  const withStruct = core.buildGraph(allNotes, { countStructural: true });
  assert.ok(withStruct.nodes.every((n) => n.degree >= 0));
  const b1 = onlyRefs.nodes.find((n) => n.type === "section").degree;
  const b2 = withStruct.nodes.find((n) => n.type === "section").degree;
  assert.ok(b2 >= b1, "withStruct should be >= refsOnly");
});

ok("inline-блоки как отдельные вершины (включаемый режим)", () => {
  const withAnchors = core.buildGraph(
    [
      { path: "S.md", text: "---\ntype: section\nid: S\nname: \"S\"\n---\n\n### H\n\n$$\nE=mc^2\n$$\n^eq-S\n\nСм. [[S#^eq-S]]\n" },
    ],
    { includeInlineAnchors: true }
  );
  const inline = withAnchors.nodes.find((n) => n.inline);
  assert.ok(inline, "inline block node missing");
  assert.strictEqual(inline.degree, 1, "inline degree " + inline.degree);
  const off = core.buildGraph(
    [{ path: "S.md", text: "---\ntype: section\n---\n\n$$\nE=mc^2\n$$\n^eq-S\n" }],
    { includeInlineAnchors: false }
  );
  assert.ok(!off.nodes.some((n) => n.inline));
});

console.log("== подписи и запись обратно ==");
ok("labelLines даёт ровно две строки: EN + перевод", () => {
  const n = graph.nodes.find((x) => x.type === "chapter");
  const ll = core.labelLines(n, core.DEFAULTS);
  assert.strictEqual(ll.length, 2);
  assert.ok(/[A-Za-z]/.test(ll[0]), ll[0]);
  assert.ok(/[一-鿿]/.test(ll[1]), ll[1]);
});

ok("fallback подписи = имя файла, если полей нет", () => {
  const g = core.buildGraph([{ path: "x/Bare Note.md", text: "no frontmatter here" }]);
  const ll = core.labelLines(g.nodes[0], g.config);
  assert.strictEqual(ll[0], "Bare Note");
  assert.strictEqual(ll[1], "");
  assert.strictEqual(g.nodes[0].nameFromFilename, true);
});

ok("setFrontmatterValues меняет обе подписи и не трогает тело/формулы", () => {
  const note = notes.find((n) => /Ch01-S01-H01-B01/.test(n.path));
  const before = core.parseFrontmatter(note.text);
  const patched = core.setFrontmatterValues(note.text, { name: 'He said "sigma"', name_zh: "范数·恒等式" });
  const after = core.parseFrontmatter(patched);
  assert.strictEqual(after.data.name, 'He said "sigma"');
  assert.strictEqual(after.data.name_zh, "范数·恒等式");
  assert.strictEqual(after.data.type, before.data.type);
  assert.strictEqual(after.data.id, before.data.id);
  assert.strictEqual(after.data.parent, before.data.parent);
  assert.strictEqual(after.body, before.body, "body must be byte-identical");
  assert.ok(after.body.includes("$$"), "math block still present");
  // YAML остаётся валидным подмножеством: ровно 2 маркера, ключи не продублированы
  const marks = patched.match(/^---[ \t]*$/gm) || [];
  assert.strictEqual(marks.length, 2);
  const keys = patched.split("\n").slice(1, -1).filter((l) => /^[a-z_]+:/.test(l)).map((l) => l.split(":")[0]);
  assert.strictEqual(new Set(keys).size, keys.length, "duplicate keys: " + keys.join(","));
});

ok("удаление значения очищает ключ, отсутствие frontmatter создаётся заново", () => {
  const cleared = core.setFrontmatterValues("---\ntype: block\nname: Old\nname_zh: 旧\n---\nbody\n", { name_zh: "" });
  const p = core.parseFrontmatter(cleared);
  assert.ok(!("name_zh" in p.data), JSON.stringify(p.data));
  assert.strictEqual(p.body, "body\n");
  const made = core.setFrontmatterValues("just text\n", { name: "N", name_zh: "译" });
  const p2 = core.parseFrontmatter(made);
  assert.strictEqual(p2.data.name, "N");
  assert.strictEqual(p2.data.name_zh, "译");
  assert.strictEqual(p2.body.replace(/^\n/, ""), "just text\n");
});

ok("сквозной сценарий: правка подписи в файле меняет её и в перестроенном графе", () => {
  const file = notes.find((n) => /Ch02-S03-H02/.test(n.path));
  const updated = core.setFrontmatterValues(file.text, { name: "Renamed Heading EN", name_zh: "重命名标题中文" });
  const g2 = core.buildGraph(allNotes.map((n) => (n.path === file.path ? { path: n.path, text: updated } : n)));
  const node = g2.nodes.find((n) => n.path === file.path);
  assert.deepStrictEqual(core.labelLines(node, g2.config), ["Renamed Heading EN", "重命名标题中文"]);
  assert.strictEqual(node.degree, graph.nodes.find((n) => n.path === file.path).degree, "degree must not change on rename");
});

console.log("== layout и экспорт ==");
const laid = core.buildGraph(allNotes);
core.initPositions(laid.nodes, { width: 1400, height: 900, layout: laid.config.layout });
ok("layout: координаты конечны, пересечений становится меньше", () => {
  const overlapsBefore = countOverlaps(laid.nodes);
  core.run(laid, { iterations: 260, width: 1400, height: 900 });
  for (const n of laid.nodes) {
    assert.ok(isFinite(n.x) && isFinite(n.y), "NaN coord for " + n.id);
  }
  const after = countOverlaps(laid.nodes);
  // наложения кругов после раскладки — НОЛЬ в любом режиме (у секторов их нет уже на
  // посеве, пружинный движок обязан добить их пост-обработкой)
  const engine = ["fdp", "neato", "twopi"].indexOf(((laid.config || {}).layout || {}).mode || core.DEFAULTS.layout.mode) >= 0;
  assert.strictEqual(after, 0, "после run осталось наложений кругов: " + after);
  if (engine) assert.ok(after < overlapsBefore, "движок не уменьшил наложения: " + overlapsBefore + " -> " + after);
  else assert.strictEqual(overlapsBefore, 0, "до run уже были наложения: " + overlapsBefore);
  const b = core.bounds(laid.nodes);
  assert.ok(b.maxX - b.minX > 400 && b.maxY - b.minY > 400, "layout collapsed");
});

function countOverlaps(nodes) {
  const cell = 80;
  const grid = {};
  nodes.forEach((n) => {
    const k = Math.floor(n.x / cell) + ":" + Math.floor(n.y / cell);
    (grid[k] || (grid[k] = [])).push(n);
  });
  let bad = 0;
  nodes.forEach((n) => {
    const gx = Math.floor(n.x / cell);
    const gy = Math.floor(n.y / cell);
    for (let ix = gx - 1; ix <= gx + 1; ix++)
      for (let iy = gy - 1; iy <= gy + 1; iy++) {
        for (const q of grid[ix + ":" + iy] || []) {
          if (q === n || q.id < n.id) continue;
          const d = Math.hypot(q.x - n.x, q.y - n.y);
          if (d < (n.r + q.r) * 0.95) bad++;
        }
      }
  });
  return bad;
}

ok("sunburst: у всех вершин есть мишень, главы занимают свои секторы", () => {
  const g = core.buildGraph(allNotes);
  const W = 1500, H = 1000;
  core.initPositions(g.nodes, { width: W, height: H, graph: g, layout: g.config.layout });
  const placed = g.nodes.filter((n) => Number.isFinite(n.tx) && Number.isFinite(n.ty));
  assert.strictEqual(placed.length, g.stats.nodes, "targets assigned to " + placed.length);
  const cx = W / 2, cy = H / 2;
  const ang = (n) => Math.atan2(n.y - cy, n.x - cx);
  const dist = (n) => Math.hypot(n.x - cx, n.y - cy);
  // дисперсия угла внутри главы мала -> сектора читаются
  const byCh = {};
  g.nodes.filter((n) => n.chapter && n.type !== "chapter").forEach((n) => (byCh[n.chapter] = byCh[n.chapter] || []).push(n));
  assert.strictEqual(Object.keys(byCh).length, 9, "chapters with members: " + Object.keys(byCh).length);
  for (const [ch, arr] of Object.entries(byCh)) {
    const a = arr.map(ang);
    const mean = Math.atan2(a.reduce((s, x) => s + Math.sin(x), 0), a.reduce((s, x) => s + Math.cos(x), 0));
    const dev = a.map((x) => Math.abs(Math.atan2(Math.sin(x - mean), Math.cos(x - mean))));
    const p90 = dev.slice().sort((x, y) => x - y)[Math.floor(dev.length * 0.9)];
    assert.ok(p90 < 0.62, `глава ${ch}: разброс угла p90=${p90.toFixed(2)} (сектор ~0.7)`);
  }
  // кольца по типам: главы ближе к центру, чем секции, те — чем заголовки, те — чем блоки
  const med = (t) => {
    const d = g.nodes.filter((n) => n.type === t).map(dist).sort((x, y) => x - y);
    return d[Math.floor(d.length / 2)];
  };
  const [rCh, rSec, rHea, rBlo] = ["chapter", "section", "heading", "block"].map(med);
  assert.ok(rCh < rSec && rSec < rHea && rHea < rBlo, `кольца ${rCh.toFixed(0)} < ${rSec.toFixed(0)} < ${rHea.toFixed(0)} < ${rBlo.toFixed(0)}`);
  assert.ok(rBlo / rCh > 3, "rings too close: " + (rBlo / rCh).toFixed(2));
});

ok("автонастройка раскладки: большой граф получает больший разлёт и отталкивание", () => {
  const big = core.tuneLayout({ nodes: new Array(1125) }, core.DEFAULTS.layout);
  const small = core.tuneLayout({ nodes: new Array(50) }, core.DEFAULTS.layout);
  assert.ok(big.tuneFactor > 1.5, "factor " + big.tuneFactor);
  assert.ok(big.repel > small.repel * 2, `repel ${big.repel} vs ${small.repel}`);
  assert.ok(big.radius > small.radius);
  assert.ok(big.gravity < small.gravity);
  const off = core.tuneLayout({ nodes: new Array(1125) }, Object.assign({}, core.DEFAULTS.layout, { autoTune: false }));
  assert.strictEqual(off.radius, core.DEFAULTS.layout.radius, "autoTune:false должен игнорироваться");
});

ok("физика на НАСТРОЙКАХ ПЛАГИНА разводит вершины (пункт 4: крупные узлы не слипаются)", () => {
  // проверяем ровно тот конфиг, который уедет в .obsidian/plugins/lecture-graph/data.json
  const plug = JSON.parse(fs.readFileSync(path.join(ROOT, ".obsidian/plugins/lecture-graph/data.json"), "utf8"));
  const g = core.buildGraph(allNotes, plug);
  assert.strictEqual(g.config.degreeGamma, plug.degreeGamma, "конфиг не подхвачен");
  core.initPositions(g.nodes, { width: 1500, height: 1000, graph: g, layout: g.config.layout });
  const before = countOverlaps(g.nodes);
  core.run(g, { iterations: 420, width: 1500, height: 1000, layout: g.config.layout });
  const after = countOverlaps(g.nodes);
  const engMode = ["fdp", "neato", "twopi"].indexOf((g.config.layout || {}).mode) >= 0;
  if (engMode) assert.ok(after < before, "движок не уменьшил наложения: " + before + " -> " + after);
  else assert.strictEqual(before, 0, "раскладка уже на старте даёт наложения: " + before);
  assert.strictEqual(after, 0, "после упаковки остались наложения кругов: " + after);
  // локальная скученность: ни у одной вершины не должно быть >4 соседей «в обнимку»
  const perNode = {};
  const cell0 = 80, grid0 = {};
  g.nodes.forEach((n) => { const k = Math.floor(n.x / cell0) + ":" + Math.floor(n.y / cell0); (grid0[k] = grid0[k] || []).push(n); });
  g.nodes.forEach((n) => {
    const gx = Math.floor(n.x / cell0), gy = Math.floor(n.y / cell0);
    let c = 0;
    for (let ix = gx - 1; ix <= gx + 1; ix++)
      for (let iy = gy - 1; iy <= gy + 1; iy++)
        for (const q of grid0[ix + ":" + iy] || []) {
          if (q === n || q.id < n.id) continue;
          if (Math.hypot(q.x - n.x, q.y - n.y) < (n.r + q.r) * 0.95) c++;
        }
    perNode[n.id] = c;
  });
  const worst = Math.max(...Object.values(perNode));
  assert.ok(worst <= 3, "у вершины " + worst + " соседей впритык");
  // ближайший сосед: ищем expanding-кольцами по сетке, чтобы не зависеть от «случайно» выбранного окна
  const cell = 200, grid = {};
  g.nodes.forEach((n) => {
    const k = Math.floor(n.x / cell) + ":" + Math.floor(n.y / cell);
    (grid[k] || (grid[k] = [])).push(n);
  });
  let sum = 0, cnt = 0, lonely = 0, buried = 0, worstGap = Infinity;
  g.nodes.forEach((n) => {
    const gx = Math.floor(n.x / cell), gy = Math.floor(n.y / cell);
    let best = Infinity;
    for (let ring = 1; ring <= 6 && best === Infinity; ring++) {
      for (let ix = gx - ring; ix <= gx + ring; ix++)
        for (let iy = gy - ring; iy <= gy + ring; iy++) {
          if (ring > 1 && Math.abs(ix - gx) !== ring && Math.abs(iy - gy) !== ring) continue; // только ободок
          for (const q of grid[ix + ":" + iy] || []) {
            if (q === n) continue;
            const d = Math.hypot(q.x - n.x, q.y - n.y) - (n.r + q.r);
            if (d < best) best = d;
          }
        }
    }
    if (best === Infinity) { lonely++; return; }
    sum += best; cnt++;
    worstGap = Math.min(worstGap, best);
    if (best < -6) buried++; // круг реально залез в соседний
  });
  assert.strictEqual(lonely, 0, "не найдено ни одного соседа у части вершин");
  assert.ok(buried <= g.stats.nodes * 0.01, "вершин с наездом больше 1%: " + buried);
  console.log("       · зазор до ближайшего соседа: " + (sum / cnt).toFixed(1) + " px (min " + worstGap.toFixed(1) + "); пересечений: " + before + " -> " + after + "; max на вершину: " + worst + "; с наездом: " + buried);
  assert.ok(sum / cnt > 4, "средний зазор до соседа всего " + (sum / cnt).toFixed(2));
});

ok("ссылка резолвится и по полному имени файла, и по id, и по пути — без лишних вершин", () => {
  const tgtRel = "30 - Blocks/Ch01/Ch01-S03-H06-B03 - Example 1.3.6c.md";
  const srcRel = "10 - Chapters/Ch01 - Metric Spaces and Completion.md";
  const target = allNotes.find((n) => n.path === tgtRel);
  const src = allNotes.find((n) => n.path === srcRel);
  assert.ok(target && src, "нет фикстур: " + !!target + "/" + !!src);
  const stem = target.path.slice(0, -3).split("/").pop();
  const g0 = core.buildGraph(allNotes);
  const node = g0.nodes.find((n) => n.path === tgtRel);
  const srcNode = g0.nodes.find((n) => n.path === srcRel);
  assert.ok(node && srcNode, "вершины не найдены");
  const linksBefore = g0.edges.filter((e) => e.source === srcNode.id && e.target === node.id).length;
  const variants = [
    "[[" + stem + "]]",
    "[[" + stem + "|Example 1.3.6c]]",
    "[[Ch01-S03-H06-B03]]",
    "[[" + tgtRel.slice(0, -3) + "]]",
  ];
  for (const raw of variants) {
    const patched = allNotes.map((n) =>
      n.path === srcRel ? { path: n.path, text: n.text + "\n" + raw + "\n" } : n);
    const g = core.buildGraph(patched);
    const hits = g.edges.filter((e) => e.source === srcNode.id && e.target === node.id).length;
    assert.strictEqual(hits - linksBefore, 1, raw + " дала прирост рёбер " + (hits - linksBefore));
    assert.strictEqual(g.stats.unresolved, 0, raw + " осталась неразрешённой");
    assert.strictEqual(g.stats.nodes, g0.stats.nodes, raw + " породила лишнюю вершину");
  }
});

ok("Course Index: иерархия, все вершины, якори-заголовки и счётчики", () => {
  const g = core.buildGraph(allNotes);
  const md = core.toIndexMarkdown(g, { stamp: "fixture", resolve: () => true });
  assert.ok(md.startsWith("---\ntype: index\n"), "нет frontmatter оглавления");
  assert.ok(/cssclasses: \["lg-index"\]/.test(md), "нет класса lg-index -> CSS не сработает");
  // вершина может упоминаться 1 раз в дереве + 1 раз в «Указателе глав» (только главы)
  // + 1 раз в таблице топ-20. Других дублей быть не должно.
  const topIds = new Set(
    g.nodes.slice().sort((a, b) => b.degree - a.degree || (a.id < b.id ? -1 : 1)).slice(0, 20).map((n) => n.id)
  );
  const firstPos = new Map();
  for (const n of g.nodes) {
    const i = md.indexOf("[[" + n.stem);
    assert.ok(i >= 0, "в оглавлении нет ссылки на " + n.stem);
    firstPos.set(n.id, i);
    // в дереве разделитель обычный `|`, в таблицах он экранирован `\|` — считаем по префиксу
    const cnt = md.split("[[" + n.stem).length - 1;
    // «Указатель глав» ссылается на заголовок заметки ([[#...]]), а не на файл, поэтому
    // владелица файла-главы упоминается один раз, плюс строка топ-20 если она в топе
    assert.strictEqual(cnt, 1 + (topIds.has(n.id) ? 1 : 0), "лишние упоминания: " + n.stem);
  }
  // порядок: секции главы идут после главы, их заголовки — после секции, блоки — после заголовка
  const kids = {};
  g.nodes.forEach((n) => {
    if (!n.parent) return;
    (kids[n.parent] = kids[n.parent] || []).push(n);
  });
  const sorted = (p, t) => (kids[p] || []).filter((n) => n.type === t).sort((a, b) => (a.id < b.id ? -1 : 1));
  let checked = 0;
  for (const ch of sorted(null, "chapter").concat(g.nodes.filter((n) => n.type === "chapter" && !n.parent)).filter((v, i, a) => a.indexOf(v) === i)) {
    let prev = firstPos.get(ch.id);
    for (const sec of sorted(ch.id, "section")) {
      assert.ok(firstPos.get(sec.id) > prev, "секция " + sec.id + " встала раньше главы");
      let p2 = firstPos.get(sec.id);
      for (const h of sorted(sec.id, "heading")) {
        assert.ok(firstPos.get(h.id) > p2, "заголовок " + h.id + " встал раньше секции");
        let p3 = firstPos.get(h.id);
        for (const b of sorted(h.id, "block")) {
          assert.ok(firstPos.get(b.id) > p3, "блок " + b.id + " встал раньше заголовка");
          p3 = firstPos.get(b.id);
          checked++;
        }
        p2 = firstPos.get(h.id);
      }
      prev = firstPos.get(sec.id);
    }
  }
  assert.ok(checked > 700, "проверено мало связей: " + checked);
  // ссылки на разделы оглавления должны вести на существующие заголовки этой же заметки
  const heads = new Set(md.split("\n").filter((l) => /^#{2,3} /.test(l)).map((l) => l.replace(/^#+ /, "").trim()));
  // якори в таблицах записаны с экранированной чертой ([[#Текст\|Текст]]) — срезам слэши
  const anchors = Array.from(md.matchAll(/\[\[#([^\]\|]+)/g)).map((m) => m[1].replace(/\\+$/, "").trim());
  assert.ok(anchors.length >= 9, "якорей глав: " + anchors.length);
  // строки таблиц: неразбитые ячейки (внутренний `|` обязан быть экранирован)
  const rows = md.split("\n").filter((l) => l.startsWith("|"));
  assert.ok(rows.length > 25, "строк таблицы: " + rows.length);
  rows.forEach((l) => {
    const cells = l.split(/(?<!\\)\|/).filter((c) => c.trim() !== "");
    assert.ok(cells.length >= 5 && cells.length <= 9, "битая строка таблицы: " + l.slice(0, 60));
  });
  for (const a of anchors) assert.ok(heads.has(a), "нет заголовка-цели: " + a);
  // счётчик в строке =degree вершины (т.е. оглавление врёт не может)
  for (const n of g.nodes.filter((x) => x.type === "section").slice(0, 10)) {
    const line = md.split("\n").find((l) => l.includes("[[" + n.stem + "|"));
    assert.ok(line.includes("`\u21E0 " + n.degree + "`"), n.id + ": " + line.trim());
  }
  assert.ok(md.includes("неразрешённых ссылок: **0**"), "раздел «что починить» не отражает 0 висячих");
  assert.ok(md.includes("Топ-20 вершин"), "нет таблицы топ-вершин");

  // цветные вертикальные полоски: каждый уровень — свой callout на своей глубине цитаты
  const n = (t) => g.nodes.filter((x) => x.type === t).length;
  const lines = md.split("\n");
  const cnt = (pref) => lines.filter((l) => l.startsWith(pref)).length;
  assert.strictEqual(cnt("> [!chapter]+ \ud83d\udfe1 "), n("chapter"), "полосок главы: " + cnt("> [!chapter]+ "));
  assert.strictEqual(cnt("> > [!section]+ \ud83d\udd35 "), n("section"), "полосок секции: " + cnt("> > [!section]+ "));
  assert.strictEqual(cnt("> > > [!heading]+ \ud83d\udfe2 "), n("heading"), "полосок заголовка: " + cnt("> > > [!heading]+ "));
  assert.strictEqual(cnt("> > > > - [[") + cnt("> > > > - `"), n("block"), "строк блоков под полоской 4-го уровня");
  const groups = cnt("> > > > [!block] ");
  assert.ok(groups > 0 && groups <= n("heading"), "групп блоков: " + groups);
  assert.strictEqual(cnt("## Ch"), n("chapter"), "главы перестали быть заголовками ## -> якори [[#…]] отвалятся");
  assert.ok(md.includes("> \ud83d\udfe1 глава \u00B7 \ud83d\udd35 секция \u00B7 \ud83d\udfe2 заголовок \u00B7 \ud83d\udfe3 блоки"),
    "в подсказке оглавления нет легенды полосок");
});

ok("типов вершины ровно четыре: оглавление не может стать вершиной графа", () => {
  assert.deepStrictEqual(core.TYPES, ["chapter", "section", "heading", "block"], "TYPES: " + core.TYPES.join(","));
  assert.strictEqual(core.isIndexNote, undefined, "в ядре осталась поддержка вершины-оглавления");
  assert.ok(!allNotes.some((n) => /Course Index/.test(n.path)), "заметка оглавления попала в набор вершин курса");
  // тот же путь, что использует плагин: настройка indexNote (её правит и пункт контекстного меню)
  const plugCfg = JSON.parse(fs.readFileSync(path.join(ROOT, ".obsidian", "plugins", "lecture-graph", "data.json"), "utf8"));
  const idxCfg = String(plugCfg.indexNote || "Course Index.md").trim().replace(/^\.\//, "");
  const idxRel = /\.md$/i.test(idxCfg) ? idxCfg : idxCfg + ".md";
  const idxText = fs.readFileSync(path.join(ROOT, idxRel), "utf8");
  assert.strictEqual(idxRel, "Course Index.md", "поставка: оглавление лежит не в корне хранилища");
  assert.ok(/^type: index$/m.test(idxText), "у оглавления пропала пометка type: index");
  assert.ok(!/^name_zh:/m.test(idxText), "в оглавлении остался frontmatter для вершины графа");
  assert.strictEqual(core.buildGraph(allNotes).stats.byType.index || 0, 0, "вершин index: " + core.buildGraph(allNotes).stats.byType.index);
});

ok("SVG: по одному кругу на вершину, две строки подписи, CJK-шрифт", () => {
  const svg = core.toSVG(laid, {});
  const circles = (svg.match(/<circle /g) || []).length;
  assert.strictEqual(circles, laid.stats.nodes, "circles=" + circles + " nodes=" + laid.stats.nodes);
  assert.ok(svg.includes("Noto Sans CJK SC"), "CJK font fallback missing");
  const ch = laid.nodes.find((n) => n.type === "chapter");
  const texts = (svg.match(/<text /g) || []).length;
  assert.ok(texts > 0, "no labels");
  assert.ok(/[一-鿿]/.test(svg), "no CJK labels in svg");
  assert.ok(svg.trim().endsWith("</svg>"));
  assert.ok(svg.startsWith("<svg "));
});

ok("экспорт CSV/GraphML/DOT/Markdown синтаксически цел", () => {
  const csv = core.toCsv(laid);
  const rows = csv.trim().split("\n");
  assert.strictEqual(rows[0].split(",").length, 10);
  assert.strictEqual(rows.length, laid.stats.nodes + 1);
  const ml = core.toGraphML(laid);
  assert.ok(ml.includes("<graphml") && ml.trim().endsWith("</graphml>"));
  assert.strictEqual((ml.match(/<node /g) || []).length, laid.stats.nodes);
  const dot = core.toDot(laid);
  assert.ok(dot.startsWith("digraph") && dot.trim().endsWith("}"));
  const md = core.toMarkdown(laid);
  assert.ok(md.includes("## chapter") && md.includes("## block"));
});

ok("фильтры и подсветка соседей", () => {
  const only = core.filterNodes(laid, { types: ["chapter", "section"], minDegree: 0 });
  assert.ok(only.every((n) => n.type === "chapter" || n.type === "section"));
  const q = core.filterNodes(laid, { query: "Spectral" });
  assert.ok(q.length > 0 && q.length < laid.stats.nodes, "search hits " + q.length);
  const zh = core.filterNodes(laid, { query: "谱定理" });
  assert.ok(zh.length > 0, "CJK search found nothing");
  const target = chaps[0];
  const nb = core.neighborhood(laid, target.id);
  assert.ok(Object.keys(nb).length >= 5, "neighbors " + Object.keys(nb).length);
  assert.ok(nb[target.id]);
});


console.log("\n== раунд 15: сектора, дуги, размеры, цвета, выгрузка ==");

const plugCfg = JSON.parse(fs.readFileSync(path.join(ROOT, ".obsidian/plugins/lecture-graph/data.json"), "utf8"));
// гарантии «нет пересечений структуры» и «вершина в секторе своей главы» принадлежат
// режиму кластеров, поэтому придирчивые проверки раунда 15 считаются именно на нём
plugCfg.layout = Object.assign({}, plugCfg.layout, { mode: "clusters" });
const laid15 = (function () {
  const gg = core.buildGraph(allNotes, plugCfg);
  core.initPositions(gg.nodes, { width: 1500, height: 1000, graph: gg, layout: gg.config.layout });
  core.run(gg, { layout: gg.config.layout, width: 1500, height: 1000 });
  return gg;
})();

/** Пересечения рёбер так, как их рисует view: дугами (кривую Ребра режем на 8 отрезков). */
function structArcCrossings(g, bow) {
  const byId = {};
  g.nodes.forEach((n) => (byId[n.id] = n));
  const ctr = g._center ? { x: g._center.cx, y: g._center.cy } : null;
  const segs = [];
  g.edges
    .filter((e) => e.kind === "structure" && byId[e.source] && byId[e.target] && byId[e.source] !== byId[e.target])
    .forEach((e) => {
      const a = byId[e.source], b = byId[e.target];
      const m = core.edgePath(a, b, bow, ctr, "structure").match(/M([-\d.]+) ([-\d.]+)Q([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)/);
      if (!m) return;
      const p0 = { x: +m[1], y: +m[2] }, p1 = { x: +m[3], y: +m[4] }, p2 = { x: +m[5], y: +m[6] };
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8, u = 1 - t;
        pts.push({ x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y });
      }
      segs.push({ a: a, b: b, pts: pts });
    });
  const hit = (p1, p2, q1, q2) => {
    const d = (bx, ax, cx) => (bx.x - ax.x) * (cx.y - ax.y) - (bx.y - ax.y) * (cx.x - ax.x);
    const d1 = d(p2, p1, q1), d2 = d(p2, p1, q2), d3 = d(q2, q1, p1), d4 = d(q2, q1, p2);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  };
  let bad = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const u = segs[i], v = segs[j];
      if (u.a === v.a || u.a === v.b || u.b === v.a || u.b === v.b) continue; // общий конец — не пересечение
      for (let x = 0; x + 1 < u.pts.length && !bad2(u, v); x++) {
        for (let y = 0; y + 1 < v.pts.length; y++) {
          if (hit(u.pts[x], u.pts[x + 1], v.pts[y], v.pts[y + 1])) { bad++; break; }
        }
      }
    }
  }
  function bad2() { return false; }
  return bad;
}

/** Наложения подписей ровно того набора, который реально рисуется. */
function labelOverlaps(g, cfg) {
  const boxes = g.nodes.map((n) => {
    const r = core.labelRectOf(n);
    return r && Object.assign({ id: n.id }, r);
  }).filter(Boolean);
  let bad = 0;
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) bad++;
    }
  return { boxes: boxes.length, bad: bad };
}

ok("рёбра «глава-секция-заголовок-блок» не пересекаются (дугами, как на экране)", () => {
  const bow = plugCfg.curvature === undefined ? core.DEFAULTS.curvature : plugCfg.curvature;
  assert.strictEqual(structArcCrossings(laid15, bow), 0, "есть пересечения структурных дуг");
  assert.strictEqual(structArcCrossings(laid15, 0), 0, "есть пересечения прямых структурных рёбер");
});

ok("кластеры по главам: сектора не перемешиваются", () => {
  const byId = {};
  laid15.nodes.forEach((n) => (byId[n.id] = n));
  const C = laid15._center;
  assert.ok(C && C.R > 100, "центр раскладки не задан");
  const ang = (n) => Math.atan2(n.y - C.cy, n.x - C.cx);
  let inside = 0, total = 0;
  const chaps = laid15.nodes.filter((n) => n.type === "chapter").sort((a, b) => (a.id < b.id ? -1 : 1));
  const span = chaps.map((n) => [ang(n) - 0.02, ang(n) + 0.02]);
  laid15.nodes.forEach((n) => {
    if (n.type === "chapter") return;
    const owner = chaps.findIndex((c) => c.id === n.chapter);
    if (owner < 0) return;
    total++;
    let a = ang(n);
    // приводим к окну сектора главы (углы в -pi..pi)
    while (a < span[owner][0] - Math.PI) a += Math.PI * 2;
    while (a > span[owner][0] + Math.PI) a -= Math.PI * 2;
    if (a >= span[owner][0] - 0.62 && a <= span[owner][1] + 0.62) inside++;
  });
  assert.ok(total > 900, "мало вершин с главой: " + total);
  assert.strictEqual(inside, total, "вершин вне сектора своей главы: " + (total - inside));
});

ok("подписи не перекрываются и видны на двух языках", () => {
  const r = labelOverlaps(laid15, plugCfg);
  assert.ok(r.boxes >= 200, "подписей нарисовано слишком мало: " + r.boxes);
  assert.strictEqual(r.bad, 0, "пересечений подписей: " + r.bad);
  const ch = laid15.nodes.find((n) => n.type === "chapter");
  const t = core.labelLines(ch, plugCfg);
  assert.ok(t[0] && t[1] && /[\u4e00-\u9fff]/.test(t[1]), "у главы нет второй (китайской) строки");
});

ok("пол размеров: глава и секция не исчезают при любом «Максимальном радиусе»", () => {
  for (const maxR of [12, 22, 34, 60]) {
    const cfg = Object.assign({}, plugCfg, { maxRadius: maxR });
    const g = core.buildGraph(allNotes, cfg);
    core.applySizes(g.nodes, cfg);
    const ch = g.nodes.filter((n) => n.type === "chapter");
    const sec = g.nodes.filter((n) => n.type === "section");
    assert.ok(ch.every((n) => n.r >= cfg.sizeFloor.chapter), "глава сжалась ниже пола при maxRadius=" + maxR);
    assert.ok(sec.every((n) => n.r >= cfg.sizeFloor.section), "секция сжалась ниже пола при maxRadius=" + maxR);
    assert.ok(ch.every((n) => n.labelShown && n.labelAlways), "у главы пропала подпись при maxRadius=" + maxR);
    assert.ok(sec.every((n) => n.labelShown), "у секции пропала подпись при maxRadius=" + maxR);
    // подписи видны и не наезжают — даже когда вершины нарисованы крупно
    core.initPositions(g.nodes, { width: 1500, height: 1000, graph: g, layout: cfg.layout });
    core.run(g, { layout: cfg.layout, width: 1500, height: 1000 });
    assert.strictEqual(labelOverlaps(g, cfg).bad, 0, "при maxRadius=" + maxR + " подписи наезжают");
  }
});

ok("размер вершины правится свойством size (и кегль подписи растёт вместе с ним)", () => {
  const base = core.buildGraph(allNotes, plugCfg);
  core.applySizes(base.nodes, plugCfg);
  const one = base.nodes.find((n) => n.type === "section");
  const r0 = one.r, f0 = one.font, w0 = one.lw;
  // то же самое, но у одной секции в заметке стоит size: 1.6
  const patched = allNotes.map((x) => {
    if (x.path !== one.path) return x;
    return { path: x.path, text: core.setFrontmatterValues(x.text, { size: 1.6 }) };
  });
  const g2 = core.buildGraph(patched, plugCfg);
  core.applySizes(g2.nodes, plugCfg);
  const n2 = g2.nodes.find((n) => n.id === one.id);
  assert.ok(Math.abs(n2.r / r0 - 1.6) < 0.02, "size: 1.6 не применился: " + (n2.r / r0).toFixed(3));
  assert.ok(Math.abs(n2.font / f0 - 1.6) < 0.02, "кегль подписи не растёт пропорционально вершине: " + (n2.font / f0).toFixed(3));
  assert.ok(n2.lw > w0, "ширина подписи не выросла вместе с вершиной");
  assert.ok(n2.cr > one.cr, "упаковочный след вершины не учёлся — подписи наедут друг на друга");
  // в другую сторону: size: 0.5 уменьшает и круг, и буквы
  const shrunk = core.buildGraph(allNotes.map((x) => (x.path === one.path ? { path: x.path, text: core.setFrontmatterValues(x.text, { size: 0.5 }) } : x)), plugCfg);
  core.applySizes(shrunk.nodes, plugCfg);
  const n3 = shrunk.nodes.find((n) => n.id === one.id);
  assert.ok(Math.abs(n3.r / r0 - 0.5) < 0.02, "size: 0.5 не уменьшил вершину: " + (n3.r / r0).toFixed(3));
  assert.ok(Math.abs(n3.font / f0 - 0.5) < 0.02, "size: 0.5 не уменьшил подпись: " + (n3.font / f0).toFixed(3));
  // «size: 22px» — заданный радиус в пикселях
  const pxg = core.buildGraph(allNotes.map((x) => (x.path === one.path ? { path: x.path, text: core.setFrontmatterValues(x.text, { size: "22px" }) } : x)), plugCfg);
  core.applySizes(pxg.nodes, plugCfg);
  assert.ok(Math.abs(pxg.nodes.find((n) => n.id === one.id).r - 22) < 0.5, "size: 22px должен дать радиус 22");
  assert.ok(core.sizeScale, "ядро не отдаёт шкалу размеров");
});

ok("рёбра рисуются дугами, а не прямыми (и в view, и в SVG)", () => {
  const byId = {};
  laid15.nodes.forEach((n) => (byId[n.id] = n));
  const e = laid15.edges.find((x) => byId[x.source] && byId[x.target] && byId[x.source] !== byId[x.target]);
  const d = core.edgePath(byId[e.source], byId[e.target], 0.24, laid15._center, e.kind);
  assert.ok(d.indexOf("Q") > 0, "дуги нет: " + d);
  assert.strictEqual(d.split("L").length - 1, 0, "в пути ребра осталась прямая линия");
  const svg = core.toSVG(laid15, { labels: false });
  assert.ok(/<path d="M[^"]+Q/.test(svg), "в SVG рёбра не дуги");
  assert.ok(!/stroke="[^"]+" stroke-width="[^"]+" stroke-opacity="[^"]+"\/>"/.test(svg) || !/<line /.test(svg), "в SVG остались <line>");
  // нулевая кривизна возвращает прямые — настройка работает в обе стороны
  const flat = core.edgePath(byId[e.source], byId[e.target], 0, laid15._center, e.kind);
  assert.notStrictEqual(flat, d, "кривизна 0 и 0.24 дали одинаковый путь");
});

  function ch_count(gr) { return gr.nodes.filter((n) => n.type === "chapter").length; }
ok("цвет по главам: наследование и переопределение своим цветом", () => {
  const g = laid15;
  assert.ok(g.colorsByChapter && typeof g.colorsByChapter === "object" && Object.keys(g.colorsByChapter).length === ch_count(g),
    "colorsByChapter (id главы -> цвет) не отдан легенде: " + JSON.stringify(g.colorsByChapter));
  assert.ok(Object.keys(g.colors).length === g.nodes.length, "colors (цвет вершины) посчитан не для всех");
  // с выключенной группировкой — цвета по типам, а легенда получает пустую карту глав
  const gg = { nodes: g.nodes, _byId: g._byId };
  core.resolveColors(gg, Object.assign({}, plugCfg, { chapterColors: false }));
  assert.deepStrictEqual(gg.colorsByChapter, {}, "выключенная группировка всё равно красит по главам");
  assert.strictEqual(gg.colors["Ch01"], plugCfg.colors.chapter, "вне группировки у главы должен быть цвет типа");
  core.resolveColors(gg, plugCfg);
  const map = core.resolveColors(g, plugCfg);
  const ch = g.nodes.filter((n) => n.type === "chapter");
  assert.strictEqual(new Set(ch.map((n) => n.color)).size, ch.length, "у глав цвета повторяются");
  ch.forEach((c) => {
    const kids = g.nodes.filter((n) => n.chapter === c.id && n.type !== "chapter");
    assert.ok(kids.length > 30, "у главы нет наследников");
    kids.forEach((k) => {
      // исключение из правила — блок, чьи ключевые фразы собрали больше вхождений в чужой
      // главе: он красится ею (своё color: по-прежнему сильнее любого из двух)
      const want = k.kwChapter && k.kwChapter !== c.id ? g.colorsByChapter[k.kwChapter] : c.color;
      assert.strictEqual(k.color, want, k.id + " не унаследовал цвет главы");
    });
    const drifted = g.nodes.filter((n) => n.kwChapter && n.chapter && n.kwChapter !== n.chapter);
    assert.ok(drifted.length > 20, "вершин, окрашенных главой-лидером по ключевым фразам, почти нет: " + drifted.length);
    drifted.forEach((n) => assert.notStrictEqual(n.color, g.colorsByChapter[n.chapter], n.id + " всё ещё цвет своей главы"));
  });
  assert.strictEqual(map[ch[0].id], ch[0].color, "карта цветов глав не совпадает с вершинами");
  // свойство color: перебивает и цвет главы, и цвет типа
  const one = g.nodes.find((n) => n.type === "heading");
  const patched = allNotes.map((x) => (x.path === one.path ? { path: x.path, text: core.setFrontmatterValues(x.text, { color: "#123456" }) } : x));
  const g2 = core.buildGraph(patched, plugCfg);
  assert.strictEqual(g2.nodes.find((n) => n.id === one.id).color, "#123456", "свой color: не применён");
});

ok("ширина подписи считается по глифам: иероглифы шире латиницы", () => {
  assert.ok(Math.abs(core.textUnits("AB") - 2 * 0.7) < 1e-9, "латиница: " + core.textUnits("AB"));
  assert.ok(Math.abs(core.textUnits("\u5ea6\u91cf\u7a7a\u95f4") - 4 * 1.05) < 1e-9, "CJK: " + core.textUnits("\u5ea6\u91cf\u7a7a\u95f4"));
  assert.ok(core.textUnits("\u2026") > 1, "многоточие (широкое) должно считаться как глиф");
  // 8 иероглифов + латинская строка в 12 символов:reserve должен определяться иероглифами,
  // иначе метки наезжают (реальная причина дефекта «подписи сливаются»)
  const nodes = [{ id: "X", type: "chapter", name: "Metric Spaces and Completion",
    nameZh: "\u5ea6\u91cf\u7a7a\u95f4\u4e0e\u5b8c\u5907\u5316", degree: 5, refs: 5, in: [], out: [] }];
  core.applySizes(nodes, Object.assign({}, plugCfg, { labelCharsFor: { chapter: 30 } }));
  const n = nodes[0];
  assert.ok(n.lw >= core.textUnits(n.labelZh) * n.font, "резерв под меньше ширины 中文-строки: lw=" + n.lw +
    " нужно " + (core.textUnits(n.labelZh) * n.font).toFixed(1));
  assert.ok(n.lw > n.labelZh.length * n.font, "резерв не учитывает ширину иероглифов: " + n.lw);
});

ok("свойство caption: связывает вершину с заметкой сообщения", () => {
  const g = core.buildGraph(allNotes, plugCfg);
  const ch = g.nodes.find((n) => n.id === "Ch01");
  assert.strictEqual(ch.caption, "Ch01 — caption", "caption: не прочитан из главы");
  const sec = g.nodes.find((n) => n.id === "Ch01-S01");
  assert.strictEqual(sec.caption, "Ch01-S01 — caption", "caption: не прочитан из секции");
  const blk = g.nodes.find((n) => n.type === "block");
  assert.ok(!blk.caption, "у блока не должно быть сообщения");
  // сами заметки сообщений лежат вне графа
  const caps = walk(path.join(ROOT, "45 - Captions")).length;
  assert.strictEqual(caps, N.chapter + N.section, "заметок сообщения должно быть ровно по одной на главу и секцию");
  assert.ok(allNotes.every((n) => n.path.indexOf("45 - Captions") < 0), "заметка сообщения попала в граф");
});

ok("выгрузка JSON: что видно на экране, то и в файле", () => {
  const vis = core.filterNodes(laid15, { types: core.TYPES, minDegree: 0 });
  const small = { nodes: vis.filter((n) => n.type !== "block"), edges: laid15.edges, stats: laid15.stats, config: laid15.config, colorsByChapter: laid15.colorsByChapter, chapterColors: laid15.chapterColors, _center: laid15._center };
  const obj = core.toGraphJson(small, { stamp: "2026-09-09 00:00" });
  assert.strictEqual(obj.format, "lecture-graph/1");
  assert.strictEqual(obj.stats.nodes, small.nodes.length);
  assert.ok(obj.stats.edges > 0 && obj.stats.edges < laid15.stats.edges, "рёбра не отфильтрованы по видимым вершинам");
  const node = obj.nodes.find((n) => n.id === "Ch01");
  ["id", "type", "name", "name_zh", "path", "refs", "in", "out", "size_factor", "radius", "color", "caption", "x", "y"].forEach((k) =>
    assert.ok(Object.prototype.hasOwnProperty.call(node, k), "в узле нет поля " + k));
  assert.ok(isFinite(node.x) && isFinite(node.y), "координат в выгрузке нет");
  assert.ok(node.refs.text > 0, "счётчик ссылок из текстов пустой");
  assert.ok(obj.settings && obj.settings.curvature !== undefined, "настройки раскладки не попали в выгрузку");
  assert.ok(Object.keys(obj.chapterColors).length >= 9, "палитры глав в выгрузке нет");
  const txt = JSON.stringify(obj);
  assert.ok(txt.indexOf("undefined") < 0, "в JSON пролез undefined");
});

console.log("\n== раунд 16: движки раскладки fdp / neato / twopi ==");

const MODES = ["fdp", "neato", "twopi", "clusters", "force"];
const shippedCfg = JSON.parse(fs.readFileSync(path.join(ROOT, ".obsidian/plugins/lecture-graph/data.json"), "utf8"));

function runMode(mode, over) {
  const cfg = JSON.parse(JSON.stringify(shippedCfg));
  cfg.layout = Object.assign({}, cfg.layout, { mode }, over || {});
  const g = core.buildGraph(allNotes, cfg);
  core.run(g, { layout: cfg.layout, width: 1600, height: 1100, config: cfg });
  return { g, cfg };
}

ok("все режимы: координаты конечны и наложений нет ни у кругов, ни у подписей", () => {
  const sizes = {}, layeredness = {};
  MODES.forEach((m) => {
    const r = runMode(m);
    r.g.nodes.forEach((n) => assert.ok(isFinite(n.x) && isFinite(n.y), m + ": NaN у " + n.id));
    const circles = countOverlaps(r.g.nodes);
    const labels = labelOverlaps(r.g, r.cfg);
    assert.strictEqual(circles, 0, m + ": наложений кругов " + circles);
    assert.ok(labels.boxes >= 200, m + ": подписей нарисовано мало: " + labels.boxes);
    assert.strictEqual(labels.bad, 0, m + ": пересечений подписей " + labels.bad);
    const b = core.bounds(r.g.nodes);
    sizes[m] = Math.round(Math.hypot(b.maxX - b.minX, b.maxY - b.minY));
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    layeredness[m] = new Set(r.g.nodes.map((n) => Math.round(Math.hypot(n.x - cx, n.y - cy) / 8))).size / r.g.nodes.length;
  });
  // режимы обязаны выглядеть РАЗНО: картинка не должна сводиться к одному и тому же силуэту
  assert.ok(Math.abs(sizes.fdp - sizes.clusters) / sizes.clusters > 0.1, "fdp как clusters: " + JSON.stringify(sizes));
  assert.ok(Math.abs(sizes.neato - sizes.fdp) / sizes.fdp > 0.1, "neato как fdp: " + JSON.stringify(sizes));
  // для twopi размах холста близок к fdp (слои растянуты по тому же радиусу) — сравниваем форму:
  // доля «слоёв» (сколько различных расстояний до центра, шагом 8px, на все вершины). У
  // радиальных режимов она копеечная (вершины квантованы по кольцам), у пружинных — высокая.
  assert.ok(Math.abs(sizes.twopi - sizes.fdp) / sizes.fdp > 0.05, "twopi как fdp: " + JSON.stringify(sizes));
  assert.ok(layeredness.fdp > 0.3 && layeredness.neato > 0.3, "пружинные режимы стали кольцами: " + JSON.stringify(layeredness));
  assert.ok(layeredness.twopi < 0.2 && layeredness.clusters < 0.2, "радиальные режимы потеряли кольца: " + JSON.stringify(layeredness));
});

ok("движок детерминирован: два прогона дают одинаковые координаты", () => {
  ["fdp", "neato", "twopi"].forEach((m) => {
    const a = runMode(m), b = runMode(m);
    let max = 0;
    a.g.nodes.forEach((n) => {
      const o = b.g.nodes.find((x) => x.id === n.id);
      max = Math.max(max, Math.abs(n.x - o.x), Math.abs(n.y - o.y));
    });
    assert.ok(max < 1e-6, m + ": раскладка гуляет между прогонами на " + max.toFixed(3) + " px");
  });
});

ok("стягивание по главам работает: вершины ближе к своей главе, чем к чужой", () => {
  ["fdp", "neato", "twopi"].forEach((m) => {
    const r = runMode(m);
    // «пятно главы» считаем по ДОМУ вершины: своя глава, а для блока с ключевыми фразами —
    // глава-лидер по вхождениям (тот же критерий, что и у цвета). Иначе проверка «цвет = пятно»
    // расходится с тем, что реально рисует раскладка.
    const homeOf = (n) => n.kwChapter || n.chapter;
    const cent = {};
    r.g.nodes.filter((n) => n.type === "chapter").forEach((c) => (cent[c.id] = { x: 0, y: 0, k: 0 }));
    r.g.nodes.forEach((n) => {
      const c = cent[homeOf(n)];
      if (!c) return;
      c.x += n.x; c.y += n.y; c.k++;
    });
    Object.keys(cent).forEach((k) => { cent[k].x /= cent[k].k; cent[k].y /= cent[k].k; });
    let own = 0, ownN = 0, foreign = 0, foreignN = 0, drifted = 0;
    const ids = Object.keys(cent);
    r.g.nodes.forEach((n) => {
      const home = homeOf(n);
      const c = cent[home];
      if (!c || n.type === "chapter") return;
      if (n.kwChapter && n.kwChapter !== n.chapter) drifted++;
      own += Math.hypot(n.x - c.x, n.y - c.y); ownN++;
      const other = ids.find((k) => k !== home);
      if (!other) return;
      foreign += Math.hypot(n.x - cent[other].x, n.y - cent[other].y); foreignN++;
    });
    assert.ok(ownN > 900, m + ": мало вершин с главой: " + ownN);
    assert.ok(drifted > 20, m + ": блоки почти не уезжают в чужие главы — перекрас не виден: " + drifted);
    if (m === "fdp" || m === "neato") {
      // а «уехавшие» блоки действительно сидят ближе к той главе, что собрала их вхождения:
      // медиана расстояния до главы-лидера должна быть меньше медианы до своей.
      // twopi/clusters не проверяем: там членство структурное (слои и сектора), а раскраска
      // по главе-лидеру — только цвет, и это осознанно (иначе сектора рвутся).
      const dLead = [], dOwn = [];
      r.g.nodes.forEach((n) => {
        if (!n.kwChapter || !n.chapter || n.kwChapter === n.chapter) return;
        const a = cent[n.chapter], b = cent[n.kwChapter];
        if (!a || !b) return;
        dOwn.push(Math.hypot(n.x - a.x, n.y - a.y));
        dLead.push(Math.hypot(n.x - b.x, n.y - b.y));
      });
      const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
      assert.ok(dLead.length > 20, m + ": нечего сравнивать у перекрашенных блоков: " + dLead.length);
      assert.ok(med(dLead) < med(dOwn), m + ": перекрашенный блок не тянется к главе-лидеру (" + Math.round(med(dLead)) + " против " + Math.round(med(dOwn)) + ")");
    }
    // главы остаются отдельными пятнами (иначе цвет по главам ничего не показывает)
    // «глава = пятно» проверяем формой: для большинства вершин ближайшее пятно — своё.
    // Средние расстояния для neato неинформативны (у него холст в 1.5-2 раза больше, и
    // среднее по всем чужим centroids тонет в размере), а вот «чей я ближе» — ровно то,
    // зачем цвет по главам и существует
    let nearest = 0, nearestN = 0;
    r.g.nodes.forEach((n) => {
      if (n.type === "chapter") return;
      const home = cent[homeOf(n)];
      if (!home) return;
      const d = Math.hypot(n.x - home.x, n.y - home.y);
      let mine = true;
      ids.forEach((k) => { if (Math.hypot(n.x - cent[k].x, n.y - cent[k].y) < d - 1e-9) mine = false; });
      nearestN++;
      if (mine) nearest++;
    });
    console.log("       · " + m + ": ближайшее пятно своё у " + ((100 * nearest) / nearestN).toFixed(1) + "% · средние " + Math.round(own / ownN) + "/" + Math.round(foreign / foreignN));
    assert.ok(nearest / nearestN >= (m === "neato" ? 0.2 : 0.75), m + ": глава не собрана в пятно — своих среди ближайших " + ((100 * nearest) / nearestN).toFixed(1) + "%");
    // у пружинных режимов нулевое стягивание должно давать совсем другую картину
    if (m !== "twopi") {
      const off = runMode(m, { clusterPull: 0 });
      const d = r.g.nodes.reduce((acc, n) => {
        const o = off.g.nodes.find((x) => x.id === n.id);
        return Math.max(acc, Math.abs(n.x - o.x), Math.abs(n.y - o.y));
      }, 0);
      assert.ok(d > 200, m + ": clusterPull ни на что не влияет (макс. сдвиг " + Math.round(d) + ")");
    }
  });
});

ok("twopi: слой = глубина от корня (BFS), как у graphviz twopi", () => {
  const r = runMode("twopi");
  const root = r.g.nodes.find((n) => n.twopiDepth === 0);
  assert.ok(root && root.type === "chapter", "кортя twopi - не глава: " + (root && root.id));
  const layers = new Set(r.g.nodes.map((n) => n.twopiDepth));
  assert.ok(layers.size >= 4, "слоёв мало: " + layers.size);
  const rad = (n) => Math.hypot(n.x - root.x, n.y - root.y);
  let prev = -1, prevMean = -1, seen = [];
  [...layers].sort((a, b) => a - b).forEach((lvl) => {
    const a = r.g.nodes.filter((n) => n.twopiDepth === lvl);
    const mean = a.reduce((s, n) => s + rad(n), 0) / a.length;
    seen.push(lvl + ":" + Math.round(mean));
    if (lvl > 0) assert.ok(mean > prevMean, "слой " + lvl + " не дальше слоя " + prev + " (" + seen.join(" ") + ")");
    prevMean = mean; prev = lvl;
  });
  // корень заданного twopiRoot становится центром
  const r2 = runMode("twopi", { twopiRoot: "Ch03" });
  assert.strictEqual(r2.g.nodes.find((n) => n.twopiDepth === 0).id, "Ch03", "twopiRoot не подхвачен");
  // чем больше шаг слоя, тем дальше кольца
  const wide = runMode("twopi", { twopiRankSep: 2 });
  const meanR = (g) => g.nodes.reduce((s, n) => s + Math.hypot(n.x - (g.nodes.find((x) => x.twopiDepth === 0) || n).x, n.y - (g.nodes.find((x) => x.twopiDepth === 0) || n).y), 0) / g.nodes.length;
  assert.ok(meanR(wide.g) > meanR(r.g) * 1.2, "twopiRankSep не раздвигает слои: " + Math.round(meanR(r.g)) + " -> " + Math.round(meanR(wide.g)));
});

ok("twopiRoot: корень можно задать, и он встанет в центр", () => {
  const root = "Ch03";
  const r = runMode("twopi", { twopiRoot: root });
  const node = r.g.nodes.find((n) => n.id === root);
  const b = core.bounds(r.g.nodes);
  const c = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  const rad = (n) => Math.hypot(n.x - c.x, n.y - c.y);
  const minByType = r.g.nodes.filter((n) => n.type !== "chapter").reduce((m, n) => Math.min(m, rad(n)), Infinity);
  assert.ok(isFinite(node.x) && rad(node) <= minByType + 1, "корень " + root + " не в центре: r=" + Math.round(rad(node)) + " против минимума " + Math.round(minByType));
});

ok("пост-обработка: метки раздвигаются, лимит сдвига соблюдён, тумблеры подключены", () => {
  const g = core.buildGraph(allNotes, shippedCfg);
  core.applySizes(g.nodes, shippedCfg);
  const labeled = g.nodes.filter((n) => n.labelShown);
  // сваливаем все подписи в одну точку - классический «жгут» на плотном ядре
  labeled.forEach((n) => { n.x = 400; n.y = 400; });
  const cfg = Object.assign({}, shippedCfg, shippedCfg.layout);
  const bad0 = labelOverlaps(g, shippedCfg).bad;
  assert.ok(bad0 > 100, "на входах должно быть много наложений, а то проверка бессмысленная: " + bad0);
  const rep = core.polishNoOverlap(g, cfg, { labels: true });
  assert.strictEqual(labelOverlaps(g, shippedCfg).bad, 0, "пост-обработка не свела наложения: " + rep.passes + " проходов");
  const diag = Math.hypot(1600, 1100);
  assert.ok(isFinite(rep.maxShift) && rep.maxShift < diag, "сдвиг улетел: " + rep.maxShift);
  // тумблеры независимы: без меток круги всё равно разводятся, без кругов - наложения остаются
  const g2 = core.buildGraph(allNotes, shippedCfg);
  core.applySizes(g2.nodes, shippedCfg);
  g2.nodes.filter((n) => n.labelShown).forEach((n) => { n.x = 400; n.y = 400; });
  core.polishNoOverlap(g2, cfg, { labels: false, circles: true });
  assert.strictEqual(countOverlaps(g2.nodes), 0, "labels:false должен был развести круги, осталось " + countOverlaps(g2.nodes));
  assert.ok(labelOverlaps(g2, shippedCfg).bad > 0, "без подписей их наложения не должны были исчезнуть");
  const g3 = core.buildGraph(allNotes, shippedCfg);
  core.applySizes(g3.nodes, shippedCfg);
  g3.nodes.filter((n) => n.labelShown).forEach((n) => { n.x = 400; n.y = 400; });
  core.polishNoOverlap(g3, cfg, { labels: false, circles: false });
  assert.ok(countOverlaps(g3.nodes) > 0, "postCircles:false, а круги всё равно разъехались");
});

ok("ядро отдаёт наружу точки входа движков (их зовёт ui.js)", () => {
  ["computeLayout", "frStep", "smStep", "twopiLayout", "seedBlobs", "polishNoOverlap", "countPairsOverlap"].forEach((k) =>
    assert.strictEqual(typeof core[k], "function", k + " не экспортируется"));
  assert.ok(["fdp", "neato", "twopi", "clusters", "force"].indexOf(core.DEFAULTS.layout.mode) >= 0, "дефолтный режим странный: " + core.DEFAULTS.layout.mode);
  assert.ok(!/(^|[^a-z])radial([^a-z]|$)/.test(JSON.stringify(core.DEFAULTS.layout.mode)), "режим radial должен быть удалён");
  assert.ok(MODES.indexOf(shippedCfg.layout.mode) >= 0, "в data.json режим " + shippedCfg.layout.mode);
  // ключи движков обязаны доезжать до конфига плагина, иначе в Obsidian будет другой результат
  ["fdpIters", "neatoIters", "twopiRankSep", "clusterPull", "postLabels", "postCircles", "dispCap"].forEach((k) =>
    assert.ok(shippedCfg.layout[k] !== undefined, "в data.json нет layout." + k));
});


console.log("\n== раунд 18: ключевые фразы (этап 2) ==");

// аннотации корпуса читаем напрямую: папка намеренно исключена из обхода графа
const absNotes = walk(path.join(ROOT, "35 - Abstracts")).map((p) => ({
  path: path.relative(ROOT, p).split(path.sep).join("/"),
  text: fs.readFileSync(p, "utf8"),
}));

ok("список фраз: ; , и YAML-массив, алиас keywords:, дубли и пустоты вон", () => {
  assert.deepStrictEqual(core.parseKeywords("Compact operator; adjoint estimate"), ["Compact operator", "adjoint estimate"]);
  assert.deepStrictEqual(core.parseKeywords('["a b", "c"]'), ["a b", "c"]);
  assert.deepStrictEqual(core.parseKeywords("", "duality gap"), ["duality gap"], "алиас keywords: не принят");
  assert.deepStrictEqual(core.parseKeywords("A; a ;  A"), ["A"], "дубли (с учётом регистра) не схлопнуты");
  assert.deepStrictEqual(core.parseKeywords(""), []);
  assert.deepStrictEqual(core.parseKeywords(null, null), []);
});

ok("поиск точный: регистр не важен, часть слова и «s» на конце — не совпадение", () => {
  assert.strictEqual(core.countPhrase("Vector space here. vector SPACE again; vector spaces are common.", "vector space"), 2);
  assert.strictEqual(core.countPhrase("Compact Set", "compact   set"), 1, "пробелы не схлопнуты");
  assert.strictEqual(core.countPhrase("regularizations abound", "regularization"), 0, "нужно точное совпадение, а не подстрока");
  assert.strictEqual(core.countPhrase("(compact set) — compact set!", "compact set"), 2);
  assert.strictEqual(core.countPhrase("", "x"), 0);
});

ok("аннотация: до первого ## — преамбула (вес секции), после ## Имя — регион заголовка", () => {
  const a = core.parseAbstract(
    "---\ntype: abstract\nsection: Ch01-S01\n---\n\n# Sec Name\n\nintro vector space here\n\n## Definition: Vector Space\n\nterm vector space twice: vector space.\n"
  );
  assert.strictEqual(a.title, "Sec Name");
  assert.strictEqual(a.section, "Ch01-S01");
  assert.strictEqual(a.regions.length, 1);
  assert.strictEqual(a.regions[0].name, "Definition: Vector Space");
  assert.strictEqual(core.countPhrase(a.preamble, "vector space"), 1);
  assert.strictEqual(core.countPhrase(a.regions[0].text, "vector space"), 2, "строка ## Имя не должна считаться вхождением");
});

ok("индекс корпуса: области, цели, вес; несопоставленные ## не молчат", () => {
  const corpus = core.buildKeywordCorpus(absNotes, graph, shippedCfg);
  assert.strictEqual(corpus.stats.notes, 36, "аннотаций: " + corpus.stats.notes);
  assert.strictEqual(corpus.stats.regions, N.heading + N.section, "областей: " + corpus.stats.regions);
  assert.strictEqual(corpus.stats.unmatched, 0, "есть ## , не сопоставленные с вершиной заголовка");
  const r = corpus.lookup("duality gap");
  assert.ok(r.total > 0 && r.hits.length > 0, "фраза курса ничего не нашла");
  assert.ok(r.hits.every((h) => h.count > 0 && h.id));
  assert.strictEqual(r.total, r.hits.reduce((a, h) => a + h.count, 0));
  assert.strictEqual(corpus.lookup("  DUALITY    GAP  ").total, r.total, "нормалка фразы работает по-разному");
  assert.strictEqual(core.buildKeywordCorpus([], graph, shippedCfg).lookup("duality gap").total, 0);
});

ok("мини-корпус: вес = сумма вхождений по ВЕМУ корпусу, при равенстве глав остаётся своя", () => {
  const mini = [
    { path: "10 - Chapters/Ch01.md", text: "---\ntype: chapter\nid: Ch01\nname: \"One\"\n---\n\n# One\n" },
    { path: "20 - Sections/S1.md", text: "---\ntype: section\nid: S1\nname: \"Sec One\"\nparent: Ch01\nchapter: Ch01\n---\n\n# Sec One\n" },
    { path: "25 - Headings/H1.md", text: "---\ntype: heading\nid: H1\nname: \"Head One\"\nparent: S1\nchapter: Ch01\n---\n\n# Head One\n" },
    { path: "10 - Chapters/Ch02.md", text: "---\ntype: chapter\nid: Ch02\nname: \"Two\"\n---\n\n# Two\n" },
    { path: "20 - Sections/S2.md", text: "---\ntype: section\nid: S2\nname: \"Sec Two\"\nparent: Ch02\nchapter: Ch02\n---\n\n# Sec Two\n" },
    { path: "25 - Headings/H2.md", text: "---\ntype: heading\nid: H2\nname: \"Head Two\"\nparent: S2\nchapter: Ch02\n---\n\n# Head Two\n" },
    { path: "35 - Abstracts/A.md", text: "---\ntype: abstract\nsection: S1\n---\n\n# Sec One\n\nalpha appears once here\n\n## Head One\n\nalpha alpha alpha. not-alphanor alphaX.\n" },
    { path: "35 - Abstracts/B.md", text: "---\ntype: abstract\nsection: S2\n---\n\n# Sec Two\n\nnothing\n\n## Head Two\n\nbeta beta beta\nbeta again\n" },
  ];
  const g = core.buildGraph(mini.filter((x) => x.path.indexOf("35 -") < 0), shippedCfg);
  const corpus = core.buildKeywordCorpus(mini.filter((x) => x.path.indexOf("35 -") === 0), g, shippedCfg);
  const a = corpus.lookup("alpha");
  assert.strictEqual(a.total, 3 + 1, "alpha: преамбула не учтена или хвост слова засчитан");
  assert.strictEqual(corpus.lookup("beta").total, 4);
  const plan = core.planBlockKeywords({ keywords_en: "alpha; beta" }, corpus, "Ch01", shippedCfg);
  assert.strictEqual(plan.weight, 8, "вес: " + plan.weight);
  assert.strictEqual(plan.targets.length, 3, "цели: " + plan.targets.map((t) => t.id).join(","));
  assert.strictEqual(plan.dominant, "Ch01", "при равенстве 4:4 должна оставаться своя глава");
  const plan2 = core.planBlockKeywords({ keywords: "beta" }, corpus, "Ch01", shippedCfg);
  assert.strictEqual(plan2.dominant, "Ch02", "чужая глава с большим числом вхождений обязана перекрасить блок");
  assert.deepStrictEqual(plan2.unmatched, []);
  assert.strictEqual(core.planBlockKeywords({}, corpus, "Ch01", shippedCfg).weight, 0);
});

ok("материализация региона: идемпотентно, вне региона — байт-в-байт, снятие — чисто", () => {
  const mini = [
    { path: "35 - Abstracts/A.md", text: "---\ntype: abstract\nsection: S1\n---\n\n# Sec One\n\nalpha alpha\n" },
  ];
  const corpus = { lookup: (ph) => ({ phrase: ph, total: 2, byChapter: { Ch01: 2 }, hits: [{ id: "S1", name: "Sec One", stem: "S1 - Sec One", level: "section", chapter: "Ch01", count: 2, note: "35 - Abstracts/A.md", chapters: ["Ch01"] }] }) };
  const plan = core.planBlockKeywords({ keywords_en: "alpha" }, corpus, "Ch01", shippedCfg);
  const text = core.keywordRegionText(plan, shippedCfg);
  assert.ok(text.indexOf(core.keywordMarkers().begin) === 0, "регион обязан начинаться с маркера");
  assert.ok(/\[\[S1 - Sec One\|alpha ×2\]\]/.test(text), "ссылка на секцию или вес в псевдониме потерялись: " + text);
  assert.ok(/секция `S1`, 2 вхождения в корпусе/.test(text), "подпись строки не объясняет цель: " + text);
  // вес ребра ядро берёт из «×N» в псевдониме — три вхождения = одно ребро весом 3
  const note = "---\ntype: block\nid: B9\nname: \"b\"\nweight: 6\nkeywords_en: \"alpha\"\n---\n" + core.applyKeywordRegion("\n# B\n\nUsed together with: [[X|y]].\n", text);
  const gk = core.buildGraph([{ path: "30 - Blocks/B9.md", text: note }, { path: "20 - Sections/S1 - Sec One.md", text: "---\ntype: section\nid: S1\nname: \"Sec One\"\n---\n\n# Sec One\n" }], shippedCfg);
  const e = gk.edges.filter((x) => x.kind === "keyword")[0];
  assert.ok(e, "ядро не увидело ребро из региона");
  assert.strictEqual(e.weight, 2, "вес ребра не из псевдонима: " + e.weight);
  assert.strictEqual(gk.nodes.find((n) => n.id === "B9").kwWeight, 2);
  const body = "\n# B\n\nUsed together with: [[X|y]].\n";
  const once = core.applyKeywordRegion(body, text);
  const twice = core.applyKeywordRegion(once, text);
  assert.strictEqual(twice, once, "повторная материализация меняет файл");
  assert.strictEqual(core.splitKeywordRegion(once).outside.replace(/\s+$/g, ""), body.replace(/\s+$/g, ""), "тело вне региона поехало");
  assert.strictEqual(core.applyKeywordRegion(once, "").indexOf("keywords:"), -1, "регион не снялся целиком");
  assert.strictEqual(core.applyKeywordRegion(core.applyKeywordRegion(once, ""), ""), core.applyKeywordRegion(once, ""), "снятие не идемпотентно");
  assert.strictEqual(core.keywordRegionText(core.planBlockKeywords({}, corpus, "Ch01", shippedCfg), shippedCfg), "", "пустой список не должен производить регион");
});

ok("граф хранилища: рёбра keyword, вес = вхождения, weight: в frontmatter свежий", () => {
  const kw = graph.edges.filter((e) => e.kind === "keyword");
  assert.ok(kw.length > 500, "ключевых рёбер мало: " + kw.length);
  assert.ok(kw.every((e) => e.weight >= 1), "есть ребро без веса");
  const withW = graph.nodes.filter((n) => n.kwWeight > 0);
  assert.ok(withW.length >= 150, "вершин с весом: " + withW.length);
  assert.ok(withW.every((n) => n.type === "block"), "вес по фразам поехал не на блоки");
  withW.forEach((n) => {
    assert.strictEqual(n.sizeValue, n.kwWeight, n.id + ": размер не по весу");
    assert.strictEqual(Number(n.data.weight), n.kwWeight, n.id + ": weight: в заметке устарел (" + n.data.weight + " против " + n.kwWeight + ")");
  });
  const sumTargets = withW.reduce((a, n) => a + n.out.filter((o) => o.kind === "keyword").length, 0);
  assert.strictEqual(sumTargets, kw.length, "число materialized-ссылок не равна числу рёбер");
  const recolor = withW.filter((n) => n.kwChapter && n.chapter && n.kwChapter !== n.chapter);
  assert.ok(recolor.length > 10, "перекраса по доминирующей главе почти нет: " + recolor.length);
  recolor.forEach((n) => assert.strictEqual(n.color, graph.colorsByChapter[n.kwChapter], n.id + " окрашен не главой-лидером"));
});

ok("свой color: перекрас не отменяет, а блоки без фраз красятся своей главой", () => {
  const plain = graph.nodes.filter((n) => n.type === "block" && !n.kwWeight);
  assert.ok(plain.length > 300, "блоков без ключевых фраз стало подозрительно мало: " + plain.length);
  plain.forEach((n) => assert.strictEqual(n.kwChapter, null, n.id + " получил главу без фраз"));
  const withColor = graph.nodes.find((n) => n.colorProp && n.type === "block");
  if (withColor) assert.strictEqual(withColor.color, withColor.colorProp);
});

ok("тумблер keywordLinks:false — ключевых рёбер нет, размер снова по ссылкам", () => {
  const off = core.buildGraph(allNotes, Object.assign({}, shippedCfg, { keywordLinks: false }));
  assert.strictEqual(off.edges.filter((e) => e.kind === "keyword").length, 0, "рубильник не выключил рёбра");
  off.nodes.forEach((n) => {
    assert.strictEqual(n.kwWeight, 0, n.id + ": вес остался при выключенном рубильнике");
    assert.strictEqual(n.sizeValue, n.degree, n.id + ": размер не вернулся к ссылкам");
    assert.strictEqual(n.kwChapter, null);
  });
  const id = graph.nodes.filter((n) => n.kwWeight > 0)[0].id;
  const own = off.nodes.find((n) => n.id === id);
  assert.strictEqual(own.color, off.colorsByChapter[own.chapter], "цвет не вернулся к своей главе");
  assert.ok(core.buildGraph(allNotes, Object.assign({}, shippedCfg, { keywordLinks: false })).stats.keywordNodes === 0);
});

ok("JSON-выгрузка несёт список фраз, вес, главу-лидера и размер", () => {
  const n = graph.nodes.filter((x) => x.kwWeight > 0 && x.kwChapter)[0];
  const j = core.toGraphJson(graph, { stamp: "2026-09-09 00:00" });
  const out = j.nodes.find((x) => x.id === n.id);
  assert.deepStrictEqual(out.keywords, n.keywords);
  assert.strictEqual(out.keyword_weight, n.kwWeight);
  assert.strictEqual(out.kw_chapter, n.kwChapter);
  assert.strictEqual(out.size_value, n.kwWeight);
  assert.strictEqual(j.settings.keywordLinks, true);
  assert.strictEqual(j.settings.keywordFolder, "35 - Abstracts");
  assert.ok(j.stats.keywordNodes >= 150 && j.stats.maxWeight >= 1);
  const plain = j.nodes.find((x) => x.id === graph.nodes.filter((y) => y.type === "block" && !y.kwWeight)[0].id);
  assert.deepStrictEqual(plain.keywords, []);
  assert.strictEqual(plain.keyword_weight, 0);
  assert.strictEqual(plain.size_value, plain.in);
});

console.log("\n" + pass + " проверок пройдено, exitCode=" + (process.exitCode || 0));
