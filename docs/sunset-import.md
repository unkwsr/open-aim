# Sunset map and captured pre-aim drills

## Supplied cover/loading art — 2026-10-28

Loading_Screen_Sunset.webp supplied by the user is copied byte-for-byte to
app/mods/aim-maps/juliett.cover.webp. The map catalog's cover and slice now use
that image. Native workshop thumbnails, Favorites cards, Studio map cards and
the native Sunset loading splash therefore share the supplied artwork. The
minimap remains separate and unchanged. The import script keeps using this
cover when it exists, with minimap fallback for imports without a cover asset.

test-sunset-favorites.cjs verifies the exact 1920×1080 image, native cover/splash
resolution and the actual WorkshopLoading image. It also verifies the local
Favorites fix described in offline-favorites.md. The original Downloads image
was not modified. Earlier minimap-as-cover notes below describe the initial import.

Imported on 2026-10-26 into the isolated test copy from the user's
`ishoutususnet1.har` through `ishoutususnet6.har` in Downloads.
These are local saved responses; no recorded URL was fetched and no captured
JavaScript was installed or executed.

## Installed content

- Sunset's internal map ID is `juliett`.
- Nine decoded map files live in `app/mods/aim-maps/`: GLB, collision, lights,
  lightmap manifest, two AVIF lightmaps, surface metadata, minimap JSON and PNG.
- The GLB is 13,544,160 bytes and contains its texture data. All nine files total
  16,131,011 bytes. Meshopt/Basis decoding uses the existing game loaders.
- `app/mods/local-api/maps` adds Sunset to the existing eight-map catalog.
  The captured minimap serves as the lobby cover/slice because the captures did
  not contain separate cover art.
- `app/studio/drill.js` also offers Sunset in Creator.
- Six scenario files feed the normal `app/training-set.json` build:

| Route | Versions | Active bots | Candidate positions | Round duration |
| --- | --- | --- | --- | --- |
| A Tube | Easy / Hard | 16 | 18 | 90 seconds |
| A Short | Easy / Hard | 15 | 17 | 90 seconds |
| B Main | Easy / Hard | 15 | 18 | 90 seconds |

Easy bots do not shoot; hard bots retain their captured shooter behavior.
Original author attribution, share codes, scenario documents, random seeds,
spawns, crouching actors, route barriers and round rules are preserved.
Only lobby-facing names/descriptions and local catalog metadata are adapted.
Captured titles are retained in the import manifest; one A Short document has
an inconsistent internal A Main title, so the lobby label follows the capture's
published scene title.

## Repeatable import

From the test-copy root:

```powershell
node tools/map-import/import-sunset.cjs
node scripts/build-scenarios.mjs
```

An alternate capture directory may be passed as the importer's first argument.
The importer authenticates/decompresses the selected encrypted assets using the
existing retained client decoder material, validates all six inputs before
writing, and skips unrelated responses. `tools/map-import/sunset-import.json`
records capture SHA-256 identities, zero-based entry ordinals, original asset
paths, decoded SHA-256 identities and exact scenario-document hashes.

REA's capture reader rejected the first original HAR's `serverIPAddress`
metadata schema. Extraction used local JSON parsing and authenticated asset
decoding instead; the original capture was not modified.

## Verification

- All 31 scenario files pass the existing build validator.
- The native game scene parser accepts all six captured documents.
- Each drill passes 180 native simulation ticks with the expected 15/16 live
  bots, finite player coordinates and a grounded player at the captured spawn.
- The actual native WebGL loader loads map geometry, textures, collision,
  lights and minimap. The initial import produced 681 batched mesh objects.
  Its 668,189 geometry-buffer triangles excluded repeated instances; the full
  geometry is 1,764,707 triangles including instances. A later Sunset-only
  batching optimization reduces mesh objects to 465 while preserving that total;
  see `sunset-performance.md`.
- All six captured starting views render nonempty geometry into the framebuffer
  with no WebGL errors. Screenshots and results are under `tools/map-import/`.
- The Studio collision/floor helper finds floors within 0.020 m of every
  captured player-spawn height.
- The eight prior catalog entries are unchanged. No game engine or viewmodel
  bundle was edited by this import. The subsequent optimization makes a narrow
  change to the renderer bundles, documented in `sunset-performance.md`.

These are compatibility checks, not measured live gameplay FPS or a completed
human playtest. Use this copy's `Start Test Game.cmd` and search for `Sunset`.

The hidden native-loader check is `tools/map-import/test-sunset.cjs`; run it with
this copy's `app/node_modules/electron/dist/electron.exe`. Its fixture blocks
external HTTP requests and uses its own test profile.
  Unrelated captured UI lazy-preload requests return 404 in the minimal fixture;
  their reload handler is suppressed, as in the existing hidden-renderer tests.
  All required map requests and native map/simulation checks pass.

## Preserved constraints and graph snapshot

Captured PVS visibility data was deliberately not imported. Custom map culling
and cached bot wall-occlusion remain removed. Test-data isolation, port 8137,
existing skins, audio and ADS changes remain in place.

The existing Graphify graph was queried, not rebuilt. It predates this import;
use this document and the importer manifest for the new files.
