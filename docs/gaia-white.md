# Gaia White Vandal

Added as **Weapon skin → Gaia White**, alongside Default, RGX and Gaia Orange.
The supplied model is named `Gaia Vandal (Red).glb`; it is the white-bark variant
with red crystals. Orange remains a separate choice.

Sources are copied into `tools/skin-converter/gaia-white-source/` from the user's
`Downloads/source/` and `Downloads/textures/` folders. The supplied color, normal
and emissive PNGs are retained byte-for-byte. Their pixels are exactly the vertical
reverse of the model's embedded maps (verified with Electron nativeImage), so
the loader enables texture flipY for this variant only. Source geometry, UVs,
normals and tangents remain unchanged.

The shared Gaia importer preserves 4,961 vertices and 5,190 triangles, uses the
native Vandal arms/equip/fire/reload/ADS animations, animates the 22-vertex charging
handle, and applies the existing Gaia 1.25 display gain. No extra lights or bloom.

White and Orange share the same decoded firing buffer and five decoded Gaia
kill buffers. Firing gain is 0.55; kill gain is 0.65, relative to the native audio
master. Kills follow stages 1–5 and repeat, replacing the prior kill sound and
continuing across weapon switches. No duplicated audio files, extra sound
decodes or per-shot/per-kill requests are introduced for White.

Rebuild: `node tools/skin-converter/import-gaia.mjs --white`.

Checks passed:

- `validate-gaia-white.mjs`: all geometry attributes, source triangles, external
  texture bytes and native animation payloads preserved.
- `test-gaia-white.cjs`: idle/fire/reload/ADS/equip, charging-handle travel,
  brightness comparison, Jett compatibility, selection and legacy Champions
  fallback. White texture orientation is asserted.
- Orange Gaia fidelity/render and shared Gaia audio regression checks.
- Audio test verifies both variants use the exact same decoded shot and all five
  kill-stage buffers at the same volume, without additional network requests.

Final White idle/fire images were visually inspected. These checks ran in hidden
Electron windows; foreground gameplay and FPS are untested.
