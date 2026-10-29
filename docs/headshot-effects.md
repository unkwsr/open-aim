# Character headshot effects restored — 2026-10-28

The grayscale shard variant now remaps its luminance to orange/red with a bright
contact core. After feedback that the initial tint looked static/yellow, the
shader now uses local plane UVs for a stronger vertical gradient and deepens
toward red over its 180 ms lifetime. A pooled material's age resets on each hit.
The change replaces the former pale multiplication tint.
Only that variant's shader changed; alpha, silhouette, animation, size and the
other variants remain unchanged. One existing material uniform changes with age;
there is no texture rewriting or per-frame painting.
Both engine routes were rebuilt. test-headshot-palette.cjs compiled/rendered
all four real atlases and verified warm pixels in the recolored variant;
previews/headshot-palette.png was visually reviewed. No gameplay FPS claim.

The user clarified that removal applies only to grid-shot dots. Character bots
retain the custom headshot effects below, native fallback, and body/leg impacts.
Only sphere target impact calls are suppressed; their supplied sound still plays.
See [grid-target-audio.md](grid-target-audio.md) for routing and current tests.

## Randomized character headshot effects

Integrated into the isolated test copy after approval. Four screenshot-derived sprites: classic, warm shards, orange dink and red-gold splash. The formerly white shard burst is recolored at material level with a cream/amber/coral vertical tint, preserving its alpha and silhouette. Other source sprites retain their supplied preview colors.

All effects last 180 ms. Each has 18 baked frames in a 6x3 atlas of 192-pixel cells (1152x576 atlas). Native body/leg impact behavior stays unchanged. If sprite textures are not ready, native headshot feedback is used as fallback. Headshot effect enable/mute settings are respected. One variant is randomly selected on each headshot, excluding the previous one when multiple variants are available.

Rendering uses one camera-facing plane per hit, anchored at the impact point and raised to keep the sprite's contact star on the head. Shared geometry, four shared atlas sources and per-variant pools of 24 render objects avoid per-hit mesh/material/texture creation. At most 24 headshot sprites are active. Per-frame work changes only atlas offsets and transforms; there is no per-frame canvas drawing, image painting or texture image update. All resources are disposed with the scene. These are implementation facts, not a measured FPS claim.

Baking: tools/skin-converter/bake-headshot-atlases.cjs reads the approved preview assets and motion. Engine rebuild: node tools/skin-converter/build-audio-loader.cjs. Assets are under app/mods/aim-impact/headshots. The shader and renderer are in tools/skin-converter/headshot-effects.cjs and injected by headshot-patch.cjs.

Validation: hidden Electron test-headshot-effects.cjs passes all four variants, 1,000 random selections with no consecutive repeats, warm tint shader compilation, cached atlas sources, render-object reuse, no per-hit source-image updates, exact 180 ms lifetime, cap/cleanup, disabled setting, native fallback and body-impact preservation. A four-variant rendered proof is tools/skin-converter/headshot-four-variants.png. Source screenshot cutouts are imagegen-assisted reconstructions; they are not original recovered Valorant effect assets.

All four sprite dimensions enlarged by 15%, from 0.72 m to 0.828 m. Camera-up anchoring scales with the sprite so its contact star stays at the hit point. Atlas frames, tint, random selection and 180 ms duration are unchanged.
