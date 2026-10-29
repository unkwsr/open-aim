// Studio options mapped to the game's existing procedural surface materials.
const SIZES = { small: 24, medium: 40, large: 70 };
const limit = (value, min, max, fallback) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
export const arenaSize = drill => limit(drill.arenaSize, 12, 200, SIZES[drill.rangeSize] || 40);
export const arenaWallHeight = drill => limit(drill.arenaWallHeight, 0, 40, 0);
export const SURFACES = [['plain', 'Flat'], ['tile', 'Grid']];
// Shared sRGB palette for the editor and compiled gameplay surfaces.
export const CHARCOAL = { floor: '#1a1a1e', wall: '#202024', seam: '#333338', floorScale: 2.4, wallScale: 1.2 };
export const LIGHT = { ...CHARCOAL, floor: '#c6c8cc', wall: '#d9dbdf', seam: '#a7abb1' };
export const darkArena = drill => drill.arenaTheme !== 'light';
export const targetColor = drill => darkArena(drill) ? '#ffffff' : '#000000';
export const arenaPalette = drill => darkArena(drill) ? CHARCOAL : LIGHT;
export const arenaSurface = drill => drill.floorSurface === 'plain' || (drill.arenaTheme === 'original' && !drill.floorSurface) ? 'plain' : 'tile';
export function setArenaSurface(drill, surface) {
  drill.floorSurface = drill.wallSurface = surface === 'plain' ? 'plain' : 'tile';
  for (const item of drill.items) if (item.kind === 'wall' || item.kind === 'block') delete item.surface;
}
export function surfaceFor(drill, item = null, floor = false) {
  const palette = arenaPalette(drill);
  const inherited = (floor ? drill.floorSurface : drill.wallSurface) || arenaSurface(drill);
  const selected = item?.surface && item.surface !== 'inherit' ? item.surface : inherited;
  const pattern = selected === 'plain' ? 'plain' : 'tile';
  const color = floor ? palette.floor : palette.wall;
  const result = { color };
  if (pattern === 'tile') {
    result.surface = pattern;
    if (pattern === 'tile') result.surfaceStyle = 'squares';
    result.surfaceScale = limit(item?.surfaceScale, .25, 8, floor ? limit(drill.floorTileScale, .25, 8, CHARCOAL.floorScale) : limit(drill.wallTileScale, .25, 8, CHARCOAL.wallScale));
    result.surfaceSeam = palette.seam;
  }
  return result;
}
export function arenaBlocks(drill) {
  const size = arenaSize(drill), height = arenaWallHeight(drill);
  const box = (id, x, y, z, w, h, d, floor = false) => ({ id, shape: 'box', position: { x, y, z }, rotationY: 0, size: { x: w, y: h, z: d }, collidable: true, ...surfaceFor(drill, null, floor) });
  const blocks = [box('ground', 0, -.2, 0, size, .4, size, true)];
  if (height > 0) blocks.push(
    box('arena-left', -size/2-.15, height/2, 0, .3, height, size+.6),
    box('arena-right', size/2+.15, height/2, 0, .3, height, size+.6),
    box('arena-back', 0, height/2, -size/2-.15, size, height, .3),
    box('arena-front', 0, height/2, size/2+.15, size, height, .3),
  );
  return blocks;
}
