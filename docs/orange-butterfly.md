# Orange Butterfly

Added the supplied `Downloads/butterfly.glb` as **Melee skin → Orange Butterfly**.
Black Market Butterfly remains a separate choice. Test checkout only.

## Model and rig

The source is a static Sketchfab model with an orange blade, dark handles,
screws and four constant-color materials. It has no textures, skeleton or
animation clips and contains 175,212 triangles.

`import-orange-butterfly.mjs` caches the source under
`tools/skin-converter/orange-butterfly-source/` and converts it offline:

- Screw centers identify each handle's hinge and butt axis.
- The two hinge positions are fitted to the existing Black Market blade/handle
  pivots. Each handle's axis/length is fitted to the corresponding animated
  handle; source display rotation is omitted.
- Position-welded connectivity identifies four complete handle shells. Each
  shell stays on one rigid joint, avoiding splits across hinge bevels.
- Blade, two handles and their screws follow `Handle_Blade`, `Handle_L` and
  `Handle_R`. All normals use the corresponding inverse-transpose transform.
- Meshoptimizer reduces the dense detail to 12,206 triangles / 9,181 vertices,
  with four material draw groups. Handle colors are retained; the blade uses
  a less saturated orange with roughness 0.26, metalness 0.8 and environment
  intensity 2.3 for visible metallic highlights in the existing material pass. Source
  GLB remains unchanged in the cache. Per-part reduction errors are recorded in
  `orange-butterfly-import-report.json`.

## Shared animation and sound

Reuses the existing Black Market motion and equip files directly, including
equip, three light attacks, heavy/right-click and inspect. No duplicate animation
or audio files are introduced. Normal/Jett arms and left/right hands are supported.
The existing Jett ability adapter and Black Market grip placement are reused.

The curved replacement handles need a 2.3 cm local grip correction. A cached
adapter follows the handle nearest the right palm and smoothly blends during
flips, translating the complete knife assembly so folding pivots stay connected.
The correction resets each frame to prevent drift and adds no per-frame allocations.

Melee audio resolves this choice to the existing Black Market buffer pack:
equip, inspect, light attack plus its recovery cue, and right-click attack.
All five sounds retain Black Market's timing, volume and interruption behavior.
Scene loading awaits the shared audio and prewarms the model.

Rebuild from this checkout root:

    node tools/skin-converter/import-orange-butterfly.mjs
    node tools/skin-converter/build-audio-loader.cjs

## Verification

- `test-orange-butterfly.cjs`: 56 hidden render cases covering both arm sets and
  hands, equip, attacks, inspect/interruption, movement and Jett abilities, with
  no WebGL errors. Normal arm geometry remains unchanged.
- Compared animated gun-joint poses to Black Market over equip, all three light
  attacks, heavy and inspect: maximum numeric difference about 4.3e-8.
- Idle grip contact error against Black Market decreased from 2.35 cm to
  0.05 cm; twenty repeated updates show no accumulated position drift.
- `test-butterfly-audio.cjs` with `BUTTERFLY_AUDIO_TEST_SKIN=orange-butterfly`:
  all five shared sounds, layered left-click/recovery timing, right-click,
  inspect interruption, switch isolation, frame deduplication and pause pass.
- Existing Black Market render and Prime Axe render regressions pass.
- Real-engine loading test with `SCENARIO_TEST_MELEE_SKIN=orange-butterfly`
  passes preparation, start, retry/cancel and loadout invalidation checks.
- Final idle, equip, inspect and Jett screenshots were visually inspected under
  `previews/orange-butterfly/`.

These are hidden renderer/audio checks, not foreground gameplay or FPS results.
