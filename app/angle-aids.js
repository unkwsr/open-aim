// Pre-aim aids, our own HUD parts (2026-11-11, third version):
//   Kill order  (key killOrder): no numbers on bots; dots under the crosshair show how many are left.
//               The minimap keeps its numbers.
//   Height tick (key aimLine): a tiny tick beside the crosshair slides with your height error versus the
//               next bot's head, green when level. No text.
// The head-height wall lines (key headLines) are drawn by the game itself (OkAdunfX.js ah(), split into
// 32 m pieces, marker aim-wall-lines-chunks).
// Data: botOrder (total, left, numbersOn, aim.deltaM/distH) from OkAdunfX.js. The order overlay
// (Hwnlm6zD.js BotOrderOverlay) calls window.__aimAngleAids on its HUD frame, so there is no loop of
// its own; the page is only written when a value changes.
(() => {
  if (window.__aimAngleAids) return;
  const LEVEL_DEG = 0.6, RANGE_DEG = 6, TICK_HALF = 14, MAX_PIPS = 12;
  const css = document.createElement("style");
  css.textContent = `
.al-bot-order-aim,.al-bot-order-badge{display:none!important}
.aim-pa{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2}
.aim-pips{position:absolute;left:50%;top:calc(50% + 26px);transform:translateX(-50%);display:none;gap:5px}
.aim-pips.is-on{display:flex}
.aim-pips b{width:6px;height:6px;border-radius:50%;border:1px solid rgba(255,255,255,.7);background:rgba(0,0,0,.25)}
.aim-pips b.is-done{background:rgba(255,255,255,.85);border-color:transparent}
.aim-tick{position:absolute;left:calc(50% + 16px);top:50%;width:0;height:0;display:none}
.aim-tick.is-on{display:block}
.aim-tick::before{content:"";position:absolute;left:0;top:-1px;width:3px;height:2px;background:rgba(255,255,255,.45)}
.aim-tick u{position:absolute;left:4px;top:-1px;width:8px;height:2px;background:#fbbf24;box-shadow:0 0 0 1px rgba(0,0,0,.6);will-change:transform}
.aim-tick.is-level u{background:#4ade80}`;
  document.head.append(css);

  let layer = null, owner = null, pips, tick, tickBar, pipsKey = "", tickKey = "";
  function build(root) {
    layer?.remove();
    layer = document.createElement("div");
    layer.className = "aim-pa";
    layer.innerHTML = `<div class="aim-pips"></div><div class="aim-tick"><u></u></div>`;
    [pips, tick] = layer.children;
    tickBar = tick.firstChild;
    pipsKey = tickKey = "";
    root.append(layer);
    owner = root;
  }
  function drawPips(order) {
    const total = order?.numbersOn ? order.total | 0 : 0;
    if (!order?.ready || total < 2 || total > MAX_PIPS) { if (pipsKey) { pips.className = "aim-pips"; pipsKey = ""; } return; }
    const done = Math.max(0, Math.min(total, total - (order.left | 0)));
    const key = total + "/" + done;
    if (key === pipsKey) return;
    pipsKey = key;
    pips.className = "aim-pips is-on";
    let html = "";
    for (let i = 0; i < total; i++) html += i < done ? '<b class="is-done"></b>' : "<b></b>";
    pips.innerHTML = html;
  }
  // + = crosshair above head height, tick moves up
  function drawTick(order) {
    const aim = order?.aim;
    if (!order?.ready || !aim?.shown || !(aim.distH > 0.5) || !Number.isFinite(aim.deltaM)) {
      if (tickKey) { tick.className = "aim-tick"; tickKey = ""; }
      return;
    }
    const deg = Math.atan2(aim.deltaM, aim.distH) * 180 / Math.PI;
    const level = Math.abs(deg) < LEVEL_DEG;
    const offset = -Math.max(-1, Math.min(1, deg / RANGE_DEG)) * TICK_HALF;
    const key = (level ? "L" : "") + offset.toFixed(0);
    if (key === tickKey) return;
    tickKey = key;
    tick.className = "aim-tick is-on" + (level ? " is-level" : "");
    tickBar.style.transform = `translate3d(0,${offset.toFixed(1)}px,0)`;
  }
  window.__aimAngleAids = (order, _hud, root) => {
    if (!root) return;
    if (owner !== root || !layer?.isConnected) build(root);
    drawPips(order);
    drawTick(order);
  };
})();
