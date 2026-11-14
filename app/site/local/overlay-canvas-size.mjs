// Keep layout queries out of Jett's per-render screen-effect path. Read the
// same client dimensions as before, but only when ResizeObserver reports a
// size change. Canvas backing-store changes remain synchronous with drawing.
// dash-fx-half-res-v1: Jett's dash/prime screen effect (its only user) is drawn at
// half resolution and stretched to full screen by CSS (width/height 100%). It redraws
// the whole canvas every frame during the dash (full-screen flash + 70 streaks; in
// Worker Test also a full-screen bitmap sent to the page per frame), and dash starts
// had 4x more >8 ms frames than other moments. All drawing scales with the canvas
// height, so the picture is the same, only softer.
const FX_SCALE = 0.5;
export function createOverlayCanvasSize(host, canvas) {
  const size = { w: 1, h: 1 };
  const refresh = () => {
    size.w = Math.max(1, Math.round(host.clientWidth * FX_SCALE));
    size.h = Math.max(1, Math.round(host.clientHeight * FX_SCALE));
  };
  refresh();
  const Observer = host.ownerDocument?.defaultView?.ResizeObserver;
  const observer = Observer ? new Observer(refresh) : null;
  observer?.observe(host, { box: 'border-box' });
  return {
    read() {
      // Retain native behavior in environments without ResizeObserver.
      if (!observer) refresh();
      if (canvas.width !== size.w || canvas.height !== size.h) {
        canvas.width = size.w;
        canvas.height = size.h;
      }
      return size;
    },
    dispose() { observer?.disconnect(); }
  };
}
