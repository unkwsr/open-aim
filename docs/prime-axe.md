# Prime Axe — isolated test copy

Added as **Melee skin → Prime Axe**. Restart the test game, select it in settings,
then enter a scene. Other melee choices remain available.

## Source and appearance

- Supplied `melee (2).glb`: Prime/HypeBeast axe, 1,804 triangles.
- Supplied `FP_Melee_Prime (1).glb`: authored equip, three light attacks,
  heavy/right-click, idle and inspect clips.
- Supplied `jett_fp (3).glb`: byte-identical to the existing captured Jett arms.
  Reuses this copy's converted Jett arms and native ability adapter.
- GLBs contain no textures. Matching body DF/NM/ORM textures were recovered
  locally from `C:/Users/hate/Downloads/primeaxe.har`; no network request needed.
- Gold/purple textured body plus a flat gold energy material, two draw groups,
  back-face culling, no transparent glass, bloom or extra lights. Unused emissive
  texture is not loaded.

Cached sources and texture provenance: `tools/skin-converter/prime-axe-source/`.
Rebuild: `node tools/skin-converter/import-prime-axe.mjs`, then
`node tools/skin-converter/build-audio-loader.cjs` for the audio preparation hook.
Generated assets and both served loader/engine routes live only in this test copy.

## Animation and audio behavior

The rigid axe follows the authored right-hand weapon attachment; it needs no
separate gun animation file. Tracks are baked offline into the existing TRS
format with scale preserved and source joint names mapped to the shared rig.

Three light attacks use the existing three-hit combo. Following the user's speed
feedback, they retain their full authored playback duration of about 1.57 s,
without the original 0.58 s time compression. A subsequent attack can interrupt
recovery. Following the next feedback pass, heavy/right-click also retains its
full ~1.57 s authored playback instead of the compressed 0.86 s version.
Native damage timing and attack cadence are unchanged. Equip and inspect retain
their source playback durations.

WAVs are copied unchanged into `app/mods/media/prime-axe/`:

- `prime axe equip.WAV` → equip.
- `attack1primeaxe.WAV`, `attack2primeaxe.WAV`, `attack3primeaxe.WAV` → light combo
  stages 1, 2, 3.
- Heavy uses attack 2's sound because no separate heavy WAV was supplied.
- No inspect audio was supplied, so inspect is silent.

Uses the existing melee audio scheduler: decode once before play, one source per
action, no per-action fetch/decode, interrupt older actions, stop on pause/switch,
and suppress stale events on resume. Scene preparation awaits Prime Axe audio.

## Verification

- `test-prime-axe.cjs`: 56 hidden render cases covering normal/Jett arms,
  right/left hand, equip, light attacks, heavy, inspect, interrupted inspect,
  movement and Jett abilities. No WebGL errors; native normal-arm mesh bytes are
  unchanged. Authored clip names, selection UI and all four melee choices checked.
- `test-prime-axe-audio.cjs`: four decoded sounds, correct attack order and heavy
  mapping, equip/frame deduplication, pause/switch isolation, no per-action
  fetch/decode and non-silent offline output pass.
- Existing Butterfly rendering, fan/Butterfly audio and Guardian audio checks pass.
- `test-scenario-loading.cjs` with `SCENARIO_TEST_MELEE_SKIN=prime-axe` passes
  real engine preparation, gameplay start, cancellation, retry and loadout
  invalidation checks, with Prime Axe audio readiness included.
- Hip, attack and Jett render snapshots were visually inspected under
  `previews/prime-axe/`.

These are hidden renderer and audio checks, not foreground gameplay or FPS
measurements. No foreground gameplay was performed in this session.
