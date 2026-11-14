// Corrode's captured projectile set includes 16 invisible partition sheets: thin
// SuperGrid_Box planes about 85 m tall that start 4.7 m up (head height above the
// 3 m floor) and run along the building lines into the sky. Where they cross an
// arch, tunnel or doorway they stop head-height shots and leave bullet holes in
// the air, while players walk through (they are not in the pawn set). The first
// fix removed the two B main / site ones by exact transform; this removes them
// all by shape. Match geometry, not array indices: an updated map pack may reorder
// its colliders. All other sets, other colliders and visible art stay intact.
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

export function applyMapCollisionFixes(document) {
  if (document?.map !== 'rook') return document;
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
