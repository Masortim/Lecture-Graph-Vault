/* Запуск плагина lecture-graph в браузере — то же, что test-view.js делает в jsdom:
   стаб API Obsidian + реальное хранилище (карта файлов от server.js). Никакой
   логики графа здесь нет: рисует собранный из src/ ui.js. */
window.__LG_BOOT__ = function () {
  const O = window.__LG_OBSIDIAN__;
  if (!O) throw new Error("стаб Obsidian не загружен");
  O.installDomExtensions(window);

  // Сообщение у вершины рендерим текст заметки: без MarkdownRenderer пузырёк был бы
  // пустым. Мини-рендер: абзацы, жирный/курсив/код, и wiki-ссылки — обычным текстом.
  O.MarkdownRenderer = {
    render: function (app, md, el, notePath) {
      const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      String(md || "").split(/\n{2,}/).forEach(function (block) {
        if (!block.trim()) return;
        const p = document.createElement("p");
        let html = esc(block)
          .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
          .replace(/\[\[([^\]]+)\]\]/g, "$1")
          .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
          .replace(/`([^`]+)`/g, "<code>$1</code>")
          .replace(/\n/g, "<br>");
        p.innerHTML = html;
        el.appendChild(p);
      });
      void app;
      void notePath;
    },
  };

  const app = {};
  app.vault = new O.Vault("");
  app.metadataCache = new O.MetadataCache(app.vault);
  app.workspace = new O.Workspace(app);
  app.keymap = { pushScope() {}, popScope() {} };
  app.scope = new O.Scope();
  app.fileManager = {
    getMarkdownLink: (f) => "[[" + f.basename + "]]",
    generateMarkdownLink: (f) => "[[" + f.basename + "]]",
  };
  app.configDir = ".obsidian";
  const files = (window.__LG_PREVIEW__ && window.__LG_PREVIEW__.files) || {};
  const manifest = JSON.parse(files[".obsidian/plugins/lecture-graph/manifest.json"] || "{}");

  const plugin = new window.LectureGraphPlugin(app, manifest);
  window.__LG_PLUGIN__ = plugin;
  const out = document.getElementById("boot");
  return plugin.onload().then(function () {
    return plugin.activateView();
  }).then(function (leaf) {
    const mount = document.getElementById("app");
    mount.textContent = "";
    mount.appendChild(leaf.view.containerEl);
    window.__LG_VIEW__ = leaf.view;
    if (out) out.parentNode.removeChild(out);
    // jsdom/браузер: размеры сцены известны только после раскладки
    setTimeout(function () { leaf.view.fit(); }, 60);
  }).catch(function (e) {
    if (out) out.textContent = "не удалось запустить плагин: " + (e && e.stack ? e.stack : e);
    throw e;
  });
};
