// Building transforms shared by the inspector and direct 3D handles.
export const wallDepth = item => Number.isFinite(item.depth) ? Math.max(.1, Math.min(40, item.depth)) : .3;
export function dimensions(item) {
  return item.kind === 'wall'
    ? { w: item.length, h: item.height, d: wallDepth(item) }
    : { w: item.w, h: item.h, d: item.shape === 'pillar' ? item.w : item.d };
}
export function resizePiece(item, original, axis, sign, delta, free = false) {
  const dims = dimensions(original), wall = item.kind === 'wall';
  const min = axis === 'h' ? (wall ? .2 : original.shape === 'floor' ? .1 : .3)
    : wall && axis === 'd' ? .1 : original.shape === 'pillar' ? .3 : (axis === 'd' ? .1 : .5);
  const max = wall && axis === 'w' ? 200 : original.shape === 'pillar' && axis !== 'h' ? 4 : 40;
  let size = Math.max(min, Math.min(max, dims[axis] + delta));
  if (!free) size = Math.max(min, Math.min(max, Math.round(size * 10) / 10));
  item[wall ? ({ w: 'length', h: 'height', d: 'depth' })[axis] : original.shape === 'pillar' && axis === 'd' ? 'w' : axis] = size;
  // The opposite face stays anchored; height grows upward from the existing base.
  if (axis !== 'h') {
    const a = (original.turn || 0) * Math.PI / 180;
    const direction = axis === 'w' ? { x: Math.cos(a), z: -Math.sin(a) } : { x: Math.sin(a), z: Math.cos(a) };
    // A round pillar changes diameter symmetrically to preserve its centre.
    const shift = original.shape === 'pillar' ? 0 : sign * (size - dims[axis]) / 2;
    item.x = original.x + direction.x * shift;
    item.z = original.z + direction.z * shift;
  }
}
