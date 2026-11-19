// wave-hud-v1 (17 Nov 2026): wave counter for Studio drills with "Bots show up: In waves".
// One chip in the style of the game's top HUD chips (.al-hud-chip: dark, red top line, small grey label, big value),
// centred just under that row, in the game's HUD layer (.al-hud):
//   label WAVE                      value 2/3     + "GROUP 1/2 · PLAY 1/2" under it when there is more than one
//   label NEXT WAVE IN 1.4 S        value 2/3     (pause before a wave; "NEXT GROUP IN 0.5 S" value 2/2 before a group)
//   label ALL WAVES                 value CLEARED (green line) when the last one is done
// Driven from snapshot.waves (sim, tools/patch-studio-waves-v6.cjs) by aim-audio/jett.mjs observe, on the main window
// in both launchers, like the Neon / Chamber HUDs. The DOM is only touched when the text changes (a few times per
// wave, 10x per second during a countdown). No filters, no per-frame layout; the pop is one short transform.
const CSS = `
.wh{position:absolute;top:100px;left:50%;display:flex;flex-direction:column;align-items:center;gap:4px;pointer-events:none;transform:translate(-50%);color:#fff;transition:opacity .25s}
.wh.is-off{opacity:0}
.wh-chip{min-width:112px;padding:9px 14px 10px;text-align:center;background:rgba(9,11,15,.82);border-top:3px solid #ff4655}
.wh-label{display:block;margin-bottom:3px;font-size:12px;color:#98a1a9;letter-spacing:.06em;text-transform:uppercase;font-stretch:75%;white-space:nowrap}
.wh-value{display:block;font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.05;letter-spacing:.02em;text-transform:uppercase}
.wh-sub{display:flex;gap:10px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;font-stretch:75%;color:#d6d9df;text-shadow:0 1px 2px #000}
.wh-sub:empty{display:none}
.wh.is-gap .wh-chip{border-top-color:#ffffff80}
.wh.is-gap .wh-label{color:#fff}
.wh.is-gap .wh-value{color:#ffffffb3}
.wh.is-done .wh-chip{border-top-color:#5dfcb0}
.wh.is-done .wh-value{color:#5dfcb0}
.wh.is-new .wh-chip{animation:wh-pop .4s ease-out}
@keyframes wh-pop{0%{transform:scale(1.15)}100%{transform:scale(1)}}
`;

// Text for one state; same input -> same text, so the DOM only changes when something visible changes.
export function waveHudText(w) {
  if (!w) return null;
  const of = (a, b) => `${a}/${b}`;
  if (w.phase === 'done') return { kind: 'done', label: 'All waves', value: 'Cleared', sub: [] };
  const sub = [];
  if (w.groups > 1) sub.push(`Group ${of(w.group, w.groups)}`);
  if (w.plays > 1) sub.push(`Play ${of(w.play, w.plays)}`);
  if (w.round > 1) sub.push(`Round ${w.round}`);
  if (w.phase === 'gap') {
    const secs = w.next > 0 ? ` in ${w.next.toFixed(1)} s` : '';
    // The next group of the same wave, or a new wave (or a new play of one).
    if (w.group > 1) return { kind: 'gap', label: `Next group${secs}`, value: of(w.group, w.groups), sub: [`Wave ${of(w.wave, w.waves)}`] };
    return { kind: 'gap', label: `${w.first ? 'First wave' : 'Next wave'}${secs}`, value: of(w.wave, w.waves), sub: w.plays > 1 ? [`Play ${of(w.play, w.plays)}`] : [] };
  }
  return { kind: 'live', label: 'Wave', value: of(w.wave, w.waves), sub };
}

export function createWaveHud() {
  if (typeof document === 'undefined' || !document.body?.appendChild) return { update() {}, hide() {}, dispose() {} };
  let root = null, labelEl = null, valueEl = null, subEl = null, last = '', lastLive = '', popTimer = 0;
  function build() {
    if (!document.querySelector('style[data-wave-hud]')) { const style = document.createElement('style'); style.textContent = CSS; style.dataset.waveHud = '1'; document.head.appendChild(style); }
    root = document.createElement('div'); root.className = 'wh is-off'; root.setAttribute('aria-hidden', 'true');
    const chip = document.createElement('div'); chip.className = 'wh-chip';
    labelEl = document.createElement('span'); labelEl.className = 'wh-label';
    valueEl = document.createElement('b'); valueEl.className = 'wh-value';
    chip.append(labelEl, valueEl);
    subEl = document.createElement('div'); subEl.className = 'wh-sub';
    root.append(chip, subEl);
  }
  return {
    update(w) {
      const t = waveHudText(w);
      if (!t) { this.hide(); return; }
      if (!root) build();
      // Live inside the game's HUD layer (the play screen covers the page body).
      if (!root.isConnected || !root.parentElement?.matches('.al-hud')) {
        const host = [...document.querySelectorAll('.al-hud')].find((e) => e.isConnected && e.getClientRects().length);
        if (!host) { root.remove(); return; }
        host.appendChild(root); last = '';
      }
      const key = `${t.kind}|${t.label}|${t.value}|${t.sub.join('|')}`;
      if (key === last) return;
      last = key;
      labelEl.textContent = t.label;
      valueEl.textContent = t.value;
      subEl.textContent = '';
      for (const s of t.sub) { const span = document.createElement('span'); span.textContent = s; subEl.append(span); }
      root.className = `wh is-${t.kind}`;
      // A short pop when a new wave / group starts.
      if (t.kind === 'live' && key !== lastLive) {
        lastLive = key;
        root.classList.add('is-new'); clearTimeout(popTimer);
        popTimer = setTimeout(() => root && root.classList.remove('is-new'), 450);
      }
    },
    hide() { if (root) { root.classList.add('is-off'); last = ''; } },
    dispose() { clearTimeout(popTimer); root?.remove(); root = null; last = ''; lastLive = ''; },
  };
}
