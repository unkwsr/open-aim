// Neon (Sprinter) first-person sounds, driven by the sim snapshot's `neon` state (mods/local/neon-kit.mjs).
// Samples: aim-audio/neon/*.wav from previews/neon/import-neon-audio.py (event-linked FModel media).
// Wwise mixing is not supplied: variant choice, levels and fades below are trainer approximations.
//   E cast            Play_Sprinter_AbilE_Cast        when High Gear comes out
//   bar loop          Play_Sprinter_Bar_Loop          while the sprint boost is on (both takes layered)
//   slide             Play_Sprinter_Slide             base + whoosh + concrete surface + skid; faded at slide end
//   in-air whoosh     Play_Sprinter_InAir_Loop        jump while High Gear is out
//   jump / land       Play_FS_Mvt_Sprinter_S0_*       every jump / landing
//   run / sprint      Play_FS_Mvt_Sprinter_S0_*       foley on each step (same step clock as the game's footsteps)
const GROUPS = { equip: 1, bar: 2, air: 5, slide: 7, 'slide-whoosh': 6, 'slide-skid': 3, 'slide-concrete': 4, jump: 3, land: 3, run: 8, sprint: 8 };
export const NEON_AUDIO_FILES = Object.entries(GROUPS).flatMap(([name, n]) => n === 1 ? [name] : Array.from({ length: n }, (_, i) => `${name}-${i + 1}`));
// Step clock: the game's own footstep generator (accumulate while speed >= 0.6 x run speed, one step per 0.29 s).
const RUN_SPEED = 5.4, STEP_SECONDS = .29, STEP_FROM = .6 * RUN_SPEED, TICK = 1 / 128;
const LEVEL = { equip: .38, bar1: .16, bar2: .07, slide: .3, whoosh: .26, concrete: .24, skid: .14, air: .26, jump: .24, land: .3, run: .16, sprint: .2 };

const bytes = new Map(), contexts = new WeakMap();
function cache(context) { let v = contexts.get(context); if (!v) { v = { buffers: null, pending: null }; contexts.set(context, v); } return v; }
export function warmNeonAudio(context) {
  const value = cache(context); if (value.buffers) return Promise.resolve(value.buffers);
  if (!value.pending) value.pending = Promise.all(NEON_AUDIO_FILES.map(async name => {
    if (!bytes.has(name)) bytes.set(name, fetch('/aim-audio/neon/' + name + '.wav').then(r => { if (!r.ok) throw Error('Neon audio ' + r.status); return r.arrayBuffer(); }).catch(e => { bytes.delete(name); throw e; }));
    return [name, await context.decodeAudioData((await bytes.get(name)).slice(0))];
  })).then(entries => value.buffers = Object.fromEntries(entries)).catch(e => { value.pending = null; throw e; });
  return value.pending;
}
const picked = () => { try { return globalThis.localStorage?.getItem('aim-agent') === 'neon'; } catch { return false; } };

