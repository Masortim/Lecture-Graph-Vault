/* Мини-реализация API Obsidian для jsdom-теста (dev/node_modules/obsidian). */
const fs = require("fs");
const path = require("path");

/* ---------- DOM-расширения, как в Obsidian ---------- */
function installDomExtensions(win) {
  const D = win.Document.prototype;
  const E = win.Element.prototype;
  const H = win.HTMLElement.prototype;

  function createEl(tag, opts) {
    let options = opts || {};
    if (typeof options === "string") options = { cls: options };
    const el = (options.type ? this.createElement(tag, { is: options.type }) : this.createElement(tag));
    if (options.cls) el.className = options.cls;
    if (options.text != null) el.textContent = options.text;
    if (options.type) el.setAttribute("type", options.type);
    if (options.value != null) el.value = options.value;
    if (options.attr) Object.keys(options.attr).forEach((k) => el.setAttribute(k, String(options.attr[k])));
    if (options.prepend) el.prepend();
    return el;
  }
  D.createEl = createEl;
  E.createEl = function (tag, opts) {
    const el = createEl.call(this.ownerDocument, tag, opts);
    this.appendChild(el);
    return el;
  };
  D.createDiv = function (o) { return createEl.call(this, "div", o); };
  E.createDiv = function (o) { return this.createEl("div", o); };
  D.createSpan = function (o) { return createEl.call(this, "span", o); };
  E.createSpan = function (o) { return this.createEl("span", o); };

  [D, E].forEach((proto) => {
    if (!proto.empty) proto.empty = function () { while (this.firstChild) this.removeChild(this.firstChild); };
    proto.setText = function (t) { this.textContent = t; return this; };
    proto.addClass = function (...cs) { cs.forEach((c) => c && this.classList.add(c)); return this; };
    proto.removeClass = function (...cs) { cs.forEach((c) => c && this.classList.remove(c)); return this; };
    proto.toggleClass = function (c, on) { if (on === undefined) this.classList.toggle(c); else this.classList.toggle(c, !!on); return this; };
    proto.hasClass = function (c) { return this.classList.contains(c); };
    proto.isShown = function () { return true; };
    proto.attachShadow = proto.attachShadow || function () { return this; };
    proto.setAttr = function (k, v) { if (v === null) this.removeAttribute(k); else this.setAttribute(k, v); return this; };
    proto.toggleAttr = function (k, v) { if (v) this.setAttribute(k, ""); else this.removeAttribute(k); return this; };
    proto.addEventListenerOnce = proto.addEventListenerOnce || function (t, f) { this.addEventListener(t, f); };
  });
}

/* ---------- базовые классы ---------- */
class Component {
  constructor() { this._regs = []; }
  register(x) { this._regs.push(x); }
  registerEvent(ref) { this._regs.push(ref); return ref; }
  registerDomEvent(el, type, cb, opts) {
    if (el && el.addEventListener) el.addEventListener(type, cb, opts);
    return { id: type, el, cb };
  }
  registerInterval(id) { return id; }
  registerScope() {}
  onload() {}
  onunload() {}
 _unloadAll() { this._regs.forEach((r) => r && r.el && r.el.removeEventListener && r.el.removeEventListener(r.id, r.cb)); }
}

class Events {
  constructor() { this._h = {}; }
  on(name, cb) { (this._h[name] = this._h[name] || []).push(cb); return { name, cb }; }
  off(name, cb) { if (this._h[name]) this._h[name] = this._h[name].filter((f) => f !== cb); }
  offref() {}
  trigger(name, ...args) { (this._h[name] || []).forEach((cb) => cb(...args)); }
}

class Icons { static getIcon() { return ""; } }

class TFile {
  constructor(p, realPath) {
    this.path = p;
    const ext = path.extname(p).replace(/^\./, ""); // как в Obsidian: не всякий файл — md
    this.basename = path.basename(p, ext ? "." + ext : "");
    this.extension = ext;
    this.name = path.basename(p);
    // как в Obsidian: у файла есть parent (для файла в корне — корневая папка "/")
    const dn = path.posix.dirname(String(p).replace(/\\/g, "/"));
    this.parent = { path: dn === "." ? "/" : dn, name: dn === "." ? "" : path.posix.basename(dn) };
    this.stat = { ctime: 0, mtime: Date.now(), size: 0 };
    this._real = realPath;
  }
}

