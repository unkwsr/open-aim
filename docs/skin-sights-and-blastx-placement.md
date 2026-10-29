# Corrected skin housing and BlastX framing

This supersedes the initial mistaken whole-device removal and 18% screen lift.
The user wanted the folded black housing hidden, while retaining the original
opening scope design, holo projector, physical ADS anchor and aiming behavior.

The reflex device is again loaded/created for every originally supported weapon.
Default weapons retain its normal visibility. Custom skins keep its physical
housing mesh hidden during hip fire, opening, ADS and closing. The original holo
projector remains visible while aiming. Bones, pose sampling, glow and physical ADS alignment remain
active; the old HUD sight fallback is no longer substituted for custom skins.

BlastX retains the approved 80-degree horizontal hip viewmodel FOV. The excessive
18% viewport projection shift is removed entirely. The hip offset is lowered by 10% of the neutral gun model height from the prior
zero-offset position (2.854 cm in the tested BlastX model). Model height is computed
once at creation from the posed gun bounds; there is no screen-space projection shift. Authored ADS
height correction remains unchanged. The FOV adjustment fades out with zoom alpha,
reaching the original full-ADS projection. Other weapon framing/settings unchanged.

Implementation: extend-reflex.cjs, extend-blastx-placement.cjs and
build-viewmodel-loader.mjs. Both generated DXHU7cEs.js routes match. No engine,
map, bot, scheduler or equip-animation changes.

The Electron test-skin-viewmodel-placement.cjs verifies default Vandal/Phantom
housing visible at hip, Champions/RGX/Gaia/BlastX housing hidden at hip, and custom housings still hidden in ADS while the original holo is drawn with
subpixel-centered ScopeTarget for all six. It also verifies 80-degree BlastX FOV, zero projection shift, 10% lowering and unchanged full-ADS projection. GL errors zero; native ADS
integration checks pass. See skin-placement-results.json and the placement PNGs
in tools/skin-converter. Restart Start Test Game.cmd to load. User feel untested.
