// HUD widgets keep independent lifecycles, but share one browser animation
// callback. Physics/rendering and mouse input keep their original scheduling.
import { recordHudWork } from './performance-diagnostics.mjs';
export function createHudFrameScheduler(
  request = callback => requestAnimationFrame(callback),
  cancel = id => cancelAnimationFrame(id),
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
