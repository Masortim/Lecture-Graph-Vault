/* Генерирует Course Index.md в корне хранилища тем же кодом, что и команда плагина
   (core.toIndexMarkdown) — чтобы оглавление в поставке и оглавление после `Rebuild` совпадали. */
const fs = require("fs");
const path = require("path");
const core = require("./src/graph-core.js");
const vaultNotes = require("./vault-notes.js");
const ROOT = path.resolve(__dirname, "..", "Lecture-Graph-Vault");
const normRel = (p) => { const x = String(p || "").trim().replace(/^\.\//, "").replace(/\\/g, "/"); return !x ? "Course Index.md" : (/\.(md|markdown)$/i.test(x) ? x : x + ".md"); };

const settingsPath = path.join(ROOT, ".obsidian", "plugins", "lecture-graph", "data.json");
const settings = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, "utf8")) : {};
const notes = vaultNotes.collect(ROOT, settings).notes;
const graph = core.buildGraph(notes, settings);
const exists = (stem) => fs.existsSync(path.join(ROOT, "00 - Start Here", stem + ".md"));
// LG_STAMP нужен тестам: с фиксированной меткой вывод побайтово воспроизводим
const stamp = process.env.LG_STAMP || new Date().toISOString().slice(0, 16).replace("T", " ");
const md = core.toIndexMarkdown(graph, { stamp, resolve: exists, graphDoc: settings.indexGraphDoc });
const OUT = normRel(settings.indexNote); // тот же путь, что у плагина: настройка indexNote
const out = path.join(ROOT, OUT);
fs.mkdirSync(path.dirname(out), { recursive: true });
const prev = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
if (prev === md) console.log(OUT + ": без изменений (" + md.split("\n").length + " строк)");
else fs.writeFileSync(out, md), console.log(OUT + ": " + md.split("\n").length + " строк, " + (md.length / 1024).toFixed(1) + " KiB, вершин " + graph.stats.nodes);
