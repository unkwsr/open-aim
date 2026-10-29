# Scenario loading and GPU preparation

Active only in C:/Users/hate/Desktop/aimtrainer-test. Restart the test game to load.

The workshop drill loader now stays mounted through map loading, collision work,
weapon preparation and GPU completion. Its own footer shows preparation status,
a final Prepare assets step and Back/Retry controls. There is no separate fullscreen
preparation screen. The initial prepared scene is consumed explicitly by the first Play action;
countdown and simulation still wait for readiness.

Play and Retry retain readiness checks. Restarts rebuild round/seed and scene
objects but reuse successful weapon preparation when the loadout, model and view/
render settings match. Scene/bot/effect readiness and GPU completion still run for
rebuilt objects. If checks finish within 250 ms no preparation UI becomes visible;
longer checks use a small themed status panel. Resume does not rebuild or warm.
Leaving the workshop aborts pending preparation. Failure exposes Retry and keeps
the round stopped; failed/cancelled work never becomes a successful cache entry.

The engine retains the map/lighting/warmup promise, awaits required bot models and
weapon assets without the previous timeout race, waits for scenario-prop preparation
and the existing conservative visibility-data preparation, and performs the native
map/bot/effect shader warmup. Selected primary and melee equip/model caches are
prepared and rendered offscreen before the round. A WebGL fence is polled with
yielding timers until the submitted GPU work completes. There is no fixed loading
delay and no gl.finish() stall. Background and no-map preparation use the same path.
Map/weapon preparation errors are surfaced to the gate rather than silently starting.
The optional visibility database still fails open if unavailable.
Temporary actor clones release their own bone textures after warming; shared map,
skin textures and geometry are retained for gameplay.

Renderer warmups are serialized across rebuilds, and stale generations cannot finish
a new scene's preparation. Existing compiler errors propagate to Retry. Simulation,
score, seed selection, replay recording and animation clocks are not advanced to
simulate warmup. The old equip-smoothing experiment remains rolled back. Map/PVS
culling and the old delayed wall cache remain removed; the accepted current-frame
bot visibility proof is unchanged. No FPS/video defaults or ongoing frame pacing
were changed by this feature.

Implementation:
- app/mods/aim-ui/scenario-loading.mjs: panel, readiness gate and GPU completion.
- tools/skin-converter/extend-scenario-loading.cjs: narrow native engine/UI/renderer hooks.
- build-audio-loader.cjs preserves engine and renderer hooks; build-video-settings.cjs
  preserves the Play/Retry hook. Both captured routes match.

