// Studio options mapped to the game's existing procedural surface materials.
const SIZES = { small: 24, medium: 40, large: 70 };
const limit = (value, min, max, fallback) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
export const arenaSize = drill => limit(drill.arenaSize, 12, 400, SIZES[drill.rangeSize] || 40);
// studio-arena-rect: the arena as a rectangle { x0, x1, z0, z1 } (world metres). drill.arena is set when you
// drag an edge or change Width / Depth; otherwise it is the centered square from the preset / Arena size.
// Edges stay within ±ARENA_REACH so the game's view distance (2x the span, max 400 m) still reaches them.
export const ARENA_REACH = 200, ARENA_MIN = 2;
export function arenaRect(drill) {
  const a = drill.arena;
  if (a && [a.x0, a.x1, a.z0, a.z1].every(Number.isFinite) && a.x1 - a.x0 >= ARENA_MIN && a.z1 - a.z0 >= ARENA_MIN) return { x0: a.x0, x1: a.x1, z0: a.z0, z1: a.z1 };
  const h = arenaSize(drill) / 2;
  return { x0: -h, x1: h, z0: -h, z1: h };
}
// Twice the farthest edge from the middle of the world: what the game uses for its view distance.
export const arenaSpan = drill => { const r = arenaRect(drill); return 2 * Math.max(-r.x0, r.x1, -r.z0, r.z1); };
export function setArenaRect(drill, r) {
  const c = (v) => Math.round(Math.max(-ARENA_REACH, Math.min(ARENA_REACH, v)) * 100) / 100;
  drill.arena = { x0: c(r.x0), x1: c(r.x1), z0: c(r.z0), z1: c(r.z1) };
}
export const arenaWallHeight = drill => limit(drill.arenaWallHeight, 0, 40, 0);
export const SURFACES = [['plain', 'Flat'], ['tile', 'Grid'], ['industrial', 'Industrial']];
// Shared sRGB palette for the editor and compiled gameplay surfaces.
export const CHARCOAL = { floor: '#1a1a1e', wall: '#202024', seam: '#333338', floorScale: 2.4, wallScale: 1.2 };
export const LIGHT = { ...CHARCOAL, floor: '#c6c8cc', wall: '#d9dbdf', seam: '#a7abb1' };
export const darkArena = drill => drill.arenaTheme !== 'light';
// arena-colors-v1 (19 Nov 2026): drill.arenaColors { floor, wall, seam, target } (each optional, '#rrggbb')
// override the Dark / Light mode colors. Walls and blocks with their own color keep it. The sky always follows the mode.
export const ARENA_COLOR_KEYS = [['floor', 'Floor'], ['wall', 'Walls and blocks'], ['seam', 'Grid lines'], ['target', 'Targets']];
const EDITABLE = new Set(ARENA_COLOR_KEYS.map(([k]) => k));
const hex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
export const customArenaColor = (drill, key) => EDITABLE.has(key) && hex(drill.arenaColors?.[key]) ? drill.arenaColors[key].toLowerCase() : null;
export const themeArenaColor = (drill, key) => key === 'sky' ? (darkArena(drill) ? '#14171c' : '#c1c5cb') : key === 'target' ? (darkArena(drill) ? '#ffffff' : '#000000') : (darkArena(drill) ? CHARCOAL : LIGHT)[key];
export const arenaColor = (drill, key) => customArenaColor(drill, key) || themeArenaColor(drill, key);
export const targetColor = drill => arenaColor(drill, 'target');
export const arenaPalette = drill => ({ ...(darkArena(drill) ? CHARCOAL : LIGHT), floor: arenaColor(drill, 'floor'), wall: arenaColor(drill, 'wall'), seam: arenaColor(drill, 'seam') });
export const arenaSurface = drill => drill.floorSurface === 'industrial' ? 'industrial' : drill.floorSurface === 'plain' || (drill.arenaTheme === 'original' && !drill.floorSurface) ? 'plain' : 'tile';
export function setArenaSurface(drill, surface) {
  drill.floorSurface = drill.wallSurface = surface === 'industrial' ? 'industrial' : surface === 'plain' ? 'plain' : 'tile';
  for (const item of drill.items) if (item.kind === 'wall' || item.kind === 'block') delete item.surface;
}
export function surfaceFor(drill, item = null, floor = false) {
  const palette = arenaPalette(drill);
  const inherited = (floor ? drill.floorSurface : drill.wallSurface) || arenaSurface(drill);
  const selected = item?.surface && item.surface !== 'inherit' ? item.surface : inherited;
  const industrial = selected === 'industrial';
  const pattern = selected === 'plain' ? 'plain' : 'tile';
  const customColor = /^#[0-9a-f]{6}$/i.test(item?.surfaceColor || '') ? item.surfaceColor : null;
  const own = customArenaColor(drill, floor ? 'floor' : 'wall');
  const themeColor = own || (industrial ? (floor ? '#343d42' : '#48606d') : (floor ? palette.floor : palette.wall));
  const color = customColor || themeColor;
  const result = { color };
  if (pattern === 'tile') {
    result.surface = pattern;
    result.surfaceStyle = industrial ? (floor ? 'industrial-grid' : 'industrial') : 'squares';
    result.surfaceScale = limit(item?.surfaceScale, .25, 8, floor ? limit(drill.floorTileScale, .25, 8, CHARCOAL.floorScale) : limit(drill.wallTileScale, .25, 8, CHARCOAL.wallScale));
    result.surfaceSeam = palette.seam;
  }
  return result;
}
export function arenaBlocks(drill) {
  const { x0, x1, z0, z1 } = arenaRect(drill), height = arenaWallHeight(drill);
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const box = (id, x, y, z, w, h, d, floor = false) => ({ id, shape: 'box', position: { x, y, z }, rotationY: 0, size: { x: w, y: h, z: d }, collidable: true, ...surfaceFor(drill, null, floor) });
  const blocks = [box('ground', cx, -.2, cz, w, .4, d, true)];
  if (height > 0) blocks.push(
    box('arena-left', x0-.15, height/2, cz, .3, height, d+.6),
    box('arena-right', x1+.15, height/2, cz, .3, height, d+.6),
    box('arena-back', cx, height/2, z0-.15, w, height, .3),
    box('arena-front', cx, height/2, z1+.15, w, height, .3),
  );
  return blocks;
}
