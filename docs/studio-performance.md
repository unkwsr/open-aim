# Studio dragging and Play performance — 2026-10-28

Scope: isolated aimtrainer-test only. Player drills were read as fixtures, not
modified. The user clarified that the map smoothness complaint occurs during
Play; wall/object dragging in Studio is a separate reported issue.

## Changes

- Reuse surface/basic materials and unit building geometry across editor rebuilds.
  Dragging/resizing no longer repeatedly deletes GPU programs and geometry.
  Materials no longer used by the current scene are pruned; shared resources
  are released on leaving/replacing the editor along with its ResizeObserver.
- Translate the selected wall/building subtree, circles and label in place when
  its position is the only change. Invalidate on settings/geometry/selection
  changes or changed supporting floor levels. Other edits retain the full rebuild.
- Exclude the dragged wall as well as the dragged block from surface raycasts.
  This removes a possible self-intersection feedback path. Its contribution to
  the user's observed stutter is a hypothesis, not a measured result.
- Coalesce 3D pointer events to one update per animation frame, render that
  update in the same frame, and flush pending movement before press/release.
  Pointer-up therefore preserves the final position even before the next rAF.
- Native Play caches local transforms for stationary blocks in Studio range
  scenes. No custom visibility/culling, geometry removal, input/physics changes,
  frame cap, VSync change or image-quality reduction was introduced.

## Measured editor results

profile-studio-smoothness.cjs, hidden Electron, 1280×720, same synthetic scenes,
90 selected-wall translations with the first 11 samples discarded. CPU time
includes editor synchronization and render submission, not monitor scanout.

| Walls | Before median / p95 | After median / p95 |
| --- | --- | --- |
| 10 | 13.0 / 16.3 ms | 0.3 / 0.5 ms |
| 100 | 20.8 / 23.6 ms | 0.6 / 1.0 ms |

Files: tools/skin-converter/studio-smoothness-before.json and
studio-smoothness-after-editor.json. Later 1080p Play runs repeated the editor
check and remained under ~1.5 ms p99 for the 100-wall fixture.

## Native Play results and limits

Read-only copies of both saved range drills (200 m, 11 items; 71 m, 10 items)
were tested through the native simulation, actor renderer, GPU fences and
unlimited scheduler. Four Flat/Grid comparisons per pass. Final comparisons
used 1920×1080, shadows enabled, default Vandal viewmodel, a 500 ms CPU warmup
and 2.5-second trials. No live player's input, audio, complete HUD or display
presentation was captured. GPU query samples include startup/warmup outliers;
their maxima must not be interpreted as steady-state GPU cost.

Full-profile CPU update/render median stayed approximately 0.4 ms for the
200 m drill and 0.2 ms for the 71 m drill before/after. Native static-transform
checks eliminated 1,080 redundant local matrix compositions over 30 frames
in the shape fixture, with identical world matrices and pixel-identical images.
This is a reduction in redundant work, not evidence of a sustained Play FPS gain.

The sustained gameplay stutter was NOT reproduced in these hidden tests.
In-game smoothness still requires the user's foreground check; the cause of
their Play complaint remains unconfirmed. Renderer submission cadence is not
display scanout cadence. Profile draw/triangle fields refer to the last render
pass; when a viewmodel is present they do not count the entire world scene.

Full results: studio-smoothness-full-before.json and
studio-smoothness-full-after.json beside the profiling script.

## Regression verification

test-studio-arena.cjs passes both native module-route patch idempotence checks,
all 24 building dimension/schema checks, Flat/Grid × Dark/Light rendering,
native collision, resize gestures, long-drag undo/redo, final pointer-up handling,
save round trips, editor resource disposal and wall thickness. Cached translation
retains mesh identity and matches a forced rebuild's image and circle positions.

Restart Start Test Game.cmd for the next foreground comparison. test-data/,
port 8137, existing culling constraints and the main project are preserved.
