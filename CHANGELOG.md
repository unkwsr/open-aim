# Changelog

All notable changes to open-aim. Newest first.

## [1.3.0] - 2026-10-29

The biggest update yet: a new map, 15 skins, new aiming and effects, a much bigger Studio and smoother performance. Your settings and training data are kept when you update.

### New map
- **Sunset**, with six pre-aim drills: A Short, A Tube and B Main, each in **Easy** (bots don't shoot) and **Hard** (bots shoot back).
- Sunset has its own map art on drill cards, favorites and the loading screen.

### New skins
- **Vandal:** RGX Yellow, Gaia Orange, Gaia White
- **Phantom:** BlastX
- **Guardian:** Prime
- **Sheriff:** Singularity
- **Ghost:** Smite
- **Operator:** Araxys, Rogue
- **Melee:** Black Market Butterfly, Orange Butterfly, Karambit Damascus Steel, Prime Axe, Silkleaf Fan, Half Life Crowbar
- Several skins have their own firing sounds, kill sounds and kill effects.
- Pick skins in **Settings**. New defaults: RGX Vandal, BlastX Phantom, Singularity Sheriff, Rogue Operator and Black Market Butterfly.

### Aiming and weapons
- **Holo sights** on the Odin, Ares, Spectre, Stinger and Bulldog: the folding reflex sight and aim-in animations the rifles use. Aim speed, zoom and accuracy are unchanged.
- **Sniper scopes** for the Marshal, Outlaw and Operator, with a smoother opening. Scope timing is unchanged.
- The gun and hands move together while strafing.
- Aiming right after pulling out a gun no longer shows the sight off to the side.
- **No more first-shot freezes:** the worst frame while firing dropped from up to 150 ms to under 4 ms.
- Every weapon and skin is prepared before a drill starts, so switching weapons doesn't stutter.
- Phantom, Spectre and Ghost tracers use the same orange as the Vandal.

### Effects and sound
- **New headshot effect:** sharp, quick splashes on bots.
- Hitting a dot (Grid Shooting and other target drills) plays a new hit sound, without the impact burst.
- Studio target dots are white in Dark mode and black in Light mode.
- **Advanced bullet tracers** (Settings > Visuals), with their own look per skin.
- Bots use the original weapon sounds.

### HUD and settings
- **Shooting error graph** (Settings > Video > Stats): a thin bar per shot, yellow for spray error, blue for movement error.
- **Frame mode** in Video: Unlimited, Match display or Custom (30–1000 FPS, presets 120 / 144 / 165 / 240 / 360).
- The FPS counter sits under the minimap, only while you play.
- The **Interface** setting is back (Video > Smoothness): Enhanced, or Performance with no glass blur.
- Crosshair settings in a match have a bigger preview with the map behind it, the RGX sight and the sniper scope.
- Crosshair changes apply right away in a drill, without leaving it.
- **Import VALORANT settings** and the update panel have the esports look. The update panel shows what's new before you install.
- **Updates** button in the lobby bar, with a red dot when a new version is out.

### Studio
- **3D** and **Detailed** views: Detailed shows the real game map, and 3D shows clean maps.
- **Copycat bots:** record a run, and a bot repeats it and shoots at you. Saved runs are kept in a **Runs** library.
- Bot options: **Unpredictable** movement, **jumps** (0.2–2 m), **occasional crouching** and **slows when hit**.
- **Arenas** from 12 to 200 m, with walls up to 40 m.
- Quiet **Dark** and **Light** looks with **Flat** or **Grid** surfaces.
- Dragging pieces in the editor is much smoother.
- Bots face the way you set them, and respawn at their own spawn point.
- Drills started from the Studio return to the Studio when you leave them.

### Lobby and app
- Opens in **fullscreen** like a real game. F11 switches to a window, and the app remembers your choice.
- Startup screen while the game loads, and a loading card when a drill needs a moment.
- Restarting a drill skips the full loading screen.
- Smooth mouse-wheel scrolling in the lobby and menus.
- Favorites work offline.
- Lobby polish: cleaner card corners, and the filter bar fits on one line while scrolling.
- The VALORANT import prompt waits until loading is done.
- Difficulty labels are always in English.

### Performance
- Smoother frames on Sunset, Corrode and drills with many bots.
- Maps and bots draw with less work, without bots popping in late when you peek.
- Smoother frames with no FPS limit.
- Faster drills with jumping and crouching bots.

### Fixes
- Corrode: invisible walls no longer stop bullets in arches and doorways.
- The game no longer tries to load online pages that aren't there.

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
