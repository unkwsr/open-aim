// Map data for the Studio: the top-down picture of each map, how world positions line up
// with it, and the walkable floor heights under any point.
// Works in the page and in Node (for tests): pass a fetch-like loader.
//
// Floors come from the map's navigation mesh (the "gameplay" collision set), which covers
// exactly where players can walk, roofs and walls excluded. A map without one falls back to
// the upward faces of its player collision, keeping only floors with room to stand.

// Triangles are bucketed on a grid of CELL x CELL metres so a query only looks at the few
// triangles near the point.
const CELL = 2;
const HEADROOM = 1.9; // fallback: a floor counts only if a player fits on it
const NAV_LIFT = 0.07; // the navigation mesh floats this far above the floor

function triangles(collision, setNames, keep) {
  const tris = []; // flat: ax ay az bx by bz cx cy cz
  const up = []; // 1 if the triangle faces up (a floor), 0 otherwise
  for (const setName of setNames) {
    const set = collision.sets[setName];
    if (!set) continue;
    for (let n = 0; n < set.count; n++) {
      const prim = collision.prims[set.prim[n]];
      if (!keep(prim)) continue;
      const m = set.m.slice(n * 12, n * 12 + 12);
      const det =
        m[0] * (m[5] * m[10] - m[6] * m[9]) - m[1] * (m[4] * m[10] - m[6] * m[8]) + m[2] * (m[4] * m[9] - m[5] * m[8]);
      const p = prim.pos;
      const world = (i) => {
        const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
        return [m[0] * x + m[1] * y + m[2] * z + m[3], m[4] * x + m[5] * y + m[6] * z + m[7], m[8] * x + m[9] * y + m[10] * z + m[11]];
      };
      const idx = prim.idx || [...Array(prim.verts).keys()];
      for (let t = 0; t + 2 < idx.length; t += 3) {
        const a = world(idx[t]);
        let b = world(idx[t + 1]);
        let c = world(idx[t + 2]);
        if (det < 0) [b, c] = [c, b];
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const len = Math.hypot(nx, ny, nz) || 1;
        tris.push(...a, ...b, ...c);
        up.push(-ny / len > 0.55 ? 1 : 0);
      }
    }
  }
  return { tris, up };
}

function bucket({ tris, up }) {
  const grid = new Map();
  for (let t = 0; t < up.length; t++) {
    const o = t * 9;
    const xs = [tris[o], tris[o + 3], tris[o + 6]], zs = [tris[o + 2], tris[o + 5], tris[o + 8]];
    const x0 = Math.floor(Math.min(...xs) / CELL), x1 = Math.floor(Math.max(...xs) / CELL);
    const z0 = Math.floor(Math.min(...zs) / CELL), z1 = Math.floor(Math.max(...zs) / CELL);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 4000) continue; // giant volumes are not floors
    for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
      const key = gx * 100003 + gz;
      let list = grid.get(key);
      if (!list) grid.set(key, (list = []));
      list.push(t);
    }
  }
  return { tris, up, grid };
}

function buildFloors(collision) {
  const nav = triangles(collision, ["gameplay"], (prim) => /navmesh/i.test(prim.name));
  // Player collision: boxes, ledges and floors. With a navigation mesh, the invisible
  // blocking volumes are left out (they also cap the sky); without one they are kept,
  // since some maps build their floors from them.
  const solid = triangles(collision, [...(collision.walkSets || ["pawn"]), "greybox"], (prim) => !nav.up.length || !/volume/i.test(prim.name));
  return { nav: nav.up.length ? bucket(nav) : null, solid: bucket(solid) };
}

// What the 3D view draws: the walkable floor and a few low pieces, not every prop.
// The "greybox" set holds props (cars, snow banks, trees, block walls) that bury the floor
// on some maps, so it only shapes placement, not the picture. A map without a navigation
// mesh gets a floor built like one: a grid over the minimap's playable area, each cell at the
// floor height bots stand on there, with slab edges where the floor ends or steps down.
// Without the minimap picture (Node), upward faces of player collision stand in.
const BAND = 30; // metres of playable height above the lowest floor
const ROOF = 4.5; // higher than this above the floor below is a roof, not a ledge
const GRID = 0.6; // floor cell size, metres
const SLAB = 1.2; // depth of the slab edge drawn under a floor's outline
const ISLAND = 16; // floor patches smaller than this many cells are props, not floors

