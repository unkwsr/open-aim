# Changelog

All notable changes to openVaim (formerly AimTrainer). Newest first.

## [1.4.2] - 2026-11-20

The game now speaks Korean, Japanese and Chinese, the top bar fits any window, and the download is about 95 MB smaller.

Your settings, drills and history carry over when you update.

### Languages
- New Settings > Language tab: English, 한국어, 日本語 and 中文. The lobby, settings, rounds, results, history, Community Workshop and the Creator are all translated. Thanks to ehbori2014-bit for the first version.
- Bot types in the Creator use the names players use (for example AD 무빙, レレレ, AD 拉扯 for strafers).
- After you switch, the game reopens on the Language tab, so you can switch back if you picked one by mistake.

### Lobby
- The top bar stays on one line at every window size and in every language. The buttons on the right are icons, with their names in the tooltip.
- The account menu shows Sign out on every tab, including Collection.
- Drills you heart in the Community Workshop now show up under Favorites.

### Fixes
- The end of a round no longer shrinks the game into a dark frame with a short freeze behind the results.
- The loading screen text no longer runs over the steps list.
- Kill icon pictures are gone for every gun (kill sounds stay).
- The AK-47 first-person option is gone; the Vandal is the rifle.
- About 95 MB of files the game no longer used were removed.

## [1.4.1] - 2026-11-19

Lots of Creator stuff (waves, Dot bots, more bot controls), smoother frames with bots on screen, a Potato graphics mode for slower PCs, and a bunch of fixes.

Your settings, drills and history carry over when you update.

### Creator
- New "Bots show up: In waves" mode. Build waves A, B, C, each with groups of bots: the next group comes when the one before is dead. Trades work inside a group, and each wave can play more than once. A wave counter shows on the HUD.
- After the last wave the round can end or start again. Wave refills can give back a set amount of HP.
- New Dot card: a floating ball to shoot, like in Aim Lab. One hit kills it. It can hold still or slide side to side, stick to walls and boxes, float up to 30 m high, and use random spots and a random zone (on a wall the zone stays on that wall).
- Speed multiplier for every moving bot, up to 3x. Bots without a gun now move at your knife speed by default.
- Peekers can face a direction you pick, so they strafe or hold an angle instead of always facing you.
- Arena colors: change the floor, walls, grid lines and target colors.
- The Creator now warns you when a bot's path goes through a wall and keeps strafes inside the room they have.
- Your own drills keep their own death, refill and HP-per-kill settings.
- Fixed dragging a peek spot in 3D jumping back to the bot.

### Community Workshop
- New drill panel: your standing on the leaderboard, a goal to beat, plays and likes, and who made it.
- Creators can rename their drills, change the picture or delete them from the panel.

### Performance
- Smoother with lots of bots on screen, especially when bots shoot back.
- Less stutter from movement and collision.
- New Potato graphics option in Settings > Video for slower PCs. The Compatibility preset turns it on.
- Graphics presets now really change the render resolution.

### Agents and flashes
- Phoenix's curveball looks and pops like the real one. The wall bounce was taken out because it broke some drills.
- KAY/O's flash has its real look, flight and timing.
- Jett's dash, updraft and glide feel closer to the real thing.
- Fixed Chamber keeping Jett's arms.

### Fixes
- Fixed bots getting you to 0 HP without you dying.
- Fixed getting stuck on grass along the tracks in Corrode A Main, and on the lily pads at Lotus C.
- Exit button in the lobby.
- The update prompt now shows Update now or Cancel when you start the game, and the Updates button gets a red mark when an update is waiting.

## [1.4.0] - 2026-11-14

AimTrainer is now openVaim. This one's big: I rebuilt the maps, added Pearl and Icebox, moved the game to its own thread, and added the Community Workshop, Chamber, Blade Storm, a bunch of skins and a lot of Creator stuff.

Your settings, drills and history carry over when you update.

### Maps
- New maps: Pearl and Icebox. Both have drills, map art and a minimap, and you can build on them in the Creator.
- Every map is rebuilt from scratch.

### Performance
- The game now runs on its own thread, separate from the menus, so frames are steadier.
- Fixed mouse movement sometimes showing up a frame late, which made aim feel jerky.
- New Smooth aim option in Settings > Video (off by default). It smooths out your mouse a little more and only adds about 2-3 ms. Clicks and shots aren't delayed.
- Rounds start faster, and the stutter right at the start is mostly gone.
- No more freeze the first time a gun, skin or smoke shows up, or when a round has a lot of bots.
- Map culling option in Settings > Video, for slower PCs.
- Frame rate defaults to Match display, which feels the smoothest.
- Lobby scrolling is smoother.

