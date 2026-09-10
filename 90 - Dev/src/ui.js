"use strict";
/*
 * lecture-graph — плагин Obsidian: интерактивный граф лекций.
 *   вершины: главы / секции / заголовки / блоки (заметки с frontmatter type:*)
 *   подпись: 2 строки — name (EN) и name_zh (перевод), редактируются на графе
 *   размер вершины = число ссылок на неё (для блоков с ключевыми фразами — число вхождений)
 * main.js собирается скриптом build.js: ядро graph-core.js инлайнится сюда.
 */
const obsidian = require("obsidian");
const core = require("graph-core");

const VIEW_TYPE = "lecture-graph-view";
const PLUGIN_ID = "lecture-graph";
const TYPES = core.TYPES;
const TYPE_LABEL = {
  chapter: "Chapter",
  section: "Section",
  heading: "Heading",
  block: "Block", // без этого чекбокс Block в панели типов оставался без подписи
};

/* ── «читаемость при любом зуме» ────────────────────────────────────────────────
   Граф из тысячи вершин после Fit уезжает на k≈0.07, и модельные 13 px радиуса
   превращаются в 0.9 px, а кегль 11 px — в 0.8 px: ни вершин, ни подписей не
   разобрать. Кегль подписи на экране поэтому держат постоянным (labelComp), круг
   растёт мягко (NODE_GROW_POW < 1 — крупные вершины остаются крупнее), а подписи,
   которым не хватило места на экране, не рисуются вовсе (planLabels) — наездов нет
   ни на одном зуме. Всё это только про отрисовку: модель (n.r, n.font, n.lw) и
   экспорт SVG остаются в модельных координатах. */
const MIN_NODE_PX = 2.2; // вершина не мельче этого радиуса на экране
const NODE_GROW_POW = 0.55; // 0 = круг модельный, 1 = круг постоянного размера на экране
const LABEL_PAD_PX = 3; // зазор между соседними метками на экране
const LABEL_GRID_CELL = 96; // ячейка сетки для проверки наездов (экранные px)
const LABEL_OFF_MARGIN = 24; // метку за пределами экрана на таком расстоянии не считаем
// на сколько кеглей можно опустить подпись, если под вершиной место уже занято
const LABEL_SHIFTS = [0, 0.85, 1.8, 3.1];
const ZOOM_MIN = 0.02;
const ZOOM_MAX = 24;
const ZOOM_STEP = 1.3; // шаг кнопок «+» и «−»
const FONT_STEP = 1.15; // шаг кнопок A−/A+ (множитель кегля)

const DEFAULT_SETTINGS = {
  folders: "",
  excludeFolders: "40 - Templates,90 - Exports",
  nameKey: "name",
  nameZhKey: "name_zh",
  typeKey: "type",
  minRadius: 6,
  maxRadius: 34,
  degreeGamma: 0.55,
  degreeBase: "min", // min | zero
  sizeMode: "hybrid", // global | byType | hybrid
  labelFontSize: 10,
  labelFontMin: 9,
  labelFontMax: 19,
  labelFontBySize: true,
  // множитель кегля: им работают кнопки A−/A+ на панели (шаг ×1.15). Кегль на экране
  // от зума не зависит, поэтому множитель виден сразу, а не «на сотую пикселя»
  labelScale: 1,
  countStructural: false,
  includeInlineAnchors: true,
  // Оглавление курса лежит в КОРНЕ хранилища: папки из `folders` его не видят, поэтому в граф
  // оно не попадает ни при каких настройках сканирования (см. команду write-index и меню «Проводника»)
  indexNote: "Course Index.md",
  indexGraphDoc: "02 Graph — как читать и править",
  labelMode: "size", // always | size | hover | none
  labelRadiusThreshold: 11,
  // размеры и подписи по уровням: глава/секция не должны превращаться в точку
  sizeFloor: { chapter: 16, section: 13, heading: 10 },
  labelAlwaysFor: { chapter: true, section: true },
  labelCharsFor: { chapter: 30, section: 24, heading: 12, block: 12 },
  labelWidthFor: { chapter: 520, section: 380, heading: 190, block: 170 },
  labelForTypes: { chapter: true, section: true, heading: true, block: false },
  // свойства заметки, которыми пользователь правит вершину
  sizeKey: "size",
  colorKey: "color",
  captionKey: "caption",
  captionFolder: "45 - Captions",
  captionChapterTemplate: "40 - Templates/T Caption Chapter.md",
  captionSectionTemplate: "40 - Templates/T Caption Section.md",
  captionHeadingTemplate: "40 - Templates/T Caption Heading.md",
  captionBlockTemplate: "40 - Templates/T Caption Block.md",
  // ——— ключевые фразы (этап 2): список `keywords_en:` в свойствах блока -> точный поиск по
  // аннотациям корпуса; найденные вхождения дают ссылки (материализуются в заметку блока),
  // их число — вес вершины, а глава с максимумом вхождений — её цвет
  keywordLinks: true, // считать рёбра (и размер) по ключевым фразам
  keywordFolder: "35 - Abstracts", // папка аннотаций; из обхода графа она исключена
  curvature: 0.24, // рёбра дугами; 0 — прямые
  chapterColors: true, // цвет главы наследуют её секции/заголовки/блоки
  chapterPalette: ["#f2b33d", "#4a9eda", "#59c98a", "#c07ad8", "#ff7a6b", "#5fd3c4", "#f58fc2", "#b9cf5e", "#9a8cff", "#f2c14e"],
  autoRefresh: true,
  maxNodes: 4000,
  exportFolder: "90 - Exports",
  colors: {
    chapter: "#f2b33d",
    section: "#4a9eda",
    heading: "#59c98a",
  },
  layout: {
    // fdp | neato | twopi | clusters (сектора глав, рёбра без пересечений) | force
    mode: "fdp",
    linkDistance: 46,
    repel: 900,
    gravity: 0.045,
    friction: 0.82,
    collide: true,
    radius: 900,
    iterations: 700,
    anchorStrength: 0.34,
    packLabels: true,
    // --- движки раскладки (fdp / neato / twopi) ---
    fdpIters: 260,
    frK: 1,
    frRepel: 1,
    frAttract: 1,
    frStruct: 1.9,
    frTemp: 0.55,
    neatoIters: 80,
    neatoScale: 2.2,
    neatoRepel: 1.6,
    twopiRoot: "",
    twopiRankSep: 1,
    clusterPull: 0.035,
    postLabels: true,
    postCircles: true,
    dispCap: 0.5,
    packPasses: 70,
    clusterPad: 10,
    clusterGap: 0.07,
    clusterFill: 0.94,
  },
  filters: {
    types: { chapter: true, section: true, heading: true, block: true },
    minDegree: 0,
    chapter: "",
    hidePlaceholders: false,
  },
};

const DEFAULT_CAPTION_BODY = {
  chapter:
    "---\ntype: caption\n---\n\n\u0427\u0442\u043e \u044d\u0442\u0430 \u0433\u043b\u0430\u0432\u0430 \u0434\u0430\u0451\u0442 \u0438 \u043a\u043e\u0433\u0434\u0430 \u043a \u043d\u0435\u0439 \u0432\u0435\u0440\u043d\u0443\u0442\u044c\u0441\u044f.\n\n\u041e\u0434\u0438\u043d-\u0434\u0432\u0430 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u044f \u2014 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435 \u043d\u0443\u0436\u043d\u043e: \u044d\u0442\u043e \u043f\u043e\u0434\u043f\u0438\u0441\u044c \u043f\u043e\u0434 \u0433\u0440\u0430\u0444\u043e\u043c, \u0430 \u043d\u0435 \u043a\u043e\u043d\u0441\u043f\u0435\u043a\u0442.\n",
  section:
    "---\ntype: caption\n---\n\n\u0417\u0430\u0447\u0435\u043c \u043d\u0443\u0436\u043d\u0430 \u044d\u0442\u0430 \u0441\u0435\u043a\u0446\u0438\u044f \u0438 \u0447\u0442\u043e \u0432 \u043d\u0435\u0439 \u0433\u043b\u0430\u0432\u043d\u043e\u0435.\n",
  heading:
    "---\ntype: caption\n---\n\nО чём этот заголовок: одно предложение, уместна ссылка на блок.\n",
  block:
    "---\ntype: caption\n---\n\nЗачем в курсе этот фрагмент: на что он опирается и где дальше используется.\n",
};

/* Сообщение положено любой вершине графа, поэтому у каждого типа свой шаблон. */
var CAPTION_TPL_KEY = {
  chapter: "captionChapterTemplate",
  section: "captionSectionTemplate",
  heading: "captionHeadingTemplate",
  block: "captionBlockTemplate",
};

/* ------------------------------------------------------------------ utils */