function lowestFloor({ tris, up }, inside) {
  const area = new Map(); // height (whole metres) -> floor area
  for (let t = 0; t < up.length; t++) {
    if (!up[t]) continue;
    const o = t * 9;
    const x = (tris[o] + tris[o + 3] + tris[o + 6]) / 3, z = (tris[o + 2] + tris[o + 5] + tris[o + 8]) / 3;
    if (!inside(x, z)) continue;
    const ux = tris[o + 3] - tris[o], uz = tris[o + 5] - tris[o + 2], vx = tris[o + 6] - tris[o], vz = tris[o + 8] - tris[o + 2];
    const a = Math.abs(ux * vz - uz * vx) / 2;
    if (a > 2000) continue; // slabs and caps far bigger than any floor
    const y = Math.floor((tris[o + 1] + tris[o + 4] + tris[o + 7]) / 3);
    area.set(y, (area.get(y) || 0) + a);
  }
  return Math.min(...[...area].filter(([, a]) => a > 100).map(([y]) => y));
}

function gridFloor(floors, mask, lowest) {
  const { x0, z0, x1, z1 } = mask.bounds;
  const nx = Math.ceil((x1 - x0) / GRID), nz = Math.ceil((z1 - z0) / GRID);
  const H = new Float32Array(nx * nz).fill(NaN);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + (i + 0.5) * GRID, z = z0 + (j + 0.5) * GRID;
    if (!mask.at(x, z)) continue;
    const y = levelsAt(floors, x, z).find((l) => l >= lowest - 1 && l <= lowest + BAND);
    if (y !== undefined) H[j * nx + i] = y;
  }
  // Tiny islands (box tops, pillars, stray ledges): take the floor around them, or drop them.
  const seen = new Uint8Array(nx * nz);
  for (let start = 0; start < H.length; start++) {
    if (seen[start] || Number.isNaN(H[start])) continue;
    const cells = [start], border = [];
    seen[start] = 1;
    for (let q = 0; q < cells.length; q++) {
      const c = cells[q], ci = c % nx, cj = (c - ci) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
        const n = j * nx + i;
        if (Number.isNaN(H[n])) continue;
        if (Math.abs(H[n] - H[c]) > 0.6) { border.push(H[n]); continue; }
        if (!seen[n]) { seen[n] = 1; cells.push(n); }
      }
    }
    if (cells.length >= ISLAND) continue;
    const fill = border.length ? Math.min(...border) : NaN;
    for (const c of cells) H[c] = fill;
  }
  const out = [];
  const quad = (a, b, c, d) => out.push(...a, ...b, ...c, ...a, ...c, ...d);
  const h = (i, j) => (i < 0 || j < 0 || i >= nx || j >= nz ? NaN : H[j * nx + i]);
  for (let j = 0; j < nz; j++) {
    const za = z0 + j * GRID, zb = za + GRID;
    for (let i = 0; i < nx; ) {
      const y = h(i, j);
      if (Number.isNaN(y)) { i++; continue; }
      let e = i + 1; // one top quad for a run of cells at the same height
      while (e < nx && Math.abs(h(e, j) - y) < 0.01) e++;
      const xa = x0 + i * GRID, xb = x0 + e * GRID;
      quad([xa, y, za], [xb, y, za], [xb, y, zb], [xa, y, zb]);
      for (let k = i; k < e; k++) {
        const ka = x0 + k * GRID, kb = ka + GRID;
        for (const [ni, nj, a, b] of [[k, j - 1, [ka, za], [kb, za]], [k, j + 1, [ka, zb], [kb, zb]], [k - 1, j, [ka, za], [ka, zb]], [k + 1, j, [kb, za], [kb, zb]]]) {
          const n = h(ni, nj);
          if (!Number.isNaN(n) && n > y - 0.3) continue;
          const low = Number.isNaN(n) ? y - SLAB : Math.max(n, y - SLAB);
          quad([a[0], y, a[1]], [b[0], y, b[1]], [b[0], low, b[1]], [a[0], low, a[1]]);
        }
      }
      i = e;
    }
  }
  return out;
}

