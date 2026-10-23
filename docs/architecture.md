# How open-aim works

## The big picture

```
┌──────────────── Electron app (app/main.js) ────────────────┐
│                                                            │
│  Local web server 127.0.0.1:8000                           │
│    ├─ serves the game from site/                           │
│    ├─ swaps in files from app/mods/                        │
│    ├─ adds the extra scenarios (training-set.json)         │
│    └─ answers account and leaderboard requests locally     │
│                                                            │
│  Chromium window → http://localhost:8000/aim               │
│    └─ on every page, injects:                              │
│         theme-esports.css   ui.css   offline.css           │
│         lobby-bar.js   player-tools.js   studio-launch.js  │
│                                                            │
│  Studio → http://localhost:8000/studio/  (app/studio/)     │
│    └─ 2D map editor + 3D preview (three.js)                │
│                                                            │
│  Every request to the internet is blocked.                 │
└────────────────────────────────────────────────────────────┘
```

## Files in `app/`

| File | Job |
| --- | --- |
| `main.js` | Starts the server, opens the window, blocks the internet, injects styles and scripts |
| `preload.js` | Small bridge between the page and the app (fullscreen, backups) |
| `backups.js` | Backs up player data at every launch (last 10 kept), restore, export, import |
| `theme-esports.css` | The esports look: colors, type, motion, glass |
| `ui.css` | Compact pause and results menus |
| `offline.css` | Hides sign-in, leaderboards and other online-only parts |
| `lobby-bar.js` | Top bar (Favorites, Creator, Quick start), FPS meter, smooth scrolling |
| `player-tools.js` | Backups and Sens tools panels |
| `studio/` | The Studio: `studio.js` (editor UI), `drill.js` (turns a layout into a playable drill), `map-data.js` (map outlines), `view3d.js` (3D preview), `vendor/` (three.js, MIT) |
| `studio-store.js` | Saves your Studio drills so they show up in the lobby |
| `studio-launch.js` | Starts a Studio drill in the game and brings you back to the Studio after |
| `shooting-error.js` | The shooting error graph on the results screen |
| `translations.js`, `english-fixes.js` | Proper English for the interface |
| `test-maps.mjs` | Smoke test: loads several maps in a running app and reports errors |

## Where player data lives

The game keeps history, bests, replays, scenes and settings in its own browser storage
(localStorage and IndexedDB), which Electron stores in `%APPDATA%\AimTrainer`.
Backups go to `%APPDATA%\AimTrainer-Backups`.

> **Careful:** running the app from this repository uses the same data folder as an installed
> AimTrainer, and makes a backup at every start. Close the installed app before running
> `npm start`, since only one copy can run at a time.

## Extra scenarios

`scripts/build-scenarios.mjs` reads every file in `scenarios/` and writes
`app/training-set.json`. `main.js` adds those entries to the game's training list and serves
their scenes, so they play exactly like built-in scenarios, with results and history.
