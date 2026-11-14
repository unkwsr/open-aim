// Enemy rank on the lobby drill cards (enemy-rank-v1, design C "big badge on the picture").
// Each VALORANT Training card whose drill has bots gets a big rank badge over its picture with < > arrows,
// a pip row and the rank name; the EASY/HARD chip is hidden on those cards. The pick is saved by main.js
// (/api/local/enemy-rank, <userData>/enemy-ranks.json) and applied when the drill loads (enemy-rank.js).
(() => {
  if (window.__aimEnemyRankCards) return;
  window.__aimEnemyRankCards = true;
  const API = "/api/local/enemy-rank";
  const ICON = (id) => `/studio/icons/ranks/${id}.png`;
  let canRename = false;
  let ranks = null; // [{ id, name, color, reaction, heads }]
  const cards = new Map(); // shareCode -> { eligible, made, rank }
  const asking = new Set();

  const style = document.createElement("style");
  style.id = "es-enemy-rank-style";
  style.textContent = `
.al-wk-card.es-rank > .aim-vt-card-difficulty { display: none !important; }
.al-wk-card.es-rank { box-shadow: inset 0 2px 0 var(--es-rank-color, transparent); }
.es-rank-hero { position: absolute; left: 0; right: 0; top: var(--es-rank-top, 14px); z-index: 6;
  display: flex; flex-direction: column; align-items: center; gap: 5px; pointer-events: none; }
.es-rank-hero::before { content: ""; position: absolute; left: 50%; top: 48%; width: 230px; height: 150px; transform: translate(-50%, -50%);
  background: radial-gradient(closest-side, rgba(8,10,14,.78), rgba(8,10,14,.45) 60%, rgba(8,10,14,0)); z-index: -1; }
.es-rank-row { display: flex; align-items: center; gap: 12px; }
.al-wk-card .es-rank-badge { width: 64px !important; height: 64px !important; object-fit: contain; opacity: 1 !important; mask: none !important; -webkit-mask: none !important; border-radius: 0 !important;
  filter: drop-shadow(0 0 12px var(--es-rank-glow, transparent)) drop-shadow(0 3px 6px rgba(0,0,0,.9)) !important; }
.es-rank-off { width: 54px; height: 54px; margin: 5px; border-radius: 50%; border: 2px dashed #8b909a;
  display: grid; place-items: center; color: #b8bcc4; font: 700 22px/1 Arial, sans-serif; background: rgba(10,12,16,.55); }
.es-rank-arrow { pointer-events: auto; width: 26px; height: 26px; padding: 0; border: 1px solid #4a4f5a;
  background: rgba(10,12,16,.82); color: #e6e6e6; font: 700 15px/1 Arial, sans-serif; cursor: pointer;
  display: grid; place-items: center; }
.es-rank-arrow:hover { border-color: var(--es-rank-color, #ff4655); color: #fff; }
.es-rank-arrow:disabled { opacity: .25; cursor: default; }
.es-rank-pips { display: flex; gap: 4px; }
.es-rank-pips i { width: 11px; height: 3px; background: rgba(255,255,255,.18); }
.es-rank-pips i.on { background: var(--es-rank-color, #ff4655); }
.es-rank-name { filter: brightness(1.25); font: 900 14px/1 "Arial Narrow", Arial, sans-serif; letter-spacing: .22em; text-transform: uppercase;
  color: var(--es-rank-color, #fff); text-shadow: 0 2px 6px #000, 0 0 2px #000; }
.es-rank-sub { font: 600 10.5px/1 Arial, sans-serif; color: #c9ccd2; letter-spacing: .04em; text-shadow: 0 1px 4px #000; }
.al-wk-card:has(.al-wkb) > .es-rank-hero { display: none; }
.es-run-rank { display: inline-flex; align-items: center; gap: 4px; margin-left: 6px; vertical-align: middle;
  font: 800 10px/1 "Arial Narrow", Arial, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--c, #aab); white-space: nowrap; }
.es-run-rank img { width: 16px; height: 16px; object-fit: contain; }
.es-run-rank .x { width: 13px; height: 13px; border-radius: 50%; border: 1.5px dashed #8b909a; display: inline-grid; place-items: center; font-size: 8px; color: #aab; }
.es-rank-bests { display: flex; flex-wrap: wrap; gap: 4px 10px; margin: 6px 0 2px; }
.es-rank-bests .es-run-rank { margin: 0; font-size: 10.5px; }
.es-rank-bests .es-run-rank b { color: #fff; font-weight: 800; margin-left: 2px; }
.es-rank-bests .es-run-rank.is-now { outline: 1px solid var(--c); outline-offset: 2px; }
.al-wkr .es-rank-bests { margin: 10px 0 4px; }
.es-tail-icon { width: 15px !important; height: 15px !important; object-fit: contain; vertical-align: -3px; margin-right: 5px; }
.al-wkb-k .es-run-rank { margin-left: 8px; font-size: 9.5px; }
.al-wk-card .al-wk-foot .al-wk-new { display: none !important; } /* the game's own "New" (= not played yet); the red NEW tag replaces it */
.es-rename { position: absolute; top: 42px; right: 20px; z-index: 7; width: 26px; height: 26px; padding: 0; display: grid; place-items: center;
  border: 1px solid #4a4f5a; background: rgba(10,12,16,.85); color: #c9ccd2; cursor: pointer; opacity: 0; transition: opacity .12s; }
.al-wk-card:hover > .es-rename, .es-rename:focus-visible { opacity: 1; }
.es-rename:hover { color: #fff; border-color: #ff4655; }
.es-rename-box { position: absolute; left: 12px; right: 12px; z-index: 8; display: flex; flex-wrap: wrap; gap: 6px; padding: 6px;
  background: #0d1016; border: 1px solid #ff4655; box-shadow: 0 6px 18px rgba(0,0,0,.6); }
.es-rename-box input { flex: 1; min-width: 0; height: 30px; padding: 0 8px; border: 1px solid #4a4f5a; background: #161a22; color: #fff;
  font: 700 15px/1 Arial, sans-serif; outline: none; }
.es-rename-box input:focus { border-color: #ff4655; }
.es-rename-box button { height: 30px; padding: 0 12px; border: 0; background: #ff4655; color: #fff; font: 800 12px/1 Arial, sans-serif; letter-spacing: .08em; cursor: pointer; }
.es-rename-box button:disabled { opacity: .5; }
.es-rename-msg { flex-basis: 100%; color: #ff8a93; font: 12px/1.3 Arial, sans-serif; }
.es-rename-msg:empty { display: none; }
.es-new-tag { position: absolute; top: 10px; left: 10px; z-index: 7; pointer-events: none; padding: 4px 9px 3px;
  background: #ff4655; color: #fff; font: 800 11px/1 Arial, sans-serif; letter-spacing: .12em;
  clip-path: polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%); box-shadow: 0 2px 8px rgba(0,0,0,.55); }
`;
  document.head.append(style);

  const glow = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},.55)`;
  };
  const sub = (r) => (!r.reaction ? "Bots don't shoot back"
    : `Reacts ${((r.reaction[0] + r.reaction[1]) / 2).toFixed(2)} s · ${r.heads ? "goes for your head" : "aims at your body"}`);
  const rankById = (id) => ranks && ranks.find((r) => r.id === id);

  // ---- Card text: "Bots don't shoot." / "Bots shoot back." follows the picked rank. ----
  const BOT_LINE = /Bots (?:don't shoot|shoot back)(?: \([A-Za-z' ]+\))?\./;
  // heal-text-v1: from the drill's healFrom rank up (Immortal; hold sites Diamond) the text says HP refills on a kill.
  const HEAL_TEXT = " HP refills on every kill.";
  function paintText(card, r, state) {
    const heal = r.id !== "off" && state && state.healFrom && ranks.findIndex((x) => x.id === r.id) >= ranks.findIndex((x) => x.id === state.healFrom);
    const ps = [...card.querySelectorAll(".al-wk-body p")];
    let target = ps.find((p) => BOT_LINE.test(p.textContent)) || (heal ? ps[0] : null);
    for (const p of ps) {
      const text = p.textContent;
      let want = text.split(HEAL_TEXT).join("");
      if (BOT_LINE.test(want)) want = want.replace(BOT_LINE, r.id === "off" ? "Bots don't shoot." : `Bots shoot back (${r.name}).`);
      if (heal && p === target) want = want.trimEnd() + HEAL_TEXT;
      if (want !== text) p.textContent = want;
    }
  }

  // ---- Records: which rank each run was played at. The game keeps runs in al-workshop-runs-v1 with the drill's
  // sceneHash; a rank other than the one the drill was made with adds "-r<rank>" (enemy-rank.js). ----
  // lobby-scroll-fast-v1: the history is parsed once per change and grouped by drill (was parsed again for every
  // card on every page change: 200-300 ms per change with 300 runs and 120 cards, the lobby scroll lag).
  let runsRaw = null, runsAt = -1, runsByCode = new Map();
  const runsFor = (code) => {
    const now = performance.now();
    if (now - runsAt > 250 || runsRaw === null) {
      runsAt = now;
      const raw = localStorage.getItem("al-workshop-runs-v1") || "[]";
      if (raw !== runsRaw) {
        runsRaw = raw;
        runsByCode = new Map();
        try {
          const all = JSON.parse(raw);
          if (Array.isArray(all)) for (const r of all) {
            if (!r || !r.shareCode || r.deletedAt) continue;
            let list = runsByCode.get(r.shareCode);
            if (!list) runsByCode.set(r.shareCode, (list = []));
            list.push(r);
          }
          for (const list of runsByCode.values()) list.sort((a, b) => b.createdAt - a.createdAt);
        } catch {}
      }
    }
    return (runsByCode.get(code) || []).slice();
  };
  const runRank = (run, made) => { const m = /-r([a-z]+)$/.exec(run.sceneHash || ""); return m && rankById(m[1]) ? m[1] : made; };
  const tag = (id, extra) => {
    const r = rankById(id);
    const el = document.createElement("span");
    el.className = "es-run-rank";
    el.dataset.rank = id;
    el.style.setProperty("--c", r.color);
    if (id === "off") { const x = document.createElement("span"); x.className = "x"; x.textContent = "✕"; el.append(x); }
    else { const img = document.createElement("img"); img.src = ICON(id); img.alt = ""; el.append(img); }
    el.append(document.createTextNode(id === "off" ? "No shoot" : r.name));
    if (extra !== undefined) { const b = document.createElement("b"); b.textContent = extra; el.append(b); }
    el.title = `Played against ${r.name === "Don't shoot" ? "bots that don't shoot" : `${r.name} bots`}`;
    return el;
  };
  const putTag = (host, id, before) => {
    const old = host.querySelector(":scope > .es-run-rank");
    if (old && old.dataset.rank === id) return;
    old?.remove();
    host.insertBefore(tag(id), before || null);
  };
  // Time drills (seconds, lower is better) or points (higher is better), as the panel shows its best.
  const better = (timeBased) => (a, b) => (timeBased ? (a.end === "cleared") - (b.end === "cleared") || b.seconds - a.seconds : a.score - b.score);
  const value = (run, timeBased) => (timeBased ? `${run.seconds.toFixed(1)}s` : String(Math.round(run.score)));
  function bestsPerRank(runs, made, timeBased) {
    const best = new Map();
    for (const run of runs) { const id = runRank(run, made); const b = best.get(id); if (!b || better(timeBased)(run, b) > 0) best.set(id, run); }
    return best;
  }
  function putBests(after, runs, state, timeBased) {
    const best = bestsPerRank(runs, state.made, timeBased);
    const key = [...best].map(([id, r]) => `${id}:${r.id}`).join(",") + "|" + state.rank;
    let box = after.parentElement.querySelector(":scope > .es-rank-bests");
    if (box && box.dataset.key === key) return;
    box?.remove();
    if (!best.size) return;
    box = document.createElement("div");
    box.className = "es-rank-bests";
    box.dataset.key = key;
    box.title = "Your best at each enemy rank";
    for (const r of ranks) if (best.has(r.id)) { const t = tag(r.id, value(best.get(r.id), timeBased)); if (r.id === state.rank) t.classList.add("is-now"); box.append(t); }
    after.after(box);
  }
  function paintBack(card, code) {
    const state = cards.get(code);
    if (!state || !state.eligible || !ranks) return;
    // Front: the "My best N pts" strip gets the rank that best was played at.
    const strip = card.querySelector(".al-wk-tag");
    if (strip && /My best/.test(strip.firstElementChild?.textContent || "")) {
      const shown = strip.querySelector(".al-wk-tag-v b")?.textContent.trim();
      const timeFront = /^s$/i.test(strip.querySelector(".al-wk-tag-v small")?.textContent.trim() || "");
      const run = runsFor(code).find((x) => value(x, timeFront).replace(/s$/, "") === shown);
      if (run) putTag(strip, runRank(run, state.made), null); else strip.querySelector(":scope > .es-run-rank")?.remove();
    }
    const back = card.querySelector(".al-wkb");
    if (!back) return;
    const runs = runsFor(code);
    const timeBased = /^s$/i.test(back.querySelector(".al-wkb-v small")?.textContent.trim() || "");
    const rows = [...back.querySelectorAll(".al-wkb-recent > li")];
    rows.forEach((li, i) => {
      const run = runs[i];
      // Inside the middle cell ("Time's up"), so the row keeps its three columns.
      const cell = li.querySelector(":scope > span") || li;
      if (!run || li.querySelector(":scope > b")?.textContent.trim() !== value(run, timeBased).replace(/s$/, "")) { cell.querySelector(":scope > .es-run-rank")?.remove(); return; }
      putTag(cell, runRank(run, state.made), null);
    });
    // "My best" is the best of every rank together: say which rank it was played at.
    const label = back.querySelector(".al-wkb-k");
    const shownBest = back.querySelector(".al-wkb-v span")?.textContent.trim();
    const bestRun = runs.find((run) => value(run, timeBased).replace(/s$/, "") === shownBest);
    if (label) { if (bestRun) putTag(label, runRank(bestRun, state.made), null); else label.querySelector(":scope > .es-run-rank")?.remove(); }
  }
  let panelCode = null; // the drill whose Full leaderboard was opened last
  function paintPanel() {
    const list = document.querySelector(".al-wkr-runs");
    const state = panelCode && cards.get(panelCode);
    if (!list || !state || !state.eligible || !ranks) return;
    const runs = runsFor(panelCode);
    const timeBased = /lower/i.test(document.querySelector(".al-wkr-k")?.textContent || "");
    const best = bestsPerRank(runs, state.made, timeBased);
    [...list.children].forEach((li, i) => {
      const run = runs[i];
      const shown = li.querySelector(".res b span")?.textContent.trim();
      if (!run || shown !== value(run, timeBased).replace(/s$/, "")) { li.querySelector(".es-run-rank")?.remove(); return; }
      const id = runRank(run, state.made);
      // "N below best" compares with the best at the same rank, with that rank's badge in front.
      const tail = li.querySelector(".tail, .pbtag");
      const top = best.get(id);
      if (tail && top) {
        const name = id === "off" ? "no-shoot" : rankById(id).name;
        const d = timeBased ? run.seconds - top.seconds : top.score - run.score;
        const want = top.id === run.id ? `Best at ${name}` : timeBased ? `${d.toFixed(1)}s slower than ${name} best` : `${Math.round(d)} below ${name} best`;
        if (tail.dataset.esRank !== id + "|" + want) {
          tail.dataset.esRank = id + "|" + want;
          tail.textContent = want;
          const icon = tag(id).firstChild;
          icon.classList?.add("es-tail-icon");
          tail.prepend(icon);
        }
      }
    });
    const head = document.querySelector(".al-wkr-best .note") || document.querySelector(".al-wkr-best b");
    if (head) putBests(head, runs, state, timeBased);
  }
  document.addEventListener("click", (e) => {
    const open = e.target.closest?.(".al-wkb-records");
    if (open) panelCode = open.closest(".al-wk-card[data-share-code]")?.dataset.shareCode || panelCode;
  }, true);

  let artTop = null;
  const onScreen = (el) => (el.checkVisibility ? el.checkVisibility({ contentVisibilityAuto: true }) : true);

  function paint(card, code) {
    const state = cards.get(code);
    if (!state || !state.eligible || !ranks) {
      if (card.classList.contains("es-rank")) { card.classList.remove("es-rank"); card.querySelector(".es-rank-hero")?.remove(); }
      return;
    }
    const at = Math.max(0, ranks.findIndex((r) => r.id === state.rank));
    const r = ranks[at];
    // Class and colours first: the game rewrites the card's class and style when it flips to Stats.
    if (!card.classList.contains("es-rank")) card.classList.add("es-rank");
    if (card.style.getPropertyValue("--es-rank-color") !== r.color) {
      card.style.setProperty("--es-rank-color", r.color);
      card.style.setProperty("--es-rank-glow", r.id === "off" ? "transparent" : glow(r.color));
    }
    const art = card.querySelector(".al-wk-art");
    if (!art) return;
    // On the card, over the picture (the picture fades its own contents toward the bottom).
    // lobby-scroll-fast-v1: cards off screen are skipped by the browser (content-visibility: auto); reading a
    // position inside one forces it to be laid out (121 cards: ~210 ms on every page change). The picture sits at
    // the same place on every card, so it is measured once on a card that is on screen.
    if (artTop === null && onScreen(art)) artTop = art.offsetTop;
    const rankTop = `${Math.max(4, (artTop ?? 4) + 10)}px`;
    if (card.style.getPropertyValue("--es-rank-top") !== rankTop) card.style.setProperty("--es-rank-top", rankTop);
    let hero = card.querySelector(":scope > .es-rank-hero");
    if (!hero || hero.dataset.rank !== r.id) {
      hero?.remove();
      hero = document.createElement("div");
      hero.className = "es-rank-hero";
      hero.dataset.rank = r.id;
      const row = document.createElement("div");
      row.className = "es-rank-row";
      const arrow = (dir, text, label) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "es-rank-arrow";
        b.textContent = text;
        b.dataset.dir = dir;
        b.setAttribute("aria-label", label);
        b.disabled = dir < 0 ? at === 0 : at === ranks.length - 1;
        return b;
      };
      let face;
      if (r.id === "off") { face = document.createElement("div"); face.className = "es-rank-off"; face.textContent = "✕"; }
      else { face = document.createElement("img"); face.className = "es-rank-badge"; face.src = ICON(r.id); face.alt = ""; face.draggable = false; }
      row.append(arrow(-1, "‹", "Lower enemy rank"), face, arrow(1, "›", "Higher enemy rank"));
      const pips = document.createElement("div");
      pips.className = "es-rank-pips";
      for (let i = 1; i < ranks.length; i++) { const p = document.createElement("i"); if (i <= at) p.className = "on"; pips.append(p); }
      const name = document.createElement("div");
      name.className = "es-rank-name";
      name.textContent = r.name;
      const line = document.createElement("div");
      line.className = "es-rank-sub";
      line.textContent = sub(r);
      hero.append(row, pips, name, line);
      hero.title = `Enemy rank: ${r.name}${state.made === r.id ? " (as the drill was made)" : ""}`;
      card.append(hero);
    }
    paintText(card, r, state);
  }

  // new-drill-tag-v1: red NEW chip on the picture of the drills exported from the Creator (main.js sets isNew).
  function paintNew(card, code) {
    const on = !!(cards.get(code) || {}).isNew;
    const tag = card.querySelector(":scope > .es-new-tag");
    if (on && !tag) { const t = document.createElement("div"); t.className = "es-new-tag"; t.textContent = "NEW"; card.append(t); }
    else if (!on && tag) tag.remove();
    paintRename(card, code);
  }

  // drill-rename-v1: pencil next to the drill name (only in the unpacked test copy: main.js sends renamable).
  const renamed = new Map(); // code -> name saved this session (the game's list keeps the old one until restart)
  function paintRename(card, code) {
    const state = cards.get(code) || {};
    const h3 = card.querySelector(".al-wk-body h3");
    let pen = card.querySelector(":scope > .es-rename");
    if (!state.renamable || !h3) { pen?.remove(); return; }
    const name = renamed.get(code);
    if (name && h3.textContent.trim() !== name && !card.querySelector(":scope > .es-rename-box")) h3.textContent = name;
    if (!pen) {
      pen = document.createElement("button");
      pen.type = "button";
      pen.className = "es-rename";
      pen.title = "Rename this drill";
      pen.setAttribute("aria-label", "Rename this drill");
      pen.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm17.7-10.2a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
      card.append(pen);
    }
    // Fixed spot next to the bookmark (CSS): no layout reads, which made scrolling stutter (lobby-scroll-fast-v1).
  }

  function openRename(card) {
    const code = card.dataset.shareCode, h3 = card.querySelector(".al-wk-body h3");
    if (!h3 || card.querySelector(":scope > .es-rename-box")) return;
    const box = document.createElement("form");
    box.className = "es-rename-box";
    box.style.top = `${h3.offsetTop - 4}px`;
    const input = document.createElement("input");
    input.maxLength = 60;
    input.value = h3.textContent.trim();
    input.spellcheck = false;
    const ok = document.createElement("button"); ok.type = "submit"; ok.textContent = "SAVE";
    const msg = document.createElement("div"); msg.className = "es-rename-msg";
    box.append(input, ok, msg);
    card.append(box);
    input.focus(); input.select();
    let busy = false, done = false;
    const close = () => { done = true; box.remove(); };
    const save = async () => {
      if (busy || done) return;
      const name = input.value.replace(/\s+/g, " ").trim();
      if (!name || name === h3.textContent.trim()) { close(); return; }
      busy = true; ok.disabled = true; msg.textContent = "";
      try {
        const res = await fetch(`/api/local/drill-rename?code=${encodeURIComponent(code)}&name=${encodeURIComponent(name)}`, { headers: { "X-Aim-Local": "1" }, cache: "no-store" });
        const data = await res.json().catch(() => ({ error: "Not saved." }));
        if (!res.ok || data.error) { msg.textContent = data.error || "Not saved."; busy = false; ok.disabled = false; input.focus(); return; }
        renamed.set(code, data.name);
        close();
        document.querySelectorAll(`.al-wk-card[data-share-code="${CSS.escape(code)}"]`).forEach((c) => paintRename(c, code));
      } catch (err) { msg.textContent = "Not saved."; busy = false; ok.disabled = false; }
    };
    box.addEventListener("submit", (e) => { e.preventDefault(); save(); });
    input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); close(); } });
    for (const t of ["keyup", "keypress"]) input.addEventListener(t, (e) => e.stopPropagation());
    input.addEventListener("blur", () => setTimeout(() => { if (!done && !busy && !box.contains(document.activeElement)) save(); }, 150));
  }

  async function ask(codes) {
    codes = codes.filter((c) => !cards.has(c) && !asking.has(c));
    if (!codes.length) return;
    codes.forEach((c) => asking.add(c));
    try {
      const res = await fetch(`${API}?codes=${encodeURIComponent(codes.join(","))}`, { cache: "no-store" });
      const data = await res.json();
      ranks = data.ranks;
      canRename = !!data.canRename;
      for (const c of codes) cards.set(c, data.cards[c] || { eligible: false });
    } catch (err) {
      console.warn("Enemy rank:", err);
    } finally {
      codes.forEach((c) => asking.delete(c));
    }
    sync();
  }

  function sync() {
    if (document.body.classList.contains("al-training-active")) return;
    const want = [];
    for (const card of document.querySelectorAll(".al-wk-card[data-share-code]:not(.al-wk-ad-card)")) {
      const code = card.dataset.shareCode;
      if (!cards.has(code)) want.push(code); else { paint(card, code); paintBack(card, code); paintNew(card, code); }
    }
    if (want.length) ask(want);
    paintPanel();
  }

  async function step(code, dir) {
    const state = cards.get(code);
    if (!state || !ranks) return;
    const at = ranks.findIndex((r) => r.id === state.rank);
    const next = ranks[Math.min(ranks.length - 1, Math.max(0, at + dir))];
    if (!next || next.id === state.rank) return;
    const before = state.rank;
    state.rank = next.id;
    document.querySelectorAll(`.al-wk-card[data-share-code="${CSS.escape(code)}"]`).forEach((c) => paint(c, code));
    try {
      const res = await fetch(`${API}?code=${encodeURIComponent(code)}&set=${next.id}`, { headers: { "X-Aim-Local": "1" }, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data[code]) cards.set(code, { ...state, ...data[code] });
    } catch (err) {
      console.warn("Enemy rank: not saved", err);
      state.rank = before;
    }
    document.querySelectorAll(`.al-wk-card[data-share-code="${CSS.escape(code)}"]`).forEach((c) => paint(c, code));
  }

  // The arrows sit on the card, which opens the drill on click: keep their clicks to themselves.
  const own = (e) => e.target.closest?.(".es-rank-arrow, .es-rename, .es-rename-box");
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
    document.addEventListener(type, (e) => { if (own(e)) e.stopPropagation(); }, true);
  }
  document.addEventListener("click", (e) => {
    const b = own(e);
    if (!b) return;
    if (b.classList.contains("es-rename-box")) { e.stopPropagation(); return; }
    e.preventDefault();
    e.stopPropagation();
    if (b.classList.contains("es-rename")) { const c = b.closest(".al-wk-card[data-share-code]"); if (c) openRename(c); return; }
    const card = b.closest(".al-wk-card[data-share-code]");
    if (card && !b.disabled) step(card.dataset.shareCode, Number(b.dataset.dir));
  }, true);

  let queued = false;
  const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; sync(); }); };
  if (window.__aimWatchPage) window.__aimWatchPage(schedule, { childList: true, subtree: true });
  else new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  schedule();
})();
