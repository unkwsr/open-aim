# Restored gun-skin kill sequences

The existing RGX Vandal, Gaia Orange/White Vandal, BlastX Phantom, Singularity
Sheriff, Araxys/Rogue Operator and Prime Guardian sequences now run on target-only
kills as well as bot kills. Each skin retains its existing 1–5 sequence, wrap to
stage one, source files, gain and master/kill-sound mute controls. No removed AK
assets are reintroduced. Karambit hands, animations and weapon placement are unchanged.

The target-only branch previously skipped `playKill`. Both served engine layouts
now ask the active skin for its sequence on target kills. If that skin has no
sequence, the existing target-hit feedback remains. Bot kills retain the native
hit-feedback fallback. Ordinary hits, misses, damage and simulation timing do not
change. `extend-skin-kill-sequences.cjs` preserves the hook in future audio builds.

The controlled audio fixture checks 96 plays across eight selections and both
kill-event paths: stage ordering/wrap, decoding, existing gains, mute settings,
absence of per-kill fetching and preservation of default feedback. Results are
in `tools/skin-converter/skin-kill-sequences-test-results.json`. These are offline
event/audio checks, not foreground gameplay measurements.

Restart `Start Test Game.cmd` to reload the updated scripts. Work is restricted
to the test copy; player-data defaults and HTTP port 8137 are unchanged.

## Live saved-settings diagnosis (2026-10-29)

The user's test profile still had `al-audio-settings-v1.killSound: false`.
Both the native controller and grid-target feedback correctly respect that flag,
so the event-hook change alone could not restore audible sequences. The earlier
fixture supplied `killSound: true` and therefore missed this profile condition.

Restored only `killSound` to `true` in the running test profile and reloaded.
Master volume remains 0.5; all other audio settings and skin selections remain
as saved. This is a profile correction, not a startup override: the user can
still disable kill sounds in Settings.

Loaded the real Grid shooting scene and captured its native audio controller on
a firing call. Its settings showed `killSound: true`, master gain 0.5 and a
running AudioContext. Calling that controller's five stages for the selected
RGX Vandal, BlastX Phantom, Singularity Sheriff, Rogue Operator and Prime Guardian
returned true for all 25 calls and started 25 nonempty decoded buffers.
Evidence: `tools/skin-converter/live-kill-playback-results.json`.
This measures live controller playback; it is not a measurement of 25 gameplay
kills or a listening test. The scene also loaded the patched versioned engine
with the target-only event hook present.
