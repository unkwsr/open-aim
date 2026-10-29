# Karambit Damascus Steel with Phoenix hands

This change is confined to `C:/Users/hate/Desktop/aimtrainer-test`. Restart
`Start Test Game.cmd`, choose **Melee skin → Karambit Damascus Steel**, and enter a
scene. Inspect uses the existing **Y** binding. Native melee damage, hit windows,
attack cadence and readiness rules remain in place.

The supplied file is `C:/Users/hate/Downloads/karambithar.har`. It contains the
Damascus Steel Karambit, paint/material inputs and paired CS hand/weapon clips.
The earlier imported AK package, textures, firing/kill sounds, menu choice,
adapters, import scripts, source extraction, test profiles, reports and previews
were removed from this checkout. Its kill-event override was removed from both
engine routes and the audio builder. Unknown saved Vandal skin IDs fall back to
Default; no removed AK audio is fetched.

The Karambit retains all 12,228 captured vertices and 13,938 triangles. Baked color,
roughness and metalness maps are 4096×4096; the captured normal map is retained.
The PNG upload orientation matches the captured UVs so the blade carries the
Damascus pattern and the grip remains dark. Neutral local studio reflection cards
keep the metal readable, using the same existing renderer environment mechanism.
Textures are not recolored or sharpened.

The visible hands are the native Phoenix mesh: 7,471 vertices, 13,099 triangles,
original positions, normals, UVs, weights, triangle indices and `arms.png` texture.
Joint IDs shift by one for an identity attachment root. Captured finger, hand,
wrist and forearm joint trajectories are retargeted onto this mesh using anatomical
frames and sampled at 60 Hz. Segment scale ratios range from 0.71945 to 1.08053;
the mapped joint-anchor error is below 1e-12 cm in the offline calculation. This
anchor measurement does not claim zero mesh intersection at every animation time.
Phoenix hands remain visible for this skin even when another character is selected.

The captured clips supply 2 s idle, 1 s equip, two 1.1667 s light slashes, a
1.1667 s heavy attack and 4.8667 s inspect. Weapon and hands share the same source
timeline. A preallocated 85 ms transition blends interrupted actions and returns
to idle. Animation sampling uses existing native skinning/clip code; the running
game does not execute the captured viewer or load CS gloves. Existing native
melee audio remains unchanged.

Reproduce in this test checkout:

```powershell
node tools/skin-converter/extract-damascus-karambit.cjs
./app/node_modules/electron/dist/electron.exe --no-sandbox --disable-gpu-sandbox tools/skin-converter/bake-damascus-karambit.cjs
node tools/skin-converter/import-damascus-karambit.mjs
./app/node_modules/electron/dist/electron.exe --no-sandbox --disable-gpu-sandbox tools/skin-converter/test-damascus-karambit.cjs
```

The bake replays retained responses offline and uses a local texture-copy helper
for an export shader omitted from the capture. Asset ordinals, paths and SHA-256
hashes are retained in `damascus-karambit-source/capture-provenance.json`.

Controlled checks pass for 12 render poses spanning equip, idle, both slashes,
heavy attack, inspect and interruption, plus a left-hand mirror. Each measured
pose draws 27,037 triangles in two calls with zero WebGL errors. Phoenix geometry
preservation, menu persistence, removal of AK preloads, Default knife and Butterfly
regressions pass. After native warmup, geometries/textures/programs stay at
10/11/4 on the first tested attack. The initial interruption delta is below
0.000007 cm and 0.00000006 radians. These are renderer/pose checks, not live
gameplay FPS or latency results.

Reports: `tools/skin-converter/damascus-karambit-import-report.json` and
`damascus-karambit-test-results.json`. Reviewed images: `previews/damascus-karambit/`.
The main project, test-data defaults and HTTP port 8137 were not changed.
