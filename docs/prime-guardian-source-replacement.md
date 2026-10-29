# Prime Guardian supplied GLBs — 2026-10-28

Only the isolated `aimtrainer-test` checkout was changed.

The three supplied Downloads GLBs are byte-for-byte identical to the previous
HAR-extracted source assets. `guardian.glb` contains the Prime/HypeBeast model;
`FP_Guardian_Prime.glb` contains first-person arm tracks;
`GN_Guardian_Prime.glb` contains the matching gun tracks. There are no textures
embedded in these files. The importer reuses the existing local body textures.

## Corrections

- Body atlas and ORM maps no longer cover the separate panel and energy meshes.
  The body panel is filled with opaque cyan, as subsequently requested by the
  user; the sight retains its separate lens. These colors are
  local material choices, since the GLBs only contain placeholder materials.
- Scope primitive material indices are local to its own material array (0–2).
  Previously the indices were 4–6, outside that array, so those groups did not draw.
- Both source reload clips are baked to Guardian's 2.5-second gameplay duration.
  An 80 ms entry and 100 ms exit blend meet the existing idle pose.
- Guardian's default locomotion layer was modifying Prime's authored reload
  fingers: the source comparison found up to 0.9713 cm / 0.1782 rad difference.
  That layer fades out for Prime's reload interior and back in at the endpoints.
  Default Guardian and other weapon behavior retain their existing paths.
- The importer accepts `--source-dir` and records all three source SHA-256 hashes.
  Rebuilding from the supplied files and the identical cached files produces
  byte-identical assets and loaders.

## Build

From the test checkout root:

    node tools/skin-converter/import-prime-guardian-har.mjs

To explicitly use the supplied files again:

    node tools/skin-converter/import-prime-guardian-har.mjs --source-dir C:/Users/hate/Downloads

This writes the Prime model/animation pack and both served loader routes.
No engine or audio rebuild is needed for this change.

## Measured verification

All checks ran using this checkout's own Electron runtime, in hidden windows.

- `test-prime-guardian-source.cjs`: 55 reload render frames, 20,295 channel checks
  against independently decoded GLB tracks. Maximum position error
  0.00002981 cm; rotation error 0.0004771 rad; scale error 0.0000003424.
  Idle/reload endpoint component error below 0.000000024.
  Also checks material isolation, valid scope material indices, default Guardian
  selection/rendering and WebGL errors.
- `test-prime-guardian.cjs`: pass, skin loading and hip/ADS rendering.
- `test-guardian-reload.cjs`: pass, eight inspected reload snapshots.
- `test-movement-grip.cjs`: pass.
- `test-reflex-skins.cjs`: pass (existing default Guardian / rifle controls).
- Both served loader files are byte-identical.
- Final hip, ADS and reload screenshots were visually inspected.

These results do not establish foreground FPS or user gameplay feel. A foreground
round has not been played in this session. The existing skin selection remains
Guardian → Prime; fully restart the test game to load the rebuilt assets.

Previous generated Prime assets and two comparison images are retained under
`tools/skin-converter/prime-guardian-before/`.

## Later optimization: flat cyan panel

After the user reported continued FPS loss, replaced the three body energy
materials with one dimmer, opaque `MeshBasicMaterial`. This material uses no
lighting, environment reflections, textures, emissive shading or tone mapping.
The three contiguous energy groups now share one draw call. Geometry and reload
tracks are preserved. The separate sight materials retain their existing path.

`profile-prime-panel.cjs` compares the previous opaque lit pack, the flat pack,
and hidden energy sections on the same GL context. At 1920×1080, three alternating
480-frame blocks per variant measured:

| Variant | CPU mean ms | GPU mean ms | Model draw calls |
|---|---:|---:|---:|
| Previous lit | 0.230 | 0.277 | 9 |
| Flat cyan | 0.200 | 0.265 | 7 |
| Energy hidden | 0.192 | 0.258 | 6 |

GPU timer queries were available and not disjoint. This is a hidden model-only
benchmark, not foreground game FPS. The small difference does not establish that
the cyan panel explains the user's larger FPS loss. Results are in
`tools/skin-converter/prime-panel-profile-results.json`.
Source-pose and reload-render checks pass after this change.

## Supplied audio and further optimization

The user's three stereo 44.1 kHz / 16-bit PCM WAVs are copied unchanged into
`app/mods/media/prime-guardian/`:

- `primeguaridanbullet.WAV` → `fire.wav` (0.65016 s).
- `guardianreload.WAV` → `reload.wav` (2.43810 s, fits the 2.5 s reload).
- `equipprimeguaridian.WAV` → `equip.wav` (1.27710 s).

`import-prime-guardian-audio.py` reproduces the import and records SHA-256
identities in `prime-guardian-audio-import.json`. No downmixing, trimming or
lossy encoding is applied. The three files total 770,282 bytes.

