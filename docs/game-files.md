# Game files

The app is a shell around the open-aim web game. To run, it needs the game's files in a
`site/` folder at the root of the repository:

```
open-aim/
├─ app/
├─ scenarios/
├─ site/            ← game files go here (not in git)
│  ├─ aim/
│  ├─ aim-maps/
│  ├─ aim-agents/
│  ├─ _assets/
│  └─ …
└─ site_meta.json   ← response headers for the site files (not in git)
```

`app/main.js` serves this folder on `http://127.0.0.1:8000` and opens it in the app window.

## Why they aren't in the repository

- **Size:** the site folder is about 190 MB, mostly 3D maps and textures. Git is made for
  text, and GitHub warns about files over 50 MB.
- **Rights:** some of the maps, character models, weapon models and sounds come from a
  commercial game. An open-source license can only cover work you own, so those files can't
  be published here.

`.gitignore` lists `site/`, `site_meta.json` and `app/mods/`, so git never picks them up,
even by accident.

## Optional: mods

Files in `app/mods/` replace the site file at the same path (for example a weapon skin in
`app/mods/aim-viewmodel/`). They're also kept out of git.

## The long-term goal

Replace every file we can't share with original or open-licensed work, such as maps made by the
community or models released as CC0. Then the whole trainer can live in this repository and
anyone can download it. If you make 3D maps or models, see the issues labelled **assets**.