function svgEl(name, attrs) {
  var el = document.createElementNS("http://www.w3.org/2000/svg", name);
  if (attrs) {
    Object.keys(attrs).forEach(function (k) {
      if (attrs[k] !== null && attrs[k] !== undefined) el.setAttribute(k, String(attrs[k]));
    });
  }
  return el;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function num(v, fallback) {
  var n = Number(v);
  return isFinite(n) ? n : fallback;
}

function buildOptions(settings) {
  var opts = {
    nameKey: settings.nameKey,
    nameZhKey: settings.nameZhKey,
    typeKey: settings.typeKey,
    minRadius: num(settings.minRadius, core.DEFAULTS.minRadius),
    maxRadius: num(settings.maxRadius, core.DEFAULTS.maxRadius),
    degreeGamma: num(settings.degreeGamma, core.DEFAULTS.degreeGamma),
    degreeBase: settings.degreeBase === "zero" ? "zero" : "min",
    sizeMode: ["global", "byType", "hybrid"].indexOf(settings.sizeMode) >= 0 ? settings.sizeMode : "hybrid",
    labelFontSize: num(settings.labelFontSize, core.DEFAULTS.labelFontSize),
    labelFontMin: num(settings.labelFontMin, core.DEFAULTS.labelFontMin),
    labelFontMax: num(settings.labelFontMax, core.DEFAULTS.labelFontMax),
    labelFontBySize: settings.labelFontBySize !== false,
    labelScale: num(settings.labelScale, 1) > 0 ? num(settings.labelScale, 1) : 1,
    countStructural: !!settings.countStructural,
    includeInlineAnchors: !!settings.includeInlineAnchors,
    // выключено — и материализованные ссылки корпуса не идут в граф, и размер снова по ссылкам
    keywordLinks: settings.keywordLinks !== false,
    keywordFolder: String(settings.keywordFolder || core.DEFAULTS.keywordFolder),
    colors: Object.assign({}, DEFAULT_SETTINGS.colors, settings.colors || {}),
    layout: Object.assign({}, DEFAULT_SETTINGS.layout, settings.layout || {}),
  };
  // ключи, которые ядро читает напрямую; добавляем только то, что реально настроено
  ["labelMode", "labelRadiusThreshold", "labelScale", "sizeFloor", "labelAlwaysFor", "labelCharsFor", "labelWidthFor", "labelForTypes",
    "sizeKey", "colorKey", "captionKey", "curvature", "chapterColors", "chapterPalette",
    "keywordsKey", "weightKey", "sectionKey"].forEach(function (k) {
    if (settings[k] !== undefined && settings[k] !== null) opts[k] = settings[k];
  });
  return opts;
}

function subsetGraph(graph, visibleSet) {
  var nodes = graph.nodes.filter(function (n) {
    return visibleSet[n.id];
  });
  var edges = graph.edges.filter(function (e) {
    return visibleSet[e.source] && visibleSet[e.target];
  });
  return { nodes: nodes, edges: edges, stats: graph.stats, config: graph.config };
}

/* ------------------------------------------------------------------ view */

var LAYOUT_MODES = [
  ["fdp", "fdp - пружины (Fruchterman-Reingold)"],
  ["neato", "neato - стресс-мажоризация"],
  ["twopi", "twopi - радиальные слои от корня"],
  ["clusters", "кластеры по главам (без пересечений рёбер)"],
  ["force", "чистая физика (живая сила)"],
];

class LectureGraphView extends obsidian.ItemView {
  constructor(leaf) {
    super(leaf);
    this._plugin = null;
    this.graph = null;
    this.visible = {};
    this.byId = {};
    this.alpha = 0;
    this.frozen = false;
    this.selected = null;
    this.neigh = null;
    this.view = { k: 1, x: 0, y: 0 };
    this.nodeEls = {};
    this.raf = null;
    // Полный путь из тысяч рёбер во время drag обновляем с ограничением частоты;
    // выделенные рёбра остаются живыми в отдельном лёгком слое.
    this.dragEdgesTimer = null;
    this._nn = null; // расстояние до ближайшей вершины: потолок «экранного» радиуса
    this._nnDirty = true;
  }

  /** Плагин: привязывается в registerView, иначе ищем в реестре плагинов. */
  get plugin() {
    if (!this._plugin) {
      var reg = this.app && this.app.plugins && this.app.plugins.plugins;
      this._plugin = (reg && reg[PLUGIN_ID]) || null;
    }
    return this._plugin;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return "Lecture graph";
  }

  getIcon() {
    return "git-fork";
  }

  async onOpen() {
    this.buildChrome();
    // Первый open построит пустой кэш, повторный — мгновенно примет уже готовый
    // снимок. Явная кнопка Rebuild по-прежнему передаёт force:true.
    await this.refresh(false);
    this.registerDomEvent(this.svg, "pointerdown", (ev) => this.onPointerDown(ev));
    this.registerDomEvent(window, "pointermove", (ev) => this.onPointerMove(ev));
    this.registerDomEvent(window, "pointerup", (ev) => this.onPointerUp(ev));
    this.registerDomEvent(this.svg, "wheel", (ev) => this.onWheel(ev), { passive: false });
    this.registerDomEvent(this.svg, "dblclick", (ev) => this.onDblClick(ev));
    this.registerDomEvent(this.svg, "contextmenu", (ev) => this.onContextMenu(ev));
    this.registerDomEvent(this.svg, "pointerover", (ev) => this.onHover(ev));
    this.addAction("download", "Export graph as SVG", () => this.exportSVG());
    this.addAction("refresh-cw", "Rebuild graph", () => this.refresh(true));
    this.addAction("maximize", "Fit graph to view", () => this.fit());
    this.addAction("expand", "Full screen (Esc — выйти)", () => this.toggleFullscreen());
    this.registerDomEvent(this.svg, "pointerout", (ev) => this.onHover(null));
    this.registerDomEvent(window, "resize", () => this.fit());
    // пользователь мог выйти из полноэкранного режима клавишей браузера — синхронизируемся
    this.registerDomEvent(document, "fullscreenchange", () => {
      var on = !!document.fullscreenElement;
      if (on !== this.fullscreen) this.toggleFullscreen(on);
    });
    this.registerDomEvent(window, "keydown", (ev) => {
      // «+»/«−» и Ctrl+колесо — тот же зум, что у кнопок на холсте
      if (ev.key === "+" || ev.key === "=" || ev.key === "-") {
        if (ev.target && /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName || "")) return;
        ev.preventDefault();
        this.zoomBy(ev.key === "-" ? 1 / ZOOM_STEP : ZOOM_STEP);
        return;
      }
      if (ev.key !== "Escape") return;
      if (this.fullscreen) {
        ev.preventDefault();
        this.toggleFullscreen();
      } else if (this.selected) {
        // Esc при открытой карточке (и не в полноэкранном режиме) — просто закрыть её
        ev.preventDefault();
        this.select(null);
      }
    });
    this.updateStatus();
  }

  onClose() {
    this.stopLoop();
    clearTimeout(this.cardTimer);
    clearTimeout(this.dragEdgesTimer);
    this.dragEdgesTimer = null;
    return Promise.resolve();
  }

  /* -------------------------------------------------- chrome */

  buildChrome() {
    var root = this.contentEl.createDiv({ cls: "lg-root" });
    this.rootEl = root;

    var bar = root.createDiv({ cls: "lg-bar" });
    var group = function (label) {
      var g = bar.createDiv({ cls: "lg-bar-group" });
      if (label) g.createDiv({ cls: "lg-bar-title", text: label });
      return g;
    };

    var gView = group("");
    this.fullBtn = this.mkButton(gView, "⛶ Просмотреть граф на полном экране", () => this.toggleFullscreen());
    this.mkButton(gView, "⟳ Rebuild", () => this.refresh(true));
    this.mkButton(gView, "⤢ Fit", () => this.fit());
    this.mkButton(gView, "⤓ JSON", () => this.exportJSON());
    this.mkButton(gView, "⤓ SVG", () => this.exportSVG());
    this.freezeBtn = this.mkButton(gView, "▶ Physics", () => {
      this.frozen = !this.frozen;
      this.freezeBtn.setText(this.frozen ? "⏸ Physics off" : "▶ Physics");
      if (!this.frozen) {
        this.alpha = Math.max(this.alpha, 0.35);
        this.startLoop();
      }
    });
    this.mkButton(gView, "✎ Layout", () => this.relayoutNow(true));

    var gLayout = group("Раскладка");
    this.layoutSel = gLayout.createEl("select", { cls: "lg-select", attr: { title: "чем раскладываем граф" } });
    LAYOUT_MODES.forEach((m) => {
      this.layoutSel.createEl("option", { text: m[1], attr: { value: m[0] } });
    });
    this.layoutSel.value = (this.plugin.settings.layout || {}).mode || "fdp";
    this.layoutSel.addEventListener("change", () => {
      this.plugin.settings.layout.mode = this.layoutSel.value;
      this.plugin.saveSettings();
      this.relayoutNow();
    });

    var gTypes = group("Types");
    var f = this.plugin.settings.filters;
    TYPES.forEach((t) => {
      var lab = gTypes.createEl("label", { cls: "lg-chip", attr: { "data-type": t } });
      var cb = lab.createEl("input", { type: "checkbox", attr: { checked: "" } });
      cb.checked = f.types[t] !== false;
      lab.createEl("span", { text: TYPE_LABEL[t] || t });
      cb.addEventListener("change", () => {
        this.plugin.settings.filters.types[t] = cb.checked;
        this.plugin.saveSettings();
        this.applyFilters();
      });
      (this.typeChecks || (this.typeChecks = {}))[t] = cb;
    });

    var gFilter = group("Filter");
    var hideL = gFilter.createEl("label", { cls: "lg-chip" });
    var hideCb = hideL.createEl("input", { type: "checkbox" });
    hideCb.checked = !!this.plugin.settings.filters.hidePlaceholders;
    hideL.createEl("span", { text: "скрыть заглушки" });
    hideCb.addEventListener("change", () => {
      this.plugin.settings.filters.hidePlaceholders = hideCb.checked;
      this.plugin.saveSettings();
      this.applyFilters();
    });

    this.searchEl = gFilter.createEl("input", {
      type: "search",
      placeholder: "search EN / 中文 / id",
      cls: "lg-search",
    });
    this.searchEl.addEventListener("input", obsidian.debounce(() => this.applyFilters(), 220));
    this.minDegEl = gFilter.createEl("input", { type: "number", cls: "lg-num", attr: { min: "0", step: "1" } });
    this.minDegEl.value = String(f.minDegree || 0);
    this.minDegEl.addEventListener("input", () => {
      this.plugin.settings.filters.minDegree = Math.max(0, num(this.minDegEl.value, 0));
      this.plugin.saveSettings();
      this.applyFilters();
    });
    this.chapterEl = gFilter.createEl("select", { cls: "lg-select" });
    this.chapterEl.createEl("option", { text: "all chapters", attr: { value: "" } });
    this.chapterEl.addEventListener("change", () => {
      this.plugin.settings.filters.chapter = this.chapterEl.value;
      this.plugin.saveSettings();
      this.applyFilters();
    });
    var gLabel = group("Labels");
    this.labelSel = gLabel.createEl("select", { cls: "lg-select" });
    [
      ["size", "по размеру вершины"],
      ["always", "всегда"],
      ["hover", "только при наведении"],
      ["none", "не показывать"],
    ].forEach((o) => this.labelSel.createEl("option", { text: o[1], attr: { value: o[0] } }));
    this.labelSel.value = this.plugin.settings.labelMode || "size";
    this.labelSel.addEventListener("change", () => {
      this.plugin.settings.labelMode = this.labelSel.value;
      this.plugin.saveSettings();
      this.updateLabels();
    });
    var gFont = group("Label size");
    this.mkButton(gFont, "A−", () => this.bumpFont(-1), { cls: "lg-btn lg-btn--font", title: "Уменьшить подписи вершин" });
    this.mkButton(gFont, "A+", () => this.bumpFont(1), { cls: "lg-btn lg-btn--font", title: "Увеличить подписи вершин" });
    // рядом с кнопками — чем кончилось: множитель и реальный кегль в пикселях на экране
    this.fontPxEl = gFont.createEl("span", { cls: "lg-fs", text: "" });
    this.fontRangeEl = gFont.createEl("span", { cls: "lg-fs lg-fs--px", text: "" });
    this.updateFontReadout();
    var labAuto = gFont.createEl("label", { cls: "lg-chip" });
    this.fontAutoEl = labAuto.createEl("input", { type: "checkbox" });
    this.fontAutoEl.checked = this.plugin.settings.labelFontBySize !== false;
    labAuto.createEl("span", { text: "кегль ∝ размеру вершины" });
    this.fontAutoEl.addEventListener("change", () => {
      this.plugin.settings.labelFontBySize = this.fontAutoEl.checked;
      this.plugin.saveSettings();
      this.applySizesNow();
    });
    var gDeg = group("Vertex size =");
    this.degSel = gDeg.createEl("select", { cls: "lg-select" });
    [
      ["refs", "входящие ссылки из текстов"],
      ["all", "все входящие (со структурными)"],
    ].forEach((o) => this.degSel.createEl("option", { text: o[1], attr: { value: o[0] } }));
    this.degSel.value = this.plugin.settings.countStructural ? "all" : "refs";
    this.degSel.addEventListener("change", () => {
      this.plugin.settings.countStructural = this.degSel.value === "all";
      this.plugin.saveSettings();
      this.refresh(true);
    });
    var gNorm = group("Относительно чего");
    this.normSel = gNorm.createEl("select", { cls: "lg-select" });
    [
      ["hybrid", "гибрид (контраст внутри уровня + общая шкала)"],
      ["byType", "среди вершин своего уровня"],
      ["global", "по всему графу"],
    ].forEach((o) => this.normSel.createEl("option", { text: o[1], attr: { value: o[0] } }));
    this.normSel.value = ["global", "byType", "hybrid"].indexOf(this.plugin.settings.sizeMode) >= 0 ? this.plugin.settings.sizeMode : "hybrid";
    this.normSel.addEventListener("change", () => {
      this.plugin.settings.sizeMode = this.normSel.value;
      this.plugin.saveSettings();
      this.applySizesNow();
    });

    var stage = root.createDiv({ cls: "lg-stage" });
    this.svg = svgEl("svg", { class: "lg-svg" });
    this.layer = svgEl("g", { class: "lg-layer" });
    this.edgesStruct = svgEl("path", { class: "lg-edges lg-edges--struct" });
    this.edgesRef = svgEl("path", { class: "lg-edges lg-edges--ref" });
    // рёбра выбранной вершины рисуем отдельно: клик по главе/секции обязан явно показать
    // связи с её соседями, а не только подсветить сами вершины
    this.edgesSel = svgEl("path", { class: "lg-edges lg-edges--sel" });
    this.nodesLayer = svgEl("g", { class: "lg-nodes" });
    this.layer.appendChild(this.edgesStruct);
    this.layer.appendChild(this.edgesRef);
    this.layer.appendChild(this.edgesSel);
    // Рёбра вручную установленных связей между двумя выделенными графами
    this.edgesManual = svgEl("path", { class: "lg-edges lg-edges--manual" });
    this.layer.appendChild(this.edgesManual);
    this.layer.appendChild(this.nodesLayer);
    this.svg.appendChild(this.layer);
    stage.appendChild(this.svg);
    // «пузырёк» с информационным сообщением: появляется РЯДОМ с вершиной (не перекрывая
    // её и её подпись), текст берётся из заметки, указанной свойством caption:.
    // Кнопки зума живут НА ХОЛСТЕ, а не в панели: в полноэкранном режиме панель
    // спрятана (lg-root--full .lg-bar { display: none }), а масштаб нужен и там.
    var zoomBar = stage.createDiv({ cls: "lg-zoom" });
    this.zoomOutBtn = this.mkButton(zoomBar, "\u2212", () => this.zoomBy(1 / ZOOM_STEP), {
      cls: "lg-btn lg-zoom__btn",
      title: "Уменьшить граф (колесо вниз, Ctrl+\u2212)",
    });
    this.zoomValEl = zoomBar.createEl("span", { cls: "lg-zoom__val", text: "100%" });
    this.zoomInBtn = this.mkButton(zoomBar, "+", () => this.zoomBy(ZOOM_STEP), {
      cls: "lg-btn lg-zoom__btn",
      title: "Увеличить граф (колесо вверх, Ctrl++)",
    });
    this.zoomFitBtn = this.mkButton(zoomBar, "\u2922", () => this.fit(), {
      cls: "lg-btn lg-zoom__btn",
      title: "Показать весь граф (двойной клик по фону)",
    });
    this.bubbleEl = stage.createDiv({ cls: "lg-bubble", attr: { "aria-live": "polite" } });
    // временные сообщения (загрузка, счётчики, ошибки) — тостом сверху, чтобы не занимать
    // место у графа и не превращаться в постоянную строку состояния
    this.toastEl = stage.createDiv({ cls: "lg-toast", attr: { "aria-live": "polite" } });
    this.legendEl = root.createDiv({ cls: "lg-legend" });
  }

  /** Движки, которые считают раскладку целиком (а не «живой силой»). */
  engineMode() {
    var m = (this.plugin.settings.layout || {}).mode;
    return m === "fdp" || m === "neato" || m === "twopi";
  }

  /** Полный конфиг для ядра: настройки подписей/размеров + блок layout. */
  layoutCfg() {
    var o = buildOptions(this.plugin.settings);
    return Object.assign({}, o, this.plugin.settings.layout || {});
  }

  /**
   * Пересобрать раскладку выбранным движком. Для fdp/neato/twopi результат считаем
   * ЦЕЛИКОМ здесь (тот же код, что у CLI и превью) - иначе картинка зависела бы от того,
   * на каком кадре пользователь посмотрел, и пост-обработка «чистых меток» не была бы
   * гарантирована.
   */
  layoutNow(graph) {
    var g = graph || this.graph;
    if (!g) return null;
    var lay = this.plugin.settings.layout || {};
    if (this.engineMode()) {
      this.setStatus("\u0440\u0430\u0441\u043a\u043b\u0430\u0434\u043a\u0430 " + lay.mode + "\u2026", 1400);
      var rep = core.computeLayout(g, {
        layout: lay, config: buildOptions(this.plugin.settings),
        width: this.width() || 1400, height: this.height() || 900,
      });
      this.setStatus("раскладка " + lay.mode + ": наложений " + (rep.overlaps || 0) +
        (rep.grows ? " · разведено в " + rep.grown + "×" : "") + " · проходов " + rep.passes, 3200);
      this.alpha = 0;
      return rep;
    }
    core.initPositions(g.nodes, { width: this.width(), height: this.height(), graph: g, layout: lay });
    var liveForce = lay.mode === "force";
    // Полный 700-шаговый прогрев force выполнялся синхронно и надолго замораживал
    // Obsidian. Для живой физики достаточно короткого посева: перед первым кадром
    // он завершается полировкой, а дальнейшие шаги идут по одному в startLoop().
    core.run(g, {
      layout: lay, config: buildOptions(this.plugin.settings),
      width: this.width() || 1400, height: this.height() || 900,
      iterations: liveForce ? Math.min(24, Math.max(1, num(lay.iterations, 700))) : (lay.iterations || 700),
      polishNoOverlap: true,
    });
    return { mode: lay.mode, warming: liveForce };
  }

  /** Только пост-обработка (после правки size:/переводов): метки и круги без наездов. */
  polishNow() {
    if (!this.graph || (this.plugin.settings.layout || {}).mode === "clusters") return null;
    var lay = this.plugin.settings.layout || {};
    var rep = core.polishNoOverlap(this.graph, this.layoutCfg(), {
      labels: lay.postLabels !== false, circles: lay.postCircles !== false,
    });
    this.redraw();
    this.updateLabels();
    return rep;
  }

  /** Кнопка «✎ Layout» и смена режима: пересобираем, а для физики ещё и запускаем цикл. */
  relayoutNow() {
    if (!this.graph) return;
    // Старый live-цикл не должен сделать ещё один force-шаг поверх уже готового
    // fdp/neato/twopi результата после смены режима.
    this.stopLoop();
    this.layoutNow(this.graph);
    this.buildDom();
    // applyFilters() строит и базовые пути, и видимость; повторять 7k путей ниже не нужно.
    this.applyFilters();
    this.fit();
    if (!this.engineMode()) {
      this.alpha = 1;
      this.frozen = false;
      if (this.freezeBtn) this.freezeBtn.setText("▶ Physics");
      this.startLoop();
    }
  }

  mkButton(parent, text, cb, opts) {
    opts = opts || {};
    var b = parent.createEl("button", {
      cls: opts.cls || "lg-btn",
      text: text,
      attr: Object.assign({ type: "button" }, opts.attr || {}, opts.title ? { title: opts.title, "aria-label": opts.title } : {}),
    });
    b.addEventListener("click", cb);
    return b;
  }

  /* -------------------------------------------------- camera */

  /** Показать масштаб в «процентах» рядом с кнопками «+»/«−». */
  updateZoomReadout() {
    if (!this.zoomValEl) return;
    var pct = Math.round((this.view.k || 1) * 100);
    var txt = (pct < 10 ? (this.view.k || 1).toFixed(2).replace(/0+$/, "") : String(pct)) + "%";
    if (this.zoomValEl.textContent !== txt) this.zoomValEl.textContent = txt;
  }

  /**
   * Изменить масштаб вокруг точки холста (по умолчанию — центр сцены, то есть
   * «увеличить то, что посередине»). Камера — один SVG transform, геометрию не трогаем.
   */
  zoomBy(factor, cx, cy) {
    if (!this.svg) return;
    var v = this.view;
    if (cx === undefined || cy === undefined || cx === null || cy === null) {
      cx = this.width() / 2;
      cy = this.height() / 2;
    }
    var k = clamp((v.k || 1) * (factor || 1), ZOOM_MIN, ZOOM_MAX);
    if (Math.abs(k - v.k) < 1e-9) return;
    v.x = cx - ((cx - v.x) / v.k) * k;
    v.y = cy - ((cy - v.y) / v.k) * k;
    v.k = k;
    this.applyViewTransform();
    // кегль и радиус на экране считаются от k, поэтому круги и метки пересобираем
    this.updateNodeSizes();
    this.updateLabels();
    this.placeBubble();
    this.updateZoomReadout();
  }

  /**
   * Радиусы кругов в модельных координатах зависят от зума (вершина не должна стать
   * точкой), поэтому их пересчитываем отдельно от геометрии. Меняем только те, у
   * кого значение действительно другое.
   */
  updateNodeSizes() {
    var k = this.view.k || 1;
    this.ensureNearest();
    for (var id in this.nodeEls) {
      var n = this.byId[id];
      if (!n) continue;
      var el = this.nodeEls[id];
      var c = el.__c || (el.__c = el.querySelector("circle"));
      if (!c) continue;
      var r = this.radiusModel(n, k).toFixed(1);
      if (c.__lgR !== r) {
        c.setAttribute("r", r);
        c.__lgR = r;
      }
    }
  }

  width() {
    return (this.svg && this.svg.clientWidth) || 1000;
  }

  height() {
    return (this.svg && this.svg.clientHeight) || 700;
  }

  /* -------------------------------------------------- data */

  async refresh(relayout) {
    this.setStatus("loading…");
    var graph = await this.plugin.getGraph(relayout === true);
    // getGraph() синхронизирует все открытые представления с новым кэшем. Раньше
    // refresh(true) раскладывал тот же граф ещё раз здесь — главный источник фриза.
    // При повторном onOpen() buildChrome() создаёт новый пустой SVG, хотя снимок
    // графа может быть тем же объектом. В таком случае достаточно заново принять
    // уже разложенные позиции; иначе nodeEls остались бы в отсоединённом DOM.
    var needsDom = !this.nodesLayer || !this.nodesLayer.firstChild;
    if (this.graph !== graph || needsDom) this.adoptGraph(graph, true);
  }

  /**
   * Переход на (возможно) уже построенный граф. Отдельно от refresh потому, что
   * плагин может пересобрать кэш по команде (Rebuild, write-index, настройки) —
   * вьюха обязана работать с ТЕМ ЖЕ объектом узлов, иначе правка подписи придёт
   * в один экземпляр вершины, а рисоваться будет другой.
   */
  adoptGraph(graph, keepPositions) {
    this.graph = graph;
    if (this.cardMsg === "loading\u2026") this.cardMsg = ""; // загрузилось — сообщение больше не нужно
    if (!graph.nodes.length) {
      this.setStatus("нет узлов: у заметок должен быть frontmatter type: chapter|section|heading|block");
      this.nodesLayer.textContent = "";
      this.nodeEls = {};
      return;
    }
    this.byId = {};
    graph.nodes.forEach((n) => (this.byId[n.id] = n));
    this.fillChapters();
    if (!keepPositions || !graph.nodes[0] || graph.nodes[0].x === undefined) {
      this.layoutNow(graph);
    }
    if (!this.engineMode()) this.alpha = Math.max(this.alpha, 1);
    this.buildDom();
    this.applyFilters();
    this.updateStatus();
    // Engine modes уже вернули завершённый снимок. Не запускаем на следующем RAF
    // лишний force-шаг, который мог испортить только что выполненную полировку.
    if (!this.frozen && !this.engineMode() && this.alpha > 0.02) this.startLoop();
    this.fit();
  }

  fillChapters() {
    var set = {};
    this.graph.nodes.forEach((n) => {
      if (n.chapter) set[n.chapter] = n.name;
    });
    var cur = this.plugin.settings.filters.chapter || "";
    this.chapterEl.textContent = "";
    this.chapterEl.createEl("option", { text: "all chapters", attr: { value: "" } });
    Object.keys(set)
      .sort()
      .forEach((id) => {
        var o = this.chapterEl.createEl("option", { text: id + " — " + set[id], attr: { value: id } });
        if (id === cur) o.selected = true;
      });
  }

  buildDom() {
    this.nodesLayer.textContent = "";
    this.nodeEls = {};
    var frag = document.createDocumentFragment();
    this.graph.nodes.forEach((n) => {
      var g = svgEl("g", { class: "lg-node lg-node--" + n.type, "data-id": n.id });
      // радиус круга на экране зависит от зума (вершина не должна стать точкой),
      // поэтому его ставит updateNodeSizes(); здесь — первое значение
      var c = svgEl("circle", { r: this.radiusModel(n, this.view.k).toFixed(1), fill: n.color });
      c.__lgR = c.getAttribute("r");
      g.__c = c;
      g.appendChild(c);
      var t = svgEl("text", { class: "lg-label", "text-anchor": "middle", y: n.r + 11 });
      var l1 = svgEl("tspan", { x: 0, class: "lg-label-en" });
      l1.textContent = n.labelEn === undefined ? n.name : n.labelEn;
      var l2 = svgEl("tspan", { x: 0, dy: 11, class: "lg-label-zh" });
      l2.textContent = (n.labelZh === undefined ? n.nameZh : n.labelZh) || "";
      t.appendChild(l1);
      t.appendChild(l2);
      // updateLabels() меняет DOM только при реальном изменении значения. Первый
      // проход после построения обязан заполнить все атрибуты.
      t.__lgLabelState = null;
      g.appendChild(t);
      g.__t = t;
      g.__lgTransform = null;
      g.__lgDisplay = null;
      frag.appendChild(g);
      this.nodeEls[n.id] = g;
    });
    this.nodesLayer.appendChild(frag);
  }

  applyFilters() {
    var g = this.graph;
    if (!g) return;
    var f = this.plugin.settings.filters;
    var keep = TYPES.filter((t) => f.types[t] !== false);
    var q = (this.searchEl.value || "").trim().toLowerCase();
    var visible = {};
    var shown = 0;
    var list = core.filterNodes(g, {
      types: keep,
      minDegree: num(f.minDegree, 0),
      chapter: f.chapter || null,
      hidePlaceholders: !!f.hidePlaceholders,
      query: q,
    });
    list.forEach((n) => {
      visible[n.id] = true;
      shown++;
    });
    this.visible = visible;
    this.visibleCount = shown;
    var g2 = subsetGraph(g, visible);
    this.drawn = g2;
    for (var id in this.nodeEls) {
      var el = this.nodeEls[id];
      var display = visible[id] ? "" : "none";
      if (el.__lgDisplay !== display) {
        el.style.display = display;
        el.__lgDisplay = display;
      }
    }
    this.updateLabels();
    // Фильтр меняет набор рёбер, поэтому здесь нужен полный пересчёт путей.
    this.redraw({ geometry: true });
    this.setStatus(
      "nodes " + shown + " / " + g.stats.nodes + " · edges " + g2.edges.length + " / " + g.stats.edges +
        " · refs max " + g.stats.maxDegree + (g.stats.unresolved ? " · unresolved " + g.stats.unresolved : ""),
      2600 // карточка с счётчиками живёт короткое время и не мешает смотреть на граф
    );
  }

  /* -------------------------------------------------- labels */

  /**
   * Радиус круга в МОДЕЛЬНЫХ координатах. На экране вершина не должна вырождаться в
   * точку: при k=0.07 (весь граф из 1200 вершин в окне) модельный радиус 13 даёт 0.9 px.
   * Поэтому круг растёт обратно пропорционально зуму — но мягко (степень NODE_GROW_POW),
   * чтобы крупные вершины оставались заметно крупнее, и никогда не мельче MIN_NODE_PX.
   */
  radiusModel(n, k) {
    k = k || this.view.k || 1;
    var grow = Math.pow(Math.max(1, 1 / k), NODE_GROW_POW);
    var floor = MIN_NODE_PX / k;
    var r = Math.max((n.r || 6) * grow, floor);
    // потолок — половина расстояния до ближайшей видимой вершины: иначе при отдалении
    // все мелкие вершины поднимаются до минимума и в плотных местах слипаются в пятно.
    // Замер на 1017 вершинах (весь граф в окне): без потолка 1343 пересекающиеся
    // пары кругов, с ним — 61.
    var nn = this._nn ? this._nn[n.id] : undefined;
    if (nn && isFinite(nn)) r = Math.min(r, nn * 0.5);
    return Math.max(r, floor * 0.6); // но и «точкой» вершина остаться не должна
  }

  /**
   * Расстояние до ближайшей видимой вершины — потолок для «экранного» радиуса.
   * Сетка даёт O(n); пересчитываем только когда менялась геометрия (зум расстояний
   * не меняет), поэтому колесо мыши не заставляет считать это на каждом событии.
   */
  ensureNearest() {
    if (this._nn && !this._nnDirty) return this._nn;
    var nn = (this._nn = {});
    this._nnDirty = false;
    var g = this.graph;
    if (!g) return nn;
    var nodes = [];
    for (var i = 0; i < g.nodes.length; i++) {
      var n = g.nodes[i];
      if (n && isFinite(n.x) && isFinite(n.y) && this.visible[n.id]) nodes.push(n);
    }
    if (nodes.length < 2) return nn;
    var b = core.bounds(nodes);
    // ячейка ≈ удвоенное среднее расстояние между соседями: тогда почти у каждой
    // вершины сосед находится в соседней ячейке и хватает первого кольца
    var cell = Math.max(8, Math.sqrt(Math.max(1, (b.maxX - b.minX) * (b.maxY - b.minY)) / nodes.length) * 2);
    var grid = {};
    for (var i2 = 0; i2 < nodes.length; i2++) {
      var key = Math.floor(nodes[i2].x / cell) + ":" + Math.floor(nodes[i2].y / cell);
      (grid[key] || (grid[key] = [])).push(nodes[i2]);
    }
    for (var a = 0; a < nodes.length; a++) {
      var p = nodes[a];
      var best = Infinity;
      var cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell);
      for (var ring = 0; ring <= 3 && best === Infinity; ring++) {
        for (var dx = -ring; dx <= ring; dx++) {
          for (var dy = -ring; dy <= ring; dy++) {
            if (ring && Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
            var lst = grid[(cx + dx) + ":" + (cy + dy)];
            if (!lst) continue;
            for (var q = 0; q < lst.length; q++) {
              var o = lst[q];
              if (o === p) continue;
              var d = Math.hypot(p.x - o.x, p.y - o.y);
              if (d < best) best = d;
            }
          }
        }
      }
      nn[p.id] = best;
    }
    return nn;
  }

  /**
   * Множитель кегля в модельных координатах. Идея: кегль ПОДПИСИ на экране постоянен.
   * Иначе отдаление превращает текст в серую пыль (было: 0.8 px на весь граф), а
   * приближение — в плакат. При k ≥ 1 множитель = 1: это ровно модельный кегль, тот
   * самый, под который ядро паковало метки (наездов нет по построению).
   */
  labelComp(k) {
    return Math.max(1, 1 / (k || 1));
  }

  /**
   * Какие подписи реально рисовать. Кегль на экране фиксирован, значит при отдалении
   * влезет меньше меток — место на экране не резиновое. Поэтому метки расставляются
   * жадно в ЭКРАННЫХ координатах: кто не влез, тот не рисуется вовсе (а не наезжает).
   * Порядок: выбранная и наведённая вершина, потом главы → секции → заголовки → блоки,
   * внутри уровня — крупные раньше мелких. Поэтому за место в первую очередь спорят
   * главы и секции, а не случайные блоки.
   */
  planLabels(k, comp) {
    var shown = {};
    var mode = this.plugin.settings.labelMode || "size";
    if (mode === "none" || !this.graph) return shown;
    this.ensureNearest();
    var v = this.view;
    var W = this.width(), H = this.height();
    var sel = this.selected, hov = this.hoverId;
    var rank = { chapter: 0, section: 1, heading: 2, block: 3 };
    var cands = [];
    for (var id in this.nodeEls) {
      if (!this.visible[id]) continue;
      var n = this.byId[id];
      if (!n || !isFinite(n.x) || !isFinite(n.y)) continue;
      // базовое правило «показывать ли подпись» живёт в ядре — то же, по которому
      // вершины расталкивались при упаковке; поверх него наведение, выделение, изоляция
      var on = core.labelShown(n, this.plugin.settings);
      if (mode === "hover") on = id === hov || id === sel;
      if (id === sel || id === hov) on = true;
      if (this.neigh && !this.neigh[id]) on = false;
      if (!on) continue;
      cands.push(n);
    }
    cands.sort(function (a, b) {
      var pa = a.id === sel ? -2 : a.id === hov ? -1 : 0;
      var pb = b.id === sel ? -2 : b.id === hov ? -1 : 0;
      if (pa !== pb) return pa - pb;
      var ra = rank[a.type] === undefined ? 9 : rank[a.type];
      var rb = rank[b.type] === undefined ? 9 : rank[b.type];
      if (ra !== rb) return ra - rb;
      return (b.r || 0) - (a.r || 0);
    });
    // сетка по экрану: проверка «не наехали» за O(1) на кандидата
    var cell = LABEL_GRID_CELL;
    var grid = {};
    for (var i = 0; i < cands.length; i++) {
      var n2 = cands[i];
      var font = n2.font || this.plugin.settings.labelFontSize || 10;
      var fsA = font * comp;
      var wM = (Math.max(0, (n2.lw || 0) - 8)) * comp + 8; // lw считан на font -> масштабируем
      var rM = this.radiusModel(n2, k);
      var cx = n2.x * k + v.x, cy = n2.y * k + v.y;
      var rS = rM * k;              // радиус круга на экране
      var fsS = fsA * k;            // кегль на экране
      var halfW = (wM * k) / 2 + LABEL_PAD_PX;
      var x0 = cx - halfW, x1 = cx + halfW;
      if (x1 < -LABEL_OFF_MARGIN || x0 > W + LABEL_OFF_MARGIN) continue; // метка за экраном
      // метку можно чуть опустить, а в крайнем случае — поставить НАД вершиной: две
      // главы на экране могут оказаться в 20 px друг от друга, и обе подписи снизу не
      // влезут никак. Сдвиг — в долях кегля, поэтому при любом зуме метка остаётся
      // «привязанной» к своей вершине (и на экспорт это не влияет).
      var shifts = LABEL_SHIFTS.slice();
      var up = (-2 * rS - 2) / fsS - 2.32; // блок текста целиком над кругом
      shifts.push(up, up - 1.1, up - 2.4);
      var box = null, shift = 0;
      for (var si = 0; si < shifts.length && !box; si++) {
        shift = shifts[si];
        // габарит метки: чуть шире и выше настоящего текста — этот же прямоугольник
        // проверяет живой рендер (test-view.js), поэтому запас здесь = гарантия «0 наездов»
        var y0 = cy + rS + (shift - 0.6) * fsS - LABEL_PAD_PX;
        var y1 = cy + rS + (shift + 2.4) * fsS + LABEL_PAD_PX;
        if (y1 < -LABEL_OFF_MARGIN || y0 > H + LABEL_OFF_MARGIN) continue;
        var i0 = Math.floor(x0 / cell), i1 = Math.floor(x1 / cell);
        var j0 = Math.floor(y0 / cell), j1 = Math.floor(y1 / cell);
        var busy = false;
        for (var gi = i0; gi <= i1 && !busy; gi++) {
          for (var gj = j0; gj <= j1 && !busy; gj++) {
            var bucket = grid[gi + ":" + gj];
            if (!bucket) continue;
            for (var bi = 0; bi < bucket.length; bi++) {
              var o = bucket[bi];
              if (x0 < o[2] && o[0] < x1 && y0 < o[3] && o[1] < y1) { busy = true; break; }
            }
          }
        }
        if (!busy) box = [x0, y0, x1, y1];
      }
      if (!box) continue;
      for (var gi2 = Math.floor(box[0] / cell); gi2 <= Math.floor(box[2] / cell); gi2++) {
        for (var gj2 = Math.floor(box[1] / cell); gj2 <= Math.floor(box[3] / cell); gj2++) {
          var key = gi2 + ":" + gj2;
          (grid[key] || (grid[key] = [])).push(box);
        }
      }
      shown[n2.id] = { fsA: fsA, wM: wM, rM: rM, shift: shift };
    }
    return shown;
  }

  updateLabels() {
    if (!this.graph) return;
    var k = this.view.k || 1;
    var comp = this.labelComp(k);
    var plan = this.planLabels(k, comp);
    for (var id in this.nodeEls) {
      var n = this.byId[id];
      var el = this.nodeEls[id];
      var t = el.__t;
      if (!n || !t) continue;
      var on = !!plan[id];
      // для наведённой/выбранной вершины показываем название целиком; для остальных —
      // обрезанную подпись, для которой уже оставлено место при упаковке.
      var focus = this.hoverId === id || this.selected === id;
      var en = focus ? n.name : (n.labelEn === undefined ? n.name : n.labelEn);
      var zh = focus ? n.nameZh : (n.labelZh === undefined ? n.nameZh : n.labelZh);
      var p = plan[id];
      var fs = p ? p.fsA : (n.font || this.plugin.settings.labelFontSize || 10) * comp;
      var rM = p ? p.rM : this.radiusModel(n, k);
      var y = rM + fs * (0.95 + (p ? p.shift : 0));
      var dy = fs * 1.12;
      var lw = p ? p.wM : (Math.max(0, (n.lw || 0) - 8)) * comp + 8;
      var state = (on ? "1" : "0") + "|" + fs.toFixed(1) + "|" + y.toFixed(1) + "|" + dy.toFixed(1) +
        "|" + lw.toFixed(1) + "|" + en + "\u0000" + (zh || "");
      // Hover / zoom генерируют много событий. Не трогаем SVG-атрибуты, если результат
      // не поменялся: это исключает тысячи style/layout invalidations за один жест.
      if (t.__lgLabelState === state) continue;
      t.__lgLabelState = state;
      t.setAttribute("font-size", fs.toFixed(1));
      t.setAttribute("y", y.toFixed(1));
      t.setAttribute("data-lw", lw.toFixed(1));
      // обводка-«гало» держит текст читаемым поверх рёбер и соседних кругов; её толщина
      // задана в модельных единицах, поэтому следует за кеглем
      t.setAttribute("stroke-width", (fs * 0.2).toFixed(2));
      t.setAttribute("style", on ? "display:block" : "display:none");
      if (t.childNodes[0].textContent !== (en || "")) t.childNodes[0].textContent = en || "";
      if (t.childNodes[1].textContent !== (zh || "")) t.childNodes[1].textContent = zh || "";
      t.childNodes[1].setAttribute("dy", dy.toFixed(1));
    }
  }

  /* -------------------------------------------------- drawing */

  /** Преобразование камеры не меняет геометрию графа — это один SVG transform. */
  applyViewTransform() {
    if (!this.layer) return;
    var v = this.view;
    var value = "translate(" + v.x + "," + v.y + ") scale(" + v.k + ")";
    if (this._viewTransform !== value) {
      this.layer.setAttribute("transform", value);
      this._viewTransform = value;
    }
  }

  /** Полные пути рёбер. Вызывается только после раскладки, фильтра или перетаскивания. */
  redrawBaseEdges(g, bow, ctr) {
    var byId = this.byId;
    var dRef = "";
    var dStruct = "";
    for (var i = 0; i < g.edges.length; i++) {
      var e = g.edges[i];
      var a = byId[e.source];
      var b = byId[e.target];
      if (!a || !b || !isFinite(a.x) || !isFinite(b.x)) continue;
      var path = core.edgePath(a, b, bow, ctr, e.kind);
      if (e.kind === "structure") dStruct += path;
      else dRef += path;
    }
    if (this._dStruct !== dStruct) {
      this.edgesStruct.setAttribute("d", dStruct);
      this._dStruct = dStruct;
    }
    if (this._dRef !== dRef) {
      this.edgesRef.setAttribute("d", dRef);
      this._dRef = dRef;
    }
  }

  /** Выделенные рёбра — короткий отдельный слой; базовые пути перестраивать не нужно. */
  redrawSelectedEdges(g, bow, ctr) {
    var sel = this.selected;
    var dSel = "";
    if (sel) {
      var byId = this.byId;
      for (var i = 0; i < g.edges.length; i++) {
        var e = g.edges[i];
        if (e.source !== sel && e.target !== sel) continue;
        var a = byId[e.source];
        var b = byId[e.target];
        if (!a || !b || !isFinite(a.x) || !isFinite(b.x)) continue;
        dSel += core.edgePath(a, b, bow, ctr, e.kind);
      }
    }
    if (this._dSel !== dSel) {
      this.edgesSel.setAttribute("d", dSel);
      this._dSel = dSel;
    }
  }

  redraw(opts) {
    // По умолчанию сохраняем прежнюю семантику redraw(): перерисовать геометрию.
    // Жесты камеры передают geometry:false и обновляют только transform слоя.
    opts = opts || {};
    var geometry = opts.geometry !== false;
    var classes = opts.classes !== false;
    var selection = opts.selection !== false;
    var labels = opts.labels !== false;
    this.applyViewTransform();
    var g = this.drawn || this.graph;
    if (!g) return;
    var cfg = this.plugin.settings;
    var bow = num(cfg.curvature, core.DEFAULTS.curvature);
    var ctr = this.graph && this.graph._center ? { x: this.graph._center.cx, y: this.graph._center.cy } : null;
    if (geometry) this.redrawBaseEdges(g, bow, ctr);
    if (geometry || selection) this.redrawSelectedEdges(g, bow, ctr);
    if (geometry) this._nnDirty = true; // вершины переехали — потолки радиусов устарели
    if (geometry || this._lastK !== this.view.k) {
      // радиус круга на экране зависит от зума, поэтому при сдвиге камеры круги
      // перерисовываем тоже (геометрия графа при этом не меняется)
      this.updateNodeSizes();
      this._lastK = this.view.k;
    }
    if (geometry) {
      for (var id in this.nodeEls) {
        var n = this.byId[id];
        if (!n || !this.visible[id]) continue;
        var el = this.nodeEls[id];
        var transform = "translate(" + n.x.toFixed(1) + "," + n.y.toFixed(1) + ")";
        if (el.__lgTransform !== transform) {
          el.setAttribute("transform", transform);
          el.__lgTransform = transform;
        }
      }
    }
    if (classes) {
      for (var id2 in this.nodeEls) {
        var n2 = this.byId[id2];
        if (!n2) continue;
        var el2 = this.nodeEls[id2];
        var cls = "lg-node lg-node--" + n2.type;
        if (this.selected === id2) cls += " lg-node--selected";
        if (this.bubbleFor === id2) cls += " lg-node--captioned";
        if (this.neigh && !this.neigh[id2]) cls += " lg-node--dim";
        if (this.neigh && this.neigh[id2] && this.selected !== id2) cls += " lg-node--neigh";
        if (el2.__cls !== cls) {
          el2.setAttribute("class", cls);
          el2.__cls = cls;
        }
      }
    }
    // подписи занимают место на ЭКРАНЕ, значит при панорамировании и зуме их набор
    // меняется; кегль тоже считается от k
    if (labels) this.updateLabels();
    this.placeBubble();
    // Обновить ручную связь при перерисовке, если выбраны две вершины
    if (this.selected && this.selected2) this.updateManualLink();
  }

  /** Позиционирование линии ручной связи между двумя выделенными вершинами. */
  updateManualLink() {
    if (!this.selected || !this.selected2) return;
    var n1 = this.byId[this.selected];
    var n2 = this.byId[this.selected2];
    if (!n1 || !n2) return;
    var k = this.view.k;
    var x1 = n1.x * k + this.view.x;
    var y1 = n1.y * k + this.view.y;
    var x2 = n2.x * k + this.view.x;
    var y2 = n2.y * k + this.view.y;
    this.edgesManual.setAttribute("d", "M " + x1 + " " + y1 + " L " + x2 + " " + y2);
  }

  /** Пузырёк сообщения ставим у вершины, но так, чтобы он не закрывал ни её, ни подпись. */
  placeBubble() {
    var el = this.bubbleEl;
    if (!el) return;
    var n = this.bubbleFor ? this.byId[this.bubbleFor] : null;
    if (!n || !el.hasClass("lg-bubble--open")) {
      el.style.left = "";
      el.style.top = "";
      return;
    }
    var v = this.view;
    var sx = n.x * v.k + v.x, sy = n.y * v.k + v.y;
    var rw = this.rootEl ? this.rootEl.clientWidth : this.width();
    var rh = this.rootEl ? this.rootEl.clientHeight : this.height();
    var bw = el.offsetWidth || 260, bh = el.offsetHeight || 90;
    var rad = this.radiusModel(n, v.k) * v.k;
    var left = sx + rad + 14;
    if (left + bw > rw - 10) left = sx - rad - 14 - bw; // не влезает справа — ставим слева
    left = clamp(left, 8, Math.max(8, rw - bw - 8));
    var top = clamp(sy - bh / 2, 8, Math.max(8, rh - bh - 8));
    el.style.left = Math.round(left) + "px";
    el.style.top = Math.round(top) + "px";
  }

  startLoop() {
    if (this.raf != null) return;
    var self = this;
    var tick = function () {
      self.raf = null;
      if (self.frozen || !self.graph) return;
      self.tickOnce();
      if (self.alpha > 0.02) self.raf = window.requestAnimationFrame(tick);
      else {
        // После живого цикла (в т.ч. после перетаскивания) метки и круги обязаны
        // остаться чистыми. polishNow уже обновляет геометрию, не рисуем её второй раз.
        if ((self.plugin.settings.layout || {}).mode !== "clusters") self.polishNow();
        else self.redraw();
        self.fit();
      }
    };
    this.raf = window.requestAnimationFrame(tick);
  }

  stopLoop() {
    if (this.raf != null && this.raf !== 0) {
      try {
        window.cancelAnimationFrame(this.raf);
      } catch (e) {
        clearTimeout(this.raf);
      }
    }
    this.raf = null;
  }

  tickOnce() {
    if ((this.plugin.settings.layout || {}).mode === "clusters" && this.graph._center) {
      // в режиме кластеров сектора и кольца заданы раскладкой; «физика» только
      // перемешала бы их, поэтому тик = ещё один упаковочный проход
      core.packAroundAnchors(this.graph, { layout: this.plugin.settings.layout, passes: 1, pull: 0.18 });
      this.alpha = Math.max(0, this.alpha - 0.06);
      this.redraw();
      return;
    }
    // Одна тяжёлая итерация на кадр сохраняет управление отзывчивым на 1000+ узлах.
    // Цикл всё равно продолжается до той же alpha, только не крадёт кадры у интерфейса.
    var steps = 1;
    for (var i = 0; i < steps; i++) {
      var d = core.step(this.graph, {
        layout: this.plugin.settings.layout,
        alpha: this.alpha,
        width: this.width(),
        height: this.height(),
      });
      this.alpha = Math.max(0.02, this.alpha * 0.985 - 0.0005);
      if (d < 0.05 && this.alpha < 0.06) this.alpha = 0;
    }
    this.redraw();
  }

  fit() {
    if (!this.graph || !this.visibleCount) return;
    var nodes = this.graph.nodes.filter((n) => this.visible[n.id] && isFinite(n.x));
    if (!nodes.length) return;
    var b = core.bounds(nodes);
    var w = this.width();
    var h = this.height();
    var gw = Math.max(1, b.maxX - b.minX);
    var gh = Math.max(1, b.maxY - b.minY);
    var k = clamp(Math.min((w - 40) / gw, (h - 40) / gh), ZOOM_MIN, ZOOM_MAX);
    this.view = { k: k, x: (w - (b.minX + b.maxX) * k) / 2, y: (h - (b.minY + b.maxY) * k) / 2 };
    // после смены камеры круги и подписи пересобираются: их размер на экране от k зависит
    this.updateNodeSizes();
    this.updateLabels();
    this.placeBubble();
    this.updateZoomReadout();
    this.redraw({ geometry: false, classes: false, selection: false });
  }

  /**
   * Карточка правого нижнего угла отвечает и за данные узла, и за временные сообщения
   * (loading, счётчики после фильтра, ошибки) — раньше для этого была строка состояния.
   * `ms` — через сколько мс сообщение убрать само (0/пусто — до следующего действия).
   */
  /** Временное сообщение — тостом сверху сцены: он не занимает место у графа. */
  setStatus(text, ms) {
    this.cardMsg = text || "";
    var el = this.toastEl;
    if (el) {
      el.empty();
      if (this.cardMsg) el.createDiv({ cls: "lg-toast__text", text: this.cardMsg });
      el.toggleClass("lg-toast--open", !!this.cardMsg);
    }
    clearTimeout(this.cardTimer);
    var self = this;
    var mine = this.cardMsg;
    if (mine && ms) {
      this.cardTimer = setTimeout(function () {
        if (self.cardMsg !== mine) return;
        self.cardMsg = "";
        if (self.toastEl) { self.toastEl.empty(); self.toastEl.removeClass("lg-toast--open"); }
      }, ms);
    }
  }

  updateStatus() {
    this.renderLegend();
  }

  /**
   * Сообщение у вершины: маленький «пузырёк» рядом с ней (не перекрывает ни круг, ни
   * подпись). Текст пользователь держит в отдельной заметке, на которую ссылает свойство
   * caption: — редактировать её так же просто, как текстовый прямоугольник в PowerPoint:
   * Пузырёк положен вершине ЛЮБОГО типа: у каждого типа свой шаблон
   * (40 - Templates/T Caption Chapter|Section|Heading|Block.md), а если заметки сообщения
   * ещё нет — прямо в пузырьке есть кнопка «+ Создать по шаблону».
   * Клик по вершине: подсветить соседей, явно показать её рёбра и показать это сообщение;
   * второй клик по той же вершине — скрыть.
   */
  renderBubble() {
    var el = this.bubbleEl;
    if (!el) return;
    var n = this.bubbleFor ? this.byId[this.bubbleFor] : null;
    el.empty();
    if (!n) {
      el.removeClass("lg-bubble--open");
      return;
    }
    el.addClass("lg-bubble--open");
    var self = this;
    var x = el.createEl("button", { cls: "lg-bubble__x", text: "\u2715", attr: { type: "button", title: "Скрыть (или Esc, или второй клик по вершине)" } });
    x.addEventListener("click", function () { self.showBubble(null); });
    var head = el.createDiv({ cls: "lg-bubble__head" });
    head.createSpan({ cls: "lg-chip lg-bubble__type", text: TYPE_LABEL[n.type] || n.type, attr: { "data-type": n.type } });
    head.createSpan({ cls: "lg-bubble__name", text: n.name || n.stem });
    if (n.nameZh) head.createSpan({ cls: "lg-bubble__zh", text: n.nameZh });
    if (n.keywords && n.keywords.length) {
      // вес = суммарное число вхождений фраз по корпусу, глава — та, что собрала их больше
      // всего; при выключенном счёте список фраз остаётся (он в свойствах заметки), а вес — нет
      var kw = el.createDiv({ cls: "lg-bubble__kw" });
      var kwOn = this.plugin.settings.keywordLinks !== false;
      kw.createSpan({ cls: "lg-bubble__kw-label", text: "ключевые фразы: " });
      kw.createSpan({ cls: "lg-bubble__kw-list", text: n.keywords.join(" · ") });
      kw.createSpan({
        cls: "lg-bubble__kw-weight",
        text: kwOn
          ? "вес " + (n.kwWeight || 0) + (n.kwChapter ? " · глава " + n.kwChapter : "")
          : "счёт рёбер по фразам выключен",
      });
    }
    var body = el.createDiv({ cls: "lg-bubble__text" });
    var text = this.plugin.captionText(n);
    if (text === undefined) {
      body.createDiv({ cls: "lg-bubble__load", text: "\u2026" });
    } else if (text === null) {
      body.createDiv({ cls: "lg-bubble__empty", text: "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0435\u0449\u0451 \u043d\u0435 \u043d\u0430\u043f\u0438\u0441\u0430\u043d\u043e: \u0441\u043e\u0437\u0434\u0430\u0439\u0442\u0435 \u0437\u0430\u043c\u0435\u0442\u043a\u0443 \u043f\u043e \u0448\u0430\u0431\u043b\u043e\u043d\u0443 \u0438 \u0432\u043f\u0438\u0448\u0438\u0442\u0435 \u0442\u0435\u043a\u0441\u0442." });
      var mk = body.createEl("button", { cls: "lg-btn lg-btn--cta", text: "+ \u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u043e \u0448\u0430\u0431\u043b\u043e\u043d\u0443", attr: { type: "button" } });
      mk.addEventListener("click", function () { self.plugin.createCaption(n).then(function () { self.renderBubble(); }); });
    } else if (!String(text).trim()) {
      body.createDiv({ cls: "lg-bubble__empty", text: "Заметка " + (n.caption || this.plugin.captionName(n)) + " пуста — впишите текст сообщения в неё." });
    } else {
      this.renderMarkdownInto(body, String(text), n.captionPath || this.plugin.captionName(n) + ".md");
    }
    var foot = el.createDiv({ cls: "lg-bubble__foot" });
    var open = foot.createEl("button", { cls: "lg-bubble__act", text: "\u270e \u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0442\u0435\u043a\u0441\u0442", attr: { type: "button", title: "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0437\u0430\u043c\u0435\u0442\u043a\u0443 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f" } });
    open.addEventListener("click", function () { self.plugin.openCaption(n); });
    foot.createSpan({ cls: "lg-bubble__src", text: n.caption || this.plugin.captionName(n) });
    this.placeBubble();
  }

  /** Markdown заметки сообщения рендерим тем же механизмом, что и предпросмотр (формулы, ссылки). */
  renderMarkdownInto(el, text, path) {
    var MR = obsidian.MarkdownRenderer;
    if (MR && MR.render && this.app) {
      try {
        MR.render(this.app, text, el, path || "", this);
        return;
      } catch (e) {
        /* нет рендерера (тесты, мобильный режим) — покажем текстом */
      }
    }
    String(text).split(/\n{2,}/).forEach(function (par) {
      if (par.trim()) el.createDiv({ cls: "lg-bubble__p", text: par.trim() });
    });
  }

  showBubble(id) {
    this.bubbleFor = id || null;
    if (this.bubbleEl) this.bubbleEl.toggleClass("lg-bubble--open", !!id);
    this.renderBubble();
  }

  /**
   * Легенда цветов. По умолчанию цвета — по главам (их наследуют секции, заголовки и
   * блоки), поэтому легенда показывает главы; если группировку по цветам глав выключить,
   * возвращаются четыре цвета по типам вершин.
   */
  renderLegend() {
    var el = this.legendEl;
    if (!el || !this.graph) return;
    el.empty();
    var self = this;
    var byCh = this.graph.colorsByChapter || {};
    var names = {};
    this.graph.nodes.forEach(function (n) {
      if (n.type === "chapter") names[n.id] = n;
    });
    var useCh = (this.plugin.settings.chapterColors !== false) && Object.keys(byCh).length > 1;
    var chips = [];
    if (useCh) {
      Object.keys(byCh).sort().forEach(function (id) {
        var n = names[id];
        if (!n) return;
        var cnt = 0;
        // блок может быть окрашен главой, собравшей больше вхождений, — в легенде он считается
        // там, где его цвет, иначе счётчики не сходятся с картинкой
        self.graph.nodes.forEach(function (m) { if ((m.kwChapter || m.chapter) === id) cnt++; });
        chips.push({ color: byCh[id], text: id + " · " + (n.name || ""), count: cnt, id: id });
      });
    } else {
      TYPES.forEach(function (t) {
        var cnt = self.graph.nodes.filter(function (n) { return n.type === t; }).length;
        chips.push({ color: (self.plugin.settings.colors || {})[t] || "#888", text: TYPE_LABEL[t] || t, count: cnt, type: t });
      });
    }
    el.createDiv({ cls: "lg-legend__title", text: useCh ? "\u0426\u0432\u0435\u0442 \u043f\u043e \u0433\u043b\u0430\u0432\u0430\u043c" : "\u0426\u0432\u0435\u0442 \u043f\u043e \u0442\u0438\u043f\u0430\u043c" });
    var row = el.createDiv({ cls: "lg-legend__row" });
    chips.forEach(function (ch) {
      var b = row.createEl("button", { cls: "lg-legend__chip", attr: { type: "button", title: ch.id ? "\u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u044d\u0442\u0443 \u0433\u043b\u0430\u0432\u0443" : ch.type } });
      b.createSpan({ cls: "lg-legend__dot", attr: { style: "background:" + ch.color } });
      b.createSpan({ cls: "lg-legend__text", text: ch.text });
      b.createSpan({ cls: "lg-legend__n", text: String(ch.count) });
      b.addEventListener("click", function () {
        if (ch.id) self.isolateChapter(ch.id);
        else if (ch.type && self.typeChecks) {
          var cb = self.typeChecks[ch.type];
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event("change"));
        }
      });
    });
    // если вершину перекрасил корпус ключевых фраз, легенда честно говорит почему
    var drifted = 0;
    if ((this.plugin.settings.keywordLinks !== false) && useCh) {
      this.graph.nodes.forEach(function (m) { if (m.kwChapter && m.chapter && m.kwChapter !== m.chapter) drifted++; });
    }
    if (drifted) {
      el.createDiv({
        cls: "lg-legend__note",
        text: drifted + " вершин окрашены главой, собравшей больше вхождений их ключевых фраз (свойство keywords_en, корпус " +
          String(this.plugin.settings.keywordFolder || "35 - Abstracts") + ")",
      });
    }
  }

  isolateChapter(id) {
    var cur = this.plugin.settings.filters.chapter || "";
    this.plugin.settings.filters.chapter = cur === id ? "" : id;
    if (this.chapterEl) this.chapterEl.value = this.plugin.settings.filters.chapter;
    this.plugin.saveSettings();
    this.applyFilters();
  }


  /** Наехать видом на вершину: карточка занимает левый нижний угол, поэтому цель — чуть выше центра. */
  centerOn(id) {
    var n = this.byId[id];
    if (!n || !isFinite(n.x) || !isFinite(n.y) || !this.view) return;
    var k = this.view.k;
    var w = this.width();
    var h = this.height();
    this.view = { k: k, x: w / 2 - n.x * k, y: h * 0.42 - n.y * k };
    this.redraw({ geometry: false, classes: false, selection: false });
  }

  copyLink(n) {
    var text = "[[" + n.stem + "|" + (n.name || n.stem) + "]]";
    try {
      var nav = typeof navigator !== "undefined" ? navigator : null;
      if (nav && nav.clipboard && nav.clipboard.writeText) {
        nav.clipboard.writeText(text);
        new obsidian.Notice("Скопировано: " + text);
        return;
      }
    } catch (e) {
      /* буфер обмена недоступен — просто покажем текст */
    }
    new obsidian.Notice(text);
  }

  hint() {
    return "ЛКМ по вершине — соседи, её рёбра и сообщение · ещё раз по той же — скрыть · 2×клик — подпись (EN + 中文) · ПКМ — меню · колесо — зум · тащить фон — панорама · ⛶ — граф на полном экране · Esc — скрыть сообщение, затем выйти из полноэкранного";
  }

  /* ---- полноэкранный режим ---- */
  toggleFullscreen(on) {
    this.fullscreen = on === undefined ? !this.fullscreen : !!on;
    if (this.rootEl) this.rootEl.toggleClass("lg-root--full", this.fullscreen);
    // настоящий полноэкранный режим окна: в нём не должно быть ничего, кроме графа
    if (document.body && document.body.toggleClass) document.body.toggleClass("lg-immersive", this.fullscreen);
    try {
      if (this.fullscreen && this.rootEl && this.rootEl.requestFullscreen && document.fullscreenElement !== this.rootEl) {
        this.rootEl.requestFullscreen();
      } else if (!this.fullscreen && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen();
      }
    } catch (e) {
      /* Fullscreen API недоступен (превью, мобильный режим) — остаётся CSS-вариант */
    }
    if (this.fullBtn) this.fullBtn.setText(this.fullscreen ? "✕ Выйти из полноэкранного (Esc)" : "⛶ Просмотреть граф на полном экране");
    var self = this;
    if (this.fullscreen) {
      // даём кадру перерисоваться, т.к. меняются размеры сцены
      setTimeout(function () {
        self.fit();
      }, 30);
    } else {
      setTimeout(function () {
        self.fit();
      }, 30);
    }
    return this.fullscreen;
  }

  /* ---- кегль подписей ----
     Раньше A−/A+ двигали границы labelFontMin/labelFontMax на 1 px, а весь граф после
     Fit живёт на k≈0.07 — то есть сдвиг был 0.07 px на экране: кнопки ничего не делали
     «на глаз». Теперь кегль на экране от зума не зависит (labelComp), поэтому множитель
     labelScale виден сразу; шаг ×1.15 — заметный, но не грубый. */
  bumpFont(delta) {
    var s = this.plugin.settings;
    var step = delta >= 0 ? FONT_STEP : 1 / FONT_STEP;
    var cur = num(s.labelScale, 1) > 0 ? num(s.labelScale, 1) : 1;
    s.labelScale = clamp(Math.round(cur * step * 1000) / 1000, 0.5, 4);
    this.plugin.saveSettings();
    this.applySizesNow();
    this.updateFontReadout();
    this.setStatus(
      "кегль подписей ×" + s.labelScale.toFixed(2) + " (" + this.fontRangeText() + ")", 1600
    );
  }

  /** Диапазон кегля в экранных пикселях — то, что пользователь и видит. */
  fontRangeText() {
    var s = this.plugin.settings;
    var sc = num(s.labelScale, 1) > 0 ? num(s.labelScale, 1) : 1;
    var lo = Math.round((s.labelFontBySize === false ? num(s.labelFontSize, 10) : num(s.labelFontMin, 9)) * sc);
    var hi = Math.round((s.labelFontBySize === false ? num(s.labelFontSize, 10) : num(s.labelFontMax, 19)) * sc);
    return lo === hi ? lo + " px" : lo + "\u2013" + hi + " px";
  }

  updateFontReadout() {
    if (this.fontPxEl) this.fontPxEl.textContent = "×" + num(this.plugin.settings.labelScale, 1).toFixed(2);
    if (this.fontRangeEl) this.fontRangeEl.textContent = this.fontRangeText();
  }

  applySizesNow() {
    if (!this.graph) return;
    core.applySizes(this.graph.nodes, buildOptions(this.plugin.settings));
    var layMode = (this.plugin.settings.layout || {}).mode;
    if (this.engineMode() || layMode === "force") {
      // метки стали шире/уже -> добиваем наложения пост-обработкой выбранного движка
      core.polishNoOverlap(this.graph, this.layoutCfg(), { labels: true });
    }
    if ((this.plugin.settings.layout || {}).mode === "clusters") {
      // размеры изменились -> метки стали шире/уже: пересобираем секторы и упаковку,
      // иначе подписи наезжают друг на друга (настройка «Физика» при этом выключена)
      var c = this.graph._center || { cx: this.width() / 2, cy: this.height() / 2 };
      core.placeClusters(this.graph, {
        cx: c.cx, cy: c.cy, layout: this.plugin.settings.layout, config: buildOptions(this.plugin.settings),
      });
      this.graph.nodes.forEach(function (n) {
        if (isFinite(n.x) && isFinite(n.y)) { n.x = n.tx; n.y = n.ty; }
      });
      core.packAroundAnchors(this.graph, { layout: this.plugin.settings.layout, passes: 24, pull: 0.6 });
    }
    this.updateNodeSizes();
    this.updateLabels();
    this.redraw();
    this.renderBubble();
    if (this.legendEl) this.renderLegend();
  }

  /** Обновить transform только той вершины, которую пользователь тащит. */
  redrawDraggedNode(node) {
    if (!node || !this.visible[node.id]) return;
    var el = this.nodeEls[node.id];
    if (!el) return;
    var transform = "translate(" + node.x.toFixed(1) + "," + node.y.toFixed(1) + ")";
    if (el.__lgTransform !== transform) {
      el.setAttribute("transform", transform);
      el.__lgTransform = transform;
    }
  }

  scheduleDragEdges() {
    if (this.dragEdgesTimer != null) return;
    var self = this;
    this.dragEdgesTimer = setTimeout(function () {
      self.dragEdgesTimer = null;
      self.redraw({ geometry: true, classes: false, selection: true });
    }, 80);
  }

  flushDragEdges() {
    if (this.dragEdgesTimer != null) {
      clearTimeout(this.dragEdgesTimer);
      this.dragEdgesTimer = null;
    }
    this.redraw({ geometry: true, classes: false, selection: true });
  }

  /* -------------------------------------------------- coordinates */

  toGraph(ev) {
    var rect = this.svg.getBoundingClientRect();
    var v = this.view;
    return {
      x: (ev.clientX - rect.left - v.x) / v.k,
      y: (ev.clientY - rect.top - v.y) / v.k,
    };
  }

  nodeFromEvent(ev) {
    var el = ev.target;
    while (el && el !== this.svg) {
      if (el.classList && el.classList.contains("lg-node")) {
        var id = el.getAttribute("data-id");
        return this.byId[id] || null;
      }
      el = el.parentNode;
    }
    return null;
  }

  /* -------------------------------------------------- interaction */

  onPointerDown(ev) {
    if (ev.button !== 0) return;
    var n = this.nodeFromEvent(ev);
    var p = this.toGraph(ev);
    if (n) {
      this.drag = { node: n, dx: n.x - p.x, dy: n.y - p.y, moved: false };
      n.fixed = true;
      this.frozen = true;
      if (this.freezeBtn) this.freezeBtn.setText("⏸ Physics off");
      if (ev.ctrlKey) {
        // Ctrl+click: manage manual linking
        if (this.selected === n.id) {
          // Already selected first node — deselect both and clear link
          this.selected = null;
          this.selected2 = null;
          this.edgesManual.setAttribute("d", "");
        } else if (this.selected && !this.selected2) {
          // Second node with Ctrl — draw link between first and second
          this.selected2 = n.id;
          this.drawManualLink(this.selected, this.selected2);
        } else {
          // First node with Ctrl (no second yet)
          this.selected = n.id;
          this.selected2 = null;
          this.edgesManual.setAttribute("d", "");
        }
        this.redraw({ geometry: false, classes: true, selection: true });
      } else {
        // Normal click: reset selection and link
        this.selected = n.id;
        this.selected2 = null;
        this.edgesManual.setAttribute("d", "");
        this.select(n.id);
      }
    } else {
      this.drag = { pan: true, sx: ev.clientX, sy: ev.clientY, vx: this.view.x, vy: this.view.y, moved: false };
      this.select(null);
      this.selected = null;
      this.selected2 = null;
      this.edgesManual.setAttribute("d", "");
    }
    ev.preventDefault();
  }

  /** Рисует прямую линию между двумя узлами какManual‑связь. */
  drawManualLink(id1, id2) {
    var n1 = this.byId[id1];
    var n2 = this.byId[id2];
    if (!n1 || !n2) return;
    var k = this.view.k;
    var x1 = n1.x * k + this.view.x;
    var y1 = n1.y * k + this.view.y;
    var x2 = n2.x * k + this.view.x;
    var y2 = n2.y * k + this.view.y;
    this.edgesManual.setAttribute("d", "M " + x1 + " " + y1 + " L " + x2 + " " + y2);
    this.redraw({ geometry: false, classes: true, selection: true });
  }

  onPointerMove(ev) {
    if (!this.drag) return;
    if (this.drag.pan) {
      this.view.x = this.drag.vx + (ev.clientX - this.drag.sx);
      this.view.y = this.drag.vy + (ev.clientY - this.drag.sy);
      this.drag.moved = true;
      this.redraw({ geometry: false, classes: false, selection: false });
      return;
    }
    var p = this.toGraph(ev);
    var node = this.drag.node;
    node.x = p.x + this.drag.dx;
    node.y = p.y + this.drag.dy;
    this.drag.moved = true;
    this.redrawDraggedNode(node);
    // Рёбра выбранной вершины (обычно их десятки, а не тысячи) следуют за курсором
    // сразу. Полную подложку обновляем максимум раз в 80 мс и обязательно на отпускании.
    this.redraw({ geometry: false, classes: false, selection: true });
    this.scheduleDragEdges();
  }

  onPointerUp() {
    if (this.drag && this.drag.node) {
      this.drag.node.fixed = false;
      this.flushDragEdges();
    }
    this.drag = null;
  }

  onWheel(ev) {
    ev.preventDefault();
    var rect = this.svg.getBoundingClientRect();
    var mx = ev.clientX - rect.left;
    var my = ev.clientY - rect.top;
    // то же преобразование, что у кнопок «+»/«−»: зум вокруг курсора
    this.zoomBy(Math.pow(1.0015, -ev.deltaY), mx, my);
  }

  onHover(ev) {
    var n = ev ? this.nodeFromEvent(ev) : null;
    var id = n ? n.id : null;
    if (id === this.hoverId) return;
    this.hoverId = id;
    if (n) this.svg.setAttribute("style", "cursor:pointer");
    else this.svg.removeAttribute("style");
    if ((this.plugin.settings.labelMode || "size") === "hover" || this.plugin.settings.labelMode === "size") this.updateLabels();
  }

  onDblClick(ev) {
    var n = this.nodeFromEvent(ev);
    if (!n) {
      this.fit();
      return;
    }
    if (n.inline) {
      new obsidian.Notice("Инлайн-блок: правьте подпись в тексте заметки (её строки `name:` нет в frontmatter).");
      this.plugin.editFile(n.path, n);
      return;
    }
    this.plugin.editLabel(n);
  }

  onContextMenu(ev) {
    var n = this.nodeFromEvent(ev);
    if (!n) {
      // правый клик по пустому месту холста: новая вершина создаётся прямо из графа —
      // с английским и китайским названиями и списком ключевых фраз, по которым сразу
      // пойдёт поиск связанных тем (корпус аннотаций + совпадения названий)
      ev.preventDefault();
      var menu = new obsidian.Menu(this.app);
      menu.addItem((it) =>
        it
          .setTitle("Create node (EN / 中文 / keywords)")
          .setIcon("plus-circle")
          .onClick(() => new CreateNodeModal(this.app, this.plugin, {}).open())
      );
      menu.addSeparator();
      menu.addItem((it) => it.setTitle("Fit graph to view").setIcon("maximize").onClick(() => this.fit()));
      menu.addItem((it) => it.setTitle("Clear filters").setIcon("x").onClick(() => this.clearIsolation()));
      menu.showAtPosition({ x: ev.pageX, y: ev.pageY });
      return;
    }
    ev.preventDefault();
    var menu = new obsidian.Menu(this.app);
    menu.addItem((it) => it.setTitle("Open note").setIcon("file-text").onClick(() => this.app.workspace.getLeaf(false).openFile(this.app.vault.getAbstractFileByPath(n.path))));
    menu.addItem((it) => it.setTitle("Edit label (EN / 中文)").setIcon("pencil").onClick(() => this.plugin.editLabel(n)));
    menu.addItem((it) => it.setTitle("Isolate chapter of this vertex").setIcon("scan").onClick(() => this.isolate(n.id)));
    menu.addItem((it) => it.setTitle("Clear filters").setIcon("x").onClick(() => this.clearIsolation()));
    menu.addSeparator();
    menu.addItem((it) => it.setTitle("Copy wiki link").setIcon("link").onClick(() => this.plugin.copyLink(n)));
    menu.showAtPosition({ x: ev.pageX, y: ev.pageY });
  }

  clearIsolation() {
    this.plugin.settings.filters.chapter = "";
    this.plugin.settings.filters.minDegree = 0;
    this.plugin.settings.filters.hidePlaceholders = false;
    this.minDegEl.value = "0";
    this.searchEl.value = "";
    this.plugin.saveSettings();
    this.applyFilters();
  }

  select(id) {
    if (id && this.selected === id) {
      // второй клик по той же вершине — снять выделение и спрятать сообщение
      this.selected = null;
      this.neigh = null;
      this.showBubble(null);
      this.redraw({ geometry: false });
      this.updateLabels();
      return;
    }
    this.selected = id || null;
    this.neigh = this.selected ? core.neighborhood(this.graph, this.selected) : null;
    if (this.neigh) this.neigh[this.selected] = true;
    var n = this.selected ? this.byId[this.selected] : null;
    // сообщение положено любой вершине: у своего типа свой шаблон, а если заметки
    // сообщения ещё нет — пузырёк сам предложит её создать
    this.showBubble(n ? n.id : null);
    this.redraw({ geometry: false });
    this.updateLabels();
  }

  isolate(id) {
    var n = this.byId[id];
    if (n && n.chapter && this.plugin.settings.filters.chapter === n.chapter) {
      this.plugin.settings.filters.chapter = "";
    } else if (n) {
      this.plugin.settings.filters.chapter = n.chapter || "";
    } else {
      this.plugin.settings.filters.chapter = "";
    }
    this.chapterEl.value = this.plugin.settings.filters.chapter || "";
    this.plugin.saveSettings();
    this.applyFilters();
  }

  /* -------------------------------------------------- export */

  exportGraph() {
    return subsetGraph(this.graph, this.visible);
  }

  async exportSVG() {
    return this.plugin.exportSVG(this.exportGraph());
  }

  /** Выгрузка ровно того, что видно: узлы, рёбра, размеры, цвета, статистика. */
  async exportJSON() {
    return this.plugin.exportJSON(this.exportGraph());
  }
}

