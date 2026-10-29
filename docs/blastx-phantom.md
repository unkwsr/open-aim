# BlastX Phantom

Isolated test copy only. Settings has a Phantom skin row with Default / BlastX, stored as es-phantom-skin. Enter a new scene after changing it. BlastX is selected when no saved choice exists. Vandal selection and custom Vandal sound scoping remain separate.

## Source and conversion

The initially supplied phantom.glb and companion GN/FP/Jett GLBs have no colored skin textures. The subsequently supplied valorant-phantom-blastx ZIP includes a separate FBX with its own UV layout and full PBR maps. The integrated colored model uses that FBX and its matching textures, rather than assigning incompatible UV textures to the earlier GLB. The extra supplied Jett arms are not substituted for existing agents.

Offline import: node tools/skin-converter/import-phantom.mjs. Requires the archive contents in tools/skin-converter/blastx-source. The small binary FBX reader supports this source's geometry, normals, UVs and model transforms; it is not a general FBX animation importer.

A single uniform scale and rigid pitch rotation fit the model to the supplied rigged BlastX stock/muzzle end caps. The 27 weapon-shell parts are consolidated into gun and magazine meshes, with 7,614 weapon-shell triangles preserved, source normals and UVs retained, and lossless original 2048x2048 texture bytes copied. All 19 ammunition submeshes are excluded, including the three detached display bullets and sixteen magazine ammunition meshes. Magazine parts move with Magazine_Main; the trigger and charging handle follow their corresponding native bones. FBX V coordinates are converted for the captured texture loader, with the corresponding normal Y adjustment.

Existing Phantom agent arms, core equip, fire, reload, ADS animations, gameplay and timing are preserved. This does not install the supplied separate Inspect animation. Model choice is included in the renderer cache key. Color, normal, roughness, metalness and AO maps are loaded once per model pack, with anisotropic filtering and disposal.

## Validation

Hidden Electron test tools/skin-converter/test-phantom.cjs verifies all five maps decode at 2048x2048, selector persistence, original/default model restoration, Jett compatibility, original arm/animation bytes and finite idle/fire/reload/equip/ADS poses. Rendered previews are phantom-idle.png, phantom-fire.png, phantom-ads.png, phantom-reload.png and phantom-equip.png in tools/skin-converter/. Existing rifle skin regression is also checked. Gameplay feel and FPS are not measured by these fixture tests.

Placement correction: the initial hand-picked trigger alignment tilted and raised the rear of the model. The importer now measures both ends from the supplied phantom.glb and the textured FBX, then solves one uniform scale and rigid rotation. No flattening, texture resizing, or arm-animation changes are applied.

View-height correction: BlastX moves its weapon and arms together 4 cm down at hip fire and 2 cm down in ADS, smoothly blended by the existing ADS progress. This changes only the first-person render offset; geometry proportions, shot directions and gameplay timing remain unchanged. The original/default Phantom and other skins have no offset.

Height fine adjustment: the previous lowering is eased back by 7%, from -4/-2 cm to -3.72/-1.86 cm (hip/ADS). Geometry size is unchanged.

The BlastX firing WAV and five-kill audio sequence are now installed for this skin. See docs/blastx-audio.md.
