// HUD widgets keep independent lifecycles, but share one callback.
// Test copy: a timer replaces requestAnimationFrame. A running animation-frame loop measured about 8 ms
// more key-to-screen delay on the low-latency canvas (docs/display-pacing-2026-10-31.md).
// Physics/rendering and mouse input keep their original scheduling.
import { recordHudWork } from './performance-diagnostics.mjs';
const HUD_INTERVAL_MS = 8;
export function createHudFrameScheduler(
  request = callback => setTimeout(() => callback(performance.now()), HUD_INTERVAL_MS),
  cancel = id => clearTimeout(id),
  report = error => {
    if (typeof globalThis.reportError === 'function') globalThis.reportError(error);
    else setTimeout(() => { throw error; }, 0);
  },
) {
  let pending = new Map(), current = null, frame = null, nextId = 1;
  function flush(timestamp) {
    const started = performance.now();
    frame = null;
    current = pending;
    pending = new Map();
    const count = current.size;
    for (const [id, callback] of current) {
      current.delete(id);
      try { callback(timestamp); } catch (error) { report(error); }
    }
    current = null;
    recordHudWork(timestamp, performance.now() - started, count);
  }
  return {
    request(callback) {
      const id = nextId++;
      pending.set(id, callback);
      if (frame === null) frame = request(flush);
      return id;
    },
    cancel(id) {
      pending.delete(id);
      current?.delete(id);
      if (!pending.size && frame !== null) { cancel(frame); frame = null; }
    },
  };
}

const shared = createHudFrameScheduler();
export const requestHudFrame = callback => shared.request(callback);
export const cancelHudFrame = id => shared.cancel(id);