/* ------------------------------------------------------------------ modal */

class EditLabelModal extends obsidian.Modal {
  constructor(app, plugin, node) {
    super(app);
    this.plugin = plugin;
    this.node = node;
  }

  onOpen() {
    var content = this.contentEl;
    content.addClass("lg-modal");
    content.createEl("h2", { text: "Редактировать подпись вершины" });
    content.createDiv({ cls: "lg-modal-path", text: this.node.path });
    var preview = content.createDiv({ cls: "lg-modal-preview" });
    var pEn = preview.createDiv({ cls: "lg-line lg-line--en", text: this.node.name });
    var pZh = preview.createDiv({ cls: "lg-line lg-line--zh", text: this.node.nameZh || "—" });

    var f1 = content.createDiv({ cls: "lg-field" });
    f1.createEl("label", { text: "Основная строка (EN)", attr: { for: "lg-name" } });
    var en = f1.createEl("input", { type: "text", attr: { id: "lg-name" }, value: this.node.name });
    var f2 = content.createDiv({ cls: "lg-field" });
    f2.createEl("label", { text: "Перевод (вторая строка)", attr: { for: "lg-name-zh" } });
    var zh = f2.createDiv({cls:"lg-field-row"});
    var zhInput = zh.createEl("input", { type: "text", attr: { id: "lg-name-zh" }, value: this.node.nameZh || "" });
    zh.createEl("button", { text: "↑", attr: { type: "button", title: "Взять из aliases/заголовка" } }).addEventListener("click", () => {
      if (!zhInput.value) zhInput.value = this.node.name;
    });
    content.createDiv({
      cls: "lg-modal-hint",
      text: "Сохраняется в frontmatter заметки как " + this.plugin.settings.nameKey + " / " + this.plugin.settings.nameZhKey + ". Тело заметки и формулы не трогаются.",
    });

    var upd = function () {
      pEn.setText(en.value || "(пусто)");
      pZh.setText(zhInput.value || "—");
    };
    en.addEventListener("input", upd);
    zhInput.addEventListener("input", upd);

    var btns = content.createDiv({ cls: "lg-modal-btns" });
    var save = btns.createEl("button", { text: "Сохранить", cls: "mod-cta", attr: { type: "button" } });
    save.addEventListener("click", () => this.submit(en.value, zhInput.value));
    btns.createEl("button", { text: "Открыть заметку", attr: { type: "button" } }).addEventListener("click", () => {
      var f = this.app.vault.getAbstractFileByPath(this.node.path);
      if (f) this.app.workspace.getLeaf(false).openFile(f);
    });
    this.en = en;
    this.zh = zhInput;
    setTimeout(() => en.focus(), 30);
    this.registerDomEvent(document, "keydown", (ev) => {
      if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) this.submit(en.value, zhInput.value);
    });
  }

  async submit(nameEn, nameZh) {
    var ok = await this.plugin.writeLabel(this.node, nameEn, nameZh);
    if (ok) {
      new obsidian.Notice("Подпись обновлена: " + nameEn + (nameZh ? " / " + nameZh : ""));
      this.close();
    }
  }

  onClose() {
    this.contentEl.textContent = "";
  }
}

