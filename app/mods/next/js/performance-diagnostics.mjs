// Bounded measurements only. No DOM work, extra animation loop or network here.
const FRAME_CAPACITY = 8192;
const EVENT_CAPACITY = 60;
const round = value => Math.round(value * 10) / 10;
const number = value => Number.isFinite(value) ? Math.max(0, value) : 0;
export const diagnosticFunction = value => typeof value === 'string' && /^[a-zA-Z_$][\w$]{0,63}$/.test(value) ? value : '';

// Only public asset paths are useful here. Never retain arbitrary URLs, API paths,
// query strings, user-defined names, exception messages, or payment/auth details.
export function diagnosticAsset(value) {
  try {
    const path = new URL(String(value), 'http://localhost:8000').pathname;
    if (!/^\/(?:_assets\/r\d{8}-\d+\/)?(?:next\/(?:js|css)|js|css|i18n|aim-[a-z-]+|img|fonts?|models?|maps?)\//i.test(path)) return '[redacted]';
    if (!/\.(?:m?js|css|png|jpe?g|webp|svg|gif|ktx2?|glb|gltf|bin|wasm|woff2?|mp3|ogg|wav)$/i.test(path)) return '[redacted]';
    return path.replace(/[^a-zA-Z0-9/_.-]/g, '_').slice(0, 180);
  } catch { return '[redacted]'; }
}

// Extract a public code location, never retain the raw exception message/stack.
export function diagnosticErrorLocation(stack) {
  if (typeof stack !== 'string') return {};
  const match = stack.slice(0, 12000).match(/((?:https?:\/\/|\/(?:_assets|next|js|i18n)\/)[^\s()]+):(\d+):(\d+)/);
  return match ? { script: diagnosticAsset(match[1]), line: Math.min(1e9, Number(match[2])), column: Math.min(1e9, Number(match[3])) } : {};
}

export function createPerformanceDiagnostics({ now = () => performance.now() } = {}) {
  const intervals = new Float64Array(FRAME_CAPACITY);
  const timestamps = new Float64Array(FRAME_CAPACITY);
  const events = [];
  const spans = [];
  const listeners = new Set();
  const issueListeners = new Set();
  const history = [], timeline = [];
  let phase = 'menu', work = {}, counters = {}, lastWork = {}, bucket = null;
  let cursor = 0, size = 0, previous = 0, running = false, visible = true;
  let warmUntil = 0, span = null, lastSample = 0, maxFps = 0, everyNth = 1;
  let scene = '', contextLost = false, baseline = 0, lastStall = -Infinity;
  function endSpan(at) {
    if (span) { span.end = at; span = null; }
  }
  function change(active, at) {
    if (running === active) return;
    running = active; previous = 0; baseline = 0;
    if (active) {
      warmUntil = at + 1500;
      span = { start: warmUntil, end: Infinity, scene };
      spans.push(span); if (spans.length > 32) spans.shift();
    } else endSpan(at);
    for (const listener of listeners) { try { listener(active); } catch { /* Diagnostics cannot stop gameplay. */ } }
  }
  function eligible(at, duration = 0) {
    return spans.some(item => at >= item.start && at + duration <= item.end);
  }
  function recordWork(stage, duration, at = now(), count = 1, extra = {}) {
    if (!running || at < warmUntil || !['tick', 'render', 'hud'].includes(stage)) return;
    const ms = Math.min(number(duration), 60000);
    const item = work[stage] ||= { count: 0, totalMs: 0, worstMs: 0 };
    item.count++; item.totalMs += ms; item.worstMs = Math.max(item.worstMs, ms);
    lastWork[stage] = round(ms);
    const second = Math.floor(at / 1000);
    if (!bucket || bucket.second !== second) {
      bucket = { second, scene, frames: 0, worstMs: 0, tickMs: 0, renderMs: 0, hudMs: 0, ticks: 0, hudCallbacks: 0, gpuBackpressure: 0 };
      timeline.push(bucket); if (timeline.length > 60) timeline.shift();
    }
    bucket[`${stage}Ms`] = round(bucket[`${stage}Ms`] + ms);
    if (stage === 'tick') bucket.ticks += number(count);
    if (stage === 'hud') bucket.hudCallbacks += number(count);
    if (stage === 'render') {
      bucket.frames++; bucket.gpuBackpressure += number(extra.gpuWaits);
      for (const key of ['programs', 'textures', 'geometries', 'calls', 'triangles']) counters[key] = number(extra[key]);
    }
  }
  function recordFrame(at, active, cap = 0, nth = 1) {
    if (!Number.isFinite(at)) return;
    maxFps = number(cap); everyNth = Math.max(1, number(nth));
    change(Boolean(active) && visible, at);
    if (!running || at < warmUntil) { previous = 0; return; }
    if (previous > 0 && at > previous) {
      const interval = at - previous;
      intervals[cursor] = interval; timestamps[cursor] = at;
      cursor = (cursor + 1) % FRAME_CAPACITY; size = Math.min(size + 1, FRAME_CAPACITY);
      lastSample = at;
      if (bucket) bucket.worstMs = Math.max(bucket.worstMs, round(interval));
      if (baseline && interval > Math.max(12, baseline * 2.5) && at - lastStall >= 1000) {
        record('frame-stall', { duration: interval, work: lastWork }, previous); lastStall = at;
      }
      baseline = baseline ? baseline * .98 + Math.min(interval, baseline * 2) * .02 : interval;
    }
    previous = at;
  }
  function record(kind, details = {}, at = now()) {
    if (!visible || !Number.isFinite(at)) return;
    const allowed = ['frame-stall', 'long-task', 'long-frame', 'input-delay', 'asset', 'javascript', 'context-lost', 'context-restored'];
    if (!allowed.includes(kind)) return;
    const duration = Math.min(number(details.duration), 60000);
    // Browser performance entries may be delivered after a pause. Classify using
    // their timestamps, not the phase at observer callback delivery time.
    const gameplay = eligible(at, duration);
    if (['long-task', 'long-frame', 'input-delay'].includes(kind) && ((!gameplay && !details.includeOutside) || duration < 50)) return;
    const asset = diagnosticAsset(details.asset || '');
    const script = diagnosticAsset(details.script || '');
    const error = ['Error', 'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'NetworkError', 'SecurityError'].includes(details.error) ? details.error : 'Error';
    const eventScene = spans.find(item => at >= item.start && at <= item.end)?.scene || scene;
    const scripts = (Array.isArray(details.scripts) ? details.scripts : []).slice(0, 5).map(item => ({
      script: diagnosticAsset(item.script), fn: diagnosticFunction(item.fn), line: Math.floor(number(item.line)), column: Math.floor(number(item.column)), sourceOffset: Math.floor(number(item.sourceOffset)),
      duration: round(number(item.duration)), forcedLayoutMs: round(number(item.forcedLayoutMs)),
    }));
    const item = { kind, at: round(at), duration: round(duration), gameplay, scene: eventScene,
      phase: gameplay ? 'gameplay' : phase, asset, script,
      status: Math.min(599, Math.floor(number(details.status))), line: Math.floor(number(details.line)),
      column: Math.floor(number(details.column)), sourceOffset: Math.floor(number(details.sourceOffset)), fn: diagnosticFunction(details.fn),
      error: kind === 'javascript' ? error : '', layout: round(Math.min(number(details.layout), duration)),
      handler: round(Math.min(number(details.handler), duration)), count: 1 };
    if (kind === 'long-frame') Object.assign(item, { scripts, scriptMs: round(number(details.scriptMs)),
      styleLayoutMs: round(number(details.styleLayoutMs)), renderPhaseMs: round(number(details.renderPhaseMs)), blockingMs: round(number(details.blockingMs)) });
    if (kind === 'input-delay') Object.assign(item, { queueMs: round(number(details.queueMs)), presentationMs: round(number(details.presentationMs)) });
    if (kind === 'frame-stall') item.work = Object.fromEntries(['tick', 'render', 'hud'].map(key => [key, round(number(details.work?.[key]))]));
    const previousEvent = events.at(-1);
    if (previousEvent && ['asset', 'javascript'].includes(kind) && previousEvent.kind === kind && previousEvent.asset === asset && previousEvent.script === script && previousEvent.status === item.status && previousEvent.line === item.line && previousEvent.error === item.error && previousEvent.gameplay === gameplay && at - previousEvent.at < 10000) {
      previousEvent.count = Math.min(9999, previousEvent.count + 1);
      previousEvent.at = round(at);
    } else { events.push(item); if (events.length > EVENT_CAPACITY) events.shift(); }
    if (kind === 'context-lost') contextLost = true;
    if (kind === 'context-restored') contextLost = false;
    if (gameplay && ['frame-stall', 'javascript', 'context-lost', 'long-task', 'input-delay'].includes(kind)) {
      for (const listener of issueListeners) { try { listener(kind); } catch { /* Never break the game. */ } }
    }
  }
  function snapshot() {
    const samples = [];
    for (let i = 0; i < size; i++) {
      const index = (cursor - size + i + FRAME_CAPACITY) % FRAME_CAPACITY;
      if (timestamps[index] >= lastSample - 15000) samples.push(intervals[index]);
    }
    samples.sort((a, b) => a - b);
    const total = samples.reduce((a, b) => a + b, 0);
    const percentile = p => samples.length ? samples[Math.min(samples.length - 1, Math.ceil(p * samples.length) - 1)] : 0;
    const typical = percentile(.5), p99 = percentile(.99);
    const slowThreshold = Math.max(12, typical * 2.5);
    const slow = samples.filter(ms => ms > slowThreshold).length;
    const ready = samples.length >= 30 && total >= 2000;
    return { running, scene, contextLost, ready, maxFps, everyNth, frames: samples.length,
      sampledSeconds: round(total / 1000), lastSampleMs: round(lastSample),
      fps: total ? round(samples.length * 1000 / total) : 0,
      onePercentLow: p99 ? round(1000 / p99) : 0, p99Ms: round(p99), typicalMs: round(typical),
      worstMs: round(samples.at(-1) || 0), slow, slowThresholdMs: round(slowThreshold),
      // Drop is relative to this run's typical frame, not a fixed 60/144/240 target.
      dropped: ready && slow >= 2,
      work: Object.fromEntries(Object.entries(work).map(([key, value]) => [key, { count: value.count,
        totalMs: round(value.totalMs), meanMs: round(value.totalMs / value.count), worstMs: round(value.worstMs) }])),
      counters: { ...counters }, timeline: timeline.map(item => ({ ...item })),
      history: history.map(item => structuredClone(item)),
      events: events.map(item => structuredClone(item)) };
  }
  function archive() {
    const data = snapshot();
    if (!data.frames) return;
    delete data.history; delete data.events; delete data.timeline;
    history.push(data); if (history.length > 6) history.shift();
  }
  return Object.freeze({ recordFrame, record, recordWork, snapshot,
    stop(at = now()) { change(false, at); },
    setPhase(value) { if (['menu', 'gameplay', 'paused', 'result'].includes(value)) phase = value; },
    setVisible(value, at = now()) { visible = Boolean(value); if (!visible) change(false, at); previous = 0; },
    setScene(value) {
      // Stable public scene identifiers only; never collect author/player names.
      const next = typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(value) ? value : '';
      if (scene !== next) {
        archive(); change(false, now()); scene = next; size = 0; cursor = 0; lastSample = 0; previous = 0; baseline = 0;
        work = {}; counters = {}; lastWork = {}; bucket = null;
      }
    },
    onPhase(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    onIssue(listener) { issueListeners.add(listener); return () => issueListeners.delete(listener); },
    clear() { events.length = 0; history.length = 0; timeline.length = 0; work = {}; counters = {}; lastWork = {}; bucket = null; size = 0; cursor = 0; lastSample = 0; previous = 0; baseline = 0; }
  });
}

export const performanceDiagnostics = createPerformanceDiagnostics();
// open-aim: also report each drawn frame to the app's FPS meter (lobby-bar.js). With
// "No frame limit" the game draws on its own loop, so requestAnimationFrame only
// shows the monitor's refresh rate.
export function recordGameFrame(at, running, cap, nth) { performanceDiagnostics.recordFrame(at, running, cap, nth); }
export function stopGameFrames() { performanceDiagnostics.stop(); }
// open-aim: also report the CPU time of each frame (simulation ticks and drawing) to
// the FPS meter, so it can tell CPU-bound frames from GPU-bound ones.
export function recordGameWork(at, tickMs, renderMs, ticks, gpuWaits, counters) {
  performanceDiagnostics.recordWork('tick', tickMs, at, ticks);
  performanceDiagnostics.recordWork('render', renderMs, at, 1, { ...counters, gpuWaits });
  // open-aim test copy: the same numbers for the slow-frame recorder (frame-log.js).
  globalThis.__aimFrameWork?.(tickMs, renderMs, gpuWaits, counters);
}
export function recordHudWork(at, duration, count) { performanceDiagnostics.recordWork('hud', duration, at, count); }
