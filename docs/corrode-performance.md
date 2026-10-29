# Corrode batching — 2026-10-26

**Current state:** the 2,048 experiment below was reverted at the user's request.
Corrode uses 64 instances / 20,000 triangles; every other map uses 16 / 20,000.
See `all-maps-and-melee-warmup.md`. The following comparisons are historical.
The previously applied bot pose/bone-upload cache already applies across maps.
No culling, wall-occlusion, texture, gameplay or transparency changes were added.

The initial 16-instance trial used controlled 1080p map-only checks at four original drill starts in four
headings each. Mesh objects decreased 449 → 309 and separate instanced meshes
290 → 120. Geometry stays at 2,941,062 triangles including instances; transparent
mesh count stays 59. At B Main start, draw calls decreased 310 → 191, median CPU
submission about 1.2 → 0.9 ms, and GPU time 1.984 → 1.877 ms. These are fixture
measurements, not a measured live gameplay FPS improvement. Two inexpensive
headings had small GPU-time increases from extra offscreen geometry submission.

Across 16 1080p image comparisons, maximum mean absolute RGB difference was
0.000461 / 255; at most 21 pixels per image differed by over 20 channel levels.
The initial applied production bundles matched that tested candidate's geometry counts
and all sixteen draw/triangle counts. Four native 180-tick simulations retained
grounded spawns and active bot counts of 16, 19, 20 and 15. The Mid-to-B scene
selects 18 pooled spawners plus one always-active spawner.

## Further Corrode tuning after the user's 200 FPS report

A comparison of 16-, 32- and 64-instance limits across the same sixteen views
selected 64. Mesh objects fell further from 309 to 274 and separate instanced
meshes 120 to 83; total triangles and the 59 transparent meshes are unchanged.
B Main start draw calls fell 191 → 162; the highest sampled count fell 248 → 214.
Mean of the sixteen per-view median CPU submission times was about 0.700 →
0.613 ms (12.5% lower), while GPU time was about 1.305 → 1.284 ms (1.7% lower).
These are controlled renderer measurements, not a measured live FPS gain.
More baked repeated geometry increases geometry-buffer memory usage.

Compared with 16, the chosen variant's maximum mean absolute RGB difference
was 0.000090 / 255, with at most two pixels per image differing by more than 20
channel levels. After applying the map-specific setting, all four native
simulations and sixteen rendered-view draw/triangle counts matched the tested
64-instance candidate. Both route variants passed syntax and rollback checks.
The report is `tools/map-import/corrode-dense-results.json`; visual comparison is
`corrode-dense-pixels.json`, and current production results are in
`corrode-applied-results.json`. The earlier comparison remains in
`corrode-profile-results.json` (its historical `expected` field for Mid-to-B
omitted the always-active spawner; the current report correctly expects 19).

## Temporary five-doubling trial

Requested progression: 64 → 128 → 256 → 512 → 1,024 → 2,048. The comparison
measured the two endpoints with the same 20,000-triangle merge cap and native
48 m batch grid. Only Corrode's instance threshold was changed.

- Map mesh objects: 274 → 267; instanced objects: 83 → 76.
- B Main start draw calls: 162 → 155; maximum sampled count: 214 → 207.
- Tracked geometry attribute/index/instance buffers: 123,600,134 → 127,111,990
  bytes (+3,511,856 bytes, approximately 3.35 MiB). This excludes textures and
  driver overhead and is not total VRAM use.
- Average per-view median CPU submission: 0.456 → 0.450 ms; GPU: 1.283 →
  1.273 ms. Such small differences can be run-to-run variation; no material
  live FPS gain has been established. The triangle cap limits further merges.
- Total 2,941,062 triangles and 59 transparent mesh objects are preserved.
- Compared with 64, maximum mean absolute RGB difference was 0.000162 / 255,
  with at most three pixels per image differing by over 20 channel levels.
- Applied bundles matched the trial's four native simulations and sixteen
  rendered-view draw/triangle counts, with no WebGL errors.

The 2,048 trial was initially left active for the user's gameplay test, then
explicitly reverted when all-map batching was requested.
Apply it with:
`node tools/map-import/optimize-sunset-batching.cjs --corrode --corrode-limit=2048`.
Restore the prior 64 setting with the ordinary `--corrode` command below.
Reports: `corrode-2048-results.json`, `corrode-2048-pixels.json` and the current
`corrode-applied-results.json` under `tools/map-import/`.

Apply/reapply:
`node tools/map-import/optimize-sunset-batching.cjs --corrode`.
Undo Corrode alone, retaining Sunset:
`node tools/map-import/optimize-sunset-batching.cjs --corrode --rollback`.
The older unscoped `--rollback` removes both maps' batching extensions.
Reapply after any future renderer regeneration.

Results: `tools/map-import/corrode-profile-results.json`,
`corrode-pixel-comparison.json` and `corrode-applied-results.json`.
Use `MAP_BENCH_TARGET=rook` with `profile-sunset.cjs` for native/candidate checks;
case `SUNSET_CELLS=0` checks the applied production bundles.
The existing Graphify graph was queried without rebuilding and predates this.
