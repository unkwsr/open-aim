# Removing unrelated online pages

Completed 2026-10-28 in the isolated test copy.

The missing replay/coaching files were already absent from disk. Their loaders and dependency references remained inside the shared site module. The bundle also contains Vue, shared UI components and engine dependencies, so removing that entire file would break AimTrainer.

`tools/skin-converter/prune-online-pages.py` uses the installed graphify Python runtime's JavaScript syntax parser to:

- Replace 28 old route entries with the existing `/aim` route tree plus lobby redirects. AimTrainer subroutes remain, including training replay routes; online video-coaching replay routes are removed.
- Remove the 219-entry backend menu page registry (coaching, orders, payments, admin and demo pages). AimTrainer's actual page loaders are in its constant route tree.
- Remove the old admin layout loaders, retaining compatible aliases to the guest layout used by `/aim`.
- Compact the dependency map from 681 to 83 assets and remap every remaining preload call's indices.
- Preserve module exports and the Studio shell isolation guard.

All four copies are pruned: both URL routes in `site/` and their served overrides in `app/mods/`. No asset directory was broadly deleted. Remaining shared framework, account/UI helpers and engine dependencies have not been represented as fully removed online code; further removal requires tracing their actual consumers.

Measured reduction: 73,207 bytes per copy, 292,828 bytes total. Each served shared module is now 2,328,137 bytes. Report: `tools/skin-converter/offline-page-pruning-results.json`. This size reduction is not a measured FPS improvement.

Regenerate with:

    C:/Python315/python.exe tools/skin-converter/prune-online-pages.py

The script validates every output before writing, rejects changed source structures, and is idempotent. The graphify Python runtime provides `tree_sitter` and `tree_sitter_javascript`.

Hidden Electron verification passed:

- `test-studio-shell-isolation.cjs`: Studio library/native simulation work with zero missing requests; `/aim` boots; no unrelated online routes remain; old `/replay` links return to `/aim` with query/hash retained.
- `test-studio-jump-hit-slow.cjs`: jumping, matched native gunfire slowing, recovery, kill/respawn, UI controls, undo/redo and save/reopen.
- All original missing filenames are absent from the four pruned shared modules. JavaScript syntax checks pass.

Restart through `Start Test Game.cmd` to load the smaller modules.
