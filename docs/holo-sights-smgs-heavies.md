# Holo sight and graph ADS on Odin, Ares, Spectre, Stinger and Bulldog

Test copy only (2026-10-28). These guns now aim like Vandal, Phantom and Guardian:
- the folding reflex housing opens as you aim;
- the projected hexagon holo sits on the crosshair;
- aiming in and out, aimed idle, and firing while aimed all use each gun's own captured first-person animation graph.

The old lowered pose (iron sights 60–90 px under the crosshair and off to the left) is gone.

## Why it was possible

The captured game (`tools/ads-comparison/173-B0639fGL.js`) attaches its reflex device to:
- `viewmodel` (Vandal), Phantom, Guardian;
- Spectre, Stinger, Ares, Odin;
- Bulldog.

It also has an ADS tuning, blend-space and clip table for each of them. Our builder only took the first three.

The graph packs for the others were already installed in `app/mods/aim-viewmodel` (identical file hashes). Every gun rig has the `Reflex` socket bone, and the source mounts the device on that socket with no per-gun offset.

## Changes

| File | Change |
|---|---|
| `tools/skin-converter/build-new-ads.cjs` | graph stems include odin, ares, spectre, stinger, bulldog; packs copied from `aim-viewmodel` when not in `decoded-assets` |
| `tools/skin-converter/build-reflex.cjs` | `loadReflex` accepts the same eight stems |
| `tools/skin-converter/extend-reflex.cjs` | removed the glowing HUD-sight patch (`nativeGlow`); no gun uses it now |
| Generated | `app/mods/aim-ads/graph-runtime.mjs`, five new `*.fpgraph.*` packs in `app/mods/aim-ads`, `reflex/device-runtime.mjs`, both `OkAdunfX.js` routes |

Unchanged:
- damage, spread, hit registration, gameplay recoil;
- ADS zoom levels and ADS times (each gun keeps its own: Odin/Ares 0.25 s, Spectre/Stinger 0.13 s, Bulldog 0.16 s);
- sensitivity and hip fire.

No skins are installed for these five guns. The Blackmarket Bulldog textures in `aim-viewmodel` are not wired to the loader.

Rebuild with the usual three steps:
1. `build-new-ads.cjs`;
2. `build-viewmodel-loader`;
3. `build-audio-loader.cjs`.

A rebuild before the change reproduced the generated files byte for byte.

## Measured (hidden window, `tools/skin-converter/test-holo-sights.cjs`, results in `holo-sights-results.json`)

**Checks**
- Holo distance from screen centre at full ADS:
  - 0.17 px at most (Guardian);
  - 0.02 px at most on the five new guns.
- Housing is visible at hip and in ADS (default models).
- No GL errors while firing aimed for 0.5 s or while aiming out.

**Timings**
- Pack load: 21–33 ms per gun.
- Viewmodel render: median 0.1–0.2 ms per frame.
- Both are renderer-only numbers, not in-game FPS.
- Frames: `tools/skin-converter/holo-sights/<gun>-{hip,half,ads}.png`.

**Regression runs**
- On the final build, 16 ADS/sight/equip tests pass: ads-integration, ads-coupling, ads-equip-gate, ads-equip-smooth-gate, ads-pitch, new-ads, reflex, reflex-skins, rgx-sight, skin-viewmodel-placement, prime-guardian, movement-grip, guardian-reload, rifle-ads-preview, crosshair-live, sniper-scopes.
- Fixed in `test-ads-integration.cjs`:
  - its syntax check runs Electron as Node (`ELECTRON_RUN_AS_NODE`); before this, Electron tried to start the files as an app and failed or hung, on old and new builds alike;
  - its glow check now asserts the old glow is gone.
- Already failing before this change: `test-smooth-equip.cjs` (missing `old.mjs` fixture) and `test-araxys-scope-settings.cjs` (`getComputedStyle` on a missing element).

## Not verified

- Feel in a real match.
- Equip→ADS right after switching to one of these guns. The equip smoothing was tuned on the rifles, so this is the first thing to watch for.