class TFolder {
  constructor(p) { this.path = p; this.name = path.basename(p); this.children = []; this.parent = null; }
}

class Vault extends Events {
  constructor(root) {
    super();
    this.root = root;
  }
  _abs(rel) { return path.join(this.root, rel); }
  getMarkdownFiles() {
    const out = [];
    const walk = (dir, rel) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ent.name.startsWith(".")) continue;
        const p = path.join(dir, ent.name);
        const r = rel ? rel + "/" + ent.name : ent.name;
        if (ent.isDirectory()) walk(p, r);
        else if (ent.name.endsWith(".md")) out.push(new TFile(r, p));
      }
    };
    if (fs.existsSync(this.root)) walk(this.root, "");
    out.sort((a, b) => (a.path < b.path ? -1 : 1));
    return out;
  }
  getAbstractFileByPath(p) {
    if (!p) return null;
    const abs = this._abs(p);
    if (!fs.existsSync(abs)) return null;
    return fs.statSync(abs).isDirectory() ? new TFolder(p) : new TFile(p, abs);
  }
  async cachedRead(f) { return fs.readFileSync(f._real || this._abs(f.path), "utf8"); }
  async read(f) { return this.cachedRead(f); }
  async modify(f, data) {
    fs.writeFileSync(f._real || this._abs(f.path), data);
    f.stat = { ctime: 0, mtime: Date.now(), size: data.length };
    this.trigger("modify", f);
    return f;
  }
  async process(f, fn) {
    const before = await this.cachedRead(f);
    const after = fn(before);
    if (after !== before) await this.modify(f, after);
    return after;
  }
  async create(p, data) {
    const abs = this._abs(p);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, data);
    const f = new TFile(p, abs);
    this.trigger("create", f);
    return f;
  }
  async createFolder(p) { fs.mkdirSync(this._abs(p), { recursive: true }); return new TFolder(p); }
  async delete(f) { fs.rmSync(f._real || this._abs(f.path), { force: true }); }
  getName() { return path.basename(this.root); }
  configDir = ".obsidian";
}

class MetadataCache extends Events {
  constructor(vault) { super(); this.vault = vault; }
  getFileCache() { return null; }
  getFirstLinkpathDest(lp) { return null; }
  resolvedLinks = {};
}

class Leaf extends Events {
  constructor(app) { super(); this.app = app; this.view = null; this._container = document.createElement("div"); }
  get viewContentType() { return this.view && this.view.getViewType && this.view.getViewType(); }
  viewContentTypeOf() { return this.viewContentType; }
  async setViewState(state) {
    const creator = this.app.workspace._views[state.type];
    if (creator && !this.view) {
      this.view = creator(this);
      if (this.view.setViewType) this.view.setViewType(state.type);
    }
    if (this.view && this.view.onOpen) await this.view.onOpen();
    return this;
  }
  async openFile(f) { this.app.workspace.activeFile = f; this.app.workspace.trigger("file-open", f); }
  detach() { this.app.workspace._leaves.delete(this); }
  setPinned() {}
  rehref() {}
}

class Workspace extends Events {
  constructor(app) {
    super();
    this.app = app;
    this._views = {};
    this._leaves = new Set();
    this.leftRibbon = document.createElement("div");
    this.activeLeaf = null;
    this.layoutReady = true;
  }
  getMostRecentLeaf() { return this.getLeaf(false); }
  getActiveViewOfType() { return null; }
  getLeaf(newLeaf) {
    const l = new Leaf(this.app);
    this._leaves.add(l);
    if (!this.activeLeaf) this.activeLeaf = l;
    return l;
  }
  getLeavesOfType(type) { return [...this._leaves].filter((l) => l.view && l.view.getViewType && l.view.getViewType() === type); }
  revealLeaf(l) { this.revealed = (this.revealed || 0) + 1; }
  detachLeavesOfType(type) { this.getLeavesOfType(type).forEach((l) => l.detach()); }
  iterateAllLeaves(cb) { this._leaves.forEach(cb); }
  getActiveFile() { return this.activeFile || null; }
  getActiveViewOfType() { return null; }
  on(name, cb) { return super.on(name, cb); }
}

