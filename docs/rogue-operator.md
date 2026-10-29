# Rogue Operator in the isolated test copy

Select **Operator skin → Rogue** and enter a scenario. Fully close the test game
and restart through `Start Test Game.cmd` to load updated scripts.

Imported `C:/Users/hate/Downloads/rogue_operator_-_valorant_skin.glb`, found locally
alongside the supplied audio. The model credits neumann (Sketchfab neumann18),
CC-BY-4.0; attribution and source URL are retained in the generated manifest.
The model has 13,734 body, 4,330 scope, 580 scope-glass and 1,357 magazine triangles.
All ten required base-color, normal and metallic/roughness PNGs are copied unchanged.
Material groups retain their source factors; the red lens uses its source texture.
No extra glow or postprocessing was added.

The source stores the body, magazine and scope at separate origins. The exporter
aligns them to the native Operator frame and magazine/scope sockets. Body bone
names map to the native rig, including bolt, trigger and magazine. The sole
unmatched Accessory_A influence follows Root. Native arm mesh, animation payloads,
skeleton, equip, camera, hand controls, reload timing, scope overlay and zoom
behavior are preserved. Default and Araxys remain available with separate caches.

`rogueoperator.WAV` is copied unchanged as `app/mods/media/rogue-operator/fire.wav`.
The single MP3 from each `rogue_1_kill.zip` through `rogue_5_kills.zip` supplies the
five kill stages, also unchanged. Kill six repeats stage one; a new kill stops the
prior kill sound. Audio predecodes through the existing skin-audio system, uses
the existing bounded voices, and routes through native volume/mute guards.
Firing gain is 1.15 and kill gain is 0.52 after the requested +15% shot / -20%
kill-volume adjustment. The
showcase MP3 is reference material and is not part of per-shot playback.

Rebuild from the workspace root:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --disable-autoexec --python tools/skin-converter/export-rogue.py
node tools/skin-converter/import-rogue.mjs
& 'C:/Python315/python.exe' tools/skin-converter/import-rogue-audio.py
```

`extend-rogue.cjs` adds selection and source-material texture loading/disposal to
the shared loader, scoped to Rogue manifests. Both served loader routes match.
No engine rebuild is required: existing Operator firing/kill/cache hooks apply.
Import hashes and counts are in `tools/skin-converter/rogue-import-report.json`
and `rogue-audio-import.json`.

Validation: `test-rogue.cjs` passes 24 hidden Electron render cases (normal/Jett,
both hands, hip/ADS/fire/reload/reload-end/equip), checks source texture bindings,
finite bones and zero WebGL errors. Native arm/animation bytes, skeleton/camera,
menu selection, separate cache keys and Default fallback are checked. Actual
Electron decoding/playback passes for the firing sound and five distinct kill
buffers, sequence repeat and prior-kill interruption. Hip, reload and equip
previews were visually inspected in `previews/rogue/`. Existing Araxys, sniper
scope and Operator zoom regression checks pass. These are hidden renderer/audio
checks; foreground gameplay, perceived audio balance and FPS are unmeasured.

Only the isolated test copy was modified; test-data/ and HTTP port 8137 remain.

Brightness follow-up: all Rogue materials now use display gain 1.4 (+40%). A
controlled same-pose hidden-render comparison measured +39.64% across 442,967
unsaturated changed color channels (8-bit output rounding). All 24 Rogue render
cases and audio/menu/cache checks pass; the final hip preview was inspected.
Foreground gameplay/FPS remain unmeasured.

Audio balance follow-up: targeted runtime checks verified firing gain 1.15 and
all five kill stages at gain 0.52, with repeat/interruption and Default fallback
preserved. This check uses mock audio nodes; perceived balance by ear is unmeasured.
