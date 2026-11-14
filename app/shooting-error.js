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

  const MODE_STORAGE_KEY = "es-shot-graph"; // "off" | "graph" | "numbers"
  const MAX_SHOTS = 30;
  const STILL_ERROR_DEG = 0.01; // degrees of movement error that still counts as standing still
  // Fixed scale steps, so a bar's height means the same thing from shot to shot.
  const SCALES = [0.25, 0.5, 1, 2, 3, 5, 8, 12, 20, 30, 45];
  const FIRING_COLOR = "#ffd25a", MOVEMENT_COLOR = "#5ce1e6";
  // Layout in CSS pixels: title row, then the plot with its scale on the left and
  // the last shot's numbers on the right.
  const AXIS_WIDTH = 30, BAR_WIDTH = 2, BAR_GAP = 1, PLOT_WIDTH = MAX_SHOTS * (BAR_WIDTH + BAR_GAP) + 1, PLOT_HEIGHT = 34;
  const TITLE_HEIGHT = 15, NUMBERS_WIDTH = 40, CANVAS_HEIGHT = TITLE_HEIGHT + PLOT_HEIGHT + 1;
  const mode = () => { try { return localStorage.getItem(MODE_STORAGE_KEY) || "off"; } catch { return "off"; } };
  const setMode = (newMode) => { try { localStorage.setItem(MODE_STORAGE_KEY, newMode); } catch {} sync(); };

  const firingErrors = new Float32Array(MAX_SHOTS), movementErrors = new Float32Array(MAX_SHOTS);
  let shotCount = 0, nextSlot = 0; // ring buffer: nextSlot is the next slot to write
  let canvas = null, context = null, repaintQueued = false, shownMode = "";

  window.__aimShot = (shot) => {
    if (!shot || typeof shot.spreadDeg !== "number") return;
    const totalError = Math.max(0, shot.spreadDeg);
    const firingError = Math.min(totalError, typeof shot.firingDeg === "number" ? Math.max(0, shot.firingDeg) : totalError);
    firingErrors[nextSlot] = firingError;
    movementErrors[nextSlot] = totalError - firingError;
    nextSlot = (nextSlot + 1) % MAX_SHOTS;
    if (shotCount < MAX_SHOTS) shotCount++;
    queueRepaint();
  };

  function queueRepaint() {
    if (repaintQueued || !canvas || canvas.style.display) return;
    repaintQueued = true;
    // A timer, not an animation frame: animation frames add about 8 ms of screen delay in a round.
    setTimeout(() => { repaintQueued = false; paint(); }, 16);
  }

  function createCanvas() {
    canvas = document.createElement("canvas");
    canvas.className = "es-shotgraph";
    document.body.appendChild(canvas);
    context = canvas.getContext("2d");
  }

  function drawLabel(text, x, y, color, align) {
    context.textAlign = align;
    context.fillStyle = "rgba(0,0,0,.8)";
    context.fillText(text, x + 1, y + 1);
    context.fillStyle = color;
    context.fillText(text, x, y);
  }

  function paint() {
    if (!canvas) return;
    const showNumbers = mode() === "numbers";
    const canvasWidth = AXIS_WIDTH + PLOT_WIDTH + (showNumbers ? NUMBERS_WIDTH : 2);
    const pixelRatio = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(canvasWidth * pixelRatio) || canvas.height !== Math.round(CANVAS_HEIGHT * pixelRatio)) {
      canvas.width = Math.round(canvasWidth * pixelRatio);
      canvas.height = Math.round(CANVAS_HEIGHT * pixelRatio);
      canvas.style.width = canvasWidth + "px";
      canvas.style.height = CANVAS_HEIGHT + "px";
    }
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, canvasWidth, CANVAS_HEIGHT);

    let largestError = 0;
    for (let i = 0; i < shotCount; i++) largestError = Math.max(largestError, firingErrors[i] + movementErrors[i]);
    const scaleTop = SCALES.find((step) => step >= largestError) ?? Math.ceil(largestError / 15) * 15;

    context.font = "700 11px Bahnschrift, Segoe UI, sans-serif";
    drawLabel("Shooting Error", 0, 10, "#fff", "left");

    // plot frame and half line
    const plotLeft = AXIS_WIDTH, plotTop = TITLE_HEIGHT, plotBottom = plotTop + PLOT_HEIGHT;
    context.fillStyle = "rgba(0,0,0,.35)";
    context.fillRect(plotLeft, plotTop, PLOT_WIDTH, PLOT_HEIGHT);
    context.strokeStyle = "rgba(255,210,90,.75)";
    context.lineWidth = 1;
    context.strokeRect(plotLeft + 0.5, plotTop + 0.5, PLOT_WIDTH - 1, PLOT_HEIGHT - 1);
    context.fillStyle = "rgba(255,255,255,.12)";
    context.fillRect(plotLeft + 1, Math.round(plotTop + PLOT_HEIGHT / 2), PLOT_WIDTH - 2, 1);

    context.font = "9px Bahnschrift, Segoe UI, sans-serif";
    const digits = scaleTop < 1 ? 2 : 1;
    drawLabel(`${scaleTop.toFixed(digits)}°`, plotLeft - 3, plotTop + 8, "#c9ced6", "right");
    drawLabel(`${(scaleTop / 2).toFixed(digits)}°`, plotLeft - 3, plotTop + PLOT_HEIGHT / 2 + 3, "#c9ced6", "right");

    // bars, newest on the right; heights in device pixels so small errors still show
    const barAreaHeight = PLOT_HEIGHT - 2, barBottom = plotBottom - 1;
    const barHeight = (deg) => (deg <= 0 ? 0 : Math.max(1 / pixelRatio, Math.round((deg / scaleTop) * barAreaHeight * pixelRatio) / pixelRatio));
    for (let barNumber = 0; barNumber < shotCount; barNumber++) {
      const slot = (nextSlot - shotCount + barNumber + MAX_SHOTS) % MAX_SHOTS;
      const barX = plotLeft + 1 + (MAX_SHOTS - shotCount + barNumber) * (BAR_WIDTH + BAR_GAP);
      const firingHeight = barHeight(firingErrors[slot]);
      const movementHeight = movementErrors[slot] > STILL_ERROR_DEG ? Math.min(barAreaHeight - firingHeight, barHeight(movementErrors[slot])) : 0;
      context.fillStyle = FIRING_COLOR;
      context.fillRect(barX, barBottom - firingHeight, BAR_WIDTH, firingHeight);
      if (movementHeight > 0) {
        context.fillStyle = MOVEMENT_COLOR;
        context.fillRect(barX, barBottom - firingHeight - movementHeight, BAR_WIDTH, movementHeight);
      }
    }

    if (showNumbers) {
      const lastSlot = shotCount ? (nextSlot - 1 + MAX_SHOTS) % MAX_SHOTS : -1;
      context.font = "700 10px Bahnschrift, Segoe UI, sans-serif";
      const numbersX = plotLeft + PLOT_WIDTH + 4;
      drawLabel(lastSlot < 0 ? "-" : `${movementErrors[lastSlot].toFixed(2)}°`, numbersX, plotTop + 12, MOVEMENT_COLOR, "left");
      drawLabel(lastSlot < 0 ? "-" : `${firingErrors[lastSlot].toFixed(2)}°`, numbersX, plotTop + 27, FIRING_COLOR, "left");
    }
  }

  // Shown during rounds only (the round view is .al-aimlab-root), and reset for each round.
  let inRound = false;
  function sync() {
    const round = !!document.querySelector(".al-aimlab-root");
    if (round !== inRound) { inRound = round; shotCount = 0; nextSlot = 0; shownMode = ""; }
    const currentMode = round ? mode() : "off";
    if (currentMode !== "off" && !canvas) createCanvas();
    if (canvas) canvas.style.display = currentMode !== "off" ? "" : "none";
    if (currentMode !== shownMode) { shownMode = currentMode; if (currentMode !== "off") paint(); }
    addSetting();
  }

  // Settings > Video > Stats: a row like the game's "Performance overlay" switch.
  function addSetting() {
    const anchor = document.querySelector('[data-setting="showPerformance"]');
    if (!anchor || anchor.parentElement.querySelector(".es-shotgraph-setting")) return;
    const row = document.createElement("div");
    row.className = "hall-field es-shotgraph-setting";
    row.innerHTML = '<span class="hall-field-text"><b>Shooting error graph</b><small>One bar per shot. Yellow: spray. Blue: moving. Aim for no blue.</small></span><div class="es-shotgraph-seg" role="radiogroup"></div>';
    const buttonGroup = row.querySelector(".es-shotgraph-seg");
    for (const [value, buttonText] of [["off", "Off"], ["graph", "Graph"], ["numbers", "Graph + numbers"]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = buttonText;
      button.setAttribute("role", "radio");
      button.addEventListener("click", () => { setMode(value); markSelectedButton(); });
      button.dataset.value = value;
      buttonGroup.appendChild(button);
    }
    const markSelectedButton = () => { for (const button of buttonGroup.children) { const isSelected = button.dataset.value === mode(); button.classList.toggle("is-on", isSelected); button.setAttribute("aria-checked", String(isSelected)); } };
    markSelectedButton();
    anchor.after(row);
  }

  setInterval(sync, 500);
  sync();
})();