### Community Workshop
- Publish your drills from the Creator and play other people's.
- Sign in with Discord to publish, like drills and post scores.
- Every drill has a 6-character code you can share. Use Enter code to open one.
- Every Workshop drill has its own leaderboard.
- Uploads get checked by a moderator before they go public.
- Bookmark drills to save them to Favorites.

### Training
- 104 drills on 11 maps: Abyss, Ascent, Bind, Corrode, Haven, Icebox, Lotus, Pearl, Split, Summit and Sunset.
- 35 new drills on Pearl, Icebox, Sunset, Haven, Ascent, Bind and Lotus. Bots spawn in different spots each round.
- You can pick the enemy rank on each drill, from Iron to Radiant. Each rank has its own records.
- If the bots shoot back and you die, the round ends. On Immortal and up (Diamond on site holds) you get your HP back on every kill.
- Rename drills with the pencil on the card. New drills have a NEW tag.

### Agents
- Press N in a round to switch between Jett, Neon and Chamber.
- Chamber is new: Headhunter on Q, Tour de Force on X, with his own arms.
- Jett now has Blade Storm.
- Neon slides with right-click while sprinting, same as in VALORANT.
- Each agent has their own keybinds in Settings > Controls.
- You can't ADS while dashing, during Updraft or in High Gear.

### Skins
- New Collection tab in the lobby to look at and equip skins.
- New skins:
  - Vandal: Primordium (Base, Cobalt), Kuronami, RGX Blue
  - Phantom: Recon (Base, Red Camo), Helix
  - Sheriff: Arcane
  - Melee: Kuronami no Yaiba, Soulstrife Scythe, Champions 2024 Blade, VCT 2026 Sigil
- Guns without their own kill effect now have one (kill sound + banner for 1 to 5 kills). Same for Smite Ghost, Headhunter, Tour de Force and Blade Storm.
- New default skins: Kuronami knife, Champions 2021 Vandal, Recon Phantom (Red Camo), Arcane Sheriff.
- Default Phantom and Spectre have a proper silencer now.

### Weapons
- Bucky right-click does the air burst.
- New Scope 2x zoom key in Settings > Controls. Also fixed accidentally going to 2x when you click twice fast.
- Left-handed guns show on the left right away.
- Gun sounds don't lag the first time you shoot a new gun anymore.
- Hit sound: Porphyr, or use your own file (Settings > Audio).
- Bots don't flash green when you hit them anymore.

### Creator
- You can put bots on boxes, crates, containers and walls on every map, right where you click.
- Trigger lines: a bot appears when you walk over a line.
- Trades: a bot appears when you kill another one. Two bots can trade each other.
- Random zones, random spots and random starts, so rounds don't repeat.
- More peeker options: strafe width, random strafe or hold, random wait.
- Save bots to a library and reuse them.
- HP refill on kill, drills up to 30 minutes, and longer smokes.
- Resize the arena by dragging its edges, any piece size, invisible floors.
- Multi-select with Shift, fly around in 3D with WASD / Space / Ctrl, and preview only the bots you pick.
- Bots show their real character models in the Detailed view.

### Other stuff
- After a round you can replay it on the position map: your route, the bots and every kill.
- Pre-aim aids are redone: a line to the next bot, a height marker next to your crosshair, kill-order dots and bots on the minimap. They're off for new players.
- Target Workshop is redone, with a preview that shows the real target size.
- Square minimap, VALORANT-style FPS counter, cleaner start screen.
- Stretched resolutions stretch the HUD too.
- The in-game settings look like the lobby settings now, with a crosshair preview.
- The installer lets you pick where to install again, and uninstalling asks if you want to keep your settings.
- The Discord button now goes to the openVaim server.
- You can start the game on another port with `--port=<number>` if 8000 is taken.
- Fixed a security issue in the game's local server.

