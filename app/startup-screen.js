// Startup screen: covers the lobby while it is still half loaded ("Loading…", 0 tasks)
// and lifts once the page has really finished. Steps follow real page state:
// page started, interface in place, training list filled. Never stays longer than
// MAX_MS, and never shows on later in-page navigation (only on a page load).
//
// Look: a small target in the middle closes in around a red V (lock-on), with the
// current step underneath. Behind it:
//  - normal start: one of three backgrounds, picked at random (never the same twice in a row):
//    H map cycle (map covers fade one into the next, an agent on each side),
//    I strips (every map as a slanted strip with an agent, one lit at a time),
//    J agent wall (every agent's face as a tilted wall, a map band across the middle);
//  - coming back with the Studio's Lobby button: the Studio home's wall art, with STUDIO above the step.
// Pictures are the game's own: /aim-maps/<map>.cover.webp, /images/agent-art/, /studio/icons/agents/.
(() => {
  if (window.__aimStartupScreen) return;
  window.__aimStartupScreen = true;
  // creator-loading-v1: the lobby (the app's start page, also reloaded when leaving the Creator) and the Creator
  // page (/studio/) each get this screen while they load. Every other page only gets the cover shown when you
  // open the Creator (window.__aimLoadingCover, below).
  const onLobby = /^\/aim\/?$/.test(location.pathname);
  const onCreator = location.pathname.startsWith("/studio/");
  const MAX_MS = 20000;
  const STABLE_MS = 350;
  const started = performance.now();

  const style = document.createElement("style");
  style.textContent = `
.es-startup{position:fixed;inset:0;z-index:2147483000;overflow:hidden;isolation:isolate;background:#07090d;color:var(--es-text,#f4f5f7);font-family:var(--es-head,"Bahnschrift",sans-serif);transition:opacity .28s ease;cursor:progress}
.es-startup *{box-sizing:border-box}
.es-startup.is-done{opacity:0;pointer-events:none}
/* drill-launch-screen-v1: hand over to the drill's loading screen in the very frame it first draws */
body:has(.al-wkload,.tl-wait) .es-startup.su-launch{display:none}
.es-startup .su-corner{position:absolute;left:56px;top:40px;z-index:6;display:flex;align-items:center;gap:10px;font-size:12px;font-weight:700;letter-spacing:.15em}
.es-startup .su-corner i{width:5px;height:17px;background:var(--es-red,#ff4655);transform:skew(-16deg)}
/* lock-on centre */
.es-startup .su-lock{position:absolute;left:50%;top:50%;z-index:5;width:220px;height:220px;transform:translate(-50%,-50%)}
.es-startup .su-lock svg{width:100%;height:100%;overflow:visible}
.es-startup .su-ring{transform-origin:110px 110px;animation:su-close 2.2s cubic-bezier(.6,0,.3,1) infinite}
.es-startup .su-ring.b{animation-delay:.18s}.es-startup .su-ring.c{animation-delay:.36s}
.es-startup .su-brk{transform-origin:110px 110px;animation:su-snap 2.2s cubic-bezier(.6,0,.3,1) infinite}
.es-startup .su-v{position:absolute;left:50%;top:50%;width:62px;transform:translate(-50%,-52%);animation:su-pop 2.2s cubic-bezier(.6,0,.3,1) infinite}
.es-startup .su-v svg{display:block;width:100%;height:auto}
@keyframes su-close{0%{transform:scale(2.4);opacity:0}35%{opacity:1}70%,100%{transform:scale(1);opacity:.9}}
@keyframes su-snap{0%,45%{transform:scale(1.5);opacity:.2}70%,100%{transform:scale(1);opacity:1}}
@keyframes su-pop{0%,55%{transform:translate(-50%,-52%) scale(.6);opacity:.35}72%{transform:translate(-50%,-52%) scale(1.08);opacity:1}100%{transform:translate(-50%,-52%) scale(1);opacity:1}}
.es-startup .su-lock-txt{position:absolute;left:50%;top:calc(50% + 150px);z-index:5;transform:translateX(-50%);text-align:center;white-space:nowrap}
.es-startup .su-lock-tag{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px;color:#c9ced6;font-size:12px;font-weight:700;letter-spacing:.18em}
.es-startup .su-lock-tag i{width:4px;height:15px;background:var(--es-red,#ff4655);transform:skew(-16deg)}
.es-startup .su-lock-step{color:var(--es-muted,#9aa1ae);font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-stretch:75%}
.es-startup .su-grid{position:absolute;inset:0;z-index:2;pointer-events:none;background-image:linear-gradient(#7ba8b70f 1px,transparent 1px),linear-gradient(90deg,#7ba8b70f 1px,transparent 1px);background-size:48px 48px}
.es-startup .su-vig{position:absolute;inset:0;z-index:3;pointer-events:none;background:radial-gradient(ellipse at center,#07090d55 0%,#07090dcc 62%,#07090d 100%)}
/* Studio: the Studio home's wall art */
.es-startup.su-studio{background:#08111b}
.es-startup .sw-wall{position:absolute;inset:0;width:100%;height:100%;z-index:0}
/* H: map cycle */
.es-startup .h-map{position:absolute;inset:-2%;background:center/cover no-repeat;opacity:0;transition:opacity 1.2s ease;filter:saturate(.55) brightness(.42);animation:su-drift 14s linear infinite alternate}
.es-startup .h-map.on{opacity:1}
@keyframes su-drift{from{transform:scale(1.04)}to{transform:scale(1.1) translateX(-1.5%)}}
.es-startup .h-agent{position:absolute;right:-4%;bottom:-6%;z-index:4;height:104%;aspect-ratio:760/690;background:right bottom/contain no-repeat;opacity:0;transition:opacity 1.2s ease;-webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 35%)}
.es-startup .h-agent.on{opacity:.9}
.es-startup .h-agent.left{left:-4%;right:auto;background-position:left bottom;-webkit-mask-image:linear-gradient(270deg,transparent 0%,#000 35%)}
.es-startup .h-name{position:absolute;left:56px;bottom:46px;z-index:5;font:italic 800 clamp(40px,5vw,84px)/1 var(--es-head,"Bahnschrift",sans-serif);font-stretch:condensed;letter-spacing:-.02em;color:#ffffff1c;text-transform:uppercase}
/* I: strips */
.es-startup .i-strips{position:absolute;inset:0 -6%;display:flex;gap:6px;transform:skewX(-12deg)}
.es-startup .i-strip{position:relative;flex:1;overflow:hidden;background:#0c0f14}
.es-startup .i-strip .m{position:absolute;inset:0 -40%;transform:skewX(12deg);background:center/cover no-repeat;filter:saturate(.5) brightness(.38);transition:filter .4s}
.es-startup .i-strip .a{position:absolute;left:-40%;right:-40%;bottom:-4%;height:86%;transform:skewX(12deg);background:center bottom/auto 100% no-repeat;filter:brightness(.55) saturate(.7);transition:filter .4s}
.es-startup .i-strip.hi .m{filter:saturate(.9) brightness(.6)}
.es-startup .i-strip.hi .a{filter:none}
.es-startup .i-strip.hi:after{content:"";position:absolute;inset:0;border:2px solid var(--es-red,#ff4655)}
.es-startup .i-strip b{position:absolute;left:0;right:0;top:9%;transform:skewX(12deg);text-align:center;font:italic 800 clamp(13px,1.3vw,22px)/1 var(--es-head,"Bahnschrift",sans-serif);color:#ffffff66;letter-spacing:.03em}
.es-startup .i-strip.hi b{color:#fff}
.es-startup.su-i .su-vig{background:radial-gradient(ellipse at center,#07090d30 0%,#07090d99 55%,#07090df0 100%)}
/* J: agent wall */
.es-startup .j-faces{position:absolute;inset:-40px;display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px;transform:rotate(-8deg) scale(1.15);opacity:.32;filter:grayscale(.75)}
.es-startup .j-faces img{width:100%;aspect-ratio:1;object-fit:cover;background:#10131a}
.es-startup .j-band{position:absolute;left:0;right:0;top:50%;z-index:2;height:260px;overflow:hidden;transform:translateY(-50%) skewY(-4deg);border-top:2px solid var(--es-red,#ff4655);border-bottom:1px solid #ffffff1a}
.es-startup .j-band div{position:absolute;inset:-30px 0;transform:skewY(4deg);background:center/cover no-repeat;filter:saturate(.6) brightness(.45)}
.es-startup.su-j .su-vig{background:radial-gradient(ellipse at center,#07090d40 0%,#07090db0 60%,#07090d 100%)}
@media(prefers-reduced-motion:reduce){.es-startup .su-ring,.es-startup .su-brk,.es-startup .su-v,.es-startup .h-map{animation:none}}`;
  document.head.append(style);
  const pageStyle = style;

  // Came back with the Studio's Lobby button (studio.js sets this just before leaving).
  let fromStudio = false;
  try { fromStudio = sessionStorage.getItem("aim-from-studio") === "1"; sessionStorage.removeItem("aim-from-studio"); } catch {}
  // drill-launch-screen-v1: the lobby page loaded only to start a drill (Play / Record in the Creator, a review play,
  // a ?pw= drill link). The drill's own loading screen (.al-wkload) follows, so this screen hands over to it as soon
  // as it is up, instead of waiting for the lobby and then showing a second loading screen.
  const fromCreatorPlay = onLobby && /(^|[#&])studio-(play|record)=/.test(location.hash);
  let launching = fromCreatorPlay || (onLobby && /[?&]pw=/.test(location.search));
  try { if (onLobby && sessionStorage.getItem("review-play")) launching = true; } catch {}

  const MAPS = [["ascent", "Ascent"], ["bonsai", "Split"], ["duality", "Bind"], ["jam", "Lotus"], ["juliett", "Sunset"], ["pitt", "Pearl"], ["plummet", "Abyss"], ["port", "Icebox"], ["rook", "Corrode"], ["triad", "Haven"]];
  const AGENTS = ["astra", "breach", "brimstone", "chamber", "clove", "cypher", "deadlock", "fade", "gekko", "harbor", "iso", "jett", "kayo", "killjoy", "miks", "neon", "omen", "phoenix", "raze", "reyna", "sage", "skye", "sova", "tejo", "veto", "viper", "vyse", "waylay", "yoru"];
  const cover = (m) => `/local/loading/maps/${m}.cover.webp`;
  const art = (a) => `/local/loading/agents/${a === "kayo" ? "kay-o" : a}.webp`;
  const face = (a) => `/local/loading/faces/${a}.png`;
  const shuffled = (list) => list.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

  const LOCK = (tag) =>
    '<div class="su-lock" aria-hidden="true"><svg viewBox="0 0 220 220">' +
    '<g fill="none" stroke="#8bcbd7" stroke-opacity=".45" stroke-width="2"><circle class="su-ring" cx="110" cy="110" r="96"/><circle class="su-ring b" cx="110" cy="110" r="64"/><circle class="su-ring c" cx="110" cy="110" r="34"/></g>' +
    '<g class="su-brk" fill="none" stroke="#ff4655" stroke-width="3"><path d="M62 40H40v22M158 40h22v22M62 180H40v-22M158 180h22v-22"/></g></svg>' +
    '<div class="su-v"><svg viewBox="0 0 100 100"><polygon points="4,10 30,10 62,90 47,90" fill="#ff4655"/><polygon points="96,10 70,10 52,55 64,72" fill="#ff4655" fill-opacity=".72"/></svg></div></div>' +
    '<div class="su-lock-txt">' + (tag ? `<div class="su-lock-tag"><i></i>${tag}</div>` : "") + '<div class="su-lock-step"></div></div>';
  const CORNER = '<div class="su-corner"><i></i>OPENVAIM</div>';

  // The Studio home's wall art (site/local/workshop-wall.svg), without its big target.
  const STUDIO_WALL = '<svg class="sw-wall" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>' +
    '<linearGradient id="sw-base" x2="1" y2="1"><stop stop-color="#08131d"/><stop offset=".55" stop-color="#0b1520"/><stop offset="1" stop-color="#060b11"/></linearGradient>' +
    '<radialGradient id="sw-glow"><stop stop-color="#b62f47" stop-opacity=".16"/><stop offset="1" stop-color="#b62f47" stop-opacity="0"/></radialGradient>' +
    '<pattern id="sw-grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#7ba8b7" stroke-opacity=".08" stroke-width="1"/></pattern>' +
    '<linearGradient id="sw-rail"><stop stop-color="#ff6170" stop-opacity="0"/><stop offset=".52" stop-color="#ff6170" stop-opacity=".26"/><stop offset="1" stop-color="#ff6170" stop-opacity="0"/></linearGradient>' +
    '<radialGradient id="sw-vig"><stop offset=".45" stop-color="#05080c" stop-opacity="0"/><stop offset="1" stop-color="#05080c" stop-opacity=".75"/></radialGradient></defs>' +
    '<rect width="1600" height="900" fill="url(#sw-base)"/><rect width="1600" height="900" fill="url(#sw-grid)"/>' +
    '<ellipse cx="800" cy="450" rx="520" ry="380" fill="url(#sw-glow)"/>' +
    '<g fill="none" stroke="url(#sw-rail)" stroke-width="3"><path d="M-80 690 660 270 1215 475 1720 180"/><path d="M-60 785 730 345 1215 565 1710 290"/></g>' +
    '<g fill="#92d1dd" fill-opacity=".45"><circle cx="646" cy="287" r="4"/><circle cx="774" cy="369" r="3"/><circle cx="917" cy="598" r="4"/><circle cx="1432" cy="326" r="3"/></g>' +
    '<path d="M0 854h420M0 865h260M1350 62h250M1460 75h140" stroke="#ff6b78" stroke-opacity=".2" stroke-width="2"/>' +
    '<rect width="1600" height="900" fill="url(#sw-vig)"/></svg>';

  // Shown the moment you open the Creator from the lobby (or anywhere else in the game), so the jump isn't flat:
  // the Creator page then starts on the same screen and lifts it once your drills are on screen.
  // Returns a promise that settles once the cover has been drawn (two frames plus a short gap: its first paint over
  // the busy lobby took 220-300 ms in tests), so the page can be left only after that.
  const drawn = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 120))));
  window.__aimLoadingCover = () => {
    if (document.querySelector(".es-startup.su-cover")) return drawn();
    const cover = document.createElement("div");
    cover.className = "es-startup su-studio su-cover";
    cover.setAttribute("role", "status");
    cover.innerHTML = STUDIO_WALL + LOCK("CREATOR");
    cover.querySelector(".su-lock-step").textContent = "Opening the Creator · 1/4";
    document.body.append(cover);
    // If the page is still here after a while (the jump didn't happen), take it away again.
    setTimeout(() => { cover.classList.add("is-done"); setTimeout(() => cover.remove(), 320); }, 9000);
    return drawn();
  };
  const toCreator = (url) => { try { const u = new URL(url, location.href); return u.origin === location.origin && /^\/(studio(\/|$)|aim\/studio(\/|$))/.test(u.pathname); } catch { return false; } };
  if (!onCreator && window.navigation && !window.__aimCreatorNavHook) {
    window.__aimCreatorNavHook = true;
    let letGo = false;
    window.navigation.addEventListener("navigate", (e) => {
      if (letGo || !toCreator(e.destination.url) || e.hashChange || e.downloadRequest) return;
      const ready = window.__aimLoadingCover();
      if (!e.cancelable) return;
      // Hold the jump until the cover is on screen.
      e.preventDefault();
      const url = e.destination.url;
      ready.then(() => { letGo = true; location.assign(url); });
    });
  }
  if (!onLobby && !onCreator) return;

  const root = document.createElement("div");
  root.className = launching ? "es-startup su-launch" : "es-startup";
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  root.setAttribute("aria-label", "Loading");
  const timers = [];
  const every = (ms, fn) => { fn(); timers.push(setInterval(fn, ms)); };

  if (fromStudio || onCreator || fromCreatorPlay) {
    root.classList.add("su-studio");
    root.innerHTML = STUDIO_WALL + LOCK("CREATOR");
  } else {
    // Pick H, I or J, never the one shown last time.
    const KEY = "es-startup-look";
    let last = "";
    try { last = localStorage.getItem(KEY) || ""; } catch {}
    const look = shuffled(["h", "i", "j"].filter((x) => x !== last))[0];
    try { localStorage.setItem(KEY, look); } catch {}
    root.classList.add("su-" + look);
    const maps = shuffled(MAPS), agents = shuffled(AGENTS);

    if (look === "h") {
      root.innerHTML = maps.map(([m]) => `<div class="h-map" style="background-image:url(${cover(m)})"></div>`).join("") +
        '<div class="h-agent"></div><div class="h-agent left"></div><div class="su-grid"></div><div class="su-vig"></div><div class="h-name"></div>' + CORNER + LOCK("");
      let k = 0;
      every(2600, () => {
        root.querySelectorAll(".h-map").forEach((el, i) => el.classList.toggle("on", i === k % maps.length));
        root.querySelector(".h-name").textContent = maps[k % maps.length][1];
        root.querySelectorAll(".h-agent").forEach((el, side) => {
          el.classList.remove("on");
          setTimeout(() => { el.style.backgroundImage = `url(${art(agents[(k * 2 + side) % agents.length])})`; el.classList.add("on"); }, 350);
        });
        k++;
      });
    } else if (look === "i") {
      root.innerHTML = '<div class="i-strips">' +
        maps.map(([m, name], i) => `<div class="i-strip"><div class="m" style="background-image:url(${cover(m)})"></div><div class="a" style="background-image:url(${art(agents[i % agents.length])})"></div><b>${name.toUpperCase()}</b></div>`).join("") +
        '</div><div class="su-grid"></div><div class="su-vig"></div>' + CORNER + LOCK("");
      let k = 0;
      every(900, () => { root.querySelectorAll(".i-strip").forEach((el, i) => el.classList.toggle("hi", i === k % maps.length)); k++; });
    } else {
      root.innerHTML = '<div class="j-faces">' + Array.from({ length: 140 }, (_, i) => `<img src="${face(agents[i % agents.length])}" alt="">`).join("") +
        '</div><div class="j-band"><div></div></div><div class="su-vig"></div>' + CORNER + LOCK("");
      let k = 0;
      every(1400, () => { root.querySelector(".j-band div").style.backgroundImage = `url(${cover(maps[k % maps.length][0])})`; k++; });
    }
  }
  document.body.append(root);
  performance.mark("aim-startup-screen");

  const TITLES = onCreator ? ["Opening the Creator", "Loading the Creator", "Loading your drills", "Ready"]
    : launching ? ["Opening your drill", "Loading the game", "Loading your drill", "Ready"]
    : ["Starting up", "Loading the interface", "Loading your training list", "Ready"];
  let step = -1;
  function show(n) {
    if (n <= step) return;
    step = n;
    root.querySelector(".su-lock-step").textContent = `${TITLES[Math.min(n, 3)]} · ${Math.min(n + 1, 4)}/4`;
  }
  show(0);

  // Still loading while any visible text outside this screen reads "Loading…".
  function stillLoading() {
    for (const el of document.querySelectorAll("body *")) {
      if (el.children.length || root.contains(el)) continue;
      const t = el.textContent.trim();
      if (t.startsWith("Loading") && el.offsetParent) return true;
    }
    return false;
  }

  let quietSince = 0;
  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    timers.forEach(clearInterval);
    show(3);
    // Handing over to a drill's loading screen: gone at once (the page is busy loading the drill then, and the fade's
    // timers ran up to 4 s late in tests).
    if (launching && document.querySelector(".al-wkload, .tl-wait")) { root.remove(); return; }
    setTimeout(() => {
      root.classList.add("is-done");
      // The lobby keeps the style: the Creator cover above uses it later.
      setTimeout(() => { root.remove(); if (onCreator) pageStyle.remove(); }, 320);
    }, 180);
  }

  const timer = setInterval(() => {
    const now = performance.now();
    if (now - started > MAX_MS) return finish();
    if (launching) {
      // Hand over once the drill's loading screen (or the round) is up; if no drill comes (bad code), the lobby
      // shows after it has been ready for 2.5 s.
      if (document.querySelector(".al-wkload, .tl-wait") || document.body.classList.contains("al-training-active")) return finish();
      if (!document.querySelector(".hall-topnav")) return show(1);
      show(2);
      if (!document.querySelector(".hall-root")) { quietSince = 0; return; }
      if (!quietSince) quietSince = now;
      else if (now - quietSince >= 2500) finish();
      return;
    }
    // Creator: its home (.library) or a drill opened straight away (.editor) is on screen and nothing reads "Loading…".
    if (!document.querySelector(onCreator ? "#app > *" : ".hall-topnav")) return show(1);
    show(2);
    if (!document.querySelector(onCreator ? ".library, .editor" : ".hall-root") || stillLoading()) {
      quietSince = 0;
      return;
    }
    if (!quietSince) quietSince = now;
    else if (now - quietSince >= STABLE_MS) finish();
  }, 100);
})();
