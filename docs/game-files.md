# Game files

The app is a shell around the open-aim web game. It serves the game from two folders, with
our own rebuilt version on top of the original web game files:

```
open-aim/
├─ app/
│  └─ site/         ← our rebuilt game (maps, skins, patched game scripts, local modules)
├─ base/            ← the original web game files underneath
│  ├─ aim/
│  ├─ aim-maps/
│  ├─ aim-agents/
│  ├─ _assets/
│  └─ …
├─ scenarios/
└─ site_meta.json   ← response headers for the game files
```

`app/main.js` serves these on `http://127.0.0.1:8000` and opens them in the app window. For
every request it looks in `app/site/` first and falls back to `base/` (for example a weapon skin
in `app/site/aim-viewmodel/` replaces the one in `base/aim-viewmodel/`).

Before 1.4.0 these folders were called `app/mods/` and `site/`.

## This repository is public, and includes them

This repository keeps `app/site/`, `base/` and `site_meta.json` in git so the app runs straight
after a clone.

- **Credit:** the [ishoutu aim trainer](https://ishoutu.cn/aim), for the original idea and the map compression methods.
- **Size:** `base/` is about 110 MB and `app/site/` about 1.3 GB, mostly 3D maps and textures.

## The long-term goal

Replace the game's maps and models with original or open-licensed work, such as maps made by
the community or models released as CC0. If you make 3D maps or models, see the issues
labelled **assets**.
