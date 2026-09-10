/*
 * Предпросмотр плагина в браузере БЕЗ Obsidian: отдаёт index.html, собранный на лету
 * bundle.js (obsidian-stub + src/graph-core.js + src/ui.js) и всё хранилище одним
 * JSON. Ничего не пишет на диск — правки в src/ видны после перезапуска сервера.
 *
 *   node "90 - Dev/preview/server.js" [порт]
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const DEV = path.resolve(__dirname, "..");
const ROOT = path.resolve(DEV, "..");
const PORT = Number(process.env.PORT || process.argv[2] || 3000);

/* ---------- бандл: тот же приём, что в build.js, плюс стаб Obsidian ---------- */

function bundle() {
  const core = fs.readFileSync(path.join(DEV, "src", "graph-core.js"), "utf8");
  const uiSrc = fs.readFileSync(path.join(DEV, "src", "ui.js"), "utf8");
  const shim = fs.readFileSync(path.join(__dirname, "fs-shim.js"), "utf8");
  const stub = fs.readFileSync(path.join(DEV, "obsidian-stub.js"), "utf8").replace(
    /^const fs = require\("fs"\);\s*const path = require\("path"\);/m,
    shim
  );
  if (stub.indexOf("__LG_PREVIEW__") < 0) throw new Error("fs-shim не подставлен в obsidian-stub.js");

  const ui = uiSrc
    .replace('const obsidian = require("obsidian");', "const obsidian = __LG_OBSIDIAN__;")
    .replace('const core = require("graph-core");', "const core = __LG_CORE__;");
  if (ui.indexOf("__LG_OBSIDIAN__") < 0 || ui.indexOf("__LG_CORE__") < 0) throw new Error("ui.js: require() не заменён");

  const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
  return [
    "/* автоген preview/server.js: obsidian-stub + src/graph-core.js + src/ui.js + preview/app.js */",
    "var __LG_OBSIDIAN__ = (function () {",
    "  var module = { exports: {} }; var exports = module.exports;",
    stub,
    "  return module.exports;",
    "})();",
    "var __LG_CORE__ = (function () {",
    "  var module = { exports: {} }; var exports = module.exports;",
    core,
    "  return module.exports;",
    "})();",
    "var LectureGraphPlugin = (function () {",
    "  var module = { exports: {} }; var exports = module.exports;",
    '  var require = function (n) { throw new Error("preview: неожиданный require(\\"" + n + "\\")"); };',
    "  var __LG_UNUSED__ = require;",
    ui,
    "  return module.exports;",
    "})();",
    app,
  ].join("\n");
}

/* ---------- хранилище: md + json, без .git и node_modules ---------- */

function vaultFiles() {
  const files = {};
  const walk = (dir, rel) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === "node_modules" || ent.name === ".git") continue;
      const abs = path.join(dir, ent.name);
      const r = rel ? rel + "/" + ent.name : ent.name;
      if (ent.isDirectory()) walk(abs, r);
      else if (/\.(md|json)$/i.test(ent.name)) {
        try { files[r] = fs.readFileSync(abs, "utf8"); } catch (e) { /* бинарный/права — пропускаем */ }
      }
    }
  };
  walk(ROOT, "");
  return files;
}

const server = http.createServer((req, res) => {
  const url = String(req.url || "/").split("?")[0];
  const send = (body, type) => {
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    res.end(body);
  };
  try {
    if (url === "/" || url === "/index.html") {
      return send(fs.readFileSync(path.join(__dirname, "index.html"), "utf8"), "text/html; charset=utf-8");
    }
    if (url === "/bundle.js") return send(bundle(), "application/javascript; charset=utf-8");
    if (url === "/styles.css") {
      return send(fs.readFileSync(path.join(DEV, "src", "styles.css"), "utf8"), "text/css; charset=utf-8");
    }
    if (url === "/vault.json") {
      return send(JSON.stringify({ files: vaultFiles() }), "application/json; charset=utf-8");
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("404 " + url);
  } catch (e) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("500: " + (e && e.stack ? e.stack : e));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("lecture-graph preview: http://0.0.0.0:" + PORT + "/");
});
