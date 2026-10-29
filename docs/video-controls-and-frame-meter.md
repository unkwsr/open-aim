# Video controls and single frame counter

Test copy only. The new frame-rate control matches the native dark/red settings
choices: Unlimited, Match display, Custom. Custom accepts native-supported whole
numbers 30–1000 with 120/144/165/240/360 presets. Changes use the native reactive
display store and its existing persistence; they do not modify native scheduler
timing. Mode changes show the existing next-round requirement only when needed.
The custom value is also remembered locally when another mode is selected.

The detected-Hz label uses the desktop shell's current-display report, not a
short browser rAF estimate. An unavailable value is shown as unavailable. Old
fractional refresh rows are removed from view; while the panel is open, legacy
fractional preferences (including preset changes) normalize to renderEveryNthFrame
1 so the visible choices match the state. One note replaces repeated PC badges.
The original VideoPanel rows remain hidden to preserve Vue ownership; the new
controls use a bridge into its real settings store. No localStorage-only fake
controls. Native settings changes notify the new UI through a Vue watcher.

The native top-left HUD branch is disabled in both Hwnlm6zD.js routes. The old
lobby-bar meter implementation and its global callbacks/CSS are removed. Both
places now expose the same one counter and visibility preference. The native
FPS sampler is disabled in the engine; independent work diagnostics remain.

## Measurement definition

The engine reports performance.now() immediately after each completed onRender
path, once per successful render. GPU retry callbacks and simulation ticks are
not frames. This measures application render completion/submission throughput,
not GPU hardware completion, scanout, input latency or frame presentation.

- FPS is number of sampled intervals / their elapsed duration, over intervals
  ending within the last second. Mean frame time uses the same intervals.
- 1% low is 1000 divided by the mean slowest ceil(N × .01) frame intervals from
  the last five seconds. It is not a renamed reciprocal p99 percentile.
- Worst frame uses the last five seconds. Long stalls are retained without
  clamping or an arbitrary outlier cutoff. Other overlays can use different
  windows/definitions and therefore need not show the same number.
- FPS waits for 0.5 s of gameplay; 1% low waits for five seconds. Pauses, round
  stop and visibility changes reset samples. No menu rAF fallback is mislabeled
  as game FPS. Stale samples show no number.
- Sampling uses fixed typed rings, no per-frame DOM work or GPU waits/readback.
  The display refreshes four times per second; its timer does not count frames.

## Files and checks

app/video-settings.js and app/frame-meter.js are injected by the test wrapper.
app/mods/aim-ui/frame-metrics.mjs holds the pure sampler. Rebuild VideoPanel/HUD
overrides with node tools/skin-converter/build-video-settings.cjs. The existing
audio-engine builder retains extend-frame-meter.cjs alongside all prior adapters.

node tools/map-import/test-frame-metrics.mjs passed known fixed rates 60–1200 FPS,
uneven interval averaging, real stalls, true slowest-1% averaging, invalid/stale
samples, reset and the shipping scheduler's render hook (9 attempts, 3 GPU retries,
6 renders counted). The hidden native Vue VideoPanel fixture passed mode mapping,
presets, invalid/custom caps, reactive external changes, legacy fraction
normalization, counter toggles and single-counter checks. Saved screenshot was
visually inspected with the native st-rows styles and test-only transitions off.
No gameplay FPS gain or external presentation-counter agreement is claimed.

Evidence: tools/map-import/video-ui-test-results.json and video-ui-preview.png.
Shell test-data/ and port 8137, all skins/melee adapters, all-map batching and
Corrode surface optimization remain intact. No custom map/PVS culling or bot
wall-occlusion was added. No main-project changes.
