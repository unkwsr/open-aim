// Smooth mouse-wheel scrolling for the lobby and menus. Each wheel notch eases the list
// toward its new position over about 150 ms instead of jumping 100 px in one frame.
// Left to the browser: touchpads (already smooth), Ctrl+wheel (zoom), Shift/sideways wheel,
// anything while the pointer is locked (aiming), and inner lists that can still scroll.
(() => {
  if (window.__aimSmoothScroll) return;
  window.__aimSmoothScroll = true;
  const GLIDE_MS = 45; // time constant: about 95% of the way after 3 x GLIDE_MS
  const LINE = 40, PAGE = 0.9;
  let el = null, target = 0, pos = 0, last = 0, frame = 0;

  const scrollable = (node) => {
    const style = getComputedStyle(node);
    return /(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
  };
  // The nearest list under the pointer that can still move in that direction.
  function container(start, dy) {
    for (let node = start; node && node !== document.documentElement; node = node.parentElement) {
      if (node.nodeType !== 1 || !scrollable(node)) continue;
      const max = node.scrollHeight - node.clientHeight;
      if ((dy > 0 && node.scrollTop < max - 1) || (dy < 0 && node.scrollTop > 1)) return node;
    }
    return null;
  }
  function step(now) {
    if (!el?.isConnected) { el = null; frame = 0; return; }
    // Someone else moved it (scrollbar drag, keyboard, the page itself): follow them.
    if (Math.abs(el.scrollTop - last) > 2) { pos = target = el.scrollTop; el = null; frame = 0; return; }
    const dt = Math.min(50, now - (step.at || now));
    step.at = now;
    pos += (target - pos) * (1 - Math.exp(-dt / GLIDE_MS));
    if (Math.abs(target - pos) < 0.5) pos = target;
    el.scrollTop = pos;
    last = el.scrollTop;
    if (pos === target) { el = null; frame = 0; return; }
    frame = requestAnimationFrame(step);
  }
  addEventListener("wheel", (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.shiftKey || document.pointerLockElement) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    // Mouse wheels report whole notches (about 100 px); touchpads report small steps.
    const dy = e.deltaMode === 1 ? e.deltaY * LINE : e.deltaMode === 2 ? e.deltaY * innerHeight * PAGE : e.deltaY;
    if (e.deltaMode === 0 && Math.abs(dy) < 40) return;
    const node = container(e.target, dy);
    if (!node) return;
    e.preventDefault();
    if (node !== el) { el = node; pos = target = last = node.scrollTop; }
    const max = node.scrollHeight - node.clientHeight;
    target = Math.max(0, Math.min(max, target + dy));
    if (!frame) { step.at = 0; frame = requestAnimationFrame(step); }
  }, { passive: false, capture: true });
})();
