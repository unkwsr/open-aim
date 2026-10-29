# Studio bot jumping and hit slowing

Update: compiler 14 adds [occasional crouching](studio-occasional-crouch.md) and a visible jump default/reset button for **1.15 m**.

Update: compiler 13 now defaults new bot jumps to **1.15 m** and uses player gravity. Saved heights and intervals remain unchanged. See [player-matched-bot-jumps.md](player-matched-bot-jumps.md) for current physics and measured verification. The original compiler-12 implementation is recorded below.

Added 2026-10-28 in the isolated test checkout. Compiler version: 12.

Select any Studio bot to find:

- **Slows when hit**: surviving bullet hits apply the native engine's temporary movement penalty. Fatal hits still kill normally. Stationary bots have no horizontal movement to slow.
- **Jumps**: adds native jump behavior alongside the bot's selected movement. Height: 0.2–2 m; wait after landing: 0.5–10 seconds, randomized between the chosen minimum and maximum. Defaults when enabled: 0.8 m and 1.5–3 seconds. Initial spawn also waits before the first jump.

Both options default to off, including when opening older Studio drills. Changing movement type retains the options. Undo/redo, save and reopen use the normal drill state. The editor route preview does not simulate jump elevation or gunfire tagging; these behaviors run during Play.

`app/studio/drill.js` emits `hitSlow: true` only when enabled: the native scene validator rejects an explicit `false`. Jump values are bounded and interval endpoints sorted during compilation. No native engine bundles or generators were changed.

## Measured verification

Run with this checkout's `app/node_modules/electron/dist/electron.exe`:

    tools/skin-converter/test-studio-jump-hit-slow.cjs

Results: `tools/skin-converter/studio-jump-hit-slow-results.json`.

- Ten native cases cover all five movement types with together/in-order spawning. A configured 0.8 m jump reached 0.7999855433 m and repeatedly landed. Moving bots retained horizontal movement. Additional tests cover 0.2 m and 2 m heights.
- Eight matched native gunfire comparisons cover strafe/patrol, both spawn modes and jumping enabled/disabled. Nonfatal shots dealt matching damage. Over the next 0.1875 seconds, slowed bots travelled 42–52% less than controls. All recovered without further shots; disabled controls received no hit tag.
- Four native kill/respawn cases cover jumping strafers and peekers in both spawn modes. First revived positions were within 0.0018 m of the placed start, with no stale jump offset or hit tag.
- Native schema validation, older-drill defaults, save round trip, real UI toggles, undo/redo, paired interval bounds, save payload and reopen passed.
- Existing fixtures passed: 14 respawn checks, eight predictable/unpredictable movement cases, and Studio navigation/draft recovery.

These are hidden native simulation/UI fixtures, not foreground gameplay or FPS measurements. Foreground appearance remains for user confirmation through `Start Test Game.cmd`.
