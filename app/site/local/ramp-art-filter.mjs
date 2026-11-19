// ramp-art-filter-v1 (14 Nov 2026): smooth ramps where the map shows stairs.
//
// The player walks on the map's collision volumes plus its visible meshes. Where the volumes have a
// smooth ramp, the visible model is often a staircase lying on that ramp. The terrain builder only
// dropped visible walkable faces up to 0.2 m above a ramp, and only inside its exact outline, so step
// tips, thin tread strips and the first step in front of the ramp stayed in the collision: the player
// was lifted and dropped every step, or stopped dead against a 6 cm strip.
//
// This runs on the player (pawn) collision only, after the builder's own filter: every visible-mesh
// triangle (or the part of a walkable one) that lies in the "skin" of a collision ramp is left out.
// Skin = from 0.25 m below to `up` (collision file: slopeClearanceUp, 0.35 m) above the ramp face, within
// `edge` (slopeEdgeMargin, 0.1 m) of its outline in plan. Walls and floors that only pass through the skin
// are cut there (pieces down to 15 cm), so what is above the skin still blocks.
// Bullets still hit the visible stairs (the projectile set is not touched).
const COS_WALKABLE = Math.cos(44.765 * Math.PI / 180); // same limit as the game's walkable slope
const COS_FLAT = Math.cos(3 * Math.PI / 180); // flatter than this is a floor, not a ramp
const CELL = 0.5;
const DOWN = 0.25; // metres below the ramp face that still count (step risers reach under it)
const MIN_PIECE = 0.15; // metres; smaller mixed pieces are decided by their centre
const MAX_DEPTH = 8;

// Never let this stop a map from loading: on any error the visible meshes are used as they are.
export function cleanRampArt(volumes, art, doc) {
  try { return filterRampArt(volumes, art, doc); } catch (error) { console.error("ramp-art-filter:", error); return art; }
}

