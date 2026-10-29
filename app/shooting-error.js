// Shooting error graph, like VALORANT's: a thin bar per shot showing how far off the bullet
// could go, split into firing error (spray/recoil, yellow) and movement error (moving while
// shooting, blue on top). A clean counter-strafe gives a yellow bar with no blue.
//
// The numbers are the game's own: main.js patches the game's frame loop to call
// window.__aimShot(event) for every shot (spreadDeg = total error, firingDeg = spray part).
// Turned on in Settings > Video > Stats (saved in localStorage).
//
// Kept cheap: one small canvas (no DOM text, no backdrop blur), shots in a fixed ring buffer,
// at most one repaint per animation frame and only when a shot arrives.
(() => {
  if (window.__aimShotGraph) return;
  window.__aimShotGraph = true;

  const KEY = "es-shot-graph"; // "off" | "graph" | "numbers"
  const SHOTS = 30;
  const CLEAN = 0.01; // degrees of movement error that still counts as standing still
  // Fixed scale steps, so a bar's height means the same thing from shot to shot.
  const SCALES = [0.25, 0.5, 1, 2, 3, 5, 8, 12, 20, 30, 45];
  const FIRING = "#ffd25a", MOVEMENT = "#5ce1e6";
  // Layout in CSS pixels: title row, then the plot with its scale on the left and
  // the last shot's numbers on the right.
  const AXIS = 30, BAR = 2, GAP = 1, PLOT_W = SHOTS * (BAR + GAP) + 1, PLOT_H = 34;
  const TOP = 15, NUMS = 40, H = TOP + PLOT_H + 1;
  const mode = () => { try { return localStorage.getItem(KEY) || "off"; } catch { return "off"; } };
  const setMode = (m) => { try { localStorage.setItem(KEY, m); } catch {} sync(); };

  const firing = new Float32Array(SHOTS), movement = new Float32Array(SHOTS);
  let count = 0, head = 0; // ring buffer: head is the next slot to write
  let canvas = null, g = null, queued = false, shown = "";

  window.__aimShot = (e) => {
    if (!e || typeof e.spreadDeg !== "number") return;
    const total = Math.max(0, e.spreadDeg);
    const f = Math.min(total, typeof e.firingDeg === "number" ? Math.max(0, e.firingDeg) : total);
    firing[head] = f;
    movement[head] = total - f;
    head = (head + 1) % SHOTS;
    if (count < SHOTS) count++;
    queue();
  };

  function queue() {
    if (queued || !canvas || canvas.style.display) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; paint(); });
  }

  function build() {
    canvas = document.createElement("canvas");
    canvas.className = "es-shotgraph";
    document.body.appendChild(canvas);
    g = canvas.getContext("2d");
  }

  function label(text, x, y, color, align) {
    g.textAlign = align;
    g.fillStyle = "rgba(0,0,0,.8)";
    g.fillText(text, x + 1, y + 1);
    g.fillStyle = color;
    g.fillText(text, x, y);
  }

  function paint() {
    if (!canvas) return;
    const numbers = mode() === "numbers";
    const W = AXIS + PLOT_W + (numbers ? NUMS : 2);
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    let max = 0;
    for (let i = 0; i < count; i++) max = Math.max(max, firing[i] + movement[i]);
    const top = SCALES.find((s) => s >= max) ?? Math.ceil(max / 15) * 15;

    g.font = "700 11px Bahnschrift, Segoe UI, sans-serif";
    label("Shooting Error", 0, 10, "#fff", "left");

    // plot frame and half line
    const x0 = AXIS, y0 = TOP, plotBottom = y0 + PLOT_H;
    g.fillStyle = "rgba(0,0,0,.35)";
    g.fillRect(x0, y0, PLOT_W, PLOT_H);
    g.strokeStyle = "rgba(255,210,90,.75)";
    g.lineWidth = 1;
    g.strokeRect(x0 + 0.5, y0 + 0.5, PLOT_W - 1, PLOT_H - 1);
    g.fillStyle = "rgba(255,255,255,.12)";
    g.fillRect(x0 + 1, Math.round(y0 + PLOT_H / 2), PLOT_W - 2, 1);

    g.font = "9px Bahnschrift, Segoe UI, sans-serif";
    const digits = top < 1 ? 2 : 1;
    label(`${top.toFixed(digits)}°`, x0 - 3, y0 + 8, "#c9ced6", "right");
    label(`${(top / 2).toFixed(digits)}°`, x0 - 3, y0 + PLOT_H / 2 + 3, "#c9ced6", "right");

    // bars, newest on the right; heights in device pixels so small errors still show
    const inner = PLOT_H - 2, base = plotBottom - 1;
    const px = (deg) => (deg <= 0 ? 0 : Math.max(1 / dpr, Math.round((deg / top) * inner * dpr) / dpr));
    for (let n = 0; n < count; n++) {
      const i = (head - count + n + SHOTS) % SHOTS;
      const x = x0 + 1 + (SHOTS - count + n) * (BAR + GAP);
      const f = px(firing[i]);
      const m = movement[i] > CLEAN ? Math.min(inner - f, px(movement[i])) : 0;
      g.fillStyle = FIRING;
      g.fillRect(x, base - f, BAR, f);
      if (m > 0) {
        g.fillStyle = MOVEMENT;
        g.fillRect(x, base - f - m, BAR, m);
      }
    }

    if (numbers) {
      const last = count ? (head - 1 + SHOTS) % SHOTS : -1;
      g.font = "700 10px Bahnschrift, Segoe UI, sans-serif";
      const nx = x0 + PLOT_W + 4;
      label(last < 0 ? "-" : `${movement[last].toFixed(2)}°`, nx, y0 + 12, MOVEMENT, "left");
      label(last < 0 ? "-" : `${firing[last].toFixed(2)}°`, nx, y0 + 27, FIRING, "left");
    }
  }

  // Shown during rounds only (the round view is .al-aimlab-root), and reset for each round.
  let inRound = false;
  function sync() {
    const round = !!document.querySelector(".al-aimlab-root");
    if (round !== inRound) { inRound = round; count = 0; head = 0; shown = ""; }
    const m = round ? mode() : "off";
    if (m !== "off" && !canvas) build();
    if (canvas) canvas.style.display = m !== "off" ? "" : "none";
    if (m !== shown) { shown = m; if (m !== "off") paint(); }
    addSetting();
  }

  // Settings > Video > Stats: a row like the game's "Performance overlay" switch.
  function addSetting() {
    const anchor = document.querySelector('[data-setting="showPerformance"]');
    if (!anchor || anchor.parentElement.querySelector(".es-shotgraph-setting")) return;
    const row = document.createElement("div");
    row.className = "hall-field es-shotgraph-setting";
    row.innerHTML = '<span class="hall-field-text"><b>Shooting error graph</b><small>Like VALORANT: a thin bar for every shot. Yellow is spray error; blue on top is extra error from moving. Counter-strafe until no bar has blue.</small></span><div class="es-shotgraph-seg" role="radiogroup"></div>';
    const seg = row.querySelector(".es-shotgraph-seg");
    for (const [value, label] of [["off", "Off"], ["graph", "Graph"], ["numbers", "Graph + numbers"]]) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.setAttribute("role", "radio");
      b.addEventListener("click", () => { setMode(value); mark(); });
      b.dataset.value = value;
      seg.appendChild(b);
    }
    const mark = () => { for (const b of seg.children) { const on = b.dataset.value === mode(); b.classList.toggle("is-on", on); b.setAttribute("aria-checked", String(on)); } };
    mark();
    anchor.after(row);
  }

  setInterval(sync, 500);
  sync();
})();
