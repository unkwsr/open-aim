# Changelog

All notable changes to open-aim. Newest first.

## [1.3.0] - 2026-10-29

### Added

- New map: Sunset, with six pre-aim drills (A Short, A Tube and B Main, each Easy and Hard).
- Weapon skins in Settings: Vandal RGX Yellow, Gaia Orange and Gaia White, Phantom BlastX,
  Guardian Prime, Sheriff Singularity, Operator Araxys and Rogue, Ghost Smite. Several
  have their own firing sounds and kill effects.
- Melee skins: Black Market Butterfly, Orange Butterfly, Karambit Damascus Steel, Prime
  Axe, Silkleaf Fan and Half Life Crowbar.
- New headshot effect.
- Shooting error graph (Settings > Video > Stats): a thin bar per shot, yellow for spray
  error and blue for movement error.
- Advanced bullet tracers with their own look per skin (Settings > Visuals).
- Sniper scopes for the Marshal, Outlaw and Operator; SMGs and heavies aim down sights
  like the rifles.
- Studio: 3D and Detailed map views, arena drills, Copycat bots that repeat a run you
  recorded, and bots that jump and crouch.
- Startup screen, and a loading card when a drill needs a moment to start.
- Smooth mouse-wheel scrolling in the lobby and menus.
- Favorites work offline.

### Changed

- Opens in fullscreen like a game. F11 switches to a window, and the app remembers it.
- Default skins: Vandal RGX Yellow, Phantom BlastX, Sheriff Singularity, Operator Rogue
  and the Black Market Butterfly. A skin you picked yourself is kept.
- Sunset drills show their difficulty: Easy when bots don't shoot, Hard when they do.
- The Import VALORANT settings and update notices wait until the startup screen is gone.
- Lobby: card corners have a proper edge, and the filter bar that follows you while
  scrolling fits on one line.
- The VALORANT settings import and the update panel use the esports look. The update
  panel shows "What's new" from the release notes before you install.
- Updates button in the lobby bar (red dot when a new version is out); it replaces
  Check for updates in Settings.
- The Interface setting (Video > Smoothness: Enhanced or Performance) is back.
- Smoother frames on Sunset, Corrode and drills with many bots.
- Difficulty labels are always in English.

### Fixed

- Corrode: invisible walls no longer stop bullets in arches and doorways.

### Removed

- The 1.2.0 headshot effect, replaced by the new one.
- The "S0pp: no-armor pistol round" drill.

## [1.2.0] - 2026-10-25

### Added

- Update notice in the lobby when a new release is out, with Update now, Remind me in
  7 days and Skip this version. Check for updates in Settings. Updating downloads the
  installer from the official GitHub release, checks it and restarts the app; settings
  and training data are kept. Thanks to @edu-boni.
- Import VALORANT settings (Settings > Import VALORANT settings): sensitivity, ADS and
  scope multipliers, crosshair, keybinds and more, with a preview, a backup and Undo.
  Thanks to @edu-boni.
- Bigger, clearer headshot effect. Thanks to @edu-boni.
- The installer lets you choose the install folder. Uninstalling asks whether to keep
  or delete your settings and training data (kept by default).

### Changed

- The original site's community links (KOOK, QQ), WeChat QR sign-in and language
  button are hidden, and the app uses the open-aim icon everywhere.

## [1.1.1] - 2026-10-24

Back to the stable build from before map culling: uncapped FPS, the accurate FPS meter
and the esports start screen stay.

### Removed

- Map culling, the Interface setting and the CPU line on the FPS meter. Map culling
  lowered performance on some PCs; they may come back once they are tested further.

## [1.1.0] - 2026-10-24

### Added

- Desktop frame settings in Video: Frame mode (No frame limit), an FPS cap up to 1000
  and a VSync toggle with a restart button.
- Map culling (Video > Smoothness, off by default): maps are batched in 32 m chunks so
  only the parts in view are drawn. Same picture, 50-80% fewer triangles. Turn it on
  for laptops and integrated graphics; on strong graphics cards it can lower FPS.
- FPS meter shows the game's CPU time per frame in rounds.
- Interface setting (Video > Smoothness): Enhanced (default) or Performance, with solid
  panels instead of glass blur.

### Fixed

- FPS meter counts the frames the game draws, so it shows the real frame rate with No
  frame limit instead of the monitor's refresh rate.
- Round start screen ("Click anywhere to start") uses the esports look again.
- Shader warm-up no longer throws and stalls when a map's materials are replaced.

## [1.0.0] - 2026-10-23

First version as a repository.

### Added

- Desktop app with a local game server, offline mode and file overrides.
- Esports theme, top bar, FPS meter, sensitivity tools and backups.
- Studio: build drills on a 2D map with bots, smoke and cover, preview them in 3D, and play them.
- 25 extra scenarios, one file each in `scenarios/`.
- Clear English names and descriptions for all 99 drills.
- `scripts/build-scenarios.mjs` to check scenarios and build the training list.
- Contribution guide, issue and pull request templates, and a CI check for scenarios.
- `examples/starter-drill.json`, Discussion forms, a release guide and a GitHub Pages site.
