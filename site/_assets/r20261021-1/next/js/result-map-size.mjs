// ResizeObserver supplies post-layout sizes. Never synchronously read geometry
// from a Vue nextTick callback (the old minimap forced a whole-document reflow).
export function createResultMapSizer(getElement, getSize, setSize, {
  min = 280, max = 560, paddingX = 44, paddingY = 40, gap = 12, heightRatio = .92,
  Observer = globalThis.ResizeObserver,
  request = callback => requestAnimationFrame(callback), cancel = id => cancelAnimationFrame(id),
  viewport = () => ({ width: innerWidth, height: innerHeight }),
} = {}) {
  let element, observer, frame = null, width = 0, dead = false;
  const children = new Map();
  function update() {
    frame = null;
    if (dead || !element) return;
    const box = viewport();
    const available = width || Math.min(600, Math.max(340, box.width - 1030));
    // Non-map rows + grid gaps are independent of the square map size.
    if (Observer && [...children.values()].some(value => value === null)) return;
    const chrome = paddingY + gap * children.size + [...children.values()].reduce((sum, value) => sum + (value || 0), 0);
    const size = Math.round(Math.max(min, Math.min(max, available - paddingX, box.height * heightRatio - chrome)));
    if (Number.isFinite(size) && size !== getSize()) setSize(size);
  }
  function schedule() { if (!dead && frame === null) frame = request(update); }
  function refresh() {
    if (dead) return;
    const next = getElement();
    if (!next) return;
    if (next !== element) {
      observer?.disconnect(); children.clear(); width = 0; element = next;
      if (Observer) {
        observer = new Observer(entries => {
          for (const entry of entries) {
            const border = entry.borderBoxSize?.[0] || entry.borderBoxSize;
            if (entry.target === element) width = Number.isFinite(entry.contentRect?.width) ? entry.contentRect.width + paddingX : border?.inlineSize || 0;
            else if (children.has(entry.target)) children.set(entry.target, border?.blockSize ?? entry.contentRect.height);
          }
          schedule();
        });
        observer.observe(element);
      }
    }
    const nextChildren = new Set([...element.children].filter(child => !child.classList.contains('al-pm-map')));
    for (const child of children.keys()) if (!nextChildren.has(child)) { observer?.unobserve(child); children.delete(child); }
    for (const child of nextChildren) if (!children.has(child)) { children.set(child, Observer ? null : 0); observer?.observe(child); }
    schedule();
  }
  return { refresh, destroy() { dead = true; observer?.disconnect(); if (frame !== null) cancel(frame); frame = null; children.clear(); element = null; } };
}
