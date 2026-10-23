// Corrode's captured projectile set includes two invisible B-site partition
// planes. They stop otherwise unobstructed shots between B main and site.
// Match the captured transforms, not array indices: an updated map pack may
// reorder or replace its colliders. All other sets and visible art stay intact.
const CORRODE_B_PARTITIONS = [
  [0, 0, -0.0015, -5.941614, 0.846259, 0, 0, 4.749741, 0, 1.220808, 0, 20.398633],
  [0, -0.206696, 0, -5.934332, 0.846243, 0, 0, 4.749744, -0.000016, 0, -0.0015, 20.49586],
];

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
    const offset = instance * 12;
    const partition = primitive?.name === 'SuperGrid_Box' && primitive.tris === 12
      && primitive.idx?.length === 36
      && CORRODE_B_PARTITIONS.some(matrix => matrix.every((value, index) => value === projectile.m[offset + index]));
    if (partition) {
      removedTriangles += primitive.tris;
      continue;
    }
    prim.push(primitiveId);
    m.push(...projectile.m.slice(offset, offset + 12));
  }
  if (!removedTriangles) return document;
  return {
    ...document,
    sets: {
      ...document.sets,
      projectile: { ...projectile, count: prim.length, tris: projectile.tris - removedTriangles, prim, m },
    },
  };
}
