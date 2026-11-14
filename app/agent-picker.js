// In-game agent picker (10 Nov 2026): press N in a round (or on the pause screen) to choose Jett,
// Neon or Chamber (added 13 Nov). The choice is saved like the old lobby button did (localStorage "aim-agent", read by the game
// when a round is set up; see site/local/neon-kit.mjs), sent to the threaded game worker, and the round
// restarts so the new agent's abilities apply right away. Keys while open: 1 / 2 pick, arrows + Enter,
// N or Esc close. Styled with the esports theme variables (theme-esports.css).
(() => {
  if (window.__aimAgentPicker) return;
  window.__aimAgentPicker = true;

  const AGENTS = [
    { id: "jett", name: "Jett", role: "Duelist", face: "/local/loading/faces/jett.png",
      kit: [["tailwind", "Tailwind"], ["updraft", "Updraft"], ["cloudburst", "Cloudburst"], ["bladestorm", "Blade Storm"]] },
    { id: "neon", name: "Neon", role: "Duelist", face: "/local/loading/faces/neon.png",
      kit: [["highGear", "High Gear"], ["Right-click", "Slide while sprinting"]] },
    // Chamber (13 Nov 2026): abilities on top of your gun, see site/local/chamber-kit.mjs.
    { id: "chamber", name: "Chamber", role: "Sentinel", face: "/local/loading/faces/chamber.png",
      kit: [["headhunter", "Headhunter"], ["tourdeforce", "Tour de Force"]] },
  ];
  const read = () => { try { const v = localStorage.getItem("aim-agent"); return v === "neon" || v === "chamber" ? v : "jett"; } catch { return "jett"; } };

  const css = `
  .aim-agent-pick { position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: center;
    background: rgba(5, 7, 10, .62); backdrop-filter: blur(3px); font-family: var(--es-head, "Bahnschrift", "Segoe UI", sans-serif); }
  .aim-agent-pick[hidden] { display: none; }
  .aim-agent-pick .ap-panel { width: min(900px, calc(100vw - 32px)); background: var(--es-panel, #10131a);
    border: 1px solid var(--es-line, #272d39); border-top: 3px solid var(--es-red, #ff4655);
    clip-path: var(--es-cut, none); padding: 18px 20px 16px; color: var(--es-text, #f4f5f7); box-shadow: 0 24px 60px rgba(0,0,0,.5); }
  .aim-agent-pick .ap-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; }
  .aim-agent-pick .ap-head b { font-size: 20px; letter-spacing: .08em; text-transform: uppercase; }
  .aim-agent-pick .ap-head span { color: var(--es-muted, #9aa1ae); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; }
  .aim-agent-pick .ap-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .aim-agent-pick .ap-card { position: relative; display: grid; grid-template-columns: 64px 1fr; gap: 12px; align-items: center; text-align: left;
    background: var(--es-raised, #171b23); border: 1px solid var(--es-line-2, #343b4a); color: inherit; font: inherit;
    padding: 12px 14px 12px 12px; cursor: pointer; clip-path: var(--es-slant-sm, none); transition: background .12s, border-color .12s; }
  .aim-agent-pick .ap-card:hover, .aim-agent-pick .ap-card.is-focus { background: var(--es-raised-2, #1e232d); border-color: var(--es-red-2, #ff6b77); }
  .aim-agent-pick .ap-card.is-on { background: var(--es-red-wash, rgba(255,70,85,.14)); border-color: var(--es-red, #ff4655); }
  .aim-agent-pick .ap-face { width: 64px; height: 64px; object-fit: cover; background: var(--es-bg, #090b0f); border: 1px solid var(--es-line, #272d39); }
  .aim-agent-pick .ap-name { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .aim-agent-pick .ap-key { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; font-size: 12px;
    background: var(--es-bg, #090b0f); border: 1px solid var(--es-line-2, #343b4a); color: var(--es-soft, #d6d9df); }
  .aim-agent-pick .ap-role { color: var(--es-muted, #9aa1ae); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; margin: 2px 0 6px; }
  .aim-agent-pick .ap-kit { display: flex; flex-wrap: wrap; gap: 4px 10px; color: var(--es-soft, #d6d9df); font-size: 12px; }
  .aim-agent-pick .ap-kit i { font-style: normal; color: var(--es-red-2, #ff6b77); font-weight: 700; margin-right: 3px; }
  .aim-agent-pick .ap-badge { position: absolute; top: 8px; right: 12px; font-size: 10px; font-weight: 700; letter-spacing: .12em;
    text-transform: uppercase; color: #fff; background: var(--es-red, #ff4655); padding: 2px 6px; }
  .aim-agent-pick .ap-foot { margin-top: 12px; color: var(--es-dim, #6b7280); font-size: 12px; letter-spacing: .04em; }
  .aim-agent-toast { position: fixed; left: 50%; top: 18%; transform: translateX(-50%); z-index: 2147483001; pointer-events: none;
    background: var(--es-panel, #10131a); border-left: 3px solid var(--es-red, #ff4655); color: var(--es-text, #f4f5f7);
    font-family: var(--es-head, "Bahnschrift", "Segoe UI", sans-serif); font-size: 14px; letter-spacing: .06em; text-transform: uppercase;
    padding: 9px 14px; transition: opacity .3s; }
  @media (max-width: 760px) { .aim-agent-pick .ap-list { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 520px) { .aim-agent-pick .ap-list { grid-template-columns: 1fr; } }`;

  // Kit keys are the player's own bindings (Settings > Controls > Jett / Neon / Chamber); plain text passes through.
  const KEY_DEFAULTS = { tailwind: "KeyE", updraft: "KeyQ", cloudburst: "KeyC", bladestorm: "KeyX", highGear: "KeyE", headhunter: "KeyQ", tourdeforce: "KeyX" };
  const KEY_NAMES = { Mouse0: "M1", Mouse1: "M3", Mouse2: "M2", Mouse3: "M4", Mouse4: "M5", WheelUp: "Wheel up", WheelDown: "Wheel down", Space: "Space", ShiftLeft: "Shift", ShiftRight: "Shift", ControlLeft: "Ctrl", ControlRight: "Ctrl", AltLeft: "Alt", AltRight: "Alt", Tab: "Tab", CapsLock: "Caps" };
  function keyLabel(action) {
    if (!(action in KEY_DEFAULTS)) return action;
    let binds = null;
    try { const saved = JSON.parse(localStorage.getItem("al-keybinds-v1") ?? "null"); if (saved && Array.isArray(saved[action])) binds = saved[action]; } catch {}
    binds ??= window.__aimKeybinds?.[action] ?? [KEY_DEFAULTS[action], null];
    const code = binds.find((k) => typeof k === "string");
    return code ? KEY_NAMES[code] ?? code.replace(/^Key|^Digit|^Numpad/, "") : "unbound";
  }

  let root = null, focus = 0, toastTimer = 0;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  function build() {
    const style = el("style"); style.id = "aim-agent-pick-css"; style.textContent = css; document.head.appendChild(style);
    root = el("div", "aim-agent-pick"); root.hidden = true; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Pick your agent");
    root.addEventListener("mousedown", (e) => { if (e.target === root) close(); });
    document.body.appendChild(root);
  }
  function render() {
    const now = read();
    root.textContent = "";
    const panel = el("div", "ap-panel");
    const head = el("div", "ap-head"); head.append(el("b", "", "Pick your agent"), el("span", "", "Round restarts with your pick"));
    const list = el("div", "ap-list");
    AGENTS.forEach((a, i) => {
      const card = el("button", "ap-card" + (a.id === now ? " is-on" : "") + (i === focus ? " is-focus" : ""));
      card.type = "button";
      const face = el("img", "ap-face"); face.src = a.face; face.alt = ""; face.draggable = false;
      const body = el("div");
      const name = el("div", "ap-name"); name.append(el("span", "ap-key", String(i + 1)), el("span", "", a.name));
      const kit = el("div", "ap-kit");
      for (const [key, what] of a.kit) { const k = el("span"); k.append(el("i", "", keyLabel(key)), document.createTextNode(what)); kit.append(k); }
      body.append(name, el("div", "ap-role", a.role), kit);
      card.append(face, body);
      if (a.id === now) card.append(el("span", "ap-badge", "Playing"));
      card.addEventListener("click", () => pick(a.id));
      card.addEventListener("mouseenter", () => { focus = i; for (const [j, c] of [...list.children].entries()) c.classList.toggle("is-focus", j === i); });
      list.append(card);
    });
    panel.append(head, list, el("div", "ap-foot", "1 / 2 / 3 or click to pick · arrows + Enter · N or Esc to close"));
    root.append(panel);
  }
  const isOpen = () => !!root && !root.hidden;
  function open() {
    if (!root) build();
    focus = Math.max(0, AGENTS.findIndex((a) => a.id === read()));
    render(); root.hidden = false;
  }
  function close() { if (root) root.hidden = true; }
  function toast(text) {
    let t = document.querySelector(".aim-agent-toast");
    if (!t) { t = el("div", "aim-agent-toast"); document.body.appendChild(t); }
    t.textContent = text; t.style.opacity = "1";
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.style.opacity = "0"; }, 1800);
  }
  function pick(id) {
    close();
    const agent = AGENTS.find((a) => a.id === id);
    if (!agent || id === read()) return;
    try { localStorage.setItem("aim-agent", id); } catch {}
    // The threaded game keeps its own copy of localStorage; send it the new value before restarting.
    try { window.__aimRefreshWorkerPreferences?.(); } catch {}
    const engine = window.__aimDrillPreparation?.engine;
    if (engine && typeof engine.restart === "function") {
      Promise.resolve().then(() => engine.restart()).catch(() => {});
      toast(`Now playing ${agent.name}`);
    } else toast(`${agent.name} from the next round`);
  }
  // In a round (mouse locked) or on its pause screen; never while typing.
  const inGame = () => !!document.pointerLockElement || !!document.querySelector('[class*="al-pause"]');
  const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "") || document.activeElement?.isContentEditable;

  // Capture on window: runs before the game's own key listeners, so N / 1 / 2 / arrows / Enter don't
  // also switch weapons or reach the game while the picker is open.
  window.addEventListener("keydown", (e) => {
    if (typing() || e.ctrlKey || e.metaKey || e.altKey) return;
    const code = e.code;
    if (!isOpen()) {
      if (code === "KeyN" && !e.repeat && inGame()) { e.preventDefault(); e.stopImmediatePropagation(); open(); }
      return;
    }
    const n = AGENTS.length;
    let used = true;
    if (code === "KeyN" || code === "Escape") close();
    else if (code === "Digit1" || code === "Numpad1") pick(AGENTS[0].id);
    else if (code === "Digit2" || code === "Numpad2") pick(AGENTS[1].id);
    else if (code === "Digit3" || code === "Numpad3") pick(AGENTS[2].id);
    else if (code === "ArrowLeft" || code === "ArrowUp") { focus = (focus + n - 1) % n; render(); }
    else if (code === "ArrowRight" || code === "ArrowDown") { focus = (focus + 1) % n; render(); }
    else if (code === "Enter" || code === "NumpadEnter") pick(AGENTS[focus].id);
    else used = false;
    if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  window.addEventListener("keyup", (e) => {
    if (["KeyN", "Digit1", "Digit2", "Digit3", "Numpad1", "Numpad2", "Numpad3"].includes(e.code) && (isOpen() || e.code === "KeyN") && !typing()) e.stopImmediatePropagation();
  }, true);
  // Leaving the round closes it.
  document.addEventListener("pointerlockchange", () => { if (!document.pointerLockElement && isOpen() && !document.querySelector('[class*="al-pause"]')) close(); });

  // Settings > Controls (lobby page and in-round settings): Jett / Neon / Chamber tabs above the agent
  // sections, so you pick an agent and see only its ability keys. The sections' heading and rows carry
  // data-kb-group (Dc2Dm9E6.js, marker agent-keybinds-v1). No DOM observer: synced shortly after clicks
  // and Enter / Esc only, so it costs nothing during a round. The tab starts on the agent you play.
  const AGENT_IDS = AGENTS.map((a) => a.id);
  let kbTab = null;
  const hideRules = AGENT_IDS.flatMap((on) => AGENT_IDS.filter((x) => x !== on).map((x) => '[data-kb-agent="' + on + '"] [data-kb-group="' + x + '"]')).join(",");
  const kbCss = hideRules + ` { display: none !important; }
  .kb-agent-tabs { display: flex; gap: 8px; margin: 18px 0 6px; flex-wrap: wrap; align-items: center; }
  .kb-agent-tabs .kb-at { display: flex; align-items: center; gap: 8px; padding: 6px 14px 6px 6px; cursor: pointer;
    font-family: var(--es-head, "Bahnschrift", "Segoe UI", sans-serif); font-size: 14px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
    color: var(--es-soft, #d6d9df); background: var(--es-raised, #171b23); border: 1px solid var(--es-line-2, #343b4a); clip-path: var(--es-slant-sm, none); }
  .kb-agent-tabs .kb-at:hover { border-color: var(--es-red-2, #ff6b77); color: #fff; }
  .kb-agent-tabs .kb-at.is-on { background: var(--es-red-wash, rgba(255,70,85,.14)); border-color: var(--es-red, #ff4655); color: #fff; }
  .kb-agent-tabs .kb-at img { width: 30px; height: 30px; object-fit: cover; background: var(--es-bg, #090b0f); }
  .kb-agent-tabs .kb-at small { font-size: 9px; letter-spacing: .12em; color: #fff; background: var(--es-red, #ff4655); padding: 1px 5px; }
  .kb-agent-tabs .kb-at-note { color: var(--es-muted, #9aa1ae); font-size: 12px; margin-left: 4px; }`;
  function syncControls() {
    const heads = [...document.querySelectorAll("h3[data-kb-group]")].filter((h) => AGENT_IDS.includes(h.dataset.kbGroup));
    if (!heads.length) return;
    if (!document.getElementById("kb-agent-css")) { const s = el("style"); s.id = "kb-agent-css"; s.textContent = kbCss; document.head.appendChild(s); }
    if (!AGENT_IDS.includes(kbTab)) kbTab = read();
    const first = heads[0], host = first.parentElement, playing = read();
    let bar = host.querySelector(":scope > .kb-agent-tabs");
    if (!bar || bar.nextElementSibling !== first) {
      bar?.remove(); bar = el("div", "kb-agent-tabs"); bar.setAttribute("role", "tablist");
      for (const a of AGENTS) {
        const b = el("button", "kb-at"); b.type = "button"; b.dataset.agent = a.id; b.setAttribute("role", "tab");
        const img = el("img"); img.src = a.face; img.alt = ""; img.draggable = false;
        b.append(img, el("span", "", a.name));
        b.addEventListener("click", () => { kbTab = a.id; syncControls(); });
        bar.append(b);
      }
      bar.append(el("span", "kb-at-note", "Pick an agent to see and change its ability keys. Different agents can use the same keys."));
      host.insertBefore(bar, first);
    }
    for (const b of bar.querySelectorAll(".kb-at")) {
      const on = b.dataset.agent === kbTab;
      b.classList.toggle("is-on", on); b.setAttribute("aria-selected", String(on));
      const tag = b.querySelector("small");
      if (b.dataset.agent === playing && !tag) b.append(el("small", "", "Playing"));
      else if (b.dataset.agent !== playing && tag) tag.remove();
    }
    host.dataset.kbAgent = kbTab;
  }
  window.__aimSyncAgentKeybinds = syncControls;
  const soon = () => { setTimeout(syncControls, 30); setTimeout(syncControls, 250); };
  document.addEventListener("click", soon, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === "Escape") soon(); }, true);
  soon();
})();
