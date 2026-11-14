// Round timeline view: animates the last round on the results screen's Position Map.
// The map component calls mount() after each redraw with its own world-to-map projection,
// so everything drawn here lines up with the map, the route and the numbered targets.
// Only the round that just finished is shown; nothing is saved.

const SVG = 'http://www.w3.org/2000/svg';
const ACCENT = '#ff4655';
const ROUTE = 'rgb(126, 208, 245)';
const SPEEDS = [1, 2, 4, 0.5];
const CONE = 0.55;              // half-width of the facing wedge, radians
const CONE_METERS = 7;
const SHOT_FLASH_TICKS = 10;
const KILL_PULSE_SECONDS = 0.5;
const TARGET_MATCH_METERS = 2.5;

const STYLE = `
.al-tl-svg{position:absolute;inset:0;pointer-events:none;overflow:visible}
.al-tl-trail{fill:none;stroke:${ROUTE};stroke-width:calc(2.4px * var(--k,1));stroke-linecap:round;stroke-linejoin:round}
.al-tl-cone{fill:rgba(255,255,255,.14);stroke:rgba(255,255,255,.55);stroke-width:calc(1px * var(--k,1))}
.al-tl-me{fill:#fff;stroke:${ROUTE};stroke-width:calc(2.5px * var(--k,1))}
.al-tl-shot{fill:none;stroke:#ffd166;stroke-width:calc(2px * var(--k,1))}
.al-tl-foe{fill:${ACCENT};stroke:#0a0d10;stroke-width:calc(1.5px * var(--k,1))}
.al-tl-kill{stroke:${ACCENT};stroke-width:calc(2.2px * var(--k,1));stroke-linecap:round}
.al-tl-kill.is-old{stroke:rgba(255,255,255,.45)}
.al-tl-pulse{fill:none;stroke:${ACCENT}}
.al-tl-bar{display:flex;align-items:center;gap:10px;margin-top:10px;font-size:12px;font-variant-numeric:tabular-nums;color:rgba(255,255,255,.72);user-select:none}
.al-tl-btn{display:inline-flex;align-items:center;justify-content:center;height:26px;min-width:26px;padding:0 7px;border:1px solid rgba(255,255,255,.16);border-radius:3px;background:rgba(255,255,255,.04);color:#fff;font:inherit;font-weight:600;cursor:pointer}
.al-tl-btn:hover{border-color:${ACCENT}}
.al-tl-btn svg{width:10px;height:10px;fill:currentColor}
.al-tl-track{position:relative;flex:1;height:26px;display:flex;align-items:center}
.al-tl-range{width:100%;margin:0;accent-color:${ACCENT};cursor:pointer}
.al-tl-tick{position:absolute;top:1px;width:2px;height:6px;margin-left:-1px;background:${ACCENT};border-radius:1px;cursor:pointer}
.al-tl-time{min-width:84px;text-align:right}
`;

const PLAY_ICON = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 0.8v8.4L9 5z"/></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 1h2.6v8H1.5zM5.9 1h2.6v8H5.9z"/></svg>';

const node = (name, cls) => { const e = document.createElementNS(SVG, name); if (cls) e.setAttribute('class', cls); return e; };
const clock = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const lerp = (a, b, f) => a + (b - a) * f;
const lerpAngle = (a, b, f) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * f; };

// Last index with array[i] <= value (array ascending), or -1.
function floorIndex(array, value, length = array.length) {
  let lo = 0, hi = length - 1, found = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (array[mid] <= value) { found = mid; lo = mid + 1; } else hi = mid - 1; }
  return found;
}

let latest = null;
let current = null;

function receive(data) {
  if (!data || data.version !== 1) return;
  latest = data;
}

// The map's route ends where the player finished the round; so does this timeline.
function belongsTo(data, view) {
  const route = view?.route;
  if (!data || !Array.isArray(route) || !route.length) return false;
  const segment = route[route.length - 1], end = segment?.[segment.length - 1];
  if (!end) return false;
  const n = data.sampleTick.length - 1;
  return Math.hypot(data.player[n * 3] - end.x, data.player[n * 3 + 1] - end.z) < 0.75;
}

