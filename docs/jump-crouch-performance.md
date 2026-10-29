# Jump/crouch performance check

Update: [targeted optimizations](jump-crouch-optimization.md) now remove redundant endpoint poses and cache static crouches/jump constants. The table below records the original pass, preserved in `jump-crouch-performance-before-optimization.json`; `jump-crouch-performance-results.json` now contains the later pass.

Measured 2026-10-28 with `tools/skin-converter/profile-jump-crouch.cjs` in this test copy's own hidden Electron runtime. No gameplay code changed for this investigation.

The fixture compares the same 1-, 10- and 50-strafer scene with both options off, jumping only, crouching only and both on. It warms 128 render iterations, then records 256 samples, each advancing four native simulation ticks before rendering. Simulation time is divided by four; the reported combined metric is one simulation tick plus CPU render submission. Configuration uses 1280x720, shadows off and no weapon viewmodel. GPU completion, display pacing and foreground FPS are not measured.

| Bots | Both off median | Jump only median | Crouch only median | Both on median |
| --- | ---: | ---: | ---: | ---: |
| 1 | 0.225 ms | 0.225 ms | 0.225 ms | 0.225 ms |
| 10 | 0.725 ms | 0.850 ms | 0.825 ms | 0.925 ms |
| 50 | 3.950 ms | 3.650 ms | 4.075 ms | 3.775 ms |

This is one comparative pass. Mixed results at 50 bots demonstrate noise/order/runtime variability; lower samples must not be interpreted as a feature speeding up the game. One bot's effect was below the measurement resolution, while the 10-bot comparison showed approximately 0.2 ms additional median combined CPU work with both enabled. These numbers do not predict the user's foreground FPS.

Draw calls, triangles, geometry counts and texture counts were identical across toggle modes at each bot count. Existing skeletons are animated; the features add no new draw calls or graphical effects. Jumping updates a few scalar values. Crouching costs more because it schedules stance changes and blends a second skeleton/hitbox pose when active. Its scratch arrays are reused. Live bullet-hitbox work was not benchmarked here, so the result does not cover sustained firing overhead.

Practical inference: these additions look inexpensive for drills with a few bots. Many simultaneously animated bots, especially when targeting very high FPS on a CPU-limited system, can still make the extra work noticeable. A foreground on/off comparison is needed to establish actual gameplay smoothness.

Full timings: `tools/skin-converter/jump-crouch-performance-results.json`.
