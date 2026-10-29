# Corrode opaque surface follow-up

Scope: isolated test checkout only. Both BiMsX6Xn.js renderer routes now draw
Corrode (`map:rook`) opaque surfaces front-sided, except materials whose names
match plant/tree/leaf/leav/folia/cloth/palette. Transparent and alpha-tested
materials remain double-sided. All other maps retain native double-sided
materials. This uses ordinary GPU back-face filtering; no map visibility/PVS
logic or bot wall-occlusion checks were restored.

Apply: `node tools/map-import/optimize-corrode-surfaces.cjs`
Rollback only this change: append `--rollback`. Reapply after replacing either
renderer bundle. Existing all-map prop batching (Corrode 64, others 16), bot
transform caching, melee preparation and raw-input adapter remain in place.

## Measurements and limits

The first broad opaque-material candidate visibly thinned tree foliage and
was rejected. An architecture whitelist preserved it but barely improved the
closest hotspot view. The final exclusions preserve foliage/palette materials
while recovering more of the measured GPU saving.

Controlled Electron/ANGLE RTX 5060 fixture, 1920×1080, native map lighting,
shadows off; 12 warmup and 24 measured frames per view. These are map renderer
GPU timer-query measurements, not live drill FPS or scanout intervals.

- Four original Corrode drill starts × four headings: mean of view GPU medians
  1.343 → 1.164 ms (13.3% less). CPU submission medians averaged 0.756 → 0.813 ms;
  this is a GPU improvement, not evidence of less CPU work.
- Four positions along the reported mid-ramp lane × four headings: 1.315 →
  1.174 ms (10.8% less). Closest reconstructed forward view: 2.044 → 1.786 ms
  (12.6% less). Exact user camera position is unconfirmed.
- All 2,941,062 geometry triangles retained. Native batch grouping changes with
  material sidedness: 274 → 287 meshes, 107 → 110 materials, 83 instanced meshes
  unchanged; tracked geometry buffers 123,600,134 → 123,033,788 bytes. This does
  not measure texture/driver allocation. Transparent mesh count stays 59.
- Four native drill simulations per fixture passed grounded/collision and bot
  count checks. No GL errors. Both shipping routes match, parse successfully,
  and pass reversible/idempotent adapter checks.
- Across 32 compared views: max mean RGB error 0.00846/255; at most 385 of
  2,073,600 pixels differ by more than 20 in a channel. Inspected views preserve
  the foliage and architecture; images are not mathematically identical.

Evidence in tools/map-import/: corrode-preserve-foliage-results.json,
corrode-mid-side-results.json, corrode-preserve-foliage-pixels.json and
corrode-mid-preserve-foliage-pixels.json. profile-sunset.cjs uses case 0 for
current shipping assets and case 1 for this adapter; after applying, both cases
match. Saved before/after results were captured before applying the patch.

Live FPS/frametime gains and other GPUs remain unmeasured. Driver and monitor
settings were not changed. Test profile still selects refresh mode.
