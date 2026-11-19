# Measure movement in a VALORANT clip (16 Nov 2026)
Run with this copy's Electron: `app/node_modules/electron/dist/electron.exe tools/clip-measure/<script>.cjs -- <args>`
- `frames.cjs <video> <outdir> sheet <step s> [t0 t1]` contact sheets; `... range <t0> <t1> <fps> <scale>` single frames.
- `track.cjs <video> <out.json> <t0> <t1> <fps> <refT> <refX> <refY>` tracks the minimap player icon (round portrait,
  radius 7 px template taken at refT around refX/refY in full-HD pixels). Clip is often 30 fps: drop `dup` rows.
- `crop.cjs <png> <out> x y w h scale`, `bbox.cjs <png>` (alpha bounds of a minimap texture).
Scale: metres per HUD px = (1 / transform.scaleU / 1024) / (HUD map width px / texture content width px),
from `app/site/aim-maps/<map>.minimap.json`. Pearl in the 15 Nov clip: 0.343 m/px.
