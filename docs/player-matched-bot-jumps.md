# Bot jumps matching the player's normal jump

Implemented 2026-10-28 in the isolated test checkout. Studio compiler: 13.

New Studio bots default to a 1.15 m jump height. The height slider now uses 0.05 m increments and two decimal places so 1.15 m is retained and displayed exactly. Jumping still defaults to disabled. Saved custom heights and wait intervals are preserved by normalization, compilation and save/reopen.

Studio emits `playerGravity: true` on its native jump behavior. `extend-player-bot-jump.cjs` changes that behavior to use the same gravity definition as the player (`nn.jump.gravity` for game movement; the active profile gravity for other movement). Launch velocity is calculated from the configured height. Unmarked imported/native jump behaviors retain their original gravity of 18 m/s².

The hook updates both served `BiMsX6Xn.js` overrides. `build-audio-loader.cjs` reapplies it when processing those stage overrides. The hook checks exact source anchors, validates both outputs before writing, and is idempotent. No unrelated generators were run.

Compiler 13 refreshes older Studio scenes through the normal library migration, adding the gravity flag while retaining saved settings. Existing 0.8 m settings remain 0.8 m; their airtime changes under the corrected gravity. Open Studio after restarting to perform the normal migration.

## Native measurements

`measure-player-bot-jumps.cjs` runs parsed compiled scenes in this copy's hidden Electron runtime. It measures feet/base displacement on a flat floor, with trajectories aligned by time since takeoff. Result: `player-bot-jump-measurements.json`. Prior measurements remain in `player-bot-jump-before-player-gravity.json`.

| Measurement | Standing/running player | Default Studio bot |
| --- | --- | --- |
| Peak height | 1.1499753515 m | 1.1499753515 m |
| Time to apex | 0.3359375 s | 0.3359375 s |
| Airtime | 0.6796875 s | 0.6796875 s |
| Gravity | 20.1920438957 m/s² | Same definition |

Maximum per-tick vertical difference: 1.23e-15 m (floating-point rounding). The 128 Hz simulation samples the theoretical 0.675-second flight, so the measured landing tick occurs at 0.6796875 seconds. This matches the ordinary standing/running jump; crouched player jumps remain lower due to their existing crouch modifier.

Additional checks cover custom heights 0.2, 0.8 and 2 m, preserving saved height/interval values, native schema round trip retaining the gravity flag, and the unmarked original 0.8 m jump retaining its previous trajectory.

Regression fixtures passed after the change:

- `test-studio-jump-hit-slow.cjs`: ten jump movement/spawn cases, eight matched hit-slow cases with recovery, four jumping kill/respawn cases, exact 1.15 m UI readout, undo/redo, save/reopen.
- `test-studio-unpredictable.cjs`: eight predictable/unpredictable movement cases.
- `test-studio-shell-isolation.cjs`: Studio/native simulation, zero missing requests, normal lobby boot and offline redirects.

These are native simulation/UI measurements, not a foreground gameplay recording or FPS measurement. Restart with `Start Test Game.cmd` and open Studio to use the updated code.
