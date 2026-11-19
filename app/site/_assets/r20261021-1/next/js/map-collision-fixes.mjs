// Corrode (map id "rook") collision fixes, applied to the collision document before the game builds
// its collision (DF in BiMsX6Xn.js). This site/ copy replaces base/_assets/.../map-collision-fixes.mjs
// (backup: backups/corrode-a-rails-2026-11-18/). Two fixes:
//
// 1. Projectile partition sheets (unchanged from the base copy): the captured projectile set includes 16
//    invisible partition sheets: thin SuperGrid_Box planes about 85 m tall that start 4.7 m up (head
//    height above the 3 m floor) and run along the building lines into the sky. Where they cross an
//    arch, tunnel or doorway they stop head-height shots and leave bullet holes in the air, while
//    players walk through (they are not in the pawn set). Removed by shape, not array index.
//
// 2. Grass tufts (corrode-grass-v1, 18 Nov 2026): the 58 Ground_GrassClump_01/02/03 meshes (thin grass
//    cards 0.27-0.65 m tall, mostly along the train tracks in A Main / A yard) were missing from the
//    export's noCollision list, so every tuft was solid: one taller than the 0.45 m step stopped the
//    player dead on open floor, lower ones made him bump up and over. Valorant has no collision on grass.
//    Adding their mesh names to noCollision drops them from both the walk and the projectile collision
//    (bullets pass through grass too). They are still drawn.
const SHEET_MIN_HEIGHT = 40; // metres; real walls and boxes are far shorter
const SHEET_MAX_THICKNESS = 0.5; // metres

function isPartitionSheet(primitive, matrix) {
  if (primitive?.name !== 'SuperGrid_Box' || !Array.isArray(primitive.pos)) return false;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < primitive.pos.length; v += 3) {
    const x = primitive.pos[v], y = primitive.pos[v + 1], z = primitive.pos[v + 2];
    for (let k = 0; k < 3; k++) {
      const w = matrix[k * 4] * x + matrix[k * 4 + 1] * y + matrix[k * 4 + 2] * z + matrix[k * 4 + 3];
      if (w < min[k]) min[k] = w;
      if (w > max[k]) max[k] = w;
    }
  }
  const height = max[1] - min[1], thickness = Math.min(max[0] - min[0], max[2] - min[2]);
  return height > SHEET_MIN_HEIGHT && thickness < SHEET_MAX_THICKNESS;
}

function removePartitionSheets(document) {
  const projectile = document.sets?.projectile;
  if (!projectile || !Array.isArray(projectile.prim) || !Array.isArray(projectile.m)
      || projectile.prim.length !== projectile.count || projectile.m.length !== projectile.count * 12) return document;

  const prim = [], m = [];
  let removedTriangles = 0;
  for (let instance = 0; instance < projectile.count; instance++) {
    const primitiveId = projectile.prim[instance];
    const primitive = document.prims?.[primitiveId];
    const matrix = projectile.m.slice(instance * 12, instance * 12 + 12);
    if (isPartitionSheet(primitive, matrix)) {
      removedTriangles += primitive.tris ?? 0;
      continue;
    }
    prim.push(primitiveId);
    m.push(...matrix);
  }
  if (prim.length === projectile.count) return document;
  return {
    ...document,
    sets: {
      ...document.sets,
      projectile: { ...projectile, count: prim.length, tris: projectile.tris - removedTriangles, prim, m },
    },
  };
}

// noCollision is matched against the exact mesh name before '#', so every placed copy is listed.
const GRASS_CLUMPS = {
  Ground_GrassClump_01: [2208, 2209, 5813, 5814, 5815, 5816, 5817, 5818, 5819, 5820, 5895, 5900, 5902, 5907, 5909],
  Ground_GrassClump_02: [2347, 5821, 5822, 5823, 5824, 5825, 5826, 5827, 5828, 5829, 5830, 5831, 5832, 5833, 5834,
    5835, 5892, 5893, 5894, 5896, 5897, 5898, 5899, 5901, 5908, 5912],
  Ground_GrassClump_03: [2348, 5836, 5837, 5838, 5839, 5840, 5841, 5842, 5843, 5844, 5903, 5904, 5905, 5906, 5910,
    5911, 5913],
};
const GRASS_NAMES = Object.entries(GRASS_CLUMPS).flatMap(([mesh, copies]) => copies.map((c) => `${mesh}__c${c}`));

function grassWithoutCollision(document) {
  const list = Array.isArray(document.noCollision) ? document.noCollision : [];
  const have = new Set(list), add = GRASS_NAMES.filter((n) => !have.has(n));
  return add.length ? { ...document, noCollision: [...list, ...add] } : document;
}

export function applyMapCollisionFixes(document) {
  if (document?.map !== 'rook') return document;
  return grassWithoutCollision(removePartitionSheets(document));
}
