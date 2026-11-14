# flashfx: enemy-view flash effect packs

The game's flash renderer (OkAdunfX.js: Em/Lm, xm/bm) draws bot flashes from packs served at
`/aim-viewmodel/flashfx.<key>.json` plus textures `flashfx.tex.<name>.png` (keys: rey, brc, sky, yru, vys).
The other dev's packs live in `base/aim-viewmodel/`; ours go in `app/site/aim-viewmodel/` (app/site overrides base).

- `build-pack.mjs` - FModel JSON exports of Cascade particle systems -> pack. `list` shows emitters; `build <recipe> <out>` writes one.
- `glb.mjs` - reads FModel .glb meshes (pack meshes = glTF [x, z, y] * 100, Unreal cm).
- `yru.recipe.json` - Yoru Blindside (systems light/splash/boom/fizzle, material -> front-end shader map).
- `check-pack.mjs <key>` - runs the game's own particle code on a pack: alive counts, NaN check, missing mats/textures/meshes.
- `compare-sky.mjs` - converter check: rebuilds Skye's flash and compares with the other dev's pack (2115 equal, 10 cosmetic diffs).

Exports needed (FModel): Characters/<Agent>/S0 as Properties JSON + Textures PNG + Models (glTF binary).
Skye = Guide, Yoru = Stealth.
