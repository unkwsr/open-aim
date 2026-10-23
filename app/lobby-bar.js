// Lobby top bar: the left sidebar is hidden by theme-esports.css, and its Quick
// start and items (Favorites, Training Creator, Workshop manual, ...) are shown as
// buttons in the top bar instead. Each button clicks the hidden sidebar item, so
// the game's own handlers (and its links) keep working unchanged.
(() => {
  if (window.__aimLobbyBar) return;
  window.__aimLobbyBar = true;

  const SHORT = { favorites: "Favorites", "open-studio": "Creator", "open-studio-guide": "Manual" };
  const GAUGE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 18a9 9 0 1 1 16 0"/><path d="M12 14l4-5"/></svg>';

  const SENS_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/></svg>';
  const BACKUP_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16v12H4z"/><path d="M3 4h18v3H3zM10 11h4"/></svg>';

  // ---------- FPS meter ----------
  // A small readout in the bottom-right: frames per second, average frame time and
  // 1% low (the frame rate of the slowest 1% of frames over the last 5 seconds).
  // Stays on in rounds; counts frames with requestAnimationFrame, like the game.
  const METER_KEY = "es-fps-meter";
  let meter = null;
  let meterRaf = 0;

  function meterOn() {
    try { return localStorage.getItem(METER_KEY) === "1"; } catch { return false; }
  }

  function setMeter(on) {
    try { localStorage.setItem(METER_KEY, on ? "1" : "0"); } catch {}
    if (on) startMeter();
    else stopMeter();
    for (const b of document.querySelectorAll(".es-bar-fps")) b.classList.toggle("is-on", on);
  }

  function startMeter() {
    if (meter) return;
    meter = document.createElement("div");
    meter.className = "es-fps";
    meter.innerHTML = '<b>–</b><span>FPS</span><small>– ms · 1% low –</small>';
    document.body.appendChild(meter);
    const [fpsEl, , detailEl] = meter.children;
    const frames = []; // [time, frame duration]
    let last = performance.now();
    let shown = 0;
    const tick = (now) => {
      frames.push([now, now - last]);
      last = now;
      while (frames.length && now - frames[0][0] > 5000) frames.shift();
      if (now - shown > 250 && frames.length > 10) {
        shown = now;
        const second = frames.filter((f) => now - f[0] <= 1000);
        const avg = second.reduce((s, f) => s + f[1], 0) / second.length;
        const sorted = frames.map((f) => f[1]).sort((a, b) => a - b);
        const p99 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
        const fpsNow = Math.round(1000 / avg);
        const low = Math.round(1000 / p99);
        fpsEl.textContent = fpsNow;
        detailEl.textContent = `${avg.toFixed(1)} ms · 1% low ${low}`;
        meter.dataset.tone = low >= fpsNow * 0.7 ? "good" : low >= fpsNow * 0.4 ? "ok" : "bad";
      }
      meterRaf = requestAnimationFrame(tick);
    };
    meterRaf = requestAnimationFrame(tick);
  }

  function stopMeter() {
    cancelAnimationFrame(meterRaf);
    meter?.remove();
    meter = null;
  }

  if (meterOn()) startMeter();

  const PLAY = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M7 4.5v15l13-7.5z"/></svg>';

  function railItems() {
    const rail = document.querySelector(".hall-rail");
    // Items the sidebar itself kept hidden stay hidden (the rail is display:none, so check each item's own display).
    // The workshop guide page was never saved offline, so its link would open a 404.
    return rail
      ? [...rail.querySelectorAll(".hall-rail-item")].filter((it) => getComputedStyle(it).display !== "none" && it.dataset.action !== "open-studio-guide")
      : [];
  }

  function keyOf(item, i) {
    return item.dataset.action || `item-${i}`;
  }

  // The bar sits in the top nav just before the Sens box (.hall-topnav-right, whose
  // other children the site's overrides hide).
  function build(right) {
    const bar = document.createElement("div");
    bar.className = "es-bar";
    right.before(bar);
    return bar;
  }

  function sync() {
    const right = document.querySelector(".hall-topnav > .hall-topnav-right");
    if (!right) return;
    const prev = right.previousElementSibling;
    const bar = prev && prev.classList.contains("es-bar") ? prev : build(right);

    // Signature of what the sidebar shows now; rebuild the buttons only when it changes.
    const quick = document.querySelector(".hall-rail-quick");
    const items = railItems();
    const sig = [quick ? quick.querySelector("em")?.textContent || "q" : "", ...items.map((it, i) => keyOf(it, i) + ":" + it.textContent.trim() + ":" + it.classList.contains("is-active"))].join("|");
    if (bar.dataset.sig === sig) return;
    bar.dataset.sig = sig;
    bar.textContent = "";

    items.forEach((item, i) => {
      const key = keyOf(item, i);
      const label = item.textContent.trim();
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "es-bar-btn" + (item.classList.contains("is-active") ? " is-on" : "");
      btn.title = label;
      const icon = item.querySelector("svg");
      if (icon) btn.appendChild(icon.cloneNode(true));
      const span = document.createElement("span");
      span.textContent = SHORT[key] || label;
      btn.appendChild(span);
      btn.addEventListener("click", () => {
        // Creator opens the Studio (studio/), which replaces the site's editor.
        if (key === "open-studio") return location.assign("/studio/");
        const live = railItems().find((it, j) => keyOf(it, j) === key);
        if (live) live.click();
      });
      bar.appendChild(btn);
    });

    const fps = document.createElement("button");
    fps.type = "button";
    fps.className = "es-bar-btn es-bar-fps" + (meterOn() ? " is-on" : "");
    fps.title = "FPS meter: live frame rate, frame time and 1% low (also shown during rounds)";
    fps.innerHTML = GAUGE;
    const fpsLabel = document.createElement("span");
    fpsLabel.textContent = "FPS";
    fps.appendChild(fpsLabel);
    fps.addEventListener("click", () => setMeter(!meterOn()));
    bar.appendChild(fps);

    // Panels from player-tools.js.
    for (const [label, title, icon, open] of [
      ["Sens tools", "Sensitivity tools: eDPI, cm/360 and converter from other games", SENS_ICON, "openSens"],
      ["Backups", "Back up, restore, export or import your training data", BACKUP_ICON, "openBackups"],
    ]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "es-bar-btn";
      b.title = title;
      b.innerHTML = icon;
      const s = document.createElement("span");
      s.textContent = label;
      b.appendChild(s);
      b.addEventListener("click", () => window.__aimTools?.[open]());
      bar.appendChild(b);
    }

    if (quick) {
      const name = quick.querySelector("em")?.textContent.trim() || "";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "es-bar-quick";
      btn.title = name ? `Quick start: ${name}` : "Quick start";
      btn.innerHTML = PLAY;
      const span = document.createElement("span");
      span.textContent = "Quick start";
      btn.appendChild(span);
      btn.addEventListener("click", () => document.querySelector(".hall-rail-quick")?.click());
      bar.appendChild(btn);
    }
  }

  // Sliding red highlight under the active top-bar tab (styled in theme-esports.css).
  function glideTabs() {
    const tabs = document.querySelector(".hall-topnav .hall-tabs");
    const active = tabs && tabs.querySelector(".hall-tab.is-active");
    if (!active) return;
    let glide = tabs.querySelector(":scope > .es-tab-glide");
    if (!glide) {
      glide = document.createElement("span");
      glide.className = "es-tab-glide";
      glide.style.transition = "none";
      tabs.prepend(glide);
      requestAnimationFrame(() => requestAnimationFrame(() => (glide.style.transition = "")));
    }
    tabs.classList.add("has-glide");
    const left = active.offsetLeft + "px";
    const width = active.offsetWidth + "px";
    if (glide.style.left !== left) glide.style.left = left;
    if (glide.style.width !== width) glide.style.width = width;
  }

  // Smooth mouse-wheel scrolling for the menus. Chromium jumps a whole wheel step
  // (120 px) in one frame here; instead each step eases the nearest vertical
  // scroller to its new position over ~150 ms, updating every frame. Not active
  // while the mouse is locked (in a round) or when the game handles the wheel itself.
  const glides = new Map();

  function verticalScroller(el) {
    for (; el && el !== document.documentElement; el = el.parentElement) {
      if (el.scrollHeight <= el.clientHeight + 1) continue;
      if (/(auto|scroll)/.test(getComputedStyle(el).overflowY)) return el;
    }
    return null;
  }

  function step(el) {
    const g = glides.get(el);
    const now = performance.now();
    const dt = Math.min(50, now - g.last);
    g.last = now;
    // Track the position as a float (scrollTop rounds to whole pixels); stop if
    // something else moved the scroller (scrollbar drag, the game itself).
    const moved = Math.abs(el.scrollTop - g.set) > 2;
    const diff = g.target - g.pos;
    if (moved || Math.abs(diff) < 0.5) {
      if (!moved) el.scrollTop = g.target;
      el.style.scrollBehavior = g.behavior;
      glides.delete(el);
      return;
    }
    g.pos += diff * (1 - Math.exp(-dt / 50));
    el.scrollTop = g.pos;
    g.set = el.scrollTop;
    requestAnimationFrame(() => step(el));
  }

  addEventListener(
    "wheel",
    (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.shiftKey || document.pointerLockElement) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const el = verticalScroller(e.target);
      if (!el) return;
      const delta = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? el.clientHeight : 1);
      const max = el.scrollHeight - el.clientHeight;
      let g = glides.get(el);
      if (!g) {
        g = { target: el.scrollTop, pos: el.scrollTop, set: el.scrollTop, last: performance.now(), behavior: el.style.scrollBehavior };
        el.style.scrollBehavior = "auto";
        glides.set(el, g);
        requestAnimationFrame(() => step(el));
      }
      g.target = Math.max(0, Math.min(max, g.target + delta));
      e.preventDefault();
    },
    { passive: false }
  );

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sync();
      glideTabs();
    });
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  sync();
  glideTabs();
  addEventListener("resize", glideTabs);
})();
