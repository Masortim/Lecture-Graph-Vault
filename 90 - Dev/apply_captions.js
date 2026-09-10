/* Прописывает caption: в frontmatter заметок-вершин (главы и секции) по dev/captions.json.
   Правится только frontmatter: тело заметки, формулы и ссылки не трогаются.
   Идемпотентно: если значение уже стоит — файл не перезаписывается. */
const fs = require("fs");
const path = require("path");
const core = require("./src/graph-core.js");

// корень хранилища: <dev>/.. (инструментарий внутри) или <dev>/../Lecture-Graph-Vault
const ROOT = require("./vault-root.js")(__dirname);
const list = JSON.parse(fs.readFileSync(path.join(__dirname, "captions.json"), "utf8"));
const key = "caption";
let changed = 0, skipped = 0, missing = [];

for (const it of list) {
  const file = path.join(ROOT, ...it.path.split("/"));
  if (!fs.existsSync(file)) {
    missing.push(it.path);
    continue;
  }
  const data = fs.readFileSync(file, "utf8");
  const fm = core.parseFrontmatter(data);
  const want = "[[" + it.caption + "]]";
  if (String(fm.data[key] || "").trim() === want) {
    skipped++;
    continue;
  }
  const patch = {};
  patch[key] = want;
  fs.writeFileSync(file, core.setFrontmatterValues(data, patch));
  changed++;
}
console.log("caption:: проставлен в", changed, "заметках · уже было:", skipped);
if (missing.length) {
  console.log("НЕ НАЙДЕНО ЗАМЕТОК ВЕРШИН:", missing.length, missing.slice(0, 5).join(", "));
  process.exit(1);
}
