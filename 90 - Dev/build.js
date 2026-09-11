/* Собирает .obsidian/plugins/lecture-graph/{main.js,manifest.json,styles.css} */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SRC = __dirname;
// Dev-исходники теперь лежат внутри самого vault, поэтому результат собираем
// рядом с ними в корневой .obsidian, а не в несуществующую вложенную копию vault.
const OUT = path.resolve(__dirname, "..", ".obsidian", "plugins", "lecture-graph");

const core = fs.readFileSync(path.join(SRC, "src", "graph-core.js"), "utf8");
const ui = fs.readFileSync(path.join(SRC, "src", "ui.js"), "utf8");

if (!ui.includes('require("graph-core")')) throw new Error("ui.js: не найден require(\"graph-core\")");
const uiPatched = ui.replace('const core = require("graph-core");', "const core = __LG_CORE__;");

// Версия плагина — одно место на весь репозиторий: баннер сборки, manifest.json и
// документация (write_docs.py читает её отсюда же).
const VERSION = "1.11.0";

const banner = `/* lecture-graph v${VERSION} — автоген: src/graph-core.js + src/ui.js, не редактировать напрямую. */\n`;
const bundle =
  banner +
  `var __LG_CORE__ = (function () {\n  var module = { exports: {} };\n  var exports = module.exports;\n` +
  core +
  `\n  return module.exports;\n})();\n` +
  uiPatched +
  `\nmodule.exports = LectureGraphPlugin;\nmodule.exports.default = LectureGraphPlugin;\n`;

fs.mkdirSync(OUT, { recursive: true });
const mainPath = path.join(OUT, "main.js");
// если сборка байт-в-байт та же — не пишем: иначе mtime main.js обгоняет превью, и
// dev/finalize.py правдоподобно ругается «превью устарели» там, где не менялось ничего
if (!fs.existsSync(mainPath) || fs.readFileSync(mainPath, "utf8") !== bundle) {
  fs.writeFileSync(mainPath, bundle);
}
execFileSync(process.execPath, ["--check", mainPath]);

const manifest = {
  id: "lecture-graph",
  name: "Lecture Graph",
  version: VERSION,
  minAppVersion: "1.5.0",
  description: "Interactive graph of lecture structure: chapters, sections, headings and referable text blocks. Layout engines (fdp / neato / twopi / chapter clusters), two-line labels (EN + 中文) that never overlap, vertex size = inbound references, per-chapter colors, course index note generated from the graph. New nodes are created by right-clicking the canvas (EN + 中文 name, keyword tags) and are auto-linked to related topics found in the abstract corpus. Manual edges: select the first node with a left click, then Ctrl+left-click the second — the link arc is drawn automatically. Nodes are deleted from the graph too: select a vertex and press Delete (or use the toolbar button / context menu) — incoming links are stripped from other notes, children are re-parented, the note goes to the Obsidian trash, and Undo last vertex deletion restores everything byte-for-byte. Duplicate vertices are merged intelligently (fuzzy titles, translations, content, keywords and shared links; the same topic in different chapters or under different numbers is never auto-merged) — per-vertex or all at once from the empty-canvas menu, with a preview window and undo.",
  author: "Arena agent",
  authorUrl: "",
  isDesktopOnly: false,
};
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
if (fs.existsSync(path.join(SRC, "src", "styles.css"))) {
  fs.copyFileSync(path.join(SRC, "src", "styles.css"), path.join(OUT, "styles.css"));
}
const bytes = fs.statSync(mainPath).size;
console.log("built " + path.relative(path.resolve(SRC, ".."), mainPath) + "  " + (bytes / 1024).toFixed(1) + " KiB, syntax OK");
