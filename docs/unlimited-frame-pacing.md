# Bounded fast GPU waiting for Unlimited

Applied only to the isolated test copy. No FPS limit, VSync change, extra queued
frames, saved-preference change or physics/input/animation change was introduced.
Custom FPS limits and Match display keep their original retry behaviour.

The native unlimited loop defers a GPU-blocked render using a nominal 1 ms timer.
Observed submission cadence was often uneven even when there was spare rendering
capacity. A zero-delay timer yields to the event loop and can check readiness
sooner, avoiding an unnecessary coarse wait. It is not a synchronous JS spin loop.
Unrestricted zero-delay polling improved pacing but did too much CPU work, so it
was rejected as a default. Count limits of 16/64 and time budgets of 1/1.5 ms did
not retain enough of the consistency improvement.

Current behaviour: when an uncapped render first finds the GPU queue full, allow
yielding zero-delay retries for up to 3 ms of elapsed time. If still blocked, use
the original 1 ms retries until the GPU is ready. The next successfully rendered
frame resets the budget. Every callback still yields, and the renderer retains
one pending callback. Queue depth stays native (default 2); no new frame buffering
or hidden frame cap. On a slow GPU, the fast phase expires and stays expired for
that pending frame instead of continuously consuming CPU throughout its wait.

This uses MORE CPU activity during GPU waits. A bound limits exposure; it is not
evidence that CPU usage stays unchanged or that all hardware will improve. More
frames rendered per second also add CPU work. It cannot synchronize uncapped
frames to a fixed-refresh display, remove tearing, or eliminate all stalls.

## Controlled evidence

Visible 240 Hz Electron/ANGLE fixture with native Corrode map, bots, simulation
and viewmodel at 1920×1080, shadows off, queue depth 2. Each variant resets seeded
simulation and excludes initial warmup. These measure render-start intervals,
not display scanout or click-to-photon latency. They are not predicted live FPS.

| Variant | FPS | p95 interval | p99 interval | Interval standard deviation |
| --- | ---: | ---: | ---: | ---: |
| Native | 353 | 6.1 ms | 7.2 ms | 2.00 ms |
| Fast wait, 3 ms budget | 627 | 2.5 ms | 3.0 ms | 0.63 ms |
| Fast wait repeat | 640 | 2.4 ms | 3.0 ms | 0.68 ms |
| Native repeat | 357 | 6.0 ms | 7.0 ms | 2.00 ms |

Rare maximum intervals were 8.0/7.8 ms native versus 7.7/10.8 ms optimized: the
change improves the distribution, not every worst-case stall. rAF averages stayed
about 239–240 Hz; its p99 stayed about 4.3 ms. Zero-render rAF observations fell
from roughly 147–151 to 2–4 per sampled run, while rendering remained uncapped.

Raw Electron renderer CPU percentCPUUsage averages in this test rose from about
3.65–3.80 to 9.20–9.28. These are the API's reported values, not an input-latency
measurement. GPU checks rose substantially. Do not present this as a CPU-saving
optimization. The user's live smoothness and other hardware remain unverified.

## Maintenance and checks

tools/skin-converter/extend-unlimited-retry.cjs changes only the GPU-blocked branch
and adds its private deadline. build-audio-loader.cjs preserves the adapter in
both OkAdunfX.js routes. Scoped rollback is rollbackUnlimitedRetry(source); remove
the builder call too if permanently reverting. Older MessageChannel burst retry
experiments in extend-gpu-retry.cjs are still rejected and NOT integrated.

Both routes parse, match, and pass idempotence/rollback checks. Tests verify the
fast window expires on a simulated slow GPU, resets after a successful render,
leaves Custom and refresh callbacks unchanged, maintains one pending callback,
and stops cleanly. Existing FPS accuracy/native render-accounting and conservative
bot-visibility geometry/camera-isolation tests pass. Raw mouse input, melee
preparation, skins, map batching and conservative bot visibility are retained.

Evidence: tools/map-import/unlimited-final-results.json (selected variant),
unlimited-pacing-results.json, unlimited-bounded-results.json and
unlimited-timed-results.json (earlier candidates). Run test-unlimited-retry.mjs
for deterministic clock checks. The visible profile tool reconstructs the native
baseline in-memory with rollbackUnlimitedRetry before comparing candidates, so
it remains a valid comparison after applying the adapter.


## Custom FPS cap and 1% lows, 2026-10-29

Live logs: a Custom 300 cap at render scale 1 removed the 135-205 ms freezes but kept
1% lows at 100-115 FPS (uncapped good rounds: above 150). Suspected cause: the custom
limiter's setTimeout waits overshooting. `tools/map-import/profile-fps-cap.cjs` runs the
real frame loop (Rook, simulation, Vandal rig, hidden 1920x1080) for 10 s per variant.

| Variant | FPS | 1% low | 0.1% low | frames > 6.67 ms |
|---|---|---|---|---|
| native limiter, 300 (two runs) | 288 / 294 | 95 / 124 | 59 / 103 | 48 / 43 |
| pure spin, no timers, 300 | 292 / 291 | 112 / 111 | 65 / 82 | 51 / 54 |
| remembered overshoot (Th 16, Eh .999), 300 | 293 / 294 | 118 / 119 | 87 / 83 | 32 / 40 |
| uncapped | 459 / 485 | 150 / 210 | 108 / 125 | 29 / 7 |

Spinning without timers did not improve the cap, so timer overshoot is not the cause; the
slow capped frames carry only ~1.5-3 ms of game work. The limiter was left unchanged.
Capping produced more 7-10 ms frames than uncapped in this fixture. Unproven candidates:
GPU clock/power-state changes at partial load, or browser presentation timing.
