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
  return {
    id,
    image: `/aim-maps/${mini.image}`,
    // world (x, z) -> picture (u, v) in 0..1, and back
    toUV: (x, z) => ({ u: x * t.scaleU + t.offsetU, v: z * t.scaleV + t.offsetV }),
    fromUV: (u, v) => ({ x: (u - t.offsetU) / t.scaleU, z: (v - t.offsetV) / t.scaleV }),
    levelsAt: (x, z) => levelsAt(floors, x, z),
    // Triangles for the 3D view: walkable floors and solid collision (flat x,y,z lists).
    meshes: { nav: floors.nav ? floors.nav.tris : null, solid: floors.solid.tris },
  };
}
