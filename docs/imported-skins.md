# Imported skins

Most skins in the Collection were put in by hand, one at a time, with their materials, sounds and effects. An **imported skin** is one taken from the game files in bulk: its model, its colour atlas and its animations, and nothing set by hand. That is how a whole catalogue (615 skins over 18 weapons) can be offered at once.

This repository carries six of them as samples, and the Frenzy's own first-person model, which was missing:

| Weapon | Skin (name in the game files) |
| --- | --- |
| Vandal | Dragon |
| Phantom | Oni |
| Operator | Raygun |
| Sheriff | Soul Stealer |
| Ghost | Ninja 2 |
| Frenzy | Oni 2 |

The full set is about 2.3 GB, too much for the repository. It is a separate download with the same folders as `app/site/`: unpack it over `app/site/` and the Collection lists everything in it.

## What a skin is made of

A skin is named `<line>-<weapon>` (`dragon-vandal`, `oni2-frenzy`). The name is the game's working name for the line, which is not always the name in the store.

| File | What |
| --- | --- |
| `aim-viewmodel/<skin>.json`, `.bin` | the first-person model and its animations |
| `aim-viewmodel/<skin>-color.png` | the colour atlas (2048x2048) |
| `aim-viewmodel/<skin>.equip.json`, `.equip.bin` | the equip animation, for the skins that have their own |
| `aim-ui/collection/<weapon>--<skin>.webp` | the still the Collection shows (`tools/collection-stills.mjs`) |
| `media/skin-fire/<skin>.ogg` | the firing sound, for the skins that have their own in the game |

Two lists say what is installed:

- `aim-ui/collection/imported.json`: `{ "<weapon>": [{ "id": "<skin>", "name": "<shown name>" }] }`. The Collection adds these to the weapon's tab, and gives a tab to a weapon that had none (Frenzy, Classic, Shorty, Bulldog, Bucky, Judge, Ares, Odin, Spectre, Stinger, Marshal, Outlaw).
- `media/skin-fire/index.json`: `{ "<skin>": <volume> }` for the skins with a firing sound of their own. The others fire with the weapon's sound.

The download brings both lists complete, so unpacking it replaces the two files here.

## How it is wired

- `app/collection.js` reads `imported.json` when the app starts and adds the skins to its tabs.
- `app/local-customization.js` keeps a saved skin named `<line>-<weapon>` even though it is on none of its own lists, then drops it (back to the default) once `imported.json` has loaded if the skin is not in it. A skin that is no longer installed therefore never reaches a round. It also plays the skin's firing sound, after the skins whose sounds are set by hand.
- `tools/patch-imported-skins.cjs` makes the three changes the compiled game needs (marker `imported-skins-v1`, safe to run again): the model loader loads `<skin>.json` for a weapon whose saved skin is named that way, the equip-preview loader does the same for the Frenzy, and the key that says which model a weapon is showing counts the skin of the weapons that had none before.

## Limits

- Colour only: no normal or roughness maps, no glow, no effects, no variants, no kill banner or finisher. Skins put in by hand look better; these look like the skin under flat light.
- The firing sound is one mix per skin, made from the game's layers by name; the balance between the layers is a guess.
- 82 of the 615 have no equip animation of their own and use the weapon's.

## Checked

In a hidden copy of the app on this branch, driven through its debugging port:

- The Collection: the six samples are on their weapons' tabs with their stills, the Frenzy has a tab, and Equip saves each of them.
- After a reload the six are still equipped; three saved skins named like imported ones but not on the list were put back to the default.
- A round with the Dragon Vandal equipped: the model shows in first person.
- No page errors from this change.

Not checked: the other five samples in a round, the firing sounds by ear, and the full set on this version of the game (it was built and used on 1.4.0).
