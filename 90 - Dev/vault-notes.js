/* Единый источник правила «какие заметки попадают в граф» для node-скриптов
   (write_index.js, write_stats.js, test-core.js). Плагин повторяет его в collectNotes()
   (ui.js): папки из настройки за минусом исключённых. Тест test-view сверяет оба набора,
   так что расхождение не пройдёт. */
const fs = require("fs");
const path = require("path");
const core = require("./src/graph-core.js");

const DIRS = ["10 - Chapters", "20 - Sections", "25 - Headings", "30 - Blocks"];

function walk(dir, acc) {
  acc = acc || [];
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".md")) acc.push(p);
  }
  return acc;
}

function readNote(root, rel) {
  const text = fs.readFileSync(path.join(root, rel), "utf8");
  const fm = core.parseFrontmatter(text);
  return { path: rel, frontmatter: fm.data, body: fm.body };
}

/**
 * Заметки для графа. settings — то, что лежит в .obsidian/plugins/lecture-graph/data.json
 * (нужны folders, excludeFolders, typeKey).
 */
function collect(root, settings) {
  const st = settings || {};
  const folders = String(st.folders || "").split(",").map((x) => x.trim()).filter(Boolean);
  const excl = String(st.excludeFolders || "").split(",").map((x) => x.trim()).filter(Boolean);
  const dirs = folders.length ? folders : DIRS;
  const rel = [];
  for (const d of dirs) {
    for (const abs of walk(path.join(root, d))) {
      const r = path.relative(root, abs).split(path.sep).join("/");
      rel.push(r);
    }
  }
  const keep = rel
    .filter((r) => !excl.some((d) => r.startsWith(d.endsWith("/") ? d : d + "/")))
    .map((r) => readNote(root, r));
  const typed = keep.filter((n) => core.TYPES.indexOf(String((n.frontmatter || {})[st.typeKey || "type"] || "").trim().toLowerCase()) >= 0);
  return { notes: typed };
}

module.exports = { collect, readNote, walk, DIRS };
