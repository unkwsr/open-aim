# Araxys Operator in the isolated test copy

The supplied `C:/Users/hate/Downloads/araxys_bundle_valorant.glb` contains several
weapons. The Operator import uses only its BoltSniper body, magazine, scope and
scope glass meshes. The four matching embedded PNGs are copied byte-for-byte.
Other weapons in the GLB are not imported. The GLB metadata attributes the bundle
to `ashwanichoudhary3608` on Sketchfab under CC-BY-4.0.

Select **Operator skin → Araxys**, then enter a scenario. The Default choice keeps
the existing Operator. The menu choice is stored in `es-operator-skin`; the model
cache includes the choice so a subsequent scene uses the correct pack. Native
Operator arm mesh, equip and animation payloads, skeleton, recoil, reload timing,
ADS scope timing and gameplay logic are retained. The supplied `araxysht.WAV`
plays as the Araxys Operator firing sound only while this skin is selected;
the Default Operator keeps its native firing sound. The 29-second showcase MP3
is used as a reference and is not played for each shot.

The five `araxys, ep 9_*kill*.zip` archives provide the Araxys Operator's
kill sounds in order. Kill six repeats sound one. A new kill stops the prior
sequence sound. The ZIP PNGs are preview images and are not used as HUD art.
Default Operator kill feedback remains unchanged.

The supplied JPG shows the rifle and exterior scope housing, rather than a
view through the scope. The Araxys gold plates and scope were brightened, with
a reflective lens and the existing cyan details. The Araxys material output is
now displayed at 50% of its prior brightness across the gold, dark and cyan
groups; the Default Operator is unaffected. The scoped reticle
artwork is unchanged for both skins, so the Default Operator sight stays as it
was. In Toggle ADS mode, successive right-clicks give 2.5×, 5×, then out. In
Hold ADS mode, release and right-click again within 0.5 seconds to reach 5×;
a later press starts at 2.5×. Native 0.2-second scope-in timing remains intact.
The four outer corner recesses marked in the supplied scope screenshot are
transparent on Araxys, showing the world behind the scope housing. The Default
Operator and other sniper scopes retain their opaque corners.
The Araxys optical opening is cleared against its exact ellipse after the
housing texture is drawn, eliminating the remaining JPG matte at the lens edge
and centre. The corner cutouts are expanded slightly along their contours to
remove a dark fringe; the textured housing remains in place.

With Araxys selected, Crosshair settings open on **Araxys sniper scope** rather
than the rifle crosshair tab. **Rifle ADS** is labelled separately. The sniper
tab previews the new scope, including its fixed housing and crosshair lines.
Its centre-dot controls change the live Araxys dot without requiring the old
advanced-options switch. Default Operator and other sniper scopes keep their
original advanced-options behavior and settings preview.

The source has no matching first-person animation clips. Fourteen Araxys plate
bone influences without native Operator equivalents are assigned to its root;
the named native bolt and magazine influences remain mapped to native bones.
The source GLB's skinned body requires Blender's evaluated mesh to apply its
bind pose. The first raw-mesh diagnostic put the body outside the view; the
evaluated import corrects this, and source/body bounds now match the native
Operator frame without an arbitrary display offset.

The generated assets are `app/mods/aim-viewmodel/araxys-operator.*`. Their source
hashes, geometry counts, and texture hashes are in
`tools/skin-converter/araxys-import-report.json`. Rebuild only this skin with:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --disable-autoexec --python tools/skin-converter/export-araxys.py
node tools/skin-converter/import-araxys.mjs
```

`test-araxys.cjs` checks original arm/animation bytes, native skeleton and camera
data, the Default option, selector/cache separation, skin-only firing sound,
and 16 hidden native-renderer
frames across both hands, normal/Jett views, hip/ADS/fire/reload. Each frame checks
all four parts, finite bones and zero WebGL errors. The current result is in
`araxys-test-results.json`; direct canvas screenshots are under `previews/araxys`.
The right-hand hip and ADS images were visually compared with the native Default
Operator reference. These are renderer checks, not measured live gameplay FPS or
an assessment of feel in a scenario. `test-operator-zoom.cjs` checks the actual
input controller's Hold and Toggle click sequences; `test-sniper-scopes.cjs`
checks the native 2.5× and 5× definitions and unchanged ADS timing.

Only `C:/Users/hate/Desktop/aimtrainer-test` was modified. Map culling and the
old cached bot wall occlusion remain removed.
