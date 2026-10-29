# Performance: per-gun cost and the 100–200 ms freezes (2026-10-28)

The user's in-game overlay showed a few things:
- very high average FPS: Stinger 1138, Spectre 1346, Sunset with bots 527;
- **"Worst 120–205 ms" in every screenshot**;
- one Odin shot at 259 FPS (3.87 ms per frame).

Nothing in the game was changed for this inspection.

## Method

`tools/skin-converter/profile-weapons.cjs` runs the real game engine in a hidden 1920×1080 Electron window on this PC, the same way as `profile-bot-shooting.cjs`, but with a controlled 240 Hz frame clock.

**Setup**
- Scene: training range with one far bot.
- Shadows off; RGX Vandal and BlastX Phantom skins.
- One fresh window per gun.

**Each run**

| Phase | Duration |
|---|---|
| Settle | 1 s |
| Hip | 3 s |
| Holding aim | 3 s |
| Holding aim and fire | 3 s |
| Release | 1 s |

**Recorded per frame**
- CPU time (simulation tick and render submission);
- GPU time (WebGL timer queries);
- new shader programs, textures and meshes created that frame;
- time spent starting the audio system (`ensure`) and playing the gunshot (`fire`).

`WEAPON_PROFILE_AUDIO=0` repeats the run with game audio off.

**Limitations**
- Hidden window, not foreground FPS.
- Browser compositing and display are not included.
- `performance.now()` is coarse in this window (0.1 ms steps).
- The GPU shader cache persists between runs, so shader compile times vary (cold vs warm).

## Steady state: Odin is not more expensive

Mean per frame, from the run with timed audio:

| Gun | CPU hip | GPU hip | GPU aim | CPU firing | GPU firing |
|---|---|---|---|---|---|
| Stinger | 0.17 | 0.10 | 0.09 | 0.25 | 0.12 |
| Spectre | 0.10 | 0.08 | 0.09 | 0.21 | 0.11 |
| Odin | 0.12 | 0.11 | 0.12 | 0.18 | 0.13 |
| Vandal | 0.12 | 0.12 | 0.12 | 0.15 | 0.08 |
| Ares | 0.11 | 0.09 | 0.09 | 0.15 | 0.08 |
| Bulldog | 0.11 | 0.09 | 0.15 | 0.15 | 0.09 |
| Phantom | 0.11 | 0.08 | 0.11 | 0.14 | 0.13 |
| Guardian | 0.11 | 0.09 | 0.11 | 0.18 | 0.11 |

All times in ms. Odin costs the same as the others. The 259 FPS screenshot was not reproduced as a steady cost; it most likely caught a moment near a stall.

Open lead: GPU p99 is about 5.3–5.9 ms on Odin, Vandal, Bulldog, Phantom and Guardian, against about 1–2 ms on Stinger, Spectre and Ares. So about 1% of frames carry a ~5.7 ms GPU spike on those guns. The cause is not identified, and timer-query noise is possible.

## The freezes are one-time setup on the spot

Worst frames from the runs:

| When | Cost | What happened that frame |
|---|---|---|
| First shot, tick | 25–97 ms (Stinger 64–97, Guardian 25) | Audio system created (`new AudioContext` inside `ensure()`). Stinger: 68.7 of 72.2 ms. Gone with game audio off. |
| First shot, next frame | 11–29 ms warm; 153 ms cold | 4–5 new shader programs (muzzle flash / tracer / impact effects) plus a texture and meshes |
| First frame of the round | 20–34 ms | 6 new shader programs, 9 textures |
| About 0.13 s into the round | 16–21 ms | 1 new program and meshes, when the bot first appears |

These match the overlay's 120–205 ms "worst in the last 5 s": the user took each screenshot shortly after starting a round and firing.

## Possible fixes (as first proposed)

1. **Start the audio system during scene preparation (the loading screen), not on the first sound.** The browser's audio context starts suspended until a click, but building it is the expensive part.
2. **Pre-compile the effect shaders during scene preparation:**
   - muzzle flash, tracer, impact/bullet hole;
   - the scene's bot material;
   - the first-frame programs.

   This can be done by rendering them once off screen, or with `renderer.compile`, so no programs are created during play.
3. Re-measure with this profiler (worst frames, new programs per frame), then check the foreground overlay.

## Fix applied (2026-10-28)

`tools/skin-converter/extend-first-shot-warmup.cjs` runs at the end of the `build-audio-loader.cjs` chain and makes two changes:

1. **Audio:** scene preparation (the loading screen) now calls `re.ensure?.()`, so the audio context and weapon sounds start there instead of inside the first gunshot's tick.
2. **Muzzle-flash effects:**
   - Once the current gun's effect textures have loaded, the effect system creates all of that gun's effect materials.
   - Creating them sets the system's own warm-up flag (`y`), so its existing off-screen warm-up (`B`) compiles them right away.
   - That happens about 0.5–0.75 s into the round, instead of on the first shot.

3. **Warm-up graphics error:** the system's warm-up drew its light/tone passes into render target `N` while sampling `N.texture`. That is a WebGL feedback loop: `GL_INVALID_OPERATION` (1282), and the draw is dropped. It was already happening on the first shot and later while firing in the old engine (measured), and moving the warm-up earlier exposed it to `test-scenario-loading.cjs`. The warm-up passes now sample no texture; it only needs the programs compiled, and the real passes set their input before every draw.

The pre-change engine file was kept for comparison in the session scratchpad.

### Measured after (same profiler, all eight guns)

| | Before | After |
|---|---|---|
| Worst frame while firing (CPU) | 25–153 ms, plus up to 97 ms audio start | 2.2–3.6 ms (Guardian: 3.7–3.8 ms on two reruns; one 16.6 ms one-off with no shader or audio work, likely GC) |
| Audio start during play | 25–97 ms on the first shot | 0, now in preparation |
| Effect shaders built on the first shot | 4–5 | 0; built at round start, 12–24 ms in one frame |
| Steady-state cost | ~0.1 ms CPU / ~0.1 ms GPU | unchanged |
| Scene preparation | ~1.1–2.0 s | ~1.05–1.5 s (no measurable increase) |
| WebGL errors during a run | 1282 on the first shot and later while firing | none (Vandal, Stinger, Odin) |

### Still remaining

These are all at round start, not during fights:
- the first frame: 6 programs, about 20–25 ms;
- the bot's first appearance: 1 program, about 13–19 ms;
- the effect warm-up: about 12–24 ms.

The GPU p99 spikes noted above are unchanged and unexplained. Foreground in-game feel and overlay numbers are not yet checked by the user.

Regression tests passing after the fix:
- `ads-integration`, `advanced-tracers`, `headshot-effects`;
- `rgx-audio`, `blastx-audio`, `gaia-audio`, `singularity-audio`, `bot-default-audio`, `grid-target-audio`;
- `butterfly-prewarm`, `crouch-loading`, `melee-prewarm`, `scenario-loading`, `unified-loading`.