export function createNeonAudio({ ensure, settings }) {
  const voices = new Set(), loops = new Map(), last = {}, played = {};
  let prev = null, stepClock = 0, lastTick = -1, disposed = false;
  const enabled = () => { const s = settings(); return s.enabled !== false && s.volume > 0; };
  const pick = group => { const n = GROUPS[group]; if (n === 1) return group; let i = Math.floor(Math.random() * n); if (n > 1 && i === last[group]) i = (i + 1) % n; last[group] = i; return `${group}-${i + 1}`; };
  function play(name, level, loopKey = null) {
    if (disposed || !enabled()) return null; const audio = ensure(); if (!audio || audio.context.state === 'closed') return null;
    const buffers = cache(audio.context).buffers; if (!buffers) { warmNeonAudio(audio.context).catch(() => {}); return null; }
    const buffer = buffers[name]; if (!buffer) return null;
    while ([...voices].filter(v => !v.loopKey).length >= 12) [...voices].find(v => !v.loopKey).finish(true);
    const ctx = audio.context, source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = buffer; source.loop = !!loopKey; gain.gain.value = level; source.connect(gain); gain.connect(audio.master);
    const voice = { name, loopKey, fading: false,
      finish(stop = false) { if (!voices.delete(voice)) return; source.onended = null; if (stop) try { source.stop(); } catch {} source.disconnect(); gain.disconnect(); if (loopKey && loops.get(loopKey) === voice) loops.delete(loopKey); },
      fade(seconds) { if (voice.fading) return; voice.fading = true; const t = ctx.currentTime; gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(0, t + seconds); try { source.stop(t + seconds + .02); } catch {} if (loopKey && loops.get(loopKey) === voice) loops.delete(loopKey); } };
    voices.add(voice); if (loopKey) loops.set(loopKey, voice); source.onended = () => voice.finish(); source.start(ctx.currentTime); played[name] = (played[name] ?? 0) + 1; return voice;
  }
  const one = (group, level, tag) => { const v = play(pick(group), level); if (v && tag) v.tag = tag; return v; };
  const loop = (key, name, level) => loops.get(key) ?? play(name, level, key);
  const stopLoop = (key, seconds = .25) => loops.get(key)?.fade(seconds);
  function clear(reset = true) { for (const v of [...voices]) v.finish(true); loops.clear(); if (reset) { prev = null; stepClock = 0; lastTick = -1; } }
  const hide = () => { if (document.hidden) clear(false); };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', hide);
  return {
    warm() { if (disposed || !enabled() || !picked()) return Promise.resolve(); const a = ensure(); return a ? warmNeonAudio(a.context) : Promise.resolve(); },
    phase(phase) { if (phase !== 'running' || !enabled()) clear(false); },
    observe(snapshot) {
      if (disposed) return;
      const n = snapshot.neon, p = snapshot.player;
      if (!n || p?.health !== undefined && p.health <= 0) { if (voices.size) clear(); prev = null; return; }
      if (snapshot.tick < lastTick) clear();
      const dt = lastTick < 0 ? TICK : Math.max(0, snapshot.tick - lastTick) * TICK; lastTick = snapshot.tick;
      if (!enabled()) { clear(false); return; }
      if (prev) {
        if (n.equipAt !== null && n.equipAt !== prev.equipAt) one('equip', LEVEL.equip);
        if (n.sliding && !prev.sliding) {
          one('slide', LEVEL.slide, 'slide'); one('slide-whoosh', LEVEL.whoosh, 'slide'); one('slide-concrete', LEVEL.concrete, 'slide'); one('slide-skid', LEVEL.skid, 'slide');
        }
        // Stop_Sprinter_Slide: the slide layers fade when the slide ends.
        if (!n.sliding && prev.sliding) for (const v of voices) if (v.tag === 'slide') v.fade(.2);
        // Leaving / touching the ground (jumpAt/landAt can shift by a tick, so use the airborne flag).
        if (n.airborne && !prev.airborne && !n.sliding) { one('jump', LEVEL.jump); if (n.highGear) one('air', LEVEL.air, 'air'); }
        // Stop_Sprinter_InAir_Loop on landing (FXC_Sprinter_E_SprintJumpAudio).
        if (!n.airborne && prev.airborne) { one('land', LEVEL.land); for (const v of voices) if (v.tag === 'air') v.fade(.1); }
      }
      // Bar loop sits on Buff_Sprinter_E_Sprint_SpeedBoost: it starts when the sprint does (after the 0.6 s equip).
      if (n.sprinting) { loop('bar1', 'bar-1', LEVEL.bar1); loop('bar2', 'bar-2', LEVEL.bar2); } else { stopLoop('bar1'); stopLoop('bar2'); }
      // Step foley on the game's footstep clock, only on the ground, not sliding or crouched.
      const speed = Math.hypot(p?.velocity?.x ?? 0, p?.velocity?.y ?? 0);
      if (!n.airborne && !n.sliding && !n.crouching && speed >= STEP_FROM) {
        stepClock += dt;
        if (stepClock >= STEP_SECONDS) { stepClock -= STEP_SECONDS; one(n.sprinting ? 'sprint' : 'run', n.sprinting ? LEVEL.sprint : LEVEL.run); }
      } else stepClock = Math.max(0, stepClock - dt);
      prev = { equipAt: n.equipAt, sliding: n.sliding, airborne: n.airborne };
    },
    clear,
    dispose() { if (disposed) return; disposed = true; clear(); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', hide); },
    stats: () => ({ activeVoices: voices.size, loops: loops.size, disposed, played: { ...played } }),
  };
}
