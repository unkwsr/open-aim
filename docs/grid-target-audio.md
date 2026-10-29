# Grid-dot sound and visual filtering — 2026-10-28

All changes are in aimtrainer-test. The supplied Steam sounds/01-saya-spawn.ogg
was copied byte-for-byte into app/mods/aim-audio/grid-targets/. The original was
not modified. The decoded clip is ~0.233 seconds at 48 kHz.

Sphere target hits, including lethal grid-dot hits, now play that clip instead
of the usual hit/kill chime. Humanoid bot hit/kill audio retains its existing
routing; a shot hitting both a dot and a bot can play both appropriate sounds.
Misses do not play the clip. This applies to sphere targets across drills,
independently of the player's weapon. It uses the existing audio enable, volume
and kill-sound settings, with the existing master gain.

The sample fetch is shared, decode is cached per AudioContext, and scenario
preparation awaits warming for scenes with sphere targets. Playback does no
per-hit fetch/decode. Overlapping voices are capped at 16 and disconnected on
completion/disposal. If settings are enabled mid-round before warming, the first
hit starts loading; subsequent warmed hits play normally.

Following the user's clarification, character bots retain their original custom
headshot bursts (and native fallback), including Reyna and other humanoid looks.
Body/leg impacts remain. Sphere target dots suppress all impact bursts, regardless
of hit part. Filtering occurs per actor at primary/collateral impact calls, so a
mixed dot/bot shot still displays the bot effect. Both engine routes preserve this
filtering and the custom dot sound when rebuilt. Character headshot settings are
still respected; no player preferences were changed.

Validation: test-grid-target-audio.cjs passes byte equality with the supplied
file, offline decoding/rendered audio, 40 rapid hit calls with one fetch/decode,
voice cap, mute/volume, dot hit/kill versus humanoid/miss/mixed routing, three
actual native dot hits, character headshot restoration, dot visual suppression,
mixed per-actor visuals, native body/leg impact cleanup,
and equality of the two engine routes. Results: grid-target-audio-results.json.
The previous test-headshot-effects.cjs now delegates to this current regression.
The engine rebuild is repeatable. test-bot-default-audio.cjs also passes all
18 weapon samples and existing player-skin routing checks. No foreground FPS
or live listening/volume-comfort measurement is claimed.

Implementation: grid-targets.mjs, extend-grid-target-audio.cjs and
extend-headshot-effects.cjs, preserved by build-audio-loader.cjs.
