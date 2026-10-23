// Shooting error graph, like VALORANT's: a bar per shot showing how far off the bullet could
// go, split into firing error (spray/recoil) and movement error (moving while shooting, red on
// top). A clean counter-strafe gives a short green bar with no red.
//
// The numbers are the game's own: main.js patches the game's frame loop to call
// window.__aimShot(event) for every shot (spreadDeg = total error, firingDeg = spray part).
// Turned on in Settings > Video > Stats (saved in localStorage).
(() => {
  if (window.__aimShotGraph) return;
  window.__aimShotGraph = true;

  const KEY = "es-shot-graph"; // "off" | "graph" | "numbers"
  const SHOTS = 30;
  const CLEAN = 0.01; // degrees of movement error that still counts as standing still
  const mode = () => { try { return localStorage.getItem(KEY) || "off"; } catch { return "off"; } };
  const setMode = (m) => { try { localStorage.setItem(KEY, m); } catch {} sync(); };

  let shots = [];
  let panel = null, canvas = null, text = null;

  window.__aimShot = (e) => {
    if (!e || typeof e.spreadDeg !== "number") return;
    const total = Math.max(0, e.spreadDeg);
    const firing = Math.min(total, typeof e.firingDeg === "number" ? Math.max(0, e.firingDeg) : total);
    shots.push({ firing, movement: total - firing, total });
    if (shots.length > SHOTS) shots.shift();
    paint();
  };

  function build() {
    panel = document.createElement("div");
    panel.className = "es-shotgraph";
    panel.innerHTML = '<b>Shooting error</b><canvas width="260" height="90"></canvas><div class="es-shotgraph-text"></div><div class="es-shotgraph-key"><i class="f"></i>Firing <i class="m"></i>Movement</div>';
    canvas = panel.querySelector("canvas");
    text = panel.querySelector(".es-shotgraph-text");
    document.body.appendChild(panel);
  }

  function paint() {
    if (!panel) return;
    const dpr = window.devicePixelRatio || 1;
    const W = 260, H = 90;
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const top = Math.max(1, ...shots.map((s) => s.total)) * 1.1;
    const y = (deg) => H - 4 - (deg / top) * (H - 10);
    g.strokeStyle = "rgba(255,255,255,.12)";
    g.lineWidth = 1;
    for (const d of [0, top / 2]) { g.beginPath(); g.moveTo(0, y(d) + 0.5); g.lineTo(W, y(d) + 0.5); g.stroke(); }
    const bw = W / SHOTS;
    shots.forEach((s, i) => {
      const x = W - (shots.length - i) * bw + 1;
      g.fillStyle = s.movement > CLEAN ? "rgba(255,255,255,.55)" : "#4ade80";
      g.fillRect(x, y(s.firing), bw - 2, y(0) - y(s.firing));
      if (s.movement > CLEAN) {
        g.fillStyle = "#ff4655";
        g.fillRect(x, y(s.total), bw - 2, y(s.firing) - y(s.total));
      }
    });
    g.fillStyle = "rgba(255,255,255,.55)";
    g.font = "10px Bahnschrift, Segoe UI";
    g.fillText(`${top.toFixed(1)}°`, 3, 10);
    if (mode() === "numbers") {
      const last = shots[shots.length - 1];
      const clean = shots.filter((s) => s.movement <= CLEAN).length;
      text.textContent = last
        ? `Last ${last.total.toFixed(2)}° · moving ${last.movement.toFixed(2)}° · ${clean}/${shots.length} shots standing still`
        : "Shoot to see your error";
    } else text.textContent = "";
  }

  // Shown during rounds only (the round view is .al-aimlab-root), and reset for each round.
  let inRound = false;
  function sync() {
    const round = !!document.querySelector(".al-aimlab-root");
    if (round !== inRound) { inRound = round; shots = []; }
    const show = round && mode() !== "off";
    if (show && !panel) build();
    if (panel) panel.style.display = show ? "" : "none";
    if (show) paint();
    addSetting();
  }

  // Settings > Video > Stats: a row like the game's "Performance overlay" switch.
  function addSetting() {
    const anchor = document.querySelector('[data-setting="showPerformance"]');
    if (!anchor || anchor.parentElement.querySelector(".es-shotgraph-setting")) return;
    const row = document.createElement("div");
    row.className = "hall-field es-shotgraph-setting";
    row.innerHTML = '<span class="hall-field-text"><b>Shooting error graph</b><small>Like VALORANT: a bar for every shot. Green means you stood still; red on top is extra error from moving. Counter-strafe until no bar has red.</small></span><div class="es-shotgraph-seg" role="radiogroup"></div>';
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

  setInterval(sync, 400);
  sync();
})();