/* ------------------------------------------------------------------ modal: новый узел */

/** Родитель какого типа уместен для вершины этого уровня (конвенция курса). */
var PARENT_TYPE_OF = { chapter: null, section: "chapter", heading: "section", block: "heading" };

class CreateNodeModal extends obsidian.Modal {
  constructor(app, plugin, opts) {
    super(app);
    this.plugin = plugin;
    this.opts = opts || {};
    this.busy = false;
  }

  onOpen() {
    var content = this.contentEl;
    content.addClass("lg-modal");
    content.addClass("lg-create");
    content.createEl("h2", { text: "Новый узел графа" });
    content.createDiv({
      cls: "lg-modal-hint",
      text: "Заметка создаётся в папке своего уровня (глава/секция/заголовок/блок) рядом с соседями. После создания плагин сам ищет связанные темы: по ключевым фразам — в корпусе аннотаций, по названиям — среди вершин графа, и сразу строит связи.",
    });

    var fType = content.createDiv({ cls: "lg-field" });
    fType.createEl("label", { text: "Тип вершины", attr: { for: "lg-new-type" } });
    var typeSel = fType.createEl("select", { attr: { id: "lg-new-type" } });
    [
      ["block", "block — фрагмент текста (формулы, утверждения)"],
      ["heading", "heading — заголовок внутри секции"],
      ["section", "section — секция главы"],
      ["chapter", "chapter — глава курса"],
    ].forEach(function (o) {
      typeSel.createEl("option", { text: o[1], attr: { value: o[0] } });
    });
    typeSel.value = "block";

    var f1 = content.createDiv({ cls: "lg-field" });
    f1.createEl("label", { text: "Название (EN)", attr: { for: "lg-new-name" } });
    var en = f1.createEl("input", { type: "text", attr: { id: "lg-new-name", placeholder: "Spectral Radius Estimate" } });
    var f2 = content.createDiv({ cls: "lg-field" });
    f2.createEl("label", { text: "Название (中文)", attr: { for: "lg-new-name-zh" } });
    var zh = f2.createEl("input", { type: "text", attr: { id: "lg-new-name-zh", placeholder: "谱半径估计" } });
    var f3 = content.createDiv({ cls: "lg-field" });
    f3.createEl("label", { text: "Ключевые слова / теги", attr: { for: "lg-new-keywords" } });
    var kw = f3.createEl("textarea", {
      attr: { id: "lg-new-keywords", rows: "3", placeholder: "spectral radius; banach space; 弱收敛" },
    });
    content.createDiv({
      cls: "lg-modal-hint",
      text: "Фразы через «;», запятую или с новой строки. По ним плагин ищет вхождения в аннотациях «" +
        (this.plugin.settings.keywordFolder || "35 - Abstracts") + "» и превращает найденное в связи с секциями и заголовками; число вхождений становится весом (размером) вершины.",
    });

    var fParent = content.createDiv({ cls: "lg-field" });
    fParent.createEl("label", { text: "Родитель (необязательно)", attr: { for: "lg-new-parent" } });
    var parentSel = fParent.createEl("select", { attr: { id: "lg-new-parent" } });

    var preview = content.createDiv({ cls: "lg-modal-preview" });
    var pEn = preview.createDiv({ cls: "lg-line lg-line--en", text: "(название)" });
    var pZh = preview.createDiv({ cls: "lg-line lg-line--zh", text: "—" });

    var btns = content.createDiv({ cls: "lg-modal-btns" });
    var save = btns.createEl("button", { text: "Создать", cls: "mod-cta", attr: { type: "button" } });
    btns.createEl("button", { text: "Отмена", attr: { type: "button" } }).addEventListener("click", () => this.close());

    var self = this;
    var upd = function () {
      pEn.setText(en.value.trim() || "(название)");
      pZh.setText(zh.value.trim() || "—");
      save.disabled = !en.value.trim() || self.busy;
    };
    en.addEventListener("input", upd);
    zh.addEventListener("input", upd);

    // список родителей зависит от типа: у блока — заголовки, у заголовка — секции и т.д.
    var fillParents = function (type) {
      parentSel.textContent = "";
      var want = PARENT_TYPE_OF[type];
      if (!want) {
        parentSel.createEl("option", { text: "— у главы родителя нет —", attr: { value: "" } });
        parentSel.disabled = true;
        return;
      }
      parentSel.disabled = false;
      parentSel.createEl("option", { text: "— без родителя (свяжется по ключевым фразам) —", attr: { value: "" } });
      var nodes = (self.plugin.cache && self.plugin.cache.nodes) || [];
      nodes
        .filter(function (n) {
          return n.type === want && !n.inline;
        })
        .sort(function (a, b) {
          return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
        })
        .forEach(function (n) {
          parentSel.createEl("option", { text: n.id + " — " + n.name, attr: { value: n.id } });
        });
    };
    fillParents(typeSel.value);
    typeSel.addEventListener("change", function () {
      fillParents(typeSel.value);
    });

    save.addEventListener("click", () => this.submit());
    this.en = en;
    this.zh = zh;
    this.kw = kw;
    this.typeSel = typeSel;
    this.parentSel = parentSel;
    upd();
    setTimeout(() => en.focus(), 30);
    this.registerDomEvent(document, "keydown", (ev) => {
      if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) this.submit();
    });
  }

  async submit() {
    if (this.busy) return;
    if (!this.en.value.trim()) {
      new obsidian.Notice("Название (EN) обязательно: это первая строка подписи вершины");
      return;
    }
    this.busy = true;
    var save = Array.from(this.contentEl.querySelectorAll("button")).find((b) => b.textContent === "Создать");
    if (save) {
      save.disabled = true;
      save.setText("Создаём…");
    }
    var res;
    try {
      res = await this.plugin.createNewNode({
        type: this.typeSel.value,
        nameEn: this.en.value,
        nameZh: this.zh.value,
        keywords: this.kw.value,
        parent: this.parentSel && !this.parentSel.disabled ? this.parentSel.value : "",
      });
    } finally {
      this.busy = false;
      if (save) {
        save.disabled = false;
        save.setText("Создать");
      }
    }
    if (res) this.close();
  }

  onClose() {
    this.contentEl.textContent = "";
  }
}

