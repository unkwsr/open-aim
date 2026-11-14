// Slow-frame recorder (test copy). Every round writes test-data/frame-logs/<time>.json:
// each game render slower than 1000/150 ms and its likely cause, from the game's own
// numbers for that frame (performance-diagnostics.mjs calls __aimFrameWork):
//   shader  - new shader programs were built
//   upload  - new textures or meshes were sent to the graphics card
//   gpu     - the frame waited for the graphics card to finish earlier frames
//   sim / render - the game's own simulation or draw calls took most of the time
//   outside - the game's work was short; the time went to the browser or system
// plus browser stalls of 50 ms or more with the scripts that ran (long-animation-frame).
// Fed by frame-meter.js on every completed game render.
(() => {
  if (window.__aimFrameLog) return;
  const SLOW_MS = 1000 / 150;
  const REFRESH_MS = 1000 / 240;
  const HISTOGRAM_BUCKETS = 500;
  const MAX_SLOW_FRAMES = 3000;
  let round = null;
  let previousRenderAt = 0;
  let lastFrameAt = 0;
  let pendingWork = null;
  let previousCounters = null;
  const stalls = [];

  // What the player was doing, and the real draw calls of each frame (renderer.info only
  // counts the last pass). Cheap counters only; summarised per second and per activity.
  const MOVE_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD"]);
  const SWITCH_KEYS = new Set(["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "KeyQ", "KeyE", "KeyX", "KeyC"]);
  const heldKeys = new Set();
  let firing = false, aiming = false, lookMovement = 0, switchedAt = -1e9, draws = 0, drill = "";

  // Gameplay events and a per-frame record, so a report can say what each event costs on the
  // frames right after it. Fixed arrays: nothing is allocated per frame.
  const MAX_FRAMES = 150000;
  const frameAt = new Float64Array(MAX_FRAMES), frameMs = new Float32Array(MAX_FRAMES), frameTick = new Float32Array(MAX_FRAMES), frameRender = new Float32Array(MAX_FRAMES), frameNewResources = new Uint16Array(MAX_FRAMES);
  let frameCount = 0;
  const events = [];
  const mark = (kind) => { if (round && events.length < 20000) events.push({ kind, at: performance.now() }); };
  window.__aimFrameEvent = mark;
  // Animation-frame callbacks requested during a round, with who asked. A running loop adds about 8 ms of screen delay.
  const nativeRequestAnimationFrame = window.requestAnimationFrame;
  if (nativeRequestAnimationFrame) {
    window.requestAnimationFrame = function (callback) {
      if (round) {
        round.raf = (round.raf || 0) + 1;
        const callerCounts = (round.rafSources ||= {});
        if (Object.keys(callerCounts).length < 12 && round.raf <= 2000) {
          const stackLine = (new Error().stack || "").split("\n")[2] || "?";
          const caller = stackLine.trim().replace(location.origin, "").slice(0, 90);
          callerCounts[caller] = (callerCounts[caller] || 0) + 1;
        }
      }
      return nativeRequestAnimationFrame.call(window, callback);
    };
  }
  function wrapEventHooks() {
    const originalShot = window.__aimShot;
    if (originalShot && !originalShot.__marked) {
      const wrapped = (shot) => {
        mark("shot");
        if (shot?.hitActorId != null || shot?.pellets?.some((pellet) => pellet.hitActorId != null)) mark("hit");
        return originalShot(shot);
      };
      wrapped.__marked = true;
      window.__aimShot = wrapped;
    }
    const localAudio = window.__aimLocalAudio;
    if (localAudio?.playSkinKill && !localAudio.playSkinKill.__marked) {
      const originalKill = localAudio.playSkinKill;
      localAudio.playSkinKill = (...args) => { mark("kill"); return originalKill(...args); };
      localAudio.playSkinKill.__marked = true;
    }
  }
  // Frame cost by time after each kind of event, with frames far from any event as the baseline.
  function eventImpact() {
    const afterEventWindows = [[0, 50], [50, 150], [150, 400]];
    const summarize = (frameIndexes) => {
      const total = frameIndexes.length;
      if (!total) return { frames: 0 };
      let msSum = 0, tickSum = 0, renderSum = 0, over8Count = 0, createdSum = 0;
      for (const frame of frameIndexes) { msSum += frameMs[frame]; tickSum += frameTick[frame]; renderSum += frameRender[frame]; if (frameMs[frame] >= 8) over8Count++; createdSum += frameNewResources[frame]; }
      return { frames: total, ms: +(msSum / total).toFixed(2), over8Pct: +((100 * over8Count) / total).toFixed(2), tick: +(tickSum / total).toFixed(2), render: +(renderSum / total).toFixed(2), createdPer100: +((100 * createdSum) / total).toFixed(1) };
    };
    const sortedEvents = [...events].sort((first, second) => first.at - second.at);
    const impact = { counts: {} };
    const nearEvent = new Uint8Array(frameCount);
    for (const kind of new Set(sortedEvents.map((event) => event.kind))) {
      const eventsOfKind = sortedEvents.filter((event) => event.kind === kind);
      impact.counts[kind] = eventsOfKind.length;
      impact[kind] = {};
      for (const [windowStart, windowEnd] of afterEventWindows) {
        const framesInWindow = [];
        let firstFrame = 0;
        for (const event of eventsOfKind) {
          while (firstFrame < frameCount && frameAt[firstFrame] < event.at + windowStart) firstFrame++;
          for (let frame = firstFrame; frame < frameCount && frameAt[frame] < event.at + windowEnd; frame++) framesInWindow.push(frame);
        }
        impact[kind][`${windowStart}-${windowEnd}ms`] = summarize(framesInWindow);
      }
      let firstFrame = 0;
      for (const event of eventsOfKind) {
        while (firstFrame < frameCount && frameAt[firstFrame] < event.at - 100) firstFrame++;
        for (let frame = firstFrame; frame < frameCount && frameAt[frame] < event.at + 500; frame++) nearEvent[frame] = 1;
      }
    }
    const quietFrames = [];
    for (let frame = 0; frame < frameCount; frame++) if (!nearEvent[frame]) quietFrames.push(frame);
    impact.baseline = summarize(quietFrames);
    return impact;
  }
  const listenerOptions = { capture: true, passive: true };
  addEventListener("keydown", (event) => {
    heldKeys.add(event.code);
    if (SWITCH_KEYS.has(event.code)) { switchedAt = performance.now(); mark("switch"); }
  }, listenerOptions);
  addEventListener("keyup", (event) => heldKeys.delete(event.code), listenerOptions);
  addEventListener("mousedown", (event) => {
    if (event.button === 0) firing = true;
    if (event.button === 2) aiming = true;
  }, listenerOptions);
  addEventListener("mouseup", (event) => {
    if (event.button === 0) firing = false;
    if (event.button === 2) aiming = false;
  }, listenerOptions);
  addEventListener("wheel", () => { switchedAt = performance.now(); mark("switch"); }, listenerOptions);
  addEventListener("pointerrawupdate", (event) => { lookMovement += Math.abs(event.movementX) + Math.abs(event.movementY); }, listenerOptions);
  addEventListener("blur", () => { heldKeys.clear(); firing = false; aiming = false; });
  const webgl2Prototype = window.WebGL2RenderingContext?.prototype;
  if (webgl2Prototype) {
    for (const methodName of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
      const originalDraw = webgl2Prototype[methodName];
      webgl2Prototype[methodName] = function (...args) {
        draws++;
        return originalDraw.apply(this, args);
      };
    }
  }
  // Letters for what the player is doing: m(oving) f(iring) a(iming) l(ooking) s(witching).
  function activityCode(at) {
    let code = "";
    for (const moveKey of MOVE_KEYS) if (heldKeys.has(moveKey)) { code += "m"; break; }
    if (firing) code += "f";
    if (aiming) code += "a";
    if (lookMovement > 0) code += "l";
    if (at - switchedAt < 500) code += "s";
    return code || "still";
  }

  if (typeof PerformanceObserver === "function" && PerformanceObserver.supportedEntryTypes?.includes("long-animation-frame")) {
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        stalls.push({
          start: entry.startTime,
          ms: Math.round(entry.duration),
          blockingMs: Math.round(entry.blockingDuration),
          styleLayoutMs: entry.styleAndLayoutStart ? Math.round(entry.startTime + entry.duration - entry.styleAndLayoutStart) : 0,
          renderMs: entry.renderStart ? Math.round(entry.startTime + entry.duration - entry.renderStart) : 0,
          scripts: entry.scripts.slice(0, 4).map((script) => ({
            ms: Math.round(script.duration),
            forcedLayoutMs: Math.round(script.forcedStyleAndLayoutDuration || 0),
            source: `${script.sourceURL.replace(location.origin, "")}${script.sourceFunctionName ? " " + script.sourceFunctionName : ""}`,
            at: script.sourceCharPosition,
            invoker: script.invoker,
          })),
        });
        if (stalls.length > 500) stalls.shift();
      }
    }).observe({ type: "long-animation-frame", buffered: false });
  }

  // Files the game fetched (models, textures, sounds), to name what loaded before a freeze.
  const recentLoads = [];
  if (typeof PerformanceObserver === "function") {
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!/\.(glb|gltf|bin|ktx2|png|jpe?g|webp|avif|json|mp3|ogg|wav)(\?|$)/i.test(entry.name)) continue;
        recentLoads.push({ end: entry.responseEnd, file: entry.name.replace(location.origin, "") });
        if (recentLoads.length > 300) recentLoads.shift();
      }
    }).observe({ type: "resource", buffered: false });
  }

  // Called just before each completed render reaches __aimFrameLog.
  window.__aimFrameWork = (tickMs, renderMs, gpuWaits, counters) => {
    const counterValues = counters || {};
    const currentCounters = { programs: counterValues.programs || 0, textures: counterValues.textures || 0, geometries: counterValues.geometries || 0 };
    pendingWork = {
      tickMs: tickMs || 0,
      renderMs: renderMs || 0,
      gpuWaits: gpuWaits || 0,
      newPrograms: previousCounters ? Math.max(0, currentCounters.programs - previousCounters.programs) : 0,
      newTextures: previousCounters ? Math.max(0, currentCounters.textures - previousCounters.textures) : 0,
      newGeometries: previousCounters ? Math.max(0, currentCounters.geometries - previousCounters.geometries) : 0,
      calls: counterValues.calls || 0,
      triangles: counterValues.triangles || 0,
    };
    previousCounters = currentCounters;
  };

  function slowFrameCause(ms, frameWork) {
    if (!frameWork) return "unknown";
    if (frameWork.newPrograms > 0) return "shader";
    if (frameWork.newTextures > 0 || frameWork.newGeometries > 0) return "upload";
    if (frameWork.gpuWaits > 0) return "gpu";
    if (frameWork.tickMs + frameWork.renderMs < ms / 2) return "outside";
    return frameWork.tickMs >= frameWork.renderMs ? "sim" : "render";
  }

  function displaySettings() {
    try {
      const saved = JSON.parse(localStorage.getItem("al-display-settings-v1") || "{}");
      return {
        renderScale: saved.renderScale, shadows: saved.shadows, lowLatency: saved.lowLatency, frameMode: saved.frameMode, maxFps: saved.maxFps,
        renderEveryNthFrame: saved.renderEveryNthFrame, interface: localStorage.getItem("es-ui-mode") || "enhanced",
      };
    } catch {
      return {};
    }
  }

  function startRound(at) {
    frameCount = 0;
    events.length = 0;
    round = { parts: {}, startedAt: new Date().toISOString(), t0: at, frames: 0, activeMs: 0, slowMs: 0, slow: [], worstMs: 0, gpuWaitFrames: 0, tickMs: 0, renderMs: 0, hist: new Uint32Array(HISTOGRAM_BUCKETS), longMs: 0, longFrames: 0, byActivity: {}, seconds: [] };
  }

  // Frames per 0.1 ms bucket, so 1% lows and p99 are exact to 0.1 ms in every round.
  function lowFrameStats(record) {
    const lowFrameCount = Math.ceil(record.frames * 0.01);
    let remaining = lowFrameCount, slowestSumMs = 0, p99 = 0;
    const longMean = record.longFrames ? record.longMs / record.longFrames : 0;
    const fromLong = Math.min(remaining, record.longFrames);
    slowestSumMs += fromLong * longMean;
    remaining -= fromLong;
    if (fromLong) p99 = longMean;
    for (let bucket = HISTOGRAM_BUCKETS - 1; bucket >= 0 && remaining > 0; bucket--) {
      const bucketFrames = Math.min(remaining, record.hist[bucket]);
      if (!bucketFrames) continue;
      slowestSumMs += bucketFrames * (bucket + 0.5) / 10;
      remaining -= bucketFrames;
      p99 = (bucket + 0.5) / 10;
    }
    return { onePercentLow: lowFrameCount && slowestSumMs ? Math.round((1000 * lowFrameCount) / slowestSumMs) : 0, p99Ms: +p99.toFixed(1) };
  }

  function finishRound() {
    if (!round) return;
    const finishedRound = round;
    round = null;
    previousRenderAt = 0;
    sendReport(finishedRound);
  }

  // Also called once gameplay has stopped for a moment (pause, results), so closing the
  // window can't lose the report. The same round overwrites its own file.
  function sendReport(record) {
    if (record.activeMs < 2000) return;
    for (const slowFrame of record.slow) {
      // The longest browser stall overlapping this frame's whole interval, not just its end.
      let longestStall = null;
      for (const stall of stalls) {
        if (stall.start < slowFrame.at && stall.start + stall.ms > slowFrame.at - slowFrame.ms && (!longestStall || stall.ms > longestStall.ms)) longestStall = stall;
      }
      if (longestStall) slowFrame.stall = longestStall;
      if (slowFrame.ms >= 50) {
        const filesBefore = recentLoads.filter((load) => load.end <= slowFrame.at && slowFrame.at - load.end < 3000).map((load) => load.file);
        if (filesBefore.length) slowFrame.loadedJustBefore = filesBefore.slice(-8);
      }
    }
    const causes = {};
    for (const slowFrame of record.slow) causes[slowFrame.cause] = (causes[slowFrame.cause] || 0) + 1;
    const report = {
      startedAt: record.startedAt,
      drill,
      ...lowFrameStats(record),
      rafPerSecond: +(((record.raf || 0) * 1000) / record.activeMs).toFixed(1),
      rafSources: record.rafSources || {},
      eventImpact: eventImpact(),
      tickPartsMsPerSecond: Object.fromEntries(Object.entries(record.parts).map(([part, totalMs]) => [part, +((1000 * totalMs) / record.activeMs).toFixed(2)])),
      over240HzPct: +((100 * record.over240) / record.frames).toFixed(2),
      byActivity: Object.fromEntries(Object.entries(record.byActivity).map(([activity, stats]) => [activity, {
        frames: stats.frames,
        fps: Math.round((stats.frames * 1000) / stats.ms),
        over240HzPct: +((100 * stats.over240) / stats.frames).toFixed(2),
        over150Pct: +((100 * stats.over150) / stats.frames).toFixed(2),
        renderMs: +(stats.renderMs / stats.frames).toFixed(2),
        tickMs: +(stats.tickMs / stats.frames).toFixed(2),
        draws: Math.round(stats.draws / stats.frames),
      }])),
      timeline: record.seconds,
      seconds: +(record.activeMs / 1000).toFixed(1),
      settings: displaySettings(),
      frames: record.frames,
      avgFps: Math.round((record.frames * 1000) / record.activeMs),
      avgTickMs: +(record.tickMs / record.frames).toFixed(3),
      avgRenderMs: +(record.renderMs / record.frames).toFixed(3),
      gpuWaitFramesPct: +((100 * record.gpuWaitFrames) / record.frames).toFixed(2),
      framesBelow150: record.slow.length,
      timeBelow150Pct: +((100 * record.slowMs) / record.activeMs).toFixed(2),
      worstMs: +record.worstMs.toFixed(1),
      causes,
      slow: record.slow.map((slowFrame) => ({ ...slowFrame, at: undefined, t: +((slowFrame.at - record.t0) / 1000).toFixed(3), ms: +slowFrame.ms.toFixed(2) })),
    };
    window.__aimFrameLogLast = report;
    window.__aimDesktop?.frameLog?.(report);
  }

  window.__aimFrameLog = (at, active) => {
    const frameWork = pendingWork;
    pendingWork = null;
    // Time spent in each part of the game tick since the last render (extend-tick-timing.cjs).
    const tickParts = window.__aimTickParts;
    window.__aimTickParts = {};
    if (round && tickParts) for (const part in tickParts) round.parts[part] = (round.parts[part] || 0) + tickParts[part];
    const inRound = document.body.classList.contains("al-training-active");
    if (!inRound) return finishRound();
    if (!active) {
      previousRenderAt = 0;
      return;
    }
    if (!round) startRound(at);
    round.saved = false;
    lastFrameAt = at;
    if (previousRenderAt) {
      const ms = at - previousRenderAt;
      // Longer gaps are pauses or a hidden window, not frames.
      if (ms < 2000) {
        round.frames++;
        round.activeMs += ms;
        if (frameCount < MAX_FRAMES) {
          frameAt[frameCount] = at;
          frameMs[frameCount] = ms;
          frameTick[frameCount] = frameWork?.tickMs || 0;
          frameRender[frameCount] = frameWork?.renderMs || 0;
          frameNewResources[frameCount] = (frameWork?.newPrograms || 0) + (frameWork?.newTextures || 0) + (frameWork?.newGeometries || 0);
          frameCount++;
        }
        if (frameWork) {
          round.tickMs += frameWork.tickMs;
          round.renderMs += frameWork.renderMs;
          if (frameWork.gpuWaits > 0) round.gpuWaitFrames++;
        }
        if (ms > round.worstMs) round.worstMs = ms;
        const bucket = Math.floor(ms * 10);
        if (bucket < HISTOGRAM_BUCKETS) round.hist[bucket]++;
        else { round.longFrames++; round.longMs += ms; }
        if (ms > REFRESH_MS) round.over240 = (round.over240 || 0) + 1;
        const doing = activityCode(at);
        const activityStats = (round.byActivity[doing] ||= { frames: 0, ms: 0, over240: 0, over150: 0, renderMs: 0, tickMs: 0, draws: 0 });
        activityStats.frames++;
        activityStats.ms += ms;
        if (ms > REFRESH_MS) activityStats.over240++;
        if (ms > SLOW_MS) activityStats.over150++;
        activityStats.renderMs += frameWork?.renderMs || 0;
        activityStats.tickMs += frameWork?.tickMs || 0;
        activityStats.draws += draws;
        const second = Math.floor((at - round.t0) / 1000);
        const secondStats = (round.seconds[second] ||= { n: 0, o240: 0, o150: 0, max: 0, render: 0, draws: 0, fire: 0, move: 0 });
        secondStats.n++;
        if (ms > REFRESH_MS) secondStats.o240++;
        if (ms > SLOW_MS) secondStats.o150++;
        if (ms > secondStats.max) secondStats.max = +ms.toFixed(1);
        secondStats.render = +(secondStats.render + (frameWork?.renderMs || 0)).toFixed(2);
        secondStats.draws += draws;
        if (firing) secondStats.fire++;
        if (doing.startsWith("m")) secondStats.move++;
        if (ms > SLOW_MS) {
          round.slowMs += ms;
          if (round.slow.length < MAX_SLOW_FRAMES) {
            const slowFrame = { at, ms, cause: slowFrameCause(ms, frameWork), doing, draws };
            if (tickParts) slowFrame.parts = Object.fromEntries(Object.entries(tickParts).filter(([, partMs]) => partMs >= 0.2).map(([part, partMs]) => [part, +partMs.toFixed(2)]));
            if (frameWork) slowFrame.work = { tickMs: +frameWork.tickMs.toFixed(2), renderMs: +frameWork.renderMs.toFixed(2), gpuWaits: frameWork.gpuWaits, newPrograms: frameWork.newPrograms, newTextures: frameWork.newTextures, newGeometries: frameWork.newGeometries, calls: frameWork.calls };
            round.slow.push(slowFrame);
          }
        }
      }
    }
    previousRenderAt = at;
    lookMovement = 0;
    draws = 0;
  };

  setInterval(() => {
    wrapEventHooks();
    if (round && !round.saved && performance.now() - lastFrameAt > 1500) {
      round.saved = true;
      sendReport(round);
    }
    // The title is only on the start screen, before the round begins.
    const title = document.querySelector(".al-scene-start-title")?.textContent.trim();
    if (title) drill = title;
    if (round && !document.body.classList.contains("al-training-active")) finishRound();
  }, 1000);
  addEventListener("pagehide", finishRound);
})();
