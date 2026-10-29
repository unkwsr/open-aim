# Frame pacing investigation — 2026-10-26

The user reports continuously uneven motion despite 240+ FPS, on a 240 Hz
monitor, using No frame limit. Existing geometry/actor optimizations remain
applied. This is a timing/presentation investigation, not an image-quality cut.

## Evidence so far

- Unlimited uses the native `_h()` MessageChannel scheduler, with timer-based
  retries when its GPU fence queue is full. The native refresh mode uses the
  browser's requestAnimationFrame scheduler. Both use the same simulation clock.
- The desktop wrapper defaults to VSync off unless its saved shell preference
  enables it. That startup option was not changed in this investigation.
- `profile-frame-pacing.cjs` executes the actual native scheduler/loop source
  with a real Corrode map, simulation, bots and a viewmodel, with the default
  two-frame GPU fence limit. Unlimited repeated approximately 265–267 FPS on
  this hardware, with render-start interval p99 of about 7.8–8.0 ms, despite
  average measured CPU work of about 1.7–1.8 ms. GPU readiness checks repeatedly
  used deferred timer retries. The 240-cap trial also had irregular intervals.
- These are renderer submission intervals, not display scanout timestamps.
  The hidden fixture throttled rAF to about 1 Hz, so its refresh-mode result
  cannot be used to evaluate a visible 240 Hz window.
- During the user's first live test, the visible FPS overlay showed about
  288 FPS, 1% low around 125, and CPU work about 2.0 ms. This is a screenshot
  observation at one instant, not a complete live trace or fixed-view benchmark.
- The opt-in live recorder produced menu samples but stopped updating during
  the live drill. Its gameplay trace is incomplete and is not used as evidence.
  Its temporary main-process hook has been removed. No recorder runs normally.

## Current comparison configuration

This isolated profile's `al-display-settings-v1` now selects `frameMode: refresh`
and `renderEveryNthFrame: 1`. Before/after preferences are saved locally in
`tools/map-import/display-pacing-settings.json`. Independent readback confirmed
persistence. All other display preference fields, including maxFps, were kept;
the maxFps field is ignored by the existing refresh scheduler. Shell VSync was
not changed. The main project/profile was not accessed.

`extend-display-pacing.cjs` preserves the desktop raw-pointer path in refresh
mode. Originally raw pointer input was gated by unlimited mode. The change
retains the existing browser behavior and custom-scheduler behavior. It does
not change sensitivity, recoil, physics, camera interpolation or animation
durations. The audio-engine builder preserves the change in both routes.

Both routes passed syntax/idempotence checks. The actual simulation/render
clock block remains byte-identical to the native source. The profile preset
changed only the two pacing preference fields. Test-data isolation and port
8137 remain intact.

The user answered **Smoother** after the visible comparison, then clarified
that smoothness still deteriorates below roughly 220 FPS. This is a subjective
improvement, not a complete fix or a controlled scanout trace.

The monitor is MSI MAG 245F X24, connected by an HDMI 2.1 cable, with Adaptive-Sync
disabled in the monitor. MSI specifies HDMI 2.0b inputs, DisplayPort 1.2a and an
Adaptive-Sync range of 48–240 Hz. Cable labeling does not upgrade the input.
NVIDIA's documented setup for an unvalidated Adaptive-Sync display uses
DisplayPort, monitor VRR enabled, then G-SYNC enabled for the selected display.
Compatibility is not guaranteed. No monitor or driver settings were changed.
Unlimited rendering cannot itself synchronize a fixed 240 Hz display below
240 FPS, and rates above 240 are outside this monitor's specified VRR range.

Sources: https://in.msi.com/Monitor/MAG-245F-X24/Specification and
https://nvidia.custhelp.com/app/answers/detail/a_id/4768/kw/windows%2064/related/1

A bounded MessageChannel retry experiment (3 or 8 GPU polls before the native
timer retry) was rejected. Fixture mean render intervals were 3.42 ms native,
3.99 ms retry-3, 3.67 ms retry-8, and 3.59 ms native repeat. Retry CPU work was
higher. Evidence: tools/map-import/gpu-retry-results.json. The experimental
adapter remains test-only and is not integrated. Native scheduling is unchanged.

The existing Graphify graph was queried without rebuilding. It predates the
latest work; use this document and the current source for these changes.
