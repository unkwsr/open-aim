# Sustained FPS drop while bots shoot: inspection

2026-10-28. User reported a sustained drop in the custom range with many shooters, sometimes one or two, and explicitly requested inspection only. No production gameplay files or player settings were changed. Temporary profiling modules were removed afterward.

## Strongest reproduced cost: the hurt-sound path

The native `playHurt()` method calls `P0`, exported as `ep` from the sound module. Each call builds two filtered noise voices plus a sine oscillator: two buffer sources, two biquad filters, three gains and one oscillator, **eight audio nodes per hit**. These are created again for each hit, even if several bots hit on the same simulation tick. Warmed weapon-shot playback uses cached audio and is a separate path.

In a controlled test, turning off **only the hurt-sound call** retained damage simulation, the damage HUD, weapon-shot audio, incoming custom tracers and all bot rendering. Identical shot/hit counts were verified between the compared cases.

| Simultaneous shooting bots | Mean CPU on shot frames, normal | Hurt sound skipped | Direct time inside hurt calls per shot frame |
| --- | ---: | ---: | ---: |
| 1 | 0.977 ms | 0.837 ms | 0.113 ms |
| 10 | 2.700 ms | 1.380 ms | 1.127 ms |
| 20 | 4.340 ms | 2.080 ms | 2.177 ms |

The directly instrumented hurt-call time accounts for most of the difference. Normal weapon-audio call counts/times remained comparable. Twenty simultaneous hits create 160 hurt-sound nodes on one tick, in addition to weapon playback nodes. This is a repeatable CPU spike, consistent with recurring stalls while bots fire. It does not establish an exact foreground FPS loss.

Average CPU across the entire measurement window changed less (for 20 bots, 1.297 → 1.218 ms), because the window includes gaps between shots and reloads. A short, repeated workload spike can still exceed a high-refresh frame budget; this is an inference about the user's symptom, not a foreground measurement.

## Other inspected work

- Bot shooter logic runs with native 128 Hz simulation, including weapon/recoil state and visibility checks. Cost grows with shooter count.
- Advanced tracer mode performs a visibility ray before the tracer renderer checks its per-enemy enabled/frequency settings. Some of that work is unnecessary when incoming tracers are disabled or a shot would be filtered. It was not the dominant cost in the controlled range.
- Damage HUD work was small in the measured JavaScript portion. Browser paint/composition cost was not fully measured.
- Enabling shooting on an unarmed Studio bot also assigns a Vandal by default. Extra visible gun geometry can therefore contribute when comparing newly armed shooters to previously unarmed bots; the performance fixture held weapon models constant.
- First-shot shader/asset preparation alone cannot explain the user's sustained report. The expensive hurt calls persisted after warmup.

## Method and limitations

`tools/skin-converter/profile-bot-shooting.cjs` uses the actual native game factory with a controlled scheduler. Tests use a 1920x1080 hidden Electron renderer, the newest saved custom-range layout (read only), the native weapon model enabled, shadows disabled, and one, ten or twenty stationary Vandal bots. To isolate simultaneous hit processing, bots were configured with zero reaction/aim error and hit on synchronized ticks. These settings deliberately stress hit bursts and do not reproduce every normal drill's accuracy/timing.

The test audio output was muted while native audio creation/playback still ran. Timings cover JavaScript/native-call CPU and render submission, not complete GPU/display/compositor/audio-thread time. They are not foreground FPS, and a severe one/two-bot drop was not established. There is no claim of a memory leak or a complete explanation of every instance of the user's symptom.

Each variant warmed 256 controlled frames and then sampled 895 frames, spanning firing and reload periods. For the focused check, 30/300/600 shot and hit events were observed at 1/10/20 bots respectively. All other effects remained active in the hurt-only comparison.

Results:

- `bot-shooting-performance-simple-range.json`: initial 1/5-bot component tests without weapon model.
- `bot-shooting-performance-component-ablation.json`: 1/10/20-bot component tests in the saved range with weapon model.
- `bot-shooting-performance-results.json`: focused hurt-sound-only comparison above.

Potential follow-up (not implemented): pre-render/cache the hurt sound and avoid layering identical hurt sounds for simultaneous hits, while preserving every damage event and the visual damage feedback. Recheck foreground frame times afterward.
