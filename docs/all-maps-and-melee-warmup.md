# All-map batching and first melee switch — 2026-10-26

## Current settings

The user requested removal of the temporary Corrode 2,048 experiment and
extension of the established optimization to every map. The current descriptor
uses 64 instances for Corrode and 16 for every other map, with the established
20,000-triangle per-group cap. The native 48 m grid is unchanged. The bot
transform/bone-upload cache was already global and remains applied.

Apply/reapply the current settings:

```powershell
node tools/map-import/optimize-sunset-batching.cjs --all-maps
```

This replaces the previous map-specific and experimental setup. Earlier
`--corrode` and `--corrode-limit` commands in historical notes are not the
current all-map configuration. `--all-maps --rollback` restores the established
Sunset/Corrode-only settings; the unscoped `--rollback` restores native batching.
No 2,048 override remains in either renderer route.

Actual native map loading, lighting, collision, scene parsing and simulation
checks passed for all nine maps: Ascent, Split, Haven, Summit, Lotus, Abyss,
Corrode, Bind and Sunset. Checks used two original pre-aim starts/four headings
each on seven maps, four starts on Corrode, and two starts on Sunset (80 rendered
views total). All tested spawn positions remained grounded and all expected bot
counts matched. Summit and Abyss initially hit fixture assumptions about actor
counts; the fixture was corrected to choose pre-aim scenes without dispatchers
and sum each spawner's actual capacity. Game scenes were not changed.

These are compatibility checks. They do not establish a live FPS gain on each
map or performance on low-end GPUs. Geometry/textures and native visibility
rules remain intact; custom map culling and bot wall-occlusion remain removed.

## First melee switch

The existing engine loaded the selected melee pack and constructed its model
on the first switch. Existing map prewarm covered actor templates and effects,
but did not explicitly prepare the selected melee viewmodel. Fan audio was
already decoded at startup.

`extend-melee-prewarm.cjs` now starts preparation in the existing map-prewarm
path, loads the correct melee/equip assets using the native skin/Jett/lockdown
cache key, and retains the model in the existing weapon cache. After the map
prewarm, while still idle, `warm-melee.mjs` compiles the actual viewmodel shaders
and draws a few equip samples at 16×16 using the real output target. It restores
the target, viewport and scissor state and immediately redraws the normal scene.
The first switch uses this cached model. Shader/asset work moves to preparation;
animation and gameplay timing are unchanged.

Generation, current cache key, disposal and phase guards prevent stale map
results from being warmed. GPU-preparation failure retains the normal loading
fallback. No warmup render runs once gameplay has started. If gameplay starts
before preparation completes, a completely stall-free first switch is not
guaranteed. The prepared melee model also consumes memory earlier than before.

The audio-engine builder preserves the adapter in both module routes.
`test-melee-prewarm.cjs` executes the actual extracted engine preparation and
switch functions with the real loader/renderer. Fan with normal arms, Fan with
Jett arms and default knife all passed:

- The first warmed switch reused the exact cached model.
- No new asset calls, shader programs, textures or geometries appeared through
  the first full equip animation after warming.
- Final equip framebuffers were pixel-identical to the cold path.
- Target/viewport/scissor state was restored, and cancelled warmup did not draw.
- Final fixture first-switch wall times were about 44–94 ms cold versus
  0.3–0.4 ms prepared. These include loading/render work in an isolated fixture,
  not a measured live stutter duration or proof the reported live hitch is gone.

Evidence: `tools/skin-converter/melee-prewarm-results.json` and corresponding
logs/images. All-map results are the `*-applied-results.json` files under
`tools/map-import/` (Sunset currently uses `sunset-profile-results.json`).
Both game-engine routes pass syntax checks and all 31 scenario files pass the
existing validator. Test data/port remain isolated; the main project was untouched.
The existing Graphify graph was queried without rebuilding; it predates these
changes.
