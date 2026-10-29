# Studio shared-module shell isolation

Fixed in the isolated test copy on 2026-10-28.

Studio's `view3d.js` imports native surface helpers from `CnrSARj_.js`. That native dependency chain imports the shared `index.uPZ7wDgX.js` module, which exports engine dependencies but also starts the original website's Vue app/router. On `/studio/`, that router attempted to load its online replay/coaching page, requesting assets absent from the offline capture.

The hidden Electron reproduction produced 61 HTTP 404s, including `DK-f1iUw.js`, `7TuphSR9.js`, and the coaching/order/video CSS files reported by the user. This is a reproduced cause, not a connection failure or missing jump asset.

`tools/skin-converter/extend-studio-shell-isolation.cjs` writes overrides for both served routes of the shared module. It skips only the website app bootstrap on `/studio` and `/studio/…`; module exports remain available. `/aim` still executes the original bootstrap. Original site files and HTTP missing-file logging are unchanged. The generator checks its anchors and is idempotent.

Verification: `tools/skin-converter/test-studio-shell-isolation.cjs`, run with this copy's Electron runtime. Baseline retained in `studio-shell-isolation-baseline.json`; fixed results in `studio-shell-isolation-results.json` alongside the script.

- Studio: 61 missing requests before, zero after; 20 total HTTP requests after.
- Studio library remains visible; native engine simulation spawns an actor.
- Both shared-module override routes have matching source.
- Separate `/aim` page still boots the website shell and resolves its router to `/aim`.
- Jump/hit-slow native/UI fixture and navigation/draft recovery fixture pass after the change.

The fix prevents a second app/router from starting inside Studio. It does not establish that the previously reported sporadic editor exits share this cause; that original trigger remains uncaptured.

Restart through `Start Test Game.cmd` to use the new module overrides.