/* ------------------------------------------------------------------ settings */

class LectureGraphSettingTab extends obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    var el = this.containerEl;
    el.empty();
    var s = this.plugin.settings;
    var save = () => this.plugin.saveSettings();

    el.createEl("h2", { text: "Lecture Graph" });
    new obsidian.Setting(el)
      .setName("Папки для обхода")
      .setDesc("Через запятую. Пусто = весь vault. Узлом считается заметка, у которой в frontmatter есть type: chapter|section|heading|block.")
      .addText((t) => t.setValue(s.folders).onChange((v) => ((s.folders = v.trim()), save())));
    new obsidian.Setting(el)
      .setName("Исключить папки")
      .addText((t) => t.setValue(s.excludeFolders).onChange((v) => ((s.excludeFolders = v.trim()), save())));
    new obsidian.Setting(el)
      .setName("Ключ основной подписи")
      .setDesc("Свойство frontmatter с названием (первая строка).")
      .addText((t) => t.setValue(s.nameKey).onChange((v) => ((s.nameKey = v.trim() || "name"), save())));
    new obsidian.Setting(el)
      .setName("Ключ перевода")
      .setDesc("Свойство frontmatter со второй строкой подписи.")
      .addText((t) => t.setValue(s.nameZhKey).onChange((v) => ((s.nameZhKey = v.trim() || "name_zh"), save())));
    new obsidian.Setting(el)
      .setName("Размер вершины по всем входящим")
      .setDesc("Вкл: учитывать и структурные ссылки (Part of…). Выкл: только ссылки из текстов.")
      .addToggle((t) => t.setValue(s.countStructural).onChange((v) => ((s.countStructural = v), save(), this.plugin.changed())));
    new obsidian.Setting(el)
      .setName("Считать инлайн-блоки (^якорь) отдельными вершинами")
      .addToggle((t) => t.setValue(s.includeInlineAnchors).onChange((v) => ((s.includeInlineAnchors = v), save(), this.plugin.changed())));
    new obsidian.Setting(el)
      .setName("Минимальный радиус")
      .addSlider((t) => t.setLimits(2, 20, 1).setValue(s.minRadius).onChange((v) => ((s.minRadius = v), save(), this.plugin.refreshSizes())));
    new obsidian.Setting(el)
      .setName("Максимальный радиус")
      .addSlider((t) => t.setLimits(10, 90, 1).setValue(s.maxRadius).onChange((v) => ((s.maxRadius = v), save(), this.plugin.refreshSizes())));
    new obsidian.Setting(el)
      .setName("Степень масштабирования")
      .setDesc("Меньше — сильнее разброс размеров при редких ссылках.")
      .addSlider((t) => t.setLimits(0.15, 1, 0.05).setValue(s.degreeGamma).onChange((v) => ((s.degreeGamma = v), save(), this.plugin.refreshSizes())));
    new obsidian.Setting(el)
      .setName("Показывать подписи")
      .addDropdown((d) => {
        d.addOption("size", "по размеру вершины");
        d.addOption("always", "всегда");
        d.addOption("hover", "при наведении");
        d.addOption("none", "никак");
        d.setValue(s.labelMode).onChange((v) => {
          s.labelMode = v;
          save();
          this.plugin.forEachView((vw) => vw.updateLabels());
        });
      });
    new obsidian.Setting(el)
      .setName("Изгиб рёбер (дуги)")
      .setDesc("0 — прямые линии. По умолчанию 0.24: структурные рёбра идут «веером» внутри своего сектора и не пересекаются.")
      .addSlider((t) => t.setLimits(0, 0.6, 0.02).setValue(num(s.curvature, 0.24)).onChange((v) => ((s.curvature = v), save(), this.plugin.forEachView((vw) => vw.redraw()))));
    new obsidian.Setting(el)
      .setName("Цвет по главам")
      .setDesc("У каждой главы свой цвет, секции, заголовки и блоки внутри неё красятся тем же цветом. Свойство color: в заметке перебивает и этот цвет, и цвет типа.")
      .addToggle((t) => t.setValue(s.chapterColors !== false).onChange((v) => ((s.chapterColors = v), save(), this.plugin.changed())));
    new obsidian.Setting(el)
      .setName("Подписи у блоков")
      .setDesc("Блоков много, по умолчанию их подписи скрыты (видно при наведении и в сообщении). Заголовки и выше — всегда по порогу.")
      .addToggle((t) => t.setValue(!!(s.labelForTypes && s.labelForTypes.block)).onChange((v) => {
        s.labelForTypes = Object.assign({ chapter: true, section: true, heading: true, block: true }, s.labelForTypes || {}, { block: v });
        save();
        this.plugin.forEachView((vw) => vw.updateLabels());
      }));
    new obsidian.Setting(el)
      .setName("Порог показа подписей (радиус)")
      .setDesc("Работает в режиме «по размеру вершины».")
      .addSlider((t) => t.setLimits(4, 40, 1).setValue(s.labelRadiusThreshold).onChange((v) => ((s.labelRadiusThreshold = v), save(), this.plugin.changed())));
    new obsidian.Setting(el)
      .setName("Относительно чего считать размер вершины")
      .setDesc("«По уровню»: глава сравнивается с главами, блок — с блоками (иначе крупные блоки задают тон и верхние уровни выглядят одинаково).")
      .addDropdown((d) => {
        d.addOption("hybrid", "гибрид: контраст внутри уровня и общая шкала");
        d.addOption("byType", "только среди вершин своего уровня");
        d.addOption("global", "только по всему графу");
        d.setValue(s.sizeMode).onChange((v) => ((s.sizeMode = v), save(), this.plugin.refreshSizes()));
      });
    new obsidian.Setting(el)
      .setName("Ноль шкалы размеров")
      .setDesc("«Минимальная степень»: самая редко цитируемая вершина = minRadius (максимальный контраст). «Ноль»: размер пропорционален числу ссылок буквально.")
      .addDropdown((d) => {
        d.addOption("min", "минимальная степень в графе");
        d.addOption("zero", "ноль ссылок");
        d.setValue(s.degreeBase).onChange((v) => ((s.degreeBase = v), save(), this.plugin.refreshSizes()));
      });
    el.createEl("h3", { text: "Подписи вершин" });
    new obsidian.Setting(el)
      .setName("Кегль зависит от размера вершины")
      .setDesc("Вершина с большим числом ссылок получает и больную подпись.")
      .addToggle((t) => t.setValue(s.labelFontBySize).onChange((v) => ((s.labelFontBySize = v), save(), this.plugin.refreshSizes())));
    new obsidian.Setting(el)
      .setName("Базовый кегль (когда авто выключено)")
      .addSlider((t) => t.setLimits(6, 40, 1).setValue(s.labelFontSize).onChange((v) => ((s.labelFontSize = v), save(), this.plugin.refreshSizes())));
    new obsidian.Setting(el)
      .setName("Кегль минимальной вершины")
      .addSlider((t) => t.setLimits(5, 30, 0.5).setValue(s.labelFontMin).onChange((v) => ((s.labelFontMin = v), save(), this.plugin.refreshSizes())));
    new obsidian.Setting(el)
      .setName("Кегль максимальной вершины")
      .addSlider((t) => t.setLimits(6, 48, 0.5).setValue(s.labelFontMax).onChange((v) => ((s.labelFontMax = v), save(), this.plugin.refreshSizes())));
    new obsidian.Setting(el)
      .setName("Масштаб подписей (кнопки A−/A+ на панели)")
      .setDesc("Множитель кегля. Кегль на экране не зависит от масштаба графа, поэтому множитель виден сразу; шаг кнопки — ×" + FONT_STEP + ".")
      .addSlider((t) => t.setLimits(0.5, 4, 0.05)
        .setValue(num(s.labelScale, 1))
        .setDynamicTooltip()
        .onChange((v) => ((s.labelScale = v), save(), this.plugin.refreshSizes())));
    new obsidian.Setting(el).setName("Автообновление при сохранении файлов").addToggle((t) => t.setValue(s.autoRefresh).onChange((v) => ((s.autoRefresh = v), save())));
    new obsidian.Setting(el).setName("Лимит узлов").addText((t) => t.setValue(String(s.maxNodes)).onChange((v) => ((s.maxNodes = num(v, 4000)), save())));
    new obsidian.Setting(el)
      .setName("Файл иерархического оглавления")
      .setDesc("Пересобирается командой «Lecture Graph: Regenerate course index» по главам/секциям/заголовкам/блокам со счётчиками ссылок.")
      .addText((t) => t.setValue(s.indexNote).onChange((v) => ((s.indexNote = v.trim() || "Course Index.md"), save())));
    new obsidian.Setting(el)
      .setName("Заметка про графы для ссылки из оглавления")
      .setDesc("Пусто — не ссылаться. Имя ищется среди заметок хранилища.")
      .addText((t) => t.setValue(s.indexGraphDoc).onChange((v) => ((s.indexGraphDoc = v.trim()), save())));
    new obsidian.Setting(el).setName("Папка экспорта").addText((t) => t.setValue(s.exportFolder).onChange((v) => ((s.exportFolder = v.trim() || "90 - Exports"), save())));
    el.createEl("h3", { text: "Сообщения у вершин" });
    new obsidian.Setting(el)
      .setName("Папка заметок-сообщений")
      .setDesc("Эта папка исключена из обхода графа: заметка сообщения не становится вершиной.")
      .addText((t) => t.setValue(s.captionFolder).onChange((v) => ((s.captionFolder = v.trim() || "45 - Captions"), save())));
    new obsidian.Setting(el)
      .setName("Шаблон сообщения для главы")
      .setDesc("Пусто — встроенный текст. Плейсхолдеры: {{title}}, {{title_zh}}, {{id}}, {{type}}.")
      .addText((t) => t.setValue(s.captionChapterTemplate).onChange((v) => ((s.captionChapterTemplate = v.trim()), save())));
    new obsidian.Setting(el)
      .setName("Шаблон сообщения для секции")
      .addText((t) => t.setValue(s.captionSectionTemplate).onChange((v) => ((s.captionSectionTemplate = v.trim()), save())));
    new obsidian.Setting(el)
      .setName("Шаблон сообщения для заголовка")
      .addText((t) => t.setValue(s.captionHeadingTemplate).onChange((v) => ((s.captionHeadingTemplate = v.trim()), save())));
    new obsidian.Setting(el)
      .setName("Шаблон сообщения для блока")
      .setDesc("Плейсхолдеры те же; пусто — встроенный текст. Сообщение показывается при клике по вершине ЛЮБОГО типа.")
      .addText((t) => t.setValue(s.captionBlockTemplate).onChange((v) => ((s.captionBlockTemplate = v.trim()), save())));

    el.createEl("h3", { text: "Ключевые фразы" });
    new obsidian.Setting(el)
      .setName("Считать рёбра по ключевым фразам")
      .setDesc(
        "Список keywords_en: в свойствах блока ищется точными совпадениями (без учёта регистра) по аннотациям корпуса: " +
        "вхождение в тексте до первого «##» даёт связь с секцией, вхождение под «## Имя заголовка» — с заголовком. " +
        "Число вхождений = вес вершины (он же размер), глава с максимумом вхождений = её цвет. " +
        "Ссылки создаёт команда «Recompute keyword links»; выключено — граф снова только по ручным ссылкам."
      )
      .addToggle((t) => t.setValue(s.keywordLinks !== false).onChange((v) => ((s.keywordLinks = v), save(), this.plugin.changed(true))));
    new obsidian.Setting(el)
      .setName("Папка аннотаций (корпус для фраз)")
      .setDesc("Держите её вне списка папок графа (или в исключённых): аннотации питают веса, но вершинами не становятся.")
      .addText((t) => t.setValue(s.keywordFolder).onChange((v) => ((s.keywordFolder = v.trim() || "35 - Abstracts"), save())));

    el.createEl("h3", { text: "Цвета по типам" });
    TYPES.forEach((t) => {
      new obsidian.Setting(el).setName(TYPE_LABEL[t] || t).setDesc("тип вершины: " + t).addText((x) => x.setValue(s.colors[t]).onChange((v) => ((s.colors[t] = v), save(), this.plugin.changed())));
    });

    el.createEl("h3", { text: "Раскладка" });
    var lay = s.layout;
    var slider = function (name, key, min, max, step, desc) {
      var st = new obsidian.Setting(el).setName(name);
      if (desc) st.setDesc(desc);
      st.addSlider((t) => t.setLimits(min, max, step).setValue(lay[key]).onChange((v) => ((lay[key] = v), save(), this.plugin.relayout())));
      return st;
    };
    var toggle = function (name, key, desc) {
      var st = new obsidian.Setting(el).setName(name);
      if (desc) st.setDesc(desc);
      st.addToggle((t) => t.setValue(lay[key] !== false).onChange((v) => ((lay[key] = v), save(), this.plugin.relayout())));
      return st;
    };
    new obsidian.Setting(el)
      .setName("Чем раскладывать")
      .setDesc("fdp - пружинный оптимизатор (Fruchterman-Reingold), neato - стресс-мажоризация, twopi - радиальные слои от корня, «кластеры по главам» - детерминированные сектора с гарантией, что структурные рёбра не пересекаются, «чистая физика» - живой силовой цикл. Подписи и круги во всех режимах в финале раздвигаются, поэтому картинка не зависит от того, на каком кадре вы на неё посмотрели.")
      .addDropdown((d) => {
        LAYOUT_MODES.forEach((o) => d.addOption(o[0], o[1]));
        d.setValue(lay.mode).onChange((v) => ((lay.mode = v), save(), this.plugin.relayout()));
      });
    slider("Стягивание по главам", "clusterPull", 0, 0.15, 0.005,
      "притяжение вершины к центру своей главы: держит главы отдельными пятнами (у twopi главы и так идут секторами)")
      .addExtraButton((b) => b.setIcon("reset").setTooltip("сброс").onClick(() => ((lay.clusterPull = 0.035), save(), this.display())));
    slider("Итераций fdp", "fdpIters", 40, 900, 20, "сколько шагов охлаждённого отталкивания/притяжения сделать после прогрева");
    slider("Итераций neato", "neatoIters", 20, 300, 10, "шагов стресс-мажоризации (сначала идёт градиентный прогрев, он же 40 % этого числа)");
    slider("Шаг слоя twopi", "twopiRankSep", 0.6, 2.4, 0.05, "насколько раздвигать радиальные слои в диаметрах вершины - крутя ползунок, видно «плотные кольца ↔ airy»");
    new obsidian.Setting(el)
      .setName("Корень для twopi")
      .setDesc("id вершины (Ch03, Ch03-S02 - как в имени файла); пусто = глава с самым большим подграфом")
      .addText((t) => {
        t.setPlaceholder("Ch01").setValue(lay.twopiRoot || "").onChange((v) => ((lay.twopiRoot = v.trim()), save()));
        t.inputEl.addEventListener("keydown", (ev) => { if (ev.key === "Enter") this.plugin.relayout(); });
      });
    toggle("Расходиться кругами", "postCircles", "пост-обработка движка: вершины раздвигаются, пока кружки не перестанут наезжать друг на друга");
    toggle("Расходиться подписями", "postLabels", "метки (вторая строка с иероглифами учитывается по реальной ширине) раздвигаются до нуля наложений; структура движка сохраняется, сдвиг ограничен следующим ползунком");
    slider("Предельный сдвиг при разведении", "dispCap", 0.1, 2, 0.05,
      "доля размера графа, на которую пост-обработка имеет право сдвинуть вершину; меньше - верности структуре больше, но возможны «проходы на вырост» (весь граф чуть крупнее)");
    slider("Длина связи", "linkDistance", 10, 160, 1, "желаемое расстояние между концами связи -basis для fdp/neato");
    slider("Отталкивание", "repel", 100, 4000, 50, "сила отталкивания для «чистой физики» (и прогрев fdp)");
    slider("Притяжение к центру", "gravity", 0, 0.3, 0.005, "для «чистой физики»: к центру графа");
    slider("Радиус колец", "radius", 200, 3000, 50, "для «кластеров» и «физики»: базовый радиус упаковка-колец");
  }
}

