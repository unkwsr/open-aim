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
  const piece = []; // which collision piece (one box, slope, ...) the triangle belongs to
  let pieces = 0;
  for (const setName of setNames) {
    const set = collision.sets[setName];
    if (!set) continue;
    for (let n = 0; n < set.count; n++) {
      const prim = collision.prims[set.prim[n]];
      if (!keep(prim)) continue;
      pieces++;
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
        piece.push(pieces);
      }
    }
  }
  return { tris, up, piece };
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

// Blocking volumes ("Box_For_Volumes" etc.) are most of the player collision on every map: crates, boxes,
// walls, ledges. On maps with a navigation mesh they used to be left out because some of them cap the sky,
// so on Lotus, Haven, Icebox and Fracture (little or no "greybox" prop data) nothing could be placed on a
// box. 13 Nov 2026 (studio-volume-tops): their tops count when they are at most VOLUME_TOP metres above
// walkable floor at or near them (crates, walls, ledges); higher ones (sky caps, tall invisible blockers)
// stay out of placement. Their sides and undersides always count as ceilings for the headroom check.
const VOLUME_TOP = 6;
const NEAR_RING = [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5], [3, 0], [-3, 0], [0, 3], [0, -3], [2.1, 2.1], [-2.1, 2.1], [2.1, -2.1], [-2.1, -2.1]];