class View extends Component {
  constructor(leaf) {
    super();
    this.app = leaf.app;
    this.leaf = leaf;
    this.containerEl = document.createElement("div");
    this.contentEl = this.containerEl.appendChild(document.createElement("div"));
    this.headerActions = [];
  }
  addAction(icon, label, cb) { this.headerActions.push({ icon, label, cb }); return document.createElement("button"); }
  getViewType() { return "unknown"; }
  getDisplayText() { return ""; }
  getIcon() { return "help"; }
  onResize() {}
}

class ItemView extends View {
  constructor(leaf) { super(leaf); this.icon = null; }
}

class Modal extends Component {
  constructor(app) {
    super();
    this.app = app;
    this.modalEl = document.createElement("div");
    this.modalEl.className = "modal";
    this.contentEl = this.modalEl.appendChild(document.createElement("div"));
    this.isOpen = false;
  }
  open() {
    document.body.appendChild(this.modalEl);
    this.isOpen = true;
    this.onOpen();
  }
  close() {
    this.isOpen = false;
    if (this.onClose) this.onClose();
    if (this.modalEl.parentNode) this.modalEl.parentNode.removeChild(this.modalEl);
  }
  setTitle(t) { this.title = t; }
  setBody() {}
}

class Menu {
  constructor(app) { this.app = app; this.items = []; }
  addItem(cb) {
    const item = {
      _t: "", _i: "", _cb: null,
      setTitle(t) { this._t = t; return this; },
      setIcon(i) { this._i = i; return this; },
      setDisabled() { return this; },
      setSection(sec) { this._s = sec; return this; },
      setTitleSize() { return this; },
      onClick(fn) { this._cb = fn; return this; },
      checkItem() { return this; },
    };
    cb(item);
    this.items.push(item);
    return item;
  }
  addSeparator() { this.items.push({ sep: true }); return this; }
  showAtPosition(pos) { this.shownAt = pos; }
  showAtMouseEvent() {}
}

class Notice {
  constructor(msg, timeout) {
    this.message = String(msg);
    Notice.all.push(this.message);
  }
  hide() {}
}
Notice.all = [];

class Setting {
  constructor(el) {
    this.el = el;
    this.settingEl = el.createDiv({ cls: "setting-item" });
    this.nameEl = this.settingEl.createDiv({ cls: "setting-item-name" });
    this.descEl = this.settingEl.createDiv({ cls: "setting-item-description" });
    this.controls = [];
    el._settings = (el._settings || 0) + 1;
    (el._all = el._all || []).push(this);
  }
  setName(t) { this.nameEl.setText(t); return this; }
  setDesc(t) { this.descEl.setText(t); return this; }
  setHeading() { return this; }
  setClass() { return this; }
  /* Как в реальном Obsidian: add* возвращает САМ Setting (а не компонент), поэтому
     цепочка `new Setting(el).setName(..).addSlider(..).setDesc(..)` работает. */
  addButton(cb) { cb && cb(makeControl(this, "button")); return this; }
  addText(cb) { cb && cb(makeControl(this, "text")); return this; }
  addTextArea(cb) { cb && cb(makeControl(this, "textarea")); return this; }
  addToggle(cb) {
    const c = makeControl(this, "toggle");
    c.setValue = (v) => { c._value = !!v; return c; };
    cb && cb(c);
    return this;
  }
  addSlider(cb) {
    const c = makeControl(this, "slider");
    c.setLimits = (lo, hi, step) => { c.lo = lo; c.hi = hi; c.step = step; return c; };
    c.setValue = (v) => { c._value = v; return c; };
    c.setDynamicTitle = () => c;
    c.setDynamicTooltip = () => c; // есть в реальном SliderComponent Obsidian
    c.setTooltip = () => c;
    cb && cb(c);
    return this;
  }
  addDropdown(cb) {
    const c = makeControl(this, "dropdown");
    c.addOption = (v, t) => { (c._opts = c._opts || {})[v] = t; return c; };
    c.addOptions = (o) => { c._opts = Object.assign(c._opts || {}, o); return c; };
    cb && cb(c);
    return this;
  }
  addExtraButton(cb) {
    const c = makeControl(this, "extra");
    c.setIcon = () => c;
    c.setTooltip = () => c;
    cb && cb(c);
    return this;
  }
  then(cb) { cb(this); return this; }
}

