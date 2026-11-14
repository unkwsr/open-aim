// Unadjusted pointer lock supplies the counts. Raw updates only change when
// Chromium delivers them; never combine raw updates with mousemove counts.
export function attachPointerInput(target, consume, { rawPointer = true } = {}) {
  const doc = target.ownerDocument;
  const view = doc.defaultView;
  const raw = rawPointer && view.isSecureContext && 'onpointerrawupdate' in view;
  const eventName = raw ? 'pointerrawupdate' : 'mousemove';
  function move(event) {
    if (doc.pointerLockElement !== target || !doc.hasFocus()) return;
    if (raw && event.pointerType !== 'mouse') return;
    if (!Number.isFinite(event.movementX) || !Number.isFinite(event.movementY)) return;
    // The dispatched delta already includes coalesced samples. Adding those
    // again would multiply sensitivity, especially with high polling rates.
    consume(event);
  }
  doc.addEventListener(eventName, move, { passive: true });
  return () => doc.removeEventListener(eventName, move);
}
