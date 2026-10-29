# Sniper scope artwork and visual easing (test copy)

Applies only to Marshal, Outlaw and Operator in C:/Users/hate/Desktop/aimtrainer-test. Restart the test game to load the new injected presentation script. No main-project files or executable were modified.

The supplied JPG is copied unchanged to app/mods/media/sniper-scope/reference.jpg. app/sniper-scopes.js removes the printed checkerboard optical opening and masks exterior corner mattes while building a cached live overlay, keeps the lens transparent, and draws the thin crosshair, side brackets, top/bottom marks and right-side arcs at the exact viewport aim centre. Scope sizing follows viewport height and existing game stretch/frame variables; black masking fills additional space on wide displays. Texture processing happens once at preload, canvas painting only when layout changes, and scope opening uses composited scale/opacity. Resize/layout observers are disconnected when the scope component unmounts.

The camera and overlay read native simulation progress and ease its rendered appearance. No additional ADS timer or fixed delay is introduced. Sniper model/scoped FOV endpoints, aim sensitivity, accuracy/readiness, firing rules and native transition constants retain their existing values. The original simulation section that advances Dt, zoom level, successive zoom, and us is preserved byte-for-byte. Non-sniper rendering keeps its original zoom calculation.

Native values verified directly from the existing weapon definitions:

- Marshal: transitionSeconds 0.1, zoomOutSeconds 0, zoomSuccessiveSeconds 0; 3.5x zoom.
- Outlaw: transitionSeconds 0.1, zoomOutSeconds 0, zoomSuccessiveSeconds 0; 3.5x zoom.
- Operator: transitionSeconds 0.2, zoomOutSeconds 0, zoomSuccessiveSeconds 0; 2.5x and 5x zoom.

The native zero-duration scope-out and successive-zoom transitions intentionally stay instantaneous. Visual easing is applied within the existing timed opening window. Floating-point values effectively at one are treated as completed in the presentation layer so visual completion is not delayed by a frame.

Files:

- app/sniper-scopes.js: cached artwork, reticle, layout handling and presentation-only progress helpers.
- tools/skin-converter/extend-sniper-scopes.cjs: scoped renderer/HUD hooks, composed into build-audio-loader.cjs without replacing the existing sound/melee fixes.
- app/main.js and app/package.json: load/package the presentation script.
- tools/skin-converter/test-sniper-scopes.cjs: self-contained hidden renderer tests; no user-game control.

Validation passed: unchanged ADS simulation block, unchanged weapon definitions, original JPG byte integrity, monotonic zoom and exact native endpoints, native zero-duration transitions, transparent lens, centred reticle, non-sniper fallback, resource cleanup, and rendered layouts at 16:9, 4:3 and ultrawide. Results are in tools/skin-converter/scope-test-results.json and scope-*.png. The previews use a synthetic background; live gameplay feel is left for the user to test.

2026-10-28 replacement: supplied `Downloads/bb1bd524-32db-4583-86ae-31b63e2b4b54.jpg`
is now the unchanged reference asset. The lens opening is centred at source
(512,286), radius 320. All three snipers, including Araxys Operator, use the same
housing and reticle. All four exterior corner wedges are transparent for every sniper, including
the wide-screen mask behind the JPG, matching the reference checkerboard regions. Existing centre-dot settings remain supported. No ADS timing,
sensitivity, weapon rules, bloom or per-frame image processing was added.
The updated hidden renderer checks pass; wide layout visually inspected.
Foreground gameplay and FPS have not been measured.

2026-10-29 settings preview: the Crosshair lab's Sniper tab drew the new housing only
for Araxys Operator (with an older cut of the artwork) and a plain black circle for
every other sniper. sniper-scopes.js now exposes `__aimScopeVisual.draw(ctx,w,h,stretch)`,
the same drawing the in-game overlay uses, rendered into a cached offscreen canvas so
the clear corners show the preview's world. The lab (ChJ6FlD4.js, both app/mods routes)
calls it for all snipers; the plain circle remains only while the artwork is loading.
Centre-dot size is 12 x thickness px at 1080p in both the preview and the game, so a
thickness of 0.041 (~0.5 px) is effectively invisible. Live check: thickness 1 showed the
dot immediately. test-sniper-scopes and test-rifle-ads-preview pass.
