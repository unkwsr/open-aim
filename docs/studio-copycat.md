# Studio copycat bots (record and replay)

Test copy only. A Studio bot type that repeats a run you recorded and shoots at you.

## Using it

1. Drill Settings → Add → **Copycat**. Place it.
2. Select it → **Record my movement**. The game plays a recording scene:
   - you start on the bot's spot, facing your usual start, where a still training bot stands to aim at;
   - other bots and targets are removed; walls and buildings stay;
   - the round lasts 30 s. Press Esc and leave (or let the round end) to go back.
3. Back in the Studio: **Keep / Record again / Discard**, with a summary (length, metres moved,
   jumps, crouches, times fired).
4. Copycat panel: **Preview the run** slider (moves the bot along its run on the map, not an
   edit), Playback (Loop / Once, then stand / Back and forth), Speed 0.75–1.25×, Mirror left
   and right, Start anywhere on the run, When it shoots (When I shot / As soon as it sees you),
   Record again, Remove run. Timed jump and occasional crouch options are hidden: the run
   holds its own jumps and crouches.

## Run library

Saved runs you can reuse on any copycat.

**Saving**
- **Keep and save to library** in the dialog after recording.
- **Save to library** on a copycat that already has a run.
- Both ask for a name. The bot then shows the name in its panel.

**Using**
- **Use a saved run** on a copycat's panel opens a list with:
  - each run's drawing, name and summary;
  - where it was recorded.
- A run recorded somewhere other than the current drill's place shows an amber warning: check it doesn't run through walls.
- The bot gets its own copy of the run. Renaming or deleting the saved run later never changes a drill. Using a run can be undone.

**Managing:** the Studio library has a **Runs** tab next to **My drills**, with Rename and Delete.

**Storage:** one JSON file per run in `<userData>/studio-runs/` (under `test-data/` in this copy). Each file holds:
- `{ id, name, place, created, track }`;
- `track` is the same format a copycat holds, so the game engine needs no change.

The store functions are `runList`, `runSave`, `runRename` and `runRemove` in `app/studio-store.js`. Before saving, they check that the run's numbers are valid, trim the name to 40 characters, and strip anything that isn't hex from file ids.

## How it works

| Piece | File |
|---|---|
| Bot type, run format, compile, checks | `app/studio/drill.js` (`recordingDrill`, `compileRecording`, `trackFromTake`, `copycatFrames`, `copycatAt`, `trackBlocked`) |
| Panel, record button, Keep dialog, scrub, map path | `app/studio/studio.js`, `app/studio/view3d.js`, `app/studio/studio.css` |
| Recording scene storage (one at a time, outside drill files) | `app/studio-store.js` (`record`, `recording`, `clearRecording`), `app/preload.js`, `app/main.js` |
| Start recording and carry the take back | `app/studio-launch.js` (`#studio-record=<code>`, sessionStorage `studio-take`) |
| Engine: recorder, `replay` behavior, shooter gate, scene checker | `tools/skin-converter/extend-studio-replay.cjs` + `studio-replay-core.js.txt` + `studio-replay-record.js.txt` |

- **Recording:** while a scene has `rules.studioRecord`, the game's step keeps the player's position,
  crouch amount, fire button and in-the-air flag for every tick (128/s) in
  `globalThis.__aimStudioTake`, keyed by tick, so checkpoint rollbacks rewrite the same ticks.
- **Run format:** `bot.track = { hz: 30, secs, p: [side, up, toward, crouch, fired, air, ...] }`,
  relative to the bot's spot, with "toward" pointing at your start spot. Moving or turning the
  bot (or your start) takes the whole run with it. Idle time before the first move is trimmed
  to 0.25 s. A shot counts for ±0.12 s around it.
- **Playback:** the `replay` behavior sets the bot's position each tick from the world-space
  frames (linear between samples) and drives the existing Studio crouch pose, so crouched
  bodies and hitboxes are the native crouch. Running/strafe animations come from the game's
  own movement detection. The spawner does not ground-snap, so jumps keep their height.
- **Shooting:**
  - "When I shot": the shooter uses `engage: "move"` and only fires while the run's fired flag is set.
  - "As soon as it sees you": the normal `engage: "stop"`; the run pauses while the bot holds to shoot.
- **Scene checker:** `app/mods/{next,_assets/r20261021-1/next}/js/D_iGclxB.js` is built from the
  site's original with `replay` added to the known behaviors (the lobby validates scenes with it).

## Rebuilding

`node tools/skin-converter/extend-studio-replay.cjs` patches both engine routes and writes the
scene-checker override. Safe to run again. `build-audio-loader.cjs` also re-applies it after
the Studio crouch patch, because that patch trims everything appended after its own marker.

## Tests

- `tools/skin-converter/test-studio-copycat.cjs` (hidden window). Results go to `studio-copycat-results.json`. It covers:
  - the real engine records a scripted run;
  - conversion into a run;
  - in-game playback compared with the Studio preview;
  - crouch, jump and shooting modes;
  - loop, once, back-and-forth, mirror and speed;
  - determinism and checkpoint restore;
  - the wall warning;
  - other bots unchanged;
  - Studio UI: Keep dialog, controls, undo/redo, scrub, 3D view, save/reopen, and the record button's scene.
- `tools/skin-converter/test-studio-run-library.cjs`:
  - Store, in the main process: save, list, rename, remove, bad runs refused, id sanitising.
  - Studio UI: save with a name, cancel, undo, use a saved run (a copy, with undo/redo), drills surviving deletion, the empty-library note, the other-place warning, Keep and save, and the Runs tab with rename and delete.
- `tools/skin-converter/profile-studio-copycat.cjs`: store round trip, plus simulation time per
  tick for 5 copycats against 5 strafers. This is not a frame-rate measurement.

## Measured (2026-10-28, Ryzen 5 5600X, hidden window)

- The recorded movement matches the player exactly (max error 0). The run stays within 2.1 cm of the recording. In-game playback matches the Studio preview (error 0).
- Simulation only, median of 5 runs over 20 s: 5 copycats took 0.012 ms per tick, against 0.017 ms per tick for 5 strafers. This is not a frame-rate result.
- A drill with 5 copycats, each with a 30 s run, is 92 KB. The game's scene limit is 8 MB.

## Known limits

- The recording also appears as a card in VALORANT Training while you record. It goes when you come back. Its round may also be written to your training history.
- Wall checks are a Studio warning only. During play the bot follows the recorded path exactly and does not collide.
- The bot always faces you. It copies your movement, not where you looked.
