# Half Life Crowbar

The Melee skin selector includes **Half Life Crowbar** (`half-life-crowbar`).
It uses the supplied rigid crowbar model, its embedded color/normal textures,
existing character arms, and the Prime Axe idle, equip, three attacks, heavy
attack and inspect. Animation timing and gameplay damage/cadence are unchanged.
The model is fitted to the Prime grip; both hand choices and Jett arm support
are available. The selected skin is saved in the isolated test profile.

Runtime geometry has 383 vertices and 290 triangles in two material groups.
The original local mesh transform is baked before grip placement. Its two color
and normal maps are packed into atlases; the source roughness and color factors
are retained. The converter copies all arm geometry and animation blocks from
the existing Prime Axe packages without changing their bytes. The loader adapter
is also applied by future viewmodel builds.

Validation: 40 rendered poses across Phoenix/Jett and left/right hands, exact
Prime Axe bone-pose comparisons, all five action montages present, equip loaded,
menu selection/persistence, unchanged arm/animation bytes, and no WebGL errors.
See `tools/skin-converter/crowbar-test-results.json`. Live test-game validation
confirmed the visible selected menu item, 290-triangle model, equip, and all five
montages (`crowbar-live-results.json`). These are render/load checks, not measured
combat or performance results.

## Model credit

“Half-Life: Crowbar” by Anthony Yanez (paulyanez):
https://sketchfab.com/3d-models/half-life-crowbar-1f075567411e42eb8af3942b5e061871
https://sketchfab.com/paulyanez

Licensed under Creative Commons Attribution 4.0:
https://creativecommons.org/licenses/by/4.0/

Changes: converted to the game's mesh format, fitted/weighted to the Prime Axe
weapon rig, baked the source shape transform, packed texture atlases, and added
existing first-person animation/character support. Original author/license data
is retained in the runtime manifest and `crowbar-source/attribution.json`.

## Sound and shading update

Half Life Crowbar aliases the existing Prime Axe audio pack. It shares the same
four decoded buffers: equip and attacks 1–3; heavy uses attack 2, matching Prime
Axe. There is no supplied Prime Axe inspect sound. The engine waits for this
pack before entering a crowbar scene. No duplicate sound downloads are added.

Crease-aware normal smoothing softens faceted shading on 325 vertices while
preserving source positions, UVs, triangle count, proportions and animations.
The supplied model is still a 290-triangle mesh with 128×128 source images;
this shading adjustment cannot add silhouette geometry or recover texture detail.
A substantially more detailed appearance requires a different or remodeled mesh
and new textures.

The sound fixture passed equip deduplication, combo order, heavy mapping,
pause/switch isolation, no per-event loading, and a nonzero rendered signal.
All 40 pose/render comparisons passed again. The live test game was launched
with the updated audio bootstrap; its crowbar alias and four Prime Axe buffers
were checked separately (`crowbar-live-audio-results.json`).
