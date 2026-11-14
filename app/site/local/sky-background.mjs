// Display-only panorama: map lights, reflections and fog keep their own settings.
const KEY = 'aim-sky-background-v1';
const CHANGE = 'aim-sky-change';

export function attachSkyBackground(scene, Texture, colorSpace, mapping, originalColor) {
  let texture = null, pending = null, disposed = false;
  let ready = Promise.resolve(), settle = () => {};
  const selected = () => {
    try { return localStorage.getItem(KEY) !== 'original'; } catch { return true; }
  };
  function refresh() {
    if (disposed) return;
    scene.background = originalColor();
    if (!selected()) return;
    if (texture) { scene.background = texture; return; }
    if (pending) return;
    ready = new Promise(resolve => { settle = resolve; });
    const image = pending = new Image();
    image.onload = () => {
      pending = null;
      if (disposed) return;
      texture = new Texture(image);
      texture.name = 'Autumn Field Pure Sky';
      texture.colorSpace = colorSpace;
      texture.mapping = mapping;
      texture.needsUpdate = true;
      if (selected()) scene.background = texture;
      settle();
    };
    image.onerror = () => {
      pending = null;
      console.warn('Autumn Field sky could not load; using the original sky.');
      settle();
    };
    image.src = '/local/skies/autumn-field-puresky-4k.jpg';
  }
  addEventListener(CHANGE, refresh);
  refresh();
  return {
    refresh,
    ready() { return selected() ? ready : Promise.resolve(); },
    dispose() {
      disposed = true;
      removeEventListener(CHANGE, refresh);
      if (pending) pending.onload = pending.onerror = null;
      pending = null;
      settle();
      texture?.dispose();
      texture = null;
    }
  };
}
