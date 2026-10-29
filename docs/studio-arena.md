# Studio arena size, tall walls and surfaces — 2026-10-27

## Automatic dot contrast — 2026-10-28

Studio target dots now use white (#FFFFFF) in Dark mode and black (#000000) in
Light mode. The compiler, 2D editor and 3D preview share targetColor(). The target
color buttons are replaced by a note explaining the automatic mode choice.
Compiler version 11 updates saved Studio scenes through normal migration.

Native sphere templates marked studioTargetContrast bypass the global ball-color
override, including newly spawned/respawned meshes. Other scenarios retain their
normal global tint behavior. Humanoid bots are unaffected. Dot audio and dot-only
burst suppression remain as before.

test-studio-dot-contrast.cjs verifies all four Dark/Light × Flat/Grid combinations
through native schema, simulation and rendered material colors, with global ball
color deliberately set to the opposite color. Save round trips and unmarked
sphere tint behavior pass. Results: tools/skin-converter/studio-dot-contrast-results.json.

## Optional unpredictable strafers — 2026-10-28

Select a Strafer → Movement → Predictable / Unpredictable. Existing/new bots
default to Predictable, which retains the existing native strafe settings.
Unpredictable uses native per-leg random ranges: travel 12–100% of width
(minimum 0.12 m), speed 65–100% of the selected Walk/Run speed, pauses
0.02–0.55 seconds. Short/long legs produce varied reversals while native
counter-strafing, acceleration and collision remain in control. Width still
defines the movement envelope. Seeded simulation/replay behavior is retained.

app/studio/strafe.js shares the configuration with an illustrative 2D/3D preview.
The preview uses the same ranges with smooth interpolation and a stable per-bot
trajectory; it is not a tick-exact simulation of native collisions/randomness.
Changing Width or Speed refreshes it. Its long cycle closes continuously.
Compiler version 10 persists the mode through normal Studio saves/migration.

Verified: eight 60-second native movement fixtures covering both modes,
Walk/Run and together/one-at-a-time. Unpredictable produced 33–59 distinct
rounded speed samples per trial, included short turns, varied pauses, and stayed
inside the 3 m width; frame displacement stayed within native speed limits.
Same seeds reproduced trajectories and different seeds changed them. Preview
bounds, schema/save round trips, UI toggle and undo/redo passed. Native gunfire
tests additionally killed unpredictable strafers twice per spawn mode and
verified return to their placed start. No foreground comfort/FPS claim is made.
Results: studio-unpredictable-results.json, studio-respawn-results.json and
studio-arena-results.json under tools/skin-converter/.

## Respawn at placed start — 2026-10-28

Strafers and looping peekers now compile their enabled respawn rule as
reSpawner instead of inPlace. Native relocation restores the original spawn
position/home and resets movement state. Peekers restart at their first route
point. One-at-a-time/cross-route peekers retain their existing route respawn.
Stationary bots, other route types, respawn delays, Stays dead and Clear behavior
are unchanged. Compiler version 9 refreshes existing drills on opening Studio.

test-studio-respawn.cjs uses native simulation and actual aimed gunfire to kill
displaced bots. Two baseline inPlace cases reproduced revival near the death
position (~0.93 m from the placed start). Eight corrected cycles (two successive
kills for standing-order and one-at-a-time strafers/peekers) returned to their
start: exact first-route point for the looping peeker, and within ~0.001 m for
moving bots sampled after the first movement tick. Stays dead compilation passes.
Results: tools/skin-converter/studio-respawn-results.json. These are controlled
native simulation results; no foreground gameplay or FPS measurement is claimed.

## Bot facing and stronger editor retention — 2026-10-28

Fixed the 180-degree mismatch between the Studio's fixed bot direction and Play.
Studio/player yaw uses local -Z forward, while native humanoid yaw uses +Z.
The compiler now adds pi when writing bot spawner/dispatcher rotationY. Editor
directions and stored facing settings are unchanged. Compiler version 8 refreshes
existing scenes through the normal library migration. The 3D white facing dot
also drags on its actual 1.5 m plane rather than the floor plane.

The prior stale-callback fix did not stop the user's unexpected editor exits.
showLibrary now refuses to replace any active editor unless called by the
explicit Drills action. A session-only draft retains the editable drill, saved
baseline and selection, restoring the editor on a Studio page reload. Draft
updates are debounced after edits and flushed on beforeunload. Intentional Drills
and Play clear the recovery draft, retaining the established return-to-library
behavior after gameplay. This does not publish/save recovery drafts as drills.
An async Save now preserves its original saved snapshot, so newer edits remain
dirty and a pending Play does not navigate away while those newer edits are open.
The user's exact remaining exit trigger has not been captured.

Verified: 20 native facing cases (standing/strafing × normal/dispatcher spawning
× four cardinal angles and one diagonal) agree with the marker at direction-dot
product >=0.9999999, checked after spawning and after movement. A real 3D facing
dot gesture compiles to the matching native direction. Existing arena tests pass.
Navigation tests verify unsolicited library requests, delayed callbacks, newer
edits during a save, actual page reload recovery, intentional Drills, and draft
clearing during intentional Play/beforeunload (destination intercepted in fixture).
Results: studio-facing-results.json, studio-navigation-results.json and
studio-arena-results.json under tools/skin-converter/.

## Rotation arrow and navigation guards — 2026-10-28

The selected wall, barrier or building piece now shows one white curved rotation
arrow in 3D, alongside the existing white resize circles. Drag its head or arc
to rotate around the vertical axis. Rotation snaps to 5 degrees; Alt disables
snapping. One drag is one undo step, and the resulting angle is saved normally.
No colored gizmo axes or extra dimension labels were added.

The user reported one unexpected return from an empty-arena editor to the Studio
drill list. Async library refresh/copy/delete operations could complete after
another editor had opened and redraw/reset the view. Screen-revision guards now
ignore those stale completions. Map-load, leave-confirmation and save/play
completions are also checked against the active editor. This is a confirmed
unsafe callback path; the user's original one-off event had no trace, so its
precise trigger is unconfirmed.

Verified with hidden Electron fixtures: delayed library refresh and delayed copy
cannot replace/reset an active empty arena; a stale save/play cannot leave a
newer editor; intentional library navigation still works. Native/editor checks,
rotation-arrow dragging and undo/redo, white resize circles, translation caching,
themes, save round trips and collision checks pass. The arrow screenshot was
visually reviewed. Results: tools/skin-converter/studio-navigation-results.json
and studio-arena-results.json.

The 2026-10-28 dragging optimization and native Play investigation are documented
in [studio-performance.md](studio-performance.md). Editor drag costs improved
in controlled tests; the reported sustained Play stutter remains unconfirmed.

## Two surfaces and two modes — 2026-10-28

Current appearance controls supersede the older options below. Drill Settings →
Place now offers Mode (Dark / Light) and Surface (Flat / Grid). One Grid size
slider appears only for Grid. Changing the global surface clears per-piece
surface overrides so the whole build follows the selection. Each visible wall
or building piece can still choose Flat or Grid independently. Mode switches
preserve the selected surfaces and dimensions. White resize circles are retained.

Removed Stone, Original/Bowser appearance buttons, building color presets,
surface tint pickers and per-piece pattern sliders. Legacy stone becomes Grid,
old Original becomes Dark with Flat, and old colored pieces follow the mode.
Compiler version 7 refreshes scenes through the normal Studio library migration.

Dark keeps the charcoal palette. Light uses soft light-gray floor #C6C8CC,
pieces/walls #D9DBDF, grid #A7ABB1 and range backdrop #C1C5CB. Existing lighting
affects displayed colors. These are saved per-drill world appearance settings;
the Studio interface retains its current theme. On imported maps the modes
apply to Studio building pieces; imported map textures remain their own.

Verified: native schema/rendering for all four mode/surface combinations,
all 31 visible fixture parts, theme/surface UI switches, undo/redo, saving Light
Flat, switching back to Dark Grid, absence of decorative controls, and existing
white-circle resizing tests. Both light screenshots were visually reviewed.
No foreground FPS or player comfort measurement was made.

## Simpler white-circle controls — 2026-10-28

Supersedes the colored gizmo controls described below. Original wall-end white
circles are restored, including their length/angle drag behavior. A selected
building piece now has only three white circles: side for width, front for depth,
top for height (pillars have diameter and height only). Walls have their two end
circles plus depth and height circles. There are no connecting axes, dimension
labels, colored boxes, elevation handles or rotation handles. Rotation/elevation
remain in the existing inspector. Snapping, undo/redo and saved dimensions remain.
The dark gameplay grid correction is retained.

Verified in the test-copy Electron fixture: original wall-end pointer dragging,
three white spherical controls on a ramp, direct width/depth/height dragging,
long-drag undo/redo, wall depth/save, all 24 building dimension/schema checks,
native rendering and existing editor checks pass. Screenshot visually reviewed.
No foreground gameplay performance measurements were taken for this UI change.

## Direct 3D editing and gameplay grid correction — 2026-10-28

Select a wall, invisible barrier or any of the eight building shapes in 3D.
Drag red Width handles, teal Depth handles or the green Height handle. The
opposite horizontal face stays fixed and height grows from the existing base.
Pillars resize their diameter around their centre. Drag the orange Raise / lower
handle to change elevation, or the white Turn handle to rotate. Translation still
uses dragging the piece itself. Dimensions snap to 0.1 m and rotation to 5 degrees;
Alt disables snapping. Each gesture is one undo entry, including long drags.
Labels show live dimensions; the inspector updates after releasing the handle.
At a camera angle directly along an axis, drag upward to expand that dimension.

Walls/barriers now have depth (0.1–40 m, existing walls default to 0.3 m), shared
by preview and compiled gameplay geometry. Window/door depth is also editable in
the inspector. Existing building size limits remain: height up to 40 m, wall
length up to 200 m, other dimensions up to 40 m (pillar diameter up to 4 m).

The screenshot's bright grid came from a saved dark drill with floorSurface=plain:
this activated the old helper overlay, including red axes. Compiled Studio scenes
now omit that overlay entirely. Compiler version 6 migrates older dark drills
with Plain floors to the subtle tile surface once. Choosing Plain afterward
produces a plain floor. Explicit Original themes are retained. Thin square grid
fading now starts at 0.05 tile/pixel and completes at 0.2 to reduce horizon noise.
Player data is refreshed through the normal Studio library migration on opening;
the development fixture does not edit real saved drills.

Verified in the hidden test-copy Electron fixture: 24 resize/compiled-schema
checks across all eight shapes; actual DOM pointer handlers for ramp width,
depth, height, elevation and rotation; long-drag undo/redo; wall depth and saved
geometry; migration and absence of the helper grid; shader compilation and
earlier distance fade; edge-on drag fallback; existing editor/save/collision
checks. Editor handles and native surface screenshots were visually reviewed.
Foreground FPS, motion shimmer and player tracking comfort remain unmeasured.

## Charcoal grid update — 2026-10-28

Supersedes the older Bowser palette below. Studio now defaults to Charcoal grid:
floor #1A1A1E, walls and placed pieces #202024, thin grid seams #333338.
The existing `bowser` theme and drills without an explicit theme use this palette;
an explicit Original theme and per-piece surface/tint overrides remain available.
Compiler version 5 refreshes stored compiled scenes through the existing Studio
library migration. Map geometry/textures are not changed.

The shared editor/native square shader keeps flat tile shading, 0.5% seam
half-width, derivative anti-aliasing and distance fading. Its distant average
now matches the thin seam coverage (~1.99%) to avoid a brighter distant band.
Existing lighting still affects the displayed material colors.

Verified using this copy's Electron renderer fixture: all 31 visible material
parts, palette/schema, shader compilation, original-theme fallback, custom tint,
save round trip, editor controls, undo/redo, 3D editor and boundary collision pass.
Native and editor screenshots were visually reviewed. No foreground gameplay
FPS or player tracking comfort was measured.

All work is in aimtrainer-test. Restart Start Test Game.cmd, open an empty-area
Studio drill, and use Drill Settings → Place near the top of the inspector.

- Arena size: square floor, 12–200 metres; original 24/40/70 m presets retained.
  Resizing keeps object coordinates and refits the 2D view. Bounds checking and
  native compiled floor use the same size helper. Shrinking can leave placed
  objects outside the floor; the existing validation reports those objects.
- Boundary wall height: 0 disables them; up to 40 m adds four solid walls just
  outside the floor, with no reduction of usable floor space. They render
  translucent in the editor so they do not hide the layout, and solid in gameplay.
- Placed walls: height now has a continuous 0.2–40 m slider, length up to 200 m.
  Building piece height limit increased to 40 m as well.
- Arena appearance: Original or Bowser dark grid. Floor/wall surfaces can be
  Plain, Grid or Stone, with independent 0.25–8 m pattern size controls.
- Each visible wall/building piece has Match arena / Plain / Grid / Stone,
  independent pattern size and a tint override. Invisible barriers remain
  invisible and preserve walking-only collision.

Bowser.json was read from the supplied Steam path and not modified. It describes
GRID 8 rather than containing image bytes. The preset reuses the existing native
procedural tile shader, linear-to-sRGB floor/wall tints (#373737 / #424242) and
2.4/1.2 scale values as metre tile sizes. It is a Bowser-style preset, not an exact
port of Kovaak's lighting, roughness/metallic/fullbright interpretation, units,
enemy palette or sky. No new raster textures or per-frame texture loading.

Implementation: app/studio/arena.js shares dimensions/surface compilation;
drill.js compiler version 3 persists values into native schema v2 blocks;
studio.js exposes UI and integrates undo/redo/save/bounds. view3d.js shares the
native surface shader through two export-only bridges in CnrSARj_.js, not a
second shader. extend-studio-surfaces.cjs and build-audio-loader.cjs preserve the
bridges on both routes. Its narrow renderer hook increases far plane for large
Studio empty-area scenes up to 400 m; maps and ordinary scenes retain 200 m.
No custom map culling or delayed bot-visibility cache was restored.

Measured/verified in the hidden test-copy Electron fixture:
- Native schema accepts 200 m floor and 40 m boundary height.
- All eight building shapes plus solid walls get native surface materials;
  the 31 visible parts in the fixture compiled and rendered without shader errors.
- At the 80 m arena's +Z boundary, 500 backwards movement ticks stop at z=39.5799
  instead of passing through the wall. Native player collision was used.
- Saved compiled blocks survive JSON round trip exactly. Original drill floor
  color, grid and no-boundary defaults pass regression checks.
- Real Studio UI resize 80→120 m, undo/redo, placed wall 18→35 m, mocked Save,
  and actual 3D editor rendering pass. No real player drills were edited by tests.
- Both module routes and patch idempotence checked. Screenshots visually reviewed.

Reproduce: test-copy Electron with tools/skin-converter/test-studio-arena.cjs.
Results: tools/skin-converter/studio-arena-results.json.
Images: previews/studio-arena-native.png and previews/studio-arena-controls.png.
These are controlled renderer/editor checks. Foreground gameplay and FPS were
not measured; no live performance gain is claimed.
