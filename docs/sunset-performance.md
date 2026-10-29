# Sunset small-prop batching optimization — 2026-10-26

Later update: batching is now enabled on every map (Corrode 64 instances,
all others 16). The temporary Corrode 2,048 experiment was reverted.
See `all-maps-and-melee-warmup.md`; the original comparison below is historical.

The user reported Sunset below 150 FPS while other maps exceeded 220 FPS, on a
Ryzen 5 5600X, RTX 5060 and 16 GB RAM. That is the user's live gameplay report.
The measurements below are separate controlled map-render measurements.

## Applied change

Sunset alone now permits the existing native texture-array batcher to merge
small repeated opaque prop groups of up to 16 instances / 20,000 total triangles.
Previously it kept groups above 3 instances / 6,000 triangles as separate
instanced draws. Larger or heavier groups still use instancing. The 48 m native
batch grid is unchanged. Other maps retain their exact previous thresholds.

The full map retains 1,764,707 triangles **including instance multiplicity**, all
textures and baked lighting. Earlier import documentation counted geometry
buffers once and reported 668,189, excluding repeated instances. Batching changes
how those triangles are submitted, not the total displayed geometry.

Map mesh objects decrease from 681 to 465; separate instanced meshes decrease
from 410 to 147. Transparent mesh count stays 173. Collision is collected before
batching and is unchanged. No bot, weapon, ADS, resolution or quality settings
were modified. No custom map culling or bot wall-occlusion was added.

## Controlled measurements

The hidden native renderer reported the RTX 5060 through ANGLE/D3D11. Checks ran
at 1920×1080, shadows off, map only, using eight camera views at A Tube and B Main.
Each view used 12 warmup renders and 24 samples. CPU values are median submission
times; GPU values use WebGL disjoint timer queries. This is not a live drill FPS
benchmark, and CPU submission and GPU time overlap rather than adding directly.

| View | Draw calls before → after | CPU submission ms | GPU ms |
| --- | --- | --- | --- |
| A Tube start | 145 → 106 | 0.90 → 0.60 | 0.547 → 0.533 |
| B Main start | 421 → 260 | 1.90 → 1.20 | 1.248 → 1.131 |
| B Main, fourth heading | 562 → 376 | 2.50 → 1.80 | 1.752 → 1.408 |

One inexpensive B-side heading increased GPU time from about 0.394 to 0.452 ms
because larger batches submit some additional offscreen geometry. CPU submission
still decreased there. The other seven sampled views had equal or lower GPU
time. Native geometry frustum checks remain in use.

Across eight 1080p screenshots, the chosen variant's maximum mean absolute RGB
difference was 0.000524 / 255, with at most 15 pixels differing by more than 20
channel levels in one image. Small raster/depth-order differences remain; images
are not claimed to be bit-identical. Both larger 96/128 m batches and a more
aggressive 32-instance merge were tested but not applied.

After applying the actual two-route patch, the existing integration check passed
all six native scene parsers, six 180-tick bot simulations with correct active
counts and grounded spawns, six rendered starting views, and zero WebGL errors.
Actual post-change live gameplay FPS remains unmeasured.

## Files and reproduction

- Both `app/mods/next/js/BiMsX6Xn.js` and its versioned route contain two narrow
  changes: map-specific thresholds in the merge descriptor and consumption of
  those thresholds in the existing native batcher.
- Apply: `node tools/map-import/optimize-sunset-batching.cjs`.
- Undo just this change: `node tools/map-import/optimize-sunset-batching.cjs --rollback`.
- Reapply after any future regeneration that replaces these renderer bundles.
- Run `tools/map-import/profile-sunset.cjs` with this copy's Electron executable
  for the native/16/32 comparison. The native baseline is restored in memory by
  the fixture, without changing production files.
- `tools/map-import/sunset-props-profile.log`, `sunset-profile-results.json` and
  `sunset-pixel-comparison.json` retain the measurements and visual comparison.
- `test-sunset.cjs` checks the applied production bundles and imported drills.

The Graphify graph was queried and remains the previous snapshot. It does not
contain this optimization or the preceding Sunset import.