function buildFloors(collision) {
  const nav = triangles(collision, ["gameplay"], (prim) => /navmesh/i.test(prim.name));
  const sets = [...(collision.walkSets || ["pawn"]), "greybox"];
  if (!nav.up.length) {
    // No navigation mesh: all player collision, volumes included (some maps build their floors from them).
    return { nav: null, solid: bucket(triangles(collision, sets, () => true)) };
  }
  const navB = bucket(nav);
  const base = triangles(collision, sets, (prim) => !/volume/i.test(prim.name));
  const vol = triangles(collision, sets, (prim) => /volume/i.test(prim.name));
  for (let t = 0; t < vol.up.length; t++) {
    if (!vol.up[t]) continue;
    const o = t * 9, T = vol.tris;
    const x = (T[o] + T[o + 3] + T[o + 6]) / 3, y = Math.max(T[o + 1], T[o + 4], T[o + 7]), z = (T[o + 2] + T[o + 5] + T[o + 8]) / 3;
    const span = Math.max(Math.abs(T[o] - T[o + 3]), Math.abs(T[o] - T[o + 6]), Math.abs(T[o + 2] - T[o + 5]), Math.abs(T[o + 2] - T[o + 8]));
    // Walkable floor under or beside it (nav meshes leave holes under props), within VOLUME_TOP below.
    const ok = span < 60 && NEAR_RING.some(([dx, dz]) => surfacesAt(navB, x + dx, z + dz).some((s) => { const d = y - (s.y - NAV_LIFT); return d > -0.5 && d <= VOLUME_TOP; }));
    // 2: a real top, but too high to be clicked blind (studio-placement: the Detailed view, which knows
    // what you see, can still stand things on it).
    if (!ok) vol.up[t] = 2;
  }
  // studio-placement: the whole of every blocking box, slope or pillar whose top can be clicked onto, for the
  // 3D view to draw. They used to be invisible there, so a bot put on one looked like it stood in the air.
  const solid = bucket({ tris: base.tris.concat(vol.tris), up: base.up.concat(vol.up) });
  const floors = { nav: navB, solid }, shown = new Set(), off = base.up.length;
  for (let t = 0; t < vol.up.length; t++) if (vol.up[t] === 1 && !shown.has(vol.piece[t]) && hasFloorBelow(floors, solid.tris, off + t)) shown.add(vol.piece[t]);
  floors.volumes = [];
  for (let t = 0; t < vol.up.length; t++) if (shown.has(vol.piece[t])) for (let k = 0; k < 9; k++) floors.volumes.push(vol.tris[t * 9 + k]);
  return floors;
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

// Pearl: the same kind of floor, but measured at the grid's corners and drawn with marching
// squares, so outlines cut across cells (diagonal and curved walls come out as straight lines,
// not staircases) and ramps slope between corners instead of stepping down cell by cell.
const SMOOTH_FLOOR = new Set(["pitt"]);
const WALL = 3.5; // height of the walls drawn along the floor's outer edge
const WALL_T = 0.6; // their thickness
const STEP = 0.6; // corners further apart than this in height are a ledge, not one floor
function smoothFloor(floors, mask, lowest, walls = []) {
  const { x0, z0, x1, z1 } = mask.bounds;
  const nx = Math.ceil((x1 - x0) / GRID) + 1, nz = Math.ceil((z1 - z0) / GRID) + 1;
  const H = new Float32Array(nx * nz).fill(NaN);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * GRID, z = z0 + j * GRID;
    if (!mask.at(x, z)) continue;
    const y = levelsAt(floors, x, z).find((l) => l >= lowest - 1 && l <= lowest + BAND);
    if (y !== undefined) H[j * nx + i] = y;
  }
  // Tiny islands (box tops, pillars, stray ledges): take the floor around them, or drop them.
  const seen = new Uint8Array(nx * nz);
  for (let start = 0; start < H.length; start++) {
    if (seen[start] || Number.isNaN(H[start])) continue;
    const pts = [start], border = [];
    seen[start] = 1;
    for (let q = 0; q < pts.length; q++) {
      const c = pts[q], ci = c % nx, cj = (c - ci) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
        const n = j * nx + i;
        if (Number.isNaN(H[n])) continue;
        if (Math.abs(H[n] - H[c]) > STEP) { border.push(H[n]); continue; }
        if (!seen[n]) { seen[n] = 1; pts.push(n); }
      }
    }
    if (pts.length >= ISLAND) continue;
    const fill = border.length ? Math.min(...border) : NaN;
    for (const c of pts) H[c] = fill;
  }
  const out = [];
  const tri = (a, b, c) => out.push(...a, ...b, ...c);
  const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
  for (let j = 0; j + 1 < nz; j++) for (let i = 0; i + 1 < nx; i++) {
    // Corners around the square, in order: (i,j) (i+1,j) (i+1,j+1) (i,j+1).
    const cx = [x0 + i * GRID, x0 + (i + 1) * GRID, x0 + (i + 1) * GRID, x0 + i * GRID];
    const cz = [z0 + j * GRID, z0 + j * GRID, z0 + (j + 1) * GRID, z0 + (j + 1) * GRID];
    const ch = [H[j * nx + i], H[j * nx + i + 1], H[(j + 1) * nx + i + 1], H[(j + 1) * nx + i]];
    const valid = ch.map((y) => !Number.isNaN(y));
    if (!valid.some(Boolean)) continue;
    // Corners joined along the square's sides at about the same height are one floor piece.
    const group = [-1, -1, -1, -1];
    let groups = 0;
    for (let k = 0; k < 4; k++) {
      if (!valid[k] || group[k] >= 0) continue;
      group[k] = groups;
      for (let changed = true; changed; ) {
        changed = false;
        for (let m = 0; m < 4; m++) {
          if (group[m] !== groups) continue;
          for (const n of [(m + 1) % 4, (m + 3) % 4]) {
            if (valid[n] && group[n] < 0 && Math.abs(ch[n] - ch[m]) <= STEP) { group[n] = groups; changed = true; }
          }
        }
      }
      groups++;
    }
    for (let g = 0; g < groups; g++) {
      // Walk around the square: this piece's corners, plus the middle of each side it leaves on.
      const poly = []; // [x, y, z, isCut]
      for (let k = 0; k < 4; k++) {
        const n = (k + 1) % 4;
        if (group[k] === g) poly.push([cx[k], ch[k], cz[k], false]);
        if ((group[k] === g) !== (group[n] === g)) {
          const own = group[k] === g ? k : n;
          poly.push([(cx[k] + cx[n]) / 2, ch[own], (cz[k] + cz[n]) / 2, true]);
        }
      }
      for (let t = 1; t + 1 < poly.length; t++) tri(poly[0].slice(0, 3), poly[t].slice(0, 3), poly[t + 1].slice(0, 3));
      // Edge of the piece inside the square (between two side middles): a slab face down to the
      // floor beside it, or SLAB deep where nothing is.
      const others = ch.filter((y, k) => valid[k] && group[k] !== g);
      for (let t = 0; t < poly.length; t++) {
        const a = poly[t], b = poly[(t + 1) % poly.length];
        if (!a[3] || !b[3]) continue;
        const y = Math.min(a[1], b[1]);
        const n = others.length ? Math.max(...others) : NaN;
        if (!Number.isNaN(n) && n > y - 0.3) continue;
        const drop = Number.isNaN(n) ? SLAB : Math.min(SLAB, y - n);
        // Where the floor just ends (nothing beside it), a wall stands on the edge, like the
        // walls other maps show.
        if (!others.length) {
          // A thick wall with a flat top, set just outside the floor's edge.
          const own = poly.filter((p) => !p[3]);
          const gx = own.reduce((s, p) => s + p[0], 0) / own.length, gz = own.reduce((s, p) => s + p[2], 0) / own.length;
          let ox = -(b[2] - a[2]), oz = b[0] - a[0];
          const ol = Math.hypot(ox, oz) || 1;
          ox /= ol; oz /= ol;
          if (ox * ((a[0] + b[0]) / 2 - gx) + oz * ((a[2] + b[2]) / 2 - gz) < 0) { ox = -ox; oz = -oz; }
          const ia = [a[0], a[1] - drop, a[2]], ib = [b[0], b[1] - drop, b[2]];
          const ta = [a[0], a[1] + WALL, a[2]], tb = [b[0], b[1] + WALL, b[2]];
          const oa = [a[0] + ox * WALL_T, a[1] + WALL, a[2] + oz * WALL_T], ob = [b[0] + ox * WALL_T, b[1] + WALL, b[2] + oz * WALL_T];
          const fa = [oa[0], ia[1], oa[2]], fb = [ob[0], ib[1], ob[2]];
          for (const [p, q, r, s] of [[ia, ib, tb, ta], [ta, tb, ob, oa], [oa, ob, fb, fa]]) walls.push(...p, ...q, ...r, ...p, ...r, ...s);
        }
        quad([a[0], a[1], a[2]], [b[0], b[1], b[2]], [b[0], b[1] - drop, b[2]], [a[0], a[1] - drop, a[2]]);
      }
    }
  }
  return out;
}

