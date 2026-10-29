# Recon Phantom

Test copy only. Select Phantom skin > Recon and enter a new scene. Default and BlastX remain separate saved options.

Source: valorant-recon-phantom-rifle.zip. The Blender source is inspected and exported offline with portable Blender 4.5.3 in tools/skin-converter/runtime (ignored). export-recon.py exports the existing mesh normals, triangles and UVs. import-recon.mjs binds the gun, magazine, trigger and charging handle to the existing Phantom rig, preserving existing agent arms and native equip/fire/reload/ADS timings.

Connected components 74-80 are the raised optic, sight glass and its mounting pieces. They are removed from the exported mesh. Internal ammunition components 44-51 are also omitted. The remaining mesh has 12,227 triangles. The receiver, barrel, suppressor and top rail remain intact; no replacement scope is added.

The source's original 1024x1024 color, normal, roughness and metallic texture bytes are preserved. No resampling or claimed resolution enhancement is applied. Normal Y is adjusted for the converted UV orientation. Model and arms share a render-only view offset; other weapons and default Phantom do not receive it.

Hidden Electron renderer test test-recon.cjs passes selector persistence, default restore, Jett arms, native animation/arms byte preservation and idle/fire/reload/equip/ADS poses. Screenshot previews: recon-idle.png, recon-fire.png, recon-ads.png, recon-reload.png, recon-equip.png. Actual gameplay feel and FPS are left to manual testing.

Removed from active skin choices and game assets at the user’s request. This document describes the historical import only.
