// Fingerprint of a text: 16 hex characters from two independent 32-bit mixes over its UTF-16 code units.
// Used to recognise old stored values (app/mods/aim-legacy/legacy-fingerprints.json) without keeping the values
// themselves. The same text always gives the same fingerprint; changing this function invalidates that file
// (rebuild it with tools/zero-chinese/fingerprint-legacy.mjs).
export function fingerprint(text) {
  let a = 0xdeadbeef, b = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 2654435761);
    b = Math.imul(b ^ c, 1597334677);
  }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return (b >>> 0).toString(16).padStart(8, "0") + (a >>> 0).toString(16).padStart(8, "0");
}
