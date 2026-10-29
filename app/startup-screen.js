// Startup screen: covers the lobby while it is still half loaded ("Loading…", 0 tasks)
// and lifts once the page has really finished. Steps follow real page state:
// page started, interface in place, training list filled. Never stays longer than
// MAX_MS, and never shows on later in-page navigation (only on a page load).
(() => {
  if (window.__aimStartupScreen) return;
  window.__aimStartupScreen = true;
  // Only the lobby itself (the app's start page, also reloaded when leaving the Studio).
  if (!/^\/aim\/?$/.test(location.pathname)) return;
  const MAX_MS = 20000;
  const STABLE_MS = 350;
  const started = performance.now();

  const style = document.createElement("style");
  style.textContent = `
.es-startup{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;padding:42px 60px;box-sizing:border-box;isolation:isolate;
 background:var(--es-bg,#090b0f);color:var(--es-text,#f4f5f7);font-family:var(--es-head,"Bahnschrift",sans-serif);transition:opacity .28s ease;cursor:progress}
.es-startup *{box-sizing:border-box}
.es-startup.is-done{opacity:0;pointer-events:none}
.es-startup .su-stage{position:absolute;left:50%;top:50%;z-index:-3;width:max(100vw,calc(100vh * 2752 / 1536));height:max(100vh,calc(100vw * 1536 / 2752));transform:translate(-50%,-50%);background:var(--es-bg,#090b0f) url('/media/startup/maps-reyna.jpg') center/100% 100% no-repeat;opacity:0;transition:opacity .45s ease}
.es-startup .su-stage.is-loaded{opacity:1}
.es-startup .su-maps{position:absolute;top:0;bottom:0;left:0;right:4.22%;display:flex;gap:.31%;transform:skewX(-12deg)}
.es-startup .su-map{position:relative;flex:1}
.es-startup .su-map b{position:absolute;left:0;right:0;top:15%;transform:skewX(12deg);text-align:center;font:italic 800 clamp(16px,1.6vw,30px)/1 var(--es-head,"Bahnschrift",sans-serif);letter-spacing:.02em;color:#fff;text-shadow:0 2px 12px #000c,0 0 2px #000}
.es-startup .su-art{position:absolute;inset:0;z-index:-2;pointer-events:none;background:linear-gradient(90deg,#090b0fec 0%,#090b0fc8 28%,#090b0f40 44%,#090b0f20 60%,#090b0f20),linear-gradient(0deg,#090b0f 0%,#090b0fd0 22%,transparent 46%)}
.es-startup:after{content:'';position:absolute;inset:16px;border:1px solid #ffffff0d;pointer-events:none}
.es-startup .su-top{display:flex;align-items:center;gap:10px;font-weight:700;font-size:12px;letter-spacing:.15em}
.es-startup .su-mark{height:17px;width:5px;background:var(--es-red,#ff4655);transform:skew(-16deg)}
.es-startup .su-top small{margin-left:auto;color:var(--es-muted,#9aa1ae);font-weight:500;letter-spacing:.09em;font-size:11px}
.es-startup .su-hero{margin:auto 0;max-width:730px;padding:44px 0}
.es-startup .su-eyebrow{color:var(--es-red,#ff4655);font-size:13px;font-weight:700;letter-spacing:.22em;margin:0 0 18px}
.es-startup h1{font-size:clamp(55px,7.3vw,116px)!important;line-height:.94!important;margin:0 0 24px!important;font-weight:800!important;font-stretch:condensed!important;letter-spacing:-.045em!important;font-style:italic!important;font-family:inherit!important;color:inherit!important;text-transform:none!important}
.es-startup h1 span{color:var(--es-red,#ff4655)}
.es-startup .su-intro{font-size:17px;color:var(--es-muted,#9aa1ae);line-height:1.6;margin:0;max-width:410px}
.es-startup .su-bottom{border-top:1px solid var(--es-line-2,#343b4a);padding-top:24px}
.es-startup .su-status{display:flex;align-items:center;gap:16px;margin-bottom:16px}
.es-startup .su-status h2{font-size:23px!important;margin:0!important;font-weight:600!important;font-family:inherit!important;color:inherit!important;text-transform:none!important;letter-spacing:0!important;font-style:normal!important}
.es-startup .su-status span{margin-left:auto;font-size:12px;color:var(--es-muted,#9aa1ae);letter-spacing:.08em}
.es-startup .su-track{height:4px;background:var(--es-line,#272d39);margin-bottom:24px;overflow:hidden}
.es-startup .su-fill{height:100%;width:100%;background:var(--es-red,#ff4655);transform-origin:left;transform:scaleX(.08);transition:transform .35s ease}
.es-startup .su-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
.es-startup .su-step{display:flex;align-items:center;gap:10px;color:var(--es-dim,#6b7280);font-size:13px}
.es-startup .su-step i{width:22px;height:22px;border:1px solid var(--es-line-2,#343b4a);display:grid;place-items:center;font-size:11px;font-style:normal}
.es-startup .su-step.is-done{color:var(--es-muted,#9aa1ae)}
.es-startup .su-step.is-done i{color:var(--es-green,#4ade80);border-color:#4ade8040}
.es-startup .su-step.is-active{color:var(--es-text,#f4f5f7)}
.es-startup .su-step.is-active i{border-color:var(--es-red,#ff4655);background:var(--es-red-wash,rgba(255,70,85,.14));color:var(--es-red,#ff4655)}
.es-startup footer{display:flex;justify-content:space-between;color:var(--es-dim,#6b7280);font-size:11px;letter-spacing:.05em;margin-top:34px}
@media(max-width:700px){.es-startup{padding:30px 26px}.es-startup h1{font-size:59px}.es-startup .su-steps{grid-template-columns:1fr 1fr;gap:14px}}`;
  document.head.append(style);

  const STEPS = ["Starting up", "Interface", "Training list", "Ready"];
  const root = document.createElement("div");
  root.className = "es-startup";
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  // Artwork: every map in the trainer as a slanted strip, with Reyna (media/startup/maps-reyna.jpg,
  // 2752x1536). The names are text on the same strip grid, scaled with the image.
  const MAPS = ["Abyss", "Ascent", "Bind", "Corrode", "Haven", "Lotus", "Split", "Summit", "Sunset"];
  root.innerHTML =
    '<div class="su-stage" aria-hidden="true"><div class="su-maps">' + MAPS.map((name) => `<div class="su-map"><b>${name.toUpperCase()}</b></div>`).join("") + "</div></div>" +
    '<div class="su-art" aria-hidden="true"></div>' +
    '<header class="su-top"><i class="su-mark" aria-hidden="true"></i>OPEN-AIM<small>GET READY TO TRAIN</small></header>' +
    '<section class="su-hero"><p class="su-eyebrow">WELCOME BACK</p><h1>MAKE EVERY<br>SHOT <span>COUNT.</span></h1>' +
    '<p class="su-intro">Getting everything ready<br>for your next session.</p></section>' +
    '<section class="su-bottom"><div class="su-status"><h2></h2><span></span></div>' +
    '<div class="su-track" role="progressbar" aria-label="Startup" aria-valuemin="0" aria-valuemax="4"><div class="su-fill"></div></div>' +
    '<div class="su-steps">' + STEPS.map((s, i) => `<div class="su-step"><i>0${i + 1}</i>${s}</div>`).join("") + "</div></section>" +
    "<footer><span>Opens the lobby as soon as everything has loaded.</span><span>OPEN-AIM</span></footer>";
  document.body.append(root);
  performance.mark("aim-startup-screen");
  const art = new Image();
  art.onload = () => root.querySelector(".su-stage").classList.add("is-loaded");
  art.src = "/media/startup/maps-reyna.jpg";

  const TITLES = ["Starting up", "Loading the interface", "Loading your training list", "Ready"];
  let step = -1;
  function show(n) {
    if (n <= step) return;
    step = n;
    root.querySelector(".su-status h2").textContent = TITLES[Math.min(n, 3)];
    root.querySelector(".su-status span").textContent = `STEP ${Math.min(n + 1, 4)} OF 4`;
    root.querySelector(".su-track").setAttribute("aria-valuenow", String(n));
    root.querySelector(".su-fill").style.transform = `scaleX(${Math.max(0.08, n / 3)})`;
    root.querySelectorAll(".su-step").forEach((el, i) => {
      el.classList.toggle("is-done", i < n || n === 3);
      el.classList.toggle("is-active", i === n && n < 3);
      el.firstElementChild.textContent = i < n || n === 3 ? "✓" : `0${i + 1}`;
    });
  }
  show(0);

  // Still loading while any visible text outside this screen reads "Loading…".
  function stillLoading() {
    for (const el of document.querySelectorAll("body *")) {
      if (el.children.length || root.contains(el)) continue;
      const t = el.textContent.trim();
      if ((t.startsWith("Loading") || t.startsWith("加载中")) && el.offsetParent) return true;
    }
    return false;
  }

  let quietSince = 0;
  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    show(3);
    setTimeout(() => {
      root.classList.add("is-done");
      setTimeout(() => { root.remove(); style.remove(); }, 320);
    }, 180);
  }

  const timer = setInterval(() => {
    const now = performance.now();
    if (now - started > MAX_MS) return finish();
    if (!document.querySelector(".hall-topnav")) return show(1);
    show(2);
    if (!document.querySelector(".hall-root") || stillLoading()) {
      quietSince = 0;
      return;
    }
    if (!quietSince) quietSince = now;
    else if (now - quietSince >= STABLE_MS) finish();
  }, 100);
})();
