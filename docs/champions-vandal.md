# Champions Vandal — isolated test copy

Launch `Start Test Game.cmd` from C:/Users/hate/Desktop/aimtrainer-test. The Vandal now uses the supplied Champions model and texture. This is the default Vandal appearance in this copy; the main project and its executables were not modified.

## Source and conversion

Input: C:/Users/hate/Desktop/skins/source/champions vandal.glb. The embedded JPEG matches the model material and is installed as champions-vandal.jpg. The input GLB has 223,170 triangles and no skeleton or animation clips. Meshoptimizer reduced the render mesh to 24,000 triangles with UV attributes preserved. The model was fitted to the original Vandal coordinate system with a uniform scale and a handedness-preserving axis rotation.

The existing weapon manifest, hands, skeleton, animation clips, locomotion and equip files remain in use. The magazine was separated from the supplied fused mesh and bound to the existing magazine bones for reloading. This adds the supplied visual model and texture; it uses the game's existing sounds and animations.

## Files

- app/mods/aim-viewmodel/viewmodel.json: skin metadata, geometry counts and binary offsets.
- app/mods/aim-viewmodel/viewmodel.bin: new weapon and magazine geometry; unchanged original arms and animation data.
- app/mods/aim-viewmodel/champions-vandal.jpg: original embedded GLB texture.
- tools/skin-converter/import-champions.mjs: reproducible conversion; uses meshoptimizer 1.3.0 as a separate build-time tool, not a game runtime dependency.
- tools/skin-converter/validate-import.mjs: geometry, binary-layout, and animation-preservation checks.
- tools/skin-converter/import-report.json: source SHA-256, triangle counts and fit transform.

## Validation performed

Opened this copy in the real Electron game. Visually checked the skin and sight alignment in Micro Flicks. Fired live shots. Created an isolated-profile Studio drill named Champions Vandal Test with finite ammo. Emptied a 25-round magazine, observed automatic reloading with the new model, and confirmed the magazine returned to 25 rounds. Brief range samples showed approximately 234–240 FPS, including 240 during the captured reload; this is not a controlled performance comparison or a guarantee across maps.

The R-key input did not trigger reload through the automation interface, so the verified reload test used magazine depletion and automatic reload. Original animation data preservation is checked byte-for-byte. No gameplay damage, recoil, spread, score or timing rules were changed.

To reproduce asset checks, run `node tools/skin-converter/validate-import.mjs` from this copy. To regenerate, run `node tools/skin-converter/import-champions.mjs "C:/Users/hate/Desktop/skins/source/champions vandal.glb"`.

## Raised-detail size correction

Reduced the oversized receiver fins and rear carry-loop highlighted in the user screenshot. The adjustment lowers receiver detail above its base, tapers the rear loop vertically and across its width, and blends into the fused mesh. The original fit transform is retained so the gun body, hands, and weapon position do not shift. Normals are regenerated after the geometry change. Confirmed the smaller details in the real test game; asset validation passed. The supplied source GLB remains unchanged.

## Restored contour and clarity revision

Supersedes the earlier strong flattening. Receiver protrusion height is now reduced by only 15%; rear protrusion height by 15% and width by up to 12%, with the same gentle transitions and original fit. The mesh now retains 24,000 triangles and uses smooth normals calculated from the dense source geometry. The unchanged source texture is 4096 by 4096; its sampling now uses anisotropy 8, clamped to the hardware limit by Three.js. This improves clarity at oblique angles without inventing texture detail. Both loader URL layouts are overridden under app/mods; other weapon textures retain their original sampling.

Rechecked live firing and automatic reload in the test drill after this revision. The captured reload showed 240 FPS, which is a brief observation rather than a controlled benchmark. Some softness is inherent to the supplied generated texture.

## Gameplay-reference sight proportions

Used the user-supplied VALORANT screenshot as a proportion reference. Receiver projections now retain 60% of their protruding height and at least 75% of their width, with a smooth taper; rear projections retain 70% of their height and width. The fit, main receiver, hands, 24,000-triangle detail level, and anisotropic texture filtering remain in place. Inspected the revised profile in the real game at the test drill start screen. The supplied generated GLB differs geometrically from the original game asset, so this is a proportion adjustment rather than an exact reconstruction of the reference.
