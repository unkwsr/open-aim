// Neon ability HUD (High Gear on E), styled like Jett's JettAbilityHud (same sizes and colours).
// Driven from the sim snapshot's `neon` state on the main window (called by aim-audio/jett.mjs observe,
// which runs there in both launchers). Icon: Characters/Sprinter/AbilityIcons/TX__Neon_Sprint when
// exported to /local/neon-icons/sprint.png, otherwise a drawn placeholder.
const CSS = `
.nh{--u:clamp(.6px,.052vw,1.5px);position:absolute;bottom:calc(22*var(--u));left:50%;display:flex;gap:calc(16*var(--u));pointer-events:none;transform:translate(-50%)}
.nh-slot{position:relative;display:flex;flex-direction:column;gap:calc(5*var(--u));align-items:center;width:calc(64*var(--u))}
.nh-ico{position:relative;display:grid;place-items:center;width:calc(64*var(--u));height:calc(64*var(--u));background:#0c121894;box-shadow:inset 0 0 0 max(1px,var(--u)) #fff3;transition:box-shadow .15s}
.nh-ico img{width:calc(44*var(--u));height:calc(44*var(--u))}
.nh-ring{position:absolute;top:calc(-4*var(--u));left:calc(-4*var(--u));box-sizing:border-box;width:calc(72*var(--u));height:calc(72*var(--u));padding:calc(3*var(--u));background:conic-gradient(#d6ecff calc(var(--p,0)*1turn),transparent 0);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
.nh-pips{display:flex;gap:calc(4*var(--u));height:calc(4*var(--u))}
.nh-pips i{width:calc(12*var(--u));background:#fff}
.nh-pips i.off{background:#ffffff38}
.nh-key{padding:calc(3*var(--u)) calc(7*var(--u));font-family:Chakra Petch,Noto Sans SC,sans-serif!important;font-size:calc(15*var(--u));font-weight:600;line-height:1;color:#fff;background:#0c12189e}
.nh-slot.is-priming .nh-ico{box-shadow:inset 0 0 0 max(1px,var(--u)) #d6ecffb3}
.nh-slot.is-active .nh-ico{box-shadow:inset 0 0 0 calc(2*var(--u)) #d6ecff,0 0 calc(18*var(--u)) #8ebcdebf}
`;
const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 3 8 18h7l-2 11 11-16h-7z"/></svg>');
const EQUIP_SECONDS = .6, TICK = 1 / 128;

// The player's High Gear binding, shown under the slot like Jett's. Read from the saved keybinds
// (localStorage "al-keybinds-v1", written by the settings store on every rebind; a save from before the
// High Gear row has no entry and gets the default E), else what the settings code last published.
function keyLabel() {
  let binds = null;
  try { const saved = JSON.parse(localStorage.getItem('al-keybinds-v1') ?? 'null'); if (saved && typeof saved === 'object') binds = Array.isArray(saved.highGear) ? saved.highGear : ['KeyE', null]; } catch {}
  binds ??= globalThis.__aimKeybinds?.highGear ?? ['KeyE', null];
  const code = binds.find(k => typeof k === 'string');
  if (!code) return '-';
  const names = { Mouse0: 'M1', Mouse1: 'M3', Mouse2: 'M2', Mouse3: 'M4', Mouse4: 'M5', WheelUp: 'WHL↑', WheelDown: 'WHL↓', Space: 'SPACE', ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT', ControlLeft: 'CTRL', ControlRight: 'CTRL', AltLeft: 'ALT', AltRight: 'ALT', Tab: 'TAB', CapsLock: 'CAPS' };
  return names[code] ?? code.replace(/^Key|^Digit|^Numpad/, '').toUpperCase();
}

export function createNeonHud() {
  if (typeof document === 'undefined' || !document.body?.appendChild) return { update() {}, hide() {}, dispose() {} };
  let root = null, slot = null, ring = null, pip = null, key = null, last = '', label = null, labelAt = -Infinity;
  function build() {
    const style = document.createElement('style'); style.textContent = CSS; style.dataset.neonHud = '1'; document.head.appendChild(style);
    root = document.createElement('div'); root.className = 'nh'; root.setAttribute('aria-hidden', 'true'); root.style.display = 'none';
    slot = document.createElement('div'); slot.className = 'nh-slot'; slot.title = 'High Gear';
    ring = document.createElement('div'); ring.className = 'nh-ring';
    const ico = document.createElement('div'); ico.className = 'nh-ico';
    const img = document.createElement('img'); img.alt = 'High Gear'; img.src = '/local/neon-icons/sprint.png'; img.onerror = () => { img.onerror = null; img.src = PLACEHOLDER; };
    ico.appendChild(img);
    const pips = document.createElement('div'); pips.className = 'nh-pips'; pip = document.createElement('i'); pips.appendChild(pip);
    key = document.createElement('div'); key.className = 'nh-key';
    slot.append(ring, ico, pips, key); root.appendChild(slot);
  }
  return {
    // n: snapshot.neon, tick: snapshot.tick.
    update(n, tick) {
      if (!n) { this.hide(); return; }
      if (!root) build();
      // Live inside the game's HUD layer (.al-hud, where Jett's slots are): the play screen is a
      // full-window layer (z-index 2100) that covers anything on the page body.
      if (!root.isConnected || !root.parentElement?.matches('.al-hud')) {
        const host = [...document.querySelectorAll('.al-hud')].find(e => e.isConnected && e.getClientRects().length);
        if (!host) { root.remove(); return; }
        host.appendChild(root); last = '';
      }
      const priming = n.highGear && !n.sprinting;
      const p = priming && n.equipAt !== null ? Math.min(1, Math.max(0, (tick * TICK - n.equipAt) / EQUIP_SECONDS)) : 0;
      // One pip = the slide (unlimited here, used up only while sliding).
      // Re-read the binding about 4 times a second, so a rebind (even from the pause menu) shows up.
      if (label === null || Math.abs(tick - labelAt) >= 32) { label = keyLabel(); labelAt = tick; }
      const state = [priming, n.sprinting, n.sliding, p.toFixed(2), label].join('|');
      root.style.display = '';
      if (state === last) return; last = state;
      slot.classList.toggle('is-priming', priming); slot.classList.toggle('is-active', n.sprinting);
      ring.style.setProperty('--p', p.toFixed(3)); ring.style.display = priming ? '' : 'none';
      pip.classList.toggle('off', n.sliding);
      key.textContent = label;
    },
    hide() { if (root) root.style.display = 'none'; last = ''; label = null; labelAt = -Infinity; },
    dispose() { root?.remove(); document.head.querySelector('style[data-neon-hud]')?.remove(); root = null; },
  };
}
