# Contributing to open-aim

Thanks for helping make the trainer better. This page explains what you can work on and how
to send your change.

## Ways to help

| You want to… | Do this |
| --- | --- |
| Report something broken | Open an issue with the **Bug report** template |
| Suggest a drill | Open an issue with the **Scenario idea** template |
| Add a drill you built | Add a file to `scenarios/` and open a pull request (below) |
| Improve the theme, tools or editor | Open an issue first for big changes, then a pull request |

Good starting points are issues labelled **good first issue**.

## Adding a scenario

1. Try the idea in the app first: build it in the Studio (**Creator** in the top bar) and play
   it a few times to make sure it feels right.
2. Create `scenarios/your-scenario-name.json`. Start from
   [`examples/starter-drill.json`](examples/starter-drill.json), or copy an existing file of the
   same type (`basic`, `flash` or `hold`), and replace the name, description, `shareCode` and scene.
   The format is described in [docs/scenario-format.md](docs/scenario-format.md).
3. Check it:

   ```bash
   node scripts/build-scenarios.mjs --check
   ```

4. Start the app (`npm start` in `app/`) and play your scenario from the lobby.
5. Open a pull request. Say what the drill trains and which map it uses.

A maintainer plays every new scenario before merging it.

## Changing the app

- Each file in `app/` starts with a comment saying what it does. Keep that up to date.
- Match the style of the code around your change: names, comments, indentation (2 spaces).
- One topic per pull request. A theme tweak and a bug fix are two pull requests.
- Test in the real app before you open the pull request, and describe how you tested.

## Commit messages

Short and in the present tense, with a type in front:

```
feat(scenarios): add 6 jiggle-peek drills on Bind
fix(fps-meter): 1% low no longer resets when the menu opens
docs: explain the scenario format
```

Common types: `feat`, `fix`, `perf`, `docs`, `style`, `chore`.

## Rules for files

- **Never commit game files** (maps, models, textures, sounds) or anything from `site/`.
  They aren't ours to share. `.gitignore` already keeps them out.
- Only submit work that's yours, or that's under a license that allows sharing it (say which).
- No personal data: no backups, logs, or files from `%APPDATA%\AimTrainer`.

## Code of conduct

Be kind and constructive. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
