# ADS adaptation — current implementation

Only C:/Users/hate/Desktop/aimtrainer-test was changed. The main project was not modified, built or launched.

## Behavior and alignment

Vandal (Default/Champions/RGX/Gaia), Phantom (Default/BlastX) and Guardian use the captured first-person graph, authored locomotion, aim springs and ADS recoil presentation. Camera FOV and first-person FOV advance separately, with the captured world-zoom delay. Marshal, Outlaw and Operator use those zoom curves while retaining their native pose path and existing scope artwork.

The gun and visible ADS sight share the same recoil quaternion. A virtual sight point is calibrated against the model's native ADS rest pose, then transformed with the gun attachment. The loader corrects the model's view-space translation to keep that point on the displayed sight ray. Matrices are refreshed before and after this calculation; using stale parent matrices caused incorrect corrections. Corrections are cached between physics ticks and recalculated for a hand change. Both hands and all current rifle skins are supported.

This binding makes the rendered weapon follow upward ADS recoil, rather than independently moving a HUD mark and adding local gun jiggle. The earlier extra ADS firing-montage workaround and separate local pitch correction have been removed. The original captured selection of ADS firing layers is retained. Captured locomotion remains; its retargeting amplitude gain is 1–3 according to movement and ADS weight.

Perfect-accuracy drills zero the simulation's recoil angles. In that mode only, a visual 1.15-degree pulse uses the original 20 ms rise/250 ms recovery envelope and feeds the shared gun/sight quaternion. Its first shot is not suppressed by the old burst buildup multiplier. The actual accuracy crosshair and simulation angles stay unchanged. Normal recoil modes use the captured simulation-derived rotation.

All gameplay ADS times, sensitivity, bullet recoil/spread, hit logic, sounds, skin geometry and texture quality remain unchanged. Equip/reload/melee and unsupported weapon fallback paths remain native. Existing agent arms and Jett retargeting remain in use.

## Validation

- test-ads-coupling.cjs: 28 skin/hand/recoil-mode cases. During recoil and movement the projected gun sight anchor agrees with the ADS sight to numerical precision (maximum normalized error 9.99e-16). Sampled skinned vertex bounds move upward in every case, verifying actual model geometry rather than only barrel angles or a HUD value. These are controlled hidden-renderer cases, not gameplay footage.
- test-new-ads.cjs: seven weapon/skin combinations, both hands, finite transforms, idle/ADS/walk/crouch/jump/fire/reload/equip, Jett arms, transition reversal, melee reset, scene-default weapon, unsupported weapon and legacy fallback.
- Sniper endpoints, immediate scope-out and Operator second zoom remain correct.
- test-ads-integration.cjs: generated engine syntax, native simulation hooks, HUD tracking/reset, and byte-identical native ADS timing/sensitivity block.
- Existing scope artwork/transparency/reticle regression and fan-melee regression passed during the initial adaptation; their paths are unchanged by sight binding.

Current isolated component benchmark: legacy update 0.061 ms; new graph/model update 0.181 ms; cached repeated frame 0.035 ms; controller tick 0.0038 ms. These are CPU component measurements, not drill FPS. Graph packs load locally, are memoized across skins, and compile samplers at model creation.

## Rebuild and test copy

Launch: C:/Users/hate/Desktop/aimtrainer-test/Start Test Game.cmd. Restart the running test copy to load edited modules.

From this test-copy root:

1. node tools/skin-converter/build-new-ads.cjs
2. node -e "import('./tools/skin-converter/build-viewmodel-loader.mjs').then(m=>m.buildViewmodelLoader(process.cwd()))"
3. node tools/skin-converter/build-audio-loader.cjs

Canonical sources: tools/skin-converter/ads-session.mjs, extend-new-ads.cjs and build-new-ads.cjs. Both engine/loader route variants are generated. For developer A/B checks, window.__aimAdsMode='legacy' or 'new'; the default is new. This is not a settings-menu option.

## Source/evidence

User-supplied C:/Users/hate/Downloads/ishoutu.har; extracted bundles 173-B0639fGL.js (graph/controller/tunings), 170-OXh9x7QR.js (camera/controller integration), and 53-XbqdCR7C.js (curve and weapon rules). Captured Vandal/Phantom/Guardian graph manifests and binaries are decoded offline under tools/ads-comparison/decoded-assets. Static compatibility and timing comparisons are saved in tools/ads-comparison/weapon-ads-comparison.json.

REA historical HAR summary: ev_c447ccb22d93c4c12f9a4a0466bd57f0dbe6449ea60ca97ab9d0ce0ae00abbfd; parent ev_579a619aa2de3255fe1396cf3a334919639f76d53b7ba2d9ad4f9cb3f941cc46. This establishes capture coverage; runtime checks above validate the local adaptation separately. Complete sniper first-person graph assets were not present, so their native pose path is retained.

