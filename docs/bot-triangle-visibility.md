# Conservative entity visibility and Match display investigation

Only C:/Users/hate/Desktop/aimtrainer-test was changed. The user explicitly
requested a smarter entity-culling replacement that avoids old peek delays.
This is separate from the removed timer-based wall cache. No map/PVS culling
was restored. No rendering mode, VSync or saved display preference was changed.

Later follow-up: Unlimited's GPU retry waiting was improved separately; see
unlimited-frame-pacing.md. Statements about unchanged scheduling below describe
the entity-visibility change itself.

## Current implementation

app/mods/aim-ui/bot-visibility.mjs builds a spatial tree of large, actual opaque
visual triangles. It never uses pawn collision volumes or point-ray samples as
proof that a whole bot is hidden. A bot can be hidden only when its native
bounding sphere's enclosing box (expanded another 5 cm) fits entirely inside
one triangle's shadow volume, behind that triangle. This is intentionally
conservative: many truly hidden bots still render, especially behind small or
tessellated faces. Visible bots still cost CPU; simulation/AI/hitboxes continue.

Existing hidden candidates are re-proven against current interpolated camera
and bot bounds EVERY rendered frame. A failed proof clears hiding immediately.
There are two new spatial queries per frame; budgeting/cooldown affects only
when something can become hidden. Untested or uncertain means visible. Moving
the player/bot therefore does not wait for a timer or prior GPU result to show
the bot. Native frustum tests continue on the current frame before this test.

Transparent materials, alpha cutouts/maps, polygon-offset decals, wireframes,
clipping planes, disabled depth testing/writing and triangles crossing the
near plane are excluded. Changed geometry, draw ranges, instance data, material,
layers, visibility or owner world transforms invalidate the proof and render
the bot. The camera-scoped registry keeps settings previews from replacing the
live game's map. Missing/unready assets fail open. No GPU readback or sync is
added. Normal pose evaluation resumes on the same frame a bot becomes visible.

Offline candidate files in app/mods/aim-occlusion contain mesh/instance/triangle
indices, not trusted world-space blockers. At runtime each selected triangle is
reconstructed from the actual loaded visual geometry and filtered again. Large
mesh scans and BVH ordering run offline, and runtime setup yields in small chunks.
Measured preparation elapsed 18–365 ms across tested starts, mostly asynchronous
startup time; bots stay visible while preparing. The index tree is per engine
camera. Queries/proofs are bounded during gameplay.

Both CnrSARj_.js routes use the native frustum stage's entry/current bounds;
both OkAdunfX.js routes attach/detach the correct camera's map. The existing
audio-engine and reflex builders preserve these adapters. Existing static local
transform/bone-upload caches, all-map batching, Corrode surfaces, skins and
melee preparation remain in place.

Apply: node tools/map-import/apply-bot-visibility.cjs
Scoped runtime rollback: same command with --rollback. Builders reapply unless
their explicit adapter calls are also removed. Regenerate index candidates after
changing map batching with this copy's Electron running build-bot-occluders.cjs.

## Evidence and limitations

- Pure geometry: 1,218 claimed-hidden boxes checked by 125 independent rays each;
  no false claims in the grid. Degenerate planes, current-camera peeks and bot
  movement cases passed. Game/preview camera registry isolation passed.
- Controlled 40-rig wall fixture: draw calls 82 → 2 after conservative hiding;
  CPU submission median about 0.9–1.1 → 0.1 ms with GPU draining outside the timed
  section. All 40 bots returned on the FIRST peek frame at both tested offsets.
  Visible-bot median remained around 0.9–1.0 ms; this is not a universal CPU gain.
  Images matched exactly for the controlled hidden and peek views.
- Same-frame fail-open cases passed: moved bot, moved/removed wall, transparent
  material, alpha cutout, near clipping, and detached map.
- All 9 maps: 18 real drill starts × 12 direction/lateral-peek poses = 216 view
  comparisons. No GL errors. Maximum RGB difference was 1/255, including uncullled
  views; all views that hid bots matched exactly. 99 cumulative hidden-bot counts
  across the views; this is not 99 simultaneous bots. Live gameplay gain and all
  possible camera positions/skins are not exhaustively measured.
- Both routes match, parse, and pass idempotence/rollback tests; builder outputs
  match the applied sources. Native simulation and scheduling are unchanged.

Evidence: tools/map-import/bot-proof-results.json, map-bot-proof-results.json,
bot-occluder-build-results.json and the test-bot-visibility scripts.

## Match display

A visible seeded native-map fixture compared the previous native statistics
branch, current branch without the new meter, current branch with the meter,
and custom 240. The first run was contaminated by startup/asset/warmup variance
and is not evidence of a mode regression. After warming and resetting simulation
state per variant, old/current Match display variants all averaged about 240 FPS
with p99 intervals about 4.8–5.0 ms. Custom 240 was not reliably better (one repeat
was about 236 FPS, p99 7.9 ms). No unsupported scheduler fix was applied. The user's
all-map Match display slowdown remains unconfirmed/reproduction-dependent.
Evidence: tools/map-import/frame-regression-results.json.

The new FPS meter now scans backward only through the last five seconds instead
of walking up to 32,768 old intervals, and skips unchanged DOM text. Its known-rate,
uneven-cadence, stale/reset/long-stall and native GPU-retry accounting tests pass.
No live FPS gain is claimed from this housekeeping change alone.

Stationary skeleton-world and early actor-work candidates were rejected after
timings did not show a reliable CPU improvement. Their test-only tools remain
explicitly marked REJECTED and are absent from shipping actor code/builders.