function displayMeshes(collision, floors, inside, mask) {
  if (floors.nav) {
    const { tris } = triangles(collision, collision.walkSets || ["pawn"], (prim) => !/volume/i.test(prim.name));
    return { nav: floors.nav.tris, solid: tris };
  }
  const lowest = lowestFloor(floors.solid, inside);
  if (mask) return { nav: gridFloor(floors, mask, lowest), solid: [] };
  const { tris, up } = floors.solid;
  const out = [];
  for (let t = 0; t < up.length; t++) {
    if (!up[t]) continue;
    const o = t * 9;
    const x = (tris[o] + tris[o + 3] + tris[o + 6]) / 3, y = (tris[o + 1] + tris[o + 4] + tris[o + 7]) / 3, z = (tris[o + 2] + tris[o + 5] + tris[o + 8]) / 3;
    if (!inside(x, z) || y < lowest - 1 || y > lowest + BAND) continue;
    // Roofs: far above the lowest floor straight below them.
    const ground = surfacesAt(floors.solid, x, z).find((s) => s.floor && s.y >= lowest - 1);
    if (ground && y - ground.y > ROOF) continue;
    for (let k = 0; k < 9; k++) out.push(tris[o + k]);
  }
  return { nav: out, solid: [] };
}

const FAR = 4; // metres outside the map's outline where the backdrop starts
// The minimap picture's opaque pixels are the playable area. Browser only; null elsewhere.
async function readMask(url, t) {
  if (typeof document === "undefined") return null;
  const img = new Image();
  img.src = url;
  try { await img.decode(); } catch { return null; }
  const w = img.naturalWidth, hgt = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w; c.height = hgt;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const rgba = g.getImageData(0, 0, w, hgt).data;
  const solid = new Uint8Array(w * hgt);
  for (let p = 0; p < solid.length; p++) solid[p] = rgba[p * 4 + 3] > 40 ? 1 : 0;
  // Outside the map: non-playable pixels reachable from the picture's edge. Buildings in the
  // middle of the map are enclosed by playable floor, so they are not outside.
  const out = new Uint8Array(w * hgt), stack = [];
  const seed = (p) => { if (!solid[p] && !out[p]) { out[p] = 1; stack.push(p); } };
  for (let u = 0; u < w; u++) { seed(u); seed((hgt - 1) * w + u); }
  for (let v = 0; v < hgt; v++) { seed(v * w); seed(v * w + w - 1); }
  while (stack.length) {
    const p = stack.pop(), u = p % w;
    if (u > 0) seed(p - 1);
    if (u < w - 1) seed(p + 1);
    if (p >= w) seed(p - w);
    if (p < (hgt - 1) * w) seed(p + w);
  }
  // Far outside: outside pixels more than FAR metres from the map (chamfer distance, in pixels).
  const reach = FAR * Math.abs(t.scaleU) * w, dist = new Float32Array(w * hgt);
  for (let p = 0; p < dist.length; p++) dist[p] = out[p] ? 1e9 : 0;
  for (let v = 0; v < hgt; v++) for (let u = 0; u < w; u++) {
    const p = v * w + u;
    if (u > 0) dist[p] = Math.min(dist[p], dist[p - 1] + 1);
    if (v > 0) dist[p] = Math.min(dist[p], dist[p - w] + 1, u > 0 ? dist[p - w - 1] + 1.414 : 1e9, u < w - 1 ? dist[p - w + 1] + 1.414 : 1e9);
  }
  for (let v = hgt - 1; v >= 0; v--) for (let u = w - 1; u >= 0; u--) {
    const p = v * w + u;
    if (u < w - 1) dist[p] = Math.min(dist[p], dist[p + 1] + 1);
    if (v < hgt - 1) dist[p] = Math.min(dist[p], dist[p + w] + 1, u < w - 1 ? dist[p + w + 1] + 1.414 : 1e9, u > 0 ? dist[p + w - 1] + 1.414 : 1e9);
  }
  const px = (x, z) => [Math.floor((x * t.scaleU + t.offsetU) * w), Math.floor((z * t.scaleV + t.offsetV) * hgt)];
  const a = { x: -t.offsetU / t.scaleU, z: -t.offsetV / t.scaleV }, b = { x: (1 - t.offsetU) / t.scaleU, z: (1 - t.offsetV) / t.scaleV };
  return {
    bounds: { x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z) },
    at(x, z) { const [u, v] = px(x, z); return u >= 0 && v >= 0 && u < w && v < hgt && solid[v * w + u] === 1; },
    // More than FAR metres outside the map (off the picture counts as far).
    far(x, z) { const [u, v] = px(x, z); return u < 0 || v < 0 || u >= w || v >= hgt || dist[v * w + u] > reach; },
    // Share (0..1) of a world rectangle that lies outside the map; off the picture counts too.
    outsideShare(xa, za, xb, zb) {
      let n = 0, o = 0;
      for (let a = 0; a <= 8; a++) for (let b = 0; b <= 8; b++) {
        const [u, v] = px(xa + (xb - xa) * a / 8, za + (zb - za) * b / 8);
        n++;
        if (u < 0 || v < 0 || u >= w || v >= hgt || out[v * w + u]) o++;
      }
      return o / n;
    },
  };
}

