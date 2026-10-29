# Jump/crouch optimization

Implemented 2026-10-28 in the isolated test copy. No saved drill settings changed.

## Changes

- Fully crouched hitboxes evaluate only the native crouched pose. Intermediate crouch amounts still blend both poses.
- Fully crouched rendering selects the native crouched animation directly. Moving bots evaluate one pose instead of two. Stationary crouched bots can reuse the native static skeleton/matrix cache until their pose changes.
- A bounded shared cache (up to 128 native motion keys) avoids repeatedly splitting strings and resolving the same crouch animation names.
- The crouch scheduler no longer creates a local random-range closure on each enabled bot's tick. Random draws, timing, movement scale and state transitions are unchanged.
- Jump launch velocity and flight duration are cached in the existing primitive behavior state. They recompute when height or gravity changes, and remain compatible with older checkpoints without cache fields.

The changes are owned by `extend-studio-crouch.cjs`, `studio-crouch-core.js.txt` and `extend-player-bot-jump.cjs`. Existing audio-builder hooks preserve them. Both served engine routes are updated; hooks are idempotent. The loading-probe fix remains intact.

## Before/after verification

`test-crouch-optimization.cjs` instruments temporary copies of the preserved previous implementation and current implementation. The copies are removed from served asset folders afterward. Baseline sources live only under `tools/skin-converter/crouch-optimization-baseline/`, outside packaged app files.

- Six live movement/spawn cases ran 2,300 ticks each with both jumping and occasional crouching. Maximum trajectory difference: **0**. Crouch amount and lifecycle states matched.
- Standing and directional moving poses, unarmed/Vandal poses, seven crouch blend amounts and three animation times: maximum hitbox-center and rendered bone-position differences **0**. Quaternion rotation difference was floating-point rounding (6.7e-16).
- Over 100 full-crouch requests, hitbox pose evaluations fell **200 → 100**. Moving skeleton pose evaluations fell **200 → 100**. Stationary skeleton pose evaluations fell **200 → 1**, with subsequent requests using the existing native cache.
- In a 600-tick jump test, jump launch/flight calculations fell **341 → 1**. Runtime height and gravity changes correctly invalidated the cache.

Median isolated CPU timings, 2,500 requests per trial, five trials with alternating implementation order after warmup:

| Workload | Before | After |
| --- | ---: | ---: |
| Fully crouched stationary rendering | 21.8 ms | 0.1 ms |
| Fully crouched moving rendering | 25.0 ms | 18.8 ms |
| Fully crouched hitbox generation | 5.5 ms | 3.0 ms |

These are specific native CPU kernels, not whole-game frame times or FPS. Full hidden-renderer profiling was repeated too, but its baseline/off timings also changed substantially between runs. Therefore the whole-pass speed difference cannot be attributed entirely to these changes.

Results: `crouch-optimization-results.json`, `jump-crouch-performance-results.json`, and the prior full-pass result `jump-crouch-performance-before-optimization.json`.

The complete crouch gameplay/render/UI fixture and actual native game import/loading/preparation/first-frame fixture passed afterward, including the latest saved range drill with weapon-model preparation. Syntax and regeneration checks passed. Foreground FPS has not been measured.
