# Local sound files and Vandal selection

All changes are in C:/Users/hate/Desktop/aimtrainer-test. Launch Start Test Game.cmd. The main project and its executable have not been rebuilt or modified.

## Use

- Settings > Training range > Weapon skin: Default, Champions Vandal, RGX Yellow. Select a skin and enter a scene. RGX geometry and textures are unchanged by these settings additions.
- Settings > Audio > Gunshot sound > Custom > Choose file: import any playable audio (WAV, MP3, OGG, FLAC, M4A and other Chromium-supported formats), up to 20 MB. Importing selects Local files automatically. Preview auditions it; Selecting a built-in firing preset hides the file controls and uses that preset for player shots without forgetting the import.
- Settings > Audio > Enemy kill sound > Custom: choose separate files for kills 1, 2, 3, 4 and 5. The sixth kill repeats slot 1, matching the game's built-in sequence. Empty slots fall back to the selected Champions, Gaia or Prelude preset. Reset removes only that slot's imported copy.
- Local sound volume applies to both local shots and local kill sounds. In gameplay, the existing Training sounds, Play kill sound and Master volume controls still apply. Enemy shot sounds remain unchanged.
- Original file bytes and filenames are stored in this test profile's IndexedDB; selection and volume are saved in localStorage. Moving the original audio file afterward does not break the imported copy. Invalid files leave the previous valid sound in place.

## Implementation

app/local-customization.js adds controls beside the existing settings, predecodes saved audio and reuses audio buffers during gameplay. Player fire and kill methods in the captured game-engine overrides call the custom player first, then use native audio when no override is active or a slot is empty. No filesystem/network work occurs per shot. Voices are capped at 24; successive kill sounds replace the previous kill voice.

The model-loader override selects the saved manifest and binary only for the Vandal; other weapon models retain their existing paths. Skin identity is part of the in-memory model cache key. Arms, animation lookup and gameplay rules remain unchanged.

Rebuild overrides from the test-copy root:

    node tools/skin-converter/build-audio-loader.cjs
    node --input-type=module -e "import {buildViewmodelLoader} from './tools/skin-converter/build-viewmodel-loader.mjs';buildViewmodelLoader(process.cwd())"

## Validation

The hidden Electron test uses a separate .customization-test-profile and the actual local server. It checks real OGG decoding, all five kill slots and cycling, native fire/kill method integration, built-in fallback without doubled shots, invalid import handling, slot reset, and persistence across renderer reloads. It loads, creates and disposes all three real viewmodels. Results: tools/skin-converter/customization-test-results.json.

The actual game UI was also inspected: the three skin choices appear in Training range, local firing controls appear in Audio, and the Windows file chooser successfully imported the existing Vandal OGG and selected Local files. Preview was triggered through the UI. Audio was validated through decoding and source scheduling; no claim of subjective listening or a controlled FPS benchmark is made.

## Inline Custom selection fix

Custom now appears beside the native firing and kill presets; file controls are only visible while Custom is selected. Selecting a built-in choice immediately disables and stops the corresponding custom audio, preserves imported files, and saves the selection. An explicitly selected built-in firing preset (including Ghost) takes priority over the weapon recording for player shots. Enemy sounds retain their original behavior. Regression results for this fix are in tools/skin-converter/sound-selection-test-results.json.

## Vandal-only audio scope

The selected firing preset (including local files) and selected skin/custom kill sequence apply only when the active shot weapon is Vandal. The kill event now passes the actual weapon from the same simulation snapshot as the shot. Other weapons keep their own shot recording and use normal hit/kill feedback instead of the Vandal kill sequence. The settings headings and custom panels are labelled Vandal. Existing imported files and preferences are preserved. Regression coverage includes Ghost, Phantom, Sheriff, Operator, melee, and switching back to Vandal, with both Custom and built-in firing selections active.

## 2026-10-28: RGX Vandal sounds built in; Vandal sound settings removed

At the user's request:
- **Removed:** the Vandal firing sound setting ("Vandal" preset and Custom firing file) and the Vandal kill sound setting (Champions 2021 and the other kill presets, plus the Custom kill sequence). Both settings rows are hidden.
- **Kept:** the kill sound on/off switch.
- **Code:** `app/local-customization.js` no longer has the import panels or the IndexedDB file store.

**RGX Yellow now has its own sounds**, played automatically when that skin is selected:
- the files the player had imported into the custom slots, copied byte for byte (same SHA-1) into `app/mods/media/rgx-vandal-yellow/`:
  - `fire.wav` (from `bullettgx.WAV`, 0.88 s);
  - `kill1.wav` to `kill5.wav` (from `1rgx`, `2gx`, `3rgx`, `4rgx`, `rgx4`; 1.42–3.04 s);
- volume 0.46, the local sound volume the player had set;
- kills play 1→5, then repeat from 1, and each kill cuts off the previous one.

**Everything else**
- Other Vandal skins: Default and Champions use the Vandal's own shot recording and normal kill feedback. Gaia keeps its own shot.
- Other weapons' skin sounds (BlastX, Singularity, Araxys) are unchanged.

**Engine (`build-audio-loader.cjs`)**
- `playFire` plays a skin sound first, otherwise the gun's own recording.
- `playKill` asks for a skin kill sequence for Phantom, Sheriff, Operator and Vandal, otherwise returns to the normal kill feedback.
- The Vandal hook is added after the Singularity and Araxys hooks, which widen that same condition.

**Left as is**
- The old imported files are still stored in the test profile's IndexedDB, unused.
- `es-local-audio-v1` and the native `fireKit`/`killKit` values stay in localStorage and are ignored.

**Tests**
- `test-rgx-audio.cjs` passes.
- `test-gaia-audio.cjs` is updated: RGX now has its own shot, and the custom-file part is gone.
- Still pass: BlastX, Singularity, Araxys, bot default audio, grid target audio, ADS integration.
- `test-customization.cjs` covered the removed import panels and now fails by design.
