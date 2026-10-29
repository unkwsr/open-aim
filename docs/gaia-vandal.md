# Gaia Vandal Orange

Isolated test copy only. Available alongside Default and RGX under Weapon skin > Gaia Orange. Saved key es-vandal-skin. Enter a new scene after selection. Champions was subsequently removed; saved Champions selections migrate to Default.

The supplied GLB has a separate static magazine and body, with 4,961 source vertices and 5,190 triangles. All source geometry is retained without reduction, deformation or flattening. Source positions are converted from metres to centimetres by [x,y,z] -> [100*x,-100*z,100*y], and the shared scene-display translation is omitted. Original normals, tangent vectors/handedness, UV coordinates, triangle order and material groups are preserved.

The body binds to the native Vandal root, except its 22-vertex charging-handle island, which follows Charging_Handle. The magazine binds to Magazine_Main. A magazine copy follows Magazine_Extra for the existing reload animation. Native agent arms, rig, camera setup, equip/fire/reload/ADS animation data and gameplay timing remain unchanged.

Embedded PNG bytes are copied directly: color and normal 2048x2048; crystal emissive 1024x1024. No re-encoding, texture resizing, synthetic sharpening or AI artwork is applied. Original roughness, metalness, color factors, normal scale and crystal emission factors are preserved. Only the crystal material samples the emissive texture. Anisotropic filtering uses the same setting as existing custom skins.

Rebuild: node tools/skin-converter/import-gaia.mjs. Static fidelity validation: node tools/skin-converter/validate-gaia.mjs. Hidden renderer test: tools/skin-converter/test-gaia.cjs. Tests pass all source vertices/triangles/UVs/normals/tangents, exact texture bytes, unchanged native arms/animations, decoded texture dimensions, correct emissive material, selector, Jett compatibility and idle/fire/reload/equip/ADS render poses. Existing Default/Champions/RGX regression also passes. Preview images are gaia-idle.png, gaia-fire.png, gaia-reload.png, gaia-ads.png, gaia-equip.png. No gameplay FPS result is claimed.

Firing sound: the supplied 1025 (2).WAV is copied byte-for-byte to app/mods/media/gaia-vandal-orange/fire.wav. Predecoded once, reused through the native audio master and mute guard. Gaia Orange Vandal uses it automatically ahead of the generic custom Vandal firing preset; other weapons/skins retain their existing behavior. Offline audio test test-gaia-audio.cjs passes decoding (1.34675 s, stereo), weapon/skin isolation, mute handling, no per-shot fetching and custom sound fallback on other Vandal skins.

## Supplied Gaia kill sequence

The five `gaia's vengeance_1_kill.zip` through `gaia's vengeance_5_kills.zip`
archives supply one MP3 each. Imported unchanged as `kill1.mp3` through
`kill5.mp3` in `app/mods/media/gaia-vandal-orange/`; archive PNGs are not used.
Reproduce with `python tools/skin-converter/import-gaia-kills.py`. Source/member
identities and SHA-256 hashes are in `tools/skin-converter/gaia-kills-import.json`.

Only Gaia Vandal uses this sequence. Stages follow the engine's kill count,
1–5 and repeat, with each new kill replacing the prior kill sound. Switching to
melee does not cut it off. Five buffers are decoded once before playback; no
per-kill fetch/decode. Volume is 0.65 times the game's master gain, with existing
disabled/master-mute/kill-sound guards. Gaia's firing file and 0.55 firing gain
are unchanged.

Gaia, RGX and Guardian audio tests pass. Gaia's test checks order/wrap, prior-kill
interruption, switch continuity, volume/mute, skin isolation and no per-kill
fetch. Decoded durations are about 4.080, 4.079, 4.079, 4.079 and 7.550 seconds.
These are hidden audio checks; foreground gameplay was not performed.

Volume adjustment: Gaia firing gain is now 0.55 (55% of its previous gain, approximately -5.2 dB). The supplied WAV bytes, duration and pitch are unchanged; other sounds retain their gain. Offline audio tests verify the gain and skin/weapon isolation.

## Brightness and charging handle correction

Gaia's two materials now multiply displayed RGB by 1.25 after tone mapping and
color-space conversion, before dithering. This changes Gaia only, including its
magazines, without changing arms, scene lighting, texture bytes or geometry.
It uses the existing material pass; no extra light, glow pass or draw call.

The source is unrigged. Its protruding red charging handle previously shared
the body Root binding. The importer identifies the closed crystal island at
source primitive 0 / seed vertex 0 by connectivity, welding UV/normal seams only
for discovery. It checks that the island has 22 vertices and lies within 2 cm of
the native Charging_Handle bind position, then binds that island to the native
animated bone. All exported positions/triangles/UVs/normals/tangents remain intact.

Champions Vandal is removed from the selector and runtime selection allowlist.
Saved Champions preferences migrate to Default; direct legacy loader selections
also resolve to Default. The unused source assets remain available internally.

Verification: source fidelity validation passes. The hidden renderer comparison
measured a 1.25017 display-color ratio over 279,558 sampled channels. The handle
mesh point moved relative to the body during native fire (~9.15 cm maximum in
the sampled poses) and equip (~14.23 cm); this is animation-space measurement,
not foreground gameplay. Selector removal and legacy fallback pass. Gaia audio,
skin-sight regressions and Guardian source/render checks pass. Idle/fire/reload/
ADS/equip screenshots were visually inspected. Foreground gameplay is untested.