function filterRampArt(volumes, art, doc) {
  if (!volumes || !art || art.length === 0 || volumes.length === 0) return art;
  const up = Number.isFinite(doc?.slopeClearanceUp) ? Math.max(0.2, doc.slopeClearanceUp) : 0.35;
  const edge = Number.isFinite(doc?.slopeEdgeMargin) ? Math.max(0, doc.slopeEdgeMargin) : 0.1;

  // 1. the ramps: sloped walkable faces of the collision volumes
  const ramps = []; // per ramp: 3 plan points (x, z), plane (y = py - (nx (x - px) + nz (z - pz)) / ny)
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (let i = 0; i + 8 < volumes.length; i += 9) {
    const ax = volumes[i + 3] - volumes[i], ay = volumes[i + 4] - volumes[i + 1], az = volumes[i + 5] - volumes[i + 2];
    const bx = volumes[i + 6] - volumes[i], by = volumes[i + 7] - volumes[i + 1], bz = volumes[i + 8] - volumes[i + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz);
    if (!(len > 0)) continue;
    nx /= len; ny /= len; nz /= len;
    if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    if (ny < COS_WALKABLE || ny > COS_FLAT) continue;
    const reach = edge;
    const r = { i, nx, ny, nz, x0: 0, x1: 0, z0: 0, z1: 0, y0: Math.min(volumes[i + 1], volumes[i + 4], volumes[i + 7]), y1: Math.max(volumes[i + 1], volumes[i + 4], volumes[i + 7]) };
    r.x0 = Math.min(volumes[i], volumes[i + 3], volumes[i + 6]) - reach; r.x1 = Math.max(volumes[i], volumes[i + 3], volumes[i + 6]) + reach;
    r.z0 = Math.min(volumes[i + 2], volumes[i + 5], volumes[i + 8]) - reach; r.z1 = Math.max(volumes[i + 2], volumes[i + 5], volumes[i + 8]) + reach;
    if (r.x0 < minX) minX = r.x0; if (r.x1 > maxX) maxX = r.x1; if (r.z0 < minZ) minZ = r.z0; if (r.z1 > maxZ) maxZ = r.z1;
    ramps.push(r);
  }
  if (ramps.length === 0) return art;

  // 2. grid of ramp ids
  const cols = Math.floor((maxX - minX) / CELL) + 1, rows = Math.floor((maxZ - minZ) / CELL) + 1;
  const count = new Int32Array(cols * rows + 1);
  const span = (r) => [Math.floor((r.x0 - minX) / CELL), Math.floor((r.x1 - minX) / CELL), Math.floor((r.z0 - minZ) / CELL), Math.floor((r.z1 - minZ) / CELL)];
  for (const r of ramps) { const [c0, c1, r0, r1] = span(r); for (let c = c0; c <= c1; c++) for (let w = r0; w <= r1; w++) count[c * rows + w + 1]++; }
  for (let k = 0; k < cols * rows; k++) count[k + 1] += count[k];
  const fill = count.slice(0, cols * rows), ids = new Int32Array(count[cols * rows]);
  ramps.forEach((r, id) => { const [c0, c1, r0, r1] = span(r); for (let c = c0; c <= c1; c++) for (let w = r0; w <= r1; w++) ids[fill[c * rows + w]++] = id; });

  // squared plan distance from (x, z) to segment a-b
  const segDist2 = (x, z, ax, az, bx, bz) => {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    let t = l2 > 0 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + dx * t - x, pz = az + dz * t - z; return px * px + pz * pz;
  };
  const edge2 = edge * edge;
  const inSkin = (x, y, z) => {
    const c = Math.floor((x - minX) / CELL), w = Math.floor((z - minZ) / CELL);
    if (c < 0 || w < 0 || c >= cols || w >= rows) return false;
    const cell = c * rows + w;
    for (let k = count[cell], e = count[cell + 1]; k < e; k++) {
      const r = ramps[ids[k]], i = r.i;
      if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
      // height above the ramp surface; past its ends the surface carries on level (floor below, landing above)
      let sy = volumes[i + 1] - (r.nx * (x - volumes[i]) + r.nz * (z - volumes[i + 2])) / r.ny;
      sy = sy < r.y0 ? r.y0 : sy > r.y1 ? r.y1 : sy;
      const h = y - sy;
      if (h < -DOWN || h > up) continue;
      const x1 = volumes[i], z1 = volumes[i + 2], x2 = volumes[i + 3], z2 = volumes[i + 5], x3 = volumes[i + 6], z3 = volumes[i + 8];
      const d = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
      if (d !== 0) {
        const a = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / d, b = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / d;
        if (a >= 0 && b >= 0 && a + b <= 1) return true;
      }
      // or just outside the outline
      if (edge > 0 && (segDist2(x, z, x1, z1, x2, z2) <= edge2 || segDist2(x, z, x2, z2, x3, z3) <= edge2 || segDist2(x, z, x3, z3, x1, z1) <= edge2)) return true;
    }
    return false;
  };
  const nearRamp = (x0, x1, z0, z1) => {
    const c0 = Math.max(0, Math.floor((x0 - minX) / CELL)), c1 = Math.min(cols - 1, Math.floor((x1 - minX) / CELL));
    const r0 = Math.max(0, Math.floor((z0 - minZ) / CELL)), r1 = Math.min(rows - 1, Math.floor((z1 - minZ) / CELL));
    for (let c = c0; c <= c1; c++) for (let w = r0; w <= r1; w++) if (count[c * rows + w + 1] > count[c * rows + w]) return true;
    return false;
  };

  // 3. the visible triangles
  let out = new Float32Array(art.length), n = 0;
  const push = (ax, ay, az, bx, by, bz, cx, cy, cz) => {
    if (n + 9 > out.length) { const bigger = new Float32Array(out.length + Math.max(36864, out.length >> 3)); bigger.set(out.subarray(0, n)); out = bigger; }
    out[n] = ax; out[n + 1] = ay; out[n + 2] = az; out[n + 3] = bx; out[n + 4] = by; out[n + 5] = bz; out[n + 6] = cx; out[n + 7] = cy; out[n + 8] = cz; n += 9;
  };
  // 0 = keep whole, 1 = drop whole, 2 = mixed (kept pieces already pushed)
  const split = (ax, ay, az, bx, by, bz, cx, cy, cz, depth) => {
    const mx = (ax + bx + cx) / 3, my = (ay + by + cy) / 3, mz = (az + bz + cz) / 3;
    const abx = (ax + bx) / 2, aby = (ay + by) / 2, abz = (az + bz) / 2, bcx = (bx + cx) / 2, bcy = (by + cy) / 2, bcz = (bz + cz) / 2, cax = (cx + ax) / 2, cay = (cy + ay) / 2, caz = (cz + az) / 2;
    const mid = inSkin(mx, my, mz);
    const inside = (mid ? 1 : 0) + (inSkin(ax, ay, az) ? 1 : 0) + (inSkin(bx, by, bz) ? 1 : 0) + (inSkin(cx, cy, cz) ? 1 : 0) + (inSkin(abx, aby, abz) ? 1 : 0) + (inSkin(bcx, bcy, bcz) ? 1 : 0) + (inSkin(cax, cay, caz) ? 1 : 0);
    const longest = Math.sqrt(Math.max((bx - ax) ** 2 + (by - ay) ** 2 + (bz - az) ** 2, (cx - bx) ** 2 + (cy - by) ** 2 + (cz - bz) ** 2, (ax - cx) ** 2 + (ay - cy) ** 2 + (az - cz) ** 2));
    if (inside === 7) return 1;
    if (inside === 0 && longest <= CELL) return 0;
    if (longest <= MIN_PIECE || depth >= MAX_DEPTH) return mid ? 1 : 0;
    const a = split(ax, ay, az, abx, aby, abz, cax, cay, caz, depth + 1), b = split(abx, aby, abz, bx, by, bz, bcx, bcy, bcz, depth + 1);
    const c = split(cax, cay, caz, bcx, bcy, bcz, cx, cy, cz, depth + 1), d = split(abx, aby, abz, bcx, bcy, bcz, cax, cay, caz, depth + 1);
    if (a === 0 && b === 0 && c === 0 && d === 0) return 0;
    if (a === 1 && b === 1 && c === 1 && d === 1) return 1;
    if (a === 0) push(ax, ay, az, abx, aby, abz, cax, cay, caz);
    if (b === 0) push(abx, aby, abz, bx, by, bz, bcx, bcy, bcz);
    if (c === 0) push(cax, cay, caz, bcx, bcy, bcz, cx, cy, cz);
    if (d === 0) push(abx, aby, abz, bcx, bcy, bcz, cax, cay, caz);
    return 2;
  };
  for (let i = 0; i + 8 < art.length; i += 9) {
    const ax = art[i], ay = art[i + 1], az = art[i + 2], bx = art[i + 3], by = art[i + 4], bz = art[i + 5], cx = art[i + 6], cy = art[i + 7], cz = art[i + 8];
    if (nearRamp(Math.min(ax, bx, cx), Math.max(ax, bx, cx), Math.min(az, bz, cz), Math.max(az, bz, cz))
      && split(ax, ay, az, bx, by, bz, cx, cy, cz, 0) !== 0) continue;
    push(ax, ay, az, bx, by, bz, cx, cy, cz);
  }
  return out.subarray(0, n);
}