function makeControl(setting, kind) {
  const el = setting.settingEl.createEl("input", { type: kind === "text" ? "text" : kind === "toggle" ? "checkbox" : "text" });
  const c = {
    el,
    inputEl: el, // как в реальных *Component Obsidian (TextComponent.inputEl и т.д.)
    _value: "",
    setValue(v) { c._value = v; el.value = v == null ? "" : String(v); return c; },
    getValue() { return c._value; },
    setPlaceholder(p) { c._ph = p; return c; },
    setTooltip() { return c; },
    setDisabled() { return c; },
    setIcon() { return c; },
    setCta() { return c; },
    setButtonText(t) { c._text = t; return c; },
    setLimits() { return c; },
    setDynamicTitle() { return c; },
    onChange(fn) { c._onChange = fn; return c; },
    onClick(fn) { c._onClick = fn; return c; },
    trigger(v) { if (c._onChange) c._onChange(v); return c; },
  };
  setting.controls.push(c);
  return c;
}

class PluginSettingTab {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement("div");
  }
  display() {}
  hide() {}
}

class Scope {
  register() {}
  unpregister() {}
}

class Plugin extends Component {
  constructor(app, manifest) {
    super();
    this.app = app;
    this.manifest = manifest;
    this._data = null;
    this.commands = [];
    this.ribbon = [];
    this.settingTabs = [];
    this.views = {};
    this._dataFile = app ? path.join(app.configDir || "", "plugins", (manifest && manifest.id) || "plugin", "data.json") : null;
  }
  // как в Obsidian: настройки плагина лежат в <configDir>/plugins/<id>/data.json,
  // поэтому e2e проверяет реально поставляемую конфигурацию, а не дефолты кода
  async loadData() {
    if (this._data !== undefined && this._data !== null) return this._data; // null = «ещё не читали»
    if (!this._dataFile || !fs.existsSync(this._dataFile)) return null;
    try { return JSON.parse(fs.readFileSync(this._dataFile, "utf8")); } catch (e) { return null; }
  }
  async saveData(d) {
    this._data = JSON.parse(JSON.stringify(d));
    if (!this._dataFile) return;
    try {
      fs.mkdirSync(path.dirname(this._dataFile), { recursive: true });
      fs.writeFileSync(this._dataFile, JSON.stringify(d, null, 2));
    } catch (e) { /* временное хранилище может быть только для чтения */ }
  }
  addRibbonIcon(icon, title, cb) { const el = document.createElement("div"); el._title = title; this.ribbon.push({ icon, title, cb }); return el; }
  addCommand(cmd) { this.commands.push(cmd); return cmd; }
  addSettingTab(tab) { this.settingTabs.push(tab); }
  registerView(type, creator) { this.views[type] = creator; this.app.workspace._views[type] = creator; }
  registerHoverLinkSource() {}
  addStatusBarItem() { return document.createElement("div"); }
}

/* helpers exported for tests */
function debounce(cb, ms) { let t = null; return (...a) => { if (t) clearTimeout(t); t = setTimeout(() => { t = null; cb(...a); }, 0); }; }
function normalizePath(p) { return String(p).replace(/[\\:*?"<>|]/g, "").replace(/^\/+/, ""); }

module.exports = {
  Component,
  Events,
  Icons,
  Modal,
  Menu,
  Notice,
  Plugin,
  PluginSettingTab,
  ItemView,
  View,
  Setting,
  Scope,
  TFile,
  TFolder,
  Vault,
  MetadataCache,
  Workspace,
  Leaf,
  debounce,
  normalizePath,
  installDomExtensions,
};
