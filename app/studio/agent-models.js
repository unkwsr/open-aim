// Character models for the Studio's Detailed view: the same mesh and picture the game uses for a
// bot's look (agents, Phoenix, training bots), posed by the game in its unarmed standing (or
// crouching) pose, holding nothing.
// The game hands them over with aimStudioAgent (patch "studio-agent-model" in CnrSARj_.js).
import * as THREE from "./vendor/three.module.js";

const GAME = "/_assets/r20261021-1/next/js/CnrSARj_.js";
// The game's meshes are Z-up, facing +X, in centimetres; the game draws them at 0.01 (about 2 m),
// so Studio uses the same size.
const SCALE = 0.01;
const cache = new Map(); // look -> Promise<{ geometry, material } | null>
const loaded = new Map(); // look -> { geometry, material } | null, once its promise has settled

function toGeometry(mesh) {
  const p = mesh.positions, n = mesh.normals, count = p.length / 3;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
  // Game mesh (x forward, y left, z up) -> Studio (-z forward, x right, y up): the game's own turn
  // (mesh x -> its +z forward) plus a half turn, since Studio's pill faces -z. Faces like the nose.
  for (let i = 0; i < count; i++) {
    const o = i * 3;
    pos[o] = p[o + 1] * SCALE; pos[o + 1] = p[o + 2] * SCALE; pos[o + 2] = -p[o] * SCALE;
    nor[o] = n[o + 1]; nor[o + 1] = n[o + 2]; nor[o + 2] = -n[o];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(mesh.uvs, 2));
  g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  g.computeBoundingSphere();
  return g;
}

async function load(look, crouch) {
  const game = await import(GAME);
  if (!game.aimStudioAgent) return null;
  const found = await game.aimStudioAgent(look, crouch);
  if (!found) return null;
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0, side: THREE.DoubleSide });
  // The picture comes in the background; the model shows plain until then.
  found.albedo.then((blob) => createImageBitmap(blob, { imageOrientation: "none" })).then((bitmap) => {
    const texture = new THREE.Texture(bitmap);
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    material.map = texture;
    material.needsUpdate = true;
  }).catch(() => {});
  const geometry = toGeometry(found.mesh);
  // Shared by every bot with this look: the 3D view must not dispose them.
  geometry.userData.studioShared = true; material.userData.studioShared = true;
  return { geometry, material };
}

// Resolves to { geometry, material } (shared, don't dispose) or null when there is no model.
export function agentModel(look, crouch = false) {
  const key = `${look || "phoenix"}|${crouch ? "crouch" : "stand"}`;
  let entry = cache.get(key);
  if (!entry) {
    entry = load(look || "phoenix", crouch).catch(() => null);
    cache.set(key, entry);
    entry.then((model) => loaded.set(key, model));
  }
  return entry;
}

// The same, without waiting: the model (or null: there is none) when it has loaded, undefined until then.
export function agentModelNow(look, crouch = false) {
  return loaded.get(`${look || "phoenix"}|${crouch ? "crouch" : "stand"}`);
}