// Heights of every surface straight above/below (x, z), lowest first.
function surfacesAt(floors, x, z) {
  const list = floors.grid.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL)) || [];
  const out = [];
  const T = floors.tris;
  for (const t of list) {
    const o = t * 9;
    const ax = T[o], ay = T[o + 1], az = T[o + 2];
    const bx = T[o + 3], by = T[o + 4], bz = T[o + 5];
    const cx = T[o + 6], cy = T[o + 7], cz = T[o + 8];
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(d) < 1e-9) continue;
    const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
    const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
    const l3 = 1 - l1 - l2;
    if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
    out.push({ y: l1 * ay + l2 * by + l3 * cy, floor: floors.up[t] === 1 });
  }
  return out.sort((a, b) => a.y - b.y);
}

const merge = (ys, gap) => {
  const out = [];
  for (const y of ys.sort((a, b) => a - b)) {
    const r = Math.round(y * 100) / 100;
    if (!out.length || r - out[out.length - 1] > gap) out.push(r);
    else out[out.length - 1] = Math.max(out[out.length - 1], r);
  }
  return out;
};

// Upward faces of solid collision with room to stand on top.
function solidLevels(bucketed, x, z) {
  const s = surfacesAt(bucketed, x, z);
  const ys = [];
  for (let i = 0; i < s.length; i++) {
    if (!s[i].floor) continue;
    const above = s.slice(i + 1).find((o) => o.y > s[i].y + 0.05);
    if (above && above.y - s[i].y < HEADROOM) continue;
    ys.push(s[i].y);
  }
  return ys;
}

const navLevels = (floors, x, z) => surfacesAt(floors.nav, x, z).map((s) => s.y - NAV_LIFT);
const AROUND = [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5], [1.1, 1.1], [-1.1, 1.1], [1.1, -1.1], [-1.1, -1.1]];

// Floor heights at (x, z) a player can stand on, lowest first: the walkable floor there,
// plus tops of boxes and ledges standing on or right next to it.
export function levelsAt(floors, x, z) {
  if (!floors.nav) return merge(solidLevels(floors.solid, x, z), 0.4);
  const here = navLevels(floors, x, z);
  const near = here.length ? here : AROUND.flatMap(([dx, dz]) => navLevels(floors, x + dx, z + dz));
  if (!near.length) return [];
  const tops = solidLevels(floors.solid, x, z).filter((y) => near.some((n) => y - n > -0.5 && y - n < 3.5));
  // Right beside the walkable floor (an edge, a prop): use the floor next to it; the game
  // drops bots and you onto whatever is really there.
  return merge(here.length || tops.length ? [...here, ...tops] : near, 0.4);
}

// Loads everything the Studio needs for one map. load(url) returns parsed JSON.
export async function loadMap(id, load) {
  const [mini, collision] = await Promise.all([load(`/aim-maps/${id}.minimap.json`), load(`/aim-maps/${id}.collision.json`)]);
  const floors = buildFloors(collision);
  const t = mini.transform;
  const mask = await readMask(`/aim-maps/${mini.image}`, t);
  return {
    id,
    image: `/aim-maps/${mini.image}`,
    // world (x, z) -> picture (u, v) in 0..1, and back
    toUV: (x, z) => ({ u: x * t.scaleU + t.offsetU, v: z * t.scaleV + t.offsetV }),
    fromUV: (u, v) => ({ x: (u - t.offsetU) / t.scaleU, z: (v - t.offsetV) / t.scaleV }),
    levelsAt: (x, z) => levelsAt(floors, x, z),
    // Triangles for the 3D view: walkable floors and a few solid pieces (flat x,y,z lists).
    meshes: displayMeshes(collision, floors, (x, z) => {
      const u = x * t.scaleU + t.offsetU, v = z * t.scaleV + t.offsetV;
      return u >= 0 && u <= 1 && v >= 0 && v <= 1;
    }, mask),
    // Playable area from the minimap picture (null outside the browser).
    mask,
  };
}
