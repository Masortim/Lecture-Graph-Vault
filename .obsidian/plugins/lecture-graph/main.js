/* lecture-graph v1.13.1 — автоген: src/graph-core.js + src/ui.js, не редактировать напрямую. */
var __LG_CORE__ = (function () {
  var module = { exports: {} };
  var exports = module.exports;
/*
 * lecture-graph / graph-core.js
 * Чистая логика (без зависимостей от Obsidian): разбор заметок, построение графа,
 * степеней, расчёт радиусов, layout, экспорт. Инлайнится в main.js плагином
 * и используется юнит-тестами в Node — один и тот же код.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = mod;
  } else {
    root.LectureGraphCore = mod;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TYPES = ["chapter", "section", "heading", "block"];

  /**
   * Подпись, которая не влезла в свой бюджет, не обрезается многоточием, а ГАСНЕТ
   * к правому краю. Это нижняя граница «сколько текста показано в полную силу»: даже
   * у названия втрое длиннее бюджета непрозрачным остаётся не меньше трети строки,
   * иначе метка превращалась бы в еле видимую полоску. Затухание рисует вид
   * (ui.js: linearGradient + mask), в модель оно приходит числом n.labelFade.
   */
  var LABEL_FADE_MIN = 0.34;

  var DEFAULTS = {
    nameKey: "name",
    nameZhKey: "name_zh",
    typeKey: "type",
    idKey: "id",
    parentKey: "parent",
    chapterKey: "chapter",
    statusKey: "status",
    placeholderValue: "placeholder",
    minRadius: 6,
    maxRadius: 34,
    degreeGamma: 0.55,
    degreeBase: "min", // min | zero — что считать «нулём» шкалы размеров
    sizeMode: "hybrid", // global | byType | hybrid — относительно чего меряется «много ссылок»
    labelFontSize: 10, // базовый кегль подписи, если масштабирование выключено
    labelFontMin: 9,
    labelFontMax: 19,
    labelFontBySize: true, // кегль подписи растёт вместе с вершиной
    // Множитель кегля подписи: им работают кнопки A−/A+ на панели (шаг ×1.15), он
    // же — «сделать подписи крупнее» в настройках. Множитель входит в n.font, то есть
    // в модельные координаты: упаковка меток и экспорт SVG остаются честными, метки
    // не начинают наезжать друг на друга. На ЭКРАНЕ кегль от зума не зависит (см.
    // view.updateLabels), поэтому множитель виден сразу, а не «на сотую пикселя».
    labelScale: 1,
    labelMaxLines: 2,
    // сколько символов влезает в подпись по уровням: «длиннее» = шире метка =
    // больше нужного радиуса кольца; для блоков и заголовков режем сильнее
    labelCharsFor: { chapter: 30, section: 24, heading: 12, block: 12 },
    // сколько пикселей ширины подпись может занять (на базовом кегле). Бюджет по уровням:
    // у глав кольцо самое свободное (9 штук на окружности) - им можно длинные названия,
    // блокам и заголовкам - короткие, иначе радиус графа растёт впустую. labelChars
    // считается как budget / baseFont, то есть «влезает столько символов, сколько места»
    labelWidthFor: { chapter: 520, section: 380, heading: 190, block: 170 },
    // каким типам разрешать подписи при labelMode:"size" (блоки — 756 штук, их метки
    // только замусорят картину; их видно при наведении и в карточке)
    labelForTypes: { chapter: true, section: true, heading: true, block: false },
    // узел верхнего уровня не должен превращаться в точку и терять подпись: если по
    // числу входящих ссылок он маленький, всё равно поднимаем до «пола» по типу
    sizeFloor: { chapter: 16, section: 13, heading: 10 },
    labelAlwaysFor: { chapter: true, section: true },
    labelMode: "size", // always | none | hover | size (по кеглю/радиусу)
    labelRadiusThreshold: 11, // при mode:"size" подпись рисуем у вершин крупнее порога
    // (11, не 14: вес по ключевым фразам растягивает шкалу внутри уровня, и с порогом 14
    //  у мелких заголовков подписи начинали пропадать — а уровень обязан быть подписан)
    curvature: 0.24, // изгиб дуги ребра (0 — прямые линии)
    chapterColors: true, // цвет главы наследуют её секции/заголовки/блоки
    chapterPalette: ["#f2b33d", "#4a9eda", "#59c98a", "#c07ad8", "#ff7a6b", "#5fd3c4", "#f58fc2", "#b9cf5e", "#9a8cff", "#f2c14e"],
    sizeKey: "size",   // свойство заметки: множитель размера вершины
    colorKey: "color", // свойство заметки: свой цвет вершины
    captionKey: "caption", // свойство заметки: ссылка на заметку с информационным сообщением
    // ——— ключевые фразы (этап 2) ———
    keywordsKey: "keywords_en", // список фраз в свойствах блока
    keywordsAltKey: "keywords", // старое имя из заметки про аннотации — принимаем как алиас
    weightKey: "weight",        // куда материализатор пишет суммарное число вхождений
    sectionKey: "section",      // аннотация корпуса указывает, какой секции она
    keywordLinks: true,         // считать рёбра (и размер) по ключевым фразам
    keywordFolder: "35 - Abstracts", // где искать корпус (из графа папка исключена)
    countStructural: false, // в размер вершины считать только ссылки из текстов?
    includeSelfEdges: false,
    includeInlineAnchors: true,
    colors: {
      chapter: "#f2b33d",
      section: "#4a9eda",
      heading: "#59c98a",
      block: "#c07ad8",
    },
    layout: {
      // чем раскладываем: fdp (пружина FR) | neato (stress majorization) |
      // twopi (радиальные слои от корня) | clusters (сектора глав, без пересечений
      // рёбер - оставлен как режим «для печати/схемы») | force (чистая физика)
      mode: "fdp",
      // --- fdp (Fruchterman-Reingold) ---
      fdpIters: 260,
      frK: 1,          // множитель «нормального расстояния» k
      frRepel: 1,      // сила отталкивания k^2/d
      frAttract: 1,    // сила притяжения d^2/k у обычных рёбер
      frStruct: 1.9,   // ...и у структурных (дерево должно читаться)
      frTemp: 0.55,    // стартовая «температура» (доля k на шаг)
      // --- neato (stress majorization) ---
      neatoIters: 80,
      neatoScale: 2.2,  // на сколько «идеальная длина» длиннее связи (воздух под подписи)
      neatoRepel: 1.6,  // короткое отталкивание (0 - чистый neato)
      // --- twopi (радиальные слои) ---
      twopiRoot: "",       // id вершины-корня; пусто - крупнейшая глава
      twopiRankSep: 1,     // множитель радиуса слоя
      // --- общее ---
      clusterPull: 0.035,  // стягивание к центроиду «дома» вершины: своей главы, а для блока
      // с ключевыми фразами - главы-лидера по вхождениям (0 - выключено). Значение прежнее:
      // neato на больших весах распухает, если его задирать, - вместо этого проверка
      // «глава = отдельное пятно» в test-core смотрит на форму (ближайшее пятно), а не на средние
      postLabels: true,    // пост-обработка: подписи не наезжают
      postCircles: true,   // пост-обработка: круги не пересекаются
      dispCap: 0.5,        // предельный сдвиг от «как положил алгоритм», доля шага
      spreadMax: 12,         // потолок «раздувания холста» пост-обработкой: подписям нужно
                             // место, но на редком графe множитель обязан быть конечен
      polishGrow: 6,       // сколько раз можно «раздвинуть холст» (×1.18 за шаг), если чистых
                           // меток не удалось добиться на текущем месте
      polishPasses: 0,     // 0 = столько, сколько нужно при данной плотности
      // значения подобраны так, чтобы круги радиусом до maxRadius не слипались:
      // чем крупнее вершины, тем длиннее «пружина» и слабее притяжение к центру
      linkDistance: 88,
      repel: 2700,
      gravity: 0.014,
      friction: 0.82,
      alphaDecay: 0.02,
      collide: true,
      radius: 1300, // базовый разлёт колец; autoTune увеличивает его на больших графах

      radialStrength: 0.05,
      anchorStrength: 0.34, // насколько сильно держим вершину у её слота (clusters)
      packLabels: true, // расталкивать вершины с учётом ширины подписей
      packPasses: 70,
      clusterSpacing: 46,
      clusterRings: [0.09, 0.33, 0.58, 0.8, 1.0],
      // кольца внутри сектора главы (доля общего радиуса R): [от, до]
      clusterBands: { chapter: [0.2, 0.3], section: [0.38, 0.6], heading: [0.8, 1.0], block: [1.06, 1.26] },
      clusterPad: 10, // запас по дуге между вершинами одного ряда
      clusterGap: 0.07, // зазор между секторами глав (доля сектора)
      clusterFill: 0.94, // какую долю окружности кольца разрешаем занять одним рядом
      autoTune: true,
      iterations: 700,
      polish: 26, // проходов «только расталкивание» в конце

    },
  };

  /* ------------------------------------------------------------ YAML (подмножество) */

  function unquote(v) {
    if (v == null) return "";
    var s = String(v).trim();
    if (s.length >= 2) {
      var a = s.charAt(0);
      var b = s.charAt(s.length - 1);
      if ((a === '"' && b === '"') || (a === "'" && b === "'")) {
        var inner = s.slice(1, -1);
        if (a === '"') {
          inner = inner
            .replace(/\\n/g, "\n")
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, "\\");
        } else {
          inner = inner.replace(/''/g, "'");
        }
        return inner;
      }
    }
    return s;
  }

  function parseScalar(v) {
    var s = (v == null ? "" : String(v)).trim();
    if (s === "") return "";
    if (s.charAt(0) === "[") {
      var inner = s.slice(1, s.lastIndexOf("]"));
      return splitTopLevel(inner).map(function (x) {
        return unquote(x);
      });
    }
    if (s === "true") return true;
    if (s === "false") return false;
    if (s === "null" || s === "~") return null;
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    return unquote(s);
  }

  function splitTopLevel(s) {
    var out = [];
    var buf = "";
    var depth = 0;
    var q = null;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (q) {
        buf += ch;
        if (ch === q && s.charAt(i - 1) !== "\\") q = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        q = ch;
        buf += ch;
        continue;
      }
      if (ch === "[" || ch === "{") depth++;
      if (ch === "]" || ch === "}") depth--;
      if (ch === "," && depth === 0) {
        out.push(buf);
        buf = "";
        continue;
      }
      buf += ch;
    }
    if (buf.trim() !== "") out.push(buf);
    return out.map(function (x) {
      return x.trim();
    });
  }

  function quoteYaml(value) {
    var s = value == null ? "" : String(value);
    return JSON.stringify(s);
  }

  /**
   * Разбирает подмножество YAML frontmatter: скаляры и inline-массивы.
   * Блоки `key:` со вложенными строками игнорируются (как и пустые значения).
   */
  function parseFrontmatter(text) {
    var res = { data: {}, body: text || "", hasFrontmatter: false, error: null };
    var src = String(text == null ? "" : text).replace(/\r\n/g, "\n");
    if (src.indexOf("\ufeff") === 0) src = src.slice(1);
    var m = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(src);
    if (!m) return res;
    res.hasFrontmatter = true;
    res.raw = m[0];
    res.body = src.slice(m[0].length);
    var lines = m[1].split("\n");
    var skipIndent = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^\s*$/.test(line)) {
        skipIndent = false;
        continue;
      }
      if (/^\s/.test(line) || /^#/.test(line)) continue; // вложенность/комментарии
      var idx = line.indexOf(":");
      if (idx < 1) {
        skipIndent = true;
        continue;
      }
      var key = line.slice(0, idx).trim();
      var rest = line.slice(idx + 1);
      if (rest.trim() === "") {
        // многострочное значение: пропускаем последующие отступные строки
        var val = "";
        while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) {
          val += (val ? " " : "") + lines[i + 1].trim();
          i++;
        }
        res.data[key] = val;
        continue;
      }
      if (/^[|>][-+]?$/.test(rest.trim())) {
        var v2 = "";
        while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) {
          v2 += (v2 ? "\n" : "") + lines[i + 1].trim();
          i++;
        }
        res.data[key] = v2;
        continue;
      }
      res.data[key] = parseScalar(rest);
    }
    return res;
  }

  /**
   * Правит/добавляет поля frontmatter, сохраняя все прочие строки дословно
   * (комментарии, вложенные списки, многострочные значения) и тело заметки байт-в-байт.
   * patch: {key: value}; "" | null | undefined => удалить ключ.
   */
  function setFrontmatterValues(text, patch) {
    var src = String(text == null ? "" : text).replace(/\r\n/g, "\n");
    var m = /^(\ufeff)?---[ \t]*\n([\s\S]*?)\n---[ \t]*\n?/.exec(src);
    var bom = m && m[1] ? m[1] : "";
    var body = m ? src.slice(m[0].length) : src;
    var patchKeys = Object.keys(patch || {});
    if (!patchKeys.length) return src;
    if (!m) {
      var made = serializePatch(patch, patchKeys);
      if (!made.length) return body;
      return "---\n" + made.join("\n") + "\n---\n" + (body.charAt(0) === "\n" || body === "" ? body : "\n" + body);
    }
    var fmLines = m[2].split("\n");
    var out = [];
    var touched = {};
    var i = 0;
    while (i < fmLines.length) {
      var line = fmLines[i];
      var km = /^([^#\s][^:]*):(\s.*)?$/.exec(line);
      if (km && /^\S/.test(line)) {
        var key = km[1].trim();
        // собрать «продолжение» значения (отступные строки многострочного YAML)
        var block = [line];
        var j = i + 1;
        while (j < fmLines.length && /^\s+\S/.test(fmLines[j])) {
          block.push(fmLines[j]);
          j++;
        }
        if (patchKeys.indexOf(key) >= 0) {
          touched[key] = true;
          var val = patch[key];
          if (val !== null && val !== undefined && val !== "") {
            out.push(key + ": " + serializeValue(val));
          }
        } else {
          for (var k = 0; k < block.length; k++) out.push(block[k]);
        }
        i = j;
        continue;
      }
      out.push(line);
      i++;
    }
    patchKeys.forEach(function (key) {
      if (touched[key]) return;
      var v = patch[key];
      if (v === null || v === undefined || v === "") return;
      out.push(key + ": " + serializeValue(v));
    });
    var cleaned = out.filter(function (l, idx) {
      // схлопнуть лишние пустые строки на концах
      return !(l.trim() === "" && (idx === 0 || idx === out.length - 1));
    });
    if (!cleaned.length) return body;
    return bom + "---\n" + cleaned.join("\n") + "\n---\n" + body;
  }

  function serializeValue(val) {
    if (Array.isArray(val)) return "[" + val.map(quoteYaml).join(", ") + "]";
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    return quoteYaml(String(val));
  }

  function serializePatch(patch, keys) {
    var out = [];
    keys.forEach(function (key) {
      var v = patch[key];
      if (v === null || v === undefined || v === "") return;
      out.push(key + ": " + serializeValue(v));
    });
    return out;
  }

  /* ------------------------------------------------------------ ссылки */

  var WIKILINK = /(!?)\[\[([^\[\]\n]+)\]\]/g;

  /**
   * Вытаскивает wiki-ссылки (и врезки) из текста. Возвращает
   * {linkType, path, anchor, blockId, alias, hasAlias, raw, index}.
   * Ссылки внутри `code`/фenced-блоков и внутри callout-маркеров не игнорируются
   * намеренно: Obsidian индексирует их так же (в inline code — нет, см. stripCode).
   */
  function extractLinks(text, opts) {
    // opts.stripCode === false оставляет «сырые» позиции ссылок (нужны там, где текст
    // переписывается по кускам — при удалении вершины ссылку надо заменить, а не найти).
    var src = (opts && opts.stripCode === false) ? String(text == null ? "" : text) : stripCode(String(text == null ? "" : text));
    var out = [];
    WIKILINK.lastIndex = 0;
    var m;
    while ((m = WIKILINK.exec(src))) {
      var raw = m[2];
      var target = raw;
      var alias = null;
      var bar = raw.indexOf("|");
      if (bar >= 0) {
        target = raw.slice(0, bar);
        alias = raw.slice(bar + 1);
      }
      var anchor = null;
      var blockId = null;
      var hash = target.indexOf("#");
      if (hash >= 0) {
        var tail = target.slice(hash + 1);
        target = target.slice(0, hash);
        if (tail.charAt(0) === "^") blockId = tail.slice(1).trim();
        else anchor = tail.trim();
      }
      target = target.trim();
      if (target === "") continue; // [[#Заголовок]] — внутренняя ссылка, не узел
      out.push({
        linkType: m[1] === "!" ? "embed" : "link",
        path: target,
        anchor: anchor,
        blockId: blockId,
        alias: alias,
        hasAlias: alias !== null,
        raw: m[0],
        index: m.index,
      });
    }
    return out;
  }

  /** Убирает fenced-блоки и inline code, чтобы `[[..]]` внутри кода не создавал рёбра. */
  function stripCode(text) {
    return text
      .replace(/^```[\s\S]*?^```[ \t]*$/gm, "")
      .replace(/^~~~[\s\S]*?^~~~[ \t]*$/gm, "")
      .replace(/`[^`\n]*`/g, "");
  }

  var ANCHOR_LINE = /^(?:\s*>+\s*)?(?:[-*+]\s+|\d+\.\s+)?\s*\^([A-Za-z0-9][\w-]*)\s*$/;

  /** Блочные якоря `^id` в конце абзаца (в т.ч. внутри blockquote/callout). */
  function extractAnchors(text) {
    var src = stripCode(String(text == null ? "" : text));
    var lines = src.split("\n");
    var out = [];
    var seen = {};
    for (var i = 0; i < lines.length; i++) {
      var m = ANCHOR_LINE.exec(lines[i]);
      if (m && !seen[m[1]]) {
        seen[m[1]] = true;
        // «подпись»: последняя непустая строка выше без маркера якоря
        var label = "";
        for (var j = i - 1; j >= 0 && j > i - 4; j--) {
          var t = lines[j].replace(/^>+/, "").replace(/^[-*+]\s+|\d+\.\s+/, "").trim();
          if (t && !ANCHOR_LINE.test(lines[j])) {
            label = t;
            break;
          }
        }
        out.push({ id: m[1], line: i, label: label });
      }
    }
    return out;
  }

  /* ------------------------------------------------------------ заметка -> узел */

  function stemOf(path) {
    var p = String(path).replace(/\\/g, "/");
    var name = p.slice(p.lastIndexOf("/") + 1);
    if (/\.md$/i.test(name)) name = name.slice(0, -3);
    return name;
  }

  function sanitizeLabel(s) {
    return String(s == null ? "" : s)
      .replace(/\[\[|\]\]/g, "")
      .replace(/\|/g, " · ")
      .replace(/[*_`>#]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * note: {path, text} | {path, frontmatter, body}
   * Возвращает «сырое» описание узла для buildGraph.
   */
  function readNote(note) {
    var data = note.frontmatter;
    var body = note.body;
    if (data === undefined || body === undefined) {
      var parsed = parseFrontmatter(note.text || note.content || "");
      data = parsed.data;
      body = parsed.body;
    }
    return {
      path: note.path,
      stem: stemOf(note.path),
      data: data || {},
      body: body || "",
    };
  }

  function nodeFromRead(read, cfg, links) {
    var t = cfg.typeKey;
    var type = String(read.data[t] || "").trim().toLowerCase();
    var name = sanitizeLabel(read.data[cfg.nameKey]);
    var zh = sanitizeLabel(read.data[cfg.nameZhKey]);
    var id = String(read.data[cfg.idKey] || read.stem).trim();
    return {
      id: id,
      path: read.path,
      stem: read.stem,
      type: TYPES.indexOf(type) >= 0 ? type : "block",
      declaredType: type,
      name: name || read.stem,
      nameZh: zh,
      nameFromFilename: !String(read.data[cfg.nameKey] || "").trim(),
      zhMissing: !String(read.data[cfg.nameZhKey] || "").trim(),
      parent: String(read.data[cfg.parentKey] || "").trim() || null,
      chapter: String(read.data[cfg.chapterKey] || "").trim() || null,
      status: String(read.data[cfg.statusKey] || "").trim() || null,
      isPlaceholder: String(read.data[cfg.statusKey] || "").trim() === cfg.placeholderValue,
      // значение свойства size: храним как написано («1.4» или «22px»), множитель
      // посчитает applySizes — им же определяется и кегль подписи
      sizeRaw: read.data[cfg.sizeKey] === undefined || read.data[cfg.sizeKey] === null ? null : read.data[cfg.sizeKey],
      sizeFactor: 1,
      colorProp: String(read.data[cfg.colorKey] || "").trim() || null,
      keywords: parseKeywords(read.data[cfg.keywordsKey], read.data[cfg.keywordsAltKey]),
      weightRaw: read.data[cfg.weightKey] === undefined || read.data[cfg.weightKey] === null ? null : read.data[cfg.weightKey],
      kwWeight: 0,
      kwChapter: null,
      sizeValue: 0,
      caption: linkTargetOf(read.data[cfg.captionKey]),
      links: links || [],
      anchors: [],
    };
  }

  /** `size: 1.4` — множитель размера; мусор и 0 игнорируем. */
  function factorOf(v, r) {
    var str = String(v == null ? "" : v).replace(",", ".").trim();
    var f = parseFloat(str);
    if (!isFinite(f) || f <= 0) return 1;
    // «size: 22px» — заданный радиус в пикселях, «size: 1.4» — множитель размера
    if (/px$/i.test(str)) return r > 0 ? clamp(f / r, 0.05, 20) : 1;
    return Math.max(0.2, Math.min(4, f));
  }

  /** `caption: "[[Ch01 - Caption]]"` -> `Ch01 - Caption` (или путь `.md`). */
  function linkTargetOf(v) {
    var t = String(v == null ? "" : v).trim();
    var m = t.match(/^\[\[([^\]|#]+)/);
    if (m) t = m[1].trim();
    t = t.replace(/^"|"$/g, "");
    return t || null;
  }

  /* ------------------------------------------------ ключевые фразы (этап 2) */

  var KW_BEGIN = "<!-- keywords:begin -->";
  var KW_END = "<!-- keywords:end -->";

  /** `[[a]] [[b]]` внутри этого блока считаются рёбрами вида "keyword". */
  function keywordMarkers() { return { begin: KW_BEGIN, end: KW_END }; }

  /** "a; b" | "a, b" | YAML-список | массив -> ["a", "b"] (порядок и регистр сохраняем). */
  function parseKeywords(v, alt) {
    var src = v === undefined || v === null || v === "" ? alt : v;
    if (src === undefined || src === null) return [];
    var parts = [];
    if (Object.prototype.toString.call(src) === "[object Array]") parts = src.slice();
    else {
      var s = String(src).trim();
      if (s.charAt(0) === "[") s = s.slice(1, s.lastIndexOf("]"));
      parts = s.split(/;|\n|,(?![^(]*\))/);
    }
    var out = [], seen = {};
    for (var i = 0; i < parts.length; i++) {
      var p = normPhrase(String(parts[i] == null ? "" : parts[i]).replace(/^["']|["']$/g, ""));
      if (!p || seen[p]) continue;
      seen[p] = true;
      out.push(parts[i] ? String(parts[i]).trim().replace(/^["']|["']$/g, "") : "");
    }
    return out.filter(function (x) { return x !== ""; });
  }

  /** Нормалка фразы: нижний регистр + схлопнутые пробелы (поиск точный, но нечувствительный к регистру). */
  function normPhrase(s) {
    return String(s == null ? "" : s).toLowerCase().replace(/\s+/g, " ").trim();
  }

  var WORDCH = /[a-z0-9\u4e00-\u9fff]/;

  /** Сколько раз фраза встречается в тексте: точное совпадение, регистр не важен, слова целые. */
  function countPhrase(text, phrase) {
    var hay = String(text == null ? "" : text).toLowerCase();
    var need = normPhrase(phrase);
    if (!hay || !need) return 0;
    var n = 0, from = 0;
    for (;;) {
      var i = hay.indexOf(need, from);
      if (i < 0) break;
      from = i + need.length;
      var before = i > 0 ? hay.charAt(i - 1) : "";
      var after = from < hay.length ? hay.charAt(from) : "";
      if (before && WORDCH.test(before)) continue;
      if (after && WORDCH.test(after)) continue;
      n++;
    }
    return n;
  }

  /**
   * Разбор аннотации корпуса: `# заголовок` = имя вершины-секции, дальшеregions `## имя
   * заголовка`. Возвращает {title, preamble, regions:[{name, text, line}]}; текст ДО
   * первого `##` — преамбула (её вхождения идут в вес секции, а не заголовка).
   */
  function parseAbstract(text) {
    var read = typeof text === "string" ? parseFrontmatter(text) : text;
    var lines = String(read.body == null ? "" : read.body).replace(/\r\n/g, "\n").split("\n");
    var title = null, regions = [], pre = [];
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (title === null && /^#\s+\S/.test(l)) { title = l.replace(/^#\s+/, "").trim(); continue; }
      var m = /^##\s+\S/.exec(l);
      if (m) { regions.push({ name: l.replace(/^##\s+/, "").trim(), line: i, text: "" }); continue; }
      if (/^#\s+\S/.test(l)) break; // началась следующая аннотация в одном файле — обрываем
      if (regions.length) regions[regions.length - 1].text += l + "\n";
      else pre.push(l);
    }
    return { title: title, section: String((read.data || {}).section || "").trim() || null, preamble: pre.join("\n"), regions: regions };
  }

  /**
   * Индекс корпуса: список аннотаций + граф (нужны имена вершин heading/section).
   * corpus.lookup(фраза) -> {phrase, total, hits:[{id,name,level,chapter,count,note}], byChapter}
   */
  function buildKeywordCorpus(abstractNotes, graph, opts) {
    var cfg = merge(DEFAULTS, opts || {});
    var byId = (graph && graph._byId) || {};
    // Названия заголовков нередко повторяются в разных секциях (например, «Examples»).
    // Поэтому одного глобального `name -> node` недостаточно: аннотация уже указывает
    // секцию в frontmatter, и именно в этой секции нужно искать ##-регион. Иначе
    // совпадение из Ch02 могло ошибочно дать связь с первым таким заголовком из Ch01
    // и скрыть настоящую связь с узлом Ch02.
    var sectionsByName = {};
    var headingsByName = {};
    var headingsBySection = {};
    function add(map, key, node) {
      if (!key || !node) return;
      var list = map[key] || (map[key] = []);
      if (list.indexOf(node) < 0) list.push(node);
    }
    ((graph && graph.nodes) || []).forEach(function (n) {
      var name = normPhrase(n.name);
      var stem = normPhrase(n.stem);
      if (n.type === "section") {
        add(sectionsByName, name, n);
        add(sectionsByName, stem, n);
        return;
      }
      if (n.type !== "heading") return;
      add(headingsByName, name, n);
      add(headingsByName, stem, n);
      if (n.parent) {
        var inSection = headingsBySection[n.parent] || (headingsBySection[n.parent] = {});
        add(inSection, name, n);
        add(inSection, stem, n);
      }
    });
    function one(list) {
      // Без section: в заголовке/имени файла можно доверять только однозначному имени.
      // Не выбираем «первый попавшийся» узел: ложная связь хуже честного unmatched.
      return list && list.length === 1 ? list[0] : null;
    }
    var regions = [], notes = 0, unmatched = 0;
    (abstractNotes || []).forEach(function (raw) {
      if (!raw || !raw.path) return;
      var read = readNote(raw);
      if (String(read.data[cfg.typeKey] || "").trim().toLowerCase() !== "abstract") return;
      var parsed = parseAbstract(read);
      notes++;
      var sec = parsed.section ? byId[parsed.section] : null;
      if (!sec || sec.type !== "section") sec = one(sectionsByName[normPhrase(parsed.title)]);
      var regionsBefore = regions.length;
      if (sec) regions.push({ node: sec, level: "section", text: parsed.preamble, note: raw.path });
      else unmatched++;
      parsed.regions.forEach(function (r) {
        var key = normPhrase(r.name);
        // При известной секции берём ВСЕ одноимённые заголовки только этой секции.
        // Это сохраняет связь с каждым соответствующим узлом и не смешивает главы.
        var matches = sec && headingsBySection[sec.id] ? headingsBySection[sec.id][key] : null;
        if (!matches || !matches.length) matches = sec ? [] : (headingsByName[key] || []);
        if (!matches.length) { unmatched++; return; }
        matches.forEach(function (h) {
          regions.push({ node: h, level: "heading", text: r.text, note: raw.path });
        });
      });
      if (!parsed.preamble && regions.length === regionsBefore && !sec) unmatched++;
    });
    var cache = {};
    return {
      stats: { notes: notes, regions: regions.length, unmatched: unmatched },
      regions: regions,
      lookup: function (phrase) {
        var key = normPhrase(phrase);
        if (!key) return { phrase: key, total: 0, hits: [], byChapter: {} };
        if (cache[key]) return cache[key];
        var hits = [], byTarget = {}, byChapter = {}, total = 0;
        regions.forEach(function (r) {
          var c = countPhrase(r.text, key);
          if (c <= 0) return;
          total += c;
          // Только id настоящей главы: section.id не является главой для цвета.
          var ch = r.node.chapter || chapterOf(r.node, byId);
          var cur = byTarget[r.node.id];
          if (!cur) {
            cur = byTarget[r.node.id] = {
              id: r.node.id,
              name: r.node.name,
              stem: r.node.stem,
              level: r.level,
              chapter: ch,
              count: 0,
              note: r.note,
              chapters: [],
              byChapter: {},
            };
            hits.push(cur);
          }
          cur.count += c;
          if (ch) {
            cur.byChapter[ch] = (cur.byChapter[ch] || 0) + c;
            if (cur.chapters.indexOf(ch) < 0) cur.chapters.push(ch);
            byChapter[ch] = (byChapter[ch] || 0) + c;
          }
        });
        return (cache[key] = { phrase: key, total: total, hits: hits, byChapter: byChapter });
      },
    };
  }

  /** План для одного блока: цели (с весами), суммарный вес, разбивка по главам, «доминирующая» глава. */
  function planBlockKeywords(data, corpus, ownChapter, opts) {
    var cfg = merge(DEFAULTS, opts || {});
    var fm = data || {};
    var list = parseKeywords(fm[cfg.keywordsKey], fm[cfg.keywordsAltKey]);
    var byTarget = {}, byChapter = {}, total = 0, empty = [];
    list.forEach(function (phrase) {
      var res = corpus.lookup(phrase);
      if (!res.hits.length) { empty.push(phrase); return; }
      res.hits.forEach(function (h) {
        total += h.count;
        var cur = byTarget[h.id];
        if (cur) { cur.count += h.count; cur.phrases.push(phrase); }
        else byTarget[h.id] = { id: h.id, name: h.name, stem: h.stem, level: h.level, chapter: h.chapter, count: h.count, phrases: [phrase] };
        // Копим реальные вхождения каждой главы, а не общий вес цели для каждой
        // главы, в которой она когда-либо встретилась. Второй вариант раздувал бы
        // счётчик и мог выбрать для цвета не ту доминирующую главу, если в корпусе
        // два файла ссылаются на один узел.
        var hitChapters = h.byChapter || null;
        if (hitChapters) {
          Object.keys(hitChapters).forEach(function (ch) {
            if (!ch) return;
            byChapter[ch] = (byChapter[ch] || 0) + hitChapters[ch];
          });
        } else {
          // Совместимость с индексами, созданными внешними скриптами до появления
          // byChapter у попадания: в типичном случае у цели была одна глава.
          (h.chapters && h.chapters.length ? h.chapters : [h.chapter]).forEach(function (ch) {
            if (!ch) return;
            byChapter[ch] = (byChapter[ch] || 0) + h.count;
          });
        }
      });
    });
    var dominant = ownChapter || null, best = -1;
    Object.keys(byChapter).sort().forEach(function (ch) {
      var v = byChapter[ch] + (ch === ownChapter ? 0.5 : 0); // при равенстве остаётся своя глава
      if (v > best) { best = v; dominant = ch; }
    });
    return {
      keywords: list,
      // Никакой фильтрации по dominant здесь нет: ссылка должна появиться у
      // КАЖДОЙ секции/заголовка, в чьей аннотации есть фраза. dominant нужен
      // исключительно для цвета вершины.
      targets: Object.keys(byTarget).sort().map(function (k) { return byTarget[k]; }),
      weight: total,
      byChapter: byChapter,
      dominant: dominant,
      unmatched: empty,
    };
  }

  /** «1 вхождение / 2 вхождения / 5 вхождений» — русские числительные для отчётов. */
  function plural(n) {
    var v = Math.abs(Number(n) || 0) % 100, d = v % 10;
    if (v > 10 && v < 20) return " вхождений";
    if (d === 1) return " вхождение";
    if (d >= 2 && d <= 4) return " вхождения";
    return " вхождений";
  }

  /**
   * Legacy-список глав по разбивке вхождений. Новые узлы и пересчёт фраз эту функцию
   * больше не используют: связь должна вести к конкретной совпавшей секции/заголовку,
   * а не к главе-посреднику. Оставлена для чтения и безопасного снятия заметок, которые
   * были созданы старой версией плагина.
   */
  function relatedChapters(graph, plan, opts) {
    var o = opts || {};
    var exclude = {};
    (o.exclude || []).forEach(function (id) {
      if (id) exclude[id] = true;
    });
    var byId = (graph && graph._byId) || {};
    var byChapter = (plan && plan.byChapter) || {};
    var out = [];
    Object.keys(byChapter).forEach(function (id) {
      if (exclude[id]) return;
      var n = byId[id];
      if (!n || n.type !== "chapter" || n.inline) return;
      var count = byChapter[id];
      out.push({
        id: id,
        stem: n.stem,
        name: n.name,
        type: "chapter",
        phrase: n.name,
        count: count,
        // почему связь появилась — видно прямо в заметке, а не только в графе
        detail: count + plural(count) + " ключевых фраз в аннотациях главы",
      });
    });
    // сначала главы, о которых тема говорит больше всего; при равенстве — по id
    out.sort(function (a, b) {
      if (a.count !== b.count) return b.count - a.count;
      return a.id < b.id ? -1 : 1;
    });
    var limit = o.limit === undefined ? 0 : o.limit;
    return limit > 0 ? out.slice(0, limit) : out;
  }

  /** Текст блока между маркерами (материализованные ссылки). "" — значит «блока нет». */
  function keywordRegionText(plan, opts) {
    var cfg = merge(DEFAULTS, opts || {});
    if (!plan || !plan.keywords.length) return "";
    var out = [
      KW_BEGIN,
      "",
      "Связи по `" + cfg.keywordsKey + "` (" + plan.keywords.join(", ") + ") — найдено в аннотациях `" + cfg.keywordFolder +
        "`. Число после × — вес ребра (сколько раз фраза встречается в этой области); блок создан алгоритмом, править его руками бессмысленно: перезапишется.",
      "",
    ];
    plan.targets.forEach(function (t) {
      out.push("- [[" + t.stem + "|" + t.phrases.join(" · ") + (t.count > 1 ? " ×" + t.count : "") + "]] — " +
        (t.level === "section" ? "секция" : "заголовок") + " `" + t.id + "`, " + t.count +
        plural(t.count) + " в корпусе");
    });
    plan.unmatched.forEach(function (p) {
      out.push("- «" + p + "» — в корпусе `" + cfg.keywordFolder + "` не найдено");
    });
    out.push("");
    out.push("**Вес по ключевым фразам: " + plan.weight + (plan.dominant ? " · глава " + plan.dominant : "") +
      " (текст до первого `##` — связь с секцией, текст под `## Имя` — с заголовком)**");
    out.push(KW_END);
    return out.join("\n");
  }

  /** Разделить тело заметки на «всё остальное» и блок между маркерами. */
  function splitKeywordRegion(body) {
    var src = String(body == null ? "" : body);
    var i = src.indexOf(KW_BEGIN);
    if (i < 0) return { outside: src, region: null, at: -1, end: -1 };
    var j = src.indexOf(KW_END, i);
    var tail = j < 0 ? src.length : j + KW_END.length;
    var region = src.slice(i + KW_BEGIN.length, j < 0 ? src.length : j).replace(/^\s*\n|\s*$/g, "");
    var before = src.slice(0, i).replace(/\s+$/g, "");
    var after = src.slice(tail).replace(/^\n/, "").replace(/\s+$/g, "");
    return { outside: [before, after].filter(function (x) { return x !== ""; }).join("\n\n") + "\n", region: region, at: i, end: tail };
  }

  var RELATED_HEADING = "## Related topics";
  // Машинный раздел старых версий: распознаём его, чтобы пересчёт мог безопасно снять.
  var CHAPTER_HEADING = "## Related chapters";

  /**
   * Дописывает пункт-ссылку в раздел с данным заголовком; раздела нет — создаёт его
   * в конце текста. Пункт вставляется после последнего непустого абзаца раздела,
   * то есть перед следующим заголовком, ничего не разрывая.
   */
  function appendBulletToSection(outside, heading, bullet) {
    var lines = String(outside == null ? "" : outside).split("\n");
    var start = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim().toLowerCase() === heading.toLowerCase()) { start = i; break; }
    }
    if (start < 0) {
      var base = lines.join("\n").replace(/\s+$/g, "");
      return (base ? base + "\n\n" : "") + heading + "\n\n" + bullet + "\n";
    }
    var end = lines.length;
    for (var j = start + 1; j < lines.length; j++) {
      if (/^#{1,6}\s/.test(lines[j])) { end = j; break; }
    }
    var at = end;
    while (at > start + 1 && lines[at - 1].trim() === "") at--;
    lines.splice(at, 0, bullet);
    return lines.join("\n");
  }

  /**
   * Ручная связь между вершинами, созданная прямо в графе (ЛКМ по первому узлу,
   * затем Ctrl+ЛКМ по второму). У графа нет «своих» рёбер — дуга рисуется, когда
   * в тексте источника появляется wiki-ссылка; эта функция и дописывает её в тело
   * заметки-источника: в раздел «Related topics» (создаётся, если его нет), всегда
   * ВНЕ региона keywords:begin/end — регион пишет только материализатор фраз, и он
   * обязан оставаться последним блоком тела. Возвращает новый текст заметки или
   * исходный, если ссылку добавлять некуда/незачем (повтор — идемпотентно,
   * фронтматтер и `$$формулы$$` не трогаются).
   */
  function appendManualLink(text, target, opts) {
    var src = String(text == null ? "" : text).replace(/\r\n/g, "\n");
    var stem = String((target && target.stem) || "").trim();
    if (!stem) return src;
    var parsed = parseFrontmatter(src);
    var body = parsed.body;
    var name = String((target && target.name) || "").replace(/[\[\]#|]/g, "").trim();
    var link = "[[" + stem + (name && name !== stem ? "|" + name : "") + "]]";
    var cut = splitKeywordRegion(body);
    // ссылка на эту заметку в теле уже есть (вне региона фраз) — не дублируем
    var lower = stem.toLowerCase();
    var exists = extractLinks(cut.outside).some(function (l) {
      var p = String(l.path || "").trim().toLowerCase().replace(/\\/g, "/");
      if (!p) return false;
      var last = p.split("/").pop();
      return p === lower || p === lower + ".md" || last === lower || last === lower + ".md";
    });
    if (exists) return src;
    var bullet = "- " + link + " — added via graph";
    var newBody;
    if (cut.region === null) {
      newBody = appendBulletToSection(body, RELATED_HEADING, bullet);
    } else {
      // регион фраз (и всё после него) остаётся байт-в-байт: ссылка пишется ДО него
      var before = body.slice(0, cut.at);
      var rest = body.slice(cut.at);
      newBody = appendBulletToSection(before, RELATED_HEADING, bullet).replace(/\s+$/g, "") + "\n\n" + rest.replace(/^\n+/, "");
    }
    return (parsed.hasFrontmatter ? parsed.raw : "") + newBody;
  }

  /** Вставить/заменить/удалить блок между маркерами; всё остальное — байт-в-байт. */
  function applyKeywordRegion(body, text) {
    var src = String(body == null ? "" : body);
    var cut = splitKeywordRegion(src);
    var base = cut.region === null ? src : cut.outside;
    var trim = String(text == null ? "" : text).replace(/\s+$/g, "");
    if (!trim) return base.replace(/\s+$/g, "") + "\n";
    var head = base.replace(/\s+$/g, "");
    return (head ? head + "\n\n" : "") + trim + "\n";
  }

  // строка-пункт машинного раздела «Related chapters»: «- [[stem|name]] — глава `id`…»
  var CHAPTER_BULLET_RE = /^\s*[-*+]\s+\[\[[^\]]*\]\][^\n]*\u0433\u043b\u0430\u0432\u0430\s+`/;

  /**
   * Снимает ТОЛЬКО машинный раздел «Related chapters»: заголовок и идущие следом
   * его же пункты-ссылки (плюс пустые строки между ними). Останавливается на первой
   * строке, которая не пустая и не такой пункт, — чтобы не проглотить произвольный
   * текст, оказавшийся после раздела (например, абзац, «съехавший» вниз при слиянии
   * узлов: там body-контент может встать сразу за списком глав, без своего заголовка).
   */
  function removeSection(text, heading) {
    var lines = String(text == null ? "" : text).replace(/\r\n/g, "\n").split("\n");
    var low = String(heading || "").toLowerCase();
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim().toLowerCase() !== low) continue;
      var end = i + 1;
      while (end < lines.length) {
        var t = lines[end].trim();
        if (t === "" || CHAPTER_BULLET_RE.test(lines[end])) { end++; continue; }
        break;
      }
      lines.splice(i, end - i);
      // подчищаем сдвоенные и хвостовые пустые строки, оставшиеся после выреза
      while (i > 0 && i < lines.length && lines[i - 1].trim() === "" && lines[i].trim() === "") lines.splice(i, 1);
      while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
      i--;
    }
    return lines.join("\n");
  }

  /** Строки legacy-раздела «Related chapters» (нужны только для совместимости). */
  function chapterBullets(chapters) {
    return (chapters || []).map(function (c) {
      return "- [[" + c.stem + "|" + c.name + (c.count > 1 ? " ×" + c.count : "") + "]] — глава `" +
        c.id + "`" + (c.detail ? ", " + c.detail : "");
    });
  }

  /**
   * Совместимость со старым машинным разделом «Related chapters». Новый алгоритм
   * передаёт пустой список и тем самым снимает этот раздел: глава-лидер теперь
   * отвечает только за цвет, а corpus-ссылки остаются в keywords:begin/end на
   * конкретные секции и заголовки. Переданный непустой список поддержан лишь для
   * безопасного разбора/миграции старых заметок.
   *
   * Раздел всегда живёт ВНЕ региона keywords:begin/end (перед ним). Фронтматтер и
   * всё, что стоит после региона, не трогаются.
   */
  function applyRelatedChapters(text, chapters, opts) {
    var src = String(text == null ? "" : text).replace(/\r\n/g, "\n");
    var parsed = parseFrontmatter(src);
    var body = parsed.body;
    var cut = splitKeywordRegion(body);
    // часть тела до региона фраз (или всё тело, если региона нет) — только её и правим
    var before = cut.region === null ? body : body.slice(0, cut.at);
    var rest = cut.region === null ? "" : body.slice(cut.at);
    var stripped = removeSection(before, CHAPTER_HEADING);
    var bullets = chapterBullets(chapters);
    var head;
    if (bullets.length) {
      var base = stripped.replace(/\s+$/g, "");
      head = (base ? base + "\n\n" : "") + CHAPTER_HEADING + "\n\n" + bullets.join("\n");
    } else {
      head = stripped.replace(/\s+$/g, "");
    }
    var newBody;
    if (cut.region === null) {
      newBody = head.replace(/\s+$/g, "") + "\n";
    } else {
      // регион (и всё после него) остаётся байт-в-байт: раздел пишется ДО него
      newBody = head.replace(/\s+$/g, "") + "\n\n" + rest.replace(/^\n+/, "");
    }
    return (parsed.hasFrontmatter ? parsed.raw : "") + newBody;
  }

  /* ------------------------------------------------------------ граф */

  function basenameKey(path) {
    return stemOf(path).toLowerCase();
  }

  /**
   * notes: массив [{path, text}] (или уже разобранных {path, frontmatter, body}).
   * opts: overrides DEFAULTS (см. DEFAULTS).
   *
   * Разрешение ссылки: 1) полный путь, 2) путь без .md, 3) имя файла, 4) id
   * (совпадение с полем `id` — так работают «короткие» ссылки вроде [[Ch01-S01-H01-B01]]).
   */
  function buildGraph(rawNotes, opts) {
    var cfg = merge(DEFAULTS, opts || {});
    var notes = [];
    var byPath = {};
    var byStem = {};
    var byId = {};
    var anchorNodes = [];

    (rawNotes || []).forEach(function (n) {
      if (!n || !n.path) return;
      var read = readNote(n);
      // ссылки внутри «материализованного» блока ключевых фраз — отдельный вид ребра:
      // их число (weight: в ребре) и есть вес по вхождениям, а при выключенном
      // переключателе keywordLinks они просто не попадают в граф
      var cut = cfg.keywordLinks === false ? { outside: read.body, region: null } : splitKeywordRegion(read.body);
      var links = extractLinks(cut.outside);
      var kwLinks = [];
      if (cut.region) {
        kwLinks = extractLinks(cut.region);
        kwLinks.forEach(function (l) {
          l.keyword = true;
          // «фраза ×3» в псевдониме = три вхождения: ядро строит ребро весом 3, поэтому
          // вес в графе и вес, записанный в свойство weight:, всегда берутся из одного текста
          var m = /\u00d7(\d+)\s*$/.exec(String(l.alias == null ? "" : l.alias));
          if (m) l.count = Math.max(1, Math.min(9999, Number(m[1])));
        });
      }
      var node = nodeFromRead(read, cfg, links.concat(kwLinks));
      node.keywordLinks = kwLinks.length;
      node.anchors = cfg.includeInlineAnchors ? extractAnchors(read.body) : [];
      node.body = read.body;
      node.data = read.data;
      notes.push(node);
      byPath[node.path.toLowerCase()] = node;
      var sk = basenameKey(node.path);
      if (!byStem[sk]) byStem[sk] = node;
      if (node.id && !byId[node.id]) byId[node.id] = node;
    });

    // узлы для inline-якорей (блоки текста внутри чужих заметок)
    notes.forEach(function (owner) {
      (owner.anchors || []).forEach(function (a) {
        var id = owner.stem + "#^" + a.id;
        if (byId[id]) return;
        var label = sanitizeLabel(a.label).slice(0, 80);
        var an = {
          id: id,
          path: owner.path,
          stem: owner.stem,
          type: "block",
          declaredType: "inline",
          inline: true,
          anchorName: a.id,
          name: label || a.id,
          nameZh: "",
          nameFromFilename: true,
          zhMissing: true,
          parent: owner.id,
          chapter: owner.chapter,
          status: null,
          isPlaceholder: false,
          links: [],
          anchors: [],
          body: "",
          data: {},
        };
        notes.push(an);
        byId[id] = an;
        anchorNodes.push(an);
      });
    });

    var nodes = notes;
    var nodeSet = {};
    nodes.forEach(function (n) {
      nodeSet[n.id] = n;
    });

    function resolve(link, from) {
      var p = String(link.path || "").replace(/\\/g, "/");
      var hit = null;
      if (p) {
        var full = /\.md$/i.test(p) ? p : p + ".md";
        hit = byPath[full.toLowerCase()] || null;
        if (!hit && p.indexOf("/") < 0) {
          hit = byStem[stemOf(p).toLowerCase()] || byId[p] || null;
          if (!hit) {
            for (var i = 0; i < notes.length; i++) {
              if (notes[i].id === p) {
                hit = notes[i];
                break;
              }
            }
          }
        }
      } else if (from) {
        hit = from; // [[#...]] / [[#^id]] внутри своего файла
      }
      if (link.blockId) {
        var owner = hit || from;
        if (owner) {
          var a = byId[owner.stem + "#^" + link.blockId];
          if (a) return a;
        }
      }
      return hit;
    }

    var edges = [];
    var seenPair = {};

    function addEdge(source, target, kind, meta) {
      if (!source || !target) return false;
      if (source === target && !cfg.includeSelfEdges) return false;
      var key = source.id + "\u0000" + target.id + "\u0000" + kind;
      var w = meta && meta.count ? meta.count : 1;
      if (seenPair[key]) {
        seenPair[key].weight += w;
        return false;
      }
      var e = {
        source: source.id,
        target: target.id,
        sourcePath: source.path,
        targetPath: target.path,
        kind: kind,
        weight: w,
        anchors: [],
      };
      // Обычная ручная/reference-ссылка на главу — не структурное ребро. Для
      // совместимости со старыми заметками не включаем её в пружины: иначе большое
      // число legacy-ссылок из «Related chapters» стянет главы-хабы в центр. Новый
      // алгоритм keyword-связей сюда не попадает — он ссылается прямо на секции и
      // заголовки внутри региона keywords:begin/end.
      if (kind === "reference" && target.type === "chapter") e.chapterRef = true;
      if (meta && meta.alias) e.alias = meta.alias;
      seenPair[key] = e;
      edges.push(e);
      if (meta && meta.blockId) e.anchors.push("^" + meta.blockId);
      if (meta && meta.anchor) e.anchors.push("#" + meta.anchor);
      return true;
    }

    nodes.forEach(function (n) {
      n.out = [];
      n.in = [];
      (n.links || []).forEach(function (link) {
        var t = resolve(link, n);
        if (!t) {
          n.unresolved = (n.unresolved || 0) + 1;
          n.unresolvedLinks = n.unresolvedLinks || [];
          if (n.unresolvedLinks.length < 25) n.unresolvedLinks.push(link.path);
          return;
        }
        var kind = link.keyword ? "keyword" : (link.linkType === "embed" ? "embed" : "reference");
        var added = addEdge(n, t, kind, link);
        n.out.push({ id: t.id, kind: kind, added: added, anchor: link.blockId || link.anchor || null });
      });
      if (n.parent) {
        var up = byId[n.parent] || byStem[stemOf(n.parent).toLowerCase()] || byPath[(n.parent + ".md").toLowerCase()];
        if (up) addEdge(n, up, "structure", null);
        else if (n.parent !== cfg.typeKey) n.unresolved = (n.unresolved || 0) + 1;
      }
    });

    // степени
    nodes.forEach(function (n) {
      n.in = [];
      n.inRefs = 0;
      n.inStruct = 0;
      n.inEmbed = 0;
      n.outCount = (n.links || []).length;
    });
    edges.forEach(function (e) {
      var t = nodeSet[e.target];
      var s = nodeSet[e.source];
      if (!t || !s) return;
      t.in.push({ id: e.source, kind: e.kind, weight: e.weight });
      if (e.kind === "structure") t.inStruct += e.weight;
      else if (e.kind === "embed") t.inEmbed += e.weight;
      else t.inRefs += e.weight;
    });
    var degreeOf = function (n) {
      return cfg.countStructural ? n.inRefs + n.inStruct + n.inEmbed : n.inRefs + n.inEmbed;
    };
    // вес по ключевым фразам = суммарное число вхождений (не число заметок и не число
    // ссылок): складываем веса рёбер вида keyword; «доминирующая глава» — та, что собрала
    // больше всего вхождений (при равенстве остаётся своя, см. planBlockKeywords)
    nodes.forEach(function (n) { n.kwWeight = 0; n.kwChapter = null; n.kwByChapter = {}; });
    edges.forEach(function (e) {
      if (e.kind !== "keyword") return;
      var s = nodeSet[e.source], t = nodeSet[e.target];
      if (!s || !t) return;
      s.kwWeight += e.weight;
      var ch = t.chapter || (t.type === "chapter" ? t.id : chapterOf(t, byId));
      if (!ch) return;
      s.kwByChapter[ch] = (s.kwByChapter[ch] || 0) + e.weight;
    });
    nodes.forEach(function (n) {
      var best = -1, own = chapterOf(n, byId);
      for (var ch in n.kwByChapter) {
        var v = n.kwByChapter[ch] + (ch === own ? 0.5 : 0);
        if (v > best) { best = v; n.kwChapter = ch; }
      }
      if (n.kwWeight <= 0) n.kwChapter = null;
    });
    var maxDeg = 1, maxWeight = 1;
    nodes.forEach(function (n) {
      n.degree = degreeOf(n);
      if (n.degree > maxDeg) maxDeg = n.degree;
      // размер вершины: для блоков с ключевыми фразами — число вхождений вместо ссылочной степени
      n.sizeValue = cfg.keywordLinks !== false && n.kwWeight > 0 ? n.kwWeight : n.degree;
      if (n.sizeValue > maxWeight) maxWeight = n.sizeValue;
    });
    applySizes(nodes, cfg);

    var stats = {
      nodes: nodes.length,
      edges: edges.length,
      inlineAnchors: anchorNodes.length,
      maxDegree: maxDeg,
      unresolved: nodes.reduce(function (a, n) {
        return a + (n.unresolved || 0);
      }, 0),
      byType: TYPES.concat(["unknown"]).reduce(function (acc, t) {
        acc[t] = 0;
        return acc;
      }, {}),
    };
    nodes.forEach(function (n) {
      stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
    });
    stats.maxWeight = maxWeight;
    stats.keywordNodes = nodes.filter(function (n) { return n.kwWeight > 0; }).length;
    stats.orphanNodes = nodes.filter(function (n) {
      return n.degree === 0 && !(n.outCount > 0);
    }).length;

    var graph = { nodes: nodes, edges: edges, stats: stats, config: cfg };
    graph._byId = byId;
    graph.chapterColors = resolveColors(graph, cfg); // цвет главы -> её секции/заголовки/блоки
    findDuplicateGroups(graph, cfg);
    return graph;
  }

  /**
   * max/min входящих ссылок — на весь граф и по каждому уровню.
   * Если внутри уровня все степени равны, нормировка по уровню вырождается
   * (все вершины стали бы максимальными) — тогда для этого уровня берём глобальный max.
   */
  function sizeScale(nodes, cfg) {
    var global = 1, gmin = Infinity;
    var byType = {}, range = {};
    nodes.forEach(function (n) {
      var d = n.sizeValue === undefined || n.sizeValue === null ? (n.degree || 0) : n.sizeValue;
      if (d > global) global = d;
      if (d < gmin) gmin = d;
      var t = n.type;
      byType[t] = Math.max(byType[t] || 1, d);
      range[t] = range[t] === undefined ? { min: d, max: d } : { min: Math.min(range[t].min, d), max: Math.max(range[t].max, d) };
    });
    var eff = {};
    TYPES.forEach(function (t) {
      if (!range[t]) return;
      if (range[t].max === range[t].min) {
        eff[t] = global; // внутри уровня все равны -> нормировка по уровню вырождается
        return;
      }
      if (cfg.sizeMode === "byType") eff[t] = byType[t];
      else if (cfg.sizeMode === "global") eff[t] = global;
      // гибрид: сглаженный максимум — контраст внутри уровня сохраняется,
      // но «блоков» с 2 ссылками всё меньше, чем «главы» с 13
      else eff[t] = Math.pow(byType[t], 0.35) * Math.pow(global, 0.65);
    });
    return { global: global || 1, byType: byType, eff: eff, range: range, min: gmin === Infinity ? 0 : gmin, base: cfg.degreeBase === "zero" ? 0 : (gmin === Infinity ? 0 : gmin) };
  }

  function refMaxFor(node, scale, cfg) {
    if (cfg.sizeMode === "global") return scale.global;
    return scale.eff[node.type] || scale.global;
  }

  /** Пересчитывает радиусы и кегль подписей на месте (без перестройки графа). */
  function applySizes(nodes, cfg) {
    cfg = merge(DEFAULTS, cfg || {});
    var scale = sizeScale(nodes, cfg);
    var base = cfg.degreeBase === "zero" ? 0 : scale.min;
    nodes.forEach(function (n) {
      var md = refMaxFor(n, scale, cfg);
      var d = n.sizeValue === undefined || n.sizeValue === null ? (n.degree || 0) : n.sizeValue;
      var frac = d <= base || md <= base ? 0 : Math.pow((Math.min(d, md) - base) / Math.max(1, md - base), cfg.degreeGamma || 0.5);
      n.relDegree = frac;
      n.refMax = md;
      n.r = cfg.minRadius + (cfg.maxRadius - cfg.minRadius) * frac;
      // labelScale — множитель A−/A+; он же задаёт «насколько крупны подписи» по
      // умолчанию. Входит в baseFont, а не домножается потом: от него зависит и
      // labelChars (сколько символов влезает), и габарит метки для упаковки.
      var lscale = Math.max(0.1, Number(cfg.labelScale) || 1);
      n.baseFont = (cfg.labelFontBySize
        ? cfg.labelFontMin + (cfg.labelFontMax - cfg.labelFontMin) * frac
        : cfg.labelFontSize) * lscale;
      n.font = n.baseFont;
      // 1) «пол» по типу: глава/секция не могут стать точкой без подписи,
      //    даже если на них никто не сослался текстом (типично для реальных конспектов)
      var floor = (cfg.sizeFloor || {})[n.type] || 0;
      n.rFloor = floor;
      if (floor && n.r < floor) n.r = floor;
      // 2) ручная правка размера из свойств заметки: size: 1.4 / 0.7 / «22px»
      n.sizeFactor = factorOf(n.sizeRaw === null || n.sizeRaw === undefined ? 1 : n.sizeRaw, n.r);
      n.r = Math.max(3, n.r * n.sizeFactor);
      // 2b) кегль подписи растёт вместе с вершиной — и когда вершину увеличили вручную
      n.font = clamp(n.baseFont * n.sizeFactor, 5, 60);
      n.labelAlways = !!(cfg.labelAlwaysFor || {})[n.type];
      // длина подписи считается от «базового» кегля: увеличить вершину = увеличить БУКВЫ,
      // а не обрезать текст сильнее (при baseFont 13 это ~18 символов на строку)
      var budget = (cfg.labelWidthFor || {})[n.type];
      if (!budget) budget = 240;
      n.labelChars = Math.max(6, Math.round(budget / n.baseFont));
      var capFor = (cfg.labelCharsFor || {})[n.type]; // у блоков и заголовков метка короче
      if (capFor) n.labelChars = Math.min(n.labelChars, capFor);
      // 3) габариты подписи -> «упаковочный» радиус: метки не должны наезжать друг на друга
      var lines = labelLines(n, cfg);
      var per = n.labelChars;
      // рисуем ровно две строки (EN и перевод) ЦЕЛИКОМ: то, что не влезает в бюджет
      // уровня, гаснет к правому краю (n.labelFade — доля подписи в полную силу),
      // а не отрезается многоточием. Упаковка считается по бюджету, а не по полному
      // тексту: место под метку отведено то же, что и при обрезке, поэтому нулевые
      // наложения меток сохраняются, а прочитать название целиком можно наведением.
      n.labelEn = fadeLabel(lines[0]);
      n.labelZh = lines[1] ? fadeLabel(lines[1]) : "";
      n.labelFade = labelFadeFrac(n.labelEn, n.labelZh, per);
      // «сколько метка занимает места» — по-прежнему бюджет уровня, а не полная строка:
      // текст за его границей уже прозрачен и на соседей не претендует
      n.labelEnClipped = clipLabel(lines[0], per);
      n.labelZhClipped = lines[1] ? clipLabel(lines[1], per) : "";
      // ширина — в «ем» по фактическим символам: азиатская глиф-строка в 1.6 раза шире
      // латинской при том же числе символов, и считать её по длине нельзя (метки бы
      // наезжали друг на друга, хотя «по оценке» всё чисто). Берём ОБРЕЗАННЫЕ строки:
      // ровно столько места метка и занимает, хвост за бюджетом уже прозрачен
      n.lw = Math.max(textUnits(n.labelEnClipped), textUnits(n.labelZhClipped)) * n.font + 8;
      n.lh = n.font * (n.labelZh ? 2.4 : 1.25) + 5;
      n.labelShown = labelShown(n, cfg);
      // «след» вершины: сколько места ей нужно по дуге кольца и сколько по радиусу.
      // если подпись рисуется, в ширину считается она, а не только круг
      n.footA = n.labelShown ? Math.max(n.r, n.lw * 0.52) : n.r;
      n.footR = n.labelShown ? n.r + n.lh * 0.8 : n.r;
      n.cr = Math.max(n.r + 3, n.footA * 0.82, n.footR * 0.7);
    });
    return scale;
  }

  /**
   * Ширина строки в em: узкие (латиница, цифры) ~0.70 em, широкие (иероглифы, катакана,
   * хангыль, полноширинные формы) ~1.05 em. Соотношение близко к реальным метрикам
   * UI-шрифта Obsidian, поэтому упаковка считает наезды по тому, что и рисуется.
   */
  function textUnits(str) {
    var t = String(str == null ? "" : str), u = 0;
    for (var i = 0; i < t.length; i++) u += wideGlyph(t.charCodeAt(i)) ? 1.05 : 0.7;
    return u;
  }

  function wideGlyph(c) {
    return (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0x303e) || (c >= 0x3040 && c <= 0x33ff) ||
      (c >= 0x3400 && c <= 0x4dbf) || (c >= 0x4e00 && c <= 0x9fff) || (c >= 0xa000 && c <= 0xa4cf) ||
      (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe6f) ||
      (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6) || c === 0x2026;
  }

  /** Сколько строк займёт подпись, повёрнутая по wrapText, и её ширина в символах. */
  function wrappedWidth(text, perLine) {
    var str = String(text == null ? "" : text);
    if (!str) return 0;
    var words = str.split(/\s+/).filter(Boolean);
    if (!words.length) return str.length;
    var line = "", max = 0, lines = 1;
    words.forEach(function (w) {
      if (!line) line = w;
      else if ((line + " " + w).length <= perLine) line += " " + w;
      else { max = Math.max(max, line.length); lines++; line = w; }
    });
    max = Math.max(max, line.length);
    return Math.max(max, perLine * 0.45) * Math.min(1, 1 / Math.max(1, lines * 0.55));
  }

  /**
   * Радиус по числу входящих ссылок. frac = ((deg - base) / (max - base))^gamma,
   * где base — «ноль шкалы» (по умолчанию минимальная степень в графе, т.е. самая
   * редко цитируемая вершина получает minRadius), а max — референсный максимум
   * (см. sizeScale: глобальный, по типу или гибрид).
   */
  function radiusFor(degree, cfg, maxDeg, baseDeg) {
    cfg = cfg || DEFAULTS;
    var lo = cfg.minRadius;
    var hi = cfg.maxRadius;
    var md = maxDeg || 1;
    var base = baseDeg === undefined ? 0 : baseDeg;
    if (degree <= base) return lo;
    var frac = Math.pow((Math.min(degree, md) - base) / Math.max(1, md - base), cfg.degreeGamma || 0.5);
    return lo + (hi - lo) * Math.max(0, Math.min(1, frac));
  }

  function merge(a, b) {
    var out = {};
    Object.keys(a || {}).forEach(function (k) {
      out[k] = a[k];
    });
    Object.keys(b || {}).forEach(function (k) {
      var v = b[k];
      if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) {
        out[k] = merge(a[k], v);
      } else {
        out[k] = v;
      }
    });
    return out;
  }

  /* ------------------------------------------------------------ layout */

  /** дети по структурной связи (поле parent, либо структурное ребро) */
  function buildTree(graph) {
    var kids = {};
    graph.nodes.forEach(function (n) {
      kids[n.id] = [];
    });
    graph.edges.forEach(function (e) {
      if (e.kind !== "structure") return;
      if (kids[e.target]) kids[e.target].push(e.source); // source — ребёнок, target — родитель
    });
    // parent ссылается на код, а ребро id->id: разворачиваем детей «вверх по иерархии»
    var byId = {};
    graph.nodes.forEach(function (n) {
      byId[n.id] = n;
    });
    graph.nodes.forEach(function (n) {
      if (!n.parent) return;
      var up = byId[n.parent] || null;
      if (up && kids[up.id].indexOf(n.id) < 0) kids[up.id].push(n.id);
    });
    Object.keys(kids).forEach(function (k) {
      kids[k] = kids[k]
        .filter(function (id, i, arr) {
          return arr.indexOf(id) === i; // без дублей: parent + структурное ребро
        })
        .map(function (id) {
          return byId[id];
        })
        .filter(Boolean)
        .sort(function (a, b) {
          return String(a.id) < String(b.id) ? -1 : 1;
        });
    });
    graph._kids = kids;
    graph._byId = byId;
    return kids;
  }

  /**
   * Sunburst: каждой главе — свой угловой сектор, внутри — секции, заголовки, блоки.
   * Возвращает число узлов, для которых заданы мишени (tx, ty).
   */
  function assignRadialTargets(graph, opts) {
    var o = opts || {};
    var cx = o.cx, cy = o.cy, R = o.radius;
    var kids = graph._kids || buildTree(graph);
    var chapters = graph.nodes
      .filter(function (n) {
        return n.type === "chapter";
      })
      .sort(function (a, b) {
        return String(a.id) < String(b.id) ? -1 : 1;
      });
    if (!chapters.length) chapters = graph.nodes.slice();
    var K = chapters.length;
    var start = -Math.PI / 2;
    var span = (Math.PI * 2) / K;
    var gap = span * 0.1;
    var ring = o.rings || [0.13, 0.4, 0.7, 1.0];
    var spacing = o.spacing || 30; // минимальный шаг между соседними вершинами
    var placed = 0;
    var orphans = [];
    var claimed = {};

    // вес = число листьев в поддереве:_sector_ выделяется пропорционально,
    // иначе на внешнем кольце вершины залезают друг на друга
    var weight = {};
    var visiting = {};
    function leaves(node) {
      if (weight[node.id] !== undefined) return weight[node.id];
      if (visiting[node.id]) return 1; // защита от цикла в parent-цепочке
      visiting[node.id] = true;
      var ch = (kids[node.id] || []).filter(function (c) {
        return c && c.id !== node.id;
      });
      var w = 1;
      if (ch.length) {
        w = 0;
        ch.forEach(function (c) {
          w += leaves(c);
        });
      }
      delete visiting[node.id];
      weight[node.id] = Math.max(1, w);
      return weight[node.id];
    }
    graph.nodes.forEach(leaves);

    function setPolar(node, ang, r) {
      node.tx = cx + r * Math.cos(ang);
      node.ty = cy + r * Math.sin(ang);
      placed++;
    }

    /**
     * Листья упаковываются клином (несколько «рядов» по радиусу), а не одной цепочкой
     * по кольцу: иначе при сотнях блоков они неизбежно залезают друг на друга.
     */
    function packLeaves(node, leaves, a0, a1, depth) {
      var rBase = R * ring[Math.min(depth, ring.length - 1)];
      var arc = Math.max(spacing, (a1 - a0) * rBase);
      var cols = Math.max(1, Math.floor(arc / spacing));
      var rows = Math.ceil(leaves.length / cols);
      // сжимаем клин, если он вышел слишком глубоким: рядов должно хватить, но без раздувания
      var rowStep = Math.min(spacing * 0.92, (R * 0.34) / Math.max(1, rows));
      leaves.forEach(function (c, i) {
        if (claimed[c.id]) return;
        claimed[c.id] = true;
        var col = i % cols;
        var row = Math.floor(i / cols);
        var frac = (col + 0.5) / cols;
        var ang = a0 + (a1 - a0) * frac + (row % 2 ? (a1 - a0) / cols / 2 : 0);
        setPolar(c, ang, rBase + row * rowStep);
      });
      if (node) node.tx = cx + R * ring[Math.max(0, depth - 1)] * Math.cos((a0 + a1) / 2), (node.ty = cy + R * ring[Math.max(0, depth - 1)] * Math.sin((a0 + a1) / 2));
    }

    function place(node, a0, a1, depth) {
      if (!node || claimed[node.id]) return;
      claimed[node.id] = true;
      var mid = (a0 + a1) / 2;
      var r = R * ring[Math.min(depth, ring.length - 1)];
      node.tx = cx + r * Math.cos(mid);
      node.ty = cy + r * Math.sin(mid);
      placed++;
      var ch = kids[node.id] || [];
      if (!ch.length || depth >= ring.length - 1) return;
      var leavesOnly = ch.every(function (c) {
        return !(kids[c.id] || []).length;
      });
      if (leavesOnly) {
        packLeaves(null, ch, a0, a1, depth + 1);
        return;
      }
      var total = 0;
      ch.forEach(function (c) {
        total += weight[c.id] || 1;
      });
      var cur = a0;
      ch.forEach(function (c) {
        var share = ((weight[c.id] || 1) / Math.max(1, total)) * (a1 - a0);
        place(c, cur, cur + share, depth + 1);
        cur += share;
      });
    }

    chapters.forEach(function (c, k) {
      var a0 = start + k * span + gap / 2;
      place(c, a0, a0 + span - gap, 0);
    });
    graph.nodes.forEach(function (n) {
      if (!claimed[n.id]) orphans.push(n);
    });
    // невошедшее (висячие узлы, ссылки между главами) — внешним кольцом золотым углом
    orphans.forEach(function (n, i) {
      var ang = (i * 2.399963229728653) % (Math.PI * 2);
      n.tx = cx + R * 1.06 * Math.cos(ang);
      n.ty = cy + R * 1.06 * Math.sin(ang);
      placed++;
    });
    return placed;
  }

  /** Параметры раскладки масштабируются размером графа (иначе 1000+ вершин сливаются в комок). */
  function tuneLayout(graph, layout) {
    var L = merge(DEFAULTS.layout, layout || {});
    if (L.autoTune === false) return L;
    var n = graph.nodes.length;
    var f = clamp(Math.sqrt(Math.max(1, n) / 450), 1, 3.4);
    L.linkDistance = L.linkDistance * (1 + 0.35 * (f - 1));
    L.repel = L.repel * f * f;
    L.radius = L.radius * f;
    L.gravity = L.gravity / (1 + 0.8 * (f - 1));
    L.tuneFactor = f;
    return L;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }


  /* -------------------------------------------------- цвета, дуги, упаковка кластеров */

  /** «Упаковочный» радиус вершины: что шире — сам круг или его подпись. */
  function effR(p, cfg) {
    if (cfg && cfg.packLabels !== false && p.cr) return p.cr;
    return (p.r || 6) + 2;
  }

  /** id главы: своё поле `chapter`, иначе подъём по цепочке `parent` (с защитой от цикла). */
  function chapterOf(n, byId, seen) {
    if (n.chapter) return n.chapter;
    if (n.type === "chapter") return n.id;
    if (!n.parent) return null;
    seen = seen || {};
    if (seen[n.id]) return null;
    seen[n.id] = true;
    var up = byId[n.parent];
    return up ? chapterOf(up, byId, seen) : null;
  }

  var HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

  /** #abc и #aabbcc (регистр не важен, вокруг — пробелы); всё остальное — не цвет. */
  function isHexColor(v) {
    return HEX.test(String(v == null ? "" : v).trim());
  }

  /** Нормализованный вид цвета для записи и сравнения: #aabbcc в нижнем регистре. */
  function normalizeHexColor(v) {
    var s = String(v == null ? "" : v).trim().toLowerCase();
    if (!HEX.test(s)) return "";
    if (s.length === 4) s = "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    return s;
  }

  /**
   * Группировка по цветам. По умолчанию цвет — у каждой главы свой (из chapterPalette),
   * и все секции, заголовки и блоки внутри главы красятся тем же цветом: кластер читаем
   * по цвету. Свойство `color:` в заметке перебивает и цвет главы, и цвет типа.
   * Возвращает карту «id главы -> цвет» (её показывает легенда и забирает встроенный Graph View).
   */
  function resolveColors(graph, cfg) {
    cfg = merge(DEFAULTS, cfg || {});
    var byId = graph._byId || {};
    if (!graph._byId) {
      byId = graph._byId = {};
      graph.nodes.forEach(function (n) { byId[n.id] = n; });
    }
    var pal = cfg.chapterPalette && cfg.chapterPalette.length ? cfg.chapterPalette : [cfg.colors.chapter];
    var chapters = graph.nodes
      .filter(function (n) { return n.type === "chapter"; })
      .sort(function (a, b) { return String(a.id) < String(b.id) ? -1 : 1; });
    var map = {};
    chapters.forEach(function (c, i) { map[c.id] = HEX.test(c.colorProp || "") ? c.colorProp : pal[i % pal.length]; });
    var byChapter = cfg.chapterColors !== false && chapters.length > 1;
    var colors = {};
    graph.nodes.forEach(function (n) {
      if (HEX.test(n.colorProp || "")) { n.color = n.colorProp; colors[n.id] = n.color; return; }
      var c = byChapter ? map[n.kwChapter || chapterOf(n, byId)] : null;
      n.color = c || cfg.colors[n.type] || cfg.colors.block;
      colors[n.id] = n.color;
    });
    // id главы -> цвет главы (пусто, если группировка по главам выключена), и цвет вершины
    graph.colorsByChapter = byChapter ? map : {};
    graph.colors = colors;
    return map;
  }

  /**
   * Дуга ребра: квадратичная кривая Безье, control point отстоит от середины по нормали.
   * Выпуклость направляем «от центра» графа — так рёбра внутри сектора не режут соседей,
   * а веер остаётся читаемым. bow = 0 -> прямая линия (как было раньше).
   */
  function arcPath(a, b, bow, center) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var k = Math.min((bow === undefined ? 0.22 : bow) * len, len * 0.4);
    var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    var nx = -dy / len, ny = dx / len;
    if (center && isFinite(center.x)) {
      var o1 = Math.pow(mx + nx * 12 - center.x, 2) + Math.pow(my + ny * 12 - center.y, 2);
      var o2 = Math.pow(mx - nx * 12 - center.x, 2) + Math.pow(my - ny * 12 - center.y, 2);
      if (o1 < o2) { nx = -nx; ny = -ny; }
    }
    return (
      "M" + f1(a.x) + " " + f1(a.y) +
      "Q" + f1(mx + nx * k) + " " + f1(my + ny * k) + " " + f1(b.x) + " " + f1(b.y)
    );
  }

  function f1(v) { return (Math.round(v * 10) / 10).toFixed(1); }

  /**
   * Путь ребра. Структурные рёбра (глава-секция-заголовок-блок) ведём «веером»:
   * контрольная точка стоит ровно между концами по углу, с лёгким провисанием к
   * центру. Так кривая не выходит за угловой диапазон концов, то есть остаётся
   * внутри сектора своей главы - и пересечься с соседним сектором не может.
   * Остальные рёбра (ссылки текстов, embed) — обычная дуга, выгнутая от центра.
   */
  function edgePath(a, b, bow, center, kind) {
    var hasC = center && isFinite(center.x) && isFinite(center.y);
    if (kind === "structure" && hasC) {
      var ra = Math.hypot(a.x - center.x, a.y - center.y);
      var rb = Math.hypot(b.x - center.x, b.y - center.y);
      var aa = Math.atan2(a.y - center.y, a.x - center.x);
      var ab = Math.atan2(b.y - center.y, b.x - center.x);
      var d = ab - aa;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      var hw = Math.min(a.ws === undefined ? 9 : a.ws, b.ws === undefined ? 9 : b.ws) * 0.6;
      var shift = Math.min(Math.abs(d) > 1e-4 ? bow * 0.18 : bow * 0.5, hw) * (d >= 0 ? 1 : -1);
      var mid = aa + d / 2 + shift;
      var rad = ((ra + rb) / 2) * (1 - Math.min(0.2, Math.abs(bow) * 0.5));
      return (
        "M" + f1(a.x) + " " + f1(a.y) +
        "Q" + f1(center.x + rad * Math.cos(mid)) + " " + f1(center.y + rad * Math.sin(mid)) +
        " " + f1(b.x) + " " + f1(b.y)
      );
    }
    return arcPath(a, b, bow, hasC ? center : null);
  }

  /**
   * Раскладка «кластеры по главам»: каждой главе — свой угловой сектор, внутри него
   * кольца по уровням. Ребра глава->секция->заголовок не пересекаются по построению
   * (каждое внутри своего клина), а упаковка с учётом подписей убирает наложения меток.
   */

  /**
   * Обрезаем подпись так, как она будет нарисована в СТАТИЧЕСКОМ экспорте (одна
   * строка, max `per` символов). В живом виде текст не режется вовсе: он рисуется
   * целиком и гаснет к правому краю своего бюджета (см. fadeLabel/labelFadeFrac) —
   * многоточие там не нужно и только съедает полезный символ.
   */
  function clipLabel(text, per) {
    var str = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    if (!per || per < 4) per = 4;
    if (str.length <= per) return str;
    return str.slice(0, Math.max(2, per - 1)).trim() + "\u2026";
  }

  /**
   * Подпись для ЖИВОГО вида: тот же текст, но без обрезки и без многоточия. Строка
   * возвращается целиком, а «не влезло» показывается затуханием — за него отвечает
   * labelFadeFrac(), который считает, какая доля метки помещается в отведённый бюджет.
   * Пробелы схлопываются, как и в clipLabel: иначе ширина по глифам считалась бы по
   * тексту, которого на экране нет.
   */
  function fadeLabel(text) {
    return String(text == null ? "" : text).replace(/\s+/g, " ").trim();
  }

  /**
   * Ширина `per` первых символов строки в ГЛИФАХ (em) — столько места отведено метке.
   * Считать бюджет в символах нельзя: иероглиф в полтора раза шире латинской буквы,
   * и «24 символа» для 中文 и для латиницы — это разная ширина на экране.
   */
  function labelBudgetUnits(text, per) {
    var str = fadeLabel(text);
    if (!str) return 0;
    if (!per || per < 4) per = 4;
    return textUnits(str.slice(0, per));
  }

  /**
   * Какая доля ПОДПИСИ показывается в полную силу: 1 — текст влез в бюджет целиком
   * (гасить нечего), меньше 1 — во столько раз он шире отведённого места, и во столько
   * же раз раньше начинается градиент прозрачности. Считается сразу по обеим строкам
   * (EN и перевод), потому что маска затухания в живом виде накладывается на подпись
   * целиком: короткая вторая строка при этом остаётся внутри непрозрачной части.
   * Ниже LABEL_FADE_MIN не опускаемся — у самого длинного названия должно оставаться
   * читаемое начало, а не один растворяющийся символ.
   */
  function labelFadeFrac(en, zh, per) {
    var a = fadeLabel(en), b = fadeLabel(zh);
    var full = Math.max(textUnits(a), textUnits(b));
    if (full <= 0) return 1;
    var budget = Math.max(labelBudgetUnits(a, per), labelBudgetUnits(b, per));
    if (budget >= full) return 1;
    return clamp(budget / full, LABEL_FADE_MIN, 1);
  }

  /**
   * Порог «показывать подпись». Он задан КВАНТИЛЕМ шкалы размеров, а не пикселем:
   * сдвиг ползунка «Размер вершин» меняет и радиусы, и порог, поэтому набор подписей
   * на экране от него не зависит (иначе при 44 подписей становилось вдвое больше и они
   * залезали друг на друга, а при 22 — исчезали совсем, включая подписи глав).
   */
  function labelThreshold(cfg) {
    cfg = cfg || {};
    var lo = cfg.minRadius === undefined ? DEFAULTS.minRadius : cfg.minRadius;
    var hi = cfg.maxRadius === undefined ? DEFAULTS.maxRadius : cfg.maxRadius;
    var raw = cfg.labelRadiusThreshold;
    var dlo = DEFAULTS.minRadius, dhi = DEFAULTS.maxRadius;
    if (raw === undefined || raw === null) return lo + (hi - lo) * 0.45;
    var frac = (Number(raw) - dlo) / Math.max(1, dhi - dlo);
    return lo + (hi - lo) * clamp(frac, 0, 1);
  }

  /** Видно ли подпись вершины при текущих настройках (то же правило, что в view.updateLabels). */
  function labelShown(n, cfg) {
    if (!cfg) return true;
    var mode = cfg.labelMode || "size";
    if (mode === "none") return false;
    if (mode === "always") return true;
    if (n.labelAlways) return true;
    if (mode === "hover") return false;
    if ((cfg.labelForTypes || {})[n.type] === false) return false;
    return (n.r || 0) >= labelThreshold(cfg);
  }

  /** Прямоугольник подписи на экране: две строки под кругом, по центру. */
  function labelRectOf(n) {
    if (!n.labelShown || !n.lw) return null;
    var y0 = (n.y || 0) + (n.r || 0) + 1;
    return { x0: (n.x || 0) - n.lw / 2, x1: (n.x || 0) + n.lw / 2, y0: y0, y1: y0 + n.lh };
  }

  function rectOfCircle(n, r) {
    return { x0: n.x - r, x1: n.x + r, y0: n.y - r, y1: n.y + r };
  }

  /**
   * Сдвигаем пару так, чтобы прямоугольник A перестал наезжать на B. Толкаем не по осям
   * экрана, а вдоль радиуса/касательной СВОЕГО сектора: узел зажат стенками кольца, и
   * обычное «сдвинуть по y» на боку окружности упирается в стену и не работает.
   */
  function pushRectRect(A, B, na, nb, k, plain) {
    var ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
    var oy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
    if (ox <= 0 || oy <= 0) return;
    if (plain) {
      // стен сектора нет - толкаем прямо по осям экрана, это минимальный сдвиг
      if (oy <= ox) {
        var s3 = (oy / 2 + 0.4) * k, sg3 = A.y0 + A.y1 <= B.y0 + B.y1 ? 1 : -1;
        if (!na.fixed) { na.y += s3 * sg3; }
        if (!nb.fixed) { nb.y -= s3 * sg3; }
      } else {
        var s4 = (ox / 2 + 0.4) * k, sg4 = A.x0 + A.x1 <= B.x0 + B.x1 ? 1 : -1;
        if (!na.fixed) { na.x += s4 * sg4; }
        if (!nb.fixed) { nb.x -= s4 * sg4; }
      }
      return;
    }
    if (oy <= ox) {
      var s = (oy / 2 + 0.4) * k;
      var sg = A.y0 + A.y1 <= B.y0 + B.y1 ? 1 : -1;
      nudgeWedge(na, s * sg, true);
      nudgeWedge(nb, -s * sg, true);
    } else {
      var s2 = (ox / 2 + 0.4) * k;
      var sg2 = A.x0 + A.x1 <= B.x0 + B.x1 ? 1 : -1;
      nudgeWedge(na, s2 * sg2, false);
      nudgeWedge(nb, -s2 * sg2, false);
    }
  }

  /** Сдвиг на `s` пикселей по экранной оси (y если vertical, иначе x) — вдоль стен сектора. */
  function nudgeWedge(n, s, vertical) {
    if (!n || n.fixed) return;
    var w = n.wmid === undefined ? Math.atan2(n.y, n.x) : n.wmid;
    var rx = Math.cos(w), ry = Math.sin(w);
    var tx = -ry, ty = rx;
    var ar = vertical ? ry : rx;
    var at = vertical ? ty : tx;
    if (Math.abs(ar) >= Math.abs(at)) {
      var c = Math.abs(ar) < 0.25 ? (ar < 0 ? -0.25 : 0.25) : ar;
      var d = s / c;
      n.x += rx * d; n.y += ry * d;
    } else {
      var c2 = Math.abs(at) < 0.25 ? (at < 0 ? -0.25 : 0.25) : at;
      var d2 = s / c2;
      n.x += tx * d2; n.y += ty * d2;
    }
  }

  /** Расталкиваем подписи: метка-на-метке и метка-на-чужом-круге. */
  function separateLabels(p, q, k, plain) {
    var A = labelRectOf(p), B = labelRectOf(q);
    if (A && B) pushRectRect(A, B, p, q, k, plain);
    else if (A) pushRectRect(A, rectOfCircle(q, (q.r || 6) + 1), p, q, k * 0.85, plain);
    else if (B) pushRectRect(B, rectOfCircle(p, (p.r || 6) + 1), q, p, k * 0.85, plain);
  }

  /**
   * Держим вершины внутри их сектора и кольца: пока каждый узел не выходит за
   * [wa0,wa1] x [wr0,wr1] своего поддерева, рёбра «глава - секция - заголовок» физически
   * не могут пересечься - сектора не перемешиваются.
   */
  function clampWalls(nodes, center) {
    if (!center) return 0;
    var moved = 0;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.wa0 === undefined) continue;
      var dx = n.x - center.cx, dy = n.y - center.cy;
      var ang = Math.atan2(dy, dx);
      var rad = Math.sqrt(dx * dx + dy * dy) || 0.001;
      var mid = (n.wa0 + n.wa1) / 2;
      var rel = ang - mid;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      var half = (n.wa1 - n.wa0) / 2 + (n.ws || 0);
      var rel2 = clamp(rel, -half, half);
      var rad2 = clamp(rad, n.wr0, n.wr1);
      if (Math.abs(rel2 - rel) > 0.01 || Math.abs(rad2 - rad) > 0.01) {
        n.x = center.cx + rad2 * Math.cos(mid + rel2);
        n.y = center.cy + rad2 * Math.sin(mid + rel2);
        moved++;
      }
    }
    return moved;
  }

  /**
   * Раскладка «кластеры по главам»: sunburst, где вес сектора = сколько места занимают
   * все вершины поддерева (круг + подпись). Каждой вершине запоминается её сектор и
   * кольцо, дальше их держат там collide / packAroundAnchors / физика.
   */
  function clusterLayout(graph, opts) {
    var o = opts || {};
    var L = merge(DEFAULTS.layout, o.layout || {});
    var cfg = o.config || {};
    var nodes = graph.nodes;
    var kids = graph._kids || buildTree(graph);
    var bands = L.clusterBands || DEFAULTS.layout.clusterBands;
    var pad = L.clusterPad === undefined ? 9 : L.clusterPad;
    var fill = L.clusterFill === undefined ? 0.9 : L.clusterFill;
    var cx = o.cx || 0, cy = o.cy || 0;
    var roots = nodes.filter(function (n) { return n.type === "chapter"; });
    if (!roots.length) roots = nodes.filter(function (n) { return !n.parent; });
    if (!roots.length) return 0;
    function foot(n) { return (n.footA === undefined ? effR(n, cfg) : n.footA * 1.06) * 2 + pad; }
    function footR(n) { return (n.footR === undefined ? effR(n, cfg) : n.footR) * 2 + 4; }
    var cost = {}, visiting = {};
    function costOf(n) {
      if (cost[n.id] !== undefined) return cost[n.id];
      if (visiting[n.id]) return foot(n);
      visiting[n.id] = true;
      var ch = (kids[n.id] || []).filter(function (c) { return c && c.id !== n.id; });
      var mine = foot(n);
      for (var i = 0; i < ch.length; i++) mine += costOf(ch[i]);
      delete visiting[n.id];
      cost[n.id] = mine;
      return mine;
    }
    nodes.forEach(costOf);
    // радиус подбираем по самому плотному кольцу (иначе 200 заголовков встанут внахлёст)
    var sums = {};
    nodes.forEach(function (n) {
      var t = bands[n.type] ? n.type : "block";
      sums[t] = (sums[t] || 0) + foot(n);
    });
    var rowH = {};
    nodes.forEach(function (n) {
      var t = bands[n.type] ? n.type : "block";
      rowH[t] = Math.max(rowH[t] || 0, footR(n));
    });
    var terms = [];
    var area = 0;
    nodes.forEach(function (n) { var e = effR(n, cfg); area += Math.max(1, e) * Math.max(1, e); });
    var R = Math.max(300, Math.sqrt(area / Math.PI / 0.3));
    Object.keys(sums).forEach(function (t) {
      var b = bands[t];
      var rho = Math.max(0.1, (b[0] + b[1]) / 2);
      var thick = Math.max(0.06, b[1] - b[0]);
      // (1) по дуге: «ноги» уровня должны влезть в ОДИН ряд своего кольца — только
      //     тогда кольца не перекрываются и рёбра «глава-секция-заголовок-блок» не
      //     пересекаются по построению (каждое ребро живёт в узкой прослойке между
      //     своими кольцами); (2) если подпись выше, чем толщина кольца — раздвигаем
      R = Math.max(R, (sums[t] * 1.16) / (2 * Math.PI * rho * fill));
      R = Math.max(R, ((rowH[t] || 20) + 4) / thick);
      terms.push(t + ":" + Math.round(sums[t] / (2 * Math.PI * rho * fill)));

    });
    if (o.radius) R = Math.max(R, o.radius * 0.6);
    graph._clusterTerms = terms.join(" ");
    R = clamp(R, 320, 20000);
    var span = (Math.PI * 2) / roots.length;
    var gap = span * (L.clusterGap === undefined ? 0.07 : L.clusterGap);
    var start = o.start === undefined ? -Math.PI / 2 : o.start;
    graph._center = { cx: cx, cy: cy, R: R, slack: gap * 0.4 };
    var total = 0;
    roots.forEach(function (r) { total += costOf(r); });
    var usable = Math.PI * 2 - gap * roots.length;
    var placed = 0, claimed = {};
    function place(node, a0, a1) {
      if (!node || claimed[node.id]) return;
      claimed[node.id] = true;
      var b = bands[node.type] || bands.block || [0.84, 1.06];
      var mid = (a0 + a1) / 2, rr = R * (b[0] + b[1]) / 2;
      node.wa0 = a0; node.wa1 = a1; node.wmid = mid;
      // угол священ (он держит сектора неперемешанными), радиус — нет: позволяем
      // вылезти за кольцо, чтобы подписи соседей могли разойтись
      node.wr0 = R * Math.max(0, b[0] - 0.03); node.wr1 = R * (b[1] + 0.07);
      // вне своего сектора узлу выходить нельзя (иначе сектора перемешаются и рёбра
      // пересекутся); главе оставляем маленький люфт в межсекторную щель
      node.ws = node._root ? gap * 0.45 : 0;
      node.tx = cx + rr * Math.cos(mid);
      node.ty = cy + rr * Math.sin(mid);
      placed++;
      var ch = (kids[node.id] || []).filter(function (c) { return c && !claimed[c.id]; });
      if (!ch.length) return;
      ch.sort(function (a, x) { return String(a.id) < String(x.id) ? -1 : 1; });
      var tot = 0;
      ch.forEach(function (c) { tot += costOf(c); });
      var cur = a0, wide = a1 - a0;
      ch.forEach(function (c) {
        var share = tot > 0 ? (costOf(c) / tot) * wide : wide / ch.length;
        var inset = Math.min(share * 0.08, 0.02); // щель между соседними подсекторами
        place(c, cur + inset * 0.5, cur + share - inset * 0.5);
        cur += share;
      });
    }
    var cur = start;
    roots.forEach(function (r) {
      r._root = true;
      var wide = total > 0 ? (costOf(r) / total) * usable : usable / roots.length;
      place(r, cur, cur + wide);
      cur += wide + gap;
    });
    // то, что не попало ни в одно дерево (нет parent, висячие ссылки) - внешним кольцом
    var ob = (bands.block || [0.84, 1.06])[1];
    var orphans = [];
    nodes.forEach(function (n) { if (!claimed[n.id]) orphans.push(n); });
    orphans.forEach(function (n, i) {
      var ang = start + (i * 2.399963229728653) % (Math.PI * 2);
      var rr = R * (ob + 0.06 + 0.05 * ((i % 3) - 1));
      n.tx = cx + rr * Math.cos(ang);
      n.ty = cy + rr * Math.sin(ang);
      n.wa0 = ang - 0.45; n.wa1 = ang + 0.45; n.ws = 0.12; n.wmid = ang;
      n.wr0 = R * (ob + 0.01); n.wr1 = R * (ob + 0.22);
      placed++;
    });
    return placed;
  }

  function placeClusters(graph, opts) {
    var o = opts || {}, L = merge(DEFAULTS.layout, o.layout || {});
    var placed = clusterLayout(graph, { cx: o.cx, cy: o.cy, radius: o.radius, layout: L, config: o.config });
    if (!placed) return 0;
    packAroundAnchors(graph, {
      layout: L, config: o.config,
      passes: o.passes === undefined ? L.packPasses : o.passes,
      pull: o.pull === undefined ? 0.5 : o.pull,
    });
    return placed;
  }

  /**
   * Раздвигаем вершины вокруг их слотов: позиции остаются там, где были (граф не «перескакивает»
   * при смене размера), а наложения кругов и подписей убираются. Именно это нужно, когда
   * физика выключена, а ползунок «Размер вершин» двигают.
   */
  function packAroundAnchors(graph, opts) {
    var o = opts || {}, L = merge(DEFAULTS.layout, o.layout || {});
    var passes = o.passes === undefined ? L.packPasses : o.passes;
    var pull = o.pull === undefined ? 0.5 : o.pull;
    var byId = graph._byId;
    var nodes = graph.nodes;
    var movable = nodes.filter(function (n) { return n.tx !== undefined && !n.fixed; });
    if (!movable.length) return 0;
    for (var i = 0; i < passes; i++) {
      var a = 1 - i / (passes + 2); // в конце слабее: не «гулять», а добивать наложения
      movable.forEach(function (n) {
        n.x += (n.tx - n.x) * pull * a;
        n.y += (n.ty - n.y) * pull * a;
      });
      collide(nodes, L, byId, 1, 0.85, o.rect !== false);
      clampWalls(nodes, graph._center);
    }
    nodes.forEach(function (n) { n.vx = 0; n.vy = 0; });
    return movable.length;
  }

  /** JSON-выгрузка: что видно на экране, то и в файле (узлы, рёбра, размеры, цвета, статистика). */
  function toGraphJson(graph, opts) {
    opts = opts || {};
    var nodes = opts.nodes || graph.nodes;
    var keep = {};
    nodes.forEach(function (n) { keep[n.id] = true; });
    var edges = (opts.edges || graph.edges).filter(function (e) { return keep[e.source] && keep[e.target]; });
    return {
      format: "lecture-graph/1",
      generated: opts.stamp || "",
      stats: {
        nodes: nodes.length,
        edges: edges.length,
        maxDegree: graph.stats ? graph.stats.maxDegree : 0,
        maxWeight: graph.stats ? graph.stats.maxWeight || 0 : 0,
        keywordNodes: graph.stats ? graph.stats.keywordNodes || 0 : 0,
        unresolved: graph.stats ? graph.stats.unresolved : 0,
        duplicateGroups: graph.stats ? graph.stats.duplicateGroups || 0 : 0,
        duplicateNodes: graph.stats ? graph.stats.duplicateNodes || 0 : 0,
        byType: graph.stats ? graph.stats.byType : {},
      },
      settings: {
        sizeMode: (graph.config || {}).sizeMode,
        minRadius: (graph.config || {}).minRadius,
        maxRadius: (graph.config || {}).maxRadius,
        degreeGamma: (graph.config || {}).degreeGamma,
        degreeBase: (graph.config || {}).degreeBase,
        countStructural: (graph.config || {}).countStructural,
        chapterColors: (graph.config || {}).chapterColors !== false,
        curvature: (graph.config || {}).curvature,
        keywordLinks: (graph.config || {}).keywordLinks !== false,
        keywordFolder: (graph.config || {}).keywordFolder || "35 - Abstracts",
      },
      chapterColors: graph.chapterColors || {},
      nodes: nodes.map(function (n) {
        return {
          id: n.id,
          type: n.type,
          name: n.name,
          name_zh: n.nameZh || "",
          path: n.path,
          status: n.status || "",
          placeholder: !!n.isPlaceholder,
          parent: n.parent || null,
          chapter: n.chapter || null,
          refs: { text: n.inRefs || 0, structural: n.inStruct || 0, embed: n.inEmbed || 0 },
          in: n.degree || 0,
          // ключевые фразы (этап 2): список в свойствах, вес = суммарное число вхождений,
          // kw_chapter — глава, собравшая больше всего вхождений (её цвет и красит вершину)
          keywords: (n.keywords || []).slice(),
          keyword_weight: n.kwWeight || 0,
          kw_chapter: n.kwChapter || null,
          size_value: n.sizeValue === undefined ? (n.degree || 0) : n.sizeValue,
          out: n.outCount || 0,
          unresolved: n.unresolved || 0,
          size_factor: n.sizeFactor || 1,
          radius: Math.round((n.r || 0) * 100) / 100,
          // как подпись лежит на экране: label_en/label_zh — как нарисована (текст рисуется
          // целиком), label_fade — доля строки в полную силу: 1 = влезла, меньше 1 = хвост
          // гаснет к правому краю бюджета (в статическом SVG вместо этого обрезка)
          label_en: n.labelEn === undefined ? n.name : n.labelEn,
          label_zh: n.labelZh === undefined ? (n.nameZh || "") : n.labelZh,
          label_fade: Math.round((n.labelFade === undefined ? 1 : n.labelFade) * 1000) / 1000,
          label_font: Math.round((n.font || 0) * 100) / 100,
          color: n.color || null,
          caption: n.caption || null,
          duplicate_of: n.duplicateOf || null,
          duplicate_group: n.duplicateGroup || null,
          x: isFinite(n.x) ? Math.round(n.x * 10) / 10 : null,
          y: isFinite(n.y) ? Math.round(n.y * 10) / 10 : null,
        };
      }),
      edges: edges.map(function (e) {
        return {
          source: e.source,
          target: e.target,
          kind: e.kind,
          weight: e.weight || 1,
          anchors: e.anchors || [],
        };
      }),
    };
  }

  function initPositions(nodes, opts) {
    opts = opts || {};
    var w = opts.width || 1200;
    var h = opts.height || 800;
    var cx = w / 2;
    var cy = h / 2;
    var graph = opts.graph || { nodes: nodes, edges: opts.edges || [] };
    var L = tuneLayout(graph, opts.layout);
    var R = L.radius * 0.5;
    var byType = { chapter: 0, section: 1, heading: 2, block: 3 };
    nodes.forEach(function (n, i) {
      n.index = i;
    });
    var hasTargets = false;
    if (L.mode === "twopi") {
      hasTargets = twopiLayout(graph, L, { cx: cx, cy: cy }) > 0;
    } else if (L.mode === "fdp" || L.mode === "neato") {
      seedBlobs(graph, L, { width: w, height: h });
    } else if (L.mode === "clusters") {
      hasTargets = placeClusters(graph, { cx: cx, cy: cy, radius: R, layout: L }) > 0;
    } else if (L.mode !== "force") {
      var maxR = opts.maxRadius || (graph.config && graph.config.maxRadius) || (opts.layout && opts.layout.maxRadius) || DEFAULTS.maxRadius;
      var placed = assignRadialTargets(graph, { cx: cx, cy: cy, radius: R, spacing: maxR * 2 + 4 });
      hasTargets = placed > 0;
    }
    if (!hasTargets) {
      var groups = {};
      nodes.forEach(function (n) {
        var g = byType[n.type] === undefined ? 3 : byType[n.type];
        (groups[g] || (groups[g] = [])).push(n);
      });
      Object.keys(groups).forEach(function (g) {
        var arr = groups[g];
        var ring = R * (0.28 + 0.32 * Number(g));
        arr.forEach(function (n, k) {
          var ang = (2 * Math.PI * k) / Math.max(1, arr.length) + Number(g) * 0.31;
          n.tx = cx + ring * Math.cos(ang);
          n.ty = cy + ring * Math.sin(ang);
        });
      });
    }
    nodes.forEach(function (n) {
      n.x = n.tx !== undefined ? n.tx : cx + (((n.index * 37) % 40) - 20);
      n.y = n.ty !== undefined ? n.ty : cy + (((n.index * 53) % 40) - 20);
      n.vx = 0;
      n.vy = 0;
      n.fixed = false;
    });
    return nodes;
  }

  /** Один шаг силы: сеточное отталкивание + пружины + гравитация + столкновения. */
  function step(graph, opts) {
    var cfg = tuneLayout(graph, opts && opts.layout ? opts.layout : {});
    var a0 = (opts && opts.alpha !== undefined ? opts.alpha : 1);
    if (cfg.mode === "fdp") return frStep(graph, cfg, opts, a0);
    if (cfg.mode === "neato") return smStep(graph, cfg, opts, a0);
    if (cfg.mode === "twopi") {
      // twopi детерминирован: «физика» только держит вершину у её слоя и разводит
      // то, что пользователь сдвинул руками
      var tn = graph.nodes;
      tn.forEach(function (p) {
        if (p.fixed || p.tx === undefined) return;
        p.x += (p.tx - p.x) * 0.35;
        p.y += (p.ty - p.y) * 0.35;
      });
      // Радиальные кольца особенно чувствительны к позднему сдвигу label-polish:
      // держим подписи разведёнными прямо в ходе twopi, как было изначально.
      collide(tn, cfg, graph._byId, 0.4, 0.9, cfg.packLabels !== false, true);
      return 0;
    }
    var nodes = graph.nodes;
    var edges = graph.edges;
    var alpha = (opts && opts.alpha !== undefined ? opts.alpha : 1);
    var n = nodes.length;
    if (!n) return 0;
    var cx = (opts && opts.width ? opts.width : 1200) / 2;
    var cy = (opts && opts.height ? opts.height : 800) / 2;
    var byId = graph._byId;
    if (!byId) {
      byId = graph._byId = {};
      nodes.forEach(function (x) {
        byId[x.id] = x;
      });
    }
    // Оптимизация v2: for-циклы вместо forEach, hoisted переменные.
    var cell = Math.max(28, cfg.linkDistance * 2.1);
    var grid = {};
    var i;
    for (i = 0; i < n; i++) {
      var pp = nodes[i];
      pp._fx = 0; pp._fy = 0;
      var gkey = Math.floor(pp.x / cell) + ":" + Math.floor(pp.y / cell);
      if (!grid[gkey]) grid[gkey] = [pp];
      else grid[gkey].push(pp);
    }
    var cl = cfg.mode === "clusters";
    var repel = cfg.repel * alpha * (cl ? 0.4 : 1);
    for (i = 0; i < n; i++) {
      var p = nodes[i];
      var gx = Math.floor(p.x / cell);
      var gy = Math.floor(p.y / cell);
      for (var ix = gx - 2; ix <= gx + 2; ix++) {
        for (var iy = gy - 2; iy <= gy + 2; iy++) {
          var bucket = grid[ix + ":" + iy];
          if (!bucket) continue;
          for (var bi = 0; bi < bucket.length; bi++) {
            var q = bucket[bi];
            if (q === p || q.index < p.index) continue;
            var dx = p.x - q.x;
            var dy = p.y - q.y;
            var d2 = dx * dx + dy * dy;
            if (d2 < 0.01) {
              dx = (p.index % 7) - 3;
              dy = (p.index % 5) - 2;
              d2 = 1;
            }
            var f = repel / (d2 + 12);
            p._fx += dx * f;
            p._fy += dy * f;
            q._fx -= dx * f;
            q._fy -= dy * f;
          }
        }
      }
    }
    var k = 1;
    var eLen = edges.length;
    for (var ei = 0; ei < eLen; ei++) {
      var e = edges[ei];
      // тематическая ссылка на главу в пружину не входит (см. addEdge/chapterRef)
      if (e.chapterRef) continue;
      var a = byId[e.source];
      var b = byId[e.target];
      if (!a || !b) continue;
      var edx = b.x - a.x;
      var edy = b.y - a.y;
      var dist = Math.sqrt(edx * edx + edy * edy) || 0.01;
      var ewant = cfg.linkDistance + (a.r || 0) + (b.r || 0);
      var strength = (e.kind === "structure" ? (cl ? 0.14 : 0.9) : 0.45) * k;
      var ef = ((dist - ewant) / dist) * strength * alpha;
      a._fx += edx * ef;
      a._fy += edy * ef;
      b._fx -= edx * ef;
      b._fy -= edy * ef;
    }
    var maxDeg = graph.stats ? graph.stats.maxDegree : 1;
    var friction = cfg.friction;
    var gravBase = cfg.gravity * alpha;
    var anchorK = cl ? (cfg.anchorStrength || 0.34) : cfg.radialStrength;
    var doAnchors = (cfg.mode === "twopi" || cl);
    var lim = 60;
    for (i = 0; i < n; i++) {
      var pn = nodes[i];
      var g = gravBase * (1 + 1.6 * (pn.degree / maxDeg));
      pn._fx += (cx - pn.x) * g;
      pn._fy += (cy - pn.y) * g;
      if (doAnchors && pn.tx !== undefined) {
        pn._fx -= (pn.x - pn.tx) * anchorK * alpha;
        pn._fy -= (pn.y - pn.ty) * anchorK * alpha;
      }
      if (cl && cfg.packLabels !== false) {
        pn._cr = effR(pn, cfg);
      }
      if (pn.fixed) {
        pn.vx = 0; pn.vy = 0;
        continue;
      }
      pn.vx = (pn.vx + pn._fx) * friction;
      pn.vy = (pn.vy + pn._fy) * friction;
      var sp2 = pn.vx * pn.vx + pn.vy * pn.vy;
      if (sp2 > lim * lim) {
        var sp = Math.sqrt(sp2);
        pn.vx = (pn.vx / sp) * lim;
        pn.vy = (pn.vy / sp) * lim;
      }
      pn.x += pn.vx;
      pn.y += pn.vy;
    }
    if (cfg.collide) {
      collide(nodes, cfg, byId, alpha, 0.85, cl);
      if (alpha > 0.06) collide(nodes, cfg, byId, alpha, 0.4, cl);
    }
    if (cl) clampWalls(nodes, graph._center);
    var disp = 0;
    nodes.forEach(function (p) {
      disp += Math.abs(p.vx) + Math.abs(p.vy);
    });
    return disp / n;
  }

  function radialTarget(p, cx, cy, R) {
    var rank = { chapter: 0, section: 1, heading: 2, block: 3 }[p.type];
    if (rank === undefined) rank = 3;
    var ring = R * (0.2 + 0.26 * rank);
    var ang = ((p.index || 0) * 2.399963229728653) % (Math.PI * 2);
    return { x: cx + ring * Math.cos(ang), y: cy + ring * Math.sin(ang) };
  }

  /**
   * Раздвигает пересекающиеся круги; если `useRect` — то и прямоугольники подписей
   * (требование: метки не наезжают ни друг на друга, ни на чужие круги).
   */
  function collide(nodes, cfg, byId, alpha, k, useRect, plainPush, reserveGrid) {
    var kk = k === undefined ? 0.5 : k;
    // В горячем цикле движков расталкиваем только круги. Подписи гарантированно
    // раскладываются финальным polishNoOverlap(), поэтому не стоит на каждом шаге
    // создавать прямоугольники для тысяч заведомо далёких пар. Для кластерной
    // упаковки `useRect` остаётся true — там подписи задают размер сектора.
    var withRects = !!useRect;
    var far = cfg.maxRadius || DEFAULTS.maxRadius || 34;
    var radii = new Array(nodes.length);
    // labelRectOf() создаёт два объекта на каждую соседнюю пару. В label-aware
    // проходе сначала держим неизменные размеры прямоугольников и вызываем её
    // только для пары, чьи реальные границы уже пересекаются.
    var labels = withRects ? new Array(nodes.length) : null;
    var i;
    for (i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      // Даже в быстром круговом проходе оставляем вокруг подписанного узла
      // его резервное место: так финальному label-polish остаётся заметно меньше работы.
      radii[i] = effR(node, cfg);
      // Для ширины клетки достаточно реального круга. Резерв подписи остаётся в
      // силе ниже, но не заставляет обходить огромные разреженные ячейки.
      var cellRadius = (withRects || reserveGrid) ? radii[i] : (node.r || 6) + 2;
      if (cellRadius > far) far = cellRadius;
      if (labels) {
        labels[i] = node.labelShown && node.lw ? {
          hw: node.lw / 2,
          y0: (node.r || 0) + 1,
          y1: (node.r || 0) + 1 + node.lh,
        } : null;
      }
      node._lgCollisionIndex = i;
    }
    // Размер клетки не меньше диаметра самого крупного объекта: достаточно девяти
    // соседних клеток, а не всего графа. Для кругов это существенно меньше ширины
    // самой длинной подписи и снимает главный источник фризов на 1000+ вершинах.
    var cell = Math.max(60, far * 2 + 8);
    var grid = {};
    for (i = 0; i < nodes.length; i++) {
      var p0 = nodes[i];
      if (!isFinite(p0.x) || !isFinite(p0.y)) continue;
      var key0 = Math.floor(p0.x / cell) + ":" + Math.floor(p0.y / cell);
      if (!grid[key0]) grid[key0] = [p0];
      else grid[key0].push(p0);
    }
    var hits = 0;
    for (i = 0; i < nodes.length; i++) {
      var p = nodes[i];
      if (!isFinite(p.x) || !isFinite(p.y)) continue;
      var gx = Math.floor(p.x / cell);
      var gy = Math.floor(p.y / cell);
      var pr = radii[i];
      for (var ix = gx - 1; ix <= gx + 1; ix++) {
        for (var iy = gy - 1; iy <= gy + 1; iy++) {
          var bucket = grid[ix + ":" + iy];
          if (!bucket) continue;
          for (var bi = 0; bi < bucket.length; bi++) {
            var q = bucket[bi];
            var qi = q._lgCollisionIndex;
            // Сохраняем детерминированный порядок прежнего алгоритма: результат
            // раскладки не начинает прыгать из-за порядка файлов в vault.
            if (q === p || q.id < p.id) continue;
            var dx = q.x - p.x;
            var dy = q.y - p.y;
            var min = (pr + radii[qi]) * 1.04 + 3;
            if (withRects) {
              // Сохраняем порядок старого label-aware пути: его устойчивое
              // взаимодействие с радиальными целями twopi нельзя менять. Но
              // skip безопасен: separateLabels для непересекающихся rect ничего
              // не делает, а геометрия их размеров неизменна в этом проходе.
              var lp = labels[i], lq = labels[qi];
              var touches = false;
              if (lp && lq) {
                touches = p.x - lp.hw < q.x + lq.hw && q.x - lq.hw < p.x + lp.hw &&
                  p.y + lp.y0 < q.y + lq.y1 && q.y + lq.y0 < p.y + lp.y1;
              } else if (lp) {
                var qr = (q.r || 6) + 1;
                touches = p.x - lp.hw < q.x + qr && q.x - qr < p.x + lp.hw &&
                  p.y + lp.y0 < q.y + qr && q.y - qr < p.y + lp.y1;
              } else if (lq) {
                var prCircle = (p.r || 6) + 1;
                touches = q.x - lq.hw < p.x + prCircle && p.x - prCircle < q.x + lq.hw &&
                  q.y + lq.y0 < p.y + prCircle && p.y - prCircle < q.y + lq.y1;
              }
              var dRect = Math.sqrt(dx * dx + dy * dy) || 0.01;
              if (touches) separateLabels(p, q, kk, plainPush);
              if (dRect >= min) continue;
              var pushRect = ((min - dRect) / dRect) * kk * (0.75 + 0.25 * alpha);
              var mxRect = dx * pushRect;
              var myRect = dy * pushRect;
              if (!p.fixed) { p.x -= mxRect; p.y -= myRect; }
              if (!q.fixed) { q.x += mxRect; q.y += myRect; }
              hits++;
              continue;
            }
            var d2 = dx * dx + dy * dy;
            // sqrt — только у действительно пересекающихся кругов; на разреженном
            // графе подавляющее большинство соседей отсеивается этой проверкой.
            if (d2 >= min * min) continue;
            var d = Math.sqrt(d2) || 0.01;
            var push = ((min - d) / d) * kk * (0.75 + 0.25 * alpha);
            var mx = dx * push;
            var my = dy * push;
            if (!p.fixed) {
              p.x -= mx;
              p.y -= my;
            }
            if (!q.fixed) {
              q.x += mx;
              q.y += my;
            }
            hits++;
          }
        }
      }
    }
    return hits;
  }

  /* ======================================================================== *
   *  Движки раскладки: fdp / neato / twopi
   *
   *  Это не обёртка над Graphviz, а те же алгоритмы, на которых он стоит:
   *    fdp   - Fruchterman-Reingold: притяжение d^2/k, отталкивание k^2/d, шаг с
   *            «температурой» (остывание) и ограничением перемещения за итерацию;
   *    neato - stress majorization (SMACOF): целевые длины рёбер, веса 1/d,
   *            координаты минимизируют стресс;
   *    twopi - радиальные слои: глубина = расстояние от корня в BFS, угол - по
   *            размеру поддерева, радиус слоя - по длине его дуги.
   *  Общее: масштаб k считается из целевой длины связи (раскладка не зависит от
   *  единиц движка), главы слегка стягиваются к своему центроиду (clusterPull), а
   *  в финале идёт пост-обработка, которая добивает наложения кругов и подписей
   *  минимально возможными сдвигами.
   * ======================================================================== */

  /* ======================================================================== *
   *  Barnes-Hut quadtree: O(n log n) отталкивание вместо O(n²) сетки.
   *  Квадрант хранит центр масс и суммарную «массу» (здесь = 1 на вершину);
   *  если отношение размера ячейки к расстоянию до центра масс < theta (0.9),
   *  всю ячейку считаем одной точкой. Это стандарт, на котором стоит Graphviz.
   * ======================================================================== */

  /**
   * Строим quadtree по текущим позициям вершин. Каждая вершина = точка с массой 1.
   * Возвращает корневой узел {cx, cy, mass, x0, y0, x1, y1, children, body}.
   */
  function bhBuild(nodes, theta) {
    var n = nodes.length;
    if (!n) return null;
    // bbox
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (var i = 0; i < n; i++) {
      var p = nodes[i];
      if (!isFinite(p.x) || !isFinite(p.y)) continue;
      if (p.x < x0) x0 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.x > x1) x1 = p.x;
      if (p.y > y1) y1 = p.y;
    }
    // квадратный bbox с запасом
    var sz = Math.max(x1 - x0, y1 - y0) + 1;
    var mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    x0 = mx - sz / 2 - 1; y0 = my - sz / 2 - 1;
    x1 = mx + sz / 2 + 1; y1 = my + sz / 2 + 1;

    // пул узлов: выделяем заранее 4*n (каждая вершина = максимум log(n) уровней)
    var poolSize = Math.max(64, n * 8);
    var pool = new Array(poolSize);
    var poolIdx = 0;
    for (var pi = 0; pi < poolSize; pi++) pool[pi] = { cx: 0, cy: 0, mass: 0, x0: 0, y0: 0, x1: 0, y1: 0, ch: null, body: null };

    function newNode(bx0, by0, bx1, by1) {
      var nd;
      if (poolIdx < poolSize) nd = pool[poolIdx++];
      else nd = { cx: 0, cy: 0, mass: 0, x0: 0, y0: 0, x1: 0, y1: 0, ch: null, body: null };
      nd.cx = 0; nd.cy = 0; nd.mass = 0;
      nd.x0 = bx0; nd.y0 = by0; nd.x1 = bx1; nd.y1 = by1;
      nd.ch = null; nd.body = null;
      return nd;
    }

    var root = newNode(x0, y0, x1, y1);

    function insert(nd, p, depth) {
      if (depth > 40) return; // защита от вырожденных случаев
      if (nd.mass === 0 && nd.body === null) {
        // пустой лист — кладём вершину
        nd.body = p;
        nd.cx = p.x; nd.cy = p.y; nd.mass = 1;
        return;
      }
      // обновляем центр масс
      var nm = nd.mass + 1;
      nd.cx = (nd.cx * nd.mass + p.x) / nm;
      nd.cy = (nd.cy * nd.mass + p.y) / nm;
      nd.mass = nm;
      if (nd.body !== null) {
        // лист с одной вершиной — разбиваем
        var old = nd.body;
        nd.body = null;
        if (nd.ch === null) nd.ch = [null, null, null, null];
        var mx2 = (nd.x0 + nd.x1) / 2, my2 = (nd.y0 + nd.y1) / 2;
        nd.ch[0] = newNode(nd.x0, nd.y0, mx2, my2);
        nd.ch[1] = newNode(mx2, nd.y0, nd.x1, my2);
        nd.ch[2] = newNode(nd.x0, my2, mx2, nd.y1);
        nd.ch[3] = newNode(mx2, my2, nd.x1, nd.y1);
        var oi = (old.y < my2 ? 0 : 2) + (old.x < mx2 ? 0 : 1);
        insert(nd.ch[oi], old, depth + 1);
      }
      if (nd.ch === null) nd.ch = [null, null, null, null];
      // дети уже созданы, только добавить текущую точку
      if (!nd.ch[0]) {
        var mx3 = (nd.x0 + nd.x1) / 2, my3 = (nd.y0 + nd.y1) / 2;
        nd.ch[0] = newNode(nd.x0, nd.y0, mx3, my3);
        nd.ch[1] = newNode(mx3, nd.y0, nd.x1, my3);
        nd.ch[2] = newNode(nd.x0, my3, mx3, nd.y1);
        nd.ch[3] = newNode(mx3, my3, nd.x1, nd.y1);
      }
      var qi = (p.y < (nd.y0 + nd.y1) / 2 ? 0 : 2) + (p.x < (nd.x0 + nd.x1) / 2 ? 0 : 1);
      insert(nd.ch[qi], p, depth + 1);
    }

    for (var j = 0; j < n; j++) {
      var pp = nodes[j];
      if (!isFinite(pp.x) || !isFinite(pp.y)) continue;
      insert(root, pp, 0);
    }
    root._theta = theta || 0.9;
    return root;
  }

  /**
   * Сила отталкивания от quadtree на точку p. Возвращает {fx, fy}.
   * repelStrength — множитель силы (аналог cfg.repel * alpha).
   */
  function bhForce(root, p, repelStrength, minDist2) {
    var fx = 0, fy = 0;
    if (!root || root.mass === 0) return { fx: 0, fy: 0 };
    var theta = root._theta || 0.9;
    // итеративный обход стеком — быстрее рекурсии на 1000+ вершинах
    var stack = [root];
    while (stack.length) {
      var nd = stack.pop();
      if (nd.mass === 0) continue;
      var dx = nd.cx - p.x, dy = nd.cy - p.y;
      var d2 = dx * dx + dy * dy;
      if (d2 < minDist2) d2 = minDist2;
      var sz = nd.x1 - nd.x0;
      // если узел — лист (одна вершина) или достаточно далеко — считаем одной точкой
      if (nd.body !== null) {
        if (nd.body === p) continue; // не отталкиваем сами себя
        var f = repelStrength / (d2 + 12);
        fx -= dx * f;
        fy -= dy * f;
        continue;
      }
      if (sz * sz < theta * theta * d2) {
        // аппроксимация: весь квадрант = одна точка массы nd.mass
        var f2 = repelStrength * nd.mass / (d2 + 12);
        fx -= dx * f2;
        fy -= dy * f2;
        continue;
      }
      // спускаемся глубже
      if (nd.ch) {
        for (var ci = 0; ci < 4; ci++) {
          if (nd.ch[ci] && nd.ch[ci].mass > 0) stack.push(nd.ch[ci]);
        }
      }
    }
    return { fx: fx, fy: fy };
  }

  /** Целевое расстояние между соседями (масштаб k для FR и «идеал» для neato). */
  function wantDistance(cfg) {
    var base = cfg.linkDistance || DEFAULTS.layout.linkDistance;
    var rad = cfg.maxRadius || DEFAULTS.maxRadius || 34;
    return base + 1.25 * rad * (cfg.packLabels === false ? 0.7 : 1);
  }

  /**
   * «Дом» вершины для раскладки: своя глава, а для блока с ключевыми фразами — та, что
   * собрала больше вхождений (тот же критерий, что и у цвета). Центроиды при этом считаются
   * по СТРУКТУРНОЙ принадлежности, иначе уехавшие блоки тянули бы пятна друг к другу.
   * В sectors-режиме (clusters) членство остаётся структурным: иначе рвутся сектора.
   */
  function homeChapterOf(n, byId) {
    return n.kwChapter || chapterOf(n, byId);
  }

  /** Центроиды глав: нужны и для стягивания, и для посева раскладки. */
  function chapterCentroids(nodes, byId) {
    var acc = {};
    nodes.forEach(function (n) {
      var cid = chapterOf(n, byId);
      if (!cid) return;
      var a = acc[cid] || (acc[cid] = { x: 0, y: 0, n: 0 });
      a.x += n.x; a.y += n.y; a.n++;
    });
    Object.keys(acc).forEach(function (key) {
      acc[key].x /= acc[key].n; acc[key].y /= acc[key].n;
    });
    return acc;
  }

  /** Лёгкое притяжение к центроиду своей главы - чтобы главу было видно пятном. */
  function applyCohesion(nodes, cfg, byId, strength) {
    var pull = cfg.clusterPull;
    if (!pull) return;
    var cen = chapterCentroids(nodes, byId);
    var k = pull * (strength === undefined ? 1 : strength);
    nodes.forEach(function (n) {
      var c = cen[homeChapterOf(n, byId)];
      if (!c) return;
      n._fx += (c.x - n.x) * k;
      n._fy += (c.y - n.y) * k;
    });
  }

  /** Один шаг Fruchterman-Reingold (в духе fdp): сетка + пружины + температура.
   *  Оптимизация v2: целочисленные ключи сетки, for-циклы, без forEach. */
  function frStep(graph, cfg, opts, alpha) {
    var nodes = graph.nodes, edges = graph.edges, byId = graph._byId;
    var nn = nodes.length;
    var k = wantDistance(cfg) * (cfg.frK || 1);
    var k2 = k * k;
    var frRepel = cfg.frRepel || 1;
    var frAttract = cfg.frAttract || 1;
    var frStruct = cfg.frStruct || 1.3;
    // init forces
    for (var fi = 0; fi < nn; fi++) { nodes[fi]._fx = 0; nodes[fi]._fy = 0; }
    // отталкивание k^2/d считаем только по соседним ячейкам
    var cell = k * 2.2;
    var grid = {};
    for (var gi = 0; gi < nn; gi++) {
      var gp = nodes[gi];
      var gkey = Math.floor(gp.x / cell) + ":" + Math.floor(gp.y / cell);
      if (!grid[gkey]) grid[gkey] = [gp];
      else grid[gkey].push(gp);
    }
    for (var ri = 0; ri < nn; ri++) {
      var rp = nodes[ri];
      var rgx = Math.floor(rp.x / cell);
      var rgy = Math.floor(rp.y / cell);
      for (var ix = rgx - 1; ix <= rgx + 1; ix++) {
        for (var iy = rgy - 1; iy <= rgy + 1; iy++) {
          var bucket = grid[ix + ":" + iy];
          if (!bucket) continue;
          for (var bi = 0; bi < bucket.length; bi++) {
            var q = bucket[bi];
            if (q === rp || q.index < rp.index) continue;
            var dx = rp.x - q.x, dy = rp.y - q.y;
            var d2 = dx * dx + dy * dy;
            if (d2 < 0.01) { dx = ((rp.index % 7) - 3) * 0.4; dy = ((rp.index % 5) - 2) * 0.4; d2 = 0.3; }
            var f = (k2 / d2) * frRepel;
            rp._fx += dx * f; rp._fy += dy * f;
            q._fx -= dx * f; q._fy -= dy * f;
          }
        }
      }
    }
    var eLen = edges.length;
    for (var ei = 0; ei < eLen; ei++) {
      var e = edges[ei];
      // Ручная/legacy-ссылка на главу в пружину не входит: рисуется, но не стягивает
      // главы-хабы в центр (см. addEdge/chapterRef).
      if (e.chapterRef) continue;
      var a = byId[e.source], b = byId[e.target];
      if (!a || !b) continue;
      var edx = b.x - a.x, edy = b.y - a.y;
      var d = Math.sqrt(edx * edx + edy * edy) || 0.01;
      var w = (e.kind === "structure" ? frStruct : 1) * frAttract;
      var ef = (d / k) * w * 0.5 / d;
      a._fx += edx * ef; a._fy += edy * ef;
      b._fx -= edx * ef; b._fy -= edy * ef;
    }
    applyCohesion(nodes, cfg, byId, alpha);
    var cx = (opts && opts.width ? opts.width : 1400) / 2;
    var cy = (opts && opts.height ? opts.height : 900) / 2;
    var temp = k * (cfg.frTemp === undefined ? 0.55 : cfg.frTemp) * alpha;
    var gravHalf = cfg.gravity ? cfg.gravity * alpha * 0.5 : 0;
    var disp = 0;
    for (var ni = 0; ni < nn; ni++) {
      var p = nodes[ni];
      if (p.fixed) { p.vx = 0; p.vy = 0; continue; }
      var pdx = p._fx, pdy = p._fy;
      var pd = Math.sqrt(pdx * pdx + pdy * pdy) || 0.01;
      var s = Math.min(pd, temp) / pd;
      var mvx = pdx * s, mvy = pdy * s;
      if (gravHalf) { mvx += (cx - p.x) * gravHalf; mvy += (cy - p.y) * gravHalf; }
      p.x += mvx; p.y += mvy;
      p.vx = mvx; p.vy = mvy;
      disp += Math.abs(mvx) + Math.abs(mvy);
    }
    if (cfg.collide !== false) collide(nodes, cfg, byId, alpha, 0.7, !!(opts && opts.labelCollision) && cfg.packLabels !== false, true);
    return disp / Math.max(1, nn);
  }

  /** Один шаг stress majorization (в духе neato): SMACOF + удержание формы.
   *  Оптимизации v2: Barnes-Hut для отпора, плоские массивы смежности,
   *  кешированные центроиды глав (раз в 3 шага), без аллокаций в горячем цикле. */
  function smStep(graph, cfg, opts, alpha) {
    var nodes = graph.nodes, byId = graph._byId;
    var nn = nodes.length;
    if (!nn) return 0;

    // Плоские массивы смежности: для каждой вершины — непрерывный диапазон индексов
    // соседей. Избегаем object[id] и Array-of-Arrays — один проход по TypedArray.
    if (!graph._smFlat || graph._smFlatN !== nn) {
      // гарантируем наличие index (initPositions ставит его, но на всякий случай)
      for (var ii = 0; ii < nn; ii++) { if (nodes[ii].index === undefined) nodes[ii].index = ii; }
      var adjOffsets = new Int32Array(nn + 1);
      var degreeArr = new Int32Array(nn);
      var edges = graph.edges;
      // В neato (SMACOF) тематические ссылки на главу ОСТАВЛЯЕМ: расстояние здесь
      // графово-теоретическое, крупные хабы оно не сминает (главы всё равно расходятся),
      // зато блок притягивается к главе-лидеру по своим ключевым фразам — это и есть
      // видимый «дрейф» темы к главе, где она встречается чаще. В пружинных режимах
      // (frStep/step) эти же рёбра из физики исключены — там они схлопывали бы хабы.
      for (var ei = 0; ei < edges.length; ei++) {
        var es = byId[edges[ei].source], et = byId[edges[ei].target];
        if (es && es.index !== undefined) degreeArr[es.index]++;
        if (et && et.index !== undefined) degreeArr[et.index]++;
      }
      for (var oi = 0; oi < nn; oi++) adjOffsets[oi + 1] = adjOffsets[oi] + degreeArr[oi];
      var totalAdj = adjOffsets[nn];
      var flatNeighbors = new Int32Array(totalAdj);
      var cursor = new Int32Array(nn);
      for (var ci = 0; ci < nn; ci++) cursor[ci] = adjOffsets[ci];
      for (var ej = 0; ej < edges.length; ej++) {
        var sa = byId[edges[ej].source], ta = byId[edges[ej].target];
        if (sa && ta && sa.index !== undefined && ta.index !== undefined) {
          flatNeighbors[cursor[sa.index]++] = ta.index;
          flatNeighbors[cursor[ta.index]++] = sa.index;
        }
      }
      graph._smFlat = flatNeighbors;
      graph._smOffsets = adjOffsets;
      graph._smFlatN = nn;
    }
    var flat = graph._smFlat, offsets = graph._smOffsets;

    var want = wantDistance(cfg) * (cfg.neatoScale || 1.45);
    var blend = 0.35 + 0.45 * alpha;
    var disp = 0;
    var wantLim = want * 0.8 * (0.3 + alpha);

    var cx = (opts && opts.width ? opts.width : 1400) / 2;
    var cy = (opts && opts.height ? opts.height : 900) / 2;
    var grav = (cfg.gravity || 0.014) * alpha;
    var pullK = cfg.clusterPull || 0;

    // SMACOF основной цикл — один проход по вершинам без аллокаций
    for (var i = 0; i < nn; i++) {
      var p = nodes[i];
      var off0 = offsets[i], off1 = offsets[i + 1];
      var sx = 0, sy = 0, sw = 0;
      var px = p.x, py = p.y;
      var pr = (p.r || 6);
      for (var j = off0; j < off1; j++) {
        var qi = flat[j];
        var q = nodes[qi];
        var ideal = want + pr + (q.r || 6);
        var dx = q.x - px, dy = q.y - py;
        var d2 = dx * dx + dy * dy;
        var d = d2 > 0.0001 ? Math.sqrt(d2) : 0.01;
        var w = d > 0.5 ? 1 / d : 2;
        var invD = 1 / d;
        sx += w * (q.x + dx * invD * ideal);
        sy += w * (q.y + dy * invD * ideal);
        sw += w;
      }
      var mvx, mvy;
      if (sw > 0) {
        mvx = (sx / sw - px) * blend;
        mvy = (sy / sw - py) * blend;
      } else {
        mvx = 0; mvy = 0;
      }
      // cap位移
      var m2 = mvx * mvx + mvy * mvy;
      if (m2 > wantLim * wantLim) {
        var m = Math.sqrt(m2);
        var scale = wantLim / m;
        mvx *= scale; mvy *= scale;
      }
      if (!p.fixed) { p.x = px + mvx; p.y = py + mvy; }
      p.vx = mvx; p.vy = mvy;
      disp += Math.abs(mvx) + Math.abs(mvy);
    }

    // Стягивание + гравитация (отдельный проход — как в оригинале).
    // Сбрасываем _fx/_fy перед applyCohesion (SMACOF их не трогает).
    for (var i1 = 0; i1 < nn; i1++) { nodes[i1]._fx = 0; nodes[i1]._fy = 0; }
    if (pullK) applyCohesion(nodes, cfg, byId, 1);
    for (var i2 = 0; i2 < nn; i2++) {
      var p2 = nodes[i2];
      if (p2.fixed) continue;
      p2.x += (p2._fx || 0) * 0.6 + (cx - p2.x) * grav;
      p2.y += (p2._fy || 0) * 0.6 + (cy - p2.y) * grav;
    }

    if (cfg.collide !== false) collide(nodes, cfg, byId, alpha, 0.55, !!(opts && opts.labelCollision) && cfg.packLabels !== false, true);
    return disp / nn;
  }

  /**
   * twopi: радиальные слои от корня. Глубина - BFS по всем рёбрам (как в Graphviz),
   * но родителем на той же глубине выбирается структурное ребро: дерево
   * «глава - секция - заголовок - блок» читается, а перекрёстные ссылки только
   * уточняют слой. Недоступные из корня уезжают на слой 1 тем же веером.
   */
  function twopiLayout(graph, cfg, opts) {
    opts = opts || {};
    var nodes = graph.nodes, byId = graph._byId;
    if (!nodes.length) return 0;
    var inc = {};
    nodes.forEach(function (n) { inc[n.id] = []; });
    graph.edges.forEach(function (e) {
      if (inc[e.source] && byId[e.target]) inc[e.source].push({ to: e.target, struct: e.kind === "structure" });
      if (inc[e.target] && byId[e.source]) inc[e.target].push({ to: e.source, struct: e.kind === "structure" });
    });
    var rootId = null;
    var want = String(cfg.twopiRoot || "").trim().replace(/^[[\]]+/g, "").replace(/\.md$/, "");
    if (want && byId[want]) rootId = want;
    if (!rootId) {
      nodes.forEach(function (n) {
        if (n.type === "chapter" && (!rootId || (n.degree || 0) > (byId[rootId].degree || 0))) rootId = n.id;
      });
    }
    if (!rootId) rootId = nodes[0].id;
    // Слои = расстояние по СТРУКТУРНОМУ лесу (глава -> секция -> заголовок -> блок),
    // и только то, до чего лес не дотянулся, достраиваем по ref-рёбрам. Если мешать их
    // в один BFS (наивно, «как twopi»), ref-хобы сбрасывают почти весь граф во второй
    // слой, и радиальной иерархии не остаётся вовсе.
    var struct = {};
    nodes.forEach(function (n) { struct[n.id] = []; });
    graph.edges.forEach(function (e) {
      if (e.kind !== "structure") return;
      if (struct[e.source] && byId[e.target]) struct[e.source].push(e.target);
      if (struct[e.target] && byId[e.source]) struct[e.target].push(e.source);
    });
    var depth = {}, parent = {}, queue = [rootId];
    depth[rootId] = 0; parent[rootId] = null;
    // остальные главы считаем детьми корня ДО обхода леса: иначе их поддеревья из
    // корня недостижимы, и угловые сектора (вместе с цветами глав) разъезжаются
    // по ref-рёбрам в кашу
    nodes.forEach(function (n) {
      if (n.type !== "chapter" || n.id === rootId) return;
      depth[n.id] = 1;
      parent[n.id] = rootId;
      queue.push(n.id);
    });
    for (var qi = 0; qi < queue.length; qi++) {
      var id = queue[qi];
      var list = struct[id] || [];
      for (var i = 0; i < list.length; i++) {
        var nb = list[i];
        if (depth[nb] !== undefined) continue;
        depth[nb] = depth[id] + 1;
        parent[nb] = id;
        queue.push(nb);
      }
    }
    var lastLayer = 0;
    nodes.forEach(function (n) { if (depth[n.id] > lastLayer) lastLayer = depth[n.id]; });
    var frontier = queue.slice();
    while (frontier.length) {
      var nxt = [];
      for (var fi = 0; fi < frontier.length; fi++) {
        var fid = frontier[fi];
        var fl = inc[fid] || [];
        for (var fj = 0; fj < fl.length; fj++) {
          var tid = fl[fj].to;
          if (depth[tid] !== undefined) continue;
          depth[tid] = depth[fid] + 1;
          parent[tid] = fid;
          nxt.push(tid);
        }
      }
      frontier = nxt;
    }
    nodes.forEach(function (n) {
      if (depth[n.id] === undefined) { depth[n.id] = lastLayer + 1; parent[n.id] = rootId; }
    });
    var kids = {};
    nodes.forEach(function (n) {
      var p = parent[n.id];
      if (p === null || p === undefined || p === n.id) return;
      (kids[p] || (kids[p] = [])).push(n.id);
    });
    // вес поддерева (низ вверх по BFS-порядку) - по нему делим угол
    var weight = {};
    nodes.forEach(function (n) { weight[n.id] = 1; });
    for (var bi = queue.length - 1; bi >= 0; bi--) {
      var bid = queue[bi], pid = parent[bid];
      if (pid !== null && pid !== undefined && weight[pid] !== undefined) weight[pid] += weight[bid];
    }
    var maxDepth = 1;
    nodes.forEach(function (n) { if (depth[n.id] > maxDepth) maxDepth = depth[n.id]; });
    // сколько дуги нужно на каждом слое - по «пятаку» вершин (круг + подпись)
    var need = [];
    for (var lvl = 0; lvl <= maxDepth; lvl++) need[lvl] = 0;
    nodes.forEach(function (n) {
      var d = Math.max(0, Math.min(maxDepth, depth[n.id] || 0));
      need[d] += effR(n, cfg) * 2 + (cfg.clusterPad || 10) + (n.labelShown ? 10 : 0);
    });
    var fill = cfg.clusterFill || 0.94;
    var R = [0];
    for (var l2 = 1; l2 <= maxDepth; l2++) {
      var ring = need[l2] / (2 * Math.PI * fill);
      R[l2] = Math.max(ring, R[l2 - 1] + wantDistance(cfg) * 0.6);
    }
    var cx = opts.cx || 0, cy = opts.cy || 0;
    var sep = cfg.twopiRankSep === undefined ? 1 : cfg.twopiRankSep;
    var placed = 0;
    (function walk(id, a0, a1, lvl) {
      var n = byId[id];
      if (!n) return;
      var ang = a0 + (a1 - a0) / 2;
      var rad = lvl === 0 ? 0 : R[Math.min(maxDepth, lvl)] * sep;
      n.x = cx + rad * Math.cos(ang);
      n.y = cy + rad * Math.sin(ang);
      n.tx = n.x; n.ty = n.y;
      n.twopiDepth = lvl;
      placed++;
      var list = (kids[id] || []).slice();
      if (!list.length) return;
      var wsum = 0;
      list.forEach(function (c) { wsum += weight[c] || 1; });
      // корню отдаём полный круг, остальным - клин родителя; крупные поддеревья вперёд
      var from = lvl === 0 ? -Math.PI : a0, to = lvl === 0 ? Math.PI : a1;
      var total = to - from, cur = from;
      list.sort(function (x, y) { return (weight[y] || 1) - (weight[x] || 1); });
      list.forEach(function (c) {
        var share = total * ((weight[c] || 1) / Math.max(1, wsum));
        walk(c, cur, cur + share, lvl + 1);
        cur += share;
      });
    })(rootId, -Math.PI, Math.PI, 0);
    graph._twopiRoot = rootId;
    graph._twopiDepth = maxDepth;
    return placed;
  }

  /** Посев для fdp/neato: главы по большому кругу, остальные - диском вокруг своей. */
  function seedBlobs(graph, cfg, opts) {
    var nodes = graph.nodes, byId = graph._byId;
    var chapters = nodes.filter(function (n) { return n.type === "chapter"; });
    if (!chapters.length) chapters = [nodes[0]];
    var want = wantDistance(cfg);
    var R0 = want * Math.max(6, chapters.length * 2.2);
    var groups = {};
    chapters.forEach(function (c) { groups[c.id] = []; });
    nodes.forEach(function (n) {
      // посев — по «дому» (своя глава, а для блока с ключевыми фразами — глава-лидер):
      // тогда блок, чья тема живёт в другой главе, стартует между пятнами и пружина его
      // там же и оставляет — «мост» видно, а не только цвет
      var cid = homeChapterOf(n, byId);
      if (groups[cid]) groups[cid].push(n);
      else groups[chapters[0].id].push(n);
    });
    chapters.forEach(function (c, i) {
      var ang = (2 * Math.PI * i) / chapters.length;
      var bx = Math.cos(ang) * R0, by = Math.sin(ang) * R0;
      var list = groups[c.id];
      if (list.indexOf(c) < 0) list.unshift(c);
      list.forEach(function (n, j) {
        if (n === c) { n.x = bx; n.y = by; }
        else {
          // детерминированный «золотой» диск: без rand() раскладка воспроизводима
          var t = (j * 2.399963229728653) % (Math.PI * 2);
          var rr = want * (1.15 + 0.4 * Math.sqrt(j));
          n.x = bx + rr * Math.cos(t);
          n.y = by + rr * Math.sin(t);
        }
        n.vx = 0; n.vy = 0;
        n.tx = n.x; n.ty = n.y;
      });
    });
    return nodes;
  }

  /**
   * Пост-обработка результата движка: добиваем (1) наложения кругов и (2) наложения
   * подписей, сдвигая вершины как можно меньше. Сдвиг ограничен dispCap долей от
   * целевого шага; если в рамки не влезает - лимит наращивается, потому что «чисто
   * на экране» важнее, чем «пиксель в пиксель как положил алгоритм».
   */
  function polishNoOverlap(graph, cfg, opts) {
    opts = opts || {};
    var nodes = graph.nodes, byId = graph._byId;
    var useRect = opts.labels !== false && cfg.packLabels !== false;
    var report = { passes: 0, overlaps: 0, maxShift: 0, medianShift: 0, cap: 0, grown: 1, spread: 1, grows: 0 };
    if (!nodes.length || (opts.labels === false && opts.circles === false)) return report;
    // сначала глобально разводим «пятна» вершин: подписи шириной в сотни пикселей
    // физически не влезут в то, что нажал алгоритм, а локальными толчками такая плотность
    // расходится плохо. Масштаб один на весь граф - относительная структура не портится.
    report.spread = Math.round(spreadToFit(nodes, cfg) * 100) / 100;
    var start = nodes.map(function (n) { return { x: n.x, y: n.y }; });
    var capFactor = opts.cap !== undefined && opts.cap !== null ? opts.cap : (cfg.dispCap === undefined ? 0.5 : cfg.dispCap);
    var diag = Math.max(1, Math.hypot(bounds(nodes).maxX - bounds(nodes).minX, bounds(nodes).maxY - bounds(nodes).minY));
    var maxPasses = opts.passes || cfg.polishPasses || 30;
    var grows = cfg.polishGrow === undefined ? 6 : cfg.polishGrow;
    var done = false;
    // «полосы» меток расходятся тем легче, чем больше свободного места, поэтому при
    // неудаче добавляем места (один масштаб на весь граф) и наращиваем допустимый
    // сдвиг. Последняя ступень - без лимита: «чисто на экране» важнее, чем
    // «пиксель в пиксель как положил алгоритм».
    for (var grow = 0; grow <= grows && !done; grow++) {
      if (grow > 0) {
        scaleNodes(nodes, 1.18);
        for (var si = 0; si < start.length; si++) {
          var c = nodes[si];
          // старт тоже масштабируем: лимит меряет ЛОКАЛЬНЫЙ дрейф, а не глобальный развод
          start[si].x += (c.x - start[si].x) * 0.18;
          start[si].y += (c.y - start[si].y) * 0.18;
        }
        report.grows = grow;
        report.grown = Math.round(Math.pow(1.18, grow) * 100) / 100;
      }
      var cap = grow >= 2 ? Infinity : diag * 0.14 * (1 + capFactor * Math.pow(2.2, grow));
      report.cap = cap; // что бывало лимитом на последней ступени (Infinity = «разводим как надо»)
      var wantCircles = opts.circles !== false;
      for (var i = 0; i < maxPasses; i++) {
        if (useRect) separateRows(nodes, cfg);
        // Финальный проход обязан увидеть все пары с label-reserve; горячие
        // итерации могут использовать мелкую circle-grid, но здесь важна точность.
        if (wantCircles) collide(nodes, cfg, byId, 0.3, 0.9, false, true, true);
        if (useRect) separateRows(nodes, cfg);
        if (isFinite(cap)) clampShift(nodes, start, cap);
        report.passes++;
        if (countPairsOverlap(nodes, cfg, useRect, wantCircles) === 0) { done = true; break; }
      }
    }
    var mx = 0, sum = 0;
    nodes.forEach(function (n, j) {
      var d = Math.hypot(n.x - start[j].x, n.y - start[j].y);
      if (d > mx) mx = d;
      sum += d;
    });
    report.maxShift = Math.round(mx * 10) / 10;
    report.medianShift = Math.round((sum / nodes.length) * 10) / 10;
    report.overlaps = countPairsOverlap(nodes, cfg, useRect, opts.circles !== false);
    return report;
  }

  /**
   * Насколько нужно раздвинуть весь результат, чтобы «пятаки» вершин (круг + подпись)
   * влезли без наложений: считаем их суммарную площадь и сравниваем с площадью bbox.
   */
  function spreadToFit(nodes, cfg) {
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, area = 0;
    var items = [];
    nodes.forEach(function (n) {
      var r = effR(n, cfg) * 2;
      var h = Math.max(r, (n.lh || r * 0.6) + (n.r || 6));
      area += r * h * 1.35;
      x0 = Math.min(x0, n.x - r / 2); x1 = Math.max(x1, n.x + r / 2);
      y0 = Math.min(y0, n.y - h / 2); y1 = Math.max(y1, n.y + h / 2);
      var R = labelRectOf(n);
      if (R) items.push({ y0: R.y0, y1: R.y1, w: (R.x1 - R.x0) + (cfg.rowGap === undefined ? 8 : cfg.rowGap) });
    });
    // главная мера - не площадь, а самая «широкая» горизонтальная полоса: метки в одной
    // полосе выстраиваются в ряд, и ряд должен влезать в ширину графа
    var bandNeed = 0, bandH = 0;
    if (items.length > 1) {
      items.sort(function (a, b) { return a.y0 - b.y0; });
      var list = [], end = -Infinity, need = 0;
      for (var i = 0; i < items.length; i++) {
        if (list.length && items[i].y0 > end) {
          if (need > bandNeed) bandNeed = need;
          bandH += Math.max(4, end - list[0].y0) + 4;
          list = []; end = -Infinity; need = 0;
        }
        list.push(items[i]); need += items[i].w;
        if (items[i].y1 > end) end = items[i].y1;
      }
      if (list.length) {
        if (need > bandNeed) bandNeed = need;
        bandH += Math.max(4, end - list[0].y0) + 4;
      }
    }
    var box = Math.max(1, (x1 - x0) * (y1 - y0));
    var fx = bandNeed ? bandNeed / Math.max(1, x1 - x0) : 0;
    var fy = bandH ? bandH / Math.max(1, y1 - y0) : 0;
    var f = Math.max(fx, fy, Math.sqrt((area * 1.25) / box));
    // итеративно: если после развода наложения всё равно остаются, множитель растёт сам
    // (сюда заходим только из polishNoOverlap, который и меряет результат)
    if (f <= 1.02) return 1;
    // потолок развода: меткам нужно место, но множитель обязан быть конечен - иначе на
    // редком графе с крупными подписями холст раздувается в десятки раз и Fit показывает
    // точки с микроскопическим текстом. Остальное доделают полосы и ступени «на вырост».
    // При neato глобальный ×12 разлёт даёт изолированные острова: Fit вынужден
    // уменьшать весь рисунок, а поиск соседей и управление становятся хуже. Grow-
    // проходы ниже всё равно добавят место под метки, поэтому держим плотный, но
    // чистый результат в пределах разумного локального масштаба.
    var maxSpread = cfg.spreadMax === undefined ? 12 : cfg.spreadMax;
    if (cfg.mode === "neato") maxSpread = Math.min(maxSpread, 5.1);
    f = Math.min(f, maxSpread);
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    nodes.forEach(function (n) {
      n.x = cx + (n.x - cx) * f;
      n.y = cy + (n.y - cy) * f;
      if (n.tx !== undefined) { n.tx = cx + (n.tx - cx) * f; n.ty = cy + (n.ty - cy) * f; }
    });
    return f;
  }

  /**
   * Раскладка подписей «полосами»: метки, чьи интервалы по y пересекаются, образуют
   * полосу; внутри полосы они выстраиваются по x без наложений (двигается только правый
   * сосед - это одномерная укладка, она сходится за один проход, в отличие от
   * симметричных толчков, которые в плотном ядре входят в цикл).
   */
  function separateRows(nodes, cfg) {
    var items = [];
    for (var i = 0; i < nodes.length; i++) {
      var R = labelRectOf(nodes[i]);
      if (R) items.push({ n: nodes[i], y0: R.y0, y1: R.y1, x: (R.x0 + R.x1) / 2, hw: (R.x1 - R.x0) / 2 });
    }
    if (items.length < 2) return 0;
    items.sort(function (a, b) { return a.y0 - b.y0 || a.x - b.x; });
    var gap = cfg.rowGap === undefined ? 8 : cfg.rowGap;
    var moved = 0;
    var band = [], bandEnd = -Infinity;
    function flush(list) {
      if (list.length < 2) { if (list.length) list[0].n.__x0 = list[0].n.x; return; }
      list.sort(function (a, b) { return a.x - b.x; });
      for (var j = 1; j < list.length; j++) {
        var prev = list[j - 1], cur = list[j];
        var need = prev.hw + cur.hw + gap;
        if (cur.x - prev.x < need) { cur.x = prev.x + need; moved++; }
      }
      // расставили влево-вправо относительно середины полосы, чтобы она не уезжала
      var lo = list[0].x - list[0].hw, hi = list[list.length - 1].x + list[list.length - 1].hw;
      var shift = ((list[0].x - list[0].hw + list[list.length - 1].x + list[list.length - 1].hw) / 2) * 0;
      void lo; void hi; void shift;
      for (var q = 0; q < list.length; q++) list[q].n.x = list[q].x;
    }
    for (var k = 0; k < items.length; k++) {
      var it = items[k];
      if (band.length && it.y0 > bandEnd) { flush(band); band = []; bandEnd = -Infinity; }
      band.push(it);
      if (it.y1 > bandEnd) bandEnd = it.y1;
    }
    if (band.length) flush(band);
    return moved;
  }

  function clampShift(nodes, start, cap) {
    if (!isFinite(cap) || cap <= 0) return;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.fixed) continue;
      var dx = n.x - start[i].x, dy = n.y - start[i].y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > cap && d > 0.001) {
        var s = cap / d;
        n.x = start[i].x + dx * s;
        n.y = start[i].y + dy * s;
      }
    }
  }

  /** Сколько пар «круг-круг / подпись-подпись / подпись-чужой круг» ещё перекрываются. */
  function countPairsOverlap(nodes, cfg, useRect, useCircles) {
    var bad = 0;
    var far = cfg.maxRadius || DEFAULTS.maxRadius || 34;
    for (var i = 0; i < nodes.length; i++) far = Math.max(far, effR(nodes[i], cfg));
    var cell = far * 2 + 12;
    var grid = {};
    nodes.forEach(function (p) {
      var key = Math.floor(p.x / cell) + ":" + Math.floor(p.y / cell);
      (grid[key] || (grid[key] = [])).push(p);
    });
    for (var a = 0; a < nodes.length; a++) {
      var p = nodes[a];
      var gx = Math.floor(p.x / cell), gy = Math.floor(p.y / cell);
      for (var ix = gx - 1; ix <= gx + 1; ix++) {
        for (var iy = gy - 1; iy <= gy + 1; iy++) {
          var bucket = grid[ix + ":" + iy];
          if (!bucket) continue;
          for (var bi = 0; bi < bucket.length; bi++) {
            var q = bucket[bi];
            if (q.id <= p.id) continue;
            var dx = q.x - p.x, dy = q.y - p.y;
            var min = (effR(p, cfg) + effR(q, cfg)) * 1.02 + 1;
            var hit = useCircles !== false && dx * dx + dy * dy < min * min;
            if (!hit && useRect) {
              var A = labelRectOf(p), B = labelRectOf(q);
              hit = (A && B && rectsOverlap(A, B)) ||
                (A && rectsOverlap(A, rectOfCircle(q, (q.r || 6) + 0.5))) ||
                (B && rectsOverlap(B, rectOfCircle(p, (p.r || 6) + 0.5)));
            }
            if (hit) bad++;
          }
        }
      }
    }
    return bad;
  }

  function scaleNodes(nodes, f) {
    var x0 = 0, y0 = 0, n = nodes.length;
    for (var i = 0; i < n; i++) { x0 += nodes[i].x; y0 += nodes[i].y; }
    x0 /= Math.max(1, n); y0 /= Math.max(1, n);
    for (var j = 0; j < n; j++) {
      var p = nodes[j];
      p.x = x0 + (p.x - x0) * f; p.y = y0 + (p.y - y0) * f;
      if (p.tx !== undefined) { p.tx = x0 + (p.tx - x0) * f; p.ty = y0 + (p.ty - y0) * f; }
    }
  }

  function rectsOverlap(A, B) {
    return A.x0 < B.x1 - 0.5 && B.x0 < A.x1 - 0.5 && A.y0 < B.y1 - 0.5 && B.y0 < A.y1 - 0.5;
  }

  /** Прогнать выбранный движок от начала и до конца (view, CLI и тесты). */
  function computeLayout(graph, opts) {
    opts = opts || {};
    var cfg = tuneLayout(graph, Object.assign({}, opts.layout || {}));
    if (opts.config && opts.config.maxRadius) cfg.maxRadius = opts.config.maxRadius;
    var mode = cfg.mode || "fdp";
    if (mode !== "fdp" && mode !== "neato" && mode !== "twopi") return { skipped: true, mode: mode };
    if (mode === "twopi") {
      twopiLayout(graph, cfg, { cx: 0, cy: 0 });
    } else {
      seedBlobs(graph, cfg, opts);
      var iters = opts.iterations || cfg[mode === "fdp" ? "fdpIters" : "neatoIters"] || (mode === "fdp" ? 260 : 140);
      var alpha = 1;
      // Большую часть итераций достаточно быстро расталкивать круги; несколько
      // последних label-aware шагов сохраняют характерную форму движка и уменьшают
      // работу дорогостоящей финальной полировки.
      var labelTail = Math.min(20, Math.max(4, Math.round(iters * 0.15)));
      for (var i = 0; i < iters; i++) {
        var stepOpts = i >= iters - labelTail ? Object.assign({}, opts, { labelCollision: true }) : opts;
        var d = mode === "fdp" ? frStep(graph, cfg, stepOpts, alpha) : smStep(graph, cfg, stepOpts, alpha);
        alpha = Math.max(0.02, Math.pow(1 - i / iters, mode === "fdp" ? 1.4 : 1) * (mode === "fdp" ? 1 : 0.8));
        if (opts.onStep && i % 25 === 0) opts.onStep(i, d, alpha);
        if (d < wantDistance(cfg) * 0.003 && alpha <= 0.05) break;
      }
    }
    var rep = polishNoOverlap(graph, cfg, {
      labels: cfg.postLabels !== false, circles: cfg.postCircles !== false,
      cap: cfg.dispCap, passes: cfg.polishPasses,
    });
    rep.mode = mode;
    graph.polish = rep;
    fitBounds(graph, opts);
    return rep;
  }

  /** Собираем результат к центру холста: view сам делает fit(), но bbox должен быть конечен. */
  function fitBounds(graph, opts) {
    var b = bounds(graph.nodes);
    var cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    var mx = (opts && opts.width ? opts.width : 1400) / 2;
    var my = (opts && opts.height ? opts.height : 900) / 2;
    var dx = mx - cx, dy = my - cy;
    if (!isFinite(dx) || !isFinite(dy)) return;
    graph.nodes.forEach(function (n) {
      n.x += dx; n.y += dy;
      if (n.tx !== undefined) { n.tx += dx; n.ty += dy; }
    });
    graph._bbox = { w: b.maxX - b.minX, h: b.maxY - b.minY, cx: mx, cy: my };
  }

  function run(graph, opts) {
    var cfg = merge(DEFAULTS.layout, opts && opts.layout ? opts.layout : {});
    // режим секторов строит раскладку в initPositions; если его пропустили (например,
    // ядро дёрнули напрямую), сделаем посев сами - иначе физика считает NaN
    if (graph.nodes.length && (graph.nodes[0].x === undefined || !isFinite(graph.nodes[0].x))) {
      initPositions(graph.nodes, { width: opts && opts.width, height: opts && opts.height, graph: graph, layout: cfg });
    }
    if (cfg.mode === "fdp" || cfg.mode === "neato" || cfg.mode === "twopi") {
      // движок сам делает итерации и пост-обработку; физика сверху не нужна
      return computeLayout(graph, {
        layout: cfg, config: opts && opts.config,
        width: opts && opts.width, height: opts && opts.height,
      });
    }
    if (cfg.mode === "clusters" && graph._center) {
      // placeClusters() уже сделал полный проход упаковки. Четыре одинаковых
      // повторных прохода почти не меняли геометрию, но блокировали интерфейс на
      // больших графах. Внешний вызов с `packs` сохраняет прежнюю возможность
      // запросить полную дополнительную упаковку.
      if (opts && opts.packs) {
        for (var ci = 0; ci < opts.packs; ci++) {
          packAroundAnchors(graph, {
            layout: cfg, passes: cfg.packPasses, config: opts.config,
            pull: ci === 0 ? 0.5 : 0.14,
          });
        }
      } else {
        packAroundAnchors(graph, {
          layout: cfg,
          passes: Math.max(10, Math.round(cfg.packPasses * 0.2)),
          config: opts && opts.config,
          pull: 0.18,
        });
      }
      return { alpha: 0, history: [], clusters: true };
    }
    var iters = (opts && opts.iterations) || cfg.iterations || 700;
    var alpha = 1;
    var hist = [];
    for (var i = 0; i < iters; i++) {
      var d = step(graph, {
        layout: cfg,
        alpha: alpha,
        width: opts && opts.width,
        height: opts && opts.height,
      });
      alpha = Math.max(0.02, alpha - (cfg.alphaDecay || 0.02));
      if (i % 100 === 0) hist.push(Number(d.toFixed(3)));
      if (d < 0.02 && alpha <= 0.03) break;
    }
    // «полировка»: несколько чистых проходов collide, чтобы добить остаточные наезды,
    // пока пружины и якоря их удерживают. Иначе ~1% вершин навсегда остаётся внахлёст.
    var polish = opts && opts.polish !== undefined ? opts.polish : cfg.polish === undefined ? 26 : cfg.polish;
    if (cfg.collide && polish > 0 && graph.nodes.length) {
      var byId = graph._byId;
      if (!byId) {
        byId = graph._byId = {};
        graph.nodes.forEach(function (x) { byId[x.id] = x; });
      }
      for (var pi = 0; pi < polish; pi++) collide(graph.nodes, cfg, byId, 0.35, 0.9, cfg.mode === "clusters");
      if (cfg.mode === "clusters") clampWalls(graph.nodes, graph._center);
    }
    // «чистые подписи» обязательны во всех режимах, поэтому после силовых итераций стоит
    // та же пост-обработка, что у fdp/neato/twopi (у clusters для этого свой упаковочный проход)
    if ((opts && opts.polishNoOverlap) !== false) polishNoOverlap(graph, cfg, { labels: cfg.postLabels !== false });
    return { alpha: alpha, history: hist };
  }

  function bounds(nodes) {
    var b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    nodes.forEach(function (n) {
      if (!isFinite(n.x) || !isFinite(n.y)) return;
      var r = (n.r || 6) + 4;
      b.minX = Math.min(b.minX, n.x - r);
      b.maxX = Math.max(b.maxX, n.x + r);
      b.minY = Math.min(b.minY, n.y - r);
      b.maxY = Math.max(b.maxY, n.y + r);
    });
    if (!isFinite(b.minX)) b = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    return b;
  }

  /* ------------------------------------------------------------ подписи / экспорт */

  /** Две строки подписи: основная (EN) и перевод (ZH). */
  function labelLines(node, cfg) {
    cfg = cfg || DEFAULTS;
    var a = sanitizeLabel(node[cfg.nameKey] !== undefined ? node[cfg.nameKey] : node.name);
    var b = sanitizeLabel(node[cfg.nameZhKey] !== undefined ? node[cfg.nameZhKey] : node.nameZh);
    if (!a) a = node.stem || node.id;
    return [a, b];
  }

  function wrapText(s, perLine, maxLines) {
    var words = String(s == null ? "" : s).split(/\s+/).filter(Boolean);
    var lines = [];
    var cur = "";
    words.forEach(function (w) {
      if (!cur) cur = w;
      else if ((cur + " " + w).length <= perLine) cur += " " + w;
      else {
        lines.push(cur);
        cur = w;
      }
      if (lines.length >= maxLines) return;
    });
    if (cur && lines.length < maxLines) lines.push(cur);
    if (lines.length > maxLines) lines = lines.slice(0, maxLines);
    return lines;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toSVG(graph, opts) {
    opts = opts || {};
    var cfg = graph.config || DEFAULTS;
    var b = bounds(graph.nodes);
    var pad = opts.pad === undefined ? 40 : opts.pad;
    var w = Math.max(200, Math.ceil(b.maxX - b.minX) + pad * 2);
    var h = Math.max(200, Math.ceil(b.maxY - b.minY) + pad * 2);
    var ox = pad - b.minX;
    var oy = pad - b.minY;
    var showLabels = opts.labels !== false;
    var minR = opts.labelMinRadius === undefined ? 9 : opts.labelMinRadius;
    var perLine = opts.labelChars || 22;
    var byId = {};
    graph.nodes.forEach(function (n) {
      byId[n.id] = n;
    });
    var parts = [];
    parts.push(
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h +
        '" viewBox="0 0 ' + w + " " + h + '">'
    );
    parts.push('<rect width="100%" height="100%" fill="#1e1e1e"/>');
    parts.push('<g stroke-linecap="round">');
    graph.edges.forEach(function (e) {
      var a = byId[e.source];
      var t = byId[e.target];
      if (!a || !t || !isFinite(a.x) || !isFinite(t.x)) return;
      var stroke = e.kind === "structure" ? "#777777" : e.kind === "embed" ? "#5aa9d6" : "#8a8a8a";
      var dash = e.kind === "structure" ? ' stroke-dasharray="3 4"' : "";
      var op = e.kind === "structure" ? 0.16 : 0.22;
      // рёбра — дуги (требование), а не прямые; кривизна настраивается
      var bow = opts.curvature === undefined ? (cfg.curvature === undefined ? 0.24 : cfg.curvature) : opts.curvature;
      // центр дуг = центр кластеров, иначе «веер» структурных рёбер поедёт и начнёт
      // пересекаться (в SVG он обязан совпадать с тем, что рисует view)
      var gc = graph._center ? { x: graph._center.cx, y: graph._center.cy } : { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
      var ctr = opts.center && isFinite(opts.center.x) ? opts.center : gc;
      var d = edgePath(
        { x: a.x + ox, y: a.y + oy, ws: a.ws }, { x: t.x + ox, y: t.y + oy, ws: t.ws },
        bow, { x: ctr.x + ox, y: ctr.y + oy }, e.kind
      );
      parts.push(
        '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="' +
          (e.kind === "structure" ? 0.7 : 1) + '" stroke-opacity="' + op + '"' + dash + "/>"
      );
    });
    parts.push("</g>");
    parts.push('<g font-family="Segoe UI, PingFang SC, Noto Sans CJK SC, sans-serif">');
    graph.nodes.forEach(function (n) {
      if (!isFinite(n.x) || !isFinite(n.y)) return;
      var x = n.x + ox;
      var y = n.y + oy;
      parts.push(
        '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (n.r || 6).toFixed(1) +
          '" fill="' + esc(n.color) + '" fill-opacity="0.85" stroke="#111" stroke-width="0.8" data-type="' +
          esc(n.type) + '" data-degree="' + n.degree + '" data-refmax="' + (n.refMax || 1) + '"/>'
      );
      if (!showLabels || !labelShown(n, cfg)) return;
      var ll = labelLines(n, cfg);
      // статическая картинка градиента не имеет — здесь по-прежнему рисуются ОБРЕЗАННЫЕ
      // строки, под которые строилась упаковка (в живом виде их гасит маска, см. ui.js)
      if (n.labelEnClipped !== undefined || n.labelZhClipped !== undefined) {
        ll = [n.labelEnClipped || "", n.labelZhClipped || ""];
      } else if (n.labelEn !== undefined || n.labelZh !== undefined) {
        ll = [clipLabel(n.labelEn, n.labelChars), clipLabel(n.labelZh, n.labelChars)];
      }
      var fs = n.font || opts.fontSize || 10;
      var chars = n.labelChars || perLine;
      var ty = y + (n.r || 6) + fs * 0.95;
      wrapText(ll[0], chars, cfg.labelMaxLines || 2).forEach(function (ln) {
        parts.push(
          '<text x="' + x.toFixed(1) + '" y="' + ty.toFixed(1) +
            '" font-size="' + fs.toFixed(1) + '" fill="#eee" text-anchor="middle">' + esc(ln) + "</text>"
        );
        ty += fs * 1.12;
      });
      if (ll[1]) {
        wrapText(ll[1], Math.max(4, Math.round(chars / 2)), cfg.labelMaxLines || 2).forEach(function (ln) {
          parts.push(
            '<text x="' + x.toFixed(1) + '" y="' + ty.toFixed(1) +
              '" font-size="' + fs.toFixed(1) + '" fill="#9fc9ff" text-anchor="middle">' + esc(ln) + "</text>"
          );
          ty += fs * 1.12;
        });
      }
    });
    parts.push("</g></svg>");
    return parts.join("\n");
  }

  /**
   * Иерархическое оглавление курса: главы → секции → заголовки → блоки.
   * Считается по тем же данным, что и граф, поэтому `⇠ N` в оглавлении — это реальное число
   * входящих ссылок, из которого плагин берёт размер вершины.
   *
   * opts: {title, stamp, graphDoc, resolve(stem)->bool, topN, foldIntro}
   */
  function toIndexMarkdown(graph, opts) {
    opts = opts || {};
    var cfg = graph.config || DEFAULTS;
    var kids = {};
    graph.nodes.forEach(function (n) {
      if (!n.parent || n.parent === n.id) return;
      (kids[n.parent] || (kids[n.parent] = [])).push(n);
    });
    Object.keys(kids).forEach(function (k) {
      kids[k].sort(function (a, b) {
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
    });
    var byType = function (t) {
      return graph.nodes
        .filter(function (n) {
          return n.type === t;
        })
        .sort(function (a, b) {
          return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
        });
    };
    var label = function (n) {
      return String(n.name || n.stem).replace(/\|/g, "\u2223");
    };
    var link = function (n) {
      return "[[" + n.stem.replace(/\|/g, "\u2223") + "|" + label(n) + "]]";
    };
    /* Внутри таблицы `|` разорвал бы строку, а алиас через `\|` — лишняя хрупкость
       (его понимают не все парсеры). Поэтому в таблицах ссылки без алиасов: имя файла
       и так равно «id — метка», а якорь [[#Заголовок]] отображается текстом заголовка. */
    var linkCell = function (n) {
      return "[[" + n.stem.replace(/\|/g, "\u2223") + "]]";
    };
    var anchorCell = function (text) {
      return "[[#" + text.replace(/\|/g, "\u2223") + "]]";
    };
    /** 中文 + счётчик ссылок + значки «есть формула» и «заглушка». */
    var tail = function (n) {
      var bits = [];
      if (n.nameZh) bits.push(String(n.nameZh).replace(/\|/g, "\u2223"));
      bits.push("`\u21E0 " + n.degree + "`");
      if (n.type === "block" && /\$\$/.test(n.body || "")) bits.push("`\u2211`");
      if (n.isPlaceholder) bits.push("`\u25CC`");
      return bits.length ? " \u00B7 " + bits.join(" \u00B7 ") : "";
    };
    var countUnder = function (n, type) {
      var total = 0;
      (function walk(x) {
        (kids[x.id] || []).forEach(function (c) {
          if (c.type === type) total++;
          walk(c);
        });
      })(n);
      return total;
    };
    /**
     * Текст заголовка раздела строим из имени файла (`<id> - <метка>`): метка там короткая,
     * без повторяющегося суффикса главы, — и [[#заголовок]]-ссылки указывают ровно на этот текст.
     */
    var headingTitle = function (n) {
      var short = String(n.stem || "").slice(String(n.id).length + 3);
      return n.id + " \u00B7 " + label({ name: short || n.name, stem: n.stem });
    };

    var out = [];
    var chapters = byType("chapter");
    var stats = graph.stats || {};
    out.push("---");
    out.push("type: index"); // пометка «это указатель»; вершиной графа такая заметка не становится
    out.push("status: generated");
    out.push('generator: "lecture-graph"');
    out.push("tags: [index]");
    out.push('cssclasses: ["lg-index"]');
    out.push("---");
    out.push("");
    out.push("# \u{1F4DA} " + (opts.title || "Оглавление курса \u00B7 Course Index"));
    out.push("");
    var sum = function (t) {
      return byType(t).length;
    };
    out.push(
      String(chapters.length) + " глав \u00B7 " + sum("section") + " секций \u00B7 " + sum("heading") +
        " заголовков \u00B7 " + sum("block") + " блоков \u00B7 " + (stats.edges || 0) +
        " \u0441\u0441\u044b\u043b\u043e\u043a \u0432 \u0433\u0440\u0430\u0444\u0435 \u00B7 " + (stats.nodes || 0) + " \u0432\u0435\u0440\u0448\u0438\u043d"
    );
    if (opts.stamp) out.push("*пересобрано: " + opts.stamp + "*");
    out.push("");
    var ICON = { chapter: "\ud83d\udfe1", section: "\ud83d\udd35", heading: "\ud83d\udfe2", block: "\ud83d\udfe3" };
    /** `> ` * d — префикс вложенной цитаты: уровень оглавления = глубина полоски. */
    var q = function (d) {
      return new Array(d + 1).join("> ");
    };
    /** пустая строка внутри цитаты глубины d (без неё соседние блоки склеятся) */
    var gap = function (d) {
      return q(d).replace(/ $/, "");
    };
    /**
     * callout-уровня: у него свой цвет полоски слева (см. сниппет lecture-nodes.css).
     * `+` после типа — сворачиваемый блок, развёрнутый по умолчанию.
     */
    var FOLD = { chapter: "+", section: "+", heading: "+", block: "" };
    var bar = function (d, type, title) {
      return q(d) + "[!" + type + "]" + (FOLD[type] || "") + " " + ICON[type] + " " + title;
    };
    out.push("> [!tip]- как пользоваться оглавлением");
    out.push("> 🟡 глава · 🔵 секция · 🟢 заголовок · 🟣 блоки — у каждого уровня своя цветная полоска слева,");
    out.push(">  цвета совпадают с цветом этих вершин в графе;");
    out.push("> - каждая строка — ссылка на заметку; `\u21E0 N` — сколько текстов на неё ссылаются,");
    out.push(">   из этого же числа плагин считает размер вершины в графе;");
    out.push("> - `\u2211` — в блоке есть вынесенная формула `$$…$$`, `\u25CC` — текст пока заглушка (`status: placeholder`);");
    out.push("> - сами полоски рисует сниппет `lecture-nodes.css` селектором `.lg-index`: без него блоки останутся");
    out.push(">   серыми, содержимое и ссылки не пострадают;");
    out.push("> - стрелка у заголовка сворачивает весь блок — главу, секцию или группу заголовков;");
    var doc = opts.graphDoc || "02 Graph \u2014 как читать и править";
    if (typeof opts.resolve !== "function" || opts.resolve(doc)) {
      out.push("> - про сами графы, фильтры и экспорт: [[" + doc + "]]");
    }
    out.push("> - пересобрать страницу: `Ctrl+P \u2192 Lecture Graph: Regenerate course index`.");
    out.push("");
    out.push("## Указатель глав");
    out.push("");
    out.push("| # | глава | 中文 | секции | заголовки | блоки | `\u21E0` |");
    out.push("|--:|---|---|--:|--:|--:|--:|");
    chapters.forEach(function (ch, i) {
      out.push(
        "| " + (i + 1) + " | " + anchorCell(headingTitle(ch)) + " | " +
          (ch.nameZh || "\u2014") + " | " + countUnder(ch, "section") + " | " + countUnder(ch, "heading") +
          " | " + countUnder(ch, "block") + " | `" + ch.degree + "` |"
      );
    });
    out.push("");
    out.push("---");
    chapters.forEach(function (ch) {
      out.push("");
      // заголовок главы остаётся обычным `##`: на него ссылаются якори [[#…]] из таблицы,
      // и на нём работает штатное сворачивание раздела
      out.push("## " + headingTitle(ch));
      out.push("");
      out.push(bar(1, "chapter", "*" + (ch.nameZh || "\u2014") + "* \u00B7 " + link(ch) + " \u00B7 `" + ch.degree + "` \u00B7 исходящих `" + ch.outCount + "`"));
      (kids[ch.id] || []).forEach(function (sec) {
        out.push(gap(1));
        out.push(bar(2, "section", "`" + sec.id + "` \u00B7 " + link(sec) + tail(sec)));
        (kids[sec.id] || []).forEach(function (h) {
          out.push(gap(2));
          out.push(bar(3, "heading", link(h) + tail(h)));
          var bs = kids[h.id] || [];
          if (!bs.length) return;
          out.push(gap(3));
          out.push(bar(4, "block", "блоков \u00B7 " + bs.length));
          bs.forEach(function (b) {
            out.push(q(4) + "- " + link(b) + tail(b));
          });
        });
      });
    });

    // хвост: что стоит починить и во что упирается граф
    var top = graph.nodes
      .slice()
      .sort(function (a, b) {
        return b.degree - a.degree || (a.id < b.id ? -1 : 1);
      })
      .slice(0, opts.topN === 0 ? 0 : opts.topN || 20);
    out.push("");
    out.push("## Топ-" + top.length + " вершин по числу ссылок");
    out.push("");
    out.push("| вершина | метка | тип | 中文 | `\u21E0` | тексты | структурные | врезки |");
    out.push("|---|---|---|---|--:|--:|--:|--:|");
    top.forEach(function (n) {
      out.push(
          "| " + linkCell(n) + " | " + label(n) + " | " + n.type + " | " + (n.nameZh || "\u2014") + " | `" + n.degree + "` | " +
          n.inRefs + " | " + n.inStruct + " | " + n.inEmbed + " |"
      );
    });
    // «что починить» — про курс: у вершины-оглавления входящих нет намеренно,
    // а её ссылка на инструкцию ведёт в заметку вне графа — это не проблема
    var orphans = graph.nodes.filter(function (n) {
      return n.degree === 0;
    });
    var unres = graph.nodes.filter(function (n) {
      return n.unresolved;
    });
    out.push("");
    out.push("## Что починить");
    out.push("");
    out.push("- вершин без единой входящей ссылки: **" + orphans.length + "**" +
      (orphans.length ? " \u2014 " + orphans.slice(0, 12).map(link).join(", ") : " \u2014 изолированных нет, граф связный"));
    out.push("- неразрешённых ссылок: **" + (stats.unresolved || 0) + "**" +
      (unres.length ? " \u2014 " + unres.slice(0, 12).map(function (n) { return link(n) + " (" + n.unresolved + ")"; }).join(", ") : ""));
    var noZh = graph.nodes.filter(function (n) {
      return n.zhMissing;
    });
    out.push("- вершин без перевода (`" + (cfg.nameZhKey || "name_zh") + "` пуст): **" + noZh.length + "**" +
      (noZh.length ? " \u2014 " + noZh.slice(0, 12).map(link).join(", ") : ""));
    return out.join("\n") + "\n";
  }

  function toDot(graph) {
    var lines = ["digraph LectureGraph {", '  node [shape=ellipse, fontname="Segoe UI"];'];
    var style = {
      chapter: 'shape=box3d, style="filled"',
      section: 'shape=note, style="filled"',
      heading: 'shape=ellipse, style="filled"',
      block: 'shape=plain, style="dashed"',
    };
    graph.nodes.forEach(function (n) {
      var ll = labelLines(n, graph.config);
      var label = ll[0] + (ll[1] ? "\\n" + ll[1] : "") + "\\nrefs " + n.degree;
      lines.push(
        '  ' + JSON.stringify(n.id) + " [" + (style[n.type] || "") +
          ' fillcolor="' + n.color + '" label=' + JSON.stringify(label) + "];"
      );
    });
    graph.edges.forEach(function (e) {
      lines.push(
        "  " + JSON.stringify(e.source) + " -> " + JSON.stringify(e.target) +
          " [style=" + (e.kind === "structure" ? "dotted" : "solid") + "];"
      );
    });
    lines.push("}");
    return lines.join("\n");
  }

  function toGraphML(graph) {
    var head =
      '<?xml version="1.0" encoding="UTF-8"?>\n<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n' +
      '  <key id="type" for="node" attr.name="type" attr.name2="type" attr.type="string"/>\n' +
      '  <key id="name" for="node" attr.name="name" attr.type="string"/>\n' +
      '  <key id="name_zh" for="node" attr.name="name_zh" attr.type="string"/>\n' +
      '  <key id="degree" for="node" attr.name="degree" attr.type="int"/>\n' +
      "  <graph id=\"G\" edgedefault=\"directed\">\n";
    var body = graph.nodes.map(function (n) {
      var ll = labelLines(n, graph.config);
      return (
        '    <node id="' + esc(n.id) + '">\n' +
        '      <data key="type">' + esc(n.type) + "</data>\n" +
        '      <data key="name">' + esc(ll[0]) + "</data>\n" +
        '      <data key="name_zh">' + esc(ll[1]) + "</data>\n" +
        '      <data key="degree">' + n.degree + "</data>\n" +
        "    </node>"
      );
    });
    var edges = graph.edges.map(function (e, i) {
      return '    <edge id="e' + i + '" source="' + esc(e.source) + '" target="' + esc(e.target) +
        '" label="' + esc(e.kind) + '"/>';
    });
    return head + body.join("\n") + "\n" + edges.join("\n") + "\n  </graph>\n</graphml>\n";
  }

  function toCsv(graph, opts) {
    opts = opts || {};
    var sep = opts.sep || ",";
    var rows = [["path", "id", "type", "name", "name_zh", "refs_in", "struct_in", "embed_in", "out", "status"]]
      .concat(
        graph.nodes.map(function (n) {
          var ll = labelLines(n, graph.config);
          return [n.path, n.id, n.type, ll[0], ll[1], n.inRefs, n.inStruct, n.inEmbed, n.outCount, n.status || ""]
            .map(function (v) {
              var s = String(v == null ? "" : v);
              return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
            })
            .join(sep);
        })
      );
    return rows.join("\n") + "\n";
  }

  function toMarkdown(graph, opts) {
    opts = opts || {};
    var limit = opts.limit || 80;
    var sorted = graph.nodes.slice().sort(function (a, b) {
      return b.degree - a.degree;
    });
    var lines = [];
    TYPES.forEach(function (t) {
      var arr = sorted.filter(function (n) {
        return n.type === t;
      });
      lines.push("## " + t + " (" + arr.length + ")");
      arr.slice(0, limit).forEach(function (n) {
        var ll = labelLines(n, graph.config);
        lines.push(
          "- [[" + n.stem + "|" + ll[0] + "]] — " + ll[1] + " · refs " + n.degree
        );
      });
      lines.push("");
    });
    return lines.join("\n");
  }

  /** Соседи (для подсветки). */
  function neighborhood(graph, id) {
    var res = {};
    res[id] = true;
    graph.edges.forEach(function (e) {
      if (e.source === id) res[e.target] = true;
      if (e.target === id) res[e.source] = true;
    });
    return res;
  }

  /** Компоненты связности (без направления) — для отчёта. */
  function components(graph) {
    var adj = {};
    graph.nodes.forEach(function (n) {
      adj[n.id] = [];
    });
    graph.edges.forEach(function (e) {
      if (adj[e.source]) adj[e.source].push(e.target);
      if (adj[e.target]) adj[e.target].push(e.source);
    });
    var seen = {};
    var sizes = [];
    graph.nodes.forEach(function (n) {
      if (seen[n.id]) return;
      var stack = [n.id];
      var size = 0;
      seen[n.id] = true;
      while (stack.length) {
        var cur = stack.pop();
        size++;
        (adj[cur] || []).forEach(function (nx) {
          if (!seen[nx]) {
            seen[nx] = true;
            stack.push(nx);
          }
        });
      }
      sizes.push(size);
    });
    sizes.sort(function (a, b) {
      return b - a;
    });
    return { count: sizes.length, sizes: sizes.slice(0, 10), largest: sizes[0] || 0 };
  }

  /** Фильтр/поиск для панели вида. */
  function filterNodes(graph, f) {
    f = f || {};
    var types = f.types || null;
    var q = (f.query || "").toLowerCase().trim();
    var minDegree = f.minDegree || 0;
    return graph.nodes.filter(function (n) {
      if (types && types.indexOf(n.type) < 0) return false;
      if (n.degree < minDegree) return false;
      if (f.hidePlaceholders && n.isPlaceholder) return false;
      if (f.chapter && n.chapter !== f.chapter) return false;
      if (q) {
        var hay = (n.name + " " + n.nameZh + " " + n.id + " " + n.stem).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  /**
   * Кандидаты для ручного слияния. В отличие от findDuplicateGroups эта функция
   * ничего не решает за пользователя: она только даёт полный, предсказуемый список
   * совместимых вершин и поиск по нему. Совместимыми считаются обычные файловые
   * вершины того же уровня — сливать, например, главу в блок нельзя, потому что у
   * их детей разные инварианты parent:/chapter:.
   *
   * Поиск видит обе строки названия, id, путь, aliases, keywords, parent и chapter.
   * Без запроса выше оказываются похожие по названию и близкие по структуре узлы;
   * это лишь порядок списка, а не автоматическое подтверждение дубликата.
   */
  function mergeSearchNorm(value) {
    var text = String(value == null ? "" : value).toLowerCase();
    if (text.normalize) {
      try { text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) { /* noop */ }
    }
    // Названия пользовательских узлов могут быть не только на EN/中文. Unicode-класс
    // сохраняет кириллицу и другие письменности; fallback нужен старым JS-движкам.
    try {
      return text.replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
    } catch (e2) {
      return text.replace(/[^a-z0-9\u0400-\u04ff\u4e00-\u9fff]+/g, " ").replace(/\s+/g, " ").trim();
    }
  }

  function mergeCandidateText(node) {
    var data = (node && node.data) || {};
    var values = [
      node && node.id,
      node && node.name,
      node && node.nameZh,
      node && node.stem,
      node && node.path,
      node && node.parent,
      node && node.chapter,
      node && node.type,
      data.aliases,
      data.keywords_en,
      data.keywords,
      node && node.keywords,
    ];
    var flat = [];
    values.forEach(function (v) {
      if (Object.prototype.toString.call(v) === "[object Array]") {
        v.forEach(function (x) { if (x !== undefined && x !== null) flat.push(String(x)); });
      } else if (v !== undefined && v !== null) {
        flat.push(String(v));
      }
    });
    return mergeSearchNorm(flat.join(" "));
  }

  function findMergeCandidates(graph, source, query, opts) {
    var o = opts || {};
    var byId = (graph && graph._byId) || {};
    var src = typeof source === "string" ? byId[source] : source;
    if (!src || src.inline) return [];
    var q = mergeSearchNorm(query || "");
    var terms = q ? q.split(/\s+/).filter(Boolean) : [];
    var scored = [];
    ((graph && graph.nodes) || []).forEach(function (n) {
      if (!n || n.id === src.id || !n.path) return;
      if (!o.includeInline && n.inline) return;
      if (o.sameType !== false && n.type !== src.type) return;
      var hay = mergeCandidateText(n);
      for (var i = 0; i < terms.length; i++) {
        if (hay.indexOf(terms[i]) < 0) return;
      }
      var rank = 0;
      if (q) {
        var exact = [n.id, n.name, n.nameZh, n.stem].map(mergeSearchNorm);
        if (exact.indexOf(q) >= 0) rank += 10000;
        for (var e = 0; e < exact.length; e++) {
          if (exact[e] && exact[e].indexOf(q) === 0) rank += 1000;
        }
        var at = hay.indexOf(q);
        if (at >= 0) rank += 500 - Math.min(499, at);
      } else {
        var en = dupTitleSim(dupNormTitle(src.name), dupNormTitle(n.name));
        var zh = dupTitleSim(dupNormTitle(src.nameZh), dupNormTitle(n.nameZh));
        rank += Math.max(en, zh) * 1000;
        if (src.parent && n.parent === src.parent) rank += 90;
        if (src.chapter && n.chapter === src.chapter) rank += 35;
      }
      rank += Math.min(30, Number(n.degree || 0)) / 100;
      scored.push({ node: n, rank: rank });
    });
    scored.sort(function (a, b) {
      if (b.rank !== a.rank) return b.rank - a.rank;
      var an = String(a.node.name || a.node.id || "").toLowerCase();
      var bn = String(b.node.name || b.node.id || "").toLowerCase();
      if (an !== bn) return an < bn ? -1 : 1;
      return a.node.id < b.node.id ? -1 : a.node.id > b.node.id ? 1 : 0;
    });
    var out = scored.map(function (x) { return x.node; });
    if (o.limit !== undefined && isFinite(Number(o.limit))) out = out.slice(0, Math.max(0, Number(o.limit)));
    return out;
  }

  /* ------------------------------------------------- поиск и слияние дубликатов */

  function dupNormText(text) {
    return String(text == null ? "" : text)
      .replace(/\r\n/g, "\n")
      .replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, function (_, path, alias) {
        return sanitizeLabel(alias || stemOf(path));
      })
      .replace(/^>+\s*/gm, "")
      .replace(/[*_`~]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function removeHeadingSection(text, heading) {
    var lines = String(text == null ? "" : text).replace(/\r\n/g, "\n").split("\n");
    var low = String(heading || "").trim().toLowerCase();
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim().toLowerCase() !== low) continue;
      var end = lines.length;
      for (var j = i + 1; j < lines.length; j++) {
        if (/^#{1,6}\s/.test(lines[j])) { end = j; break; }
      }
      lines.splice(i, end - i);
      break;
    }
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    return lines.join("\n");
  }

  function mergeBodyCore(node, opts) {
    var name = normPhrase((node && (node.name || node.stem)) || "");
    var zh = normPhrase((node && node.nameZh) || "");
    var rawBody = String((node && node.body) || "").replace(/\r\n/g, "\n");
    var cut = splitKeywordRegion(rawBody);
    // Related вырезаем только из части ДО региона фраз: «хвост» после региона
    // (якорь/абзац, дописанные в конец файла) — обычное содержимое, а не Related
    var beforePart = cut.at >= 0 ? rawBody.slice(0, cut.at) : rawBody;
    var afterPart = cut.at >= 0 ? rawBody.slice(cut.end >= 0 ? cut.end : rawBody.length) : "";
    var cleanedBefore;
    if (opts && opts.preserveRelated) {
      // При ручном слиянии пользователь ожидает сохранить и исходящие ручные
      // связи удаляемого узла. Оставляем их wiki-ссылки в переносимом материале,
      // но понижаем служебные H2 до H3 и подписываем источник, чтобы у keeper не
      // появлялось два одинаковых активных раздела `## Related topics`.
      var from = (node && node.id) || "node";
      cleanedBefore = beforePart.split("\n").map(function (line) {
        var low = line.trim().toLowerCase();
        if (low === RELATED_HEADING.toLowerCase()) return "### Related topics carried from " + from;
        if (low === CHAPTER_HEADING.toLowerCase()) return "### Related chapters carried from " + from;
        return line;
      }).join("\n").replace(/\s+$/g, "");
    } else {
      cleanedBefore = removeHeadingSection(beforePart, RELATED_HEADING).replace(/\s+$/g, "");
    }
    var cleanedAfter = afterPart.replace(/^\s+|\s+$/g, "");
    var body = [cleanedBefore, cleanedAfter].filter(function (x) { return x !== ""; }).join("\n\n");
    var lines = body.split("\n");
    while (lines.length && !lines[0].trim()) lines.shift();
    if (lines.length && /^#\s+/.test(lines[0])) {
      var top = normPhrase(lines[0].replace(/^#\s+/, ""));
      var stem = normPhrase((node && node.stem) || "");
      if (top && (top === name || top === stem)) lines.shift();
      while (lines.length && !lines[0].trim()) lines.shift();
    }
    if (lines.length && zh && /^\*\*.*\*\*$/.test(lines[0].trim())) {
      var bold = normPhrase(lines[0].replace(/^\*\*|\*\*$/g, ""));
      if (bold === zh) lines.shift();
      while (lines.length && !lines[0].trim()) lines.shift();
    }
    if (lines.length && /^⬆️\s+Part of\b/i.test(lines[0].trim())) {
      lines.shift();
      while (lines.length && !lines[0].trim()) lines.shift();
    }
    // шаблонный абзац новых узлов («Узел создан из окна графа…») — не содержимое:
    // иначе все свежие MN-вершины «похожи» друг на друга по тексту-заглушке
    lines = lines.filter(function (l) { return l.indexOf("Узел создан из окна графа") < 0; });
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  /* --- интеллектуальный поиск дубликатов: нормалки, нечёткое сравнение, множества --- */

  function dupNormTitle(s) {
    var t = String(s == null ? "" : s).toLowerCase();
    if (t.normalize) {
      try { t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) { /* noop */ }
    }
    return t.replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function dupTitleTokens(norm) {
    var parts = String(norm || "").match(/[a-z0-9]+|[\u4e00-\u9fff]/g) || [];
    var seen = {}, out = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      // одиночные латинские буквы — шум («a», «of» без «o»/«f» по отдельности не бывает),
      // а одиночные цифры значимы: «1.1.1a» и «6.1.1a» — разные позиции курса
      if (p.length <= 1 && !/[\u4e00-\u9fff0-9]/.test(p)) continue;
      if (seen[p]) continue;
      seen[p] = true;
      out.push(p);
    }
    return out;
  }

  function levDist(a, b, limit) {
    a = String(a || ""); b = String(b || "");
    if (a === b) return 0;
    var la = a.length, lb = b.length;
    if (!la) return lb;
    if (!lb) return la;
    if (limit !== undefined && Math.abs(la - lb) > limit) return limit + 1;
    var prev = new Array(lb + 1), cur = new Array(lb + 1), j, i;
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      cur[0] = i;
      var rowMin = i;
      var ca = a.charCodeAt(i - 1);
      for (j = 1; j <= lb; j++) {
        var cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
        var v = prev[j] + 1;
        var ins = cur[j - 1] + 1;
        if (ins < v) v = ins;
        var sub = prev[j - 1] + cost;
        if (sub < v) v = sub;
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (limit !== undefined && rowMin > limit) return limit + 1;
      var tmp = prev; prev = cur; cur = tmp;
    }
    return prev[lb];
  }

  function dupTitleSim(normA, normB, tokA, tokB) {
    if (!normA || !normB) return 0;
    if (normA === normB) return 1;
    var j = 0;
    if (tokA && tokB && tokA.length && tokB.length) {
      var map = {}, hit = 0, union = tokA.length, i;
      for (i = 0; i < tokA.length; i++) map[tokA[i]] = 1;
      for (i = 0; i < tokB.length; i++) {
        if (map[tokB[i]] === 1) hit++;
        else union++;
        map[tokB[i]] = 2;
      }
      j = union ? hit / union : 0;
      if (j >= 1) return 1;
      // общих токенов почти нет — названия заведомо разные, Левенштейн не нужен
      if (j < 0.15) return j;
    }
    var maxLen = Math.max(normA.length, normB.length);
    if (!maxLen || maxLen > 140) return j;
    var limit = Math.floor(maxLen * 0.4) + 1;
    var d = levDist(normA, normB, limit);
    var c = d <= limit ? 1 - d / maxLen : 0;
    return Math.max(j, c);
  }

  function dupSetStats(setA, setB) {
    var empty = { hit: 0, jaccard: 0, containment: 0 };
    if (!setA || !setB || !setA.length || !setB.length) return empty;
    var map = {}, i, hit = 0;
    for (i = 0; i < setA.length; i++) map[setA[i]] = 1;
    for (i = 0; i < setB.length; i++) {
      if (map[setB[i]] === 1) { hit++; map[setB[i]] = 2; }
      else if (!map[setB[i]]) map[setB[i]] = 2;
    }
    var union = setA.length + setB.length - hit;
    return {
      hit: hit,
      jaccard: union ? hit / union : 0,
      containment: hit / Math.min(setA.length, setB.length),
    };
  }

  function dupKeywordSet(node) {
    var out = [], seen = {};
    var list = parseKeywords(
      node && node.data ? node.data.keywords_en : (node && node.keywords) || [],
      node && node.data ? node.data.keywords : null
    );
    // keywords уже лежат в node.keywords у построенного графа — добираем и оттуда
    if (node && node.keywords && node.keywords.length) {
      for (var k = 0; k < node.keywords.length; k++) list.push(node.keywords[k]);
    }
    for (var i = 0; i < list.length; i++) {
      var nk = dupNormTitle(list[i]);
      if (!nk || seen[nk]) continue;
      seen[nk] = true;
      out.push(nk);
    }
    return out;
  }

  function dupLinkSet(node) {
    var out = [], seen = {};
    var links = (node && node.links) || [];
    for (var i = 0; i < links.length; i++) {
      var p = String(links[i] && links[i].path || "").trim();
      if (!p) continue;
      var k = stemOf(p).toLowerCase();
      if (!k || seen[k]) continue;
      seen[k] = true;
      out.push(k);
    }
    return out;
  }

  function dupAliasSet(node) {
    var out = [], seen = {};
    var raw = [];
    var av = node && node.data ? node.data.aliases : null;
    if (Object.prototype.toString.call(av) === "[object Array]") raw = raw.concat(av);
    else if (av !== undefined && av !== null && av !== "") raw.push(av);
    raw.push(node && node.id, node && node.stem);
    for (var i = 0; i < raw.length; i++) {
      var k = String(raw[i] == null ? "" : raw[i]).trim().toLowerCase();
      if (!k || seen[k]) continue;
      seen[k] = true;
      out.push(k);
    }
    return out;
  }

  function duplicateTokens(text) {
    var seen = {};
    var out = [];
    var parts = String(text == null ? "" : text).toLowerCase().match(/[a-z0-9]+|[\u4e00-\u9fff]/g) || [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.length <= 1 && !/[\u4e00-\u9fff]/.test(p)) continue;
      if (seen[p]) continue;
      seen[p] = true;
      out.push(p);
    }
    return out;
  }

  function duplicateJaccard(a, b) {
    var sa = duplicateTokens(a);
    var sb = duplicateTokens(b);
    if (!sa.length || !sb.length) return 0;
    var map = {};
    var i;
    for (i = 0; i < sa.length; i++) map[sa[i]] = 1;
    var hit = 0, union = sa.length;
    for (i = 0; i < sb.length; i++) {
      if (map[sb[i]] === 1) hit++;
      else union++;
      map[sb[i]] = 2;
    }
    return union ? hit / union : 0;
  }

  function duplicateKeywordsKey(node) {
    return parseKeywords(node && node.keywords ? node.keywords : ((node && node.data && node.data.keywords_en) || ""))
      .map(normPhrase)
      .filter(Boolean)
      .sort()
      .join(";");
  }

  function duplicateProfile(node) {
    var body = dupNormText(mergeBodyCore(node));
    var titleRaw = (node && node.name) || (node && node.stem) || "";
    var zhRaw = (node && node.nameZh) || "";
    var titleNorm = dupNormTitle(titleRaw);
    var zhNorm = dupNormTitle(zhRaw);
    return {
      title: normPhrase(titleRaw),
      titleZh: normPhrase(zhRaw),
      titleNorm: titleNorm,
      zhNorm: zhNorm,
      titleTokens: dupTitleTokens(titleNorm),
      zhTokens: dupTitleTokens(zhNorm),
      body: body,
      bodyLen: body.length,
      bodyTokens: duplicateTokens(body),
      keywords: duplicateKeywordsKey(node),
      kwSet: dupKeywordSet(node),
      linkSet: dupLinkSet(node),
      aliasSet: dupAliasSet(node),
      manual: /^MN-\d+$/.test(String((node && node.id) || "")),
    };
  }

  function dupTitleNumbers(norm) {
    return (String(norm || "").match(/[0-9]+[a-z]?/g) || []).join(" ");
  }

  function duplicateScore(a, b, opts) {
    var cfg = merge(DEFAULTS, opts || {});
    var empty = { match: false, score: 0, contentScore: 0, titleSim: 0, zhSim: 0, containment: 0, kwOverlap: 0, linkOverlap: 0, reasons: [] };
    if (!a || !b || a === b || a.inline || b.inline) return empty;
    if (a.type !== b.type) return { match: false, score: 0, contentScore: 0, titleSim: 0, zhSim: 0, containment: 0, kwOverlap: 0, linkOverlap: 0, reasons: ["different-type"] };
    var pa = a._dupProfile || (a._dupProfile = duplicateProfile(a));
    var pb = b._dupProfile || (b._dupProfile = duplicateProfile(b));
    var sameTitle = !!pa.title && pa.title === pb.title;
    var sameZh = !!pa.titleZh && pa.titleZh === pb.titleZh;
    var homeA0 = a.chapter || (a.type === "chapter" ? a.id : null);
    var homeB0 = b.chapter || (b.type === "chapter" ? b.id : null);
    var manual0 = /^MN-\d+$/.test(String(a.id || "")) || /^MN-\d+$/.test(String(b.id || ""));
    // Одна и та же тема в разных главах — штатная структура курса, а не дубликат.
    // Проверяем ДО дорогих Левенштейна/Жаккара: таких пар тысячи, и все мимо.
    if (homeA0 && homeB0 && homeA0 !== homeB0 && !manual0 && a.type !== "chapter") {
      var es = 0.18, er = [];
      if (sameTitle) { es += 0.44; er.push("same-title"); }
      if (sameZh) { es += 0.12; er.push("same-title-zh"); }
      er.push("different-chapter");
      return {
        match: false, score: Math.round(es * 1000) / 1000, contentScore: 0,
        titleSim: sameTitle ? 1 : 0, zhSim: sameZh ? 1 : 0, containment: 0,
        kwOverlap: 0, linkOverlap: 0, reasons: er,
      };
    }
    // Номера в названии («Proposition 1.1.1a» vs «Proposition 6.1.1a») — это позиция
    // в курсе, а не опечатка: одинаковая тема под разными номерами — разные вершины.
    // Исключение — побайтово одинаковое содержимое (тогда смотрим остальные сигналы).
    var numA = dupTitleNumbers(pa.titleNorm);
    var numB = dupTitleNumbers(pb.titleNorm);
    var sameBodyEarly = pa.bodyLen >= 80 && !!pa.body && pa.body === pb.body;
    if (numA && numB && numA !== numB && !sameBodyEarly) {
      var ns = 0.18, nr = [];
      if (sameTitle) { ns += 0.44; nr.push("same-title"); }
      if (sameZh) { ns += 0.12; nr.push("same-title-zh"); }
      nr.push("different-numbers");
      return {
        match: false, score: Math.round(ns * 1000) / 1000, contentScore: 0,
        titleSim: sameTitle ? 1 : 0, zhSim: sameZh ? 1 : 0, containment: 0,
        kwOverlap: 0, linkOverlap: 0, reasons: nr,
      };
    }
    var titleSim = sameTitle ? 1 : dupTitleSim(pa.titleNorm, pb.titleNorm, pa.titleTokens, pb.titleTokens);
    if (!sameTitle && pa.titleNorm && pa.titleNorm === pb.titleNorm) { sameTitle = true; titleSim = 1; }
    var zhSim = sameZh ? 1 : dupTitleSim(pa.zhNorm, pb.zhNorm, pa.zhTokens, pb.zhTokens);
    if (!sameZh && pa.zhNorm && pa.zhNorm === pb.zhNorm) { sameZh = true; zhSim = 1; }
    var sameBody = pa.bodyLen >= 80 && !!pa.body && pa.body === pb.body;
    var bodyStats = dupSetStats(pa.bodyTokens, pb.bodyTokens);
    var bodySim = sameBody ? 1 : bodyStats.jaccard;
    var containment = sameBody ? 1 : bodyStats.containment;
    var sameKeywords = !!pa.keywords && pa.keywords === pb.keywords;
    var kwStats = dupSetStats(pa.kwSet, pb.kwSet);
    var kwOverlap = sameKeywords ? 1 : kwStats.jaccard;
    var linkStats = dupSetStats(pa.linkSet, pb.linkSet);
    var linkOverlap = linkStats.jaccard;
    var aliasOverlap = dupSetStats(pa.aliasSet, pb.aliasSet).hit > 0;
    var sameParent = !!a.parent && a.parent === b.parent;
    var homeA = a.chapter || (a.type === "chapter" ? a.id : null);
    var homeB = b.chapter || (b.type === "chapter" ? b.id : null);
    var sameChapter = !!homeA && homeA === homeB;
    var differentChapter = !!homeA && !!homeB && homeA !== homeB;
    var manual = pa.manual || pb.manual;
    var score = 0.18;
    var reasons = [];
    if (sameTitle) { score += 0.44; reasons.push("same-title"); }
    else if (titleSim >= 0.92) { score += 0.38; reasons.push("similar-title:" + Math.round(titleSim * 100) + "%"); }
    else if (titleSim >= 0.8) { score += 0.28; reasons.push("similar-title:" + Math.round(titleSim * 100) + "%"); }
    else if (titleSim >= 0.68) { score += 0.15; reasons.push("similar-title:" + Math.round(titleSim * 100) + "%"); }
    if (sameZh) { score += 0.12; reasons.push("same-title-zh"); }
    else if (zhSim >= 0.92) { score += 0.1; reasons.push("similar-title-zh:" + Math.round(zhSim * 100) + "%"); }
    else if (zhSim >= 0.8) { score += 0.07; reasons.push("similar-title-zh:" + Math.round(zhSim * 100) + "%"); }
    var bodyBase = Math.min(pa.bodyLen || 0, pb.bodyLen || 0);
    if (sameBody) { score += 0.62; reasons.push("same-content"); }
    else if (containment >= 0.92 && bodyBase >= 100) { score += 0.5; reasons.push("content-contains:" + Math.round(containment * 100) + "%"); }
    else if (bodySim >= 0.34) { score += Math.min(0.34, bodySim * 0.34); reasons.push("content-similarity:" + Math.round(bodySim * 100) + "%"); }
    else if (containment >= 0.6 && bodyBase >= 120) { score += 0.18; reasons.push("content-overlap:" + Math.round(containment * 100) + "%"); }
    if (sameKeywords) { score += 0.08; reasons.push("same-keywords"); }
    else if (pa.kwSet.length && pb.kwSet.length) {
      if (kwOverlap >= 0.6) { score += 0.07; reasons.push("shared-keywords:" + Math.round(kwOverlap * 100) + "%"); }
      else if (kwOverlap >= 0.4) { score += 0.05; reasons.push("shared-keywords:" + Math.round(kwOverlap * 100) + "%"); }
      else if (kwOverlap >= 0.25) { score += 0.03; reasons.push("shared-keywords:" + Math.round(kwOverlap * 100) + "%"); }
    }
    if (pa.linkSet.length && pb.linkSet.length) {
      if (linkOverlap >= 0.6) { score += 0.1; reasons.push("shared-links:" + Math.round(linkOverlap * 100) + "%"); }
      else if (linkOverlap >= 0.4) { score += 0.06; reasons.push("shared-links:" + Math.round(linkOverlap * 100) + "%"); }
      else if (linkOverlap >= 0.25) { score += 0.03; reasons.push("shared-links:" + Math.round(linkOverlap * 100) + "%"); }
    }
    if (aliasOverlap) { score += 0.1; reasons.push("shared-alias"); }
    if (sameParent) { score += 0.08; reasons.push("same-parent"); }
    if (sameChapter) { score += 0.05; reasons.push("same-chapter"); }
    if (manual) { score += 0.12; reasons.push("manual-node"); }
    var titleHit = sameTitle || titleSim >= 0.85;
    var zhHit = sameZh || zhSim >= 0.85;
    var strongContent =
      (sameBody && (sameTitle || sameZh || sameKeywords || titleHit || zhHit || titleSim >= 0.68 || zhSim >= 0.68)) ||
      (bodyBase >= 160 && bodySim >= 0.9 && (sameKeywords || sameTitle || sameZh || titleHit || zhHit || kwOverlap >= 0.4)) ||
      (bodyBase >= 120 && containment >= 0.88 && (sameKeywords || kwOverlap >= 0.4 || titleHit || zhHit)) ||
      (bodyBase >= 100 && bodySim >= 0.8 && (titleHit || zhHit)) ||
      (bodyBase >= 200 && bodySim >= 0.9 && kwOverlap >= 0.5);
    // Точное совпадение названия под одним родителем — дубликат; для НЕЧЁТКОГО
    // совпадения («Estimate»/«Example») одного родителя мало — нужны перевод,
    // содержимое, фразы или связи, иначе схлопнутся соседние блоки курса.
    var fuzzyTitle = !sameTitle && titleHit;
    var matchTitle =
      (sameTitle && (zhHit || bodySim >= 0.34 || containment >= 0.6 || manual || sameKeywords || kwOverlap >= 0.3 || sameParent || linkOverlap >= 0.4 || aliasOverlap)) ||
      (fuzzyTitle && (zhHit || bodySim >= 0.34 || containment >= 0.6 || manual || sameKeywords || kwOverlap >= 0.3 || linkOverlap >= 0.4 || aliasOverlap));
    var match = matchTitle || strongContent || (score >= 0.95 && (titleHit || zhHit || strongContent));
    if (!titleHit && !zhHit && !strongContent) match = false;
    return {
      match: !!match, score: Math.round(score * 1000) / 1000,
      contentScore: Math.round(bodySim * 1000) / 1000,
      titleSim: Math.round(titleSim * 1000) / 1000, zhSim: Math.round(zhSim * 1000) / 1000,
      containment: Math.round(containment * 1000) / 1000,
      kwOverlap: Math.round(kwOverlap * 1000) / 1000, linkOverlap: Math.round(linkOverlap * 1000) / 1000,
      reasons: reasons,
    };
  }

  function duplicateRichness(node) {
    var body = String((node && node.body) || "");
    var score = 0;
    var math = body.match(/\$\$/g) || [];
    if (math.length >= 2) score += 3;
    var heads = body.match(/^#{1,6}\s+\S/mg) || [];
    score += Math.min(2, heads.length);
    var items = body.match(/^\s*(?:[-*+]|\d+\.)\s+\S/mg) || [];
    score += Math.min(2, Math.round(items.length / 2));
    return score;
  }

  function duplicateKeeperScore(node) {
    if (!node) return -Infinity;
    var p = node._dupProfile || (node._dupProfile = duplicateProfile(node));
    var score = 0;
    if (!node.isPlaceholder) score += 8;
    if (String(node.status || "") === "draft") score += 2;
    if (node.caption) score += 4;
    if (node.nameZh) score += 2;
    if ((node.kwWeight || 0) > 0) score += 2;
    var aliasCount = node.data && Object.prototype.toString.call(node.data.aliases) === "[object Array]" ? node.data.aliases.length : 0;
    if (aliasCount > 1) score += 1;
    if (p.manual) score -= 6;
    else score += 8;
    score += Math.min(8, Math.round((node.degree || 0) / 3));
    score += Math.min(8, Math.round(p.bodyLen / 80));
    score += Math.min(4, (node.keywords || []).length);
    if (node.outCount) score += Math.min(3, Math.round(node.outCount / 4));
    score += duplicateRichness(node);
    return score;
  }

  function pickDuplicateKeeper(nodes) {
    var arr = (nodes || []).slice().filter(Boolean);
    arr.sort(function (a, b) {
      var sa = duplicateKeeperScore(a);
      var sb = duplicateKeeperScore(b);
      if (sa !== sb) return sb - sa;
      var da = a.degree || 0;
      var db = b.degree || 0;
      if (da !== db) return db - da;
      var la = (a._dupProfile || (a._dupProfile = duplicateProfile(a))).bodyLen;
      var lb = (b._dupProfile || (b._dupProfile = duplicateProfile(b))).bodyLen;
      if (la !== lb) return lb - la;
      return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
    });
    return arr[0] || null;
  }

  var DUP_STOP = { and: 1, the: 1, of: 1, for: 1, with: 1, from: 1, into: 1, that: 1, this: 1, are: 1, was: 1, were: 1, has: 1, have: 1, had: 1, but: 1, not: 1, per: 1, via: 1 };

  function dupConfidenceOf(score, sameTitle, sameBody) {
    if (sameTitle && sameBody) return "high";
    if (score >= 1) return "high";
    if (score >= 0.7) return "medium";
    return "low";
  }

  function findDuplicateGroups(graph, opts) {
    var cfg = merge(DEFAULTS, opts || {});
    var nodes = ((graph && graph.nodes) || []).filter(function (n) { return n && !n.inline; });
    nodes.forEach(function (n) { n._dupProfile = duplicateProfile(n); n.duplicateOf = null; n.duplicateGroup = null; n.duplicateReasons = []; });
    var MAX_BUCKET = 80;
    var buckets = {};
    function push(key, node) {
      if (!key) return;
      var arr = buckets[key] || (buckets[key] = []);
      // слишком частые ключи («definition», «proposition») — не блокировка, а шум
      if (arr.length >= MAX_BUCKET) { arr.overflow = true; return; }
      arr.push(node);
    }
    // частоты токенов содержимого: блокируемся по самым редким — так находятся пары
    // с разным названием, но одинаковым текстом
    var bodyFreq = {};
    nodes.forEach(function (n) {
      var toks = n._dupProfile.bodyTokens || [];
      for (var i = 0; i < toks.length; i++) bodyFreq[toks[i]] = (bodyFreq[toks[i]] || 0) + 1;
    });
    nodes.forEach(function (n) {
      var p = n._dupProfile;
      var pre = n.type + "\u0000";
      push(pre + "t\u0000" + p.titleNorm, n);
      push(pre + "z\u0000" + p.zhNorm, n);
      if (p.bodyLen >= 80) push(pre + "b\u0000" + p.body, n);
      var seenTok = {};
      (p.titleTokens || []).forEach(function (t) {
        if (seenTok[t]) return;
        seenTok[t] = true;
        if (t.length < 2) return;
        if (DUP_STOP[t]) return;
        push(pre + "tok\u0000" + t, n);
      });
      // китайские названия блокируем по биграммам: одиночный иероглиф («空», «间»)
      // встречается в половине заголовков и даёт тысячи пар, а биграмма точна
      var zhWords = String(p.zhNorm || "").split(" ");
      for (var zw = 0; zw < zhWords.length; zw++) {
        var w = zhWords[zw];
        if (!w) continue;
        if (/^[a-z0-9]+$/.test(w)) {
          if (w.length >= 2 && !DUP_STOP[w] && !seenTok[w]) { seenTok[w] = true; push(pre + "tok\u0000" + w, n); }
          continue;
        }
        for (var zc = 0; zc + 1 < w.length; zc++) {
          var bg = w.charAt(zc) + w.charAt(zc + 1);
          if (!/[\u4e00-\u9fff]/.test(bg)) continue;
          var k = "zbg\u0000" + bg;
          if (seenTok[k]) continue;
          seenTok[k] = true;
          push(pre + k, n);
        }
      }
      (p.kwSet || []).forEach(function (k) { push(pre + "kw\u0000" + k, n); });
      if (n.parent) push(pre + "par\u0000" + n.parent, n);
      var rare = (p.bodyTokens || []).slice().sort(function (x, y) {
        return (bodyFreq[x] || 0) - (bodyFreq[y] || 0);
      }).slice(0, 2);
      rare.forEach(function (t) { push(pre + "rare\u0000" + t, n); });
    });
    var pairKeys = {};
    var pairs = [];
    function addPair(a, b) {
      if (!a || !b || a.id === b.id) return;
      var ka = a.id < b.id ? a.id + "\u0000" + b.id : b.id + "\u0000" + a.id;
      if (pairKeys[ka]) return;
      pairKeys[ka] = true;
      pairs.push([a, b]);
    }
    Object.keys(buckets).forEach(function (k) {
      var arr = buckets[k];
      if (!arr || arr.length < 2 || arr.overflow) return;
      for (var i = 0; i < arr.length; i++)
        for (var j = i + 1; j < arr.length; j++) addPair(arr[i], arr[j]);
    });
    var parent = {}, rank = {}, matchInfo = {};
    nodes.forEach(function (n) { parent[n.id] = n.id; rank[n.id] = 0; });
    function find(x) {
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    }
    function union(a, b) {
      var ra = find(a), rb = find(b);
      if (ra === rb) return;
      if (rank[ra] < rank[rb]) parent[ra] = rb;
      else if (rank[rb] < rank[ra]) parent[rb] = ra;
      else { parent[rb] = ra; rank[ra]++; }
    }
    pairs.forEach(function (pair) {
      var a = pair[0], b = pair[1];
      var sc = duplicateScore(a, b, cfg);
      if (!sc.match) return;
      var key = a.id < b.id ? a.id + "\u0000" + b.id : b.id + "\u0000" + a.id;
      matchInfo[key] = sc;
      union(a.id, b.id);
    });
    var groupsByRoot = {};
    nodes.forEach(function (n) {
      var r = find(n.id);
      (groupsByRoot[r] || (groupsByRoot[r] = [])).push(n);
    });
    var groups = [];
    Object.keys(groupsByRoot).forEach(function (r) {
      var arr = groupsByRoot[r];
      if (!arr || arr.length < 2) return;
      var keep = pickDuplicateKeeper(arr);
      var drop = arr.filter(function (n) { return n.id !== keep.id; }).sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; });
      var reasons = {};
      var maxScore = 0, maxContent = 0, maxTitle = 0, maxContain = 0;
      var hasSameTitle = false, hasSameBody = false;
      drop.forEach(function (n) {
        var key = keep.id < n.id ? keep.id + "\u0000" + n.id : n.id + "\u0000" + keep.id;
        var info = matchInfo[key] || duplicateScore(keep, n, cfg);
        n.duplicateOf = keep.id;
        n.duplicateReasons = info.reasons.slice();
        keep.duplicateReasons = keep.duplicateReasons.concat(info.reasons);
        info.reasons.forEach(function (x) { reasons[x] = true; });
        if (info.score > maxScore) maxScore = info.score;
        if (info.contentScore > maxContent) maxContent = info.contentScore;
        if ((info.titleSim || 0) > maxTitle) maxTitle = info.titleSim;
        if ((info.containment || 0) > maxContain) maxContain = info.containment;
        if (info.reasons.indexOf("same-title") >= 0) hasSameTitle = true;
        if (info.reasons.indexOf("same-content") >= 0) hasSameBody = true;
      });
      keep.duplicateGroup = keep.id;
      keep.duplicateOf = null;
      arr.forEach(function (n) { n.duplicateGroup = keep.id; });
      groups.push({
        id: keep.id,
        keep: keep,
        drop: drop,
        nodes: arr.slice().sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; }),
        reasons: Object.keys(reasons).sort(),
        score: Math.round(maxScore * 1000) / 1000,
        contentScore: Math.round(maxContent * 1000) / 1000,
        titleSim: Math.round(maxTitle * 1000) / 1000,
        containment: Math.round(maxContain * 1000) / 1000,
        confidence: dupConfidenceOf(maxScore, hasSameTitle, hasSameBody),
      });
    });
    groups.sort(function (a, b) {
      if (b.nodes.length !== a.nodes.length) return b.nodes.length - a.nodes.length;
      if (b.score !== a.score) return b.score - a.score;
      return a.keep.path < b.keep.path ? -1 : a.keep.path > b.keep.path ? 1 : 0;
    });
    if (graph) {
      graph.duplicateGroups = groups;
      if (graph.stats) {
        graph.stats.duplicateGroups = groups.length;
        graph.stats.duplicateNodes = groups.reduce(function (sum, g) { return sum + g.nodes.length; }, 0);
      }
    }
    return groups;
  }

  function listAliases(v) {
    if (v === undefined || v === null || v === "") return [];
    if (Object.prototype.toString.call(v) === "[object Array]") return v.map(function (x) { return String(x).trim(); }).filter(Boolean);
    return [String(v).trim()].filter(Boolean);
  }

  function mergeTagList(into, v) {
    var seen = into._seen || (into._seen = {});
    var add = function (x) {
      var t = String(x == null ? "" : x).trim().replace(/^#+/, "").trim();
      if (!t || seen[t.toLowerCase()]) return;
      seen[t.toLowerCase()] = true;
      into.push(t);
    };
    if (Object.prototype.toString.call(v) === "[object Array]") v.forEach(add);
    else if (v !== undefined && v !== null && v !== "") String(v).split(/[,;\s]+/).forEach(add);
    return into;
  }

  function mergedNodePatch(keep, dropNodes, opts) {
    var cfg = merge(DEFAULTS, opts || {});
    var arr = (dropNodes || []).filter(Boolean);
    var aliases = {};
    var altNames = [];
    listAliases(keep && keep.data ? keep.data.aliases : []).concat([keep && keep.id, keep && keep.stem]).forEach(function (x) { if (x) aliases[x] = true; });
    var tags = [];
    if (keep && keep.data) mergeTagList(tags, keep.data.tags);
    var keywords = {};
    var patch = {};
    var order = [];
    function takeKeyword(node) {
      parseKeywords(node && node.data ? node.data[cfg.keywordsKey] : (node && node.keywords) || [], node && node.data ? node.data[cfg.keywordsAltKey] : null).forEach(function (k) {
        var nk = normPhrase(k);
        if (!nk || keywords[nk]) return;
        keywords[nk] = k;
        order.push(k);
      });
    }
    takeKeyword(keep);
    var status = (keep && keep.status) || (keep && keep.data && keep.data.status) || "";
    var name = keep && keep.name ? keep.name : "";
    var zh = keep && keep.nameZh ? keep.nameZh : "";
    var chapter = keep && keep.chapter ? keep.chapter : null;
    var parent = keep && keep.parent ? keep.parent : null;
    var sizeRaw = keep && keep.sizeRaw ? keep.sizeRaw : null;
    var colorProp = keep && keep.colorProp ? keep.colorProp : null;
    var caption = keep && keep.caption ? keep.caption : null;
    arr.forEach(function (n) {
      listAliases(n && n.data ? n.data.aliases : []).concat([n.id, n.stem]).forEach(function (x) { if (x) aliases[x] = true; });
      // альтернативные названия дублей — в aliases, чтобы заметка находилась по любому из них
      if (n.name && n.name !== (keep && keep.name) && !aliases[n.name]) { aliases[n.name] = true; altNames.push(n.name); }
      if (n.nameZh && n.nameZh !== (keep && keep.nameZh) && !aliases[n.nameZh]) { aliases[n.nameZh] = true; altNames.push(n.nameZh); }
      if (n.data) mergeTagList(tags, n.data.tags);
      takeKeyword(n);
      if ((!name || /^untitled$/i.test(name)) && n.name) name = n.name;
      if (!zh && n.nameZh) zh = n.nameZh;
      if ((!status || status === cfg.placeholderValue) && n.status && n.status !== cfg.placeholderValue) status = n.status;
      if (!chapter && n.chapter) chapter = n.chapter;
      if (!parent && n.parent) parent = n.parent;
      if (!sizeRaw && n.sizeRaw) sizeRaw = n.sizeRaw;
      if (!colorProp && n.colorProp) colorProp = n.colorProp;
      if (!caption && n.caption) caption = n.caption;
    });
    patch.aliases = Object.keys(aliases).sort();
    if (tags.length) patch.tags = tags.slice().sort(function (a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : 1; });
    patch[cfg.keywordsKey || "keywords_en"] = order.length ? order.join("; ") : "";
    patch[cfg.weightKey || "weight"] = "";
    if (name) patch[cfg.nameKey || "name"] = name;
    if (zh) patch[cfg.nameZhKey || "name_zh"] = zh;
    if (status) patch[cfg.statusKey || "status"] = status;
    if (chapter) patch[cfg.chapterKey || "chapter"] = chapter;
    if (parent) patch[cfg.parentKey || "parent"] = parent;
    if (sizeRaw) patch[cfg.sizeKey || "size"] = sizeRaw;
    if (colorProp) patch[cfg.colorKey || "color"] = colorProp;
    if (caption) patch[cfg.captionKey || "caption"] = caption;
    return patch;
  }

  function rewriteAnchorIds(text, anchorMap) {
    var out = String(text == null ? "" : text);
    Object.keys(anchorMap || {}).forEach(function (oldId) {
      var newId = anchorMap[oldId];
      if (!newId || newId === oldId) return;
      var escId = oldId.replace(/[.*+?^${}()|[\]\\]/g, "\$&");
      out = out.replace(new RegExp("(\\[\\[#\\^)" + escId + "(\\]\\])", "g"), "$1" + newId + "$2");
      out = out.replace(new RegExp("(\\[\\[[^\\]#|]+#\\^)" + escId + "((?:\\|[^\\]]*)?\\]\\])", "g"), "$1" + newId + "$2");
      out = out.replace(new RegExp("(^|[^A-Za-z0-9_\\-^])(\\^" + escId + "\\b)", "gm"), function (m, pre) {
        return pre + "^" + newId;
      });
    });
    return out;
  }

  function renameAnchorsForMerge(baseBody, incomingBody, nodeId) {
    var used = {};
    extractAnchors(baseBody).forEach(function (a) { used[a.id] = true; });
    var out = String(incomingBody == null ? "" : incomingBody);
    var map = {};
    extractAnchors(out).forEach(function (a) {
      if (!used[a.id]) { used[a.id] = true; return; }
      var stem = String(nodeId || "dup").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "dup";
      var next = a.id + "-" + stem;
      var idx = 2;
      while (used[next]) { next = a.id + "-" + stem + "-" + idx; idx++; }
      used[next] = true;
      map[a.id] = next;
    });
    if (Object.keys(map).length) out = rewriteAnchorIds(out, map);
    return { text: out, anchorMap: map };
  }

  function splitMergeParagraphs(text) {
    var chunks = String(text == null ? "" : text).replace(/\r\n/g, "\n").split(/\n\s*\n/);
    var out = [];
    chunks.forEach(function (c) {
      var t = String(c || "").replace(/^\s+|\s+$/g, "");
      if (!t) return;
      var lines = t.split("\n");
      var isList = lines.length > 1 && lines.every(function (l) { return /^\s*(?:[-*+]|\d+\.)\s+\S/.test(l) || !l.trim(); });
      if (isList) {
        lines.forEach(function (l) {
          var s = l.replace(/^\s+|\s+$/g, "");
          if (s) out.push(s);
        });
        return;
      }
      out.push(t);
    });
    return out;
  }

  function paraTokensLower(norm) {
    var parts = String(norm || "").toLowerCase().match(/[a-z0-9]+|[\u4e00-\u9fff]/g) || [];
    var seen = {}, out = [];
    for (var i = 0; i < parts.length; i++) {
      if (seen[parts[i]]) continue;
      seen[parts[i]] = true;
      out.push(parts[i]);
    }
    return out;
  }

  function paraSimilarity(aNorm, bNorm) {
    if (!aNorm || !bNorm) return 0;
    if (aNorm === bNorm) return 1;
    var st = dupSetStats(paraTokensLower(aNorm), paraTokensLower(bNorm));
    if (st.jaccard >= 0.92) return st.jaccard;
    var maxLen = Math.max(aNorm.length, bNorm.length);
    if (maxLen > 400) return st.jaccard;
    var limit = Math.floor(maxLen * 0.2) + 1;
    var d = levDist(aNorm.toLowerCase(), bNorm.toLowerCase(), limit);
    var c = d <= limit ? 1 - d / maxLen : 0;
    return Math.max(st.jaccard, c);
  }

  function mergeNodeBodies(keep, drop, opts) {
    var base = splitKeywordRegion((keep && keep.body) || "").outside.replace(/\s+$/g, "");
    var manual = !!(opts && opts.manualMerge);
    var add = mergeBodyCore(drop, { preserveRelated: manual });
    var emptyBase = base ? base + "\n" : "";
    if (!add) return { body: emptyBase, anchorMap: {}, appended: false, kept: 0, skipped: 0 };
    var ren = renameAnchorsForMerge(base, add, drop && drop.id);
    add = ren.text.replace(/\s+$/g, "");
    var baseNorm = dupNormText(base);
    var addNorm = dupNormText(add);
    if (!addNorm) return { body: emptyBase, anchorMap: ren.anchorMap, appended: false, kept: 0, skipped: 0 };
    if (baseNorm === addNorm || (addNorm && baseNorm.indexOf(addNorm) >= 0)) {
      return { body: emptyBase, anchorMap: ren.anchorMap, appended: false, kept: 0, skipped: 1 };
    }
    // поабзацно: переносим только то, чего ещё нет в keeper (списки — по пунктам)
    var baseParas = splitMergeParagraphs(base).map(function (p) { return { text: p, norm: dupNormText(p) }; });
    var baseExact = {};
    baseParas.forEach(function (p) { if (p.norm) baseExact[p.norm] = true; });
    var incoming = splitMergeParagraphs(add);
    var fresh = [];
    var skipped = 0;
    incoming.forEach(function (p) {
      var norm = dupNormText(p);
      if (!norm) return;
      if (baseExact[norm]) { skipped++; return; }
      for (var i = 0; i < baseParas.length; i++) {
        if (!baseParas[i].norm) continue;
        if (paraSimilarity(baseParas[i].norm, norm) >= 0.92) { skipped++; return; }
      }
      baseExact[norm] = true;
      baseParas.push({ text: p, norm: norm });
      fresh.push(p);
    });
    if (!fresh.length) return { body: emptyBase, anchorMap: ren.anchorMap, appended: false, kept: 0, skipped: skipped };
    var block = (manual ? "## Material merged manually from " : "## Duplicate material merged from ") +
      ((drop && drop.id) || (manual ? "node" : "duplicate")) +
      "\n\n> " + (manual ? "merged manually from note \"" : "merged automatically from duplicate note \"") +
      sanitizeLabel((drop && (drop.name || drop.stem)) || (manual ? "node" : "duplicate")) +
      "\" (`" + String((drop && drop.path) || "") + "`).\n\n" + fresh.join("\n\n");
    return { body: (base ? base + "\n\n" : "") + block.replace(/\s+$/g, "") + "\n", anchorMap: ren.anchorMap, appended: true, kept: fresh.length, skipped: skipped };
  }

  function retargetLinks(text, replacements, opts) {
    var src = String(text == null ? "" : text).replace(/\r\n/g, "\n");
    var list = (replacements || []).filter(Boolean);
    if (!list.length || src.indexOf("[[") < 0) return { text: src, changed: false, replaced: 0, removed: 0 };
    var current = opts && opts.currentNode ? opts.currentNode : null;
    var lines = src.split("\n");
    var out = [];
    var changed = false, replaced = 0, removed = 0;
    function match(link) {
      for (var i = 0; i < list.length; i++) {
        var rep = list[i];
        if (rep.from && linkTargetsNode(link, rep.from, opts && opts.graph)) return rep;
      }
      return null;
    }
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      if (line.indexOf("[[") < 0) { out.push(line); continue; }
      var links = extractLinks(line, { stripCode: false }).filter(function (l) {
        var ticks = (line.slice(0, l.index).match(/`/g) || []).length;
        return ticks % 2 === 0;
      });
      if (!links.length) { out.push(line); continue; }
      var pos = 0;
      var pieces = [];
      var localChanged = false;
      for (var x = 0; x < links.length; x++) {
        var l = links[x];
        var rep = match(l);
        pieces.push(line.slice(pos, l.index));
        pos = l.index + l.raw.length;
        if (!rep) { pieces.push(l.raw); continue; }
        var to = rep.to;
        var anchor = l.anchor ? "#" + l.anchor : l.blockId ? "#^" + ((rep.anchorMap && rep.anchorMap[l.blockId]) || l.blockId) : "";
        var pointsToSelf = current && to && noteKeyMatch(to.path, current) && !anchor;
        if (pointsToSelf && !(opts && opts.keepSelfLinks)) {
          pieces.push(l.hasAlias && l.alias ? l.alias : sanitizeLabel(to.name || to.stem));
          removed++;
        } else {
          var raw = (l.linkType === "embed" ? "!" : "") + "[[" + to.stem + anchor + (l.hasAlias ? "|" + (l.alias || "") : "") + "]]";
          pieces.push(raw);
          replaced++;
        }
        localChanged = true;
      }
      pieces.push(line.slice(pos));
      var merged = pieces.join("").replace(/[ \t]{2,}/g, " " ).replace(/[ \t]+$/g, "");
      out.push(merged);
      if (localChanged && merged !== line) changed = true;
    }
    var textOut = out.join("\n");
    return { text: changed ? textOut : src, changed: changed, replaced: replaced, removed: removed };
  }

  function planNodeMerge(graph, ids, opts) {
    var cfg = merge(DEFAULTS, opts || {});
    var byId = (graph && graph._byId) || {};
    var list = [];
    if (ids && ids.keep && ids.drop) list = [ids.keep].concat(ids.drop);
    else if (Object.prototype.toString.call(ids) === "[object Array]") list = ids;
    else if (ids) list = [ids];
    list = list.map(function (x) { return typeof x === "string" ? byId[x] : x; }).filter(Boolean);
    if (list.length < 2) return { keep: null, drop: [], refs: [], children: [], targets: [], files: 0 };
    var keep = ids && ids.keep ? (typeof ids.keep === "string" ? byId[ids.keep] : ids.keep) : pickDuplicateKeeper(list);
    var drop = list.filter(function (n) { return n && keep && n.id !== keep.id; });
    var targets = drop.slice();
    ((graph && graph.nodes) || []).forEach(function (n) {
      if (!n || !n.inline) return;
      if (drop.some(function (d) { return d.path === n.path; })) targets.push(n);
    });
    var refs = [];
    ((graph && graph.nodes) || []).forEach(function (n) {
      if (!n || n.inline) return;
      var links = (n.links || []).filter(function (l) {
        return targets.some(function (t) { return linkTargetsNode(l, t, graph); });
      });
      if (!links.length) return;
      refs.push({ id: n.id, path: n.path, type: n.type, name: n.name, links: links.length });
    });
    var dropIds = {};
    drop.forEach(function (n) { dropIds[n.id] = true; });
    var children = ((graph && graph.nodes) || []).filter(function (n) {
      return n && !n.inline && dropIds[n.parent];
    }).map(function (n) {
      return { id: n.id, path: n.path, type: n.type, name: n.name, parent: n.parent, chapter: n.chapter };
    });
    var warnings = [];
    if (children.length) warnings.push("Детей будет перевешено на keeper: " + children.length);
    var refLinks = refs.reduce(function (s, r) { return s + (r.links || 0); }, 0);
    if (refs.length > 10 || refLinks > 25) warnings.push("Много входящих ссылок будет переписано: " + refLinks + " в " + refs.length + " заметках");
    var diffParent = drop.some(function (n) { return (n.parent || "") !== (keep.parent || ""); });
    if (diffParent) warnings.push("Родители различаются — уцелеет parent keeper «" + (keep.parent || "—") + "»");
    var keepHome = keep.chapter || (keep.type === "chapter" ? keep.id : "");
    var diffChapter = drop.some(function (n) {
      var h = n.chapter || (n.type === "chapter" ? n.id : "");
      return h !== keepHome;
    });
    if (diffChapter) warnings.push("Главы различаются — уцелеет глава keeper «" + (keepHome || "—") + "»");
    var capKeep = keep.caption || "";
    if (capKeep && drop.some(function (n) { return n.caption && n.caption !== capKeep; })) {
      warnings.push("Caption есть у нескольких вершин — тексты сообщений будут объединены");
    }
    return {
      keep: keep,
      drop: drop,
      refs: refs,
      children: children,
      targets: targets,
      files: 1 + refs.length + children.length + drop.length,
      warnings: warnings,
      patch: mergedNodePatch(keep, drop, cfg),
    };
  }

  /* ------------------------------------------------- создание узлов из вида */

  var RELATED_TYPE_LABEL = { chapter: "глава", section: "секция", heading: "заголовок", block: "блок" };

  /**
   * Второй ярус «семантического» поиска рядом с корпусом аннотаций: темы, чьё имя
   * (или имя файла) ТОЧНО совпало с одной из фраз — регистр и пробелы не важны.
   * Корпус ищет вхождения в текстах аннотаций и потому видит только секции и
   * заголовки; здесь же находятся и главы, и блоки, чьи имена пользователь назвал
   * тегом в явном виде. Возвращает [{node, phrase}] — сначала крупные уровни,
   * внутри уровня — более связанные (больше входящих ссылок).
   */
  function relatedByName(graph, phrases, opts) {
    var o = opts || {};
    var limit = o.limit === undefined ? 12 : o.limit;
    var exclude = {};
    (o.exclude || []).forEach(function (id) {
      if (id) exclude[id] = true;
    });
    var want = {};
    (phrases || []).forEach(function (p) {
      var k = normPhrase(p);
      if (k && !want[k]) want[k] = String(p).trim();
    });
    if (!Object.keys(want).length || !graph) return [];
    var rank = { chapter: 0, section: 1, heading: 2, block: 3 };
    var out = [];
    (graph.nodes || []).forEach(function (n) {
      if (!n || n.inline || exclude[n.id]) return;
      var keys = [normPhrase(n.name), normPhrase(n.stem)];
      var phrase = null;
      for (var k in want) {
        if (keys.indexOf(k) >= 0) {
          phrase = want[k];
          break;
        }
      }
      if (phrase === null) return;
      out.push({ node: n, phrase: phrase });
    });
    out.sort(function (a, b) {
      var ra = rank[a.node.type] === undefined ? 9 : rank[a.node.type];
      var rb = rank[b.node.type] === undefined ? 9 : rank[b.node.type];
      if (ra !== rb) return ra - rb;
      var da = a.node.degree || 0;
      var db = b.node.degree || 0;
      if (da !== db) return db - da;
      return a.node.id < b.node.id ? -1 : 1;
    });
    return out.slice(0, Math.max(0, limit));
  }

  /**
   * Свободный id для новой вершины. С родителем — по конвенции курса: id родителя +
   * суффикс уровня (S/H/B) с номером на единицу больше существующих. Без родителя —
   * серия MN-01, MN-02, … («manual node»): такие коды не пересекаются с генерируемыми
   * ChNN-… и сразу видно, что вершина добавлена руками.
   */
  function nextNodeId(graph, type, parent) {
    var nodes = (graph && graph.nodes) || [];
    var byId = (graph && graph._byId) || {};
    var pad = function (n) {
      return (n < 10 ? "0" : "") + n;
    };
    var maxMatch = function (re) {
      var max = 0;
      nodes.forEach(function (n) {
        var m = re.exec(String((n && n.id) || ""));
        if (m) max = Math.max(max, parseInt(m[1], 10));
      });
      return max;
    };
    if (type === "chapter") return "Ch" + pad(maxMatch(/^Ch(\d+)$/) + 1);
    if (parent) {
      var suffix = { section: "S", heading: "H", block: "B" }[type] || "N";
      var base = String(parent).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      var num = maxMatch(new RegExp("^" + base + "-" + suffix + "(\\d+)$")) + 1;
      return String(parent) + "-" + suffix + pad(num);
    }
    var i = 1;
    while (byId["MN-" + pad(i)]) i++;
    return "MN-" + pad(i);
  }

  /**
   * Текст новой заметки-вершины целиком: frontmatter по конвенциям курса (простые
   * значения — без кавычек, как в остальных заметках хранилища; строки с пробелами
   * и пунктуацией — в кавычках, как их же читает parseScalar), тело с двумя строками
   * подписи, материализованным регионом ключевых фраз и разделом «Related topics»
   * для совпадений по названиям. Corpus-связи живут только в `region`: это все
   * конкретные совпавшие секции/заголовки, а глава-лидер не создаёт отдельной ссылки.
   * Чистая функция — её и проверяют юнит-тесты.
   */
  function composeNote(spec, opts) {
    var cfg = merge(DEFAULTS, opts || {});
    var s = spec || {};
    var type = TYPES.indexOf(s.type) >= 0 ? s.type : "block";
    var name = String(s.name || "").trim() || "Untitled";
    var bare = /^[-A-Za-z0-9_]+$/;
    var scalar = function (v) {
      if (typeof v === "number") return String(v);
      if (Object.prototype.toString.call(v) === "[object Array]") return "[" + v.map(quoteYaml).join(", ") + "]";
      var str = String(v == null ? "" : v);
      return bare.test(str) ? str : quoteYaml(str);
    };
    var fm = [];
    fm.push([cfg.typeKey, type]);
    if (s.id) fm.push(["id", String(s.id)]);
    fm.push([cfg.nameKey, name]);
    if (s.nameZh) fm.push([cfg.nameZhKey, String(s.nameZh)]);
    if (s.id) fm.push(["aliases", [String(s.id)]]);
    fm.push(["status", s.status || "draft"]);
    if (s.parent) fm.push(["parent", String(s.parent)]);
    if (s.chapter) fm.push(["chapter", String(s.chapter)]);
    // свой цвет вершины: пишется только валидным hex, иначе вершина красится как обычно
    // (цветом главы или типом) — мусор из окна создания в frontmatter не попадает
    if (s.color && isHexColor(s.color)) fm.push([cfg.colorKey, normalizeHexColor(s.color)]);
    if (s.keywords && s.keywords.length) fm.push([cfg.keywordsKey, s.keywords.join("; ")]);
    if (s.weight !== null && s.weight !== undefined) fm.push([cfg.weightKey, s.weight]);
    fm.push(["cssclasses", ["lg-node", "lg-node--" + type]]);
    var out = "---\n" + fm.map(function (kv) { return kv[0] + ": " + scalar(kv[1]); }).join("\n") + "\n---\n";
    var body = ["# " + name];
    if (s.nameZh) body.push("", "**" + String(s.nameZh) + "**");
    body.push(
      "",
      String(s.intro || "Узел создан из окна графа. Замените этот абзац содержимым: что это, на что опирается, где используется.")
    );
    var related = s.related || [];
    if (related.length) {
      body.push("", RELATED_HEADING, "");
      related.forEach(function (r) {
        var label = RELATED_TYPE_LABEL[r.type] || "вершина";
        body.push("- [[" + r.stem + "|" + r.phrase + "]] — " + label + (r.name && r.name !== r.phrase ? " «" + r.name + "»" : ""));
      });
    }
    // регион ключевых фраз — всегда ПОСЛЕДНИМ блоком тела: материализатор
    // (applyKeywordRegion) пишет его в конец, и повторный пересчёт не двигает его
    var region = String(s.region || "").replace(/\s+$/g, "");
    if (region) body.push("", region);
    return out + "\n" + body.join("\n").replace(/\s+$/g, "") + "\n";
  }

  /* ------------------------------------------------- удаление вершин */

  /**
   * Совпадает ли имя цели ссылки с вершиной: по stem (имя файла без .md), по id или
   * по пути — те же четыре варианта, что перебирает resolve() в buildGraph.
   */
  function noteKeyMatch(path, node) {
    if (!node) return false;
    var s = String(path == null ? "" : path).replace(/\\/g, "/").replace(/^\.\//, "").trim().toLowerCase();
    if (!s) return false;
    var noExt = s.replace(/\.md$/i, "");
    var base = String(node.path == null ? "" : node.path).split("/").pop();
    var cands = [node.stem, node.id, node.path, String(node.path == null ? "" : node.path).replace(/\.md$/i, ""),
      base, String(base).replace(/\.md$/i, "")];
    for (var i = 0; i < cands.length; i++) {
      var c = String(cands[i] == null ? "" : cands[i]).trim().toLowerCase();
      if (!c) continue;
      if (noExt === c || noExt === c.replace(/\.md$/i, "")) return true;
    }
    return false;
  }

  /**
   * Ведёт ли ссылка ровно на эту вершину. Ссылка с блочным якорем (`[[Заметка#^id]]`)
   * ведёт на инлайн-вершину, а не на саму заметку, поэтому для обычной вершины такие
   * ссылки не считаются её ссылками, а для инлайн-блока — наоборот, только они.
   */
  function linkTargetsNode(link, node, graph) {
    if (!link || !node) return false;
    var p = String(link.path == null ? "" : link.path).replace(/\\/g, "/").trim();
    if (node.inline) {
      if (!link.blockId) return false;
      if (String(node.anchorName) !== String(link.blockId)) return false;
      var owner = (graph && graph._byId && graph._byId[node.parent]) ||
        { stem: node.stem, path: node.path, id: node.parent };
      return noteKeyMatch(p, owner);
    }
    if (link.blockId) return false; // это ссылка на блок внутри заметки, а не на заметку
    return noteKeyMatch(p, node);
  }

  /** Свойство caption: указывает на удаляемую вершину (на неё ссылается сообщение). */
  function captionPointsTo(node, target) {
    if (!node || !target) return false;
    var t = String(node.caption == null ? "" : node.caption).trim();
    if (!t) return false;
    return noteKeyMatch(t.replace(/^\[\[/, "").replace(/\]\]$/, ""), target);
  }

  /**
   * Убирает из текста ссылки на удаляемые вершины (targets — сама вершина и её
   * инлайн-блоки, если заметка удаляется целиком):
   *   * пункт списка, который НАЧИНАЕТСЯ со ссылки на удаляемую вершину, уходит
   *     целиком: так устроены машинные пункты — регион ключевых фраз и раздел
   *     «Related topics» — они существуют только ради ссылки;
   *   * ссылка внутри фразы превращается в свой видимый текст (псевдоним, иначе имя
   *     вершины) — мысль в тексте остаётся, битой ссылки не остаётся;
   *   * врезка `![[…]]` исчезает (вставлять больше нечего).
   * Ссылки внутри `инлайн-кода` не трогаются: для Obsidian это не ссылка.
   */
  function stripTargetRefs(text, targets, res, graph) {
    var lines = String(text == null ? "" : text).replace(/\r\n/g, "\n").split("\n");
    var out = [];
    var isTarget = function (l) {
      return targets.some(function (t) {
        return linkTargetsNode(l, t, graph);
      });
    };
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf("[[") < 0) {
        out.push(line);
        continue;
      }
      var links = extractLinks(line, { stripCode: false }).filter(function (l) {
        var ticks = (line.slice(0, l.index).match(/`/g) || []).length;
        return ticks % 2 === 0;
      });
      var hits = links.filter(isTarget);
      if (!hits.length) {
        out.push(line);
        continue;
      }
      var bm = /^(\s*(?:[-*+]|\d+\.)\s+)(.*)$/.exec(line);
      if (bm && isTarget(links[0]) && bm[2].replace(/^[\s*_>]+/, "").indexOf(links[0].raw) === 0) {
        res.removed += hits.length;
        continue; // пункт-обёртка ссылки исчезает целиком
      }
      var pieces = [];
      var pos = 0;
      links.forEach(function (l) {
        pieces.push(line.slice(pos, l.index));
        pos = l.index + l.raw.length;
        if (!isTarget(l)) {
          pieces.push(l.raw);
          return;
        }
        res.removed++;
        if (l.linkType === "embed") return;
        var t = targets.filter(function (x) {
          return linkTargetsNode(l, x, graph);
        })[0];
        pieces.push(l.hasAlias && l.alias ? l.alias : sanitizeLabel((t && t.name) || l.path));
      });
      pieces.push(line.slice(pos));
      out.push(pieces.join("").replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/, ""));
    }
    return out.join("\n");
  }

  /**
   * Удаляет раздел целиком, если в нём не осталось ничего, кроме пустых строк
   * (и служебных `---`/`^якорей`). Так уходит «## Related topics» после снятия
   * последней ссылки — пустой заголовок в заметке не нужен.
   */
  function dropEmptySection(text, heading) {
    var lines = String(text == null ? "" : text).replace(/\r\n/g, "\n").split("\n");
    var low = String(heading || "").toLowerCase();
    var dropped = 0;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim().toLowerCase() !== low) continue;
      var end = lines.length;
      for (var j = i + 1; j < lines.length; j++) {
        if (/^#{1,6}\s/.test(lines[j])) {
          end = j;
          break;
        }
      }
      var empty = true;
      for (var k = i + 1; k < end; k++) {
        var t = lines[k].trim();
        if (t && t !== "---" && t !== "^" && !/^\^[A-Za-z0-9][\w-]*$/.test(t)) {
          empty = false;
          break;
        }
      }
      if (!empty) continue;
      lines.splice(i, end - i);
      while (i > 0 && i < lines.length && lines[i - 1].trim() === "" && lines[i].trim() === "") lines.splice(i, 1);
      while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
      dropped++;
      i--;
    }
    return { text: dropped ? lines.join("\n") + "\n" : String(text == null ? "" : text), dropped: dropped };
  }

  /**
   * Убирает из текста заметки всё, что указывает на удаляемые вершины, и возвращает
   * готовый новый текст: ссылки (см. stripTargetRefs), пустой раздел «Related topics»,
   * пересчитанный `weight:` — по оставшимся ссылкам региона ключевых фраз, — а если
   * ссылок в регионе не осталось, то и сам регион вместе со свойством.
   * Если упоминаний не было, текст возвращается БАЙТ-В-БАЙТ: удаление идемпотентно.
   * Возвращает {text, removed, weight, regionGone, dropped, changed}.
   */
  function stripDeletedRefs(text, targets, opts) {
    var cfg = merge(DEFAULTS, opts || {});
    var list = (Object.prototype.toString.call(targets) === "[object Array]" ? targets : [targets]).filter(Boolean);
    var src = String(text == null ? "" : text).replace(/\r\n/g, "\n");
    var res = { text: src, removed: 0, weight: null, regionGone: false, dropped: 0, changed: false };
    if (!list.length) return res;
    var parsed = parseFrontmatter(src);
    var cut = splitKeywordRegion(parsed.body);
    // Регион обрабатывается ДО раннего выхода: ссылка может жить только в нём (частый
    // случай — блок связан с вершиной исключительно по ключевым фразам).
    var outside = stripTargetRefs(cut.outside, list, res);
    var region = cut.region === null ? null : stripTargetRefs(cut.region, list, res);
    // оба машинных раздела пустыми не остаются: и «Related topics» (совпадения по
    // названию), и «Related chapters» (главы по ключевым фразам) существуют только
    // ради своих ссылок — без них заголовок в заметке не нужен
    [RELATED_HEADING, CHAPTER_HEADING].forEach(function (h) {
      var drop = dropEmptySection(outside, h);
      outside = drop.text;
      res.dropped += drop.dropped;
    });
    if (!res.removed) return res; // ни одной ссылки не сняли — заметка не меняется
    var body;
    if (region === null) {
      body = outside;
    } else {
      var left = extractLinks(region);
      res.weight = left.reduce(function (sum, l) {
        var m = /\u00d7(\d+)\s*$/.exec(String(l.alias == null ? "" : l.alias));
        return sum + (m ? Math.max(1, Number(m[1])) : 1);
      }, 0);
      res.regionGone = !left.length;
      // итоговая строка региона — тоже текст вида «**Вес по ключевым фразам: 20**»:
      // число в ней обязано совпасть с пересчитанным weight: (иначе цифры расходятся)
      if (!res.regionGone) region = region.replace(/(\*\*\u0412\u0435\u0441 \u043f\u043e \u043a\u043b\u044e\u0447\u0435\u0432\u044b\u043c \u0444\u0440\u0430\u0437\u0430\u043c: )\d+/, "$1" + res.weight);
      // Маркеры возвращаем в том же обрамлении, в каком они были в заметке: applyKeywordRegion
      // работает с текстом, который уже включает keywords:begin/end.
      var endAt = parsed.body.indexOf(KW_END, cut.at);
      var inner = endAt < 0 ? "" : parsed.body.slice(cut.at + KW_BEGIN.length, endAt);
      var wrapped = res.regionGone ? "" : KW_BEGIN + (/^\s*/.exec(inner) || [""])[0] + region + (/\s*$/.exec(inner) || [""])[0] + KW_END;
      body = applyKeywordRegion(outside, wrapped);
    }
    var out = (parsed.hasFrontmatter ? parsed.raw : "") + body;
    if (cut.region !== null) {
      var patch = {};
      patch[cfg.weightKey || "weight"] = res.regionGone ? "" : res.weight;
      out = setFrontmatterValues(out, patch);
    }
    res.text = out;
    res.changed = out !== src;
    if (!res.changed) res.text = src;
    return res;
  }

  /**
   * Убирает блочный якорь `^id` — инлайн-вершина исчезает из графа, а текст абзаца
   * остаётся на месте: это удаление вершины, а не удаление фрагмента лекции.
   */
  function stripInlineAnchor(text, anchorId) {
    var src = String(text == null ? "" : text).replace(/\r\n/g, "\n");
    var id = String(anchorId == null ? "" : anchorId).replace(/^\^/, "").trim();
    if (!id || src.indexOf("^" + id) < 0) return src;
    var re = new RegExp("(^|[^A-Za-z0-9_\\-^])\\^" + id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[ \\t]*$");
    var lines = src.split("\n");
    var removed = 0;
    for (var i = 0; i < lines.length; i++) {
      var m = re.exec(lines[i]);
      if (!m) continue;
      lines[i] = lines[i].slice(0, m.index + m[1].length).replace(/[ \t]+$/, "");
      removed++;
      if (!lines[i].trim()) lines.splice(i, 1);
    }
    if (!removed) return src;
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
    return lines.join("\n") + "\n";
  }

  /**
   * Что именно затронет удаление вершины — план для окна подтверждения и для самой
   * операции. Чистая функция: считает по свежей модели графа, ничего не пишет.
   *   inline   — инлайн-блоки внутри удаляемой заметки (исчезнут вместе с текстом);
   *   children — заметки с `parent:` = id: их перевесим на родителя удаляемой вершины;
   *   refs     — заметки, ссылающиеся на удаляемую вершину (или её инлайн-блоки):
   *              ссылки будут сняты, а `weight:` пересчитан;
   *   targets  — список вершин, которые исчезают (сама вершина + её инлайн-блоки).
   */
  function planNodeDelete(graph, id, opts) {
    var byId = (graph && graph._byId) || {};
    var node = byId[id] || null;
    var plan = {
      id: id,
      node: node,
      parent: node ? node.parent || null : null,
      newParent: node ? node.parent || null : null,
      newChapter: node && node.type === "chapter" ? null : (node ? node.chapter || null : null),
      inline: [],
      children: [],
      refs: [],
      targets: [],
      inEdges: node ? (node.in || []).length : 0,
      outEdges: node ? (node.out || []).length : 0,
      edges: { keyword: 0, reference: 0, embed: 0, structure: 0 },
      files: 0,
    };
    if (!node) return plan;
    var nodes = (graph && graph.nodes) || [];
    plan.inline = nodes.filter(function (n) {
      return n.inline && n.path === node.path && n.id !== node.id;
    });
    plan.children = node.inline
      ? []
      : nodes.filter(function (n) {
          return !n.inline && n.id !== node.id && n.parent === node.id;
        });
    plan.targets = [node].concat(plan.inline);
    plan.refs = [];
    nodes.forEach(function (n) {
      if (n.inline || n.id === node.id) return;
      var links = (n.links || []).filter(function (l) {
        return plan.targets.some(function (t) {
          return linkTargetsNode(l, t, graph);
        });
      });
      var caption = plan.targets.some(function (t) {
        return captionPointsTo(n, t);
      });
      if (!links.length && !caption) return;
      var kinds = { keyword: 0, reference: 0, embed: 0 };
      links.forEach(function (l) {
        if (l.keyword) kinds.keyword++;
        else if (l.linkType === "embed") kinds.embed++;
        else kinds.reference++;
      });
      plan.refs.push({
        id: n.id,
        name: n.name,
        type: n.type,
        path: n.path,
        links: links.length,
        keyword: kinds.keyword,
        reference: kinds.reference,
        embed: kinds.embed,
        caption: caption,
      });
    });
    (node.in || []).forEach(function (e) {
      if (plan.edges[e.kind] !== undefined) plan.edges[e.kind] += e.weight || 1;
    });
    plan.refsTotal = plan.refs.reduce(function (s, r) { return s + r.links; }, 0);
    plan.files = plan.refs.length + plan.children.length + (node.inline ? 0 : 1);
    return plan;
  }

  return {
    TYPES: TYPES,
    DEFAULTS: DEFAULTS,
    parseFrontmatter: parseFrontmatter,
    setFrontmatterValues: setFrontmatterValues,
    extractLinks: extractLinks,
    extractAnchors: extractAnchors,
    stripCode: stripCode,
    stemOf: stemOf,
    keywordMarkers: keywordMarkers,
    sanitizeLabel: sanitizeLabel,
    readNote: readNote,
    buildGraph: buildGraph,
    normPhrase: normPhrase,
    parseKeywords: parseKeywords,
    countPhrase: countPhrase,
    parseAbstract: parseAbstract,
    buildKeywordCorpus: buildKeywordCorpus,
    planBlockKeywords: planBlockKeywords,
    keywordRegionText: keywordRegionText,
    splitKeywordRegion: splitKeywordRegion,
    applyKeywordRegion: applyKeywordRegion,
    applyRelatedChapters: applyRelatedChapters,
    chapterBullets: chapterBullets,
    appendManualLink: appendManualLink,
    appendBulletToSection: appendBulletToSection,
    RELATED_HEADING: RELATED_HEADING,
    CHAPTER_HEADING: CHAPTER_HEADING,
    radiusFor: radiusFor,
    initPositions: initPositions,
    buildTree: buildTree,
    assignRadialTargets: assignRadialTargets,
    computeLayout: computeLayout,
    frStep: frStep,
    smStep: smStep,
    twopiLayout: twopiLayout,
    seedBlobs: seedBlobs,
    polishNoOverlap: polishNoOverlap,
    countPairsOverlap: countPairsOverlap,
    wantDistance: wantDistance,
    tuneLayout: tuneLayout,
    step: step,
    run: run,
    bounds: bounds,
    labelLines: labelLines,
    applySizes: applySizes,
    sizeScale: sizeScale,
    wrapText: wrapText,
    toSVG: toSVG,
    arcPath: arcPath,
    edgePath: edgePath,
    clipLabel: clipLabel,
    fadeLabel: fadeLabel,
    labelFadeFrac: labelFadeFrac,
    labelBudgetUnits: labelBudgetUnits,
    LABEL_FADE_MIN: LABEL_FADE_MIN,
    textUnits: textUnits,
    labelShown: labelShown,
    labelThreshold: labelThreshold,
    labelRectOf: labelRectOf,
    clampWalls: clampWalls,
    clusterLayout: clusterLayout,
    placeClusters: placeClusters,
    packAroundAnchors: packAroundAnchors,
    resolveColors: resolveColors,
    isHexColor: isHexColor,
    normalizeHexColor: normalizeHexColor,
    toGraphJson: toGraphJson,
    toDot: toDot,
    toGraphML: toGraphML,
    toCsv: toCsv,
    toMarkdown: toMarkdown,
    toIndexMarkdown: toIndexMarkdown,
    homeChapterOf: homeChapterOf,
    neighborhood: neighborhood,
    components: components,
    filterNodes: filterNodes,
    findMergeCandidates: findMergeCandidates,
    findDuplicateGroups: findDuplicateGroups,
    duplicateScore: duplicateScore,
    pickDuplicateKeeper: pickDuplicateKeeper,
    mergedNodePatch: mergedNodePatch,
    mergeNodeBodies: mergeNodeBodies,
    retargetLinks: retargetLinks,
    relatedByName: relatedByName,
    relatedChapters: relatedChapters,
    nextNodeId: nextNodeId,
    composeNote: composeNote,
    noteKeyMatch: noteKeyMatch,
    linkTargetsNode: linkTargetsNode,
    captionPointsTo: captionPointsTo,
    stripDeletedRefs: stripDeletedRefs,
    stripInlineAnchor: stripInlineAnchor,
    dropEmptySection: dropEmptySection,
    planNodeDelete: planNodeDelete,
    planNodeMerge: planNodeMerge,
    dupNormTitle: dupNormTitle,
    dupTitleSim: dupTitleSim,
    splitMergeParagraphs: splitMergeParagraphs,
    mergeBodyCore: mergeBodyCore,
    duplicateProfile: duplicateProfile,
    esc: esc,
  };
});

  return module.exports;
})();
"use strict";
/*
 * lecture-graph — плагин Obsidian: интерактивный граф лекций.
 *   вершины: главы / секции / заголовки / блоки (заметки с frontmatter type:*)
 *   подпись: 2 строки — name (EN) и name_zh (перевод), редактируются на графе
 *   размер вершины = число ссылок на неё (для блоков с ключевыми фразами — число вхождений)
 * main.js собирается скриптом build.js: ядро graph-core.js инлайнится сюда.
 */
const obsidian = require("obsidian");
const core = __LG_CORE__;

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
/* Подпись, которая не влезла в свой бюджет, не обрезается многоточием, а плавно гаснет
   к правому краю (маска с линейным градиентом). Масок не по одной на вершину, а FADE_STEPS
   штук на весь граф: доля видимого текста округляется до ближайшей ступени и вершины
   переиспользуют общий <mask>. Иначе на 1017 вершинах в defs жило бы 1017 градиентов,
   которые пересчитывались бы на каждый зум. */
const FADE_STEPS = 12; // ступеней затухания (0.34…1 с шагом ~0.055)
const FADE_TAIL = 0.26; // какая доля ширины метки уходит под сам градиент (мягкость края)
// сколько ждём «устоявшегося» размера сцены при входе/выходе из полноэкранного режима:
// переход Chromium и перекладка Obsidian длятся сотни миллисекунд
const FULLSCREEN_SETTLE_MS = 450;

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
  // удаление вершины: подтверждение с разбором последствий и клавиша Delete/Backspace
  // (Backspace — потому что на macOS клавиши Delete нет, там удаление идёт по ним)
  confirmDelete: true,
  deleteKey: true,
  autoMergeDuplicates: true,
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

function replaceNoteBody(text, body) {
  var parsed = core.parseFrontmatter(text || "");
  var next = String(body == null ? "" : body);
  if (parsed.hasFrontmatter) return parsed.raw + (next ? (next.charAt(0) === "\n" ? next : "\n" + next) : "");
  return next;
}

function mergeLooseBodies(base, extra, title) {
  var a = String(base == null ? "" : base).replace(/\s+$/g, "");
  var b = String(extra == null ? "" : extra).replace(/\s+$/g, "");
  if (!b) return a ? a + "\n" : "";
  var na = b ? String(a).replace(/\s+/g, " " ).trim() : "";
  var nb = String(b).replace(/\s+/g, " " ).trim();
  if (!a) return b + "\n";
  if (!nb || na === nb || na.indexOf(nb) >= 0) return a + "\n";
  var head = title ? "## " + title.replace(/\s+/g, " " ).trim() : "## Merged duplicate note";
  return a + "\n\n" + head + "\n\n" + b + "\n";
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
    // размер окна/листа сменился — камера обязана следовать за сценой, иначе граф
    // останется центрированным по прежнему прямоугольнику (один fit на кадр максимум)
    this.registerDomEvent(window, "resize", () => this.scheduleRefit());
    // то же самое, но на уровне самой сцены: ловит и вход в полноэкранный режим
    // (прячутся панель и легенда), и раздвижку панелей Obsidian без изменения окна
    this.observeStage();
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
      // Delete (а на macOS это Backspace: там клавиши Delete нет) удаляет выделенную
      // вершину. В полях ввода и при открытом окне клавиша остаётся своей обычной ролью.
      if (this.plugin.settings.deleteKey !== false && (ev.key === "Delete" || ev.key === "Backspace")) {
        if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
        var t = ev.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ""))) return;
        if (!this.selected || this.plugin.deleting || (this.plugin.deleteModal && this.plugin.deleteModal.isOpen)) return;
        ev.preventDefault();
        this.deleteSelected();
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
    this.stopRefit();
    if (this._stageRO) {
      try {
        this._stageRO.disconnect();
      } catch (e) {
        /* наблюдатель уже не нужен */
      }
      this._stageRO = null;
    }
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
    // удаление выделенной вершины: кнопка живёт в панели и активна ровно тогда, когда
    // есть что удалять (та же операция — Delete/Backspace и пункт контекстного меню)
    this.delBtn = this.mkButton(gView, "🗑 Удалить", () => this.deleteSelected(), {
      cls: "lg-btn lg-btn--danger",
      title: "Удалить выделенную вершину (Delete или Backspace): снять ссылки, перевесить детей, заметку — в корзину",
    });
    this.delBtn.disabled = true;

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
    this.stageEl = stage;
    this.svg = svgEl("svg", { class: "lg-svg" });
    // маски затухания подписей: общие на весь граф (см. ensureFadeDefs)
    this.defs = svgEl("defs", { class: "lg-defs" });
    this.svg.appendChild(this.defs);
    this.ensureFadeDefs();
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

  /* -------------------------------------------------- сцена и камера */

  /**
   * Реальный размер сцены — того прямоугольника, по которому центрируется граф.
   *
   * ВАЖНО: `clientWidth` у svg равен 0 ровно в те моменты, когда Obsidian ещё не
   * переложил холст: вход/выход из полноэкранного режима, переключение вкладки,
   * первый кадр после onOpen. Прежний `clientWidth || 1000` возвращал в этот
   * момент ФАНТОМНЫЕ 1000×700, fit() центрировал граф в несуществующем окне — и на
   * экране граф уезжал влево от центра на (W − 1000)/2: на окне 1920 px это 460 px.
   * Поэтому размер спрашиваем у всей цепочки контейнеров (svg → сцена → корень →
   * contentEl), а фантом остаётся последним средством — для jsdom и предпросмотра,
   * где layout нет вовсе.
   */
  stageBox() {
    var els = [this.svg, this.stageEl, this.rootEl, this.contentEl];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el) continue;
      var w = el.clientWidth || 0;
      var h = el.clientHeight || 0;
      if (w > 0 && h > 0) return { w: w, h: h };
    }
    return { w: 1000, h: 700 };
  }

  /**
   * Прямоугольник, по которому граф вписывается и центрируется.
   *
   * В полноэкранном режиме холст обязан занимать ВСЁ окно, поэтому опора здесь —
   * окно, а не измеренный бокс сцены. Бокс может оказаться меньше окна по двум
   * причинам: Obsidian ещё не переложил холст (кадр между сменой класса и layout)
   * или полноэкранный слой лёг не на всё окно. В обоих случаях прежний расчёт по
   * узкому прямоугольнику ставил центр графа в центр ЭТОГО прямоугольника, а на
   * экране граф уезжал влево от центра — ровно на (W_экран − W_бокс)/2. При окне
   * 1920 и листе 1584 (левая панель 300 + лента) это 168 px.
   *
   * `toScreen` — признак, что размер взят из окна: тогда центрировать надо по центру
   * ЭКРАНА, приведённому к координатам холста (холст может начинаться не от левого
   * края окна), а не по w/2.
   */
  fitFrame() {
    var b = this.stageBox();
    if (!this.fullscreen || typeof window === "undefined") return { w: b.w, h: b.h, toScreen: false };
    var vw = window.innerWidth || 0;
    var vh = window.innerHeight || 0;
    if (vw > b.w || vh > b.h) return { w: Math.max(b.w, vw), h: Math.max(b.h, vh), toScreen: true };
    return { w: b.w, h: b.h, toScreen: false };
  }

  width() {
    return this.fitFrame().w;
  }

  height() {
    return this.fitFrame().h;
  }

  /**
   * Куда ставить центр графа: в обычном режиме — центр холста, в полноэкранном с размером
   * от окна — центр экрана в координатах холста. Если точка вышла за холст, остаётся
   * центр холста: лучше ровно по холсту, чем наполовину за обрезом.
   */
  centerTarget(fr) {
    var cx = fr.w / 2;
    var cy = fr.h / 2;
    if (!fr.toScreen || !this.svg || !this.svg.getBoundingClientRect) return { x: cx, y: cy };
    var r = null;
    try {
      r = this.svg.getBoundingClientRect();
    } catch (e) {
      r = null;
    }
    if (!r || !isFinite(r.left) || !isFinite(r.top)) return { x: cx, y: cy };
    var tx = (window.innerWidth || fr.w) / 2 - r.left;
    var ty = (window.innerHeight || fr.h) / 2 - r.top;
    if (tx > 0 && tx < fr.w) cx = tx;
    if (ty > 0 && ty < fr.h) cy = ty;
    return { x: cx, y: cy };
  }

  /** Камера посчитана под другой размер или положение сцены? */
  boxChanged() {
    var f = this._fitBox;
    var fr = this.fitFrame();
    var c = this.centerTarget(fr);
    // При входе в Fullscreen API ширина из fitFrame() сразу равна ширине окна,
    // однако сам SVG ещё несколько кадров сохраняет прежний left/top. Поэтому одной
    // проверки w/h недостаточно: после перекладки размер формально тот же, но центр
    // экрана в координатах холста уже другой. Именно это оставляло граф слева вплоть
    // до ручного Fit.
    return !f || !isFinite(f.cx) || !isFinite(f.cy) ||
      Math.abs(fr.w - f.w) > 0.5 || Math.abs(fr.h - f.h) > 0.5 ||
      Math.abs(c.x - f.cx) > 0.5 || Math.abs(c.y - f.cy) > 0.5;
  }

  /*
   * Пересчёт камеры ПОСЛЕ того, как сцена действительно сменила размер.
   *
   * Полноэкранный режим меняет и положение холста (position: fixed на всё окно),
   * и состав chrome: панель управления и легенда прячутся, сцена становится шире и
   * выше. Ни CSS-переход Chromium, ни перекладка Obsidian не заканчиваются в тот же
   * кадр, что и смена класса, поэтому единственный fit() «через 30 мс» считал камеру
   * по старому размеру: центр графа оставался центром ПРЕЖНЕЙ сцены, а на экране это
   * выглядело ровно как жалоба — граф смещён влево от центра (на (W_new − W_old)/2).
   *
   * Отсюда правило: пересчитываем, пока размер не устоится три кадра подряд и не
   * раньше заказанного срока (и не дольше ~3 с), а не по одному таймеру. Один fit на
   * кадр максимум — на 1000+ вершинах пересборка подписей дорогая, «шторм» из fit()
   * во время drag-resize не нужен.
   */
  scheduleRefit(minMs) {
    // Срок ждущей цепочки — общий и ПРОДЛЕВАЕМЫЙ: запрос, пришедший, пока цепочка
    // ещё жива, обязан увеличить её запас, а не потеряться. Иначе ровно этот случай
    // и ломает центрирование: вход в полный экран случился через мгновение после
    // другого пересчёта, цепочка со старым коротким сроком тут же вышла, и камеру
    // больше никто не досчитал.
    var until = Date.now() + (minMs || 0);
    if (until > (this._refitUntil || 0)) this._refitUntil = until;
    if (this._refitRaf != null) return this._refitRaf;
    var self = this;
    var stable = 0;
    var frames = 0;
    var step = function () {
      self._refitRaf = null;
      if (!self.graph || self.svg == null) {
        self._refitUntil = 0;
        return;
      }
      frames++;
      if (self.boxChanged()) {
        stable = 0;
        self.fit();
      } else {
        stable++;
      }
      // раньше срока не уходим: переход полноэкранного режима может закончиться
      // позже, чем размер устоялся на три кадра
      if ((stable >= 3 && Date.now() >= (self._refitUntil || 0)) || frames > 180) {
        self._refitUntil = 0;
        return;
      }
      self._refitRaf = window.requestAnimationFrame(step);
    };
    this._refitRaf = window.requestAnimationFrame(step);
    return this._refitRaf;
  }

  stopRefit() {
    this._refitUntil = 0;
    if (this._refitRaf != null && this._refitRaf !== 0) {
      try {
        window.cancelAnimationFrame(this._refitRaf);
      } catch (e) {
        /* превью/jsdom: отменять нечем — флаг уже снят */
      }
    }
    this._refitRaf = null;
  }

  /**
   * Наблюдатель за размером сцены. Это основная страховка центрирования: какой бы
   * путь ни сменил размер холста (полноэкранный режим, панели Obsidian, поворот
   * экрана, шрифт), камера пересчитается по новому прямоугольнику.
   */
  observeStage() {
    if (typeof ResizeObserver === "undefined" || !this.stageEl || this._stageRO) return;
    var self = this;
    try {
      this._stageRO = new ResizeObserver(function () {
        self.scheduleRefit();
      });
      this._stageRO.observe(this.stageEl);
    } catch (e) {
      this._stageRO = null; // наблюдателя нет — остаются onResize() и window.resize
    }
  }

  /**
   * Obsidian зовёт onResize(), когда меняется размер листа (раздвижка панелей,
   * боковые панели, окно). Без него камера оставалась от прежнего размера и граф
   * стоял не по центру. Это же — страховка на случай, когда ResizeObserver недоступен.
   */
  onResize() {
    this.scheduleRefit();
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
    // выделения может уже не быть в новой модели (вершину удалили) — кнопка не должна
    // обещать удаление того, чего нет
    if (this.selected && !this.byId[this.selected]) this.selected = null;
    this.updateDeleteBtn();
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
      c.__lgFill = n.color; // что нарисовано сейчас — redraw меняет заливку только при отличии
      g.__c = c;
      g.appendChild(c);
      var t = svgEl("text", { class: "lg-label", "text-anchor": "middle", y: n.r + 11 });
      // текст пишется целиком; «не влезло» гасит маска, которую вешает updateLabels()
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
   * Маски «затухающей подписи»: FADE_STEPS штук на весь граф, а не по одной на вершину.
   * Каждая — прямоугольник в долях ширины метки (maskContentUnits: objectBoundingBox),
   * залитый линейным градиентом «белое → прозрачное». Белое = текст виден, прозрачное =
   * текст растворился. Ступень выбирается по n.labelFade, поэтому 1017 вершин делят
   * между собой десяток градиентов, а не заводят по своему.
   *
   * ВАЖНО: маска строится в координатах ОБЪЕКТА, поэтому она не зависит ни от зума, ни
   * от кегля — при любом масштабе гаснет одна и та же доля строки, и пересчитывать defs
   * на каждое движение камеры не нужно.
   */
  ensureFadeDefs() {
    if (!this.defs || this._fadeReady) return;
    var ns = "http://www.w3.org/2000/svg";
    for (var i = 0; i < FADE_STEPS; i++) {
      // frac — доля строки, видимая в полную силу; последняя ступень (frac=1) не нужна:
      // подпись, которая влезла целиком, рисуется вообще без маски
      var frac = core.LABEL_FADE_MIN + ((1 - core.LABEL_FADE_MIN) * i) / (FADE_STEPS - 1);
      if (frac >= 0.999) continue;
      var id = "lg-fade-" + i;
      var grad = svgEl("linearGradient", { id: id + "-g", x1: "0", y1: "0", x2: "1", y2: "0" });
      // Гаснет ТОЛЬКО правый край: читают слева направо, и начало названия обязано
      // остаться в полную силу (иначе вместо «Setup and Notation — Metric…» видно
      // огрызок «…tation — Metric…», что хуже прежнего многоточия). Поэтому такие
      // подписи ещё и выравниваются по левому краю своего бюджета (см. updateLabels).
      // frac — доля ширины текста, помещающаяся в бюджет; на ней метка уже прозрачна,
      // а переход начинается за tail до неё.
      var tail = Math.min(FADE_TAIL, frac * 0.5);
      [
        [0, 1], [Math.max(0.001, frac - tail), 1], [Math.min(0.999, frac), 0], [1, 0],
      ].forEach(function (s) {
        var stop = document.createElementNS(ns, "stop");
        stop.setAttribute("offset", String(Math.round(s[0] * 1000) / 1000));
        stop.setAttribute("stop-color", "#fff");
        stop.setAttribute("stop-opacity", String(s[1]));
        grad.appendChild(stop);
      });
      var mask = svgEl("mask", { id: id, maskContentUnits: "objectBoundingBox" });
      // прямоугольник шире единицы: у текста с обводкой (paint-order: stroke) реальный
      // bbox чуть больше глифов, и по краям маски не должно возникать среза
      mask.appendChild(svgEl("rect", { x: "-0.1", y: "-0.6", width: "1.2", height: "2.2", fill: "url(#" + id + "-g)" }));
      this.defs.appendChild(grad);
      this.defs.appendChild(mask);
    }
    this._fadeReady = true;
  }

  /**
   * Какую маску повесить на подпись: null — текст влез целиком (маска не нужна и не
   * ставится, это ещё и быстрее), иначе id ближайшей ступени затухания.
   * Наведённая/выбранная вершина показывает название ЦЕЛИКОМ, поэтому для неё маски нет
   * никогда — за это отвечает вызывающий код (updateLabels), а не эта функция.
   */
  fadeMaskFor(frac) {
    var f = Number(frac);
    if (!isFinite(f) || f >= 0.999) return null;
    var lo = core.LABEL_FADE_MIN;
    var idx = Math.round(((clamp(f, lo, 1) - lo) / (1 - lo)) * (FADE_STEPS - 1));
    idx = clamp(idx, 0, FADE_STEPS - 1);
    if (idx >= FADE_STEPS - 1) return null;
    return "lg-fade-" + idx;
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
    // подпись под курсором разворачивается на полную длину, поэтому её вершина обязана
    // лежать ПОВЕРХ соседей: в SVG z-order — это порядок в документе
    var focusId = this.hoverId || this.selected;
    if (focusId && this.nodeEls[focusId]) this.raiseNode(focusId);
    for (var id in this.nodeEls) {
      var n = this.byId[id];
      var el = this.nodeEls[id];
      var t = el.__t;
      if (!n || !t) continue;
      var on = !!plan[id];
      // Текст рисуется ЦЕЛИКОМ и в обычном состоянии, и под курсором — разница только
      // в затухании: если название шире отведённого бюджета, его хвост гаснет к краю
      // (маска), а у наведённой/выбранной вершины маска снимается и название читается
      // полностью. Обрезки многоточием в живом виде нет вообще.
      var focus = this.hoverId === id || this.selected === id;
      var en = n.labelEn === undefined ? n.name : n.labelEn;
      var zh = (n.labelZh === undefined ? n.nameZh : n.labelZh) || "";
      var fade = this.fadeMaskFor(n.labelFade); // null — название влезло целиком
      var mask = focus ? null : fade;
      var p = plan[id];
      var fs = p ? p.fsA : (n.font || this.plugin.settings.labelFontSize || 10) * comp;
      var rM = p ? p.rM : this.radiusModel(n, k);
      var y = rM + fs * (0.95 + (p ? p.shift : 0));
      var dy = fs * 1.12;
      var lw = p ? p.wM : (Math.max(0, (n.lw || 0) - 8)) * comp + 8;
      // Подпись, которая не влезла, прижимается к ЛЕВОМУ краю своего бюджета: гаснет
      // хвост, а начало названия читается в полную силу. Выравнивание зависит от fade,
      // а не от mask, поэтому при наведении текст не прыгает — снимается только маска.
      var x0 = fade ? -lw / 2 : 0;
      var anchor = fade ? "start" : "middle";
      var state = (on ? "1" : "0") + "|" + fs.toFixed(1) + "|" + y.toFixed(1) + "|" + dy.toFixed(1) +
        "|" + lw.toFixed(1) + "|" + (mask || "-") + "|" + anchor + "|" + x0.toFixed(1) +
        "|" + en + "\u0000" + (zh || "");
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
      // затухание длинного названия: маска ставится только тем, кто не влез в бюджет,
      // и снимается под курсором — так название читается целиком без «прыжка» текста
      if (mask) {
        t.setAttribute("mask", "url(#" + mask + ")");
        t.setAttribute("data-fade", mask);
      } else if (t.hasAttribute("mask")) {
        t.removeAttribute("mask");
        t.removeAttribute("data-fade");
      }
      t.setAttribute("text-anchor", anchor);
      t.childNodes[0].setAttribute("x", x0.toFixed(1));
      t.childNodes[1].setAttribute("x", x0.toFixed(1));
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
        // заливка меняется на месте (writeNodeColor правит colorProp и зовёт redraw):
        // круг не пересоздаётся, поэтому следим и за fill, а не только за классами
        var c2 = el2.__c || (el2.__c = el2.querySelector("circle"));
        if (c2 && c2.__lgFill !== n2.color) {
          c2.setAttribute("fill", n2.color);
          c2.__lgFill = n2.color;
        }
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
    var rw = this.width(), rh = this.height();
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
    // опора центрирования: в обычном режиме — бокс сцены, в полноэкранном — окно
    // (в предпросмотре и тестах width()/height() переопределяют: jsdom не считает layout)
    var fr = this.fitFrame();
    var w = fr.w;
    var h = fr.h;
    var gw = Math.max(1, b.maxX - b.minX);
    var gh = Math.max(1, b.maxY - b.minY);
    var k = clamp(Math.min((w - 40) / gw, (h - 40) / gh), ZOOM_MIN, ZOOM_MAX);
    // центр ограничивающего прямоугольника графа — ровно в центр экрана (в полном
    // экране) или сцены, и по X, и по Y
    var c = this.centerTarget(fr);
    this.view = { k: k, x: c.x - ((b.minX + b.maxX) * k) / 2, y: c.y - ((b.minY + b.maxY) * k) / 2 };
    // Запоминаем не только размер, но и фактический центр окна в координатах SVG:
    // при асинхронной перекладке fullscreen left/top меняются без изменения w/h.
    this._fitBox = { w: w, h: h, cx: c.x, cy: c.y };
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
    /* Сцена меняет размер ДВАЖДЫ: сразу (класс) и когда закончится переход
       полноэкранного режима Chromium и перекладка Obsidian. Считаем камеру сразу —
       чтобы не показывать кадр со старой, — и досчитываем, пока размер не устоится.
       Прежний одинокий fit() «через 30 мс» центрировал граф по ПРЕЖНЕЙ сцене, и на
       широком экране он вставал левее центра на (W_new − W_old)/2. */
    this.fit();
    this.scheduleRefit(FULLSCREEN_SETTLE_MS);
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
    // Ctrl+ЛКМ (на macOS и Cmd+ЛКМ) — ручная связь: источник — уже выделенная
    // вершина, цель — вершина под курсором. Дуга рисуется сама: плагин дописывает
    // ссылку в заметку источника и пересобирает граф. Перетаскивание тут не нужно.
    if (ev.ctrlKey || ev.metaKey) {
      if (n) {
        ev.preventDefault();
        this.linkSelectedTo(n);
        return;
      }
      // Ctrl+клик по пустому месту — как обычный клик: панорама/снятие выделения
    }
    var p = this.toGraph(ev);
    if (n) {
      this.drag = { node: n, dx: n.x - p.x, dy: n.y - p.y, moved: false };
      n.fixed = true;
      this.frozen = true;
      if (this.freezeBtn) this.freezeBtn.setText("⏸ Physics off");
      this.select(n.id);
    } else {
      this.drag = { pan: true, sx: ev.clientX, sy: ev.clientY, vx: this.view.x, vy: this.view.y, moved: false };
      this.select(null);
    }
    ev.preventDefault();
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
    // наведение снимает затухание с подписи (название читается целиком) — это работает
    // в ЛЮБОМ режиме подписей, поэтому пересчёт нужен всегда, а не только в size/hover
    this.updateLabels();
  }

  /**
   * Поднимает вершину над остальными: её группа переезжает в конец слоя, а в SVG
   * порядок документа — это и есть z-order. Нужно для наведения: подпись под курсором
   * разворачивается на полную длину и иначе уходила бы под круги и метки соседей.
   * Дешёвая операция (перенос одного узла), и делается только при смене hover.
   */
  raiseNode(id) {
    var el = this.nodeEls && this.nodeEls[id];
    if (!el || !this.nodesLayer || el === this.nodesLayer.lastChild) return;
    this.nodesLayer.appendChild(el);
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
      // пойдёт поиск связанных тем (корпус аннотаций + совпадения названий); тут же —
      // глобальное слияние дубликатов по всему графу (с предпросмотром и отменой)
      ev.preventDefault();
      var menu = new obsidian.Menu(this.app);
      menu.addItem((it) =>
        it
          .setTitle("Create node (EN / 中文 / keywords)")
          .setIcon("plus-circle")
          .onClick(() => new CreateNodeModal(this.app, this.plugin, {}).open())
      );
      var dupCount = this.graph && this.graph.duplicateGroups ? this.graph.duplicateGroups.length : 0;
      var dupSuffix = dupCount ? " (" + dupCount + ")" : "";
      menu.addItem((it) =>
        it
          .setTitle("Preview duplicate groups" + dupSuffix + "…")
          .setIcon("eye")
          .onClick(() => this.plugin.previewDuplicateNodes())
      );
      menu.addItem((it) =>
        it
          .setTitle("Merge all duplicate vertices" + dupSuffix)
          .setIcon("git-merge")
          .onClick(() => this.plugin.mergeDuplicateNodes())
      );
      if (this.plugin.lastMerge) {
        var undoMergeTitle = this.plugin.lastMerge.mode === "manual" ? "Undo last manual merge" : "Undo last duplicate merge";
        menu.addItem((it) =>
          it.setTitle(undoMergeTitle).setIcon("undo").onClick(() => this.plugin.undoDuplicateMerge())
        );
      }
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
    menu.addItem((it) =>
      it
        .setTitle("Цвет вершины…")
        .setIcon("palette")
        .setDisabled(!!n.inline)
        .onClick(() => this.plugin.editNodeColor(n))
    );
    menu.addItem((it) => it.setTitle("Isolate chapter of this vertex").setIcon("scan").onClick(() => this.isolate(n.id)));
    menu.addItem((it) => it.setTitle("Clear filters").setIcon("x").onClick(() => this.clearIsolation()));
    menu.addSeparator();
    menu.addItem((it) => it.setTitle("Copy wiki link").setIcon("link").onClick(() => this.plugin.copyLink(n)));
    menu.addItem((it) =>
      it
        .setTitle("Ручное слияние с другим узлом…")
        .setIcon("combine")
        .setDisabled(!!n.inline)
        .onClick(() => this.plugin.openManualMerge(n))
    );
    menu.addItem((it) => it.setTitle("Merge duplicates of this vertex").setIcon("git-merge").onClick(() => this.plugin.mergeDuplicateNodes({ ids: [n.id] })));
    menu.addItem((it) => it.setTitle("Preview duplicates of this vertex…").setIcon("eye").onClick(() => this.plugin.previewDuplicateNodes({ ids: [n.id] })));
    // ручная связь без Ctrl: если вершина уже выделена, меню предлагает оба направления
    if (this.selected && this.selected !== n.id && this.byId[this.selected]) {
      var srcSel = this.byId[this.selected];
      var self = this;
      var label = function (x) { return x.name || x.id; };
      menu.addSeparator();
      menu.addItem((it) =>
        it
          .setTitle("Link: «" + label(srcSel) + "» → эта вершина")
          .setIcon("arrow-right")
          .onClick(() => self.linkSelectedTo(n, srcSel))
      );
    menu.addItem((it) =>
      it
        .setTitle("Link: эта вершина → «" + label(srcSel) + "»")
        .setIcon("arrow-left")
        .onClick(() => self.linkSelectedTo(srcSel, n))
    );
    }
    menu.addSeparator();
    menu.addItem((it) =>
      it
        .setTitle("Delete vertex (Delete)")
        .setIcon("trash")
        .setWarning()
        .onClick(() => this.plugin.confirmDeleteNode(n))
    );
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

  select(id, force) {
    if (id && this.selected === id && !force) {
      // второй клик по той же вершине — снять выделение и спрятать сообщение
      this.selected = null;
      this.neigh = null;
      this.showBubble(null);
      this.updateDeleteBtn();
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
    this.updateDeleteBtn();
    this.redraw({ geometry: false });
    this.updateLabels();
    if (this.selected) {
      // подсказка про второй шаг ручной связи: источник уже выделен
      this.setStatus("Связь: «" + (n.name || n.id) + "» — источник. Ctrl+клик по другому узлу — провести дугу", 5000);
    }
  }

  /** Кнопка «🗑 Удалить» активна только тогда, когда есть что удалять. */
  updateDeleteBtn() {
    if (this.delBtn) this.delBtn.disabled = !this.selected;
  }

  /**
   * Удаление выделенной вершины: из клавиши Delete/Backspace, кнопки панели и команды
   * палитры. Сначала показывается окно подтверждения (его можно отключить в настройках)
   * со списком последствий — сколько ссылок снимется, кто из детей перевесится.
   */
  async deleteSelected() {
    var id = this.selected;
    if (!id) {
      new obsidian.Notice("Удаление: сначала выделите вершину (ЛКМ по кругу)");
      return null;
    }
    var node = this.byId[id] || id;
    return this.plugin.confirmDeleteNode(node);
  }

  /**
   * Ручная связь из графа: источник — выделенная вершина (или явно переданный),
   * цель — та, по которой Ctrl+кликнули. Порядок выделения задаёт направление дуги:
   * первый выделенный узел ссылается на второй. Если источник ещё не выбран,
   * клик просто делает цель первым узлом будущей связи.
   */
  async linkSelectedTo(target, source) {
    if (!target) return;
    var src = source || (this.selected ? this.byId[this.selected] : null);
    if (!src) {
      new obsidian.Notice("Связь: сначала выделите первый узел (ЛКМ), затем Ctrl+клик по второму");
      this.select(target.id);
      return;
    }
    if (src.id === target.id) {
      new obsidian.Notice("Связь вершины с собой создать нельзя: Ctrl+кликните другой узел");
      return;
    }
    var ok = await this.plugin.createManualLink(src, target, this.graph);
    if (ok) {
      // граф пересобран: обновить соседей и пузырёк источника, не снимая выделения
      this.select(src.id, true);
      this.setStatus("Связь создана: «" + (src.name || src.id) + "» → «" + (target.name || target.id) + "». Ctrl+клик — ещё одна дуга", 6000);
    }
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

/* ------------------------------------------------------------------ образцы цвета */

/**
 * Один и тот же ряд образцов в окне «Цвет вершины» и в окне создания узла: пунктирный
 * круг «как у главы/типа» плюс все цвета, которые уже есть в графе (plugin.usedColors).
 */
function fillColorSwatches(row, plugin, onPick) {
  row.textContent = "";
  var auto = row.createEl("button", {
    cls: "lg-swatch lg-swatch--auto",
    attr: { type: "button", title: "Как у главы/типа: вершина красится по общему правилу", "aria-label": "Как у главы/типа" },
  });
  auto.addEventListener("click", function () { onPick(""); });
  plugin.usedColors().forEach(function (c) {
    var b = row.createEl("button", {
      cls: "lg-swatch",
      attr: { type: "button", style: "background:" + c, title: c, "aria-label": "Цвет " + c },
    });
    b.dataset.color = c;
    b.addEventListener("click", function () { onPick(c); });
  });
}

/** Подсветить выбранный образец; пустое значение подсвечивает «как у главы/типа».
 *  Полувведённый hex (#ff…) не подсвечивает ничего — это ещё не выбор. */
function markColorSwatch(row, value) {
  var raw = String(value == null ? "" : value).trim();
  var want = core.isHexColor(raw) ? core.normalizeHexColor(raw) : "";
  Array.prototype.forEach.call(row.querySelectorAll(".lg-swatch"), function (b) {
    var on = want ? b.dataset && b.dataset.color === want : raw === "" && b.classList.contains("lg-swatch--auto");
    b.classList.toggle("lg-swatch--on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

/* ------------------------------------------------------------------ modal: цвет вершины */

/**
 * Смена цвета одной вершины. Цвет — это свойство color: в frontmatter заметки: оно
 * перебивает и цвет главы, и цвет типа (см. core.resolveColors), поэтому окно пишет
 * ровно его и ничего больше. Список образцов — цвета, которые уже есть в графе:
 * палитра глав, цвета типов и чужие собственные color: у других вершин (plugin.usedColors);
 * плюс свой цвет — пипеткой <input type="color"> или hex-строкой. Выбор «как у
 * главы/типа» снимает свойство: вершина снова красится по общему правилу.
 */
class NodeColorModal extends obsidian.Modal {
  constructor(app, plugin, node, opts) {
    super(app);
    this.plugin = plugin;
    this.node = node;
    this.opts = opts || {};
    this.value = core.isHexColor(node.colorProp) ? core.normalizeHexColor(node.colorProp) : "";
    this.busy = false;
  }

  /** Откуда сейчас цвет вершины: своё свойство, глава или тип (для пояснения в окне). */
  colorSource() {
    var n = this.node;
    if (core.isHexColor(n.colorProp)) return { hex: core.normalizeHexColor(n.colorProp), why: "своё свойство color:" };
    var byCh = (this.plugin.cache && this.plugin.cache.colorsByChapter) || {};
    var ch = byCh[n.kwChapter || n.chapter];
    if (ch) return { hex: ch, why: "глава " + (n.kwChapter || n.chapter) };
    return { hex: (this.plugin.settings.colors || {})[n.type] || "#888888", why: "тип «" + (TYPE_LABEL[n.type] || n.type) + "»" };
  }

  onOpen() {
    var content = this.contentEl;
    var self = this;
    content.addClass("lg-modal");
    content.addClass("lg-node-color");
    content.createEl("h2", { text: "Цвет вершины" });
    content.createDiv({ cls: "lg-modal-path", text: this.node.path });

    var preview = content.createDiv({ cls: "lg-modal-preview lg-node-color__preview" });
    this.dotEl = preview.createDiv({ cls: "lg-node-color__dot" });
    var lines = preview.createDiv({ cls: "lg-node-color__lines" });
    this.pName = lines.createDiv({ cls: "lg-line lg-line--en", text: this.node.name || this.node.id });
    this.pNote = lines.createDiv({ cls: "lg-node-color__note" });

    var fPal = content.createDiv({ cls: "lg-field" });
    fPal.createEl("label", { text: "Цвет вершины", attr: { for: "lg-node-color-swatches" } });
    this.swatchRow = fPal.createDiv({ cls: "lg-swatches", attr: { id: "lg-node-color-swatches" } });

    var fCustom = content.createDiv({ cls: "lg-field" });
    fCustom.createEl("label", { text: "Свой цвет (пипетка или #rgb / #rrggbb)", attr: { for: "lg-node-color-hex" } });
    var customRow = fCustom.createDiv({ cls: "lg-field-row" });
    this.pickerEl = customRow.createEl("input", {
      cls: "lg-color-picker",
      type: "color",
      attr: { id: "lg-node-color-picker", title: "Выбрать свой цвет" },
    });
    this.hexEl = customRow.createEl("input", {
      type: "text",
      attr: { id: "lg-node-color-hex", placeholder: "#3fa7d6", spellcheck: "false", autocomplete: "off" },
    });

    content.createDiv({
      cls: "lg-modal-hint",
      text: "Выбор пишется в свойство " + (this.plugin.settings.colorKey || "color") + " заметки и перебивает цвет главы и тип. " +
        "«Как у главы/типа» (пунктирный круг) снимает свойство — вершина снова красится по общему правилу. Тело заметки не трогается.",
    });

    var btns = content.createDiv({ cls: "lg-modal-btns" });
    this.saveBtn = btns.createEl("button", { text: "Сохранить", cls: "mod-cta", attr: { type: "button" } });
    this.saveBtn.addEventListener("click", () => this.submit());
    btns.createEl("button", { text: "Отмена", attr: { type: "button" } }).addEventListener("click", () => this.close());

    this.pickerEl.addEventListener("input", function () {
      self.setValue(core.normalizeHexColor(this.value) || this.value, { from: "picker" });
    });
    this.hexEl.addEventListener("input", function () {
      var v = this.value.trim();
      if (!v) self.setValue(""); // очистил поле — вернулись к «как у главы/типа»
      else if (core.isHexColor(v)) self.setValue(core.normalizeHexColor(v), { from: "hex" });
      else {
        // полу-введённый hex (#ff…): ещё не выбор — подсветку снимаем и не даём
        // сохранить «старое» значение под видом недописанного
        self.hexOk = false;
        self.saveBtn.disabled = true;
        self.markSwatches(v);
      }
    });
    this.registerDomEvent(document, "keydown", (ev) => {
      if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) this.submit();
    });

    this.renderSwatches();
    this.setValue(this.value);
    setTimeout(() => this.hexEl.focus(), 30);
  }

  /** Ряд образцов: «как у главы/типа» (пунктир) + все цвета, которые уже есть в графе. */
  renderSwatches() {
    var self = this;
    fillColorSwatches(this.swatchRow, this.plugin, function (v) { self.setValue(v); });
  }

  /** Единая точка выбора: подсветить образец, обновить пипетку, hex и предпросмотр. */
  setValue(v, from) {
    this.value = core.isHexColor(v) ? core.normalizeHexColor(v) : "";
    this.hexOk = true;
    if (!this.busy) this.saveBtn.disabled = false;
    markColorSwatch(this.swatchRow, this.value);
    var cur = this.colorSource();
    // пипетка всегда активна: клик по ней сразу выбирает свой цвет; без своего цвета
    // она показывает текущий (главы/типа), чтобы начать выбор с чего-то осмысленного
    if (!from || from !== "picker") this.pickerEl.value = this.value || cur.hex;
    if (!from || from !== "hex") this.hexEl.value = this.value;
    var showOwn = !!this.value;
    this.dotEl.style.background = showOwn ? this.value : "transparent";
    this.dotEl.removeClass("lg-node-color__dot--auto");
    if (!showOwn) this.dotEl.addClass("lg-node-color__dot--auto");
    this.pNote.setText(
      (showOwn ? "будет: " + this.value + " (свойство color:)" : "будет: как у главы/типа — сейчас " + cur.hex + " (" + cur.why + ")")
    );
  }

  /** Подсветка выбранного образца без перезаписи полей (для полу-введённого hex). */
  markSwatches(v) {
    markColorSwatch(this.swatchRow, v);
  }

  async submit() {
    if (this.busy) return;
    if (this.hexOk === false) {
      new obsidian.Notice("Цвет дописан не до конца: #abc или #aabbcc — либо очистите поле, чтобы снять свой цвет");
      return;
    }
    this.busy = true;
    this.saveBtn.disabled = true;
    this.saveBtn.setText("Сохраняем…");
    var ok;
    try {
      ok = await this.plugin.writeNodeColor(this.node, this.value);
    } finally {
      this.busy = false;
      this.saveBtn.disabled = false;
      this.saveBtn.setText("Сохранить");
    }
    if (ok) {
      new obsidian.Notice(
        this.value
          ? "Цвет вершины " + this.node.id + ": " + this.value
          : "Свой цвет снят: " + this.node.id + " снова красится по главе/типу"
      );
      this.close();
    }
  }

  onClose() {
    if (typeof this.opts.onDone === "function") this.opts.onDone(this.value);
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
      text: "Заметка создаётся в папке своего уровня (глава/секция/заголовок/блок) рядом с соседями. После создания плагин сам ищет связанные темы: по ключевым фразам — во всех аннотациях корпуса, по названиям — среди вершин графа, и сразу связывает её с каждой совпавшей секцией и заголовком.",
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
        (this.plugin.settings.keywordFolder || "35 - Abstracts") + "» и превращает найденное в связи с секциями и заголовками; " +
        "число вхождений становится весом (размером) вершины. Связи ставятся со всеми совпавшими секциями и заголовками, " +
        "а глава с наибольшим числом вхождений определяет цвет вершины.",
    });

    var fParent = content.createDiv({ cls: "lg-field" });
    fParent.createEl("label", { text: "Родитель (необязательно)", attr: { for: "lg-new-parent" } });
    var parentSel = fParent.createEl("select", { attr: { id: "lg-new-parent" } });

    // цвет можно задать сразу: образцами, которые уже есть в графе, или своим. По
    // умолчанию — «как у главы/типа»: заметка красится по общему правилу, и её
    // кластер остаётся читаемым; своё значение пишется в color: и перебивает его
    var fColor = content.createDiv({ cls: "lg-field" });
    fColor.createEl("label", { text: "Цвет вершины", attr: { for: "lg-new-color-swatches" } });
    var colorRow = fColor.createDiv({ cls: "lg-swatches", attr: { id: "lg-new-color-swatches" } });
    var fColorCustom = content.createDiv({ cls: "lg-field" });
    fColorCustom.createEl("label", { text: "Свой цвет (пипетка или #rgb / #rrggbb)", attr: { for: "lg-new-color-hex" } });
    var customRow = fColorCustom.createDiv({ cls: "lg-field-row" });
    var colorPicker = customRow.createEl("input", {
      cls: "lg-color-picker",
      type: "color",
      attr: { id: "lg-new-color-picker", title: "Выбрать свой цвет" },
    });
    var colorHex = customRow.createEl("input", {
      type: "text",
      attr: { id: "lg-new-color-hex", placeholder: "#3fa7d6", spellcheck: "false", autocomplete: "off" },
    });

    var preview = content.createDiv({ cls: "lg-modal-preview lg-node-color__preview" });
    var pDot = preview.createDiv({ cls: "lg-node-color__dot" });
    var pLines = preview.createDiv({ cls: "lg-node-color__lines" });
    var pEn = pLines.createDiv({ cls: "lg-line lg-line--en", text: "(название)" });
    var pZh = pLines.createDiv({ cls: "lg-line lg-line--zh", text: "—" });
    var pColor = pLines.createDiv({ cls: "lg-node-color__note" });

    var btns = content.createDiv({ cls: "lg-modal-btns" });
    var save = btns.createEl("button", { text: "Создать", cls: "mod-cta", attr: { type: "button" } });
    btns.createEl("button", { text: "Отмена", attr: { type: "button" } }).addEventListener("click", () => this.close());

    var self = this;
    this.color = "";
    this.colorOk = true;
    var upd = function () {
      pEn.setText(en.value.trim() || "(название)");
      pZh.setText(zh.value.trim() || "—");
      save.disabled = !en.value.trim() || self.busy || !self.colorOk;
      if (!self.color) pColor.setText("цвет: унаследуется — как у главы, а без неё как у типа «" + (TYPE_LABEL[typeSel.value] || typeSel.value) + "»");
    };
    // «как у главы/типа» показывает цвет типа — до создания реальную главу никто
    // не знает (её определит поиск по корпусу), а пунктир честно говорит «унаследуется»
    var autoColor = function () {
      return core.normalizeHexColor((self.plugin.settings.colors || {})[typeSel.value]) || "#888888";
    };
    var setColor = function (v) {
      self.color = core.isHexColor(v) ? core.normalizeHexColor(v) : "";
      self.colorOk = true;
      markColorSwatch(colorRow, self.color);
      // пипетка всегда активна; без своего цвета показывает цвет типа — с него
      // удобно начинать выбор, а пунктирный круг говорит «пока не выбрано своё»
      colorPicker.value = self.color || autoColor();
      colorHex.value = self.color;
      if (self.color) {
        pDot.style.background = self.color;
        pDot.removeClass("lg-node-color__dot--auto");
        pColor.setText("цвет: " + self.color + " (свойство color:)");
      } else {
        pDot.style.background = "transparent";
        pDot.addClass("lg-node-color__dot--auto");
        pColor.setText("цвет: унаследуется — как у главы, а без неё как у типа «" + (TYPE_LABEL[typeSel.value] || typeSel.value) + "»");
      }
      upd();
    };
    fillColorSwatches(colorRow, this.plugin, setColor);
    colorPicker.addEventListener("input", function () {
      setColor(core.normalizeHexColor(this.value) || this.value);
    });
    colorHex.addEventListener("input", function () {
      var v = this.value.trim();
      if (!v) setColor(""); // очистил поле — снова «как у главы/типа»
      else if (core.isHexColor(v)) setColor(core.normalizeHexColor(v));
      else {
        // полу-введённый hex: выбора нет, «Создать» заблокирован, чтобы не сохранить
        // прежний цвет под видом недописанного
        self.colorOk = false;
        markColorSwatch(colorRow, v);
        upd();
      }
    });
    setColor("");
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
      // подсказка про «как у главы/типа» зависит от выбранного типа
      if (!self.color) {
        pDot.style.background = "transparent";
        pColor.setText("цвет: унаследуется — как у главы, а без неё как у типа «" + (TYPE_LABEL[typeSel.value] || typeSel.value) + "»");
      }
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
    if (this.colorOk === false) {
      new obsidian.Notice("Цвет дописан не до конца: #abc или #aabbcc — либо очистите поле, чтобы красить по общему правилу");
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
        color: this.color,
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

/* ------------------------------------------------------------------ modal: удаление вершины */

/**
 * Окно подтверждения удаления. Показывает не «вы уверены?», а что именно случится:
 * куда уйдёт заметка, сколько ссылок придётся снять и в скольких заметках, кто из
 * детей перевесится на родителя удаляемой вершины, что будет с инлайн-блоками.
 * Числа берутся из core.planNodeDelete — плана, посчитанного по свежей модели графа.
 */
class DeleteNodeModal extends obsidian.Modal {
  constructor(app, plugin, plan) {
    super(app);
    this.plugin = plugin;
    this.plan = plan;
    this.busy = false;
  }

  onOpen() {
    var plan = this.plan;
    var node = plan.node;
    var content = this.contentEl;
    content.addClass("lg-modal");
    content.addClass("lg-delete");
    content.createEl("h2", { text: node.inline ? "Удалить инлайн-блок?" : "Удалить вершину?" });

    var prev = content.createDiv({ cls: "lg-modal-preview" });
    prev.createDiv({ cls: "lg-line lg-line--en", text: (node.name || node.id) + (TYPE_LABEL[node.type] ? " · " + TYPE_LABEL[node.type] : "") });
    if (node.nameZh) prev.createDiv({ cls: "lg-line lg-line--zh", text: node.nameZh });
    prev.createDiv({ cls: "lg-modal-path", text: node.path + " · id " + node.id });

    var list = content.createEl("ul", { cls: "lg-delete__list" });
    var li = function (text, cls) {
      return list.createEl("li", { cls: cls || "", text: text });
    };
    var names = function (arr) {
      return arr
        .slice(0, 3)
        .map(function (n) { return n.name || n.id; })
        .join(", ") + (arr.length > 3 ? " …" : "");
    };
    if (node.inline) {
      li("Из заметки уйдёт только якорь ^" + node.anchorName + " — текст абзаца останется на месте.");
    } else {
      li(
        "Заметка уйдёт " +
          (this.plugin.trashAvailable() ? "в корзину Obsidian (штатным способом её можно вернуть)" : "безвозвратно: корзины у этого хранилища нет") +
          "."
      );
      if (plan.inline.length) li("Вместе с ней исчезнут инлайн-блоки (" + plan.inline.length + "): " + names(plan.inline));
    }
    if (plan.refs.length) {
      var kinds = [];
      kinds.push("ссылок из текста: " + plan.refs.reduce(function (s, r) { return s + r.reference; }, 0));
      if (plan.edges.keyword) kinds.push("по ключевым фразам: " + plan.edges.keyword);
      if (plan.edges.embed) kinds.push("врезок: " + plan.edges.embed);
      li(
        "Ссылки снимутся в " + plan.refs.length + " " + (plan.refs.length === 1 ? "заметке" : "заметках") + " (всего " +
          plan.refsTotal + " — " + kinds.join(", ") + "): машинные пункты уйдут целиком, в прозе останется видимый текст, " +
          "weight: и раздел «Related topics» пересчитаются."
      );
    } else {
      li("Входящих ссылок нет — править чужие заметки не придётся.");
    }
    if (plan.children.length) {
      li(
        "Дочерних вершин: " + plan.children.length + " (" + names(plan.children) + ") — их parent:/chapter: будут перевешены на " +
          (plan.newParent ? "«" + plan.newParent + "»" : "родителя (поля очистятся)")
      );
    }
    if (plan.outEdges) li("Исходящие связи (" + plan.outEdges + ") уйдут вместе с заметкой.");
    li(
      "Удаление обратимо до перезагрузки Obsidian: команда «Lecture Graph: Undo last vertex deletion» вернёт заметку и все правки байт-в-байт.",
      "lg-delete__undo"
    );

    var noAsk = content.createEl("label", { cls: "lg-chip lg-delete__noask" });
    var noAskCb = noAsk.createEl("input", { type: "checkbox" });
    noAsk.createEl("span", { text: "больше не спрашивать" });
    this.noAskEl = noAskCb;

    content.createDiv({
      cls: "lg-modal-hint",
      text: "Ctrl+Enter — удалить. Клавиша Delete удаляет выделенную вершину, Backspace — то же (на macOS клавиши Delete нет).",
    });

    var btns = content.createDiv({ cls: "lg-modal-btns" });
    this.delBtn = btns.createEl("button", { cls: "mod-warning", text: "Удалить", attr: { type: "button" } });
    this.delBtn.addEventListener("click", () => this.submit());
    btns.createEl("button", { text: "Открыть заметку", attr: { type: "button" } }).addEventListener("click", () => this.openNote());
    btns.createEl("button", { text: "Отмена", attr: { type: "button" } }).addEventListener("click", () => this.close());
    setTimeout(() => this.delBtn.focus(), 30);
    this.registerDomEvent(document, "keydown", (ev) => {
      if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) this.submit();
    });
  }

  openNote() {
    var f = this.app.vault.getAbstractFileByPath(this.plan.node.path);
    if (f) this.app.workspace.getLeaf(false).openFile(f);
  }

  async submit() {
    if (this.busy) return;
    this.busy = true;
    if (this.noAskEl && this.noAskEl.checked) {
      this.plugin.settings.confirmDelete = false;
      this.plugin.saveSettings();
    }
    this.delBtn.disabled = true;
    this.delBtn.setText("Удаляем…");
    try {
      await this.plugin.deleteNode(this.plan);
    } finally {
      this.busy = false;
    }
    this.close();
  }

  onClose() {
    this.contentEl.textContent = "";
    if (this.plugin.deleteModal === this) this.plugin.deleteModal = null;
  }
}

/* ------------------------------------------------- ручное слияние двух узлов */

/**
 * Ручное слияние не зависит от эвристики дубликатов. Пользователь выбирает второй
 * узел сам, но только среди обычных вершин того же уровня: так section не сможет
 * внезапно стать ребёнком block, а chapter — потерять собственную иерархию.
 */
class ManualMergeModal extends obsidian.Modal {
  constructor(app, plugin, source, graph) {
    super(app);
    this.plugin = plugin;
    this.source = source;
    this.graph = graph;
    this.target = null;
    this.busy = false;
    this.renderLimit = 160;
  }

  onOpen() {
    var content = this.contentEl;
    var self = this;
    this.modalEl.addClass("lg-modal-wide");
    content.addClass("lg-modal");
    content.addClass("lg-manual-merge");
    content.createEl("h2", { text: "Ручное слияние узлов" });
    content.createDiv({
      cls: "lg-modal-hint",
      text: "Найдите второй узел того же уровня. Слияние перенесёт его текст, ссылки, ключевые фразы, подпись и дочерние вершины в выбранный keeper, а второй файл отправит в корзину Obsidian. Автопроверка на дубликат здесь не применяется.",
    });

    // У исходной вершины и найденных вариантов одна и та же «плашка».
    // Так пользователь сравнивает не три разрозненные строки в тесной кнопке,
    // а одинаковые карточки с названием, контекстом и путём.
    var sourceBox = content.createDiv({ cls: "lg-manual-merge__node-card lg-manual-merge__source" });
    this.renderNodeCard(sourceBox, this.source, "Узел, выбранный на графе");

    var searchField = content.createDiv({ cls: "lg-field lg-manual-merge__search" });
    searchField.createEl("label", { text: "Найти узел для слияния", attr: { for: "lg-manual-merge-search" } });
    this.searchEl = searchField.createEl("input", {
      type: "search",
      attr: {
        id: "lg-manual-merge-search",
        placeholder: "Название, перевод, id, путь, alias или ключевая фраза",
        autocomplete: "off",
      },
    });
    this.countEl = content.createDiv({ cls: "lg-manual-merge__count", attr: { "aria-live": "polite" } });
    this.listEl = content.createDiv({ cls: "lg-manual-merge__list", attr: { role: "listbox", "aria-label": "Узлы для слияния" } });
    this.emptyEl = content.createDiv({ cls: "lg-manual-merge__empty", text: "Совпадений нет. Попробуйте искать по id или части названия." });

    this.targetBox = content.createDiv({ cls: "lg-manual-merge__node-card lg-manual-merge__target" });
    this.renderNodeCard(this.targetBox, null, "Выбран второй узел");
    this.targetBox.style.display = "none";

    var keeperField = content.createDiv({ cls: "lg-field lg-manual-merge__keeper" });
    keeperField.createEl("label", { text: "Какой узел оставить (keeper)", attr: { for: "lg-manual-merge-keeper" } });
    this.keeperEl = keeperField.createEl("select", { attr: { id: "lg-manual-merge-keeper" } });
    this.keeperEl.disabled = true;
    this.keeperEl.createEl("option", { text: "Сначала выберите второй узел", attr: { value: "" } });

    this.planEl = content.createDiv({ cls: "lg-manual-merge__plan", attr: { "aria-live": "polite" } });
    this.warnEl = content.createDiv({ cls: "lg-manual-merge__warn" });
    this.planEl.setText("Выберите узел в списке — здесь появится план изменений.");
    this.warnEl.style.display = "none";

    var btns = content.createDiv({ cls: "lg-modal-btns" });
    this.mergeBtn = btns.createEl("button", { cls: "mod-warning", text: "Объединить узлы", attr: { type: "button" } });
    this.mergeBtn.disabled = true;
    this.mergeBtn.addEventListener("click", () => this.submit());
    btns.createEl("button", { text: "Отмена", attr: { type: "button" } }).addEventListener("click", () => this.close());

    this.searchEl.addEventListener("input", function () { self.renderCandidates(self.searchEl.value); });
    this.searchEl.addEventListener("keydown", function (ev) {
      if (ev.key !== "ArrowDown") return;
      var first = self.listEl.querySelector("button.lg-manual-merge__item");
      if (first) { ev.preventDefault(); first.focus(); }
    });
    this.keeperEl.addEventListener("change", function () { self.updatePlan(); });
    this.registerDomEvent(document, "keydown", (ev) => {
      if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) this.submit();
    });
    this.renderCandidates("");
    setTimeout(() => this.searchEl.focus(), 30);
  }

  /**
   * Единая плашка вершины для source, результатов поиска и выбранной цели.
   * У каждого фрагмента есть собственный блочный контейнер: тема Obsidian может
   * менять базовый вид <button>, но не сможет наложить название на метаданные
   * или путь следующего результата.
   */
  renderNodeCard(card, node, eyebrow) {
    card.textContent = "";
    card.createDiv({ cls: "lg-manual-merge__eyebrow", text: eyebrow });
    var name = card.createDiv({ cls: "lg-manual-merge__name", text: node ? (node.name || node.id) : "—" });
    if (node && node.nameZh) name.createDiv({ cls: "lg-line lg-line--zh lg-manual-merge__zh", text: node.nameZh });
    var bits = node ? ["id " + node.id, TYPE_LABEL[node.type] || node.type, "⇠ " + (node.degree || 0)] : [];
    if (node && node.chapter) bits.push("глава " + node.chapter);
    if (node && node.parent) bits.push("родитель " + node.parent);
    card.createDiv({ cls: "lg-manual-merge__meta", text: bits.join(" · ") });
    card.createDiv({ cls: "lg-modal-path lg-manual-merge__path", text: node ? node.path : "" });
  }

  renderCandidates(query) {
    var self = this;
    var all = core.findMergeCandidates(this.graph, this.source, query, { sameType: true });
    var shown = all.slice(0, this.renderLimit);
    this.listEl.textContent = "";
    shown.forEach(function (n) {
      var item = self.listEl.createEl("button", {
        cls: "lg-manual-merge__node-card lg-manual-merge__item" + (self.target && self.target.id === n.id ? " lg-manual-merge__item--selected" : ""),
        attr: {
          type: "button",
          role: "option",
          "aria-selected": self.target && self.target.id === n.id ? "true" : "false",
          "aria-label": "Выбрать для слияния: " + (n.name || n.id) + ", " + n.id,
          "data-node-id": n.id,
          "data-node-type": n.type,
        },
      });
      self.renderNodeCard(item, n, "Нажмите, чтобы выбрать");
      item.addEventListener("click", function () { self.selectTarget(n); });
    });
    var tail = all.length > shown.length ? " · показаны первые " + shown.length + " — уточните запрос" : "";
    this.countEl.setText("Найдено: " + all.length + " из " + Math.max(0, (this.graph.nodes || []).filter(function (n) {
      return n && !n.inline && n.id !== self.source.id && n.type === self.source.type;
    }).length) + tail);
    this.emptyEl.style.display = all.length ? "none" : "";
    this.listEl.style.display = all.length ? "" : "none";
  }

  selectTarget(node) {
    if (!node || node.id === this.source.id || node.inline || node.type !== this.source.type) return;
    this.target = node;
    var items = this.listEl.querySelectorAll("button[data-node-id]");
    for (var i = 0; i < items.length; i++) {
      var on = items[i].getAttribute("data-node-id") === node.id;
      items[i].classList.toggle("lg-manual-merge__item--selected", on);
      items[i].setAttribute("aria-selected", on ? "true" : "false");
    }
    this.renderNodeCard(this.targetBox, node, "Выбран второй узел");
    this.targetBox.style.display = "";

    this.keeperEl.textContent = "";
    this.keeperEl.createEl("option", {
      text: "Оставить выбранный на графе: " + (this.source.name || this.source.id) + " · " + this.source.id,
      attr: { value: this.source.id },
    });
    this.keeperEl.createEl("option", {
      text: "Оставить найденный: " + (node.name || node.id) + " · " + node.id,
      attr: { value: node.id },
    });
    this.keeperEl.value = this.source.id;
    this.keeperEl.disabled = false;
    this.mergeBtn.disabled = false;
    this.updatePlan();
  }

  updatePlan() {
    if (!this.target) return;
    var keepId = this.keeperEl.value || this.source.id;
    var keep = keepId === this.target.id ? this.target : this.source;
    var drop = keep.id === this.source.id ? this.target : this.source;
    var plan = core.planNodeMerge(this.graph, { keep: keep, drop: [drop] }, buildOptions(this.plugin.settings));
    var links = (plan.refs || []).reduce(function (sum, r) { return sum + (r.links || 0); }, 0);
    this.planEl.setText(
      "Останется «" + (keep.name || keep.id) + "» (" + keep.id + "). Узел «" + (drop.name || drop.id) +
      "» уйдёт в корзину · ссылок перенаправить: " + links + " в " + plan.refs.length +
      " заметках · детей перевесить: " + plan.children.length + " · файлов затронет: " + plan.files + "."
    );
    var warnings = (plan.warnings || []).slice();
    warnings.unshift("Это ручная операция: сходство названий и содержимого не проверяется.");
    this.warnEl.setText("Внимание: " + warnings.join(" · "));
    this.warnEl.style.display = "";
  }

  async submit() {
    if (this.busy || !this.target) return;
    this.busy = true;
    this.mergeBtn.disabled = true;
    this.mergeBtn.setText("Объединяем…");
    var result = null;
    try {
      result = await this.plugin.mergeNodesManually({
        sourceId: this.source.id,
        targetId: this.target.id,
        keeperId: this.keeperEl.value || this.source.id,
      });
    } finally {
      this.busy = false;
      if (this.mergeBtn) {
        this.mergeBtn.disabled = !this.target;
        this.mergeBtn.setText("Объединить узлы");
      }
    }
    if (result) this.close();
  }

  onClose() {
    this.contentEl.textContent = "";
    if (this.plugin.manualMergeModal === this) this.plugin.manualMergeModal = null;
  }
}

/* ------------------------------------------------- предпросмотр слияния */

function dupReasonLabel(r) {
  var s = String(r || "");
  var pct = function () {
    var m = /:(\d+)%$/.exec(s);
    return m ? m[1] + "%" : "";
  };
  if (s === "same-title") return "одинаковое название";
  if (s.indexOf("similar-title:") === 0) return "похожие названия (" + pct() + ")";
  if (s === "same-title-zh") return "одинаковый перевод";
  if (s.indexOf("similar-title-zh:") === 0) return "похожие переводы (" + pct() + ")";
  if (s === "same-content") return "одинаковое содержимое";
  if (s.indexOf("content-similarity:") === 0) return "содержимое похоже на " + pct();
  if (s.indexOf("content-contains:") === 0) return "одно содержимое включает другое (" + pct() + ")";
  if (s.indexOf("content-overlap:") === 0) return "содержимое пересекается (" + pct() + ")";
  if (s === "same-keywords") return "одинаковые ключевые фразы";
  if (s.indexOf("shared-keywords:") === 0) return "общие ключевые фразы (" + pct() + ")";
  if (s.indexOf("shared-links:") === 0) return "общие связи (" + pct() + ")";
  if (s === "shared-alias") return "общий алиас";
  if (s === "same-parent") return "общий родитель";
  if (s === "same-chapter") return "одна глава";
  if (s === "manual-node") return "вершина создана вручную";
  if (s === "different-chapter") return "разные главы";
  return s;
}

function dupConfidenceLabel(c) {
  if (c === "high") return "уверенно";
  if (c === "medium") return "вероятно";
  return "сомнительно";
}

function narrowDuplicateGroups(groups, target, mergeOpts) {
  if (!target || !Object.keys(target).length) return (groups || []).slice();
  return (groups || [])
    .filter(function (gr) {
      return gr.nodes.some(function (n) { return target[n.id]; });
    })
    .map(function (gr) {
      var keepIds = {};
      gr.nodes.forEach(function (seed) {
        if (!target[seed.id]) return;
        keepIds[seed.id] = true;
        gr.nodes.forEach(function (other) {
          if (!other || other.id === seed.id) return;
          if (core.duplicateScore(seed, other, mergeOpts).match) keepIds[other.id] = true;
        });
      });
      var nodes = gr.nodes.filter(function (n) { return keepIds[n.id]; });
      if (nodes.length < 2) return null;
      var keep = core.pickDuplicateKeeper(nodes);
      return { id: keep.id, keep: keep, nodes: nodes, drop: nodes.filter(function (n) { return !keep || n.id !== keep.id; }), reasons: gr.reasons || [], score: gr.score || 0, contentScore: gr.contentScore || 0, titleSim: gr.titleSim || 0, containment: gr.containment || 0, confidence: gr.confidence || "low" };
    })
    .filter(Boolean);
}

class MergeDuplicatesModal extends obsidian.Modal {
  constructor(app, plugin, groups, opts) {
    super(app);
    this.plugin = plugin;
    this.groups = (groups || []).slice();
    this.graph = (opts || {}).graph || null;
    this.caption = (opts || {}).title || "Merge duplicate vertices";
    this.busy = false;
    this.selected = {};
    this.keepers = {};
    var self = this;
    this.groups.forEach(function (g) {
      self.selected[g.id] = true;
      self.keepers[g.id] = g.keep.id;
    });
  }

  groupPlan(gr, keeperId) {
    if (!this.graph) return null;
    var keeper = null;
    for (var i = 0; i < gr.nodes.length; i++) {
      if (gr.nodes[i].id === keeperId) { keeper = gr.nodes[i]; break; }
    }
    if (!keeper) keeper = gr.keep;
    try {
      return core.planNodeMerge(this.graph, { keep: keeper, drop: gr.nodes.filter(function (n) { return n.id !== keeper.id; }) });
    } catch (e) {
      return null;
    }
  }

  onOpen() {
    var content = this.contentEl;
    this.modalEl.addClass("lg-modal-wide");
    content.addClass("lg-modal");
    content.addClass("lg-merge");
    var self = this;
    content.createEl("h2", { text: this.caption + (this.groups.length ? " — групп: " + this.groups.length : "") });
    content.createDiv({
      cls: "lg-modal-hint",
      text: "Дубликат — вершины одного уровня с одинаковым (или очень похожим) названием, переводом и содержимым; учитываются также ключевые фразы и общие связи. Одна и та же тема в разных главах — не дубликат. Ссылки, дети, фразы и подписи переносятся в keeper, дубли уходят в корзину, отмена — командой «Undo last duplicate merge».",
    });
    if (!this.groups.length) {
      content.createDiv({
        cls: "lg-merge__empty",
        text: "Дубликаты не найдены. Если вершины выглядят одинаково, но живут в разных главах или у них разное содержимое, — это штатные позиции курса, и сливать их не нужно.",
      });
      var btns0 = content.createDiv({ cls: "lg-modal-btns" });
      btns0.createEl("button", { text: "Закрыть", attr: { type: "button" } }).addEventListener("click", () => this.close());
      return;
    }
    var toolbar = content.createDiv({ cls: "lg-merge__toolbar" });
    toolbar.createEl("a", { text: "Выбрать все", href: "#" }).addEventListener("click", (ev) => { ev.preventDefault(); self.toggleAll(true); });
    toolbar.createEl("span", { text: " · " });
    toolbar.createEl("a", { text: "Снять все", href: "#" }).addEventListener("click", (ev) => { ev.preventDefault(); self.toggleAll(false); });
    var list = content.createDiv({ cls: "lg-merge__list" });
    this.groups.forEach(function (gr, gi) {
      list.appendChild(self.renderGroup(gr, gi));
    });
    var btns = content.createDiv({ cls: "lg-modal-btns" });
    this.mergeBtn = btns.createEl("button", { cls: "mod-cta", text: "…", attr: { type: "button" } });
    this.mergeBtn.addEventListener("click", () => this.submit());
    btns.createEl("button", { text: "Отмена", attr: { type: "button" } }).addEventListener("click", () => this.close());
    this.updateMergeBtn();
  }

  toggleAll(v) {
    var self = this;
    this.groups.forEach(function (g) { self.selected[g.id] = v; });
    var boxes = this.contentEl.querySelectorAll("input[data-lg-group]");
    for (var i = 0; i < boxes.length; i++) boxes[i].checked = v;
    this.updateMergeBtn();
  }

  selectedGroups() {
    var self = this;
    return this.groups.filter(function (g) { return self.selected[g.id]; });
  }

  updateMergeBtn() {
    if (!this.mergeBtn) return;
    var sel = this.selectedGroups();
    var nodes = sel.reduce(function (s, g) { return s + g.nodes.length; }, 0);
    this.mergeBtn.setText(sel.length ? "Merge selected (" + sel.length + " групп · " + nodes + " вершин)" : "Нечего сливать");
    this.mergeBtn.disabled = !sel.length || this.busy;
  }

  renderGroup(gr, gi) {
    var self = this;
    var box = document.createElement("div");
    box.className = "lg-merge__group";
    var head = document.createElement("div");
    head.className = "lg-merge__head";
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = true;
    cb.setAttribute("data-lg-group", gr.id);
    cb.addEventListener("change", function () {
      self.selected[gr.id] = cb.checked;
      box.classList.toggle("lg-merge__group--off", !cb.checked);
      self.updateMergeBtn();
    });
    head.appendChild(cb);
    var title = document.createElement("div");
    title.className = "lg-merge__title";
    var conf = gr.confidence || "low";
    title.textContent = "Группа " + (gi + 1) + " · " + (TYPE_LABEL[gr.keep.type] || gr.keep.type) + " · " + gr.nodes.length + " вершин · score " + (gr.score !== undefined ? gr.score : "—") + " · " + dupConfidenceLabel(conf);
    head.appendChild(title);
    var badge = document.createElement("span");
    badge.className = "lg-merge__badge lg-merge__badge--" + conf;
    badge.textContent = dupConfidenceLabel(conf);
    head.appendChild(badge);
    box.appendChild(head);

    var reasons = document.createElement("div");
    reasons.className = "lg-merge__reasons";
    reasons.textContent = "Почему дубликат: " + (gr.reasons || []).map(dupReasonLabel).join("; ");
    box.appendChild(reasons);

    var keepRow = document.createElement("div");
    keepRow.className = "lg-merge__keeper";
    keepRow.appendChild(document.createTextNode("Оставить (keeper): "));
    var sel = document.createElement("select");
    gr.nodes.forEach(function (n) {
      var o = document.createElement("option");
      o.value = n.id;
      o.textContent = (n.name || n.id) + " · " + n.id + " · ⇠" + (n.degree || 0);
      if (n.id === gr.keep.id) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      self.keepers[gr.id] = sel.value;
      planLine.textContent = self.planText(gr, sel.value);
      warnLine.textContent = self.warnText(gr, sel.value);
      warnLine.style.display = warnLine.textContent ? "" : "none";
    });
    keepRow.appendChild(sel);
    box.appendChild(keepRow);

    var ul = document.createElement("ul");
    ul.className = "lg-merge__nodes";
    gr.nodes.forEach(function (n) {
      var li = document.createElement("li");
      var bits = [(n.name || n.id) + (n.nameZh ? " · " + n.nameZh : "")];
      bits.push("id " + n.id);
      bits.push("⇠" + (n.degree || 0) + " / ⇢" + (n.outCount || 0));
      if (n.parent) bits.push("parent " + n.parent);
      if (n.chapter) bits.push("глава " + n.chapter);
      if (n.isPlaceholder) bits.push("заглушка");
      if (/^MN-\d+$/.test(n.id)) bits.push("вручную");
      if (n.id === self.keepers[gr.id]) bits.push("KEEPER");
      li.textContent = bits.join(" · ");
      var path = document.createElement("div");
      path.className = "lg-modal-path";
      path.textContent = n.path;
      li.appendChild(path);
      ul.appendChild(li);
    });
    box.appendChild(ul);

    var planLine = document.createElement("div");
    planLine.className = "lg-merge__plan";
    planLine.textContent = this.planText(gr, gr.keep.id);
    box.appendChild(planLine);
    var warnLine = document.createElement("div");
    warnLine.className = "lg-merge__warn";
    warnLine.textContent = this.warnText(gr, gr.keep.id);
    if (!warnLine.textContent) warnLine.style.display = "none";
    box.appendChild(warnLine);
    return box;
  }

  planText(gr, keeperId) {
    var plan = this.groupPlan(gr, keeperId);
    if (!plan) return "План: keeper «" + keeperId + "», дублей " + (gr.nodes.length - 1) + ".";
    var links = (plan.refs || []).reduce(function (s, r) { return s + (r.links || 0); }, 0);
    return (
      "План: keeper «" + plan.keep.id + "», дублей " + plan.drop.length +
      " · входящих ссылок переписать: " + links + " в " + plan.refs.length + " заметках" +
      " · детей перевесить: " + plan.children.length +
      " · файлов затронет: " + plan.files
    );
  }

  warnText(gr, keeperId) {
    var plan = this.groupPlan(gr, keeperId);
    if (!plan || !plan.warnings || !plan.warnings.length) return "";
    return "Внимание: " + plan.warnings.join(" · ");
  }

  async submit() {
    if (this.busy) return;
    var sel = this.selectedGroups();
    if (!sel.length) return;
    this.busy = true;
    this.updateMergeBtn();
    var ids = [];
    var keepers = {};
    var self = this;
    sel.forEach(function (gr) {
      var keeper = self.keepers[gr.id] || gr.keep.id;
      gr.nodes.forEach(function (n) {
        ids.push(n.id);
        keepers[n.id] = keeper;
      });
    });
    this.close();
    try {
      await this.plugin.mergeDuplicateNodes({ ids: ids, keepers: keepers });
    } finally {
      this.busy = false;
    }
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
      .setName("Спрашивать подтверждение перед удалением вершины")
      .setDesc("Окно показывает последствия: куда уйдёт заметка, сколько ссылок снимется и в каких заметках, кто из детей перевесится на родителя. Выключено — Delete удаляет сразу.")
      .addToggle((t) => t.setValue(s.confirmDelete !== false).onChange((v) => ((s.confirmDelete = v), save())));
    new obsidian.Setting(el)
      .setName("Клавиша Delete удаляет выделенную вершину")
      .setDesc("В окне графа Delete удаляет выделенный узел, Backspace — то же (на macOS клавиши Delete нет). В полях ввода клавиша работает как обычно.")
      .addToggle((t) => t.setValue(s.deleteKey !== false).onChange((v) => ((s.deleteKey = v), save())));
    new obsidian.Setting(el)
      .setName("Автослияние дубликатов после создания узла")
      .setDesc("После команды Create node плагин сравнивает новую заметку с вершинами того же уровня: одинаковое или очень похожее название, перевод, содержимое, ключевые фразы и общие связи — сигналы дубликата (одна тема в разных главах — не дубликат). Совпавшие сливаются в одну заметку: связи, дети, фразы и подписи переносятся, дубль уходит в корзину. Массовое слияние — правый клик по пустому холсту графа, с предпросмотром.")
      .addToggle((t) => t.setValue(s.autoMergeDuplicates !== false).onChange((v) => ((s.autoMergeDuplicates = v), save())));
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

    /* Цвет отдельной вершины: выбрать узел графа и назначить ему другой цвет — из
       уже используемых в графе или собственный. Пишется то же свойство color:, что
       и из контекстного меню графа, поэтому оба пути взаимозаменяемы. */
    el.createEl("h3", { text: "Цвет отдельной вершины" });
    var plugin = this.plugin;
    var colorBox = el.createDiv({ cls: "lg-node-color-settings" });
    var renderNodeColorPicker = function (graph) {
      colorBox.textContent = "";
      var nodes = (graph.nodes || []).filter(function (n) { return !n.inline; });
      nodes.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
      colorBox.createDiv({
        cls: "lg-modal-hint",
        text: "Найдите вершину и назначьте ей другой цвет — из уже используемых в графе или собственный. " +
          "Цвет сохраняется в свойство " + (s.colorKey || "color") + " заметки и перебивает цвет главы и цвет типа; " +
          "кнопка «как у главы/типа» в окне снимает свойство.",
      });
      var fSearch = colorBox.createDiv({ cls: "lg-field" });
      fSearch.createEl("label", { text: "Найти вершину", attr: { for: "lg-color-node-search" } });
      var search = fSearch.createEl("input", {
        type: "search",
        attr: { id: "lg-color-node-search", placeholder: "id, название, перевод или путь", autocomplete: "off" },
      });
      var fSel = colorBox.createDiv({ cls: "lg-field" });
      fSel.createEl("label", { text: "Вершина", attr: { for: "lg-color-node-sel" } });
      var sel = fSel.createEl("select", { attr: { id: "lg-color-node-sel" } });
      var info = colorBox.createDiv({ cls: "lg-node-color-settings__info", attr: { "aria-live": "polite" } });
      var btns = colorBox.createDiv({ cls: "lg-node-color-settings__btns" });
      var pick = btns.createEl("button", { text: "Выбрать цвет…", cls: "mod-cta", attr: { type: "button" } });
      var LIMIT = 400; // верхнее окно селекта: дальше — только через поиск
      var byId = function (id) {
        for (var i = 0; i < nodes.length; i++) if (nodes[i].id === id) return nodes[i];
        return null;
      };
      var updInfo = function () {
        var n = byId(sel.value);
        info.textContent = "";
        pick.disabled = !n;
        if (!n) {
          info.setText("Вершин в графе: " + nodes.length);
          return;
        }
        info.createSpan({
          cls: "lg-node-color__dot lg-node-color__dot--sm",
          attr: { style: "background:" + (n.color || "#888888") },
        });
        var own = core.isHexColor(n.colorProp);
        var why = own
          ? "свой цвет (" + core.normalizeHexColor(n.colorProp) + ")"
          : (graph.colorsByChapter || {})[n.kwChapter || n.chapter]
            ? "цвет главы " + (n.kwChapter || n.chapter)
            : "цвет типа «" + (TYPE_LABEL[n.type] || n.type) + "»";
        info.createSpan({ text: " " + (n.color || "") + " · " + why });
      };
      var fill = function () {
        var q = search.value.trim().toLowerCase();
        var list = !q
          ? nodes
          : nodes.filter(function (n) {
              return (n.id + " " + (n.name || "") + " " + (n.nameZh || "") + " " + n.path).toLowerCase().indexOf(q) >= 0;
            });
        sel.textContent = "";
        if (!list.length) {
          sel.createEl("option", { text: "— ничего не найдено —", attr: { value: "" } });
        } else {
          list.slice(0, LIMIT).forEach(function (n) {
            sel.createEl("option", { text: n.id + " — " + (n.name || n.id), attr: { value: n.id } });
          });
        }
        updInfo();
      };
      search.addEventListener("input", fill);
      sel.addEventListener("change", updInfo);
      pick.addEventListener("click", function () {
        var n = byId(sel.value);
        if (!n) return;
        // окно то же, что из графа (ПКМ по вершине); после закрытия обновляем строку
        plugin.editNodeColor(n, { onDone: function () { updInfo(); } });
      });
      fill();
    };
    if (plugin.cache && plugin.cache.nodes && plugin.cache.nodes.length && !plugin.cacheDirty) {
      renderNodeColorPicker(plugin.cache);
    } else {
      // список вершин собирается асинхронно; settings-вкладку это не должно блокировать
      colorBox.createDiv({ cls: "lg-modal-hint", text: "Собираем список вершин графа…" });
      plugin
        .getGraph(false)
        .then(function (g) {
          if (colorBox.isConnected) renderNodeColorPicker(g);
        })
        .catch((e) => {
          if (!colorBox.isConnected) return;
          colorBox.textContent = "";
          colorBox.createDiv({
            cls: "lg-modal-hint",
            text: "Не удалось собрать список вершин: " + (e && e.message ? e.message : e),
          });
        });
    }

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
    this.lastMerge = null;
    this.manualMergeModal = null;
    this.mergingManually = false;

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
    this.addCommand({
      id: "set-selected-node-color",
      name: "Set color of the selected vertex (existing palette or custom)",
      callback: () => {
        var v = this.view();
        if (!v || !v.selected || !v.byId[v.selected]) {
          return new obsidian.Notice("Сначала выделите вершину на графе (клик по ней)");
        }
        return this.editNodeColor(v.byId[v.selected]);
      },
    });
    this.addCommand({
      id: "set-node-color",
      name: "Set the color of the current note's vertex",
      editorCallback: () => {
        var f = this.app.workspace.getActiveFile();
        if (!f) return new obsidian.Notice("Откройте заметку-вершину");
        var node = this.nodeByPath(f.path);
        if (!node) return new obsidian.Notice("Заметка не является вершиной графа (нет type: в frontmatter)");
        return this.editNodeColor(node);
      },
    });
    this.addCommand({
      id: "manual-merge-selected",
      name: "Manually merge the selected vertex with another vertex",
      callback: () => {
        var v = this.view();
        if (!v || !v.selected || !v.byId[v.selected]) {
          return new obsidian.Notice("Ручное слияние: сначала выделите вершину на графе");
        }
        return this.openManualMerge(v.byId[v.selected]);
      },
    });
    this.addCommand({
      id: "manual-merge-current-note",
      name: "Manually merge the current note with another vertex",
      editorCallback: () => {
        var f = this.app.workspace.getActiveFile();
        if (!f) return new obsidian.Notice("Откройте заметку-вершину");
        var node = this.nodeByPath(f.path);
        if (!node) return new obsidian.Notice("Заметка не является вершиной графа (нет type: в frontmatter)");
        return this.openManualMerge(node);
      },
    });
    this.addCommand({
      id: "merge-duplicates",
      name: "Merge duplicate vertices (same title / same content)",
      callback: () => this.mergeDuplicateNodes(),
    });
    this.addCommand({
      id: "preview-duplicates",
      name: "Preview duplicate groups (choose what to merge)",
      callback: () => this.previewDuplicateNodes(),
    });
    this.addCommand({
      id: "preview-current-note-duplicates",
      name: "Preview duplicates of the current note",
      editorCallback: () => {
        var f = this.app.workspace.getActiveFile();
        if (!f) return new obsidian.Notice("Откройте заметку-вершину");
        var node = this.nodeByPath(f.path);
        if (!node) return new obsidian.Notice("Заметка не является вершиной графа (нет type: в frontmatter)");
        return this.previewDuplicateNodes({ ids: [node.id] });
      },
    });
    this.addCommand({
      id: "merge-current-note-duplicates",
      name: "Merge duplicates of the current note",
      editorCallback: () => {
        var f = this.app.workspace.getActiveFile();
        if (!f) return new obsidian.Notice("Откройте заметку-вершину");
        var node = this.nodeByPath(f.path);
        if (!node) return new obsidian.Notice("Заметка не является вершиной графа (нет type: в frontmatter)");
        return this.mergeDuplicateNodes({ ids: [node.id] });
      },
    });
    this.addCommand({
      id: "undo-merge-duplicates",
      name: "Undo last node merge (duplicate or manual)",
      callback: () => this.undoDuplicateMerge(),
    });
    this.addCommand({
      id: "undo-node-merge",
      name: "Undo last node merge",
      callback: () => this.undoDuplicateMerge(),
    });
    this.addCommand({
      id: "delete-node",
      name: "Delete selected vertex (Delete/Backspace key)",
      callback: () => {
        var v = this.view();
        if (!v) return new obsidian.Notice("Откройте представление графа (Lecture graph)");
        return v.deleteSelected();
      },
    });
    this.addCommand({
      id: "undo-delete",
      name: "Undo last vertex deletion (restore note and links)",
      callback: () => this.undoDelete(),
    });
    this.addCommand({
      id: "delete-current-note",
      name: "Delete the vertex of the current note (with confirm)",
      editorCallback: () => {
        var f = this.app.workspace.getActiveFile();
        if (!f) return new obsidian.Notice("Откройте заметку-вершину");
        var node = this.nodeByPath(f.path);
        if (!node) return new obsidian.Notice("Заметка не является вершиной графа (нет type: в frontmatter)");
        return this.confirmDeleteNode(node);
      },
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
      menu.addItem((it) =>
        it
          .setTitle("Цвет вершины графа…")
          .setIcon("palette")
          .onClick(async () => {
            var g = await this.getGraph(false);
            var node = g.nodes.find((n) => n.path === file.path && !n.inline);
            if (!node) new obsidian.Notice("Заметка не является вершиной графа (нет type: в frontmatter)");
            else this.editNodeColor(node);
          })
      );
      menu.addItem((it) =>
        it
          .setTitle("Ручное слияние с другим узлом…")
          .setIcon("combine")
          .onClick(async () => {
            var g = await this.getGraph(false);
            var node = g.nodes.find((n) => n.path === file.path);
            if (!node) new obsidian.Notice("Заметка не является вершиной графа (нет type: в frontmatter)");
            else this.openManualMerge(node);
          })
      );
      menu.addItem((it) =>
        it
          .setTitle("Merge duplicates of this vertex")
          .setIcon("git-merge")
          .onClick(async () => {
            var g = await this.getGraph(false);
            var node = g.nodes.find((n) => n.path === file.path);
            if (!node) new obsidian.Notice("Заметка не является вершиной графа (нет type: в frontmatter)");
            else this.mergeDuplicateNodes({ ids: [node.id] });
          })
      );
      menu.addItem((it) =>
        it
          .setTitle("Preview duplicates of this vertex…")
          .setIcon("eye")
          .onClick(async () => {
            var g = await this.getGraph(false);
            var node = g.nodes.find((n) => n.path === file.path);
            if (!node) new obsidian.Notice("Заметка не является вершиной графа (нет type: в frontmatter)");
            else this.previewDuplicateNodes({ ids: [node.id] });
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

  /* -------------------------------------------------- цвет вершины */

  /**
   * Все цвета, которые уже есть в графе: палитра глав, цвета типов и собственные
   * color: у вершин (в этом порядке — от привычного к редкому). Из этого списка
   * состоят ряды образцов в окне выбора цвета и при создании узла, поэтому новый
   * цвет можно взять «как у соседей», а не подбирать заново.
   */
  usedColors(graph) {
    var out = [];
    var seen = {};
    var push = function (c) {
      var v = core.normalizeHexColor(c);
      if (!v || seen[v]) return;
      seen[v] = true;
      out.push(v);
    };
    (this.settings.chapterPalette || []).forEach(push);
    TYPES.forEach((t) => push((this.settings.colors || {})[t]));
    var g = graph || this.cache;
    if (g && g.nodes) g.nodes.forEach(function (n) { push(n.colorProp); push(n.color); });
    return out;
  }

  /** Открыть окно выбора цвета вершины (свойство color: в frontmatter). */
  editNodeColor(node, opts) {
    if (!node) return;
    if (node.inline) {
      new obsidian.Notice("Инлайн-блок живёт в тексте чужой заметки и своего свойства color: не имеет");
      return;
    }
    var file = this.app.vault.getAbstractFileByPath(node.path);
    if (!(file instanceof obsidian.TFile)) {
      new obsidian.Notice("Файл не найден: " + node.path);
      return;
    }
    new NodeColorModal(this.app, this, node, opts).open();
  }

  /**
   * Записать (или снять — пустая строка) собственный цвет вершины. Граф не
   * перестраивается: color: уже в заметке, поэтому достаточно пересчитать цвета
   * на живой модели (core.resolveColors — O(n), раскладка не трогается) и
   * перерисовать открытые виды: круг на месте меняет заливку.
   */
  async writeNodeColor(node, color) {
    if (!node || !node.path) return false;
    var file = this.app.vault.getAbstractFileByPath(node.path);
    if (!(file instanceof obsidian.TFile)) {
      new obsidian.Notice("Файл не найден: " + node.path);
      return false;
    }
    var hex = core.normalizeHexColor(color);
    if (color && !hex) {
      new obsidian.Notice("Цвет выглядит не так: «#abc» или «#aabbcc» (получилось «" + color + "»)");
      return false;
    }
    var patch = {};
    patch[this.settings.colorKey || "color"] = hex; // пустое значение снимает ключ
    try {
      await this.processInternal(file, (data) => core.setFrontmatterValues(data, patch));
    } catch (e) {
      new obsidian.Notice("Не удалось записать цвет: " + (e && e.message ? e.message : e));
      return false;
    }
    node.colorProp = hex || null;
    // пересчитать цвета на живой модели (O(n), раскладка не трогается) и перерисовать
    // открытые виды: круг на месте меняет заливку. Графы у вида и кэша один и те же,
    // subset для фильтров держит те же объекты вершин, поэтому правка видна всюду
    var opts = buildOptions(this.settings);
    var graphs = [];
    if (this.cache && this.cache.nodes) graphs.push(this.cache);
    this.forEachView(function (v) {
      if (v.graph && v.graph.nodes && graphs.indexOf(v.graph) < 0) graphs.push(v.graph);
    });
    graphs.forEach(function (g) { core.resolveColors(g, opts); });
    this.forEachView(function (v) {
      if (v.redraw) v.redraw();
      if (v.updateStatus) v.updateStatus();
    });
    return true;
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
   *
   * Каждое попадание в аннотации даёт связь именно с соответствующей секцией или
   * заголовком — по всем главам, без отсечения по главе-лидеру. Лидер нужен только
   * для цвета (core.resolveColors читает n.kwChapter), а не для выбора ссылок.
   * При пересчёте удаляется только оставшийся от старых версий машинный раздел
   * «Related chapters»: его ссылки на главы не являются прямыми попаданиями корпуса.
   *
   * Свойства и тело вне региона/устаревшего раздела не трогаются; второй прогон
   * байт-в-байт идемпотентен.
   */
  async recomputeKeywords(runOpts) {
    runOpts = runOpts || {};
    var opts = buildOptions(this.settings);
    // Плану keyword-ссылок нужны свежие frontmatter/body, но не координаты. Читаем
    // модель напрямую, чтобы не делать полную раскладку и до, и после batch-записи.
    var g = await this.buildGraphModel(opts);
    var abs = await this.keywordCorpusNotes();
    if (!abs.length) {
      if (!runOpts.silent) new obsidian.Notice("Папка корпуса «" + opts.keywordFolder + "» пуста — ключевые фразы искать негде");
      return null;
    }
    var corpus = core.buildKeywordCorpus(abs, g, opts);
    var weightKey = opts.weightKey || "weight";
    var touched = 0, planned = 0, sumWeight = 0, cleaned = 0;
    var marks = core.keywordMarkers();
    var only = {};
    (runOpts.only || []).forEach(function (p) { if (p) only[String(p)] = true; });
    for (var i = 0; i < g.nodes.length; i++) {
      var n = g.nodes[i];
      if (n.inline || !n.path) continue;
      if (Object.keys(only).length && !only[n.path]) continue;
      var file = this.app.vault.getAbstractFileByPath(n.path);
      if (!(file instanceof obsidian.TFile)) continue;
      var hasRegion = String(n.body || "").indexOf(marks.begin) >= 0;
      var hasLegacyChapters = String(n.body || "").indexOf(core.CHAPTER_HEADING) >= 0;
      if (!(n.keywords && n.keywords.length)) {
        // Снимаем материализованные связи; legacy-раздел глав тоже должен уйти,
        // чтобы после удаления фраз не остались ложные тематические рёбра.
        if (!hasRegion && !hasLegacyChapters) continue;
        await this.processInternal(file, (data) => {
          var off = {};
          off[weightKey] = "";
          var cleared = core.applyRelatedChapters(core.applyKeywordRegion(data, ""), [], opts);
          var next = core.setFrontmatterValues(cleared, off);
          if (next === data) return data;
          cleaned++;
          return next;
        });
        continue;
      }
      // plan.targets содержит ВСЕ совпавшие области корпуса; dominant здесь
      // намеренно не участвует в отборе — он используется только при окрашивании.
      var plan = core.planBlockKeywords(n.data, corpus, n.chapter, opts);
      planned++;
      sumWeight += plan.weight;
      var want = core.keywordRegionText(plan, opts);
      await this.processInternal(file, (data) => {
        var patch = {};
        patch[weightKey] = plan.weight;
        var withRegion = core.applyKeywordRegion(data, want);
        // Убираем лишь машинный legacy-раздел из прежних версий. Новый код не
        // создаёт ссылки на главы: ссылки должны вести к реально совпавшим узлам.
        var withoutLegacyChapters = core.applyRelatedChapters(withRegion, [], opts);
        var next = core.setFrontmatterValues(withoutLegacyChapters, patch);
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
      (corpus.stats.unmatched ? " · НЕ СОПОСТАВЛЕНО заголовков в корпусе: " + corpus.stats.unmatched : "");
    if (!runOpts.silent) new obsidian.Notice(msg);
    // getGraph(true) выше уже обновил cache и все View; повторный changed() только
    // запустил бы ещё одну полную пересборку через debounce.
    return { planned: planned, touched: touched, cleaned: cleaned, weight: sumWeight, edges: kw };
  }

  /* -------------------------------------------------- слияние узлов */

  /** Открыть поиск второго узла для ручного слияния по свежей модели графа. */
  async openManualMerge(nodeOrId) {
    var opts = buildOptions(this.settings);
    var g = await this.buildGraphModel(opts);
    var id = nodeOrId && nodeOrId.id ? nodeOrId.id : String(nodeOrId || "");
    var path = nodeOrId && nodeOrId.path ? nodeOrId.path : "";
    var source = (g._byId && g._byId[id]) || (path ? g.nodes.find(function (n) { return n.path === path && !n.inline; }) : null);
    if (!source) {
      new obsidian.Notice("Ручное слияние: выбранный узел больше не существует — перестройте граф");
      return null;
    }
    if (source.inline) {
      new obsidian.Notice("Инлайн-блок нельзя сливать как отдельную заметку: откройте содержащий его файл");
      return null;
    }
    if (this.manualMergeModal && this.manualMergeModal.isOpen) this.manualMergeModal.close();
    var modal = new ManualMergeModal(this.app, this, source, g);
    this.manualMergeModal = modal;
    modal.open();
    return modal;
  }

  /**
   * Выполнить явно выбранное слияние двух узлов. В автоматическую эвристику эта
   * операция не заходит: единственные guard'ы — существование файлов, разные id и
   * одинаковый тип. Вся файловая механика общая с mergeDuplicateGroup, поэтому
   * ручное слияние так же ретаргетит wiki-ссылки/^якоря, перевешивает детей,
   * объединяет frontmatter/caption и поддерживает session-only Undo.
   */
  async mergeNodesManually(runOpts) {
    runOpts = runOpts || {};
    if (this.mergingManually) {
      new obsidian.Notice("Ручное слияние уже выполняется");
      return null;
    }
    var mergeOpts = buildOptions(this.settings);
    var g = await this.buildGraphModel(mergeOpts);
    var source = g._byId && g._byId[String(runOpts.sourceId || "")];
    var target = g._byId && g._byId[String(runOpts.targetId || "")];
    if (!source || !target) {
      new obsidian.Notice("Ручное слияние: один из выбранных узлов больше не существует");
      return null;
    }
    if (source.id === target.id) {
      new obsidian.Notice("Нельзя объединить узел с самим собой");
      return null;
    }
    if (source.inline || target.inline || !source.path || !target.path) {
      new obsidian.Notice("Ручное слияние доступно только для узлов-заметок, не для инлайн-блоков");
      return null;
    }
    if (source.type !== target.type) {
      new obsidian.Notice("Нельзя объединить узлы разных уровней: " + source.type + " и " + target.type);
      return null;
    }
    var keeperId = String(runOpts.keeperId || source.id);
    if (keeperId !== source.id && keeperId !== target.id) {
      new obsidian.Notice("Ручное слияние: неверно выбран keeper");
      return null;
    }
    var keep = keeperId === target.id ? target : source;
    var drop = keep.id === source.id ? target : source;
    var group = { id: keep.id, keep: keep, nodes: [keep, drop], drop: [drop], reasons: ["manual"], confidence: "manual" };
    var snapshotMap = {};
    var snapshot = function (path, text) {
      if (snapshotMap[path] === undefined) snapshotMap[path] = text;
    };
    this.mergingManually = true;
    var result;
    try {
      result = await this.mergeDuplicateGroup(g, group, { snapshot: snapshot, manualMerge: true });
    } catch (e) {
      new obsidian.Notice("Не удалось объединить узлы: " + (e && e.message ? e.message : e));
      return null;
    } finally {
      this.mergingManually = false;
    }
    if (!result) {
      new obsidian.Notice("Не удалось объединить узлы: keeper недоступен для записи");
      return null;
    }
    this.lastMerge = {
      at: Date.now(),
      mode: "manual",
      sourceId: source.id,
      targetId: target.id,
      files: Object.keys(snapshotMap).map(function (p) { return { path: p, text: snapshotMap[p] }; }),
      results: [result],
    };
    await this.recomputeKeywords({ only: [result.keepPath], silent: true });
    this.markGraphDirty();
    var fresh = await this.getGraph(true);
    this.forEachView(function (v) {
      v.refresh(false);
      if (fresh._byId[result.keepId]) v.select(result.keepId, true);
    });
    var msg = "Узлы объединены вручную: оставлен «" + result.keepName + "» · удалён узел " + drop.id +
      (result.retargeted ? " · перенаправлено ссылок " + result.retargeted : "") +
      (result.reparented ? " · детей перевешено " + result.reparented : "") +
      " · отмена: команда ‘Undo last node merge’";
    new obsidian.Notice(msg);
    this.forEachView(function (v) { v.setStatus(msg, 9000); });
    return { merged: 1, focusId: result.keepId, result: result, files: Object.keys(snapshotMap).length };
  }

  /* Автоматическое/групповое слияние дубликатов использует тот же файловый конвейер. */
  async mergeDuplicateCaptions(keep, drops, snapshot, runOpts) {
    var keepCap = this.findCaptionFile(keep);
    var pool = [];
    if (keepCap) pool.push({ node: keep, file: keepCap });
    (drops || []).forEach((n) => {
      var f = this.findCaptionFile(n);
      if (f) pool.push({ node: n, file: f });
    });
    if (!pool.length) return { captionPatch: keep.caption ? "[[" + String(keep.caption).replace(/^.*\//, "").replace(/\.md$/i, "") + "]]" : "", touched: 0, deleted: 0 };
    var chosen = keepCap ? pool[0] : pool[0];
    var chosenFile = chosen.file;
    var chosenRaw = await this.app.vault.cachedRead(chosenFile);
    var changed = 0;
    var deleted = 0;
    var mergedBody = core.parseFrontmatter(chosenRaw).body.trim();
    var mergedRaw = chosenRaw;
    for (var i = 0; i < pool.length; i++) {
      var item = pool[i];
      if (!item.file || item.file.path === chosenFile.path) continue;
      var raw = await this.app.vault.cachedRead(item.file);
      snapshot(item.file.path, raw);
      mergedBody = mergeLooseBodies(mergedBody, core.parseFrontmatter(raw).body.trim(),
        (runOpts && runOpts.manualMerge ? "Caption merged manually from " : "Merged duplicate caption from ") +
          ((item.node && item.node.id) || item.file.basename));
    }
    mergedRaw = replaceNoteBody(mergedRaw, mergedBody);
    mergedRaw = core.setFrontmatterValues(mergedRaw, { node: keep.id, level: keep.type, color: keep.color || "" });
    if (mergedRaw !== chosenRaw) {
      snapshot(chosenFile.path, chosenRaw);
      await this.processInternal(chosenFile, function () { return mergedRaw; });
      changed++;
    }
    for (var j = 0; j < pool.length; j++) {
      var extra = pool[j];
      if (!extra.file || extra.file.path === chosenFile.path) continue;
      await this.withInternalWrite(extra.file.path, () => this.trashFile(extra.file));
      deleted++;
    }
    return { captionPatch: "[[" + chosenFile.basename + "]]", touched: changed, deleted: deleted, path: chosenFile.path };
  }

  async previewDuplicateNodes(opts) {
    opts = opts || {};
    var mergeOpts = buildOptions(this.settings);
    var g = await this.buildGraphModel(mergeOpts);
    var groups = core.findDuplicateGroups(g, mergeOpts);
    var target = {};
    (opts.ids || []).forEach(function (id) {
      var key = id && id.id ? id.id : id;
      if (key) target[String(key)] = true;
    });
    if (Object.keys(target).length) groups = narrowDuplicateGroups(groups, target, mergeOpts);
    var title = opts.title || (Object.keys(target).length ? "Merge duplicates of vertex" : "Merge all duplicate vertices");
    new MergeDuplicatesModal(this.app, this, groups, { graph: g, title: title }).open();
    return groups;
  }

  async mergeDuplicateGroup(graph, group, bag) {
    var opts = buildOptions(this.settings);
    if (bag && bag.manualMerge) opts.manualMerge = true;
    var plan = core.planNodeMerge(graph, group, opts);
    if (!plan || !plan.keep || !plan.drop.length) return null;
    var keep = plan.keep;
    var keepFile = this.app.vault.getAbstractFileByPath(keep.path);
    if (!(keepFile instanceof obsidian.TFile)) return null;
    var snapshot = bag && bag.snapshot ? bag.snapshot : function () {};
    var keepRaw = await this.app.vault.cachedRead(keepFile);
    var keepParsed = core.parseFrontmatter(keepRaw);
    var keepNode = Object.assign({}, keep, { body: keepParsed.body, data: keepParsed.data });
    var mergedRaw = keepRaw;
    var replacements = [];
    var appended = 0;
    var inlineByPath = {};
    (plan.targets || []).forEach(function (t) {
      if (!t || !t.inline) return;
      (inlineByPath[t.path] || (inlineByPath[t.path] = [])).push(t);
    });
    for (var i = 0; i < plan.drop.length; i++) {
      var drop = plan.drop[i];
      var dropFile = this.app.vault.getAbstractFileByPath(drop.path);
      var dropRaw = dropFile instanceof obsidian.TFile ? await this.app.vault.cachedRead(dropFile) : null;
      if (dropRaw !== null) snapshot(drop.path, dropRaw);
      var dropParsed = dropRaw === null ? { body: drop.body || "", data: drop.data || {} } : core.parseFrontmatter(dropRaw);
      var dropNode = Object.assign({}, drop, { body: dropParsed.body, data: dropParsed.data });
      var merged = core.mergeNodeBodies(keepNode, dropNode, opts);
      keepNode.body = merged.body;
      mergedRaw = replaceNoteBody(mergedRaw, merged.body);
      if (merged.appended) appended++;
      replacements.push({ from: dropNode, to: keepNode, anchorMap: merged.anchorMap || {} });
      var inlineTargets = (inlineByPath[drop.path] || []).slice();
      if (!inlineTargets.length) {
        inlineTargets = core.extractAnchors(dropNode.body || "").map(function (a) {
          return {
            id: dropNode.stem + "#^" + a.id,
            inline: true,
            anchorName: a.id,
            parent: dropNode.id,
            stem: dropNode.stem,
            path: dropNode.path,
          };
        });
      }
      inlineTargets.forEach(function (x) {
        replacements.push({ from: x, to: keepNode, anchorMap: merged.anchorMap || {} });
      });
    }
    var patch = core.mergedNodePatch(keepNode, plan.drop, opts);
    var cap = await this.mergeDuplicateCaptions(keepNode, plan.drop, snapshot, bag);
    if (cap && cap.captionPatch) patch[this.settings.captionKey || "caption"] = cap.captionPatch;
    var keepRewrite = core.retargetLinks(mergedRaw, replacements, { currentNode: keepNode, graph: graph });
    mergedRaw = keepRewrite.text;
    mergedRaw = core.setFrontmatterValues(mergedRaw, patch);

    var dropIds = {};
    plan.drop.forEach(function (n) { dropIds[n.id] = true; });
    var chapterTarget = keepNode.type === "chapter" ? keepNode.id : (keepNode.chapter || "");
    var ops = {};
    var opFor = function (path, node) {
      return ops[path] || (ops[path] = { path: path, node: node || null, rewrite: false, patch: {}, merged: null });
    };
    opFor(keep.path, keepNode).merged = mergedRaw;
    var rewriteByPath = {};
    (plan.refs || []).forEach(function (r) {
      if (!r || !r.path || r.path === keep.path) return;
      rewriteByPath[r.path] = (graph._byId && graph._byId[r.id]) || null;
    });
    (graph.nodes || []).forEach(function (n) {
      if (!n || n.inline || !n.path || n.path === keep.path) return;
      if ((n.links || []).some(function (l) {
        return replacements.some(function (rep) { return core.linkTargetsNode(l, rep.from, graph); });
      })) rewriteByPath[n.path] = n;
    });
    Object.keys(rewriteByPath).forEach(function (p) {
      opFor(p, rewriteByPath[p]).rewrite = true;
    });
    (plan.children || []).forEach(function (c) {
      var op = opFor(c.path, (graph._byId && graph._byId[c.id]) || null);
      if (c.parent !== keepNode.id) op.patch[this.settings.parentKey || "parent"] = keepNode.id;
      if (c.chapter !== chapterTarget) op.patch[this.settings.chapterKey || "chapter"] = chapterTarget || "";
    }, this);

    var touched = 0;
    var retargeted = keepRewrite.replaced + keepRewrite.removed;
    var reparented = 0;
    var paths = Object.keys(ops);
    for (var p = 0; p < paths.length; p++) {
      var op = ops[paths[p]];
      var file = this.app.vault.getAbstractFileByPath(op.path);
      if (!(file instanceof obsidian.TFile)) continue;
      var before = op.path === keep.path ? keepRaw : await this.app.vault.cachedRead(file);
      var after = op.merged !== null ? op.merged : before;
      if (op.rewrite && op.path !== keep.path) {
        var rr = core.retargetLinks(after, replacements, { currentNode: op.node, graph: graph });
        after = rr.text;
        retargeted += rr.replaced + rr.removed;
      }
      if (Object.keys(op.patch).length) {
        after = core.setFrontmatterValues(after, op.patch);
        if (op.patch[this.settings.parentKey || "parent"] !== undefined || op.patch[this.settings.chapterKey || "chapter"] !== undefined) reparented++;
      }
      if (after === before) continue;
      snapshot(op.path, before);
      await this.processInternal(file, function () { return after; });
      touched++;
    }

    for (var d = 0; d < plan.drop.length; d++) {
      var dup = plan.drop[d];
      var target = this.app.vault.getAbstractFileByPath(dup.path);
      if (!(target instanceof obsidian.TFile)) continue;
      await this.withInternalWrite(dup.path, () => this.trashFile(target));
    }

    return {
      keepId: keepNode.id,
      keepPath: keepNode.path,
      keepName: keepNode.name || keepNode.id,
      dropIds: plan.drop.map(function (n) { return n.id; }),
      dropPaths: plan.drop.map(function (n) { return n.path; }),
      touched: touched,
      appended: appended,
      retargeted: retargeted,
      reparented: reparented,
      captionTouched: cap ? cap.touched : 0,
      captionDeleted: cap ? cap.deleted : 0,
    };
  }

  async mergeDuplicateNodes(runOpts) {
    runOpts = runOpts || {};
    var target = {};
    (runOpts.ids || []).forEach(function (id) {
      var key = id && id.id ? id.id : id;
      if (key) target[String(key)] = true;
    });
    var targeted = Object.keys(target).length > 0;
    var snapshotMap = {};
    var snapshot = function (path, text) {
      if (snapshotMap[path] === undefined) snapshotMap[path] = text;
    };
    var merged = [];
    var keepPaths = {};
    var groups = 0;
    var guard = 0;
    while (guard++ < 40) {
      var mergeOpts = buildOptions(this.settings);
      var g = await this.buildGraphModel(mergeOpts);
      var dup = core.findDuplicateGroups(g, mergeOpts);
      if (Object.keys(target).length) dup = narrowDuplicateGroups(dup, target, mergeOpts);
      if (!dup.length) break;
      var grp = dup[0];
      // выбор keeper из окна предпросмотра: все вершины группы единогласно
      // указывают на него (иначе граф успел измениться — берём keeper по умолчанию)
      if (runOpts.keepers) {
        var votes = {};
        grp.nodes.forEach(function (n) {
          var k = runOpts.keepers[n.id];
          if (k) votes[k] = (votes[k] || 0) + 1;
        });
        var best = null, bestCount = 0;
        Object.keys(votes).forEach(function (k) {
          if (votes[k] > bestCount) { bestCount = votes[k]; best = k; }
        });
        if (best && bestCount === grp.nodes.length) {
          var want = null;
          for (var wi = 0; wi < grp.nodes.length; wi++) {
            if (grp.nodes[wi].id === best) { want = grp.nodes[wi]; break; }
          }
          if (want && want.id !== grp.keep.id) {
            grp = { id: want.id, keep: want, nodes: grp.nodes, drop: grp.nodes.filter(function (n) { return n.id !== want.id; }), reasons: grp.reasons || [], score: grp.score || 0 };
          }
        }
      }
      var res = await this.mergeDuplicateGroup(g, grp, { snapshot: snapshot });
      if (!res) break;
      merged.push(res);
      keepPaths[res.keepPath] = true;
      groups++;
      if (Object.keys(target).length) {
        dup[0].nodes.forEach(function (n) { delete target[n.id]; });
        if (targeted && !Object.keys(target).length) break;
      }
    }
    if (!merged.length) {
      if (!runOpts.silent) new obsidian.Notice(Object.keys(target).length ? "Для выбранной вершины дубликаты не найдены" : "Дубликаты не найдены");
      return { groups: 0, merged: 0, results: [] };
    }
    this.lastMerge = {
      at: Date.now(),
      mode: "duplicates",
      files: Object.keys(snapshotMap).map(function (p) { return { path: p, text: snapshotMap[p] }; }),
      results: merged.slice(),
    };
    await this.recomputeKeywords({ only: Object.keys(keepPaths), silent: true });
    this.markGraphDirty();
    var fresh = await this.getGraph(true);
    var focus = merged[merged.length - 1].keepId;
    this.forEachView(function (v) {
      v.refresh(false);
      if (focus && fresh._byId[focus]) v.select(focus, true);
    });
    var mergedNodes = merged.reduce(function (sum, r) { return sum + r.dropIds.length; }, 0);
    var rewired = merged.reduce(function (sum, r) { return sum + r.retargeted; }, 0);
    var reparented = merged.reduce(function (sum, r) { return sum + r.reparented; }, 0);
    var msg = "Дубликаты объединены: групп " + groups + " · слито вершин " + mergedNodes +
      (rewired ? " · перенаправлено ссылок " + rewired : "") +
      (reparented ? " · детей перевешено " + reparented : "") +
      " · отмена: команда ‘Undo last duplicate merge’";
    if (!runOpts.silent) {
      new obsidian.Notice(msg);
      this.forEachView(function (v) { v.setStatus(msg, 8000); });
    }
    return { groups: groups, merged: mergedNodes, results: merged, focusId: focus, files: Object.keys(snapshotMap).length };
  }

  async undoDuplicateMerge() {
    var last = this.lastMerge;
    if (!last || !last.files || !last.files.length) {
      new obsidian.Notice("Отменять нечего: в этой сессии слияния узлов не было");
      return null;
    }
    var n = 0;
    for (var i = 0; i < last.files.length; i++) {
      try {
        await this.writeFile(last.files[i].path, last.files[i].text);
        n++;
      } catch (e) {
        new obsidian.Notice("Не удалось вернуть " + last.files[i].path + ": " + (e && e.message ? e.message : e));
      }
    }
    this.lastMerge = null;
    this.markGraphDirty();
    var g = await this.getGraph(true);
    var focus = last.results && last.results.length ? last.results[last.results.length - 1].keepId : null;
    this.forEachView(function (v) {
      v.refresh(false);
      if (focus && g._byId[focus]) v.select(focus, true);
    });
    var msg = (last.mode === "manual" ? "Ручное слияние отменено" : "Слияние дубликатов отменено") +
      ": восстановлено заметок — " + n;
    new obsidian.Notice(msg);
    this.forEachView(function (v) { v.setStatus(msg, 8000); });
    return { files: n };
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
   *   1) ключевые фразы ищутся в корпусе аннотаций (buildKeywordCorpus): КАЖДАЯ
   *      совпавшая секция/заголовок материализуется wiki-ссылкой между
   *      keywords:begin/end (ребро «keyword»), число вхождений пишется в weight: и
   *      задаёт размер вершины. Глава-лидер из этого же плана служит только цветом;
   *   2) название и фразы, ТОЧНО совпадающие с именем другой вершины, дают раздел
   *      «Related topics» в теле заметки (обычные рёбра «reference») — так находятся
   *      и главы, и блоки, которых в текстах аннотаций нет.
   *
   * У ручной вершины без родителя глава-лидер используется только чтобы выбрать
   * удобную папку. `chapter:` ей не приписывается: это свойство структуры, а не
   * цвета, и оно не должно превращать много-темный узел в ребёнка одной главы.
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
    // цвет из окна создания: валидный hex пишется в color:, мусор молча игнорируется
    var color = core.isHexColor(input.color) ? core.normalizeHexColor(input.color) : "";
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
    // 3. Структурная глава известна только у родителя. Не подменяем ею главу-лидера
    // из корпуса: последняя определяет цвет, но не должна становиться chapter:.
    var structuralChapter = parentNode
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
        plan = core.planBlockKeywords(kwData, corpus, structuralChapter, opts);
      }
    }
    // По plan.dominant выбираем лишь папку для самостоятельной заметки. Цвет
    // вычислит resolveColors из всех keyword-связей, а chapter: останется пустым.
    var placementChapter = structuralChapter || (plan && plan.dominant) || null;
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
    // 5. Папка и путь без коллизий: перезаписывать чужую заметку нельзя. Удобное
    // размещение по главе-лидеру не создаёт структурной принадлежности к этой главе.
    var dir = this.folderForNewNode(g, type, placementChapter, parentNode);
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
        chapter: structuralChapter,
        color: color,
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
    // 7. Если новая заметка оказалась дублем, сразу схлопываем её с существующей:
    // переносим связи/ключевые фразы в одну заметку и не оставляем в графе «две одинаковые вершины».
    var autoMerge = null;
    if (this.settings.autoMergeDuplicates !== false) autoMerge = await this.mergeDuplicateNodes({ ids: [id], silent: true });
    var finalId = autoMerge && autoMerge.focusId ? autoMerge.focusId : id;
    // 8. Пересборка графа и выбор итоговой вершины: пользователь сразу видит её связи.
    var fresh = await this.getGraph(true);
    var node = (fresh._byId && fresh._byId[finalId]) || this.nodeByPath(file.path);
    if (node) file = this.app.vault.getAbstractFileByPath(node.path) || file;
    this.forEachView(function (v) {
      if (!node) return;
      if (!v.visible[node.id]) v.clearIsolation(); // фильтр главы прятал бы только что созданное
      v.select(node.id);
    });
    var kwLinks = plan ? plan.targets.length : 0;
    var msg =
      "Узел создан: " + (node ? node.path : file.path) +
      (nameZh ? " · " + nameEn + " / " + nameZh : "") +
      (structuralChapter ? " · структура " + structuralChapter : "") +
      (plan && plan.dominant ? " · цвет главы " + plan.dominant : "") +
      (color ? " · свой цвет " + color : "") +
      (plan ? " · связей по корпусу: " + kwLinks + " (вес " + plan.weight + ")" : "") +
      (related.length ? " · по названиям: " + related.length : "") +
      (autoMerge && autoMerge.merged ? " · автослияние дубликата: сохранена вершина " + finalId : "") +
      (plan && plan.unmatched.length ? " · НЕ НАЙДЕНО в корпусе: " + plan.unmatched.join(", ") : "");
    new obsidian.Notice(msg);
    return {
      file: file,
      path: node ? node.path : file.path,
      node: node,
      id: finalId,
      createdId: id,
      plan: plan,
      related: related,
      structuralChapter: structuralChapter,
      placementChapter: placementChapter,
      dominantChapter: plan ? plan.dominant : null,
      merged: autoMerge,
    };
  }

  /**
   * Ручная связь между двумя вершинами (ЛКМ по первой, затем Ctrl+ЛКМ по второй).
   * У графа нет «своих» рёбер: дуга появляется, когда в заметке источника появляется
   * ссылка. Поэтому здесь — проверка, что дуги ещё нет, дописка `[[цель|имя]]` в тело
   * заметки-источника (раздел «Related topics», см. core.appendManualLink) и
   * пересборка графа. Позиции вершин переносятся из прежнего снимка, чтобы дуга
   * возникла ровно между теми кругами, по которым кликнули, а не после перекладки.
   */
  async createManualLink(srcNode, tgtNode, currentGraph) {
    if (!srcNode || !tgtNode) return false;
    var label = function (n) { return (n && (n.name || n.id)) || "?"; };
    if (srcNode.inline) {
      new obsidian.Notice("Инлайн-блок не может быть источником связи: у него нет своей заметки (" + srcNode.id + ")");
      return false;
    }
    if (tgtNode.inline) {
      new obsidian.Notice("Инлайн-блок не может быть целью связи (" + tgtNode.id + ")");
      return false;
    }
    var g = currentGraph || this.cache;
    if (g && (g.edges || []).some(function (e) { return e.source === srcNode.id && e.target === tgtNode.id; })) {
      new obsidian.Notice("Связь уже есть: «" + label(srcNode) + "» → «" + label(tgtNode) + "»");
      return false;
    }
    var file = this.app.vault.getAbstractFileByPath(srcNode.path);
    if (!(file instanceof obsidian.TFile)) {
      new obsidian.Notice("Заметка источника не найдена: " + srcNode.path);
      return false;
    }
    // запоминаем координаты до пересборки: после записи вернём их на место
    var oldPos = {};
    if (this.cache) {
      this.cache.nodes.forEach(function (n) {
        if (isFinite(n.x) && isFinite(n.y)) oldPos[n.id] = { x: n.x, y: n.y };
      });
    }
    var opts = buildOptions(this.settings);
    var wrote = false;
    try {
      await this.processInternal(file, function (data) {
        var next = core.appendManualLink(data, { stem: tgtNode.stem, name: tgtNode.name }, opts);
        if (next === data) return data; // ссылка уже была в тексте — не дублируем
        wrote = true;
        return next;
      });
    } catch (e) {
      new obsidian.Notice("Не удалось записать связь: " + (e && e.message ? e.message : e));
      return false;
    }
    if (!wrote) {
      new obsidian.Notice("Ссылка на «" + label(tgtNode) + "» уже есть в тексте заметки " + srcNode.path);
      return false;
    }
    var fresh = await this.getGraph(true);
    var made = (fresh.edges || []).some(function (e) { return e.source === srcNode.id && e.target === tgtNode.id; });
    var carried = 0;
    fresh.nodes.forEach(function (n) {
      var p = oldPos[n.id];
      if (p) { n.x = p.x; n.y = p.y; n.tx = p.x; n.ty = p.y; carried++; }
    });
    if (carried) {
      this.forEachView(function (v) {
        if (v.graph === fresh) v.adoptGraph(fresh, true);
      });
    }
    if (!made) {
      new obsidian.Notice("Ссылка записана (" + srcNode.path + "), но ребро в графе не появилось — проверьте текст заметки");
      return false;
    }
    new obsidian.Notice("Связь создана: «" + label(srcNode) + "» → «" + label(tgtNode) + "» (" + srcNode.path + ")");
    return true;
  }

  /* -------------------------------------------------- удаление вершин */

  /** Есть ли у приложения штатное «в корзину» (Obsidian 1.6+): от него зависит текст окна. */
  trashAvailable() {
    var fm = this.app && this.app.fileManager;
    return !!(fm && typeof fm.trashFile === "function");
  }

  /**
   * Удаление файла так, как это делает сам Obsidian: системная корзина, корзина
   * хранилища (.trash) или безвозвратно — решает настройка «Files & Links →
   * Deleted files». Старый API (vault.trash) оставлен на случай 1.5.x.
   */
  async trashFile(file) {
    var fm = this.app.fileManager;
    if (fm && typeof fm.trashFile === "function") return fm.trashFile(file);
    if (this.app.vault && typeof this.app.vault.trash === "function") return this.app.vault.trash(file, true);
    return this.app.vault.delete(file);
  }

  /** План удаления вершины по свежей модели графа (без раскладки — нужны только связи). */
  async deletePlan(nodeOrId) {
    var id = nodeOrId && nodeOrId.id ? nodeOrId.id : nodeOrId;
    if (!id) return null;
    var g = await this.buildGraphModel(buildOptions(this.settings));
    if (!g._byId || !g._byId[id]) return null;
    return core.planNodeDelete(g, id, buildOptions(this.settings));
  }

  /**
   * Удаление выделенной вершины, шаг первый: окно подтверждения со списком последствий
   * (его можно выключить настройкой «Спрашивать подтверждение»). Пока окно открыто,
   * повторный Delete или клик по кнопке ничего не запускают — на плагине висит флаг.
   */
  async confirmDeleteNode(nodeOrId) {
    if (this.deleting) {
      new obsidian.Notice("Удаление уже идёт…");
      return null;
    }
    if (this.deleteModal && this.deleteModal.isOpen) return null;
    var plan = await this.deletePlan(nodeOrId);
    if (!plan || !plan.node) {
      new obsidian.Notice("Удаление: вершина не найдена в свежей модели графа — нажмите ⟳ Rebuild");
      return null;
    }
    if (this.settings.confirmDelete === false) return this.deleteNode(plan);
    var modal = new DeleteNodeModal(this.app, this, plan);
    this.deleteModal = modal;
    modal.open();
    return { plan: plan, modal: modal };
  }

  /**
   * Удаление вершины. У графа нет «своих» рёбер: дуга существует, пока в заметке есть
   * ссылка. Поэтому одной операцией делается всё, чтобы после удаления не осталось
   * битых ссылок и висящих родителей:
   *   1. из заметок, ссылающихся на вершину (и на её инлайн-блоки), снимаются ссылки
   *      (core.stripDeletedRefs): машинные пункты уходят целиком, в прозе остаётся
   *      видимый текст, пустой «Related topics» исчезает, weight: пересчитывается по
   *      оставшимся ссылкам региона, а опустевший регион убирается вместе со свойством;
   *   2. детям вершины (parent:/chapter:) назначается её родитель — иерархия курса цела;
   *   3. сама заметка уходит в корзину Obsidian (инлайн-блок — убирается только якорь,
   *      текст абзаца остаётся);
   *   4. граф пересобирается, выделение снимается, тост подводит итог.
   * Каждый правленый файл запоминается до записи: undoDelete() возвращает всё байт-в-байт.
   */
  async deleteNode(planOrNode, opts) {
    opts = opts || {};
    var plan = planOrNode && planOrNode.node ? planOrNode : await this.deletePlan(planOrNode);
    if (!plan || !plan.node) {
      new obsidian.Notice("Удаление: вершина не найдена");
      return null;
    }
    var self = this;
    var node = plan.node;
    var coreOpts = buildOptions(this.settings);
    var captionKey = this.settings.captionKey || "caption";
    var parentKey = this.settings.parentKey || "parent";
    var chapterKey = this.settings.chapterKey || "chapter";

    // Один проход на файл: снятие ссылок и правка свойств — одна запись, а не две
    // (иначе второй проход читает уже изменённый текст и может затереть первый).
    var ops = {};
    var opFor = function (path) {
      return ops[path] || (ops[path] = { path: path, strip: null, patch: {} });
    };
    plan.refs.forEach(function (r) {
      var op = opFor(r.path);
      op.strip = plan.targets;
      if (r.caption) op.patch[captionKey] = "";
    });
    plan.children.forEach(function (child) {
      var op = opFor(child.path);
      if (child.parent === node.id) op.patch[parentKey] = plan.newParent || "";
      if (child.chapter === node.id) op.patch[chapterKey] = plan.newChapter || "";
    });

    var snapshots = {};
    var snapshot = function (path, text) {
      if (snapshots[path] === undefined) snapshots[path] = text;
    };
    // Чистое преобразование текста заметки: одна и та же функция и для примерки
    // («меняется ли файл вообще»), и для самой записи — расхождения быть не может.
    var strip = function (text, op) {
      var res = op.strip ? core.stripDeletedRefs(text, op.strip, coreOpts) : null;
      var out = res ? res.text : text;
      if (Object.keys(op.patch).length) out = core.setFrontmatterValues(out, op.patch);
      return { text: out, removed: res ? res.removed : 0 };
    };

    this.deleting = true;
    var stripped = 0;
    var edited = 0;
    var reparented = 0;
    try {
      var paths = Object.keys(ops);
      for (var i = 0; i < paths.length; i++) {
        var op = ops[paths[i]];
        var file = this.app.vault.getAbstractFileByPath(op.path);
        if (!(file instanceof obsidian.TFile)) continue;
        var before = await this.app.vault.cachedRead(file);
        var after = strip(before, op);
        if (after.text === before) continue;
        snapshot(op.path, before);
        await this.processInternal(file, function (data) {
          return strip(data, op).text;
        });
        edited++;
        stripped += after.removed;
        if (op.patch[parentKey] !== undefined || op.patch[chapterKey] !== undefined) reparented++;
      }
      // сама вершина
      var target = this.app.vault.getAbstractFileByPath(node.path);
      if (node.inline) {
        if (target instanceof obsidian.TFile) {
          var ownerBefore = await this.app.vault.cachedRead(target);
          var ownerAfter = core.stripInlineAnchor(ownerBefore, node.anchorName);
          if (ownerAfter !== ownerBefore) {
            snapshot(node.path, ownerBefore);
            await this.processInternal(target, function (data) {
              return core.stripInlineAnchor(data, node.anchorName);
            });
            edited++;
          }
        }
      } else if (target instanceof obsidian.TFile) {
        snapshot(node.path, await this.app.vault.cachedRead(target));
        await this.withInternalWrite(node.path, function () {
          return self.trashFile(target);
        });
      }
    } finally {
      this.deleting = false;
    }

    this.lastDelete = {
      at: Date.now(),
      node: { id: node.id, name: node.name, type: node.type, path: node.path, inline: !!node.inline },
      files: Object.keys(snapshots).map(function (p) {
        return { path: p, text: snapshots[p] };
      }),
    };

    // Граф: пересобрать и показать результат (выделения у удалённой вершины уже нет)
    this.markGraphDirty();
    await this.getGraph(true);
    this.forEachView(function (v) {
      if (v.selected && !v.byId[v.selected]) v.select(null);
      v.refresh(false);
    });
    var bits = [];
    bits.push("вершина «" + (node.name || node.id) + "» удалена");
    if (edited) bits.push("правлено заметок: " + edited);
    if (stripped) bits.push("снято ссылок: " + stripped);
    if (reparented) bits.push("детей перевешено: " + reparented);
    if (node.inline) bits.push("текст абзаца остался");
    var msg = bits.join(" · ") + " · вернуть — команда «Undo last vertex deletion»";
    new obsidian.Notice(msg);
    this.forEachView(function (v) {
      v.setStatus(msg, 8000);
    });
    return { plan: plan, edited: edited, stripped: stripped, snapshot: this.lastDelete };
  }

  /**
   * Отмена последнего удаления: заметка создаётся заново, а всем правленым файлам
   * возвращается текст, снятый перед записью (ссылки, parent:/chapter:, weight:,
   * caption:) — байт-в-байт. Помним только последнее удаление и только эту сессию:
   * «отмена на все времена» требует журнала, а не памяти плагина.
   */
  async undoDelete() {
    var last = this.lastDelete;
    if (!last || !last.files || !last.files.length) {
      new obsidian.Notice("Отменять нечего: в этой сессии Obsidian ничего не удалялось");
      return null;
    }
    var files = last.files;
    var n = 0;
    for (var i = 0; i < files.length; i++) {
      try {
        await this.writeFile(files[i].path, files[i].text);
        n++;
      } catch (e) {
        new obsidian.Notice("Не удалось вернуть " + files[i].path + ": " + (e && e.message ? e.message : e));
      }
    }
    this.lastDelete = null;
    this.markGraphDirty();
    var g = await this.getGraph(true);
    var want = last.node && last.node.id ? g._byId[last.node.id] : null;
    this.forEachView(function (v) {
      v.refresh(false);
      if (want && v.byId[want.id]) v.select(want.id, true);
    });
    var msg = "Удаление отменено: восстановлено заметок — " + n +
      (last.node ? " (включая «" + (last.node.name || last.node.id) + "»)" : "");
    new obsidian.Notice(msg);
    this.forEachView(function (v) {
      v.setStatus(msg, 8000);
    });
    return { files: n };
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
module.exports.DeleteNodeModal = DeleteNodeModal;
module.exports.ManualMergeModal = ManualMergeModal;
module.exports.VIEW_TYPE = VIEW_TYPE;
module.exports.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
module.exports.buildOptions = buildOptions;
module.exports.subsetGraph = subsetGraph;

module.exports = LectureGraphPlugin;
module.exports.default = LectureGraphPlugin;
