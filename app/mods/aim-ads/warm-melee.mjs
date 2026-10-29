// Run only during the existing idle/map preparation path, never on weapon input.
export async function warmMeleeModel(renderer, model, { valid, aspect, hand, fov }) {
  if (!valid()) return false;
  model.setHand(hand);
  model.setFovHorizontal(fov);
  model.update({ seconds: 0, shots: [], speed: 0, reloadSince: null, adsBlend: 0, melee: [], equipAt: 0 });
  const layer = model.fxLayer();
  await renderer.compileAsync(layer.scene, layer.camera);
  if (!valid()) return false;
  const target = renderer.getRenderTarget();
  const viewport = renderer.getViewport({ copy(v) { this.x=v.x;this.y=v.y;this.z=v.z;this.w=v.w;return this; } });
  const scissor = renderer.getScissorTest();
  try {
    // Match the real output shader variant and upload buffers/textures before switching.
    renderer.setRenderTarget(null);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, 16, 16);
    for (const seconds of [0, .3, .8, 1.5]) {
      model.update({ seconds, shots: [], speed: 0, reloadSince: null, adsBlend: 0, melee: [], equipAt: 0 });
      model.render(renderer, { aspect });
    }
    // The aimed pose may reveal a different scope material or shader variant.
    model.update({ seconds: 2, shots: [], speed: 0, reloadSince: null, adsBlend: 1, melee: [], equipAt: 0 });
    model.render(renderer, { aspect });
  } finally {
    renderer.setRenderTarget(target);
    renderer.setViewport(viewport.x, viewport.y, viewport.z, viewport.w);
    renderer.setScissorTest(scissor);
  }
  return true;
}
