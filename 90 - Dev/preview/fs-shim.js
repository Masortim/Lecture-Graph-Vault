/* Браузерная замена `require("fs")` / `require("path")` для obsidian-stub.js.
   Виртуальная ФС поверх window.__LG_PREVIEW__.files — карты «путь -> текст»,
   которую отдаёт preview/server.js. Пишется в память: хранилище в браузере не трогаем. */
const path = (function () {
  const norm = (p) => String(p).replace(/\\/g, "/").replace(/\/+$/, "").replace(/^\.\//, "");
  function extname(p) {
    const s = norm(p).split("/").pop() || "";
    const i = s.lastIndexOf(".");
    return i <= 0 ? "" : s.slice(i);
  }
  function basename(p, ext) {
    let s = norm(p).split("/").pop() || "";
    if (ext) {
      const e = String(ext).replace(/^\./, "");
      if (s.length > e.length && s.slice(-(e.length + 1)) === "." + e) s = s.slice(0, -(e.length + 1));
    }
    return s;
  }
  function dirname(p) {
    const a = norm(p).split("/");
    a.pop();
    return a.join("/") || ".";
  }
  function join() {
    const out = [];
    Array.prototype.forEach.call(arguments, function (x) {
      String(x).split(/[\\/]/).forEach(function (seg) {
        if (!seg || seg === ".") return;
        if (seg === "..") out.pop();
        else out.push(seg);
      });
    });
    return out.join("/");
  }
  const api = { sep: "/", extname: extname, basename: basename, dirname: dirname, join: join, normalize: norm, relative: function () { return ""; } };
  api.posix = api;
  api.win32 = api;
  return api;
})();

const fs = (function () {
  const files = function () {
    return (window.__LG_PREVIEW__ && window.__LG_PREVIEW__.files) || {};
  };
  const norm = (p) => String(p).replace(/\\/g, "/").replace(/\/+$/, "").replace(/^\.\//, "");
  const dirs = function () {
    const s = { "": true };
    Object.keys(files()).forEach(function (p) {
      const a = p.split("/");
      a.pop();
      let c = "";
      s[c] = true;
      a.forEach(function (seg) { c = c ? c + "/" + seg : seg; s[c] = true; });
    });
    return s;
  };
  return {
    readFileSync: function (p) {
      const c = files()[norm(p)];
      if (c == null) {
        const e = new Error("ENOENT: " + p);
        e.code = "ENOENT";
        throw e;
      }
      return c;
    },
    writeFileSync: function (p, d) { files()[norm(p)] = String(d); },
    existsSync: function (p) {
      const n = norm(p);
      return Object.prototype.hasOwnProperty.call(files(), n) || dirs()[n] === true;
    },
    mkdirSync: function () {},
    rmSync: function () {},
    statSync: function (p) {
      const n = norm(p);
      const isDir = dirs()[n] === true;
      return {
        isDirectory: function () { return isDir; },
        isFile: function () { return !isDir && Object.prototype.hasOwnProperty.call(files(), n); },
      };
    },
    readdirSync: function (p) {
      const d = norm(p);
      const seen = {};
      const out = [];
      const add = (name, isDir) => {
        if (!name || seen[name]) return;
        seen[name] = true;
        out.push({ name: name, isDirectory: function () { return isDir; }, isFile: function () { return !isDir; } });
      };
      Object.keys(files()).forEach(function (f) {
        if (d && f.indexOf(d + "/") !== 0) return;
        const rest = d ? f.slice(d.length + 1) : f;
        const parts = rest.split("/");
        add(parts[0], parts.length > 1);
      });
      Object.keys(dirs()).forEach(function (x) {
        if (!x || !d || x.indexOf(d + "/") !== 0) return;
        add(x.slice(d.length + 1).split("/")[0], true);
      });
      return out;
    },
  };
})();
