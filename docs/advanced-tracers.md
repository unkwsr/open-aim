# Advanced tracers and doubled headshot effects

Only the isolated aimtrainer-test copy is changed.

The existing Bullet tracers toggle remains the master switch. Expand Advanced bullet tracers and select Custom. Original retains the captured weapon-specific renderer. Custom supplies separate player/enemy enable, color, brightness, width (full width in cm), length, fade duration, every-N bullet frequency, random probability, and reset. Settings are validated, stored locally under es-advanced-tracers-v1, and applied live. Enemy trails default off. Native enemy events do not contain projectile paths: incoming trails are cosmetic guides from the actor toward the player, with deterministic offsets for misses, and are suppressed across blocked sight lines. Damage, hit detection, spread, recoil, and weapon timing are unchanged.

Custom mode uses one fixed geometry/shader batch and 96 pooled active records with 96 pending slots. The existing native renderer is used in Original mode; enemy-tracer work is gated off there. Mode switches, disabled rendering, time resets, and disposal clear effects. No per-frame texture generation or image uploads.

Headshot plane size increased from .828 m to 1.656 m on both axes. Atlas animation, randomized selection, anchor fraction, 180 ms lifetime, and native body/leg effects are preserved.

Canonical sources: app/mods/aim-tracers/{settings,renderer}.mjs, app/advanced-tracers.js, tools/skin-converter/extend-tracers.cjs, and tools/skin-converter/headshot-effects.cjs. Rebuild the generated engine overrides with node tools/skin-converter/build-audio-loader.cjs.

Validation: test-advanced-tracers.cjs passed real WebGL drawing/shader checks, measured width/length, fading, frequency, random probability, player/enemy isolation, pool caps, one geometry batch, native routing, live UI, validation, storage, and reset. test-headshot-effects.cjs passed doubled scale, unchanged anchoring/lifetime, pooling, random variants, and body-effect parity. test-ads-integration.cjs passed generated syntax and unchanged ADS timing. Hidden renderer fixtures only; no live-drill FPS measurement or user-PC gameplay control.

## 2026-10-28: Vandal tracer on Phantom, Spectre and Ghost

The native tracer table gives each gun a class.
- Before: Phantom and Spectre (`silent1p`) and Ghost (`silentLuger1p`) used the captured game's "silencer1p" effect, a white/grey tracer.
- Now: `extend-tracers.cjs` points both classes at the Vandal's `tracer1p` effect (orange/red), with Vandal's fade cycle `[1,.1,.02,.02]` and 0.1 s after impact.
- Each keeps its own start offset past the suppressor: 0.2 m for Phantom/Spectre, 1 m for Ghost.
- Unchanged: sniper contrails (Marshal, Operator, Outlaw), how often tracers appear, Custom mode, damage, hits and spread.

Verified: `test-advanced-tracers.cjs`, `test-headshot-effects.cjs` and `test-ads-integration.cjs` pass. Both `OkAdunfX.js` routes match and contain no `silencer1p` class. Not looked at in a live match.
