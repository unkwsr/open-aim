// Equality is checked on final GPU float32 bits, after the original skeleton
// calculation. Changed poses, new arrays and replacement textures still upload.
const previous = new WeakMap();
export function markBoneTexture(skeleton, matrices, texture) {
  if (texture === null) return false;
  // Custom textures may not use the skeleton's matrix array. Keep their native
  // update behavior; equality of an unrelated array cannot prove an upload idle.
  if (!(matrices instanceof Float32Array) || texture.image?.data !== matrices) {
    previous.delete(skeleton);
    texture.needsUpdate = true;
    return true;
  }
  let entry = previous.get(skeleton);
  if (!entry || entry.array !== matrices || entry.texture !== texture || entry.version !== texture.version || entry.source !== texture.source || entry.sourceVersion !== texture.source?.version || entry.words.length !== matrices.length) {
    const words = new Uint32Array(matrices.buffer, matrices.byteOffset, matrices.length);
    entry = { array: matrices, texture, words, last: new Uint32Array(words.length) };
    entry.last.set(words);
    previous.set(skeleton, entry);
    texture.needsUpdate = true;
    entry.version = texture.version;
    entry.source = texture.source;
    entry.sourceVersion = texture.source?.version;
    return true;
  }
  const { words, last } = entry;
  for (let i = 0; i < words.length; i++) {
    if (words[i] !== last[i]) {
      last.set(words);
      texture.needsUpdate = true;
      entry.version = texture.version;
      entry.sourceVersion = texture.source?.version;
      return true;
    }
  }
  return false;
}
