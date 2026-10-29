# Default bot weapon recordings

Bot Vandal shots previously used the globally overridden
app/mods/media/vandal.rgT5EY0P.ogg (7,227 bytes). The captured original is still in
site/media/vandal.rgT5EY0P.ogg (8,647 bytes). The builder copies that original to
app/mods/aim-audio/default-weapons/vandal.ogg for bot playback only. The existing
player override and player skin/custom sound choices are preserved.

Other bot weapons use their original native recording table. The bot path reuses
the native decode cache, 0.5 sample gain, pitch variation, distance attenuation,
volume/mute guards and synthetic fallback if an asset cannot load. It never calls
the player's imported/skin sound hooks. Scenario preparation now awaits bot sound
decoding before the countdown; warmed shots perform no network requests.

extend-bot-audio.cjs is preserved by build-audio-loader.cjs (engine routing) and
build-video-settings.cjs (native audio module bridge and pristine asset copy).
Both captured routes match. No saved audio settings are changed.

test-bot-default-audio.cjs decoded and played all 18 built-in weapon recordings,
checked Vandal audio samples against the pristine file, isolated player hooks,
checked native gain/pitch and mute, and verified no per-shot fetch after warmup.
Existing Gaia and BlastX player-audio regression fixtures pass. See
tools/skin-converter/bot-default-audio-results.json. These are audio-routing and
sample checks, not a live listening comparison. Restart Start Test Game.cmd.
