# Crosshair settings performance check — 2026-10-27

No runtime code was changed for this check. Tests used this copy's Electron
runtime, isolated profiles, and native Corrode simulation/render loop at 1280x720,
neutral input, RGX Vandal, uncapped rendering in a hidden window. This is controlled
native-game evidence, not a foreground gameplay/display-latency measurement.

The initial sequential run showed timing drift, so it was not used to claim no
regression. A repeat loaded the lobby/preview assets before both conditions,
reset the same scene before each sample, warmed 1.8 seconds and measured 5 seconds.

| Condition | Mean frame interval | p99 |
| --- | --- | --- |
| Closed control 1 | 1.805 ms | 3.3 ms |
| Closed after settings 1 | 1.753 ms | 3.3 ms |
| Closed control 2 | 1.876 ms | 3.4 ms |
| Closed after settings 2 | 1.765 ms | 3.2 ms |

No sustained regression was detected; faster after-settings samples are not proof
of an improvement. All four closed samples recorded zero preview paints, zero
preview drawImage calls, and zero remaining preview ResizeObservers. In the first
run, both untouched open-preview samples also recorded zero redraws. Opening the
preview created zero extra WebGL contexts. Native WebGL errors were zero.

Opening/updates have a one-off canvas cost: across the two runs, paint median was
4.2–5.6 ms; maximum was 21.5–27.4 ms (five intercepted paints per run). This can
cause a brief UI hitch and must not be described as zero overhead. Fixed waits
in the fixture's open function are not measured loading latency. Rare native frame
spikes occurred in multiple conditions; the test does not establish their cause.

Code audit: in-match SettingsDialog is conditionally mounted in Hwnlm6zD.js. The
preview wrapper in extend-rifle-ads-preview.cjs watches settings/profile changes,
paints on demand, cancels pending RAF, disconnects ResizeObserver, clears its map
load callback on unmount. Vue stops setup-scoped watchers on unmount. It shares the
lobby's 2D renderer and cached image assets, with no continuous preview loop.

Reproducible fixtures/results:
- tools/skin-converter/test-crosshair-performance.cjs
- tools/skin-converter/crosshair-performance-results.json
- tools/skin-converter/test-crosshair-performance-controlled.cjs
- tools/skin-converter/crosshair-performance-controlled-results.json
