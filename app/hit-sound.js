// Hit sound (2026-11-11): Porphyr is the only built-in hit sound, or the player's own file.
// Replaces the game's synth hit kits (Ding, Thud, Double tap, Chirp): playHit in OkAdunfX.js
// (both copies, marker aim-hit-sound) asks window.__aimHitSound.play first and never falls
// back to them. Settings > Audio: the old hit choices are hidden and two cards take their place;
// the live preview is hidden for all tabs in theme-esports.css.
// Your own file is copied by main.js into <profile>/AimTrainer/custom-sounds (ipc aim:hitsound:*).
(() => {
  if (window.__aimHitSound) return;
  const KEY = "aim-hit-sound";           // "porphyr" | "custom"
  const MAX_SECONDS = 2;                 // longer files are faded out and cut at 2 s
  let decoder = null, porphyr = null, porphyrLoading = null, custom = null, customName = null, customLoading = null;
  const api = () => window.__aimDesktop?.hitSound;
  const context = () => (decoder ||= new AudioContext());
  const choice = () => { try { return localStorage.getItem(KEY) === "custom" ? "custom" : "porphyr"; } catch { return "porphyr"; } };
  const setChoice = (value) => { try { localStorage.setItem(KEY, value); } catch {} };

  function loadPorphyr() {
    return (porphyrLoading ||= fetch("/media/hit-sounds/porphyr.ogg")
      .then((r) => { if (!r.ok) throw new Error("Porphyr hit sound missing"); return r.arrayBuffer(); })
      .then((bytes) => context().decodeAudioData(bytes))
      .then((buffer) => (porphyr = buffer))
      .catch((error) => { console.warn("Hit sound:", error); porphyrLoading = null; return null; }));
  }
  function bytesFromBase64(text) {
    const bin = atob(text), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  function loadCustom(again = false) {
    if (again) { customLoading = null; custom = null; }
    return (customLoading ||= (async () => {
      const file = await api()?.read();
      if (!file) { customName = null; return null; }
      customName = file.name;
      custom = await context().decodeAudioData(bytesFromBase64(file.data));
      return custom;
    })().catch((error) => { console.warn("Hit sound (your file):", error); custom = null; return null; }));
  }
  loadPorphyr();
  loadCustom();

  // Called by the game on every hit. Returns true so the old synth sounds never play.
  function play(ctx, destination, gain = 1) {
    const buffer = choice() === "custom" && custom ? custom : porphyr;
    if (!buffer) { loadPorphyr(); return true; }
    const source = ctx.createBufferSource(), level = ctx.createGain(), t = ctx.currentTime;
    source.buffer = buffer;
    level.gain.value = gain;
    source.connect(level).connect(destination);
    source.start(t);
    if (buffer.duration > MAX_SECONDS) {
      level.gain.setValueAtTime(gain, t + MAX_SECONDS - 0.08);
      level.gain.linearRampToValueAtTime(0, t + MAX_SECONDS);
      source.stop(t + MAX_SECONDS);
    }
    return true;
  }
  // Settings "Play" button: the game's audio isn't running there, so use the master volume setting.
  function audition(which) {
    let volume = 0.7;
    try { const s = JSON.parse(localStorage.getItem("al-audio-settings-v1") || "{}"); if (s.enabled === false) volume = 0; else if (typeof s.volume === "number") volume = s.volume; } catch {}
    const ctx = context();
    if (ctx.state === "suspended") ctx.resume();
    const keep = choice();
    setChoice(which);
    play(ctx, ctx.destination, volume);
    setChoice(keep);
  }
  window.__aimHitSound = { play, choice, loadCustom, get customName() { return customName; } };

  // ---------- Settings > Audio ----------
  const css = document.createElement("style");
  css.textContent = `
[data-setting="hitKit"]{display:none!important}
.aim-hs{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin:10px 0 4px}
.aim-hs-card{position:relative;padding:14px 16px;border:1px solid var(--es-line-2,#343b4a);background:var(--es-raised,#171b23);cursor:pointer;text-align:left;color:inherit}
.aim-hs-card.is-on{border-color:var(--es-red,#ff4655);background:var(--es-red-wash,rgba(255,70,85,.14));box-shadow:inset 0 0 0 1px var(--es-red,#ff4655)}
.aim-hs-card.is-on::after{content:"✓";position:absolute;right:14px;top:12px;color:var(--es-red-2,#ff6b77);font-weight:700}
.aim-hs-card b{display:flex;align-items:center;gap:8px;font:600 15px var(--es-head,"Bahnschrift",sans-serif)}
.aim-hs-card b i{font-style:normal;color:var(--es-red,#ff4655);font-size:11px}
.aim-hs-card small{display:block;margin-top:4px;color:var(--es-muted,#9aa1ae);font-size:12px}
.aim-hs-acts{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px}
.aim-hs-btn{font:700 11.5px var(--es-head,"Bahnschrift",sans-serif);letter-spacing:.05em;text-transform:uppercase;padding:7px 14px;border:1px solid var(--es-line-2,#343b4a);background:var(--es-raised-2,#1e232d);color:var(--es-soft,#d6d9df);cursor:pointer;clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)}
.aim-hs-btn:hover{color:#fff;border-color:var(--es-muted,#9aa1ae)}
.aim-hs-btn.is-red{background:var(--es-red,#ff4655);border-color:var(--es-red,#ff4655);color:#fff}
.aim-hs-file{font-size:12px;color:var(--es-soft,#d6d9df);overflow-wrap:anywhere}
.aim-hs-file em{font-style:normal;color:var(--es-dim,#6b7280)}
.aim-hs-file.is-error{color:#fbbf24}
.aim-hs-limits{margin-top:8px;font-size:11.5px;color:var(--es-dim,#6b7280)}`;
  document.head.append(css);

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let message = "";
  function render(box) {
    const on = choice(), hasFile = !!customName;
    box.innerHTML = `
<div class="aim-hs-card${on === "porphyr" ? " is-on" : ""}" data-pick="porphyr">
  <b><i>ılı</i>Porphyr</b><small>The default hit sound</small>
  <div class="aim-hs-acts"><button type="button" class="aim-hs-btn" data-play="porphyr">▶ Play</button></div>
</div>
<div class="aim-hs-card${on === "custom" && hasFile ? " is-on" : ""}" data-pick="custom">
  <b><i>ılı</i>Your own sound</b><small>Pick a short sound file from your PC</small>
  <div class="aim-hs-acts">
    <button type="button" class="aim-hs-btn${hasFile ? "" : " is-red"}" data-choose>${hasFile ? "Change…" : "Choose file…"}</button>
    ${hasFile ? `<button type="button" class="aim-hs-btn" data-play="custom">▶ Play</button>` : ""}
    <span class="aim-hs-file${message ? " is-error" : ""}">${message ? esc(message) : hasFile ? esc(customName) : "<em>No file chosen</em>"}</span>
  </div>
  <div class="aim-hs-limits">.ogg, .mp3 or .wav · up to 1 MB · longer than 2 s is cut at 2 s</div>
</div>`;
  }
  async function choose(box) {
    if (!api()) { message = "Choosing a file only works in the game window"; render(box); return; }
    let result;
    try { result = await api().pick(); } catch (error) { result = { error: error?.message || String(error) }; }
    if (!result || result.canceled) return;
    if (result.error) { message = result.error; render(box); return; }
    message = "";
    const buffer = await loadCustom(true);
    if (!buffer) { message = "This file couldn't be played; still using Porphyr"; setChoice("porphyr"); }
    else setChoice("custom");
    refreshAll();
  }
  function wire(box) {
    box.addEventListener("click", (event) => {
      const play = event.target.closest("[data-play]");
      if (play) { event.stopPropagation(); audition(play.dataset.play); return; }
      if (event.target.closest("[data-choose]")) { event.stopPropagation(); choose(box); return; }
      const card = event.target.closest("[data-pick]");
      if (!card) return;
      if (card.dataset.pick === "custom" && !customName) { choose(box); return; }
      setChoice(card.dataset.pick);
      message = "";
      refreshAll();
    });
  }
  const boxes = new Set();
  function refreshAll() { for (const box of boxes) if (box.isConnected) render(box); else boxes.delete(box); }
  function scan() {
    for (const kit of document.querySelectorAll('[data-setting="hitKit"]')) {
      if (kit.nextElementSibling?.classList.contains("aim-hs")) continue;
      const box = document.createElement("div");
      box.className = "aim-hs";
      wire(box);
      render(box);
      boxes.add(box);
      kit.after(box);
    }
    // Hit sound switched off: the game removes its own hit choices, so drop ours too.
    for (const box of document.querySelectorAll(".aim-hs")) {
      if (!box.previousElementSibling?.matches('[data-setting="hitKit"]')) { box.remove(); boxes.delete(box); }
    }
  }
  let queued = false;
  const watch = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; scan(); }); };
  if (window.__aimWatchPage) window.__aimWatchPage(watch, { childList: true, subtree: true });
  else new MutationObserver(watch).observe(document.documentElement, { childList: true, subtree: true });
  loadCustom().then(() => refreshAll());
  scan();
})();
