// Spot mode on the lobby drill cards: a "Fixed | Random" switch above Start training on every
// pre-aim map drill. The pick is saved by main.js (/api/local/spot-mode, <userData>/spot-modes.json) and applied
// when the drill loads (spot-mode.js). Click handling follows enemy-rank-cards.js.
(() => {
  if (window.__aimSpotModeCards) return;
  window.__aimSpotModeCards = true;
  const API = "/api/local/spot-mode";
  const cards = new Map(); // shareCode -> { eligible, mode, authored }
  const asking = new Set();

  const style = document.createElement("style");
  style.textContent = `
.ov-spot{display:flex;align-items:center;gap:8px;margin:0 16px 8px;position:relative;z-index:6;flex:none}
.ov-spot-label{font:800 10px/1 "Arial Narrow",Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#8b909a;white-space:nowrap}
.ov-spot-seg{display:flex;flex:1;border:1px solid #4a4f5a;background:rgba(10,12,16,.82)}
.ov-spot-seg button{flex:1;height:26px;padding:0;border:0;background:transparent;color:#aeb2ba;cursor:pointer;
  font:800 11px/1 "Arial Narrow",Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}
.ov-spot-seg button+button{border-left:1px solid #4a4f5a}
.ov-spot-seg button:hover{color:#fff}
.ov-spot-seg button.is-on{background:#ff4655;color:#fff}`;
  document.head.append(style);

  function paint(card, code) {
    const state = cards.get(code);
    let box = card.querySelector(".ov-spot");
    if (!state || !state.eligible) { box?.remove(); return; }
    if (box && box.dataset.mode === state.mode) return;
    box?.remove();
    // Directly above the Start / Records buttons (a direct child of the card).
    const foot = card.querySelector(":scope > .al-wk-split");
    if (!foot) return;
    box = document.createElement("div");
    box.className = "ov-spot";
    box.dataset.mode = state.mode;
    box.title = "Fixed: bots stand in the same spots every time. Random: spots change every round.";
    box.innerHTML = '<span class="ov-spot-label">Bot spots</span><div class="ov-spot-seg" role="radiogroup" aria-label="Bot spots"></div>';
    const seg = box.querySelector(".ov-spot-seg");
    for (const [value, label] of [["fixed", "Fixed"], ["random", "Random"]]) {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.dataset.value = value;
      b.textContent = label;
      b.classList.toggle("is-on", value === state.mode);
      b.setAttribute("aria-checked", String(value === state.mode));
      seg.append(b);
    }
    card.insertBefore(box, foot);
  }

  async function ask(codes) {
    codes = codes.filter((c) => !cards.has(c) && !asking.has(c));
    if (!codes.length) return;
    codes.forEach((c) => asking.add(c));
    try {
      const res = await fetch(`${API}?codes=${encodeURIComponent(codes.join(","))}`, { cache: "no-store" });
      const data = await res.json();
      for (const c of codes) cards.set(c, data.cards[c] || { eligible: false });
    } catch (err) {
      console.warn("Spot mode:", err);
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
      if (!cards.has(code)) want.push(code); else paint(card, code);
    }
    if (want.length) ask(want);
  }

  async function choose(code, mode) {
    const state = cards.get(code);
    if (!state || state.mode === mode) return;
    const before = state.mode;
    state.mode = mode;
    document.querySelectorAll(`.al-wk-card[data-share-code="${CSS.escape(code)}"]`).forEach((c) => paint(c, code));
    try {
      const res = await fetch(`${API}?code=${encodeURIComponent(code)}&set=${mode}`, { headers: { "X-Aim-Local": "1" }, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data[code]) cards.set(code, data[code]);
    } catch (err) {
      console.warn("Spot mode: not saved", err);
      state.mode = before;
    }
    document.querySelectorAll(`.al-wk-card[data-share-code="${CSS.escape(code)}"]`).forEach((c) => paint(c, code));
  }

  const own = (e) => e.target.closest?.(".ov-spot");
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
    document.addEventListener(type, (e) => { if (own(e)) e.stopPropagation(); }, true);
  }
  document.addEventListener("click", (e) => {
    const box = own(e);
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    const b = e.target.closest("button[data-value]");
    const card = box.closest(".al-wk-card[data-share-code]");
    if (b && card) choose(card.dataset.shareCode, b.dataset.value);
  }, true);

  let queued = false;
  const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; sync(); }); };
  if (window.__aimWatchPage) window.__aimWatchPage(schedule, { childList: true, subtree: true });
  else new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  schedule();
})();
