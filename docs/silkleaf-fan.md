# Silkleaf fan melee (test copy only)

Source: C:/Users/hate/Downloads/kingdom_download. No Sova arm model or Sova textures were imported. The original trainer arm mesh, textures and skeleton are preserved, with named animation tracks adapted to the existing rig. The existing Jett arm variant also remains supported. The main project was not edited or built.

## Use

Settings > Training range > Melee skin: Default knife / Silkleaf Fan. The fan is the initial choice when no melee preference has been saved. Select it and enter a map drill that supports melee. Small-ball drills retain their existing weapon restrictions.

Default controls: 3 equips melee, left click cycles four attacks, right click uses the alternate attack, Y inspects, and 1 returns to the primary weapon. Existing user key bindings take precedence. Attacking or switching weapons interrupts inspection. The fan has its own supplied equip, inspect, and attack WAVs. Other melee skins retain their normal sound behavior.

## Conversion and playback

The supplied fan keeps all 1,208 vertices and 1,118 triangles. Colour, normal, ORM and emission PNG files remain byte-identical at 2048x2048. A single shared material uses these maps. The original UVs, normals and authored bone weights are retained (weights use the trainer's existing normalized 8-bit GPU format).

Paired hand and fan clips are sampled offline into aligned Float32 transform tracks. Translation, rotation AND animated scale are preserved. The exported clips use a 24 Hz timeline; playback is calibrated to the trainer's 60 Hz authored frame cadence (2.5x export rate), yielding 1.667 s equip and 4.1 s inspect clips. This timing choice is an integration calibration, not metadata claiming the exporter specifies original gameplay speed. Existing damage, hit windows, equip readiness, attack cadence and movement rules remain unchanged.

The fan's authored root orientation is preserved using the same coordinate basis as the arms. The gun and hands use synchronized action selection and blending. Existing walking/idle additive motion remains available. Named tracks let the existing alternate arms receive the same pose and scale.

Runtime sampling reuses decoded arrays, quaternion scratch values and scale caches. Files are loaded per model, not during attacks or inspection. The fan path skips the unused AK model. The fan and base arms render as two mesh draws (14,217 triangles total). These are structural cost checks, not a promise of an FPS gain.

## Validation

- validate-fan.mjs: unchanged original arm mesh/skeleton, exact four source textures, geometry counts, aligned animation blocks, finite transforms, normalized quaternions, and preserved animated scales.
- test-fan.cjs: actual game renderer, equip, attacks, alternate attack, inspect, interrupted inspect, default knife switching, existing Jett arms and resource disposal; rendered frames are in tools/skin-converter/fan-*.png and results in fan-test-results.json.
- test-fan-regression.cjs: existing Default, Champions and RGX Vandal loaders still construct, update and dispose.
- Native game opened and a map drill tested. Simulated melee-key input did not reliably register through the Windows automation tool, so a live key-driven fan/inspect demonstration is not claimed. The animation playback itself was rendered and inspected using the actual game loader and renderer.

Rebuild from the test-copy root:

    node tools/skin-converter/import-fan.mjs
    node tools/skin-converter/build-audio-loader.cjs
    node --input-type=module -e "import {buildViewmodelLoader} from './tools/skin-converter/build-viewmodel-loader.mjs';buildViewmodelLoader(process.cwd())"
    node tools/skin-converter/validate-fan.mjs

## Attack recovery and supplied audio update

Light attack visuals now complete in 0.58 s and alternate attack in 0.86 s. A shared piecewise time map preserves the initial 0.18 s strike phase and compresses recovery; hand and fan samples use the same map. Blend-in is 0.09 s and blend-out 0.08 s. Equip and inspect clips/timing remain unchanged, as do damage windows and attack cadence.

Original WAVs are copied byte-for-byte into app/mods/media/silkleaf-fan/: equip.wav, inspect.wav, attack1.wav and attack2.wav. Light attacks alternate attack1/attack2 across combo variants; alternate attack uses attack2. app/fan-audio.js preloads/decodes each file once, deduplicates simulation events, and routes voices through the existing master audio output. Inspect/equip voices stop when interrupted; switching weapons, choosing Default knife or pausing stops fan audio.

Test-fan.cjs and test-fan-audio.cjs now use a self-contained read-only fixture server and hidden renderer windows; they do not launch or control the user's game. Tests cover chained attacks and recovery, four WAV decodes, equip deduplication, inspection interruption, light/heavy sound mapping, pause and weapon/skin scoping. Results are saved in fan-test-results.json and fan-audio-test-results.json. Live gameplay feel remains for the user to assess.
