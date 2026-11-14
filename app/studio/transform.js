// Building transforms shared by the inspector and direct 3D handles.
// studio-free-size: pieces can be any size from MIN_SIZE to MAX_SIZE (the game itself has no limit).
export const MIN_SIZE = .05, MAX_SIZE = 1000;
export const wallDepth = item => Number.isFinite(item.depth) ? Math.max(MIN_SIZE, Math.min(MAX_SIZE, item.depth)) : .3;
export function dimensions(item) {
  return item.kind === 'wall'
    ? { w: item.length, h: item.height, d: wallDepth(item) }
    : { w: item.w, h: item.h, d: item.shape === 'pillar' ? item.w : item.d };
}
export function resizePiece(item, original, axis, sign, delta, free = false) {
  const dims = dimensions(original), wall = item.kind === 'wall';
  const min = MIN_SIZE, max = MAX_SIZE;
  let size = Math.max(min, Math.min(max, dims[axis] + delta));
  if (!free) size = Math.max(.1, Math.min(max, Math.round(size * 10) / 10));
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

// Cache stationary building bounds once per gesture. The spatial buckets keep
// pointer movement limited to nearby pieces, including in large custom arenas.
export function createPieceSnap(items, moving) {
  if (!moving || !['wall', 'block'].includes(moving.kind) || moving.invisible) return null;
  const capture = .18, release = .32, cellSize = 4, buckets = new Map(), large = [];
  const shape = item => {
    const size = dimensions(item), angle = (item.turn || 0) * Math.PI / 180;
    const u = { x: Math.cos(angle), z: -Math.sin(angle) }, v = { x: Math.sin(angle), z: Math.cos(angle) };
    const bottom = (item.y || 0) + (item.lift || 0);
    return { turn: item.turn || 0, x: item.x, z: item.z, u, v, w: size.w / 2, d: size.d / 2,
      bottom, top: bottom + size.h,
      rx: Math.abs(u.x) * size.w / 2 + Math.abs(v.x) * size.d / 2,
      rz: Math.abs(u.z) * size.w / 2 + Math.abs(v.z) * size.d / 2 };
  };
  const range = b => [Math.floor((b.x-b.rx-release)/cellSize), Math.floor((b.x+b.rx+release)/cellSize),
    Math.floor((b.z-b.rz-release)/cellSize), Math.floor((b.z+b.rz+release)/cellSize)];
  const targets = items.filter(it => it.id !== moving.id && ['wall', 'block'].includes(it.kind) && !it.invisible).map(shape);
  for (const target of targets) {
    const [x0,x1,z0,z1] = range(target);
    if ((x1-x0+1)*(z1-z0+1) > 64) { large.push(target); continue; }
    for (let x=x0;x<=x1;x++) for (let z=z0;z<=z1;z++) {
      const key = x + ',' + z;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(target);
    }
  }
  const near = item => {
    const b = shape(item), [x0,x1,z0,z1] = range(b);
    const found = new Set(large);
    if ((x1-x0+1)*(z1-z0+1) > 64) return targets;
    for (let x=x0;x<=x1;x++) for (let z=z0;z<=z1;z++) {
      for (const target of buckets.get(x+','+z) || []) found.add(target);
    }
    return found;
  };
  const dot = (b, axis) => b.x*axis.x+b.z*axis.z;
  const radius = (b, axis) => Math.abs(dot(b.u,axis))*b.w+Math.abs(dot(b.v,axis))*b.d;
  const parallel = (a,b) => Math.abs(dot(a.u,b.u)) > .9999 || Math.abs(dot(a.u,b.v)) > .9999;
  const overlaps = (a,b,axis,pad=0) => Math.abs(dot(a,axis)-dot(b,axis)) <= radius(a,axis)+radius(b,axis)+pad;
  const locks = [null,null,null];
  function nearest(values, value, lock) {
    if (lock !== null && values.some(v => Math.abs(v-lock)<1e-7) && Math.abs(lock-value)<=release) return lock;
    let best = null, distance = capture;
    for (const target of values) {
      const gap = Math.abs(target-value);
      if (gap < distance) { best=target; distance=gap; }
    }
    return best;
  }
  return {
    move(item, free=false, align=false) {
      if (free) { locks.fill(null); return; }
      const nearby = near(item);
      if (align) {
        let best = 12, turn = item.turn || 0;
        const b = shape(item);
        for (const target of nearby) {
          if (Math.abs(b.x-target.x)>b.rx+target.rx+capture || Math.abs(b.z-target.z)>b.rz+target.rz+capture) continue;
          const value=target.turn+Math.round(((item.turn||0)-target.turn)/90)*90;
          const difference=Math.abs(value-(item.turn||0));
          if (difference<best) { best=difference; turn=value; }
        }
        item.turn=(turn%360+360)%360;
      }
      let b = shape(item);
      for (let i=0;i<2;i++) {
        const axis = i===0 ? b.u : b.v, tangent = i===0 ? b.v : b.u, values = [];
        for (const target of nearby) {
          if (!parallel(b,target) || !overlaps(b,target,tangent,release)) continue;
          if (b.bottom>target.top+release || b.top<target.bottom-release) continue;
          const center=dot(target,axis), edge=radius(target,axis), own=radius(b,axis);
          // Opposite faces join flush; matching faces align ends at a corner.
          values.push(center-edge-own,center+edge+own,center-edge+own,center+edge-own);
        }
        const value=dot(b,axis), snapped=nearest(values,value,locks[i]);
        locks[i]=snapped;
        if (snapped!==null) {
          item.x+=axis.x*(snapped-value); item.z+=axis.z*(snapped-value);
          b=shape(item);
        }
      }
      const heights=[];
      for (const target of nearby) {
        if (!overlaps(b,target,b.u,capture) || !overlaps(b,target,b.v,capture) ||
            !overlaps(b,target,target.u,capture) || !overlaps(b,target,target.v,capture)) continue;
        const height=b.top-b.bottom;
        heights.push(target.bottom,target.top,target.top-height);
      }
      const bottom=nearest(heights,b.bottom,locks[2]);
      locks[2]=bottom;
      if (bottom!==null) item.y=bottom-(item.lift||0);
    },
    resize(item, original, axisName, sign, free=false) {
      if (free) { locks.fill(null); return; }
      const b=shape(item), size=dimensions(item), values=[];
      const axis=axisName==='w'?b.u:b.v, tangent=axisName==='w'?b.v:b.u;
      for (const target of near(item)) {
        if (axisName==='h') {
          if (overlaps(b,target,b.u,capture) && overlaps(b,target,b.v,capture)) values.push(target.bottom,target.top);
        } else if (parallel(b,target) && overlaps(b,target,tangent,release) &&
                   b.bottom<=target.top+release && b.top>=target.bottom-release) {
          const center=dot(target,axis), extent=radius(target,axis);
          values.push(center-extent,center+extent);
        }
      }
      const face=axisName==='h'?b.top:dot(b,axis)+sign*size[axisName]/2;
      const target=nearest(values,face,locks[0]); locks[0]=target;
      if (target===null) return;
      const newSize=size[axisName]+(axisName==='h'?1:sign)*(target-face);
      resizePiece(item,original,axisName,sign,newSize-dimensions(original)[axisName],true);
    },
  };
}