function displayMeshes(collision, floors, inside, mask, smooth) {
  if (floors.nav) {
    const { tris } = triangles(collision, collision.walkSets || ["pawn"], (prim) => !/volume/i.test(prim.name));
    return { nav: floors.nav.tris, solid: tris.concat(floors.volumes || []) };
  }
  const lowest = lowestFloor(floors.solid, inside);
  if (mask && smooth) {
    const walls = [];
    return { nav: smoothFloor(floors, mask, lowest, walls), solid: walls };
  }
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
    out.push({ y: l1 * ay + l2 * by + l3 * cy, floor: floors.up[t] === 1, top: floors.up[t] > 0 });
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

// A top is clickable when some floor (navigation mesh, or another upward collision face) lies 0.3 to
// VOLUME_TOP metres below it, straight under it or within 3 m beside it.
function hasFloorBelow(floors, T, t) {
  const o = t * 9, y = Math.max(T[o + 1], T[o + 4], T[o + 7]);
  const x = (T[o] + T[o + 3] + T[o + 6]) / 3, z = (T[o + 2] + T[o + 5] + T[o + 8]) / 3;
  const span = Math.max(Math.abs(T[o] - T[o + 3]), Math.abs(T[o] - T[o + 6]), Math.abs(T[o + 2] - T[o + 5]), Math.abs(T[o + 2] - T[o + 8]));
  if (span >= 60) return false;
  const below = (s, lift) => { const d = y - (s.y - lift); return d > 0.3 && d <= VOLUME_TOP; };
  for (const [dx, dz] of NEAR_RING) {
    if (floors.nav && surfacesAt(floors.nav, x + dx, z + dz).some((s) => d0(y, s.y - NAV_LIFT))) return true;
    if (surfacesAt(floors.solid, x + dx, z + dz).some((s) => s.floor && below(s, 0))) return true;
  }
  return false;
}
const d0 = (y, f) => y - f > -0.5 && y - f <= VOLUME_TOP;

// Loads everything the Studio needs for one map. load(url) returns parsed JSON.
export async function loadMap(id, load) {
  const [mini, collision] = await Promise.all([load(`/aim-maps/${id}.minimap.json`), load(`/aim-maps/${id}.collision.json`)]);
  const floors = buildFloors(collision);
  const t = mini.transform;
  const mask = await readMask(`/aim-maps/${mini.image}`, t);
  let topTris = null;
  return {
    id,
    // Upward faces of the map's collision (box and pillar tops, ledges, floors), flat x,y,z list.
    // The 3D view clicks onto these, so you can place things on top of them like in 2D.
    get topTris() {
      if (!topTris) {
        // studio-volume-tops: only tops with a floor at most VOLUME_TOP below them (at or beside the spot),
        // so roofs-over-roofs and invisible sky caps (Pearl, Corrode) don't catch clicks meant for the box below.
        const { tris, up } = floors.solid, out = [];
        for (let t = 0; t < up.length; t++) if (up[t] === 1 && hasFloorBelow(floors, tris, t)) for (let k = 0; k < 9; k++) out.push(tris[t * 9 + k]);
        topTris = new Float32Array(out);
      }
      return topTris;
    },
    image: `/aim-maps/${mini.image}`,
    // world (x, z) -> picture (u, v) in 0..1, and back
    toUV: (x, z) => ({ u: x * t.scaleU + t.offsetU, v: z * t.scaleV + t.offsetV }),
    fromUV: (u, v) => ({ x: (u - t.offsetU) / t.scaleU, z: (v - t.offsetV) / t.scaleV }),
    levelsAt: (x, z) => levelsAt(floors, x, z),
    // Every upward collision face at (x, z), however high (tall crates, walls, roofs). The
    // editor keeps a bot on one of these when its height matches (placed there in 3D).
    topsAt: (x, z) => surfacesAt(floors.solid, x, z).filter((s) => s.floor).map((s) => s.y),
    // studio-placement: every height something can stand on at exactly (x, z), lowest first: the walkable
    // floor there plus every upward collision face (no headroom or height filter). The 3D view matches the
    // surface under the mouse against these.
    spotsAt: (x, z) => [
      ...(floors.nav ? navLevels(floors, x, z) : []),
      ...surfacesAt(floors.solid, x, z).filter((s) => s.top).map((s) => s.y),
    ].map((y) => Math.round(y * 100) / 100).sort((a, b) => a - b),
    // Triangles for the 3D view: walkable floors and a few solid pieces (flat x,y,z lists).
    meshes: displayMeshes(collision, floors, (x, z) => {
      const u = x * t.scaleU + t.offsetU, v = z * t.scaleV + t.offsetV;
      return u >= 0 && u <= 1 && v >= 0 && v <= 1;
    }, mask, SMOOTH_FLOOR.has(id)),
    // Playable area from the minimap picture (null outside the browser).
    mask,
  };
}