/* ------------------------------------------------------------------ plugin */

class LectureGraphPlugin extends obsidian.Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS);
    this.settings.colors = Object.assign({}, DEFAULT_SETTINGS.colors);
    this.settings.layout = Object.assign({}, DEFAULT_SETTINGS.layout);
    this.settings.filters = Object.assign({}, DEFAULT_SETTINGS.filters, {
      types: Object.assign({}, DEFAULT_SETTINGS.filters.types),
    });
    var loaded = await this.loadData();
    if (loaded && typeof loaded === "object") {
      this.settings = Object.assign(this.settings, loaded);
      this.settings.colors = Object.assign({}, DEFAULT_SETTINGS.colors, loaded.colors || {});
      this.settings.layout = Object.assign({}, DEFAULT_SETTINGS.layout, loaded.layout || {});
      this.settings.filters = Object.assign({}, DEFAULT_SETTINGS.filters, loaded.filters || {}, {
        types: Object.assign({}, DEFAULT_SETTINGS.filters.types, (loaded.filters && loaded.filters.types) || {}),
      });
    }

    this.cache = null;
    this.cacheDirty = true;
    this.cacheVersion = 0;
    this.graphBuildPromise = null;
    this.pending = null;
    this.refreshing = false;
    this.refreshQueued = false;
    // Пути, которые прямо сейчас пишет сам плагин. Их modify-события не должны
    // запускать сотни одинаковых refresh/layout во время пакетных команд.
    this.internalWrites = {};

    this.addRibbonIcon("git-fork", "Lecture graph (полный экран — Shift+клик)", (ev) => this.activateView(!!(ev && (ev.shiftKey || ev.ctrlKey))));
    this.addCommand({
      id: "open-view",
      name: "Open graph view",
      callback: () => this.activateView(),
    });
    this.addCommand({
      id: "edit-label",
      name: "Edit label of current note (EN / 中文)",
      editorCallback: () => {
        var f = this.app.workspace.getActiveFile();
        if (!f) return new obsidian.Notice("Откройте заметку");
        var node = this.nodeByPath(f.path);
        if (node) this.editLabel(node);
        else this.editFile(f.path, { name: this.fileName(f.path, this.settings.nameKey), nameZh: this.fileName(f.path, this.settings.nameZhKey) });
      },
    });
    this.addCommand({
      id: "toggle-fullscreen",
      name: "Toggle full screen",
      callback: () => {
        var v = this.view();
        if (!v) this.activateView(true);
        else v.toggleFullscreen();
      },
    });
    this.addCommand({
      id: "open-view-fullscreen",
      name: "Open graph in full screen",
      callback: () => this.activateView(true),
    });
    this.addCommand({
      id: "zoom-in",
      name: "Zoom graph in",
      callback: () => { var v = this.view(); if (v) v.zoomBy(ZOOM_STEP); },
    });
    this.addCommand({
      id: "zoom-out",
      name: "Zoom graph out",
      callback: () => { var v = this.view(); if (v) v.zoomBy(1 / ZOOM_STEP); },
    });
    this.addCommand({
      id: "zoom-fit",
      name: "Fit graph to view",
      callback: () => { var v = this.view(); if (v) v.fit(); },
    });
    this.addCommand({
      id: "bump-font-up",
      name: "Increase label font size",
      callback: () => { var v = this.view(); if (v) v.bumpFont(1); },
    });
    this.addCommand({
      id: "bump-font-down",
      name: "Decrease label font size",
      callback: () => { var v = this.view(); if (v) v.bumpFont(-1); },
    });
    this.addCommand({
      id: "rebuild",
      name: "Rebuild graph now",
      callback: () => this.changed(true),
    });
    this.addCommand({
      id: "export-svg",
      name: "Export current graph as SVG",
      callback: async () => {
        var view = this.view();
        await this.exportSVG(view ? view.exportGraph() : await this.getGraph(false));
      },
    });
    this.addCommand({
      id: "export-json",
      name: "Export current graph as JSON",
      callback: async () => {
        var view = this.view();
        await this.exportJSON(view ? view.exportGraph() : await this.getGraph(false));
      },
    });
    this.addCommand({
      id: "edit-caption",
      name: "Edit info message of current note (caption)",
      editorCallback: () => {
        var f = this.app.workspace.getActiveFile();
        if (!f) return new obsidian.Notice("\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u0437\u0430\u043c\u0435\u0442\u043a\u0443");
        var node = this.nodeByPath(f.path);
        if (!node) return new obsidian.Notice("\u0417\u0430\u043c\u0435\u0442\u043a\u0430 \u043d\u0435 \u044f\u0432\u043b\u044f\u0435\u0442\u0441\u044f \u0432\u0435\u0440\u0448\u0438\u043d\u043e\u0439 \u0433\u0440\u0430\u0444\u0430");
        this.openCaption(node);
      },
    });
    this.addCommand({
      id: "export-csv",
      name: "Export labels + reference counts (CSV)",
      callback: async () => {
        var g = await this.getGraph(false);
        await this.writeFile(this.settings.exportFolder + "/lecture-labels-" + stamp() + ".csv", core.toCsv(g));
      },
    });
    this.addCommand({
      id: "labels-note",
      name: "Save labels table as a note (markdown)",
      callback: async () => {
        var g = await this.getGraph(false);
        await this.writeFile(this.settings.exportFolder + "/Labels table.md", core.toMarkdown(g, { limit: 120 }));
      },
    });
    this.addCommand({
      id: "write-index",
      name: "Regenerate course index (hierarchical TOC note)",
      callback: () => this.writeIndex(),
    });
    this.addCommand({
      id: "write-counts",
      name: "Write reference counts into frontmatter (refs: N)",
      callback: () => this.writeCounts(),
    });
    this.addCommand({
      id: "recompute-keywords",
      name: "Recompute keyword links (search keywords_en in abstracts)",
      callback: () => this.recomputeKeywords(),
    });
    this.addCommand({
      id: "create-node",
      name: "Create new node (EN / 中文 / keywords) with auto-search of related topics",
      callback: () => new CreateNodeModal(this.app, this, {}).open(),
    });

    this.registerView(VIEW_TYPE, (leaf) => {
      var v = new LectureGraphView(leaf);
      v._plugin = this;
      return v;
    });

    this.register(this.app.workspace.on("file-menu", (menu, file) => {
      var idx = this.indexMenuAction(file);
      if (idx) {
        menu.addItem((it) =>
          it
            .setTitle(idx.update ? "Обновить оглавление курса" : "Создать оглавление курса")
            .setIcon(idx.update ? "refresh-cw" : "list-tree")
            .setSection("creation")
            .onClick(() => this.writeIndex({ at: idx.path }))
        );
      }
      if (!(file instanceof obsidian.TFile) || file.extension !== "md") return;
      menu.addItem((it) =>
        it
          .setTitle("Edit graph label")
          .setIcon("pencil")
          .onClick(async () => {
            var g = await this.getGraph(false);
            var node = g.nodes.find((n) => n.path === file.path);
            if (!node) new obsidian.Notice("Заметка не является вершиной графа (нет type: в frontmatter)");
            else this.editLabel(node);
          })
      );
    }));

    this.registerEvent(
      this.app.vault.on("modify", (f) => {
        if (!this.settings.autoRefresh || !f || f.extension !== "md") return;
        if (this.isInternalWrite(f.path) || !this.isGraphPath(f.path)) return;
        this.changed();
      })
    );

    this.addSettingTab(new LectureGraphSettingTab(this.app, this));
  }

  onunload() {
    this.cache = null;
    this.graphBuildPromise = null;
    clearTimeout(this.pending);
    this.pending = null;
  }

  async activateView(fullscreen) {
    var existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    var leaf = existing.length ? existing[0] : this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
    var self = this;
    var v = leaf.view;
    if (fullscreen && v && v.toggleFullscreen) setTimeout(function () { v.toggleFullscreen(true); }, 60);
    return leaf;
  }

  view() {
    var leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    return leaves.length ? leaves[0].view : null;
  }

  labelThreshold() {
    // правило живёт в ядре: порог = квантиль шкалы размеров, поэтому набор подписей
    // не меняется от ползунка «Размер вершин»
    return core.labelThreshold(this.settings);
  }

  stamp() {
    return stamp();
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  forEachView(cb) {
    this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach((l) => {
      if (l.view) cb(l.view);
    });
  }

  refreshSizes() {
    var v = this.view();
    if (v) v.applySizesNow();
  }

  relayout() {
    var any = false;
    this.forEachView((v) => {
      if (!v || !v.graph) return;
      any = true;
      v.relayoutNow();
    });
    // Открытый вид уже переложил тот же объект кэша. Старый код после этого ещё
    // запускал changed() и строил/раскладывал граф второй раз, особенно заметно в
    // force и clusters. Без открытого вида координаты пересчитаются лениво при open.
    if (!any) this.markGraphDirty();
  }

  /** Инвалидация модели с версией защищает от результата устаревшего async-чтения. */
  markGraphDirty() {
    this.cacheDirty = true;
    this.cacheVersion = (this.cacheVersion || 0) + 1;
  }

  /** Список папок из настройки в нормализованном виде. */
  graphFolderList(key) {
    return String(this.settings[key] || "")
      .split(",")
      .map((x) => x.trim().replace(/\\/g, "/").replace(/\/+$/, ""))
      .filter(Boolean);
  }

  /** Может ли изменение этого пути вообще изменить модель графа? */
  isGraphPath(path) {
    var p = String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
    var folders = this.graphFolderList("folders");
    var excluded = this.graphFolderList("excludeFolders");
    var inFolders = !folders.length || folders.some(function (d) { return p === d || p.indexOf(d + "/") === 0; });
    return inFolders && !excluded.some(function (d) { return p === d || p.indexOf(d + "/") === 0; });
  }

  isInternalWrite(path) {
    var key = String(path || "").replace(/\\/g, "/");
    return !!(this.internalWrites && this.internalWrites[key]);
  }

  /** Выполнить собственную запись, не реагируя на её же vault modify-событие. */
  async withInternalWrite(path, action) {
    var key = String(path || "").replace(/\\/g, "/");
    var writes = this.internalWrites || (this.internalWrites = {});
    writes[key] = (writes[key] || 0) + 1;
    try {
      return await action();
    } finally {
      if (--writes[key] <= 0) delete writes[key];
    }
  }

  async processInternal(file, updater) {
    var self = this;
    return this.withInternalWrite(file.path, function () {
      return self.app.vault.process(file, updater);
    });
  }

  changed(rebuild) {
    // Сначала помечаем кэш: события modify могут прийти во время уже идущей сборки.
    this.markGraphDirty();
    if (rebuild) this.captions = {}; // тексты читались из старых объектов — перечитаем
    // Trailing debounce собирает серию сохранений в одну пересборку. Это особенно
    // важно для writeCounts / keyword materializer, которые меняют много заметок.
    if (this.pending) clearTimeout(this.pending);
    var self = this;
    this.pending = setTimeout(async function () {
      self.pending = null;
      if (self.refreshing) {
        self.refreshQueued = true;
        return;
      }
      self.refreshing = true;
      try {
        do {
          self.refreshQueued = false;
          var leaves = self.app.workspace.getLeavesOfType(VIEW_TYPE);
          // cacheDirty уже выставлен, поэтому force не нужен и не отменит совместную сборку.
          await Promise.all(leaves.map(function (l) { return l.view && l.view.refresh(false); }));
        } while (self.refreshQueued);
      } finally {
        self.refreshing = false;
      }
    }, 600);
  }

  /* -------------------------------------------------- данные */

  async getGraph(force) {
    if (force) this.markGraphDirty();
    while (!this.cache || this.cacheDirty) {
      var build = this.graphBuildPromise;
      if (!build) {
        var version = this.cacheVersion || 0;
        var self = this;
        build = (async function () {
          var opts = buildOptions(self.settings);
          var graph = await self.buildGraphModel(opts);
          // Прогреваем раскладку до готового снимка. Для force оставляем короткий
          // старт с полировкой: дальнейшая физика идёт кадрами в View, а не блокирует UI.
          var lay = self.settings.layout || {};
          var liveForce = lay.mode === "force";
          core.initPositions(graph.nodes, { width: 1200, height: 800, graph: graph, layout: lay });
          core.run(graph, {
            layout: lay, config: opts, width: 1600, height: 1100,
            iterations: liveForce ? Math.min(24, Math.max(1, num(lay.iterations, 700))) : (graph.nodes.length > 800 ? 420 : 560),
            polishNoOverlap: true,
          });
          graph._lgCacheVersion = version;
          // Не публикуем снимок, если пока читали файлы пришло новое изменение.
          if ((self.cacheVersion || 0) !== version) return graph;
          self.cache = graph;
          self.cacheDirty = false;
          self.lastStats = graph.stats;
          self.nodeByPathIndex = {};
          graph.nodes.forEach(function (n) { self.nodeByPathIndex[n.path] = n; });
          // Открытые view получают ровно этот объект. refresh() ниже заметит это и
          // не будет повторно запускать дорогую раскладку.
          self.forEachView(function (v) {
            if (v.graph !== graph) v.adoptGraph(graph, true);
          });
          return graph;
        })();
        this.graphBuildPromise = build;
      }
      var graph;
      try {
        graph = await build;
      } finally {
        // Ошибка чтения не должна навечно оставить rejected Promise в кэше in-flight.
        if (this.graphBuildPromise === build) this.graphBuildPromise = null;
      }
      if (this.cache === graph && !this.cacheDirty) return graph;
      // Снимок устарел во время чтения; следующий проход либо подхватит уже
      // начатую сборку, либо создаст одну новую — параллельных layout не будет.
    }
    return this.cache;
  }

  /** Собрать модель из свежих файлов без координат: для операций с метаданными. */
  async buildGraphModel(opts) {
    opts = opts || buildOptions(this.settings);
    return core.buildGraph(await this.collectNotes(opts), opts);
  }

  async collectNotes(opts) {
    var files = this.app.vault.getMarkdownFiles().filter((f) => this.isGraphPath(f.path));
    var limit = num(this.settings.maxNodes, 4000);
    if (files.length > limit) {
      new obsidian.Notice("Узлов больше лимита (" + limit + "): часть заметок не вошла. Увеличьте «Лимит узлов» или сузьте папки.");
      files = files.slice(0, limit);
    }
    // cachedRead в Obsidian асинхронный. Последовательное чтение тысячи заметок
    // превращало холодный старт в цепочку I/O await. Ограниченный пул бережёт диск,
    // сохраняет порядок файлов и заметно сокращает время сборки на больших vault.
    var out = new Array(files.length);
    var cursor = 0;
    var workers = Math.min(24, Math.max(1, files.length));
    var self = this;
    async function readWorker() {
      while (true) {
        var i = cursor++;
        if (i >= files.length) return;
        var f = files[i];
        var text;
        try {
          text = await self.app.vault.cachedRead(f);
        } catch (e) {
          continue;
        }
        var parsed = core.parseFrontmatter(text);
        var type = String((parsed.data && parsed.data[opts.typeKey]) || "").trim().toLowerCase();
        if (TYPES.indexOf(type) >= 0) out[i] = { path: f.path, frontmatter: parsed.data, body: parsed.body };
      }
    }
    var jobs = [];
    for (var w = 0; w < workers; w++) jobs.push(readWorker());
    await Promise.all(jobs);
    return out.filter(Boolean);
  }

  nodeByPath(path) {
    if (!this.cache) return null;
    return (this.nodeByPathIndex && this.nodeByPathIndex[path]) || this.cache.nodes.find((n) => n.path === path) || null;
  }

  fileName(path, key) {
    var name = path.replace(/^.*\//, "").replace(/\.md$/i, "");
    return key === "name" ? name : "";
  }

  /* -------------------------------------------------- запись подписей */

  async editLabel(node) {
    if (!node) return;
    if (node.inline) {
      new obsidian.Notice("Инлайн-блок: подпись правится текстом заметки, frontmatter не используется.");
      return;
    }
    var file = this.app.vault.getAbstractFileByPath(node.path);
    if (!(file instanceof obsidian.TFile)) {
      new obsidian.Notice("Файл не найден: " + node.path);
      return;
    }
    new EditLabelModal(this.app, this, node).open();
  }

  async editFile(path, node) {
    var file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof obsidian.TFile) {
      new EditLabelModal(this.app, this, { path: path, name: node.name || "", nameZh: node.nameZh || "", inline: false }).open();
    }
  }

  async writeLabel(node, nameEn, nameZh) {
    var file = this.app.vault.getAbstractFileByPath(node.path);
    if (!(file instanceof obsidian.TFile)) {
      new obsidian.Notice("Файл не найден");
      return false;
    }
    var patch = {};
    patch[this.settings.nameKey] = (nameEn || "").trim();
    patch[this.settings.nameZhKey] = (nameZh || "").trim();
    try {
      await this.processInternal(file, (data) => core.setFrontmatterValues(data, patch));
      // обновим узел на лету, не перестраивая граф
      node.name = core.sanitizeLabel((nameEn || "").trim() || node.stem);
      node.nameZh = core.sanitizeLabel((nameZh || "").trim());
      var v = this.view();
      if (v) {
        // подпись стала длиннее/короче -> пересчитываем кегль и упаковку, иначе метки
        // снова начнут наезжать друг на друга
        v.applySizesNow();
        v.updateStatus();
      }
      return true;
    } catch (e) {
      new obsidian.Notice("Не удалось записать: " + (e && e.message ? e.message : e));
      return false;
    }
  }

  /** Имя файла оглавления — из настройки, чтобы меню и команда палитры писали в одно место. */
  indexBaseName() {
    var t = String(this.settings.indexNote || "").trim().replace(/\\/g, "/");
    var base = t.slice(t.lastIndexOf("/") + 1).replace(/\.md$/i, "");
    return base || "Course Index";
  }

  /**
   * Что делать пункту контекстного меню: правый клик по папке (или по пустому месту
   * «Проводника» — там корень хранилища) создаёт оглавление в этой папке; клик по заметке —
   * в её папке; клик по самой заметке оглавления обновляет её, а не плодит дубль.
   */
  indexMenuAction(file) {
    var dir = "";
    var target = "";
    var base = this.indexBaseName();
    if (file instanceof obsidian.TFolder) {
      dir = String(file.path || "");
      if (typeof file.isRoot === "function" && file.isRoot()) dir = "";
    } else if (file instanceof obsidian.TFile) {
      if (file.extension !== "md") return null;
      dir = String((file.parent && file.parent.path) || "");
      if (file.basename === base) target = file.path; // обновляем на месте
    } else {
      return null;
    }
    dir = dir.replace(/\/+$/, "");
    if (dir === "/") dir = "";
    if (!target) target = dir ? dir + "/" + base + ".md" : base + ".md";
    return { path: obsidian.normalizePath(target), update: !!this.app.vault.getAbstractFileByPath(obsidian.normalizePath(target)) };
  }

  /**
   * Пересобирает заметку-оглавление (главы → секции → заголовки → блоки) из тех же данных,
   * что и граф: счётчики `⇠ N` в оглавлении всегда настоящие, а не «на глаз».
   * `opts.at` — путь из контекстного меню; без него — путь из настройки `indexNote`.
   */
  async writeIndex(opts) {
    var at = opts && opts.at ? String(opts.at).trim() : "";
    var target = (at || this.settings.indexNote || "Course Index.md").trim();
    if (!/\.md$/i.test(target)) target += ".md";
    var g = await this.getGraph(false);
    var app = this.app;
    var self = this;
    var doc = (this.settings.indexGraphDoc || "").trim();
    var md = core.toIndexMarkdown(g, {
      stamp: new Date().toISOString().slice(0, 16).replace("T", " "),
      graphDoc: doc,
      resolve: function (stem) {
        return app.vault.getMarkdownFiles().some(function (f) {
          return f.basename === stem;
        });
      },
    });
    try {
      var file = await this.writeFile(target, md);
      // заметку могли создать в другой папке — путь по умолчанию едет за ней, иначе команда
      // палитры и «Обновить» из меню писали бы в два разных файла
      if (at && this.settings.indexNote !== file.path) {
        this.settings.indexNote = file.path;
        await this.saveSettings();
      }
      new obsidian.Notice((at ? "Оглавление курса: " : "Оглавление пересобрано: ") + file.path +
        " · " + g.nodes.length + " вершин · " + g.stats.edges + " связей");
      return file;
    } catch (e) {
      new obsidian.Notice("Не удалось записать оглавление: " + (e && e.message ? e.message : e));
      return null;
    }
  }

  async writeCounts() {
    // refs — производное поле: берём готовый снимок и не раскладываем его заново.
    var g = await this.getGraph(false);
    var n = 0;
    for (var i = 0; i < g.nodes.length; i++) {
      var node = g.nodes[i];
      if (node.inline) continue;
      var file = this.app.vault.getAbstractFileByPath(node.path);
      if (!(file instanceof obsidian.TFile)) continue;
      await this.processInternal(file, (data) => {
        var fm = core.parseFrontmatter(data);
        if (Number(fm.data.refs) === node.degree) return data;
        return core.setFrontmatterValues(data, { refs: node.degree });
      });
      n++;
    }
    new obsidian.Notice("Проставлено refs для " + n + " заметок");
  }

  /** Заметки корпуса: папка из настройки намеренно исключена из обхода графа, читаем напрямую. */
  async keywordCorpusNotes() {
    var folder = String(this.settings.keywordFolder || core.DEFAULTS.keywordFolder || "").replace(/\/+$/, "");
    var out = [];
    if (!folder) return out;
    var files = this.app.vault.getMarkdownFiles().filter(function (f) {
      return f.path.indexOf(folder + "/") === 0;
    });
    files.sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; });
    for (var i = 0; i < files.length; i++) {
      out.push({ path: files[i].path, text: await this.app.vault.cachedRead(files[i]) });
    }
    return out;
  }

  /**
   * Этап 2: превращает `keywords_en:` в настоящие wiki-ссылки (между маркерами
   * keywords:begin/end) и в свойство weight:. Работает для вершины любого уровня —
   * регион ключевых фраз читается графом у всех заметок, не только у блоков.
   * Свойства и тело вне региона не трогаются, второй прогон байт-в-байт
   * идемпотентен; заметки без списка фраз остаются как есть.
   */
  async recomputeKeywords() {
    var opts = buildOptions(this.settings);
    // Плану keyword-ссылок нужны свежие frontmatter/body, но не координаты. Читаем
    // модель напрямую, чтобы не делать полную раскладку и до, и после batch-записи.
    var g = await this.buildGraphModel(opts);
    var abs = await this.keywordCorpusNotes();
    if (!abs.length) {
      new obsidian.Notice("Папка корпуса «" + opts.keywordFolder + "» пуста — ключевые фразы искать негде");
      return null;
    }
    var corpus = core.buildKeywordCorpus(abs, g, opts);
    var weightKey = opts.weightKey || "weight";
    var touched = 0, planned = 0, sumWeight = 0, flipped = 0, cleaned = 0;
    var marks = core.keywordMarkers();
    for (var i = 0; i < g.nodes.length; i++) {
      var n = g.nodes[i];
      if (n.inline || !n.path) continue;
      var file = this.app.vault.getAbstractFileByPath(n.path);
      if (!(file instanceof obsidian.TFile)) continue;
      var hasRegion = String(n.body || "").indexOf(marks.begin) >= 0;
      if (!(n.keywords && n.keywords.length)) {
        if (!hasRegion) continue; // заметка живёт только на ручных ссылках — не трогаем
        await this.processInternal(file, (data) => {
          var off = {};
          off[weightKey] = "";
          var next = core.setFrontmatterValues(core.applyKeywordRegion(data, ""), off);
          if (next === data) return data;
          cleaned++;
          return next;
        });
        continue;
      }
      var plan = core.planBlockKeywords(n.data, corpus, n.chapter, opts);
      planned++;
      sumWeight += plan.weight;
      if (plan.dominant && n.chapter && plan.dominant !== n.chapter) flipped++;
      var want = core.keywordRegionText(plan, opts);
      await this.processInternal(file, (data) => {
        var patch = {};
        patch[weightKey] = plan.weight;
        var next = core.setFrontmatterValues(core.applyKeywordRegion(data, want), patch);
        if (next === data) return data;
        touched++;
        return next;
      });
    }
    // После серии внутренних записей строим и публикуем один свежий снимок.
    var fresh = await this.getGraph(true);
    var kw = fresh.edges.filter(function (e) { return e.kind === "keyword"; }).length;
    var msg =
      "Ключевые фразы: вершин с весом " + fresh.stats.keywordNodes + " · ссылок " + kw +
      " · записей обновлено " + touched + (cleaned ? " · снято " + cleaned : "") +
      (flipped ? " · окрашено по чужой главе " + flipped : "") +
      (corpus.stats.unmatched ? " · НЕ СОПОСТАВЛЕНО заголовков в корпусе: " + corpus.stats.unmatched : "");
    new obsidian.Notice(msg);
    // getGraph(true) выше уже обновил cache и все View; повторный changed() только
    // запустил бы ещё одну полную пересборку через debounce.
    return { planned: planned, touched: touched, cleaned: cleaned, flipped: flipped, weight: sumWeight, edges: kw };
  }

  /* -------------------------------------------------- создание узла из графа */

  /** Имя файла из названия: без символов, запрещённых в путях. */
  safeNoteName(s) {
    return (
      String(s || "")
        .replace(/[\\/:*?"<>|#^[\]]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80) || "Untitled"
    );
  }

  /**
   * Папка для новой вершины: там же, где живут её соседи по уровню. Сначала ищем
   * самую популярную папку среди вершин того же типа, затем — самую популярную
   * подпапку среди вершин той же главы (30 - Blocks/Ch05 и т.п.). Пусто — папка
   * родителя, затем первая папка обхода, и только потом корень хранилища.
   */
  folderForNewNode(g, type, chapter, parentNode) {
    var folders = this.graphFolderList("folders");
    var votes = {};
    var chapterVotes = {};
    (g.nodes || []).forEach(function (n) {
      if (!n || n.type !== type || !n.path) return;
      var top = null;
      for (var i = 0; i < folders.length; i++) {
        if (n.path === folders[i] || n.path.indexOf(folders[i] + "/") === 0) {
          top = folders[i];
          break;
        }
      }
      if (top === null) top = n.path.indexOf("/") >= 0 ? n.path.slice(0, n.path.indexOf("/")) : "";
      votes[top] = (votes[top] || 0) + 1;
      if (chapter && n.chapter === chapter) {
        var d = n.path.slice(0, n.path.lastIndexOf("/"));
        if (d) chapterVotes[d] = (chapterVotes[d] || 0) + 1;
      }
    });
    var best = null;
    var bestN = 0;
    Object.keys(votes)
      .sort()
      .forEach(function (k) {
        if (votes[k] > bestN) {
          bestN = votes[k];
          best = k;
        }
      });
    var sub = null;
    var subN = 0;
    Object.keys(chapterVotes)
      .sort()
      .forEach(function (k) {
        if (chapterVotes[k] > subN) {
          subN = chapterVotes[k];
          sub = k;
        }
      });
    if (sub) return sub;
    if (best) return best;
    if (parentNode && parentNode.path) return parentNode.path.slice(0, parentNode.path.lastIndexOf("/")) || "";
    return folders.length ? folders[0] : "";
  }

  /**
   * Создание вершины из окна графа: заметка с двустрочной подписью (EN + 中文),
   * списком ключевых фраз и — сразу после записи — автоматическим поиском связанных
   * тем. Поиск двухъярусный:
   *   1) ключевые фразы ищутся в корпусе аннотаций (buildKeywordCorpus): найденные
   *      секции/заголовки материализуются wiki-ссылками между keywords:begin/end
   *      (рёбра «keyword»), число вхождений пишется в weight: и задаёт размер вершины;
   *   2) название и фразы, ТОЧНО совпадающие с именем другой вершины, дают раздел
   *      «Related topics» в теле заметки (обычные рёбра «reference») — так находятся
   *      и главы, и блоки, которых в текстах аннотаций нет.
   * Глава без родителя берётся у главы-лидера по вхождениям (plan.dominant), поэтому
   * заметка ложится в папку той главы, о которой больше всего говорит её содержимое.
   */
  async createNewNode(input) {
    input = input || {};
    var opts = buildOptions(this.settings);
    var type = TYPES.indexOf(input.type) >= 0 ? input.type : "block";
    var nameEn = core.sanitizeLabel(String(input.nameEn || "").trim());
    var nameZh = core.sanitizeLabel(String(input.nameZh || "").trim());
    if (!nameEn) {
      new obsidian.Notice("Название (EN) обязательно: это первая строка подписи вершины");
      return null;
    }
    var keywords = core.parseKeywords(input.keywords);
    // 1. Свежая модель без раскладки: для id, родителей, голосования папок и поиска.
    var g = await this.buildGraphModel(opts);
    var parentNode = null;
    if (input.parent) {
      parentNode = (g._byId && g._byId[input.parent]) || null;
      if (!parentNode) {
        new obsidian.Notice("Родитель не найден в графе: " + input.parent);
        return null;
      }
    }
    // 2. Id по конвенции курса (родитель + суффикс уровня) или из серии MN-… .
    var id = core.nextNodeId(g, type, parentNode ? parentNode.id : null);
    // 3. Своя глава: у родителя она известна, без родителя решит поиск по корпусу.
    var chapter = parentNode
      ? parentNode.chapter || (parentNode.type === "chapter" ? parentNode.id : null)
      : null;
    var plan = null;
    if (keywords.length) {
      var abs = await this.keywordCorpusNotes();
      if (!abs.length) {
        new obsidian.Notice("Папка корпуса «" + opts.keywordFolder + "» пуста — связи по ключевым фразам не построены");
      } else {
        var corpus = core.buildKeywordCorpus(abs, g, opts);
        var kwData = {};
        kwData[opts.keywordsKey || "keywords_en"] = keywords;
        plan = core.planBlockKeywords(kwData, corpus, chapter, opts);
      }
    }
    if (!chapter && plan && plan.dominant) chapter = plan.dominant;
    // 4. Второй ярус: темы, чьё название совпало с названием/фразой новой вершины.
    var exclude = parentNode ? [parentNode.id] : [];
    if (plan) {
      plan.targets.forEach(function (t) {
        exclude.push(t.id);
      });
    }
    var related = core
      .relatedByName(g, [nameEn].concat(keywords), { exclude: exclude })
      .map(function (r) {
        return { stem: r.node.stem, name: r.node.name, phrase: r.phrase, type: r.node.type, id: r.node.id };
      });
    // 5. Папка и путь без коллизий: перезаписывать чужую заметку нельзя.
    var dir = this.folderForNewNode(g, type, chapter, parentNode);
    var base = id + " - " + this.safeNoteName(nameEn);
    var rel = (dir ? dir + "/" : "") + base + ".md";
    var bump = 2;
    while (this.app.vault.getAbstractFileByPath(obsidian.normalizePath(rel))) {
      rel = (dir ? dir + "/" : "") + base + " " + bump + ".md";
      bump++;
    }
    // 6. Текст заметки: frontmatter по конвенциям + регион ключевых фраз + Related topics.
    var text = core.composeNote(
      {
        type: type,
        id: id,
        name: nameEn,
        nameZh: nameZh,
        status: "draft",
        parent: parentNode ? parentNode.id : null,
        chapter: chapter,
        keywords: keywords,
        weight: plan ? plan.weight : null,
        region: plan ? core.keywordRegionText(plan, opts) : "",
        related: related,
      },
      opts
    );
    var file;
    try {
      file = await this.writeFile(rel, text);
    } catch (e) {
      new obsidian.Notice("Не удалось создать заметку: " + (e && e.message ? e.message : e));
      return null;
    }
    // 7. Пересборка графа и выбор новой вершины: пользователь сразу видит её связи.
    var fresh = await this.getGraph(true);
    var node = (fresh._byId && fresh._byId[id]) || this.nodeByPath(file.path);
    this.forEachView(function (v) {
      if (!node) return;
      if (!v.visible[node.id]) v.clearIsolation(); // фильтр главы прятал бы только что созданное
      v.select(node.id);
    });
    var kwLinks = plan ? plan.targets.length : 0;
    var msg =
      "Узел создан: " + file.path +
      (nameZh ? " · " + nameEn + " / " + nameZh : "") +
      (chapter ? " · глава " + chapter : "") +
      (plan ? " · связей по корпусу: " + kwLinks + " (вес " + plan.weight + ")" : "") +
      (related.length ? " · по названиям: " + related.length : "") +
      (plan && plan.unmatched.length ? " · НЕ НАЙДЕНО в корпусе: " + plan.unmatched.join(", ") : "");
    new obsidian.Notice(msg);
    return { file: file, path: file.path, node: node, id: id, plan: plan, related: related, chapter: chapter };
  }

  async copyLink(node) {
    var link = "[[" + node.stem + "|" + node.name + "]]";
    try {
      await navigator.clipboard.writeText(link);
      new obsidian.Notice("Скопировано: " + link);
    } catch (e) {
      new obsidian.Notice(link);
    }
  }

  /* -------------------------------------------------- файлы */

  async writeFile(path, content) {
    var p = obsidian.normalizePath(path);
    var i = p.lastIndexOf("/");
    var dir = i > 0 ? p.slice(0, i) : ""; // файла в корне это не «папка Course Index»
    if (dir && !this.app.vault.getAbstractFileByPath(dir)) {
      try {
        await this.app.vault.createFolder(dir);
      } catch (e) {
        /* уже существует */
      }
    }
    var existing = this.app.vault.getAbstractFileByPath(p);
    if (existing instanceof obsidian.TFile) {
      // Экспорт/оглавление тоже могут лежать в папке обхода. Это наша служебная
      // запись, а не пользовательская правка исходной заметки.
      await this.withInternalWrite(p, () => this.app.vault.modify(existing, content));
      return existing;
    }
    return await this.app.vault.create(p, content);
  }

  /**
   * graph.json — выгрузка графа: что видно на экране, то и в файле. Нужна, чтобы граф
   * можно было отдать другому инструменту (или себе же через полгода) вместе с размерами,
   * цветами и координатами.
   */
  async exportJSON(graph) {
    var g = graph || (await this.getGraph(false));
    var obj = core.toGraphJson(g, { stamp: new Date().toISOString().slice(0, 16).replace("T", " ") });
    var text = JSON.stringify(obj, null, 2) + "\n";
    var file = await this.writeFile(this.settings.exportFolder + "/lecture-graph-" + stamp() + ".json", text);
    new obsidian.Notice("JSON сохранён: " + file.path + " · " + obj.stats.nodes + " вершин · " + obj.stats.edges + " связей");
    return file;
  }

  /* -------------------------------------------------- сообщения у вершин (caption) */

  /**
   * Текст сообщения вершины. Заметку сообщения (свойство caption:) держим вне графа:
   * её папка исключена из обхода, поэтому она не плодит лишних вершин.
   * undefined — читается, null — свойства caption: нет.
   */
  captionText(node) {
    if (!node) return null;
    this.captions = this.captions || {};
    // имя заметки сообщения = "<id> — caption", поэтому найдём её и когда свойство
    // caption: ещё не проставлено (например, сразу после «Создать по шаблону»)
    var key = this.captionName(node);
    if (this.captions[key] !== undefined) return this.captions[key];
    var self = this;
    this.loadCaption(node).then(function (txt) {
      self.captions[key] = txt;
      self.forEachView(function (v) { v.renderBubble(); });
    });
    return undefined;
  }

  findCaptionFile(node) {
    var want = String(node.caption || node.id).replace(/^.*\//, "").replace(/\.md$/i, "");
    var files = this.app.vault.getMarkdownFiles();
    for (var i = 0; i < files.length; i++) {
      if (files[i].basename === want) return files[i];
    }
    return null;
  }

  async loadCaption(node) {
    var f = this.findCaptionFile(node);
    if (!f) return null; // заметки сообщения нет — пузырёк предложит создать
    node.captionPath = f.path;
    try {
      var text = await this.app.vault.cachedRead(f);
      return core.parseFrontmatter(text).body.trim();
    } catch (e) {
      return "";
    }
  }

  /** Имя заметки сообщения: id вершины + суффикс, чтобы не зависеть от длинного названия. */
  captionName(node) {
    return node.id + " — caption";
  }

  /** Открыть (или создать по шаблону) заметку с сообщением для главы/секции. */
  async openCaption(node) {
    if (!node) return null;
    var f = this.findCaptionFile(node);
    if (!f) f = await this.createCaption(node);
    if (f) {
      var leaf = this.app.workspace.getLeaf(false);
      if (leaf && leaf.openFile) await leaf.openFile(f);
    }
    return f;
  }

  /**
   * Создаёт заметку сообщения по шаблону (для глав — свой, для секций — свой) и прописывает
   * caption: в frontmatter самой вершины. Больше ничего в заметке не меняется.
   */
  async createCaption(node) {
    if (!node) return null;
    var folder = (this.settings.captionFolder || "45 - Captions").replace(/\/+$/, "");
    var name = this.captionName(node);
    var path = folder + "/" + name + ".md";
    var tpl = this.settings[CAPTION_TPL_KEY[node.type] || "captionSectionTemplate"];
    var body = await this.readTemplate(tpl);
    if (body === null) {
      body = DEFAULT_CAPTION_BODY[node.type] || "";
    }
    body = body
      .replace(/\{\{title\}\}/g, node.name || node.stem)
      .replace(/\{\{title_zh\}\}/g, node.nameZh || "")
      .replace(/\{\{id\}\}/g, node.id)
      .replace(/\{\{type\}\}/g, node.type)
      // «{{body}}» в шаблоне — метка «пиши здесь», в готовой заметке её быть не должно
      .replace(/\n*\{\{\s*body\s*\}\}\n*/g, "\n")
      .replace(/\n{3,}/g, "\n\n");
    // служебный frontmatter: заметка сообщения не вершина графа (тип caption + папка
    // исключена), но по этому полю её можно найти и не спутать с содержимым курса.
    // Шапка шаблона (type: template) заменяется своей — иначе новая заметка числилась бы шаблоном.
    var capFm = "---\ntype: caption\nnode: " + node.id + "\nlevel: " + node.type +
      (node.color ? "\ncolor: " + node.color : "") +
      "\ncssclasses: [\"lg-caption\"]\n---\n";
    var fmHead = body.match(/^---[^]*?\n---[ \t]*\n/);
    body = capFm + (fmHead ? body.slice(fmHead[0].length) : "\n" + body);
    var file;
    try {
      file = await this.writeFile(path, body);
    } catch (e) {
      new obsidian.Notice("Не удалось создать заметку сообщения: " + (e && e.message ? e.message : e));
      return null;
    }
    var src = this.app.vault.getAbstractFileByPath(node.path);
    if (src instanceof obsidian.TFile) {
      var patch = {};
      patch[this.settings.captionKey || "caption"] = "[[" + name + "]]";
      await this.processInternal(src, function (data) {
        return core.setFrontmatterValues(data, patch);
      });
    }
    this.captions = this.captions || {};
    this.captions[name] = core.parseFrontmatter(body).body.trim();
    node.caption = name;
    node.captionPath = path;
    new obsidian.Notice("Заметка сообщения создана: " + path);
    // Поле caption уже обновлено в текущем объекте node; новая заметка лежит вне
    // модели. Полная пересборка графа здесь ничего не меняет.
    return file;
  }

  async readTemplate(path) {
    if (!path) return null;
    var f = this.app.vault.getAbstractFileByPath(String(path).trim());
    if (!(f instanceof obsidian.TFile)) return null;
    try {
      var text = await this.app.vault.cachedRead(f);
      var body = core.parseFrontmatter(text).body;
      // служебные строчки Templater'а в готовом сообщении не нужны
      return body.replace(/<%[\s\S]*?%>/g, "").trim();
    } catch (e) {
      return null;
    }
  }

  async exportSVG(graph) {
    var g = graph || (await this.getGraph(false));
    var svg = core.toSVG(g, { pad: 60 });
    var file = await this.writeFile(this.settings.exportFolder + "/lecture-graph-" + stamp() + ".svg", svg);
    new obsidian.Notice("SVG сохранён: " + file.path + " (" + g.nodes.length + " узлов)");
    return file;
  }
}

function stamp() {
  var d = new Date();
  var pad = function (x) {
    return (x < 10 ? "0" : "") + x;
  };
  return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + pad(d.getHours()) + pad(d.getMinutes());
}

module.exports = LectureGraphPlugin;
module.exports.LectureGraphView = LectureGraphView;
module.exports.EditLabelModal = EditLabelModal;
module.exports.CreateNodeModal = CreateNodeModal;
module.exports.VIEW_TYPE = VIEW_TYPE;
module.exports.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
module.exports.buildOptions = buildOptions;
module.exports.subsetGraph = subsetGraph;