function createView(card, mapEl) {
  if (!document.getElementById('al-tl-style')) {
    const style = document.createElement('style'); style.id = 'al-tl-style'; style.textContent = STYLE; document.head.appendChild(style);
  }
  const svg = node('svg', 'al-tl-svg');
  const trail = node('polyline', 'al-tl-trail');
  const kills = node('g'), foes = node('g');
  const cone = node('polygon', 'al-tl-cone');
  const shot = node('circle', 'al-tl-shot');
  const me = node('circle', 'al-tl-me');
  svg.append(trail, kills, foes, cone, shot, me);
  // Below the numbered targets, so their numbers stay readable and clickable.
  const marks = mapEl.querySelector('.al-pm-svg');
  if (marks) mapEl.insertBefore(svg, marks); else mapEl.appendChild(svg);

  const bar = document.createElement('div');
  bar.className = 'al-tl-bar';
  bar.innerHTML = `<button type="button" class="al-tl-btn" data-act="play" aria-label="Play">${PLAY_ICON}</button>`
    + '<div class="al-tl-track"><input class="al-tl-range" type="range" min="0" max="1000" step="1" value="0" aria-label="Round time"></div>'
    + '<span class="al-tl-time"></span><button type="button" class="al-tl-btn" data-act="speed" aria-label="Playback speed">1×</button>';
  mapEl.after(bar);
  const playBtn = bar.querySelector('[data-act="play"]');
  const speedBtn = bar.querySelector('[data-act="speed"]');
  const range = bar.querySelector('.al-tl-range');
  const track = bar.querySelector('.al-tl-track');
  const timeLabel = bar.querySelector('.al-tl-time');

  const state = {
    card, mapEl, svg, bar, data: null, project: null, size: 0, k: 1,
    points: null, seconds: 0, t: 0, playing: false, speed: 1, frame: 0, last: 0,
    foePool: [], killPool: [],
  };

  const circle = (pool, parent, cls) => {
    const e = node('circle', cls); parent.appendChild(e); pool.push(e); return e;
  };

  function draw() {
    const { data, points, project } = state;
    if (!data || !points) return;
    const k = state.k, tick = data.firstTick + state.t / data.tickSeconds;
    const count = data.sampleTick.length;
    const i = Math.max(0, floorIndex(data.sampleTick, tick));
    const j = Math.min(count - 1, i + 1);
    const span = data.sampleTick[j] - data.sampleTick[i];
    const f = span > 0 ? Math.min(1, Math.max(0, (tick - data.sampleTick[i]) / span)) : 0;

    // Player
    const px = lerp(data.player[i * 3], data.player[j * 3], f);
    const pz = lerp(data.player[i * 3 + 1], data.player[j * 3 + 1], f);
    const yaw = lerpAngle(data.player[i * 3 + 2], data.player[j * 3 + 2], f);
    const at = project(px, pz);
    let trailPoints = points.slice(0, i + 1).join(' ');
    trailPoints += ` ${at.x.toFixed(1)},${at.y.toFixed(1)}`;
    trail.setAttribute('points', trailPoints);
    me.setAttribute('cx', at.x); me.setAttribute('cy', at.y); me.setAttribute('r', 5.5 * k);
    const edge = a => project(px - Math.sin(a) * CONE_METERS, pz - Math.cos(a) * CONE_METERS);
    const l = edge(yaw - CONE), r = edge(yaw + CONE);
    cone.setAttribute('points', `${at.x},${at.y} ${l.x},${l.y} ${r.x},${r.y}`);

    // Shot flash
    const s = floorIndex(data.shots, tick);
    const sinceShot = s >= 0 ? tick - data.shots[s] : Infinity;
    if (sinceShot <= SHOT_FLASH_TICKS) {
      shot.style.display = '';
      shot.setAttribute('cx', at.x); shot.setAttribute('cy', at.y);
      shot.setAttribute('r', (7 + sinceShot * 0.9) * k);
      shot.setAttribute('opacity', String(1 - sinceShot / SHOT_FLASH_TICKS));
    } else shot.style.display = 'none';

    // Enemies alive at this moment, eased toward their next sampled position.
    const a0 = data.enemyStart[i], a1 = data.enemyStart[i + 1];
    const b0 = data.enemyStart[j], b1 = data.enemyStart[j + 1];
    let used = 0;
    for (let row = a0; row < a1; row += 1) {
      const id = data.enemies[row * 3];
      let x = data.enemies[row * 3 + 1], z = data.enemies[row * 3 + 2];
      for (let other = b0; other < b1; other += 1) {
        if (data.enemies[other * 3] === id) { x = lerp(x, data.enemies[other * 3 + 1], f); z = lerp(z, data.enemies[other * 3 + 2], f); break; }
      }
      const e = state.foePool[used] ?? circle(state.foePool, foes, 'al-tl-foe');
      const p = project(x, z);
      e.style.display = '';
      e.setAttribute('cx', p.x); e.setAttribute('cy', p.y); e.setAttribute('r', 4.5 * k);
      used += 1;
    }
    for (let n = used; n < state.foePool.length; n += 1) state.foePool[n].style.display = 'none';

    // Kills so far: a cross where each enemy fell, with a short pulse when it happens.
    const killCount = data.kills.length / 4;
    let shown = 0;
    for (let n = 0; n < killCount; n += 1) {
      const kt = data.kills[n * 4];
      if (kt > tick) break;
      const x = data.kills[n * 4 + 2], z = data.kills[n * 4 + 3];
      if (!Number.isFinite(x)) continue;
      let g = state.killPool[shown];
      if (!g) {
        g = node('g'); g.append(node('line', 'al-tl-kill'), node('line', 'al-tl-kill'), node('circle', 'al-tl-pulse'));
        kills.appendChild(g); state.killPool.push(g);
      }
      const p = project(x, z), d = 4 * k, age = (tick - kt) * data.tickSeconds;
      const [l1, l2, pulse] = g.children;
      l1.setAttribute('x1', p.x - d); l1.setAttribute('y1', p.y - d); l1.setAttribute('x2', p.x + d); l1.setAttribute('y2', p.y + d);
      l2.setAttribute('x1', p.x - d); l2.setAttribute('y1', p.y + d); l2.setAttribute('x2', p.x + d); l2.setAttribute('y2', p.y - d);
      const fresh = age < KILL_PULSE_SECONDS;
      l1.classList.toggle('is-old', age > 3); l2.classList.toggle('is-old', age > 3);
      pulse.style.display = fresh ? '' : 'none';
      if (fresh) {
        const u = age / KILL_PULSE_SECONDS;
        pulse.setAttribute('cx', p.x); pulse.setAttribute('cy', p.y);
        pulse.setAttribute('r', (5 + 12 * u) * k); pulse.setAttribute('stroke-width', 2 * k * (1 - u)); pulse.setAttribute('opacity', String(1 - u));
      }
      g.style.display = '';
      shown += 1;
    }
    for (let n = shown; n < state.killPool.length; n += 1) state.killPool[n].style.display = 'none';

    range.value = String(Math.round(state.t / state.seconds * 1000));
    timeLabel.textContent = `${clock(state.t)} / ${clock(state.seconds)}`;
  }

  function loop(now) {
    if (!state.playing) return;
    if (!state.card.isConnected) { pause(); return; }
    const dt = Math.min(0.1, (now - state.last) / 1000);
    state.last = now;
    state.t = Math.min(state.seconds, state.t + dt * state.speed);
    draw();
    if (state.t >= state.seconds) { pause(); return; }
    state.frame = requestAnimationFrame(loop);
  }
  function play() {
    if (!state.data) return;
    if (state.t >= state.seconds) state.t = 0;
    state.playing = true;
    playBtn.innerHTML = PAUSE_ICON; playBtn.setAttribute('aria-label', 'Pause');
    state.last = performance.now();
    state.frame = requestAnimationFrame(loop);
  }
  function pause() {
    state.playing = false;
    cancelAnimationFrame(state.frame);
    playBtn.innerHTML = PLAY_ICON; playBtn.setAttribute('aria-label', 'Play');
  }
  function seek(seconds) {
    state.t = Math.min(state.seconds, Math.max(0, seconds));
    draw();
  }

  playBtn.addEventListener('click', () => state.playing ? pause() : play());
  speedBtn.addEventListener('click', () => {
    state.speed = SPEEDS[(SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length];
    speedBtn.textContent = `${state.speed}×`;
  });
  // Scrubbing takes over from playback.
  range.addEventListener('input', () => { pause(); seek(Number(range.value) / 1000 * state.seconds); });
  const onHidden = () => { if (document.hidden) pause(); };
  document.addEventListener('visibilitychange', onHidden);

  function setData(data) {
    if (state.data === data) return;
    pause();
    state.data = data;
    state.seconds = Math.max(0.1, (data.lastTick - data.firstTick) * data.tickSeconds);
    state.t = 0;
    for (const tick of track.querySelectorAll('.al-tl-tick')) tick.remove();
    for (let n = 0; n < data.kills.length / 4; n += 1) {
      const seconds = Math.max(0, (data.kills[n * 4] - data.firstTick) * data.tickSeconds);
      const mark = document.createElement('span');
      mark.className = 'al-tl-tick';
      mark.style.left = `${seconds / state.seconds * 100}%`;
      mark.title = `Kill at ${clock(seconds)}`;
      mark.addEventListener('click', () => { pause(); seek(Math.max(0, seconds - 1.5)); });
      track.appendChild(mark);
    }
  }

  function setMap(project, size, k) {
    state.project = project; state.size = size; state.k = k;
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.style.setProperty('--k', String(k));
    const d = state.data, n = d.sampleTick.length;
    state.points = new Array(n);
    for (let i = 0; i < n; i += 1) {
      const p = project(d.player[i * 3], d.player[i * 3 + 1]);
      state.points[i] = `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }
  }

  function show(visible) {
    svg.style.display = visible ? '' : 'none';
    bar.style.display = visible ? '' : 'none';
    // has-style-fix-v1: theme-esports.css checks this class, not the style attribute. A :has() that reads
    // [style] made every inline-style write on the page (crosshair follower, ~52/s) restyle the whole page.
    bar.classList.toggle('is-off', !visible);
    if (!visible) pause();
  }

  // Picking a target on the results screen (its tile or its number on the map) jumps the
  // replay to that enemy: 1.5 s before its kill, or the moment it first came near if it
  // wasn't killed. Matching is by position, since the map's targets carry no enemy id.
  function jumpToTarget(n) {
    const d = state.data, point = state.view?.points?.find(p => p.n === n);
    const at = point?.enemy;
    if (!d || !at) return;
    let best = -1, bestDist = TARGET_MATCH_METERS;
    for (let k = 0; k < d.kills.length / 4; k += 1) {
      const dist = Math.hypot(d.kills[k * 4 + 2] - at.x, d.kills[k * 4 + 3] - at.z);
      if (dist < bestDist) { bestDist = dist; best = k; }
    }
    for (const tick of track.querySelectorAll('.al-tl-tick')) tick.classList.remove('is-focus');
    if (best >= 0) {
      track.querySelectorAll('.al-tl-tick')[best]?.classList.add('is-focus');
      seek((d.kills[best * 4] - d.firstTick) * d.tickSeconds - 1.5);
      play();
      return;
    }
    for (let i = 0; i < d.sampleTick.length; i += 1) {
      for (let row = d.enemyStart[i]; row < d.enemyStart[i + 1]; row += 1) {
        if (Math.hypot(d.enemies[row * 3 + 1] - at.x, d.enemies[row * 3 + 2] - at.z) < TARGET_MATCH_METERS) {
          pause(); seek((d.sampleTick[i] - d.firstTick) * d.tickSeconds - 0.5); return;
        }
      }
    }
  }
  const onPick = event => {
    const tile = event.target.closest?.('.al-ps-tile[data-n]');
    // Only when the tile becomes selected; a second click just clears the selection.
    if (!tile || tile.classList.contains('is-sel') || !state.card.isConnected) return;
    jumpToTarget(Number(tile.dataset.n));
  };
  document.addEventListener('click', onPick, true);

  function dispose() { pause(); document.removeEventListener('visibilitychange', onHidden); document.removeEventListener('click', onPick, true); svg.remove(); bar.remove(); }

  return { state, setData, setMap, show, draw, dispose };
}

const view = {
  // Called by the Position Map after it draws. card: the map card element;
  // project(x, z): world position to map pixels; size: map size in pixels.
  mount(card, project, size, mapView, k = 1) {
    if (!card) return;
    const mapEl = card.querySelector('.al-pm-map');
    if (!mapEl) return;
    const data = belongsTo(latest, mapView) ? latest : null;
    if (current && current.state.card !== card) { current.dispose(); current = null; }
    if (!data) { current?.show(false); return; }
    if (getComputedStyle(mapEl).position === 'static') mapEl.style.position = 'relative';
    if (!current) current = createView(card, mapEl);
    current.setData(data);
    current.state.view = mapView;
    current.setMap(project, size, k);
    current.show(true);
    current.draw();
  },
  unmount(card) {
    if (current && (!card || current.state.card === card)) { current.dispose(); current = null; }
  },
};

// The page only; inside the game worker the sink forwards to the page instead.
if (!globalThis.__aimWorkerThread) {
  globalThis.__aimTimelineView = view;
  globalThis.__aimTimelineSink = receive;
}
