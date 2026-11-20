// Interface translation (Settings > Language, see language.js).
// The game shows English. When another language is chosen, main.js serves this file
// at /_aim_lang/<code>.js right after the pack (window.__aimLangPack = { code, strings }),
// and a small tag at the top of the lobby page loads it before the game starts.
// It swaps English text for the translation as it appears: text in the page, a few
// attributes (title, placeholder, aria-label, alt) and text drawn on canvases.
// Lines with no translation stay in English as a whole, so a sentence never ends up
// half translated.
(() => {
  if (window.__aimLang?.ready) return;
  const PACK = window.__aimLangPack || { code: "en", strings: {} };
  const CODE = PACK.code || "en";
  const LIST_JOIN = { ja: "、", zh: "、" }[CODE] ?? ", ";

  const norm = text => text.trim().replace(/\s+/g, " ");
  const keep = (value, out) => value.match(/^\s*/)[0] + out + value.match(/\s*$/)[0];
  const LETTERS = /[A-Za-z]{2}/;
  const NUMBER = /[-+]?\d+(?:[.,:]\d+)*/g;

  // Exact lines, lines whose numbers change ("{}" stands for the changing part) and
  // ALL-CAPS versions of the same lines.
  const EXACT = new Map();
  const LOWER = new Map();
  const SHAPES = new Map(); // line with its numbers as "{}" -> translation with "{}"
  const PATTERNS = [];
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const count = (s, re) => (s.match(re) || []).length;
  // A translation may use "{1}", "{2}", ... to put the changing parts in another order
  // ("{} of {} spots" -> "{2}곳 중 {1}곳"); a plain "{}" takes the next part in turn.
  const SLOT = /\{(\d?)\}/g;
  const fill = (value, parts) => {
    let i = 0;
    return value.replace(SLOT, (_, n) => parts[n ? Number(n) - 1 : i++] ?? "");
  };
  for (const [key, value] of Object.entries(PACK.strings || {})) {
    if (typeof value !== "string" || !value) continue;
    if (key.includes("{}")) {
      SHAPES.set(key, value);
      const parts = key.split("{}");
      // A pattern that starts with its changing part ("{} tasks") only takes numbers or known
      // words there, so it can't swallow an unrelated line ("Favorite tasks").
      PATTERNS.push([new RegExp("^" + parts.map(escape).join("(.+?)") + "$"), value, !key.startsWith("{}")]);
    } else {
      EXACT.set(key, value);
      LOWER.set(key.toLowerCase(), value);
      // A known line with numbers also covers the same line with other numbers,
      // when the translation keeps the same numbers in the same order.
      const nums = key.match(NUMBER);
      if (nums && count(value, NUMBER) === nums.length && JSON.stringify(value.match(NUMBER)) === JSON.stringify(nums)) {
        const shape = key.replace(NUMBER, "{}");
        if (!SHAPES.has(shape)) SHAPES.set(shape, value.replace(NUMBER, "{}"));
      }
    }
  }
  PATTERNS.sort((a, b) => b[0].source.length - a[0].source.length);

  // Lines that are already in their own language (language names, the Language panel).
  const PROTECT = new Set(["English", "한국어", "日本語", "中文"]);
  const missing = (window.__aimMissing = new Set());
  const cache = new Map();

  function lookup(text) {
    if (EXACT.has(text)) return EXACT.get(text);
    // Same line with other numbers ("Round 3 of 5" -> "Round {} of {}").
    const numbers = text.match(NUMBER);
    if (numbers) {
      const shape = text.replace(NUMBER, "{}");
      if (SHAPES.has(shape)) return fill(SHAPES.get(shape), numbers);
    }
    // Lists of numbered names ("Strafer 1, Holder 2" in the Studio): each name translated,
    // joined the way the language writes lists. Only when every item ends in its number.
    // Checked before the patterns, which would otherwise take "1, Holder 2" as one number.
    if (text.includes(", ")) {
      const items = text.split(", ");
      if (items.every(s => /\S \d+$/.test(s))) {
        const out = items.map(s => lookup(s));
        if (!out.includes(null)) return out.join(LIST_JOIN);
      }
    }
    for (const [re, value, loose] of PATTERNS) {
      const m = re.exec(text);
      if (!m) continue;
      // The changing parts are translated too when they are known words (map names, ...).
      const parts = m.slice(1).map(part => {
        const t = part.trim();
        if (!t || /^[-+]?[\d.,:%×/ ]+[KkM]?$/.test(t)) return part;
        return lookup(t) ?? (loose ? part : null);
      });
      if (parts.includes(null)) continue;
      return fill(value, parts);
    }
    if (text === text.toUpperCase() && LOWER.has(text.toLowerCase())) return LOWER.get(text.toLowerCase());
    return null;
  }

  // A line made of several sentences ("15 bots at random spots. Bots shoot back (Gold).") is
  // translated sentence by sentence, but only when every sentence is known.
  // Also splits after a translated sentence ("…撃ち返してきます。 HP refills on every kill."): some
  // scripts add an English sentence to card text that is already translated.
  const SENTENCE = /(?<=[.!?;])\s+(?=[A-Z0-9])|(?<=[。！？])\s*(?=[A-Z0-9])/;
  const JOIN = { ja: "", zh: "" }[CODE] ?? " ";
  function lookupLine(text) {
    const whole = lookup(text);
    if (whole !== null) return whole;
    const parts = text.split(SENTENCE);
    if (parts.length < 2) return null;
    const out = [];
    for (const part of parts) {
      // Already translated (the game sometimes adds a sentence to text shown earlier).
      if (!LETTERS.test(part)) { out.push(part); continue; }
      const t = lookup(part);
      if (t === null) return null;
      out.push(t);
    }
    return out.join(JOIN);
  }

  function translate(value) {
    if (typeof value !== "string" || !LETTERS.test(value)) return value;
    const text = norm(value);
    if (PROTECT.has(text)) return value;
    let out = cache.get(text);
    if (out === undefined) {
      out = lookupLine(text);
      if (out === null) {
        if (text.length < 300) missing.add(text);
        out = text;
      }
      if (cache.size > 8000) cache.clear();
      cache.set(text, out);
    }
    return out === text ? value : keep(value, out);
  }

  window.__aimLang = {
    ready: true,
    code: CODE,
    t: translate,
    protect: (...list) => { for (const s of list) if (s) PROTECT.add(norm(String(s))); },
  };
  if (CODE === "en") return;
  // Lets stylesheets adjust for longer lines in a language (html[data-aim-lang="ja"] ...).
  document.documentElement.dataset.aimLang = CODE;

  // ---- page text ----
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT", "SVG"]);
  const SKIP_SELECTOR = "[data-aim-no-translate], .aim-lang-panel, [contenteditable=''], [contenteditable='true']";
  const ATTRS = ["title", "placeholder", "aria-label", "alt"];
  const shown = new WeakMap(); // text node -> the text we last put there

  const skipped = el => !el || SKIP_TAGS.has(el.tagName) || !!el.closest?.(SKIP_SELECTOR);

  function doText(node) {
    const value = node.data;
    if (shown.get(node) === value || skipped(node.parentElement)) return;
    const out = translate(value);
    shown.set(node, out);
    if (out !== value) node.data = out;
  }

  const shownAttr = new WeakMap(); // element -> { attribute: text we put there }
  function doAttr(el, name) {
    const value = el.getAttribute(name);
    if (value == null || skipped(el)) return;
    const seen = shownAttr.get(el) || {};
    if (seen[name] === value) return;
    const out = translate(value);
    seen[name] = out;
    shownAttr.set(el, seen);
    if (out !== value) el.setAttribute(name, out);
  }
  // Buttons drawn as <input type="button" value="...">.
  function doInput(el) {
    if (/^(button|submit|reset)$/i.test(el.type || "")) {
      const out = translate(el.value);
      if (out !== el.value) el.value = out;
    }
  }

  function doTree(root) {
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1 && skipped(root)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.nodeType === 1 && skipped(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n = walker.currentNode; n; n = walker.nextNode()) {
      if (n.nodeType === 3) doText(n);
      else if (n.nodeType === 1) {
        for (const a of ATTRS) if (n.hasAttribute(a)) doAttr(n, a);
        if (n.tagName === "INPUT") doInput(n);
      }
    }
  }

  const observer = new MutationObserver(records => {
    for (const r of records) {
      if (r.type === "characterData") doText(r.target);
      else if (r.type === "attributes") doAttr(r.target, r.attributeName);
      else for (const n of r.addedNodes) doTree(n);
    }
  });
  observer.observe(document.documentElement, {
    childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS,
  });
  // ---- text put on the page by stylesheets (content: "Categories" and the like) ----
  // Such text is not in the page, so each rule that sets an English content line gets a
  // copy of itself with the translation, in one stylesheet of our own kept up to date.
  let cssSheet = null;
  let cssTimer = 0;
  const cssDone = new Set(); // "selector\u0000text" already overridden
  function scanRules(rules, out) {
    for (const rule of rules) {
      if (rule.cssRules && rule.cssRules.length && !rule.selectorText) { scanRules(rule.cssRules, out); continue; }
      const content = rule.style?.content;
      if (!content || content[0] !== '"' || !rule.selectorText) continue;
      let text;
      try { text = JSON.parse(content); } catch { continue; }
      const key = rule.selectorText + "\u0000" + text;
      if (cssDone.has(key) || !LETTERS.test(text)) continue;
      cssDone.add(key);
      const translated = translate(text);
      if (translated !== text) out.push(`${rule.selectorText}{content:${JSON.stringify(translated)} !important}`);
    }
  }
  function doStyles() {
    cssTimer = 0;
    const outRules = [];
    for (const sheet of document.styleSheets) {
      if (sheet.ownerNode === cssSheet) continue;
      let rules;
      try { rules = sheet.cssRules; } catch { continue; } // another origin's stylesheet
      if (rules) scanRules(rules, outRules);
    }
    if (!outRules.length) return;
    if (!cssSheet || !cssSheet.isConnected) {
      cssSheet = document.createElement("style");
      cssSheet.dataset.aimLangCss = "";
      (document.head || document.documentElement).appendChild(cssSheet);
    }
    cssSheet.appendChild(document.createTextNode(outRules.join("\n") + "\n"));
  }
  const queueStyles = () => { if (!cssTimer) cssTimer = setTimeout(doStyles, 50); };
  new MutationObserver(records => {
    for (const r of records) for (const n of r.addedNodes) {
      if (n.nodeName === "STYLE" || n.nodeName === "LINK") {
        if (n !== cssSheet) { queueStyles(); if (n.nodeName === "LINK") n.addEventListener("load", queueStyles, { once: true }); }
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  const start = () => { doTree(document.documentElement); queueStyles(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  window.addEventListener("load", queueStyles, { once: true });
  start();

  // ---- text drawn on canvases (HUD, result screens) ----
  for (const Ctx of [window.CanvasRenderingContext2D, window.OffscreenCanvasRenderingContext2D]) {
    if (!Ctx) continue;
    for (const name of ["fillText", "strokeText", "measureText"]) {
      const original = Ctx.prototype[name];
      if (typeof original !== "function") continue;
      Ctx.prototype[name] = function (text, ...rest) {
        return original.call(this, typeof text === "string" ? translate(text) : text, ...rest);
      };
    }
  }
})();
