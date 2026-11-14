// Target Workshop (lobby tab), rebuilt: design B "Gallery" (2-column cards) + full-page Tune screen.
// The lobby (ChJ6FlD4.js HallView, marker aim-target-workshop-rebuild) renders an empty
// <div class="tw-root"> and hands this file an API: state(), play, favorite, tunables, and the
// game's own 103-degree projection (project/draw). Every preview here is that projection, so a
// target drawn here has the same size and spacing, relative to the screen, as in a run.
(() => {
  if (window.__aimTargetWorkshop) return;

  const STYLE = `
.tw-root{position:relative;grid-column:1/-1;min-height:calc(100vh - 140px);width:100%;color:#f4f5f7;font:14px "Segoe UI",sans-serif}
.tw-root *{box-sizing:border-box}
.tw-page{padding:26px 32px 30px;display:flex;flex-direction:column;gap:18px;min-height:inherit}
.tw-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap}
.tw-kicker{font:700 11px var(--es-head,"Bahnschrift");letter-spacing:.14em;text-transform:uppercase;color:#9aa1ae}
.tw-title{margin:4px 0 0;font:900 38px/1 var(--es-head,"Bahnschrift");letter-spacing:.02em;text-transform:uppercase;color:#fff}
.tw-chips{display:inline-flex;border:1px solid #343b4a}
.tw-chips button{all:unset;cursor:pointer;padding:8px 16px;font:700 12px var(--es-head,"Bahnschrift");letter-spacing:.1em;text-transform:uppercase;color:#9aa1ae}
.tw-chips button:hover{color:#fff}.tw-chips button[aria-pressed="true"]{background:#ff4655;color:#fff}
.tw-chips button i{font-style:normal;opacity:.6;margin-left:5px}
.tw-note{display:flex;gap:14px;align-items:center;color:#d6d9df;margin:0}
.tw-note button,.tw-link{all:unset;cursor:pointer;color:#ff6b77;font-weight:600}
.tw-grid{flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(620px,1fr));grid-auto-rows:minmax(330px,1fr);gap:18px}
.tw-card{position:relative;display:grid;grid-template-columns:minmax(0,46%) 1fr;background:#10131a;border:1px solid #272d39;cursor:pointer;overflow:hidden;transition:border-color .15s,transform .15s}
.tw-card:hover{border-color:#4a5263}.tw-card.is-on{border-color:#ff4655;box-shadow:0 0 0 1px #ff4655 inset}
.tw-pv{position:relative;min-height:220px;background:#0c0f14;overflow:hidden}
.tw-pv canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.tw-pv .tw-tag{position:absolute;left:12px;top:12px}
.tw-pv .tw-len{position:absolute;right:12px;bottom:12px;font:800 12px var(--es-head,"Bahnschrift");letter-spacing:.06em;background:#000a;color:#fff;padding:3px 8px}
.tw-pv .tw-custom{position:absolute;left:12px;bottom:12px;font:800 11px var(--es-head,"Bahnschrift");letter-spacing:.1em;text-transform:uppercase;background:#ffd23d;color:#111;padding:3px 8px}
.tw-tag{display:inline-block;font:700 11px var(--es-head,"Bahnschrift");letter-spacing:.08em;text-transform:uppercase;color:#ff6b77;background:#140a0ccc;border:1px solid #ff465544;padding:3px 8px}
.tw-body{padding:20px 22px 18px;display:flex;flex-direction:column;min-width:0}
.tw-name{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.tw-name h2{margin:0;font:900 26px/1.05 var(--es-head,"Bahnschrift");letter-spacing:.02em;text-transform:uppercase;color:#fff}
.tw-fav{all:unset;cursor:pointer;color:#6b7280;padding:2px}.tw-fav:hover{color:#fff}.tw-fav.is-on{color:#ff4655}
.tw-fav svg{width:20px;height:20px;display:block}
.tw-desc{color:#9aa1ae;line-height:1.5;margin:8px 0 12px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.tw-stats{display:flex;gap:26px;margin-bottom:6px}
.tw-stats div{display:flex;flex-direction:column;gap:2px}
.tw-stats span{font:700 10px var(--es-head,"Bahnschrift");letter-spacing:.14em;text-transform:uppercase;color:#9aa1ae}
.tw-stats b{font:800 26px/1 var(--es-head,"Bahnschrift");font-variant-numeric:tabular-nums;color:#fff}.tw-stats b.is-none{color:#4b5160}
.tw-trend{flex:1;min-height:56px;display:flex;align-items:center}
.tw-trend svg{width:100%;height:64px;overflow:visible}
.tw-trend p{margin:0;width:100%;text-align:center;color:#6b7280;font-size:12px}
.tw-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:10px}
.tw-root .tw-btn{text-transform:uppercase!important}
.tw-btn{all:unset;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:8px;font:800 14px var(--es-head,"Bahnschrift");letter-spacing:.08em;text-transform:uppercase;color:#fff;background:#ff4655;padding:11px 30px;clip-path:polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%);transition:filter .15s}
.tw-btn:hover{filter:brightness(1.12)}.tw-btn.is-ghost{background:#1e232d;color:#d6d9df;padding:11px 18px}.tw-btn.is-ghost:hover{background:#2a303c;color:#fff}
.tw-btn:disabled,.tw-btn[aria-disabled="true"]{opacity:.45;cursor:default}
.tw-btn svg{width:13px;height:13px}
.tw-empty{grid-column:1/-1;display:grid;place-items:center;color:#9aa1ae;min-height:240px}
/* Tune screen */
.tw-tune{position:fixed;left:0;right:0;top:var(--tw-top,64px);bottom:var(--tw-bottom,50px);z-index:900;display:grid;grid-template-columns:minmax(0,1fr) 520px;background:#090b0f}
.tw-stage{position:relative;display:flex;flex-direction:column;padding:24px 30px 20px;min-width:0;min-height:0;overflow:hidden}
.tw-back{all:unset;cursor:pointer;font:700 11px var(--es-head,"Bahnschrift");letter-spacing:.14em;text-transform:uppercase;color:#9aa1ae}.tw-back:hover{color:#fff}
.tw-stage>.tw-tag{align-self:flex-start}
.tw-stage h1{margin:8px 0 6px;font:900 38px/1 var(--es-head,"Bahnschrift");letter-spacing:.02em;text-transform:uppercase}
.tw-screen-wrap{flex:1 1 0;position:relative;display:grid;place-items:center;min-height:0;overflow:hidden;margin-top:14px}
.tw-screen{position:relative;box-shadow:0 0 0 1px #343b4a,0 20px 60px #0008}
.tw-screen canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.tw-screen svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.tw-screen-label{position:absolute;left:10px;top:8px;font:700 10px var(--es-head,"Bahnschrift");letter-spacing:.14em;text-transform:uppercase;color:#fff;background:#000a;padding:3px 7px}
.tw-readout{display:flex;gap:30px;margin-top:16px}
.tw-readout div{display:flex;flex-direction:column;gap:2px}
.tw-readout span{font:700 10px var(--es-head,"Bahnschrift");letter-spacing:.14em;text-transform:uppercase;color:#9aa1ae}
.tw-readout b{font:800 26px/1 var(--es-head,"Bahnschrift");font-variant-numeric:tabular-nums}
.tw-readout b small{font-size:13px;color:#9aa1ae;margin-left:3px}
.tw-side{background:#10131a;border-left:3px solid #ff4655;display:flex;flex-direction:column;min-height:0}
.tw-tabs{display:flex;border-bottom:1px solid #272d39;padding:18px 26px 0}
.tw-tabs button{all:unset;cursor:pointer;padding:10px 18px;font:800 14px var(--es-head,"Bahnschrift");letter-spacing:.08em;text-transform:uppercase;color:#9aa1ae}
.tw-tabs button[aria-selected="true"]{color:#fff;box-shadow:inset 0 -3px 0 #ff4655}
.tw-panel{flex:1;overflow:auto;padding:18px 26px}
.tw-rows{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.tw-row{background:#171b23;border-left:2px solid #343b4a;padding:14px 16px 12px;transition:border-color .15s,background .15s}
.tw-row:hover,.tw-row.is-active{background:#1b2029;border-left-color:#ff4655}
.tw-row.is-changed{border-left-color:#ffd23d}
.tw-row-top{display:flex;justify-content:space-between;align-items:center;gap:8px}
.tw-row-top span{color:#d6d9df;font-weight:600;font-size:13px}
.tw-val{display:flex;align-items:baseline;gap:3px}
.tw-val input{all:unset;width:58px;text-align:right;font:800 20px var(--es-head,"Bahnschrift");font-variant-numeric:tabular-nums;color:#fff;border-bottom:1px dashed transparent}
.tw-val input:hover,.tw-val input:focus{border-bottom-color:#6b7280}
.tw-val small{color:#9aa1ae;font-size:12px;min-width:8px}
.tw-row input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:18px;margin:8px 0 2px;background:transparent;cursor:pointer}
.tw-row input[type=range]::-webkit-slider-runnable-track{height:4px;background:linear-gradient(90deg,#ff4655 var(--p,0%),#343b4a var(--p,0%))}
.tw-row input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;margin-top:-6px;border-radius:50%;background:#fff;border:3px solid #ff4655}
.tw-row-foot{display:flex;justify-content:space-between;font-size:11px;color:#6b7280}
.tw-row-foot button{all:unset;cursor:pointer;color:#ffd23d}
.tw-sec{font:700 11px var(--es-head,"Bahnschrift");letter-spacing:.14em;text-transform:uppercase;color:#9aa1ae;margin:22px 0 10px}
.tw-sec:first-child{margin-top:4px}
.tw-seg{display:inline-flex;border:1px solid #343b4a}
.tw-seg button{all:unset;cursor:pointer;padding:9px 20px;font:700 12px var(--es-head,"Bahnschrift");letter-spacing:.1em;text-transform:uppercase;color:#9aa1ae}
.tw-seg button[aria-pressed="true"]{background:#ff4655;color:#fff}
.tw-swatches{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.tw-sw{all:unset;cursor:pointer;width:30px;height:30px;border:2px solid transparent;box-shadow:inset 0 0 0 1px #0004}
.tw-sw[aria-pressed="true"]{border-color:#fff;outline:2px solid #ff4655}
.tw-sw-auto{all:unset;cursor:pointer;height:30px;padding:0 12px;display:inline-flex;align-items:center;font:700 12px var(--es-head,"Bahnschrift");letter-spacing:.06em;text-transform:uppercase;color:#d6d9df;border:1px solid #343b4a}
.tw-sw-auto[aria-pressed="true"]{border-color:#ff4655;color:#fff;background:#ff465524}
.tw-hex{display:flex;align-items:center;gap:8px;margin-top:12px;color:#9aa1ae;font-size:12px}
.tw-hex input[type=color]{all:unset;width:30px;height:30px;cursor:pointer}
.tw-hex input[type=text]{all:unset;width:80px;padding:6px 8px;border:1px solid #343b4a;color:#fff;font:600 13px Consolas,monospace;text-transform:uppercase}
.tw-help{color:#6b7280;font-size:12px;line-height:1.5;margin:14px 0 0}
.tw-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:16px 26px;border-top:1px solid #272d39}
.tw-foot span{color:#9aa1ae;font-size:13px}.tw-foot div{display:flex;gap:10px}
@media (max-width:1300px){.tw-grid{grid-template-columns:1fr}.tw-tune{grid-template-columns:1fr 440px}.tw-rows{grid-template-columns:1fr}}
`;

  const ICON = {
    play: '<svg viewBox="0 0 12 12"><path d="M2 1l9 5-9 5z" fill="currentColor"/></svg>',
    tune: '<svg viewBox="0 0 16 16"><path d="M2 4h7M13 4h1M2 12h1M7 12h7M11 2v4M5 10v4" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
    mark: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4.5L6 21z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    markOn: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4.5L6 21z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n) => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));
  const FAV = "__fav";

  // In-round Parameters window: same Tune layout, as a centred box over the round.
  const MODAL_STYLE = `
.tw-modal{position:fixed;inset:0;z-index:2147482000;display:grid;place-items:center;background:#000b;color:#f4f5f7;font:14px "Segoe UI",sans-serif}
.tw-modal *{box-sizing:border-box}
.tw-modal .tw-tune{position:relative;inset:auto;width:min(1560px,96vw);height:min(900px,94vh);box-shadow:0 30px 90px #000c;border-top:3px solid #ff4655}
.tw-x{all:unset;cursor:pointer;position:absolute;right:14px;top:12px;width:32px;height:32px;display:grid;place-items:center;font-size:22px;color:#9aa1ae;z-index:2}.tw-x:hover{color:#fff}
.tw-warn{color:#ffd23d!important}
`;
  let api = null, root = null, state = null;
  let filter = "all";
  let tune = null; // lobby Tune controller
  const requested = new Set();
  let resizeObs = null, drawQueued = 0;

  function injectCss() {
    if (document.getElementById("tw-style")) return;
    const st = document.createElement("style");
    st.id = "tw-style";
    st.textContent = STYLE + MODAL_STYLE;
    document.head.appendChild(st);
  }

  // ---- drawing (the game's own projection) -------------------------------------------------
  // project(values, w, h) gives the drill exactly as the game's 103-degree camera sees it on a
  // w x h screen. A canvas that is not 16:9 shows the middle of a 16:9 screen at true scale.
  function paint(canvas, project, draw, values, ballColor, backdrop) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
    if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    const sh = Math.max(h, w * 9 / 16), sw = sh * 16 / 9;
    const layout = project(values, sw, sh);
    if (!layout) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(-(sw - w) / 2, -(sh - h) / 2);
    draw(ctx, layout, ballColor);
    ctx.restore();
    crosshair(ctx, w / 2, h / 2, backdrop === "white" ? "#111" : "#fff");
    // marks() works in canvas coordinates
    return { ...layout, ox: -(sw - w) / 2, oy: -(sh - h) / 2 };
  }
  function crosshair(ctx, x, y, color) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.globalAlpha = .85;
    ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x - 2, y); ctx.moveTo(x + 2, y); ctx.lineTo(x + 7, y);
    ctx.moveTo(x, y - 7); ctx.lineTo(x, y - 2); ctx.moveTo(x, y + 2); ctx.lineTo(x, y + 7); ctx.stroke(); ctx.restore();
  }

  // ---- Tune screen (shared by the lobby and the in-round Parameters window) -----------------
  // o = { title, tag, rows, values, h (helpers: project, draw, clamp, format, label, colors,
  //       getBackdrop, setBackdrop), ballColor(), setBallColor(c), live(values|null) (save as you
  //       drag, or null), primary: {label, run(values), ready(values)}, note(values),
  //       back: {label, run} | null, close() | null }
  function createTune(host, o) {
    const t = { values: { ...o.values }, tab: "drill", active: null, timer: 0, raf: 0, ro: null };
    const H = o.h;
    const valueOf = (r) => t.values[r.key] ?? r.def;
    const isChanged = (r) => Math.abs(valueOf(r) - r.def) > 1e-9;
    const pct = (r, v) => { const span = r.tunable.max - r.tunable.min; return span > 0 ? Math.min(100, Math.max(0, (v - r.tunable.min) / span * 100)) : 0; };
    const out = () => { const v = {}; for (const r of o.rows) if (isChanged(r)) v[r.key] = valueOf(r); return v; };

    function flush() {
      clearTimeout(t.timer); t.timer = 0;
      o.live?.(out());
    }
    function setValue(r, v, now) {
      if (!Number.isFinite(v)) return;
      const c = H.clamp(r, v);
      if (Math.abs(c - r.def) > 1e-9) t.values[r.key] = c; else delete t.values[r.key];
      syncRow(r); syncFoot(); queue();
      if (o.live) { clearTimeout(t.timer); t.timer = setTimeout(flush, now ? 0 : 150); }
    }

    function rowHtml(r) {
      const v = valueOf(r), changed = isChanged(r), lab = H.label(r), u = r.unit || "";
      return `<div class="tw-row${changed ? " is-changed" : ""}" data-row="${esc(r.key)}" data-field="${esc(r.tunable.field)}">
        <div class="tw-row-top"><span>${esc(lab)}</span><label class="tw-val"><input type="text" inputmode="decimal" value="${esc(H.format(r, v))}" aria-label="${esc(lab)}"><small>${esc(u)}</small></label></div>
        <input type="range" min="${r.tunable.min}" max="${r.tunable.max}" step="${r.tunable.step}" value="${v}" style="--p:${pct(r, v)}%" aria-label="${esc(lab)} slider">
        <div class="tw-row-foot"><span>${esc(H.format(r, r.tunable.min))}${esc(u)}</span>${changed ? `<button type="button" data-act="reset-row">Reset to ${esc(H.format(r, r.def))}</button>` : ""}<span>${esc(H.format(r, r.tunable.max))}${esc(u)}</span></div></div>`;
    }
    function syncRow(r) {
      const el = host.querySelector(`.tw-row[data-row="${CSS.escape(r.key)}"]`);
      if (!el) return;
      const v = valueOf(r), changed = isChanged(r);
      el.classList.toggle("is-changed", changed);
      const text = el.querySelector('input[type="text"]');
      if (document.activeElement !== text) text.value = H.format(r, v);
      const range = el.querySelector('input[type="range"]');
      range.value = v; range.style.setProperty("--p", pct(r, v) + "%");
      const foot = el.querySelector(".tw-row-foot"), btn = foot.querySelector("button");
      if (changed && !btn) foot.children[0].insertAdjacentHTML("afterend", `<button type="button" data-act="reset-row">Reset to ${esc(H.format(r, r.def))}</button>`);
      if (!changed && btn) btn.remove();
    }
    function syncFoot() {
      const n = o.rows.filter(isChanged).length, el = host.querySelector(".tw-foot span");
      if (el) { const note = o.note?.(out(), n); el.textContent = note?.text ?? (n ? `${n} changed from default` : "All at default"); el.classList.toggle("tw-warn", !!note?.warn); }
      host.querySelector('[data-act="reset-all"]')?.setAttribute("aria-disabled", String(!n));
      const p = host.querySelector('[data-act="primary"]');
      if (p) p.setAttribute("aria-disabled", String(!(o.primary.ready?.(out()) ?? true)));
    }
    function lookHtml() {
      const bc = o.ballColor(), presets = H.colors || [], bd = H.getBackdrop();
      return `<div class="tw-sec">Background</div>
        <div class="tw-seg" role="group">${[["white", "White room"], ["black", "Dark room"]].map(([k, l]) => `<button type="button" data-bg="${k}" aria-pressed="${bd === k}">${l}</button>`).join("")}</div>
        <p class="tw-help">The room around the targets, in every Target Workshop drill.</p>
        <div class="tw-sec">Target colour</div>
        <div class="tw-swatches"><button type="button" class="tw-sw-auto" data-color="" aria-pressed="${bc == null}">Drill's own</button>
          ${presets.map((p) => `<button type="button" class="tw-sw" data-color="${esc(p.value)}" title="${esc(p.label)}" aria-pressed="${bc === p.value}" style="background:${esc(p.value)}"></button>`).join("")}</div>
        <div class="tw-hex">Custom <input type="color" value="${esc(bc || "#ff4655")}" aria-label="Pick a custom colour"><input type="text" value="${esc((bc || "").toUpperCase())}" placeholder="#FF4655" maxlength="7" aria-label="Colour code"></div>
        <p class="tw-help">Used for the targets in every Target Workshop drill.</p>`;
    }
    function render() {
      const drill = o.rows.length
        ? `<div class="tw-sec">${esc(o.title || "Drill")} · the preview follows every change</div><div class="tw-rows">${o.rows.map(rowHtml).join("")}</div>
           <p class="tw-help">Hover a setting to see what it changes on the screen.${o.help ? " " + esc(o.help) : ""}</p>`
        : `<p class="tw-help">This drill has no adjustable settings. The Look tab still applies.</p>`;
      host.innerHTML = `<div class="tw-tune">${o.close ? `<button type="button" class="tw-x" data-act="close" aria-label="Close">×</button>` : ""}
        <section class="tw-stage">${o.back ? `<button type="button" class="tw-back" data-act="back">← ${esc(o.back.label)}</button>` : `<span class="tw-back" style="cursor:default">Parameters</span>`}
          <h1>${esc(o.title || "")}</h1>${o.tag ? `<span class="tw-tag">${esc(o.tag)}</span>` : ""}
          <div class="tw-screen-wrap"><div class="tw-screen"><canvas></canvas><svg></svg><span class="tw-screen-label">Your screen · 103° FOV · true scale</span></div></div>
          <div class="tw-readout"></div></section>
        <aside class="tw-side"><div class="tw-tabs" role="tablist">${[["drill", "Drill"], ["look", "Look"]].map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${t.tab === k}">${l}</button>`).join("")}</div>
          <div class="tw-panel">${t.tab === "drill" ? drill : lookHtml()}</div>
          <div class="tw-foot"><span></span><div><button type="button" class="tw-btn is-ghost" data-act="reset-all">Reset</button><button type="button" class="tw-btn" data-act="primary">${ICON.play} ${esc(o.primary.label)}</button></div></div></aside></div>`;
      syncFoot(); fit(); queue();
    }
    function fit() {
      o.fitBars?.(host);
      const wrap = host.querySelector(".tw-screen-wrap"), scr = host.querySelector(".tw-screen");
      if (!wrap || !scr) return;
      const W = wrap.clientWidth, Hh = wrap.clientHeight;
      let w = W, h = W * 9 / 16;
      if (h > Hh) { h = Hh; w = Hh * 16 / 9; }
      scr.style.width = Math.floor(w) + "px"; scr.style.height = Math.floor(h) + "px";
    }
    function queue() { if (!t.raf) t.raf = requestAnimationFrame(() => { t.raf = 0; draw(); }); }
    function draw() {
      const scr = host.querySelector(".tw-screen");
      if (!scr) return;
      const cv = scr.querySelector("canvas"), svg = scr.querySelector("svg");
      const L = paint(cv, (v, w, h) => H.project(v, w, h), H.draw, t.values, o.ballColor(), H.getBackdrop());
      svg.setAttribute("viewBox", `0 0 ${cv.clientWidth} ${cv.clientHeight}`);
      svg.innerHTML = L ? `<g transform="translate(${L.ox} ${L.oy})">${marks(L)}</g>` : "";
      const f = L?.facts || {}, deg = (v) => (v == null ? null : v.toFixed(1) + "<small>°</small>");
      const dist = o.rows.find((r) => r.tunable.field === "distance");
      const items = [["Target size", deg(f.ballDeg)], ["Gap side to side", deg(f.stepDegX)], ["Gap up and down", deg(f.stepDegY)],
        ["Distance", f.distance == null ? null : (dist ? H.format(dist, f.distance) : f.distance.toFixed(1)) + "<small>m</small>"]].filter(([, v]) => v);
      const ro = host.querySelector(".tw-readout");
      if (ro) ro.innerHTML = items.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join("");
    }
    // Highlights for the setting under the mouse.
    function marks(L) {
      const field = t.active, s = [];
      if (!field || !L.focus) return "";
      const mine = L.targets.filter((x) => x.owner.kind === L.focus.kind && x.owner.id === L.focus.id), lit = mine.filter((x) => x.lit);
      const line = (x1, y1, x2, y2, dash) => s.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ffd23d" stroke-width="2" ${dash ? 'stroke-dasharray="6 5"' : ""}/>`);
      const ring = (x) => s.push(`<circle cx="${x.center.x}" cy="${x.center.y}" r="${x.radius + 6}" fill="none" stroke="#ffd23d" stroke-width="2"/>`);
      const tag = (x, y, text) => s.push(`<g><rect x="${x - text.length * 3.6 - 8}" y="${y - 11}" width="${text.length * 7.2 + 16}" height="22" fill="#000c"/><text x="${x}" y="${y + 4}" fill="#ffd23d" font-size="12" font-weight="700" text-anchor="middle" font-family="Bahnschrift,Segoe UI">${esc(text)}</text></g>`);
      const row = o.rows.find((r) => r.tunable.field === field);
      const label = row ? `${H.format(row, valueOf(row))} ${row.unit || ""}`.trim() : "";
      const cell = (c, r) => mine.find((x) => x.cell?.col === c && x.cell?.row === r);
      const lastRow = Math.max(0, ...mine.map((x) => x.cell?.row ?? 0));
      if (field === "spacingX" || field === "spacing") {
        const a = cell(0, lastRow), b = cell(1, lastRow);
        if (a && b) { const y = Math.min(a.center.y, b.center.y) - a.radius - 18; line(a.center.x, y, b.center.x, y); line(a.center.x, y - 5, a.center.x, y + 5); line(b.center.x, y - 5, b.center.x, y + 5); tag((a.center.x + b.center.x) / 2, y - 16, `${label}  ${L.facts.stepDegX?.toFixed(1) ?? "—"}°`); }
      }
      if (field === "spacingY" || field === "spacing") {
        const a = cell(0, 0), b = cell(0, 1);
        if (a && b) { const x = a.center.x - a.radius - 20; line(x, a.center.y, x, b.center.y); line(x - 5, a.center.y, x + 5, a.center.y); line(x - 5, b.center.y, x + 5, b.center.y); tag(x - 62, (a.center.y + b.center.y) / 2, `${label}  ${L.facts.stepDegY?.toFixed(1) ?? "—"}°`); }
      } else if (field === "radius") {
        const sp = lit.filter((x) => x.shape === "sphere");
        sp.forEach(ring);
        const x = sp.sort((p, q) => q.center.x - p.center.x)[0];
        if (x) tag(x.center.x + x.radius + 70, x.center.y, `${label}${L.facts.ballDeg != null ? "  " + L.facts.ballDeg.toFixed(1) + "°" : ""}`);
      } else if (field === "distance") {
        const y = Math.max(...mine.map((x) => x.center.y + (x.shape === "sphere" ? x.radius : x.height * .38)));
        if (Number.isFinite(y)) { line(L.width / 2, L.height - 10, L.width / 2, y + 8, true); tag(L.width / 2, (L.height + y) / 2, label); }
      } else if (field === "width" || field === "height") {
        const r = L.regions?.[0];
        if (r) s.push(`<polygon points="${r.map((p) => `${p.x},${p.y}`).join(" ")}" fill="#ffd23d14" stroke="#ffd23d" stroke-width="2" stroke-dasharray="6 5"/>`);
      } else if (field !== "duration" && field !== "spacing") lit.forEach(ring);
      return s.join("");
    }
    function setColor(c) {
      o.setBallColor(c);
      if (t.tab === "look") { const p = host.querySelector(".tw-panel"); if (p) p.innerHTML = lookHtml(); }
      queue();
    }

    function onClick(e) {
      const b = e.target.closest("button");
      if (!b || !host.contains(b)) return;
      const act = b.dataset.act;
      if (b.dataset.tab) { t.tab = b.dataset.tab; render(); return; }
      if (b.dataset.bg) { H.setBackdrop(b.dataset.bg); host.querySelectorAll("[data-bg]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.bg === H.getBackdrop()))); queue(); return; }
      if (b.dataset.color !== undefined) { setColor(b.dataset.color || null); return; }
      if (act === "reset-row") { const r = o.rows.find((x) => x.key === b.closest(".tw-row").dataset.row); r && setValue(r, r.def, true); return; }
      if (act === "reset-all") { if (!o.rows.some(isChanged)) return; t.values = {}; o.rows.forEach(syncRow); syncFoot(); queue(); if (o.live) flush(); return; }
      if (act === "primary") { if (b.getAttribute("aria-disabled") === "true") return; if (o.live) flush(); o.primary.run(out()); return; }
      if (act === "back") { if (o.live) flush(); o.back.run(); return; }
      if (act === "close") { o.close?.(); }
    }
    function onInput(e) {
      const el = e.target, rowEl = el.closest(".tw-row");
      if (rowEl && el.type === "range") { const r = o.rows.find((x) => x.key === rowEl.dataset.row); r && setValue(r, Number(el.value), false); }
      if (el.type === "color") setColor(el.value.toLowerCase());
    }
    function onChange(e) {
      const el = e.target, rowEl = el.closest(".tw-row");
      if (rowEl && el.type === "text") {
        const r = o.rows.find((x) => x.key === rowEl.dataset.row), v = Number(el.value.replace(",", "."));
        if (r) { if (el.value.trim() && Number.isFinite(v)) setValue(r, v, true); el.value = H.format(r, valueOf(r)); }
      }
      if (el.type === "range" && o.live) flush();
      if (el.type === "text" && el.closest(".tw-hex")) {
        const v = el.value.trim(), hex = (v.startsWith("#") ? v : "#" + v).toLowerCase();
        if (/^#[0-9a-f]{6}$/.test(hex)) setColor(hex); else el.value = (o.ballColor() || "").toUpperCase();
      }
    }
    function onKey(e) {
      if (!host.isConnected) return;
      if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation();
        if (o.back) { if (o.live) flush(); o.back.run(); } else o.close?.();
        return;
      }
      if (e.key === "Enter" && host.contains(e.target) && e.target.matches?.('input[type="text"]')) e.target.blur();
    }
    function onOver(e) {
      const rowEl = e.target.closest?.(".tw-row"), f = rowEl ? rowEl.dataset.field : null;
      if (f === t.active) return;
      host.querySelectorAll(".tw-row.is-active").forEach((x) => x.classList.remove("is-active"));
      rowEl?.classList.add("is-active");
      t.active = f; queue();
    }
    host.addEventListener("click", onClick);
    host.addEventListener("input", onInput);
    host.addEventListener("change", onChange);
    host.addEventListener("pointerover", onOver);
    window.addEventListener("keydown", onKey, true);
    t.ro = new ResizeObserver(() => { fit(); queue(); });
    t.ro.observe(host);
    render();
    return {
      redraw: queue,
      flush,
      setRows(rows, values) { o.rows = rows; if (values) t.values = { ...values }; render(); },
      refreshLook() { if (t.tab === "look") { const p = host.querySelector(".tw-panel"); if (p) p.innerHTML = lookHtml(); } syncFoot(); queue(); },
      destroy() {
        if (o.live && t.timer) flush();
        cancelAnimationFrame(t.raf);
        t.ro.disconnect();
        window.removeEventListener("keydown", onKey, true);
        host.removeEventListener("click", onClick);
        host.removeEventListener("input", onInput);
        host.removeEventListener("change", onChange);
        host.removeEventListener("pointerover", onOver);
        host.innerHTML = "";
      },
    };
  }

  // Lobby helpers for the Tune controller.
  const lobbyHelpers = (code) => ({
    project: (v, w, h) => api.project(code, v, w, h, api.getBackdrop()), draw: (x, l, bc) => api.draw(x, l, bc),
    clamp: (r, v) => api.clamp(r, v), format: (r, v) => api.format(r, v), label: (r) => api.label(r), colors: api.colors,
    getBackdrop: () => api.getBackdrop(), setBackdrop: (v) => { api.setBackdrop(v); state.backdrop = api.getBackdrop(); },
  });
  function fitBars(host) {
    const el = host.querySelector(".tw-tune");
    if (!el || !root) return;
    const top = root.getBoundingClientRect().top;
    const foot = [...document.querySelectorAll("footer, .hall-bottombar")].map((e) => e.getBoundingClientRect()).filter((r) => r.height > 20 && r.height < 120 && r.bottom >= window.innerHeight - 2);
    const bottom = foot.length ? window.innerHeight - Math.min(...foot.map((r) => r.top)) : 50;
    el.style.setProperty("--tw-top", Math.max(0, Math.round(top)) + "px");
    el.style.setProperty("--tw-bottom", Math.max(0, Math.round(bottom)) + "px");
  }

  // ---- list page ----------------------------------------------------------------------------
  function sparkline(scores) {
    if (scores.length < 2) return `<p>${scores.length ? "One run so far: your trend starts after the next" : "Play once to start your trend"}</p>`;
    const W = 400, Hh = 64, lo = Math.min(...scores) * .96, hi = Math.max(...scores) * 1.02 || 1;
    const pts = scores.map((v, i) => [4 + i * (W - 8) / (scores.length - 1), Hh - 6 - (v - lo) / (hi - lo || 1) * (Hh - 14)]);
    const best = Math.max(...scores), by = Hh - 6 - (best - lo) / (hi - lo || 1) * (Hh - 14), last = pts[pts.length - 1];
    const area = `M${pts[0][0]},${Hh} ` + pts.map((p) => `L${p[0]},${p[1]}`).join(" ") + ` L${last[0]},${Hh} Z`;
    return `<svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" aria-label="Score trend, last ${scores.length} runs">
      <defs><linearGradient id="twg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4655" stop-opacity=".28"/><stop offset="1" stop-color="#ff4655" stop-opacity="0"/></linearGradient></defs>
      <line x1="0" x2="${W}" y1="${by}" y2="${by}" stroke="#ffffff22" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>
      <path d="${area}" fill="url(#twg)"/>
      <polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#ff4655" stroke-width="2" vector-effect="non-scaling-stroke"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="4" fill="#fff" stroke="#ff4655" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
  }
  function isCustom(code) {
    const t = api.tunables(code);
    return !!t && t.rows.some((r) => t.values[r.key] != null && Math.abs(t.values[r.key] - r.def) > 1e-9);
  }
  function visibleItems() {
    return state.items.filter((it) => it.match && (filter === "all" || (filter === FAV ? state.favorites.includes(it.shareCode) : it.facts?.skill === filter)));
  }
  function renderList() {
    const skills = [...new Set(state.items.map((it) => it.facts?.skill).filter(Boolean))];
    if (filter !== "all" && filter !== FAV && !skills.includes(filter)) filter = "all";
    const chip = (key, label, n) => `<button type="button" data-filter="${esc(key)}" aria-pressed="${filter === key}">${esc(label)}${n != null ? `<i>${n}</i>` : ""}</button>`;
    const items = visibleItems(), q = state.query.trim();
    let body;
    if (state.status === "loading") body = `<div class="tw-empty">Loading target tasks…</div>`;
    else if (state.status === "error") body = `<div class="tw-empty"><p class="tw-note">Could not load target tasks. <button type="button" data-act="retry">Try again</button></p></div>`;
    else if (!items.length) body = `<div class="tw-empty">${q ? "No matching target tasks." : filter === FAV ? "No favorites yet: click the bookmark on a task." : "No target tasks yet."}</div>`;
    else body = items.map(card).join("");
    root.innerHTML = `<div class="tw-page">
      <div class="tw-head"><div><div class="tw-kicker">Train the basics · precision, reactions, tracking</div><h1 class="tw-title">Target Workshop</h1></div>
        <div class="tw-chips" role="group" aria-label="Filter">${chip("all", "All", state.items.length)}${skills.map((s) => chip(s, s, state.items.filter((it) => it.facts?.skill === s).length)).join("")}${chip(FAV, "Favorites", state.favorites.filter((c) => state.items.some((it) => it.shareCode === c)).length)}</div></div>
      ${q ? `<p class="tw-note">Search "${esc(q)}" · ${items.length} tasks <button type="button" data-act="clear">Clear search</button></p>` : ""}
      <div class="tw-grid">${body}</div></div>`;
    queueDraw();
  }
  function card(it) {
    const f = it.facts, fav = state.favorites.includes(it.shareCode);
    const custom = it.doc === "ready" && isCustom(it.shareCode);
    return `<article class="tw-card${it.shareCode === state.selected ? " is-on" : ""}" data-code="${esc(it.shareCode)}" tabindex="0" aria-label="${esc(it.name)}">
      <div class="tw-pv"><canvas data-pv="${esc(it.shareCode)}"></canvas>
        ${f ? `<span class="tw-tag">${esc(f.skill)} / ${esc(f.form)}</span><span class="tw-len">${esc(f.length)}</span>` : ""}
        ${custom ? `<span class="tw-custom" title="You changed this drill's settings">Tuned</span>` : ""}</div>
      <div class="tw-body">
        <div class="tw-name"><h2>${esc(it.name)}</h2><button type="button" class="tw-fav${fav ? " is-on" : ""}" data-act="fav" title="${fav ? "Remove from favorites" : "Add to favorites"}" aria-pressed="${fav}">${fav ? ICON.markOn : ICON.mark}</button></div>
        <p class="tw-desc">${esc(it.description || f?.summary || "")}</p>
        <div class="tw-stats"><div><span>Best</span><b class="${it.best == null ? "is-none" : ""}">${num(it.best)}</b></div>
          <div><span>Accuracy</span><b class="${it.accuracy == null ? "is-none" : ""}">${it.accuracy == null ? "—" : Math.round(it.accuracy) + "%"}</b></div>
          <div><span>Runs</span><b>${it.attempts}</b></div></div>
        <div class="tw-trend">${sparkline(it.scores)}</div>
        <div class="tw-actions"><button type="button" class="tw-btn is-ghost" data-act="tune" ${it.doc === "ready" ? "" : 'aria-disabled="true"'}>${ICON.tune} Tune</button>
          <button type="button" class="tw-btn" data-act="play" ${state.paused ? 'aria-disabled="true"' : ""}>${ICON.play} Play</button></div>
      </div></article>`;
  }
  function queueDraw() {
    if (drawQueued) return;
    drawQueued = requestAnimationFrame(() => { drawQueued = 0; drawAll(); });
  }
  function drawAll() {
    if (!root || !state) return;
    if (tune) { tune.redraw(); return; }
    for (const cv of root.querySelectorAll("canvas[data-pv]")) {
      const code = cv.dataset.pv, it = state.items.find((x) => x.shareCode === code);
      if (!it || it.doc !== "ready") continue;
      const tn = api.tunables(code);
      paint(cv, (v, w, h) => api.project(code, v, w, h, state.backdrop), api.draw, tn ? tn.values : {}, state.ballColor, state.backdrop);
    }
  }

  // ---- lobby Tune page ----------------------------------------------------------------------
  function openTune(code) {
    const tn = api.tunables(code), it = state.items.find((x) => x.shareCode === code);
    if (!tn) return;
    api.select(code);
    root.innerHTML = "";
    const host = document.createElement("div");
    root.appendChild(host);
    tune = createTune(host, {
      title: it?.name, tag: it?.facts ? `${it.facts.skill} / ${it.facts.form} · ${it.facts.length}` : "",
      rows: tn.rows, values: tn.values, h: lobbyHelpers(code), fitBars,
      ballColor: () => state.ballColor, setBallColor: (c) => { api.setBallColor(c); state.ballColor = c; },
      live: (v) => api.tunables(code)?.set(v),
      help: "Runs with changed settings still go into Training History.",
      primary: { label: "Save & play", ready: () => !state.paused, run: () => { closeTune(); api.play(code); } },
      back: { label: "Back to Target Workshop", run: () => closeTune() },
      close: null,
    });
    tune.code = code;
  }
  function closeTune() {
    if (!tune) return;
    const t = tune; tune = null;
    t.destroy();
    if (root) renderList();
  }

  function onClick(e) {
    if (tune) return;
    const t = e.target.closest("button, [data-code]");
    if (!t || !root.contains(t)) return;
    if (t.matches("[data-filter]")) { filter = t.dataset.filter; renderList(); return; }
    const act = t.dataset.act;
    if (act === "retry") return api.retry();
    if (act === "clear") return api.clearQuery();
    const cardEl = t.closest("[data-code]");
    if (!cardEl) return;
    const code = cardEl.dataset.code;
    if (act === "fav") { api.favorite(code); return; }
    if (act === "tune") { if (t.getAttribute("aria-disabled") !== "true") openTune(code); return; }
    if (act === "play") { if (!state.paused) api.play(code); return; }
    if (code !== state.selected) api.select(code);
  }
  function onKey(e) {
    if (tune || !root?.isConnected) return;
    if (e.key === "Enter" && e.target.classList?.contains("tw-card") && root.contains(e.target)) api.play(e.target.dataset.code);
  }

  // ---- lifecycle ----------------------------------------------------------------------------
  function mount(el, a) {
    if (a) api = a;
    if (!el) { unmount(); return; }
    if (el === root) return;
    unmount();
    injectCss();
    root = el;
    root.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey, true);
    resizeObs = new ResizeObserver(() => queueDraw());
    resizeObs.observe(root);
    update(api.state());
  }
  function unmount() {
    if (!root) return;
    if (tune) { const t = tune; tune = null; t.destroy(); }
    resizeObs?.disconnect(); resizeObs = null;
    window.removeEventListener("keydown", onKey, true);
    root.removeEventListener("click", onClick);
    root = null;
  }
  function update(s) {
    state = s;
    if (!root || !api) return;
    for (const it of s.items) if (!requested.has(it.shareCode)) { requested.add(it.shareCode); api.ensure(it.shareCode); }
    if (tune) {
      if (!s.items.some((it) => it.shareCode === tune.code)) closeTune();
      else tune.redraw();
      return;
    }
    renderList();
  }

  // ---- in-round Parameters window (the game's TunablesDialog, marker aim-tw-dialog) ----------
  // ctx = { props (rows, values, doc, mode "pause"|"start", localProgress, title, ballColor),
  //         emit(name, payload), helpers {project, draw, clamp, format, label, colors, getBackdrop, setBackdrop} }
  function dialog(el, ctx) {
    injectCss();
    const P = ctx.props, mode = P.mode;
    const same = (a, b) => {
      for (const x of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
        const p = a?.[x], q = b?.[x];
        if (p == null && q == null) continue;
        if (p == null || q == null || Math.abs(p - q) > 1e-9) return false;
      }
      return true;
    };
    const wrap = document.createElement("div");
    wrap.className = "tw-modal";
    wrap.setAttribute("role", "dialog"); wrap.setAttribute("aria-modal", "true"); wrap.dataset.role = "tunables-dialog"; wrap.dataset.mode = mode;
    el.appendChild(wrap);
    wrap.addEventListener("click", (e) => { if (e.target === wrap) ctx.emit("close"); });
    const ranked = !!P.localProgress;
    const c = createTune(wrap, {
      title: P.title, tag: "", rows: P.rows, values: P.values || {}, h: ctx.helpers,
      ballColor: () => ctx.props.ballColor ?? null,
      setBallColor: (col) => {
        // Saved colour (used when a drill loads) + the round's display setting (live). Worker Test's
        // game thread only sees the display setting through a forwarded storage event.
        ctx.helpers.setColor?.(col);
        ctx.emit("update:ballColor", col);
        setTimeout(() => window.__aimWorkerStorageEvent?.("al-display-settings-v1"), 30);
      },
      live: mode === "pause" ? null : (v) => ctx.emit("update", v),
      help: mode === "pause" ? "Changes apply when the drill restarts." : ranked ? "Runs with changed settings still go into Training History." : "",
      note: (v, n) => {
        if (mode === "pause") return same(v, ctx.props.values) ? { text: "Same as this run" } : { text: ranked ? "Restart to use the new settings" : "After restarting with these, the run is unranked", warn: !ranked && n > 0 };
        if (!ranked && n > 0) return { text: `${n} changed: this run is unranked`, warn: true };
        return null;
      },
      primary: mode === "pause"
        ? { label: "Restart with new settings", ready: (v) => !same(v, ctx.props.values), run: (v) => ctx.emit("apply", v) }
        : mode === "start" ? { label: "Start training", run: () => ctx.emit("start") }
        : { label: "Done", run: () => ctx.emit("close") },
      back: null,
      close: () => ctx.emit("close"),
    });
    return {
      refresh() { c.refreshLook(); },
      destroy() { c.destroy(); wrap.remove(); },
    };
  }

  window.__aimTargetWorkshop = { mount, update, dialog };
  // The lobby may have mounted the tab before this script ran.
  const late = document.querySelector(".tw-root");
  if (late && window.__aimTWApi) mount(late, window.__aimTWApi);
})();
