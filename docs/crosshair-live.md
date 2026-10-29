# Crosshair updates inside a drill, 2026-10-27

Reproduced: applying a valid crosshair code updated the reactive store and saved
settings, but the mounted StageCrosshair kept its previous color and geometry.
The base Crosshair component updated correctly on its own. Rejoining recreated
StageCrosshair with the latest settings, explaining the reported workaround.

The ADS positioning wrapper in extend-new-ads.cjs introduced an outer Vue render
block but reused the inner component block without its original openBlock call.
The inner block consumed the wrapper block, so later optimized child-prop patches
were skipped. Restored the inner openBlock in both engine overrides and the
builder. No new watcher, polling loop, drill rebuild or crosshair remount.

Hidden Electron regression tests pass imported preset application, primary slider
mutation, separate ADS profile, ADS slider and whole-profile replacement, sniper
hide/show, ADS follow offset and preservation of the same crosshair DOM element.
Both generated engine routes match. See test-crosshair-live.cjs and
crosshair-live-results.json. This is controlled component evidence, not a live FPS
measurement. Restart Start Test Game.cmd once to load the fix.
