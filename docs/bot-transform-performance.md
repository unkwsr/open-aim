# Static bot transform and bone-upload caching — 2026-10-26

After the Sunset batching change, the user reported improved but inconsistent
performance. This follow-up removes repeated work for unchanged humanoid rigs;
it does not make visibility decisions.

## Applied behavior

- Keep the built scenario group's identity transform instead of recomposing it
  on every render traversal.
- Update actor-root and pivot matrices when position, yaw or uniform scale
  changes. Existing interpolation and actor visibility code remain intact.
- Cache local bone matrices for zero-duration poses. Animated poses restore
  normal per-frame bone updates; changing poses refreshes the stage transform.
- Reuse a stationary rig's computed bone matrices and bone texture until its
  pose, world-stage transform, inverse-bind revision or bone-texture object
  changes. Animated poses always use the original skeleton update.
- The asynchronous agent-skin loader increments the inverse-bind revision after
  replacing bone-inverse data, so late-loaded skins invalidate the cache.

The change applies to the native actor renderer, including other maps using it.
It does not affect first-person arms/viewmodels, physics, hit detection,
animation timing, texture resolution, bot frustum decisions or wall visibility.
The earlier Sunset-specific map batching remains applied. Custom map culling
and cached bot wall-occlusion remain removed.

## Verification and limits

`tools/map-import/test-actor-transform-cache.cjs` compares the original actor
module with the cached module through the actual native renderer on Sunset.
The dense fixture uses 15 real rigs from the imported drill and the existing
Jett/Cypher actor definitions. The fixture is intentionally controlled; it is
not a complete live gameplay benchmark.

- All compared actor, pivot, bone-world and bone-palette matrices matched exactly
  through translation, yaw, scaling, walking, running and crouch/stand switches.
- Turning away and back during movement retained the same visible states and
  matrices. Explicit inverse-bind revision changes produced identical palettes.
- Final 1080p framebuffer images were pixel-identical.
- Over 360 warmed stationary-bot frames, local matrix compositions fell from
  660,240 to 11,880, and redundant bone-texture version increments fell from
  5,400 to zero. Moving/animated rigs still refresh their bone data.
- Draw submissions stayed at 191 in both compared final views: the improvement
  does not come from hiding bots or removing geometry.
- In the final fixture run, CPU update/render submission median was about
  3.6 → 2.6 ms, 95th percentile 5.5 → 4.4 ms, and 99th percentile 5.9 → 5.1 ms.
  Timings vary between runs and include driver submission/wait behavior; these
  values are not live frame intervals or a measured gameplay FPS gain.
- Both module routes pass JavaScript syntax checks, patch/rollback round trips,
  idempotence checks and byte-for-byte parity with the updated builder output.

Measurements and screenshots are in `tools/map-import/actor-cache-results.json`,
`actor-cache-test.log` and `actor-cache-{native,cached}.png`. Rerunning the test
updates those files. The existing six-drill integration check remains separate
in `test-sunset.cjs`.

## Maintenance

Both `app/mods/next/js/CnrSARj_.js` and its versioned route are patched by:

```powershell
node tools/map-import/optimize-actor-transforms.cjs
```

Undo this runtime patch alone with `--rollback`. The reflex builder now applies
the same source adapter when regenerating the actor module, preserving its
existing narrow reflex FX exports. A later builder run reapplies the cache.

The existing Graphify graph was queried without rebuilding. It predates this
change and the Sunset import; use this document for the latest implementation.