Validation uses this copy's Electron runtime and test-only profiles. The native
engine was exercised on Corrode, Sunset, Ascent and map-free Drift Click, with
selected RGX Vandal and Silkleaf Fan. The hidden fixture supplies the desktop,
visibility and pointer-lock predicates; frame counts and HUD updates assert that
the real native render loop and simulation advance. Phase stayed idle during
preparation; first 400 ms of running created zero additional shader programs or
geometry buffers in those controlled views, and GL errors were zero. Sunset still
allocated a few small per-instance bone textures for subsequently spawned bots
(traced to the renderer's skeleton boneTexture uniform, not unfinished asset loading).
Repeat preparation passed. Deferred
readiness, Cancel, error/Retry, duplicate Play, native countdown ordering and GPU
fence polling passed. Existing melee warmup test passed all six cold/warm variants.
See tools/skin-converter/scenario-loading-results.json and melee-prewarm-results.json.

These are fixture results, not measured improvement in live gameplay or guaranteed
zero stutter. Driver/disk caches, new settings/skins, first use of untested effects,
asset decoding, simulation allocations and CPU load can still affect frame times.
Warmup shifts work into loading; it does not increase steady-state FPS. Only current
scenario assets and selected weapons are prepared, not every installed skin.


## Theme update, 2026-10-27

Loading now uses the existing --es-* theme tokens: Bahnschrift condensed italic
heading, dark panel, broadcast red top border/progress, cut corner, secondary
Cancel with Esc badge and slanted red Retry. Visible stage labels use plain
language and a stage counter; progress still reflects completed engine work.
No readiness, countdown, cancellation, GPU-fence or asset-loading behavior changed.
No blur, perpetual animation or extra rendering loop was added.

Real panel renders with ui.css and theme-esports.css were reviewed at 1600x900
and 420x620, including failure/Retry. See previews/loading-theme-desktop.png,
loading-theme-compact.png and loading-theme-error.png. Computed colors match
--es-panel (#10131a) and --es-red (#ff4655), with Bahnschrift. Existing complete
scenario-loading fixture passes readiness/Cancel/Retry/duplicate Play/countdown/
GPU completion and native starts on Corrode, Sunset, Ascent and Drift Click.

## Loading artwork continuation, 2026-10-27

The final preparation gate now uses the map splash, agent art, title and subtitle
from the preceding workshop loading screen, with stage progress at the bottom.
It remains a separate readiness gate after the workshop screen closes, because
the scenario itself still needs to finish preparing. The gate still waits for the
same map, weapon, shader and GPU work before the round can start. Artwork is
reused only when captured within two minutes; other scenarios use the themed
fallback background. This changes presentation only, not steady FPS or warmup
coverage.


## Unified loader and repeat preparation, 2026-10-27

This supersedes the separate panel and artwork-copying updates above. The actual
WorkshopLoading component remains mounted until its mounted engine finishes
preparation. Map/collision completion precedes the preparation stage. Native
progress reserves the last portion for preparation and cannot complete early.
Mounted-hook registration is read after painting, not synchronously at Suspense
resolution. Back returns through the workshop's existing exit handler. Native
scene generations prevent a stale completion from closing a later load.

Implementation additionally uses tools/skin-converter/extend-unified-loading.cjs,
which preserves both captured routes as app/mods overrides. The existing engine
builder calls the extension through extend-scenario-loading.cjs. Run the unified
extension to regenerate workshop overrides from captures. App lobby-bar.js no
longer copies loader artwork. Changed UI styles live in theme-esports.css and use
the existing red, square/slanted controls and transform-only progress animation.

Measured in the hidden Electron fixtures: native workshop continuity on Lotus,
readiness holding, integrated Retry, Back cancellation and no fast-restart flash
passed. Native preparation tests on Corrode, Sunset, Ascent and map-free Drift
Click passed; successful same-loadout repeats skipped weapon warming and took
7.1–85.8 ms in the recorded run. The initial prepared-scene flag was single-use, and first Play avoided a rebuild.
Changing view FOV or melee skin caused weapon
preparation to run again. All four controlled views created zero new shader
programs or geometry buffers during the first 400 ms of gameplay; some maps still
allocated per-instance textures. No WebGL errors were reported.

Desktop and compact renders of the actual workshop component were inspected at
1600x900 and 420x620 (window dimensions; client area excludes window chrome).
See previews/unified-loading-desktop.png, previews/unified-loading-compact.png,
tools/skin-converter/unified-loading-results.json and scenario-loading-results.json.
The fixture's unrelated hall preload requests can log missing captured chunks;
its loader assertions and map loading pass. These are controlled fixture results,
not live gameplay FPS measurements or a guarantee that every restart is below
250 ms. Slow scene preparation still waits safely and displays compact status.


## Vandal/Phantom warmup and keeping warmed guns, 2026-10-29

Live slow-frame logs (app/frame-log.js) showed the remaining 135-205 ms freezes were the
first switch to an unwarmed gun: BlastX Phantom (twice) and the RGX Vandal viewmodel,
each building 2 shader programs in one frame. The warm list skipped both rifles unless
one was the selected weapon. It now starts with `viewmodel` (Vandal) and `phantom`.
Ys() also disposed every cached gun except current/secondary/melee on the first switch,
so warmed guns could load again mid-round; guns warmed by the last preparation are now
kept (`__aimWarmKeys`) until the next preparation re-decides.

Hidden real-engine fixture, two runs each: first preparation on Rook 1,281/1,300 ms
before vs 1,556/1,573 ms after (+~0.27 s, the extra rifle); Juliett, Ascent and
no-map unchanged; repeats still skip weapon warming. Scenario-loading, melee,
butterfly, unified and crouch loading tests pass. Warmed guns stay in memory for the
round. The live effect on freezes is not yet measured.
Builder: extend-scenario-loading.cjs (keepWarmGuns) reproduces the patched engine.

## Compact loading card (2026-10-29)

The compact loader (`app/mods/aim-ui/scenario-loading.mjs`, styles in `app/theme-esports.css`) is a centered
card over a dimmed scene: drill name, spinner, elapsed timer, "Step N of 4" with a four-segment bar whose
current segment sweeps, an Esc hint and Back/Retry. After 8 s it adds "Still working". While it is shown,
the native `.al-scene-start.is-waiting` prompt ("Map still loading") is hidden so the two do not overlap.
The workshop (integrated) loader is unchanged.