`app/local-customization.js` decodes the buffers before play and reuses three
volume buses per output. Fire allocates one one-shot source; no per-shot fetch,
decode, gain node, filter or spatial panner. Guardian voices are capped at eight.
Gains relative to the game's master volume are fire 1, reload 1.5 and equip 2
(the supplied equip recording is quieter). Default Guardian retains native audio.

`extend-prime-guardian-audio.cjs`, last in `build-audio-loader.cjs`, awaits the
audio preparation during loading, observes authoritative simulation times for
equip/reload transitions, and stops voices on game disposal. Equip/reload do not
restart on duplicate render frames. Weapon/skin changes, pause, reload aborts
and mute stop the associated voices. Shots interrupt equip/reload cues.

Skin optimization also removes the unused 1024×1024 emissive texture reference,
avoiding its request/decode/GPU upload. Body and cyan materials cull back faces.
The source topology, visible exterior geometry and reload animation are retained.
Final hip, ADS and reload renders were inspected.

Verification:

- New `test-prime-guardian-audio.cjs`: correct three buffers, actual fire routing,
  decode reuse, three prewarmed gain nodes, eight-voice cap, interruption/mute
  guards, default Guardian isolation and a non-silent rendered shot all pass.
- `test-prime-guardian-source.cjs`, `test-prime-guardian.cjs`,
  `test-guardian-reload.cjs`, `test-rgx-audio.cjs`, `test-gaia-audio.cjs` and
  `test-scenario-loading.cjs` pass.
- Real engine profiler with local audio enabled: 16/16 shots used Prime audio;
  zero WebGL errors; custom audio submission mean 0.056 ms, max 0.1 ms. The
  window's timer resolution is coarse, about 0.1 ms. This does not measure audio
  device latency or foreground FPS. GPU p99 around 5.5 ms remains unexplained,
  as in earlier weapon profiles; this change does not claim to resolve it.
- The two served engine routes are byte-identical.

The final engine profile is retained in
`tools/skin-converter/prime-guardian-engine-profile-results.json`.
To repeat it, set `WEAPON_PROFILE_GUNS=guardian`,
`WEAPON_PROFILE_LOCAL_AUDIO=1`, `WEAPON_PROFILE_GUARDIAN_SKIN=prime-guardian`,
then run `profile-weapons.cjs` with this copy's Electron runtime.

## Latest audio replacement: no equip, new shot, five kills

This supersedes the initial firing/equip configuration above:

- Equip audio is removed from playback, preloading and the media folder.
- `primeguard.WAV` replaces `fire.wav` unchanged (1.36998 s).
- Reload remains `guardianreload.WAV`.
- The single MP3 from each supplied `prime__2.0_1_kill.zip` through
  `prime__2.0_5_kills.zip` is imported unchanged as `kill1.mp3` through
  `kill5.mp3`. Archive PNGs are not used.
- The Prime Guardian kill sequence follows the engine's kill count, 1–5 and
  repeat; the next kill stops the previous kill sound. Kill volume is 0.65 times
  the game's master gain. Native kill mute/disabled/zero-volume guards apply.
- Seven buffers are predecoded and three shared volume buses serve fire,
  reload and all kill stages. Voice cap remains eight. No equip buffer is loaded.

`test-prime-guardian-audio.cjs`, `test-rgx-audio.cjs` and
`test-gaia-audio.cjs` pass after this replacement. The Guardian test verifies
kill order/wrap/interruption, removal of equip fetch/playback, correct replacement
shot duration and buffer reuse, default Guardian isolation, mute handling and
actual non-silent offline rendering. The five decoded kill durations are about
2.007, 2.199, 2.207, 2.351 and 5.499 seconds. Foreground gameplay is untested.

### User feedback corrections

Guardian firing gain is now 4 instead of 1 (+12.04 dB), with reload and kill
gains unchanged. The offline single-shot output peak measured about 0.246 at
master gain 1; this is not a measurement of perceived loudness in gameplay.

An active Guardian kill sound now continues across switching to melee/another
weapon, switching back, or re-equipping. Reload voices still stop on switch.
Following further feedback, shot voices also continue across switches/equip
updates. The kill is protected from shot voice-limit eviction. A newer kill
sound replaces it; pause, mute, disposal or scene-time rewind still stops it.
The native kill-sound toggle is honored even while another weapon is selected.

The Guardian audio regression now covers all of these transitions, the boosted
gain and voice-cap protection. Guardian audio, Prime Axe rendering/audio and RGX
audio checks pass after the feedback fixes. Foreground feel remains untested.

The latest Guardian audio regression explicitly starts a shot before the first
Guardian state update, switches to melee one millisecond later, switches back,
and repeats the equip frame. The source is never stopped by those transitions.
Previously the state cleanup could stop it before audible output began. Pause,
mute, disposal and scene rewind retain full audio cleanup; the eight-voice cap
still applies. This corrects the reproduced transition cutoff, without claiming
that every possible missing-shot cause has been diagnosed.
