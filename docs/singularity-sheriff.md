# Singularity Sheriff

Added only the Sheriff from `C:/Users/hate/Downloads/Singularity_Bundle.blend`.
Other bundle weapons are not exported or added to the game.

Restart this test copy with `Start Test Game.cmd`. In the existing skin settings,
choose **Sheriff skin → Singularity**, then enter a Sheriff scenario. **Default**
restores the original Sheriff on the next scene entry. The initial choice stays
Default; no player settings were edited by the import or tests.

The complete 2,451-triangle source mesh is retained, without decimation. Native
centimetre coordinates are obtained from the Blender mesh's local coordinates at
100 cm/metre; bundle display transforms are discarded. Eight functional anchors
agree with the native rig within 0.000058 cm. Additional cosmetic panel/sight bones
follow their native Root ancestor in their authored rest positions. This adds the
appearance, using the existing Sheriff animations. New Singularity panel
animations and finishers are not included. The later user-supplied skin audio is
described below.

Body color, reconstructed OpenGL normal, ORM, and emission-mask PNGs are 2048².
The purple line and triangle shaders are adapted as separate transparent material
groups, with 1024² color and alpha textures baked from the supplied UV shaders.
This is a renderer adaptation, not a promise of identical Blender lighting.
Energy texture sets load before the model is returned and are disposed with it.
Older skin manifests use their existing material path without these extra loads.

The user requested a less black body after trying the initial version. The body
material now lifts sampled albedo with exponent 0.65 and linear floor 0.022 and
uses metallic factor 0.7. This is restricted to the Singularity body; its original
textures, normals, purple emission, energy materials, geometry and animations are
unchanged. In the controlled native-renderer comparison, 36,675 pixels changed;
mean luminance of those changed pixels increased from 14.72 to 38.87 on a 0–255
scale. This describes one fixed camera/lighting fixture, not all gameplay views.
See `previews/singularity/brightness-before.png`, `brightness-after.png`, and
`tools/skin-converter/singularity-brightness-results.json`.

## Skin audio (2026-10-27)

`Downloads/singularity.WAV` is copied byte for byte as the firing sample. The five
`singularity, ep 9_1_kill.zip` / `2_kills.zip` through `5_kills.zip` archives each
provide one MP3; these are extracted without re-encoding, in numeric order.
Archive thumbnails are unused. Runtime files live in
`app/mods/media/singularity-sheriff/`; hashes and source entries are recorded in
`tools/skin-converter/singularity-audio-import.json`. Reproduce the import with
`C:/Python315/python.exe tools/skin-converter/import-singularity-audio.py`.

The files preload/decode through the existing local skin-audio bridge. Only
Sheriff with Singularity selected uses them; Default Sheriff and other weapons
retain their existing paths. Shot gain is 1 and kill gain is 0.65, consistent with
the current skin-audio convention; the native master gain/mute remains in effect.
Stages 1–5 follow kill count and repeat from 1 after stage 5. A newer kill stage
interrupts the previous kill voice. Bots retain their native weapon sounds.

The engine skin-kill guard now accepts Sheriff as well as Phantom; the narrower
bridge checks weapon and selected skin before playing anything. Both generated
engine routes and the builder retain this hook. The audio fixture verifies all
six decoded files, stage order/wrap/interruption, default switching, weapon
isolation, mute guards and no per-shot fetch after readiness. Existing Gaia and
BlastX audio regressions pass. Decoded durations: shot ~0.789 s; kills ~3.079,
3.122, 3.079, 3.079 and 6.245 s. No live gameplay loudness/feel claim is made.

The native Sheriff skeleton, attachment, arm geometry and all animation payloads
are retained. There is no captured Sheriff `.equip` asset in this checkout, so
the existing native equip fallback is retained. The model cache includes the
Sheriff selection. Both generated loader routes match; the engine cache hook is
applied to both routes and preserved by `build-audio-loader.cjs`.

## Reproduce

From the test-copy root:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --disable-autoexec 'C:/Users/hate/Downloads/Singularity_Bundle.blend' --python tools/skin-converter/export-singularity.py
node tools/skin-converter/import-singularity.mjs
& './app/node_modules/electron/dist/electron.exe' tools/skin-converter/test-singularity.cjs
```

The exporter reads the input without saving it. It writes only under this test
copy. The importer updates the two viewmodel loader routes and narrowly patches
the Sheriff cache key in the current engine routes, preserving other engine code.

## Verification (2026-10-27)

`singularity-test-results.json` records 20 hidden native-renderer cases: idle,
fire, reload, native equip fallback, and walking, across both hands and normal/Jett
arm packs. Bone poses exactly match the corresponding default-Sheriff models.
Arm mesh and animation byte comparisons, skeleton/attachment/timing comparisons,
2048² texture loading, transparent energy materials, texture disposal, selector
switching/persistence, cache keys and WebGL checks pass. Jett uses the existing
native retargeting; this work does not change or independently fix that system.

Generated loader routes match byte for byte and parse. The unversioned loader
depends on the application server's captured-module fallbacks, so its parity is
checked statically; rendering uses the captured versioned route in the fixture.
The existing six-skin placement/holo/ADS regression also passes. Screenshots in
`previews/singularity/in-game-*.png` are captured directly from the WebGL canvas.
Fixtures do not measure live gameplay FPS, input latency or user-perceived feel.

The main project, test-data defaults, HTTP port 8137, map/PVS culling removal,
removed delayed bot wall cache, current-frame bot triangle proofs, and pending
`raze.har` audio/melee work are unchanged.
