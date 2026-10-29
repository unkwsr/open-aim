# Interpolated equip presentation

**ROLLED BACK at the user's request.** Both runtime routes and builder hooks
were restored to their pre-experiment state. The notes below are historical;
the smooth equip adapter is inactive. Earlier optimizations remain active.

Applied only in aimtrainer-test, following the user's approval of a targeted
equip fix. Both engine routes still pass seconds:ce.tick*ve to the viewmodel,
and now also pass equipSeconds:Fe, where Fe=(ce.tick+renderAlpha)*ve is the
existing render-interpolated clock. Physics, firing readiness, input, reload,
attack times and idle/ADS graph cache keys remain on their original clocks.

Only active generic equip clips and the accepted equip-to-ADS crossfade use the
new visual clock. The loader clamps it to the current simulation tick's interval.
Native equip eligibility, duration/cancellation and readiness tests still use
simulation time. Visual elapsed time cannot end equip early or bypass readiness.
The transition captures its start in the same visual time domain, expires after
its existing duration, and retains the interrupted-equip marker so releasing ADS
does not resume the cosmetic clip. Simulation-clock rewind resets the markers.

Callers without equipSeconds retain exact legacy poses, including prewarm
callers. Repeated identical paused clocks produce identical poses. The new
timestamp is not used as the general weapon clock: idle/ADS graph caching,
firing/reload/attack playback and reflex state continue using seconds.

## Checks and costs

The hidden Electron fixture compares the current loader with the candidate and
a continuous-time equip reference. Ten combinations: default/RGX/Champions/Gaia
Vandal, BlastX/Recon Phantom, Guardian, Fan normal/Jett, and default knife.

- At 600 FPS sampling within 120 Hz ticks, coarse equip poses were held while
  smooth poses changed on each tested subframe. Maximum local bone error versus
  continuous reference was 2.85e-13. Pure equip references disable the separate,
  intentionally unchanged breathing/locomotion clock.
- Across one repeated logical tick, the ADS handoff changed on 4/4 subframe
  transitions, versus 0/4 before. A visual timestamp reaching readiness before
  simulation time did not interrupt equip early; the original readiness tick did.
- Idle/ADS graph evaluation remained one call across ten renders with identical
  simulation time. Post-equip reference poses and legacy/prewarm fallback poses
  matched exactly. Rewind/re-equip and paused pose checks passed.
- Native ADS integration with interpolated equip time passed readiness, settled
  sight alignment and release/no-equip-resume checks. Existing normal/Jett/default
  melee prewarm/first-switch tests passed after applying the built change.
- CPU fixture mean update cost: original 0.077 ms, smooth 0.069 ms, original repeat
  0.066 ms. The candidate was within baseline variation; no FPS gain or zero-cost
  guarantee is established. Both performed 6,720 equip samples in the comparison.
- GPU workload comparison: both 9 draw calls, 27,938 triangles, 8 shader programs
  and 120 bone-texture version increments over 24 draws, with no GL errors. GPU
  execution time on other hardware and subjective live smoothness are unmeasured.

## Maintenance

tools/skin-converter/extend-smooth-equip.cjs owns reversible engine/loader adapters.
Both build-audio-loader.cjs and build-viewmodel-loader.mjs preserve them.
node tools/skin-converter/apply-smooth-equip.cjs applies to all four runtime files;
append --rollback to remove this change alone. Builders reapply it unless their
adapter calls are removed too. Rebuilt output, after scoped rollback, matches the
entire previous source byte-for-byte: accepted skins, ADS, reflex, warmup, tracers,
Unlimited GPU retries and conservative bot visibility were retained.

Evidence: tools/skin-converter/smooth-equip-results.json,
ads-equip-smooth-gate-results.json and the related test scripts/logs.
Restart the test game to reload modules. No saved settings or main-project files
were modified; test-data/ and port 8137 remain unchanged.
