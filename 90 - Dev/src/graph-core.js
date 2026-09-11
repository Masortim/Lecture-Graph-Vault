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
    var byName = {}, byStem = {}, byId = (graph && graph._byId) || {};
    ((graph && graph.nodes) || []).forEach(function (n) {
      if (n.type !== "heading" && n.type !== "section") return;
      var k = normPhrase(n.name);
      if (k && !byName[k]) byName[k] = n;
      var s = normPhrase(n.stem);
      if (s && !byName[s]) byName[s] = n;
    });
    var regions = [], notes = 0, unmatched = 0;
    (abstractNotes || []).forEach(function (raw) {
      if (!raw || !raw.path) return;
      var read = readNote(raw);
      if (String(read.data[cfg.typeKey] || "").trim().toLowerCase() !== "abstract") return;
      var parsed = parseAbstract(read);
      notes++;
      var sec = parsed.section ? byId[parsed.section] : null;
      if (!sec) sec = byName[normPhrase(parsed.title)] || null;
      var regionsBefore = regions.length;
      if (sec) regions.push({ node: sec, level: "section", text: parsed.preamble, note: raw.path });
      else unmatched++;
      parsed.regions.forEach(function (r) {
        var h = byName[normPhrase(r.name)];
        if (!h) { unmatched++; return; } // заголовок переименован — считаем unmatched, не молчим
        regions.push({ node: h, level: "heading", text: r.text, note: raw.path });
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
          var ch = r.node.chapter || (r.level === "section" ? r.node.id : chapterOf(r.node, byId));
          var cur = byTarget[r.node.id];
          if (cur) { cur.count += c; cur.chapters.push(ch); }
          else {
            cur = byTarget[r.node.id] = { id: r.node.id, name: r.node.name, stem: r.node.stem, level: r.level, chapter: ch, count: c, note: r.note, chapters: [ch] };
            hits.push(cur);
          }
          byChapter[ch] = (byChapter[ch] || 0) + c;
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
        h.chapters.forEach(function (ch) { byChapter[ch] = (byChapter[ch] || 0) + h.count; });
      });
    });
    var dominant = ownChapter || null, best = -1;
    Object.keys(byChapter).sort().forEach(function (ch) {
      var v = byChapter[ch] + (ch === ownChapter ? 0.5 : 0); // при равенстве остаётся своя глава
      if (v > best) { best = v; dominant = ch; }
    });
    return {
      keywords: list,
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
   * ВСЕ главы, о которых говорит новая вершина, — а не одна «доминирующая».
   *
   * Корпус аннотаций состоит из секций и заголовков, поэтому прямые попадания
   * (plan.targets) — это всегда они; главу же до сих пор использовали только чтобы
   * выбрать папку и цвет (plan.dominant), и связь с ней в графе не появлялась вовсе.
   * Между тем ключевые фразы почти всегда попадают в НЕСКОЛЬКО глав: именно эти связи
   * и показывают, что тема сквозная. Здесь они превращаются в обычные ссылки-рёбра
   * (kind "reference"), по одной на главу, отсортированные по числу вхождений.
   *
   * Вес по ключевым фразам (`weight:`) при этом НЕ меняется: он считается по региону
   * keywords:begin/end, а эти ссылки живут в теле заметки, поэтому «вес = число
   * вхождений в корпусе» остаётся прежним, а рёбра глав добавляются сверх него.
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
  // связи со всеми главами, где встречаются ключевые фразы вершины (см. relatedChapters)
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

  function mergeBodyCore(node) {
    var name = normPhrase((node && (node.name || node.stem)) || "");
    var zh = normPhrase((node && node.nameZh) || "");
    var rawBody = String((node && node.body) || "").replace(/\r\n/g, "\n");
    var cut = splitKeywordRegion(rawBody);
    // Related вырезаем только из части ДО региона фраз: «хвост» после региона
    // (якорь/абзац, дописанные в конец файла) — обычное содержимое, а не Related
    var beforePart = cut.at >= 0 ? rawBody.slice(0, cut.at) : rawBody;
    var afterPart = cut.at >= 0 ? rawBody.slice(cut.end >= 0 ? cut.end : rawBody.length) : "";
    var cleanedBefore = removeHeadingSection(beforePart, RELATED_HEADING).replace(/\s+$/g, "");
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
    var add = mergeBodyCore(drop);
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
    var block = "## Duplicate material merged from " + ((drop && drop.id) || "duplicate") +
      "\n\n> merged automatically from duplicate note \"" + sanitizeLabel((drop && (drop.name || drop.stem)) || "duplicate") +
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
   * для совпадений по названиям. Чистая функция — её и проверяют юнит-тесты.
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
    // Связи со ВСЕМИ главами, в аннотациях которых нашлись ключевые фразы (не только
    // с «доминирующей», которая задаёт папку и цвет): у сквозной темы их несколько, и
    // без этого раздела в графе не было бы видно ни одной из них. Отдельный заголовок,
    // а не общий «Related topics»: пункты машинные, у каждого — за что связь.
    var chapters = s.chapters || [];
    if (chapters.length) {
      // Без вводного абзаца: за что связь, написано в самом пункте. Тогда после
      // удаления последней главы раздел уходит целиком (dropEmptySection), а не
      // остаётся сиротливым заголовком с пояснением к пустому списку.
      body.push("", CHAPTER_HEADING, "");
      chapters.forEach(function (c) {
        body.push("- [[" + c.stem + "|" + c.name + (c.count > 1 ? " ×" + c.count : "") + "]] — глава `" +
          c.id + "`" + (c.detail ? ", " + c.detail : ""));
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
