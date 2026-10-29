# Occasional crouching and jump-height reset

Implemented 2026-10-28 in the isolated test checkout. Studio compiler: 14.

Select a bot and enable **Occasional crouching**. Defaults: hold the fully crouched pose for a randomized 0.5–1.2 seconds, then stand for a randomized 2–4 seconds before crouching again. Both ranges are adjustable from 0.3 to 10 seconds. Older drills and new bots default to off. Choosing the existing fixed Standing/Crouching pose turns occasional crouching off; enabling occasional crouching clears the fixed crouch flag.

The **Jump height** control now explicitly says **Default: 1.15 m (your normal jump)** and includes **Reset to 1.15 m**. Reset affects only the selected bot's jump height, is undoable, and preserves its jump interval. Saved custom heights remain unchanged until reset.

## Native behavior

Peekers also expose **Pose → Standing / Crouching**. Fixed crouch keeps the peeker low during both the outward peek and return; Walk / Run still determines movement speed. Occasional crouching remains available, with the same fixed/random exclusivity as other bots. This uses the existing native fixed-crouch pose without a compiler or engine change.

The extended fixtures passed four fixed-crouch peeker cases (together/in-order spawning, flash on/off), checking outward movement, return and lowered native head hitboxes. The editor control, saved compiled pose, reopen selection and actual game-engine loading also passed. These are automated hidden-runtime checks; foreground FPS was not measured for this UI addition.

The compiler stores optional `studioCrouch` duration/interval ranges on the actor template. `extend-studio-crouch.cjs` connects them to a per-life seeded scheduler in native behavior updates. Runtime state contains only primitive values. The native player's 0.275-second crouch transition drives a continuous amount from zero to one; full crouch uses the native character's crouch or directional crouch-walk pose. Movement smoothly approaches the player's crouch speed multiplier, combined with any hit slowdown.

Visual skeletons and native hitboxes blend between the same standing and crouched poses; the character is not scaled or teleported. Shooter stance and firing-eye height follow the crouch amount. The hit-test broad phase remains conservative during blending.

The amount freezes while airborne. Timed jumps wait until the bot has stood completely; a pending jump takes priority over starting/holding another crouch. Path obstacle hops freeze the existing amount until grounded. New lives reset crouch on the first respawn snapshot, including route-owned respawns.

Helper sources are `studio-crouch-core.js.txt` and `studio-crouch-render.js.txt` beside the generator. It updates both served core/renderer routes and is reapplied by `build-audio-loader.cjs`. It validates replacement anchors and all outputs before writing; regeneration is idempotent. No unrelated generators were run.

## Measured verification

`test-studio-crouch.cjs` runs in this copy's hidden Electron runtime. Results: `studio-crouch-results.json` beside the script.

- Twenty native cases: all five bot movement types, together/in-order spawning, and jumping on/off. Repeated standing/crouching, bounded gradual transitions, timed jump coordination and no pose changes while already airborne passed.
- Full transition takes 36 ticks at 128 Hz and matches the player's crouch amount tick for tick (nominal duration 0.275 seconds; first full tick at 0.28125 seconds).
- In a controlled run, standing movement reached 5.4 m/s; fully crouched movement reached 1.89 m/s (35%).
- Native head hitbox lowered 0.398333 m. Fully blended hitbox centers and rendered bone positions exactly matched native fixed-crouch endpoints in the fixture; the halfway blend and actual renderer updater were checked.
- Real native gunfire killed a crouched target by aiming at the lowered head. Respawn reset the pose immediately.
- Seeded replay, legacy off defaults, schema/save round trips, UI range ordering, fixed/random pose exclusivity, undo/redo and save/reopen passed.
- The visible 1.15 m default, reset button, reset undo/redo and saved reset value passed.

Regression fixtures also passed: jumping/hit-slow/respawn/UI, player-versus-bot jump trajectories (still matching to floating-point precision), Studio navigation/draft recovery and shell isolation (zero missing requests).

These are hidden native simulation/render/UI measurements. Foreground appearance and gameplay remain for user confirmation through **Start Test Game.cmd**. The editor's illustrative route preview does not simulate occasional crouching, matching the existing Play-only jumping controls.

## Startup failure fixed after user report

The user reported `Cannot read properties of undefined (reading 'studioCrouch')` while loading My drill. Reproduced in `test-crouch-loading.cjs --baseline`: importing the actual `OkAdunfX.js` game module calls `MS` for an initial head-position calculation using a pose-probe object with no `behavior` map. `aimActorPose` incorrectly assumed the map always existed. The earlier fixture used live simulation actors, so it did not exercise this import-time probe.

`aimActorPose` and the injected read-only stance/render helpers now treat absent behavior maps as zero dynamic crouch. The scheduler only runs on actors with simulation behavior state. The fix lives in the generator/helper source and is applied to both served core and renderer routes; errors are not swallowed and the game preparation gate remains intact.

New regression: `test-crouch-loading.cjs` imports the actual game module, constructs the real engine, completes native preparation through Ready and runs first frames. Standing, fixed crouch, occasional crouch, and jumping plus crouching all pass. It also reads the newest saved range drill without modifying saves and verifies that scene with weapon-model preparation enabled. Results are in `crouch-loading-results.json`; the original reproduced probe/module-import errors remain in `crouch-loading-baseline.json`.

After this fix the complete crouch fixture also passed again. Fully restart through `Start Test Game.cmd` to replace the cached module that failed during import.
