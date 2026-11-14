// target-workshop-backdrop-v1: visual preference for Target Workshop scenes.
const key = 'aim-target-workshop-backdrop-v1';
const palettes = {
  white: { sky: '#f4f6f8', wall: '#f4f6f8', floor: '#d9dee4' },
  black: { sky: '#0c0f14', wall: '#11151c', floor: '#1c222b' },
};

export function getTargetBackdrop() {
  try { return localStorage.getItem(key) === 'black' ? 'black' : 'white'; }
  catch { return 'white'; }
}

export function setTargetBackdrop(value) {
  const choice = value === 'black' ? 'black' : 'white';
  try { localStorage.setItem(key, choice); } catch {}
  return choice;
}

const targetColorKey = 'aim-target-workshop-color-v1';
/* target-workshop-custom-color-v1 */
export function getTargetColor() {
  try { const value = localStorage.getItem(targetColorKey); return /^#[0-9a-f]{6}$/i.test(value ?? '') ? value.toLowerCase() : null; }
  catch { return null; }
}
export function setTargetColor(value) {
  const color = typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
  try { if (color) localStorage.setItem(targetColorKey, color); else localStorage.removeItem(targetColorKey); } catch {}
  return color;
}

export function applyTargetBackdrop(doc, value = getTargetBackdrop(), targetColor = getTargetColor()) {
  if (!doc?.environment) return doc;
  const color = palettes[value === 'black' ? 'black' : 'white'];
  doc.environment.skyColor = color.sky;
  doc.environment.__aimTargetWorkshop = true;
  for (const block of doc.blocks ?? []) {
    if (block.transparent) continue;
    block.color = block.shape === 'plane' || block.id === 'ground' ? color.floor : color.wall;
  }
  // target-workshop-dark-target-contrast-v1
  if (targetColor) for (const actor of doc.actors ?? []) {
    if (actor.body?.shape === 'sphere') actor.color = targetColor;
  }
  if (!targetColor && value === 'black') for (const actor of doc.actors ?? []) {
    if (actor.body?.shape !== 'sphere' || typeof actor.color !== 'string') continue;
    const rgb = /^#([0-9a-f]{6})$/i.exec(actor.color)?.[1];
    if (!rgb) continue;
    const red = parseInt(rgb.slice(0, 2), 16), green = parseInt(rgb.slice(2, 4), 16), blue = parseInt(rgb.slice(4, 6), 16);
    if (0.2126 * red + 0.7152 * green + 0.0722 * blue < 72) actor.color = '#ff4655';
  }
  return doc;
}