### Special thanks
- [@firedevill](https://github.com/firedevill) for finding the left-handed gun bug and sending the fix ([#5](https://github.com/unkwsr/open-aim/issues/5)).
- [@odykyi](https://github.com/odykyi) for the `--port` option ([#9](https://github.com/unkwsr/open-aim/pull/9)).

## [1.3.0] - 2026-10-29

**The biggest update yet: a new map, 15 skins, new aiming and effects, a much bigger Studio and smoother performance.**

Your settings and training data are kept when you update.

### New map
- **Sunset**, with six pre-aim drills: A Short, A Tube and B Main, each in **Easy** (bots don't shoot) and **Hard** (bots shoot back).
- Sunset has its own map art on drill cards, favorites and the loading screen.

### Aiming and weapons
- **New aim down sights (ADS)** for the Vandal, Phantom and Guardian: real first-person animations, the gun rises to your eye, a folding reflex sight flips open, and the gun and sight sway and kick together.
- **The same ADS on more guns:** Odin, Ares, Spectre, Stinger and Bulldog now aim like the rifles, with the holo sight.
- **Sniper scopes** for the Marshal, Outlaw and Operator, with a smoother opening.
- Recoil shows on the gun while aiming, even in perfect-accuracy drills.
- Skins keep their own look while aiming: the sight's housing is hidden and the holo dot stays.
- Aim speed, zoom, sensitivity, spread and accuracy are all unchanged; only the look and feel are new.
- The gun and hands move together while strafing.
- Aiming right after pulling out a gun no longer shows the sight off to the side.
- **No more first-shot freezes:** the worst frame while firing dropped from up to 150 ms to under 4 ms.
- Every weapon and skin is prepared before a drill starts, so switching weapons doesn't stutter.
- Phantom, Spectre and Ghost tracers use the same orange as the Vandal.

### Studio
- **3D** and **Detailed** views: Detailed shows the real game map, and 3D shows clean maps.
- **Copycat bots:** record a run, and a bot repeats it and shoots at you. Saved runs are kept in a **Runs** library.
- Bot options: **Unpredictable** movement, **jumps** (0.2–2 m), **occasional crouching** and **slows when hit**.
- Bots jump with the same gravity as you, with a 1.15 m default jump height.
- **Arenas** from 12 to 200 m, with walls up to 40 m; walls up to 200 m long.
- Quiet **Dark** and **Light** looks with **Flat** or **Grid** surfaces; target dots are white in Dark mode and black in Light mode.
- Simpler editing: drag a wall's ends, white circles to resize, one arrow to rotate. Pieces snap to 0.1 m and 5° (hold Alt for free), with undo and redo.
- Dragging pieces in the editor is much smoother.
- Bots face the way you set them, and respawn at their own spawn point.
- Drills started from the Studio return to the Studio when you leave them.

### New skins
- **Vandal:** RGX Yellow, Gaia Orange, Gaia White
- **Phantom:** BlastX
- **Guardian:** Prime
- **Sheriff:** Singularity
- **Ghost:** Smite
- **Operator:** Araxys, Rogue
- **Melee:** Black Market Butterfly, Orange Butterfly, Karambit Damascus Steel, Prime Axe, Silkleaf Fan, Half Life Crowbar
- Several skins have their own firing sounds, kill sounds and kill effects.
- Melee skins have their own equip, attack and **inspect (Y)** animations.
- Pick skins in **Settings**. New defaults: RGX Vandal, BlastX Phantom, Singularity Sheriff, Rogue Operator and Black Market Butterfly.

### Effects and sound
- **New headshot effect:** sharp, quick splashes on bots.
- Hitting a dot (Grid Shooting and other target drills) plays a new hit sound, without the impact burst.
- **Advanced bullet tracers** (Settings > Visuals), with their own look per skin.
- Bots use the original weapon sounds.

### HUD and settings
- **Shooting error graph rebuilt** (Settings > Video > Stats): smaller and more precise, with a thin bar per shot, yellow for spray error and blue for movement error, and lighter on performance.
- **Frame mode** in Video: Unlimited, Match display or Custom (30–1000 FPS, presets 120 / 144 / 165 / 240 / 360).
- The FPS counter sits under the minimap, only while you play.
- The **Interface** setting is back (Video > Smoothness): Enhanced, or Performance with no glass blur.
- Crosshair settings in a match have a bigger preview with the map behind it, the RGX sight and the sniper scope.
- Crosshair changes apply right away in a drill, without leaving it.
- **Import VALORANT settings**, the update panel, Backups and Sens tools all have the square esports look. The update panel shows what's new before you install.
- **Updates** button in the lobby bar, with a red dot when a new version is out.

### Lobby and app
- Opens in **fullscreen** like a real game. F11 switches to a window, and the app remembers your choice.
- Startup screen while the game loads, and a loading card when a drill needs a moment.
- Restarting a drill skips the full loading screen.
- Smooth mouse-wheel scrolling in the lobby and menus.
- A calmer lobby: no glossy sweeps or zooming images, and quick page changes.
- Cleaner card corners, and the filter bar fits on one line while scrolling.
- Favorites work offline.
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
- Fixed an error in the lobby bar that repeated on every page change.

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

- The original site's community links, QR sign-in and language
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
