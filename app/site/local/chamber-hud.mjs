// Chamber ability HUD (13 Nov 2026): Headhunter and Tour de Force slots, styled like Neon's / Jett's
// (same sizes and colours). Driven from the sim snapshot's `chamber` state on the main window (called by
// aim-audio/jett.mjs observe, which runs there in both launchers). Icons: /local/chamber-icons/*.png
// (white on transparent, from the player). Keys shown are Chamber's own Headhunter / Tour de Force
// bindings (Settings > Controls > Chamber, default Q / X).
const CSS = `
.chh{--u:clamp(.6px,.052vw,1.5px);position:absolute;bottom:calc(22*var(--u));left:50%;display:flex;gap:calc(16*var(--u));pointer-events:none;transform:translate(-50%)}
.chh-slot{position:relative;display:flex;flex-direction:column;gap:calc(5*var(--u));align-items:center;width:calc(64*var(--u))}
.chh-ico{position:relative;display:grid;place-items:center;width:calc(64*var(--u));height:calc(64*var(--u));background:#0c121894;box-shadow:inset 0 0 0 max(1px,var(--u)) #fff3;transition:box-shadow .15s}
.chh-ico img{width:calc(44*var(--u));height:calc(44*var(--u));opacity:.9}
.chh-key{padding:calc(3*var(--u)) calc(7*var(--u));font-family:Chakra Petch,Noto Sans SC,sans-serif!important;font-size:calc(15*var(--u));font-weight:600;line-height:1;color:#fff;background:#0c12189e}
.chh-slot.is-active .chh-ico{box-shadow:inset 0 0 0 calc(2*var(--u)) #ffd98a,0 0 calc(18*var(--u)) #e6b25cbf}
.chh-slot.is-active .chh-ico img{opacity:1}
`;
const SLOTS = [
  { weapon: 'headhunter', name: 'Headhunter', bind: 'headhunter', fallback: 'KeyQ' },
  { weapon: 'tourdeforce', name: 'Tour de Force', bind: 'tourdeforce', fallback: 'KeyX' },
];

function keyLabel(bind, fallback) {
  let binds = null;
  try { const saved = JSON.parse(localStorage.getItem('al-keybinds-v1') ?? 'null'); if (saved && typeof saved === 'object') binds = Array.isArray(saved[bind]) ? saved[bind] : [fallback, null]; } catch {}
  binds ??= globalThis.__aimKeybinds?.[bind] ?? [fallback, null];
  const code = binds.find(k => typeof k === 'string');
  if (!code) return '-';
  const names = { Mouse0: 'M1', Mouse1: 'M3', Mouse2: 'M2', Mouse3: 'M4', Mouse4: 'M5', WheelUp: 'WHL↑', WheelDown: 'WHL↓', Space: 'SPACE', ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT', ControlLeft: 'CTRL', ControlRight: 'CTRL', AltLeft: 'ALT', AltRight: 'ALT', Tab: 'TAB', CapsLock: 'CAPS' };
  return names[code] ?? code.replace(/^Key|^Digit|^Numpad/, '').toUpperCase();
}

export function createChamberHud() {
  if (typeof document === 'undefined' || !document.body?.appendChild) return { update() {}, hide() {}, dispose() {} };
  let root = null, slots = [], last = '', labels = null, labelAt = -Infinity;
  function build() {
    const style = document.createElement('style'); style.textContent = CSS; style.dataset.chamberHud = '1'; document.head.appendChild(style);
    root = document.createElement('div'); root.className = 'chh'; root.setAttribute('aria-hidden', 'true'); root.style.display = 'none';
    slots = SLOTS.map(s => {
      const slot = document.createElement('div'); slot.className = 'chh-slot'; slot.title = s.name;
      const ico = document.createElement('div'); ico.className = 'chh-ico';
      const img = document.createElement('img'); img.alt = s.name; img.src = `/local/chamber-icons/${s.weapon}.png`; img.draggable = false;
      ico.appendChild(img);
      const key = document.createElement('div'); key.className = 'chh-key';
      slot.append(ico, key); root.appendChild(slot);
      return { slot, key, weapon: s.weapon };
    });
  }
  return {
    // c: snapshot.chamber ({active: weapon id or null}), tick: snapshot.tick.
    update(c, tick) {
      if (!c) { this.hide(); return; }
      if (!root) build();
      // Live inside the game's HUD layer (.al-hud), like Jett's and Neon's slots.
      if (!root.isConnected || !root.parentElement?.matches('.al-hud')) {
        const host = [...document.querySelectorAll('.al-hud')].find(e => e.isConnected && e.getClientRects().length);
        if (!host) { root.remove(); return; }
        host.appendChild(root); last = '';
      }
      // Re-read the bindings about 4 times a second, so a rebind shows up.
      if (labels === null || Math.abs(tick - labelAt) >= 32) { labels = SLOTS.map(s => keyLabel(s.bind, s.fallback)); labelAt = tick; }
      const state = [c.active ?? '', ...labels].join('|');
      root.style.display = '';
      if (state === last) return; last = state;
      slots.forEach((s, i) => { s.slot.classList.toggle('is-active', c.active === s.weapon); s.key.textContent = labels[i]; });
    },
    hide() { if (root) root.style.display = 'none'; last = ''; labels = null; labelAt = -Infinity; },
    dispose() { root?.remove(); document.head.querySelector('style[data-chamber-hud]')?.remove(); root = null; },
  };
}
